import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { isDateString, today } from '@/lib/dates';
import { useSelectedDayStore } from '@/lib/store/selectedDay';

/**
 * Where the morning outlook notification and the widgets lead (`daylight://today`): "Heute" on
 * today, whichever tab or day the app was left on, since that is where the card stands. With
 * `?date=YYYY-MM-DD` (the history widget, for a day that has entries) "Heute" shows that day
 * instead; a date ahead or one that is none falls back to today. Shows nothing itself.
 */
export default function TodayLink() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  useEffect(() => {
    const day = today();
    useSelectedDayStore.getState().pick(date && isDateString(date) && date < day ? date : null);
    router.replace('/');
    // Once, when the link opens the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
