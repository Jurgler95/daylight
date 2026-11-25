package de.behla.daylight.widget

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** The JS side of `Widgets`: the app hands over what the widgets show, they redraw at once. */
class DaylightWidgetModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("DaylightWidget")

    Function("update") { state: String ->
      Widgets.store(context, state)
    }
  }
}
