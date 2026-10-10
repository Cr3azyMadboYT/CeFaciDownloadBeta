import ExpoModulesCore
import UIKit

public class CefaciIconModule: Module {
  private let looks = ["primavara", "vara", "toamna", "iarna", "craciun"]
  public func definition() -> ModuleDefinition {
    Name("CefaciIcon")
    Function("current") { () -> String in
      let read = { UIApplication.shared.alternateIconName?.replacingOccurrences(of: "Icon_", with: "") ?? "vara" }
      return Thread.isMainThread ? read() : DispatchQueue.main.sync(execute: read)
    }
    AsyncFunction("set") { (look: String, promise: Promise) in
      guard self.looks.contains(look) else { promise.resolve(false); return }
      DispatchQueue.main.async {
        let app = UIApplication.shared
        guard app.supportsAlternateIcons, app.applicationState == .active else { promise.resolve(false); return }
        let name: String? = look == "vara" ? nil : "Icon_" + look
        if app.alternateIconName == name { promise.resolve(true); return }
        app.setAlternateIconName(name) { error in
          if let error = error { promise.reject(error) } else { promise.resolve(true) }
        }
      }
    }
  }
}
