import { requireOptionalNativeModule } from 'expo';

/**
 * Local reminders on Android without Firebase (`android/.../Reminders.kt`). Null where the native
 * module is missing: iOS, the web, Expo Go and Jest.
 */
export interface DaylightRemindersModule {
  createChannel(id: string, name: string): void;
  hasPermission(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  /** `at` in milliseconds since the epoch. A time in the past schedules nothing. */
  schedule(id: string, at: number, channelId: string, title: string, body: string): void;
  cancelAll(): void;
}

export default requireOptionalNativeModule<DaylightRemindersModule>('DaylightReminders');
