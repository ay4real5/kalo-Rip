import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { config } from "./config.js";
import { handleCall } from "./bridge.js";

/**
 * Realtime voice bridge.
 *
 * Exists because Vercel cannot hold a WebSocket open for the length of a phone
 * call. Everything else stays in the Next.js app; this process only carries
 * audio between Twilio and OpenAI, and asks the app whenever a booking
 * decision is needed.
 */

const server = createServer((req, res) => {
  // Railway health checks, and a quick way to confirm a deploy is alive.
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, model: config.model }));
    return;
  }
  res.writeHead(404).end();
});

// noServer so non-WebSocket traffic still gets the health check above.
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  if (!request.url?.startsWith("/twilio")) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

wss.on("connection", (ws) => handleCall(ws));

server.listen(config.port, () => {
  console.log(`voice bridge listening on ${config.port}, model ${config.model}`);
});

// Railway restarts the process on crash, but an unhandled rejection mid-call
// would otherwise take down every call in flight, not just the one that broke.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

const shutdown = () => {
  console.log("shutting down");
  wss.clients.forEach((client) => client.close());
  server.close(() => process.exit(0));
  // Don't let a stuck socket hold the deploy open indefinitely.
  setTimeout(() => process.exit(0), 5000).unref();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
