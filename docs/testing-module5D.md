# Testing Guide: Module 5D — Streak Engine (Per-Date Evaluation)

This document provides a practical test checklist for validating the 5D changes:
- Client-side streak evaluation on app open
- Per-user, per-calendar-date streak counting (respects each member's timezone)
- Streak increments when all members sent streak-eligible images on the same date
- Streak breaks on first missed date
- Multi-day catch-up evaluation (loops through missed dates)
- User's tefillin streak = highest across all buddy chat streaks
- No double evaluation in the same app session

Use this after the 5D implementation and before starting Module 5E.

## Preconditions

- Modules 5A, 5B, and 5C are complete and tested.
- Firebase project is configured and reachable.
- At least two test user accounts exist, are friends, and are tefillin buddies (with an active buddy chat).
- Both test users have `timeZone` set on their Firestore profiles (auto-set from device).
- Both test users have `latitude`/`longitude` on their profiles (for Zmanim lookups in 5C).

## Files Changed

| File | Changes |
|------|---------|
| `src/friends/streakEvaluator.ts` | **New file.** `evaluateChatStreak` and `evaluateAllStreaks` — the core streak evaluation engine |
| `App.tsx` | Added `evaluateAllStreaks` import; added `streakEvalDone` ref guard; added `useEffect` to run evaluation once per app session after auth hydration |
| `docs/module5-feature-roadmap.md` | Updated 5D status to "Complete" |

---

## How Streak Evaluation Works

### Evaluation Flow (on app open)

1. User authenticates → `useEffect` detects `user` with `buddyChatIds.length > 0`.
2. `evaluateAllStreaks(uid)` is called (only once per session via `streakEvalDone` ref).
3. For each buddy chat:
   - Determines the first date to evaluate (`lastStreakDate + 1` or chat creation date).
   - Finds the "latest timezone" among members (furthest west = latest midnight).
   - Only evaluates dates where midnight has passed in **all** member timezones.
   - For each date: checks if **every** member sent at least one `isStreakEligible: true` image on their calendar date (midnight-to-midnight in their timezone).
   - If all sent → `streakCount++`, `lastStreakDate` advances.
   - If any missed → `streakCount = 0`, `streakBrokenAt` set, loop stops.
4. After evaluating all chats: user's `tefillinCurrentStreak` = max across all chat streaks.
5. Buddy chats and user profile are re-fetched to update the UI.

### Per-User Calendar Date

Each member's "day" is midnight-to-midnight in their own timezone. The evaluator converts dates to UTC ranges using `Intl.DateTimeFormat` with the member's IANA timezone, then queries Firestore with those UTC boundaries.

### Cross-Timezone Example

- User A (Jerusalem, UTC+3): sends image at 2pm IST on April 1.
- User B (New York, UTC-4): sends image at 5pm EST on April 1.
- April 1 evaluation waits until midnight UTC-4 (User B's timezone is further west).
- Both satisfied April 1 → streak increments.

---

## Test Cases

### 5D-1: Both Users Sent Yesterday — Streak Increments

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5D-1 | Streak increments when both sent | 1. Both users sent streak-eligible camera images yesterday (during daylight). 2. Close app. 3. Reopen app today. | Chat `streakCount` incremented by 1. `lastStreakDate` set to yesterday's date. | [ ] |

**How to verify:** Check the `buddyChats/{id}` doc in Firestore — `streakCount` should be 1 (or previous + 1). The buddy chat header in the app should show the updated streak.

---

### 5D-2: One User Missed Yesterday — Streak Breaks

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5D-2 | Streak breaks on single miss | 1. Only User A sent a streak-eligible image yesterday. User B did not. 2. Reopen app as either user. | Chat `streakCount` reset to 0. `streakBrokenAt` set to yesterday's date. | [ ] |

---

### 5D-3: Neither Sent Yesterday — Streak Breaks

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5D-3 | Both missed | 1. Neither user sent a streak-eligible image yesterday. 2. Reopen app. | Chat `streakCount` reset to 0. | [ ] |

---

### 5D-4: Multiple Days Missed — Streak Breaks on First Miss

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5D-4 | Catch-up evaluation | 1. In Firestore, set `lastStreakDate` to 4 days ago on the buddy chat doc. 2. Reopen app. | Evaluator checks each missed date sequentially. `streakCount` reset to 0 on the first date with no images. | [ ] |

**How to set up:** Manually edit the `buddyChats/{id}` doc in Firestore Console. Set `lastStreakDate` to a date 4 days ago (e.g., `"2026-04-02"` if today is April 6).

---

### 5D-5: User Streak = Highest Chat Streak

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5D-5 | Max across chats | 1. User has 3 buddy chats with `streakCount` values of 0, 3, and 7. 2. Reopen app. | User's `tefillinCurrentStreak` in Firestore is set to 7. Home screen displays streak of 7. | [ ] |

**How to set up:** Create multiple buddy pairs. Manually set different `streakCount` values in Firestore on the chat docs.

---

### 5D-6: Longest Streak Updates

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5D-6 | Longest streak tracked | 1. User's buddy chat has `streakCount: 5`, `longestStreak: 3`. 2. Both users send images. 3. Reopen app next day. | Chat `longestStreak` updated to 6. User's `tefillinLongestStreak` updated if 6 exceeds their current longest. | [ ] |

---

### 5D-7: No Double Evaluation Same Day

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5D-7 | Single evaluation per session | 1. Open app (evaluation runs). 2. Close app. 3. Reopen app. | On second open, `evaluateAllStreaks` runs again (new session). But since `lastStreakDate` was already advanced, no changes occur. Streak count unchanged. | [ ] |
| 5D-7b | Same session guard | 1. Open app (evaluation runs). 2. Navigate away and back to home tab (without killing app). | `streakEvalDone` ref prevents re-evaluation within the same session. No duplicate Firestore reads. | [ ] |

**How it works:** `streakEvalDone` is a `useRef(false)` that is set to `true` after the first evaluation. It resets when the app process is killed and restarted.

---

### 5D-8: Solo User (No Buddies) Unaffected

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5D-8 | No buddy chats | 1. User has 0 buddy chats (`buddyChatIds` is empty). 2. Open app. | `evaluateAllStreaks` exits early. Solo tefillin self-confirm still works. No errors. | [ ] |

---

### 5D-9: After-Sunset Image Not Counted

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5D-9 | Non-eligible image ignored | 1. User sent a gallery image (or after-sunset image) with `isStreakEligible: false`. 2. No camera image was sent that day. 3. Reopen app next day. | That image is not counted for the streak. Streak breaks for that date. | [ ] |

**How it works:** The evaluator queries for `isStreakEligible === true AND type === "image"`. Non-eligible images are ignored.

---

### 5D-10: Cross-Timezone — Both Sent on Same Date

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5D-10 | Timezone-aware evaluation | 1. User A (Jerusalem, UTC+3) sends at 2pm IST on April 1. 2. User B (NYC, UTC-4) sends at 5pm EST on April 1. 3. After midnight EST, reopen app. | Both images count for April 1. Streak increments. | [ ] |

**How it works:** `memberSentOnDate` computes midnight-to-midnight boundaries in each member's timezone, then queries Firestore with those UTC timestamps.

---

### 5D-11: Cross-Timezone — Day Not Yet Complete

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5D-11 | Skips incomplete day | 1. User A (Jerusalem) sent today. 2. User B (NYC) hasn't reached midnight yet in their timezone. 3. Open app. | Evaluation skips today's date — `isDateComplete` returns false because midnight hasn't passed in User B's timezone. Streak unchanged. | [ ] |

---

### 5D-12: Catch-Up Evaluation After 3 Days Offline

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5D-12 | Multi-day sequential eval | 1. Set `lastStreakDate` to 3 days ago in Firestore. 2. Both users sent streak-eligible images on day 1 after `lastStreakDate`, but not on day 2. 3. Reopen app. | Day 1: streak increments. Day 2: streak breaks. Day 3: not evaluated (stopped at first break). Final `streakCount` is 0. | [ ] |

---

## Data Validation Checklist

After running all tests, verify these in Firestore:

- [ ] `streakCount` only increments when ALL members sent streak-eligible images on that date
- [ ] `lastStreakDate` advances by exactly one day per successful evaluation
- [ ] `longestStreak` on chat doc is the all-time max (never decreases)
- [ ] User `tefillinCurrentStreak` matches max across all their buddy chats
- [ ] User `tefillinLongestStreak` is all-time max (never decreases)
- [ ] Evaluation respects each member's timezone for date boundaries
- [ ] Multiple missed days are evaluated sequentially (first miss breaks streak)
- [ ] `streakBrokenAt` is set to the date of the first missed day

---

## Architecture Notes

### Key Design Decisions

1. **Client-side evaluation** — runs on app open since the project doesn't use Cloud Functions. A Cloud Function would be the ideal long-term solution for server-side evaluation at midnight.

2. **Per-user timezone boundaries** — each member's calendar date is computed using `Intl.DateTimeFormat` with their IANA timezone from `UserProfile.timeZone`. This handles DST transitions correctly.

3. **Latest-timezone gate** — evaluation for a date only proceeds once midnight has passed in the furthest-west timezone among all chat members. This prevents evaluating a date before all members have had their full day.

4. **60-iteration cap** — the evaluation loop is capped at 60 iterations to prevent runaway queries if `lastStreakDate` is very old.

5. **Single evaluation per session** — the `streakEvalDone` ref ensures `evaluateAllStreaks` only runs once per app launch, avoiding redundant Firestore reads.

6. **Firestore composite index** — the `memberSentOnDate` query uses `type + isStreakEligible + senderUid + createdAt` on the messages subcollection. Firestore will prompt to create this index on first execution (follow the link in the error message).

---

## Edge Cases

- **New chat (no lastStreakDate):** Evaluation starts from the chat's `createdAt` date. If no images exist on that date, streak stays at 0 without breaking (since it was never active).

- **Member with no timezone:** Falls back to `"UTC"`.

- **Single member in chat (shouldn't happen for pairs):** Evaluator still works — checks that single member sent.

- **Chat with 0 members (shouldn't happen):** `evaluateChatStreak` returns the chat unchanged.

- **Firestore index not yet created:** First evaluation will fail with a Firestore error containing a link to create the required composite index. After creating it, subsequent evaluations work.

---

## Release Sign-Off (Module 5D)

Mark each Pass/Fail:

- [ ] 5D-1: Both sent yesterday — streak increments
- [ ] 5D-2: One missed — streak breaks
- [ ] 5D-3: Both missed — streak breaks
- [ ] 5D-4: Multiple days missed — breaks on first miss
- [ ] 5D-5: User streak = highest chat streak
- [ ] 5D-6: Longest streak updates
- [ ] 5D-7: No double evaluation (2 cases)
- [ ] 5D-8: Solo user unaffected
- [ ] 5D-9: After-sunset image not counted
- [ ] 5D-10: Cross-timezone both sent
- [ ] 5D-11: Cross-timezone day not complete
- [ ] 5D-12: Catch-up after 3 days offline
- [ ] Data validation checklist complete
- [ ] No regressions in Module 5A, 5B, or 5C functionality
