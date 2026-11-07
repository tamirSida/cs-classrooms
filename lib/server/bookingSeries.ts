import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { Collections } from "@/lib/firebase/collections";
import {
  BookingSeriesSummary,
  BookingStatus,
  IBookingSeries,
  IUser,
  SeriesDateEntry,
  SeriesInput,
  UserRole,
} from "@/lib/models";
import {
  ActiveBooking,
  conflictingDates,
  resolveDailyLimit,
  toMinutes,
  usedMinutes,
  validateSlotBasics,
} from "@/lib/bookings";
import { CancelScope, describeRule, RecurrenceRule, selectForCancel, validateRule } from "@/lib/recurrence";
import { CampusNow, hasStarted, nowInCampus } from "@/lib/time";
import { HttpError } from "./http";
import { getServerSettings, ServerSettings } from "./settings";
import {
  assertCanBookClassroom,
  canOverrideBookings,
  ClassroomRecord,
  initialStatus,
  loadActiveBookings,
  loadClassroom,
} from "./bookingRules";
import { sendSeriesEmail } from "./bookingEmails";
import { belongsToSeries, classroomName, getSeriesBookings, getSeriesOrThrow, seriesEmailData } from "./seriesStore";

interface PreparedSeries {
  input: SeriesInput;
  classroom: ClassroomRecord;
  settings: ServerSettings;
  dates: string[];
  now: CampusNow;
}

const MAX_SUMMARY_IDS = 30;

// Copies only known fields so arbitrary client data never reaches Firestore.
export function parseSeriesInput(body: unknown): SeriesInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const rule = (b.rule ?? {}) as Record<string, unknown>;
  const end = (rule.end ?? {}) as Record<string, unknown>;

  if (typeof b.classroomId !== "string" || typeof b.startDate !== "string") {
    throw new HttpError(400, "Missing classroom or start date");
  }
  if (typeof b.startTime !== "string" || typeof b.endTime !== "string") {
    throw new HttpError(400, "Missing start or end time");
  }

  const parsedEnd =
    end.type === "count"
      ? { type: "count" as const, count: Number(end.count) }
      : end.type === "until" && typeof end.until === "string"
        ? { type: "until" as const, until: end.until }
        : null;
  if (!parsedEnd) throw new HttpError(400, "Choose when the booking stops repeating");

  const parsedRule: RecurrenceRule = {
    frequency: rule.frequency as RecurrenceRule["frequency"],
    interval: Number(rule.interval),
    end: parsedEnd,
  };
  if (rule.frequency === "weekly" && Array.isArray(rule.weekdays) && rule.weekdays.length) {
    parsedRule.weekdays = rule.weekdays.map(Number);
  }

  return {
    classroomId: b.classroomId,
    startDate: b.startDate,
    startTime: b.startTime,
    endTime: b.endTime,
    rule: parsedRule,
    skipDates: Array.isArray(b.skipDates) ? b.skipDates.filter((d): d is string => typeof d === "string") : [],
  };
}

export function canCreateSeries(user: IUser, settings: ServerSettings): boolean {
  return user.role !== UserRole.STUDENT || settings.allowRecurringForAllUsers;
}

async function prepare(db: Firestore, user: IUser, input: SeriesInput): Promise<PreparedSeries> {
  const [classroom, settings] = await Promise.all([loadClassroom(db, input.classroomId), getServerSettings(db)]);

  if (!canCreateSeries(user, settings)) {
    throw new HttpError(403, "Recurring bookings are not enabled for your account");
  }
  assertCanBookClassroom(user, classroom);

  const slotError = validateSlotBasics(settings.operatingHours, input.startTime, input.endTime);
  if (slotError) throw new HttpError(400, slotError);

  const now = nowInCampus();
  const result = validateRule(input.startDate, input.rule, now);
  if (!result.ok) throw new HttpError(400, result.error);

  return { input, classroom, settings, dates: result.dates, now };
}

function evaluate(prepared: PreparedSeries, active: ActiveBooking[], user: IUser): SeriesDateEntry[] {
  const { input, classroom, settings, dates, now } = prepared;
  const slots = dates.map((date) => ({ date, startTime: input.startTime, endTime: input.endTime }));
  const conflicts = conflictingDates(active, classroom.id, slots);
  const limit =
    user.role === UserRole.STUDENT
      ? resolveDailyLimit(classroom.config.maxTimePerDay, settings.defaultMaxTimePerDay)
      : null;
  const duration = toMinutes(input.endTime) - toMinutes(input.startTime);

  return dates.map((date): SeriesDateEntry => {
    if (hasStarted({ date, startTime: input.startTime }, now)) return { date, status: "past" };
    if (conflicts.has(date)) return { date, status: "conflict" };
    if (limit !== null && usedMinutes(active, user.id, classroom.id, date) + duration > limit) {
      return { date, status: "over_limit" };
    }
    return { date, status: "available" };
  });
}

export async function previewSeries(user: IUser, input: SeriesInput) {
  const db = adminDb();
  const prepared = await prepare(db, user, input);
  const active = await loadActiveBookings(db, prepared.dates[0], prepared.dates[prepared.dates.length - 1]);
  return {
    entries: evaluate(prepared, active, user),
    ruleText: describeRule(input.rule, input.startDate),
  };
}

