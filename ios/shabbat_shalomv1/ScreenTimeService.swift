import FamilyControls
import DeviceActivity
import Foundation
import ManagedSettings
import React
import SwiftUI

private let appGroupIdentifier = "group.com.lielsimon.shem"
private let activeReasonsKey = "activeBlockReasons"
private let currentShieldReasonKey = "currentShieldReason"
private let blockModeKey = "blockMode"

private extension DeviceActivityName {
  static let shemModehAni = Self("shem.modehAni")
  static let shemShema = Self("shem.shema")
  static let shemShabbat = Self("shem.shabbat")
}

private func activityName(for identifier: String) -> DeviceActivityName {
  switch identifier {
  case "modehAni":
    return .shemModehAni
  case "shema":
    return .shemShema
  case "shabbat":
    return .shemShabbat
  default:
    return DeviceActivityName("shem.\(identifier)")
  }
}

private func dateComponents(from date: Date) -> DateComponents {
  Calendar.current.dateComponents(
    [.year, .month, .day, .hour, .minute, .second],
    from: date
  )
}

private func parseIsoDate(_ value: String) -> Date? {
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  if let date = formatter.date(from: value) {
    return date
  }

  formatter.formatOptions = [.withInternetDateTime]
  return formatter.date(from: value)
}

private func sharedDefaults() -> UserDefaults? {
  UserDefaults(suiteName: appGroupIdentifier)
}

private func setSharedValue(_ value: Any?, forKey key: String) {
  let defaults = sharedDefaults()
  if let value {
    defaults?.set(value, forKey: key)
  } else {
    defaults?.removeObject(forKey: key)
  }
  defaults?.synchronize()
}

private func setActiveShieldReason(_ reason: String?) {
  guard let reason else {
    setSharedValue(nil, forKey: currentShieldReasonKey)
    setSharedValue([], forKey: activeReasonsKey)
    return
  }

  setSharedValue(reason, forKey: currentShieldReasonKey)
}

private func selectionDataKey(for mode: String) -> String {
  "familyActivitySelection.\(mode)"
}

private func selectionCountKey(for mode: String) -> String {
  "familyActivitySelection.\(mode).count"
}

@available(iOS 16.0, *)
private func loadSelection(mode: String) -> FamilyActivitySelection? {
  guard let data = sharedDefaults()?.data(forKey: selectionDataKey(for: mode)) else {
    return nil
  }
  return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
}

@available(iOS 16.0, *)
private func saveSelection(_ selection: FamilyActivitySelection, mode: String) throws -> Int {
  let data = try JSONEncoder().encode(selection)
  let count = selection.applicationTokens.count +
    selection.categoryTokens.count +
    selection.webDomainTokens.count
  let defaults = sharedDefaults()
  defaults?.set(data, forKey: selectionDataKey(for: mode))
  defaults?.set(count, forKey: selectionCountKey(for: mode))
  defaults?.synchronize()
  return count
}

private func selectionCount(mode: String) -> Int {
  sharedDefaults()?.integer(forKey: selectionCountKey(for: mode)) ?? 0
}

@available(iOS 16.0, *)
private func applySelectionBlocking(mode: String) throws -> Int {
  guard let selection = loadSelection(mode: mode) else {
    throw NSError(
      domain: "ScreenTimeService",
      code: 1,
      userInfo: [NSLocalizedDescriptionKey: "No \(mode) app selection saved."]
    )
  }

  let count = selection.applicationTokens.count +
    selection.categoryTokens.count +
    selection.webDomainTokens.count

  guard count > 0 else {
    throw NSError(
      domain: "ScreenTimeService",
      code: 2,
      userInfo: [NSLocalizedDescriptionKey: "Pick at least one app, category, or website."]
    )
  }

  let store = ManagedSettingsStore()
  store.shield.applications = selection.applicationTokens.isEmpty ?
    nil :
    selection.applicationTokens
  store.shield.applicationCategories = selection.categoryTokens.isEmpty ?
    nil :
    .specific(selection.categoryTokens)
  store.shield.webDomains = selection.webDomainTokens.isEmpty ?
    nil :
    selection.webDomainTokens
  return count
}

@available(iOS 16.0, *)
private func applyConfiguredBlocking() throws {
  let mode = sharedDefaults()?.string(forKey: blockModeKey) ?? "none"
  if mode == "none" {
    return
  }
  if mode == "custom" || mode == "medium" {
    _ = try applySelectionBlocking(mode: mode)
    return
  }

  let store = ManagedSettingsStore()
  store.shield.applications = nil
  store.shield.webDomains = nil
  store.shield.applicationCategories = .all(except: Set<ApplicationToken>())
}

@available(iOS 16.0, *)
private func applyFullBlocking() {
  let store = ManagedSettingsStore()
  store.shield.applications = nil
  store.shield.webDomains = nil
  store.shield.applicationCategories = .all(except: Set<ApplicationToken>())
}

