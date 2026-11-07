import { describe, expect, it } from "vitest";
import {
  addDaysToDateString,
  hasStarted,
  isValidDateString,
  nowInCampus,
  weekdayOf,
} from "./campusTime";

describe("nowInCampus", () => {
  it("rolls to the next campus date before UTC does", () => {
    expect(nowInCampus(new Date("2026-12-01T22:30:00Z"))).toEqual({
      date: "2026-12-02",
      time: "00:30",
    });
  });

  it("applies summer time", () => {
    expect(nowInCampus(new Date("2026-07-01T06:00:00Z")).time).toBe("09:00");
  });
});

describe("isValidDateString", () => {
  it("rejects impossible and unpadded dates", () => {
    expect(isValidDateString("2027-02-31")).toBe(false);
    expect(isValidDateString("2026-11-8")).toBe(false);
    expect(isValidDateString("2028-02-29")).toBe(true);
  });
});

describe("date arithmetic", () => {
  it("adds days across a DST change", () => {
    expect(addDaysToDateString("2027-03-21", 7)).toBe("2027-03-28");
  });

  it("reports Sunday as 0", () => {
    expect(weekdayOf("2026-11-08")).toBe(0);
  });
});

describe("hasStarted", () => {
  const booking = { date: "2026-11-10", startTime: "10:00" };

  it("is true at the start time", () => {
    expect(hasStarted(booking, { date: "2026-11-10", time: "10:00" })).toBe(true);
  });

  it("is false one minute before", () => {
    expect(hasStarted(booking, { date: "2026-11-10", time: "09:59" })).toBe(false);
  });
});
