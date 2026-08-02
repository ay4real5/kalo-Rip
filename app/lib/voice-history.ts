/**
 * Conversation history for the voice agent.
 *
 * OpenAI enforces a structural rule that is easy to break and fails loudly at
 * request time rather than where the mistake was made: every message with role
 * "tool" must be preceded by an assistant message carrying a matching entry in
 * its `tool_calls`. Break it and the request 400s, the caller is transferred to
 * a human, and — because history is persisted — every later turn of that call
 * fails too.
 *
 * These helpers exist so that rule is enforced in one testable place.
 */

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface VoiceMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Required on the assistant turn that requests tools. */
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

/**
 * Drop `tool` messages that no preceding assistant turn asked for.
 *
 * Transcripts written before the tool_calls fix are stored in exactly that
 * broken shape, so replaying one verbatim would 400 forever.
 */
export function dropOrphanToolMessages(history: VoiceMessage[]): VoiceMessage[] {
  const requested = new Set<string>();

  return history.filter((message) => {
    if (message.role === "assistant") {
      for (const call of message.tool_calls ?? []) requested.add(call.id);
      return true;
    }
    if (message.role !== "tool") return true;
    return message.tool_call_id !== undefined && requested.has(message.tool_call_id);
  });
}

/**
 * Trim to roughly the most recent `limit` messages without orphaning tool
 * results.
 *
 * Slicing blindly can cut between an assistant's tool_calls and the `tool`
 * messages answering it, which reintroduces the 400 this module exists to
 * prevent. When the cut lands inside such a block, the start moves *back* to
 * the assistant turn that opened it — so the result can be slightly longer
 * than `limit`. Moving forward instead would drop the replies, and a cut
 * landing on a long run of them could discard the conversation entirely.
 */
export function trimHistory(history: VoiceMessage[], limit = 30): VoiceMessage[] {
  if (history.length <= limit) return history;

  let start = history.length - limit;
  while (start > 0 && history[start].role === "tool") {
    start--;
  }
  return history.slice(start);
}

/**
 * Whether a history satisfies OpenAI's tool-message rule. Used by the tests as
 * the single source of truth for what "valid" means.
 */
export function isValidToolSequence(history: VoiceMessage[]): boolean {
  const requested = new Set<string>();

  for (const message of history) {
    if (message.role === "assistant") {
      for (const call of message.tool_calls ?? []) requested.add(call.id);
      continue;
    }
    if (message.role !== "tool") continue;
    if (message.tool_call_id === undefined || !requested.has(message.tool_call_id)) {
      return false;
    }
  }
  return true;
}
