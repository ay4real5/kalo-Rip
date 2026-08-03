# Kalo Rip

AI phone receptionist and booking platform for driving schools.

## What it does

- Answers incoming phone calls with an AI assistant.
- Understands enquiries, bookings, rescheduling and cancellations.
- Checks real instructor availability before confirming any slot.
- Sends confirmations by SMS/email.
- Provides an instructor portal for availability and leave.
- Provides an admin dashboard for bookings, calls and overrides.
- Transfers difficult calls to a human with a summary.
- Refills cancelled lessons from a waitlist instead of losing them.

## Architecture

```
Caller
  → Twilio phone number
  → /api/voice/incoming (TwiML)
  → /api/voice/respond (OpenAI function calling)
  → Booking engine (app/lib/booking-engine.ts)
  → PostgreSQL (Supabase today, Azure later)
  → SMS / human transfer
```

## Tech stack

- **Framework:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** Supabase Auth (placeholder today)
- **Telephony:** Twilio Voice
- **Voice AI:** OpenAI Chat Completions with function calling
- **Notifications:** Twilio SMS / email (stubs in dev)

## Local setup

1. Copy the environment template and fill in real values:

```bash
cp .env.example .env
```

2. Start PostgreSQL locally or create a Supabase project and set `DATABASE_URL`.

3. Run database migrations and seed data:

```bash
npx prisma migrate dev
npx prisma db seed
```

4. Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

5. Open http://localhost:3000

## Voice flow

The first working call flow is:

> “I want to book a driving lesson.”

1. AI asks for name, postcode, transmission and preferred time.
2. Backend searches real instructor availability.
3. AI offers genuine slots.
4. Caller selects a slot.
5. Backend holds the slot.
6. Caller confirms.
7. Backend creates the booking and sends confirmation.
8. On any failure or human request, the call is transferred.

## Important principles

- The AI never invents availability. It always calls `search_available_lesson_slots`.
- All business rules (areas, transmission, holidays, travel buffers, daily caps,
  double-booking checks) live in `app/lib/booking-engine.ts`.
- Calls, bookings and slot holds are persisted in PostgreSQL.
- Identity on a call comes from the phone line, never from the model. Tools act
  only for the caller they resolved from the incoming number.
- Times are stored as UTC instants and interpreted in `SCHOOL_TIMEZONE`
  (default `Europe/London`). Never build a lesson time with `new Date("...T09:00")` —
  that parses in the server's zone, which is UTC on Vercel and an hour out for
  the whole of BST. Use the helpers in `app/lib/timezone.ts`.
- Overlapping confirmed lessons are rejected by a database exclusion
  constraint, not just by application checks, which race.

## Waitlist

Learners can register interest in a time that isn't currently free
(`POST /api/waitlist`, optionally scoped to one instructor and a time-of-day
range). When a future booking is cancelled, `cancelBooking` matches the freed
slot against active entries and texts the earliest-joined matches, first come
first served. Notification is best-effort: it can never fail a cancellation.

## Twilio configuration

1. Buy a Twilio phone number.
2. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_PHONE_NUMBER` in `.env`.
3. In the Twilio console, set the voice webhook for incoming calls to:

```
https://<your-domain>/api/voice/incoming
```

Use HTTP POST.

## Environment variables

See `.env.example` for the full list.

## Deployment

The project is designed for deployment on Vercel, but can also be moved to Azure later. Make sure to set all environment variables in the hosting dashboard and run `npx prisma migrate deploy` after deployment.

## Roadmap to production

1. Replace dev auth with Supabase Auth or Clerk.
2. Add instructor leave / blackout dates UI.
3. Add Stripe or payment-link flow if required.
4. Upgrade Twilio flow from OpenAI Chat Completions to OpenAI Realtime API for lower latency.
5. Add reminder cron jobs and no-show follow-ups.
6. Add audit logging and GDPR data-deletion workflows.
