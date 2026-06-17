export type CongregationReligion = "jewish" | "christian" | "mixed";

export type Congregation = {
  id: string;
  name: string;
  city: string;
  religion: CongregationReligion | null;
  latitude: number;
  longitude: number;
  timezone: string;
  leaderUid: string;
  joinPolicy: "OPEN" | "REQUEST" | "CLOSED";
  memberUids: string[];
  pendingUids: string[];
  createdAtIso: string;
};

export type NearbyCongregation = Congregation & {
  distanceMiles: number;
};
