# Module 2: Location & Shabbat Times (iOS-only)

This document defines the technical requirements, architecture, and
implementation details for Module 2 of the "Kesher" iOS app.
Scope is limited to location, Shabbat time retrieval, caching, and data
exposure for other modules.

## Goals
- Determine the user’s city-level location (privacy-first).
- Fetch accurate Shabbat start/end times via Hebcal.
- Normalize and cache times for weekly reuse.
- Provide a clean API for future modules (scheduler/reminders).

## Non-Negotiable Constraints
- React Native (bare workflow), iOS-only behavior.
- TypeScript with strict type checking (no `any`).
- Fetch API (or axios).
- No Expo APIs.
- No native Swift code required.
- No background tasks.
- No UI components calling `fetch` directly.
- No Android code paths.
- No auth assumptions.
- No hardcoded cities.

## File Structure (to be created)
```
/src
  /shabbat
    shabbatTimeService.ts
    shabbatTimeTypes.ts
    shabbatTimeCache.ts
  /location
    locationService.ts
    locationTypes.ts
  /hooks
    useShabbatTimes.ts
```

## Location Requirements (Privacy-First)

### Permissions
- Request **approximate location only** (iOS reduced accuracy).
- Use iOS Core Location through a JS library (no native code in this module).
- No background location.
- No continuous tracking.

### Behavior
1. On first use: request location permission.
2. If granted: fetch latitude & longitude (city-level).
3. If denied: require manual city input (manual override).
4. Persist:
   - latitude
   - longitude
   - timezone
   - source ("gps" | "manual")

Location refresh triggers:
- First app launch.
- User explicitly refreshes.
- Timezone changes.

## Location Service API
`locationService.ts` must expose:
- `getCurrentLocation(): Promise<LocationResult>`
- `requestLocationPermission(): Promise<LocationPermissionStatus>`
- `setManualLocation(city: string, lat: number, lon: number, tz: string): void`

Define strong types in `locationTypes.ts`.

Suggested types:
```
type LocationSource = "gps" | "manual";

type LocationPermissionStatus =
  | "granted"
  | "denied"
  | "undetermined";

type LocationResult = {
  city: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  source: LocationSource;
  fetchedAt: Date;
};
```

## Shabbat Time API (Locked)
Use **Hebcal Shabbat API** (free, no key):
```
https://www.hebcal.com/shabbat
```
Required query params:
- `cfg=json`
- `latitude`
- `longitude`
- `tzid`

Do not use any other Jewish calendar API.

## Shabbat Time Data Requirements
From Hebcal response, extract:
- Candle lighting time (Shabbat start)
- Havdalah time (Shabbat end)
- Parsha name (optional, but supported)

Normalize all times to:
- JavaScript `Date`
- Local timezone

Single source-of-truth type (in `shabbatTimeTypes.ts`):
```
type ShabbatTimes = {
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
```

## Shabbat Time Service
`shabbatTimeService.ts` must expose:
- `getShabbatTimes(location: LocationResult): Promise<ShabbatTimes>`

### Behavior
1. Accept location input.
2. Build Hebcal request.
3. Fetch API response.
4. Validate response shape.
5. Convert times to `Date`.
6. Return fully typed `ShabbatTimes`.

Fail fast on malformed API responses.

## Caching Strategy
Create `shabbatTimeCache.ts`.

Rules:
- Cache Shabbat times locally (AsyncStorage or MMKV).
- Cache is valid for one Shabbat week only.
- Cache invalidation if:
  - Location changes.
  - Timezone changes.
  - Cache is older than 7 days.

Expose:
- `getCachedShabbatTimes(): Promise<ShabbatTimes | null>`
- `setCachedShabbatTimes(times: ShabbatTimes): Promise<void>`
- `clearCache(): Promise<void>`

Implementation notes:
- Store cache metadata including `fetchedAt`, `timezone`, and a location hash
  (e.g., `lat|lon|tz`) to validate quickly.
- Use ISO strings when persisting `Date` objects.

## Hook: useShabbatTimes
Create `useShabbatTimes.ts`.

Responsibilities:
- Load cached times immediately (if valid).
- Fetch fresh times if cache invalid or missing.
- Expose:
```
{
  shabbatTimes: ShabbatTimes | null
  loading: boolean
  error: ShabbatTimeError | null
  refresh(): Promise<void>
}
```

No UI logic beyond state exposure.

## Error Handling
Define typed errors (in `shabbatTimeTypes.ts`):
```
enum ShabbatTimeErrorCode {
  LOCATION_DENIED = "LOCATION_DENIED",
  API_FAILED = "API_FAILED",
  INVALID_RESPONSE = "INVALID_RESPONSE",
  NETWORK_ERROR = "NETWORK_ERROR"
}

type ShabbatTimeError = {
  code: ShabbatTimeErrorCode;
  message: string;
};
```

Errors must be:
- Typed
- UI-agnostic
- Logged, not swallowed

## Reasonable Engineering Decisions
- Use AsyncStorage for cache persistence (RN stable and widely supported).
- Use local timezone detection via `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Validate Hebcal response by matching known item titles (e.g., "Candle lighting",
  "Havdalah") to avoid parsing incorrect events.

## Testing Guidance (Not Implementation)
- Location permission grant/deny flows.
- Manual location override and cache invalidation.
- Hebcal API response parsing with malformed response handling.
- Cache validity boundaries (within 7 days vs. expired).
- Timezone change detection logic.
