import {
  ConfirmationResult,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  OAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInAnonymously,
  signInWithCredential,
  signOut as firebaseSignOut,
  Unsubscribe,
  User as FirebaseUser,
} from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import Config from "react-native-config";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  signInWithApple as signInWithAppleAuth,
  AuthErrorCode,
  AuthError,
} from "./appleAuth";
import { UserProfile } from "../types/UserProfile";
import { getOrCreateUserProfileOnLogin } from "../firebase/firestore";
import { DEV_MODE } from "../config/devMode";
import { Timestamp } from "firebase/firestore";

let cachedUserProfile: UserProfile | null = null;

const mapFirebaseAuthError = (error: unknown): AuthError => {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: string }).code);
    const maybeMessage =
      "message" in error ? (error as { message?: unknown }).message : undefined;
    const details =
      typeof maybeMessage === "string"
        ? maybeMessage
        : code;
    if (code === "auth/network-request-failed") {
      return { code: AuthErrorCode.NETWORK, message: "Network error." };
    }
    if (
      code === "auth/invalid-credential" ||
      code === "auth/user-disabled" ||
      code === "auth/user-token-expired"
    ) {
      return { code: AuthErrorCode.UNAUTHORIZED, message: "Unauthorized." };
    }
    if (code === "auth/operation-not-allowed") {
      return {
        code: AuthErrorCode.UNAUTHORIZED,
        message:
          "Anonymous Auth is disabled in Firebase. Enable it in Authentication > Sign-in method.",
      };
    }
    if (code === "permission-denied") {
      return {
        code: AuthErrorCode.UNAUTHORIZED,
        message:
          "Firestore permission denied. Update Firestore rules to allow this signed-in user.",
      };
    }
    return {
      code: AuthErrorCode.UNKNOWN,
      message: `Auth error (${code}): ${details}`,
    };
  }

  if (error instanceof Error && error.message) {
    return {
      code: AuthErrorCode.UNKNOWN,
      message: error.message,
    };
  }

  return { code: AuthErrorCode.UNKNOWN, message: "Unknown auth error." };
};

const hydrateProfileForFirebaseUser = async (
  firebaseUser: FirebaseUser
): Promise<UserProfile> => {
  // Centralized hydration keeps UI free of Firebase calls.
  return getOrCreateUserProfileOnLogin({
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName ?? null,
    email: firebaseUser.email ?? null,
  });
};

const hydrateProfileWithFallback = async ({
  firebaseUser,
  displayName,
  email,
}: {
  firebaseUser: FirebaseUser;
  displayName?: string | null;
  email?: string | null;
}): Promise<UserProfile> => {
  let profile: UserProfile;
  try {
    profile = await getOrCreateUserProfileOnLogin({
      uid: firebaseUser.uid,
      displayName: displayName ?? firebaseUser.displayName ?? null,
      email: email ?? firebaseUser.email ?? null,
    });
  } catch (error) {
    // In DEV MODE, allow app usage even if Firestore rules/config are not ready yet.
    if (!DEV_MODE) {
      throw error;
    }
    profile = {
      uid: firebaseUser.uid,
      createdAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
      displayName: displayName ?? firebaseUser.displayName ?? "Dev User",
      email: email ?? firebaseUser.email ?? null,
      shabbatIntentText: null,
      wantsMorningReminders: true,
      wantsShabbatReminders: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      platform: "ios",
      gender: null,
      profileImageUrl: null,
      currentStreak: 0,
      longestStreak: 0,
      lastStreakWeekId: null,
      congregationId: null,
      congregationOnboardingCompleted: false,
    };
  }
  cachedUserProfile = profile;
  return profile;
};

const ensureGoogleConfigured = (): void => {
  const webClientId = Config.GOOGLE_WEB_CLIENT_ID ?? "";
  if (!webClientId) {
    throw new Error(
      "Missing GOOGLE_WEB_CLIENT_ID. Add it to .env using your Firebase Web client ID."
    );
  }
  GoogleSignin.configure({
    webClientId,
  });
};

