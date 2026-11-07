import "server-only";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { Collections } from "@/lib/firebase/collections";
import { IUser, UserRole } from "@/lib/models";
import { HttpError } from "./http";

export const ADMIN_ROLES = [UserRole.ADMIN, UserRole.SUPER_ADMIN];

// Resolves the caller from a Firebase ID token. The acting user always comes from
// the token, never from the request body.
export async function requireUser(request: Request, roles?: UserRole[]): Promise<IUser> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Sign in required");

  let uid: string;
  let tokenEmail: string | undefined;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    uid = decoded.uid;
    tokenEmail = decoded.email;
  } catch {
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  }

  const snap = await adminDb().collection(Collections.USERS).doc(uid).get();
  if (!snap.exists) throw new HttpError(403, "Account not found");

  // Email comes from the verified token: the user document is client-editable data.
  const user = { id: snap.id, ...snap.data() } as IUser;
  if (tokenEmail) user.email = tokenEmail;
  if (user.isActive === false) throw new HttpError(403, "Your account is deactivated");
  if (roles && !roles.includes(user.role)) throw new HttpError(403, "You don't have permission to do this");

  return user;
}

export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

// For routes with their own try/catch: returns the user, or a ready error response.
export async function authorize(request: Request, roles?: UserRole[]): Promise<IUser | Response> {
  try {
    return await requireUser(request, roles);
  } catch (error) {
    if (error instanceof HttpError) {
      return Response.json({ message: error.message, error: error.message }, { status: error.status });
    }
    throw error;
  }
}
