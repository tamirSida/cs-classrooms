import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Collections } from "@/lib/firebase";
import { BookingStatus, Settings } from "@/lib/models";

// GET /api/preview - Public endpoint for preview display.
// Uses the admin SDK (unauthenticated callers can't pass Firestore rules),
// so responses are projected to only the fields the public page needs.
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    const db = adminDb();

    const [classroomsSnap, settingsSnap, bookingsSnap] = await Promise.all([
      db.collection(Collections.CLASSROOMS).where("config.isActive", "==", true).get(),
      db.collection(Collections.SETTINGS).doc(Settings.DOCUMENT_ID).get(),
      db
        .collection(Collections.BOOKINGS)
        .where("date", ">=", startDate)
        .where("date", "<=", endDate)
        .get(),
    ]);

    const classrooms = classroomsSnap.docs
      .map((doc) => ({ id: doc.id, name: doc.data().name as string }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const settingsData = settingsSnap.exists
      ? settingsSnap.data()!
      : Settings.createDefault("system");

    const settings = {
      operatingHours: settingsData.operatingHours,
      signupCode: settingsData.signupCode,
    };

    const bookings = bookingsSnap.docs
      .filter((doc) => doc.data().status === BookingStatus.CONFIRMED)
      .map((doc) => {
        const { classroomId, userName, date, startTime, endTime, status } = doc.data();
        return { id: doc.id, classroomId, userName, date, startTime, endTime, status };
      });

    return NextResponse.json({ classrooms, settings, bookings });
  } catch (error) {
    console.error("Preview API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch preview data" },
      { status: 500 }
    );
  }
}
