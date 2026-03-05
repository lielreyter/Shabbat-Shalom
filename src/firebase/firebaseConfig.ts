import Config from "react-native-config";
import { initializeApp, getApps } from "firebase/app";
import {
  initializeAuth,
  getAuth,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";

const { getReactNativePersistence } = require("@firebase/auth/dist/rn/index.js");

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

const firebaseConfig: FirebaseConfig = {
  apiKey: Config.FIREBASE_API_KEY ?? "",
  authDomain: Config.FIREBASE_AUTH_DOMAIN ?? "",
  projectId: Config.FIREBASE_PROJECT_ID ?? "",
  storageBucket: Config.FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: Config.FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: Config.FIREBASE_APP_ID ?? "",
  measurementId: Config.FIREBASE_MEASUREMENT_ID || undefined,
};

const requiredKeys: (keyof FirebaseConfig)[] = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

requiredKeys.forEach((key) => {
  if (!firebaseConfig[key]) {
    throw new Error(`Missing Firebase env var: ${key}`);
  }
});

// Reuse the app instance in dev (hot reload) to avoid duplicate init.
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // If auth was already initialized (hot reload), reuse it.
    return getAuth(app);
  }
})();

export const firestore = getFirestore(app);
