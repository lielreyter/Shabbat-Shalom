import {
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { firestore, storage } from "../firebase/firebaseConfig";
import {
  WeeklyVideo,
  WeeklyVideoType,
  WeeklyVideoVisibility,
} from "./weeklyVideoTypes";

export const WEEKLY_VIDEO_UPLOADER_EMAIL = "liel.reyter@gmail.com";

export const canUploadWeeklyVideo = (email: string | null | undefined): boolean =>
  email?.trim().toLowerCase() === WEEKLY_VIDEO_UPLOADER_EMAIL;

type UploadWeeklyVideoInput = {
  uploaderUid: string;
  uploaderEmail?: string | null;
  weekId: string;
  uri: string;
  fileName?: string | null;
  contentType?: string | null;
  durationSeconds?: number | null;
  visibility?: WeeklyVideoVisibility;
  type?: WeeklyVideoType;
};

const weeklyVideoDoc = (weekId: string) =>
  doc(firestore, "weeklyVideos", weekId);

const storagePathFor = (
  weekId: string,
  fileName?: string | null
): string => {
  const extension = fileName?.split(".").pop()?.toLowerCase() || "mp4";
  return `weeklyVideos/global/${weekId}/weekly-video.${extension}`;
};

const uriToBlob = (uri: string): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error("Failed to read video file"));
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });

const hydrateWeeklyVideo = (
  id: string,
  data: Record<string, unknown>
): WeeklyVideo => ({
  id,
  uploaderUid: (data.uploaderUid as string) ?? "",
  weekId: (data.weekId as string) ?? id,
  storagePath: (data.storagePath as string) ?? "",
  downloadUrl: (data.downloadUrl as string) ?? "",
  createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
  durationSeconds:
    typeof data.durationSeconds === "number" ? data.durationSeconds : null,
  fileName: typeof data.fileName === "string" ? data.fileName : null,
  contentType: typeof data.contentType === "string" ? data.contentType : null,
  visibility:
    data.visibility === "friends" || data.visibility === "congregation"
      ? data.visibility
      : "private",
  type:
    data.type === "shabbat" || data.type === "tefillin"
      ? data.type
      : "reflection",
});

export const getWeeklyVideo = async (
  weekId: string
): Promise<WeeklyVideo | null> => {
  const snapshot = await getDoc(weeklyVideoDoc(weekId));
  if (!snapshot.exists()) return null;
  return hydrateWeeklyVideo(snapshot.id, snapshot.data() as Record<string, unknown>);
};

export const uploadWeeklyVideo = async ({
  uploaderUid,
  uploaderEmail,
  weekId,
  uri,
  fileName,
  contentType,
  durationSeconds,
  visibility = "private",
  type = "reflection",
}: UploadWeeklyVideoInput): Promise<WeeklyVideo> => {
  if (!canUploadWeeklyVideo(uploaderEmail)) {
    throw new Error(`Only ${WEEKLY_VIDEO_UPLOADER_EMAIL} can upload weekly videos.`);
  }

  const existing = await getWeeklyVideo(weekId);
  if (existing?.storagePath) {
    await deleteObject(ref(storage, existing.storagePath)).catch(() => {});
  }

  const storagePath = storagePathFor(weekId, fileName);
  const storageRef = ref(storage, storagePath);
  const blob = await uriToBlob(uri);
  await uploadBytesResumable(storageRef, blob, {
    contentType: contentType ?? "video/mp4",
  });
  const downloadUrl = await getDownloadURL(storageRef);

  const payload = {
    uploaderUid,
    weekId,
    storagePath,
    downloadUrl,
    createdAt: serverTimestamp(),
    durationSeconds: durationSeconds ?? null,
    fileName: fileName ?? null,
    contentType: contentType ?? null,
    visibility,
    type,
  };

  await setDoc(weeklyVideoDoc(weekId), payload);
  const snapshot = await getDoc(weeklyVideoDoc(weekId));
  return hydrateWeeklyVideo(snapshot.id, snapshot.data() as Record<string, unknown>);
};

export const deleteWeeklyVideo = async (
  weekId: string
): Promise<void> => {
  const existing = await getWeeklyVideo(weekId);
  if (existing?.storagePath) {
    await deleteObject(ref(storage, existing.storagePath)).catch(() => {});
  }
  await deleteDoc(weeklyVideoDoc(weekId));
};
