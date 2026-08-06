import { prisma } from "@/app/lib/prisma";
import {
  checkAreaCoverage,
  InvalidLessonDateError,
  searchSchoolCapacity,
  securePendingBooking,
  SlotUnavailableError,
} from "@/app/lib/booking-engine";
import {
  notifyAdminOfPendingBooking,
  sendSlotSecured,
} from "@/app/lib/notifications";
import { formatLessonTime } from "@/app/lib/timezone";
import type { Customer } from "@prisma/client";

type BookingWithInstructor = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  /** Null while the lesson is waiting for an admin to allocate a driver. */
  instructor: { user: { name: string | null } } | null;
};

type UserWithCustomer = {
  id: string;
  name: string | null;
  email: string;
  customer: Customer | null;
};


export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: CallContext) => Promise<unknown>;
}

export interface CallContext {
  callSid: string;
  fromNumber: string;
  toNumber: string;
  /**
   * The customer this call belongs to, once identified.
   *
   * Identity comes from the phone line, never from the model. Tools used to
   * take a customerId or bookingId as an argument and act on it, so anything
   * that could put words in the model's mouth — a caller reciting an id, a
   * prompt injection spoken down the phone — could read or cancel a stranger's
   * lessons. The model is not a trusted source of authorisation.
   *
   * Persisted to CallLog.customerId so it survives between webhook turns.
   */
  customerId: string | null;
}

/** Numbers Twilio reports for withheld or unavailable caller ID. */
const ANONYMOUS_NUMBERS = new Set(["", "anonymous", "unknown", "restricted", "+266696687"]);

function hasCallerId(ctx: CallContext): boolean {
  return !ANONYMOUS_NUMBERS.has(ctx.fromNumber.trim().toLowerCase());
}

/** Record the identified caller on the call so later turns can rely on it. */
async function linkCustomerToCall(ctx: CallContext, customerId: string) {
  ctx.customerId = customerId;
  await prisma.callLog.updateMany({
    where: { twilioSid: ctx.callSid },
    data: { customerId },
  });
}

const NEEDS_IDENTITY = {
  error:
    "No caller identified yet. Call create_customer now with the caller's name, postcode and transmission, then retry this call. " +
    "If the caller withheld their number, transfer to a human instead.",
  nextStep: "create_customer",
} as const;

/**
 * A slot time as it should be spoken to a caller, in UK local time.
 *
 * Tool results carry UTC instants for the machine to act on, but the model
 * reads whatever it is given. Handed a bare ISO string it announced the UTC
 * clock time as the lesson time — an hour early throughout BST — and guessed
 * at the date.
 */
const describeSlot = formatLessonTime;

/**
 * Match a customer by calling number.
 *
 * Compared on digits only, so +447700900123, 07700900123 and 447700900123 all
 * resolve to the same person. Anchored to the last 10 digits to survive
 * country-code and trunk-prefix differences without matching on a loose
 * substring, which could have collided with an unrelated number.
 */
