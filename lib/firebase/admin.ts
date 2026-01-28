import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

class FirebaseAdmin {
  private static instance: FirebaseAdmin | null = null;
  private app: App | null = null;
  private _auth: Auth | null = null;
  private _firestore: Firestore | null = null;
  private initialized = false;

  private initialize(): void {
    if (this.initialized) return;

    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccountKey) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. " +
          "Please add your Firebase service account JSON to .env.local"
      );
    }

    try {
      const serviceAccount = JSON.parse(serviceAccountKey);

      if (getApps().length === 0) {
        this.app = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
      } else {
        this.app = getApps()[0];
      }

      this._auth = getAuth(this.app);
      this._firestore = getFirestore(this.app);
      this.initialized = true;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(
          "FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON. " +
            "Make sure to paste the entire service account JSON as a single line."
        );
      }
      throw error;
    }
  }

  static getInstance(): FirebaseAdmin {
    if (!FirebaseAdmin.instance) {
      FirebaseAdmin.instance = new FirebaseAdmin();
    }
    return FirebaseAdmin.instance;
  }

  get auth(): Auth {
    this.initialize();
    return this._auth!;
  }

  get firestore(): Firestore {
    this.initialize();
    return this._firestore!;
  }
}

export const getFirebaseAdmin = () => FirebaseAdmin.getInstance();
export const adminAuth = () => getFirebaseAdmin().auth;
export const adminDb = () => getFirebaseAdmin().firestore;
