export type Congregation = {
  id: string;
  name: string;
  city: string;
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
