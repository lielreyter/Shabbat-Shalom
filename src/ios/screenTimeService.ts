import { NativeModules, Platform } from "react-native";
import {
  ShabbatModeError,
  ShabbatModeErrorCode,
} from "../shabbatMode/shabbatModeTypes";

type ScreenTimeNativeModule = {
  requestAuthorization: () => Promise<boolean>;
  getAuthorizationStatus: () => Promise<{
    status: ScreenTimeAuthorizationStatus;
  }>;
  enableFullAppBlocking: () => Promise<void>;
  enablePersonalBlocking: () => Promise<{ count: number }>;
  setShieldReason: (reason: "modehAni" | "shema" | "shabbat" | "personal" | "manual") => Promise<void>;
  enableBlockingMode: (
    mode: "full" | "medium" | "custom" | "none"
  ) => Promise<{ count: number }>;
  setBlockMode: (mode: "full" | "medium" | "custom" | "none") => Promise<void>;
  disableAllBlocking: () => Promise<void>;
  clearExpiredShabbatBlocking: () => Promise<void>;
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

export type ScreenTimeAuthorizationStatus =
  | "notDetermined"
  | "denied"
  | "approved"
  | "unavailable";

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

const screenTimeError = (
  error: unknown,
  fallbackCode: ShabbatModeErrorCode,
  fallbackMessage: string
): ShabbatModeError => {
  const nativeError =
    error && typeof error === "object"
      ? (error as { code?: string; message?: string })
      : null;
  const denied =
    nativeError?.code === "screen_time_not_authorized" ||
    nativeError?.code === "screen_time_auth_denied";
  return {
    code: denied ? ShabbatModeErrorCode.SCREEN_TIME_DENIED : fallbackCode,
    message: nativeError?.message || fallbackMessage,
  };
};

export const getScreenTimeAuthorizationStatus =
  async (): Promise<ScreenTimeAuthorizationStatus> => {
    ensureIos();
    if (!ScreenTimeModule) {
      return "unavailable";
    }
    try {
      const result = await ensureModule().getAuthorizationStatus();
      return result.status;
    } catch (error) {
      throw screenTimeError(
        error,
        ShabbatModeErrorCode.BLOCKING_FAILED,
        "Could not check Screen Time access."
      );
    }
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
  } catch (error) {
    throw screenTimeError(
      error,
      ShabbatModeErrorCode.SCREEN_TIME_DENIED,
      "Screen Time permission could not be granted."
    );
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
  } catch (error) {
    throw screenTimeError(
      error,
      ShabbatModeErrorCode.BLOCKING_FAILED,
      "Failed to enable Screen Time blocking."
    );
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
  } catch (error) {
    throw screenTimeError(
      error,
      ShabbatModeErrorCode.BLOCKING_FAILED,
      "Failed to enable selected Screen Time blocking."
    );
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
  } catch (error) {
    throw screenTimeError(
      error,
      ShabbatModeErrorCode.BLOCKING_FAILED,
      "Failed to enable selected Screen Time blocking."
    );
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
  } catch (error) {
    throw screenTimeError(
      error,
      ShabbatModeErrorCode.BLOCKING_FAILED,
      "Failed to save the Screen Time block level."
    );
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

export const clearExpiredShabbatBlocking = async (): Promise<void> => {
  ensureIos();
  if (!ScreenTimeModule) {
    return;
  }
  try {
    await ensureModule().clearExpiredShabbatBlocking();
  } catch (error) {
    throw screenTimeError(
      error,
      ShabbatModeErrorCode.BLOCKING_FAILED,
      "Failed to clear expired Shabbat blocking."
    );
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
  } catch (error) {
    throw screenTimeError(
      error,
      ShabbatModeErrorCode.BLOCKING_FAILED,
      "Failed to schedule Screen Time block."
    );
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
