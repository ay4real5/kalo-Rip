import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { securePendingBooking } from "@/app/lib/booking-engine";
import { sendEmail, pendingBookingHtml } from "@/app/lib/email";
import { notifyAdminOfPendingBooking } from "@/app/lib/notifications";
import { rateLimit, getClientIp } from "@/app/lib/rate-limit";
import { authorize } from "@/app/lib/auth/api";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  postcode: z.string().min(1),
  transmission: z.enum(["MANUAL", "AUTOMATIC", "BOTH"]).default("MANUAL"),
  /// Accepted for backwards compatibility and ignored — the admin picks the
  /// driver, so a client cannot choose one.
  instructorId: z.string().optional(),
  startsAt: z.string(),
  endsAt: z.string().optional(),
  lessonType: z.enum(["REGULAR", "INTENSIVE", "TEST", "REFRESHER"]).default("REGULAR"),
  notes: z.string().optional(),
  source: z.enum(["PHONE_AI", "PORTAL", "ADMIN"]).default("PORTAL"),
});

// Staff view of the diary. An instructor sees only their own lessons; an
// admin sees all. Customers use /api/me/bookings — this used to accept any
// signed-in user, so a customer could page through the whole book with every
// other customer's contact details attached.
export async function GET(request: Request) {
  try {
    const { user, error } = await authorize(["ADMIN", "INSTRUCTOR"]);
    if (error) return error;

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const status = url.searchParams.get("status") ?? "";
    const pageSize = 50;

    const where = {
      ...(status
        ? {
            status: status as
              | "PENDING_ASSIGNMENT"
              | "CONFIRMED"
              | "COMPLETED"
              | "CANCELLED",
          }
        : {}),
      ...(user.role === "ADMIN" ? {} : { instructor: { userId: user.id } }),
    };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          customer: { include: { user: true } },
          instructor: { include: { user: true } },
        },
        orderBy: { startsAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.booking.count({ where }),
    ]);

    return NextResponse.json({
      items: bookings,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Get bookings error:", error);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = rateLimit(`booking:${ip}`, 10, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many booking attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const parsed = createSchema.parse(body);

    const user = await prisma.user.create({
      data: {
        email: parsed.email,
        name: parsed.name,
        phone: parsed.phone,
        role: "CUSTOMER",
      },
    });

    const customer = await prisma.customer.create({
      data: {
        userId: user.id,
        postcode: parsed.postcode,
        transmission: parsed.transmission,
      },
    });

    // Web bookings secure a time and join the same assignment queue as phone
    // enquiries, so every lesson is allocated by an admin and no route
    // bypasses that. The instructorId a caller may have picked in the UI is
    // deliberately ignored — choosing the driver is the admin's job.
    const booking = await securePendingBooking({
      customerId: customer.id,
      postcode: parsed.postcode,
      transmission: parsed.transmission,
      startsAt: new Date(parsed.startsAt),
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : undefined,
      lessonType: parsed.lessonType,
      notes: parsed.notes,
      source: parsed.source === "PHONE_AI" ? "PORTAL" : parsed.source,
    });

    // Fire and forget — do not block the response on email/SMS
    sendEmail({
      to: parsed.email,
      subject: "Your driving lesson slot is secured",
      html: pendingBookingHtml({
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        pricePence: booking.pricePence,
        customerName: parsed.name,
      }),
    }).catch((err) => console.error("[bookings] email failed:", err));

    notifyAdminOfPendingBooking(booking).catch((err) =>
      console.error("[bookings] admin alert failed:", err)
    );

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Create booking error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create booking" },
      { status: 500 }
    );
  }
}
