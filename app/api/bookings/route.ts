import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { Collections } from "@/lib/firebase";
import { BookingStatus, IBooking, UserRole } from "@/lib/models";
import { Resend } from "resend";
import {
  bookingConfirmedTemplate,
  bookingPendingTemplate,
  bookingConfirmedText,
  bookingPendingText,
  BookingEmailData,
} from "@/lib/email";

// Server-side email sending (has access to RESEND_API_KEY)
async function sendBookingEmail(booking: IBooking, classroomName: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[API/bookings] RESEND_API_KEY not configured, skipping email");
    return false;
  }

  const resend = new Resend(apiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || "room@efi-arazi.com";
  const fromName = process.env.RESEND_FROM_NAME || "ClassScheduler";

  const isPending = booking.status === BookingStatus.PENDING;
  const emailData: BookingEmailData = {
    userName: booking.userName,
    userEmail: booking.userEmail,
    classroomName,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
  };

  const html = isPending
    ? bookingPendingTemplate(emailData)
    : bookingConfirmedTemplate(emailData);

  const text = isPending
    ? bookingPendingText(emailData)
    : bookingConfirmedText(emailData);

  const subject = isPending
    ? `Booking Submitted - ${classroomName}`
    : `Booking Confirmed - ${classroomName}`;

  try {
    console.log(`[API/bookings] Sending email to: ${booking.userEmail}, status: ${booking.status}`);
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: booking.userEmail,
      subject,
      html,
      text,
    });

    if (error) {
      console.error("[API/bookings] Resend error:", error);
      return false;
    }

    console.log(`[API/bookings] Email sent! ID: ${data?.id}`);
    return true;
  } catch (error) {
    console.error("[API/bookings] Failed to send email:", error);
    return false;
  }
}

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
    } = body;

    if (!classroomId || !userId || !userEmail || !userName || !date || !startTime || !endTime) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = adminDb();

    // Get classroom data
    const classroomDoc = await db.collection(Collections.CLASSROOMS).doc(classroomId).get();
    if (!classroomDoc.exists) {
      return NextResponse.json(
        { message: "Classroom not found" },
        { status: 404 }
      );
    }
    const classroomData = classroomDoc.data();
    const classroomName = classroomData?.name || "Classroom";
    const requiresApproval = classroomData?.config?.requiresApproval ?? false;

    // Get user role to determine if admin (auto-approve)
    const userDoc = await db.collection(Collections.USERS).doc(userId).get();
    const userRole = userDoc.exists ? userDoc.data()?.role : UserRole.STUDENT;
    const isAdmin = userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN;

    // Determine status: admins auto-confirm, otherwise check classroom setting
    const status = isAdmin || !requiresApproval
      ? BookingStatus.CONFIRMED
      : BookingStatus.PENDING;

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

    const booking: IBooking = {
      id: docRef.id,
      ...bookingData,
    };

    // Send confirmation email (server-side)
    await sendBookingEmail(booking, classroomName);

    return NextResponse.json(booking);
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
