import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { firestore } from "./firebaseConfig";
import { UserProfile } from "../types/UserProfile";

type UserProfileWrite = Omit<UserProfile, "createdAt" | "lastLoginAt"> & {
  createdAt: ReturnType<typeof serverTimestamp>;
  lastLoginAt: ReturnType<typeof serverTimestamp>;
};

const getTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const userDocRef = (uid: string) => doc(firestore, "users", uid);

const ensureTimestamp = (value: unknown): Timestamp => {
  // Server timestamps can be null immediately after writes; fall back safely.
  return value instanceof Timestamp ? value : Timestamp.now();
};

const hydrateUserProfile = (uid: string, data: Partial<UserProfile>): UserProfile => {
  return {
    uid,
    createdAt: ensureTimestamp(data.createdAt),
    lastLoginAt: ensureTimestamp(data.lastLoginAt),
    displayName: data.displayName ?? null,
    email: data.email ?? null,
    shabbatIntentText: data.shabbatIntentText ?? null,
    wantsMorningReminders: data.wantsMorningReminders ?? true,
    timeZone: data.timeZone ?? getTimeZone(),
    platform: "ios",
    currentStreak: data.currentStreak ?? 0,
    longestStreak: data.longestStreak ?? 0,
    congregationId: data.congregationId ?? null,
  };
};

export const getUserProfile = async (
  uid: string
): Promise<UserProfile | null> => {
  const snapshot = await getDoc(userDocRef(uid));
  if (!snapshot.exists()) {
    return null;
  }
  return hydrateUserProfile(uid, snapshot.data() as UserProfile);
};

export const createUserProfile = async ({
  uid,
  displayName,
  email,
}: {
  uid: string;
  displayName: string | null;
  email: string | null;
}): Promise<UserProfile> => {
  const payload: UserProfileWrite = {
    uid,
    // Use serverTimestamp to keep time authoritative and consistent.
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    displayName,
    email,
    shabbatIntentText: null,
    wantsMorningReminders: true,
    timeZone: getTimeZone(),
    platform: "ios",
    currentStreak: 0,
    longestStreak: 0,
    congregationId: null,
  };

  await setDoc(userDocRef(uid), payload);
  const snapshot = await getDoc(userDocRef(uid));
  return hydrateUserProfile(uid, snapshot.data() as UserProfile);
};

export const updateUserProfile = async (
  uid: string,
  updates: Partial<UserProfile>
): Promise<UserProfile> => {
  await updateDoc(userDocRef(uid), updates as Record<string, unknown>);
  const snapshot = await getDoc(userDocRef(uid));
  return hydrateUserProfile(uid, snapshot.data() as UserProfile);
};

export const getOrCreateUserProfileOnLogin = async ({
  uid,
  displayName,
  email,
}: {
  uid: string;
  displayName: string | null;
  email: string | null;
}): Promise<UserProfile> => {
  const existing = await getUserProfile(uid);
  if (!existing) {
    return createUserProfile({ uid, displayName, email });
  }

  const updates: Record<string, unknown> = {
    lastLoginAt: serverTimestamp(),
  };

  if (!existing.displayName && displayName) {
    updates.displayName = displayName;
  }
  if (!existing.email && email) {
    updates.email = email;
  }
  if (!existing.timeZone) {
    updates.timeZone = getTimeZone();
  }
  if (!existing.platform) {
    updates.platform = "ios";
  }

  await updateDoc(userDocRef(uid), updates);
  const snapshot = await getDoc(userDocRef(uid));
  return hydrateUserProfile(uid, snapshot.data() as UserProfile);
};
