package de.behla.daylight.reminders

import android.content.ComponentName
import android.content.Context
import android.content.Intent

/** The class Expo's template generates under the Android namespace from app.json, whatever the application id. */
private const val MAIN_ACTIVITY = "de.behla.daylight.MainActivity"

/**
 * The app's launch intent, aimed at the activity itself rather than at the launcher entry. The
 * launcher entry is one of several aliases that `modules/daylight-launcher` switches with the
 * seasonal design; a notification tapped after a switch would point at an alias that is off by
 * then and open nothing. MainActivity, the target of every alias, never changes. Should no alias be
 * on at all, the intent still goes straight to MainActivity.
 */
internal fun launchIntent(context: Context): Intent {
  val launch = runCatching { context.packageManager.getLaunchIntentForPackage(context.packageName) }.getOrNull()
  val component = launch?.component
  val target = component?.let { runCatching { context.packageManager.getActivityInfo(it, 0).targetActivity }.getOrNull() }
  return when {
    launch == null -> Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setClassName(context.packageName, MAIN_ACTIVITY)
    component != null && target != null -> launch.setComponent(ComponentName(component.packageName, target))
    else -> launch
  }
}
