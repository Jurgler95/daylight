package de.behla.daylight.launcher

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** The JS side of `LauncherIcons`: which icon the home screen should show, switched once the app is out of sight. */
class DaylightLauncherModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("DaylightLauncher")

    OnCreate {
      val context = appContext.reactContext ?: return@OnCreate
      runCatching { LauncherIcons.ensureOne(context) }
      LauncherIcons.watch(context)
    }

    Function("current") {
      LauncherIcons.current(context)
    }

    Function("setTarget") { key: String ->
      LauncherIcons.setTarget(context, key)
    }

    Function("setHeld") { held: Boolean ->
      LauncherIcons.held = held
    }
  }
}
