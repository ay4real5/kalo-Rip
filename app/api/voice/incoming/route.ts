import { prisma } from "@/app/lib/prisma";
import { getHandoffNumber } from "@/app/lib/settings";
import { verifyTwilioSignature } from "@/app/lib/twilio-verify";
import { NextResponse } from "next/server";

// Run in London. The database is in eu-west-1 and callers are in the UK, so a
// function in Vercel's default US region puts an Atlantic crossing on every
// query — and a slot search makes dozens of them while the caller waits.
export const preferredRegion = "lhr1";
export const runtime = "nodejs";

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
  const handoffNumber = await getHandoffNumber();
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Emma-Neural" language="en-GB">
    Hello, you have reached the driving school booking line. This is an automated assistant. We may record this call for training and quality purposes. How can I help you today?
  </Say>
  <Gather input="speech" action="${actionUrl}" language="en-GB" speechTimeout="1" maxSpeechTime="10">
    <Say voice="Polly.Emma-Neural" language="en-GB">You can say, I want to book a driving lesson.</Say>
  </Gather>
  <Say voice="Polly.Emma-Neural" language="en-GB">I didn't catch that. Let me transfer you to a human.</Say>
  <Dial>${handoffNumber}</Dial>
</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
