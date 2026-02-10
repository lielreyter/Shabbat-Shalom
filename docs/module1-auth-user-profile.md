# Module 1: Authentication & User Profile (iOS-only)

This document defines the technical requirements, architecture, and
implementation details for Module 1 of the "Shabbat Shalom" iOS app.
Scope is limited to authentication and user profile management.

## Goals
- Authenticate users using Sign in with Apple (primary).
- Create and manage a user profile document in Firestore.
- Persist auth state across app restarts.
- Expose a reusable auth API for the rest of the app.

## Non-Negotiable Constraints
- React Native (bare workflow), iOS-only behavior.
- TypeScript with strict type checking (no `any`).
- Firebase v10+ modular SDK only.
- Apple Sign-In required (App Store compliance).
- Firestore is the primary database.
- Local persistence via MMKV or AsyncStorage (no Expo APIs).
- No inline Firebase calls in UI components.
- No hardcoded secrets or credentials.
- Do not implement other modules.

## Auth Error Model (Optional, Recommended)
To keep UI clean and avoid leaking provider-specific errors, define a small
error model for auth flows:

```
enum AuthErrorCode {
  CANCELED = "CANCELED",
  NETWORK = "NETWORK",
  UNAUTHORIZED = "UNAUTHORIZED",
  UNKNOWN = "UNKNOWN"
}

type AuthError = {
  code: AuthErrorCode
  message: string
}
```

Why this matters:
- Prevents Firebase error strings leaking into UI.
- Makes UX decisions explicit and consistent.
- Future-proofs retries, analytics, and observability.

## File Structure (to be created)
```
/src
  /auth
    authService.ts
    appleAuth.ts
    authContext.tsx
  /firebase
    firebaseConfig.ts
    firestore.ts
  /types
    UserProfile.ts
```

## Firestore User Profile Schema
TypeScript interface (single source of truth), enforced everywhere.

```
UserProfile {
  uid: string
  createdAt: Timestamp
  lastLoginAt: Timestamp

  displayName: string | null
  email: string | null

  shabbatIntentText: string | null
  wantsMorningReminders: boolean

  timeZone: string
  platform: "ios"

  currentStreak: number
  longestStreak: number

  congregationId: string | null
}
```

Defaults:
- shabbatIntentText = null
- wantsMorningReminders = true
- currentStreak = 0
- longestStreak = 0
- congregationId = null

## Architecture Overview

### Layers
- `firebaseConfig.ts`: Initializes Firebase and exports `auth` and `firestore`.
- `firestore.ts`: Helper functions for user profile documents.
- `appleAuth.ts`: Apple Sign-In flow and Firebase credential exchange.
- `authService.ts`: Core auth API (sign-in, sign-out, current user, subscribe).
- `authContext.tsx`: React Context to expose auth state to UI.
- UI: Minimal screens for loading, sign-in, and logged-in state.

### Responsibilities and Boundaries
- UI components never call Firebase directly.
- `authService.ts` is the single authority for auth state changes.
- `authContext.tsx` subscribes to auth changes and exposes `user` + `loading`.
- Firestore persistence and auth persistence are configured once in `firebaseConfig.ts`.

## Firebase Initialization

### Environment Variables
Firebase configuration must be loaded from environment variables. No secrets
in source control. Required variables:
- FIREBASE_API_KEY
- FIREBASE_AUTH_DOMAIN
- FIREBASE_PROJECT_ID
- FIREBASE_STORAGE_BUCKET
- FIREBASE_MESSAGING_SENDER_ID
- FIREBASE_APP_ID
- FIREBASE_MEASUREMENT_ID (optional)

Source of env vars (iOS):
- `.env` via `react-native-config` or equivalent setup (no hardcoded values).

### Auth Persistence
Use `initializeAuth` with a React Native persistence provider:
- Preferred: `@react-native-async-storage/async-storage`
- Alternative: MMKV (if chosen, wrap in a compatible persistence adapter)

Persistence must be set so auth survives app restarts.

## Apple Sign-In Flow (iOS)

### Library
Use `@invertase/react-native-apple-authentication`.

### Security Requirements
- Generate a random nonce.
- Hash nonce with SHA256.
- Pass hashed nonce to Apple Sign-In request.
- Use the original nonce when creating Firebase OAuth credential.

### Error Handling
Handle:
- Canceled login (no error surfaces to user; return a handled state).
- Network errors and Firebase auth errors.
- Unexpected credential formats (fail fast with a typed error).

### Availability Check
- Check `appleAuth.isSupported` before showing the button.
- If unsupported (simulators, rare devices), fail gracefully with a clear
  non-blocking message.

## Auth Service Contract
`authService.ts` must expose:
- `signInWithApple(): Promise<UserProfile>`
- `signOut(): Promise<void>`
- `getCurrentUser(): UserProfile | null`
- `subscribeToAuthState(callback): Unsubscribe`

#### subscribeToAuthState Details
- Wraps `onAuthStateChanged`.
- Returns the Firebase unsubscribe function.
- The callback receives a hydrated `UserProfile | null` (not raw Firebase User).

### Behavior Details
1. On sign-in:
   - Perform Apple Sign-In.
   - Exchange Apple credential for Firebase credential.
   - Sign in to Firebase Auth.
2. On first login:
   - Create Firestore document at `users/{uid}` with defaults.
3. On subsequent logins:
   - Fetch existing profile.
4. Always:
   - Update `lastLoginAt` on every login.
   - Return a fully typed `UserProfile`.

### Data Consistency
- Use Firestore `serverTimestamp()` for `createdAt` and `lastLoginAt`.
- After create or update, read back the document to return a fully typed object.

## Auth Context
`authContext.tsx` provides:
- `user: UserProfile | null`
- `loading: boolean`
- `signIn(): Promise<void>`
- `signOut(): Promise<void>`

### Behavior
- On mount, subscribe to Firebase auth state changes.
- If a user exists, fetch or restore `UserProfile`.
- While restoring, show a loading state.
- On sign-out, clear local state and call Firebase sign-out.

## Minimal UI Requirements
- Placeholder Sign-In screen.
- Loading state screen while auth is being restored.
- Logged-in screen that displays:
  - `user.displayName`
  - `user.currentStreak`

## Firestore Rules (Recommendation)
Restrict access to user documents:
- Only authenticated users can read/write their own `users/{uid}` doc.

## Testing Guidance (Not Implementation)
- Verify Apple Sign-In success and cancellation flows.
- Verify Firestore doc created on first login.
- Verify `lastLoginAt` updates on subsequent logins.
- Verify auth state persists across app restart.

## Reasonable Engineering Decisions
- Use AsyncStorage persistence for Firebase Auth (RN-native and stable).
- Use `serverTimestamp()` to ensure consistent timestamps.
- Keep auth API surface small and typed to avoid leakage of Firebase internals.
