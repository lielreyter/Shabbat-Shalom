import {
  ShabbatModeError,
  ShabbatModeErrorCode,
  ShabbatModeState,
  ShabbatModeStatus,
} from "./shabbatModeTypes";
import {
  getCurrentState as getPersistedState,
  getCurrentWeekId,
  loadShabbatModeState,
  setActiveState,
  setBrokenState,
  setInactiveState,
} from "./shabbatModeState";
import {
  enableFullAppBlocking,
  disableAllBlocking,
  requestScreenTimePermission,
} from "../ios/screenTimeService";
import { runIntentFlow } from "./shabbatIntentFlow";

let isInitialized = false;

const ensureInitialized = async (): Promise<void> => {
  if (!isInitialized) {
    await loadShabbatModeState();
    isInitialized = true;
  }
};

export const startShabbatMode = async (weekId?: string): Promise<void> => {
  await ensureInitialized();
  const granted = await requestScreenTimePermission();
  if (!granted) {
    throw {
      code: ShabbatModeErrorCode.SCREEN_TIME_DENIED,
      message: "Screen Time permission is required to start Shabbat Mode.",
    } satisfies ShabbatModeError;
  }

  await enableFullAppBlocking();
  await setActiveState(weekId ?? getCurrentWeekId() ?? "unknown-week");
};

export const endShabbatMode = async (): Promise<void> => {
  await ensureInitialized();
  await disableAllBlocking();
  await setInactiveState();
};

export const attemptBreakShabbat = async (): Promise<"ALLOWED" | "CANCELED"> => {
  await ensureInitialized();
  const result = await runIntentFlow();
  if (result === "ABORT") {
    return "CANCELED";
  }

  await disableAllBlocking();
  await setBrokenState();
  return "ALLOWED";
};

export const getCurrentState = (): ShabbatModeState => {
  return getPersistedState();
};

export const isShabbatModeActive = (): boolean => {
  return getPersistedState().status === ShabbatModeStatus.ACTIVE;
};
