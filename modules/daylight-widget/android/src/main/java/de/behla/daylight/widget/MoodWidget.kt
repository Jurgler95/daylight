package de.behla.daylight.widget

import android.content.Context
import android.view.View
import android.widget.RemoteViews
import java.time.LocalDate

private const val SLOTS = 5

/** Heights (dp) of the parts around the icons, as `daylight_mood_widget.xml` lays them out. */
private const val PADDING = 16
private const val LABEL = 18
private const val TITLE = 47
private const val ICON_MIN = 36
private const val ICON_MAX = 46

private data class Slot(val root: Int, val icon: Int, val label: Int)

private val SLOT_IDS = listOf(
  Slot(R.id.daylight_widget_slot_0, R.id.daylight_widget_mood_0, R.id.daylight_widget_label_0),
  Slot(R.id.daylight_widget_slot_1, R.id.daylight_widget_mood_1, R.id.daylight_widget_label_1),
  Slot(R.id.daylight_widget_slot_2, R.id.daylight_widget_mood_2, R.id.daylight_widget_label_2),
  Slot(R.id.daylight_widget_slot_3, R.id.daylight_widget_mood_3, R.id.daylight_widget_label_3),
  Slot(R.id.daylight_widget_slot_4, R.id.daylight_widget_mood_4, R.id.daylight_widget_label_4),
)

/**
 * What fits the widget's size: the question and the names under the icons only where there is room,
 * the icons as large as width and height allow. The texts grow with the system font size, so the
 * room they need does too.
 */
private data class Fit(val title: Boolean, val labels: Boolean, val icon: Int) {
  companion object {
    fun of(size: Size): Fit {
      val width = if (size.width > 0) size.width else 320
      val height = (if (size.height > 0) size.height else 100) - PADDING
      val label = (LABEL * size.fontScale).toInt()
      val title = (TITLE * size.fontScale).toInt()
      val labels = height >= ICON_MIN + label
      val titled = height >= ICON_MAX + label + title
      val room = height - (if (labels) label else 0) - (if (titled) title else 0)
      val icon = minOf(width / SLOTS - 16, room, ICON_MAX).coerceAtLeast(ICON_MIN)
      return Fit(titled, labels, icon)
    }
  }
}

/** The question and five moods: a tap on one opens a new entry for today with that mood. */
internal object MoodWidget : WidgetKind {
  override fun views(context: Context, state: WidgetState?, size: Size, look: Look): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.daylight_mood_widget)
    val theme = Widgets.theme(context, views, look)
    theme.text(R.id.daylight_widget_title)
    theme.muted(R.id.daylight_widget_empty)
    views.setOnClickPendingIntent(R.id.daylight_widget_root, Widgets.open(context, "daylight://today"))
    // Before the app has run once there is nothing to show: a tap opens it, and it hands over its moods.
    if (state == null || state.moods.isEmpty()) {
      views.setViewVisibility(R.id.daylight_widget_title, View.GONE)
      views.setViewVisibility(R.id.daylight_widget_gap, View.GONE)
      views.setViewVisibility(R.id.daylight_widget_row, View.GONE)
      views.setViewVisibility(R.id.daylight_widget_empty, View.VISIBLE)
      return views
    }
    val fit = Fit.of(size)
    views.setViewVisibility(R.id.daylight_widget_empty, View.GONE)
    views.setViewVisibility(R.id.daylight_widget_row, View.VISIBLE)
    val titled = if (fit.title && state.title.isNotEmpty()) View.VISIBLE else View.GONE
    views.setViewVisibility(R.id.daylight_widget_title, titled)
    views.setViewVisibility(R.id.daylight_widget_gap, titled)
    views.setTextViewText(R.id.daylight_widget_title, state.title)

    val picked = if (state.date == LocalDate.now()) state.moodId else null
    val px = dp(context, fit.icon)
    SLOT_IDS.forEachIndexed { index, slot ->
      val mood = state.moods.getOrNull(index)
      if (mood == null) {
        views.setViewVisibility(slot.root, View.GONE)
        return@forEachIndexed
      }
      val chosen = mood.id == picked
      views.setViewVisibility(slot.root, View.VISIBLE)
      views.setImageViewBitmap(slot.icon, Widgets.badge(context, state, mood.level, mood.glyph, mood.label, px, chosen))
      views.setViewVisibility(slot.label, if (fit.labels) View.VISIBLE else View.GONE)
      views.setTextViewText(slot.label, mood.label)
      // As in the mood picker: the chosen mood's name in its colour, the others muted.
      if (chosen) theme.level(slot.label, mood.level) else theme.muted(slot.label)
      views.setContentDescription(slot.root, mood.label)
      // Every tap starts a new entry with this mood, also when the day already has one.
      views.setOnClickPendingIntent(slot.root, Widgets.open(context, "daylight://entry/new?mood=${mood.id}"))
    }
    return views
  }
}
