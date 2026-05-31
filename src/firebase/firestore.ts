import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
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
const DEFAULT_SHABBAT_INTENTION = "To connect with Hashem";

const normalizeWeekId = (weekId: string): string => weekId.trim();

const addDaysToDateString = (dateStr: string, days: number): string => {
  const date = new Date(`${dateStr}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const isSaturdayDateString = (dateStr: string): boolean => {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay() === 6;
};

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
    shabbatIntentText: data.shabbatIntentText ?? DEFAULT_SHABBAT_INTENTION,
    wantsMorningReminders: data.wantsMorningReminders ?? false,
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
    wantsChatNotifications: data.wantsChatNotifications ?? true,
    intentVisibility: data.intentVisibility ?? "private",
    friendCode: data.friendCode ?? uid.slice(0, 8).toUpperCase(),
    friendRequestStatus: data.friendRequestStatus ?? "request",
    friendUids: Array.isArray(data.friendUids) ? data.friendUids : [],
    pendingFriendUids: Array.isArray(data.pendingFriendUids) ? data.pendingFriendUids : [],
    latitude: typeof data.latitude === "number" ? data.latitude : null,
    longitude: typeof data.longitude === "number" ? data.longitude : null,
    streakVisibility: data.streakVisibility ?? "public",
    tefillinBuddyUids: Array.isArray(data.tefillinBuddyUids) ? data.tefillinBuddyUids : [],
    buddyChatIds: Array.isArray(data.buddyChatIds) ? data.buddyChatIds : [],
    fcmToken: data.fcmToken ?? null,
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

export const deleteUserProfile = async (uid: string): Promise<void> => {
  await deleteDoc(userDocRef(uid));
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
  const friendCode = uid.slice(0, 8).toUpperCase();
  const payload: UserProfileWrite & { displayNameLower: string | null } = {
    uid,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    displayName,
    displayNameLower: displayName?.toLowerCase() ?? null,
    friendCode,
    email,
    shabbatIntentText: DEFAULT_SHABBAT_INTENTION,
    wantsMorningReminders: false,
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
    wantsChatNotifications: true,
    intentVisibility: "private",
    streakVisibility: "public",
    friendRequestStatus: "request",
    friendUids: [],
    pendingFriendUids: [],
    latitude: null,
    longitude: null,
    tefillinBuddyUids: [],
    buddyChatIds: [],
    fcmToken: null,
  };

  await setDoc(userDocRef(uid), payload);
  const snapshot = await getDoc(userDocRef(uid));
  return hydrateUserProfile(uid, snapshot.data() as UserProfile);
};

export const updateUserProfile = async (
  uid: string,
  updates: Partial<UserProfile>
): Promise<UserProfile> => {
  const payload: Record<string, unknown> = { ...updates };
  if (updates.displayName !== undefined) {
    payload.displayNameLower = updates.displayName?.toLowerCase() ?? null;
  }
  await updateDoc(userDocRef(uid), payload);
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
    friendCode: uid.slice(0, 8).toUpperCase(),
  };

  if (!existing.displayName && displayName) {
    updates.displayName = displayName;
    updates.displayNameLower = displayName.toLowerCase();
  }
  if (existing.displayName) {
    updates.displayNameLower = existing.displayName.toLowerCase();
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
  if (typeof existing.wantsChatNotifications !== "boolean") {
    updates.wantsChatNotifications = true;
  }
  if (!existing.friendRequestStatus) {
    updates.friendRequestStatus = "request";
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

export const checkAndBreakStaleStreaks = async (
  uid: string
): Promise<UserProfile | null> => {
  const profile = await getUserProfile(uid);
  if (!profile) return null;

  const updates: Partial<UserProfile> = {};
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (profile.tefillinCurrentStreak > 0) {
    if (!profile.lastTefillinDate) {
      updates.tefillinCurrentStreak = 0;
    } else if (profile.lastTefillinDate !== todayStr && profile.lastTefillinDate !== yesterdayStr) {
      const finalAutoDate = isSaturdayDateString(todayStr) ? todayStr : yesterdayStr;
      let cursor = addDaysToDateString(profile.lastTefillinDate, 1);
      let missedNonShabbatDay = false;

      while (cursor <= finalAutoDate) {
        if (!isSaturdayDateString(cursor)) {
          missedNonShabbatDay = true;
          break;
        }
        cursor = addDaysToDateString(cursor, 1);
      }

      if (missedNonShabbatDay) {
        updates.tefillinCurrentStreak = 0;
      }
    }
  }

  if (profile.currentStreak > 0 && profile.lastStreakWeekId) {
    const lastWeekDate = new Date(profile.lastStreakWeekId.replace("week-", ""));
    const daysSinceLastWeek = Math.floor(
      (now.getTime() - lastWeekDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastWeek > 14) {
      updates.currentStreak = 0;
    }
  }

  if (Object.keys(updates).length === 0) return profile;
  return updateUserProfile(uid, updates);
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

/* ── intent history (Firestore-persisted per user) ── */

const intentHistoryCol = (uid: string) =>
  collection(firestore, "users", uid, "intentHistory");

const intentHistoryDoc = (uid: string, weekDate: string) =>
  doc(firestore, "users", uid, "intentHistory", weekDate);

export const saveIntentEntry = async (
  uid: string,
  weekDate: string,
  text: string
): Promise<void> => {
  await setDoc(intentHistoryDoc(uid, weekDate), {
    text,
    savedAt: serverTimestamp(),
  });
};

export const getIntentHistory = async (
  uid: string
): Promise<Record<string, string>> => {
  const snapshot = await getDocs(intentHistoryCol(uid));
  const history: Record<string, string> = {};
  snapshot.docs.forEach((d) => {
    const data = d.data() as { text?: string };
    if (data.text) {
      history[d.id] = data.text;
    }
  });
  return history;
};
