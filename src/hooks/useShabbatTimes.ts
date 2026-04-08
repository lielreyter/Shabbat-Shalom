import { useCallback, useEffect, useState } from "react";
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
      const times = await getShabbatTimes(location);
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
        setShabbatTimes(cached);
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
