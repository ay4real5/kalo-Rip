/**
 * Local smoke test: pretends to be Twilio and checks the bridge gets a real
 * Realtime session up and audio flowing back.
 *
 * Run the bridge first, then: node smoke-test.mjs
 */
import WebSocket from "ws";

const BRIDGE = process.env.BRIDGE_WS ?? "ws://localhost:8080/twilio";
const CALL_SID = "CAsmoke" + Date.now();

// One frame of μ-law silence. 0xFF is silence in G.711 μ-law; 160 bytes is the
// 20ms frame size Twilio sends at 8 kHz.
const SILENCE = Buffer.alloc(160, 0xff).toString("base64");

let audioFrames = 0;
let cleared = 0;
const started = Date.now();

const ws = new WebSocket(BRIDGE);

ws.on("open", () => {
  console.log("connected to bridge");
  ws.send(JSON.stringify({ event: "connected", protocol: "Call" }));
  ws.send(
    JSON.stringify({
      event: "start",
      start: {
        streamSid: "MZsmoke",
        callSid: CALL_SID,
        customParameters: { from: "+447700900123", to: "+447414104022" },
      },
    })
  );

  // Keep sending frames as a real call would; the greeting should come back
  // without us saying anything.
  const timer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: "media", media: { payload: SILENCE } }));
    }
  }, 20);

  setTimeout(() => {
    clearInterval(timer);
    ws.send(JSON.stringify({ event: "stop" }));

    console.log("");
    console.log(`audio frames received from agent: ${audioFrames}`);
    console.log(`clear (barge-in) messages:        ${cleared}`);
    const ok = audioFrames > 0;
    console.log(
      ok
        ? `\nPASS - the agent spoke (first audio after ${firstAudioMs}ms)`
        : "\nFAIL - no audio came back; check bridge logs"
    );
    ws.close();
    process.exit(ok ? 0 : 1);
  }, 12000);
});

let firstAudioMs = 0;

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.event === "media") {
    if (audioFrames === 0) firstAudioMs = Date.now() - started;
    audioFrames++;
  }
  if (msg.event === "clear") cleared++;
});

ws.on("error", (e) => {
  console.error("bridge connection failed:", e.message);
  process.exit(1);
});
