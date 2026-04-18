import { Timestamp } from "firebase/firestore";

export interface BuddyChat {
  id: string;
  type: "pair" | "group";
  name: string | null;
  memberUids: string[];
  createdAt: Timestamp;
  lastActivityAt: Timestamp;
  streakCount: number;
  longestStreak: number;
  lastStreakDate: string | null;
  streakBrokenAt: string | null;
}

export interface BuddyMessage {
  id: string;
  senderUid: string;
  senderName: string;
  type: "text" | "image";
  text: string | null;
  imageUrl: string | null;
  createdAt: Timestamp;
  opened: boolean;
  isStreakEligible: boolean;
  savedByUids: string[];
}
