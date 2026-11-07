import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { Collections } from "@/lib/firebase/collections";
import { BookingStatus } from "@/lib/models";
import { conflictingDates, validateSlotBasics } from "@/lib/bookings";
import { hasStarted, isValidDateString, nowInCampus } from "@/lib/time";
import { requireUser } from "@/lib/server/auth";
import { HttpError, readJson, withErrors } from "@/lib/server/http";
import { getServerSettings } from "@/lib/server/settings";
import {
  assertCanBookClassroom,
  canOverrideBookings,
  loadActiveBookings,
  loadClassroom,
} from "@/lib/server/bookingRules";
import { bookingFromDoc, classroomName } from "@/lib/server/seriesStore";
import { sendBookingEmail } from "@/lib/server/bookingEmails";

interface UpdateBookingBody {
  date?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
}

type RouteContext = { params: Promise<{ id: string }> };

const STARTED_MESSAGE = "This date has already started and can't be changed";

// PATCH /api/bookings/:id - edit times or cancel. Approval goes through /api/bookings/review.
export const PATCH = withErrors("API/bookings/:id PATCH", async (request: NextRequest, { params }: RouteContext) => {
  const user = await requireUser(request);
  const { id } = await params;
  const body = await readJson<UpdateBookingBody>(request);

  if (body.status !== undefined && body.status !== BookingStatus.CANCELLED) {
    throw new HttpError(400, "Bookings can only be cancelled here. Approvals are handled on the Approvals page.");
  }

  const db = adminDb();
  const docRef = db.collection(Collections.BOOKINGS).doc(id);
  const settings = await getServerSettings(db);
  const canOverride = canOverrideBookings(user, settings);
  const now = nowInCampus();

  // Every check runs on a snapshot read inside the transaction, so a concurrent
  // approve/reject/cancel cannot be overwritten.
  const outcome = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) throw new HttpError(404, "Booking not found");
    const existing = bookingFromDoc(snap);

    const isOwner = existing.userId === user.id;
    if (!isOwner && !canOverride) throw new HttpError(403, "Not authorized to modify this booking");

    if (existing.status === BookingStatus.CANCELLED) {
      if (body.status === BookingStatus.CANCELLED) return { kind: "none" as const, booking: existing };
      throw new HttpError(400, "This booking is already cancelled");
    }
    if (existing.seriesId && hasStarted(existing, now)) throw new HttpError(409, STARTED_MESSAGE);

    if (body.status === BookingStatus.CANCELLED) {
      tx.update(docRef, {
        status: BookingStatus.CANCELLED,
        cancelledAt: Timestamp.now(),
        cancelledBy: user.id,
        updatedAt: Timestamp.now(),
      });
      return { kind: "cancelled" as const, booking: { ...existing, status: BookingStatus.CANCELLED }, isOwner };
    }

    const next = {
      date: body.date ?? existing.date,
      startTime: body.startTime ?? existing.startTime,
      endTime: body.endTime ?? existing.endTime,
    };
    const timesChanged = next.startTime !== existing.startTime || next.endTime !== existing.endTime;
    if (next.date === existing.date && !timesChanged) return { kind: "none" as const, booking: existing };

    if (!isValidDateString(next.date)) throw new HttpError(400, "Invalid date");
    if (timesChanged) {
      const slotError = validateSlotBasics(settings.operatingHours, next.startTime, next.endTime);
      if (slotError) throw new HttpError(400, slotError);
    }
    if (existing.seriesId && hasStarted(next, now)) {
      throw new HttpError(409, "A series date can't be moved into the past");
    }

    const classroom = await loadClassroom(db, existing.classroomId, tx);
    assertCanBookClassroom(user, classroom);

    const active = await loadActiveBookings(db, next.date, next.date, tx);
    if (conflictingDates(active, existing.classroomId, [next], new Set([id])).size > 0) {
      throw new HttpError(409, "Time slot is already booked");
    }
    tx.update(docRef, { ...next, updatedAt: Timestamp.now() });
    return { kind: "modified" as const, booking: { ...existing, ...next }, previous: existing };
  });

  if (outcome.kind !== "none") {
    const name = await classroomName(db, outcome.booking.classroomId);
    await sendBookingEmail(
      outcome.booking,
      name,
      outcome.kind === "cancelled"
        ? { kind: outcome.isOwner ? "cancelledByUser" : "cancelledByAdmin" }
        : {
            kind: "modified",
            oldDate: outcome.previous.date,
            oldStartTime: outcome.previous.startTime,
            oldEndTime: outcome.previous.endTime,
          }
    );
  }

  return NextResponse.json(outcome.booking);
});
