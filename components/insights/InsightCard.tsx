import type { PropsWithChildren, ReactNode } from 'react';

import { AppText, Card } from '@/components/ui';

interface Props extends PropsWithChildren {
  title: string;
  /** Shown instead of the content when set: the card's own short empty state. */
  empty?: string | null;
  /** Controls between the title and the content, e.g. chips that pick a group or a year. */
  controls?: ReactNode;
}

/** A card with a headline; with too little data it keeps its place and says so in one line. */
export function InsightCard({ title, empty, controls, children }: Props) {
  return (
    <Card>
      <AppText variant="headline" accessibilityRole="header">
        {title}
      </AppText>
      {controls}
      {empty ? <AppText muted>{empty}</AppText> : children}
    </Card>
  );
}
