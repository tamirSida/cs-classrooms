import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { Collections } from "@/lib/firebase";
import { UserRole, IUser } from "@/lib/models";

// POST - Create a new student user via self-signup
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, code } = body;

    const db = adminDb();

    // Get signup code from settings
    const settingsDoc = await db.collection(Collections.SETTINGS).doc("global").get();
    const signupCode = settingsDoc.exists ? settingsDoc.data()?.signupCode : null;

    // Validate signup code
    if (!signupCode || code !== signupCode) {
      return NextResponse.json(
        { error: "Invalid signup link" },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const auth = adminAuth();

    // Check if user already exists
    try {
      await auth.getUserByEmail(email);
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    } catch (authError: any) {
      if (authError.code !== "auth/user-not-found") {
        throw authError;
      }
      // User not found - good, we can create
    }

    // Create Firebase Auth user
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    });

    // Create Firestore user document
    const userData: Omit<IUser, "id"> = {
      email,
      name,
      role: UserRole.STUDENT,
      active: true,
      createdAt: Timestamp.now() as any,
    };

    await db.collection(Collections.USERS).doc(userRecord.uid).set(userData);

    console.log(`[SIGNUP] New student registered: ${email}`);

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create account" },
      { status: 500 }
    );
  }
}
