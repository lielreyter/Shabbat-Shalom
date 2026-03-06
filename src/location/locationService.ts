import AsyncStorage from "@react-native-async-storage/async-storage";
import Geolocation, {
  GeoPosition,
} from "react-native-geolocation-service";
import {
  LocationResult,
  LocationPermissionStatus,
  LocationCacheRecord,
} from "./locationTypes";

export const LOCATION_STORAGE_KEY = "location:lastKnown";

const getTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const toLocationResult = (record: LocationCacheRecord): LocationResult => ({
  city: record.city,
  latitude: record.latitude,
  longitude: record.longitude,
  timezone: record.timezone,
  source: record.source,
  fetchedAt: new Date(record.fetchedAtIso),
});

const fromPosition = (position: GeoPosition): LocationResult => ({
  city: null,
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  timezone: getTimeZone(),
  source: "gps",
  fetchedAt: new Date(),
});

const persistLocation = async (result: LocationResult): Promise<void> => {
  const record: LocationCacheRecord = {
    city: result.city ?? null,
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone,
    source: result.source,
    fetchedAtIso: result.fetchedAt.toISOString(),
  };
  await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(record));
};

const loadCachedLocation = async (): Promise<LocationResult | null> => {
  const raw = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as LocationCacheRecord;
    return toLocationResult(parsed);
  } catch {
    return null;
  }
};

const hasTimezoneChanged = (cached: LocationResult): boolean => {
  return cached.timezone !== getTimeZone();
};

export const requestLocationPermission =
  async (): Promise<LocationPermissionStatus> => {
    const status = await Geolocation.requestAuthorization("whenInUse");
    if (status === "granted") {
      return "granted";
    }
    if (status === "denied" || status === "disabled") {
      return "denied";
    }
    return "undetermined";
  };

export const setManualLocation = async (
  city: string,
  lat: number,
  lon: number,
  tz: string
): Promise<void> => {
  const manual: LocationResult = {
    city,
    latitude: lat,
    longitude: lon,
    timezone: tz,
    source: "manual",
    fetchedAt: new Date(),
  };
  await persistLocation(manual);
};

export const getCurrentLocation = async (): Promise<LocationResult> => {
  const cached = await loadCachedLocation();

  if (cached && cached.source === "manual") {
    return cached;
  }

  if (cached && !hasTimezoneChanged(cached)) {
    return cached;
  }

  const permission = await requestLocationPermission();
  if (permission !== "granted") {
    if (cached) {
      return cached;
    }
    throw new Error("LOCATION_DENIED");
  }

  const position = await new Promise<GeoPosition>((resolve, reject) => {
    Geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 60000,
    });
  });

  const location = fromPosition(position);
  await persistLocation(location);
  return location;
};
