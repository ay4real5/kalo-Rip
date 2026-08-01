import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          Kalo Rip
        </h1>
        <p className="mt-4 text-lg text-zinc-600">
          AI phone receptionist and booking platform for driving schools.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/admin"
            className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Admin dashboard
          </Link>
          <Link
            href="/instructor"
            className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-200 hover:bg-zinc-50"
          >
            Instructor portal
          </Link>
        </div>
      </div>
    </main>
  );
}
