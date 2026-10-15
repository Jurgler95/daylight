package de.behla.daylight.reminders

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.AlarmManagerCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ProcessLifecycleOwner
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Local reminders without Firebase. Replaces the part of expo-notifications Daylight used and
 * copies its behaviour: an inexact alarm unless exact alarms are allowed, pending reminders kept in
 * SharedPreferences and set again after a reboot or an update, past ones dropped, the notification
 * silent while the app is in the foreground, a tap opening the app (at the reminder's link, if any).
 * Unlike expo-notifications a reminder keeps its wall-clock time when the time zone changes.
 */
internal data class Reminder(
  val id: String,
  val at: Long,
  val channelId: String,
  val title: String,
  val body: String,
  /** Deep link the tap opens, e.g. `daylight://entry/new?date=2026-10-13`; null opens the app as it is. */
  val url: String? = null,
  /**
   * The wall-clock time the reminder is meant for: `date` as "YYYY-MM-DD", `hour` and `minute` in
   * the device's time zone. With it `at` is worked out again after a change of time zone, so 20:30
   * stays 20:30 where the phone is now. Null for reminders stored before, those keep their `at`.
   */
  val local: LocalTrigger? = null,
) {
  fun toJson(): String = JSONObject()
    .put("at", at)
    .put("channelId", channelId)
    .put("title", title)
    .put("body", body)
    .apply { if (url != null) put("url", url) }
    .apply {
      if (local != null) {
        put("date", local.date)
        put("hour", local.hour)
        put("minute", local.minute)
      }
    }
    .toString()

  /** `at` for the wall-clock time in the zone the device is in now; without one the stored `at`. */
  fun inCurrentZone(): Reminder {
    val zoned = local?.atMillis(ZoneId.systemDefault()) ?: return this
    return copy(at = zoned)
  }

  companion object {
    /** Reminders stored before links existed have no `url` and simply open the app; ones without `date` keep `at`. */
    fun fromJson(id: String, json: String): Reminder? = try {
      val o = JSONObject(json)
      val url = if (o.has("url")) o.getString("url") else null
      val local = if (o.has("date") && o.has("hour") && o.has("minute")) {
        LocalTrigger.of(o.getString("date"), o.getInt("hour"), o.getInt("minute"))
      } else {
        null
      }
      Reminder(id, o.getLong("at"), o.getString("channelId"), o.getString("title"), o.getString("body"), url, local)
    } catch (e: Exception) {
      null
    }
  }
}

/** A day and a time of day without a zone. java.time is part of Android from API 26, the app's minSdk. */
internal data class LocalTrigger(val date: String, val hour: Int, val minute: Int) {
  /** A time that does not exist on that day (clocks jumping forward) moves to just after the gap. */
  fun atMillis(zone: ZoneId): Long? = try {
    ZonedDateTime.of(LocalDate.parse(date), LocalTime.of(hour, minute), zone).toInstant().toEpochMilli()
  } catch (e: Exception) {
    null
  }

  companion object {
    /** "YYYY-MM-DDTHH:mm" as JS sends it, null when it is missing or malformed. */
    fun parse(value: String?): LocalTrigger? {
      val match = value?.let { Regex("""^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$""").matchEntire(it) } ?: return null
      return of(match.groupValues[1], match.groupValues[2].toInt(), match.groupValues[3].toInt())
    }

    /** Null when the parts do not make a valid day and time; the reminder then keeps its `at`. */
    fun of(date: String?, hour: Int?, minute: Int?): LocalTrigger? {
      if (date == null || hour == null || minute == null) return null
      val trigger = LocalTrigger(date, hour, minute)
      return if (trigger.atMillis(ZoneId.systemDefault()) == null) null else trigger
    }
  }
}

internal object Reminders {
  private const val TAG = "DaylightReminders"
  private const val PREFS = "daylight_reminders"
  const val ACTION_FIRE = "de.behla.daylight.reminders.FIRE"
  /** Notifications are told apart by their tag (the reminder id), so the numeric id is always the same. */
  private const val NOTIFICATION_ID = 0

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun alarmManager(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  fun createChannel(context: Context, id: String, name: String) {
    val channel = NotificationChannel(id, name, NotificationManager.IMPORTANCE_DEFAULT).apply {
      lockscreenVisibility = android.app.Notification.VISIBILITY_PRIVATE
      vibrationPattern = longArrayOf(0, 200)
    }
    context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  fun schedule(context: Context, reminder: Reminder) {
    if (reminder.at <= System.currentTimeMillis()) {
      remove(context, reminder.id)
      return
    }
    prefs(context).edit().putString(reminder.id, reminder.toJson()).apply()
    setAlarm(context, reminder)
  }

  fun cancelAll(context: Context) {
    val prefs = prefs(context)
    for (id in prefs.all.keys) alarmManager(context).cancel(fireIntent(context, id))
    prefs.edit().clear().apply()
  }

  /** Takes notifications off the screen, e.g. once the day they ask about has an entry. */
  fun dismiss(context: Context, ids: List<String>) {
    val manager = NotificationManagerCompat.from(context)
    for (id in ids) manager.cancel(id, NOTIFICATION_ID)
  }

  /**
   * After a reboot or an update the system has forgotten every alarm. After a change of time zone
   * or of the clock the alarms are still there, but at the old absolute time, so each `at` is
   * worked out again from the stored wall-clock time. One that has passed in the new zone is dropped.
   */
  fun restore(context: Context) {
    for ((id, json) in prefs(context).all) {
      val reminder = (json as? String)?.let { Reminder.fromJson(id, it) }
      if (reminder == null) {
        alarmManager(context).cancel(fireIntent(context, id))
        remove(context, id)
      } else {
        val moved = reminder.inCurrentZone()
        if (moved.at <= System.currentTimeMillis()) alarmManager(context).cancel(fireIntent(context, id))
        schedule(context, moved)
      }
    }
  }

  fun fire(context: Context, id: String) {
    val reminder = prefs(context).getString(id, null)?.let { Reminder.fromJson(id, it) }
    remove(context, id)
    if (reminder != null) show(context, reminder)
  }

  private fun remove(context: Context, id: String) {
    prefs(context).edit().remove(id).apply()
  }

  private fun setAlarm(context: Context, reminder: Reminder) {
    val alarms = alarmManager(context)
    val operation = fireIntent(context, reminder.id)
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()) {
      AlarmManagerCompat.setExactAndAllowWhileIdle(alarms, AlarmManager.RTC_WAKEUP, reminder.at, operation)
    } else {
      AlarmManagerCompat.setAndAllowWhileIdle(alarms, AlarmManager.RTC_WAKEUP, reminder.at, operation)
    }
  }

  /** One PendingIntent per reminder; the data URI keeps them apart so each can be cancelled. */
  private fun fireIntent(context: Context, id: String): PendingIntent {
    val intent = Intent(context, ReminderReceiver::class.java)
      .setAction(ACTION_FIRE)
      .setData(Uri.fromParts("daylight-reminder", id, null))
    return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun show(context: Context, reminder: Reminder) {
    val manager = NotificationManagerCompat.from(context)
    if (!manager.areNotificationsEnabled()) return
    val builder = NotificationCompat.Builder(context, reminder.channelId)
      .setSmallIcon(R.drawable.daylight_reminder_icon)
      .setColor(ContextCompat.getColor(context, R.color.daylight_reminder_color))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setContentTitle(reminder.title)
      .setContentText(reminder.body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(reminder.body))
      // Like expo-notifications with shouldPlaySound: false while the app is open.
      .setSilent(isAppInForeground())
    openAppIntent(context, reminder)?.let { builder.setContentIntent(it) }
    try {
      manager.notify(reminder.id, NOTIFICATION_ID, builder.build())
    } catch (e: SecurityException) {
      Log.w(TAG, "Reminder ${reminder.id} could not be shown", e)
    }
  }

  /**
   * With a link: ACTION_VIEW with the link as data, aimed at the launch activity. React Native only
   * hands the URL to JS (initial URL on a cold start, a `url` event on a warm one) when it is the
   * intent's data, extras would go unseen. Each reminder gets its own request code, so two shown at
   * once never share (and overwrite) one PendingIntent.
   */
  private fun openAppIntent(context: Context, reminder: Reminder): PendingIntent? {
    val launch = runCatching { context.packageManager.getLaunchIntentForPackage(context.packageName) }.getOrNull() ?: return null
    val intent = reminder.url?.let { Intent(Intent.ACTION_VIEW, Uri.parse(it)).setComponent(launch.component) } ?: launch
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, reminder.id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /**
   * An activity on screen, as in expo-notifications. The process importance would not do: while a
   * receiver runs, Android counts the whole process as foreground.
   */
  private fun isAppInForeground(): Boolean =
    ProcessLifecycleOwner.get().lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
}
