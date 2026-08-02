/**
 * Verify that a request is a genuine Twilio webhook by checking the
 * X-Twilio-Signature header against the Twilio auth token.
 *
 * Fails CLOSED in production: a missing TWILIO_AUTH_TOKEN rejects the request
 * rather than waving it through. Skipping verification is a local-dev
 * convenience only — previously a missing or misnamed env var on the host
 * silently left the voice webhooks open to anyone.
 *
 * Note: signatures are computed over the URL Twilio called. Behind a proxy
 * (Vercel) `request.url` may report the internal origin, so set
 * TWILIO_WEBHOOK_BASE_URL to the public origin if verification rejects
 * genuine requests.
 */
export async function verifyTwilioSignature(
  request: Request,
  authToken: string | undefined
): Promise<boolean> {
  if (!authToken) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "TWILIO_AUTH_TOKEN is not set — rejecting webhook. Set it to accept Twilio traffic."
      );
      return false;
    }
    console.warn("TWILIO_AUTH_TOKEN not set — skipping signature check (dev only)");
    return true;
  }

  const signature = request.headers.get("x-twilio-signature");
  if (!signature) {
    return false;
  }

  const url = resolveWebhookUrl(request);
  // Clone the body before reading so it can be re-read later
  const rawBody = await request.clone().text();

  // Build the validation string
  const params = new URLSearchParams(rawBody);
  const sortedKeys = Array.from(params.keys()).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + (params.get(key) ?? "");
  }

  // Twilio uses HMAC-SHA1 with the auth token as the key
  const crypto = await import("crypto");
  const hmac = crypto.createHmac("sha1", authToken).update(data, "utf8").digest("base64");

  const expected = Buffer.from(hmac);
  const received = Buffer.from(signature);
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

/**
 * The origin Twilio signed against. `request.url` is rewritten by some hosts,
 * which breaks the signature, so an explicit override wins when configured.
 */
function resolveWebhookUrl(request: Request): string {
  const base = process.env.TWILIO_WEBHOOK_BASE_URL;
  if (!base) return request.url;

  const incoming = new URL(request.url);
  const target = new URL(base);
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  return target.toString();
}
