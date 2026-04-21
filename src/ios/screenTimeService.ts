import { NativeModules, Platform } from "react-native";
import {
  ShabbatModeError,
  ShabbatModeErrorCode,
} from "../shabbatMode/shabbatModeTypes";

type ScreenTimeNativeModule = {
  requestAuthorization: () => Promise<boolean>;
  enableFullAppBlocking: () => Promise<void>;
  disableAllBlocking: () => Promise<void>;
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
