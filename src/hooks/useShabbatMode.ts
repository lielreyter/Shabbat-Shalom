import { useCallback, useEffect, useState } from "react";
import {
  ShabbatModeState,
  ShabbatModeStatus,
} from "../shabbatMode/shabbatModeTypes";
import {
  attemptBreakShabbat,
  endShabbatMode,
  getCurrentState,
  startShabbatMode,
} from "../shabbatMode/shabbatModeService";
import { loadShabbatModeState } from "../shabbatMode/shabbatModeState";

type UseShabbatModeState = {
  status: ShabbatModeStatus;
  isActive: boolean;
  start: () => Promise<void>;
  end: () => Promise<void>;
  breakShabbat: () => Promise<"ALLOWED" | "CANCELED">;
};

const defaultState: ShabbatModeState = {
  status: ShabbatModeStatus.INACTIVE,
  startedAt: null,
  endedAt: null,
  brokenAt: null,
};

export const useShabbatMode = (): UseShabbatModeState => {
  const [state, setState] = useState<ShabbatModeState>(defaultState);

  useEffect(() => {
    let isMounted = true;
    loadShabbatModeState().then(() => {
      if (isMounted) {
        setState(getCurrentState());
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const start = useCallback(async () => {
    await startShabbatMode();
    setState(getCurrentState());
  }, []);

  const end = useCallback(async () => {
    await endShabbatMode();
    setState(getCurrentState());
  }, []);

  const breakShabbat = useCallback(async () => {
    const result = await attemptBreakShabbat();
    setState(getCurrentState());
    return result;
  }, []);

  return {
    status: state.status,
    isActive: state.status === ShabbatModeStatus.ACTIVE,
    start,
    end,
    breakShabbat,
  };
};
