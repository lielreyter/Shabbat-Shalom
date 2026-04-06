# Module 5: Feature Roadmap & Integration Test Plan

This document is the step-by-step implementation guide for all pending features
and bug fixes. Each section is a self-contained module. Implement and test them
**in order** — later modules depend on earlier ones.

Use the status checkboxes to track progress. After each module, run its test
cases before moving on.

---

## Status Tracker

| #  | Module                                  | Status      |
|----|-----------------------------------------|-------------|
| 5A | Bug Fixes & Quick Wins                  | Complete    |
| 5B | Tefillin Buddy System (Firestore)       | Complete    |
| 5C | Buddy Chat & Image Messaging            | Complete    |
| 5D | Streak Engine (Time Window + Eval)      | Not started |
| 5E | Group Buddy Chats                       | Not started |
| 5F | Badge System SCRAPPED                   | Not started |
| 5G | Congregation Fixes                      | Not started |
| 5H | Phone Auth Fix                          | Not started |

---

## Firestore Collections Overview (Final State)

After all modules, Firestore should contain exactly these top-level collections:

| Collection         | Purpose                                   |
|--------------------|-------------------------------------------|
| `users`            | User profiles, streaks, friends, buddies  |
| `congregations`    | Congregation metadata and membership      |
| `congregations/{id}/messages` | Congregation chat messages     |
| `buddyChats`       | 1-on-1 and group tefillin buddy chats     |
| `buddyChats/{id}/messages`    | Chat messages and streak images |

No other top-level collections should be created. AsyncStorage is only for
device-local UI caches (block level, UI state, confirmed-today flag). It must
never be a source of truth for social data.

---

## Module 5A: Bug Fixes & Quick Wins

### Scope
- Fix tefillin streak double-count
- Fix tefillin reminder defaulting to ON
- Merge Modeh Ani and tefillin wake-up time prompts
- Add streak auto-break on missed day/week
- Remove tefillin self-confirm when user has buddies

### Files to Modify
- `src/firebase/firestore.ts`
- `src/types/UserProfile.ts`
- `App.tsx`

### 5A-1: Fix tefillin double-count

**Problem:** `onConfirmTefillin` in `App.tsx` reads `user.lastTefillinDate` from
React state, which can be stale. Tapping twice before state refreshes increments
the streak twice.

**Fix:** Read the user profile fresh from Firestore inside `onConfirmTefillin`
before comparing `lastTefillinDate`. Use the fresh value, not React state.

**Implementation steps:**
1. In `App.tsx`, update `onConfirmTefillin`:
   - Call `getUserProfile(user.uid)` at the start to get fresh data.
   - Compare fresh `lastTefillinDate` against `todayDateStr()`.
   - Only increment if they differ.
2. Keep `setTefillinConfirmedToday(true)` and AsyncStorage write as optimistic
   UI — they prevent the prompt from re-appearing, but Firestore is the guard
   against double-counting.

**Test cases:**

| ID    | Test                            | Steps                                                        | Expected                                             |
|-------|---------------------------------|--------------------------------------------------------------|------------------------------------------------------|
| 5A1-1 | Single tap increments once      | Tap "Yes" on tefillin prompt                                 | `tefillinCurrentStreak` increases by 1 in Firestore  |
| 5A1-2 | Rapid double-tap no double-count| Tap "Yes" twice quickly                                      | Streak increases by exactly 1, not 2                 |
| 5A1-3 | Re-open app same day            | Confirm tefillin, kill app, reopen                           | Prompt does not appear again; streak unchanged       |
| 5A1-4 | New day shows prompt again      | Confirm today, advance device date by 1 day, reopen          | Prompt appears; tapping Yes increments streak by 1   |

---

### 5A-2: Fix tefillin reminder default

**Problem:** `wantsMorningReminders` defaults to `true` in `hydrateUserProfile`,
so new users immediately see the tefillin prompt without opting in.

**Fix:** Default `wantsMorningReminders` to `false` in `hydrateUserProfile`. Add
an onboarding step or settings toggle where users explicitly enable it.

**Implementation steps:**
1. In `src/firebase/firestore.ts`, change `hydrateUserProfile`:
   `wantsMorningReminders: data.wantsMorningReminders ?? false`
2. Existing users who already have `true` in Firestore are unaffected.

**Test cases:**

| ID    | Test                        | Steps                                       | Expected                                    |
|-------|-----------------------------|----------------------------------------------|---------------------------------------------|
| 5A2-1 | New user default off        | Create new account, open home tab            | Tefillin prompt does NOT appear             |
| 5A2-2 | Existing user unaffected    | Login as user who had reminders on           | Tefillin prompt still appears               |
| 5A2-3 | Toggle on in settings       | Go to settings, enable tefillin reminders    | Prompt appears on next home tab visit       |

---

### 5A-3: Merge Modeh Ani and tefillin wake-up time

**Problem:** App prompts for wake-up time separately for Modeh Ani and tefillin
reminders, which is redundant.

**Fix:** Use a single `wakeUpTime` field (already exists on `UserProfile`) for
both. When scheduling reminders, schedule Modeh Ani at `wakeUpTime` and tefillin
at `wakeUpTime + 15 minutes`. Only prompt the user once to set their wake-up time.

**Implementation steps:**
1. In `App.tsx`, unify the wake-up time picker — one setting controls both.
2. In reminder scheduling, use `wakeUpTime` for Modeh Ani, `wakeUpTime + 15min`
   for tefillin.
