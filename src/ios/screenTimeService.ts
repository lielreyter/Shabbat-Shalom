import { NativeModules, Platform } from "react-native";
import {
  ShabbatModeError,
  ShabbatModeErrorCode,
} from "../shabbatMode/shabbatModeTypes";

type ScreenTimeNativeModule = {
  requestAuthorization: () => Promise<boolean>;
  enableFullAppBlocking: () => Promise<void>;
  enablePersonalBlocking: () => Promise<{ count: number }>;
  setShieldReason: (reason: "modehAni" | "shema" | "shabbat" | "personal" | "manual") => Promise<void>;
  enableBlockingMode: (
    mode: "full" | "medium" | "custom" | "none"
  ) => Promise<{ count: number }>;
  setBlockMode: (mode: "full" | "medium" | "custom" | "none") => Promise<void>;
  disableAllBlocking: () => Promise<void>;
  scheduleBlock: (
    identifier: "modehAni" | "shema" | "shabbat" | "personal",
    startIso: string,
    endIso: string
  ) => Promise<void>;
  cancelScheduledBlock: (
    identifier: "modehAni" | "shema" | "shabbat" | "personal"
  ) => Promise<void>;
  presentFamilyActivityPicker: (
    mode: "medium" | "custom" | "personal",
    title: string
  ) => Promise<{ cancelled: boolean; count: number }>;
  getFamilyActivitySelectionSummary: (
    mode: "medium" | "custom" | "personal"
  ) => Promise<{ count: number }>;
};

const ScreenTimeModule =
  NativeModules.ScreenTimeService as ScreenTimeNativeModule | undefined;

const ensureIos = (): void => {
  if (Platform.OS !== "ios") {
    throw {
      code: ShabbatModeErrorCode.BLOCKING_FAILED,
      message: "Screen Time is only supported on iOS.",
    } satisfies ShabbatModeError;
  }
};

const ensureModule = (): ScreenTimeNativeModule => {
  if (!ScreenTimeModule) {
    throw {
      code: ShabbatModeErrorCode.BLOCKING_FAILED,
      message: "Screen Time native module is not installed.",
    } satisfies ShabbatModeError;
  }
  return ScreenTimeModule;
};

export const requestScreenTimePermission = async (): Promise<boolean> => {
  ensureIos();
  if (!ScreenTimeModule) {
    console.warn("ScreenTimeService native module not available — returning false.");
    return false;
  }
  const module = ensureModule();
  try {
    return await module.requestAuthorization();
  } catch {
    console.error("Screen Time permission request failed.");
    throw {
      code: ShabbatModeErrorCode.SCREEN_TIME_DENIED,
      message: "Screen Time permission was denied.",
    } satisfies ShabbatModeError;
  }
};

export const enableFullAppBlocking = async (): Promise<void> => {
  ensureIos();
  if (!ScreenTimeModule) {
    console.warn("ScreenTimeService native module not available — skipping enable.");
    return;
  }
  const module = ensureModule();
  try {
    await module.enableFullAppBlocking();
  } catch {
    console.error("Failed to enable Screen Time blocking.");
    throw {
      code: ShabbatModeErrorCode.BLOCKING_FAILED,
      message: "Failed to enable Screen Time blocking.",
    } satisfies ShabbatModeError;
  }
};

export const setScreenTimeShieldReason = async (
  reason: "modehAni" | "shema" | "shabbat" | "personal" | "manual"
): Promise<void> => {
  ensureIos();
  if (!ScreenTimeModule) {
    return;
  }
  try {
    await ensureModule().setShieldReason(reason);
  } catch {
    // Best-effort copy update; blocking should still continue.
  }
};

export const enablePersonalBlocking = async (): Promise<{ count: number }> => {
  ensureIos();
  if (!ScreenTimeModule) {
    return { count: 0 };
  }
  try {
    return await ensureModule().enablePersonalBlocking();
  } catch {
    throw {
      code: ShabbatModeErrorCode.BLOCKING_FAILED,
      message: "Failed to enable selected Screen Time blocking.",
    } satisfies ShabbatModeError;
  }
};

