package de.behla.daylight.reminders

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.core.app.NotificationManagerCompat

/**
 * A mood button in a reminder (`MoodButtons`): takes that reminder off the screen, then opens its
 * link (`daylight://entry/new?date=…&mood=…`) in the app the way a widget does, and closes without
 * showing anything. A button in a custom view does not close the notification by itself, unlike a
 * tap on the notification. Behind the app lock the app asks to unlock first, as for every link.
 */
class MoodTapActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    intent.getStringExtra(EXTRA_REMINDER)?.let { NotificationManagerCompat.from(this).cancel(it, Reminders.NOTIFICATION_ID) }
    intent.getStringExtra(EXTRA_LINK)?.let { link ->
      val open = Intent(Intent.ACTION_VIEW, Uri.parse(link))
        .setComponent(launchIntent(this).component)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      runCatching { startActivity(open) }
    }
    // Theme.NoDisplay asks for finish() before onResume.
    finish()
  }

  companion object {
    const val EXTRA_REMINDER = "de.behla.daylight.reminders.REMINDER"
    const val EXTRA_LINK = "de.behla.daylight.reminders.LINK"
  }
}
