import { Button } from "@/app/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import {
  Bot,
  CalendarCheck,
  Headphones,
  MessageSquareText,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Car,
  Calendar,
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

const benefits = [
  "Capture every enquiry, even out of hours",
  "Reduce admin time for your school",
  "Give instructors their own schedule login",
  "Book with confidence using live availability",
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-900 px-6 py-24 lg:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(16,185,129,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(59,130,246,0.1),transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-400 ring-1 ring-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              AI receptionist for driving schools
            </div>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Never miss a booking call again
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300 lg:text-xl">
              Kalo Rip answers learner and parent calls, checks real instructor availability, books lessons and only hands off to you when it needs to.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button href="/book" size="lg" variant="primary" icon={<Calendar size={18} />}>
                Book a lesson
              </Button>
              <Button href="/admin" size="lg" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white">
                Open dashboard
              </Button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            {[
              { value: "24/7", label: "Call answering" },
              { value: "0", label: "Double bookings" },
              { value: "Live", label: "Availability" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 text-center backdrop-blur-sm"
              >
                <div className="text-3xl font-bold text-emerald-400">{stat.value}</div>
                <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Built for busy driving schools
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Stop losing learners to missed calls. The AI handles enquiries, checks real instructor slots and books lessons while you focus on teaching.
              </p>
              <ul className="mt-8 space-y-4">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <CheckCircle2 size={14} />
                    </div>
                    <span className="text-slate-700">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-blue-500/20 blur-2xl" />
              <Card className="relative border-slate-200 p-8" padding="lg">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
                    <Car size={28} />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-slate-900">Driving School Demo</div>
                    <div className="text-sm text-slate-500">AI booking assistant active</div>
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  {[
                    "Caller asks to book a lesson",
                    "AI checks instructor availability",
                    "Slot is held and confirmed",
                    "SMS confirmation is sent",
                  ].map((step, i) => (
                    <div key={step} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                        {i + 1}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{step}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Everything you need to run bookings
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              From the first phone call to the confirmed lesson, Kalo Rip keeps the process smooth.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} hover padding="lg">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <feature.icon size={24} />
                </div>
                <CardHeader className="mt-5 px-0 pb-0">
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardDescription>{feature.description}</CardDescription>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-emerald-600 px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to let the AI take your next call?
          </h2>
          <p className="mt-4 text-emerald-100">
            Set your Twilio webhook to{" "}
            <code className="rounded-lg bg-emerald-500 px-3 py-1 text-sm font-medium">
              https://kalo-rip.vercel.app/api/voice/incoming
            </code>
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button
              href="/admin"
              size="lg"
              variant="secondary"
              className="bg-white text-emerald-700 hover:bg-slate-50"
            >
              Open admin dashboard
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
