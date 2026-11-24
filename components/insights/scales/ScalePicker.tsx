import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SelectRow } from '@/components/ui';
import type { ScaleInsight } from '@/lib/insights';

/** The scale the section looks at; falls back to the first one when the range no longer has it. */
export function useScale(insights: readonly ScaleInsight[]): [ScaleInsight | null, (id: number) => void] {
  const [picked, setPicked] = useState<number | null>(null);
  return [insights.find((insight) => insight.scale.id === picked) ?? insights[0] ?? null, setPicked];
}

/**
 * One row in the sticky head of "Skalen" that names the scale every card below shows and opens the
 * list of all of them. A row of chips would grow with every scale and push the cards down; this
 * stays one line however many there are. Hidden when there is only one.
 */
export function ScalePicker({ insights, value, onChange }: { insights: readonly ScaleInsight[]; value: number; onChange: (id: number) => void }) {
  const { t } = useTranslation();
  if (insights.length < 2) return null;
  return (
    <SelectRow
      label={t('insights.scales.label')}
      title={t('insights.scales.pick')}
      value={String(value)}
      sections={[{ options: insights.map(({ scale }) => ({ value: String(scale.id), label: scale.name })) }]}
      closeLabel={t('common.close')}
      onChange={(id) => onChange(Number(id))}
    />
  );
}
