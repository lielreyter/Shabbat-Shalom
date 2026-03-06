export type LocationSource = "gps" | "manual";

export type LocationPermissionStatus = "granted" | "denied" | "undetermined";

export type LocationResult = {
  city: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  source: LocationSource;
  fetchedAt: Date;
};

export type LocationCacheRecord = {
  city: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  source: LocationSource;
  fetchedAtIso: string;
};