3. Remove any duplicate time-picker UI.

**Test cases:**

| ID    | Test                           | Steps                                           | Expected                                     |
|-------|--------------------------------|--------------------------------------------------|----------------------------------------------|
| 5A3-1 | Single wake-up time setting    | Open settings                                    | Only one wake-up time picker visible         |
| 5A3-2 | Both reminders use same time   | Set wake-up to 7:00, enable both reminders       | Modeh Ani at 7:00, tefillin at 7:15          |

---

### 5A-4: Streak auto-break on missed day/week

**Problem:** Tefillin streak never auto-resets if user misses a day. Shabbat
streak only resets when explicitly broken.

**Fix:** On app open, check if the user missed yesterday for tefillin or missed
last week for Shabbat. If so, reset the streak.

**Implementation steps:**
1. Create helper `checkAndBreakStaleStreaks(user: UserProfile)` in
   `src/firebase/firestore.ts`.
2. For tefillin: if `lastTefillinDate` is not yesterday or today, set
   `tefillinCurrentStreak` to 0.
3. For Shabbat: if `lastStreakWeekId` is not the current or previous week,
   set `currentStreak` to 0.
4. Call this function on app open (in the auth hydration flow or `useEffect`
   in `App.tsx`).
5. Return the updated profile so the UI reflects the reset.

**Test cases:**

| ID    | Test                              | Steps                                               | Expected                                        |
|-------|-----------------------------------|------------------------------------------------------|-------------------------------------------------|
| 5A4-1 | Tefillin streak breaks after miss | Set `lastTefillinDate` to 3 days ago, open app       | `tefillinCurrentStreak` resets to 0             |
| 5A4-2 | Tefillin streak survives today    | Confirm tefillin today, close and reopen app          | Streak unchanged                                |
| 5A4-3 | Tefillin streak survives yesterday| Set `lastTefillinDate` to yesterday, open app         | Streak unchanged (grace: they may confirm today)|
| 5A4-4 | Shabbat streak breaks after miss  | Set `lastStreakWeekId` to 3 weeks ago, open app       | `currentStreak` resets to 0                     |

---

### 5A-5: Disable tefillin self-confirm when user has buddies

**Problem:** If a user has tefillin buddies, they should not be able to increase
their own streak by tapping "Yes" — their streak comes from buddy exchanges.

**Fix:** Conditionally hide/disable the tefillin self-confirm prompt when the
user has at least one tefillin buddy.

**Implementation steps:**
1. After Module 5B is complete, check `user.tefillinBuddyUids.length > 0`.
2. If true, hide the "Have you wrapped tefillin today?" prompt bar.
3. Show a message like "Your tefillin streak is tracked through your buddy
   chats" instead.

**Test cases:**

| ID    | Test                               | Steps                                          | Expected                                           |
|-------|------------------------------------|-------------------------------------------------|----------------------------------------------------|
| 5A5-1 | No buddies: prompt visible         | User with 0 buddies, reminders on, open home    | "Have you wrapped tefillin today?" appears          |
| 5A5-2 | Has buddies: prompt hidden         | User with 1+ buddies, open home tab             | Self-confirm prompt not shown                       |
| 5A5-3 | Has buddies: streak message shown  | User with 1+ buddies, open home tab             | Message about buddy-tracked streak appears          |

**Note:** Test 5A5-2 and 5A5-3 can only be tested after Module 5B is complete.

---

### 5A Data Validation Checklist

- [ ] `tefillinCurrentStreak` never increments more than once per day
- [ ] New users have `wantsMorningReminders: false` in Firestore
- [ ] `wakeUpTime` is the single source for both reminder schedules
- [ ] Stale streaks (tefillin + Shabbat) auto-reset on app open
- [ ] Self-confirm prompt respects buddy status

---

## Module 5B: Tefillin Buddy System (Firestore)

### Scope
- Move tefillin buddies from AsyncStorage to Firestore
- Add/remove tefillin buddy from friend profile view
- Support being buddies with multiple people simultaneously
- User's tefillin streak defaults to their highest buddy streak

### Prerequisites
- Module 5A complete (streak fixes)

### Files to Create
- `src/friends/buddyService.ts`

### Files to Modify
- `src/types/UserProfile.ts`
- `src/firebase/firestore.ts`
- `src/friends/friendsService.ts`
- `App.tsx`

### Schema Changes

Add to `UserProfile`:
```
tefillinBuddyUids: string[]      // UIDs of tefillin buddies
buddyChatIds: string[]            // IDs of buddy chats user is in
```

Add to `hydrateUserProfile` in `firestore.ts`:
```
tefillinBuddyUids: Array.isArray(data.tefillinBuddyUids) ? data.tefillinBuddyUids : []
buddyChatIds: Array.isArray(data.buddyChatIds) ? data.buddyChatIds : []
```

### Implementation Steps

1. **Update `UserProfile.ts`** — add `tefillinBuddyUids` and `buddyChatIds`
   fields.

2. **Update `firestore.ts`** — hydrate the new fields with empty array defaults.

3. **Create `src/friends/buddyService.ts`** with:
   - `addTefillinBuddy(myUid, buddyUid)` — adds each UID to the other's
     `tefillinBuddyUids` via `arrayUnion`. Validates they are already friends.
   - `removeTefillinBuddy(myUid, buddyUid)` — removes via `arrayRemove` on
     both users.
   - `getTefillinBuddyProfiles(uids: string[])` — fetches profiles for all
     buddy UIDs (reuse `getFriendProfiles` pattern).

