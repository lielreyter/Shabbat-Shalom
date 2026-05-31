# Module 3: Shabbat Mode Engine (iOS-only)

This document defines the technical requirements, architecture, and
implementation details for Module 3 of the "Kesher" iOS app.
Scope is limited to Shabbat Mode scheduling, enforcement, intent flow,
and streak state transitions.

## Goals
- Automatically start/end Shabbat Mode based on Shabbat times.
- Enforce app restrictions using iOS Screen Time APIs.
- Implement a “pause and think” intent flow before breaking Shabbat.
- Update streak state deterministically when Shabbat is kept or broken.
- Provide clean, UI-agnostic APIs for future modules.

## Non-Negotiable Constraints
- iOS-only behavior.
- React Native (bare workflow).
- TypeScript strict mode (no `any`).
- Uses iOS Screen Time APIs via native modules (FamilyControls, DeviceActivity, ManagedSettings).
- No Expo APIs.
- No UI components inside this module.
- No background services beyond iOS-supported scheduling.
- No hardcoded dates or times.
- No emergency override button.
- No Android code paths.
- No auth or location logic in this module.

## File Structure (to be created)
```
/src
  /shabbatMode
    shabbatModeService.ts
    shabbatModeScheduler.ts
    shabbatModeTypes.ts
    shabbatModeState.ts
    shabbatIntentFlow.ts
  /ios
    screenTimeService.ts
  /hooks
    useShabbatMode.ts
```

## Core Types (Single Source of Truth)
`shabbatModeTypes.ts`
```
enum ShabbatModeStatus {
  INACTIVE = "INACTIVE",
  ACTIVE = "ACTIVE",
  BROKEN = "BROKEN"
}

type ShabbatModeConfig = {
  enabled: boolean
  blockAllApps: boolean
  allowedApps: string[] // usually empty
}

type ShabbatModeState = {
  status: ShabbatModeStatus
  startedAt: Date | null
  endedAt: Date | null
  brokenAt: Date | null
}
```

## Error Handling
Define:
```
enum ShabbatModeErrorCode {
  SCREEN_TIME_DENIED = "SCREEN_TIME_DENIED",
  SCHEDULING_FAILED = "SCHEDULING_FAILED",
  BLOCKING_FAILED = "BLOCKING_FAILED"
}

type ShabbatModeError = {
  code: ShabbatModeErrorCode
  message: string
}
```

Errors must be typed, logged, and never silently ignored.

## Screen Time Integration (iOS)
`screenTimeService.ts`

Responsibilities:
- Request Screen Time authorization.
- Apply app/category restrictions.
- Remove restrictions.

Expose:
- `requestScreenTimePermission(): Promise<boolean>`
- `enableFullAppBlocking(): Promise<void>`
- `disableAllBlocking(): Promise<void>`

Rules:
- If permission is denied, Shabbat Mode cannot activate.
- Fail loudly (typed error) if restrictions cannot be applied.

## Shabbat Mode Scheduler
`shabbatModeScheduler.ts`

Inputs:
- `ShabbatTimes` (from Module 2)

Responsibilities:
- Schedule Shabbat Mode start at candle lighting.
- Schedule Shabbat Mode end at havdalah.
- Use iOS-safe scheduling only (no polling loops).

Expose:
- `scheduleShabbatMode(times: ShabbatTimes): Promise<void>`
- `cancelScheduledShabbatMode(): Promise<void>`

Behavior:
- Scheduling must be recalculated weekly.
- Reschedule if Shabbat times change.
- No assumptions about app being open.

## Shabbat Mode Service (Core Brain)
`shabbatModeService.ts`

Expose:
- `startShabbatMode(): Promise<void>`
- `endShabbatMode(): Promise<void>`
- `attemptBreakShabbat(): Promise<"ALLOWED" | "CANCELED">`
- `getCurrentState(): ShabbatModeState`

### Start Behavior
- Verify Screen Time permission.
- Enable full app blocking.
- Persist state:
  - `status = ACTIVE`
  - `startedAt = now`
- Lock streak for the week.

### End Behavior
- Disable all app blocking.
- Persist:
  - `status = INACTIVE`
  - `endedAt = now`
- If not broken → streak continues.

## Intent + Delay Flow (Critical UX Feature)
`shabbatIntentFlow.ts`

Expose:
- `runIntentFlow(): Promise<"PROCEED" | "ABORT">`

Flow:
- Display user’s saved Shabbat intent text.
- Require user to:
  - Read intent.
  - Complete a 10-breath delay (timed, not skippable).
  - Confirm: “Do you still want to break Shabbat?”

Outcomes:
- ABORT → return to Shabbat Mode.
- PROCEED → break Shabbat.

No UI is implemented here; this module only defines the flow contract.

## Breaking Shabbat (Streak Logic)
`attemptBreakShabbat()`
- Run intent flow.
- If user aborts → do nothing.
- If user proceeds:
  - Disable all app blocking.
  - Mark state as:
    - `status = BROKEN`
    - `brokenAt = now`
  - Invalidate current streak.
  - Persist immediately.

There is no instant override.

## State Persistence
`shabbatModeState.ts`

Persist locally:
- Current Shabbat Mode state.
- Week identifier.
- Whether streak was broken.

Rules:
- State must survive app restarts.
- State must be recoverable on launch.
- Local state is the source of truth during Shabbat.

## Hook API
`useShabbatMode.ts`
Expose to UI:
```
{
  status: ShabbatModeStatus
  isActive: boolean
  start(): Promise<void>
  end(): Promise<void>
  breakShabbat(): Promise<void>
}
```

Rules:
- UI never touches Screen Time APIs directly.
- UI never manipulates state directly.

## iOS Capability Reality Check
Third-party apps cannot lock the entire phone, but can:
- Block user-selectable apps.
- Block categories (games, social, entertainment, etc.).
- Block Safari and web access.

This module assumes usage of:
- `FamilyControls`
- `DeviceActivity`
- `ManagedSettings`

These APIs require proper iOS entitlements and native configuration.

## Engineering Principles
- Deterministic behavior > flexibility.
- Shabbat Mode must be hard to break, but always possible.
- No shame UX, no forced lockouts.
- Respect iOS privacy + App Store rules.
- No reliance on willpower alone.

## Testing Guidance (Not Implementation)
- Shabbat Mode auto-starts at candle lighting.
- Apps are blocked correctly.
- Intent flow cannot be skipped.
- Breaking Shabbat always breaks streak.
- Mode auto-ends at havdalah.
- State survives device restart during Shabbat.

## Reasonable Engineering Decisions
- Use local persistence (AsyncStorage/MMKV) for Shabbat Mode state.
- Keep scheduling logic separate from enforcement logic.
- Expose intent flow as a contract to allow UI implementation later.
