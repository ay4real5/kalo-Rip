import { NextResponse } from "next/server";
import { searchAvailableSlots } from "@/app/lib/booking-engine";
import { rateLimit, getClientIp } from "@/app/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  postcode: z.string().min(1),
  transmission: z.enum(["MANUAL", "AUTOMATIC", "BOTH"]).optional(),
  preferredDate: z.string().optional(),
  lessonType: z.enum(["REGULAR", "INTENSIVE", "TEST", "REFRESHER"]).optional(),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = rateLimit(`search:${ip}`, 30, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const parsed = schema.parse(body);

    const slots = await searchAvailableSlots({
      postcode: parsed.postcode,
      transmission: parsed.transmission ?? "BOTH",
      preferredDate: parsed.preferredDate ? new Date(parsed.preferredDate) : undefined,
      lessonType: parsed.lessonType ?? "REGULAR",
    });

    return NextResponse.json(slots);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Search slots error:", error);
    return NextResponse.json({ error: "Failed to search slots" }, { status: 500 });
  }
}
