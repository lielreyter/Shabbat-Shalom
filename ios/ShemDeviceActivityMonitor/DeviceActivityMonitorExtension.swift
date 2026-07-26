//
//  DeviceActivityMonitorExtension.swift
//  ShemDeviceActivityMonitor
//
//  Created by Liel R on 4/27/26.
//

import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

private let appGroupIdentifier = "group.com.lielsimon.shem"
private let activeReasonsKey = "activeBlockReasons"
private let currentShieldReasonKey = "currentShieldReason"
private let blockModeKey = "blockMode"

private func sharedDefaults() -> UserDefaults? {
    UserDefaults(suiteName: appGroupIdentifier)
}

private func reason(for activity: DeviceActivityName) -> String {
    activity.rawValue.hasPrefix("shem.")
        ? String(activity.rawValue.dropFirst("shem.".count))
        : activity.rawValue
}

private func activeReasons() -> Set<String> {
    let stored = sharedDefaults()?.stringArray(forKey: activeReasonsKey) ?? []
    return Set(stored)
}

private func saveActiveReasons(_ reasons: Set<String>) {
    let defaults = sharedDefaults()
    defaults?.set(Array(reasons), forKey: activeReasonsKey)
    if reasons.contains("shabbat") || reasons.contains("shem.shabbat") {
        defaults?.set("shabbat", forKey: currentShieldReasonKey)
    } else {
        defaults?.set(reasons.sorted().last, forKey: currentShieldReasonKey)
    }
    defaults?.synchronize()
}

private func selectionDataKey(for mode: String) -> String {
    "familyActivitySelection.\(mode)"
}

private func loadSelection(mode: String) -> FamilyActivitySelection? {
    guard let data = sharedDefaults()?.data(forKey: selectionDataKey(for: mode)) else {
        return nil
    }
    return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
}

private func enableFullBlocking() {
    let store = ManagedSettingsStore()
    store.shield.applications = nil
    store.shield.webDomains = nil
    store.shield.applicationCategories = .all(except: Set<ApplicationToken>())
}

private func enableSelectionBlocking(mode: String) -> Bool {
    guard let selection = loadSelection(mode: mode) else {
        return false
    }

    let count = selection.applicationTokens.count +
        selection.categoryTokens.count +
        selection.webDomainTokens.count

    guard count > 0 else {
        return false
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
    return true
}

private func enableConfiguredBlocking() {
    let mode = sharedDefaults()?.string(forKey: blockModeKey) ?? "none"
    if mode == "none" {
        return
    }
    if mode == "full" {
        enableFullBlocking()
        return
    }
    if mode == "custom" || mode == "medium" {
        _ = enableSelectionBlocking(mode: mode)
    }
}

private func enableBlocking(for activity: DeviceActivityName) {
    let reasons = activeReasons()
    if reasons.contains("shabbat") || reasons.contains("shem.shabbat") {
        enableConfiguredBlocking()
        return
    }

    switch activity.rawValue {
    case "modehAni", "shem.modehAni", "shema", "shem.shema":
        enableFullBlocking()
    case "personal", "shem.personal":
        if !enableSelectionBlocking(mode: "personal") {
            enableFullBlocking()
        }
    default:
        enableConfiguredBlocking()
    }
}

private func enableBlocking(for reasons: Set<String>) {
    if reasons.contains("shabbat") || reasons.contains("shem.shabbat") {
        enableConfiguredBlocking()
        return
    }

    if reasons.contains("modehAni") ||
        reasons.contains("shem.modehAni") ||
        reasons.contains("shema") ||
        reasons.contains("shem.shema") {
        enableFullBlocking()
        return
    }

    if reasons.contains("personal") || reasons.contains("shem.personal") {
        if !enableSelectionBlocking(mode: "personal") {
            enableFullBlocking()
        }
        return
    }

    enableConfiguredBlocking()
}

private func clearBlockingIfUnused() {
    guard activeReasons().isEmpty else {
        return
    }

    sharedDefaults()?.removeObject(forKey: currentShieldReasonKey)
    let store = ManagedSettingsStore()
    store.clearAllSettings()
}

class DeviceActivityMonitorExtension: DeviceActivityMonitor {
    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)

        var reasons = activeReasons()
        reasons.insert(reason(for: activity))
        saveActiveReasons(reasons)
        enableBlocking(for: activity)
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)

        var reasons = activeReasons()
        reasons.remove(reason(for: activity))
        // Remove the legacy prefixed value as well so installs upgraded from
        // older builds cannot retain a stale Shabbat shield indefinitely.
        reasons.remove(activity.rawValue)
        saveActiveReasons(reasons)
        if reasons.isEmpty {
            clearBlockingIfUnused()
        } else {
            enableBlocking(for: reasons)
        }
    }

    override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
        super.eventDidReachThreshold(event, activity: activity)
    }

    override func intervalWillStartWarning(for activity: DeviceActivityName) {
        super.intervalWillStartWarning(for: activity)
    }

    override func intervalWillEndWarning(for activity: DeviceActivityName) {
        super.intervalWillEndWarning(for: activity)
    }

    override func eventWillReachThresholdWarning(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
        super.eventWillReachThresholdWarning(event, activity: activity)
    }
}
