export const CAMPUS_TIME_ZONE = "Asia/Jerusalem";

export interface CampusNow {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

const campusFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CAMPUS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function nowInCampus(at: Date = new Date()): CampusNow {
  const parts = Object.fromEntries(
    campusFormatter.formatToParts(at).map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function toUtcMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isValidDateString(value: string): boolean {
  return DATE_PATTERN.test(value) && fromUtcMs(toUtcMs(value)) === value;
}

export function addDaysToDateString(date: string, days: number): string {
  return fromUtcMs(toUtcMs(date) + days * MS_PER_DAY);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

export function weekdayOf(date: string): number {
  return new Date(toUtcMs(date)).getUTCDay();
}

export function hasStarted(
  booking: { date: string; startTime: string },
  now: CampusNow
): boolean {
  return `${booking.date} ${booking.startTime}` <= `${now.date} ${now.time}`;
}
