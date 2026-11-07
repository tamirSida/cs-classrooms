import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let env: RulesTestEnvironment;

const DEFAULT_SETTINGS = {
  operatingHours: { start: "08:00", end: "18:00" },
  defaultMaxTimePerDay: 60,
  timeSlotDuration: 15,
  requiresApproval: false,
  restrictSignupDomain: true,
  allowedSignupDomains: ["runi.ac.il"],
  adminCanOverrideBookings: false,
  allowRecurringForAllUsers: false,
  updatedBy: "student",
};

const BOOKING = {
  classroomId: "room",
  userId: "student",
  date: "2026-12-01",
  startTime: "10:00",
  endTime: "11:00",
  status: "pending",
};

const db = (uid: string) => env.authenticatedContext(uid).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-cs-classrooms",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore();
    await setDoc(doc(admin, "users/super"), { role: "super_admin", isActive: true, displayName: "Super" });
    await setDoc(doc(admin, "users/admin"), { role: "admin", isActive: true, displayName: "Admin" });
    await setDoc(doc(admin, "users/student"), { role: "student", isActive: true, displayName: "Student" });
    await setDoc(doc(admin, "classrooms/room"), { name: "Room", config: { requiresApproval: true } });
    await setDoc(doc(admin, "bookings/single"), BOOKING);
    await setDoc(doc(admin, "bookings/series"), { ...BOOKING, seriesId: "s1", occurrenceIndex: 0 });
    await setDoc(doc(admin, "bookingSeries/s1"), { userId: "student" });
  });
});

async function seedSettings() {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "settings/global"), DEFAULT_SETTINGS));
}

describe("settings", () => {
  it("lets a student create default settings on first run", async () => {
    await assertSucceeds(setDoc(doc(db("student"), "settings/global"), DEFAULT_SETTINGS));
  });

  it("lets older clients create defaults without the new field", async () => {
    const { allowRecurringForAllUsers: _omit, ...legacy } = DEFAULT_SETTINGS;
    void _omit;
    await assertSucceeds(setDoc(doc(db("student"), "settings/global"), legacy));
  });

  it("blocks creating settings with a permission switched on", async () => {
    await assertFails(
      setDoc(doc(db("student"), "settings/global"), { ...DEFAULT_SETTINGS, allowRecurringForAllUsers: true })
    );
    await assertFails(
      setDoc(doc(db("student"), "settings/global"), { ...DEFAULT_SETTINGS, allowedSignupDomains: ["gmail.com"] })
    );
  });

  it("blocks creating settings under another id", async () => {
    await assertFails(setDoc(doc(db("student"), "settings/other"), DEFAULT_SETTINGS));
  });

  it("lets only super admins update settings", async () => {
    await seedSettings();
    await assertFails(updateDoc(doc(db("student"), "settings/global"), { allowRecurringForAllUsers: true }));
    await assertFails(updateDoc(doc(db("admin"), "settings/global"), { allowRecurringForAllUsers: true }));
    await assertSucceeds(updateDoc(doc(db("super"), "settings/global"), { allowRecurringForAllUsers: true }));
  });
});

describe("bookings", () => {
  it("blocks all client updates to single bookings", async () => {
    await assertFails(updateDoc(doc(db("student"), "bookings/single"), { status: "confirmed" }));
    await assertFails(updateDoc(doc(db("super"), "bookings/single"), { status: "confirmed" }));
  });

  it("blocks client updates to series bookings, even for super admins", async () => {
    await assertFails(updateDoc(doc(db("student"), "bookings/series"), { status: "confirmed" }));
    await assertFails(updateDoc(doc(db("super"), "bookings/series"), { status: "cancelled" }));
  });

  it("blocks attaching a booking to a series", async () => {
    await assertFails(updateDoc(doc(db("student"), "bookings/single"), { seriesId: "s1" }));
  });
});

describe("bookingSeries", () => {
  it("is readable but never client-writable", async () => {
    await assertSucceeds(getDoc(doc(db("student"), "bookingSeries/s1")));
    await assertFails(updateDoc(doc(db("super"), "bookingSeries/s1"), { userId: "x" }));
  });
});

describe("user profiles", () => {
  it("lets users change only their own display name", async () => {
    await assertSucceeds(updateDoc(doc(db("student"), "users/student"), { displayName: "Dana" }));
    await assertFails(updateDoc(doc(db("student"), "users/student"), { email: "attacker@example.com" }));
    await assertFails(updateDoc(doc(db("student"), "users/admin"), { displayName: "Hacked" }));
  });

  it("lets admins change only classroom assignments of others", async () => {
    await assertSucceeds(updateDoc(doc(db("admin"), "users/admin"), { assignedClassrooms: ["room"] }));
    await assertFails(updateDoc(doc(db("admin"), "users/student"), { displayName: "Renamed" }));
  });

  it("lets super admins edit any profile", async () => {
    await assertSucceeds(updateDoc(doc(db("super"), "users/student"), { displayName: "Renamed", role: "admin" }));
  });
});

describe("settings first run", () => {
  it("blocks first-run settings with custom operating hours", async () => {
    await assertFails(
      setDoc(doc(db("student"), "settings/global"), {
        ...DEFAULT_SETTINGS,
        operatingHours: { start: "00:00", end: "23:59" },
      })
    );
  });
});

describe("users", () => {
  it("blocks users from reactivating or deactivating accounts", async () => {
    await assertFails(updateDoc(doc(db("student"), "users/student"), { isActive: false }));
    await assertFails(updateDoc(doc(db("admin"), "users/super"), { isActive: false }));
    await assertSucceeds(updateDoc(doc(db("student"), "users/student"), { displayName: "New name" }));
    await assertSucceeds(updateDoc(doc(db("super"), "users/admin"), { isActive: false }));
  });
});

describe("classrooms", () => {
  it("lets only admins update classrooms", async () => {
    await assertFails(updateDoc(doc(db("student"), "classrooms/room"), { "config.requiresApproval": false }));
    await assertSucceeds(updateDoc(doc(db("admin"), "classrooms/room"), { "config.requiresApproval": false }));
  });
});
