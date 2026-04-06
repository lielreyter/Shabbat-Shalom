# Testing Guide: Module 5C — Buddy Chat & Image Messaging

This document provides a practical test checklist for validating the 5C changes:
- 1-on-1 buddy chat auto-created when two users become tefillin buddies
- Text and image messages in buddy chat
- Image streak-eligibility based on sender's local sunrise/sunset (HebCal Zmanim)
- Sun window blocking — images rejected when sun is down
- Real-time message subscription
- Message opened status tracking
- Buddy chat deleted when buddy is removed
- User lat/lon persisted to profile for Zmanim lookups

Use this after the 5C implementation and before starting Module 5D.

## Preconditions

- Module 5A and 5B are complete and tested.
- Firebase project is configured and reachable.
- Firebase Storage is enabled in the Firebase Console.
- At least two test user accounts exist and are friends with each other.
- Device has camera/photo library access (for image tests).
- Device has location services enabled (for sunrise/sunset calculation).

## Files Changed

| File | Changes |
|------|---------|
| `src/types/UserProfile.ts` | Added `latitude: number \| null` and `longitude: number \| null` |
| `src/firebase/firestore.ts` | Hydrate and create `latitude`/`longitude` fields |
| `src/firebase/firebaseConfig.ts` | Added Firebase Storage export (`getStorage`) |
| `src/friends/buddyChatTypes.ts` | **New file.** `BuddyChat` and `BuddyMessage` interfaces |
| `src/friends/zmanimService.ts` | **New file.** `fetchZmanim`, `getCachedZmanim`, `isWithinSunWindow`, `getSunWindowMessage` — HebCal Zmanim API with AsyncStorage cache |
| `src/friends/buddyChatService.ts` | **New file.** `createBuddyChat`, `getBuddyChat`, `getUserBuddyChats`, `deleteBuddyChat`, `findPairChat`, `sendBuddyMessage`, `markMessageOpened`, `subscribeToBuddyMessages`, `uploadBuddyImage`, `getStreakEligibleSendersForDate` |
| `src/friends/buddyService.ts` | `addTefillinBuddy` now auto-creates a pair buddy chat; `removeTefillinBuddy` now auto-deletes the pair chat |
| `App.tsx` | New `buddyChat` social sub-tab; buddy chat state/effects/handlers; camera/gallery image picker; sun window banner; message opened tracking; lat/lon auto-persisted to profile on location load; `displayTefillinStreak` now uses buddy chat streak counts |
| `package.json` | Added `react-native-image-picker` dependency |

---

## Test Cases

### 5C-1: Chat Created on Buddy Add

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5C-1 | Chat created on buddy add | 1. Add a friend as a tefillin buddy. 2. Check Firestore `buddyChats` collection. | A new `buddyChats` doc exists with type `"pair"`, both UIDs in `memberUids`, `streakCount: 0`. Both users' `buddyChatIds` contain the new chat ID. | [ ] |

**How it works:** `addTefillinBuddy` in `buddyService.ts` now calls `createBuddyChat([myUid, buddyUid], "pair")` after adding buddy UIDs. `createBuddyChat` also updates each member's `buddyChatIds` via `arrayUnion`.

---

### 5C-2: Send Text Message

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5C-2 | Send text message | 1. Tap a buddy in the Tefillin Buddies section. 2. Type a message and tap Send. 3. Check Firestore `buddyChats/{id}/messages`. | Message doc created with `type: "text"`, `text` field populated, `isStreakEligible: false`, `opened: false`. | [ ] |

---

### 5C-3: Send Camera Image While Sun Is Up (Streak-Eligible)

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5C-3a | Camera photo during daylight | 1. During daylight hours, open buddy chat. 2. Tap 📷. 3. Choose "Camera (streak-eligible)". 4. Take a photo. | Image uploaded to Firebase Storage. Message created with `isStreakEligible: true`. Shows "📸 Streak eligible" label. | [ ] |
| 5C-3b | Gallery photo during daylight | 1. During daylight hours, open buddy chat. 2. Tap 📷. 3. Choose "Gallery (not streak-eligible)". 4. Pick a photo. | Image uploaded. Message created with `isStreakEligible: false`. Shows "🖼 Gallery photo" label. | [ ] |

