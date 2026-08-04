import { prisma } from "@/app/lib/prisma";

const DEFAULT_HANDOFF_NUMBER = "+441234567890";

export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return setting?.value ?? null;
}

/**
 * Normalise a phone number to E.164 for use in TwiML `<Dial>`.
 *
 * Twilio cannot route a national-format number — it has no country context —
 * and the call drops the moment the flow reaches the transfer. A UK admin will
 * naturally type "07459137803", which is the format on every UK phone, so
 * accept it and convert rather than depending on them knowing about E.164.
 */
export function toE164(input: string, countryCode = "44"): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");

  const digits = trimmed.replace(/\D/g, "");
  // UK national: drop the trunk 0 and prefix the country code.
  if (digits.startsWith("0")) return `+${countryCode}${digits.slice(1)}`;
  if (digits.startsWith(countryCode)) return `+${digits}`;
  return `+${digits}`;
}

export async function getHandoffNumber(): Promise<string> {
  const number = await getSetting("human_handoff_number");
  return number ? toE164(number) : DEFAULT_HANDOFF_NUMBER;
}
