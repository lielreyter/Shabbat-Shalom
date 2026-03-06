import { ShabbatTimes } from "../shabbat/shabbatTimeTypes";
import {
  ReminderConfig,
  ReminderError,
  ReminderErrorCode,
  ReminderType,
} from "./reminderTypes";
import {
  cancelAllNotifications,
  cancelNotificationById,
  requestNotificationPermission,
  scheduleDailyNotification,
} from "../ios/notificationsService";

const MAX_SHIFT_DAYS = 7;

const buildNotificationId = (type: ReminderType): string =>
  `reminder:${type}`;

const parseHHMM = (
  time: string
): { hours: number; minutes: number } | null => {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return { hours, minutes };
};

const buildCandidateDate = (
  hours: number,
  minutes: number,
  dayOffset: number
): Date => {
  const now = new Date();
  const candidate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + dayOffset,
    hours,
    minutes,
    0,
    0
  );
  return candidate;
};

const isInsideShabbat = (
  candidate: Date,
  shabbatTimes: ShabbatTimes
): boolean => {
  const t = candidate.getTime();
  return (
    t >= shabbatTimes.shabbatStart.getTime() &&
    t < shabbatTimes.shabbatEnd.getTime()
  );
};

const findNextValidCandidate = (
  hours: number,
  minutes: number,
  shabbatTimes: ShabbatTimes
): Date | null => {
  const now = Date.now();

  for (let offset = 0; offset <= MAX_SHIFT_DAYS; offset++) {
    const candidate = buildCandidateDate(hours, minutes, offset);
    if (candidate.getTime() <= now) {
      continue;
    }
    if (isInsideShabbat(candidate, shabbatTimes)) {
      continue;
    }
    return candidate;
  }
  return null;
};

export const scheduleNextReminder = async (
  config: ReminderConfig,
  shabbatTimes: ShabbatTimes
): Promise<void> => {
  if (!config.enabled) {
    return;
  }

  const parsed = parseHHMM(config.time);
  if (!parsed) {
    throw {
      code: ReminderErrorCode.INVALID_CONFIG,
      message: `Invalid time format: "${config.time}". Expected HH:mm.`,
    } satisfies ReminderError;
  }

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    throw {
      code: ReminderErrorCode.PERMISSION_DENIED,
      message: "Notification permission denied.",
    } satisfies ReminderError;
  }

  const candidate = findNextValidCandidate(
    parsed.hours,
    parsed.minutes,
    shabbatTimes
  );
  if (!candidate) {
    throw {
      code: ReminderErrorCode.SCHEDULING_FAILED,
      message: "Could not find a valid time slot for this reminder.",
    } satisfies ReminderError;
  }

  const id = buildNotificationId(config.type);
  await scheduleDailyNotification(
    id,
    config.title,
    config.body,
    candidate.toISOString(),
    config.metadata ?? {}
  );
};

export const cancelReminder = async (type: ReminderType): Promise<void> => {
  const id = buildNotificationId(type);
  await cancelNotificationById(id);
};

export const cancelAllReminders = async (): Promise<void> => {
  await cancelAllNotifications();
};
