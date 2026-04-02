# Testing Guide: Module 5B — Tefillin Buddy System (Firestore)

This document provides a practical test checklist for validating the 5B changes:
- Tefillin buddies moved from AsyncStorage to Firestore
- Add/remove tefillin buddy from friend profile view
- Multiple buddies supported simultaneously
- User's tefillin streak defaults to highest buddy streak
- Unfriend cascades to buddy removal
- Friend profile modal with buddy toggle and unfriend button

Use this after the 5B implementation and before starting Module 5C.

## Preconditions

- Module 5A is complete and tested.
- Firebase project is configured and reachable.
- At least two test user accounts exist and are friends with each other.
- A third test user account is helpful for multi-buddy tests.

## Files Changed

| File | Changes |
|------|---------|
| `src/friends/buddyService.ts` | **New file.** `addTefillinBuddy`, `removeTefillinBuddy`, `getTefillinBuddyProfiles` — all Firestore-based with `arrayUnion`/`arrayRemove` |
| `src/friends/friendsService.ts` | No changes (already had `removeFriend`); now imported in App.tsx |
| `src/types/UserProfile.ts` | No changes (5A already added `tefillinBuddyUids` and `buddyChatIds`) |
| `src/firebase/firestore.ts` | No changes (5A already hydrates `tefillinBuddyUids` and `buddyChatIds`) |
| `App.tsx` | Removed `TEFILLIN_BUDDIES_KEY` and all AsyncStorage buddy reads/writes; `tefillinBuddyUids` now derived from `user.tefillinBuddyUids` via `useMemo`; replaced `onToggleTefillinBuddy` with `onAddTefillinBuddy`/`onRemoveTefillinBuddy` (Firestore); added `onUnfriend` with cascade; added `displayTefillinStreak` computed from highest buddy streak; added friend profile modal with buddy toggle + unfriend; leaderboard rows and buddy add rows are now tappable; migrates old AsyncStorage key on load |

---

## Test Cases

### 5B-1: Add Tefillin Buddy

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5B-1a | Add buddy from buddy section | 1. Open Social tab. 2. Scroll to "Tefillin Buddies" section. 3. Tap "+ Add" next to a friend's name. | Friend appears in active buddies list. Both users' `tefillinBuddyUids` in Firestore contain each other's UID. | [ ] |
| 5B-1b | Add buddy from friend profile | 1. Tap a friend in the Leaderboard. 2. In the profile modal, tap "Add Tefillin Buddy". | Same as above. Modal closes. | [ ] |

**How it works:** `onAddTefillinBuddy` calls `addTefillinBuddy(myUid, buddyUid)` in `buddyService.ts`, which validates friendship and uses `arrayUnion` on both users' `tefillinBuddyUids`.

---

### 5B-2: Remove Tefillin Buddy

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5B-2a | Remove buddy via ✕ button | 1. In the active buddies list, tap the ✕ next to a buddy. | Buddy removed from list. Both users' `tefillinBuddyUids` no longer contain each other. | [ ] |
| 5B-2b | Remove buddy from friend profile | 1. Tap a buddy in the leaderboard. 2. Tap "Remove Tefillin Buddy" (red). | Same as above. Modal closes. | [ ] |

**How it works:** `onRemoveTefillinBuddy` calls `removeTefillinBuddy(myUid, buddyUid)`, which uses `arrayRemove` on both users.

---

### 5B-3: Cannot Buddy Non-Friend

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5B-3 | Buddy requires friendship | 1. In Firestore, remove a UID from a user's `friendUids` but keep them in `tefillinBuddyUids` (simulated). 2. Attempt to call `addTefillinBuddy` programmatically (or remove from friends first, then re-add as buddy). | Error: "You must be friends first before adding a tefillin buddy." | [ ] |

---

### 5B-4: Multiple Buddies Allowed

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5B-4 | Add 3 different buddies | 1. Have 3 friends. 2. Add each as a tefillin buddy. | `tefillinBuddyUids` contains all 3 UIDs. All 3 appear in the active buddies list. | [ ] |

---

### 5B-5: Unfriend Cascades to Buddy Removal

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5B-5 | Unfriend a tefillin buddy | 1. Tap a buddy in the leaderboard. 2. Tap "Remove Friend". 3. Confirm removal. | User removed from both `friendUids` AND `tefillinBuddyUids` on both users. Friend disappears from leaderboard and buddy list. | [ ] |

**How it works:** `onUnfriend` checks if the friend is in `tefillinBuddyUids` and calls `removeTefillinBuddy` before calling `removeFriend`.

---

