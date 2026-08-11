import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/app/lib/prisma";
import { executeTool, getToolDefinitions, type CallContext } from "@/app/lib/voice-tools";
import { buildSystemPrompt } from "@/app/lib/voice-prompt";
import { z } from "zod";

/**
 * Tool execution for the Realtime voice bridge.
 *
 * The bridge (voice-bridge/, on Railway) only moves audio. When the model wants
 * to do something it calls this, so every booking rule stays here in one place
 * rather than being reimplemented in a second service — the handlers below are
 * the same ones the Gather flow uses, already covered by the test suite.
 *
 * This endpoint can create and cancel bookings, so it is secret-authenticated
 * and never exposed to callers.
 */

const bodySchema = z.object({
  name: z.string().min(1),
  args: z.record(z.unknown()).default({}),
  callSid: z.string().min(1),
  fromNumber: z.string().default(""),
  toNumber: z.string().default(""),
});

/** Constant-time compare so the secret can't be recovered by timing. */
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = process.env.VOICE_BRIDGE_SECRET;
  if (!expected) {
    // Fails closed. An unset secret must not mean an open endpoint — that is
    // the mistake the Twilio signature check originally made.
    console.error("VOICE_BRIDGE_SECRET is not set; refusing tool execution.");
    return NextResponse.json({ error: "Bridge not configured" }, { status: 503 });
  }

  if (!secretMatches(request.headers.get("x-bridge-secret"), expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, args, callSid, fromNumber, toNumber } = bodySchema.parse(
      await request.json()
    );

    // Identity comes from the call record, exactly as in the Gather flow. The
    // model supplies the tool name and arguments; it does not get to say who
    // the caller is.
    const callLog = await prisma.callLog.findUnique({
      where: { twilioSid: callSid },
      select: { customerId: true },
    });

    const context: CallContext = {
      callSid,
      fromNumber,
      toNumber,
      customerId: callLog?.customerId ?? null,
    };

    const result = await executeTool(name, args, context);

    // Tools mutate ctx.customerId when they identify or create a caller, and
    // each bridge request builds a fresh context, so persist it or the next
    // tool call in the same conversation would not know who it is talking to.
    if (context.customerId && context.customerId !== callLog?.customerId) {
      await prisma.callLog.updateMany({
        where: { twilioSid: callSid },
        data: { customerId: context.customerId },
      });
    }

    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    // Hand the failure back rather than 500ing: the bridge feeds this to the
    // model, which can apologise or try something else. One bad tool call
    // should not drop a caller mid-booking.
    console.error("[voice/tool] execution failed:", error);
    return NextResponse.json({
      result: {
        error: error instanceof Error ? error.message : "Tool call failed",
      },
    });
  }
}

/**
 * Session configuration for the bridge: the tool schemas and the prompt.
 *
 * Fetched per call rather than baked into the bridge, so there is one
 * definition of both. It also means the prompt carries the correct date — a
 * long-running bridge process that cached it at startup would still be saying
 * it was Tuesday on Thursday.
 */
export async function GET(request: Request) {
  const expected = process.env.VOICE_BRIDGE_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "Bridge not configured" }, { status: 503 });
  }
  if (!secretMatches(request.headers.get("x-bridge-secret"), expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    instructions: buildSystemPrompt(),
    // Realtime takes a flat tool shape rather than Chat Completions' nesting.
    tools: getToolDefinitions().map((t) => ({
      type: "function" as const,
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    })),
  });
}
