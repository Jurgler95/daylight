import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Small, named touches of feedback so every screen speaks the same haptic language.
 * On Android this goes through the view's haptic engine (no VIBRATE permission, and it
 * follows the system "touch feedback" switch); iOS uses the Taptic Engine.
 * Failures are swallowed: feedback is a nicety, never a reason for an error.
 */
function run(android: Haptics.AndroidHaptics, ios: () => Promise<void>) {
  const promise = Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(android) : ios();
  promise.catch(() => undefined);
}

export const haptics = {
  /** A plain button press. */
  tap: () => run(Haptics.AndroidHaptics.Virtual_Key, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Something was switched on or picked. */
  on: () => run(Haptics.AndroidHaptics.Toggle_On, () => Haptics.selectionAsync()),
  /** Something was switched off or cleared. */
  off: () => run(Haptics.AndroidHaptics.Toggle_Off, () => Haptics.selectionAsync()),
  /** Moving along a scale or a wheel of days. */
  tick: () => run(Haptics.AndroidHaptics.Segment_Tick, () => Haptics.selectionAsync()),
  /** One beat while something is being held down, e.g. setting a turning point. */
  hold: () => run(Haptics.AndroidHaptics.Segment_Frequent_Tick, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
  /** The end of a long press that set something rare. */
  landmark: () => run(Haptics.AndroidHaptics.Long_Press, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  /** An entry that matters was recorded. */
  confirm: () => run(Haptics.AndroidHaptics.Confirm, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
