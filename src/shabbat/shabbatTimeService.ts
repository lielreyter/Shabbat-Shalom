import { LocationResult } from "../location/locationTypes";
import {
  HolidayEvent,
  ShabbatTimes,
  ShabbatTimeError,
  ShabbatTimeErrorCode,
} from "./shabbatTimeTypes";

type HebcalItem = {
  title?: string;
  category?: string;
  date?: string;
};

type HebcalResponse = {
  items?: HebcalItem[];
  location?: {
    title?: string;
    city?: string;
    tzid?: string;
  };
};

const HEB_CAL_ENDPOINT = "https://www.hebcal.com/shabbat";

const buildUrl = (location: LocationResult): string => {
  const params = new URLSearchParams({
    cfg: "json",
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    tzid: location.timezone,
  });
  return `${HEB_CAL_ENDPOINT}?${params.toString()}`;
};

const parseDate = (value?: string): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const findShabbatCandles = (items: HebcalItem[]): HebcalItem | undefined => {
  const candleItems = items.filter((item) => item.category === "candles");
  for (const item of candleItems) {
    const date = parseDate(item.date);
    if (date && date.getDay() === 5) return item;
  }
  return candleItems[candleItems.length - 1];
};

const findShabbatHavdalah = (items: HebcalItem[]): HebcalItem | undefined => {
  const havdalahItems = items.filter((item) => item.category === "havdalah");
  for (const item of havdalahItems) {
    const date = parseDate(item.date);
    if (date && date.getDay() === 6) return item;
  }
  return havdalahItems[havdalahItems.length - 1];
};

const extractHolidays = (items: HebcalItem[]): HolidayEvent[] => {
  const holidayItems = items.filter((item) => item.category === "holiday");
  if (holidayItems.length === 0) return [];

  const nonFridayCandles = items.filter((item) => {
    if (item.category !== "candles") return false;
    const date = parseDate(item.date);
    return date && date.getDay() !== 5;
  });

  const nonSaturdayHavdalah = items.filter((item) => {
    if (item.category !== "havdalah") return false;
    const date = parseDate(item.date);
    return date && date.getDay() !== 6;
  });

  return holidayItems.map((h, i) => ({
    name: h.title ?? "Holiday",
    candleLighting: nonFridayCandles[i]
      ? parseDate(nonFridayCandles[i]?.date)
      : null,
    havdalah: nonSaturdayHavdalah[i]
      ? parseDate(nonSaturdayHavdalah[i]?.date)
      : null,
  }));
};

const toShabbatTimes = (
  location: LocationResult,
  response: HebcalResponse
): ShabbatTimes => {
  const items = response.items;
  if (!items || !Array.isArray(items)) {
    throw {
      code: ShabbatTimeErrorCode.INVALID_RESPONSE,
      message: "Hebcal response is missing items.",
    } satisfies ShabbatTimeError;
  }

  const candle = findShabbatCandles(items);
  const havdalah = findShabbatHavdalah(items);

  const shabbatStart = parseDate(candle?.date);
  const shabbatEnd = parseDate(havdalah?.date);

  if (!shabbatStart || !shabbatEnd) {
    throw {
      code: ShabbatTimeErrorCode.INVALID_RESPONSE,
      message: "Hebcal response missing candle lighting or havdalah.",
    } satisfies ShabbatTimeError;
  }

  const parshaItem = items.find((item) => item.category === "parashat");
  const cityName = response.location?.city ?? response.location?.title ?? null;
  const holidays = extractHolidays(items);

  return {
    shabbatStart,
    shabbatEnd,
    cityName,
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.timezone,
    source: "api",
    fetchedAt: new Date(),
    parsha: parshaItem?.title ?? null,
    holidays: holidays.length > 0 ? holidays : undefined,
  };
};

const mapToShabbatError = (error: unknown): ShabbatTimeError => {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: string }).code);
    if (
      Object.values(ShabbatTimeErrorCode).includes(
        code as ShabbatTimeErrorCode
      )
    ) {
      return error as ShabbatTimeError;
    }
  }
  if (error instanceof TypeError) {
    return {
      code: ShabbatTimeErrorCode.NETWORK_ERROR,
      message: "Network error.",
    };
  }
  return {
    code: ShabbatTimeErrorCode.API_FAILED,
    message: "Failed to fetch Shabbat times.",
  };
};

export const getShabbatTimes = async (
  location: LocationResult
): Promise<ShabbatTimes> => {
  const url = buildUrl(location);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw {
        code: ShabbatTimeErrorCode.API_FAILED,
        message: `Hebcal API failed with status ${response.status}.`,
      } satisfies ShabbatTimeError;
    }

    const data = (await response.json()) as HebcalResponse;
    return toShabbatTimes(location, data);
  } catch (error) {
    throw mapToShabbatError(error);
  }
};
