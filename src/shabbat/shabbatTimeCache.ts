import AsyncStorage from "@react-native-async-storage/async-storage";
import { LOCATION_STORAGE_KEY } from "../location/locationService";
import { LocationCacheRecord } from "../location/locationTypes";
import {
  ShabbatTimes,
  ShabbatTimesCacheRecord,
} from "./shabbatTimeTypes";

const SHABBAT_CACHE_KEY = "shabbat:times";
const CACHE_MAX_AGE_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const buildLocationHash = (location: {
  latitude: number;
  longitude: number;
  timezone: string;
}): string => {
  return `${location.latitude}|${location.longitude}|${location.timezone}`;
};

const isCacheFresh = (fetchedAt: Date): boolean => {
  const ageMs = Date.now() - fetchedAt.getTime();
  return ageMs <= CACHE_MAX_AGE_DAYS * MS_PER_DAY;
};

const readCurrentLocationHash = async (): Promise<string | null> => {
  const raw = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as LocationCacheRecord;
    return buildLocationHash(parsed);
  } catch {
    return null;
  }
};

const toCacheRecord = (
  times: ShabbatTimes,
  locationHash: string
): ShabbatTimesCacheRecord => ({
  shabbatStartIso: times.shabbatStart.toISOString(),
  shabbatEndIso: times.shabbatEnd.toISOString(),
  cityName: times.cityName ?? null,
  latitude: times.latitude,
  longitude: times.longitude,
  timezone: times.timezone,
  source: times.source,
  fetchedAtIso: times.fetchedAt.toISOString(),
  parsha: times.parsha ?? null,
  locationHash,
});

const fromCacheRecord = (record: ShabbatTimesCacheRecord): ShabbatTimes => ({
  shabbatStart: new Date(record.shabbatStartIso),
  shabbatEnd: new Date(record.shabbatEndIso),
  cityName: record.cityName ?? null,
  latitude: record.latitude,
  longitude: record.longitude,
  timezone: record.timezone,
  source: record.source,
  fetchedAt: new Date(record.fetchedAtIso),
  parsha: record.parsha ?? null,
});

export const getCachedShabbatTimes =
  async (): Promise<ShabbatTimes | null> => {
    const raw = await AsyncStorage.getItem(SHABBAT_CACHE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const record = JSON.parse(raw) as ShabbatTimesCacheRecord;
      const fetchedAt = new Date(record.fetchedAtIso);
      if (Number.isNaN(fetchedAt.getTime()) || !isCacheFresh(fetchedAt)) {
        return null;
      }

      const currentHash = await readCurrentLocationHash();
      if (currentHash && record.locationHash !== currentHash) {
        return null;
      }

      return fromCacheRecord(record);
    } catch {
      return null;
    }
  };

export const setCachedShabbatTimes = async (
  times: ShabbatTimes
): Promise<void> => {
  const locationHash = buildLocationHash(times);
  const record = toCacheRecord(times, locationHash);
  await AsyncStorage.setItem(SHABBAT_CACHE_KEY, JSON.stringify(record));
};

export const clearCache = async (): Promise<void> => {
  await AsyncStorage.removeItem(SHABBAT_CACHE_KEY);
};
