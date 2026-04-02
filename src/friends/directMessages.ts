import {
  addDoc,
  collection,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  limit as firestoreLimit,
  type Unsubscribe,
} from "firebase/firestore";
import { firestore } from "../firebase/firebaseConfig";

export type DirectMessage = {
  id: string;
  senderUid: string;
  senderName: string;
  text: string;
  createdAt: Date;
};

const getChatId = (uid1: string, uid2: string): string => {
  return [uid1, uid2].sort().join("_");
};

const dmCollection = (chatId: string) =>
  collection(firestore, "directMessages", chatId, "messages");

export const sendDirectMessage = async (
  myUid: string,
  friendUid: string,
  senderName: string,
  text: string
): Promise<void> => {
  const trimmed = text.trim();
  if (!trimmed) return;

  const chatId = getChatId(myUid, friendUid);
  await addDoc(dmCollection(chatId), {
    senderUid: myUid,
    senderName,
    text: trimmed,
    createdAt: serverTimestamp(),
  });
};

export const subscribeToDirectMessages = (
  myUid: string,
  friendUid: string,
  callback: (messages: DirectMessage[]) => void,
  messageLimit = 50
): Unsubscribe => {
  const chatId = getChatId(myUid, friendUid);
  const q = query(
    dmCollection(chatId),
    orderBy("createdAt", "desc"),
    firestoreLimit(messageLimit)
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs
      .map((d) => {
        const data = d.data();
        const ts = data.createdAt;
        return {
          id: d.id,
          senderUid: data.senderUid ?? "",
          senderName: data.senderName ?? "Unknown",
          text: data.text ?? "",
          createdAt: ts instanceof Timestamp ? ts.toDate() : new Date(),
        };
      })
      .reverse();
    callback(messages);
  });
};
