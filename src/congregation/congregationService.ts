import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { firestore } from "../firebase/firebaseConfig";
import { LocationResult } from "../location/locationTypes";
import { Congregation, NearbyCongregation } from "./congregationTypes";
import { setUserCongregation, hydrateUserProfile } from "../firebase/firestore";
import { UserProfile } from "../types/UserProfile";

const CONGREGATIONS_COLLECTION = "congregations";

const DEFAULT_CONGREGATIONS: Omit<
  Congregation,
  "leaderUid" | "createdAtIso" | "memberUids" | "pendingUids" | "joinPolicy"
>[] = [
  {
    id: "default-jerusalem-central",
    name: "Jerusalem Central Kehilla",
    city: "Jerusalem",
    latitude: 31.7683,
    longitude: 35.2137,
    timezone: "Asia/Jerusalem",
  },
  {
    id: "default-tel-aviv-shalom",
    name: "Tel Aviv Shalom Minyan",
    city: "Tel Aviv",
    latitude: 32.0853,
    longitude: 34.7818,
    timezone: "Asia/Jerusalem",
  },
  {
    id: "default-haifa-carmel",
    name: "Haifa Carmel Community",
    city: "Haifa",
    latitude: 32.794,
    longitude: 34.9896,
    timezone: "Asia/Jerusalem",
  },
];

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const haversineDistanceMiles = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 3959;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const congregationsCollection = () =>
  collection(firestore, CONGREGATIONS_COLLECTION);

const congregationDoc = (id: string) =>
  doc(firestore, CONGREGATIONS_COLLECTION, id);

const normalizeMatchText = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const STOP_WORDS = new Set([
  "of", "the", "a", "an", "in", "at", "by", "for", "and",
]);

const extractTokens = (name: string): string[] =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w))
    .sort();

const tokensMatch = (a: string[], b: string[]): boolean =>
  a.length > 0 &&
  a.length === b.length &&
  a.every((tok, i) => tok === b[i]);

const normalizeCongregation = (
  id: string,
  data: Partial<Congregation>
): Congregation => ({
  id,
  name: data.name ?? "Unknown Congregation",
  city: data.city ?? "Unknown",
  latitude: typeof data.latitude === "number" ? data.latitude : 0,
  longitude: typeof data.longitude === "number" ? data.longitude : 0,
  timezone: data.timezone ?? "UTC",
  leaderUid: data.leaderUid ?? "system",
  joinPolicy: data.joinPolicy ?? "OPEN",
  memberUids: Array.isArray(data.memberUids) ? data.memberUids : [],
  pendingUids: Array.isArray(data.pendingUids) ? data.pendingUids : [],
  createdAtIso: data.createdAtIso ?? new Date(0).toISOString(),
});

export const bootstrapDefaultCongregations = async (): Promise<void> => {
  await Promise.all(
    DEFAULT_CONGREGATIONS.map(async (defaultCongregation) => {
      const ref = congregationDoc(defaultCongregation.id);
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) {
        await setDoc(ref, {
          ...defaultCongregation,
          leaderUid: "system",
          joinPolicy: "OPEN",
          memberUids: [],
          pendingUids: [],
          createdAtIso: new Date(0).toISOString(),
        });
      }
    })
  );
};

export const listCongregations = async (): Promise<Congregation[]> => {
  await bootstrapDefaultCongregations();
  const snapshot = await getDocs(congregationsCollection());
  return snapshot.docs.map((docSnapshot) =>
    normalizeCongregation(
      docSnapshot.id,
      docSnapshot.data() as Partial<Congregation>
    )
  );
};

const deduplicateCongregations = (
  list: NearbyCongregation[]
): NearbyCongregation[] => {
  const seen = new Map<string, NearbyCongregation>();
  for (const item of list) {
    const key = [
      ...extractTokens(item.name),
      normalizeMatchText(item.city),
    ].join("|");
    const existing = seen.get(key);
    if (!existing || item.distanceMiles < existing.distanceMiles) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
};

export const listNearbyCongregations = async (
  location: LocationResult,
  limit = 5,
  maxDistanceMiles = 50
): Promise<NearbyCongregation[]> => {
  const congregations = await listCongregations();
  const withDistance = congregations
    .map((congregation) => ({
      ...congregation,
      distanceMiles: haversineDistanceMiles(
        location.latitude,
        location.longitude,
        congregation.latitude,
        congregation.longitude
      ),
    }))
    .filter((item) => item.distanceMiles <= maxDistanceMiles)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);

  return deduplicateCongregations(withDistance).slice(0, limit);
};

