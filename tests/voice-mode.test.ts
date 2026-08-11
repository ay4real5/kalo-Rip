import { describe, expect, it } from "vitest";

/**
 * Which voice implementation answers a call, and the safety of that switch.
 *
 * This is a live phone line that real people already ring, so the flag has to
 * fail towards the implementation known to work. Mirrors buildTwiML in
 * app/api/voice/incoming/route.ts, which cannot be imported — Next only permits
 * handler exports from a route file.
 */

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function buildTwiML(
  fromNumber: string,
  toNumber: string,
  env: { VOICE_MODE?: string; VOICE_BRIDGE_WSS_URL?: string }
): string {
  const bridgeUrl = env.VOICE_BRIDGE_WSS_URL;
  if (env.VOICE_MODE === "realtime" && bridgeUrl) {
    return `<Response><Connect><Stream url="${escapeXml(bridgeUrl)}">` +
      `<Parameter name="from" value="${escapeXml(fromNumber)}"/>` +
      `<Parameter name="to" value="${escapeXml(toNumber)}"/>` +
      `</Stream></Connect></Response>`;
  }
  return `<Response><Say>greeting</Say><Gather/></Response>`;
}

const WSS = "wss://bridge.up.railway.app/twilio";
const FROM = "+447700900123";
const TO = "+447414104022";

describe("voice mode switch", () => {
  it("streams to the bridge when realtime is on", () => {
    const twiml = buildTwiML(FROM, TO, { VOICE_MODE: "realtime", VOICE_BRIDGE_WSS_URL: WSS });
    expect(twiml).toContain("<Connect>");
    expect(twiml).toContain(WSS);
    expect(twiml).not.toContain("<Gather");
  });

  it("passes the caller's number as a stream parameter", () => {
    // Identity must reach the bridge from Twilio. If this is dropped the bridge
    // cannot identify the caller and every booking tool refuses.
    const twiml = buildTwiML(FROM, TO, { VOICE_MODE: "realtime", VOICE_BRIDGE_WSS_URL: WSS });
    expect(twiml).toContain(`name="from" value="${FROM}"`);
    expect(twiml).toContain(`name="to" value="${TO}"`);
  });

  it("defaults to the working gather flow when unset", () => {
    const twiml = buildTwiML(FROM, TO, {});
    expect(twiml).toContain("<Gather");
    expect(twiml).not.toContain("<Connect>");
  });

  it("falls back to gather when realtime is on but no bridge URL is configured", () => {
    // A half-configured deploy must still answer the phone.
    const twiml = buildTwiML(FROM, TO, { VOICE_MODE: "realtime" });
    expect(twiml).toContain("<Gather");
    expect(twiml).not.toContain("<Connect>");
  });

  it("falls back on any unrecognised mode", () => {
    const twiml = buildTwiML(FROM, TO, { VOICE_MODE: "Realtime", VOICE_BRIDGE_WSS_URL: WSS });
    expect(twiml).toContain("<Gather");
  });

  it("escapes quotes in a withheld or odd caller id", () => {
    // A stray quote would break out of the attribute and produce invalid TwiML,
    // which Twilio rejects — the call would simply fail.
    const twiml = buildTwiML('+44"7700', TO, {
      VOICE_MODE: "realtime",
      VOICE_BRIDGE_WSS_URL: WSS,
    });
    expect(twiml).toContain("&quot;");
    expect(twiml).not.toContain('value="+44"7700"');
  });
});
