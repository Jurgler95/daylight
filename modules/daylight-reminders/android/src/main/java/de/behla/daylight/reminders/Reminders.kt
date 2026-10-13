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

/**
 * Local reminders without Firebase. Replaces the part of expo-notifications Daylight used and
 * copies its behaviour: an inexact alarm unless exact alarms are allowed, pending reminders kept in
 * SharedPreferences and set again after a reboot or an update, past ones dropped, the notification
 * silent while the app is in the foreground, a tap opening the app (at the reminder's link, if any).
 */
internal data class Reminder(
  val id: String,
  val at: Long,
  val channelId: String,
  val title: String,
  val body: String,
  /** Deep link the tap opens, e.g. `daylight://entry/new?date=2026-10-13`; null opens the app as it is. */
  val url: String? = null,
) {
  fun toJson(): String = JSONObject()
    .put("at", at)
    .put("channelId", channelId)
    .put("title", title)
    .put("body", body)
    .apply { if (url != null) put("url", url) }
    .toString()

  companion object {
    /** Reminders stored before links existed have no `url` and simply open the app. */
    fun fromJson(id: String, json: String): Reminder? = try {
      val o = JSONObject(json)
      val url = if (o.has("url")) o.getString("url") else null
      Reminder(id, o.getLong("at"), o.getString("channelId"), o.getString("title"), o.getString("body"), url)
    } catch (e: Exception) {
      null
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

  /** After a reboot or an update the system has forgotten every alarm. */
  fun restore(context: Context) {
    for ((id, json) in prefs(context).all) {
      val reminder = (json as? String)?.let { Reminder.fromJson(id, it) }
      if (reminder == null) remove(context, id) else schedule(context, reminder)
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
