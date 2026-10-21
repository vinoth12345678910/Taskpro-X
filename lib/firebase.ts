import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

// Firebase web configuration is public by design (it identifies the project; access is
// enforced by security rules). Every value can be overridden at build time.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyB-cfrZI67_V1BAw_ndzdACfCLUxiuPvHQ",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "taskprox-58458.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "taskprox-58458",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "taskprox-58458.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "341647400164",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:341647400164:web:bd01ce4e0775bc0343a0f1",
};

export const USE_EMULATORS = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "1";

const isNew = getApps().length === 0;
const app: FirebaseApp = isNew ? initializeApp(firebaseConfig) : getApp();

function createFirestore(): Firestore {
  if (!isNew) return getFirestore(app);
  // Emulator runs (CI / local e2e) use HTTP long-polling: it is immune to proxies that interfere with streaming
  // WebChannel connections, which made the very first write after boot stall in sandboxed environments.
  if (USE_EMULATORS) return initializeFirestore(app, { experimentalForceLongPolling: true });
  // Offline cache + multi-tab sync only in the browser (never during static prerender),
  // and not under emulators so test runs stay hermetic.
  if (typeof window !== "undefined" && !USE_EMULATORS) {
    try {
      return initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch {
      /* fall through to the default in-memory cache */
    }
  }
  return getFirestore(app);
}

export const auth = getAuth(app);
export const db = createFirestore();
export const storage = getStorage(app);

if (USE_EMULATORS && isNew) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
