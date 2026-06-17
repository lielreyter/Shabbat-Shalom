import { Timestamp } from "firebase/firestore";

export type FaithTradition = "jewish" | "christian";

export interface UserProfile {
  uid: string;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;

  displayName: string | null;
  email: string | null;
  faithTradition: FaithTradition | null;

  shabbatIntentText: string | null;
  wantsMorningReminders: boolean;
  wantsShabbatReminders: boolean;

  timeZone: string;
  platform: "ios";
  gender: string | null;
  profileImageUrl: string | null;

  currentStreak: number;
  longestStreak: number;
  lastStreakWeekId: string | null;

  congregationId: string | null;
  congregationOnboardingCompleted: boolean;
  firstRunGuideCompleted: boolean;

  tefillinCurrentStreak: number;
  tefillinLongestStreak: number;
  lastTefillinDate: string | null;
  candleCurrentStreak: number;
  candleLongestStreak: number;
  lastCandleDate: string | null;

  wakeUpTime: string | null;
  bedTime: string | null;

  shabbatBlockLevel: "full" | "medium" | "custom" | "none";

  wantsModehAniReminder: boolean;
  wantsShemaReminder: boolean;
  wantsChatNotifications: boolean;

  intentVisibility: "public" | "friends" | "private";

  friendCode: string;
  friendRequestStatus: "open" | "request" | "closed";
  friendUids: string[];
  pendingFriendUids: string[];

  latitude: number | null;
  longitude: number | null;

  streakVisibility: "public" | "friends" | "private";

  tefillinBuddyUids: string[];
  candleBuddyUids: string[];
  buddyChatIds: string[];

  fcmToken: string | null;
}
