package expo.modules.cefacibusinessicon

import android.content.ComponentName
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CefaciBusinessIconModule : Module() {
  private val looks = listOf("primavara", "vara", "toamna", "iarna", "craciun")
  private fun alias(p: String, look: String) = ComponentName(p, "$p.Icon_$look")
  override fun definition() = ModuleDefinition {
    Name("CefaciBusinessIcon")
    Function("current") {
      val context = appContext.reactContext ?: return@Function null
      val pm = context.packageManager
      looks.firstOrNull { look ->
        val component = alias(context.packageName, look)
        when (pm.getComponentEnabledSetting(component)) {
          PackageManager.COMPONENT_ENABLED_STATE_ENABLED -> true
          PackageManager.COMPONENT_ENABLED_STATE_DEFAULT -> pm.getActivityInfo(component, PackageManager.MATCH_DISABLED_COMPONENTS).enabled
          else -> false
        }
      }
    }
    AsyncFunction("set") { look: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      if (look !in looks) return@AsyncFunction false
      val pm = context.packageManager
      val components = listOf(look) + looks.filter { it != look }
      if (Build.VERSION.SDK_INT >= 33) {
        // Atomic switch prevents duplicate or missing launcher entries.
        pm.setComponentEnabledSettings(components.map {
          PackageManager.ComponentEnabledSetting(alias(context.packageName, it), if (it == look) PackageManager.COMPONENT_ENABLED_STATE_ENABLED else PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
        })
      } else {
        val previous = components.associateWith { pm.getComponentEnabledSetting(alias(context.packageName, it)) }
        try {
          for (item in components) pm.setComponentEnabledSetting(alias(context.packageName, item), if (item == look) PackageManager.COMPONENT_ENABLED_STATE_ENABLED else PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
        } catch (error: Exception) {
          // Restore the earlier entry before removing any newly enabled entry.
          for (item in components.sortedBy { if (previous[it] == PackageManager.COMPONENT_ENABLED_STATE_DISABLED) 1 else 0 }) {
            pm.setComponentEnabledSetting(alias(context.packageName, item), previous.getValue(item), PackageManager.DONT_KILL_APP)
          }
          throw error
        }
      }
      true
    }
  }
}
