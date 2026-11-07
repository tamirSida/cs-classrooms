import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { Collections } from "@/lib/firebase/collections";
import { BookingStatus, IBooking } from "@/lib/models";
import { conflictingDates, validateSlotBasics } from "@/lib/bookings";
import { hasStarted, isValidDateString, nowInCampus } from "@/lib/time";
import { requireUser } from "@/lib/server/auth";
import { HttpError, readJson, withErrors } from "@/lib/server/http";
import { getServerSettings } from "@/lib/server/settings";
import { canOverrideBookings, loadActiveBookings } from "@/lib/server/bookingRules";
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
  const snap = await docRef.get();
  if (!snap.exists) throw new HttpError(404, "Booking not found");
  const existing = { id: snap.id, ...snap.data() } as IBooking;

  const settings = await getServerSettings(db);
  const isOwner = existing.userId === user.id;
  const canOverride = canOverrideBookings(user, settings);
  if (!isOwner && !canOverride) throw new HttpError(403, "Not authorized to modify this booking");

  if (existing.status === BookingStatus.CANCELLED) {
    throw new HttpError(400, "This booking is already cancelled");
  }

  const now = nowInCampus();
  if (existing.seriesId && hasStarted(existing, now)) throw new HttpError(409, STARTED_MESSAGE);

  const classroomSnap = await db.collection(Collections.CLASSROOMS).doc(existing.classroomId).get();
  const classroomName = (classroomSnap.data()?.name as string) || "Classroom";

  if (body.status === BookingStatus.CANCELLED) {
    await docRef.update({
      status: BookingStatus.CANCELLED,
      cancelledAt: Timestamp.now(),
      cancelledBy: user.id,
      updatedAt: Timestamp.now(),
    });
    const updated = { ...existing, status: BookingStatus.CANCELLED };
    await sendBookingEmail(updated, classroomName, { kind: isOwner ? "cancelledByUser" : "cancelledByAdmin" });
    return NextResponse.json(updated);
  }

  const next = {
    date: body.date ?? existing.date,
    startTime: body.startTime ?? existing.startTime,
    endTime: body.endTime ?? existing.endTime,
  };
  const timeChanged =
    next.date !== existing.date || next.startTime !== existing.startTime || next.endTime !== existing.endTime;
  if (!timeChanged) return NextResponse.json(existing);

  if (!isValidDateString(next.date)) throw new HttpError(400, "Invalid date");
  const slotError = validateSlotBasics(settings.operatingHours, next.startTime, next.endTime);
  if (slotError) throw new HttpError(400, slotError);
  if (existing.seriesId && hasStarted(next, now)) throw new HttpError(409, "A series date can't be moved into the past");

  await db.runTransaction(async (tx) => {
    const active = await loadActiveBookings(db, next.date, next.date, tx);
    if (conflictingDates(active, existing.classroomId, [next], new Set([id])).size > 0) {
      throw new HttpError(409, "Time slot is already booked");
    }
    tx.update(docRef, { ...next, updatedAt: Timestamp.now() });
  });

  const updated = { ...existing, ...next };
  await sendBookingEmail(updated, classroomName, {
    kind: "modified",
    oldDate: existing.date,
    oldStartTime: existing.startTime,
    oldEndTime: existing.endTime,
  });
  return NextResponse.json(updated);
});
