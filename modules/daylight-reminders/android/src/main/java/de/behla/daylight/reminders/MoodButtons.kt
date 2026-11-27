package de.behla.daylight.reminders

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File

internal data class ButtonMood(val id: Int, val level: Int, val glyph: Int, val label: String)

/** What the app last handed over (`lib/notifications/moods.ts`): the active moods in the picker's order and the icon font. */
internal data class StoredMoods(val font: String?, val moods: List<ButtonMood>) {
  companion object {
    fun parse(json: String): StoredMoods? = runCatching {
      val o = JSONObject(json)
      val list = o.getJSONArray("moods")
      val moods = (0 until list.length()).map { i ->
        val m = list.getJSONObject(i)
        ButtonMood(m.getInt("id"), m.getInt("level"), m.optInt("glyph", 0), m.getString("label"))
      }
      StoredMoods(o.optString("font").ifEmpty { null }, moods)
    }.getOrNull()
  }
}

/**
 * The expanded reminder: its title and text, below them a button per mood. A tap opens a new entry
 * with that mood chosen (through `MoodTapActivity`, which also takes the notification away). The
 * buttons never mark a mood, so behind the app lock they tell nothing about the diary either.
 *
 * Android shows at most three action buttons, too few for five moods, so the row is a custom view
 * in the system's decorated frame (DecoratedCustomViewStyle): app icon, name and time stay the
 * system's own, collapsed the notification is the standard one.
 */
internal object MoodButtons {
  private const val PREFS = "daylight_reminder_moods"
  private const val KEY = "moods"
  private const val ICON_DP = 40

  /** Where Metro puts `@expo/vector-icons`' MaterialCommunityIcons in a release build, should the app pass no name. */
  private const val DEFAULT_FONT = "node_modules_expo_vectoricons_build_vendor_reactnativevectoricons_fonts_materialcommunityicons"

  /** `lib/theme/tokens.ts` `moodColors`, strong and soft per level 1 to 5, as in the widgets. */
  private val STRONG = mapOf(5 to "#007060", 4 to "#336E08", 3 to "#876200", 2 to "#B03512", 1 to "#9C1C7A")
  private val SOFT = mapOf(5 to "#C8F3E3", 4 to "#DDF4C2", 3 to "#FFEC9E", 2 to "#FFDCC0", 1 to "#F8D8F0")

  /** Five slots, as in the mood widget; the app hands over at most five moods. */
  private val SLOT_IDS = listOf(
    Triple(R.id.daylight_reminder_slot_0, R.id.daylight_reminder_mood_0, R.id.daylight_reminder_label_0),
    Triple(R.id.daylight_reminder_slot_1, R.id.daylight_reminder_mood_1, R.id.daylight_reminder_label_1),
    Triple(R.id.daylight_reminder_slot_2, R.id.daylight_reminder_mood_2, R.id.daylight_reminder_label_2),
    Triple(R.id.daylight_reminder_slot_3, R.id.daylight_reminder_mood_3, R.id.daylight_reminder_label_3),
    Triple(R.id.daylight_reminder_slot_4, R.id.daylight_reminder_mood_4, R.id.daylight_reminder_label_4),
  )

  private var typeface: Typeface? = null
  private var typefaceSource: String? = null

  fun store(context: Context, json: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply()
  }

