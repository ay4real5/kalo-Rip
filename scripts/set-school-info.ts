/**
 * Write the school's details into Settings.
 *
 *   npm run set-school-info
 *
 * These are what the phone agent answers questions from. Editing a value here
 * (or in the admin dashboard) changes what callers are told without a deploy.
 * Prices, lesson lengths and areas are NOT here — those come live from the
 * instructor records, so they can never drift out of date.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SCHOOL_INFO: Record<string, string> = {
  school_name: "Shah Driving School",

  // How the phone is answered. Change this line and re-run to change the
  // greeting on both the Realtime and fallback paths.
  greeting: "Welcome to Shah Driving School. How can I help you today?",

  block_discounts:
    "we don't currently offer block booking discounts, lessons are paid for individually",
  payment_when: "payment is due before each lesson",
  payment_methods: "cash or bank transfer",

  cancellation_notice:
    "please give at least 24 hours notice to cancel or rearrange a lesson",
  late_cancellation:
    "there's no charge as long as you cancel in time, so please let us know at least 24 hours ahead",

  test_car_provided: "yes, we provide the car for your driving test",
  test_booking_help:
    "you can book the test yourself, and we're happy to help you arrange it if you'd like",

  pickup_policy:
    "we can usually collect you from home, work or somewhere convenient, depending on where you are — your instructor will agree it with you",
  extra_services:
    "we focus on standard driving lessons, so we don't currently offer Pass Plus, motorway lessons or refresher courses",

  office_hours:
    "the office is open 9 to 5, though this line answers any time and can take your booking",
  gift_vouchers: "we don't currently offer gift vouchers",
  start_availability:
    "you can start as soon as you're ready — we'll find you a slot and confirm your instructor shortly after",
};

async function main() {
  for (const [key, value] of Object.entries(SCHOOL_INFO)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    console.log(`  ${key.padEnd(22)} ${value.slice(0, 60)}${value.length > 60 ? "…" : ""}`);
  }
  console.log(`\n${Object.keys(SCHOOL_INFO).length} settings written.`);
}

main()
  .catch((error) => {
    console.error("Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
