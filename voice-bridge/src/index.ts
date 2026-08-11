import { createServer } from "node:http";
import WebSocket, { WebSocketServer } from "ws";
import { config } from "./config.js";
import { handleCall } from "./bridge.js";
import { fetchSessionConfig } from "./app-client.js";

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

  // Reports what the bridge can actually reach from where it runs. A call that
  // connects and then hears nothing gives no clue whether the app or OpenAI is
  // the problem, and Railway's logs are not visible from everywhere.
  if (req.url === "/diag") {
    void runDiagnostics().then((result) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result, null, 2));
    });
    return;
  }

  res.writeHead(404).end();
});

async function runDiagnostics() {
  const out: Record<string, unknown> = {
    appUrl: config.appUrl,
    model: config.model,
    voice: config.voice,
    nodeEnv: process.env.NODE_ENV ?? "(unset)",
  };

  try {
    const session = await fetchSessionConfig();
    out.appReachable = true;
    out.toolCount = session.tools.length;
    out.promptChars = session.instructions.length;
  } catch (error) {
    out.appReachable = false;
    out.appError = error instanceof Error ? error.message.slice(0, 300) : String(error);
  }

  // Can this host open a Realtime socket at all? Egress rules and a bad key
  // both show up here rather than mid-call.
  out.openAi = await new Promise((resolve) => {
    const probe = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(config.model)}`,
      { headers: { Authorization: `Bearer ${config.openAiKey}` } }
    );
    const done = (value: unknown) => {
      try {
        probe.close();
      } catch {
        /* already closed */
      }
      resolve(value);
    };
    probe.on("open", () => done("connected"));
    probe.on("unexpected-response", (_req, res) =>
      done(`rejected: HTTP ${res.statusCode}`)
    );
    probe.on("error", (e: Error) => done(`error: ${e.message.slice(0, 200)}`));
    setTimeout(() => done("timeout after 8s"), 8000);
  });

  return out;
}

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
