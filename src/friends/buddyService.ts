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

  const myData = mySnap.data() as Partial<UserProfile>;
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
