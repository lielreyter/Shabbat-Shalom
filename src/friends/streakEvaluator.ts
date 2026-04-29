import {
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { firestore } from "../firebase/firebaseConfig";
import { getUserProfile, updateUserProfile } from "../firebase/firestore";
import { getUserBuddyChats } from "./buddyChatService";
import { BuddyChat } from "./buddyChatTypes";
import { UserProfile } from "../types/UserProfile";

const messagesCol = (chatId: string) =>
  collection(firestore, "buddyChats", chatId, "messages");

/**
 * Returns "YYYY-MM-DD" for "today" in the given IANA timezone.
 */
const dateInTz = (date: Date, tz: string): string => {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const y = parts.find((p) => p.type === "year")!.value;
    const m = parts.find((p) => p.type === "month")!.value;
    const d = parts.find((p) => p.type === "day")!.value;
    return `${y}-${m}-${d}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
};

/**
 * Returns the current "YYYY-MM-DD" in the given timezone.
 */
const todayInTz = (tz: string): string => dateInTz(new Date(), tz);

/**
 * Adds `days` to a "YYYY-MM-DD" string and returns the new "YYYY-MM-DD".
 */
const addDays = (dateStr: string, days: number): string => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const isSaturdayDate = (dateStr: string): boolean => {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay() === 6;
};

/**
 * Returns the start-of-day and end-of-day as JS Dates for a given
 * "YYYY-MM-DD" in the given IANA timezone.
 */
const dayBoundsInTz = (
  dateStr: string,
  tz: string
): { start: Date; end: Date } => {
  const startLocal = new Date(`${dateStr}T00:00:00`);
  const endLocal = new Date(`${dateStr}T23:59:59.999`);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset",
  });

  const extractOffsetMs = (d: Date): number => {
    const formatted = formatter.format(d);
    const match = formatted.match(/GMT([+-]\d{2}):?(\d{2})?/);
    if (!match) return 0;
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2] || "0", 10);
    return (hours * 60 + (hours < 0 ? -minutes : minutes)) * 60 * 1000;
  };

  const offsetMs = extractOffsetMs(startLocal);
  const start = new Date(startLocal.getTime() - offsetMs);
  const end = new Date(endLocal.getTime() - offsetMs);
  return { start, end };
};

/**
 * Checks whether a given member sent at least one streak-eligible image
 * on their calendar date (midnight-to-midnight in their timezone).
 */
const memberSentOnDate = async (
  chatId: string,
  memberUid: string,
  dateStr: string,
  memberTz: string
): Promise<boolean> => {
  const { start, end } = dayBoundsInTz(dateStr, memberTz);

  const q = query(
    messagesCol(chatId),
    where("type", "==", "image"),
    where("isStreakEligible", "==", true),
    where("senderUid", "==", memberUid),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<=", Timestamp.fromDate(end))
  );

  const snapshot = await getDocs(q);
  return !snapshot.empty;
};

/**
 * Returns the latest timezone (furthest west / latest midnight) among members.
 * Used to determine when a calendar date is "complete" for all members.
 */
const getLatestMidnightTz = (profiles: UserProfile[]): string => {
  let latestTz = "UTC";
  let latestOffset = -Infinity;

  for (const p of profiles) {
    const tz = p.timeZone || "UTC";
    try {
      const formatted = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "longOffset",
      }).format(new Date());
      const match = formatted.match(/GMT([+-]\d{2}):?(\d{2})?/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2] || "0", 10);
        const totalMinutes = hours * 60 + (hours < 0 ? -minutes : minutes);
        // More negative offset = further west = later midnight
        if (-totalMinutes > latestOffset) {
          latestOffset = -totalMinutes;
          latestTz = tz;
        }
      }
    } catch {
      // skip invalid tz
    }
  }

  return latestTz;
};

/**
 * Checks if a given date has "completed" — i.e., midnight has passed in
 * the latest (furthest west) timezone among all members.
 */
const isDateComplete = (dateStr: string, latestTz: string): boolean => {
  const todayLatest = todayInTz(latestTz);
  return dateStr < todayLatest;
};

/**
 * Determine the first date to evaluate for a chat.
 * If lastStreakDate exists, start from the day after.
 * Otherwise, start from the chat's creation date.
 */
const getFirstEvalDate = (chat: BuddyChat): string => {
  if (chat.lastStreakDate) {
    return addDays(chat.lastStreakDate, 1);
  }

  const created = chat.createdAt.toDate();
  return created.toISOString().slice(0, 10);
};

/**
 * Evaluate a single buddy chat's streak by checking each pending date
 * sequentially. A single missed date breaks the streak.
 */
export const evaluateChatStreak = async (
  chat: BuddyChat,
  memberProfiles: UserProfile[]
): Promise<BuddyChat> => {
  if (memberProfiles.length === 0) return chat;

  const latestTz = getLatestMidnightTz(memberProfiles);
  let evalDate = getFirstEvalDate(chat);
  let { streakCount, longestStreak, lastStreakDate, streakBrokenAt } = chat;
  let changed = false;

  const maxIterations = 60;
  let iterations = 0;

  while (isDateComplete(evalDate, latestTz) && iterations < maxIterations) {
    iterations++;

    if (isSaturdayDate(evalDate)) {
      lastStreakDate = evalDate;
      changed = true;
      evalDate = addDays(evalDate, 1);
      continue;
    }

    let allSent = true;
    for (const member of memberProfiles) {
      const memberTz = member.timeZone || "UTC";
      const sent = await memberSentOnDate(
        chat.id,
        member.uid,
        evalDate,
        memberTz
      );
      if (!sent) {
        allSent = false;
        break;
      }
    }

    if (allSent) {
      streakCount += 1;
      longestStreak = Math.max(longestStreak, streakCount);
      lastStreakDate = evalDate;
      changed = true;
    } else {
      if (streakCount > 0 || lastStreakDate !== null) {
        streakCount = 0;
        streakBrokenAt = evalDate;
        lastStreakDate = evalDate;
        changed = true;
      }
      break;
    }

    evalDate = addDays(evalDate, 1);
  }

  if (changed) {
    const chatRef = doc(firestore, "buddyChats", chat.id);
    await updateDoc(chatRef, {
      streakCount,
      longestStreak,
      lastStreakDate,
      streakBrokenAt,
    });
  }

  return {
    ...chat,
    streakCount,
    longestStreak,
    lastStreakDate,
    streakBrokenAt,
  };
};

/**
 * Evaluate all buddy chat streaks for a user, then persist the highest
 * streak as the user's tefillin streak.
 */
export const evaluateAllStreaks = async (uid: string): Promise<void> => {
  const chats = await getUserBuddyChats(uid);
  if (chats.length === 0) return;

  const memberUidSet = new Set<string>();
  for (const chat of chats) {
    for (const mUid of chat.memberUids) {
      memberUidSet.add(mUid);
    }
  }

  const profileMap = new Map<string, UserProfile>();
  for (const mUid of memberUidSet) {
    const profile = await getUserProfile(mUid);
    if (profile) profileMap.set(mUid, profile);
  }

  const evaluatedChats: BuddyChat[] = [];
  for (const chat of chats) {
    const members = chat.memberUids
      .map((mUid) => profileMap.get(mUid))
      .filter((p): p is UserProfile => p !== undefined);

    const evaluated = await evaluateChatStreak(chat, members);
    evaluatedChats.push(evaluated);
  }

  const maxStreak = Math.max(0, ...evaluatedChats.map((c) => c.streakCount));
  const maxLongest = Math.max(
    0,
    ...evaluatedChats.map((c) => c.longestStreak)
  );

  const userProfile = profileMap.get(uid);
  if (!userProfile) return;

  const updates: Partial<UserProfile> = {};

  if (userProfile.tefillinCurrentStreak !== maxStreak) {
    updates.tefillinCurrentStreak = maxStreak;
  }

  const newLongest = Math.max(userProfile.tefillinLongestStreak, maxLongest);
  if (userProfile.tefillinLongestStreak !== newLongest) {
    updates.tefillinLongestStreak = newLongest;
  }

  if (Object.keys(updates).length > 0) {
    await updateUserProfile(uid, updates);
  }
};
