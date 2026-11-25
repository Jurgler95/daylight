import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';

import { useStarColor } from '@/components/achievements/StarRow';
import { AppText, Button, Card } from '@/components/ui';
import { TOUCH_TARGET, medalGradient, spacing } from '@/lib/theme';

interface Props {
  onRate: () => void;
  onDismiss: () => void;
}

const SPARKS = 6;

/**
 * Asks once for a rating in the Play Store, right after a save once entries were written on seven
 * days (`lib/review/prompt.ts`). No question first and nothing promised in return. "Bewerten" opens
 * the store page, "Nicht jetzt" closes; either answer puts the card away for good.
 */
export function ReviewCard({ onRate, onDismiss }: Props) {
  const { t } = useTranslation();
  return (
    <Card tone="muted" style={styles.card}>
      <View style={styles.head}>
        <Medal />
        <View style={styles.text}>
          <AppText variant="headline" accessibilityRole="header">
            {t('review.title')}
          </AppText>
          <AppText>{t('review.body')}</AppText>
        </View>
      </View>
      <View style={styles.actions}>
        <Button label={t('review.rate')} accessibilityHint={t('review.rateHint')} style={styles.button} onPress={onRate} />
        <Button label={t('review.later')} variant="ghost" style={styles.button} onPress={onDismiss} />
      </View>
    </Card>
  );
}

/** A star on the gold medal of the star message: it pops in, sways once and throws a few sparks. */
function Medal() {
  const pop = useSharedValue(0.6);
  const tilt = useSharedValue(0);
  const burst = useSharedValue(0);
  useEffect(() => {
    pop.value = withSpring(1, { damping: 9, stiffness: 180 });
    tilt.value = withDelay(180, withSequence(withTiming(-10, { duration: 90 }), withTiming(6, { duration: 100 }), withTiming(0, { duration: 120 })));
    burst.value = withDelay(200, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [pop, tilt, burst]);
  const medal = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }, { rotate: `${tilt.value}deg` }] }));
  return (
    <View style={styles.medalBox} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {Array.from({ length: SPARKS }, (_, index) => (
        <Spark key={index} angle={(index / SPARKS) * Math.PI * 2 - Math.PI / 2} burst={burst} />
      ))}
      <Animated.View style={[styles.glow, medal]}>
        <LinearGradient colors={medalGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.medal}>
          <MaterialCommunityIcons name="star" size={21} color="#FFFFFF" />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

function Spark({ angle, burst }: { angle: number; burst: SharedValue<number> }) {
  const starColor = useStarColor();
  const style = useAnimatedStyle(() => {
    const distance = 15 + burst.value * 8;
    return {
      opacity: burst.value === 0 ? 0 : (1 - burst.value) * 0.9,
      transform: [{ translateX: Math.cos(angle) * distance }, { translateY: Math.sin(angle) * distance }, { scale: 1 - burst.value * 0.4 }],
    };
  });
  return (
    <Animated.View style={[styles.spark, style]}>
      <MaterialCommunityIcons name="star-four-points" size={8} color={starColor} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Tighter than a plain card: one line of buttons under a short text.
  card: { paddingVertical: spacing.lg, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: 2 },
  medalBox: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  glow: { borderRadius: 18, elevation: 4, shadowColor: '#E09B00', shadowOpacity: 0.45, shadowRadius: 7, shadowOffset: { width: 0, height: 3 } },
  medal: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  button: { minHeight: TOUCH_TARGET },
});