### 5B-6: AsyncStorage No Longer Used for Buddies

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5B-6a | Buddy list loads from Firestore | 1. Add a buddy. 2. Kill app. 3. Reopen app. | Buddy list loads correctly from Firestore user profile. | [ ] |
| 5B-6b | Old AsyncStorage key cleaned up | 1. Before update: had `tefillinBuddies:v1` in AsyncStorage. 2. After update: open app. | `tefillinBuddies:v1` is removed from AsyncStorage on load. No stale data. | [ ] |

---

### 5B-7: Buddy Toggle UI Visible

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5B-7a | Add button visible for non-buddies | 1. Open Social tab. 2. Scroll to "Add a Tefillin Buddy" section. | "+ Add" button visible next to each non-buddy friend. | [ ] |
| 5B-7b | Remove button visible for buddies | 1. In the active buddies list. | "✕" button visible next to each buddy. | [ ] |
| 5B-7c | Profile modal shows correct state | 1. Tap a non-buddy friend in leaderboard. | "Add Tefillin Buddy" button (blue). 2. Tap a buddy in leaderboard. | "Remove Tefillin Buddy" button (red). | [ ] |

---

### 5B-8: Unfriend Button Visible

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5B-8 | Remove Friend button in profile modal | 1. Tap any friend in the leaderboard. | "Remove Friend" button visible in the profile modal (red, below buddy toggle). | [ ] |

---

### 5B-9: Streak Shows Highest Buddy Streak

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5B-9a | User streak = max buddy streak | 1. User has `tefillinCurrentStreak: 2`. 2. Buddy A has streak 3, Buddy B has streak 7. | Home screen shows tefillin streak of 7 (highest among user + buddies). | [ ] |
| 5B-9b | No buddies = solo streak | 1. User has 0 buddies and `tefillinCurrentStreak: 5`. | Home screen shows tefillin streak of 5. | [ ] |
| 5B-9c | Buddy with lower streak | 1. User has streak 10, buddy has streak 3. | Home screen shows 10 (user's own streak is highest). | [ ] |

**How it works:** `displayTefillinStreak` is computed as `Math.max(user.tefillinCurrentStreak, ...buddyStreaks)`. Falls back to solo streak when no buddies.

---

## Data Validation Checklist

After running all tests, verify these in Firestore:

- [ ] `tefillinBuddyUids` is symmetric — if User A has User B, User B has User A
- [ ] No references to `TEFILLIN_BUDDIES_KEY` or `tefillinBuddies:v1` in the codebase
- [ ] `buddyChatIds` hydrates as empty array for existing users (prepared for 5C)
- [ ] Unfriending cascades to buddy removal on both users
- [ ] `arrayUnion` / `arrayRemove` are used for all array mutations (no overwrite races)
- [ ] Adding a buddy validates friendship first
- [ ] Adding self as buddy is rejected

---

## Architecture Notes

### Key Design Decisions

1. **No local state for buddy UIDs.** `tefillinBuddyUids` is derived from `user.tefillinBuddyUids` via `useMemo`. This ensures Firestore is the single source of truth.

2. **Optimistic refresh pattern.** After each buddy add/remove/unfriend, the updated user profile is fetched fresh from Firestore and set into React state.

3. **Cascade unfriend → buddy removal.** `onUnfriend` checks if the friend is a buddy before removing, ensuring no orphaned buddy relationships.

4. **Friend profile modal.** Tapping any friend in the leaderboard or buddy sections opens a modal showing their streaks, buddy toggle, and unfriend button.

5. **Migration.** The old `tefillinBuddies:v1` AsyncStorage key is cleaned up on first app load after the update.

---

## Edge Cases

- **Race condition on add/remove:** `arrayUnion`/`arrayRemove` are atomic Firestore operations, preventing race conditions when two users modify buddy lists simultaneously.

- **Buddy whose profile was deleted:** `getTefillinBuddyProfiles` and the friends list filter out null profiles, so a deleted user won't cause crashes.

- **Offline mode:** Firestore SDK queues writes when offline. Buddy adds/removes will sync when connectivity is restored.

---

## Release Sign-Off (Module 5B)

Mark each Pass/Fail:

- [p] 5B-1: Add tefillin buddy (2 cases)
- [p] 5B-2: Remove tefillin buddy (2 cases)
- [p] 5B-3: Cannot buddy non-friend
- [n/a(most likely p)] 5B-4: Multiple buddies allowed
- [p] 5B-5: Unfriend cascades to buddy removal
- [p] 5B-6: AsyncStorage no longer used (2 cases)
- [p] 5B-7: Buddy toggle UI visible (3 cases)
- [p] 5B-8: Unfriend button visible
- [p] 5B-9: Streak shows highest buddy streak (3 cases)
- [p] Data validation checklist complete
- [p] No regressions in Module 5A functionality
