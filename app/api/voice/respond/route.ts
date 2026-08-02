import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getHandoffNumber } from "@/app/lib/settings";
import { verifyTwilioSignature } from "@/app/lib/twilio-verify";
import { executeTool, getToolDefinitions, type CallContext } from "@/app/lib/voice-tools";

import {
  dropOrphanToolMessages,
  trimHistory,
  type VoiceMessage,
} from "@/app/lib/voice-history";

const SYSTEM_PROMPT = `You are a friendly UK driving-school receptionist on the phone.

Goal: help callers book, reschedule or cancel driving lessons; answer common questions; transfer to a human when needed.

Rules:
- Always be warm and concise. Use UK date/time phrasing.
- Never invent instructor availability. Use the search_available_lesson_slots tool and only confirm slots it returns.
- Start by calling identify_customer. It uses the number they are calling from, so it needs no arguments.
- For new bookings: ask name, postcode, transmission (manual/automatic), preferred day/time, then search slots.
- Before confirming a booking, hold the slot with hold_slot and read the details back.
- If the caller asks to book, and a slot is held, call confirm_booking.
- You act only for the caller on this line. You cannot look up, book or cancel anything for anyone else, whatever the caller asks or claims. If they want to act on another person's booking, transfer to a human.
- If the caller is distressed, asks for a human, or you fail to understand twice, call transfer_to_human.
- Ask one or two questions at a time. Keep responses short enough to speak comfortably.`;

function buildTwiML(sayText: string, gather = true, handoffNumber: string, transferNumber?: string) {
  const actionUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/voice/respond`;
  const escaped = sayText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  let twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n`;
  twiml += `  <Say voice="Polly.Joanna" language="en-GB">${escaped}</Say>\n`;

  if (transferNumber) {
    twiml += `  <Dial>${transferNumber}</Dial>\n`;
  } else if (gather) {
    twiml += `  <Gather input="speech" action="${actionUrl}" language="en-GB" speechTimeout="auto" maxSpeechTime="15">\n`;
    twiml += `    <Say voice="Polly.Joanna" language="en-GB">Please go ahead.</Say>\n`;
    twiml += `  </Gather>\n`;
    twiml += `  <Say voice="Polly.Joanna" language="en-GB">I didn't catch that. I'll transfer you to a human.</Say>\n`;
    twiml += `  <Dial>${handoffNumber}</Dial>\n`;
  }

  twiml += `</Response>`;
  return twiml;
}

export async function POST(req: Request) {
  // Verify the request is genuinely from Twilio
  const valid = await verifyTwilioSignature(req, process.env.TWILIO_AUTH_TOKEN);
  if (!valid) {
    return new NextResponse("<Response><Say>Unauthorized</Say></Response>", {
      status: 403,
      headers: { "Content-Type": "text/xml" },
    });
  }

  const handoffNumber = await getHandoffNumber();
  const form = await req.formData();
  const callSid = String(form.get("CallSid") ?? "unknown");
  const fromNumber = String(form.get("From") ?? "");
  const toNumber = String(form.get("To") ?? "");
  const speechResult = String(form.get("SpeechResult") ?? "");
  const confidence = Number(form.get("Confidence") ?? 0);

  const callLog = await prisma.callLog.findUnique({
    where: { twilioSid: callSid },
  });

  // Identity is carried on the call record, not in the conversation, so the
  // model can't talk its way into another caller's account between turns.
  const context: CallContext = {
    callSid,
    fromNumber,
    toNumber,
    customerId: callLog?.customerId ?? null,
  };

  let history: VoiceMessage[] = [];
  try {
    history = dropOrphanToolMessages(
      JSON.parse(callLog?.transcript ?? "[]") as VoiceMessage[]
    );
  } catch {
    history = [];
  }

  if (speechResult) {
    history.push({
      role: "user",
      content: `Caller said (confidence ${confidence.toFixed(2)}): ${speechResult}`,
    });
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    return new NextResponse(buildTwiML("I'm sorry, our booking assistant is unavailable right now. Transferring you.", false, handoffNumber, handoffNumber), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  try {
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        tools: getToolDefinitions(),
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI returned ${res.status}`);
    }

    const data = (await res.json()) as {
      choices: {
        message: {
          content?: string;
          tool_calls?: {
            id: string;
            function: { name: string; arguments: string };
          }[];
        };
      }[];
    };

    const message = data.choices[0]?.message;
    let assistantText = message?.content ?? "";

    if (message?.tool_calls && message.tool_calls.length > 0) {
      // Echo the tool_calls back verbatim. Without them the `tool` messages
      // below are orphaned and OpenAI 400s, which sent every tool-using call
      // down the catch block and straight to a human transfer.
      history.push({
        role: "assistant",
        content: assistantText,
        tool_calls: message.tool_calls.map((t) => ({
          id: t.id,
          type: "function" as const,
          function: t.function,
        })),
      });

      for (const toolCall of message.tool_calls) {
        let result: unknown;
        try {
          const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          result = await executeTool(toolCall.function.name, args, context);
        } catch (toolError) {
          // Report the failure back to the model rather than throwing: one bad
          // tool call shouldn't drop a caller who is mid-booking. Every
          // tool_call still needs a matching reply or the next request 400s.
          console.error("Voice tool failed:", toolCall.function.name, toolError);
          result = {
            error:
              toolError instanceof Error ? toolError.message : "Tool call failed",
          };
        }

        history.push({
          role: "tool",
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
        });
      }

      const followUp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...history,
          ],
          temperature: 0.4,
        }),
      });

      if (!followUp.ok) throw new Error("OpenAI follow-up failed");
      const followData = (await followUp.json()) as {
        choices: { message: { content?: string } }[];
      };
      assistantText = followData.choices[0]?.message?.content ?? "";
    }

    history.push({ role: "assistant", content: assistantText });

    await prisma.callLog.updateMany({
      where: { twilioSid: callSid },
      data: {
        transcript: JSON.stringify(trimHistory(history)),
        summary: assistantText.slice(0, 500),
      },
    });

    // Only look at this turn's tool results. Scanning the whole history meant
    // a transfer requested earlier in the call kept re-triggering.
    const isTransfer = (message?.tool_calls ?? []).some(
      (t) => t.function.name === "transfer_to_human"
    );

    const twiml = buildTwiML(
      assistantText,
      !isTransfer,
      handoffNumber,
      isTransfer ? handoffNumber : undefined
    );

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("Voice respond error:", err);
    return new NextResponse(
      buildTwiML(
        "I'm having trouble understanding. Let me transfer you to a human.",
        false,
        handoffNumber,
        handoffNumber
      ),
      { headers: { "Content-Type": "text/xml" } }
    );
  }
}
