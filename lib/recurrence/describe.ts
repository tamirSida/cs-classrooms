import { weekdayOf } from "@/lib/time";
import { RecurrenceRule, WEEKDAY_LABELS } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const UNITS = { daily: ["Daily", "days"], weekly: ["Weekly", "weeks"], monthly: ["Monthly", "months"] } as const;

export function formatDateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function describeRule(rule: RecurrenceRule, startDate: string): string {
  const [single, plural] = UNITS[rule.frequency];
  let text = rule.interval === 1 ? single : `Every ${rule.interval} ${plural}`;

  if (rule.frequency === "weekly") {
    const days = rule.weekdays?.length ? [...rule.weekdays].sort((a, b) => a - b) : [weekdayOf(startDate)];
    text += ` on ${days.map((d) => WEEKDAY_LABELS[d]).join(", ")}`;
  } else if (rule.frequency === "monthly") {
    text += ` on day ${Number(startDate.slice(8, 10))}`;
  }

  return rule.end.type === "until"
    ? `${text} until ${formatDateLabel(rule.end.until)}`
    : `${text}, ${rule.end.count} times`;
}
