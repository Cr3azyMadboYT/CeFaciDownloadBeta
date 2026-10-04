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
// under the 3 buttons. The bar's area gets the app's background colour, without the grey see-through layer Android
// puts there otherwise. The JS side is told how much was padded ("onFit"): if Android did not pad (an odd phone, an
// old activity), the screens pad themselves by the bar's height instead — never neither.
class CefaciInsetsModule : Module() {
  private var navDp = -1.0     // the navigation bar's height, dp (-1: not measured yet)
  private var fittedDp = 0.0   // how much the app's content is padded above it, dp
  private var light = true

  private fun report(activity: Activity, navPx: Int, fittedPx: Int) {
    val density = activity.resources.displayMetrics.density
    val nav = (navPx / density).toDouble()
    val fitted = (fittedPx / density).toDouble()
    if (nav == navDp && fitted == fittedDp) return
    navDp = nav
    fittedDp = fitted
    sendEvent("onFit", mapOf("nav" to navDp, "fitted" to fittedDp))
  }

  private fun fit(activity: Activity) {
    val window = activity.window ?: return
    val content = activity.findViewById<View>(android.R.id.content) ?: return
    ViewCompat.setOnApplyWindowInsetsListener(content) { v, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
      if (v.paddingBottom != bars.bottom || v.paddingLeft != bars.left || v.paddingRight != bars.right) {
        v.setPadding(bars.left, 0, bars.right, bars.bottom)
      }
      report(activity, bars.bottom, v.paddingBottom)
      insets
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) window.isNavigationBarContrastEnforced = false
    WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightNavigationBars = light
    ViewCompat.requestApplyInsets(content)
  }

  /** What Android says right now: the bar's height and the content's padding, in dp. */
  private fun measure(): Map<String, Double> {
    val activity = appContext.currentActivity ?: return mapOf("nav" to navDp, "fitted" to fittedDp)
    val density = activity.resources.displayMetrics.density
    val root = activity.window?.decorView?.let { ViewCompat.getRootWindowInsets(it) }
    val nav = root?.getInsets(WindowInsetsCompat.Type.navigationBars())?.bottom?.let { (it / density).toDouble() } ?: navDp
    val content = activity.findViewById<View>(android.R.id.content)
    val fitted = content?.paddingBottom?.let { (it / density).toDouble() } ?: fittedDp
    val screen = activity.window?.decorView?.height?.let { (it / density).toDouble() } ?: -1.0
    val app = content?.height?.let { ((it - (content.paddingBottom)) / density).toDouble() } ?: -1.0
    return mapOf("nav" to nav, "fitted" to fitted, "screen" to screen, "app" to app)
  }

  override fun definition() = ModuleDefinition {
    Name("CefaciInsets")
    Events("onFit")

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

    /** { nav, fitted, screen, app } in dp: the bar, the padding above it, the screen and the app's height. */
    Function("state") { measure() }

    /** The navigation bar's height in dp (for windows drawn over it, like the bottom sheets); -1 when unknown. */
    Function("navBarBottom") { measure()["nav"] ?: -1.0 }
  }
}
