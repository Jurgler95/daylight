package de.behla.daylight.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.app.WallpaperColors
import android.app.WallpaperManager
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

internal const val PREFS = "daylight_widget"
private const val KEY_STATE = "state"
internal const val ACTION_MIDNIGHT = "de.behla.daylight.widget.MIDNIGHT"
/** The class Expo's template generates under the Android namespace from app.json, whatever the application id. */
private const val MAIN_ACTIVITY = "de.behla.daylight.MainActivity"

/** Where Metro puts `@expo/vector-icons`' MaterialCommunityIcons in a release build, should the app pass no name. */
private const val DEFAULT_FONT = "node_modules_expo_vectoricons_build_vendor_reactnativevectoricons_fonts_materialcommunityicons"

/** `lib/theme/tokens.ts` `moodColors`, strong and soft per level 1 to 5. */
internal val STRONG = mapOf(5 to "#007060", 4 to "#336E08", 3 to "#876200", 2 to "#B03512", 1 to "#9C1C7A")
internal val SOFT = mapOf(5 to "#C8F3E3", 4 to "#DDF4C2", 3 to "#FFEC9E", 2 to "#FFDCC0", 1 to "#F8D8F0")

internal fun strong(level: Int) = Color.parseColor(STRONG[level] ?: STRONG.getValue(3))
internal fun soft(level: Int) = Color.parseColor(SOFT[level] ?: SOFT.getValue(3))

/** The app's accent, and a lighter blue for rings that have to read on light and dark alike. */
internal val ACCENT = Color.parseColor("#1A5FC2")
internal val RING = Color.parseColor("#4F86E0")
/** A streak at risk (`lib/theme/tokens.ts`): a warm amber that asks, never alarms. */
internal val AMBER = Color.parseColor("#E08A00")
/** Days without an entry and moods behind the app lock: a grey that reads on light and dark. */
internal val NEUTRAL = Color.parseColor("#8090A8")

/** How a widget looks, set per widget in `WidgetSettingsActivity`. Stored by position: add only at the end. */
internal enum class Style { LIGHT, DARK, SYSTEM, WALLPAPER }

/** `opacity` in percent of the background, 0 leaves only icons and texts over the wallpaper. */
internal data class Look(val opacity: Int, val style: Style) {
  companion object {
    val DEFAULT = Look(100, Style.LIGHT)
  }
}

/** Light and dark text and chosen-name colours, the same as `values` and `values-night/colors.xml`. */
internal data class Ink(val text: Int, val muted: Int, val levels: Map<Int, String>)

private val LIGHT_INK = Ink(Color.parseColor("#13213A"), Color.parseColor("#475873"), STRONG)
private val DARK_INK = Ink(Color.parseColor("#F3F8FF"), Color.parseColor("#B8C4D8"), SOFT)

private val LEVEL_COLORS = mapOf(
  1 to R.color.daylight_widget_level_1,
  2 to R.color.daylight_widget_level_2,
  3 to R.color.daylight_widget_level_3,
  4 to R.color.daylight_widget_level_4,
  5 to R.color.daylight_widget_level_5,
)

/**
 * Colours for the texts of one widget's views. "As the system" uses colour resources with a night
 * variant, so the launcher picks light or dark and switches along with the system; the fixed styles
 * set theirs. Every colour is set each time, also the layout's own: a launcher may reapply new views
 * onto the old ones, and a colour set before would stay.
 */
internal class Theme(private val context: Context, private val views: RemoteViews, private val ink: Ink?) {
  fun text(view: Int) = color(view, ink?.text, R.color.daylight_widget_text)
  fun muted(view: Int) = color(view, ink?.muted, R.color.daylight_widget_muted)
  fun level(view: Int, level: Int) {
    val known = if (level in 1..5) level else 3
    color(view, ink?.let { Color.parseColor(it.levels.getValue(known)) }, LEVEL_COLORS.getValue(known))
  }

  private fun color(view: Int, fixed: Int?, resource: Int) {
    when {
      fixed != null -> views.setTextColor(view, fixed)
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> views.setColorStateList(view, "setTextColor", resource)
      else -> views.setTextColor(view, context.getColor(resource))
    }
  }
}

/** The size a widget has, in dp, and the system font size its texts grow with. In portrait a widget is min width by max height. */
internal data class Size(val width: Int, val height: Int, val fontScale: Float)

internal data class WidgetMood(val id: Int, val level: Int, val glyph: Int, val label: String)
internal data class WidgetDay(val level: Int, val glyph: Int)
internal data class Streak(val days: Int, val todayDone: Boolean, val atRisk: Boolean)

