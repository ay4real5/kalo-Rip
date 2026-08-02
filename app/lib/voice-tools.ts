import { prisma } from "@/app/lib/prisma";
import {
  createBooking,
  holdSlot,
  releaseHold,
  searchAvailableSlots,
} from "@/app/lib/booking-engine";
import { sendBookingConfirmation } from "@/app/lib/notifications";
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
}

export const voiceTools: ToolDefinition[] = [
  {
    name: "identify_customer",
    description:
      "Find an existing customer by phone number. Returns null if no customer record exists.",
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description: "Caller phone number in E.164 or local format",
        },
      },
      required: ["phone"],
    },
    handler: async ({ phone }) => {
      const customer = await prisma.customer.findFirst({
        where: {
          OR: [
            { user: { phone: String(phone) } },
            { user: { phone: { contains: String(phone) } } },
          ],
        },
        include: { user: true },
      });
      return customer
        ? {
            customerId: customer.id,
            name: customer.user.name,
            postcode: customer.postcode,
            transmission: customer.transmission,
          }
        : null;
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
        phone: { type: "string", description: "Phone number" },
        email: { type: "string" },
        postcode: { type: "string", description: "Service postcode" },
        transmission: {
          type: "string",
          enum: ["MANUAL", "AUTOMATIC", "BOTH"],
        },
      },
      required: ["name", "phone", "postcode", "transmission"],
    },
    handler: async ({ name, phone, email, postcode, transmission }) => {
      const safePhone = String(phone).replace(/\D/g, "");
      const user = (await prisma.user.create({
        data: {
          name: String(name),
          phone: String(phone),
          email: email ? String(email) : `${safePhone}@placeholder.kalo.rip`,
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
      return { customerId: user.customer!.id, name: user.name };
    },
  },
  {
    name: "search_available_lesson_slots",
    description:
      "Search for genuine available driving-lesson slots. Never invent availability. Returns up to 20 slots.",
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
      return slots.map((s) => ({
        instructorId: s.instructorId,
        instructorName: s.instructorName,
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
        customerPhone: { type: "string" },
      },
      required: ["instructorId", "startsAt", "endsAt"],
    },
    handler: async ({ instructorId, startsAt, endsAt, customerPhone }) => {
      const result = await holdSlot(
        String(instructorId),
        new Date(String(startsAt)),
        new Date(String(endsAt)),
        customerPhone ? String(customerPhone) : undefined
      );
      return result;
    },
  },
  {
    name: "confirm_booking",
    description:
      "Create a confirmed booking after the caller has selected a held slot. Sends confirmation.",
    parameters: {
      type: "object",
      properties: {
        customerId: { type: "string" },
        instructorId: { type: "string" },
        startsAt: { type: "string", format: "date-time" },
        endsAt: { type: "string", format: "date-time" },
        lessonType: {
          type: "string",
          enum: ["REGULAR", "INTENSIVE", "TEST", "REFRESHER"],
        },
        notes: { type: "string" },
      },
      required: ["customerId", "instructorId", "startsAt", "endsAt"],
    },
    handler: async ({
      customerId,
      instructorId,
      startsAt,
      endsAt,
      lessonType,
      notes,
    }) => {
      const booking = (await createBooking({
        customerId: String(customerId),
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
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        instructor: booking.instructor.user.name,
        confirmed: true,
      };
    },
  },
  {
    name: "cancel_booking",
    description: "Cancel an existing customer booking and record the reason.",
    parameters: {
      type: "object",
      properties: {
        customerId: { type: "string" },
        bookingId: { type: "string" },
        reason: { type: "string" },
      },
      required: ["bookingId"],
    },
    handler: async ({ bookingId, reason }) => {
      const { cancelBooking } = await import("@/app/lib/booking-engine");
      const booking = await cancelBooking(
        String(bookingId),
        reason ? String(reason) : undefined
      );
      return { bookingId: booking.id, status: booking.status };
    },
  },
  {
    name: "get_customer_bookings",
    description:
      "List a customer's upcoming bookings so they can reschedule or cancel.",
    parameters: {
      type: "object",
      properties: {
        customerId: { type: "string" },
      },
      required: ["customerId"],
    },
    handler: async ({ customerId }) => {
      const bookings: BookingWithInstructor[] = await prisma.booking.findMany({
        where: {
          customerId: String(customerId),
          status: { in: ["CONFIRMED"] },
          startsAt: { gte: new Date() },
        },
        include: { instructor: { include: { user: true } } },
        orderBy: { startsAt: "asc" },
      });
      return bookings.map((b) => ({
        bookingId: b.id,
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
