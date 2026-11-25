import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { spacing } from '@/lib/theme';

interface Props extends PropsWithChildren {
  title: string;
  /** Shown instead of the content when set: the card's own short empty state. */
  empty?: string | null;
  /** Controls between the title and the content, e.g. chips that pick a group or a year. */
  controls?: ReactNode;
  /** A small button at the end of the headline, e.g. to open the card on its own. */
  action?: ReactNode;
}

/** A card with a headline; with too little data it keeps its place and says so in one line. */
export function InsightCard({ title, empty, controls, action, children }: Props) {
  const headline = (
    <AppText variant="headline" accessibilityRole="header" style={action ? styles.flex : undefined}>
      {title}
    </AppText>
  );
  return (
    <Card>
      {action ? (
        <View style={styles.row}>
          {headline}
          {action}
        </View>
      ) : (
        headline
      )}
      {controls}
      {empty ? <AppText muted>{empty}</AppText> : children}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
