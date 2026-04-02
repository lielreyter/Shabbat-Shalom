# Testing Guide: Module 5A — Bug Fixes & Quick Wins

This document provides a practical test checklist for validating the 5A changes:
- Tefillin double-count fix
- Tefillin reminder default changed to OFF
- Merged wake-up time for Modeh Ani + Tefillin
- Streak auto-break on missed day/week
- Tefillin self-confirm hidden when user has buddies

Use this after the 5A implementation and before starting Module 5B.

## Preconditions

- Firebase project is configured and reachable.
- Firestore is enabled with authenticated user access.
- App `.env` contains valid Firebase keys.
- At least one test user account exists.
- A second test user account is helpful for buddy-related tests.

## Files Changed

| File | Changes |
|------|---------|
| `src/firebase/firestore.ts` | `wantsMorningReminders` defaults to `false` in hydration and creation; added `checkAndBreakStaleStreaks`; added `tefillinBuddyUids` and `buddyChatIds` to hydration and creation |
| `src/types/UserProfile.ts` | Added `tefillinBuddyUids: string[]` and `buddyChatIds: string[]` |
| `App.tsx` | Fresh Firestore read in `onConfirmTefillin`; merged wake-up time picker; `onToggleModehAni` now schedules notification; `onSetWakeTime` reschedules both reminders; `checkAndBreakStaleStreaks` called on auth; tefillin prompt gated behind no buddies |

---

## Test Cases

### 5A1: Tefillin Double-Count Fix

| ID    | Test                            | Steps                                                        | Expected                                             | Pass? |
|-------|---------------------------------|--------------------------------------------------------------|------------------------------------------------------|-------|
| 5A1-1 | Single tap increments once      | 1. Open app as user with `wantsMorningReminders: true` and no buddies. 2. Tap "Yes" on tefillin prompt. 3. Check `tefillinCurrentStreak` in Firestore. | Streak increases by exactly 1. | [ ] |
| 5A1-2 | Rapid double-tap no double-count| 1. Same setup as 5A1-1. 2. Tap "Yes" twice as fast as possible. 3. Check Firestore. | `tefillinCurrentStreak` increased by exactly 1, not 2. | [ ] |
| 5A1-3 | Re-open app same day            | 1. Confirm tefillin. 2. Force-kill app. 3. Reopen app. | Tefillin prompt does NOT appear again. Streak unchanged. | [ ] |
| 5A1-4 | New day shows prompt again      | 1. Confirm tefillin today. 2. Change device date forward by 1 day (or wait). 3. Reopen app. | Prompt reappears. Tapping "Yes" increments streak by 1. | [ ] |

**How it works:** `onConfirmTefillin` now reads the profile fresh from Firestore via `getUserProfile(uid)` before comparing `lastTefillinDate`. The local `setTefillinConfirmedToday(true)` is only an optimistic UI guard — Firestore is the source of truth that prevents double-counting.

---

### 5A2: Tefillin Reminder Default OFF

| ID    | Test                        | Steps                                       | Expected                                    | Pass? |
|-------|-----------------------------|----------------------------------------------|---------------------------------------------|-------|
| 5A2-1 | New user default off        | 1. Create a brand new account (any method). 2. Open the home tab. | Tefillin prompt does NOT appear. `wantsMorningReminders` is `false` in Firestore. | [ ] |
| 5A2-2 | Existing user unaffected    | 1. Login as a user who already had `wantsMorningReminders: true` in Firestore. 2. Open home tab. | Tefillin prompt still appears (existing value preserved). | [ ] |
| 5A2-3 | Toggle on in settings       | 1. As a new user, go to settings. 2. Toggle "Tefillin Reminder" ON. 3. Return to home tab. | Prompt appears on home tab. `wantsMorningReminders` is now `true` in Firestore. | [ ] |

**What changed:** `hydrateUserProfile` now defaults `wantsMorningReminders` to `false` (was `true`). `createUserProfile` also writes `false`. Existing Firestore docs with `true` are read as-is.

---

### 5A3: Merged Wake-Up Time

| ID    | Test                           | Steps                                           | Expected                                     | Pass? |
|-------|--------------------------------|--------------------------------------------------|----------------------------------------------|-------|
| 5A3-1 | Single wake-up time picker     | 1. Go to settings → Daily Practice section. 2. Toggle tefillin reminder ON. 3. Toggle Modeh Ani ON. | Only ONE wake-up time picker visible (not two). | [ ] |
| 5A3-2 | Picker shown for tefillin only | 1. Toggle tefillin ON, Modeh Ani OFF. | Wake-up picker visible. Hint says "Tefillin reminder 15 min after this time". | [ ] |
| 5A3-3 | Picker shown for Modeh Ani only| 1. Toggle Modeh Ani ON, tefillin OFF. | Wake-up picker visible. Hint says "Modeh Ani reminder at this time". | [ ] |
| 5A3-4 | Picker shows combined hint     | 1. Both toggles ON. | Hint says "Modeh Ani at this time, tefillin 15 min later". | [ ] |
| 5A3-5 | Wake time change reschedules   | 1. Both reminders ON. 2. Change wake-up time from 7:00 to 6:30. | Modeh Ani scheduled at 6:30, Tefillin at 6:45. (Check notification schedule if possible.) | [ ] |
| 5A3-6 | Neither on: no picker          | 1. Both toggles OFF. | No wake-up time picker visible. | [ ] |