export const searchCongregationsByCity = async (
  cityName: string
): Promise<Congregation[]> => {
  const normalizedCity = normalizeMatchText(cityName);
  if (!normalizedCity) return [];
  const congregations = await listCongregations();
  return congregations.filter((c) => {
    const cCity = normalizeMatchText(c.city);
    return cCity === normalizedCity || cCity.startsWith(normalizedCity) || normalizedCity.startsWith(cCity);
  });
};

export const createCongregation = async ({
  name,
  city,
  latitude,
  longitude,
  timezone,
  creatorUid,
}: {
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  creatorUid: string;
}): Promise<Congregation> => {
  const trimmedName = name.trim();
  const trimmedCity = city.trim();
  if (!trimmedName || !trimmedCity) {
    throw new Error("Congregation name and city are required.");
  }
  const normalizedName = normalizeMatchText(trimmedName);
  const normalizedCity = normalizeMatchText(trimmedCity);
  const nameTokens = extractTokens(trimmedName);
  const existingCongregations = await listCongregations();
  const duplicate = existingCongregations.find((existing) => {
    const sameCity = normalizeMatchText(existing.city) === normalizedCity;
    if (!sameCity) {
      return false;
    }
    if (normalizeMatchText(existing.name) === normalizedName) {
      return true;
    }
    return tokensMatch(extractTokens(existing.name), nameTokens);
  });
  if (duplicate) {
    throw new Error(
      `A congregation named "${duplicate.name}" already exists in ${duplicate.city}.`
    );
  }

  const id = `cong-${trimmedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}-${Date.now()}`;
  const createdAtIso = new Date().toISOString();

  const created: Congregation = {
    id,
    name: trimmedName,
    city: trimmedCity,
    latitude,
    longitude,
    timezone,
    leaderUid: creatorUid,
    joinPolicy: "OPEN",
    memberUids: [creatorUid],
    pendingUids: [],
    createdAtIso,
  };

  await setDoc(congregationDoc(id), created);
  return created;
};

export const getCongregationById = async (
  congregationId: string
): Promise<Congregation | null> => {
  if (!congregationId) {
    return null;
  }
  const snapshot = await getDoc(congregationDoc(congregationId));
  if (!snapshot.exists()) {
    return null;
  }
  return normalizeCongregation(
    snapshot.id,
    snapshot.data() as Partial<Congregation>
  );
};

export const joinCongregationAsUser = async (
  congregationId: string,
  uid: string
): Promise<"JOINED" | "REQUESTED"> => {
  const congregation = await getCongregationById(congregationId);
  if (!congregation) {
    throw new Error("Congregation not found.");
  }

  if (congregation.joinPolicy === "CLOSED") {
    throw new Error("This congregation is closed to new members.");
  }

  if (congregation.joinPolicy === "REQUEST") {
    await updateDoc(congregationDoc(congregationId), {
      pendingUids: arrayUnion(uid),
    });
    return "REQUESTED";
  }

  await updateDoc(congregationDoc(congregationId), {
    memberUids: arrayUnion(uid),
    pendingUids: arrayRemove(uid),
  });
  await setUserCongregation(uid, congregationId);
  return "JOINED";
};

