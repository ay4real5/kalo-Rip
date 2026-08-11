/** Environment for the bridge, validated once at startup. */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Fail at boot, not on the first call. A misconfigured bridge that starts
    // successfully and then drops callers is far worse than one that refuses
    // to start and shows up immediately in the deploy log.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 8080),
  openAiKey: required("OPENAI_API_KEY"),
  /** Where the tool endpoint lives, e.g. https://kalo-rip.vercel.app */
  appUrl: required("APP_URL").replace(/\/$/, ""),
  /** Shared with the app's /api/voice/tool endpoint. */
  bridgeSecret: required("VOICE_BRIDGE_SECRET"),
  model: process.env.REALTIME_MODEL ?? "gpt-realtime-2.1",
  voice: process.env.REALTIME_VOICE ?? "marin",
  /** Spoken as soon as the call connects, so the caller isn't met with silence. */
  greeting:
    process.env.VOICE_GREETING ??
    "Hello, you've reached the driving school booking line. How can I help?",
} as const;

export type Config = typeof config;
