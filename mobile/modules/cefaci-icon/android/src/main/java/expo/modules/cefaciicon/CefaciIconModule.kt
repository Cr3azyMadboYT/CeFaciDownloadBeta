package expo.modules.cefaciicon

import android.content.ComponentName
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// The app's icon by season (decision Cornel, 06.10). The launcher entry is one of the activity-aliases
// <package>.Icon_<look> that plugins/withSeasonIcons.js puts in the manifest, all opening MainActivity; exactly one is
// enabled. Changing it is left for when the app is in the background (src/lib/season.ts): on some phones the
// launcher closes an app whose entry changes under it.
// 23.10 (Cornel: „după ce instalez app și dau conectare cu Google îmi dă crash, doar prima dată”): „background” also
// happens for a few seconds while the Google sign-in sheet, a permission question or the in-app browser is on top, and
// Samsung then closed the app. Now the switch waits until the app has been in the background for 10 minutes
// (`later`): anything shorter, it never happens.
class CefaciIconModule : Module() {
  private val looks = listOf("primavara", "vara", "toamna", "iarna", "craciun")
  private val first = "vara" // enabled in the manifest

  private fun pm(): PackageManager? = appContext.reactContext?.packageManager
  private fun pkg(): String? = appContext.reactContext?.packageName
  private fun alias(p: String, look: String) = ComponentName(p, "$p.Icon_$look")
  private val handler = Handler(Looper.getMainLooper())
  private var wanted: String? = null
  private var pending: Runnable? = null
  private val delayMs = 10L * 60L * 1000L

  private fun currentLook(): String? {
    val m = pm() ?: return null
    val p = pkg() ?: return null
    return looks.firstOrNull { look ->
      when (m.getComponentEnabledSetting(alias(p, look))) {
        PackageManager.COMPONENT_ENABLED_STATE_ENABLED -> true
        PackageManager.COMPONENT_ENABLED_STATE_DEFAULT -> look == first
        else -> false
      }
    }
  }

  private fun applyLook(look: String): Boolean {
    val m = pm() ?: return false
    val p = pkg() ?: return false
    if (look !in looks) return false
    m.setComponentEnabledSetting(alias(p, look), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
    for (other in looks) {
      if (other != look) m.setComponentEnabledSetting(alias(p, other), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
    }
    return true
  }

  private fun cancel() { pending?.let { handler.removeCallbacks(it) }; pending = null }

  override fun definition() = ModuleDefinition {
    Name("CefaciIcon")

    /** The look whose icon is on the launcher now. */
    Function("current") { currentLook() }

    /** Puts the icon of `look` on the launcher now (the new one first, so there is never none). */
    AsyncFunction("set") { look: String -> applyLook(look) }

    /** The icon this season wants; it is put on the launcher only after 10 minutes in the background. */
    Function("later") { look: String -> wanted = if (look in looks) look else null; true }

    OnActivityEntersBackground {
      cancel()
      val look = wanted ?: return@OnActivityEntersBackground
      if (currentLook() == look) return@OnActivityEntersBackground
      val r = Runnable { pending = null; try { applyLook(look) } catch (_: Exception) { } }
      pending = r
      handler.postDelayed(r, delayMs)
    }

    OnActivityEntersForeground { cancel() }
  }
}
