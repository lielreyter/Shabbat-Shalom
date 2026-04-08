# Module 5E: Group Buddy Chats — Testing Guide

## What Changed

### `src/friends/buddyChatService.ts`
- Added `addGroupMember(chatId, uid)` — adds a friend to an existing group chat, updating both the chat's `memberUids` and the user's `buddyChatIds`.
- Added `removeGroupMember(chatId, uid)` — removes a member from a group chat. If fewer than 2 members remain, the chat is auto-deleted.
- Added `getTodayStreakStatus(chatId, memberUids)` — queries today's streak-eligible image senders for the daily status banner.

### `App.tsx`
- Added `"groupCreate"` to `SocialSubTab` type for the group creation screen.
- Added group creation flow: multi-select friends, enter group name, create group chat.
- Added "Group Chats" section in the social/friends view listing all group chats.
- Updated buddy chat header to show group name + stacked member avatars for group chats.
- Added daily progress banner in group chats showing who has/hasn't sent today.
- Added Group Members modal (tap header) with add/remove member and leave group actions.
- Streak evaluation already handles groups via `memberUids` — no changes needed there.

---

## Test Cases

| ID    | Test                                     | Steps                                                           | Expected                                                 |
|-------|------------------------------------------|-----------------------------------------------------------------|----------------------------------------------------------|
| 5E-1  | Create group with 3 members              | Go to Social tab → scroll to "Group Chats" → tap "+ Create Group" → select 2+ friends → enter name "Morning Crew" → tap "Create Group" | `buddyChats` doc created with type "group", 3 memberUids, name "Morning Crew" |
| 5E-2  | All 3 send: streak increments            | All 3 members send image while sun is up, evaluate next day     | Group `streakCount` increments by 1                      |
| 5E-3  | 1 of 3 misses: streak breaks             | Only 2 of 3 members send image on that date, evaluate next day  | Group `streakCount` resets to 0                          |
| 5E-4  | Daily status shows who hasn't sent       | Open group chat where 2 of 3 have sent today                    | Banner shows ✓ for senders, ○ for non-senders            |
| 5E-5  | Sun down: image blocked for group        | After sender's sunset, attempt to send image in group chat      | Blocked with "sun is not visible" message                |
| 5E-6  | Add member to group                      | Open group chat → tap header → in members modal tap "+ Add" next to a friend | `memberUids` now includes new member, their `buddyChatIds` updated |
| 5E-7  | Remove member from group                 | Open group chat → tap header → tap "Remove" next to a member   | Member removed from `memberUids`, their `buddyChatIds` updated |
| 5E-8  | Member leaves group                      | Open group chat → tap header → tap "Leave Group"               | User removed from group, navigated back to friends view  |
| 5E-9  | Group name displayed                     | Open group chat                                                 | Group name shown at top with member count and streak     |
| 5E-10 | Cross-timezone group                     | 3 members in 3 timezones, all send during their own daylight    | All count for that date; streak increments               |
| 5E-11 | Cannot create with <2 friends            | On group create screen, select only 1 friend                    | "Create Group" button is disabled                        |
| 5E-12 | Group appears in list after creation     | Create a group, return to social tab                            | New group visible in "Group Chats" section               |
| 5E-13 | Group auto-deletes when <2 members       | Remove members until only 1 remains                             | Chat doc is deleted, removed from user's `buddyChatIds`  |

---

## How to Test

1. **Create a group:** Scroll to the "Group Chats" section in the Social tab. Tap "+ Create Group". Select 2+ friends and enter a name. Tap "Create Group".

2. **Open a group chat:** Tap on any group in the "Group Chats" list. Verify the header shows the group name, stacked member avatars, member count, and streak count.

3. **Daily status banner:** In a group chat, check the "Today's Progress" banner. It shows each member with ✓ (sent) or ○ (not sent) based on today's streak-eligible images.

4. **Manage members:** Tap the group header to open the members modal. You can:
   - See all current members
   - Add friends who aren't in the group yet
   - Remove members
   - Leave the group

5. **Streak evaluation:** The existing streak evaluator from Module 5D handles groups — it checks ALL `memberUids` for streak-eligible images on each calendar date. No separate testing needed beyond verifying 5E-2 and 5E-3.

---

## Data Validation Checklist

- [ ] Group `type` is `"group"`, pair `type` is `"pair"`
- [ ] Group `name` is stored and non-null
- [ ] `memberUids` array accurately reflects group membership
- [ ] Streak evaluation requires ALL members (not just majority)
- [ ] Adding/removing members updates both the chat doc and user profiles
- [ ] Each member's sun window is checked independently based on their location
- [ ] Group with <2 members is auto-deleted
