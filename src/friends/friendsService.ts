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

  const lower = trimmed.toLowerCase();

  const [lowerSnap, originalSnap] = await Promise.all([
    getDocs(query(
      usersCollection(),
      where("displayNameLower", ">=", lower),
      where("displayNameLower", "<=", lower + "\uf8ff"),
      firestoreLimit(15)
    )),
    getDocs(query(
      usersCollection(),
      where("displayName", ">=", trimmed),
      where("displayName", "<=", trimmed + "\uf8ff"),
      firestoreLimit(15)
    )),
  ]);

  const seen = new Set<string>();
  const results: UserProfile[] = [];
  for (const snap of [lowerSnap, originalSnap]) {
    for (const d of snap.docs) {
      if (d.id === currentUid || seen.has(d.id)) continue;
      seen.add(d.id);
      results.push(hydrateUserProfile(d.id, d.data() as Partial<UserProfile>));
    }
  }
  return results;
};

export const searchByFriendCode = async (
  code: string,
  currentUid: string
): Promise<UserProfile[]> => {
  const trimmed = code.trim();
  if (trimmed.length < 4) return [];

  const upper = trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();

  const queries = [
    getDocs(query(usersCollection(), where("friendCode", "==", upper), firestoreLimit(5))),
  ];
  if (lower !== upper) {
    queries.push(
      getDocs(query(usersCollection(), where("friendCode", "==", lower), firestoreLimit(5))),
      getDocs(query(usersCollection(), where("friendCode", "==", trimmed), firestoreLimit(5))),
    );
  }

  const snapshots = await Promise.all(queries);
  const seen = new Set<string>();
  const results: UserProfile[] = [];
  for (const snap of snapshots) {
    for (const d of snap.docs) {
      if (d.id === currentUid || seen.has(d.id)) continue;
      seen.add(d.id);
      results.push(hydrateUserProfile(d.id, d.data() as Partial<UserProfile>));
    }
  }
  return results;
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

  const friendRequestStatus = toData.friendRequestStatus ?? "request";
  if (friendRequestStatus === "closed") {
    throw new Error("This user is not accepting friend requests at the moment.");
  }

  if (friendRequestStatus === "open") {
    const fromRef = doc(firestore, "users", fromUid);
    await updateDoc(toRef, {
      friendUids: arrayUnion(fromUid),
      pendingFriendUids: arrayRemove(fromUid),
    });
    await updateDoc(fromRef, {
      friendUids: arrayUnion(toUid),
    });
    return;
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
