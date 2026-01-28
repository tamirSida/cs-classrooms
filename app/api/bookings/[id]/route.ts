import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { Collections } from "@/lib/firebase";
import { BookingStatus } from "@/lib/models";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { date, startTime, endTime, status, cancelledBy } = body;

    const db = adminDb();
    const docRef = db.collection(Collections.BOOKINGS).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { message: "Booking not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    if (date) updateData.date = date;
    if (startTime) updateData.startTime = startTime;
    if (endTime) updateData.endTime = endTime;
    if (status) {
      updateData.status = status;
      if (status === BookingStatus.CANCELLED && cancelledBy) {
        updateData.cancelledAt = Timestamp.now();
        updateData.cancelledBy = cancelledBy;
      }
    }

    await docRef.update(updateData);

    const updated = await docRef.get();

    return NextResponse.json({
      id: updated.id,
      ...updated.data(),
    });
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
