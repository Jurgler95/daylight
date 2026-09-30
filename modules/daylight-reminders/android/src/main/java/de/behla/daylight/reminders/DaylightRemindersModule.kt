package de.behla.daylight.reminders

import android.Manifest
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DaylightRemindersModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  /** Android 13 asks for POST_NOTIFICATIONS; before that the system switch is all there is, as in expo-notifications. */
  private val asksForPermission: Boolean
    get() = Build.VERSION.SDK_INT >= 33 && context.applicationInfo.targetSdkVersion >= 33

  override fun definition() = ModuleDefinition {
    Name("DaylightReminders")

    Function("createChannel") { id: String, name: String ->
      Reminders.createChannel(context, id, name)
    }

    AsyncFunction("hasPermission") { promise: Promise ->
      if (!asksForPermission) {
        promise.resolve(NotificationManagerCompat.from(context).areNotificationsEnabled())
        return@AsyncFunction
      }
      val permissions = appContext.permissions ?: throw Exceptions.PermissionsModuleNotFound()
      permissions.getPermissions({ result ->
        promise.resolve(result.values.all { it.status == PermissionsStatus.GRANTED })
      }, Manifest.permission.POST_NOTIFICATIONS)
    }

    AsyncFunction("requestPermission") { promise: Promise ->
      if (!asksForPermission) {
        promise.resolve(NotificationManagerCompat.from(context).areNotificationsEnabled())
        return@AsyncFunction
      }
      val permissions = appContext.permissions ?: throw Exceptions.PermissionsModuleNotFound()
      permissions.askForPermissions({ result ->
        promise.resolve(result.values.all { it.status == PermissionsStatus.GRANTED })
      }, Manifest.permission.POST_NOTIFICATIONS)
    }

    Function("schedule") { id: String, at: Double, channelId: String, title: String, body: String ->
      Reminders.schedule(context, Reminder(id, at.toLong(), channelId, title, body))
    }

    Function("cancelAll") {
      Reminders.cancelAll(context)
    }
  }
}
