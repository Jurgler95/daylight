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
   * (a `daylight://` link) in the app, or just the app when it is null. `local` is the wall-clock
   * time behind `at` ("YYYY-MM-DDTHH:mm"): after a change of time zone the module works out `at`
   * again from it, so the reminder keeps its time of day.
   */
  schedule(id: string, at: number, channelId: string, title: string, body: string, url: string | null, local: string | null): void;
  cancelAll(): void;
  /** Removes notifications already on screen by reminder id; ids that show nothing are ignored. */
  dismiss(ids: string[]): void;
}

export default requireOptionalNativeModule<DaylightRemindersModule>('DaylightReminders');
