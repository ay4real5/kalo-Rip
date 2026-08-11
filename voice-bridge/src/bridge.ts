import WebSocket from "ws";
import { config } from "./config.js";
import { callTool, fetchSessionConfig } from "./app-client.js";

/**
 * One phone call: Twilio on one side, OpenAI Realtime on the other.
 *
 * Audio flows straight through in both directions. Twilio sends and expects
 * G.711 μ-law at 8 kHz, base64 encoded, and the Realtime session is configured
 * to speak the same format so nothing has to be transcoded — that keeps the
 * latency this whole rewrite exists to remove.
 */

interface TwilioStartMessage {
  event: "start";
  start: {
    streamSid: string;
    callSid: string;
    customParameters?: Record<string, string>;
  };
}

interface TwilioMediaMessage {
  event: "media";
  media: { payload: string };
}

type TwilioMessage =
  | TwilioStartMessage
  | TwilioMediaMessage
  | { event: "stop" | "connected" | "mark" };

export function handleCall(twilioWs: WebSocket) {
  let openAiWs: WebSocket | null = null;
  let streamSid = "";
  let callSid = "";
  let fromNumber = "";
  let toNumber = "";

  /** Audio queued before the OpenAI socket finished opening. */
  const pending: string[] = [];
  let openAiReady = false;

  const closeBoth = (reason: string) => {
    if (openAiWs && openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
    if (twilioWs.readyState === WebSocket.OPEN) twilioWs.close();
    console.log(`[call ${callSid || "?"}] closed: ${reason}`);
  };

  const sendToOpenAi = (payload: unknown) => {
    if (openAiWs?.readyState === WebSocket.OPEN) {
      openAiWs.send(JSON.stringify(payload));
    }
  };

  async function connectToOpenAi() {
    let session;
    try {
      session = await fetchSessionConfig();
    } catch (error) {
      console.error(`[call ${callSid}] could not load session config:`, error);
      closeBoth("session config unavailable");
      return;
    }

    openAiWs = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(config.model)}`,
      { headers: { Authorization: `Bearer ${config.openAiKey}` } }
    );

    openAiWs.on("open", () => {
      sendToOpenAi({
        type: "session.update",
        session: {
          type: "realtime",
          model: config.model,
          instructions: session.instructions,
          tools: session.tools,
          tool_choice: "auto",
          audio: {
            input: {
              format: { type: "audio/pcmu" },
              // Server-side voice activity detection is what makes the agent
              // feel immediate: OpenAI decides when the caller has stopped,
              // rather than Twilio waiting out a silence timer first.
              turn_detection: { type: "semantic_vad", create_response: true },
            },
            output: { format: { type: "audio/pcmu" }, voice: config.voice },
          },
        },
      });

      openAiReady = true;
      for (const payload of pending) {
        sendToOpenAi({ type: "input_audio_buffer.append", audio: payload });
      }
      pending.length = 0;

      // Speak first. Callers expect a greeting, and silence on answer reads as
      // a dead line.
      sendToOpenAi({
        type: "response.create",
        response: { instructions: `Greet the caller: "${config.greeting}"` },
      });
    });

    openAiWs.on("message", (raw) => {
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(raw.toString());
      } catch {
        return;
      }
      handleOpenAiEvent(event);
    });

    openAiWs.on("error", (error) => {
      console.error(`[call ${callSid}] OpenAI socket error:`, error);
      closeBoth("OpenAI socket error");
    });

    openAiWs.on("close", () => closeBoth("OpenAI socket closed"));
  }

  function handleOpenAiEvent(event: Record<string, unknown>) {
    const type = event.type as string;

    switch (type) {
      case "response.output_audio.delta": {
        // Straight through to the caller, no buffering: this is what lets the
        // agent start speaking before it has finished composing the sentence.
        const delta = event.delta as string;
        if (delta && twilioWs.readyState === WebSocket.OPEN) {
          twilioWs.send(
            JSON.stringify({ event: "media", streamSid, media: { payload: delta } })
          );
        }
        break;
      }

      case "input_audio_buffer.speech_started": {
        // The caller has started talking over the agent. Drop whatever Twilio
        // has buffered so the agent stops mid-word, which is what makes an
        // interruption feel natural rather than the caller waiting it out.
        if (twilioWs.readyState === WebSocket.OPEN) {
          twilioWs.send(JSON.stringify({ event: "clear", streamSid }));
        }
        sendToOpenAi({ type: "response.cancel" });
        break;
      }

      case "response.function_call_arguments.done": {
        void runTool(event);
        break;
      }

      case "error": {
        console.error(`[call ${callSid}] OpenAI error event:`, event.error);
        break;
      }
    }
  }

  async function runTool(event: Record<string, unknown>) {
    const name = event.name as string;
    const callId = event.call_id as string;

    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse((event.arguments as string) || "{}");
    } catch {
      // Leave args empty; the tool will reject it and the model can retry.
    }

    const result = await callTool({ name, args, callSid, fromNumber, toNumber });

    sendToOpenAi({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(result),
      },
    });
    // The tool result is only data; the model still has to say something about
    // it, so ask for the spoken turn.
    sendToOpenAi({ type: "response.create" });
  }

  twilioWs.on("message", (raw) => {
    let message: TwilioMessage;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (message.event) {
      case "start": {
        const start = (message as TwilioStartMessage).start;
        streamSid = start.streamSid;
        callSid = start.callSid;
        // Passed through from TwiML: the caller's number is how identity is
        // established, and it must come from Twilio rather than the model.
        fromNumber = start.customParameters?.from ?? "";
        toNumber = start.customParameters?.to ?? "";
        console.log(`[call ${callSid}] started from ${fromNumber}`);
        void connectToOpenAi();
        break;
      }

      case "media": {
        const payload = (message as TwilioMediaMessage).media.payload;
        if (openAiReady) {
          sendToOpenAi({ type: "input_audio_buffer.append", audio: payload });
        } else if (pending.length < 400) {
          // Roughly eight seconds of audio while OpenAI connects. Bounded so a
          // failed connection cannot grow this without limit.
          pending.push(payload);
        }
        break;
      }

      case "stop":
        closeBoth("caller hung up");
        break;
    }
  });

  twilioWs.on("close", () => closeBoth("Twilio socket closed"));
  twilioWs.on("error", (error) => {
    console.error(`[call ${callSid}] Twilio socket error:`, error);
    closeBoth("Twilio socket error");
  });
}
