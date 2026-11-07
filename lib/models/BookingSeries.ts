import { Timestamp } from "firebase/firestore";
import type { RecurrenceRule } from "@/lib/recurrence/types";

export interface IBookingSeries {
  id: string;
  classroomId: string;
  userId: string;
  userEmail: string;
  userName: string;
  startTime: string;
  endTime: string;
  startDate: string;
  rule: RecurrenceRule;
  skippedDates: string[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Fields safe to show any signed-in user (no email).
export type BookingSeriesSummary = Omit<IBookingSeries, "userEmail" | "createdAt" | "updatedAt"> & {
  ruleText: string;
  remaining: number; // live dates that have not started
  nextDate: string | null;
};

export type SeriesDateStatus = "available" | "conflict" | "over_limit" | "past";

export interface SeriesDateEntry {
  date: string;
  status: SeriesDateStatus;
}

export interface SeriesInput {
  classroomId: string;
  startDate: string;
  startTime: string;
  endTime: string;
  rule: RecurrenceRule;
  skipDates?: string[];
}

export interface SeriesPreview {
  entries: SeriesDateEntry[];
  ruleText: string;
}

export interface SeriesCreateResult {
  seriesId: string;
  booked: string[];
  skipped: string[];
  status: string;
}

export interface BookingRef {
  id: string;
  date: string;
}

export interface SeriesCancelResult {
  cancelled: BookingRef[];
  keptStarted: BookingRef[];
  dryRun: boolean;
}
