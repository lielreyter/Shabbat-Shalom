# Dev Mode Stubs Plan (No Apple Entitlements)

This document defines how to keep the app fully runnable in **DEV MODE**
without Apple Developer entitlements. It replaces entitlement‑gated services
with deterministic mocks while preserving module boundaries and business logic.

## Goals
- Run the app end‑to‑end without Apple entitlements.
- Exercise all JS/TS state machines, persistence, scheduling, and hooks.
- Make later native integration a swap of stub files only.

## Constraints
- **DEV MODE = true** (assumed for this phase).
- Keep module boundaries exactly as designed.
- Only replace entitlement‑gated services:
  - Apple Sign‑In (`appleAuth`)
  - Screen Time (`screenTimeService`)
  - Notifications (Module 4)
- No real native APIs or entitlements.
- No changes to business logic or public APIs.

## Stub Strategy (High Level)
1. **Preserve public APIs** in each module.
2. **Mock behavior** inside only the entitlement‑gated services.
3. **Log actions** instead of performing native work.
4. **Return deterministic outcomes** (success/failure) to test flows.
5. Mark stubbed code with:
   - `// DEV MODE STUB — replace with real native implementation`

## Files To Stub

### Module 1 (Auth)
- `src/auth/appleAuth.ts`
  - Stub Apple Sign‑In response
  - Return a fake user profile in a consistent shape
  - Simulate cancel/unauthorized errors via deterministic toggles

### Module 3 (Shabbat Mode)
- `src/ios/screenTimeService.ts`
  - Stub `requestScreenTimePermission` (return `true` by default)
  - Stub `enableFullAppBlocking` / `disableAllBlocking` (log only)

### Module 4 (Morning Reminders)
- `src/ios/notificationsService.ts` (or wherever the notification API is wrapped)
  - Stub permission request
  - Stub schedule/cancel actions (log only)
  - Return deterministic results

## Behavior Requirements (Dev Stubs)

### Apple Sign‑In Stub
- Should return a realistic `idToken`, `rawNonce`, `fullName`, `email`.
- Should allow deterministic failure paths:
  - CANCELED
  - UNAUTHORIZED
  - NETWORK (optional)
- Must preserve `AuthError` shapes.

### Screen Time Stub
- Permission request should return `true` by default.
- Blocking actions should log only.
- Throw typed `ShabbatModeError` on simulated failure.

### Notifications Stub
- Permission request returns `true` by default.
- Schedule/cancel logs only.
- Return success or typed error based on deterministic flags.

## Deterministic Toggle Pattern (Recommended)
Use simple in‑memory toggles to simulate errors:
```
let forceAuthCancel = false
let forceScreenTimeDenied = false
let forceNotificationFailure = false
```

This enables manual testing of error paths without native APIs.

## Success Criteria
- App runs end‑to‑end.
- All modules (1–4) can be exercised manually.
- Business logic remains intact.
- Swapping to real native implementations later only requires
  replacing the stubbed files.

## Next Step (Implementation)
After this doc:
- Implement stubbed services with the exact public APIs.
- Add clear stub comments in each file.
*** End Patch"}}Since no apply_patch tool is allowed before, now we can. Done. need read_lints. But docs no lint. still. use read_lints. Actually required. do. Then respond. Include note. Let's call read_lints. Then final. 