export async function createSeries(user: IUser, input: SeriesInput) {
  const db = adminDb();
  const prepared = await prepare(db, user, input);
  const { classroom, dates } = prepared;
  const skip = new Set(input.skipDates);
  const status = initialStatus(user, classroom);
  const seriesRef = db.collection(Collections.BOOKING_SERIES).doc();

  const result = await db.runTransaction(async (tx) => {
    const active = await loadActiveBookings(db, dates[0], dates[dates.length - 1], tx);
    const entries = evaluate(prepared, active, user);

    const blocking = entries.filter((e) => e.status !== "available" && !skip.has(e.date));
    if (blocking.length > 0) {
      throw new HttpError(409, "Some dates are no longer available. Review the updated list and try again.", {
        preview: entries,
      });
    }

    const toBook = entries.filter((e) => e.status === "available" && !skip.has(e.date)).map((e) => e.date);
    if (toBook.length === 0) throw new HttpError(400, "There are no available dates to book");
    const skippedDates = dates.filter((d) => !toBook.includes(d));

    const now = Timestamp.now();
    const series: Omit<IBookingSeries, "id" | "createdAt" | "updatedAt"> = {
      classroomId: classroom.id,
      userId: user.id,
      userEmail: user.email,
      userName: user.displayName,
      startTime: input.startTime,
      endTime: input.endTime,
      startDate: input.startDate,
      rule: input.rule,
      skippedDates,
      createdBy: user.id,
    };
    tx.create(seriesRef, { ...series, createdAt: now, updatedAt: now });

    toBook.forEach((date, occurrenceIndex) => {
      tx.create(db.collection(Collections.BOOKINGS).doc(), {
        classroomId: classroom.id,
        userId: user.id,
        userEmail: user.email,
        userName: user.displayName,
        date,
        startTime: input.startTime,
        endTime: input.endTime,
        status,
        seriesId: seriesRef.id,
        occurrenceIndex,
        createdAt: now,
        updatedAt: now,
      });
    });

    return { series: { id: seriesRef.id, ...series }, toBook, skippedDates };
  });

  await sendSeriesEmail(user.email, status === BookingStatus.PENDING ? "pending" : "created", {
    ...seriesEmailData(result.series as IBookingSeries, classroom.name, result.toBook),
    skippedDates: result.skippedDates,
  });

  return { seriesId: seriesRef.id, booked: result.toBook, skipped: result.skippedDates, status };
}

export interface CancelSeriesOptions {
  scope: CancelScope;
  fromBookingId?: string;
  dryRun?: boolean;
}

export async function cancelSeries(user: IUser, seriesId: string, options: CancelSeriesOptions) {
  const { scope, fromBookingId, dryRun = false } = options;
  if (!["this", "following", "all"].includes(scope)) throw new HttpError(400, "Invalid cancel option");
  if (scope !== "all" && !fromBookingId) throw new HttpError(400, "Missing the selected booking");

  const db = adminDb();
  const settings = await getServerSettings(db);
  const now = nowInCampus();

  const outcome = await db.runTransaction(async (tx) => {
    const series = await getSeriesOrThrow(db, seriesId, tx);
    const isOwner = series.userId === user.id;
    if (!isOwner && !canOverrideBookings(user, settings)) {
      throw new HttpError(403, "Not authorized to cancel this booking");
    }

    const bookings = (await getSeriesBookings(db, seriesId, tx)).filter((b) => belongsToSeries(b, series));
    let anchor = null;
    if (scope !== "all") {
      anchor = bookings.find((b) => b.id === fromBookingId) ?? null;
      if (!anchor) throw new HttpError(404, "Booking not found in this series");
    }

    const selection = selectForCancel(bookings, series, scope, anchor, now);
    if (!dryRun) {
      for (const booking of selection.cancel) {
        tx.update(db.collection(Collections.BOOKINGS).doc(booking.id), {
          status: BookingStatus.CANCELLED,
          cancelledAt: Timestamp.now(),
          cancelledBy: user.id,
          updatedAt: Timestamp.now(),
        });
      }
    }
    return { series, isOwner, selection };
  });

  const toRef = (b: { id: string; date: string }) => ({ id: b.id, date: b.date });
  const cancelled = outcome.selection.cancel.map(toRef);
  const keptStarted = outcome.selection.keptStarted.map(toRef);

  if (!dryRun && cancelled.length > 0) {
    const name = await classroomName(db, outcome.series.classroomId);
    await sendSeriesEmail(
      outcome.series.userEmail,
      outcome.isOwner ? "cancelled" : "cancelledByAdmin",
      seriesEmailData(outcome.series, name, cancelled.map((b) => b.date))
    );
  }

  return { cancelled, keptStarted, dryRun };
}

export async function getSeriesSummaries(ids: string[]): Promise<BookingSeriesSummary[]> {
  const unique = [...new Set(ids)].slice(0, MAX_SUMMARY_IDS);
  if (unique.length === 0) return [];

  const db = adminDb();
  const refs = unique.map((id) => db.collection(Collections.BOOKING_SERIES).doc(id));
  const snaps = await db.getAll(...refs);
  return snaps
    .filter((snap) => snap.exists)
    .map((snap) => {
      const s = { id: snap.id, ...snap.data() } as IBookingSeries;
      return {
        id: s.id,
        classroomId: s.classroomId,
        userId: s.userId,
        userName: s.userName,
        startTime: s.startTime,
        endTime: s.endTime,
        startDate: s.startDate,
        rule: s.rule,
        skippedDates: s.skippedDates ?? [],
        createdBy: s.createdBy,
        ruleText: describeRule(s.rule, s.startDate),
      };
    });
}
