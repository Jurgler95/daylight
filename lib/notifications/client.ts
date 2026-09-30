import { parseDateString } from '@/lib/dates';
import Reminders from '@/modules/daylight-reminders';

import type { PlannedReminder } from './plan';

/**
 * Reminders go through the app's own native module (`modules/daylight-reminders`), not
 * expo-notifications: that one ships Firebase Cloud Messaging, which Daylight never uses and which
 * keeps the app out of F-Droid. Without the module (Expo Go, iOS, tests) every entry point degrades
 * to "no reminders".
 */

/** Android channel for the one reminder this app schedules. */
export const CHANNEL_ID = 'reminders';

/** False in Expo Go; the settings page uses this to explain why nothing arrives. */
export function notificationsAvailable(): boolean {
  return Reminders !== null;
}

export async function hasPermission(): Promise<boolean> {
  if (!Reminders) return false;
  return Reminders.hasPermission();
}

/** Android 13 only shows the permission prompt once a channel exists, so the channel comes first. */
export async function requestPermission(channelName: string): Promise<boolean> {
  if (!Reminders) return false;
  if (await hasPermission()) return true;
  Reminders.createChannel(CHANNEL_ID, channelName);
  return Reminders.requestPermission();
}

export async function cancelAll(): Promise<void> {
  Reminders?.cancelAll();
}

function triggerAt(reminder: PlannedReminder): number {
  const day = parseDateString(reminder.date);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), reminder.hour, reminder.minute, 0, 0).getTime();
}

export interface ReminderTexts {
  channelName: string;
  title: string;
  body: string;
}

/**
 * Replaces every scheduled reminder with the given plan. The app schedules nothing else, so
 * cancelling all first keeps the device in sync without bookkeeping of identifiers.
 */
export async function syncReminders(planned: readonly PlannedReminder[], texts: ReminderTexts): Promise<void> {
  if (!Reminders) return;
  Reminders.createChannel(CHANNEL_ID, texts.channelName);
  Reminders.cancelAll();
  for (const reminder of planned) {
    Reminders.schedule(reminder.key, triggerAt(reminder), CHANNEL_ID, texts.title, texts.body);
  }
}
