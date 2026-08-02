/**
 * Payment integration layer.
 *
 * This is a placeholder that supports Stripe Checkout for taking lesson
 * deposits or full payments at booking time.
 *
 * To enable:
 *  1. npm i stripe @stripe/stripe-js
 *  2. Set STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY env vars
 *  3. Uncomment the real Stripe calls below
 *
 * For now, createPaymentSession returns a null URL so the booking flow
 * still works without payment configured.
 */

interface PaymentSession {
  url: string | null;
  sessionId: string | null;
}

export async function createPaymentSession(_params: {
  bookingId: string;
  amountPence: number;
  customerEmail: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<PaymentSession> {
  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    console.log("[payments] Stripe not configured — skipping payment session");
    return { url: null, sessionId: null };
  }

  // Real implementation (uncomment after installing stripe):
  //
  // const Stripe = (await import("stripe")).default;
  // const stripe = new Stripe(apiKey);
  // const session = await stripe.checkout.sessions.create({
  //   payment_method_types: ["card"],
  //   customer_email: params.customerEmail,
  //   line_items: [
  //     {
  //       price_data: {
  //         currency: "gbp",
  //         product_data: { name: params.description },
  //         unit_amount: params.amountPence,
  //       },
  //       quantity: 1,
  //     },
  //   ],
  //   mode: "payment",
  //   success_url: params.successUrl,
  //   cancel_url: params.cancelUrl,
  //   metadata: { bookingId: params.bookingId },
  // });
  // return { url: session.url, sessionId: session.id };

  return { url: null, sessionId: null };
}

export async function markBookingPaid(bookingId: string, sessionId: string): Promise<void> {
  const { prisma } = await import("@/app/lib/prisma");
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      paidAt: new Date(),
      paymentReference: sessionId,
    },
  });
}
