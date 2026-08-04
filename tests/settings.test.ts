import { describe, expect, it } from "vitest";
import { toE164 } from "@/app/lib/settings";

/**
 * Twilio cannot route a national-format number in `<Dial>` — it has no country
 * context — so the call drops the instant the flow reaches a transfer. A UK
 * admin will naturally type "07459137803", the format printed on every UK
 * phone, so the app converts rather than relying on them knowing about E.164.
 */
describe("toE164", () => {
  it("converts a UK national number by dropping the trunk zero", () => {
    expect(toE164("07459137803")).toBe("+447459137803");
  });

  it("leaves an already-correct number alone", () => {
    expect(toE164("+447459137803")).toBe("+447459137803");
  });

  it("tolerates spaces, dashes and brackets", () => {
    expect(toE164("07459 137 803")).toBe("+447459137803");
    expect(toE164("(07459) 137-803")).toBe("+447459137803");
    expect(toE164("+44 7459 137 803")).toBe("+447459137803");
  });

  it("handles a country code typed without the plus", () => {
    expect(toE164("447459137803")).toBe("+447459137803");
  });

  it("supports other country codes", () => {
    expect(toE164("0612345678", "33")).toBe("+33612345678");
  });

  it("does not mangle a landline", () => {
    expect(toE164("02079460958")).toBe("+442079460958");
  });
});