**Key rule:** Only camera photos (taken live) count toward the streak. Gallery photos can always be sent but are never streak-eligible.

---

### 5C-4: Send Image While Sun Is Down

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5C-4a | Camera hidden after sunset | 1. After sunset (or before sunrise), open buddy chat. 2. Note yellow banner. 3. Tap 📷. | Only "Gallery (not streak-eligible)" option shown. No camera option. | [ ] |
| 5C-4b | Gallery still works after sunset | 1. After sunset, tap 📷, choose Gallery. | Image uploads and sends with `isStreakEligible: false`. | [ ] |

**How it works:** `getSunWindowMessage` sets `sunBlockedMessage`. When non-null, the camera option is hidden from the action sheet. Gallery is always available.

---

### 5C-5: Text Allowed When Sun Is Down

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5C-5 | Text sends regardless of sun | 1. After sunset, open buddy chat. 2. Type a text message and send. | Message sends successfully with `isStreakEligible: false`. | [ ] |

---

### 5C-6: Message Opened Status

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5C-6a | Image message marked opened | 1. User A sends an image. 2. User B opens the buddy chat. | The image message's `opened` field is set to `true` in Firestore. | [ ] |
| 5C-6b | Own messages not marked | 1. User A sends a message. 2. User A views their own message. | `opened` remains `false` (only the receiver marks as opened). | [ ] |

**How it works:** `onMarkBuddyMessageOpened` is called in the FlatList `renderItem` when a non-own, unopened message appears. It calls `markMessageOpened(chatId, messageId)` to set `opened: true`.

---

### 5C-7: Real-Time Message Updates

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5C-7 | Messages appear in real time | 1. User A and User B both have the buddy chat open. 2. User A sends a message. | User B sees the message appear without needing to refresh. | [ ] |

**How it works:** `subscribeToBuddyMessages` uses Firestore `onSnapshot` with real-time updates. The subscription is active whenever `socialSubTab === "buddyChat"` and `activeBuddyChat` is set.

---

### 5C-8: Zmanim Cached Per Day

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5C-8 | Only one API call per day | 1. Open buddy chat (triggers Zmanim lookup). 2. Close and reopen buddy chat. | AsyncStorage has a `zmanim:` key for today. Only one HebCal API request made (verify via network logs or AsyncStorage inspection). | [ ] |

**How it works:** `getCachedZmanim` checks AsyncStorage for a key like `zmanim:32.07_34.77_2026-04-02`. If found and for today, returns cached data. Otherwise fetches from HebCal and caches. Yesterday's cache is cleaned up.

---

### 5C-9: Chat Shows Streak Count

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5C-9 | Streak count in chat header | 1. Open a buddy chat. | The back button area shows the buddy's name and "X day streak" text. | [ ] |
| 5C-9b | Streak in buddy list | 1. View the buddy list in the social tab. | Each buddy row shows the chat's `streakCount` (not the friend's solo `tefillinCurrentStreak`). | [ ] |

---

### 5C-10: Chat Deleted on Buddy Remove

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5C-10a | Remove buddy deletes chat | 1. Remove a tefillin buddy (via profile modal or ✕ button). 2. Check Firestore `buddyChats` collection. | The pair chat doc and its messages subcollection are deleted. Both users' `buddyChatIds` no longer contain the chat ID. | [ ] |
| 5C-10b | Unfriend deletes chat | 1. Unfriend a user who was a tefillin buddy. | Same as above — buddy removal cascades to chat deletion. | [ ] |

---

### 5C-11: Cross-Timezone: Both Users Valid

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5C-11 | Different timezones | 1. User A in Jerusalem sends image at 2pm IST. 2. User B in NYC sends image at 3pm EST. | Both messages have `isStreakEligible: true` because both are within their own sunrise-sunset window. | [ ] |