4. **Remove AsyncStorage buddy storage** — delete all references to
   `TEFILLIN_BUDDIES_KEY` and `tefillinBuddies:v1` from `App.tsx`. Replace
   with reads from `user.tefillinBuddyUids`.

5. **Add buddy toggle UI** — when viewing a friend's profile, show:
   - "Add Tefillin Buddy" if not already a buddy
   - "Remove Tefillin Buddy" if already a buddy
   Wire these to `addTefillinBuddy` / `removeTefillinBuddy`.

6. **Add unfriend button** — on friend profile view, show "Remove Friend"
   button. Calls existing `removeFriend` from `friendsService.ts`. Also calls
   `removeTefillinBuddy` if they were a buddy.

7. **Tefillin streak = highest buddy streak** — when displaying the user's
   tefillin streak on the home screen, compute:
   ```
   const displayStreak = buddyChats.length > 0
     ? Math.max(...buddyChats.map(c => c.streakCount))
     : user.tefillinCurrentStreak;
   ```

### Test Cases

| ID    | Test                              | Steps                                                     | Expected                                               |
|-------|-----------------------------------|-----------------------------------------------------------|--------------------------------------------------------|
| 5B-1  | Add tefillin buddy                | View friend profile, tap "Add Tefillin Buddy"             | Both users' `tefillinBuddyUids` contain each other     |
| 5B-2  | Remove tefillin buddy             | View buddy profile, tap "Remove Tefillin Buddy"           | Both users' `tefillinBuddyUids` no longer contain each other |
| 5B-3  | Cannot buddy non-friend           | Attempt to add buddy who is not a friend                  | Error: must be friends first                           |
| 5B-4  | Multiple buddies allowed          | Add 3 different friends as tefillin buddies               | `tefillinBuddyUids` contains all 3 UIDs               |
| 5B-5  | Unfriend also removes buddy       | Unfriend a tefillin buddy                                 | Removed from both `friendUids` and `tefillinBuddyUids` |
| 5B-6  | AsyncStorage no longer used       | Add buddy, kill app, reopen                               | Buddy list loads from Firestore, not AsyncStorage      |
| 5B-7  | Buddy toggle UI visible           | View friend profile                                       | Add/Remove Tefillin Buddy button visible at bottom     |
| 5B-8  | Unfriend button visible           | View friend profile                                       | "Remove Friend" button visible                         |
| 5B-9  | Streak shows highest buddy streak | User has buddies with streaks 3 and 7                     | Home screen shows tefillin streak of 7                 |

### Data Validation Checklist

- [ ] `tefillinBuddyUids` is symmetric (if A has B, B has A)
- [ ] `TEFILLIN_BUDDIES_KEY` / AsyncStorage no longer referenced in code
- [ ] `buddyChatIds` hydrates as empty array for existing users
- [ ] Unfriending cascades to buddy removal

---

## Module 5C: Buddy Chat & Image Messaging

### Scope
- Create 1-on-1 buddy chat when two users become tefillin buddies
- Send text and image messages in buddy chat
- Message metadata: sender, timestamp, opened status, streak eligibility
- Streak eligibility based on **sender's local sunrise/sunset** (HebCal Zmanim)
- Per-user, per-calendar-date streak tracking (not a fixed global window)
- Real-time message subscription

### Prerequisites
- Module 5B complete (buddy system in Firestore)
- Firebase Storage configured for image uploads

### New Dependencies
- `@react-native-firebase/storage` or Firebase JS SDK storage
- `react-native-image-picker` (for camera/gallery access)

### Files to Create
- `src/friends/buddyChatService.ts`
- `src/friends/buddyChatTypes.ts`
- `src/friends/zmanimService.ts`

### Files to Modify
- `App.tsx` (chat UI)
- `src/friends/buddyService.ts` (auto-create chat on buddy add)
- `src/types/UserProfile.ts` (add latitude/longitude if not present)

### Sunrise/Sunset Approach: Per-User via HebCal Zmanim

Instead of a fixed 5am-9pm window, each user's streak window is determined by
the **actual sunrise and sunset at their location** on that day. This is
halachically accurate and fair across time zones — a user in Jerusalem and a
user in New York each have their own sun-based window.

**HebCal Zmanim API:**
```
GET https://www.hebcal.com/zmanim?cfg=json&latitude={lat}&longitude={lon}&tzid={tz}&date={YYYY-MM-DD}
```
Returns `sunrise`, `sunset`, and other zmanim. We use `sunrise` and `sunset`.

**Streak eligibility rule:** An image is streak-eligible if it is sent between
the sender's local sunrise and sunset on that calendar date.

**Per-date counting:** Each user must send at least one streak-eligible image
on **their own calendar date** (midnight to midnight in their timezone). Buddies
in different time zones each satisfy the streak independently on their own
date. The streak increments when all members have completed the same calendar
date.

### Schema: `buddyChats` Collection

```
BuddyChat {
  id: string
  type: "pair" | "group"
  name: string | null                // null for 1-on-1
  memberUids: string[]
  createdAt: Timestamp
  streakCount: number                // current streak
  longestStreak: number
  lastStreakDate: string | null       // "YYYY-MM-DD" of last successful streak day
  streakBrokenAt: string | null      // "YYYY-MM-DD" when streak last broke
}
```

