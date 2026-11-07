import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { Collections } from "@/lib/firebase/collections";
import { BookingStatus, IBooking, IBookingSeries } from "@/lib/models";
import { conflictingDates } from "@/lib/bookings";
import { hasStarted, nowInCampus } from "@/lib/time";
import { ADMIN_ROLES, requireUser } from "@/lib/server/auth";
import { HttpError, readJson, withErrors } from "@/lib/server/http";
import { loadActiveBookings } from "@/lib/server/bookingRules";
import { sendBookingEmail, sendSeriesEmail } from "@/lib/server/bookingEmails";
import {
  belongsToSeries,
  bookingFromDoc,
  classroomName,
  getSeriesBookings,
  getSeriesOrThrow,
  seriesEmailData,
} from "@/lib/server/seriesStore";

interface ReviewBody {
  decision?: "approve" | "reject";
  bookingId?: string;
  seriesId?: string;
}

// POST /api/bookings/review - approve or reject one pending booking or a whole pending series.
// Only dates that have not started are reviewed; past pending dates are left as they are.
export const POST = withErrors("API/bookings/review", async (request: NextRequest) => {
  const user = await requireUser(request, ADMIN_ROLES);
  const { decision, bookingId, seriesId } = await readJson<ReviewBody>(request);

  if (decision !== "approve" && decision !== "reject") throw new HttpError(400, "Invalid decision");
  if (!bookingId === !seriesId) throw new HttpError(400, "Provide either bookingId or seriesId");

  const db = adminDb();
  const now = nowInCampus();
  let series: IBookingSeries | null = null;

  const reviewed = await db.runTransaction(async (tx) => {
    let candidates: IBooking[];
    if (seriesId) {
      series = await getSeriesOrThrow(db, seriesId, tx);
      const owned = series;
      candidates = (await getSeriesBookings(db, seriesId, tx)).filter((b) => belongsToSeries(b, owned));
    } else {
      const snap = await tx.get(db.collection(Collections.BOOKINGS).doc(bookingId!));
      if (!snap.exists) throw new HttpError(404, "Booking not found");
      candidates = [bookingFromDoc(snap)];
    }

    const targets = candidates.filter((b) => b.status === BookingStatus.PENDING && !hasStarted(b, now));
    if (targets.length === 0) throw new HttpError(400, "Nothing left to review: no upcoming pending dates");

    if (decision === "approve") {
      const dates = targets.map((b) => b.date).sort();
      const active = await loadActiveBookings(db, dates[0], dates[dates.length - 1], tx);
      const conflicts = conflictingDates(active, targets[0].classroomId, targets, new Set(targets.map((b) => b.id)));
      if (conflicts.size > 0) {
        throw new HttpError(409, "Some dates are now taken by other bookings", { conflicts: [...conflicts].sort() });
      }
    }

    for (const booking of targets) {
      const ref = db.collection(Collections.BOOKINGS).doc(booking.id);
      tx.update(
        ref,
        decision === "approve"
          ? { status: BookingStatus.CONFIRMED, updatedAt: Timestamp.now() }
          : { status: BookingStatus.CANCELLED, cancelledAt: Timestamp.now(), cancelledBy: user.id, updatedAt: Timestamp.now() }
      );
    }
    return targets;
  });

  const name = await classroomName(db, reviewed[0].classroomId);
  const reviewedSeries = series as IBookingSeries | null;
  if (reviewedSeries) {
    await sendSeriesEmail(
      reviewedSeries.userEmail,
      decision === "approve" ? "approved" : "rejected",
      seriesEmailData(reviewedSeries, name, reviewed.map((b) => b.date))
    );
  } else {
    await sendBookingEmail(reviewed[0], name, { kind: decision === "approve" ? "approved" : "rejected" });
  }

  return NextResponse.json({ reviewed: reviewed.map((b) => b.id) });
});
