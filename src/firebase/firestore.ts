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

const normalizeWeekId = (weekId: string): string => weekId.trim();

const ensureTimestamp = (value: unknown): Timestamp => {
  return value instanceof Timestamp ? value : Timestamp.now();
};

export const hydrateUserProfile = (uid: string, data: Partial<UserProfile>): UserProfile => {
  return {
    uid,
    createdAt: ensureTimestamp(data.createdAt),
    lastLoginAt: ensureTimestamp(data.lastLoginAt),
    displayName: data.displayName ?? null,
    email: data.email ?? null,
    shabbatIntentText: data.shabbatIntentText ?? null,
    wantsMorningReminders: data.wantsMorningReminders ?? true,
    wantsShabbatReminders: data.wantsShabbatReminders ?? true,
    timeZone: data.timeZone ?? getTimeZone(),
    platform: "ios",
    gender: data.gender ?? null,
    profileImageUrl: data.profileImageUrl ?? null,
    currentStreak: data.currentStreak ?? 0,
    longestStreak: data.longestStreak ?? 0,
    lastStreakWeekId: data.lastStreakWeekId ?? null,
    congregationId: data.congregationId ?? null,
    congregationOnboardingCompleted: data.congregationOnboardingCompleted ?? false,
    tefillinCurrentStreak: data.tefillinCurrentStreak ?? 0,
    tefillinLongestStreak: data.tefillinLongestStreak ?? 0,
    lastTefillinDate: data.lastTefillinDate ?? null,
    wakeUpTime: data.wakeUpTime ?? null,
    bedTime: data.bedTime ?? null,
    shabbatBlockLevel: data.shabbatBlockLevel ?? "none",
    wantsModehAniReminder: data.wantsModehAniReminder ?? false,
    wantsShemaReminder: data.wantsShemaReminder ?? false,
    intentVisibility: data.intentVisibility ?? "private",
    friendUids: Array.isArray(data.friendUids) ? data.friendUids : [],
    pendingFriendUids: Array.isArray(data.pendingFriendUids) ? data.pendingFriendUids : [],
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
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    displayName,
    email,
    shabbatIntentText: null,
    wantsMorningReminders: true,
    wantsShabbatReminders: true,
    timeZone: getTimeZone(),
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
    intentVisibility: "private",
    friendUids: [],
    pendingFriendUids: [],
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
  if (typeof existing.wantsShabbatReminders !== "boolean") {
    updates.wantsShabbatReminders = true;
  }

  await updateDoc(userDocRef(uid), updates);
  const snapshot = await getDoc(userDocRef(uid));
  return hydrateUserProfile(uid, snapshot.data() as UserProfile);
};

export const setUserCongregation = async (
  uid: string,
  congregationId: string | null
): Promise<UserProfile> => {
  const updates: Partial<UserProfile> = {
    congregationId,
    congregationOnboardingCompleted: true,
  };
  return updateUserProfile(uid, updates);
};

export const completeCongregationOnboarding = async (
  uid: string
): Promise<UserProfile> => {
  return updateUserProfile(uid, { congregationOnboardingCompleted: true });
};

export const recordKeptShabbatWeek = async (
  uid: string,
  weekId: string
): Promise<UserProfile> => {
  const existing = await getUserProfile(uid);
  if (!existing) {
    throw new Error("User profile not found.");
  }

  const normalizedWeekId = normalizeWeekId(weekId);
  if (!normalizedWeekId) {
    throw new Error("Invalid week id.");
  }

  if (existing.lastStreakWeekId === normalizedWeekId) {
    return existing;
  }

  const nextStreak = existing.currentStreak + 1;
  const nextLongest = Math.max(existing.longestStreak, nextStreak);
  return updateUserProfile(uid, {
    currentStreak: nextStreak,
    longestStreak: nextLongest,
    lastStreakWeekId: normalizedWeekId,
  });
};

export const recordBrokenShabbatWeek = async (
  uid: string,
  weekId: string
): Promise<UserProfile> => {
  const existing = await getUserProfile(uid);
  if (!existing) {
    throw new Error("User profile not found.");
  }

  const normalizedWeekId = normalizeWeekId(weekId);
  if (!normalizedWeekId) {
    throw new Error("Invalid week id.");
  }

  if (existing.lastStreakWeekId === normalizedWeekId && existing.currentStreak === 0) {
    return existing;
  }

  return updateUserProfile(uid, {
    currentStreak: 0,
    lastStreakWeekId: normalizedWeekId,
  });
};
