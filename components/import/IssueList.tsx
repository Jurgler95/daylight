import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui';

interface Props {
  title: string;
  lines: readonly string[];
  /** Lines shown before the rest collapses into "und N weitere". */
  limit?: number;
  color?: string;
}

/** Errors or notes of an import, one per row of the file. */
export function IssueList({ title, lines, limit = 8, color }: Props) {
  const { t } = useTranslation();
  if (lines.length === 0) return null;
  return (
    <>
      <AppText variant="label" color={color}>
        {title}
      </AppText>
      {lines.slice(0, limit).map((line, index) => (
        <AppText key={index} variant="caption" muted>
          {line}
        </AppText>
      ))}
      {lines.length > limit ? (
        <AppText variant="caption" muted>
          {t('import.more', { count: lines.length - limit })}
        </AppText>
      ) : null}
    </>
  );
}
