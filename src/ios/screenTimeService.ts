import { NativeModules, Platform } from "react-native";
import {
  ShabbatModeError,
  ShabbatModeErrorCode,
} from "../shabbatMode/shabbatModeTypes";
import { DEV_MODE } from "../config/devMode";

type ScreenTimeNativeModule = {
  requestAuthorization: () => Promise<boolean>;
  enableFullAppBlocking: () => Promise<void>;
  disableAllBlocking: () => Promise<void>;
};

const ScreenTimeModule =
  NativeModules.ScreenTimeService as ScreenTimeNativeModule | undefined;

type ScreenTimeStubConfig = {
  forcePermissionDenied: boolean;
  forceEnableFailure: boolean;
  forceDisableFailure: boolean;
};

let stubConfig: ScreenTimeStubConfig = {
  forcePermissionDenied: false,
  forceEnableFailure: false,
  forceDisableFailure: false,
};

// DEV MODE STUB — replace with real native implementation.
export const setScreenTimeStubConfig = (
  next: Partial<ScreenTimeStubConfig>
): void => {
  stubConfig = { ...stubConfig, ...next };
};

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
  if (DEV_MODE) {
    // DEV MODE STUB — replace with real native implementation.
    console.log("DEV MODE STUB — Screen Time permission requested.");
    if (stubConfig.forcePermissionDenied) {
      return false;
    }
    return true;
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
  if (DEV_MODE) {
    // DEV MODE STUB — replace with real native implementation.
    console.log("DEV MODE STUB — Screen Time blocking enabled.");
    if (stubConfig.forceEnableFailure) {
      throw {
        code: ShabbatModeErrorCode.BLOCKING_FAILED,
        message: "Failed to enable Screen Time blocking (stub).",
      } satisfies ShabbatModeError;
    }
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
  if (DEV_MODE) {
    // DEV MODE STUB — replace with real native implementation.
    console.log("DEV MODE STUB — Screen Time blocking disabled.");
    if (stubConfig.forceDisableFailure) {
      throw {
        code: ShabbatModeErrorCode.BLOCKING_FAILED,
        message: "Failed to disable Screen Time blocking (stub).",
      } satisfies ShabbatModeError;
    }
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
