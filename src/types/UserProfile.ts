import { Timestamp } from "firebase/firestore";

export interface UserProfile {
  uid: string;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;

  displayName: string | null;
  email: string | null;

  shabbatIntentText: string | null;
  wantsMorningReminders: boolean;

  timeZone: string;
  platform: "ios";

  currentStreak: number;
  longestStreak: number;

  congregationId: string | null;
}
