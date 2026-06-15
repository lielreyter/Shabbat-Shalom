import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { firestore } from "../firebase/firebaseConfig";
import { hydrateUserProfile } from "../firebase/firestore";
import { UserProfile } from "../types/UserProfile";
import { createBuddyChat, findPairChat, deleteBuddyChat } from "./buddyChatService";

const userRef = (uid: string) => doc(firestore, "users", uid);

export const addTefillinBuddy = async (
  myUid: string,
  buddyUid: string
): Promise<void> => {
  if (myUid === buddyUid) {
    throw new Error("Cannot add yourself as a tefillin buddy.");
  }

  const mySnap = await getDoc(userRef(myUid));
  if (!mySnap.exists()) throw new Error("Your profile was not found.");
  const buddySnap = await getDoc(userRef(buddyUid));
  if (!buddySnap.exists()) throw new Error("Your friend's profile was not found.");

  const myData = mySnap.data() as Partial<UserProfile>;
  const buddyData = buddySnap.data() as Partial<UserProfile>;
  if (myData.gender !== "female" || buddyData.gender !== "female") {
    throw new Error("Candle buddies are only available for women.");
  }

  const myFriends = Array.isArray(myData.friendUids) ? myData.friendUids : [];
  if (!myFriends.includes(buddyUid)) {
    throw new Error("You must be friends first before adding a tefillin buddy.");
  }

  const myBuddies = Array.isArray(myData.tefillinBuddyUids) ? myData.tefillinBuddyUids : [];
  if (myBuddies.includes(buddyUid)) {
    return;
  }

  await updateDoc(userRef(myUid), {
    tefillinBuddyUids: arrayUnion(buddyUid),
  });
  await updateDoc(userRef(buddyUid), {
    tefillinBuddyUids: arrayUnion(myUid),
  });

  const existingChat = await findPairChat(myUid, buddyUid);
  if (!existingChat) {
    await createBuddyChat([myUid, buddyUid], "pair");
  }
};

export const addCandleBuddy = async (
  myUid: string,
  buddyUid: string
): Promise<void> => {
  if (myUid === buddyUid) {
    throw new Error("Cannot add yourself as a candle buddy.");
  }

  const mySnap = await getDoc(userRef(myUid));
  if (!mySnap.exists()) throw new Error("Your profile was not found.");

  const myData = mySnap.data() as Partial<UserProfile>;
  const myFriends = Array.isArray(myData.friendUids) ? myData.friendUids : [];
  if (!myFriends.includes(buddyUid)) {
    throw new Error("You must be friends first before adding a candle buddy.");
  }

  const myBuddies = Array.isArray(myData.candleBuddyUids) ? myData.candleBuddyUids : [];
  if (myBuddies.includes(buddyUid)) {
    return;
  }

  await updateDoc(userRef(myUid), {
    candleBuddyUids: arrayUnion(buddyUid),
  });
  await updateDoc(userRef(buddyUid), {
    candleBuddyUids: arrayUnion(myUid),
  });

  const existingChat = await findPairChat(myUid, buddyUid, "candles");
  if (!existingChat) {
    await createBuddyChat([myUid, buddyUid], "pair", undefined, "candles");
  }
};

export const removeTefillinBuddy = async (
  myUid: string,
  buddyUid: string
): Promise<void> => {
  await updateDoc(userRef(myUid), {
    tefillinBuddyUids: arrayRemove(buddyUid),
  });
  await updateDoc(userRef(buddyUid), {
    tefillinBuddyUids: arrayRemove(myUid),
  });

  const chat = await findPairChat(myUid, buddyUid);
  if (chat) {
    await deleteBuddyChat(chat.id);
  }
};

export const removeCandleBuddy = async (
  myUid: string,
  buddyUid: string
): Promise<void> => {
  await updateDoc(userRef(myUid), {
    candleBuddyUids: arrayRemove(buddyUid),
  });
  await updateDoc(userRef(buddyUid), {
    candleBuddyUids: arrayRemove(myUid),
  });

  const chat = await findPairChat(myUid, buddyUid, "candles");
  if (chat) {
    await deleteBuddyChat(chat.id);
  }
};

export const getTefillinBuddyProfiles = async (
  uids: string[]
): Promise<UserProfile[]> => {
  if (uids.length === 0) return [];

  const profiles = await Promise.all(
    uids.map(async (uid) => {
      const snap = await getDoc(userRef(uid));
      if (!snap.exists()) return null;
      return hydrateUserProfile(snap.id, snap.data() as Partial<UserProfile>);
    })
  );

  return profiles.filter((p): p is UserProfile => p !== null);
};
