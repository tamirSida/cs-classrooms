import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Collections } from "@/lib/firebase";

// GET - Validate signup code
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    const db = adminDb();
    const settingsDoc = await db.collection(Collections.SETTINGS).doc("global").get();

    if (!settingsDoc.exists) {
      return NextResponse.json({ valid: false }, { status: 404 });
    }

    const settings = settingsDoc.data();
    const signupCode = settings?.signupCode;

    if (!signupCode || signupCode !== code) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({ valid: true });
  } catch (error: any) {
    console.error("Validate signup code error:", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
