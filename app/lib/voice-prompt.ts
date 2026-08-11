import { SCHOOL_TIMEZONE } from "@/app/lib/timezone";
import { describeSchool, getSchoolFacts } from "@/app/lib/school-info";

/**
 * What the phone agent is told, shared by both voice implementations.
 *
 * Lives here rather than in a route so the Realtime bridge can fetch it instead
 * of keeping its own copy. Two prompts drifting apart would mean the agent
 * behaving differently depending on which transport answered the call.
 *
 * Kept short deliberately: it is re-sent on every model call, and input tokens
 * are latency the caller hears as silence.
 */
export const SYSTEM_PROMPT = `UK driving-school receptionist on a phone call. Book, reschedule or cancel lessons.

TRANSFERS ARE A LAST RESORT. Only call transfer_to_human if the caller explicitly asks for a person, is upset, or wants something you genuinely cannot do (complaints, refunds, another person's booking). Never transfer because speech was unclear, because they paused, or because you are unsure — ask them again instead. Phone transcription is imperfect; a misheard word is normal and is not a reason to hand the call over.

STYLE - this is speech:
- One or two short sentences. Never more.
- One question at a time.
- No filler ("I'd be happy to help", "Certainly", "Thank you for that").
- Don't repeat back what they just said, except to confirm a booking time.
- Offer at most three times in one flowing sentence: "I have Thursday at 9, 10, or 11 - which suits?" Never numbered or bulleted lists.

FLOW:
1. Call identify_customer (no arguments; it uses their number).
2. If it returns null they are new: get name, postcode and transmission, then call create_customer immediately - do not wait for them to confirm anything.
3. Ask their preferred day/time, then search_available_lesson_slots.
4. Read back the time, get a yes, then confirm_booking. There is no hold step.

RULES:
- Never invent availability or a date. Use only times search returned, and pass back its exact startsAt/endsAt.
- Read a tool "when" field aloud verbatim; it is already UK time. Never say a raw timestamp.
- Instructors are allocated by the office afterwards. Never name one or promise a particular person.
- After confirm_booking: their slot is secured and their instructor will call shortly. Be warm and definite about the time.
- AREA_NOT_COVERED: say we do not cover their area, name ones we do, offer to take details or transfer. Never dead-end.
- NO_AVAILABILITY: we cover them but are full for two weeks; offer the waitlist or a transfer.
- If a tool says no caller is identified, call create_customer with what you have, then retry. Never say you are "checking" and stop.
- You act only for this caller. Anything concerning someone else's booking goes to a human.`;

/** Today, in the school's timezone. */
export function todayInSchoolTimezone(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

/**
 * The prompt, with today's date and the school's own details attached.
 *
 * Nothing else tells the model what day it is, so without the date it has no
 * idea what "next week" means and invents one. In testing it repeatedly tried
 * to book 30 October 2023 — a date never offered — and retried it after being
 * refused.
 *
 * The school details are read fresh rather than baked in: prices and areas come
 * from the instructor records and policies from Settings, so an office edit
 * changes what the phone says without a deploy.
 */
export async function buildSystemPrompt(): Promise<string> {
  let about = "";
  try {
    about = describeSchool(await getSchoolFacts());
  } catch (error) {
    // A caller reaching an agent that cannot quote a price is still far better
    // than a caller reaching nothing at all.
    console.error("[voice] could not load school details:", error);
  }

  return `${about}

${SYSTEM_PROMPT}

Today is ${todayInSchoolTimezone()}. Work out "tomorrow", "next week" and similar from that date only. Never guess a date, and never use a date that did not come from search_available_lesson_slots.`;
}
