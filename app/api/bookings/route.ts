import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { Collections } from "@/lib/firebase/collections";
import { BookingStatus } from "@/lib/models";
import { conflictingDates, validateSlotBasics } from "@/lib/bookings";
import { isValidDateString } from "@/lib/time";
import { requireUser } from "@/lib/server/auth";
import { HttpError, readJson, withErrors } from "@/lib/server/http";
import { getServerSettings } from "@/lib/server/settings";
import {
  assertCanBookClassroom,
  initialStatus,
  loadActiveBookings,
  loadClassroom,
} from "@/lib/server/bookingRules";
import { sendBookingEmail } from "@/lib/server/bookingEmails";

interface CreateBookingBody {
  classroomId?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

// POST /api/bookings - create a single booking for the signed-in user.
export const POST = withErrors("API/bookings POST", async (request: NextRequest) => {
  const user = await requireUser(request);
  const { classroomId, date, startTime, endTime } = await readJson<CreateBookingBody>(request);

  if (!classroomId || !date || !startTime || !endTime) {
    throw new HttpError(400, "Missing required fields");
  }
  if (!isValidDateString(date)) throw new HttpError(400, "Invalid date");

  const db = adminDb();
  const [classroom, settings] = await Promise.all([loadClassroom(db, classroomId), getServerSettings(db)]);
  assertCanBookClassroom(user, classroom);

  const slotError = validateSlotBasics(settings.operatingHours, startTime, endTime);
  if (slotError) throw new HttpError(400, slotError);

  const bookingData = {
    classroomId,
    userId: user.id,
    userEmail: user.email,
    userName: user.displayName,
    date,
    startTime,
    endTime,
    status: initialStatus(user, classroom),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const docRef = db.collection(Collections.BOOKINGS).doc();
  await db.runTransaction(async (tx) => {
    const active = await loadActiveBookings(db, date, date, tx);
    if (conflictingDates(active, classroomId, [{ date, startTime, endTime }]).size > 0) {
      throw new HttpError(409, "Time slot is already booked");
    }
    tx.create(docRef, bookingData);
  });

  const booking = { id: docRef.id, ...bookingData };
  await sendBookingEmail(booking, classroom.name, {
    kind: booking.status === BookingStatus.PENDING ? "pending" : "confirmed",
  });

  return NextResponse.json(booking);
});

// GET /api/bookings - signed-in users only. Filters in memory to avoid composite indexes.
export const GET = withErrors("API/bookings GET", async (request: NextRequest) => {
  await requireUser(request);

  const { searchParams } = request.nextUrl;
  const classroomId = searchParams.get("classroomId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const userId = searchParams.get("userId");

  let query = adminDb().collection(Collections.BOOKINGS) as FirebaseFirestore.Query;
  if (classroomId) {
    query = query.where("classroomId", "==", classroomId);
  } else if (userId) {
    query = query.where("userId", "==", userId);
  }

  const snapshot = await query.get();
  let bookings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Array<{
    id: string;
    userId: string;
    date: string;
    startTime: string;
  }>;

  if (classroomId && userId) bookings = bookings.filter((b) => b.userId === userId);
  if (startDate && endDate) bookings = bookings.filter((b) => b.date >= startDate && b.date <= endDate);

  bookings.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  return NextResponse.json(bookings);
});