private func rootViewController() -> UIViewController? {
  let scenes = UIApplication.shared.connectedScenes
    .compactMap { $0 as? UIWindowScene }
  let window = scenes
    .flatMap { $0.windows }
    .first { $0.isKeyWindow }
  var controller = window?.rootViewController
  while let presented = controller?.presentedViewController {
    controller = presented
  }
  return controller
}

@available(iOS 16.0, *)
private struct FamilyActivityPickerSheet: View {
  let title: String
  let initialSelection: FamilyActivitySelection
  let onCancel: () -> Void
  let onSave: (FamilyActivitySelection) -> Void

  @State private var selection: FamilyActivitySelection

  init(
    title: String,
    initialSelection: FamilyActivitySelection,
    onCancel: @escaping () -> Void,
    onSave: @escaping (FamilyActivitySelection) -> Void
  ) {
    self.title = title
    self.initialSelection = initialSelection
    self.onCancel = onCancel
    self.onSave = onSave
    _selection = State(initialValue: initialSelection)
  }

  var body: some View {
    NavigationView {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button("Cancel", action: onCancel)
          }
          ToolbarItem(placement: .confirmationAction) {
            Button("Save") {
              onSave(selection)
            }
          }
        }
    }
  }
}

private func currentScheduledReason() -> String {
  let defaults = sharedDefaults()
  let now = Date()
  for identifier in ["modehAni", "shema", "shabbat"] {
    guard let startIso = defaults?.string(forKey: "block.\(identifier).startIso"),
          let endIso = defaults?.string(forKey: "block.\(identifier).endIso"),
          let startDate = parseIsoDate(startIso),
          let endDate = parseIsoDate(endIso) else {
      continue
    }

    if now >= startDate && now <= endDate {
      return identifier
    }
  }

  return "manual"
}

