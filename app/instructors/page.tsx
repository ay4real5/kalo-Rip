"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle, CardDescription } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { Car, MapPin, PoundSterling, Clock, User, Zap } from "lucide-react";

interface PublicInstructor {
  id: string;
  bio: string | null;
  vehicleType: string | null;
  transmission: string;
  basePostcode: string;
  servicePostcodes: string[];
  hourlyRatePence: number;
  lessonDurationMinutes: number;
  offersIntensive: boolean;
  user: { name: string | null };
}

export default function InstructorsPage() {
  const [instructors, setInstructors] = useState<PublicInstructor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/instructors/public")
      .then((r) => r.json())
      .then((data) => {
        setInstructors(data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Our instructors</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Meet the team. Book a lesson with any of them online.
          </p>
        </div>

        {instructors.length === 0 ? (
          <div className="text-center py-16">
            <User size={40} className="mx-auto text-slate-300" />
            <p className="mt-4 text-slate-500">No instructors available right now.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {instructors.map((instructor, i) => (
              <Card
                key={instructor.id}
                padding="lg"
                hover
                className={`animate-fade-in-up stagger-${Math.min(i + 1, 5)}`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                    {(instructor.user.name ?? "I")[0]}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{instructor.user.name ?? "Instructor"}</CardTitle>
                    <CardDescription>{instructor.vehicleType ?? "Driving instructor"}</CardDescription>
                  </div>
                </div>

                {instructor.bio && (
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">{instructor.bio}</p>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Car size={16} className="text-emerald-600" />
                    {instructor.transmission.toLowerCase()}
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <PoundSterling size={16} className="text-emerald-600" />
                    £{(instructor.hourlyRatePence / 100).toFixed(2)}/hr
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Clock size={16} className="text-emerald-600" />
                    {instructor.lessonDurationMinutes} min
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <MapPin size={16} className="text-emerald-600" />
                    {instructor.basePostcode}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {instructor.servicePostcodes.slice(0, 5).map((p) => (
                    <Badge key={p} variant="neutral">{p}</Badge>
                  ))}
                  {instructor.offersIntensive && (
                    <Badge variant="primary"><Zap size={12} className="mr-1" /> Intensive</Badge>
                  )}
                </div>

                <Button href={`/book?instructor=${instructor.id}`} className="mt-6 w-full" variant="primary">
                  Book with {instructor.user.name?.split(" ")[0] ?? "this instructor"}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
