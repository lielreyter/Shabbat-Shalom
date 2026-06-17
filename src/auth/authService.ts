import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  OAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInAnonymously,
  signInWithCredential,
  signOut as firebaseSignOut,
  updateProfile,
  Unsubscribe,
  User as FirebaseUser,
} from "firebase/auth";
import nativeAuth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { Platform } from "react-native";
import { auth } from "../firebase/firebaseConfig";
import Config from "react-native-config";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  signInWithApple as signInWithAppleAuth,
  AuthErrorCode,
  AuthError,
} from "./appleAuth";
import { UserProfile } from "../types/UserProfile";
import { getOrCreateUserProfileOnLogin, getUserProfile } from "../firebase/firestore";
import { DEV_MODE } from "../config/devMode";
import { Timestamp } from "firebase/firestore";

let cachedUserProfile: UserProfile | null = null;
let pendingSignup = false;

export type PhoneAuthConfirmation = {
  verificationId: string;
};

let pendingNativePhoneConfirmation: FirebaseAuthTypes.ConfirmationResult | null = null;

const ensureIosPhoneVerificationReady = async (): Promise<void> => {
  if (Platform.OS !== "ios") return;
  try {
    const messaging = (await import("@react-native-firebase/messaging")).default;
    await messaging().registerDeviceForRemoteMessages();
  } catch {
    // Phone auth can still fall back to reCAPTCHA if push registration fails.
  }
};

const resolvePhoneAuthUser = async (): Promise<{
  uid: string;
  displayName: string | null;
  email: string | null;
}> => {
  const readUser = (): {
    uid: string;
    displayName: string | null;
    email: string | null;
  } | null => {
    const nativeUser = nativeAuth().currentUser;
    if (nativeUser?.uid) {
      return {
        uid: nativeUser.uid,
        displayName: nativeUser.displayName,
        email: nativeUser.email,
      };
    }
    const webUser = auth.currentUser;
    if (webUser?.uid) {
      return {
        uid: webUser.uid,
        displayName: webUser.displayName,
        email: webUser.email,
      };
    }
    return null;
  };

  const immediate = readUser();
  if (immediate) return immediate;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const synced = readUser();
    if (synced) return synced;
  }

  throw new Error("Phone sign-in failed. Please try again.");
};

const signOutPhoneSignupCollision = async (): Promise<void> => {
  try {
    await nativeAuth().signOut();
  } catch {
    // The native session may already be clear.
  }
  try {
    await firebaseSignOut(auth);
  } catch {
    // Phone auth uses the native session; the web session may not exist.
  }
};

const EMAIL_VERIFICATION_BYPASS_EMAILS = new Set(["liel.reyter@gmail.com"]);
const DEFAULT_SHABBAT_INTENTION = "To connect with Hashem";
const AUTH_STATE_TIMEOUT_MS = 10000;

const shouldBypassEmailVerification = (email: string | null): boolean =>
  email !== null && EMAIL_VERIFICATION_BYPASS_EMAILS.has(email.trim().toLowerCase());

