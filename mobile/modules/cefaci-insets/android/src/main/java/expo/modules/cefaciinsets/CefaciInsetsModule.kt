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

// The phone's own navigation bar (decision Cornel, 04.10: nothing of the app may sit under the 3 buttons, like
// Instagram). The app is drawn down to the screen's edge, as React Native expects, and the screens leave the bar's
// height free at the bottom (src/ui/insets.ts). This module measures that height straight from Android — some
// Samsung phones report 0 to React Native — and says where the bar starts, so the bottom bar can check where it
// really ended up. It also takes away the grey see-through layer Android puts over the bar, so the buttons sit on
// the app's own background.
//
// It no longer pads the app above the bar (04.10, seen on the emulator): the first screen, laid out before the
// padding, kept its full height and its bottom bar stayed under the buttons.
class CefaciInsetsModule : Module() {
  private var navDp = -1.0    // the navigation bar's height, dp (-1: not measured yet)
  private var navTopDp = -1.0 // where it starts, dp from the window's top (-1: not measured yet)
  private var light = true

  /** The window's height in px: the decor view's, but never more than the window's bounds on the screen. */
  private fun windowHeight(activity: Activity): Int {
    val decor = activity.window?.decorView?.height ?: 0
    val bounds = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) activity.windowManager.currentWindowMetrics.bounds.height() else 0
    return if (decor > 0 && bounds > 0) minOf(decor, bounds) else maxOf(decor, bounds)
  }

  /** The bar's height in px, from the window's own insets (the same React Native reads); null before the first. */
  private fun navPx(activity: Activity): Int? {
    val decor = activity.window?.decorView ?: return null
    return ViewCompat.getRootWindowInsets(decor)?.getInsets(WindowInsetsCompat.Type.navigationBars())?.bottom
  }

  private fun report(activity: Activity) {
    val density = activity.resources.displayMetrics.density
    val height = windowHeight(activity)
    val px = navPx(activity) ?: return
    if (height <= 0) return
    val nav = (px / density).toDouble()
    val top = ((height - px) / density).toDouble()
    if (nav == navDp && top == navTopDp) return
    navDp = nav
    navTopDp = top
    sendEvent("onFit", mapOf("nav" to navDp, "fitted" to 0.0, "navTop" to navTopDp))
  }

  private fun setup(activity: Activity) {
    val window = activity.window ?: return
    val content = activity.findViewById<View>(android.R.id.content) ?: return
    // an older build padded the content: never again
    if (content.paddingBottom != 0 || content.paddingLeft != 0 || content.paddingRight != 0) content.setPadding(0, 0, 0, 0)
    ViewCompat.setOnApplyWindowInsetsListener(content) { v, insets ->
      v.post { report(activity) }
      ViewCompat.onApplyWindowInsets(v, insets)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) window.isNavigationBarContrastEnforced = false
    WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightNavigationBars = light
    ViewCompat.requestApplyInsets(content)
  }

  /** What Android says right now, in dp: the bar's height, where it starts, the screen's and the app's height. */
  private fun measure(): Map<String, Double> {
    val activity = appContext.currentActivity ?: return mapOf("nav" to navDp, "fitted" to 0.0, "navTop" to navTopDp)
    val density = activity.resources.displayMetrics.density
    val px = navPx(activity)
    val nav = px?.let { (it / density).toDouble() } ?: navDp
    val screen = windowHeight(activity).takeIf { it > 0 }?.let { (it / density).toDouble() } ?: -1.0
    val navTop = if (px != null && screen > 0) screen - nav else navTopDp
    val content: View? = activity.findViewById(android.R.id.content)
    val pad = content?.paddingBottom ?: 0
    val fitted = (pad / density).toDouble()
    val contentPx = content?.height ?: 0
    val app = if (contentPx > 0) ((contentPx - pad) / density).toDouble() else -1.0
    return mapOf("nav" to nav, "fitted" to fitted, "navTop" to navTop, "screen" to screen, "app" to app)
  }

  override fun definition() = ModuleDefinition {
    Name("CefaciInsets")
    Events("onFit")

    /** No grey layer over the bar; `lightBg`: the app's background is light (dark buttons on it). Watches the bar. */
    AsyncFunction("watchNavBar") { lightBg: Boolean ->
      light = lightBg
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      setup(activity)
      true
    }.runOnQueue(Queues.MAIN)

    OnActivityEntersForeground {
      appContext.currentActivity?.let { a -> a.runOnUiThread { setup(a) } }
    }

    /** { nav, navTop, fitted, screen, app } in dp (see measure). */
    Function("state") { measure() }

    /** The navigation bar's height in dp; -1 when unknown. */
    Function("navBarBottom") { measure()["nav"] ?: -1.0 }
  }
}
