import { Timestamp } from "firebase/firestore";

export interface UserProfile {
  uid: string;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;

  displayName: string | null;
  email: string | null;

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

  tefillinCurrentStreak: number;
  tefillinLongestStreak: number;
  lastTefillinDate: string | null;

  wakeUpTime: string | null;
  bedTime: string | null;

  shabbatBlockLevel: "full" | "medium" | "custom" | "none";

  wantsModehAniReminder: boolean;
  wantsShemaReminder: boolean;

  intentVisibility: "public" | "friends" | "private";

  friendCode: string;
  friendUids: string[];
  pendingFriendUids: string[];

  latitude: number | null;
  longitude: number | null;

  tefillinBuddyUids: string[];
  buddyChatIds: string[];
}
