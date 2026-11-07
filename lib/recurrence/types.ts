export type Frequency = "daily" | "weekly" | "monthly";

export type RecurrenceEnd =
  | { type: "count"; count: number }
  | { type: "until"; until: string };

export interface RecurrenceRule {
  frequency: Frequency;
  interval: number;
  weekdays?: number[];
  end: RecurrenceEnd;
}

export const MAX_INTERVAL = 12;
export const MIN_OCCURRENCES = 2;
export const MAX_COUNT = 400;
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
