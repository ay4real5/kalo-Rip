/**
 * Verify that a request is a genuine Twilio webhook by checking the
 * X-Twilio-Signature header against the Twilio auth token.
 *
 * If TWILIO_AUTH_TOKEN is not set, verification is skipped (dev mode).
 */
export async function verifyTwilioSignature(
  request: Request,
  authToken: string | undefined
): Promise<boolean> {
  if (!authToken) {
    // Dev mode — skip verification
    return true;
  }

  const signature = request.headers.get("x-twilio-signature");
  if (!signature) {
    return false;
  }

  const url = request.url;
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

  return hmac === signature;
}
