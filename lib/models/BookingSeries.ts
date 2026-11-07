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
};
