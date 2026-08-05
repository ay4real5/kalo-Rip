import type { Booking, Customer, Instructor } from "@prisma/client";
import { formatLessonTime } from "@/app/lib/timezone";

// Shared formatter — see the note on formatLessonTime for why this must never
// be a bare Intl.DateTimeFormat.
const formatBookingTime = formatLessonTime;

/**
 * Send an SMS via Twilio. Returns true if sent, false if Twilio is not configured
 * or the recipient has no phone.
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.log("[SMS] (no Twilio) to=" + to + " body=" + body.slice(0, 80));
    return false;
  }

  if (!to || to.length < 6) {
    return false;
  }

  try {
    const Twilio = (await import("twilio")).default;
    const client = new (Twilio as unknown as new (sid: string, token: string) => {
      messages: { create: (opts: { from: string; to: string; body: string }) => Promise<unknown> };
    })(accountSid, authToken);
    await client.messages.create({ from, to, body });
    return true;
  } catch (error) {
    console.error("[SMS] send failed:", error);
    return false;
  }
}

export async function sendBookingConfirmation(opts: {
  customer: Customer & { user?: { name: string | null; email: string | null; phone: string | null } | null };
  instructor: Instructor & { user?: { name: string | null } | null };
  booking: Booking;
}) {
  const customerName = opts.customer.user?.name ?? "";
  const instructorName = opts.instructor.user?.name ?? "your instructor";
  const message =
    `Hi ${customerName}, your driving lesson is confirmed for ${formatBookingTime(opts.booking.startsAt)} with ${instructorName}. ` +
    `Reply STOP to opt out of messages.`;

  const phone = opts.customer.user?.phone ?? "";
  const smsOptIn = (opts.customer as { smsOptIn?: boolean }).smsOptIn !== false;
  const sent = smsOptIn ? await sendSms(phone, message) : false;

  return { sent, channel: phone && smsOptIn ? "sms" : "none" };
}

export async function sendLessonReminder(opts: {
  customer: Customer & { user?: { name: string | null; phone: string | null } | null };
  instructor: Instructor & { user?: { name: string | null } | null };
  booking: Booking;
}) {
  const message =
    `Reminder: driving lesson with ${opts.instructor.user?.name ?? "your instructor"} ` +
    `tomorrow at ${formatBookingTime(opts.booking.startsAt)}.`;

  const phone = opts.customer.user?.phone ?? "";
  const smsOptIn = (opts.customer as { smsOptIn?: boolean }).smsOptIn !== false;
  if (!smsOptIn) return { sent: false };
  return { sent: await sendSms(phone, message) };
}

/**
 * Tell the learner their time is held, without naming a driver.
 *
 * Deliberately does not say "confirmed with X" — nobody has been assigned yet.
 * Promising a driver here and changing it later is worse than saying nothing.
 */
export async function sendSlotSecured(opts: {
  customer: Customer & { user?: { name: string | null; phone: string | null } | null };
  booking: Booking;
}) {
  const name = opts.customer.user?.name ?? "";
  const message =
    `Hi ${name}, your driving lesson slot on ${formatBookingTime(opts.booking.startsAt)} is secured. ` +
    `We're matching you with an instructor and they'll be in touch shortly. Reply STOP to opt out.`;

  const phone = opts.customer.user?.phone ?? "";
  const smsOptIn = (opts.customer as { smsOptIn?: boolean }).smsOptIn !== false;
  if (!phone || !smsOptIn) return { sent: false };
  return { sent: await sendSms(phone, message) };
}

/**
 * Alert the school that a lesson is waiting to be allocated.
 *
 * Goes to the same number as the human handoff — the person who answers
 * transferred calls is the person who assigns drivers.
 */
export async function notifyAdminOfPendingBooking(booking: {
  id: string;
  startsAt: Date;
  customer?: { postcode?: string; transmission?: string; user?: { name: string | null } | null } | null;
}) {
  const { getHandoffNumber } = await import("@/app/lib/settings");
  const to = await getHandoffNumber();

  const who = booking.customer?.user?.name ?? "A learner";
  const where = booking.customer?.postcode ? ` in ${booking.customer.postcode}` : "";
  const gearbox = booking.customer?.transmission
    ? ` (${booking.customer.transmission.toLowerCase()})`
    : "";

  const message =
    `New lesson to assign: ${who}${where}${gearbox} — ` +
    `${formatBookingTime(booking.startsAt)}. Open the admin portal to allocate a driver.`;

  return { sent: await sendSms(to, message) };
}

export async function sendInstructorNotification(opts: {
  instructor: Instructor & { user?: { name: string | null; phone: string | null } | null };
  message: string;
}) {
  const phone = opts.instructor.user?.phone ?? "";
  return { sent: await sendSms(phone, opts.message) };
}
