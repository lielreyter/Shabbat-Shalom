# Push Notifications And Family Controls Setup

## What is already real in this repo

- `DEV_MODE` is `false` in `src/config/devMode.ts`.
- Local notification code exists in `ios/shabbat_shalomv1/NotificationsService.m`.
- Screen Time blocking code exists in `ios/shabbat_shalomv1/ScreenTimeService.swift`.
- The app initializes Firebase in `AppDelegate.swift`.
- The app requests chat push permission, fetches the device FCM token, and saves it
  to `users/{uid}.fcmToken`.
- User profiles now include:
  - `fcmToken`
  - `wantsChatNotifications`

## What is not fully finished yet

- Backend chat push sending is not wired yet.
- Family Controls can block all apps immediately, but scheduled background blocking
  at the exact wake/bed time still needs an iOS `DeviceActivityMonitor` extension.
- Custom app selection was removed because iOS app selection must come from
  Family Controls, not a hardcoded app list.

## Goal split

### 1. Tefillin notifications

Use local notifications from the app.

- No user-facing "chat notifications" setting should affect tefillin.
- If you want tefillin to be truly mandatory, remove the old tefillin toggle and
  always schedule the reminder from `wakeUpTime`.

### 2. Chat notifications

Use remote push notifications.

- Controlled by `users/{uid}.wantsChatNotifications`
- Sent for:
  - buddy chats
  - congregation chat
- Not sent when that field is `false`

## iOS push notification setup

### Apple Developer

1. Open Apple Developer.
2. Go to Certificates, Identifiers & Profiles.
3. Open your app ID that matches the iOS bundle identifier exactly.
4. Enable:
   - Push Notifications
   - Family Controls (already requested)
5. Create or reuse an APNs Auth Key.
6. Download the `.p8` key if you do not already have it.
7. Regenerate your iOS provisioning profile after enabling capabilities.
8. Download and install the new provisioning profile.

### Firebase Console

1. Open Firebase Console.
2. Open Project Settings.
3. Open the Cloud Messaging tab.
4. Upload the APNs Auth Key:
   - Key ID
   - Team ID
   - `.p8` file
5. Confirm the iOS app bundle ID matches your Xcode target exactly.

### React Native app dependencies

Native Firebase messaging is already listed in `package.json`. After pulling these
changes, run:

```bash
cd ios && pod install
```

### Xcode

In the main app target:

1. `Signing & Capabilities`:
   - Add `Push Notifications`
   - Add `Background Modes`
   - Enable `Remote notifications`
2. Make sure `GoogleService-Info.plist` is included in the app target.
3. Build on a physical iPhone, not the simulator.

### App startup work now done

- `FirebaseApp.configure()` is called from `AppDelegate.swift`.
- Push permission is requested for signed-in users with chat notifications enabled.
- FCM tokens are saved to `users/{uid}.fcmToken`.
- Token refreshes are persisted back to Firestore.

## Chat push flow to implement

### App side

1. Request push permission once user is signed in.
2. Fetch FCM token.
3. Save token to the user's Firestore doc.
4. Respect `wantsChatNotifications` before subscribing or registering.

### Backend side

Use Firebase Cloud Functions or another trusted server:

1. Trigger on new buddy message.
2. Trigger on new congregation message.
3. Load recipient user docs.
4. Skip sender.
5. Skip users with `wantsChatNotifications === false`.
6. Send FCM push to stored tokens.

## Tefillin reminder path

Current repo uses local notifications for tefillin.

To make it fully real:

1. Keep the native local notification module.
2. Request notification permission on device.
3. Schedule tefillin using the saved `wakeUpTime`.
4. If you want no off switch:
   - remove the old tefillin toggle from the UI
   - always schedule/re-schedule when `wakeUpTime` changes

## Family Controls in Xcode not showing

This is usually one of these:

1. The capability was approved for the team, but not actually attached to the
   specific App ID.
2. The provisioning profile was not regenerated after enabling it.
3. Xcode cached old profiles.
4. Bundle IDs do not match exactly.
5. Family Controls is a managed capability and does not always show like a normal
   toggle in Xcode even when the entitlement works.

### What to do

1. Verify the exact app ID in Apple Developer has Family Controls enabled.
2. Regenerate the provisioning profile for that app ID.
3. Download/install the new profile.
4. In Xcode:
   - Settings / Accounts / your team / Download Manual Profiles
   - clean build folder
   - restart Xcode
5. Check the built app's entitlements at runtime rather than relying only on the
   Capabilities UI.
6. If still missing, contact Apple Developer Support and ask them to confirm the
   managed capability is attached to the exact App ID.

## Remaining non-real / placeholder items in this repo

### Still placeholder

- `COMMON_APPS` in `App.tsx` is not real iOS app selection.
- Background scheduled prayer blocking is not complete without a native monitor extension.

### Not currently active, but still present as fallback code

- Some auth code paths still contain DEV fallback profile creation logic in
  `src/auth/authService.ts`, but they should not run while `DEV_MODE` is `false`.

## Recommended order

1. Finish APNs + FCM setup in Apple Developer, Firebase, and Xcode.
2. Add backend push sender for chat messages.
3. Remove or redesign the tefillin toggle if tefillin must always notify.
4. Add `DeviceActivityMonitor` extension for true scheduled all-app prayer blocking.
5. Add real Family Controls app/category selection if custom app blocking is still needed.