/** What the app last handed over (`lib/widget/state.ts`). `date` is the day it holds for. */
internal data class WidgetState(
  val title: String,
  val font: String?,
  val moods: List<WidgetMood>,
  val date: LocalDate?,
  val moodId: Int?,
  val days: Map<LocalDate, WidgetDay>,
  val weekStart: Int,
  val weekdays: List<String>,
  val streak: Streak,
  val streakLabel: String,
  val streakLabelZero: String,
  val newEntry: String,
  val locked: Boolean,
) {
  companion object {
    fun parse(json: String): WidgetState? = runCatching {
      val o = JSONObject(json)
      val list = o.getJSONArray("moods")
      val moods = (0 until list.length()).map { i ->
        val m = list.getJSONObject(i)
        WidgetMood(m.getInt("id"), m.getInt("level"), m.optInt("glyph", 0), m.getString("label"))
      }
      val days = mutableMapOf<LocalDate, WidgetDay>()
      o.optJSONObject("days")?.let { map ->
        for (key in map.keys()) {
          val day = map.getJSONObject(key)
          runCatching { days[LocalDate.parse(key)] = WidgetDay(day.getInt("level"), day.optInt("glyph", 0)) }
        }
      }
      val weekdays = o.optJSONArray("weekdays")?.let { names -> (0 until names.length()).map { names.getString(it) } } ?: emptyList()
      val streak = o.optJSONObject("streak")
      WidgetState(
        title = o.optString("title"),
        font = o.optString("font").ifEmpty { null },
        moods = moods,
        date = o.optString("date").ifEmpty { null }?.let { runCatching { LocalDate.parse(it) }.getOrNull() },
        moodId = if (o.isNull("moodId")) null else o.getInt("moodId"),
        days = days,
        weekStart = o.optInt("weekStart", 1),
        weekdays = weekdays,
        streak = Streak(streak?.optInt("days", 0) ?: 0, streak?.optBoolean("todayDone") ?: false, streak?.optBoolean("atRisk") ?: false),
        streakLabel = o.optString("streakLabel"),
        streakLabelZero = o.optString("streakLabelZero"),
        newEntry = o.optString("newEntry"),
        locked = o.optBoolean("locked"),
      )
    }.getOrNull()
  }
}

/** One kind of widget: draws its views from the stored state. */
internal interface WidgetKind {
  fun views(context: Context, state: WidgetState?, size: Size, look: Look): RemoteViews
}

internal object Widgets {
  private val kinds: Map<String, WidgetKind> = mapOf(
    MoodWidgetProvider::class.java.name to MoodWidget,
    DaysWidgetProvider::class.java.name to DaysWidget,
    StreakWidgetProvider::class.java.name to StreakWidget,
    QuickWidgetProvider::class.java.name to QuickWidget,
  )

  private var typeface: Typeface? = null
  private var typefaceSource: String? = null

