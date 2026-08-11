import { prisma } from "@/app/lib/prisma";

/**
 * What the phone agent knows about the school.
 *
 * Two sources, deliberately:
 *
 * - Live facts (prices, areas, transmissions) come from the instructor
 *   records, so raising a rate or covering a new postcode changes what the
 *   phone says immediately. Hard-coding these would guarantee the agent quotes
 *   a stale price eventually.
 * - Policies (cancellation, payment, test day) come from Settings, so the
 *   office can edit them in the admin dashboard without a deploy.
 *
 * Anything not answered here the agent must not invent — the prompt tells it to
 * offer a callback instead. A made-up cancellation fee is worse than "let me
 * check that for you".
 */

export const SCHOOL_SETTING_KEYS = [
  "school_name",
  "block_discounts",
  "payment_when",
  "payment_methods",
  "cancellation_notice",
  "late_cancellation",
  "test_car_provided",
  "test_booking_help",
  "pickup_policy",
  "extra_services",
  "office_hours",
  "gift_vouchers",
  "start_availability",
] as const;

export type SchoolSettingKey = (typeof SCHOOL_SETTING_KEYS)[number];

export interface SchoolFacts {
  name: string;
  priceRange: string;
  lessonLengths: string;
  transmissions: string;
  areas: string[];
  offersIntensive: boolean;
  policies: Record<string, string>;
}

function money(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export async function getSchoolFacts(): Promise<SchoolFacts> {
  const [instructors, settings] = await Promise.all([
    prisma.instructor.findMany({
      where: { active: true, acceptsNewLearners: true },
      select: {
        hourlyRatePence: true,
        lessonDurationMinutes: true,
        transmission: true,
        servicePostcodes: true,
        offersIntensive: true,
      },
    }),
    prisma.setting.findMany({
      where: { key: { in: [...SCHOOL_SETTING_KEYS] } },
    }),
  ]);

  const policies = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  const prices = [...new Set(instructors.map((i) => i.hourlyRatePence))].sort((a, b) => a - b);
  const lengths = [...new Set(instructors.map((i) => i.lessonDurationMinutes))].sort((a, b) => a - b);
  const transmissions = [...new Set(instructors.map((i) => i.transmission))];

  return {
    name: policies.school_name ?? "the driving school",
    priceRange:
      prices.length === 0
        ? "please ask the office"
        : prices.length === 1
          ? `${money(prices[0]!)} an hour`
          : `${money(prices[0]!)} to ${money(prices[prices.length - 1]!)} an hour depending on the instructor`,
    lessonLengths: lengths.length ? lengths.map((m) => `${m} minutes`).join(" or ") : "60 minutes",
    transmissions: transmissions.map((t) => t.toLowerCase()).join(" and "),
    areas: [...new Set(instructors.flatMap((i) => i.servicePostcodes))].sort(),
    offersIntensive: instructors.some((i) => i.offersIntensive),
    policies,
  };
}

/**
 * The facts block appended to the phone agent's prompt.
 *
 * Written as short statements it can read almost verbatim, because anything it
 * has to rephrase is a chance to get a price or a policy subtly wrong.
 */
export function describeSchool(facts: SchoolFacts): string {
  const p = facts.policies;
  const lines: string[] = [
    `You answer the phone for ${facts.name}.`,
    "",
    "ABOUT US — answer from this, and never invent an answer you don't have here:",
    `- Lessons cost ${facts.priceRange}, ${facts.lessonLengths} long.`,
    `- We teach ${facts.transmissions}.`,
    `- We cover these postcode areas: ${facts.areas.slice(0, 12).join(", ")}${facts.areas.length > 12 ? " and others" : ""}.`,
    facts.offersIntensive
      ? "- We do intensive courses."
      : "- We do not currently offer intensive courses.",
  ];

  const add = (key: string, prefix: string) => {
    if (p[key]) lines.push(`- ${prefix} ${p[key]}`);
  };

  add("payment_when", "Payment:");
  add("payment_methods", "We accept:");
  add("cancellation_notice", "Cancellations:");
  add("late_cancellation", "Late cancellations:");
  add("test_car_provided", "Driving test car:");
  add("test_booking_help", "Booking the test:");
  add("pickup_policy", "Pick-up:");
  add("extra_services", "Other services:");
  add("block_discounts", "Block discounts:");
  add("gift_vouchers", "Gift vouchers:");
  add("start_availability", "Starting:");
  add("office_hours", "Office hours:");

  lines.push(
    "",
    "GENERAL UK DRIVING RULES you may answer confidently:",
    "- You need a provisional licence before your first lesson, and you must bring it.",
    "- You can start at 17, or 16 if you get the higher rate mobility component of PIP/DLA.",
    "- You must pass the theory test before booking the practical. The theory pass lasts two years.",
    "- You must be able to read a numberplate from 20 metres, glasses or lenses are fine.",
    "- DVSA suggest around 45 hours of lessons plus 22 hours of private practice on average, but it varies a lot.",
    "",
    "If you are asked something not covered above — a price for something unusual, a complaint, anything you are unsure of — say you will have someone call them back, and take their name. Never guess at a price, a policy or a fee.",
  );

  return lines.join("\n");
}
