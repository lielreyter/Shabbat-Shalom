import FamilyControls
import DeviceActivity
import Foundation
import ManagedSettings
import React

private let appGroupIdentifier = "group.com.lielsimon.shem"
private let activeReasonsKey = "activeBlockReasons"
private let currentShieldReasonKey = "currentShieldReason"

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
  setSharedValue([reason], forKey: activeReasonsKey)
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
    false
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

    Task {
      do {
        try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
        resolve(true)
      } catch {
        // Surface a soft failure so JS can treat this as "not granted"
        // rather than crashing on entitlement/config issues.
        resolve(false)
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

    let store = ManagedSettingsStore()
    store.shield.applicationCategories = .all(except: Set<ApplicationToken>())
    setActiveShieldReason(currentScheduledReason())
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
