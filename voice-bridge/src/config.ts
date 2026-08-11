/** Environment for the bridge, validated once at startup. */

function required(name: string): string {
  // Trimmed, because these are pasted into a dashboard by hand and a trailing
  // newline rides along more often than not. A newline in the API key makes
  // Node refuse the Authorization header outright (ERR_INVALID_CHAR), so the
  // OpenAI socket never opens and the caller hears silence for the whole call
  // with nothing obviously wrong anywhere else. That cost an afternoon.
  const value = process.env[name]?.trim();
  if (!value) {
    // Fail at boot, not on the first call. A misconfigured bridge that starts
    // successfully and then drops callers is far worse than one that refuses
    // to start and shows up immediately in the deploy log.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Where the tool endpoint lives, e.g. https://kalo-rip.vercel.app
 *
 * Accepts NEXT_PUBLIC_APP_URL too, since that is the name the rest of the
 * project uses and it is the one people reach for when copying variables
 * across.
 */
function appUrl(): string {
  const value = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL)?.trim();
  if (!value) {
    throw new Error("Missing required environment variable: APP_URL");
  }

  // The local .env points at localhost, so that value gets copied by mistake.
  // From Railway there is no localhost to reach, and the failure would show up
  // as tool calls silently failing mid-call rather than anything obvious.
  if (/localhost|127\.0\.0\.1/.test(value) && process.env.NODE_ENV === "production") {
    throw new Error(
      `APP_URL is "${value}", which this service cannot reach. Set it to the deployed app, e.g. https://kalo-rip.vercel.app`
    );
  }

  return value.replace(/\/$/, "");
}

export const config = {
  port: Number(process.env.PORT ?? 8080),
  openAiKey: required("OPENAI_API_KEY"),
  appUrl: appUrl(),
  /** Shared with the app's /api/voice/tool endpoint. */
  bridgeSecret: required("VOICE_BRIDGE_SECRET"),
  model: process.env.REALTIME_MODEL?.trim() ?? "gpt-realtime-2.1",
  voice: process.env.REALTIME_VOICE?.trim() ?? "marin",
  /** Spoken as soon as the call connects, so the caller isn't met with silence. */
  greeting:
    process.env.VOICE_GREETING?.trim() ??
    "Hello, you've reached the driving school booking line. How can I help?",
} as const;

export type Config = typeof config;