const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

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
  "auth/invalid-phone-number": "Invalid phone number. Check the country and local number.",
  "auth/missing-phone-number": "Please enter a phone number.",
  "auth/invalid-verification-code": "Invalid verification code.",
  "auth/code-expired": "Verification code has expired. Request a new one.",
  "auth/missing-verification-code": "Please enter the verification code.",
  "auth/quota-exceeded": "SMS limit reached. Please try again later.",
  "auth/captcha-check-failed": "Verification failed. Please try again.",
  "auth/argument-error": "Phone sign-in could not start. Check that the number is valid and try again.",
  "auth/operation-not-supported-in-this-environment":
    "Phone sign-in is unavailable in this build. Make sure @react-native-firebase/auth is installed and pods are updated.",
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
      faithTradition: null,
      shabbatIntentText: DEFAULT_SHABBAT_INTENTION,
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
      firstRunGuideCompleted: false,
      tefillinCurrentStreak: 0,
      tefillinLongestStreak: 0,
      lastTefillinDate: null,
      candleCurrentStreak: 0,
      candleLongestStreak: 0,
      lastCandleDate: null,
      wakeUpTime: null,
      bedTime: null,
      shabbatBlockLevel: "none",
      wantsModehAniReminder: false,
      wantsShemaReminder: false,
      wantsChatNotifications: true,
      intentVisibility: "private",
      streakVisibility: "public",
      friendCode: firebaseUser.uid.slice(0, 8).toUpperCase(),
      friendRequestStatus: "request",
      friendUids: [],
      pendingFriendUids: [],
      latitude: null,
      longitude: null,
      tefillinBuddyUids: [],
      candleBuddyUids: [],
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
      const appleDisplayName = appleResult.fullName?.trim();
      if (appleDisplayName && appleDisplayName !== result.user.displayName) {
        await updateProfile(result.user, { displayName: appleDisplayName });
      }
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
        faithTradition: null,
        shabbatIntentText: DEFAULT_SHABBAT_INTENTION,
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
        firstRunGuideCompleted: false,
        tefillinCurrentStreak: 0,
        tefillinLongestStreak: 0,
        lastTefillinDate: null,
        candleCurrentStreak: 0,
        candleLongestStreak: 0,
        lastCandleDate: null,
        wakeUpTime: null,
        bedTime: null,
        shabbatBlockLevel: "none",
        wantsModehAniReminder: false,
        wantsShemaReminder: false,
        wantsChatNotifications: true,
        intentVisibility: "private",
        streakVisibility: "public",
        friendCode: devUid.replace(/\D/g, "").slice(-8).padStart(8, "0").toUpperCase() || "DEV00001",
        friendRequestStatus: "request",
        friendUids: [],
        pendingFriendUids: [],
        latitude: null,
        longitude: null,
        tefillinBuddyUids: [],
        candleBuddyUids: [],
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
  displayName,
  gender,
}: {
  email: string;
  password: string;
  displayName?: string | null;
  gender?: string | null;
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
      displayName: displayName ?? null,
      email: trimmedEmail,
      faithTradition: null,
      shabbatIntentText: DEFAULT_SHABBAT_INTENTION,
      wantsMorningReminders: true,
      wantsShabbatReminders: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      platform: "ios",
      gender: gender ?? null,
      profileImageUrl: null,
      currentStreak: 0,
      longestStreak: 0,
      lastStreakWeekId: null,
      congregationId: null,
      congregationOnboardingCompleted: false,
      firstRunGuideCompleted: false,
      tefillinCurrentStreak: 0,
      tefillinLongestStreak: 0,
      lastTefillinDate: null,
      candleCurrentStreak: 0,
      candleLongestStreak: 0,
      lastCandleDate: null,
      wakeUpTime: null,
      bedTime: null,
      shabbatBlockLevel: "none",
      wantsModehAniReminder: false,
      wantsShemaReminder: false,
      wantsChatNotifications: true,
      intentVisibility: "private",
      streakVisibility: "public",
      friendCode: result.user.uid.slice(0, 8).toUpperCase(),
      friendRequestStatus: "request",
      friendUids: [],
      pendingFriendUids: [],
      latitude: null,
      longitude: null,
      tefillinBuddyUids: [],
      candleBuddyUids: [],
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
): Promise<PhoneAuthConfirmation> => {
  const trimmedPhone = phoneNumber.trim();
  if (!trimmedPhone) {
    throw new Error("Phone number is required.");
  }
  try {
    await ensureIosPhoneVerificationReady();
    pendingNativePhoneConfirmation = await nativeAuth().signInWithPhoneNumber(trimmedPhone);
    if (!pendingNativePhoneConfirmation.verificationId) {
      pendingNativePhoneConfirmation = null;
      throw new Error("Phone verification could not start. Please try again.");
    }
    return { verificationId: pendingNativePhoneConfirmation.verificationId };
  } catch (error) {
    pendingNativePhoneConfirmation = null;
    throw mapFirebaseAuthError(error);
  }
};

export const confirmPhoneSignIn = async ({
  confirmation,
  code,
}: {
  confirmation: PhoneAuthConfirmation;
  code: string;
}): Promise<UserProfile> => {
  const trimmedCode = code.trim();
  if (!trimmedCode) {
    throw new Error("Verification code is required.");
  }
  try {
    const nativeConfirmation = pendingNativePhoneConfirmation;
    if (
      !nativeConfirmation ||
      nativeConfirmation.verificationId !== confirmation.verificationId
    ) {
      throw new Error("Phone verification expired. Request a new code and try again.");
    }

    await nativeConfirmation.confirm(trimmedCode);
    pendingNativePhoneConfirmation = null;
    const phoneUser = await resolvePhoneAuthUser();

    return hydrateProfileWithFallback({
      firebaseUser: { uid: phoneUser.uid } as FirebaseUser,
      displayName: phoneUser.displayName,
      email: phoneUser.email,
    });
  } catch (error) {
    throw mapFirebaseAuthError(error);
  }
};

