package de.behla.daylight.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Shows a reminder when its alarm goes off and sets the pending ones again after a reboot or an update. */
class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action == Reminders.ACTION_FIRE) {
      intent.data?.schemeSpecificPart?.let { Reminders.fire(context, it) }
    } else {
      Reminders.restore(context)
    }
  }
}
