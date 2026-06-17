import UIKit
import React

@objc(AppIconService)
class AppIconService: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    true
  }

  @objc func getCurrentIcon(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(UIApplication.shared.alternateIconName)
  }

  @objc func setIcon(
    _ iconName: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard UIApplication.shared.supportsAlternateIcons else {
      resolve(nil)
      return
    }

    let normalizedName: String? = {
      guard let iconName, !iconName.isEmpty else { return nil }
      return iconName
    }()

    if UIApplication.shared.alternateIconName == normalizedName {
      resolve(nil)
      return
    }

    UIApplication.shared.setAlternateIconName(normalizedName) { error in
      if let error {
        reject("ICON_ERROR", error.localizedDescription, error)
        return
      }
      resolve(nil)
    }
  }
}
