import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { Collections } from "@/lib/firebase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, config, assignedAdmins = [] } = body;

    if (!name || !config) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = adminDb();

    const classroomData = {
      name,
      description,
      config,
      assignedAdmins,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await db.collection(Collections.CLASSROOMS).add(classroomData);

    return NextResponse.json({
      id: docRef.id,
      ...classroomData,
    });
  } catch (error) {
    console.error("Error creating classroom:", error);
    return NextResponse.json(
      { message: "Failed to create classroom" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const db = adminDb();
    const snapshot = await db.collection(Collections.CLASSROOMS).get();

    const classrooms = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(classrooms);
  } catch (error) {
    console.error("Error fetching classrooms:", error);
    return NextResponse.json(
      { message: "Failed to fetch classrooms" },
      { status: 500 }
    );
  }
}
