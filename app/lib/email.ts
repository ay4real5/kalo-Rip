interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send a transactional email.
 *
 * In production this should use a provider like Resend, SendGrid or Postmark.
 * Set RESEND_API_KEY (or equivalent) and swap the implementation below.
 *
 * For now we log to the server console so the booking flow still works
 * without an email provider configured.
 */
export async function sendEmail({ to, subject, html }: EmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromDomain = process.env.EMAIL_FROM_DOMAIN ?? "kalo.rip";

  if (!apiKey) {
    console.log(`[email] (no provider) to=${to} subject="${subject}"`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Kalo Rip <noreply@${fromDomain}>`,
        to,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[email] Resend error:", text);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] send failed:", error);
    return false;
  }
}

export function bookingConfirmationHtml({
  instructorName,
  startsAt,
  endsAt,
  pricePence,
  customerName,
}: {
  instructorName: string;
  startsAt: string;
  endsAt: string;
  pricePence: number;
  customerName: string;
}) {
  const start = new Date(startsAt).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const end = new Date(endsAt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const price = `£${(pricePence / 100).toFixed(2)}`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f172a;">
      <div style="background: #10b981; color: white; padding: 16px 24px; border-radius: 12px 12px 0 0; font-size: 18px; font-weight: bold;">
        Booking confirmed
      </div>
      <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <p>Hi ${customerName},</p>
        <p>Your driving lesson has been booked. Here are the details:</p>
        <table style="width: 100%; margin: 16px 0; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #64748b;">Instructor</td><td style="padding: 8px 0; font-weight: 600;">${instructorName}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Date</td><td style="padding: 8px 0; font-weight: 600;">${start}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Ends</td><td style="padding: 8px 0; font-weight: 600;">${end}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Price</td><td style="padding: 8px 0; font-weight: 600;">${price}</td></tr>
        </table>
        <p style="color: #64748b; font-size: 14px;">Need to cancel or reschedule? Reply to this email or call us.</p>
        <p style="margin-top: 24px; color: #94a3b8; font-size: 12px;">Kalo Rip — AI receptionist for driving schools.</p>
      </div>
    </div>
  `;
}
