import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Thin wrapper around expo-local-authentication (from Zyklus). Device credentials are the fallback,
 * so a phone with only a PIN or pattern can use the lock: `getEnrolledLevelAsync` reports `SECRET` for it.
 */

export async function isLockAvailable(): Promise<boolean> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

export interface AuthResult {
  success: boolean;
  /** True when the user dismissed the prompt instead of failing it. */
  cancelled: boolean;
}

export async function authenticate(promptMessage: string, cancelLabel: string): Promise<AuthResult> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel,
    // Keeping the device PIN as fallback means a phone without biometrics can still use the lock.
    disableDeviceFallback: false,
  });
  if (result.success) return { success: true, cancelled: false };
  return { success: false, cancelled: result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel' };
}
