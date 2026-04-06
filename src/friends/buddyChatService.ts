import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  arrayUnion,
  arrayRemove,
  limit as firestoreLimit,
  type Unsubscribe,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { firestore, storage } from "../firebase/firebaseConfig";
import { BuddyChat, BuddyMessage } from "./buddyChatTypes";
import { isWithinSunWindow } from "./zmanimService";

const chatsCol = collection(firestore, "buddyChats");
const chatDoc = (chatId: string) => doc(firestore, "buddyChats", chatId);
const messagesCol = (chatId: string) =>
  collection(firestore, "buddyChats", chatId, "messages");
const userDoc = (uid: string) => doc(firestore, "users", uid);

const hydrateBuddyChat = (id: string, data: Record<string, unknown>): BuddyChat => ({
  id,
  type: (data.type as "pair" | "group") ?? "pair",
  name: (data.name as string) ?? null,
  memberUids: Array.isArray(data.memberUids) ? data.memberUids : [],
  createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
  streakCount: typeof data.streakCount === "number" ? data.streakCount : 0,
  longestStreak: typeof data.longestStreak === "number" ? data.longestStreak : 0,
  lastStreakDate: typeof data.lastStreakDate === "string" ? data.lastStreakDate : null,
  streakBrokenAt: typeof data.streakBrokenAt === "string" ? data.streakBrokenAt : null,
});

const hydrateBuddyMessage = (id: string, data: Record<string, unknown>): BuddyMessage => ({
  id,
  senderUid: (data.senderUid as string) ?? "",
  senderName: (data.senderName as string) ?? "Unknown",
  type: (data.type as "text" | "image") ?? "text",
  text: (data.text as string) ?? null,
  imageUrl: (data.imageUrl as string) ?? null,
  createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
  opened: data.opened === true,
  isStreakEligible: data.isStreakEligible === true,
});

export const createBuddyChat = async (
  memberUids: string[],
  type: "pair" | "group",
  name?: string
): Promise<BuddyChat> => {
  const payload = {
    type,
    name: name ?? null,
    memberUids,
    createdAt: serverTimestamp(),
    streakCount: 0,
    longestStreak: 0,
    lastStreakDate: null,
    streakBrokenAt: null,
  };

  const docRef = await addDoc(chatsCol, payload);

  for (const uid of memberUids) {
    await updateDoc(userDoc(uid), {
      buddyChatIds: arrayUnion(docRef.id),
    });
  }

  const snap = await getDoc(docRef);
  return hydrateBuddyChat(snap.id, snap.data() as Record<string, unknown>);
};

export const getBuddyChat = async (chatId: string): Promise<BuddyChat | null> => {
  const snap = await getDoc(chatDoc(chatId));
  if (!snap.exists()) return null;
  return hydrateBuddyChat(snap.id, snap.data() as Record<string, unknown>);
};

export const getUserBuddyChats = async (uid: string): Promise<BuddyChat[]> => {
  const q = query(chatsCol, where("memberUids", "array-contains", uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) =>
    hydrateBuddyChat(d.id, d.data() as Record<string, unknown>)
  );
};

export const deleteBuddyChat = async (chatId: string): Promise<void> => {
  const chat = await getBuddyChat(chatId);
  if (!chat) return;

  // Remove chatId from each member's buddyChatIds
  for (const uid of chat.memberUids) {
    await updateDoc(userDoc(uid), {
      buddyChatIds: arrayRemove(chatId),
    });
  }

  // Delete all messages in the subcollection
  const msgSnap = await getDocs(messagesCol(chatId));
  for (const msgDoc of msgSnap.docs) {
    await deleteDoc(msgDoc.ref);
  }

  await deleteDoc(chatDoc(chatId));
};

export const findPairChat = async (
  uid1: string,
  uid2: string
): Promise<BuddyChat | null> => {
  const q = query(
    chatsCol,
    where("type", "==", "pair"),
    where("memberUids", "array-contains", uid1)
  );
  const snapshot = await getDocs(q);
  for (const d of snapshot.docs) {
    const data = d.data() as Record<string, unknown>;
    const members = Array.isArray(data.memberUids) ? data.memberUids : [];
    if (members.includes(uid2)) {
      return hydrateBuddyChat(d.id, data);
    }
  }
  return null;
};

export const sendBuddyMessage = async (
  chatId: string,
  senderUid: string,
  senderName: string,
  type: "text" | "image",
  content: string,
  senderLat?: number | null,
  senderLon?: number | null,
  senderTzid?: string,
  fromCamera?: boolean
): Promise<BuddyMessage> => {
  let streakEligible = false;

  if (type === "image" && fromCamera) {
    if (
      senderLat != null &&
      senderLon != null &&
      senderTzid
    ) {
      const inSunWindow = await isWithinSunWindow(senderLat, senderLon, senderTzid)
        .catch(() => false);
      if (!inSunWindow) {
        throw new Error(
          "The sun is not visible — tefillin photos can only be sent between sunrise and sunset"
        );
      }
      streakEligible = true;
    }
  }

  const payload: Record<string, unknown> = {
    senderUid,
    senderName,
    type,
    text: type === "text" ? content : null,
    imageUrl: type === "image" ? content : null,
    createdAt: serverTimestamp(),
    opened: false,
    isStreakEligible: streakEligible,
  };

  const docRef = await addDoc(messagesCol(chatId), payload);
  const snap = await getDoc(docRef);
  return hydrateBuddyMessage(snap.id, snap.data() as Record<string, unknown>);
};

export const markMessageOpened = async (
  chatId: string,
  messageId: string
): Promise<void> => {
  await updateDoc(doc(firestore, "buddyChats", chatId, "messages", messageId), {
    opened: true,
  });
};

export const subscribeToBuddyMessages = (
  chatId: string,
  callback: (messages: BuddyMessage[]) => void,
  messageLimit = 50
): Unsubscribe => {
  const q = query(
    messagesCol(chatId),
    orderBy("createdAt", "desc"),
    firestoreLimit(messageLimit)
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs
      .map((d) =>
        hydrateBuddyMessage(d.id, d.data() as Record<string, unknown>)
      )
      .reverse();
    callback(messages);
  });
};

const uriToBlob = (uri: string): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error("Failed to read image file"));
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });

export const uploadBuddyImage = async (
  chatId: string,
  senderUid: string,
  imageUri: string
): Promise<string> => {
  const filename = `${senderUid}_${Date.now()}.jpg`;
  const storageRef = ref(storage, `buddyChats/${chatId}/${filename}`);

  const blob = await uriToBlob(imageUri);
  await uploadBytesResumable(storageRef, blob, { contentType: "image/jpeg" });

  return getDownloadURL(storageRef);
};

export const getStreakEligibleSendersForDate = async (
  chatId: string,
  date: string
): Promise<Set<string>> => {
  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  const endOfDay = new Date(`${date}T23:59:59.999Z`);

  const q = query(
    messagesCol(chatId),
    where("type", "==", "image"),
    where("isStreakEligible", "==", true),
    where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
    where("createdAt", "<=", Timestamp.fromDate(endOfDay))
  );

  const snapshot = await getDocs(q);
  const senders = new Set<string>();
  snapshot.docs.forEach((d) => {
    const data = d.data();
    if (data.senderUid) senders.add(data.senderUid as string);
  });
  return senders;
};
