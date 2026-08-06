// Temporary latency probe against the deployed app, as Twilio would call it.
import crypto from "node:crypto";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);

const BASE = "https://kalo-rip.vercel.app";
const prisma = new PrismaClient();
const SID = `CAlat${Date.now()}`;
const FROM = "+447700900123";

function sign(url: string, params: Record<string, string>) {
  let d = url;
  for (const k of Object.keys(params).sort()) d += k + params[k];
  return crypto.createHmac("sha1", env.TWILIO_AUTH_TOKEN).update(d, "utf8").digest("base64");
}

async function post(path: string, params: Record<string, string>) {
  const url = `${BASE}${path}`;
  const t = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": sign(url, params),
    },
    body: new URLSearchParams(params).toString(),
  });
  const body = await res.text();
  return { ms: Date.now() - t, status: res.status, body };
}

const spoken = (twiml: string) =>
  [...twiml.matchAll(/<Say[^>]*>([\s\S]*?)<\/Say>/g)].map((m) => m[1].trim())[0] ?? "";

async function main() {
  const base = { CallSid: SID, From: FROM, To: env.TWILIO_PHONE_NUMBER ?? "+447414104022" };

  const incoming = await post("/api/voice/incoming", { ...base, AccountSid: "ACx" });
  console.log(`incoming            ${String(incoming.ms).padStart(5)}ms`);

  const turns = [
    "I want to book a driving lesson",
    "My name is Test Caller, postcode CR0 1AA, automatic please",
    "Next week is fine",
  ];

  for (const [i, text] of turns.entries()) {
    const r = await post("/api/voice/respond", {
      ...base,
      SpeechResult: text,
      Confidence: "0.95",
    });
    const said = spoken(r.body);
    // Speech time matters as much as think time — a 90-word answer takes ~30s
    // to read aloud however fast the model was.
    const words = said.split(/\s+/).filter(Boolean).length;
    console.log(
      `turn ${i + 1}  HTTP ${r.status}  ${String(r.ms).padStart(5)}ms  ${String(words).padStart(3)} words (~${Math.round((words / 150) * 60)}s spoken)`
    );
    console.log(`         "${said.slice(0, 120).replace(/\s+/g, " ")}${said.length > 120 ? "…" : ""}"`);
  }

  await prisma.callLog.deleteMany({ where: { twilioSid: SID } });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exitCode = 1;
});
