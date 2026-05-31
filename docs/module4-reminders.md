# Module 4: Reminder Engine (iOS-only)

This document defines the technical requirements, architecture, and
implementation details for Module 4 of the "Kesher" iOS app.
Scope is limited to deterministic local reminder scheduling and cancellation.

Module 3 (Shabbat Mode Engine) is assumed to already exist and run.

## Goals
- Schedule deterministic, one-shot reminders for upcoming occurrences.
- Never schedule reminders during Shabbat.
- Keep all reminder logic UI-agnostic and TypeScript strict.
- Support DEV MODE stubs without changing business APIs.
- Prevent duplicate notifications by deterministic IDs + cancel-before-schedule.

## Non-Negotiable Constraints
- iOS-only behavior.
- React Native (bare workflow).
- TypeScript strict mode (no `any`).
- No Expo APIs.
- No Android code paths.
- No background polling.
- No `setInterval` loops.
- No hardcoded dates.
- No Shabbat-time fetching in this module.

## Dependency Contract (Module 2 + Module 3 + Module 4)

### Module 2 -> Module 4 (Required)
Module 4 consumes `ShabbatTimes` from Module 2 as input. It does not fetch API
data directly.

Input contract:
- `shabbatStart: Date`
- `shabbatEnd: Date`
- `timezone: string`

### Module 3 -> Module 4 (Required Integration Rules)
Module 3 owns Shabbat mode enforcement and lifecycle. Module 4 must not:
- enable/disable blocking
- call Screen Time APIs
- mutate Shabbat mode state

Module 4 may consume read-only state from Module 3 when needed (for guardrails),
but scheduling decisions are time-window based using `ShabbatTimes`.

### Orchestration Ownership (App Layer)
A top-level coordinator (App/bootstrap layer) orchestrates module calls:
1. Resolve location + fresh/valid `ShabbatTimes` (Module 2).
2. Schedule/cancel Shabbat mode window (Module 3).
3. Schedule reminders for next valid occurrence (Module 4).

No module-to-module side effects should create circular dependencies.

## File Structure (to be created)
```
/src
  /reminders
    reminderScheduler.ts
    reminderTypes.ts
    reminderState.ts           // optional, local id/time bookkeeping
  /ios
    notificationsService.ts    // already present; transport layer
```

## Core Types (Single Source of Truth)
`reminderTypes.ts`
```
enum ReminderType {
  MODEH_ANI = "MODEH_ANI",
  TEFILLIN = "TEFILLIN",
  SHABBAT_PREP = "SHABBAT_PREP"
}

type ReminderConfig = {
  type: ReminderType
  enabled: boolean
  time: string            // "HH:mm" local wall time
  title: string
  body: string
  metadata?: Record<string, string>
}

enum ReminderErrorCode {
  PERMISSION_DENIED = "PERMISSION_DENIED",
  SCHEDULING_FAILED = "SCHEDULING_FAILED",
  INVALID_CONFIG = "INVALID_CONFIG"
}

type ReminderError = {
  code: ReminderErrorCode
  message: string
}
```

## Public API (Module 4)
`reminderScheduler.ts`
```
scheduleNextReminder(config: ReminderConfig, shabbatTimes: ShabbatTimes): Promise<void>
cancelReminder(type: ReminderType): Promise<void>
cancelAllReminders(): Promise<void> // optional convenience API
```

Rules:
- `scheduleNextReminder` schedules exactly one future occurrence.
- `cancelReminder` is id-based and deterministic.
- Repeating schedules are disallowed in business logic.

## Deterministic Notification Identity
Reminder notification IDs must be deterministic:
```
reminder:${ReminderType}
```

Examples:
- `reminder:MODEH_ANI`
- `reminder:TEFILLIN`

No random IDs, UUIDs, timestamp suffixes, or per-launch entropy.

## Scheduling Algorithm (Deterministic)
Given:
- `config.time` in `HH:mm`
- local timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`
- current local date/time
- `shabbatTimes.shabbatStart` / `shabbatTimes.shabbatEnd`

Algorithm:
1. If `config.enabled === false`, return without scheduling.
2. Parse `HH:mm`; fail with `INVALID_CONFIG` if malformed.
3. Build candidate date for today at `HH:mm` (local timezone semantics).
4. If candidate is not in the future, move candidate to tomorrow same time.
5. If candidate falls in Shabbat window, shift by +1 day and recheck.
6. Loop max 7 iterations to avoid infinite loops.
7. Cancel existing reminder ID before scheduling the new candidate.
8. Schedule exactly one notification.

## Shabbat Window Rules (Critical)
Reminder is considered inside Shabbat when:
```
shabbatStart <= candidate < shabbatEnd
```

Boundary behavior:
- `candidate === shabbatStart` -> invalid (must skip)
- `candidate === shabbatEnd` -> valid

This preserves deterministic behavior at exact boundaries.

## Module 3 / Module 4 Conflict Rules
To avoid contradictory behavior while Shabbat Mode is active:
- If candidate time is during Shabbat window, Module 4 must skip to next day.
- Module 4 does not disable or alter Mode state when scheduling fails.
- Reminder failures must never block Module 3 scheduling/enforcement.

Recommended orchestration policy:
- Treat Module 3 as safety-critical path.
- Treat Module 4 as non-critical path with typed surfaced errors.

## Transport Layer Contract (`notificationsService`)
Module 4 calls the notification wrapper only; no native APIs directly.

Required transport capabilities:
- request permission
- schedule one-shot notification by deterministic `id`
- cancel notification by `id` (preferred), or documented fallback strategy

If existing transport only supports cancel-all, either:
- extend transport with id-based cancel for Module 4, or
- persist ownership metadata so cancel-all does not remove unrelated schedules.

## Error Handling
No silent failures.

Map failures into typed `ReminderError`:
- permission denied -> `PERMISSION_DENIED`
- schedule/cancel operation failure -> `SCHEDULING_FAILED`
- invalid time/config -> `INVALID_CONFIG`

Errors should be logged with context (`type`, candidate ISO/timezone) and
re-thrown as typed errors for caller decisions.

## DEV MODE Compatibility
DEV MODE behavior is provided by the existing notifications stub.

Module 4 rules in DEV MODE:
- same deterministic ID and date math as production
- same cancel-before-schedule behavior
- same typed error mapping
- no API shape changes to transport wrapper

## Persistence (Optional but Recommended)
Optional `reminderState.ts` may store:
- last scheduled candidate ISO
- reminder ID
- timezone used
- updatedAt

Use cases:
- debugging deterministic behavior
- fast duplicate checks during app restart

This state must not be source-of-truth over deterministic recomputation.

## Testing Guidance (Not Implementation)
- Schedules today when time is later than now.
- Schedules tomorrow when today's time is already passed.
- Skips Saturday morning candidates inside Shabbat.
- Accepts candidates exactly at `shabbatEnd`.
- Rejects/throws on invalid `HH:mm` input.
- Repeated scheduling keeps single reminder ID without duplicates.
- DEV MODE stub failure toggles map to typed `ReminderError`.
- Boot order where Module 3 succeeds and Module 4 fails keeps Mode intact.

## Reasonable Engineering Decisions
- Keep reminder decision logic pure and deterministic.
- Keep transport concerns isolated in `notificationsService`.
- Keep module dependency direction one-way:
  - Module 4 depends on Module 2 data + optional Module 3 read-only state.
  - Module 3 never depends on Module 4.
