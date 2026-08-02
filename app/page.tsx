import Link from "next/link";
import {
  Bot,
  CalendarCheck,
  Headphones,
  MessageSquareText,
  ShieldCheck,
  Clock,
} from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "AI phone assistant",
    description:
      "Answers calls 24/7, understands bookings, reschedules and cancellations in natural speech.",
  },
  {
    icon: CalendarCheck,
    title: "Real-time availability",
    description:
      "Only confirms slots that exist. Checks instructor schedules, areas, vehicle type and travel time.",
  },
  {
    icon: Headphones,
    title: "Human handoff",
    description:
      "Transfers distressed callers, complex requests and complaints to a real person with a call summary.",
  },
  {
    icon: MessageSquareText,
    title: "SMS confirmations",
    description:
      "Sends booking confirmations and reminders automatically, keeping learners and instructors informed.",
  },
  {
    icon: ShieldCheck,
    title: "No double bookings",
    description:
      "Every booking is protected by a temporary hold and conflict check before it is confirmed.",
  },
  {
    icon: Clock,
    title: "Instructor portal",
    description:
      "Instructors manage their own weekly hours, leave and service areas without back-and-forth calls.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      <section className="bg-white px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-600"></span>
            </span>
            AI receptionist for driving schools
          </div>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl">
            Never miss a booking call again
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600">
            Kalo Rip answers learner and parent calls, checks real instructor availability, books lessons and only hands off to you when it needs to.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/admin"
              className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              Open admin dashboard
            </Link>
            <Link
              href="/instructor"
              className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-200 hover:bg-zinc-50"
            >
              Instructor portal
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <feature.icon size={22} />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-zinc-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-indigo-600 px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready to let the AI take your next call?
          </h2>
          <p className="mt-4 text-indigo-100">
            Set your Twilio webhook to{" "}
            <code className="rounded bg-indigo-500 px-2 py-1 text-sm">
              https://kalo-rip.vercel.app/api/voice/incoming
            </code>{" "}
            and start booking real lessons.
          </p>
        </div>
      </section>
    </div>
  );
}
