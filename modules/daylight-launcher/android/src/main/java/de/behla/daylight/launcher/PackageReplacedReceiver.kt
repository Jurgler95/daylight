package de.behla.daylight.launcher

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Runs once after every update of the app, without it being opened: should the update have left no
 * launcher alias on, the logo comes back, so there is an icon to open the app with.
 */
class PackageReplacedReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    runCatching { LauncherIcons.ensureOne(context) }.onFailure { Log.w("DaylightLauncher", "Launcher alias check failed", it) }
  }
}
