import { Timestamp } from "firebase/firestore";

export type WeeklyVideoVisibility = "private" | "friends" | "congregation";
export type WeeklyVideoType = "shabbat" | "tefillin" | "reflection";

export interface WeeklyVideo {
  id: string;
  uploaderUid: string;
  weekId: string;
  storagePath: string;
  downloadUrl: string;
  createdAt: Timestamp;
  durationSeconds: number | null;
  fileName: string | null;
  contentType: string | null;
  visibility: WeeklyVideoVisibility;
  type: WeeklyVideoType;
}
