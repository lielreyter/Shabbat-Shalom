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
  return {
    code: ShabbatTimeErrorCode.API_FAILED,
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
      }
    };

    initialize().catch(() => {
      if (isMounted) {
        setError({
          code: ShabbatTimeErrorCode.API_FAILED,
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
import { useCallback, useEffect, useState } from "react";
import { getCurrentLocation } from "../location/locationService";
import { getShabbatTimes } from "../shabbat/shabbatTimeService";
import {
  ShabbatTimes,
  ShabbatTimeError,
  ShabbatTimeErrorCode,
} from "../shabbat/shabbatTimeTypes";
import {
  getCachedShabbatTimes,
  setCachedShabbatTimes,
} from "../shabbat/shabbatTimeCache";

const mapError = (error: unknown): ShabbatTimeError => {
  if (error instanceof Error && error.message === "LOCATION_DENIED") {
    return {
      code: ShabbatTimeErrorCode.LOCATION_DENIED,
      message: "Location permission denied.",
    };
  }

  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: string }).code);
    if (code in ShabbatTimeErrorCode) {
      return {
        code: code as ShabbatTimeErrorCode,
        message: "Failed to load Shabbat times.",
      };
    }
  }

  return {
    code: ShabbatTimeErrorCode.UNKNOWN,
    message: "Unknown error.",
  } as ShabbatTimeError;
};

export const useShabbatTimes = () => {
  const [shabbatTimes, setShabbatTimes] = useState<ShabbatTimes | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ShabbatTimeError | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const location = await getCurrentLocation();
      const cached = await getCachedShabbatTimes(location);
      if (cached) {
        setShabbatTimes(cached);
        setLoading(false);
        return;
      }

      const fresh = await getShabbatTimes(location);
      await setCachedShabbatTimes(location, fresh);
      setShabbatTimes(fresh);
    } catch (err) {
      console.error("Failed to refresh Shabbat times", err);
      setError(mapError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    shabbatTimes,
    loading,
    error,
    refresh,
  };
};