Note: no `dailySenders` field needed — streak evaluation queries messages
directly to check who sent streak-eligible images on each date.

### Schema: `buddyChats/{chatId}/messages` Subcollection

```
BuddyMessage {
  id: string
  senderUid: string
  senderName: string
  type: "text" | "image"
  text: string | null
  imageUrl: string | null
  createdAt: Timestamp
  opened: boolean
  isStreakEligible: boolean           // true if sent between sender's sunrise and sunset
}
```

### Implementation Steps

1. **Add location fields to `UserProfile`** (if not already present):
   - `latitude: number | null`
   - `longitude: number | null`
   These are set from the device's geolocation on login/profile update. They
   are used for Zmanim lookups. Fallback: use the user's congregation location
   if personal coordinates are unavailable.

2. **Create `src/friends/zmanimService.ts`:**
   - `fetchZmanim(lat, lon, tzid, date)` — calls HebCal Zmanim API, returns
     `{ sunrise: Date, sunset: Date }`.
   - `getCachedZmanim(lat, lon, tzid)` — checks AsyncStorage cache keyed by
     `zmanim:{date}`. If cache is for today, return it. Otherwise fetch, cache,
     and return. One API call per user per day.
   - `isWithinSunWindow(lat, lon, tzid): Promise<boolean>` — fetches today's
     zmanim and checks if `now` is between sunrise and sunset.
   - `getSunWindowMessage(lat, lon, tzid): Promise<string | null>` — returns
     `null` if sun is up, or `"The sun is not visible — tefillin photos can
     only be sent between sunrise and sunset"` if not.

3. **Create `src/friends/buddyChatTypes.ts`** with `BuddyChat` and
   `BuddyMessage` interfaces.

