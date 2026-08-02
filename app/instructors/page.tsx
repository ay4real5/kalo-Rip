"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle, CardDescription } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { Car, MapPin, PoundSterling, Clock, User, Zap, Star } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  booking: {
    customer: { user: { name: string | null } };
  };
}

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
  const [reviews, setReviews] = useState<Record<string, Review[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/instructors/public")
      .then((r) => r.json())
      .then(async (data) => {
        setInstructors(data);
        setLoading(false);
        // Fetch reviews for each instructor in parallel
        const reviewFetches = data.map(async (instructor: PublicInstructor) => {
          const res = await fetch(`/api/reviews?instructorId=${instructor.id}`);
          const r = await res.json();
          return [instructor.id, r] as const;
        });
        const entries = await Promise.all(reviewFetches);
        setReviews(Object.fromEntries(entries));
      });
  }, []);

  function avgRating(instructorId: string): number | null {
    const r = reviews[instructorId];
    if (!r || r.length === 0) return null;
    return r.reduce((sum, x) => sum + x.rating, 0) / r.length;
  }

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

                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <MapPin size={12} /> Service area
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {instructor.servicePostcodes.slice(0, 8).map((p) => (
                      <Badge key={p} variant="neutral">{p}</Badge>
                    ))}
                    {instructor.servicePostcodes.length > 8 && (
                      <Badge variant="neutral">+{instructor.servicePostcodes.length - 8} more</Badge>
                    )}
                    {instructor.offersIntensive && (
                      <Badge variant="primary"><Zap size={12} className="mr-1" /> Intensive</Badge>
                    )}
                  </div>
                </div>

                {avgRating(instructor.id) !== null && (
                  <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            size={16}
                            className={n <= Math.round(avgRating(instructor.id)!) ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600"}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {avgRating(instructor.id)!.toFixed(1)}
                      </span>
                      <span className="text-xs text-slate-400">
                        ({reviews[instructor.id].length} review{reviews[instructor.id].length !== 1 ? "s" : ""})
                      </span>
                    </div>
                    {reviews[instructor.id].slice(0, 1).map((r) => (
                      <p key={r.id} className="mt-2 text-sm italic text-slate-500 dark:text-slate-400">
                        &ldquo;{r.comment}&rdquo; — {r.booking.customer.user.name ?? "Anonymous"}
                      </p>
                    ))}
                  </div>
                )}

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
