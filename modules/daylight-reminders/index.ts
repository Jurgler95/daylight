import { requireOptionalNativeModule } from 'expo';

/**
 * Local reminders on Android without Firebase (`android/.../Reminders.kt`). Null where the native
 * module is missing: iOS, the web, Expo Go and Jest.
 */
export interface DaylightRemindersModule {
  createChannel(id: string, name: string): void;
  hasPermission(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  /**
   * `at` in milliseconds since the epoch. A time in the past schedules nothing. A tap opens `url`
   * (a `daylight://` link) in the app, or just the app when it is null.
   */
  schedule(id: string, at: number, channelId: string, title: string, body: string, url: string | null): void;
  cancelAll(): void;
  /** Removes notifications already on screen by reminder id; ids that show nothing are ignored. */
  dismiss(ids: string[]): void;
}

export default requireOptionalNativeModule<DaylightRemindersModule>('DaylightReminders');