export const confirmPhoneSignUp = async ({
  confirmation,
  code,
  displayName,
  gender,
}: {
  confirmation: PhoneAuthConfirmation;
  code: string;
  displayName?: string | null;
  gender?: string | null;
}): Promise<UserProfile> => {
  const trimmedCode = code.trim();
  if (!trimmedCode) {
    throw new Error("Verification code is required.");
  }
  try {
    pendingSignup = true;
    const nativeConfirmation = pendingNativePhoneConfirmation;
    if (
      !nativeConfirmation ||
      nativeConfirmation.verificationId !== confirmation.verificationId
    ) {
      throw new Error("Phone verification expired. Request a new code and try again.");
    }

    await nativeConfirmation.confirm(trimmedCode);
    pendingNativePhoneConfirmation = null;
    const phoneUser = await resolvePhoneAuthUser();
    const existingProfile = await getUserProfile(phoneUser.uid);
    if (existingProfile) {
      pendingSignup = false;
      await signOutPhoneSignupCollision();
      throw new Error(
        "This phone number is already being used by another account. Sign in instead."
      );
    }

    const stub: UserProfile = {
      uid: phoneUser.uid,
      createdAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
      displayName: displayName ?? null,
      email: phoneUser.email ?? null,
      faithTradition: null,
      shabbatIntentText: DEFAULT_SHABBAT_INTENTION,
      wantsMorningReminders: true,
      wantsShabbatReminders: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      platform: "ios",
      gender: gender ?? null,
      profileImageUrl: null,
      currentStreak: 0,
      longestStreak: 0,
      lastStreakWeekId: null,
      congregationId: null,
      congregationOnboardingCompleted: false,
      firstRunGuideCompleted: false,
      tefillinCurrentStreak: 0,
      tefillinLongestStreak: 0,
      lastTefillinDate: null,
      candleCurrentStreak: 0,
      candleLongestStreak: 0,
      lastCandleDate: null,
      wakeUpTime: null,
      bedTime: null,
      shabbatBlockLevel: "none",
      wantsModehAniReminder: false,
      wantsShemaReminder: false,
      wantsChatNotifications: true,
      intentVisibility: "private",
      streakVisibility: "public",
      friendCode: phoneUser.uid.slice(0, 8).toUpperCase(),
      friendRequestStatus: "request",
      friendUids: [],
      pendingFriendUids: [],
      latitude: null,
      longitude: null,
      tefillinBuddyUids: [],
      candleBuddyUids: [],
      buddyChatIds: [],
      fcmToken: null,
    };
    cachedUserProfile = stub;
    if (displayName || gender) {
      const profile = await getOrCreateUserProfileOnLogin({
        uid: phoneUser.uid,
        displayName: displayName ?? null,
        email: phoneUser.email ?? null,
      });
      const updated = await import("../firebase/firestore").then((m) =>
        m.updateUserProfile(profile.uid, {
          displayName: displayName ?? profile.displayName,
          gender: gender ?? profile.gender,
        })
      );
      cachedUserProfile = updated;
      pendingSignup = false;
      return updated;
    }
    pendingSignup = false;
    return stub;
  } catch (error) {
    pendingSignup = false;
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
  // Send with Firebase's default hosted verification page. Passing a custom
  // continue URL whose domain is not in the Firebase "Authorized domains" list
  // causes sendEmailVerification to fail with auth/unauthorized-continue-uri,
  // which silently stops the email from ever being delivered.
  try {
    await sendEmailVerification(user);
  } catch (error) {
    throw mapFirebaseAuthError(error);
  }
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

export const isAppleProvider = (): boolean => {
  const user = auth.currentUser;
  if (!user) {
    return false;
  }
  return user.providerData.some((p) => p.providerId === "apple.com");
};

export const getAuthUserDisplayName = (): string | null => {
  const name = auth.currentUser?.displayName?.trim();
  return name || null;
};

export const getAuthUserEmail = (): string | null => {
  const email = auth.currentUser?.email?.trim();
  return email || null;
};

const fallbackDisplayNameFromEmail = (email: string | null | undefined): string | null => {
  const localPart = email?.split("@")[0]?.trim();
  return localPart || null;
};

export const resolveProfileDisplayName = ({
  profileDisplayName,
  inputDisplayName,
  authDisplayName,
  email,
}: {
  profileDisplayName?: string | null;
  inputDisplayName?: string | null;
  authDisplayName?: string | null;
  email?: string | null;
}): string => {
  const candidates = [
    inputDisplayName?.trim(),
    profileDisplayName?.trim(),
    authDisplayName?.trim(),
    fallbackDisplayNameFromEmail(email),
  ];
  return candidates.find((value) => Boolean(value)) ?? "Friend";
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
  try {
    await nativeAuth().signOut();
  } catch {
    // Ignore native sign-out errors and still clear the web session.
  }
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
  const unsubscribeNative = nativeAuth().onAuthStateChanged(async (nativeUser) => {
    if (!nativeUser || auth.currentUser || pendingSignup) {
      return;
    }
    try {
      const profile = await withTimeout(
        getOrCreateUserProfileOnLogin({
          uid: nativeUser.uid,
          displayName: nativeUser.displayName,
          email: nativeUser.email,
        }),
        AUTH_STATE_TIMEOUT_MS,
        "Profile load timed out."
      );
      cachedUserProfile = profile;
      callback(profile);
    } catch {
      if (cachedUserProfile?.uid === nativeUser.uid) {
        callback(cachedUserProfile);
      }
    }
  });

  const unsubscribeWeb = onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      if (nativeAuth().currentUser) {
        return;
      }
      cachedUserProfile = null;
      callback(null);
      return;
    }

    // Validate the user still exists on the server (catches users
    // deleted from Firebase Console while the local token is cached).
    // Only force a sign-out for definitive account problems — a transient
    // network error must NOT lock the user out of a session they already have.
    if (!pendingSignup) {
      try {
        await withTimeout(
          firebaseUser.reload(),
          AUTH_STATE_TIMEOUT_MS,
          "Auth session check timed out."
        );
      } catch (reloadError) {
        const code =
          reloadError && typeof reloadError === "object" && "code" in reloadError
            ? String((reloadError as { code?: string }).code)
            : "";
        const fatalCodes = [
          "auth/user-token-expired",
          "auth/user-disabled",
          "auth/user-not-found",
          "auth/invalid-user-token",
          "auth/requires-recent-login",
        ];
        if (fatalCodes.includes(code)) {
          await firebaseSignOut(auth);
          cachedUserProfile = null;
          pendingSignup = false;
          callback(null);
          return;
        }
        // Transient/offline error: keep the existing session alive.
      }
    }

    const isUnverifiedEmail =
      !firebaseUser.emailVerified &&
      firebaseUser.providerData.some((p) => p.providerId === "password") &&
      !shouldBypassEmailVerification(firebaseUser.email);

    if (isUnverifiedEmail || pendingSignup) {
      const stub: UserProfile = cachedUserProfile ?? {
        uid: firebaseUser.uid,
        createdAt: Timestamp.now(),
        lastLoginAt: Timestamp.now(),
        displayName: firebaseUser.displayName ?? null,
        email: firebaseUser.email ?? null,
        faithTradition: null,
        shabbatIntentText: DEFAULT_SHABBAT_INTENTION,
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
        firstRunGuideCompleted: false,
        tefillinCurrentStreak: 0,
        tefillinLongestStreak: 0,
        lastTefillinDate: null,
        candleCurrentStreak: 0,
        candleLongestStreak: 0,
        lastCandleDate: null,
        wakeUpTime: null,
        bedTime: null,
        shabbatBlockLevel: "none",
        wantsModehAniReminder: false,
        wantsShemaReminder: false,
        wantsChatNotifications: true,
        intentVisibility: "private",
        streakVisibility: "public",
        friendCode: firebaseUser.uid.slice(0, 8).toUpperCase(),
        friendRequestStatus: "request",
        friendUids: [],
        pendingFriendUids: [],
        latitude: null,
        longitude: null,
        tefillinBuddyUids: [],
        candleBuddyUids: [],
        buddyChatIds: [],
        fcmToken: null,
      };
      cachedUserProfile = stub;
      callback(stub);
      return;
    }

    try {
      const profile = await withTimeout(
        hydrateProfileForFirebaseUser(firebaseUser),
        AUTH_STATE_TIMEOUT_MS,
        "Profile load timed out."
      );
      cachedUserProfile = profile;
      callback(profile);
    } catch {
      callback(cachedUserProfile);
    }
  });

  return () => {
    unsubscribeNative();
    unsubscribeWeb();
  };
};

export type { AuthError };
export { AuthErrorCode };