export const enableBlockingMode = async (
  mode: "full" | "medium" | "custom" | "none"
): Promise<{ count: number }> => {
  ensureIos();
  if (!ScreenTimeModule) {
    console.warn("ScreenTimeService native module not available — skipping enable.");
    return { count: 0 };
  }
  try {
    return await ensureModule().enableBlockingMode(mode);
  } catch {
    throw {
      code: ShabbatModeErrorCode.BLOCKING_FAILED,
      message: "Failed to enable selected Screen Time blocking.",
    } satisfies ShabbatModeError;
  }
};

export const setScreenTimeBlockMode = async (
  mode: "full" | "medium" | "custom" | "none"
): Promise<void> => {
  ensureIos();
  if (!ScreenTimeModule) {
    return;
  }
  try {
    await ensureModule().setBlockMode(mode);
  } catch {
    // The JS setting is still saved; native will retry when blocking is enabled.
  }
};

export const disableAllBlocking = async (): Promise<void> => {
  ensureIos();
  if (!ScreenTimeModule) {
    console.warn("ScreenTimeService native module not available — skipping disable.");
    return;
  }
  const module = ensureModule();
  try {
    await module.disableAllBlocking();
  } catch {
    console.error("Failed to disable Screen Time blocking.");
    throw {
      code: ShabbatModeErrorCode.BLOCKING_FAILED,
      message: "Failed to disable Screen Time blocking.",
    } satisfies ShabbatModeError;
  }
};

export const scheduleScreenTimeBlock = async (
  identifier: "modehAni" | "shema" | "shabbat" | "personal",
  startDate: Date,
  endDate: Date
): Promise<void> => {
  ensureIos();
  if (!ScreenTimeModule) {
    console.warn("ScreenTimeService native module not available — skipping schedule.");
    return;
  }
  const module = ensureModule();
  try {
    await module.scheduleBlock(identifier, startDate.toISOString(), endDate.toISOString());
  } catch {
    console.error("Failed to schedule Screen Time block.");
    throw {
      code: ShabbatModeErrorCode.BLOCKING_FAILED,
      message: "Failed to schedule Screen Time block.",
    } satisfies ShabbatModeError;
  }
};

export const cancelScheduledScreenTimeBlock = async (
  identifier: "modehAni" | "shema" | "shabbat" | "personal"
): Promise<void> => {
  ensureIos();
  if (!ScreenTimeModule) {
    console.warn("ScreenTimeService native module not available — skipping cancel schedule.");
    return;
  }
  const module = ensureModule();
  try {
    await module.cancelScheduledBlock(identifier);
  } catch {
    throw {
      code: ShabbatModeErrorCode.BLOCKING_FAILED,
      message: "Failed to cancel Screen Time block.",
    } satisfies ShabbatModeError;
  }
};

export const presentFamilyActivityPicker = async (
  mode: "medium" | "custom" | "personal",
  title: string
): Promise<{ cancelled: boolean; count: number }> => {
  ensureIos();
  if (!ScreenTimeModule) {
    console.warn("ScreenTimeService native module not available — skipping picker.");
    return { cancelled: true, count: 0 };
  }
  try {
    return await ensureModule().presentFamilyActivityPicker(mode, title);
  } catch {
    throw {
      code: ShabbatModeErrorCode.BLOCKING_FAILED,
      message: "Failed to open app picker.",
    } satisfies ShabbatModeError;
  }
};

export const getFamilyActivitySelectionSummary = async (
  mode: "medium" | "custom" | "personal"
): Promise<{ count: number }> => {
  ensureIos();
  if (!ScreenTimeModule) {
    return { count: 0 };
  }
  try {
    return await ensureModule().getFamilyActivitySelectionSummary(mode);
  } catch {
    return { count: 0 };
  }
};
