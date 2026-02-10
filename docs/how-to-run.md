# How to Run (iOS)

This guide explains how to install dependencies and run the app locally
for the current modules (Auth, Location/Shabbat Times, Shabbat Mode).

## Prerequisites
- macOS with Xcode installed
- Node.js + npm or yarn
- CocoaPods (`sudo gem install cocoapods` if needed)
- A Firebase iOS app configured in the Firebase console

## 1) Install JavaScript Dependencies
From the project root:
```
npm install
```
or
```
yarn install
```

If you added Module 1–3 dependencies manually:
```
npm install firebase @invertase/react-native-apple-authentication \
  @react-native-async-storage/async-storage react-native-config \
  react-native-get-random-values uuid @noble/hashes \
  react-native-geolocation-service
```

## 2) Environment Variables
Create a `.env` file at the project root:
```
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
FIREBASE_MEASUREMENT_ID=...
```

`react-native-config` is used to load these values in `src/firebase/firebaseConfig.ts`.

## 3) iOS Setup

### Firebase
- Download `GoogleService-Info.plist` from Firebase.
- Place it in your iOS project (typically `ios/`).

### Apple Sign-In
**Dev Mode:** Apple Sign-In is stubbed in JS. No Apple Developer entitlements
are required to run locally.

**Production:** Enable **Sign In with Apple** capability in Xcode and ensure
your bundle identifier matches Firebase and Apple settings.

### Screen Time (Module 3)
**Dev Mode:** Screen Time is stubbed in JS. No native modules required.

**Production:** This module expects native iOS modules for:
- `ScreenTimeService`
- `ShabbatModeScheduler`

These are not included in JS and must be implemented in Swift/Obj‑C using:
`FamilyControls`, `DeviceActivity`, `ManagedSettings`.

### Location Permissions (Module 2)
Add to `Info.plist`:
- `NSLocationWhenInUseUsageDescription`
- `NSLocationAlwaysAndWhenInUseUsageDescription` (optional)

### Notifications (Future Module 4)
**Dev Mode:** Notifications are stubbed in JS.

**Production:** UNUserNotificationCenter permissions will be required when
Module 4 is added.

## 4) Install Pods
```
cd ios
pod install
cd ..
```

## 5) Run the App (iOS)
```
npm run ios
```
or
```
yarn ios
```

## Notes
- Dev Mode is controlled by `src/config/devMode.ts` (set to `true` now).
- Module 3 will not fully function until native Screen Time modules are wired.
- Module 2 requires location permissions on device or simulator.
- Apple Sign-In requires a real device for full testing.
