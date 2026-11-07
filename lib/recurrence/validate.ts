import { CampusNow, isValidDateString } from "@/lib/time";
import { expandRule, seriesCapDate } from "./expand";
import { MAX_COUNT, MAX_INTERVAL, MIN_OCCURRENCES, RecurrenceRule } from "./types";

export type RuleValidation = { ok: true; dates: string[] } | { ok: false; error: string };

const YEAR_LIMIT_ERROR = "A recurring booking can't run longer than 1 year";

function structuralError(startDate: string, rule: RecurrenceRule): string | null {
  if (!isValidDateString(startDate)) return "Invalid start date";
  if (!["daily", "weekly", "monthly"].includes(rule.frequency)) return "Invalid repeat frequency";
  if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > MAX_INTERVAL) {
    return `Repeat interval must be between 1 and ${MAX_INTERVAL}`;
  }

  if (rule.frequency === "weekly" && rule.weekdays?.length) {
    const valid = rule.weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (!valid || new Set(rule.weekdays).size !== rule.weekdays.length) return "Invalid weekdays";
  }

  if (rule.end.type === "count") {
    const { count } = rule.end;
    if (!Number.isInteger(count) || count < MIN_OCCURRENCES || count > MAX_COUNT) {
      return `Number of bookings must be between ${MIN_OCCURRENCES} and ${MAX_COUNT}`;
    }
  } else if (rule.end.type === "until") {
    if (!isValidDateString(rule.end.until)) return "Invalid end date";
    if (rule.end.until < startDate) return "End date must be after the start date";
  } else {
    return "Invalid end";
  }

  return null;
}

export function validateRule(startDate: string, rule: RecurrenceRule, now: CampusNow): RuleValidation {
  const error = structuralError(startDate, rule);
  if (error) return { ok: false, error };
  if (startDate < now.date) return { ok: false, error: "The start date is in the past" };

  const dates = expandRule(startDate, rule);
  if (dates.length > 0) {
    const cap = seriesCapDate(dates[0]);
    if (rule.end.type === "until" && rule.end.until > cap) return { ok: false, error: YEAR_LIMIT_ERROR };
    if (rule.end.type === "count" && dates.length < rule.end.count) {
      return { ok: false, error: YEAR_LIMIT_ERROR };
    }
  }

  if (dates.length < MIN_OCCURRENCES) {
    return { ok: false, error: `A recurring booking needs at least ${MIN_OCCURRENCES} dates. Use a normal booking instead.` };
  }

  return { ok: true, dates };
}
