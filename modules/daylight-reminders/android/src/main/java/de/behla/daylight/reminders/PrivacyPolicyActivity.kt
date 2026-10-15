package de.behla.daylight.reminders

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle

/**
 * Health Connect's link to the privacy policy: the permission dialog starts this activity (with
 * `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` up to Android 13, through the alias
 * `ViewPermissionUsageActivity` from Android 14 on). Play requires the policy to show there, not
 * whatever page was open last. So it hands `daylight://more/privacy` to the launch activity as a
 * plain VIEW link, which expo-router opens like any deep link, and closes without showing anything.
 * Declared in the app manifest by `plugins/withHealthPrivacyPolicy.js`, right before the alias.
 */
class PrivacyPolicyActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val launch = runCatching { packageManager.getLaunchIntentForPackage(packageName) }.getOrNull()
    if (launch != null) {
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(PRIVACY_LINK))
        .setComponent(launch.component)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      runCatching { startActivity(intent) }
    }
    // Theme.NoDisplay asks for finish() before onResume.
    finish()
  }

  companion object {
    /** `app/more/privacy.tsx` under the scheme from app.json. */
    const val PRIVACY_LINK = "daylight://more/privacy"
  }
}