**What changed:** The Modeh Ani section no longer has its own wake-up time picker. A single shared picker appears below both toggles when either is on. `onToggleModehAni` now schedules/cancels a `MODEH_ANI` notification. `onSetWakeTime` reschedules both reminders. Tefillin is scheduled at `wakeUpTime + 15 minutes`.

---

### 5A4: Streak Auto-Break

| ID    | Test                              | Steps                                               | Expected                                        | Pass? |
|-------|-----------------------------------|------------------------------------------------------|-------------------------------------------------|-------|
| 5A4-1 | Tefillin streak breaks after miss | 1. In Firestore, set user's `lastTefillinDate` to 3+ days ago and `tefillinCurrentStreak` to 5. 2. Open app (triggers `checkAndBreakStaleStreaks`). 3. Check Firestore. | `tefillinCurrentStreak` is now 0. | [ ] |
| 5A4-2 | Tefillin streak survives today    | 1. Confirm tefillin today. 2. Close and reopen app. | Streak unchanged (not reset). | [ ] |
| 5A4-3 | Tefillin streak survives yesterday| 1. In Firestore, set `lastTefillinDate` to yesterday and `tefillinCurrentStreak` to 3. 2. Open app. | Streak stays at 3 (grace period — user may still confirm today). | [ ] |
| 5A4-4 | Shabbat streak breaks after miss  | 1. In Firestore, set `lastStreakWeekId` to a week ID more than 14 days ago and `currentStreak` to 4. 2. Open app. | `currentStreak` resets to 0. | [ ] |
| 5A4-5 | Shabbat streak survives recent    | 1. In Firestore, set `lastStreakWeekId` to last week's ID. 2. Open app. | `currentStreak` unchanged. | [ ] |

**What changed:** `checkAndBreakStaleStreaks(uid)` in `firestore.ts` runs on auth state load. It checks:
- Tefillin: if `lastTefillinDate` is not today or yesterday → reset `tefillinCurrentStreak` to 0.
- Shabbat: if `lastStreakWeekId` is older than 14 days → reset `currentStreak` to 0.

---

### 5A5: Tefillin Self-Confirm Hidden With Buddies

| ID    | Test                               | Steps                                          | Expected                                           | Pass? |
|-------|------------------------------------|-------------------------------------------------|----------------------------------------------------|-------|
| 5A5-1 | No buddies: prompt visible         | 1. User with `tefillinBuddyUids: []` and `wantsMorningReminders: true`. 2. Open home tab before confirming. | "Have you wrapped tefillin today?" prompt appears. | [ ] |
| 5A5-2 | Has buddies: prompt hidden         | 1. In Firestore, add a UID to user's `tefillinBuddyUids`. 2. Open home tab. | Self-confirm prompt does NOT appear. | [ ] |
| 5A5-3 | Has buddies: info banner shown     | 1. Same as 5A5-2. | Blue banner: "Your tefillin streak is tracked through your buddy chats" is shown. | [ ] |
| 5A5-4 | Buddy removed: prompt returns      | 1. Remove all UIDs from `tefillinBuddyUids` in Firestore. 2. Reopen home tab. | Self-confirm prompt appears again. | [ ] |

**What changed:** The home tab tefillin prompt now checks `(user?.tefillinBuddyUids?.length ?? 0) === 0`. If the user has buddies, a blue info banner is shown instead of the tappable prompt. `UserProfile` now includes `tefillinBuddyUids: string[]` and `buddyChatIds: string[]` (hydrated as empty arrays for existing users).

**Note:** Fully populating `tefillinBuddyUids` requires Module 5B. For now, you can manually set values in Firestore to test this behavior.

---

## Data Validation Checklist

After running all tests, verify these in Firestore:

- [ ] `tefillinCurrentStreak` never increments more than once per calendar day
- [ ] New users have `wantsMorningReminders: false`
- [ ] New users have `tefillinBuddyUids: []` and `buddyChatIds: []`
- [ ] Existing users with `wantsMorningReminders: true` keep their value
- [ ] `wakeUpTime` is the single source for both Modeh Ani and Tefillin schedules
- [ ] Stale `tefillinCurrentStreak` resets to 0 when `lastTefillinDate` is older than yesterday
- [ ] Stale `currentStreak` (Shabbat) resets to 0 when `lastStreakWeekId` is older than 14 days
- [ ] `tefillinLongestStreak` is never decreased (only `tefillinCurrentStreak` resets)
- [ ] `longestStreak` (Shabbat) is never decreased (only `currentStreak` resets)

---

## Edge Cases

- **Offline / network interruption during confirm:**
  - Optimistic UI shows confirmed, but Firestore write fails.
  - On next app open, `tefillinConfirmedToday` is read from AsyncStorage (stays confirmed).
  - Firestore will not have incremented — streak catches up on next successful write.

- **Device date manipulation:**
  - Changing device date backward may re-show the prompt, but Firestore `lastTefillinDate` guard prevents double-incrementing.

- **Multiple devices:**
  - Confirming on device A sets Firestore. Device B will not show prompt if it reads fresh state.
  - AsyncStorage is device-local — each device independently shows/hides the prompt, but Firestore prevents double-counting.

---

## Release Sign-Off (Module 5A)

Mark each Pass/Fail:

- [p] 5A1: Tefillin double-count fix (all 4 cases)
- [p] 5A2: Reminder default OFF (all 3 cases)
- [p] 5A3: Merged wake-up time (all 6 cases)
- [n/a] 5A4: Streak auto-break (all 5 cases)
- [p] 5A5: Buddy-gated prompt (all 4 cases)
- [ ] Data validation checklist complete
- [p] No regressions in existing functionality
