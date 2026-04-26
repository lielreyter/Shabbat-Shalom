import {
  ConfirmationResult,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  OAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
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
let pendingSignup = false;

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/user-not-found": "No account found with this email.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/user-token-expired": "Session expired. Please sign in again.",
  "auth/email-already-in-use": "An account already exists with this email.",
  "auth/weak-password": "Password is too weak. Use at least 6 characters.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/network-request-failed": "Network error. Check your connection.",
  "auth/invalid-phone-number": "Invalid phone number. Use format: +15551234567",
  "auth/missing-phone-number": "Please enter a phone number.",
  "auth/invalid-verification-code": "Invalid verification code.",
  "auth/code-expired": "Verification code has expired. Request a new one.",
  "auth/operation-not-allowed":
    "This sign-in method is not enabled. Enable it in Firebase Console > Authentication > Sign-in method.",
  "permission-denied":
    "Permission denied. Update Firestore rules to allow this user.",
};

const mapFirebaseAuthError = (error: unknown): AuthError => {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: string }).code);
    const friendly = FIREBASE_ERROR_MESSAGES[code];
    if (friendly) {
      const authCode =
        code === "auth/network-request-failed"
          ? AuthErrorCode.NETWORK
          : AuthErrorCode.UNAUTHORIZED;
      return { code: authCode, message: friendly };
    }
    const maybeMessage =
      "message" in error ? (error as { message?: unknown }).message : undefined;
    const details =
      typeof maybeMessage === "string" ? maybeMessage : code;
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
      tefillinCurrentStreak: 0,
      tefillinLongestStreak: 0,
      lastTefillinDate: null,
      wakeUpTime: null,
      bedTime: null,
      shabbatBlockLevel: "none",
      wantsModehAniReminder: false,
      wantsShemaReminder: false,
      wantsChatNotifications: true,
      intentVisibility: "private",
      streakVisibility: "public",
      friendCode: firebaseUser.uid.slice(0, 8).toUpperCase(),
      friendUids: [],
      pendingFriendUids: [],
      latitude: null,
      longitude: null,
      tefillinBuddyUids: [],
      buddyChatIds: [],
      fcmToken: null,
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
      const devUid = `dev-local-${Date.now()}`;
      const fallbackProfile: UserProfile = {
        uid: devUid,
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
        tefillinCurrentStreak: 0,
        tefillinLongestStreak: 0,
        lastTefillinDate: null,
        wakeUpTime: null,
        bedTime: null,
        shabbatBlockLevel: "none",
        wantsModehAniReminder: false,
        wantsShemaReminder: false,
        wantsChatNotifications: true,
        intentVisibility: "private",
        streakVisibility: "public",
        friendCode: devUid.replace(/\D/g, "").slice(-8).padStart(8, "0").toUpperCase() || "DEV00001",
        friendUids: [],
        pendingFriendUids: [],
        latitude: null,
        longitude: null,
        tefillinBuddyUids: [],
        buddyChatIds: [],
        fcmToken: null,
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
    const stub: UserProfile = {
      uid: result.user.uid,
      createdAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
      displayName: null,
      email: trimmedEmail,
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
      tefillinCurrentStreak: 0,
      tefillinLongestStreak: 0,
      lastTefillinDate: null,
      wakeUpTime: null,
      bedTime: null,
      shabbatBlockLevel: "none",
      wantsModehAniReminder: false,
      wantsShemaReminder: false,
      wantsChatNotifications: true,
      intentVisibility: "private",
      streakVisibility: "public",
      friendCode: result.user.uid.slice(0, 8).toUpperCase(),
      friendUids: [],
      pendingFriendUids: [],
      latitude: null,
      longitude: null,
      tefillinBuddyUids: [],
      buddyChatIds: [],
      fcmToken: null,
    };
    cachedUserProfile = stub;
    return stub;
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

export const confirmPhoneSignUp = async ({
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
    pendingSignup = true;
    const result = await confirmation.confirm(trimmedCode);
    const stub: UserProfile = {
      uid: result.user.uid,
      createdAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
      displayName: null,
      email: result.user.email ?? null,
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
      tefillinCurrentStreak: 0,
      tefillinLongestStreak: 0,
      lastTefillinDate: null,
      wakeUpTime: null,
      bedTime: null,
      shabbatBlockLevel: "none",
      wantsModehAniReminder: false,
      wantsShemaReminder: false,
      wantsChatNotifications: true,
      intentVisibility: "private",
      streakVisibility: "public",
      friendCode: result.user.uid.slice(0, 8).toUpperCase(),
      friendUids: [],
      pendingFriendUids: [],
      latitude: null,
      longitude: null,
      tefillinBuddyUids: [],
      buddyChatIds: [],
      fcmToken: null,
    };
    cachedUserProfile = stub;
    return stub;
  } catch (error) {
    throw mapFirebaseAuthError(error);
  }
};

export const sendVerification = async (): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("No signed-in user.");
  }
  if (user.emailVerified) {
    return;
  }
  await sendEmailVerification(user);
};

