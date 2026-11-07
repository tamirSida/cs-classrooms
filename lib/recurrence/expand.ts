import { addDaysToDateString, isValidDateString, weekdayOf } from "@/lib/time";
import { RecurrenceRule } from "./types";

// Latest date a series may reach: the same calendar date one year after its first date.
export function seriesCapDate(firstDate: string): string {
  const [y, m, d] = firstDate.split("-").map(Number);
  const candidate = `${y + 1}-${pad(m)}-${pad(d)}`;
  return isValidDateString(candidate) ? candidate : `${y + 1}-${pad(m)}-28`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function* candidates(startDate: string, rule: RecurrenceRule): Generator<string> {
  const { frequency, interval } = rule;

  if (frequency === "daily") {
    for (let i = 0; ; i++) yield addDaysToDateString(startDate, i * interval);
  }

  if (frequency === "weekly") {
    const weekdays = rule.weekdays?.length
      ? [...rule.weekdays].sort((a, b) => a - b)
      : [weekdayOf(startDate)];
    const anchorSunday = addDaysToDateString(startDate, -weekdayOf(startDate));
    for (let week = 0; ; week += interval) {
      for (const weekday of weekdays) {
        const date = addDaysToDateString(anchorSunday, week * 7 + weekday);
        if (date >= startDate) yield date;
      }
    }
  }

  const [startYear, startMonth, day] = startDate.split("-").map(Number);
  for (let offset = 0; ; offset += interval) {
    const monthIndex = startMonth - 1 + offset;
    const date = `${startYear + Math.floor(monthIndex / 12)}-${pad((monthIndex % 12) + 1)}-${pad(day)}`;
    if (isValidDateString(date)) yield date;
  }
}

// Expands a rule into ascending dates. Expansion always stops at the rule's end
// or at the 1-year cap, whichever comes first; the cap guarantees termination.
export function expandRule(startDate: string, rule: RecurrenceRule): string[] {
  const dates: string[] = [];
  let cap: string | null = null;

  for (const date of candidates(startDate, rule)) {
    cap ??= seriesCapDate(date);
    if (date > cap) break;
    if (rule.end.type === "until" && date > rule.end.until) break;
    dates.push(date);
    if (rule.end.type === "count" && dates.length >= rule.end.count) break;
  }

  return dates;
}
