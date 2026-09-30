import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOUCH_TARGET, spacing, useTheme, withAlpha } from '@/lib/theme';

import { AppText } from './AppText';
import { LogoBackdrop } from './LogoBackdrop';

interface Props extends PropsWithChildren {
  title?: string;
  eyebrow?: string;
  scroll?: boolean;
  /** Shows a back button above the title. Used by every screen pushed on top of the tabs. */
  back?: boolean;
  backLabel?: string;
  /** Pinned above the scroll area, so it stays put while the content below moves. */
  sticky?: ReactNode;
  /** A new value starts the scroll area over at the top, e.g. when a tab above it switches. */
  contentKey?: string;
}

export function Screen({ title, eyebrow, scroll = true, back, backLabel, sticky, contentKey, children }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const Container = scroll ? ScrollView : View;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* A sky blue glow fades in from the top edge, so every page starts a little sunnier. Decorative only. */}
      <LinearGradient
        pointerEvents="none"
        colors={[colors.glow, withAlpha(colors.glow, 0)]}
        style={[styles.glow, { height: insets.top + 320 }]}
      />
      <LogoBackdrop />
      {sticky ? <View style={[styles.sticky, { paddingTop: insets.top + spacing.lg }]}>{sticky}</View> : null}
      <Container
        key={contentKey}
        // Without the scroll view the padding moves onto the container itself, so a child list
        // can fill the remaining height and own its bottom inset.
        style={scroll ? styles.root : [styles.root, styles.content, { paddingTop: sticky ? spacing.lg : insets.top + spacing.lg }]}
        contentContainerStyle={
          scroll
            ? [
                styles.content,
                { paddingTop: sticky ? spacing.lg : insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxxl },
              ]
            : undefined
        }
        contentInsetAdjustmentBehavior={sticky ? 'never' : 'automatic'}
      >
        {back ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={backLabel ?? t('common.back')}
            style={({ pressed }) => [styles.back, { backgroundColor: colors.accentSoft, opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.accent} />
          </Pressable>
        ) : null}
        {(eyebrow || title) && (
          <View style={styles.header}>
            {eyebrow ? (
              <AppText variant="caption" color={colors.accent} style={styles.eyebrow}>
                {eyebrow.toUpperCase()}
              </AppText>
            ) : null}
            {title ? (
              <AppText variant="title" accessibilityRole="header">
                {title}
              </AppText>
            ) : null}
          </View>
        )}
        {children}
      </Container>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  glow: { position: 'absolute', top: 0, left: 0, right: 0 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  // Outside the scroll view, so it keeps its place while the content below moves.
  sticky: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  header: { gap: spacing.xs, marginBottom: spacing.sm },
  back: { width: TOUCH_TARGET, height: TOUCH_TARGET, borderRadius: TOUCH_TARGET / 2, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { letterSpacing: 1 },
});
