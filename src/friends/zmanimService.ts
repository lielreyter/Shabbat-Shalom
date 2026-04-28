import AsyncStorage from "@react-native-async-storage/async-storage";

export type ZmanimResult = {
  sunrise: Date;
  sunset: Date;
};

const ZMANIM_CACHE_PREFIX = "zmanim:";

const todayStr = (tzid?: string): string => {
  if (tzid) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tzid,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      const y = parts.find((p) => p.type === "year")!.value;
      const m = parts.find((p) => p.type === "month")!.value;
      const d = parts.find((p) => p.type === "day")!.value;
      return `${y}-${m}-${d}`;
    } catch {
      // fall through to UTC
    }
  }
  return new Date().toISOString().slice(0, 10);
};

const cacheKey = (lat: number, lon: number, date: string): string =>
  `${ZMANIM_CACHE_PREFIX}${lat.toFixed(2)}_${lon.toFixed(2)}_${date}`;

export const fetchZmanim = async (
  lat: number,
  lon: number,
  tzid: string,
  date: string
): Promise<ZmanimResult> => {
  const url = `https://www.hebcal.com/zmanim?cfg=json&latitude=${lat}&longitude=${lon}&tzid=${encodeURIComponent(tzid)}&date=${date}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HebCal Zmanim API error: ${response.status}`);
  }
  const data = (await response.json()) as {
    times?: { sunrise?: string; sunset?: string };
    sunrise?: string;
    sunset?: string;
  };
  const times = data.times ?? data;

  const sunriseStr = times.sunrise;
  const sunsetStr = times.sunset;

  if (!sunriseStr || !sunsetStr) {
    throw new Error("HebCal response missing sunrise or sunset");
  }

  return {
    sunrise: new Date(sunriseStr),
    sunset: new Date(sunsetStr),
  };
};

export const getCachedZmanim = async (
  lat: number,
  lon: number,
  tzid: string
): Promise<ZmanimResult> => {
  const date = todayStr(tzid);
  const key = cacheKey(lat, lon, date);

  const cached = await AsyncStorage.getItem(key);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      return {
        sunrise: new Date(parsed.sunrise),
        sunset: new Date(parsed.sunset),
      };
    } catch {
      // cache corrupt, refetch
    }
  }

  const result = await fetchZmanim(lat, lon, tzid, date);

  await AsyncStorage.setItem(
    key,
    JSON.stringify({
      sunrise: result.sunrise.toISOString(),
      sunset: result.sunset.toISOString(),
    })
  );

  // Clean up yesterday's cache entry
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const oldKey = cacheKey(lat, lon, yesterday.toISOString().slice(0, 10));
  AsyncStorage.removeItem(oldKey).catch(() => {});

  return result;
};

export const isWithinSunWindow = async (
  lat: number,
  lon: number,
  tzid: string
): Promise<boolean> => {
  const { sunrise, sunset } = await getCachedZmanim(lat, lon, tzid);
  const now = new Date();
  return now >= sunrise && now <= sunset;
};

export const getSunWindowMessage = async (
  lat: number,
  lon: number,
  tzid: string
): Promise<string | null> => {
  const withinWindow = await isWithinSunWindow(lat, lon, tzid);
  if (withinWindow) return null;
  return "The sun is not visible — tefillin photos can only be sent between sunrise and sunset";
};
