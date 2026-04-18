import { NativeModules } from "react-native";
import { DEV_MODE } from "../config/devMode";

export enum ReminderErrorCode {
  PERMISSION_DENIED = "PERMISSION_DENIED",
  SCHEDULING_FAILED = "SCHEDULING_FAILED",
}

export type ReminderError = {
  code: ReminderErrorCode;
  message: string;
};

type NotificationStubConfig = {
  forcePermissionDenied: boolean;
  forceScheduleFailure: boolean;
  forceCancelFailure: boolean;
};

let stubConfig: NotificationStubConfig = {
  forcePermissionDenied: false,
  forceScheduleFailure: false,
  forceCancelFailure: false,
};

type NotificationNativeModule = {
  requestPermission: () => Promise<boolean>;
  scheduleNotification: (
    id: string,
    title: string,
    body: string,
    isoTime: string,
    metadata: Record<string, string>
  ) => Promise<void>;
  cancelNotificationById: (id: string) => Promise<void>;
  cancelAllNotifications: () => Promise<void>;
};

const NotificationModule =
  NativeModules.NotificationsService as NotificationNativeModule | undefined;

const ensureModule = (): NotificationNativeModule => {
  if (!NotificationModule) {
    throw {
      code: ReminderErrorCode.SCHEDULING_FAILED,
      message: "Notification native module is not installed.",
    } satisfies ReminderError;
  }
  return NotificationModule;
};

// DEV MODE STUB — replace with real native implementation.
export const setNotificationStubConfig = (
  next: Partial<NotificationStubConfig>
): void => {
  stubConfig = { ...stubConfig, ...next };
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (DEV_MODE) {
    console.log("DEV MODE STUB — notification permission requested.");
    return !stubConfig.forcePermissionDenied;
  }
  try {
    return await ensureModule().requestPermission();
  } catch {
    throw {
      code: ReminderErrorCode.PERMISSION_DENIED,
      message: "Failed to request notification permission.",
    } satisfies ReminderError;
  }
};

export const scheduleDailyNotification = async (
  id: string,
  title: string,
  body: string,
  time: string,
  metadata: Record<string, string>
): Promise<void> => {
  if (DEV_MODE) {
    console.log("DEV MODE STUB — schedule notification:", {
      id,
      title,
      body,
      time,
      metadata,
    });
    if (stubConfig.forceScheduleFailure) {
      throw {
        code: ReminderErrorCode.SCHEDULING_FAILED,
        message: "Failed to schedule notification (stub).",
      } satisfies ReminderError;
    }
    return;
  }
  try {
    await ensureModule().scheduleNotification(id, title, body, time, metadata);
  } catch {
    throw {
      code: ReminderErrorCode.SCHEDULING_FAILED,
      message: "Failed to schedule notification.",
    } satisfies ReminderError;
  }
};

export const cancelNotificationById = async (id: string): Promise<void> => {
  if (DEV_MODE) {
    console.log("DEV MODE STUB — cancel notification by id:", id);
    if (stubConfig.forceCancelFailure) {
      throw {
        code: ReminderErrorCode.SCHEDULING_FAILED,
        message: "Failed to cancel notification (stub).",
      } satisfies ReminderError;
    }
    return;
  }
  try {
    await ensureModule().cancelNotificationById(id);
  } catch {
    throw {
      code: ReminderErrorCode.SCHEDULING_FAILED,
      message: "Failed to cancel notification.",
    } satisfies ReminderError;
  }
};

export const cancelAllNotifications = async (): Promise<void> => {
  if (DEV_MODE) {
    console.log("DEV MODE STUB — cancel all notifications.");
    if (stubConfig.forceCancelFailure) {
      throw {
        code: ReminderErrorCode.SCHEDULING_FAILED,
        message: "Failed to cancel notifications (stub).",
      } satisfies ReminderError;
    }
    return;
  }
  try {
    await ensureModule().cancelAllNotifications();
  } catch {
    throw {
      code: ReminderErrorCode.SCHEDULING_FAILED,
      message: "Failed to cancel notifications.",
    } satisfies ReminderError;
  }
};
