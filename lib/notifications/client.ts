import { isRunningInExpoGo } from 'expo';
import type * as NotificationsTypes from 'expo-notifications';
import { Platform } from 'react-native';

import { parseDateString } from '@/lib/dates';

import type { PlannedReminder } from './plan';

/**
 * expo-notifications is required lazily and skipped in Expo Go on Android. In Zyklus the plain
 * import threw there and took every module that imported the client down with it (Zyklus, Phase 7,
 * decision 14). Every entry point degrades to "no reminders" without the module.
 */

type NotificationsModule = typeof NotificationsTypes;

/** Android channel for the one reminder this app schedules. */
export const CHANNEL_ID = 'reminders';

const supported = Platform.OS === 'android' || Platform.OS === 'ios';

let cached: NotificationsModule | null | undefined;

function load(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  if (!supported || (Platform.OS === 'android' && isRunningInExpoGo())) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('expo-notifications') as NotificationsModule;
    module.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    cached = module;
  } catch {
    cached = null;
  }
  return cached;
}

/** False in Expo Go on Android; the settings page uses this to explain why nothing arrives. */
export function notificationsAvailable(): boolean {
  return load() !== null;
}

/** Android 13 only shows the permission prompt once a channel exists, so this runs before asking. */
async function ensureChannel(module: NotificationsModule, channelName: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await module.setNotificationChannelAsync(CHANNEL_ID, {
    name: channelName,
    importance: module.AndroidImportance.DEFAULT,
    lockscreenVisibility: module.AndroidNotificationVisibility.PRIVATE,
    vibrationPattern: [0, 200],
  });
}

export async function hasPermission(): Promise<boolean> {
  const module = load();
  if (!module) return false;
  const status = await module.getPermissionsAsync();
  return status.granted || status.ios?.status === module.IosAuthorizationStatus.PROVISIONAL;
}

export async function requestPermission(channelName: string): Promise<boolean> {
  const module = load();
  if (!module) return false;
  if (await hasPermission()) return true;
  await ensureChannel(module, channelName);
  const status = await module.requestPermissionsAsync();
  return status.granted;
}

export async function cancelAll(): Promise<void> {
  const module = load();
  if (!module) return;
  await module.cancelAllScheduledNotificationsAsync();
}

function triggerFor(module: NotificationsModule, reminder: PlannedReminder): NotificationsTypes.NotificationTriggerInput {
  const day = parseDateString(reminder.date);
  const date = new Date(day.getFullYear(), day.getMonth(), day.getDate(), reminder.hour, reminder.minute, 0, 0);
  return { type: module.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_ID };
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
  const module = load();
  if (!module) return;
  await ensureChannel(module, texts.channelName);
  await module.cancelAllScheduledNotificationsAsync();
  for (const reminder of planned) {
    await module.scheduleNotificationAsync({
      content: { title: texts.title, body: texts.body, data: { kind: 'daily' } },
      trigger: triggerFor(module, reminder),
    });
  }
}
