import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { Collections } from "@/lib/firebase/collections";
import { Settings } from "@/lib/models/Settings";

export interface ServerSettings {
  operatingHours: { start: string; end: string };
  defaultMaxTimePerDay: number;
  adminCanOverrideBookings: boolean;
  allowRecurringForAllUsers: boolean;
}

// Reads global settings with the admin SDK. Permission flags fail closed when missing.
export async function getServerSettings(db: Firestore): Promise<ServerSettings> {
  const snap = await db.collection(Collections.SETTINGS).doc(Settings.DOCUMENT_ID).get();
  const data = snap.data() ?? {};
  return {
    operatingHours: data.operatingHours ?? { start: "08:00", end: "18:00" },
    defaultMaxTimePerDay: typeof data.defaultMaxTimePerDay === "number" ? data.defaultMaxTimePerDay : 60,
    adminCanOverrideBookings: data.adminCanOverrideBookings === true,
    allowRecurringForAllUsers: data.allowRecurringForAllUsers === true,
  };
}
