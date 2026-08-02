import { Button } from "@/app/components/ui/Button";
import { Home, Calendar } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="text-7xl font-bold text-emerald-600">404</div>
      <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">Page not found</h1>
      <p className="mt-2 max-w-md text-slate-600 dark:text-slate-400">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="mt-8 flex gap-3">
        <Button href="/" icon={<Home size={16} />} variant="primary">
          Go home
        </Button>
        <Button href="/book" icon={<Calendar size={16} />} variant="secondary">
          Book a lesson
        </Button>
      </div>
    </div>
  );
}
