import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { ShabbatTimes } from "../shabbat/shabbatTimeTypes";
import {
  ShabbatModeError,
  ShabbatModeErrorCode,
} from "./shabbatModeTypes";
import {
  cancelScheduledScreenTimeBlock,
  requestScreenTimePermission,
  scheduleScreenTimeBlock,
} from "../ios/screenTimeService";

const SCHEDULE_STORAGE_KEY = "shabbatMode:schedule";

type ScheduleRecord = {
  startIso: string;
  endIso: string;
  weekId: string;
  timezone: string;
  updatedAtIso: string;
};

const ensureIos = (): void => {
  if (Platform.OS !== "ios") {
    throw {
      code: ShabbatModeErrorCode.SCHEDULING_FAILED,
      message: "Shabbat Mode scheduling is iOS-only.",
    } satisfies ShabbatModeError;
  }
};

const formatDateKey = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const computeWeekId = (times: ShabbatTimes): string => {
  return `${formatDateKey(times.shabbatStart, times.timezone)}|${times.timezone}`;
};

const readScheduleRecord = async (): Promise<ScheduleRecord | null> => {
  const raw = await AsyncStorage.getItem(SCHEDULE_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ScheduleRecord;
  } catch {
    return null;
  }
};

const writeScheduleRecord = async (record: ScheduleRecord): Promise<void> => {
  await AsyncStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(record));
};

export const scheduleShabbatMode = async (
  times: ShabbatTimes
): Promise<void> => {
  ensureIos();

  const weekId = computeWeekId(times);
  const existing = await readScheduleRecord();
  if (
    existing &&
    existing.weekId === weekId &&
    existing.startIso === times.shabbatStart.toISOString() &&
    existing.endIso === times.shabbatEnd.toISOString()
  ) {
    return;
  }

  try {
    const granted = await requestScreenTimePermission();
    if (!granted) {
      throw new Error("Screen Time permission denied.");
    }
    await scheduleScreenTimeBlock("shabbat", times.shabbatStart, times.shabbatEnd);
  } catch {
    console.error("Shabbat Mode scheduling failed.");
    throw {
      code: ShabbatModeErrorCode.SCHEDULING_FAILED,
      message: "Failed to schedule Shabbat Mode.",
    } satisfies ShabbatModeError;
  }

  await writeScheduleRecord({
    startIso: times.shabbatStart.toISOString(),
    endIso: times.shabbatEnd.toISOString(),
    weekId,
    timezone: times.timezone,
    updatedAtIso: new Date().toISOString(),
  });
};

export const cancelScheduledShabbatMode = async (): Promise<void> => {
  ensureIos();
  try {
    await cancelScheduledScreenTimeBlock("shabbat");
  } catch {
    console.error("Failed to cancel Shabbat Mode schedule.");
    throw {
      code: ShabbatModeErrorCode.SCHEDULING_FAILED,
      message: "Failed to cancel Shabbat Mode schedule.",
    } satisfies ShabbatModeError;
  }
  await AsyncStorage.removeItem(SCHEDULE_STORAGE_KEY);
};
