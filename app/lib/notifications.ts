import type { Booking, Customer, Instructor } from "@prisma/client";

interface NotificationPayload {
  to: string;
  body: string;
}

function formatBookingTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).format(date);
}

export async function sendBookingConfirmation(opts: {
  customer: Customer & { user?: { name: string | null; email: string | null } | null };
  instructor: Instructor & { user?: { name: string | null } | null };
  booking: Booking;
}) {
  const customerName = opts.customer.user?.name ?? "";
  const instructorName = opts.instructor.user?.name ?? "your instructor";
  const message =
    `Hi ${customerName}, your driving lesson is confirmed for ${formatBookingTime(opts.booking.startsAt)} with ${instructorName}. ` +
    `Reply STOP to opt out of messages.`;

  const payload: NotificationPayload = {
    to: opts.customer.user?.email ? opts.customer.user.email : "",
    body: message,
  };

  if (process.env.NODE_ENV === "production") {
    // TODO: wire Twilio SMS / SendGrid email here
    // await twilioClient.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: phone, body });
    console.log("[SMS]", payload);
  } else {
    console.log("[DEV SMS]", payload);
  }

  return { sent: true, channel: opts.customer.user?.email ? "email" : "sms" };
}

export async function sendLessonReminder(opts: {
  customer: Customer & { user?: { name: string | null } | null };
  instructor: Instructor & { user?: { name: string | null } | null };
  booking: Booking;
}) {
  const message =
    `Reminder: driving lesson with ${opts.instructor.user?.name ?? "your instructor"} ` +
    `tomorrow at ${formatBookingTime(opts.booking.startsAt)}.`;

  console.log("[DEV REMINDER]", message);
  return { sent: true };
}

export async function sendInstructorNotification(opts: {
  instructor: Instructor & { user?: { name: string | null; phone: string | null } | null };
  message: string;
}) {
  console.log("[DEV INSTRUCTOR NOTIFY]", opts.instructor.user?.phone, opts.message);
  return { sent: true };
}