async function findCustomerByPhone(fromNumber: string) {
  const digits = fromNumber.replace(/\D/g, "");
  if (digits.length < 7) return null;
  const tail = digits.slice(-10);

  // Strip formatting in SQL so a stored "+44 7700 900123" still matches the
  // "+447700900123" Twilio reports. A plain endsWith on the raw column only
  // worked for numbers that happened to be stored unformatted.
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT c."id"
    FROM "customers" c
    JOIN "users" u ON u."id" = c."user_id"
    WHERE regexp_replace(COALESCE(u."phone", ''), '\D', '', 'g') LIKE ${"%" + tail}
    ORDER BY c."created_at" ASC
    LIMIT 1
  `;
  if (rows.length === 0) return null;

  return prisma.customer.findUnique({
    where: { id: rows[0].id },
    include: { user: true },
  });
}

export const voiceTools: ToolDefinition[] = [
  {
    name: "identify_customer",
    description:
      "Look up the caller using the number they are calling from. Takes no arguments. Returns null if they have no record yet.",
    parameters: { type: "object", properties: {}, required: [] },
    // The number is taken from the call, not from the model. Accepting a phone
    // argument let a caller be identified as somebody else just by saying so.
    handler: async (_args, ctx) => {
      if (!hasCallerId(ctx)) {
        return { error: "Caller withheld their number; they cannot be identified." };
      }

      const customer = await findCustomerByPhone(ctx.fromNumber);
      if (!customer) return null;

      await linkCustomerToCall(ctx, customer.id);
      return {
        name: customer.user.name,
        postcode: customer.postcode,
        transmission: customer.transmission,
      };
    },
  },
  {
    name: "create_customer",
    description:
      "Create a new customer record. Use when the caller is not already in the system.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Full name" },
        email: { type: "string" },
        postcode: { type: "string", description: "Service postcode" },
        transmission: {
          type: "string",
          enum: ["MANUAL", "AUTOMATIC", "BOTH"],
        },
      },
      required: ["name", "postcode", "transmission"],
    },
    // Phone comes from the call, so a new record can only ever be created for
    // the number actually calling.
    handler: async ({ name, email, postcode, transmission }, ctx) => {
      if (!hasCallerId(ctx)) {
        return { error: "Caller withheld their number; transfer to a human to take details." };
      }

      // Re-entering the flow shouldn't mint a duplicate customer.
      const existing = await findCustomerByPhone(ctx.fromNumber);
      if (existing) {
        await linkCustomerToCall(ctx, existing.id);
        return { name: existing.user.name, alreadyRegistered: true };
      }

      const digits = ctx.fromNumber.replace(/\D/g, "");
      const user = (await prisma.user.create({
        data: {
          name: String(name),
          phone: ctx.fromNumber,
          email: email ? String(email) : `${digits}@placeholder.kalo.rip`,
          role: "CUSTOMER",
          customer: {
            create: {
              postcode: String(postcode).toUpperCase().trim(),
              transmission:
                (transmission as "MANUAL" | "AUTOMATIC" | "BOTH") ?? "MANUAL",
            },
          },
        },
        include: { customer: true },
      })) as UserWithCustomer;

      await linkCustomerToCall(ctx, user.customer!.id);
      return { name: user.name };
    },
  },
  {
    name: "search_available_lesson_slots",
    description:
      "Search for genuine available driving-lesson slots. Never invent availability. Returns up to 20 slots. " +
      "Read the `when` field aloud verbatim — it is already in UK local time. Never read startsAt/endsAt to the caller. " +
      "If the result has reason AREA_NOT_COVERED, tell the caller we don't cover their area, suggest nearby areas we do serve, " +
      "and offer to take their details or transfer to a human. If the result has reason NO_AVAILABILITY, tell the caller " +
      "we cover their area but are fully booked, and offer to add them to the waitlist or transfer to a human.",
    parameters: {
      type: "object",
      properties: {
        postcode: {
          type: "string",
          description: "Caller postcode or area, e.g. CR0 1AA",
        },
        transmission: {
          type: "string",
          enum: ["MANUAL", "AUTOMATIC", "BOTH"],
        },
        preferredDate: {
          type: "string",
          format: "date",
          description: "ISO date, e.g. 2026-08-05",
        },
        lessonType: {
          type: "string",
          enum: ["REGULAR", "INTENSIVE", "TEST", "REFRESHER"],
        },
      },
      required: ["postcode", "transmission"],
    },
    handler: async ({ postcode, transmission, preferredDate, lessonType }) => {
      const postcodeStr = String(postcode);
      const transmissionVal = (transmission as "MANUAL" | "AUTOMATIC" | "BOTH") ?? "BOTH";

      // Capacity across the whole school, not one driver's diary — the caller
      // is choosing a time, and the office chooses who teaches it.
      const slots = await searchSchoolCapacity({
        postcode: postcodeStr,
        transmission: transmissionVal,
        preferredDate: preferredDate ? new Date(String(preferredDate)) : undefined,
        lessonType: (lessonType as "REGULAR" | "INTENSIVE" | "TEST" | "REFRESHER") ?? "REGULAR",
      });

      // Distinguish "we don't cover your area" from "fully booked". Without
      // this, an empty result had no reason and the agent told the caller
      // there were no slots at all — a dead end that lost the lead. Now the
      // agent can offer to take their details for the waitlist, suggest the
      // nearest covered area, or transfer to a human.
      if (slots.length === 0) {
        const { covered, servedAreas } = await checkAreaCoverage(postcodeStr);
        if (!covered) {
          return {
            slots: [],
            reason: "AREA_NOT_COVERED",
            message:
              `We don't currently have any instructors covering the ${postcodeStr.split(" ")[0]} area. ` +
              `We serve: ${servedAreas.join(", ")}. ` +
              `Offer to take the caller's name and number so we can contact them if we expand to their area, ` +
              `or ask if any of the served areas would work for them, or transfer to a human.`,
            servedAreas,
          };
        }
        return {
          slots: [],
          reason: "NO_AVAILABILITY",
          message:
            "We cover this area but have no available slots in the next two weeks. " +
            "Offer to add the caller to the waitlist, ask if they can be flexible on day or time, " +
            "or transfer to a human.",
        };
      }

      // `when` is what the agent reads out. The ISO instants are UTC, and the
      // model was speaking them as if they were local time — offering "8am"
      // for a 9am lesson through BST, and inventing the date. Give it the
      // spoken form directly rather than expecting it to convert.
      // Three, not twenty. On a phone call every extra option is roughly seven
      // seconds the caller sits through, and a tester found the agent reading
      // out a numbered list of twenty times — thirty seconds of speech for one
      // answer. Callers pick from a short choice; more can be offered if none
      // of these suit.
      const OFFER = 3;
      return {
        slots: slots.slice(0, OFFER).map((s) => ({
          when: describeSlot(s.startsAt),
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
          pricePence: s.pricePence,
        })),
        moreAvailable: Math.max(0, slots.length - OFFER),
        sayToCaller:
          "Offer these times in one short sentence. Do not number them or list them one per line. " +
          "If none suit, say you have other times and ask what day or time of day they prefer.",
      };
    },
  },
  {
    name: "confirm_booking",
    description:
      "Secure the chosen time for the caller. Their instructor is allocated afterwards by the office, " +
      "so never name or promise a specific instructor. Tell the caller the slot is secured and that " +
      "their instructor will contact them shortly to confirm.",
    parameters: {
      type: "object",
      properties: {
        startsAt: { type: "string", format: "date-time" },
        endsAt: { type: "string", format: "date-time" },
        lessonType: {
          type: "string",
          enum: ["REGULAR", "INTENSIVE", "TEST", "REFRESHER"],
        },
        notes: { type: "string" },
      },
      required: ["startsAt", "endsAt"],
    },
    // Secures the time only. There is no instructorId argument: which driver
    // teaches this lesson is the office's decision, made in the admin portal.
    handler: async ({ startsAt, endsAt, lessonType, notes }, ctx) => {
      if (!ctx.customerId) return NEEDS_IDENTITY;

      try {
        const customer = await prisma.customer.findUnique({
          where: { id: ctx.customerId },
          include: { user: true },
        });
        if (!customer) return NEEDS_IDENTITY;

        const booking = await securePendingBooking({
          customerId: ctx.customerId,
          postcode: customer.postcode,
          transmission: customer.transmission,
          startsAt: new Date(String(startsAt)),
          endsAt: new Date(String(endsAt)),
          lessonType:
            (lessonType as "REGULAR" | "INTENSIVE" | "TEST" | "REFRESHER") ?? "REGULAR",
          notes: notes ? String(notes) : undefined,
          source: "PHONE_AI",
        });

        // Tell the learner their time is held, and the office that there is a
        // lesson to allocate. Neither may fail the call.
        await sendSlotSecured({ customer, booking }).catch(() => undefined);
        await notifyAdminOfPendingBooking({
          id: booking.id,
          startsAt: booking.startsAt,
          customer: { ...customer, user: customer.user },
        }).catch(() => undefined);

        return {
          bookingId: booking.id,
          when: describeSlot(booking.startsAt),
          startsAt: booking.startsAt.toISOString(),
          endsAt: booking.endsAt.toISOString(),
          secured: true,
          awaitingInstructor: true,
          sayToCaller:
            "Their slot is secured. An instructor will be assigned and will contact them shortly to confirm. Do not name an instructor.",
        };
      } catch (error) {
        if (error instanceof SlotUnavailableError) {
          return {
            error: "That slot was taken while you were confirming. Search again.",
          };
        }
        // The model sometimes produces a date of its own rather than copying
        // one from the search results. Send it back to the list instead of
        // failing the call.
        if (error instanceof InvalidLessonDateError) {
          return {
            error: `${error.message}. Use the exact startsAt value from search_available_lesson_slots — do not work out a date yourself.`,
            nextStep: "search_available_lesson_slots",
          };
        }
        throw error;
      }
    },
  },
  {
    name: "cancel_booking",
    description: "Cancel an existing customer booking and record the reason.",
    parameters: {
      type: "object",
      properties: {
        bookingId: { type: "string" },
        reason: { type: "string" },
      },
      required: ["bookingId"],
    },
    // The booking must belong to the caller. Without this check a caller who
    // named any booking id — or a prompt injection that produced one — could
    // cancel a stranger's lesson.
    handler: async ({ bookingId, reason }, ctx) => {
      if (!ctx.customerId) return NEEDS_IDENTITY;

      const booking = await prisma.booking.findUnique({
        where: { id: String(bookingId) },
        select: { id: true, customerId: true, status: true },
      });

      // Same answer for "not yours" as for "doesn't exist".
      if (!booking || booking.customerId !== ctx.customerId) {
        return { error: "No such booking on this account." };
      }
      if (booking.status === "CANCELLED") {
        return { error: "That booking is already cancelled." };
      }

      const { cancelBooking } = await import("@/app/lib/booking-engine");
      const cancelled = await cancelBooking(
        booking.id,
        reason ? String(reason) : undefined
      );
      return { bookingId: cancelled.id, status: cancelled.status };
    },
  },
  {
    name: "get_customer_bookings",
    description:
      "List a customer's upcoming bookings so they can reschedule or cancel.",
    parameters: { type: "object", properties: {}, required: [] },
    // Scoped to the identified caller; there is no customerId to point
    // elsewhere and read someone else's diary.
    handler: async (_args, ctx) => {
      if (!ctx.customerId) return NEEDS_IDENTITY;

      const bookings: BookingWithInstructor[] = await prisma.booking.findMany({
        where: {
          customerId: ctx.customerId,
          // Lessons awaiting a driver are still the learner's lessons, and
          // they will ring up about them, so include them.
          status: { in: ["PENDING_ASSIGNMENT", "CONFIRMED"] },
          startsAt: { gte: new Date() },
        },
        include: { instructor: { include: { user: true } } },
        orderBy: { startsAt: "asc" },
      });
      return bookings.map((b) => ({
        bookingId: b.id,
        when: describeSlot(b.startsAt),
        startsAt: b.startsAt.toISOString(),
        endsAt: b.endsAt.toISOString(),
        instructorName: b.instructor?.user.name ?? null,
        // Tell the model plainly, so it says "we're still matching you with an
        // instructor" rather than inventing a name or claiming it's unbooked.
        awaitingInstructor: b.instructor === null,
        status: b.status,
      }));
    },
  },
  {
    name: "transfer_to_human",
    description:
      "Transfer the call to a human agent. Use if the caller asks, is distressed, or the request is outside the system.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string" },
      },
      required: ["reason"],
    },
    handler: async ({ reason }, ctx) => {
      await prisma.callLog.updateMany({
        where: { twilioSid: ctx.callSid },
        data: {
          status: "HANDED_OFF",
          handoffReason: String(reason),
        },
      });
      return {
        action: "TRANSFER",
        reason: String(reason),
        message:
          "I'm transferring you to a member of the team now. Please hold.",
      };
    },
  },
];

export function getToolDefinitions() {
  return voiceTools.map(({ name, description, parameters }) => ({
    type: "function" as const,
    function: { name, description, parameters },
  }));
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: CallContext
) {
  const tool = voiceTools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool ${name} not found`);
  return tool.handler(args, ctx);
}
