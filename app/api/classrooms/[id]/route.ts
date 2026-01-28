import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { Collections } from "@/lib/firebase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, config, assignedAdmins } = body;

    const db = adminDb();
    const docRef = db.collection(Collections.CLASSROOMS).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { message: "Classroom not found" },
        { status: 404 }
      );
    }

    const currentData = doc.data();
    const updateData: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (assignedAdmins !== undefined) updateData.assignedAdmins = assignedAdmins;
    if (config !== undefined) {
      updateData.config = {
        ...currentData?.config,
        ...config,
      };
    }

    await docRef.update(updateData);

    const updated = await docRef.get();

    return NextResponse.json({
      id: updated.id,
      ...updated.data(),
    });
  } catch (error) {
    console.error("Error updating classroom:", error);
    return NextResponse.json(
      { message: "Failed to update classroom" },
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
    const docRef = db.collection(Collections.CLASSROOMS).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { message: "Classroom not found" },
        { status: 404 }
      );
    }

    await docRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting classroom:", error);
    return NextResponse.json(
      { message: "Failed to delete classroom" },
      { status: 500 }
    );
  }
}
