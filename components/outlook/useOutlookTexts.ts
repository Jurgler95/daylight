import { useTranslation } from 'react-i18next';

import type { MoodLevel } from '@/db/schema';
import { activityLabel, levelMood } from '@/lib/catalog/catalog';
import type { Catalog } from '@/lib/catalog/catalog';
import { formatWeekdayLong, type DateString } from '@/lib/dates';
import { formatDecimal, formatPercent } from '@/lib/insights/format';
import type { OutlookDay, OutlookRange, OutlookReason } from '@/lib/outlook';

/** Sentences of the outlook, with mood and activity names from the catalog. */
export function useOutlookTexts(catalog: Catalog) {
  const { t } = useTranslation();
  const mood = (level: MoodLevel) => levelMood(catalog, level).label;

  const range = (value: OutlookRange) =>
    value.lowLevel === value.highLevel ? mood(value.mid) : t('outlook.between', { low: mood(value.lowLevel), high: mood(value.highLevel) });

  const reason = (value: OutlookReason, date: DateString): string => {
    const up = value.value > 0;
    if (value.kind === 'weekday') return t(up ? 'outlook.reasonWeekdayUp' : 'outlook.reasonWeekdayDown', { weekday: formatWeekdayLong(date) });
    if (value.kind === 'carry') return t(up ? 'outlook.reasonCarryUp' : 'outlook.reasonCarryDown');
    const name = activityLabel(catalog, value.activityId);
    if (value.source === 'planned') return t(up ? 'outlook.reasonPlannedUp' : 'outlook.reasonPlannedDown', { name });
    if (value.source === 'recurring') return t(up ? 'outlook.reasonRecurringUp' : 'outlook.reasonRecurringDown', { name });
    return t(up ? 'outlook.reasonSkippedUp' : 'outlook.reasonSkippedDown', { name });
  };

  const profile = (day: OutlookDay) =>
    day.weekdayMean === null
      ? t('outlook.weekdayNone', { weekday: formatWeekdayLong(day.date) })
      : t('outlook.weekdayMean', { weekday: formatWeekdayLong(day.date), mean: formatDecimal(day.weekdayMean), count: day.weekdayDays });

  const names = (ids: readonly number[]) => ids.map((id) => activityLabel(catalog, id)).join(', ');

  const hardChance = (share: number) => t('outlook.hardChance', { percent: formatPercent(share) });

  return { mood, range, reason, profile, names, hardChance };
}
