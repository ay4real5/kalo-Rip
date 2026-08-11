# Voice bridge

Streams audio between Twilio Media Streams and the OpenAI Realtime API, so the
phone agent answers in well under a second and the caller can interrupt it.

It exists as a separate service because Vercel cannot hold a WebSocket open for
the length of a phone call. It carries audio and nothing else — every booking
rule stays in the Next.js app, reached through `POST /api/voice/tool`.

```
caller → Twilio ──audio──▶ bridge ──audio──▶ OpenAI Realtime
                             │
                             └── tool call ──▶ app /api/voice/tool ──▶ booking engine
```

## Deploying to Railway

Use the **Hobby** plan, $5/month. The Free tier gives $1 of usage credits, and
an always-on service costs roughly $3–4/month at Railway's per-second rates — it
would stop partway through the month, which for a phone line means calls simply
stop being answered.

1. New project → Deploy from GitHub repo → this repository.
2. Settings → **Root Directory: `voice-bridge`**. Without this Railway builds the
   Next.js app instead.
3. Settings → Networking → **Generate Domain**. Note the hostname.
4. Variables:

   | Variable | Value |
   |---|---|
   | `OPENAI_API_KEY` | same key the app uses |
   | `APP_URL` | `https://kalo-rip.vercel.app` |
   | `VOICE_BRIDGE_SECRET` | a long random string |
   | `REALTIME_VOICE` | optional, defaults to `marin` |

5. Confirm it is up: `curl https://<your-domain>/health` → `{"ok":true,...}`

## Switching the phone line over

In **Vercel**, set:

| Variable | Value |
|---|---|
| `VOICE_BRIDGE_SECRET` | the same string as on Railway |
| `VOICE_BRIDGE_WSS_URL` | `wss://<your-railway-domain>/twilio` |
| `VOICE_MODE` | `realtime` |

Redeploy, then call the number.

**To roll back, set `VOICE_MODE=gather`.** It takes effect on the next call with
no deploy. The original transcribe-think-speak flow is still in the app and
still works; the switch defaults to it, so a missing or mistyped variable lands
on the implementation known to answer the phone.

## Local development

```bash
npm install
OPENAI_API_KEY=sk-... \
APP_URL=https://kalo-rip.vercel.app \
VOICE_BRIDGE_SECRET=... \
npm run dev
```

Point Twilio at a tunnel (`ngrok http 8080`) and set `VOICE_BRIDGE_WSS_URL` to
`wss://<tunnel-host>/twilio`.

## Notes

- Audio is G.711 μ-law at 8 kHz in both directions, which is what Twilio sends
  and expects. The Realtime session is configured to match so nothing is
  transcoded — transcoding would reintroduce the latency this replaces.
- Turn detection runs server-side at OpenAI rather than waiting on a Twilio
  silence timer.
- When the caller talks over the agent, the bridge sends Twilio a `clear` to
  drop buffered audio and cancels the in-flight response, so the agent stops
  mid-word instead of talking on.
- The prompt and tool schemas are fetched from the app per call, so there is one
  definition of each. It also keeps the date correct — a process running for
  weeks would otherwise still think it was the day it booted.
