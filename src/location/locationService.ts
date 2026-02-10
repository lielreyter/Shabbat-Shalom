import AsyncStorage from "@react-native-async-storage/async-storage";
import Geolocation, {
  GeolocationResponse,
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

const fromPosition = (position: GeolocationResponse): LocationResult => ({
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
  if (cached && !hasTimezoneChanged(cached)) {
    return cached;
  }

  const permission = await requestLocationPermission();
  if (permission !== "granted") {
    if (cached && cached.source === "manual") {
      return cached;
    }
    throw new Error("Location permission denied.");
  }

  const position = await new Promise<GeolocationResponse>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: false, // reduced accuracy to align with privacy-first requirement
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  });

  const location = fromPosition(position);
  await persistLocation(location);
  return location;
};
import Geolocation from "@react-native-community/geolocation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  LocationPermissionStatus,
  LocationResult,
  LocationSource,
} from "./locationTypes";

const LOCATION_CACHE_KEY = "location:v1";

type StoredLocation = {
  city: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  source: LocationSource;
  fetchedAt: string;
};

const getDeviceTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const toLocationResult = (stored: StoredLocation): LocationResult => ({
  ...stored,
  fetchedAt: new Date(stored.fetchedAt),
});

const readStoredLocation = async (): Promise<StoredLocation | null> => {
  const raw = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredLocation;
  } catch {
    return null;
  }
};

const writeStoredLocation = async (location: StoredLocation): Promise<void> => {
  await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(location));
};

const mapPermissionStatus = (status: string): LocationPermissionStatus => {
  if (status === "granted") {
    return "granted";
  }
  if (status === "denied" || status === "restricted") {
    return "denied";
  }
  return "undetermined";
};

export const requestLocationPermission =
  async (): Promise<LocationPermissionStatus> => {
    // iOS-only: request "when in use" with reduced accuracy.
    const status = await Geolocation.requestAuthorization("whenInUse");
    return mapPermissionStatus(status);
  };

const fetchGpsLocation = async (): Promise<LocationResult> => {
  const timezone = getDeviceTimeZone();

  const position = await new Promise<Geolocation.GeoPosition>(
    (resolve, reject) => {
      Geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000,
        }
      );
    }
  );

  return {
    city: null,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    timezone,
    source: "gps",
    fetchedAt: new Date(),
  };
};

export const setManualLocation = async (
  city: string,
  lat: number,
  lon: number,
  tz: string
): Promise<void> => {
  const stored: StoredLocation = {
    city,
    latitude: lat,
    longitude: lon,
    timezone: tz,
    source: "manual",
    fetchedAt: new Date().toISOString(),
  };
  await writeStoredLocation(stored);
};

export const getCurrentLocation = async (): Promise<LocationResult> => {
  const stored = await readStoredLocation();
  const deviceTimeZone = getDeviceTimeZone();

  if (stored) {
    // If user set a manual location, prefer it until they change it.
    if (stored.source === "manual") {
      return toLocationResult(stored);
    }

    // Refresh GPS location only when timezone changed.
    if (stored.timezone === deviceTimeZone) {
      return toLocationResult(stored);
    }
  }

  const permission = await requestLocationPermission();
  if (permission !== "granted") {
    throw new Error("LOCATION_DENIED");
  }

  const location = await fetchGpsLocation();
  await writeStoredLocation({
    ...location,
    fetchedAt: location.fetchedAt.toISOString(),
  });

  return location;
};
