package de.behla.daylight.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import java.time.LocalDate
import java.time.temporal.ChronoUnit

private const val PADDING = 12
private const val LABEL = 30
private const val RING_MIN = 32
private const val RING_MAX = 64

/**
 * Days in a row in a ring: filled once today has an entry, faint until then, amber while yesterday
 * is missing. The count stays behind the app lock, as in the reminders: it tells how regularly,
 * never what. A tap opens a new entry while today has none, and "Heute" with today's entries after that.
 */
internal object StreakWidget : WidgetKind {
  override fun views(context: Context, state: WidgetState?, size: Size, look: Look): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.daylight_streak_widget)
    val theme = Widgets.theme(context, views, look)
    val (streak, label) = state?.let { current(it) } ?: (Streak(0, false, false) to "")
    views.setOnClickPendingIntent(R.id.daylight_widget_root, Widgets.open(context, if (streak.todayDone) "daylight://today" else "daylight://entry/new"))
    val width = (if (size.width > 0) size.width else 70) - PADDING
    val height = (if (size.height > 0) size.height else 70) - PADDING
    val labelHeight = (LABEL * size.fontScale).toInt()
    val labelled = label.isNotEmpty() && height >= RING_MIN + labelHeight
    val ring = minOf(width, height - (if (labelled) labelHeight else 0), RING_MAX).coerceAtLeast(RING_MIN)
    val px = dp(context, ring)

    val bitmap = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val density = context.resources.displayMetrics.density
    if (streak.todayDone) {
      canvas.drawCircle(px / 2f, px / 2f, px / 2f - 1, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ACCENT })
    } else {
      val stroke = 3 * density
      canvas.drawCircle(px / 2f, px / 2f, px / 2f - stroke / 2 - 1, Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = stroke
        color = if (streak.atRisk) AMBER else RING
        alpha = if (streak.atRisk) 255 else 150
      })
    }
    views.setImageViewBitmap(R.id.daylight_streak_ring, bitmap)
    views.setTextViewText(R.id.daylight_streak_count, streak.days.toString())
    views.setTextViewTextSize(R.id.daylight_streak_count, TypedValue.COMPLEX_UNIT_DIP, ring * if (streak.days >= 100) 0.32f else 0.4f)
    if (streak.todayDone) views.setTextColor(R.id.daylight_streak_count, Color.WHITE) else theme.muted(R.id.daylight_streak_count)
    views.setViewVisibility(R.id.daylight_streak_label, if (labelled) View.VISIBLE else View.GONE)
    views.setTextViewText(R.id.daylight_streak_label, label)
    theme.muted(R.id.daylight_streak_label)
    views.setContentDescription(R.id.daylight_widget_root, "${streak.days} $label".trim())
    return views
  }

  /**
   * The streak today, from what the app saw on `state.date`. Days pass while the app stays closed:
   * after one, yesterday's entry keeps the run waiting for today, a missing one puts it at risk;
   * after two, an entry on the saved day with none since still leaves it at risk;
   * after more, or a second missing day, it has run out.
   */
  private fun current(state: WidgetState): Pair<Streak, String> {
    val s = state.streak
    val gap = state.date?.let { ChronoUnit.DAYS.between(it, LocalDate.now()) } ?: 0
    val ended = Streak(0, false, false) to state.streakLabelZero
    return when {
      gap <= 0L -> s to state.streakLabel
      gap == 1L && s.todayDone -> Streak(s.days, false, false) to state.streakLabel
      gap == 1L && !s.atRisk && s.days > 0 -> Streak(s.days, false, true) to state.streakLabel
      // The saved day had an entry, the day after none: the run ending on the saved day is at risk.
      gap == 2L && s.todayDone && !s.atRisk -> Streak(s.days, false, true) to state.streakLabel
      else -> ended
    }
  }
}
