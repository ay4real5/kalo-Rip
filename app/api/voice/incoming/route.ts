import { prisma } from "@/app/lib/prisma";
import { verifyTwilioSignature } from "@/app/lib/twilio-verify";
import { NextResponse } from "next/server";

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

  await prisma.callLog
    .upsert({
      where: { twilioSid: callSid },
      update: {},
      create: {
        twilioSid: callSid,
        fromNumber,
        toNumber,
        status: "IN_PROGRESS",
      },
    })
    .catch(() => undefined);

  return new NextResponse(buildTwiML(fromNumber, toNumber), {
    headers: { "Content-Type": "text/xml" },
  });
}

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Which voice implementation answers the call.
 *
 * `realtime` streams audio to the bridge on Railway — sub-second, interruptible.
 * `gather` is the original transcribe-think-speak flow, kept working as a
 * fallback: this is a live phone line, and flipping VOICE_MODE back takes
 * effect on the next call with no deploy. Defaults to gather, so a missing or
 * mistyped variable lands on the implementation known to work.
 */
function buildTwiML(fromNumber: string, toNumber: string): string {
  const bridgeUrl = process.env.VOICE_BRIDGE_WSS_URL;

  if (process.env.VOICE_MODE === "realtime" && bridgeUrl) {
    // No <Say> before <Connect>: the bridge greets as soon as the stream opens,
    // and a Polly greeting here would add exactly the delay this replaces.
    // The caller's number travels as a Parameter because identity must come
    // from Twilio, never from anything the model says.
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(bridgeUrl)}">
      <Parameter name="from" value="${escapeXml(fromNumber)}"/>
      <Parameter name="to" value="${escapeXml(toNumber)}"/>
    </Stream>
  </Connect>
</Response>`;
  }

  if (process.env.VOICE_MODE === "realtime" && !bridgeUrl) {
    console.error("VOICE_MODE=realtime but VOICE_BRIDGE_WSS_URL is unset; using gather.");
  }

  const actionUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/voice/respond`;
  // No <Dial> fallback here. Silence used to fall straight through to a
  // transfer, so a caller who paused before speaking was handed to a human
  // before saying a word. actionOnEmptyResult sends silence back to /respond,
  // which re-prompts twice before giving up.
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Emma-Neural" language="en-GB">
    Hello, you've reached the driving school booking line. How can I help?
  </Say>
  <Gather input="speech" action="${actionUrl}?silent=0" method="POST" language="en-GB" speechTimeout="1" timeout="7" maxSpeechTime="15" actionOnEmptyResult="true"/>
</Response>`;
}
