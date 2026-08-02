import { NextResponse } from "next/server";
import { searchAvailableSlots } from "@/app/lib/booking-engine";
import { z } from "zod";

const schema = z.object({
  postcode: z.string().min(1),
  transmission: z.enum(["MANUAL", "AUTOMATIC", "BOTH"]).optional(),
  preferredDate: z.string().optional(),
  lessonType: z.enum(["REGULAR", "INTENSIVE", "TEST", "REFRESHER"]).optional(),
});

export async function POST(request: Request) {
  try {
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
