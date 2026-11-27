import { useTranslation } from 'react-i18next';

import { Segmented, TextField } from '@/components/ui';
import { formatDecimal } from '@/lib/insights/format';
import { NUMBER_MAX_DECIMALS, UNIT_MAX_LENGTH } from '@/lib/scales/number';

interface Props {
  unit: string;
  decimals: number;
  onUnit: (unit: string) => void;
  /** For a scale that exists: the unit is saved when the field is left. */
  onUnitBlur?: () => void;
  onDecimals: (decimals: number) => void;
}

const DECIMALS = Array.from({ length: NUMBER_MAX_DECIMALS + 1 }, (_, decimals) => decimals);

/** Unit and decimals of a number scale, when it is created and on its own page. */
export function NumberSettings({ unit, decimals, onUnit, onUnitBlur, onDecimals }: Props) {
  const { t } = useTranslation();
  return (
    <>
      <TextField label={t('manage.unit')} value={unit} placeholder={t('manage.unitPlaceholder')} maxLength={UNIT_MAX_LENGTH} onChangeText={onUnit} onBlur={onUnitBlur} />
      <Segmented
        label={t('manage.decimals')}
        // "0", "0,0", "0,00": what the value will look like is clearer than a count.
        options={DECIMALS.map((value) => ({ value, label: formatDecimal(0, value) }))}
        value={decimals}
        onChange={onDecimals}
      />
    </>
  );
}
