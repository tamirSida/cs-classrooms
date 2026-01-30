import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { Collections } from "@/lib/firebase";
import { IInvitation, UserRole } from "@/lib/models";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const db = adminDb();
    const auth = adminAuth();

    // Get invitation
    const invitationDoc = await db.collection(Collections.INVITATIONS).doc(token).get();

    if (!invitationDoc.exists) {
      return NextResponse.json(
        { error: "Invalid invitation link" },
        { status: 404 }
      );
    }

    const invitation = invitationDoc.data() as Omit<IInvitation, "id">;

    // Check if already used
    if (invitation.used) {
      return NextResponse.json(
        { error: "This invitation has already been used" },
        { status: 400 }
      );
    }

    // Check if expired
    const expiresAt = invitation.expiresAt instanceof Date
      ? invitation.expiresAt
      : (invitation.expiresAt as any).toDate();

    if (new Date() > expiresAt) {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 400 }
      );
    }

    // Create Firebase Auth user
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: invitation.email,
        password,
        displayName: invitation.name,
      });
    } catch (authError: any) {
      if (authError.code === "auth/email-already-exists") {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 400 }
        );
      }
      throw authError;
    }

    // Create user document in Firestore
    const userData = {
      email: invitation.email,
      displayName: invitation.name,
      role: invitation.role,
      assignedClassrooms: [],
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: invitation.createdBy,
    };

    await db.collection(Collections.USERS).doc(userRecord.uid).set(userData);

    // Mark invitation as used
    await db.collection(Collections.INVITATIONS).doc(token).update({
      used: true,
      usedAt: Timestamp.now(),
    });

    console.log(`[INVITE] Invitation accepted: ${invitation.email} (role: ${invitation.role})`);

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
    });
  } catch (error: any) {
    console.error("Accept invitation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to accept invitation" },
      { status: 500 }
    );
  }
}
