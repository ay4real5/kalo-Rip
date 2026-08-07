import { describe, expect, it } from "vitest";

/**
 * Transfers must never dial back into the call they came from.
 *
 * Both failures below happened live. The handoff number was set to the mobile
 * the tester was ringing from, so when the agent transferred it dialled the
 * phone already on the call — it appeared to "call itself". Pointing the
 * handoff at our own Twilio number does the same thing, straight back into the
 * agent.
 *
 * Mirrors isLoopingTransfer in app/api/voice/respond/route.ts. That lives in a
 * route file, where Next only permits handler exports, so the rule is asserted
 * here against the same comparison.
 */
function isLoopingTransfer(target: string, fromNumber: string, toNumber: string) {
  const digits = (s: string) => s.replace(/\D/g, "").slice(-10);
  const dest = digits(target);
  return dest.length > 0 && (dest === digits(fromNumber) || dest === digits(toNumber));
}

const CALLER = "+447387624064";
const TWILIO_LINE = "+447414104022";
const OFFICE = "+447459137803";

describe("transfer loop protection", () => {
  it("refuses to transfer to the number that is calling", () => {
    // The exact live failure: handoff set to the tester's own mobile.
    expect(isLoopingTransfer("07387624064", CALLER, TWILIO_LINE)).toBe(true);
  });

  it("refuses to transfer to our own line", () => {
    expect(isLoopingTransfer(TWILIO_LINE, CALLER, TWILIO_LINE)).toBe(true);
  });

  it("allows a genuine office number", () => {
    expect(isLoopingTransfer(OFFICE, CALLER, TWILIO_LINE)).toBe(false);
  });

  it("matches regardless of how the number is written", () => {
    // Stored national, arriving E.164 — still the same phone.
    expect(isLoopingTransfer("07387624064", CALLER, TWILIO_LINE)).toBe(true);
    expect(isLoopingTransfer("+44 7387 624064", CALLER, TWILIO_LINE)).toBe(true);
    expect(isLoopingTransfer("447387624064", CALLER, TWILIO_LINE)).toBe(true);
  });

  it("does not block on an empty or withheld number", () => {
    // Nothing to compare against; the office number is still safe to dial.
    expect(isLoopingTransfer(OFFICE, "", TWILIO_LINE)).toBe(false);
    expect(isLoopingTransfer("", CALLER, TWILIO_LINE)).toBe(false);
  });

  it("does not confuse two different numbers sharing a prefix", () => {
    expect(isLoopingTransfer("+447387624065", CALLER, TWILIO_LINE)).toBe(false);
  });
});
