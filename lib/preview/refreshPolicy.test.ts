import { describe, expect, it } from "vitest";
import { computeStaleness, nextAnchorDate, shouldFetch } from "./refreshPolicy";

describe("computeStaleness", () => {
  it("is stale only after 3 minutes without a success", () => {
    expect(computeStaleness(0, 180_001)).toBe(true);
    expect(computeStaleness(0, 180_000)).toBe(false);
    expect(computeStaleness(null, 999_999)).toBe(false);
  });
});

describe("nextAnchorDate", () => {
  it("moves to the new campus date when following today", () => {
    expect(
      nextAnchorDate(
        { anchor: "2026-11-07", followToday: true, lastInteractionAt: 0 },
        { campusDate: "2026-11-08", ms: 1_000 }
      )
    ).toEqual({ anchor: "2026-11-08", followToday: true });
  });

  it("keeps a browsed date until 5 minutes idle, then returns to today", () => {
    const state = { anchor: "2026-11-20", followToday: false, lastInteractionAt: 0 };
    expect(nextAnchorDate(state, { campusDate: "2026-11-08", ms: 299_000 })).toEqual({
      anchor: "2026-11-20",
      followToday: false,
    });
    expect(nextAnchorDate(state, { campusDate: "2026-11-08", ms: 301_000 })).toEqual({
      anchor: "2026-11-08",
      followToday: true,
    });
  });
});

describe("shouldFetch", () => {
  it("skips while a request is in flight or within 10 seconds of a success", () => {
    expect(shouldFetch(null, true, 0)).toBe(false);
    expect(shouldFetch(1_000, false, 10_999)).toBe(false);
    expect(shouldFetch(1_000, false, 11_000)).toBe(true);
    expect(shouldFetch(null, false, 0)).toBe(true);
  });
});
