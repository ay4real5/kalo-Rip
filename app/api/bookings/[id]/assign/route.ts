import { NextResponse } from "next/server";
import { authorize } from "@/app/lib/auth/api";
import {
  assignInstructor,
  isExclusionViolation,
  OutsideAvailabilityError,
  SlotUnavailableError,
} from "@/app/lib/booking-engine";
import { sendBookingConfirmation } from "@/app/lib/notifications";
import { z } from "zod";

const schema = z.object({ instructorId: z.string().min(1) });

/**
 * Allocate a driver to a lesson whose time is already secured.
 *
 * Admin-only: choosing who teaches is the whole point of the queue, and it is
 * not something a learner or an instructor gets to decide for themselves.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await authorize(["ADMIN"]);
    if (error) return error;

    const { id } = await params;
    const { instructorId } = schema.parse(await request.json());

    const booking = await assignInstructor(id, instructorId);

    // Now there is a name to give, the learner gets a real confirmation.
    // Best-effort: a failed text must not undo the assignment.
    if (booking.instructor) {
      sendBookingConfirmation({
        customer: booking.customer,
        instructor: booking.instructor,
        booking,
      }).catch((err) => console.error("[assign] confirmation failed:", err));
    }

    return NextResponse.json(booking);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    // The driver was free when the page loaded but is not now — someone else
    // was assigned in the meantime, or their availability changed.
    if (err instanceof SlotUnavailableError || isExclusionViolation(err)) {
      return NextResponse.json(
        { error: "That instructor is no longer free at this time." },
        { status: 409 }
      );
    }
    if (err instanceof OutsideAvailabilityError) {
      return NextResponse.json(
        { error: "That time is outside the instructor's working hours." },
        { status: 409 }
      );
    }
    console.error("Assign booking error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to assign instructor" },
      { status: 500 }
    );
  }
}
