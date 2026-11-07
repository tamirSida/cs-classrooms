import { CampusNow, hasStarted } from "@/lib/time";

export type CancelScope = "this" | "following" | "all";

export interface CancelCandidate {
  id: string;
  userId: string;
  classroomId: string;
  status: string;
  date: string;
  startTime: string;
  occurrenceIndex?: number;
}

export interface CancelSelection<B> {
  cancel: B[];
  keptStarted: B[];
}

// Picks which series bookings a cancel affects. Only live bookings that really belong
// to the series owner and classroom are eligible, so a forged seriesId has no effect.
export function selectForCancel<B extends CancelCandidate>(
  bookings: B[],
  series: { userId: string; classroomId: string },
  scope: CancelScope,
  anchor: { id: string; occurrenceIndex?: number } | null,
  now: CampusNow
): CancelSelection<B> {
  const eligible = bookings
    .filter(
      (b) =>
        b.status !== "cancelled" &&
        b.userId === series.userId &&
        b.classroomId === series.classroomId
    )
    .sort((a, b) => (a.occurrenceIndex ?? 0) - (b.occurrenceIndex ?? 0));

  const inScope = eligible.filter((b) => {
    if (scope === "all") return true;
    if (!anchor) return false;
    if (scope === "this") return b.id === anchor.id;
    return (b.occurrenceIndex ?? 0) >= (anchor.occurrenceIndex ?? 0);
  });

  return {
    cancel: inScope.filter((b) => !hasStarted(b, now)),
    keptStarted: inScope.filter((b) => hasStarted(b, now)),
  };
}
