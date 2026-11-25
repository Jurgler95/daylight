package de.behla.daylight.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.Bundle

/** The widgets on the home screen. They draw from what the app last stored (`Widgets`), never from the database. */
abstract class DaylightWidgetProvider : AppWidgetProvider() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == ACTION_MIDNIGHT) Widgets.renderAll(context) else super.onReceive(context, intent)
  }

  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    Widgets.render(context, manager, ids)
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    Widgets.render(context, manager, intArrayOf(id))
  }

  override fun onDeleted(context: Context, ids: IntArray) {
    Widgets.forget(context, ids)
  }

  /** The last widget of this kind is gone; the midnight redraw only stops with the last of all kinds. */
  override fun onDisabled(context: Context) {
    if (Widgets.allIds(context).isEmpty()) Widgets.cancelMidnight(context)
  }
}

/** Five moods: a tap opens the entry with that mood. Also receives the midnight redraw for all kinds. */
class MoodWidgetProvider : DaylightWidgetProvider()

/** The last week in a row, or the last five weeks as a grid. */
class DaysWidgetProvider : DaylightWidgetProvider()

/** Days in a row. */
class StreakWidgetProvider : DaylightWidgetProvider()

/** One button for a new entry. */
class QuickWidgetProvider : DaylightWidgetProvider()
