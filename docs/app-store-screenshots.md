# App Store Screenshots

Use a Release build for App Store screenshots and app preview videos. Debug builds can show React Native development UI such as "Connect Metro to develop JavaScript" when Metro is not connected. Release builds bundle JavaScript into the app and do not show that banner.

## iOS Simulator Screenshots

From the repo root:

```bash
npm run ios:release
```

If you need a specific simulator, run:

```bash
npx react-native run-ios --mode Release --simulator "iPhone 16 Pro"
```

## Xcode Screenshots

1. Open `ios/shabbat_shalomv1.xcworkspace`.
2. Select the app scheme.
3. Product -> Scheme -> Edit Scheme.
4. Select **Run**.
5. Change **Build Configuration** from `Debug` to `Release`.
6. Run the app on the simulator or device.

## If the Banner Still Appears

- Fully quit the app from the simulator/device and launch it again.
- Make sure the scheme says `Release`, not `Debug`.
- Do not use the default `npm run ios` command for screenshot capture; that starts a development build.
- If using a physical device, use Xcode with the Run build configuration set to `Release`.
