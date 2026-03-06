export enum ReminderType {
  MODEH_ANI = "MODEH_ANI",
  TEFILLIN = "TEFILLIN",
  SHABBAT_PREP = "SHABBAT_PREP",
}

export type ReminderConfig = {
  type: ReminderType;
  enabled: boolean;
  time: string; // "HH:mm" local wall time
  title: string;
  body: string;
  metadata?: Record<string, string>;
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