**How it works:** `sendBuddyMessage` checks `isWithinSunWindow` using the sender's lat/lon/timezone from their profile. Each user's Zmanim are looked up independently.

---

### 5C-12: Fallback to Device Location

| ID | Test | Steps | Expected | Pass? |
|----|------|-------|----------|-------|
| 5C-12 | User with no profile lat/lon | 1. User has no `latitude`/`longitude` in Firestore profile. 2. Send an image in buddy chat. | Zmanim fetched using `currentLocation` from device's geolocation (set via `getCurrentLocation` on app open). | [ ] |

**How it works:** `handleBuddyImageSend` falls back: `user.latitude ?? currentLocation?.latitude`. The `loadLocationAndCongregations` callback also auto-persists lat/lon to the profile on first successful location fetch.

---

## Data Validation Checklist

After running all tests, verify these in Firestore:

- [ ] `buddyChats/{id}` docs have correct `memberUids`, `type: "pair"`, initial `streakCount: 0`
- [ ] Messages have all required fields: `senderUid`, `senderName`, `type`, `text`/`imageUrl`, `createdAt`, `opened`, `isStreakEligible`
- [ ] Images uploaded to `buddyChats/{chatId}/` path in Firebase Storage
- [ ] `isStreakEligible` is based on sender's actual sunrise/sunset (not a fixed window)
- [ ] Zmanim cache in AsyncStorage updates daily, keyed by `zmanim:{lat}_{lon}_{date}`
- [ ] `buddyChatIds` on user profiles stay in sync with actual chat docs
- [ ] `latitude` and `longitude` are persisted on `UserProfile` after first location fetch
- [ ] New users have `latitude: null` and `longitude: null` initially

---

## Architecture Notes

### Key Design Decisions

1. **HebCal Zmanim API** is used for sunrise/sunset, providing halachically accurate time windows per user location. Cached daily in AsyncStorage.

2. **Firebase Storage** is used for image uploads. Images are stored at `buddyChats/{chatId}/{senderUid}_{timestamp}.jpg`.

3. **Buddy chats are pair-specific.** Each buddy pair gets one chat document. The chat is auto-created when buddies are added and auto-deleted when they're removed.

4. **`isStreakEligible`** is determined at send time based on the sender's location. This means the sender's Zmanim are checked, not the receiver's. Module 5D will handle the actual streak evaluation.

5. **Location fallback chain:** User profile lat/lon → device's `currentLocation` → if neither available, image sends without streak eligibility.

6. **Real-time subscription** uses Firestore `onSnapshot` — same pattern as congregation chat and DMs.

---

## Edge Cases

- **No location data:** If the user has no lat/lon on their profile and no device location, image messages are sent but may not be streak-eligible (no sun window check possible).

- **Image upload failure:** If Firebase Storage upload fails, an error alert is shown and no message is created.

- **Rapid image sends:** Each image upload is independent. The `buddyChatImageLoading` state prevents double-sends from the UI.

- **Sun exactly at sunrise/sunset:** `isWithinSunWindow` uses `>=` for sunrise and `<=` for sunset (inclusive on both boundaries).

- **Network offline:** Firestore SDK queues writes. Messages will sync when connectivity returns. Image uploads require connectivity and will fail with an error.

---

## Release Sign-Off (Module 5C)

Mark each Pass/Fail:

- [p] 5C-1: Chat created on buddy add
- [p] 5C-2: Send text message
- [f] 5C-3: Send image while sun is up
- [n/a] 5C-4: Send image while sun is down (blocked)
- [n/a] 5C-5: Text allowed when sun is down
- [f] 5C-6: Message opened status (2 cases)
- [p] 5C-7: Real-time message updates
- [?] 5C-8: Zmanim cached per day
- [p] 5C-9: Chat shows streak count (2 cases)
- [p] 5C-10: Chat deleted on buddy remove (2 cases)
- [n/a] 5C-11: Cross-timezone both valid
- [p] 5C-12: Fallback to device location
- [?] Data validation checklist complete
- [P] No regressions in Module 5A or 5B functionality
