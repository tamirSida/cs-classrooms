import { describe, expect, it } from "vitest";
import {
  conflictingDates,
  resolveDailyLimit,
  usedMinutes,
  validateSlotBasics,
  ActiveBooking,
} from "./rules";

const existing: ActiveBooking[] = [
  { id: "a", classroomId: "c1", userId: "u1", date: "2026-11-10", startTime: "10:00", endTime: "11:00" },
  { id: "b", classroomId: "c2", userId: "u2", date: "2026-11-10", startTime: "10:00", endTime: "11:00" },
  { id: "c", classroomId: "c1", userId: "u1", date: "2026-11-11", startTime: "09:00", endTime: "09:30" },
];

describe("conflictingDates", () => {
  it("flags overlaps in the same classroom only", () => {
    const slots = [
      { date: "2026-11-10", startTime: "10:30", endTime: "11:30" },
      { date: "2026-11-11", startTime: "09:30", endTime: "10:00" },
    ];
    expect([...conflictingDates(existing, "c1", slots)]).toEqual(["2026-11-10"]);
  });

  it("ignores excluded bookings", () => {
    const slots = [{ date: "2026-11-10", startTime: "10:00", endTime: "11:00" }];
    expect(conflictingDates(existing, "c1", slots, new Set(["a"])).size).toBe(0);
  });
});

describe("resolveDailyLimit", () => {
  it("uses the classroom value, then global, with -1 as unlimited", () => {
    expect(resolveDailyLimit(60, 30)).toBe(60);
    expect(resolveDailyLimit(0, 30)).toBe(30);
    expect(resolveDailyLimit(-1, 30)).toBeNull();
    expect(resolveDailyLimit(0, -1)).toBeNull();
  });
});

describe("usedMinutes", () => {
  it("sums one user's time in one classroom on one date", () => {
    expect(usedMinutes(existing, "u1", "c1", "2026-11-10")).toBe(60);
  });
});

describe("validateSlotBasics", () => {
  const hours = { start: "08:00", end: "18:00" };

  it("accepts a slot inside operating hours", () => {
    expect(validateSlotBasics(hours, "08:00", "18:00")).toBeNull();
  });

  it("rejects slots outside hours, reversed or malformed", () => {
    expect(validateSlotBasics(hours, "07:45", "09:00")).toContain("operating hours");
    expect(validateSlotBasics(hours, "10:00", "10:00")).toContain("after");
    expect(validateSlotBasics(hours, "9:00", "10:00")).toContain("Invalid");
  });
});
