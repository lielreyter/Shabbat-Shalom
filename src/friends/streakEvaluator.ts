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
import { getUserProfile } from "../firebase/firestore";
import { getUserBuddyChats } from "./buddyChatService";
import { BuddyChat } from "./buddyChatTypes";
import { UserProfile } from "../types/UserProfile";

const messagesCol = (chatId: string) =>
  collection(firestore, "buddyChats", chatId, "messages");

const MAX_STREAK_LOOKBACK_DAYS = 370;

/**
 * Returns "YYYY-MM-DD" for a date in the given IANA timezone.
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

const todayInTz = (tz: string): string => dateInTz(new Date(), tz);

const addDays = (dateStr: string, days: number): string => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const isSaturdayDate = (dateStr: string): boolean =>
  new Date(`${dateStr}T12:00:00Z`).getUTCDay() === 6;

const isFridayDate = (dateStr: string): boolean =>
  new Date(`${dateStr}T12:00:00Z`).getUTCDay() === 5;

const maxDateStr = (a: string, b: string): string => (a > b ? a : b);

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

const isRequiredStreakDate = (
  kind: BuddyChat["kind"],
  dateStr: string,
  memberProfiles: UserProfile[]
): boolean => {
  if (kind === "candles") {
    return isFridayDate(dateStr);
  }

  if (isSaturdayDate(dateStr)) {
    return !memberProfiles.every((member) => member.faithTradition !== "christian");
  }

  return true;
};

/**
 * Groups camera-photo senders by the sender's own local date. The `fromCamera`
 * flag is authoritative for new messages; legacy tefillin images are counted
 * because older GPS/sun-window bugs incorrectly wrote `isStreakEligible: false`.
 */
const getEligibleSendersByDate = async (
  chat: BuddyChat,
  memberProfiles: UserProfile[]
): Promise<Map<string, Set<string>>> => {
  const tzByUid = new Map(
    memberProfiles.map((profile) => [profile.uid, profile.timeZone || "UTC"])
  );

  const q = query(messagesCol(chat.id), where("type", "==", "image"));
  const snapshot = await getDocs(q);
  const byDate = new Map<string, Set<string>>();

  for (const messageDoc of snapshot.docs) {
    const data = messageDoc.data();
    if (data.fromCamera === false) continue;
    if (chat.kind === "candles" && data.isStreakEligible !== true) continue;

    const senderUid = typeof data.senderUid === "string" ? data.senderUid : null;
    if (!senderUid || !tzByUid.has(senderUid)) continue;
    const createdAt = data.createdAt as Timestamp | undefined;
    if (!createdAt) continue;

    const memberTz = tzByUid.get(senderUid)!;
    const localDate = dateInTz(createdAt.toDate(), memberTz);
    const senders = byDate.get(localDate) ?? new Set<string>();
    senders.add(senderUid);
    byDate.set(localDate, senders);
  }

  return byDate;
};

export const evaluateChatStreak = async (
  chat: BuddyChat,
  memberProfiles: UserProfile[]
): Promise<BuddyChat> => {
  if (memberProfiles.length === 0) return chat;

  const latestTz = getLatestMidnightTz(memberProfiles);
  const todayLatest = todayInTz(latestTz);
  const lookbackStart = addDays(todayLatest, -MAX_STREAK_LOOKBACK_DAYS + 1);
  let evalDate = maxDateStr(dateInTz(chat.createdAt.toDate(), latestTz), lookbackStart);
  let streakCount = 0;
  let longestStreak = chat.longestStreak;
  let lastStreakDate: string | null = null;
  let streakBrokenAt: string | null = null;
  const sendersByDate = await getEligibleSendersByDate(chat, memberProfiles);
  let iterations = 0;

  while (evalDate <= todayLatest && iterations < MAX_STREAK_LOOKBACK_DAYS) {
    iterations++;

    if (!isRequiredStreakDate(chat.kind, evalDate, memberProfiles)) {
      lastStreakDate = evalDate;
      evalDate = addDays(evalDate, 1);
      continue;
    }

    const senders = sendersByDate.get(evalDate) ?? new Set<string>();
    const allSent = memberProfiles.every((member) => senders.has(member.uid));

    if (allSent) {
      streakCount += 1;
      longestStreak = Math.max(longestStreak, streakCount);
      lastStreakDate = evalDate;
    } else {
      streakCount = 0;
      streakBrokenAt = evalDate;
      lastStreakDate = evalDate;
    }

    evalDate = addDays(evalDate, 1);
  }

  const changed =
    streakCount !== chat.streakCount ||
    longestStreak !== chat.longestStreak ||
    lastStreakDate !== chat.lastStreakDate ||
    streakBrokenAt !== chat.streakBrokenAt;

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

  for (const chat of chats) {
    const members = chat.memberUids
      .map((mUid) => profileMap.get(mUid))
      .filter((p): p is UserProfile => p !== undefined);

    await evaluateChatStreak(chat, members);
  }
};
