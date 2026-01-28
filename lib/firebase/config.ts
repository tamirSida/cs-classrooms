import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

class FirebaseClient {
  private static instance: FirebaseClient | null = null;
  private app: FirebaseApp | null = null;
  private _auth: Auth | null = null;
  private _firestore: Firestore | null = null;

  private initialize() {
    if (!this.app) {
      this.app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
      this._auth = getAuth(this.app);
      this._firestore = getFirestore(this.app);
    }
  }

  static getInstance(): FirebaseClient {
    if (!FirebaseClient.instance) {
      FirebaseClient.instance = new FirebaseClient();
    }
    return FirebaseClient.instance;
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

const firebaseClient = FirebaseClient.getInstance();

export const getFirebaseAuth = () => firebaseClient.auth;
export const getFirebaseDb = () => firebaseClient.firestore;

export const auth = typeof window !== "undefined" ? firebaseClient.auth : null!;
export const db = typeof window !== "undefined" ? firebaseClient.firestore : null!;
