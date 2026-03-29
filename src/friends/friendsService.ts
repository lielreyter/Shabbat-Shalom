import {
  collection,
  query,
  where,
  getDocs,
  limit as firestoreLimit,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { firestore } from "../firebase/firebaseConfig";
import { hydrateUserProfile } from "../firebase/firestore";
import { UserProfile } from "../types/UserProfile";

const usersCollection = () => collection(firestore, "users");

export const searchUsersByName = async (
  searchTerm: string,
  currentUid: string
): Promise<UserProfile[]> => {
  const trimmed = searchTerm.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const q = query(
    usersCollection(),
    where("displayName", ">=", trimmed),
    where("displayName", "<=", trimmed + "\uf8ff"),
    firestoreLimit(15)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => hydrateUserProfile(d.id, d.data() as Partial<UserProfile>))
    .filter((u) => u.uid !== currentUid);
};

export const sendFriendRequest = async (
  fromUid: string,
  toUid: string
): Promise<void> => {
  if (fromUid === toUid) {
    throw new Error("Cannot send a friend request to yourself.");
  }

  const toRef = doc(firestore, "users", toUid);
  const toSnap = await getDoc(toRef);
  if (!toSnap.exists()) {
    throw new Error("User not found.");
  }

  const toData = toSnap.data() as Partial<UserProfile>;
  const existing = Array.isArray(toData.friendUids) ? toData.friendUids : [];
  if (existing.includes(fromUid)) {
    throw new Error("You are already friends.");
  }

  const pending = Array.isArray(toData.pendingFriendUids)
    ? toData.pendingFriendUids
    : [];
  if (pending.includes(fromUid)) {
    throw new Error("Friend request already sent.");
  }

  await updateDoc(toRef, {
    pendingFriendUids: arrayUnion(fromUid),
  });
};

export const acceptFriendRequest = async (
  myUid: string,
  friendUid: string
): Promise<void> => {
  const myRef = doc(firestore, "users", myUid);
  const friendRef = doc(firestore, "users", friendUid);

  await updateDoc(myRef, {
    pendingFriendUids: arrayRemove(friendUid),
    friendUids: arrayUnion(friendUid),
  });

  await updateDoc(friendRef, {
    friendUids: arrayUnion(myUid),
  });
};

export const rejectFriendRequest = async (
  myUid: string,
  friendUid: string
): Promise<void> => {
  const myRef = doc(firestore, "users", myUid);
  await updateDoc(myRef, {
    pendingFriendUids: arrayRemove(friendUid),
  });
};

export const removeFriend = async (
  myUid: string,
  friendUid: string
): Promise<void> => {
  const myRef = doc(firestore, "users", myUid);
  const friendRef = doc(firestore, "users", friendUid);

  await updateDoc(myRef, {
    friendUids: arrayRemove(friendUid),
  });

  await updateDoc(friendRef, {
    friendUids: arrayRemove(myUid),
  });
};

export const getFriendProfiles = async (
  uids: string[]
): Promise<UserProfile[]> => {
  if (uids.length === 0) {
    return [];
  }

  const profiles = await Promise.all(
    uids.map(async (uid) => {
      const snap = await getDoc(doc(firestore, "users", uid));
      if (!snap.exists()) {
        return null;
      }
      return hydrateUserProfile(snap.id, snap.data() as Partial<UserProfile>);
    })
  );

  return profiles.filter((p): p is UserProfile => p !== null);
};

export const getPendingRequestProfiles = async (
  uids: string[]
): Promise<UserProfile[]> => {
  return getFriendProfiles(uids);
};
