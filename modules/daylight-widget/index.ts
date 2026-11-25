import { requireOptionalNativeModule } from 'expo';

/**
 * The mood widget on the home screen (`android/.../MoodWidget.kt`). Null where the native module is
 * missing: iOS, the web, Expo Go and Jest.
 */
export interface DaylightWidgetModule {
  /** Stores what the widget shows (`lib/widget` builds the JSON) and redraws every widget placed. */
  update(state: string): void;
}

export default requireOptionalNativeModule<DaylightWidgetModule>('DaylightWidget');
