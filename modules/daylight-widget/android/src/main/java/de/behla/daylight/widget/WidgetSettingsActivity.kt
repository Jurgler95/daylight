package de.behla.daylight.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.WindowInsets
import android.widget.Button
import android.widget.FrameLayout
import android.widget.RadioGroup
import android.widget.SeekBar
import android.widget.TextView
import java.text.NumberFormat

/** Opacity steps on the slider: 0 to 100 percent in fives. */
private const val STEP = 5

/**
 * The settings of one widget on the home screen, opened by the launcher ("Customize"). Native and
 * small, so it opens at once without starting React Native. Every change is stored and drawn on
 * the home screen right away, so leaving by "Done" or by going back keeps it alike.
 */
class WidgetSettingsActivity : Activity() {
  private var id = AppWidgetManager.INVALID_APPWIDGET_ID
  private lateinit var look: Look

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    id = intent?.extras?.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID) ?: AppWidgetManager.INVALID_APPWIDGET_ID
    if (id == AppWidgetManager.INVALID_APPWIDGET_ID) {
      finish()
      return
    }
    // OK from the start: before Android 12 these settings open on placing, and leaving them by
    // going back would otherwise take the new widget off the home screen again.
    setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id))
    look = Widgets.look(this, id)

    setContentView(R.layout.daylight_widget_settings)
    val root = findViewById<android.view.View>(R.id.daylight_settings_root)
    val gap = (16 * resources.displayMetrics.density).toInt()
    root.setOnApplyWindowInsetsListener { view, insets ->
      val bars = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        insets.getInsets(WindowInsets.Type.systemBars()).let { intArrayOf(it.left, it.top, it.right, it.bottom) }
      } else {
        @Suppress("DEPRECATION")
        intArrayOf(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
      }
      view.setPadding(bars[0] + gap, bars[1] + gap, bars[2] + gap, bars[3] + gap)
      insets
    }

    val slider = findViewById<SeekBar>(R.id.daylight_settings_opacity)
    slider.progress = look.opacity / STEP
    slider.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
      override fun onProgressChanged(bar: SeekBar, progress: Int, fromUser: Boolean) {
        if (fromUser) change(look.copy(opacity = progress * STEP))
      }
      override fun onStartTrackingTouch(bar: SeekBar) = Unit
      override fun onStopTrackingTouch(bar: SeekBar) = Unit
    })

    val styles = mapOf(
      Style.LIGHT to R.id.daylight_settings_style_light,
      Style.DARK to R.id.daylight_settings_style_dark,
      Style.SYSTEM to R.id.daylight_settings_style_system,
      Style.WALLPAPER to R.id.daylight_settings_style_wallpaper,
    )
    val group = findViewById<RadioGroup>(R.id.daylight_settings_style)
    group.check(styles.getValue(look.style))
    group.setOnCheckedChangeListener { _, checked ->
      styles.entries.firstOrNull { it.value == checked }?.let { change(look.copy(style = it.key)) }
    }

    findViewById<Button>(R.id.daylight_settings_done).setOnClickListener { finish() }
    show()
  }

  private fun change(next: Look) {
    look = next
    Widgets.saveLook(this, id, look)
    val manager = AppWidgetManager.getInstance(this)
    manager.updateAppWidget(id, Widgets.views(this, manager, id, look))
    show()
  }

  /** The percentage next to the slider, and the widget drawn the way the home screen will draw it. */
  private fun show() {
    val percent = NumberFormat.getPercentInstance().format(look.opacity / 100.0)
    findViewById<TextView>(R.id.daylight_settings_opacity_value).text = percent
    val slider = findViewById<SeekBar>(R.id.daylight_settings_opacity)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) slider.stateDescription = percent
    slider.contentDescription = getString(R.string.daylight_widget_settings_background)

    val manager = AppWidgetManager.getInstance(this)
    val options = manager.getAppWidgetOptions(id)
    val density = resources.displayMetrics.density
    val width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0).takeIf { it > 0 } ?: 320
    val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0).takeIf { it > 0 } ?: 100
    val preview = findViewById<FrameLayout>(R.id.daylight_settings_preview)
    val view = runCatching { Widgets.views(this, manager, id, look).apply(this, preview) }.getOrNull() ?: return
    preview.removeAllViews()
    val size = FrameLayout.LayoutParams((width * density).toInt(), (height * density).toInt(), Gravity.CENTER)
    preview.addView(view, size)
    // Taps on the preview would open the app like on the home screen: a clear layer on top takes them.
    preview.addView(android.view.View(this).apply { setOnClickListener {} }, FrameLayout.LayoutParams(size))
  }
}
