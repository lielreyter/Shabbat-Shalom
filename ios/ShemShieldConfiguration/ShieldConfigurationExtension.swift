//
//  ShieldConfigurationExtension.swift
//  ShemShieldConfiguration
//
//  Created by Liel R on 4/27/26.
//

import ManagedSettings
import ManagedSettingsUI
import UIKit

private let appGroupIdentifier = "group.com.lielsimon.shem"
private let currentShieldReasonKey = "currentShieldReason"

private enum ShemShieldReason {
    case modehAni
    case shema
    case shabbat
    case personal
    case generic
}

private func currentReason() -> ShemShieldReason {
    let raw = UserDefaults(suiteName: appGroupIdentifier)?
        .string(forKey: currentShieldReasonKey)

    switch raw {
    case "modehAni", "shem.modehAni":
        return .modehAni
    case "shema", "shem.shema":
        return .shema
    case "shabbat", "shem.shabbat":
        return .shabbat
    case "personal", "shem.personal":
        return .personal
    default:
        return .generic
    }
}

private func shieldConfiguration() -> ShieldConfiguration {
    let reason = currentReason()

    let title: String
    let subtitle: String
    let primaryButton: String

    switch reason {
    case .modehAni:
        title = "Modeh Ani"
        subtitle = "Open Shem and recite the Modeh Ani. After you tap \"I have read this,\" your apps will unlock for the day."
        primaryButton = "Close"
    case .shema:
        title = "Shema"
        subtitle = "Open Shem and recite the Shema. After you tap \"I have read this,\" your apps will unlock for the night."
        primaryButton = "Close"
    case .shabbat:
        title = "Shabbat"
        subtitle = "It is Shabbat. Open Shem only if you want to break Shabbat."
        primaryButton = "Close"
    case .personal:
        title = "Blocked by Shem"
        subtitle = "This app is blocked by Shem."
        primaryButton = "Close"
    case .generic:
        title = "Shem"
        subtitle = "This app is blocked by Shem."
        primaryButton = "Close"
    }

    return ShieldConfiguration(
        backgroundBlurStyle: .systemUltraThinMaterialLight,
        backgroundColor: UIColor(red: 0.94, green: 0.97, blue: 1.0, alpha: 1.0),
        icon: UIImage(systemName: "sparkles"),
        title: ShieldConfiguration.Label(
            text: title,
            color: UIColor(red: 0.12, green: 0.23, blue: 0.44, alpha: 1.0)
        ),
        subtitle: ShieldConfiguration.Label(
            text: subtitle,
            color: UIColor(red: 0.39, green: 0.45, blue: 0.55, alpha: 1.0)
        ),
        primaryButtonLabel: ShieldConfiguration.Label(
            text: primaryButton,
            color: .white
        ),
        primaryButtonBackgroundColor: UIColor(red: 0.15, green: 0.39, blue: 0.92, alpha: 1.0)
    )
}

class ShieldConfigurationExtension: ShieldConfigurationDataSource {
    override func configuration(shielding application: Application) -> ShieldConfiguration {
        shieldConfiguration()
    }

    override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
        shieldConfiguration()
    }

    override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
        shieldConfiguration()
    }

    override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration {
        shieldConfiguration()
    }
}
