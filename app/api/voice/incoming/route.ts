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

  const actionUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/voice/respond`;
  // No <Dial> fallback here. Silence used to fall straight through to a
  // transfer, so a caller who paused before speaking was handed to a human
  // before saying a word. actionOnEmptyResult sends silence back to /respond,
  // which re-prompts twice before giving up.
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Emma-Neural" language="en-GB">
    Hello, you've reached the driving school booking line. How can I help?
  </Say>
  <Gather input="speech" action="${actionUrl}?silent=0" method="POST" language="en-GB" speechTimeout="1" timeout="7" maxSpeechTime="15" actionOnEmptyResult="true"/>
</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
