import "server-only";
import type { DocumentSnapshot, Firestore, Transaction } from "firebase-admin/firestore";
import { Collections } from "@/lib/firebase/collections";
import { IBooking, IBookingSeries } from "@/lib/models";
import { describeRule } from "@/lib/recurrence";
import { SeriesEmailData } from "@/lib/email";
import { HttpError } from "./http";

export function bookingFromDoc(doc: DocumentSnapshot): IBooking {
  return { id: doc.id, ...doc.data() } as IBooking;
}

export async function getSeriesOrThrow(db: Firestore, seriesId: string, tx?: Transaction): Promise<IBookingSeries> {
  const ref = db.collection(Collections.BOOKING_SERIES).doc(seriesId);
  const snap = tx ? await tx.get(ref) : await ref.get();
  if (!snap.exists) throw new HttpError(404, "Recurring booking not found");
  return { id: snap.id, ...snap.data() } as IBookingSeries;
}

// Bookings tagged with the series id. Callers must still check owner and classroom,
// because seriesId alone is not trusted.
export async function getSeriesBookings(db: Firestore, seriesId: string, tx?: Transaction): Promise<IBooking[]> {
  const query = db.collection(Collections.BOOKINGS).where("seriesId", "==", seriesId);
  const snap = tx ? await tx.get(query) : await query.get();
  return snap.docs.map(bookingFromDoc);
}

export function belongsToSeries(booking: IBooking, series: IBookingSeries): boolean {
  return booking.seriesId === series.id && booking.userId === series.userId && booking.classroomId === series.classroomId;
}

export function seriesEmailData(series: IBookingSeries, classroomName: string, dates: string[]): SeriesEmailData {
  return {
    userName: series.userName,
    classroomName,
    startTime: series.startTime,
    endTime: series.endTime,
    ruleText: describeRule(series.rule, series.startDate),
    dates: [...dates].sort(),
  };
}

export async function classroomName(db: Firestore, classroomId: string): Promise<string> {
  const snap = await db.collection(Collections.CLASSROOMS).doc(classroomId).get();
  return (snap.data()?.name as string) || "Classroom";
}
