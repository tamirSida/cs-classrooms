import { describe, expect, it } from "vitest";
import { selectForCancel, CancelCandidate } from "./cancelScope";

const SERIES = { userId: "u1", classroomId: "c1" };
const NOW = { date: "2026-11-10", time: "10:30" };

function booking(i: number, date: string, overrides: Partial<CancelCandidate> = {}): CancelCandidate {
  return {
    id: `b${i}`,
    userId: "u1",
    classroomId: "c1",
    status: "confirmed",
    date,
    startTime: "10:00",
    occurrenceIndex: i,
    ...overrides,
  };
}

const bookings = [
  booking(0, "2026-11-03"),
  booking(1, "2026-11-10"),
  booking(2, "2026-11-17"),
  booking(3, "2026-11-24"),
  booking(4, "2026-12-01", { status: "cancelled" }),
  booking(5, "2026-12-08", { userId: "intruder" }),
];

const ids = (list: CancelCandidate[]) => list.map((b) => b.id);

describe("selectForCancel", () => {
  it("cancels only the anchor for 'this'", () => {
    const r = selectForCancel(bookings, SERIES, "this", bookings[2], NOW);
    expect(ids(r.cancel)).toEqual(["b2"]);
  });

  it("cancels the anchor and later occurrences for 'following'", () => {
    const r = selectForCancel(bookings, SERIES, "following", bookings[2], NOW);
    expect(ids(r.cancel)).toEqual(["b2", "b3"]);
  });

  it("keeps started bookings for 'all'", () => {
    const r = selectForCancel(bookings, SERIES, "all", null, NOW);
    expect(ids(r.cancel)).toEqual(["b2", "b3"]);
    expect(ids(r.keptStarted)).toEqual(["b0", "b1"]);
  });

  it("never selects bookings from another user, even with the series id", () => {
    const r = selectForCancel(bookings, SERIES, "all", null, NOW);
    expect(ids([...r.cancel, ...r.keptStarted])).not.toContain("b5");
  });

  it("reports an in-progress anchor as kept", () => {
    const r = selectForCancel(bookings, SERIES, "this", bookings[1], NOW);
    expect(r.cancel).toEqual([]);
    expect(ids(r.keptStarted)).toEqual(["b1"]);
  });
});
