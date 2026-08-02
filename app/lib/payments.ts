/**
 * Payment integration layer — ON HOLD, NOT WIRED UP.
 *
 * Taking payments is deferred pending compliance review. The API routes that
 * used this (app/api/payments/{checkout,success,webhook}) have been removed;
 * nothing in the app can create a charge or mark a booking paid.
 *
 * This stub is kept so the work isn't lost. Before re-enabling, note that the
 * removed `success` route marked bookings paid straight from a query param
 * with no auth and no Stripe verification — payment state must only ever be
 * written by a signature-verified webhook.
 *
 * To revive: restore the routes from git history (they were removed in the
 * commit following b2c874d), then:
 *  1. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET
 *  2. Uncomment the real Stripe calls below
 *  3. Verify amount_total against booking.pricePence, and make the webhook
 *     idempotent on the Stripe event id
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
