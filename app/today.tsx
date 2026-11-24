import { router } from 'expo-router';
import { useEffect } from 'react';

import { useSelectedDayStore } from '@/lib/store/selectedDay';

/**
 * Where the morning outlook notification leads (`daylight://today`): "Heute" on today, whichever
 * tab or day the app was left on, since that is where the card stands. Shows nothing itself.
 */
export default function TodayLink() {
  useEffect(() => {
    useSelectedDayStore.getState().pick(null);
    router.replace('/');
  }, []);
  return null;
}
