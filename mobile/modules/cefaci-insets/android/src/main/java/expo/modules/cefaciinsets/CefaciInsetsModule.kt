package expo.modules.cefaciinsets

import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// The bottom navigation bar's real height, read from the window insets Android gives the app (in dp).
class CefaciInsetsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CefaciInsets")

    Function("navBarBottom") {
      val activity = appContext.currentActivity ?: return@Function -1.0
      val view = activity.window?.decorView ?: return@Function -1.0
      val insets = ViewCompat.getRootWindowInsets(view) ?: return@Function -1.0
      val bars = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
      val tappable = insets.getInsets(WindowInsetsCompat.Type.tappableElement())
      val px = maxOf(bars.bottom, tappable.bottom)
      (px / activity.resources.displayMetrics.density).toDouble()
    }
  }
}
