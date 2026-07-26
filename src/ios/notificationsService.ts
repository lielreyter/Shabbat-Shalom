import { NativeModules } from "react-native";

export enum ReminderErrorCode {
  PERMISSION_DENIED = "PERMISSION_DENIED",
  SCHEDULING_FAILED = "SCHEDULING_FAILED",
}

export type ReminderError = {
  code: ReminderErrorCode;
  message: string;
};

type NotificationNativeModule = {
  requestPermission: () => Promise<boolean>;
  getPermissionStatus: () => Promise<NotificationPermissionStatus>;
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

export type NotificationPermissionStatus =
  | "notDetermined"
  | "denied"
  | "authorized";

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

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!NotificationModule) {
    console.warn("NotificationsService native module not available.");
    return false;
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

export const getNotificationPermissionStatus =
  async (): Promise<NotificationPermissionStatus> => {
    if (!NotificationModule) {
      return "denied";
    }
    try {
      return await ensureModule().getPermissionStatus();
    } catch {
      return "denied";
    }
  };

export const scheduleDailyNotification = async (
  id: string,
  title: string,
  body: string,
  time: string,
  metadata: Record<string, string>
): Promise<void> => {
  if (!NotificationModule) {
    console.warn("NotificationsService native module not available — skipping schedule.");
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
  if (!NotificationModule) {
    console.warn("NotificationsService native module not available — skipping cancel.");
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
  if (!NotificationModule) {
    console.warn("NotificationsService native module not available — skipping cancel all.");
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
