package expo.modules.cefaciicon

import android.content.ComponentName
import android.content.pm.PackageManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// The app's icon by season (decision Cornel, 06.10). The launcher entry is one of the activity-aliases
// <package>.Icon_<look> that plugins/withSeasonIcons.js puts in the manifest, all opening MainActivity; exactly one is
// enabled. Changing it is left for when the app is in the background (src/lib/season.ts): on some phones the
// launcher closes an app whose entry changes under it.
class CefaciIconModule : Module() {
  private val looks = listOf("primavara", "vara", "toamna", "iarna", "craciun")
  private val first = "vara" // enabled in the manifest

  private fun pm(): PackageManager? = appContext.reactContext?.packageManager
  private fun pkg(): String? = appContext.reactContext?.packageName
  private fun alias(p: String, look: String) = ComponentName(p, "$p.Icon_$look")

  override fun definition() = ModuleDefinition {
    Name("CefaciIcon")

    /** The look whose icon is on the launcher now. */
    Function("current") {
      val m = pm() ?: return@Function null
      val p = pkg() ?: return@Function null
      looks.firstOrNull { look ->
        when (m.getComponentEnabledSetting(alias(p, look))) {
          PackageManager.COMPONENT_ENABLED_STATE_ENABLED -> true
          PackageManager.COMPONENT_ENABLED_STATE_DEFAULT -> look == first
          else -> false
        }
      }
    }

    /** Puts the icon of `look` on the launcher (the new one first, so there is never none). */
    AsyncFunction("set") { look: String ->
      val m = pm() ?: return@AsyncFunction false
      val p = pkg() ?: return@AsyncFunction false
      if (look !in looks) return@AsyncFunction false
      m.setComponentEnabledSetting(alias(p, look), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
      for (other in looks) {
        if (other != look) m.setComponentEnabledSetting(alias(p, other), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
      }
      true
    }
  }
}
