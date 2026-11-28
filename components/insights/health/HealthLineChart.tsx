import { useTranslation } from 'react-i18next';

import { ValueLineChart } from '@/components/insights/ValueLineChart';
import { formatShort } from '@/lib/dates';
import { formatMetric } from '@/lib/health/format';
import type { DayWindow, HealthMetric, HealthPoint } from '@/lib/insights';

interface Props {
  metric: HealthMetric;
  points: HealthPoint[];
  window: DayWindow;
  /** Drawn as a dashed line, e.g. 7 h of sleep. */
  goal?: number;
}

/** Steps, sleep and training start at 0; the pulse only moves a few beats, so its scale hugs the values. */
export function HealthLineChart({ metric, points, window, goal }: Props) {
  const { t } = useTranslation();
  const values = points.map((p) => p.value);
  const max = Math.max(goal ?? 0, ...values);
  const min = Math.min(...values);
  const lo = metric === 'restingHr' ? Math.max(0, Math.floor(min) - 3) : 0;
  const hi = metric === 'restingHr' ? Math.ceil(max) + 3 : Math.max(1, max * 1.05);
  const last = points[points.length - 1];
  const label = t('insights.healthStats.trend.a11y', {
    metric: t(`insights.healthStats.metric.${metric}`),
    from: formatShort(window.from),
    to: formatShort(window.to),
    count: points.length,
    last: last ? formatMetric(metric, last.rolling) : '',
  });
  return <ValueLineChart points={points} window={window} lo={lo} hi={hi} format={(value) => formatMetric(metric, value)} accessibilityLabel={label} goal={goal} title={t(`insights.healthStats.metric.${metric}`)} />;
}