4. **Create `src/friends/buddyChatService.ts`** with:
   - `createBuddyChat(memberUids, type, name?)` — creates chat doc, adds
     chatId to each member's `buddyChatIds`.
   - `getBuddyChat(chatId)` — fetch single chat.
   - `getUserBuddyChats(uid)` — fetch all chats where user is a member.
   - `sendBuddyMessage(chatId, senderUid, senderName, type, content)`:
     - If `type === "image"`: call `isWithinSunWindow()` using the sender's
       lat/lon/timezone. If sun is down, reject with message.
     - Set `isStreakEligible` based on the sun window check.
     - Add message to subcollection.
   - `markMessageOpened(chatId, messageId)` — set `opened: true`.
   - `subscribeToBuddyMessages(chatId, callback)` — real-time `onSnapshot`
     listener ordered by `createdAt`.
   - `uploadBuddyImage(chatId, senderUid, imageUri)` — uploads to Firebase
     Storage at path `buddyChats/{chatId}/{messageId}`, returns download URL.
   - `getStreakEligibleSendersForDate(chatId, memberUids, date)` — queries
     messages where `isStreakEligible === true` and `type === "image"` for the
     given date range (per each member's timezone). Returns set of sender UIDs.

5. **Auto-create chat on buddy add** — in `buddyService.ts`, when
   `addTefillinBuddy` succeeds, call `createBuddyChat([myUid, buddyUid], "pair")`.

6. **Auto-delete chat on buddy remove** — in `buddyService.ts`, when
   `removeTefillinBuddy` succeeds, find and delete the pair chat (or mark
   it inactive).

7. **Chat UI in `App.tsx`** — add a buddy chat screen accessible from:
   - Tapping on a buddy in the buddy list
   - A new "Buddy Chats" section in the social tab
   The chat UI should:
   - Show messages in chronological order
   - Show "opened" / "unopened" indicator on images (no streak effect)
   - Show camera button for sending images
   - When sun is down: disable image send, show banner "The sun is not visible"
   - Allow text messages at any time (not streak-eligible)
   - Show current streak count at top of chat

### Test Cases

| ID    | Test                                    | Steps                                                              | Expected                                                  |
|-------|-----------------------------------------|--------------------------------------------------------------------|-----------------------------------------------------------|
| 5C-1  | Chat created on buddy add               | Add a tefillin buddy                                               | `buddyChats` doc created with both UIDs, both users' `buddyChatIds` updated |
| 5C-2  | Send text message                       | Open buddy chat, type message, send                                | Message appears in `buddyChats/{id}/messages` with correct fields |
| 5C-3  | Send image while sun is up              | During daylight, take photo and send in buddy chat                 | Image uploaded, message created with `isStreakEligible: true` |
| 5C-4  | Send image while sun is down            | After sunset, attempt to send image                                | Blocked with "sun is not visible" message                 |
| 5C-5  | Text allowed when sun is down           | After sunset, send text message                                    | Message sends successfully (not streak-eligible)          |
| 5C-6  | Message opened status                   | Receiver opens image message                                       | `opened` field set to `true`                              |
| 5C-7  | Real-time message updates               | User A sends message while User B has chat open                    | User B sees message appear without refresh                |
| 5C-8  | Zmanim cached per day                   | Send two images same day                                           | Only one HebCal API call made (second uses cache)         |
| 5C-9  | Chat shows streak count                 | Open buddy chat with streak of 5                                   | "5" streak count displayed at top                         |
| 5C-10 | Chat deleted on buddy remove            | Remove a tefillin buddy                                            | Associated buddy chat deleted or deactivated              |
| 5C-11 | Cross-timezone: both users valid        | User A (Jerusalem) sends at 2pm IST, User B (NYC) sends at 3pm EST| Both messages are `isStreakEligible: true`                 |
| 5C-12 | Fallback to congregation location       | User with no personal lat/lon but has congregation                 | Zmanim fetched using congregation's coordinates           |

### Data Validation Checklist

- [ ] `buddyChats/{id}` has correct `memberUids`, `type`, initial `streakCount: 0`
- [ ] Messages have all required fields (sender, type, timestamp, opened, streakEligible)
- [ ] Images uploaded to `buddyChats/{chatId}/` path in Firebase Storage
- [ ] `isStreakEligible` is based on sender's actual sunrise/sunset, not a fixed window
- [ ] Zmanim cache in AsyncStorage updates daily, keyed by date
- [ ] `buddyChatIds` on user profiles stay in sync with actual chat docs

---

## Module 5D: Streak Engine (Per-Date Evaluation)

### Scope
- Daily streak evaluation based on **per-user calendar dates**
- Each member must send at least one streak-eligible image on their calendar date
- Streak increments when all members have completed the same date
- User's tefillin streak = their highest buddy chat streak

### Prerequisites
- Module 5C complete (buddy chat with sunrise/sunset image gating)

### Approach: Client-Side Evaluation

Since the project does not currently use Firebase Cloud Functions, implement
client-side evaluation that runs on app open. A Cloud Function is the ideal
long-term solution but this works without additional infrastructure.

### How Per-Date Evaluation Works

Each user's "day" is defined by **their own timezone** (stored on `UserProfile`).
An image counts for a date if:
1. It has `isStreakEligible: true` (sent during the sender's sunrise–sunset)
2. Its `createdAt` falls within that user's calendar date (midnight to midnight
   in their timezone)

**Example with cross-timezone buddies:**
- User A (Jerusalem, UTC+3): sends image at 2pm IST on April 1 → counts for
  User A's April 1
- User B (New York, UTC-4): sends image at 5pm EST on April 1 → counts for
  User B's April 1
- Both satisfied April 1 → streak increments

Evaluation for a given date can only happen once **all members' timezones have
passed midnight** for that date. The evaluator uses the latest timezone among
members to determine when a date is "complete."

### Files to Create
- `src/friends/streakEvaluator.ts`

### Files to Modify
- `src/friends/buddyChatService.ts`
- `src/firebase/firestore.ts`
- `App.tsx`

### Implementation Steps

1. **Create `src/friends/streakEvaluator.ts`** with:

   - `evaluateChatStreak(chat: BuddyChat, memberProfiles: UserProfile[])`:
     - Determine the date to evaluate: `lastStreakDate` + 1 day, or the
       earliest possible date if `lastStreakDate` is null.
     - Check if that date is "complete" — has midnight passed in the latest
       timezone among all members? If not, skip (day still in progress).
     - For each member, query `buddyChats/{chatId}/messages` for:
       `type === "image" AND isStreakEligible === true AND createdAt` within
       that member's calendar date (using their `timeZone`).
     - If **all** members have at least one qualifying image: increment
       `streakCount`, update `lastStreakDate`, update `longestStreak`.
     - If **any** member has no qualifying image: set `streakCount` to 0,
       set `streakBrokenAt` to that date.
     - If multiple dates need evaluation (user hasn't opened app in days),
       loop through each missed date. A single missed date breaks the streak.

   - `evaluateAllStreaks(uid: string)`:
     - Fetch all buddy chats for the user.
     - Fetch member profiles for each chat (for timezone info).
     - Call `evaluateChatStreak` for each.
     - Compute user's tefillin streak = `Math.max(...chats.map(c => c.streakCount))`.
     - Persist to `tefillinCurrentStreak` and `tefillinLongestStreak` on the
       user's profile.

2. **Call on app open** — in `App.tsx`, after auth hydration, call
   `evaluateAllStreaks(user.uid)`.

3. **Update user tefillin streak** — after evaluation, persist the highest
   streak to `tefillinCurrentStreak` and `tefillinLongestStreak` on the user
   profile.

4. **Handle edge cases:**
   - User with 0 buddy chats: tefillin streak managed by solo confirm (5A).
   - User with mix of active/broken chats: highest active streak wins.
   - New chat (streakCount 0, no lastStreakDate): evaluation starts after the
     first day where any image is sent.
   - Member with no location data: fall back to congregation location or UTC.

### Test Cases

| ID    | Test                                       | Steps                                                          | Expected                                                     |
|-------|--------------------------------------------|----------------------------------------------------------------|--------------------------------------------------------------|
| 5D-1  | Both users sent yesterday: streak++        | Both users sent streak-eligible images yesterday (their dates) | Chat `streakCount` incremented by 1                          |
| 5D-2  | One user missed yesterday: streak breaks   | Only user A sent image on their yesterday                      | Chat `streakCount` reset to 0, `streakBrokenAt` set         |
| 5D-3  | Neither sent yesterday: streak breaks      | No streak-eligible images yesterday                            | Chat `streakCount` reset to 0                                |
| 5D-4  | Multiple days missed: streak breaks        | `lastStreakDate` is 4 days ago, open app                       | Chat `streakCount` reset to 0 (first missed day breaks it)  |
| 5D-5  | User streak = highest chat streak          | User has chats with streaks 0, 3, 7                            | User `tefillinCurrentStreak` set to 7                        |
| 5D-6  | Longest streak updates                     | Current streak surpasses previous longest                      | `tefillinLongestStreak` updated on user profile              |
| 5D-7  | No double evaluation same day              | Open app, close, reopen same day                               | Streak count unchanged on second open                        |
| 5D-8  | Solo user (no buddies) unaffected          | User with 0 buddy chats opens app                             | Solo tefillin confirm still works, no evaluation runs        |
| 5D-9  | After-sunset image not counted             | Image sent after sender's sunset                               | `isStreakEligible: false`; not counted for that date         |
| 5D-10 | Cross-timezone: both sent on same date     | User A (IST) at 2pm, User B (EST) at 5pm, same calendar date  | Both count for that date; streak increments                  |
| 5D-11 | Cross-timezone: day not yet complete       | User A sent, but User B's timezone hasn't reached midnight yet | Evaluation skipped (day still in progress for User B)        |
| 5D-12 | Catch-up evaluation after 3 days offline   | User hasn't opened app for 3 days, opens now                   | Evaluator checks each missed date; breaks on first miss      |

### Data Validation Checklist

- [ ] `streakCount` only increments when ALL members sent streak-eligible images on that date
- [ ] `lastStreakDate` advances by exactly one day per successful evaluation
- [ ] `longestStreak` on chat doc is the all-time max
- [ ] User `tefillinCurrentStreak` matches max across all their buddy chats
- [ ] User `tefillinLongestStreak` is all-time max
- [ ] Evaluation respects each member's timezone for date boundaries
- [ ] Multiple missed days are evaluated sequentially (first miss breaks streak)

---

## Module 5E: Group Buddy Chats

### Scope
- Create group tefillin buddy chats with 3+ members
- Group name
- Group streak: ALL members must send a streak-eligible image on each calendar date
- Same sunrise/sunset gating per user's location
- Same per-date streak evaluation logic (already handles groups via `memberUids`)

### Prerequisites
- Module 5D complete (streak evaluation works for pairs)

### Files to Modify
- `src/friends/buddyChatService.ts`
- `src/friends/buddyService.ts`
- `App.tsx`

### Implementation Steps

1. **Group creation UI** — add a "Create Group" option in the buddy/social
   section:
   - User picks multiple friends (checkboxes).
   - User enters group name.
   - Calls `createBuddyChat(selectedUids, "group", groupName)`.

2. **Group chat UI** — same as 1-on-1 chat but:
   - Shows group name at top.
   - Shows member avatars.
   - Shows a "daily status" banner: who has/hasn't sent their streak-eligible
     photo today. Derived by querying today's messages for each member where
     `isStreakEligible === true` and `type === "image"`.

3. **Add/remove group members** — extend `buddyChatService.ts`:
   - `addGroupMember(chatId, uid)` — leader/creator adds member.
   - `removeGroupMember(chatId, uid)` — leader removes member, or member
     leaves voluntarily.
   - Update `memberUids` and the user's `buddyChatIds`.

4. **Streak evaluation** — no changes needed. The evaluator in 5D already
   checks ALL `memberUids` for streak-eligible images per calendar date.
   Groups with 5 people require all 5 to have sent during their own
   sunrise-sunset window on that date.

### Test Cases

| ID    | Test                                     | Steps                                                           | Expected                                                 |
|-------|------------------------------------------|-----------------------------------------------------------------|----------------------------------------------------------|
| 5E-1  | Create group with 3 members              | Select 3 friends, name group "Morning Crew", create             | `buddyChats` doc with type "group", 3 memberUids, name   |
| 5E-2  | All 3 send: streak increments            | All 3 members send image while sun is up, evaluate next day     | Group `streakCount` increments by 1                      |
| 5E-3  | 1 of 3 misses: streak breaks             | Only 2 of 3 members send image on that date, evaluate next day  | Group `streakCount` resets to 0                          |
| 5E-4  | Daily status shows who hasn't sent       | 2 of 3 have sent today                                          | Banner shows 3rd member as "hasn't sent yet"             |
| 5E-5  | Sun down: image blocked for group        | After sender's sunset, attempt to send image in group chat      | Blocked with "sun is not visible" message                |
| 5E-6  | Add member to group                      | Leader adds 4th friend to group                                 | `memberUids` now has 4 UIDs, new member's `buddyChatIds` updated |
| 5E-7  | Remove member from group                 | Leader removes a member                                         | Member removed from `memberUids`, their `buddyChatIds` updated |
| 5E-8  | Member leaves group                      | Non-leader member taps "Leave Group"                            | Same as 5E-7 but self-initiated                          |
| 5E-9  | Group name displayed                     | Open group chat                                                 | Group name "Morning Crew" shown at top                   |
| 5E-10 | Cross-timezone group                     | 3 members in 3 timezones, all send during their own daylight    | All count for that date; streak increments               |

### Data Validation Checklist

- [ ] Group `type` is `"group"`, pair `type` is `"pair"`
- [ ] Group `name` is stored and non-null
- [ ] `memberUids` array accurately reflects group membership
- [ ] Streak evaluation requires ALL members (not just majority)
- [ ] Adding/removing members updates both the chat doc and user profiles
- [ ] Each member's sun window is checked independently based on their location

---

## Module 5F: Badge System

### Scope
- Display fire emoji badges next to tefillin streak
- 1 fire = at least one active buddy streak
- 2 fires = 50%+ of buddy chats have active streaks
- 3 fires = ALL buddy chats have active streaks

### Prerequisites
- Module 5D complete (streak evaluation populates streakCount on chats)

### Files to Modify
- `src/types/UserProfile.ts` (optional: persist badge level)
- `App.tsx` (display logic)

### Implementation Steps

1. **Compute badge level** — create a utility function (can live in
   `streakEvaluator.ts` or a new `badgeUtils.ts`):
   ```
   computeBadgeLevel(buddyChats: BuddyChat[]): 0 | 1 | 2 | 3
     - 0 chats → 0
     - count active = chats where streakCount > 0
     - active >= 1 → 1
     - active / total >= 0.5 → 2
     - active === total → 3
   ```

2. **Display in UI** — next to the tefillin streak number on home screen,
   show `"🔥".repeat(badgeLevel)`.

3. **Persist (optional)** — store `tefillinBadgeLevel` on UserProfile for
   display in leaderboard/friend views without re-fetching all chats. Update
   during streak evaluation.

### Test Cases

| ID    | Test                            | Steps                                                           | Expected                |
|-------|---------------------------------|-----------------------------------------------------------------|-------------------------|
| 5F-1  | No buddies: no badge            | User with 0 buddy chats                                         | No fire emoji shown     |
| 5F-2  | 1 active out of 3: one fire     | User has 3 buddy chats, 1 has streak > 0                        | 🔥 shown               |
| 5F-3  | 2 active out of 3: two fires    | User has 3 buddy chats, 2 have streak > 0                       | 🔥🔥 shown             |
| 5F-4  | 3 active out of 3: three fires  | User has 3 buddy chats, all have streak > 0                     | 🔥🔥🔥 shown           |
| 5F-5  | Exactly 50%: two fires          | User has 4 buddy chats, 2 have streak > 0                       | 🔥🔥 shown             |
| 5F-6  | Badge updates on streak break   | One buddy streak breaks (was 3/3, now 2/3)                      | Badge drops from 🔥🔥🔥 to 🔥🔥 |

---

## Module 5G: Congregation Fixes

### Scope
- Fix "Create New" congregation: no city picker
- Fix congregation showing "No Congregation: search for more"
- Fix congregation search by city
- Leader succession when leader leaves
- Leadership transfer within congregation

### Prerequisites
- None (independent of buddy system modules)

### Files to Modify
- `src/congregation/congregationService.ts`
- `src/congregation/congregationTypes.ts`
- `App.tsx`

### 5G-1: City picker on Create Congregation

**Problem:** Create flow doesn't let user pick/edit the city. It may auto-detect
as "Unknown" from geolocation.

**Fix:** In the create-congregation modal in `App.tsx`, add a text input for
city name. Pre-fill it with the reverse-geocoded city from the user's location.
Allow the user to edit it before creating.

### 5G-2: Fix "No Congregation" display bug

**Problem:** Congregation name shows as "No Congregation: search for more" even
when user is in a congregation.

**Fix:** Debug the congregation loading in `App.tsx`. Likely causes:
- `congregationId` is set on user but the congregation name hasn't loaded yet.
- The congregation doc exists but `normalizeCongregation` falls through to
  `"Unknown Congregation"` because a field is missing.
- Race condition where UI renders before async fetch completes.

Add a loading state for congregation data. Only show the "No Congregation"
message when `congregationId` is definitively `null`.

### 5G-3: Search congregations by city name

**Problem:** `listNearbyCongregations` uses geolocation distance, not city
name search. Users searching by city text get no results.

**Fix:** Add a new function to `congregationService.ts`:
```
searchCongregationsByCity(cityName: string): Promise<Congregation[]>
```
Uses Firestore `where("city", "==", normalizedCity)`. Also support partial
matching with `>=` / `<= + \uf8ff` like the friend search does.

### 5G-4: Leader succession

**Problem:** `leaveCongregationAsUser` doesn't check if the leaving user is the
leader. If the leader leaves, the congregation has no leader.

**Fix:** Update `leaveCongregationAsUser`:
- If leaving user is the leader:
  - Find remaining members.
  - If members remain: assign leadership to the member with the highest
    `tefillinCurrentStreak` (fetch profiles, sort, pick top).
  - If no members remain: delete the congregation doc.
- Update `leaderUid` on the congregation doc.

### 5G-5: Leadership transfer

**Fix:** Add a `transferLeadership` function to `congregationService.ts`:
```
transferLeadership(congregationId, currentLeaderUid, newLeaderUid)
```
- Validates `currentLeaderUid` is the actual leader.
- Validates `newLeaderUid` is a member.
- Updates `leaderUid` on the congregation doc.

Only the leader can set congregation to OPEN/REQUEST/CLOSED (already enforced).

### Test Cases

| ID    | Test                                    | Steps                                                          | Expected                                                  |
|-------|-----------------------------------------|----------------------------------------------------------------|-----------------------------------------------------------|
| 5G-1  | Create with city picker                 | Open create congregation, see city field pre-filled            | City field editable, congregation created with correct city |
| 5G-2  | Create with manual city                 | Clear pre-filled city, type "Brooklyn", create                 | Congregation has city "Brooklyn"                          |
| 5G-3  | Congregation name loads correctly       | User in a congregation, open social tab                        | Congregation name displayed (not "No Congregation")       |
| 5G-4  | Search by city                          | Type "Jerusalem" in congregation search                        | Jerusalem congregations appear in results                 |
| 5G-5  | Leader leaves: succession               | Leader leaves congregation with 3 members                      | Member with highest streak becomes new leader             |
| 5G-6  | Leader leaves: empty congregation       | Solo leader leaves congregation                                | Congregation doc deleted                                  |
| 5G-7  | Transfer leadership                     | Leader transfers to another member                             | `leaderUid` updated to new member's UID                   |
| 5G-8  | Non-leader cannot transfer              | Non-leader attempts leadership transfer                        | Error: only leader can transfer                           |
| 5G-9  | Only leader sets join policy            | Non-leader attempts to change join policy                      | Error (already enforced, verify it still works)           |

### Data Validation Checklist

- [ ] All congregations have non-empty `city` field
- [ ] `leaderUid` always points to a current member
- [ ] Deleted congregations don't leave orphaned `congregationId` on user profiles
- [ ] `transferLeadership` updates `leaderUid` atomically

---

## Module 5H: Phone Auth Fix

### Scope
- Fix phone number verification Firebase Auth error

### Prerequisites
- None (independent)

### Root Cause

`startPhoneSignIn` in `src/auth/authService.ts` calls `signInWithPhoneNumber(auth, phone)`
using the Firebase JS SDK. The JS SDK requires a `RecaptchaVerifier` as the
second argument, which is a web-only construct and doesn't work in React Native.

### Fix Options (pick one)

**Option A (Recommended): Use `@react-native-firebase/auth`**
- Install `@react-native-firebase/app` and `@react-native-firebase/auth`.
- These use the native Firebase SDKs which handle phone auth natively
  (silent APNs push on iOS, Play Integrity on Android).
- Replace `signInWithPhoneNumber` calls with the native module version.
- This requires CocoaPods setup and native rebuilds.

**Option B: Firebase JS SDK with invisible reCAPTCHA**
- Create an invisible `RecaptchaVerifier` using a hidden web view.
- More complex and fragile in React Native.
- Not recommended for production.

### Implementation Steps (Option A)

1. Install `@react-native-firebase/app` and `@react-native-firebase/auth`.
2. Run `pod install` in `ios/`.
3. Ensure `GoogleService-Info.plist` is in the Xcode project (already present).
4. Update `authService.ts`:
   - Import phone auth from `@react-native-firebase/auth`.
   - Replace `signInWithPhoneNumber` with native module equivalent.
   - Keep the same public API surface (`startPhoneSignIn`, `confirmPhoneSignIn`).
5. Enable Phone provider in Firebase Console with test phone numbers.
6. For iOS: configure APNs (push notification certificate or key) in Firebase
   Console under Project Settings > Cloud Messaging.

### Test Cases

| ID    | Test                                 | Steps                                                       | Expected                                            |
|-------|--------------------------------------|--------------------------------------------------------------|-----------------------------------------------------|
| 5H-1  | Send verification code               | Enter valid phone number, tap send code                      | SMS received (or test code route works)             |
| 5H-2  | Verify correct code                  | Enter received code, tap verify                              | User signed in, profile created/hydrated            |
| 5H-3  | Verify wrong code                    | Enter invalid code, tap verify                               | Error shown, user remains signed out                |
| 5H-4  | Invalid phone number                 | Enter "abc" as phone number, tap send                        | Validation error shown                              |
| 5H-5  | No auth/augment error                | Complete full phone auth flow                                | No Firebase auth errors in console                  |

---

## Implementation Order Summary

```
5A  Bug Fixes & Quick Wins
 ├── 5A-1  Fix tefillin double-count         (standalone)
 ├── 5A-2  Fix reminder default              (standalone)
 ├── 5A-3  Merge wake-up time prompts        (standalone)
 ├── 5A-4  Streak auto-break                 (standalone)
 └── 5A-5  Disable self-confirm with buddies (depends on 5B)

5B  Tefillin Buddy System (Firestore)        (depends on 5A)

5C  Buddy Chat & Image Messaging             (depends on 5B)

5D  Streak Engine                            (depends on 5C)

5E  Group Buddy Chats                        (depends on 5D)

5F  Badge System                             (depends on 5D)

5G  Congregation Fixes                       (independent, can parallel any)
 ├── 5G-1  City picker
 ├── 5G-2  Fix display bug
 ├── 5G-3  Search by city
 ├── 5G-4  Leader succession
 └── 5G-5  Leadership transfer

5H  Phone Auth Fix                           (independent, can parallel any)
```

Modules 5G and 5H are independent and can be implemented at any time. The main
chain is 5A → 5B → 5C → 5D → 5E/5F.

---

## Global Rules

1. **No duplicate databases.** Social data (friends, buddies, streaks, chats)
   lives in Firestore only. AsyncStorage is only for device-local UI caches
   (and the daily Zmanim cache).
2. **No new top-level Firestore collections** beyond those listed in the
   overview table.
3. **Streak eligibility uses real sunrise/sunset** from HebCal Zmanim, based
   on the sender's location and timezone. No fixed hour window.
4. **Streak counting is per calendar date per user.** Each member satisfies
   their date independently. The streak increments when all members have
   completed the same date.
5. **All Firestore writes** that modify arrays must use `arrayUnion`/`arrayRemove`
   to prevent race conditions.
6. **All user-facing errors** must be caught and shown via `Alert.alert()` or
   inline error text — no silent failures, no raw Firebase errors.
