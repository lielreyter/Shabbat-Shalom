export enum ReminderType {
  MODEH_ANI = "MODEH_ANI",
  TEFILLIN = "TEFILLIN",
  SHEMA = "SHEMA",
  SHABBAT_PREP = "SHABBAT_PREP",
  SHABBAT_END = "SHABBAT_END",
}

export type ReminderConfig = {
  type: ReminderType;
  enabled: boolean;
  time: string; // "HH:mm" local wall time
  title: string;
  body: string;
  metadata?: Record<string, string>;
  // Weekday numbers to skip (0 = Sunday … 6 = Saturday). Used to skip
  // Shabbat-day for tefillin even when shabbatTimes are missing/stale.
  skipWeekdays?: number[];
};

export enum ReminderErrorCode {
  PERMISSION_DENIED = "PERMISSION_DENIED",
  SCHEDULING_FAILED = "SCHEDULING_FAILED",
  INVALID_CONFIG = "INVALID_CONFIG",
}

export type ReminderError = {
  code: ReminderErrorCode;
  message: string;
};
