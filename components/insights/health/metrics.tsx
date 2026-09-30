import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Segmented } from '@/components/ui';
import type { HealthMetric } from '@/lib/insights';
import type { IconName } from '@/lib/icons';

export const METRIC_ICONS: Record<HealthMetric, IconName> = {
  sleep: 'power-sleep',
  steps: 'shoe-print',
  restingHr: 'heart-pulse',
  exercise: 'run',
};

/** The picked metric of a card; falls back to the first one when the range no longer has it. */
export function useMetric(metrics: readonly HealthMetric[]): [HealthMetric | null, (metric: HealthMetric) => void] {
  const [picked, setPicked] = useState<HealthMetric | null>(null);
  const metric = picked && metrics.includes(picked) ? picked : (metrics[0] ?? null);
  return [metric, setPicked];
}

/** Switches a card between sleep, steps, pulse and training; hidden when there is only one. */
export function MetricPicker({ metrics, value, onChange }: { metrics: readonly HealthMetric[]; value: HealthMetric; onChange: (metric: HealthMetric) => void }) {
  const { t } = useTranslation();
  if (metrics.length < 2) return null;
  return (
    <Segmented
      options={metrics.map((metric) => ({ value: metric, label: t(`insights.healthStats.metric.${metric}`) }))}
      value={value}
      onChange={onChange}
    />
  );
}
