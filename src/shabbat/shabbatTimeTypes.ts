export type ShabbatTimes = {
  shabbatStart: Date;
  shabbatEnd: Date;
  cityName: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  source: "api";
  fetchedAt: Date;
  parsha?: string | null;
};

export enum ShabbatTimeErrorCode {
  LOCATION_DENIED = "LOCATION_DENIED",
  API_FAILED = "API_FAILED",
  INVALID_RESPONSE = "INVALID_RESPONSE",
  NETWORK_ERROR = "NETWORK_ERROR",
  UNKNOWN = "UNKNOWN",
}

export type ShabbatTimeError = {
  code: ShabbatTimeErrorCode;
  message: string;
};

export type ShabbatTimesCacheRecord = {
  shabbatStartIso: string;
  shabbatEndIso: string;
  cityName: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  source: "api";
  fetchedAtIso: string;
  parsha?: string | null;
  locationHash: string;
};
