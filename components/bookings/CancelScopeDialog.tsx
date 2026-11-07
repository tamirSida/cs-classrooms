"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cancelSeries } from "@/hooks/useBookingSeries";
import { BookingRef, IBooking, SeriesCancelResult } from "@/lib/models";
import { CancelScope, formatDateLabel } from "@/lib/recurrence";

interface CancelScopeDialogProps {
  booking: IBooking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (result: SeriesCancelResult) => void;
}

type Previews = Record<Exclude<CancelScope, "this">, BookingRef[]>;

export function CancelScopeDialog({ booking, open, onOpenChange, onDone }: CancelScopeDialogProps) {
  const [scope, setScope] = useState<CancelScope>("this");
  const [loaded, setLoaded] = useState<{ key: string; previews: Previews | null; error: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SeriesCancelResult | null>(null);

  const seriesId = booking?.seriesId;
  const bookingId = booking?.id;
  const loadKey = open && seriesId && bookingId ? `${seriesId}:${bookingId}` : null;

  useEffect(() => {
    if (!loadKey || !seriesId || !bookingId) return;
    let active = true;

    Promise.all([
      cancelSeries(seriesId, { scope: "following", fromBookingId: bookingId, dryRun: true }),
      cancelSeries(seriesId, { scope: "all", dryRun: true }),
    ]).then(([following, all]) => {
      if (!active) return;
      setLoaded(
        following.ok && all.ok
          ? { key: loadKey, previews: { following: following.data.cancelled, all: all.data.cancelled }, error: null }
          : { key: loadKey, previews: null, error: !following.ok ? following.error : !all.ok ? all.error : null }
      );
    });

    return () => {
      active = false;
    };
  }, [loadKey, seriesId, bookingId]);

  if (!booking || !seriesId) return null;

  const current = loaded?.key === loadKey ? loaded : null;
  const previews = current?.previews ?? null;
  const shownError = error ?? current?.error ?? null;

  const reset = () => {
    setScope("this");
    setError(null);
    setLoaded(null);
    setOutcome(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // A finished cancel still has to reach the parent so it refreshes.
      if (outcome) onDone(outcome);
      reset();
    }
    onOpenChange(next);
  };

  const selectedDates =
    scope === "this" ? [booking.date] : (previews?.[scope] ?? []).map((b) => b.date);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    const result = await cancelSeries(seriesId, { scope, fromBookingId: booking.id });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.data.keptStarted.length > 0) {
      // Stay open so the user sees which dates could not be cancelled.
      setOutcome(result.data);
      return;
    }
    reset();
    onDone(result.data);
  };

  const finish = () => {
    const done = outcome;
    reset();
    if (done) onDone(done);
  };

  const countLabel = (key: keyof Previews) => (previews ? ` (${previews[key].length})` : "");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cancel recurring booking</DialogTitle>
          <DialogDescription>
            Choose which dates to cancel. Dates that have already started are always kept.
          </DialogDescription>
        </DialogHeader>

        {outcome ? (
          <div className="space-y-3 text-sm">
            <p>
              {outcome.cancelled.length > 0
                ? `Cancelled ${outcome.cancelled.length} ${outcome.cancelled.length === 1 ? "booking" : "bookings"}.`
                : "Nothing was cancelled."}
            </p>
            <div className="rounded-md bg-amber-50 p-3 text-amber-800">
              <p className="font-medium">Kept because they had already started:</p>
              <ul className="mt-1 list-disc pl-5">
                {outcome.keptStarted.map((b) => (
                  <li key={b.id}>{formatDateLabel(b.date)}</li>
                ))}
              </ul>
            </div>
            <DialogFooter>
              <Button onClick={finish}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
        <RadioGroup value={scope} onValueChange={(v) => setScope(v as CancelScope)} className="space-y-3">
          <RadioGroupItem value="this" id="cancel-scope-this">
            <span className="text-sm">This booking only ({formatDateLabel(booking.date)})</span>
          </RadioGroupItem>
          <RadioGroupItem value="following" id="cancel-scope-following">
            <span className="text-sm">This and following bookings{countLabel("following")}</span>
          </RadioGroupItem>
          <RadioGroupItem value="all" id="cancel-scope-all">
            <span className="text-sm">All remaining bookings{countLabel("all")}</span>
          </RadioGroupItem>
        </RadioGroup>

        {scope !== "this" && previews && (
          <ul className="max-h-40 overflow-y-auto rounded-md border divide-y text-sm">
            {selectedDates.map((date) => (
              <li key={date} className="px-3 py-1.5">
                {formatDateLabel(date)}
              </li>
            ))}
          </ul>
        )}

        {shownError && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{shownError}</div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Keep bookings
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting || (scope !== "this" && (!previews || selectedDates.length === 0))}
          >
            {submitting
              ? "Cancelling..."
              : `Cancel ${selectedDates.length || ""} ${selectedDates.length === 1 ? "booking" : "bookings"}`.replace("  ", " ")}
          </Button>
        </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