export const leaveCongregationAsUser = async (
  congregationId: string,
  uid: string
): Promise<void> => {
  const congregation = await getCongregationById(congregationId);
  if (!congregation) {
    await setUserCongregation(uid, null);
    return;
  }

  await updateDoc(congregationDoc(congregationId), {
    memberUids: arrayRemove(uid),
    pendingUids: arrayRemove(uid),
  });
  await setUserCongregation(uid, null);

  if (congregation.leaderUid === uid) {
    const remainingUids = congregation.memberUids.filter((m) => m !== uid);
    if (remainingUids.length === 0) {
      await deleteDoc(congregationDoc(congregationId));
    } else {
      const memberProfiles = await listCongregationMembers(congregationId);
      const sorted = memberProfiles
        .filter((m) => m.uid !== uid)
        .sort((a, b) => (b.tefillinCurrentStreak ?? 0) - (a.tefillinCurrentStreak ?? 0));
      const newLeaderUid = sorted.length > 0 ? sorted[0].uid : remainingUids[0];
      await updateDoc(congregationDoc(congregationId), { leaderUid: newLeaderUid });
    }
  }
};

export const setCongregationJoinPolicy = async ({
  congregationId,
  leaderUid,
  policy,
}: {
  congregationId: string;
  leaderUid: string;
  policy: "OPEN" | "REQUEST" | "CLOSED";
}): Promise<void> => {
  const congregation = await getCongregationById(congregationId);
  if (!congregation) {
    throw new Error("Congregation not found.");
  }
  if (congregation.leaderUid !== leaderUid) {
    throw new Error("Only the congregation leader can change join policy.");
  }
  await updateDoc(congregationDoc(congregationId), {
    joinPolicy: policy,
  });
};

export const approveJoinRequest = async ({
  congregationId,
  leaderUid,
  targetUid,
}: {
  congregationId: string;
  leaderUid: string;
  targetUid: string;
}): Promise<void> => {
  const congregation = await getCongregationById(congregationId);
  if (!congregation) {
    throw new Error("Congregation not found.");
  }
  if (congregation.leaderUid !== leaderUid) {
    throw new Error("Only the congregation leader can approve requests.");
  }
  await updateDoc(congregationDoc(congregationId), {
    pendingUids: arrayRemove(targetUid),
    memberUids: arrayUnion(targetUid),
  });
  await setUserCongregation(targetUid, congregationId);
};

export const rejectJoinRequest = async ({
  congregationId,
  leaderUid,
  targetUid,
}: {
  congregationId: string;
  leaderUid: string;
  targetUid: string;
}): Promise<void> => {
  const congregation = await getCongregationById(congregationId);
  if (!congregation) {
    throw new Error("Congregation not found.");
  }
  if (congregation.leaderUid !== leaderUid) {
    throw new Error("Only the congregation leader can reject requests.");
  }
  await updateDoc(congregationDoc(congregationId), {
    pendingUids: arrayRemove(targetUid),
  });
};

export const kickMember = async ({
  congregationId,
  leaderUid,
  targetUid,
}: {
  congregationId: string;
  leaderUid: string;
  targetUid: string;
}): Promise<void> => {
  const congregation = await getCongregationById(congregationId);
  if (!congregation) {
    throw new Error("Congregation not found.");
  }
  if (congregation.leaderUid !== leaderUid) {
    throw new Error("Only the congregation leader can kick members.");
  }
  if (targetUid === leaderUid) {
    throw new Error("Leader cannot kick themselves.");
  }
  await updateDoc(congregationDoc(congregationId), {
    memberUids: arrayRemove(targetUid),
    pendingUids: arrayRemove(targetUid),
  });
  await setUserCongregation(targetUid, null);
};

export const transferLeadership = async (
  congregationId: string,
  currentLeaderUid: string,
  newLeaderUid: string
): Promise<void> => {
  const congregation = await getCongregationById(congregationId);
  if (!congregation) throw new Error("Congregation not found.");
  if (congregation.leaderUid !== currentLeaderUid) {
    throw new Error("Only the congregation leader can transfer leadership.");
  }
  if (!congregation.memberUids.includes(newLeaderUid)) {
    throw new Error("New leader must be a member of the congregation.");
  }
  await updateDoc(congregationDoc(congregationId), { leaderUid: newLeaderUid });
};

export const listCongregationMembers = async (
  congregationId: string
): Promise<UserProfile[]> => {
  const snapshot = await getDocs(
    query(collection(firestore, "users"), where("congregationId", "==", congregationId))
  );
  return snapshot.docs.map((docSnapshot) =>
    hydrateUserProfile(docSnapshot.id, docSnapshot.data() as Partial<UserProfile>)
  );
};
