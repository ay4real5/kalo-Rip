import { config } from "./config.js";

/**
 * Talks to the Next.js app, which owns every booking rule.
 *
 * The bridge deliberately holds no business logic: it moves audio, and defers
 * anything that touches a booking to the app, where the handlers are shared
 * with the older Gather flow and covered by tests.
 */

export interface RealtimeTool {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface SessionConfig {
  instructions: string;
  tools: RealtimeTool[];
  /** Spoken on answer. Comes from the app so the school's name lives in one place. */
  greeting?: string;
}

const headers = {
  "Content-Type": "application/json",
  "x-bridge-secret": config.bridgeSecret,
};

/**
 * Prompt and tool schemas for a call.
 *
 * Fetched per call rather than cached: the prompt embeds today's date, and a
 * process that stays up for weeks would otherwise keep telling the model it is
 * still the day it booted.
 */
export async function fetchSessionConfig(): Promise<SessionConfig> {
  // Bounded, because this is on the path to the caller hearing anything at
  // all. Without a timeout an unreachable app leaves the call sitting in
  // silence for its whole duration — which is exactly how this failed: the
  // fetch never returned, so the OpenAI socket was never opened.
  const res = await fetch(`${config.appUrl}/api/voice/tool`, {
    headers,
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) {
    throw new Error(
      `Session config failed: ${res.status} ${(await res.text()).slice(0, 200)}`
    );
  }
  return (await res.json()) as SessionConfig;
}

export interface ToolCallInput {
  name: string;
  args: Record<string, unknown>;
  callSid: string;
  fromNumber: string;
  toNumber: string;
}

/**
 * Run a tool in the app.
 *
 * Never throws: a failure is returned as a result the model can read out and
 * work around. Dropping a caller mid-booking because one lookup failed would be
 * a worse outcome than the agent saying it had trouble.
 */
export async function callTool(input: ToolCallInput): Promise<unknown> {
  try {
    const res = await fetch(`${config.appUrl}/api/voice/tool`, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[tool] ${input.name} -> ${res.status} ${detail}`);
      return { error: "That didn't work. Please try again." };
    }

    const { result } = (await res.json()) as { result: unknown };
    return result;
  } catch (error) {
    console.error(`[tool] ${input.name} failed:`, error);
    return { error: "That didn't work. Please try again." };
  }
}
