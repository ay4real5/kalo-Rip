import { prisma } from "@/app/lib/prisma";
import {
  createBooking,
  holdSlot,
  releaseHold,
  searchAvailableSlots,
  SlotUnavailableError,
} from "@/app/lib/booking-engine";
import { sendBookingConfirmation } from "@/app/lib/notifications";
import { formatLessonTime } from "@/app/lib/timezone";
import type { Customer, Instructor, Booking } from "@prisma/client";

type BookingWithInstructor = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  instructor: { user: { name: string | null } };
};

type UserWithCustomer = {
  id: string;
  name: string | null;
  email: string;
  customer: Customer | null;
};

type BookingWithRelations = Booking & {
  customer: Customer & { user: { name: string | null; email: string | null; phone: string | null } };
  instructor: Instructor & { user: { name: string | null } };
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
    "No caller identified yet. Call identify_customer or create_customer first; if the caller withheld their number, transfer to a human.",
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
      "Read the `when` field aloud verbatim — it is already in UK local time. Never read startsAt/endsAt to the caller.",
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
      const slots = await searchAvailableSlots({
        postcode: String(postcode),
        transmission: (transmission as "MANUAL" | "AUTOMATIC" | "BOTH") ?? "BOTH",
        preferredDate: preferredDate ? new Date(String(preferredDate)) : undefined,
        lessonType: (lessonType as "REGULAR" | "INTENSIVE" | "TEST" | "REFRESHER") ?? "REGULAR",
      });
      // `when` is what the agent reads out. The ISO instants are UTC, and the
      // model was speaking them as if they were local time — offering "8am"
      // for a 9am lesson through BST, and inventing the date. Give it the
      // spoken form directly rather than expecting it to convert.
      return slots.map((s) => ({
        instructorId: s.instructorId,
        instructorName: s.instructorName,
        when: describeSlot(s.startsAt),
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        pricePence: s.pricePence,
        vehicleType: s.vehicleType,
      }));
    },
  },
  {
    name: "hold_slot",
    description:
      "Temporarily hold a slot while the caller confirms. Expires after 5 minutes if not booked.",
    parameters: {
      type: "object",
      properties: {
        instructorId: { type: "string" },
        startsAt: { type: "string", format: "date-time" },
        endsAt: { type: "string", format: "date-time" },
      },
      required: ["instructorId", "startsAt", "endsAt"],
    },
    handler: async ({ instructorId, startsAt, endsAt }, ctx) => {
      return holdSlot(
        String(instructorId),
        new Date(String(startsAt)),
        new Date(String(endsAt)),
        hasCallerId(ctx) ? ctx.fromNumber : undefined
      );
    },
  },
  {
    name: "confirm_booking",
    description:
      "Create a confirmed booking after the caller has selected a held slot. Sends confirmation.",
    parameters: {
      type: "object",
      properties: {
        instructorId: { type: "string" },
        startsAt: { type: "string", format: "date-time" },
        endsAt: { type: "string", format: "date-time" },
        lessonType: {
          type: "string",
          enum: ["REGULAR", "INTENSIVE", "TEST", "REFRESHER"],
        },
        notes: { type: "string" },
      },
      required: ["instructorId", "startsAt", "endsAt"],
    },
    // Books for the identified caller only — there is no customerId argument
    // to point somewhere else.
    handler: async ({ instructorId, startsAt, endsAt, lessonType, notes }, ctx) => {
      if (!ctx.customerId) return NEEDS_IDENTITY;

      try {
        const booking = (await createBooking({
          customerId: ctx.customerId,
          instructorId: String(instructorId),
          startsAt: new Date(String(startsAt)),
          endsAt: new Date(String(endsAt)),
          lessonType:
            (lessonType as "REGULAR" | "INTENSIVE" | "TEST" | "REFRESHER") ?? "REGULAR",
          notes: notes ? String(notes) : undefined,
          source: "PHONE_AI",
        })) as BookingWithRelations;

        await sendBookingConfirmation({
          customer: booking.customer,
          instructor: booking.instructor,
          booking,
        });

        return {
          bookingId: booking.id,
          when: describeSlot(booking.startsAt),
          startsAt: booking.startsAt.toISOString(),
          endsAt: booking.endsAt.toISOString(),
          instructor: booking.instructor.user.name,
          confirmed: true,
        };
      } catch (error) {
        if (error instanceof SlotUnavailableError) {
          return {
            error: "That slot was taken while you were confirming. Search again.",
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
          status: { in: ["CONFIRMED"] },
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
        instructorName: b.instructor.user.name,
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
  {
    name: "release_slot",
    description: "Release a temporary slot hold if the caller changes their mind.",
    parameters: {
      type: "object",
      properties: {
        holdId: { type: "string" },
      },
      required: ["holdId"],
    },
    handler: async ({ holdId }) => {
      await releaseHold(String(holdId));
      return { released: true };
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
