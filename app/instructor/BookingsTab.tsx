"use client";

import { useEffect, useState } from "react";
import { SCHOOL_TIMEZONE } from "@/app/lib/timezone";
import { Card } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ToastProvider";
import { CalendarDays, Clock, User, Phone, CheckCircle2, Loader2, StickyNote } from "lucide-react";

interface Booking {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  lessonType: string;
  notes: string | null;
  customer: { user: { name: string | null; phone: string | null; email: string } };
}

export function BookingsTab({ instructorId }: { instructorId: string }) {
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [notesId, setNotesId] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    fetch(`/api/instructors/${instructorId}/bookings`)
      .then((r) => r.json())
      .then((data) => {
        setBookings(data);
        setLoading(false);
      });
  }, [instructorId]);

  async function completeBooking(id: string) {
    setCompletingId(id);
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    if (res.ok) {
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: "COMPLETED" } : b))
      );
      showToast("Lesson marked complete", "success");
    } else {
      showToast("Failed to mark complete", "error");
    }
    setCompletingId(null);
  }

  function startNotes(id: string, currentNotes: string | null) {
    setNotesId(id);
    setNotesValue(currentNotes ?? "");
  }

  async function saveNotes(id: string) {
    setSavingNotes(true);
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructorNotes: notesValue }),
    });
    if (res.ok) {
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, notes: notesValue } : b))
      );
      showToast("Notes saved", "success");
      setNotesId(null);
    } else {
      showToast("Failed to save notes", "error");
    }
    setSavingNotes(false);
  }

  const now = new Date();
  const upcoming = bookings.filter((b) => new Date(b.startsAt) >= now && b.status === "CONFIRMED");
  const past = bookings.filter((b) => new Date(b.startsAt) < now || b.status !== "CONFIRMED");

  if (loading) {
    return (
      <Card padding="md">
        <div className="h-64 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <CalendarDays size={20} className="text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Upcoming lessons</h2>
            <Badge variant="primary">{upcoming.length}</Badge>
          </div>
        </div>
        <div className="px-6 py-4">
          {upcoming.length === 0 ? (
            <p className="py-8 text-center text-slate-500 dark:text-slate-400">No upcoming lessons.</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((b) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  onComplete={completeBooking}
                  completing={completingId === b.id}
                  onNotes={startNotes}
                  notesId={notesId}
                  notesValue={notesValue}
                  setNotesValue={setNotesValue}
                  onSaveNotes={saveNotes}
                  savingNotes={savingNotes}
                  onCancelNotes={() => setNotesId(null)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      {past.length > 0 && (
        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Past lessons</h2>
          </div>
          <div className="px-6 py-4">
            <div className="space-y-3">
              {past.slice(0, 20).map((b) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  onComplete={completeBooking}
                  completing={completingId === b.id}
                  onNotes={startNotes}
                  notesId={notesId}
                  notesValue={notesValue}
                  setNotesValue={setNotesValue}
                  onSaveNotes={saveNotes}
                  savingNotes={savingNotes}
                  onCancelNotes={() => setNotesId(null)}
                />
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

interface BookingRowProps {
  booking: Booking;
  onComplete: (id: string) => void;
  completing: boolean;
  onNotes: (id: string, currentNotes: string | null) => void;
  notesId: string | null;
  notesValue: string;
  setNotesValue: (v: string) => void;
  onSaveNotes: (id: string) => void;
  savingNotes: boolean;
  onCancelNotes: () => void;
}

function BookingRow({
  booking,
  onComplete,
  completing,
  onNotes,
  notesId,
  notesValue,
  setNotesValue,
  onSaveNotes,
  savingNotes,
  onCancelNotes,
}: BookingRowProps) {
  const start = new Date(booking.startsAt);
  const isPast = start < new Date();
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
            <Clock size={20} />
          </div>
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {start.toLocaleString("en-GB", { timeZone: SCHOOL_TIMEZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <User size={12} />
                {booking.customer.user.name ?? booking.customer.user.email}
              </span>
              {booking.customer.user.phone && (
                <span className="flex items-center gap-1">
                  <Phone size={12} />
                  {booking.customer.user.phone}
                </span>
              )}
            </div>
            {booking.notes && (
              <p className="mt-1 text-xs text-slate-400">{booking.notes}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={booking.status === "CONFIRMED" ? "success" : booking.status === "COMPLETED" ? "primary" : "neutral"} dot>
            {booking.status}
          </Badge>
          <span className="text-xs capitalize text-slate-400">{booking.lessonType.toLowerCase()}</span>
        </div>
      </div>

      {booking.status === "CONFIRMED" && isPast && (
        <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
          <Button
            onClick={() => onComplete(booking.id)}
            disabled={completing}
            variant="primary"
            icon={completing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          >
            {completing ? "Completing..." : "Mark complete"}
          </Button>
          <Button
            onClick={() => onNotes(booking.id, booking.notes)}
            variant="secondary"
            icon={<StickyNote size={14} />}
          >
            Notes
          </Button>
        </div>
      )}

      {notesId === booking.id && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
          <textarea
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            placeholder="Lesson notes — progress, areas to improve, etc."
            rows={3}
            className="w-full rounded-xl border-slate-200 bg-white p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <div className="mt-2 flex gap-2">
            <Button onClick={() => onSaveNotes(booking.id)} disabled={savingNotes} variant="primary">
              {savingNotes ? "Saving..." : "Save notes"}
            </Button>
            <Button onClick={onCancelNotes} variant="secondary">Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
