import FamilyControls
import Foundation
import ManagedSettings
import React

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
    resolve(nil)
  }
}
