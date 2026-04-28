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

private func sharedDefaults() -> UserDefaults? {
    UserDefaults(suiteName: appGroupIdentifier)
}

private func reason(for activity: DeviceActivityName) -> String {
    activity.rawValue
}

private func activeReasons() -> Set<String> {
    let stored = sharedDefaults()?.stringArray(forKey: activeReasonsKey) ?? []
    return Set(stored)
}

private func saveActiveReasons(_ reasons: Set<String>) {
    let defaults = sharedDefaults()
    defaults?.set(Array(reasons), forKey: activeReasonsKey)
    defaults?.set(reasons.sorted().last, forKey: currentShieldReasonKey)
    defaults?.synchronize()
}

private func enableFullBlocking() {
    let store = ManagedSettingsStore()
    store.shield.applicationCategories = .all(except: Set<ApplicationToken>())
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
        enableFullBlocking()
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)

        var reasons = activeReasons()
        reasons.remove(reason(for: activity))
        saveActiveReasons(reasons)
        clearBlockingIfUnused()
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
