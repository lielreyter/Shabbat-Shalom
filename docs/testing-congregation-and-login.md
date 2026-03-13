# Testing Guide: Congregation + Login

This document provides a practical test checklist for validating:
- Login flows (Apple, Google, Email/Password, Phone OTP)
- Congregation flows (discover, create, join, leave, approvals, membership updates)

Use this before releases and after any authentication or congregation changes.

## Scope

Features covered:
- Firebase Auth integration from app login screen
- Firestore profile hydration on login
- Firestore-backed congregation data and membership behavior

Out of scope:
- Push notifications and reminder scheduling
- Restriction engine and Shabbat mode logic

## Preconditions

- Firebase project is configured and reachable.
- Firestore is enabled.
- Authentication providers are enabled in Firebase Console:
  - Apple
  - Google
  - Email/Password
  - Phone
- Firestore rules allow authenticated user access for tested paths.
- App `.env` contains valid Firebase keys.
- `GOOGLE_WEB_CLIENT_ID` exists in `.env` for Google login flow.
- Test phone numbers are configured in Firebase Auth console (recommended for QA).

## Test Environments

- iOS simulator (basic UI checks)
- iOS physical device (required for full provider validation, especially phone)
- Optional Android device if multi-platform parity is needed

## Login Test Cases

### L1 - Apple Sign-In success

1. Launch app with signed-out state.
2. Tap "Continue with Apple".
3. Complete Apple prompt.
4. Verify app enters authenticated state.
5. Verify `users/{uid}` exists in Firestore.

Expected:
- User is signed in.
- Profile exists with defaults if first login.
- No auth error shown.

### L2 - Google Sign-In success

1. Launch app signed out.
2. Tap "Continue with Google".
3. Complete Google account selection.
4. Verify authenticated state.
5. Verify profile creation or hydration in Firestore.

Expected:
- Successful sign-in and profile hydration.
- No token/config errors.

### L3 - Email sign-in existing user

1. Enter existing account email/password.
2. Tap "Sign in with Email".

Expected:
- User signs in successfully.
- Existing profile loads.

### L4 - Email registration new user

1. Enter new email/password.
2. Tap "Create Email Account".

Expected:
- Account is created in Firebase Auth.
- Firestore user profile is created.
- User enters app.

### L5 - Email invalid credentials

1. Enter wrong email/password.
2. Tap "Sign in with Email".

Expected:
- Sign-in fails gracefully.
- Error message appears in login screen.
- App remains signed out.

### L6 - Phone send code

1. Enter valid E.164 phone number (example: `+15551234567`).
2. Tap "Send Phone Code".

Expected:
- Verification SMS is sent (or Firebase test code route).
- App shows "Code sent" confirmation.

### L7 - Phone verify success

1. Complete L6.
2. Enter received verification code.
3. Tap "Verify Phone Code".

Expected:
- User signs in successfully.
- Firestore profile is created/hydrated.

### L8 - Phone verify failure

1. Complete L6.
2. Enter invalid verification code.
3. Tap "Verify Phone Code".

Expected:
- Verification fails with user-facing error.
- App remains signed out.

### L9 - Sign out behavior

1. Sign in with any provider.
2. Navigate to account/stats view.
3. Tap "Sign out".

Expected:
- App returns to login screen.
- Protected data is no longer visible until next sign-in.

## Congregation Test Cases

### C1 - Initial congregation list load

1. Sign in.
2. Open congregation tab.

Expected:
- Nearby congregation list loads or clean empty state appears.
- No crash if location is denied.

### C2 - Default congregation bootstrap

1. Ensure `congregations` collection is empty (test project only).
2. Sign in and open congregation flow.

Expected:
- Default congregations are seeded automatically.
- `congregations` documents appear in Firestore.

### C3 - Create congregation

1. Sign in and allow location.
2. Enter congregation name and city.
3. Tap create.

Expected:
- New congregation document appears in Firestore.
- Creator becomes leader and first member.
- User profile `congregationId` is updated.

### C4 - Join OPEN congregation

1. From user B, select an OPEN congregation.
2. Tap join.

Expected:
- User B appears in member list.
- User B profile `congregationId` is set.

### C5 - Join REQUEST congregation

1. Leader sets policy to REQUEST.
2. User B requests join.

Expected:
- User B goes to `pendingUids`.
- User B is not added to `memberUids` yet.

### C6 - Approve join request

1. Leader approves user B.

Expected:
- User B moves from `pendingUids` to `memberUids`.
- User B profile `congregationId` updates correctly.

### C7 - Reject join request

1. Leader rejects user C request.

Expected:
- User C removed from `pendingUids`.
- User C not added to `memberUids`.

### C8 - Leave congregation

1. Member user taps leave congregation.

Expected:
- User removed from `memberUids` and `pendingUids`.
- User profile `congregationId` becomes `null`.

### C9 - Kick member

1. Leader kicks a non-leader member.

Expected:
- Member is removed from congregation arrays.
- Member profile `congregationId` becomes `null`.

### C10 - Unauthorized policy/admin actions

1. Non-leader attempts policy change or approval actions.

Expected:
- Operation fails with clear error.
- Firestore data unchanged.

## Data Validation Checklist (Firestore)

For each successful login:
- `users/{uid}` exists
- `lastLoginAt` updates on new login
- Defaults are present for missing optional fields

For congregation operations:
- `congregations/{id}` fields are consistent:
  - `leaderUid`
  - `joinPolicy`
  - `memberUids`
  - `pendingUids`
- Membership mirrors in `users/{uid}.congregationId`

## Failure and Edge Cases

- Firestore permission denied:
  - Expect user-friendly auth/congregation error.
  - No partial UI crash.
- Offline/network interruption during sign-in:
  - Error shown, state remains consistent.
- Location unavailable:
  - User can still proceed with non-location-dependent actions where applicable.
- Duplicate taps on auth buttons:
  - Loading state prevents duplicate submissions.

## Release Sign-Off Template

Mark each item Pass/Fail before release:

- [ ] Apple login
- [ ] Google login
- [ ] Email sign-in
- [ ] Email registration
- [ ] Phone send code
- [ ] Phone verify
- [ ] Sign out
- [ ] Congregation list load
- [ ] Congregation create
- [ ] Join OPEN
- [ ] Join REQUEST
- [ ] Approve/reject request
- [ ] Leave/kick behavior
- [ ] Firestore data integrity checks
