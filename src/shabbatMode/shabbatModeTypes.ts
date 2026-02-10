export enum ShabbatModeStatus {
  INACTIVE = "INACTIVE",
  ACTIVE = "ACTIVE",
  BROKEN = "BROKEN",
}

export type ShabbatModeConfig = {
  enabled: boolean;
  blockAllApps: boolean;
  allowedApps: string[];
};

export type ShabbatModeState = {
  status: ShabbatModeStatus;
  startedAt: Date | null;
  endedAt: Date | null;
  brokenAt: Date | null;
};

export enum ShabbatModeErrorCode {
  SCREEN_TIME_DENIED = "SCREEN_TIME_DENIED",
  SCHEDULING_FAILED = "SCHEDULING_FAILED",
  BLOCKING_FAILED = "BLOCKING_FAILED",
}

export type ShabbatModeError = {
  code: ShabbatModeErrorCode;
  message: string;
};

export type ShabbatModePersistedState = {
  state: ShabbatModeState;
  weekId: string | null;
  streakBroken: boolean;
  updatedAtIso: string;
};
