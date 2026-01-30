import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import crypto from "crypto";
import { Collections } from "@/lib/firebase";
import { UserRole, IInvitation, IBulkInviteResult, IValidateInvitationResponse } from "@/lib/models";
import { Resend } from "resend";
import { invitationEmailTemplate, invitationEmailText } from "@/lib/email";

const DEFAULT_EXPIRY_DAYS = 7;

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function getExpiryDate(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

// POST - Create invitation(s) and send email(s)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invitations } = body as { invitations: Array<{ email: string; name: string; role: UserRole }> };

    if (!invitations || !Array.isArray(invitations) || invitations.length === 0) {
      return NextResponse.json(
        { error: "No invitations provided" },
        { status: 400 }
      );
    }

    const db = adminDb();
    const auth = adminAuth();
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "room@efi-arazi.com";
    const fromName = process.env.RESEND_FROM_NAME || "ClassScheduler";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    if (!resendApiKey) {
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);
    const results: IBulkInviteResult = {
      success: true,
      sent: 0,
      failed: 0,
      errors: [],
    };

    for (const invite of invitations) {
      const { email, name, role } = invite;

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        results.failed++;
        results.errors.push({ email, error: "Invalid email format" });
        continue;
      }

      // Validate role
      if (role !== UserRole.ADMIN && role !== UserRole.STUDENT) {
        results.failed++;
        results.errors.push({ email, error: "Invalid role" });
        continue;
      }

      try {
        // Check if user already exists in Firebase Auth
        try {
          await auth.getUserByEmail(email);
          results.failed++;
          results.errors.push({ email, error: "User already exists" });
          continue;
        } catch (authError: any) {
          if (authError.code !== "auth/user-not-found") {
            throw authError;
          }
          // User not found, which is good for invitations
        }

        // Delete any existing pending invitations for this email
        const existingInvites = await db
          .collection(Collections.INVITATIONS)
          .where("email", "==", email)
          .where("used", "==", false)
          .get();

        const batch = db.batch();
        existingInvites.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();

        // Generate token and create invitation
        const token = generateToken();
        const expiryDays = DEFAULT_EXPIRY_DAYS;
        const expiresAt = getExpiryDate(expiryDays);

        const invitation: Omit<IInvitation, "id"> = {
          email,
          name,
          role,
          expiresAt: Timestamp.fromDate(expiresAt) as any,
          createdAt: Timestamp.now() as any,
          createdBy: "admin",
          used: false,
        };

        await db.collection(Collections.INVITATIONS).doc(token).set(invitation);

        // Build invitation URL
        const inviteUrl = `${baseUrl}/invite?token=${token}`;

        // Send email with both HTML and text versions
        const emailData = { name, email, role, inviteUrl, expiryDays };
        const { error } = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: email,
          subject: "You're Invited to ClassScheduler",
          html: invitationEmailTemplate(emailData),
          text: invitationEmailText(emailData),
        });

        if (error) {
          // Clean up invitation on email failure
          await db.collection(Collections.INVITATIONS).doc(token).delete();
          results.failed++;
          results.errors.push({ email, error: "Failed to send email" });
          continue;
        }

        console.log(`[INVITE] Invitation sent to ${email} (role: ${role})`);
        results.sent++;
      } catch (err: any) {
        results.failed++;
        results.errors.push({ email, error: err.message || "Unknown error" });
      }
    }

    results.success = results.failed === 0;

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("Create invitation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create invitations" },
      { status: 500 }
    );
  }
}

// GET - Validate invitation token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      const response: IValidateInvitationResponse = {
        valid: false,
        error: "No token provided",
      };
      return NextResponse.json(response, { status: 400 });
    }

    const db = adminDb();
    const invitationDoc = await db.collection(Collections.INVITATIONS).doc(token).get();

    if (!invitationDoc.exists) {
      const response: IValidateInvitationResponse = {
        valid: false,
        error: "Invalid invitation link",
      };
      return NextResponse.json(response, { status: 404 });
    }

    const invitation = invitationDoc.data() as Omit<IInvitation, "id">;

    // Check if already used
    if (invitation.used) {
      const response: IValidateInvitationResponse = {
        valid: false,
        error: "This invitation has already been used",
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Check if expired
    const expiresAt = invitation.expiresAt instanceof Date
      ? invitation.expiresAt
      : (invitation.expiresAt as any).toDate();

    if (new Date() > expiresAt) {
      const response: IValidateInvitationResponse = {
        valid: false,
        error: "This invitation has expired",
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Valid invitation
    const response: IValidateInvitationResponse = {
      valid: true,
      email: invitation.email,
      name: invitation.name,
      role: invitation.role,
    };
    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Validate invitation error:", error);
    const response: IValidateInvitationResponse = {
      valid: false,
      error: error.message || "Failed to validate invitation",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
