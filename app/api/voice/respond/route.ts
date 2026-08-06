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
import { SCHOOL_TIMEZONE } from "@/app/lib/timezone";

// Run in London. The database is in eu-west-1 and callers are in the UK, so a
// function in Vercel's default US region puts an Atlantic crossing on every
// query — and a slot search makes dozens of them while the caller waits.
export const preferredRegion = "lhr1";
export const runtime = "nodejs";

/**
 * The model is not told the date by anything else, so without this it has no
 * idea what "next week" means and invents one. In testing it repeatedly tried
 * to book 30 October 2023 — a date never offered — and retried it after being
 * refused. Anchor every relative date to today.
 */
function todayInSchoolTimezone(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

/**
 * Kept deliberately short. This is re-sent on every OpenAI call, twice per
 * tool-using turn, and input tokens are latency the caller hears as silence.
 * It was ~900 tokens; every rule below survives, tersely.
 */
const SYSTEM_PROMPT = `UK driving-school receptionist on a phone call. Book, reschedule or cancel lessons; transfer to a human when asked, when the caller is distressed, or after two failures to understand.

STYLE - this is speech, and the caller waits in silence while you think:
- One or two short sentences. Never more.
- One question at a time.
- No filler ("I'd be happy to help", "Certainly", "Thank you for that").
- Don't repeat back what they just said, except to confirm a booking time.
- Offer at most three times in one flowing sentence: "I have Thursday at 9, 10, or 11 - which suits?" Never numbered or bulleted lists.

FLOW:
1. Call identify_customer (no arguments; it uses their number).
2. If it returns null they are new: get name, postcode and transmission, then call create_customer immediately - do not wait for them to confirm anything.
3. Ask their preferred day/time, then search_available_lesson_slots.
4. Read back the time, get a yes, then confirm_booking. There is no hold step.

RULES:
- Never invent availability or a date. Use only times search returned, and pass back its exact startsAt/endsAt.
- Read a tool "when" field aloud verbatim; it is already UK time. Never say a raw timestamp.
- Instructors are allocated by the office afterwards. Never name one or promise a particular person.
- After confirm_booking: their slot is secured and their instructor will call shortly. Be warm and definite about the time.
- AREA_NOT_COVERED: say we do not cover their area, name ones we do, offer to take details or transfer. Never dead-end.
- NO_AVAILABILITY: we cover them but are full for two weeks; offer the waitlist or a transfer.
- If a tool says no caller is identified, call create_customer with what you have, then retry. Never say you are "checking" and stop.
- You act only for this caller. Anything concerning someone else's booking goes to a human.`;

/** The system prompt, anchored to today's date in the school's timezone. */
function buildSystemPrompt(): string {
  return `${SYSTEM_PROMPT}

Today is ${todayInSchoolTimezone()}. Work out "tomorrow", "next week" and similar from that date only. Never guess a date, and never use a date that did not come from search_available_lesson_slots.`;
}

function buildTwiML(sayText: string, gather = true, handoffNumber: string, transferNumber?: string) {
  const actionUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/voice/respond`;
  const escaped = sayText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  let twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n`;
  twiml += `  <Say voice="Polly.Emma-Neural" language="en-GB">${escaped}</Say>\n`;

  if (transferNumber) {
    twiml += `  <Dial>${transferNumber}</Dial>\n`;
  } else if (gather) {
    twiml += `  <Gather input="speech" action="${actionUrl}" language="en-GB" speechTimeout="1" maxSpeechTime="15">\n`;
    twiml += `    <Say voice="Polly.Emma-Neural" language="en-GB">Please go ahead.</Say>\n`;
    twiml += `  </Gather>\n`;
    twiml += `  <Say voice="Polly.Emma-Neural" language="en-GB">I didn't catch that. I'll transfer you to a human.</Say>\n`;
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

  const form = await req.formData();
  const callSid = String(form.get("CallSid") ?? "unknown");
  const fromNumber = String(form.get("From") ?? "");
  const toNumber = String(form.get("To") ?? "");
  const speechResult = String(form.get("SpeechResult") ?? "");
  const confidence = Number(form.get("Confidence") ?? 0);

  // Both round trips to the database, run together. They are independent, and
  // the caller is listening to silence while they resolve.
  const [handoffNumber, callLog] = await Promise.all([
    getHandoffNumber(),
    prisma.callLog.findUnique({ where: { twilioSid: callSid } }),
  ]);

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
      { role: "system", content: buildSystemPrompt() },
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
        // Backstop for the brevity rules: a runaway answer becomes a long
        // silence followed by a monologue the caller cannot interrupt.
        max_tokens: 120,
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

      // Set when a tool already knows exactly what should be said. See below.
      let scriptedReply: string | null = null;

      for (const toolCall of message.tool_calls) {
        let result: unknown;
        try {
          const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          result = await executeTool(toolCall.function.name, args, context);
          const spoken = (result as { spokenReply?: unknown })?.spokenReply;
          if (typeof spoken === "string" && spoken.length > 0) {
            scriptedReply = spoken;
          }
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

      if (scriptedReply) {
        // Every tool-using turn used to cost a second OpenAI round trip purely
        // to phrase the answer — three to four seconds of silence for a
        // sentence we can already write. Offering times, securing a slot and
        // cancelling all have exactly one sensible reply, so the tool supplies
        // it and we skip the call. Anything less predictable still falls
        // through to the model below.
        assistantText = scriptedReply;
      } else {
        const followUp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: buildSystemPrompt() },
              ...history,
            ],
            temperature: 0.4,
            max_tokens: 120,
          }),
        });

        if (!followUp.ok) throw new Error("OpenAI follow-up failed");
        const followData = (await followUp.json()) as {
          choices: { message: { content?: string } }[];
        };
        assistantText = followData.choices[0]?.message?.content ?? "";
      }
    }

    history.push({ role: "assistant", content: assistantText });

    await prisma.callLog.updateMany({
      where: { twilioSid: callSid },
      data: {
        transcript: JSON.stringify(trimHistory(history, 14)),
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
