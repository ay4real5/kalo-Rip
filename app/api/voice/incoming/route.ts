import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
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
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-GB">
    Hello, you have reached the driving school booking line. This is an automated assistant. We may record this call for training and quality purposes. How can I help you today?
  </Say>
  <Gather input="speech" action="${actionUrl}" language="en-GB" speechTimeout="auto" maxSpeechTime="10">
    <Say voice="Polly.Joanna" language="en-GB">You can say, I want to book a driving lesson.</Say>
  </Gather>
  <Say voice="Polly.Joanna" language="en-GB">I didn't catch that. Let me transfer you to a human.</Say>
  <Dial>+441234567890</Dial>
</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
