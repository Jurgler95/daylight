package de.behla.daylight.theme

import android.app.UiModeManager
import android.content.Context
import android.os.Build
import androidx.core.view.WindowInsetsControllerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Tells Android whether Daylight is light, dark or follows the device ("Erscheinungsbild" under
 * "Mehr"). From Android 12 the system keeps this per app and draws the splash screen of the next
 * cold start in it, so a phone in light mode no longer flashes the light splash before a dark app.
 * The palette inside the app comes from JS either way; earlier versions simply skip this.
 */
class DaylightThemeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DaylightTheme")

    Function("setNightMode") { scheme: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function
      val context = appContext.reactContext ?: return@Function
      val manager = context.getSystemService(Context.UI_MODE_SERVICE) as? UiModeManager ?: return@Function
      val mode = when (scheme) {
        "dark" -> UiModeManager.MODE_NIGHT_YES
        "light" -> UiModeManager.MODE_NIGHT_NO
        else -> UiModeManager.MODE_NIGHT_AUTO
      }
      runCatching { manager.setApplicationNightMode(mode) }
    }

    /**
     * Light or dark buttons in the navigation bar. React Native sets them once when the activity is
     * created; MainActivity handles uiMode changes itself and is not recreated, so a switch while
     * the app is open would leave the three buttons in the old colours. The status bar is set from
     * JS (expo-status-bar).
     */
    Function("setDarkBars") { dark: Boolean ->
      val activity = appContext.currentActivity ?: return@Function
      activity.runOnUiThread {
        val window = activity.window ?: return@runOnUiThread
        WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightNavigationBars = !dark
      }
    }
  }
}
