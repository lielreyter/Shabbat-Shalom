import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import {
  ShabbatTimeError,
  ShabbatTimeErrorCode,
  ShabbatTimes,
} from "../shabbat/shabbatTimeTypes";
import { getShabbatTimes } from "../shabbat/shabbatTimeService";
import {
  clearCache,
  getCachedShabbatTimes,
  setCachedShabbatTimes,
} from "../shabbat/shabbatTimeCache";
import { getCurrentLocation } from "../location/locationService";

type UseShabbatTimesState = {
  shabbatTimes: ShabbatTimes | null;
  loading: boolean;
  error: ShabbatTimeError | null;
  refresh: () => Promise<void>;
};

const filterUpcomingHolidays = (times: ShabbatTimes): ShabbatTimes => {
  const now = Date.now();
  const holidays = times.holidays?.filter((holiday) => {
    const relevantUntil = holiday.havdalah ?? holiday.candleLighting;
    return relevantUntil !== null && relevantUntil.getTime() >= now;
  });

  return {
    ...times,
    holidays: holidays && holidays.length > 0 ? holidays : undefined,
  };
};

const toError = (error: unknown): ShabbatTimeError => {
  if (error && typeof error === "object" && "code" in error) {
    return error as ShabbatTimeError;
  }
  if (error instanceof Error && error.message === "LOCATION_DENIED") {
    return {
      code: ShabbatTimeErrorCode.LOCATION_DENIED,
      message: "Location permission denied.",
    };
  }
  return {
    code: ShabbatTimeErrorCode.UNKNOWN,
    message: "Unknown error.",
  };
};

export const useShabbatTimes = (): UseShabbatTimesState => {
  const [shabbatTimes, setShabbatTimes] = useState<ShabbatTimes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ShabbatTimeError | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const location = await getCurrentLocation();
      const times = filterUpcomingHolidays(await getShabbatTimes(location));
      await setCachedShabbatTimes(times);
      setShabbatTimes(times);
    } catch (err) {
      setError(toError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      const cached = await getCachedShabbatTimes();
      if (cached && isMounted) {
        setShabbatTimes(filterUpcomingHolidays(cached));
      }
      if (!cached) {
        await refresh();
      } else {
        setLoading(false);
        refresh().catch(() => {});
      }
    };

    initialize().catch(() => {
      if (isMounted) {
        setError({
          code: ShabbatTimeErrorCode.UNKNOWN,
          message: "Failed to load Shabbat times.",
        });
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh().catch(() => {});
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  const wrappedRefresh = useCallback(async () => {
    await clearCache();
    await refresh();
  }, [refresh]);

  return {
    shabbatTimes,
    loading,
    error,
    refresh: wrappedRefresh,
  };
};
