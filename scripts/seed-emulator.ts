// Seeds the local Firebase emulators with test users, classrooms and settings.
// Refuses to run unless both emulator hosts are set, so it can never touch a real project.
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const PROJECT_ID = "demo-cs-classrooms";
const PASSWORD = "password123";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Emulator hosts not set. Aborting so no real project is touched.");
  process.exit(1);
}

const app = initializeApp({ projectId: PROJECT_ID });
const auth = getAuth(app);
const db = getFirestore(app);

const users = [
  { uid: "super", email: "super@runi.ac.il", displayName: "Super Admin", role: "super_admin" },
  { uid: "admin", email: "admin@runi.ac.il", displayName: "Room Admin", role: "admin" },
  { uid: "student", email: "student@runi.ac.il", displayName: "Dana Student", role: "student" },
  { uid: "student2", email: "student2@runi.ac.il", displayName: "Yossi Student", role: "student" },
];

const classrooms = [
  { id: "room-open", name: "Room A (open)", requiresApproval: false, permissions: "student" },
  { id: "room-approval", name: "Room B (approval)", requiresApproval: true, permissions: "student" },
  { id: "room-admin", name: "Room C (admin only)", requiresApproval: false, permissions: "admin_only" },
];

async function main() {
  const now = Timestamp.now();

  for (const u of users) {
    await auth.createUser({ uid: u.uid, email: u.email, password: PASSWORD, displayName: u.displayName }).catch(() => undefined);
    await db.doc(`users/${u.uid}`).set({
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      assignedClassrooms: [],
      isActive: true,
      createdBy: "seed",
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const c of classrooms) {
    await db.doc(`classrooms/${c.id}`).set({
      name: c.name,
      description: "",
      config: { permissions: c.permissions, maxTimePerDay: 0, requiresApproval: c.requiresApproval, isActive: true },
      assignedAdmins: ["admin"],
      createdAt: now,
      updatedAt: now,
    });
  }

  await db.doc("settings/global").set({
    operatingHours: { start: "08:00", end: "18:00" },
    defaultMaxTimePerDay: -1,
    timeSlotDuration: 15,
    requiresApproval: false,
    restrictSignupDomain: true,
    allowedSignupDomains: ["runi.ac.il"],
    adminCanOverrideBookings: false,
    allowRecurringForAllUsers: false,
    signupCode: "QA-CODE",
    updatedAt: now,
    updatedBy: "seed",
  });

  console.log(`Seeded ${users.length} users (password: ${PASSWORD}), ${classrooms.length} classrooms, settings.`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
