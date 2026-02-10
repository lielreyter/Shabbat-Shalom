import {
  OAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signOut as firebaseSignOut,
  Unsubscribe,
  User as FirebaseUser,
} from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import {
  signInWithApple as signInWithAppleAuth,
  AuthErrorCode,
  AuthError,
} from "./appleAuth";
import { UserProfile } from "../types/UserProfile";
import { getOrCreateUserProfileOnLogin } from "../firebase/firestore";
import { DEV_MODE } from "../config/devMode";

let cachedUserProfile: UserProfile | null = null;

const mapFirebaseAuthError = (error: unknown): AuthError => {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: string }).code);
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

    const displayName =
      appleResult.fullName ?? result.user.displayName ?? null;
    const email = appleResult.email ?? result.user.email ?? null;

    const profile = await getOrCreateUserProfileOnLogin({
      uid: result.user.uid,
      displayName,
      email,
    });

    cachedUserProfile = profile;
    return profile;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const typed = error as AuthError;
      if (Object.values(AuthErrorCode).includes(typed.code)) {
        throw typed;
      }
    }
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

export { AuthError, AuthErrorCode };