export const signInWithApple = async (): Promise<UserProfile> => {
  try {
    const appleResult = await signInWithAppleAuth();
    let result: { user: FirebaseUser };

    if (DEV_MODE) {
      // DEV MODE STUB — replace with real native implementation.
      console.log("DEV MODE STUB — using anonymous Firebase auth.");
      result = await signInAnonymously(auth);
    } else {
      const provider = new OAuthProvider("apple.com");
      const credential = provider.credential({
        idToken: appleResult.idToken,
        rawNonce: appleResult.rawNonce,
      });
      result = await signInWithCredential(auth, credential);
    }
    return hydrateProfileWithFallback({
      firebaseUser: result.user,
      displayName: appleResult.fullName,
      email: appleResult.email,
    });
  } catch (error) {
    if (DEV_MODE) {
      // Last-resort DEV fallback so app can run without complete Firebase auth setup.
      const fallbackProfile: UserProfile = {
        uid: `dev-local-${Date.now()}`,
        createdAt: Timestamp.now(),
        lastLoginAt: Timestamp.now(),
        displayName: "Dev User",
        email: null,
        shabbatIntentText: null,
        wantsMorningReminders: true,
        wantsShabbatReminders: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        platform: "ios",
        gender: null,
        profileImageUrl: null,
        currentStreak: 0,
        longestStreak: 0,
        lastStreakWeekId: null,
        congregationId: null,
        congregationOnboardingCompleted: false,
      };
      cachedUserProfile = fallbackProfile;
      return fallbackProfile;
    }
    if (error && typeof error === "object" && "code" in error) {
      const typed = error as AuthError;
      if (Object.values(AuthErrorCode).includes(typed.code)) {
        throw typed;
      }
    }
    throw mapFirebaseAuthError(error);
  }
};

export const signInWithGoogle = async (): Promise<UserProfile> => {
  try {
    if (DEV_MODE) {
      const result = await signInAnonymously(auth);
      return hydrateProfileWithFallback({
        firebaseUser: result.user,
        displayName: "Dev Google User",
      });
    }

    ensureGoogleConfigured();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    await GoogleSignin.signIn();
    const { idToken } = await GoogleSignin.getTokens();
    if (!idToken) {
      throw new Error("Google sign-in did not return an ID token.");
    }

    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    return hydrateProfileWithFallback({ firebaseUser: result.user });
  } catch (error) {
    throw mapFirebaseAuthError(error);
  }
};

export const signInWithEmailPassword = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<UserProfile> => {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !password) {
    throw new Error("Email and password are required.");
  }
  try {
    const result = await signInWithEmailAndPassword(auth, trimmedEmail, password);
    return hydrateProfileWithFallback({ firebaseUser: result.user, email: trimmedEmail });
  } catch (error) {
    throw mapFirebaseAuthError(error);
  }
};

export const registerWithEmailPassword = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<UserProfile> => {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !password) {
    throw new Error("Email and password are required.");
  }
  try {
    const result = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
    return hydrateProfileWithFallback({ firebaseUser: result.user, email: trimmedEmail });
  } catch (error) {
    throw mapFirebaseAuthError(error);
  }
};

export const startPhoneSignIn = async (
  phoneNumber: string
): Promise<ConfirmationResult> => {
  const trimmedPhone = phoneNumber.trim();
  if (!trimmedPhone) {
    throw new Error("Phone number is required.");
  }
  try {
    return await signInWithPhoneNumber(auth, trimmedPhone);
  } catch (error) {
    throw mapFirebaseAuthError(error);
  }
};

export const confirmPhoneSignIn = async ({
  confirmation,
  code,
}: {
  confirmation: ConfirmationResult;
  code: string;
}): Promise<UserProfile> => {
  const trimmedCode = code.trim();
  if (!trimmedCode) {
    throw new Error("Verification code is required.");
  }
  try {
    const result = await confirmation.confirm(trimmedCode);
    return hydrateProfileWithFallback({ firebaseUser: result.user });
  } catch (error) {
    throw mapFirebaseAuthError(error);
  }
};

export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
  cachedUserProfile = null;
};

export const getCurrentUser = (): UserProfile | null => {
  return cachedUserProfile;
};

export const subscribeToAuthState = (
  callback: (profile: UserProfile | null) => void
): Unsubscribe => {
  // Wrap onAuthStateChanged to always return a hydrated profile.
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      cachedUserProfile = null;
      callback(null);
      return;
    }

    try {
      const profile = await hydrateProfileForFirebaseUser(firebaseUser);
      cachedUserProfile = profile;
      callback(profile);
    } catch {
      cachedUserProfile = null;
      callback(null);
    }
  });
};

export type { AuthError };
export { AuthErrorCode };
export type { ConfirmationResult as PhoneAuthConfirmation };
