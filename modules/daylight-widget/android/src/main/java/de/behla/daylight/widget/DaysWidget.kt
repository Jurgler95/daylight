package de.behla.daylight.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.view.View
import android.widget.RemoteViews
import java.time.LocalDate
import java.time.format.DateTimeFormatter

private const val WEEKS = 5
private const val PADDING = 16
private const val LABEL = 18
private const val HEAD = 20
private const val CELL_MIN = 20
private const val ICON_MAX = 40
/** Below this a grid cell is too small for an icon; the colour alone shows the day. */
private const val GLYPH_MIN = 18

private data class DaySlot(val root: Int, val icon: Int, val label: Int)

private val WEEK_IDS = listOf(
  DaySlot(R.id.daylight_days_slot_0, R.id.daylight_days_icon_0, R.id.daylight_days_label_0),
  DaySlot(R.id.daylight_days_slot_1, R.id.daylight_days_icon_1, R.id.daylight_days_label_1),
  DaySlot(R.id.daylight_days_slot_2, R.id.daylight_days_icon_2, R.id.daylight_days_label_2),
  DaySlot(R.id.daylight_days_slot_3, R.id.daylight_days_icon_3, R.id.daylight_days_label_3),
  DaySlot(R.id.daylight_days_slot_4, R.id.daylight_days_icon_4, R.id.daylight_days_label_4),
  DaySlot(R.id.daylight_days_slot_5, R.id.daylight_days_icon_5, R.id.daylight_days_label_5),
  DaySlot(R.id.daylight_days_slot_6, R.id.daylight_days_icon_6, R.id.daylight_days_label_6),
)

private val HEAD_IDS = listOf(
  R.id.daylight_days_head_0, R.id.daylight_days_head_1, R.id.daylight_days_head_2, R.id.daylight_days_head_3,
  R.id.daylight_days_head_4, R.id.daylight_days_head_5, R.id.daylight_days_head_6,
)

/**
 * The last days like the app's calendar: the day's mood with its icon, an empty ring for a day
 * without an entry, today ringed. Low it shows the last seven days, a tap on one opens it; tall the
 * last five weeks by weekday, a tap opens the calendar. Behind the app lock days with an entry are grey.
 */
internal object DaysWidget : WidgetKind {
  override fun views(context: Context, state: WidgetState?, size: Size, look: Look): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.daylight_days_widget)
    val theme = Widgets.theme(context, views, look)
    theme.muted(R.id.daylight_widget_empty)
    views.setOnClickPendingIntent(R.id.daylight_widget_root, Widgets.open(context, "daylight://calendar"))
    if (state == null || state.weekdays.size != 7) {
      views.setViewVisibility(R.id.daylight_days_week, View.GONE)
      views.setViewVisibility(R.id.daylight_widget_empty, View.VISIBLE)
      return views
    }
    val today = LocalDate.now()
    val width = (if (size.width > 0) size.width else 320) - PADDING
    val height = (if (size.height > 0) size.height else 200) - PADDING
    val head = (HEAD * size.fontScale).toInt()
    val tall = height - head >= WEEKS * (CELL_MIN + 6)

    views.setViewVisibility(R.id.daylight_days_week, if (tall) View.GONE else View.VISIBLE)
    views.setViewVisibility(R.id.daylight_days_head, if (tall) View.VISIBLE else View.GONE)
    views.setViewVisibility(R.id.daylight_days_grid, if (tall) View.VISIBLE else View.GONE)
    if (tall) grid(context, views, theme, state, today, width, height - head - 4) else week(context, views, theme, state, today, width, height, size.fontScale)
    return views
  }

  private fun week(context: Context, views: RemoteViews, theme: Theme, state: WidgetState, today: LocalDate, width: Int, height: Int, fontScale: Float) {
    val label = (LABEL * fontScale).toInt()
    val labels = height >= CELL_MIN + label
    val icon = minOf(width / 7 - 6, height - (if (labels) label else 0), ICON_MAX).coerceAtLeast(CELL_MIN)
    val px = dp(context, icon)
    WEEK_IDS.forEachIndexed { index, slot ->
      val date = today.minusDays((6 - index).toLong())
      val bitmap = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
      drawDay(context, state, Canvas(bitmap), px / 2f, px / 2f, px / 2f - 1, date, date == today)
      views.setImageViewBitmap(slot.icon, bitmap)
      views.setViewVisibility(slot.label, if (labels) View.VISIBLE else View.GONE)
      views.setTextViewText(slot.label, weekday(state, date))
      if (date == today) theme.text(slot.label) else theme.muted(slot.label)
      views.setContentDescription(slot.root, date.format(DateTimeFormatter.ISO_LOCAL_DATE))
      // A day with entries opens on "Heute", where they are listed and another one can be added;
      // an empty day goes straight to a new entry for it.
      val link = if (state.days.containsKey(date)) "daylight://today?date=$date" else "daylight://entry/new?date=$date"
      views.setOnClickPendingIntent(slot.root, Widgets.open(context, link))
    }
  }

  private fun grid(context: Context, views: RemoteViews, theme: Theme, state: WidgetState, today: LocalDate, width: Int, height: Int) {
    val offset = (today.dayOfWeek.value % 7 - state.weekStart + 7) % 7
    val start = today.minusDays(offset.toLong() + 7L * (WEEKS - 1))
    HEAD_IDS.forEachIndexed { index, id ->
      views.setTextViewText(id, state.weekdays[(state.weekStart + index) % 7])
      theme.muted(id)
    }
    val w = dp(context, width)
    val h = dp(context, height)
    val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val cellW = w / 7f
    val cellH = h / WEEKS.toFloat()
    val radius = minOf(cellW, cellH) / 2f * 0.86f
    for (row in 0 until WEEKS) for (column in 0 until 7) {
      val date = start.plusDays(row * 7L + column)
      if (date.isAfter(today)) continue
      drawDay(context, state, canvas, cellW * (column + 0.5f), cellH * (row + 0.5f), radius, date, date == today)
    }
    views.setImageViewBitmap(R.id.daylight_days_grid, bitmap)
  }

  private fun drawDay(context: Context, state: WidgetState, canvas: Canvas, cx: Float, cy: Float, radius: Float, date: LocalDate, today: Boolean) {
    val density = context.resources.displayMetrics.density
    var r = radius
    if (today) {
      val stroke = 2 * density
      canvas.drawCircle(cx, cy, r - stroke / 2, Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = stroke
        color = RING
      })
      r -= stroke + density
    }
    val day = state.days[date]
    when {
      day == null -> if (!today) canvas.drawCircle(cx, cy, r - density, Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 1.5f * density
        color = NEUTRAL
        alpha = 130
      })
      day.level !in 1..5 -> canvas.drawCircle(cx, cy, r, Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = NEUTRAL
        alpha = 170
      })
      else -> {
        val glyph = if (r * 2 >= GLYPH_MIN * density) day.glyph else 0
        Widgets.drawBadge(context, state, canvas, cx, cy, r, day.level, glyph, "", false)
      }
    }
  }

  private fun weekday(state: WidgetState, date: LocalDate) = state.weekdays.getOrElse(date.dayOfWeek.value % 7) { "" }
}
