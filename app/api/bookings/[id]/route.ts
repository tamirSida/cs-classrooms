import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { Collections } from "@/lib/firebase";
import { BookingStatus, IBooking, UserRole } from "@/lib/models";
import { Resend } from "resend";
import {
  bookingModifiedTemplate,
  bookingCancelledByUserTemplate,
  bookingCancelledByAdminTemplate,
  BookingEmailData,
  BookingModifiedData,
} from "@/lib/email";

type BookingChange =
  | { kind: "modified"; oldDate: string; oldStartTime: string; oldEndTime: string }
  | { kind: "cancelled"; byAdmin: boolean }
  | { kind: "none" };

async function sendBookingChangeEmail(
  booking: IBooking,
  classroomName: string,
  change: BookingChange
): Promise<void> {
  if (change.kind === "none") return;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[API/bookings/:id] RESEND_API_KEY not configured, skipping email");
    return;
  }

  const resend = new Resend(apiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || "room@efi-arazi.com";
  const fromName = process.env.RESEND_FROM_NAME || "ClassScheduler";

  const baseData: BookingEmailData = {
    userName: booking.userName,
    userEmail: booking.userEmail,
    classroomName,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
  };

  let html: string;
  let subject: string;

  if (change.kind === "modified") {
    const modifiedData: BookingModifiedData = {
      ...baseData,
      oldDate: change.oldDate,
      oldStartTime: change.oldStartTime,
      oldEndTime: change.oldEndTime,
    };
    html = bookingModifiedTemplate(modifiedData);
    subject = `Booking Modified - ${classroomName}`;
  } else {
    html = change.byAdmin
      ? bookingCancelledByAdminTemplate(baseData)
      : bookingCancelledByUserTemplate(baseData);
    subject = `Booking Cancelled - ${classroomName}`;
  }

  try {
    console.log(`[API/bookings/:id] Sending ${change.kind} email to: ${booking.userEmail}`);
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: booking.userEmail,
      subject,
      html,
    });
    if (error) {
      console.error("[API/bookings/:id] Resend error:", error);
      return;
    }
    console.log(`[API/bookings/:id] Email sent! ID: ${data?.id}`);
  } catch (error) {
    console.error("[API/bookings/:id] Failed to send email:", error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { date, startTime, endTime, status, requesterId } = body;

    if (!requesterId) {
      return NextResponse.json(
        { message: "requesterId is required" },
        { status: 400 }
      );
    }

    const db = adminDb();
    const docRef = db.collection(Collections.BOOKINGS).doc(id);
    const existingDoc = await docRef.get();

    if (!existingDoc.exists) {
      return NextResponse.json({ message: "Booking not found" }, { status: 404 });
    }

    const existing = { id: existingDoc.id, ...existingDoc.data() } as IBooking;

    // Look up requester role for authorization
    const requesterDoc = await db.collection(Collections.USERS).doc(requesterId).get();
    if (!requesterDoc.exists) {
      return NextResponse.json({ message: "Requester not found" }, { status: 401 });
    }
    const requesterRole = requesterDoc.data()?.role as UserRole;
    const isAdmin = requesterRole === UserRole.ADMIN || requesterRole === UserRole.SUPER_ADMIN;
    const isOwner = existing.userId === requesterId;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { message: "Not authorized to modify this booking" },
        { status: 403 }
      );
    }

    if (existing.status === BookingStatus.CANCELLED && status !== BookingStatus.CANCELLED) {
      return NextResponse.json(
        { message: "Cannot modify a cancelled booking" },
        { status: 400 }
      );
    }

    // Determine the change kind for email routing
    const isCancelling = status === BookingStatus.CANCELLED && existing.status !== BookingStatus.CANCELLED;
    const timeChanged =
      (date && date !== existing.date) ||
      (startTime && startTime !== existing.startTime) ||
      (endTime && endTime !== existing.endTime);

    const updateData: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    if (date) updateData.date = date;
    if (startTime) updateData.startTime = startTime;
    if (endTime) updateData.endTime = endTime;
    if (status) {
      updateData.status = status;
      if (status === BookingStatus.CANCELLED) {
        updateData.cancelledAt = Timestamp.now();
        updateData.cancelledBy = requesterId;
      }
    }

    await docRef.update(updateData);
    const updatedDoc = await docRef.get();
    const updated = { id: updatedDoc.id, ...updatedDoc.data() } as IBooking;

    // Look up classroom for the email
    const classroomDoc = await db
      .collection(Collections.CLASSROOMS)
      .doc(updated.classroomId)
      .get();
    const classroomName = classroomDoc.exists
      ? (classroomDoc.data()?.name as string) || "Classroom"
      : "Classroom";

    let change: BookingChange = { kind: "none" };
    if (isCancelling) {
      change = { kind: "cancelled", byAdmin: isAdmin && !isOwner };
    } else if (timeChanged) {
      change = {
        kind: "modified",
        oldDate: existing.date,
        oldStartTime: existing.startTime,
        oldEndTime: existing.endTime,
      };
    }

    await sendBookingChangeEmail(updated, classroomName, change);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating booking:", error);
    return NextResponse.json(
      { message: "Failed to update booking" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = adminDb();
    const docRef = db.collection(Collections.BOOKINGS).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { message: "Booking not found" },
        { status: 404 }
      );
    }

    await docRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting booking:", error);
    return NextResponse.json(
      { message: "Failed to delete booking" },
      { status: 500 }
    );
  }
}
