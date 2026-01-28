import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { Collections } from "@/lib/firebase";
import { BookingStatus } from "@/lib/models";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      classroomId,
      userId,
      userEmail,
      userName,
      date,
      startTime,
      endTime,
      status = BookingStatus.CONFIRMED,
    } = body;

    if (!classroomId || !userId || !userEmail || !userName || !date || !startTime || !endTime) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = adminDb();

    const bookingData = {
      classroomId,
      userId,
      userEmail,
      userName,
      date,
      startTime,
      endTime,
      status,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await db.collection(Collections.BOOKINGS).add(bookingData);

    return NextResponse.json({
      id: docRef.id,
      ...bookingData,
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json(
      { message: "Failed to create booking" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classroomId = searchParams.get("classroomId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const userId = searchParams.get("userId");

    const db = adminDb();

    // Use single filter to avoid composite index requirements
    // Filter the rest in memory
    let query = db.collection(Collections.BOOKINGS) as FirebaseFirestore.Query;

    if (classroomId) {
      query = query.where("classroomId", "==", classroomId);
    } else if (userId) {
      query = query.where("userId", "==", userId);
    }

    const snapshot = await query.get();

    let bookings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Array<{ id: string; classroomId: string; userId: string; date: string; startTime: string }>;

    // Filter in memory to avoid composite indexes
    if (classroomId && userId) {
      bookings = bookings.filter((b) => b.userId === userId);
    }

    if (startDate && endDate) {
      bookings = bookings.filter((b) => b.date >= startDate && b.date <= endDate);
    }

    // Sort by date and startTime
    bookings.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { message: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}
