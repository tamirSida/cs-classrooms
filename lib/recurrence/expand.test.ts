import { describe, expect, it } from "vitest";
import { expandRule } from "./expand";
import { validateRule } from "./validate";
import { describeRule } from "./describe";
import { RecurrenceRule } from "./types";

const NOW = { date: "2026-11-07", time: "12:00" };

describe("expandRule", () => {
  it("expands daily with an interval and count", () => {
    const rule: RecurrenceRule = { frequency: "daily", interval: 2, end: { type: "count", count: 3 } };
    expect(expandRule("2026-11-08", rule)).toEqual(["2026-11-08", "2026-11-10", "2026-11-12"]);
  });

  it("anchors biweekly rules on the Sunday of the start week", () => {
    const rule: RecurrenceRule = {
      frequency: "weekly",
      interval: 2,
      weekdays: [0, 2],
      end: { type: "until", until: "2026-12-08" },
    };
    expect(expandRule("2026-11-10", rule)).toEqual([
      "2026-11-10",
      "2026-11-22",
      "2026-11-24",
      "2026-12-06",
      "2026-12-08",
    ]);
  });

  it("starts on the first matching date when the start date does not match", () => {
    const rule: RecurrenceRule = {
      frequency: "weekly",
      interval: 2,
      weekdays: [0],
      end: { type: "count", count: 2 },
    };
    expect(expandRule("2026-11-11", rule)).toEqual(["2026-11-22", "2026-12-06"]);
  });

  it("defaults weekly rules to the start date's weekday", () => {
    const rule: RecurrenceRule = { frequency: "weekly", interval: 1, end: { type: "count", count: 2 } };
    expect(expandRule("2026-11-10", rule)).toEqual(["2026-11-10", "2026-11-17"]);
  });

  it("skips months without the day instead of clamping", () => {
    const rule: RecurrenceRule = { frequency: "monthly", interval: 1, end: { type: "count", count: 4 } };
    expect(expandRule("2027-01-31", rule)).toEqual([
      "2027-01-31",
      "2027-03-31",
      "2027-05-31",
      "2027-07-31",
    ]);
  });

  it("includes a full year of Sundays (53 dates)", () => {
    const rule: RecurrenceRule = {
      frequency: "weekly",
      interval: 1,
      weekdays: [0],
      end: { type: "until", until: "2027-11-08" },
    };
    const dates = expandRule("2026-11-08", rule);
    expect(dates).toHaveLength(53);
    expect(dates.at(-1)).toBe("2027-11-07");
  });
});

describe("validateRule", () => {
  it("accepts a year of Sundays", () => {
    const result = validateRule(
      "2026-11-08",
      { frequency: "weekly", interval: 1, weekdays: [0], end: { type: "until", until: "2027-11-08" } },
      NOW
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a count that runs past 1 year", () => {
    const result = validateRule(
      "2027-01-31",
      { frequency: "monthly", interval: 1, end: { type: "count", count: 12 } },
      NOW
    );
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.error).toContain("1 year");
  });

  it("rejects an end date more than 1 year out", () => {
    const result = validateRule(
      "2026-11-08",
      { frequency: "daily", interval: 7, end: { type: "until", until: "2027-11-09" } },
      NOW
    );
    expect(!result.ok && result.error).toContain("1 year");
  });

  it("rejects a start in the past", () => {
    const result = validateRule(
      "2026-11-06",
      { frequency: "daily", interval: 1, end: { type: "count", count: 3 } },
      NOW
    );
    expect(!result.ok && result.error).toContain("past");
  });

  it("rejects a series with fewer than 2 dates", () => {
    const result = validateRule(
      "2026-11-09",
      { frequency: "weekly", interval: 1, weekdays: [0], end: { type: "until", until: "2026-11-14" } },
      NOW
    );
    expect(!result.ok && result.error).toContain("at least 2");
  });

  it("rejects bad weekdays, intervals and dates", () => {
    const base = { frequency: "weekly" as const, end: { type: "count" as const, count: 3 } };
    expect(validateRule("2026-11-08", { ...base, interval: 1, weekdays: [7] }, NOW).ok).toBe(false);
    expect(validateRule("2026-11-08", { ...base, interval: 1, weekdays: [1, 1] }, NOW).ok).toBe(false);
    expect(validateRule("2026-11-08", { ...base, interval: 13 }, NOW).ok).toBe(false);
    expect(validateRule("2026-11-8", { ...base, interval: 1 }, NOW).ok).toBe(false);
  });
});

describe("describeRule", () => {
  it("describes a biweekly rule with an end date", () => {
    expect(
      describeRule(
        { frequency: "weekly", interval: 2, weekdays: [0, 2], end: { type: "until", until: "2026-12-08" } },
        "2026-11-10"
      )
    ).toBe("Every 2 weeks on Sun, Tue until Dec 8, 2026");
  });

  it("describes a monthly rule with a count", () => {
    expect(
      describeRule({ frequency: "monthly", interval: 1, end: { type: "count", count: 4 } }, "2027-01-31")
    ).toBe("Monthly on day 31, 4 times");
  });
});