  fun store(context: Context, json: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_STATE, json).apply()
    renderAll(context)
  }

  /** Every Daylight widget placed, of every kind. */
  fun allIds(context: Context): IntArray {
    val manager = AppWidgetManager.getInstance(context)
    return kinds.keys.flatMap { manager.getAppWidgetIds(ComponentName(context.packageName, it)).toList() }.toIntArray()
  }

  fun renderAll(context: Context) {
    val ids = allIds(context)
    if (ids.isEmpty()) cancelMidnight(context) else render(context, AppWidgetManager.getInstance(context), ids)
  }

  fun render(context: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) manager.updateAppWidget(id, views(context, manager, id, look(context, id)))
    scheduleMidnight(context)
  }

  /** The widget `id` as it would look with `look`: what the home screen shows, and the settings' preview. */
  fun views(context: Context, manager: AppWidgetManager, id: Int, look: Look): RemoteViews {
    val kind = kinds[manager.getAppWidgetInfo(id)?.provider?.className] ?: MoodWidget
    val json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_STATE, null)
    val options = manager.getAppWidgetOptions(id)
    val size = Size(
      options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0),
      options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0),
      context.resources.configuration.fontScale,
    )
    return kind.views(context, json?.let { WidgetState.parse(it) }, size, look)
  }

  fun look(context: Context, id: Int): Look {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val style = Style.entries.getOrNull(prefs.getInt("style_$id", -1)) ?: Look.DEFAULT.style
    return Look(prefs.getInt("opacity_$id", Look.DEFAULT.opacity).coerceIn(0, 100), style)
  }

  fun saveLook(context: Context, id: Int, look: Look) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putInt("opacity_$id", look.opacity)
      .putInt("style_$id", look.style.ordinal)
      .apply()
  }

  fun forget(context: Context, ids: IntArray) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
    for (id in ids) prefs.remove("opacity_$id").remove("style_$id")
    prefs.apply()
  }

  /** Sets the background and its opacity for `look`, and returns the colours for the texts. */
  fun theme(context: Context, views: RemoteViews, look: Look): Theme {
    val style = if (look.style == Style.WALLPAPER) wallpaperStyle(context) else look.style
    val background = when (style) {
      Style.LIGHT -> R.drawable.daylight_widget_background_light
      Style.DARK -> R.drawable.daylight_widget_background_dark
      else -> R.drawable.daylight_widget_background
    }
    views.setImageViewResource(R.id.daylight_widget_background, background)
    views.setInt(R.id.daylight_widget_background, "setImageAlpha", look.opacity * 255 / 100)
    val ink = when (style) {
      Style.LIGHT -> LIGHT_INK
      Style.DARK -> DARK_INK
      else -> null
    }
    return Theme(context, views, ink)
  }

  /**
   * Light or dark to stand out on the home screen's wallpaper: Android tells whether dark text
   * reads on it, without a permission. Checked whenever the widget is drawn; a new wallpaper shows
   * from the next update on (opening the app, midnight). Unknown: as the system.
   */
  private fun wallpaperStyle(context: Context): Style {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O_MR1) return Style.SYSTEM
    val colors = runCatching { WallpaperManager.getInstance(context).getWallpaperColors(WallpaperManager.FLAG_SYSTEM) }.getOrNull()
      ?: return Style.SYSTEM
    val darkText = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      colors.colorHints and WallpaperColors.HINT_SUPPORTS_DARK_TEXT != 0
    } else {
      colors.primaryColor.luminance() > 0.5f
    }
    return if (darkText) Style.LIGHT else Style.DARK
  }

  /** `components/mood/MoodBadge.tsx` as a bitmap: the icon in the strong colour on the soft one, white on strong when filled. */
  fun badge(context: Context, state: WidgetState, level: Int, glyph: Int, label: String, size: Int, filled: Boolean): Bitmap {
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    drawBadge(context, state, Canvas(bitmap), size / 2f, size / 2f, size / 2f - 1, level, glyph, label, filled)
    return bitmap
  }

  fun drawBadge(context: Context, state: WidgetState, canvas: Canvas, cx: Float, cy: Float, radius: Float, level: Int, glyph: Int, label: String, filled: Boolean) {
    canvas.drawCircle(cx, cy, radius, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = if (filled) strong(level) else soft(level) })
    val ink = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = if (filled) Color.WHITE else strong(level)
      textAlign = Paint.Align.CENTER
    }
    // Without the icon font (a development build gets it from Metro) the mood's initial stands in.
    val font = font(context, state.font)
    val text = if (font != null && glyph > 0) {
      ink.typeface = font
      ink.textSize = radius * 2 * 0.68f
      String(Character.toChars(glyph))
    } else if (label.isNotEmpty()) {
      ink.typeface = Typeface.DEFAULT_BOLD
      ink.textSize = radius * 0.9f
      label.take(1).uppercase()
    } else {
      return
    }
    canvas.drawText(text, cx, cy - (ink.descent() + ink.ascent()) / 2f, ink)
  }

  /**
   * The MaterialCommunityIcons font the app itself draws with. In a release build Metro puts it in
   * `res/raw` and the app passes its resource name; it is copied out once, since a Typeface needs a file.
   */
  private fun font(context: Context, source: String?): Typeface? {
    val name = source?.takeUnless { it.contains("://") } ?: DEFAULT_FONT
    if (name == typefaceSource) return typeface
    val loaded = runCatching {
      val res = sequenceOf(name, DEFAULT_FONT).map { context.resources.getIdentifier(it, "raw", context.packageName) }.firstOrNull { it != 0 }
        ?: return@runCatching null
      val file = File(context.noBackupFilesDir, "daylight_widget_icons.ttf")
      context.resources.openRawResource(res).use { input -> file.outputStream().use { input.copyTo(it) } }
      Typeface.createFromFile(file)
    }.getOrNull()
    typeface = loaded
    typefaceSource = name
    return loaded
  }

  /**
   * Opens a `daylight://` link in the app. Aimed at MainActivity itself, not at the launcher entry:
   * that is one of several aliases `modules/daylight-launcher` switches with the season, and one
   * turned off since would open nothing. Links differ by their data, so each keeps its own intent.
   */
  fun open(context: Context, url: String): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
      .setComponent(ComponentName(context.packageName, MAIN_ACTIVITY))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Redraws just after midnight: a new day to mark, a streak to wait for. Inexact: needs no permission. */
  private fun scheduleMidnight(context: Context) {
    val alarm = context.getSystemService(AlarmManager::class.java) ?: return
    val zone = ZoneId.systemDefault()
    val next = LocalDate.now(zone).plusDays(1).atTime(LocalTime.of(0, 0, 30)).atZone(zone).toInstant().toEpochMilli()
    runCatching { alarm.set(AlarmManager.RTC, next, midnightIntent(context)) }
  }

  fun cancelMidnight(context: Context) {
    context.getSystemService(AlarmManager::class.java)?.cancel(midnightIntent(context))
  }

  private fun midnightIntent(context: Context): PendingIntent {
    val intent = Intent(context, MoodWidgetProvider::class.java).setAction(ACTION_MIDNIGHT)
    return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
}

internal fun dp(context: Context, value: Int) = (value * context.resources.displayMetrics.density).toInt()
