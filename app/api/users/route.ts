import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { Collections } from "@/lib/firebase";
import { UserRole } from "@/lib/models";
import { authorize } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  const caller = await authorize(request, [UserRole.SUPER_ADMIN]);
  if (caller instanceof Response) return caller;

  try {
    const body = await request.json();
    const { email, password, displayName, role } = body;
    const createdBy = caller.id;

    if (!email || !password || !displayName || !role) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!Object.values(UserRole).includes(role)) {
      return NextResponse.json({ message: "Invalid role" }, { status: 400 });
    }

    const auth = adminAuth();
    const db = adminDb();

    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
    });

    const userData = {
      email,
      displayName,
      role: role as UserRole,
      assignedClassrooms: [],
      createdBy,
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await db.collection(Collections.USERS).doc(userRecord.uid).set(userData);

    return NextResponse.json({
      id: userRecord.uid,
      ...userData,
    });
  } catch (error) {
    console.error("Error creating user:", error);

    if (error instanceof Error) {
      if (error.message.includes("email-already-exists")) {
        return NextResponse.json(
          { message: "Email already exists" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { message: "Failed to create user" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const caller = await authorize(request, [UserRole.SUPER_ADMIN]);
  if (caller instanceof Response) return caller;

  try {
    const db = adminDb();
    const snapshot = await db.collection(Collections.USERS).get();

    const users = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { message: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
