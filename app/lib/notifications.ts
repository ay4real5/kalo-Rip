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

export async function sendInstructorNotification(opts: {
  instructor: Instructor & { user?: { name: string | null; phone: string | null } | null };
  message: string;
}) {
  const phone = opts.instructor.user?.phone ?? "";
  return { sent: await sendSms(phone, opts.message) };
}
