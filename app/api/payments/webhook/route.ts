import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

// Stripe webhook handler. Verifies the signature and marks bookings as paid.
// To enable: set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET on Vercel,
// then point a Stripe webhook to https://kalo-rip.vercel.app/api/payments/webhook
// listening for `checkout.session.completed` events.
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!webhookSecret || !apiKey) {
    return NextResponse.json({ error: "Webhooks not configured" }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(apiKey);
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as { metadata?: { bookingId?: string }; id: string };
      const bookingId = session.metadata?.bookingId;
      if (bookingId) {
        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            paidAt: new Date(),
            paymentReference: session.id,
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook failed" },
      { status: 400 }
    );
  }
}