export const checkEmailVerified = async (): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) {
    return false;
  }
  await user.reload();
  return user.emailVerified;
};

export const isEmailProvider = (): boolean => {
  const user = auth.currentUser;
  if (!user) {
    return false;
  }
  return user.providerData.some((p) => p.providerId === "password");
};

export const isCurrentUserEmailVerified = (): boolean => {
  return auth.currentUser?.emailVerified ?? false;
};

export const resetPassword = async (email: string): Promise<void> => {
  const trimmed = email.trim();
  if (!trimmed) {
    throw new Error("Email is required.");
  }
  await sendPasswordResetEmail(auth, trimmed);
};

export const createProfileAfterVerification = async ({
  displayName,
  gender,
}: {
  displayName: string;
  gender: string;
}): Promise<UserProfile> => {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) {
    throw new Error("No signed-in user.");
  }
  const profile = await getOrCreateUserProfileOnLogin({
    uid: firebaseUser.uid,
    displayName,
    email: firebaseUser.email ?? null,
  });
  const updated = gender
    ? await import("../firebase/firestore").then((m) =>
        m.updateUserProfile(profile.uid, { displayName, gender })
      )
    : profile;
  cachedUserProfile = updated;
  pendingSignup = false;
  return updated;
};

export const deleteCurrentUser = async (): Promise<void> => {
  const firebaseUser = auth.currentUser;
  if (firebaseUser) {
    await deleteUser(firebaseUser);
  }
  cachedUserProfile = null;
  pendingSignup = false;
};

export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
  cachedUserProfile = null;
  pendingSignup = false;
};

export const getCurrentUser = (): UserProfile | null => {
  return cachedUserProfile;
};

export const subscribeToAuthState = (
  callback: (profile: UserProfile | null) => void
): Unsubscribe => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      cachedUserProfile = null;
      callback(null);
      return;
    }

    // Validate the user still exists on the server (catches users
    // deleted from Firebase Console while the local token is cached).
    if (!pendingSignup) {
      try {
        await firebaseUser.reload();
      } catch {
        await firebaseSignOut(auth);
        cachedUserProfile = null;
        pendingSignup = false;
        callback(null);
        return;
      }
    }

    const isUnverifiedEmail =
      !firebaseUser.emailVerified &&
      firebaseUser.providerData.some((p) => p.providerId === "password");

    if (isUnverifiedEmail || pendingSignup) {
      const stub: UserProfile = cachedUserProfile ?? {
        uid: firebaseUser.uid,
        createdAt: Timestamp.now(),
        lastLoginAt: Timestamp.now(),
        displayName: firebaseUser.displayName ?? null,
        email: firebaseUser.email ?? null,
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
        tefillinCurrentStreak: 0,
        tefillinLongestStreak: 0,
        lastTefillinDate: null,
        wakeUpTime: null,
        bedTime: null,
        shabbatBlockLevel: "none",
        wantsModehAniReminder: false,
        wantsShemaReminder: false,
        wantsChatNotifications: true,
        intentVisibility: "private",
        streakVisibility: "public",
        friendCode: firebaseUser.uid.slice(0, 8).toUpperCase(),
        friendUids: [],
        pendingFriendUids: [],
        latitude: null,
        longitude: null,
        tefillinBuddyUids: [],
        buddyChatIds: [],
        fcmToken: null,
      };
      cachedUserProfile = stub;
      callback(stub);
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