  private fun stored(context: Context): StoredMoods? =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)?.let { StoredMoods.parse(it) }

  /** The expanded view with the moods as they are now, or null without any (the app has not handed them over yet). */
  fun views(context: Context, reminder: Reminder): RemoteViews? {
    val base = reminder.moodUrl ?: return null
    val stored = stored(context) ?: return null
    if (stored.moods.isEmpty()) return null
    val views = RemoteViews(context.packageName, R.layout.daylight_reminder_moods)
    views.setTextViewText(R.id.daylight_reminder_title, reminder.title)
    views.setTextViewText(R.id.daylight_reminder_text, reminder.body)
    views.setViewVisibility(R.id.daylight_reminder_text, if (reminder.body.isEmpty()) View.GONE else View.VISIBLE)
    val px = (ICON_DP * context.resources.displayMetrics.density).toInt()
    SLOT_IDS.forEachIndexed { index, (root, icon, label) ->
      val mood = stored.moods.getOrNull(index)
      if (mood == null) {
        views.setViewVisibility(root, View.GONE)
        return@forEachIndexed
      }
      views.setViewVisibility(root, View.VISIBLE)
      views.setImageViewBitmap(icon, badge(context, stored.font, mood, px))
      views.setTextViewText(label, mood.label)
      views.setContentDescription(root, mood.label)
      views.setOnClickPendingIntent(root, tapIntent(context, reminder.id, moodLink(base, mood.id), mood.id))
    }
    return views
  }

  /** `base` with the mood added as a query parameter. */
  fun moodLink(base: String, moodId: Int): String = base + (if (base.contains('?')) "&" else "?") + "mood=$moodId"

  /**
   * Starts `MoodTapActivity`, an activity: Android 12 no longer lets a receiver or service tapped in
   * a notification start one. The data URI is unique per reminder and mood, so no two buttons share
   * (and overwrite) a PendingIntent, also when two reminders of a day show at once.
   */
  private fun tapIntent(context: Context, reminderId: String, link: String, moodId: Int): PendingIntent {
    val intent = Intent(context, MoodTapActivity::class.java)
      .setData(Uri.fromParts("daylight-reminder-mood", "$reminderId/$moodId", null))
      .putExtra(MoodTapActivity.EXTRA_REMINDER, reminderId)
      .putExtra(MoodTapActivity.EXTRA_LINK, link)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** `components/mood/MoodBadge.tsx` as a bitmap: the icon in the strong colour on the soft one. */
  private fun badge(context: Context, fontName: String?, mood: ButtonMood, size: Int): Bitmap {
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val radius = size / 2f - 1
    val strong = Color.parseColor(STRONG[mood.level] ?: STRONG.getValue(3))
    val soft = Color.parseColor(SOFT[mood.level] ?: SOFT.getValue(3))
    canvas.drawCircle(size / 2f, size / 2f, radius, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = soft })
    val ink = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = strong
      textAlign = Paint.Align.CENTER
    }
    // Without the icon font (a development build gets it from Metro) the mood's initial stands in.
    val font = font(context, fontName)
    val text = if (font != null && mood.glyph > 0) {
      ink.typeface = font
      ink.textSize = radius * 2 * 0.68f
      String(Character.toChars(mood.glyph))
    } else if (mood.label.isNotEmpty()) {
      ink.typeface = Typeface.DEFAULT_BOLD
      ink.textSize = radius * 0.9f
      mood.label.take(1).uppercase()
    } else {
      return bitmap
    }
    canvas.drawText(text, size / 2f, size / 2f - (ink.descent() + ink.ascent()) / 2f, ink)
    return bitmap
  }

  /**
   * The MaterialCommunityIcons font the app draws with. In a release build Metro puts it in
   * `res/raw` and the app passes its resource name; it is copied out once, since a Typeface needs a file.
   */
  private fun font(context: Context, source: String?): Typeface? {
    val name = source?.takeUnless { it.contains("://") } ?: DEFAULT_FONT
    if (name == typefaceSource) return typeface
    val loaded = runCatching {
      val res = sequenceOf(name, DEFAULT_FONT).map { context.resources.getIdentifier(it, "raw", context.packageName) }.firstOrNull { it != 0 }
        ?: return@runCatching null
      val file = File(context.noBackupFilesDir, "daylight_reminder_icons.ttf")
      context.resources.openRawResource(res).use { input -> file.outputStream().use { input.copyTo(it) } }
      Typeface.createFromFile(file)
    }.getOrNull()
    typeface = loaded
    typefaceSource = name
    return loaded
  }
}
