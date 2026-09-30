import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { LastMoodError, NameTakenError } from '@/db/types';
import { mutate } from '@/lib/store/dataVersion';

/**
 * Runs a write from the management screens and turns the expected refusals into a message:
 * a taken name (the way out is merging) and archiving the last mood. Returns whether it worked.
 */
export function useManageWrite(): (write: () => void) => boolean {
  const { t } = useTranslation();
  return (write) => {
    try {
      mutate(write);
      return true;
    } catch (error) {
      if (error instanceof NameTakenError) Alert.alert(t('manage.nameTaken', { name: error.taken }), t('manage.nameTakenHint'));
      else if (error instanceof LastMoodError) Alert.alert(t('manage.lastMood'));
      else Alert.alert(t('common.error'), error instanceof Error ? error.message : String(error));
      return false;
    }
  };
}
