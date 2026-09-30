import { useTranslation } from 'react-i18next';

import { levelMood } from '@/lib/catalog/catalog';
import { useCatalog } from '@/lib/catalog/useCatalog';
import { formatLong, type DateString } from '@/lib/dates';

import { dayAccessibilityLabel, type CalendarMarker } from './dayLabel';

/** The spoken label of a day, with the texts and mood names filled in. */
export function useDayLabel(today: DateString): (date: DateString, marker: CalendarMarker | undefined) => string {
  const { t } = useTranslation();
  const catalog = useCatalog();
  const texts = {
    today: t('calendar.today'),
    mood: (level: 1 | 2 | 3 | 4 | 5) => levelMood(catalog, level).label,
    entries: (count: number) => t('calendar.entries', { count }),
    noEntry: t('calendar.noEntry'),
    formatDate: formatLong,
    outlook: (level: 1 | 2 | 3 | 4 | 5) => t('calendar.outlook', { mood: levelMood(catalog, level).label }),
    planned: (names: string) => t('calendar.planned', { names }),
  };
  return (date, marker) => dayAccessibilityLabel(date, marker, date === today, date > today, texts);
}
