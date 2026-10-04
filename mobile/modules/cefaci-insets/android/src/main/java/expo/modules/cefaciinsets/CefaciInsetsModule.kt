package expo.modules.cefaciinsets

import android.app.Activity
import android.os.Build
import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// The app stops above the phone's own navigation bar, like Instagram (decision Cornel, 04.10): Android itself pads
// the app's content by the bar's height, so nothing (the bottom tabs, the buttons at the bottom of a screen) can sit
// under the 3 buttons, whatever the JS side thinks the insets are. The bar's area gets the app's background colour,
// without the grey see-through layer Android puts there otherwise.
class CefaciInsetsModule : Module() {
  private var lastBottomDp = -1.0
  private var light = true

  private fun fit(activity: Activity) {
    val window = activity.window ?: return
    val content = activity.findViewById<View>(android.R.id.content) ?: return
    val density = activity.resources.displayMetrics.density
    ViewCompat.setOnApplyWindowInsetsListener(content) { v, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
      if (v.paddingBottom != bars.bottom || v.paddingLeft != bars.left || v.paddingRight != bars.right) {
        v.setPadding(bars.left, 0, bars.right, bars.bottom)
      }
      lastBottomDp = (bars.bottom / density).toDouble()
      insets
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) window.isNavigationBarContrastEnforced = false
    WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightNavigationBars = light
    ViewCompat.requestApplyInsets(content)
  }

  override fun definition() = ModuleDefinition {
    Name("CefaciInsets")

    /** Pads the app above the navigation bar; `lightBg`: the app's background is light (dark buttons on it). */
    AsyncFunction("fitNavBar") { lightBg: Boolean ->
      light = lightBg
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      fit(activity)
      true
    }.runOnQueue(Queues.MAIN)

    OnActivityEntersForeground {
      appContext.currentActivity?.let { a -> a.runOnUiThread { fit(a) } }
    }

    /** The navigation bar's height in dp (for windows drawn over it, like the bottom sheets); -1 when unknown. */
    Function("navBarBottom") {
      if (lastBottomDp >= 0) return@Function lastBottomDp
      val activity = appContext.currentActivity ?: return@Function -1.0
      val view = activity.window?.decorView ?: return@Function -1.0
      val insets = ViewCompat.getRootWindowInsets(view) ?: return@Function -1.0
      val bars = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
      (bars.bottom / activity.resources.displayMetrics.density).toDouble()
    }
  }
}