@objc(ScreenTimeService)
class ScreenTimeService: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    true
  }

  @available(iOS 16.0, *)
  private func authorizationStatusValue() -> String {
    switch AuthorizationCenter.shared.authorizationStatus {
    case .notDetermined:
      return "notDetermined"
    case .denied:
      return "denied"
    case .approved:
      return "approved"
    @unknown default:
      return "denied"
    }
  }

  @available(iOS 16.0, *)
  private func requireAuthorization(_ reject: RCTPromiseRejectBlock) -> Bool {
    guard AuthorizationCenter.shared.authorizationStatus == .approved else {
      reject(
        "screen_time_not_authorized",
        "Screen Time access is not currently approved for Kesher.",
        nil
      )
      return false
    }
    return true
  }

  @objc(getAuthorizationStatus:rejecter:)
  func getAuthorizationStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      resolve(["status": "unavailable"])
      return
    }

    resolve(["status": authorizationStatusValue()])
  }

  @objc(requestAuthorization:rejecter:)
  func requestAuthorization(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      resolve(false)
      return
    }

    Task { @MainActor in
      do {
        if AuthorizationCenter.shared.authorizationStatus == .approved {
          resolve(true)
          return
        }
        try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
        resolve(AuthorizationCenter.shared.authorizationStatus == .approved)
      } catch {
        let code = AuthorizationCenter.shared.authorizationStatus == .denied
          ? "screen_time_auth_denied"
          : "screen_time_auth_failed"
        reject(code, error.localizedDescription, error)
      }
    }
  }

  @objc(enableFullAppBlocking:rejecter:)
  func enableFullAppBlocking(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("screen_time_unavailable",
             "Screen Time blocking requires iOS 16 or newer.",
             nil)
      return
    }
    guard requireAuthorization(reject) else { return }

    applyFullBlocking()
    if sharedDefaults()?.string(forKey: currentShieldReasonKey) == nil {
      setActiveShieldReason(currentScheduledReason())
    }
    resolve(nil)
  }

  @objc(setShieldReason:resolver:rejecter:)
  func setShieldReason(
    _ reason: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    setActiveShieldReason(reason == "personal" ? "shem.personal" : reason)
    resolve(nil)
  }

  @objc(enablePersonalBlocking:rejecter:)
  func enablePersonalBlocking(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("screen_time_unavailable",
             "Screen Time blocking requires iOS 16 or newer.",
             nil)
      return
    }
    guard requireAuthorization(reject) else { return }

    do {
      let count = try applySelectionBlocking(mode: "personal")
      setActiveShieldReason("shem.personal")
      resolve(["count": count])
    } catch {
      reject("screen_time_selection_missing",
             error.localizedDescription,
             error)
    }
  }

  @objc(enableBlockingMode:resolver:rejecter:)
  func enableBlockingMode(
    _ mode: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("screen_time_unavailable",
             "Screen Time blocking requires iOS 16 or newer.",
             nil)
      return
    }
    if mode != "none" {
      guard requireAuthorization(reject) else { return }
    }

    do {
      setSharedValue(mode, forKey: blockModeKey)
      if mode == "none" {
        let store = ManagedSettingsStore()
        store.clearAllSettings()
        setActiveShieldReason(nil)
        resolve(["count": 0])
        return
      }

      if mode == "custom" || mode == "medium" {
        let count = try applySelectionBlocking(mode: mode)
        setActiveShieldReason(currentScheduledReason())
        resolve(["count": count])
        return
      }

      applyFullBlocking()
      setActiveShieldReason(currentScheduledReason())
      resolve(["count": -1])
    } catch {
      reject("screen_time_selection_missing",
             error.localizedDescription,
             error)
    }
  }

  @objc(setBlockMode:resolver:rejecter:)
  func setBlockMode(
    _ mode: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    setSharedValue(mode, forKey: blockModeKey)
    if mode == "none", #available(iOS 16.0, *) {
      ManagedSettingsStore().clearAllSettings()
      setActiveShieldReason(nil)
    }
    resolve(nil)
  }

  @objc(disableAllBlocking:rejecter:)
  func disableAllBlocking(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      resolve(nil)
      return
    }

    let store = ManagedSettingsStore()
    store.clearAllSettings()
    setActiveShieldReason(nil)
    resolve(nil)
  }

  @objc(clearExpiredShabbatBlocking:rejecter:)
  func clearExpiredShabbatBlocking(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      resolve(nil)
      return
    }

    let defaults = sharedDefaults()
    let currentReason = defaults?.string(forKey: currentShieldReasonKey)
    let isShabbatReason =
      currentReason == "shabbat" || currentReason == "shem.shabbat"
    guard isShabbatReason else {
      resolve(nil)
      return
    }

    var reasons = Set(defaults?.stringArray(forKey: activeReasonsKey) ?? [])
    reasons.remove("shabbat")
    reasons.remove("shem.shabbat")
    setSharedValue(Array(reasons), forKey: activeReasonsKey)

    if reasons.isEmpty {
      ManagedSettingsStore().clearAllSettings()
      setSharedValue(nil, forKey: currentShieldReasonKey)
    } else {
      setSharedValue(reasons.sorted().last, forKey: currentShieldReasonKey)
    }
    resolve(nil)
  }

  @objc(scheduleBlock:startIso:endIso:resolver:rejecter:)
  func scheduleBlock(
    _ identifier: String,
    startIso: String,
    endIso: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("screen_time_unavailable",
             "Scheduled Screen Time blocking requires iOS 16 or newer.",
             nil)
      return
    }
    guard requireAuthorization(reject) else { return }

    guard let startDate = parseIsoDate(startIso),
          let endDate = parseIsoDate(endIso),
          endDate > startDate else {
      reject("screen_time_invalid_schedule",
             "Scheduled block requires valid future start and end dates.",
             nil)
      return
    }

    let activityName = activityName(for: identifier)
    let schedule = DeviceActivitySchedule(
      intervalStart: dateComponents(from: startDate),
      intervalEnd: dateComponents(from: endDate),
      repeats: false
    )

    do {
      try DeviceActivityCenter().startMonitoring(activityName, during: schedule)
      setSharedValue(startIso, forKey: "block.\(identifier).startIso")
      setSharedValue(endIso, forKey: "block.\(identifier).endIso")
      setSharedValue(identifier, forKey: "block.\(identifier).reason")
      resolve(nil)
    } catch {
      reject("screen_time_schedule_failed",
             "Failed to schedule Screen Time block.",
             error)
    }
  }

  @objc(presentFamilyActivityPicker:title:resolver:rejecter:)
  func presentFamilyActivityPicker(
    _ mode: String,
    title: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("screen_time_unavailable",
             "Family Activity Picker requires iOS 16 or newer.",
             nil)
      return
    }
    guard requireAuthorization(reject) else { return }

    DispatchQueue.main.async {
      let initialSelection = loadSelection(mode: mode) ?? FamilyActivitySelection()
      let hostingController = UIHostingController(
        rootView: FamilyActivityPickerSheet(
          title: title,
          initialSelection: initialSelection,
          onCancel: {
            rootViewController()?.dismiss(animated: true)
            resolve([
              "cancelled": true,
              "count": selectionCount(mode: mode),
            ])
          },
          onSave: { selection in
            do {
              let count = try saveSelection(selection, mode: mode)
              rootViewController()?.dismiss(animated: true)
              resolve([
                "cancelled": false,
                "count": count,
              ])
            } catch {
              rootViewController()?.dismiss(animated: true)
              reject("screen_time_selection_save_failed",
                     "Failed to save app selection.",
                     error)
            }
          }
        )
      )
      hostingController.modalPresentationStyle = .formSheet
      rootViewController()?.present(hostingController, animated: true)
    }
  }

  @objc(getFamilyActivitySelectionSummary:resolver:rejecter:)
  func getFamilyActivitySelectionSummary(
    _ mode: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    resolve(["count": selectionCount(mode: mode)])
  }

  @objc(cancelScheduledBlock:resolver:rejecter:)
  func cancelScheduledBlock(
    _ identifier: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      resolve(nil)
      return
    }

    let activityName = activityName(for: identifier)
    DeviceActivityCenter().stopMonitoring([activityName])
    setSharedValue(nil, forKey: "block.\(identifier).startIso")
    setSharedValue(nil, forKey: "block.\(identifier).endIso")
    setSharedValue(nil, forKey: "block.\(identifier).reason")
    resolve(nil)
  }
}
