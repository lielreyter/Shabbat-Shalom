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
}
