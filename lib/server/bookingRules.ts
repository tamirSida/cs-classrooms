import "server-only";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { Collections } from "@/lib/firebase/collections";
import { ActiveBooking } from "@/lib/bookings";
import { BookingStatus, IUser, UserRole } from "@/lib/models";
import { HttpError } from "./http";
import { ServerSettings } from "./settings";

export interface ClassroomRecord {
  id: string;
  name: string;
  config: {
    permissions?: string;
    maxTimePerDay?: number;
    requiresApproval?: boolean;
    isActive?: boolean;
  };
}

// Live (pending or confirmed) bookings between two dates, across all classrooms.
// A single-field range query needs no composite index; the caller filters by classroom.
export async function loadActiveBookings(
  db: Firestore,
  fromDate: string,
  toDate: string,
  tx?: Transaction
): Promise<ActiveBooking[]> {
  const query = db
    .collection(Collections.BOOKINGS)
    .where("date", ">=", fromDate)
    .where("date", "<=", toDate);
  const snap = tx ? await tx.get(query) : await query.get();
  return snap.docs
    .filter((doc) => doc.data().status !== BookingStatus.CANCELLED)
    .map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        classroomId: d.classroomId,
        userId: d.userId,
        date: d.date,
        startTime: d.startTime,
        endTime: d.endTime,
      };
    });
}

export async function loadClassroom(db: Firestore, classroomId: string, tx?: Transaction): Promise<ClassroomRecord> {
  const ref = db.collection(Collections.CLASSROOMS).doc(classroomId);
  const snap = tx ? await tx.get(ref) : await ref.get();
  if (!snap.exists) throw new HttpError(404, "Classroom not found");
  const data = snap.data()!;
  return { id: snap.id, name: data.name ?? "Classroom", config: data.config ?? {} };
}

export function assertCanBookClassroom(user: IUser, classroom: ClassroomRecord): void {
  if (classroom.config.isActive === false) throw new HttpError(400, "Classroom is not active");
  if (classroom.config.permissions === "admin_only" && user.role === UserRole.STUDENT) {
    throw new HttpError(403, "Students cannot book this classroom");
  }
}

// Super-admins always override; admins only when the settings toggle is on.
export function canOverrideBookings(user: IUser, settings: ServerSettings): boolean {
  if (user.role === UserRole.SUPER_ADMIN) return true;
  return user.role === UserRole.ADMIN && settings.adminCanOverrideBookings;
}

export function initialStatus(user: IUser, classroom: ClassroomRecord): BookingStatus {
  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  return isAdmin || !classroom.config.requiresApproval ? BookingStatus.CONFIRMED : BookingStatus.PENDING;
}
