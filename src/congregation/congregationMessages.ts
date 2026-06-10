import {
  addDoc,
  collection,
  getDocs,
  limit as firestoreLimit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { firestore } from "../firebase/firebaseConfig";

export type CongregationMessage = {
  id: string;
  senderUid: string;
  senderName: string;
  text: string;
  createdAt: Date;
};

const messagesCollection = (congregationId: string) =>
  collection(firestore, "congregations", congregationId, "messages");

export const sendCongregationMessage = async (
  congregationId: string,
  senderUid: string,
  senderName: string,
  text: string
): Promise<void> => {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }

  await addDoc(messagesCollection(congregationId), {
    senderUid,
    senderName,
    text: trimmed,
    createdAt: serverTimestamp(),
  });
};

export const getCongregationMessages = async (
  congregationId: string,
  messageLimit = 50
): Promise<CongregationMessage[]> => {
  const q = query(
    messagesCollection(congregationId),
    orderBy("createdAt", "desc"),
    firestoreLimit(messageLimit)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs
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
};

export const subscribeToCongregationMessages = (
  congregationId: string,
  callback: (messages: CongregationMessage[]) => void,
  messageLimit = 50
): Unsubscribe => {
  const q = query(
    messagesCollection(congregationId),
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

export const subscribeToLatestCongregationMessage = (
  congregationId: string,
  callback: (message: CongregationMessage | null) => void
): Unsubscribe => {
  const q = query(
    messagesCollection(congregationId),
    orderBy("createdAt", "desc"),
    firestoreLimit(1)
  );

  return onSnapshot(q, (snapshot) => {
    const doc = snapshot.docs[0];
    if (!doc) {
      callback(null);
      return;
    }

    const data = doc.data();
    const ts = data.createdAt;
    callback({
      id: doc.id,
      senderUid: data.senderUid ?? "",
      senderName: data.senderName ?? "Unknown",
      text: data.text ?? "",
      createdAt: ts instanceof Timestamp ? ts.toDate() : new Date(),
    });
  });
};
