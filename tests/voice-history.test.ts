import { describe, expect, it } from "vitest";
import {
  dropOrphanToolMessages,
  isValidToolSequence,
  trimHistory,
  type VoiceMessage,
} from "@/app/lib/voice-history";

/**
 * The bug these guard: the assistant turn was pushed without its tool_calls,
 * so every `tool` message was orphaned. OpenAI 400s on that, the route's catch
 * block transferred the caller to a human, and the malformed history was
 * persisted — poisoning every later turn of the same call. Every booking call
 * that got as far as searching for a slot failed.
 */

const toolCall = (id: string, name = "search_available_lesson_slots") => ({
  id,
  type: "function" as const,
  function: { name, arguments: "{}" },
});

const assistantAsking = (...ids: string[]): VoiceMessage => ({
  role: "assistant",
  content: "",
  tool_calls: ids.map((id) => toolCall(id)),
});

const toolReply = (id: string): VoiceMessage => ({
  role: "tool",
  content: "{}",
  tool_call_id: id,
  name: "search_available_lesson_slots",
});

const user = (content: string): VoiceMessage => ({ role: "user", content });

describe("isValidToolSequence", () => {
  it("accepts a tool reply that answers a preceding request", () => {
    expect(
      isValidToolSequence([user("book a lesson"), assistantAsking("call_1"), toolReply("call_1")])
    ).toBe(true);
  });

  it("rejects the exact shape the old code produced", () => {
    // An assistant turn with no tool_calls, followed by tool messages.
    const broken: VoiceMessage[] = [
      user("book a lesson"),
      { role: "assistant", content: "Calling tool..." },
      toolReply("call_1"),
    ];
    expect(isValidToolSequence(broken)).toBe(false);
  });

  it("rejects a tool reply whose id was never requested", () => {
    expect(isValidToolSequence([assistantAsking("call_1"), toolReply("call_2")])).toBe(false);
  });

  it("accepts parallel tool calls answered together", () => {
    expect(
      isValidToolSequence([assistantAsking("a", "b"), toolReply("a"), toolReply("b")])
    ).toBe(true);
  });
});

describe("dropOrphanToolMessages", () => {
  it("repairs a transcript stored in the broken shape", () => {
    const poisoned: VoiceMessage[] = [
      user("book a lesson"),
      { role: "assistant", content: "Calling tool..." },
      toolReply("call_1"),
      { role: "assistant", content: "I found three slots." },
    ];

    const repaired = dropOrphanToolMessages(poisoned);

    expect(isValidToolSequence(repaired)).toBe(true);
    expect(repaired.some((m) => m.role === "tool")).toBe(false);
    // The conversation itself is preserved; only the unusable parts go.
    expect(repaired.filter((m) => m.role === "assistant")).toHaveLength(2);
    expect(repaired[0]).toEqual(user("book a lesson"));
  });

  it("leaves a well-formed history untouched", () => {
    const good = [user("hi"), assistantAsking("call_1"), toolReply("call_1")];
    expect(dropOrphanToolMessages(good)).toEqual(good);
  });

  it("keeps replies to earlier requests while dropping unmatched ones", () => {
    const mixed: VoiceMessage[] = [
      assistantAsking("call_1"),
      toolReply("call_1"),
      toolReply("call_ghost"),
    ];
    const repaired = dropOrphanToolMessages(mixed);
    expect(repaired).toHaveLength(2);
    expect(isValidToolSequence(repaired)).toBe(true);
  });

  it("handles an empty history", () => {
    expect(dropOrphanToolMessages([])).toEqual([]);
  });
});

describe("trimHistory", () => {
  it("does not cut between a tool request and its replies", () => {
    // slice(-30) could land mid-sequence and reintroduce the 400.
    const history: VoiceMessage[] = [
      ...Array.from({ length: 28 }, (_, i) => user(`turn ${i}`)),
      assistantAsking("call_1", "call_2"),
      toolReply("call_1"),
      toolReply("call_2"),
    ];

    const trimmed = trimHistory(history, 2);

    expect(isValidToolSequence(trimmed)).toBe(true);
    // Starts at the assistant turn that opened the block, not mid-block, and
    // never discards the block by walking forward off the end.
    expect(trimmed[0].role).toBe("assistant");
    expect(trimmed).toHaveLength(3);
  });

  it("never returns an empty history when one was given", () => {
    const history: VoiceMessage[] = [
      assistantAsking("call_1", "call_2", "call_3"),
      toolReply("call_1"),
      toolReply("call_2"),
      toolReply("call_3"),
    ];
    expect(trimHistory(history, 1)).toHaveLength(4);
  });

  it("keeps a valid sequence valid at every trim length", () => {
    const history: VoiceMessage[] = [
      user("a"),
      assistantAsking("call_1"),
      toolReply("call_1"),
      user("b"),
      assistantAsking("call_2", "call_3"),
      toolReply("call_2"),
      toolReply("call_3"),
      { role: "assistant", content: "done" },
    ];

    for (let limit = 1; limit <= history.length + 2; limit++) {
      expect(isValidToolSequence(trimHistory(history, limit))).toBe(true);
    }
  });

  it("returns short histories unchanged", () => {
    const history = [user("a"), user("b")];
    expect(trimHistory(history, 30)).toEqual(history);
  });

  it("caps length to the limit", () => {
    const history = Array.from({ length: 50 }, (_, i) => user(`turn ${i}`));
    expect(trimHistory(history, 30)).toHaveLength(30);
  });
});
