import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { type Auth, connectAuthEmulator, getAuth } from "firebase/auth";
import {
  type Firestore,
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
// Cloud Storage is deliberately not initialized: it requires Firebase's paid
// Blaze plan, and no screen in this app uploads or serves files. The
// storageBucket value stays in the config so enabling it later is a one-liner.

const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

// Next.js inlines process.env.NEXT_PUBLIC_* at build time, so these have to be
// referenced as literal property accesses — a dynamic process.env[name] lookup
// would come back undefined in the browser bundle.
const rawConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const missingEnvVars = REQUIRED_ENV_VARS.filter((name) => {
  switch (name) {
    case "NEXT_PUBLIC_FIREBASE_API_KEY":
      return !rawConfig.apiKey;
    case "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN":
      return !rawConfig.authDomain;
    case "NEXT_PUBLIC_FIREBASE_PROJECT_ID":
      return !rawConfig.projectId;
    case "NEXT_PUBLIC_FIREBASE_APP_ID":
      return !rawConfig.appId;
  }
});

/**
 * True once real Firebase credentials are present. The UI reads this so a
 * missing/incomplete .env.local shows a clear setup message instead of a
 * cryptic `auth/invalid-api-key` failure at login.
 */
export const isFirebaseConfigured = missingEnvVars.length === 0;

// Firebase's SDK throws at init if apiKey is empty, which would break `next build`
// before credentials are added. Falling back to Firebase's own "demo-*" convention
// keeps the build and dev server usable; `isFirebaseConfigured` is what gates the UI.
const firebaseConfig = {
  apiKey: rawConfig.apiKey || "demo-api-key",
  authDomain: rawConfig.authDomain || "demo-clinic.firebaseapp.com",
  projectId: rawConfig.projectId || "demo-clinic",
  storageBucket: rawConfig.storageBucket || "demo-clinic.appspot.com",
  messagingSenderId: rawConfig.messagingSenderId || "000000000000",
  appId: rawConfig.appId || "1:000000000000:web:0000000000000000000000",
};

if (!isFirebaseConfigured && !useEmulators && typeof window !== "undefined") {
  console.error(
    `[Firebase] Missing configuration: ${missingEnvVars.join(", ")}.\n` +
      "Copy .env.local.example to .env.local and paste your Firebase web app config " +
      "(Firebase Console > Project Settings > General > Your apps). " +
      "Restart the dev server after editing .env.local.",
  );
}

function createFirebaseApp(): FirebaseApp {
  const existing = getApps();
  if (existing.length > 0) return existing[0];
  return initializeApp(firebaseConfig);
}

const app = createFirebaseApp();

// Firestore must be created via initializeFirestore (not getFirestore) so we can
// turn on offline persistence — the clinic's front desk connection is unreliable
// and staff need to keep working (queue, check-ins) through short outages.
let firestoreInstance: Firestore;
if (typeof window === "undefined") {
  // SSR/build: no IndexedDB available, plain Firestore instance is enough.
  firestoreInstance = getFirestore(app);
} else {
  try {
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    // Fast Refresh can re-execute this module against an app that already has
    // a Firestore instance attached; fall back to the existing one.
    firestoreInstance = getFirestore(app);
  }
}

export const db: Firestore = firestoreInstance;
export const auth: Auth = getAuth(app);

let emulatorsConnected = false;
if (useEmulators && typeof window !== "undefined" && !emulatorsConnected) {
  emulatorsConnected = true;
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export { app };
