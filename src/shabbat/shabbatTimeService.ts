import { LocationResult } from "../location/locationTypes";
import {
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

const findItemByCategory = (
  items: HebcalItem[],
  category: string
): HebcalItem | undefined => {
  return items.find((item) => item.category === category);
};

const parseDate = (value?: string): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

  const candle = findItemByCategory(items, "candles");
  const havdalah = findItemByCategory(items, "havdalah");

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
