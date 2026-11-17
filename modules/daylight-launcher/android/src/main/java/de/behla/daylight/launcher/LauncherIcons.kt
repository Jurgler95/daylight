package de.behla.daylight.launcher

import android.content.ComponentName
import android.content.Context
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.ProcessLifecycleOwner

/**
 * The launcher aliases from `plugins/withSeasonalIcons.js`, one per entry in
 * `plugins/launcherAliases.js`: `<namespace>.launcher.<key>` (`launcher.logo`, `launcher.herbst`,
 * ...), each with its own adaptive icon and the LAUNCHER intent filter. The key travels from JS as
 * it is, so the name rule lives in `ALIAS_PREFIX` here and in the plugin, and a Jest test keeps the
 * two equal.
 *
 * JS only says which icon it wants (`target`) and whether a system screen it opened is in front
 * (`held`). The switch itself waits for ON_STOP of the whole process, i.e. no activity of the app
 * is visible any more: some launchers close a task whose launcher entry goes away, and a pause alone
 * also comes with every dialog. A held switch waits for the next ON_STOP.
 */
internal object LauncherIcons {
  const val ALIAS_PREFIX = ".launcher."
  const val LOGO = "logo"
  private const val TAG = "DaylightLauncher"

  @Volatile private var target: String? = null
  @Volatile var held = false
  private var watching = false

  /** Follows the process lifecycle once per process; safe to call again after a JS reload. */
  fun watch(context: Context) {
    val app = context.applicationContext
    Handler(Looper.getMainLooper()).post {
      if (watching) return@post
      watching = true
      ProcessLifecycleOwner.get().lifecycle.addObserver(
        LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_STOP) applyTarget(app) },
      )
    }
  }

  fun setTarget(context: Context, key: String) {
    require(aliases(context).any { keyOf(it) == key }) { "No launcher alias $key" }
    target = key
    // Once is enough (OnCreate does it too), a second call does nothing; a target never waits unwatched.
    watch(context)
  }

  /** The key of the one enabled alias, or null when none or several are on. */
  fun current(context: Context): String? {
    val pm = context.packageManager
    return aliases(context).filter { isEnabled(pm, it) }.singleOrNull()?.let(::keyOf)
  }

  /** A device without any enabled alias would have no icon on the home screen: the logo comes back. */
  fun ensureOne(context: Context) {
    val pm = context.packageManager
    val all = aliases(context)
    if (all.none { isEnabled(pm, it) }) all.firstOrNull { keyOf(it) == LOGO }?.let { set(pm, it, PackageManager.COMPONENT_ENABLED_STATE_ENABLED) }
  }

  private fun applyTarget(context: Context) {
    val key = target ?: return
    if (held) return
    runCatching { select(context, key) }.onFailure { Log.w(TAG, "Launcher icon $key could not be set", it) }
  }

  /**
   * Turns the alias for `key` on before every other one off, so the launcher never sees the app
   * without an entry, and writes nothing that already is as it should be. Keeps the process alive.
   */
  private fun select(context: Context, key: String) {
    val pm = context.packageManager
    val all = aliases(context)
    val wanted = all.firstOrNull { keyOf(it) == key } ?: return
    if (!isEnabled(pm, wanted)) set(pm, wanted, PackageManager.COMPONENT_ENABLED_STATE_ENABLED)
    for (alias in all) {
      if (alias.name != wanted.name && isEnabled(pm, alias)) set(pm, alias, PackageManager.COMPONENT_ENABLED_STATE_DISABLED)
    }
  }

  private fun keyOf(alias: ActivityInfo): String = alias.name.substringAfterLast(ALIAS_PREFIX)

  /** The launcher aliases from the manifest, switched off ones included. */
  private fun aliases(context: Context): List<ActivityInfo> {
    val pm = context.packageManager
    val flags = PackageManager.GET_ACTIVITIES or PackageManager.MATCH_DISABLED_COMPONENTS
    val info = if (Build.VERSION.SDK_INT >= 33) {
      pm.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(flags.toLong()))
    } else {
      @Suppress("DEPRECATION")
      pm.getPackageInfo(context.packageName, flags)
    }
    return info.activities.orEmpty().filter { it.targetActivity != null && it.name.contains(ALIAS_PREFIX) }
  }

  /** The state set at runtime, or the manifest's `android:enabled` while none was set. */
  private fun isEnabled(pm: PackageManager, alias: ActivityInfo): Boolean =
    when (pm.getComponentEnabledSetting(ComponentName(alias.packageName, alias.name))) {
      PackageManager.COMPONENT_ENABLED_STATE_ENABLED -> true
      PackageManager.COMPONENT_ENABLED_STATE_DEFAULT -> alias.enabled
      else -> false
    }

  private fun set(pm: PackageManager, alias: ActivityInfo, state: Int) {
    pm.setComponentEnabledSetting(ComponentName(alias.packageName, alias.name), state, PackageManager.DONT_KILL_APP)
  }
}
