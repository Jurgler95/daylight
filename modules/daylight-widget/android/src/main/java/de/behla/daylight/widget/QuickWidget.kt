package de.behla.daylight.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.view.View
import android.widget.RemoteViews

private const val PADDING = 12
private const val LABEL = 34
private const val ICON_MIN = 32
private const val ICON_MAX = 56

/** One button: a tap opens today's entry, or a new one. Works before the app has run, with its own caption. */
internal object QuickWidget : WidgetKind {
  override fun views(context: Context, state: WidgetState?, size: Size, look: Look): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.daylight_quick_widget)
    val theme = Widgets.theme(context, views, look)
    views.setOnClickPendingIntent(R.id.daylight_widget_root, Widgets.open(context, "daylight://entry/new"))

    val caption = state?.newEntry?.ifEmpty { null } ?: context.getString(R.string.daylight_quick_label)
    val width = (if (size.width > 0) size.width else 70) - PADDING
    val height = (if (size.height > 0) size.height else 70) - PADDING
    val labelHeight = (LABEL * size.fontScale).toInt()
    val labelled = height >= ICON_MIN + labelHeight
    val icon = minOf(width, height - (if (labelled) labelHeight else 0), ICON_MAX).coerceAtLeast(ICON_MIN)
    val px = dp(context, icon)

    val bitmap = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.drawCircle(px / 2f, px / 2f, px / 2f - 1, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ACCENT })
    val plus = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      strokeWidth = px * 0.09f
      strokeCap = Paint.Cap.ROUND
    }
    val arm = px * 0.22f
    canvas.drawLine(px / 2f - arm, px / 2f, px / 2f + arm, px / 2f, plus)
    canvas.drawLine(px / 2f, px / 2f - arm, px / 2f, px / 2f + arm, plus)
    views.setImageViewBitmap(R.id.daylight_quick_icon, bitmap)

    views.setViewVisibility(R.id.daylight_quick_label, if (labelled) View.VISIBLE else View.GONE)
    views.setTextViewText(R.id.daylight_quick_label, caption)
    theme.text(R.id.daylight_quick_label)
    views.setContentDescription(R.id.daylight_widget_root, caption)
    return views
  }
}
