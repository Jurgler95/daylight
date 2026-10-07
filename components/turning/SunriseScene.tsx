import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Extrapolation, interpolate, useAnimatedProps, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Line, RadialGradient, Rect, Stop } from 'react-native-svg';

import { daysBetween, type DateString } from '@/lib/dates';
import type { InsightDay } from '@/lib/insights';
import { moodColors } from '@/lib/theme';

import { DAWN } from './dawn';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedLine = Animated.createAnimatedComponent(Line);

interface Props {
  /** The diary around the day, oldest first; only `SIDE_DAYS` on each side are drawn. */
  days: readonly InsightDay[];
  date: DateString;
  /** 0 while waiting, 1 once the hold is complete. */
  progress: SharedValue<number>;
  /** 0 until the turning point is set, then runs to 1 once: the burst around the risen sun. */
  burst: SharedValue<number>;
  /** Skips the opening, e.g. when an existing turning point is edited and the sun is already up. */
  risen?: boolean;
}

const HEIGHT = 230;
const HORIZON = 170;
const SUN = 34;
const SUN_DOWN = HORIZON + SUN * 0.55;
const SUN_UP = HORIZON - SUN - 30;
/** How far below its waiting place the sun starts while the scene opens. */
const SUN_DEEP = SUN * 0.9;
const RAYS = 14;
const SPARKS = 10;
/** Days drawn on each side of the turning point. */
export const SIDE_DAYS = 60;
/** The opening: horizon, then the days, then the sun peeking up. */
export const INTRO_MS = 1700;

const clamp = Extrapolation.CLAMP;

/**
 * The day as a horizon: the days before it as a ridge of mood dots on the left, the days after it
 * on the right, faint until the turning point is set, and a sun waiting below the line at the day
 * itself. On opening, the horizon draws out from the day, the days appear and the sun peeks up.
 * Holding the button raises the sun and lights up the side after; once set, the sun pulses and
 * throws out a ring, rays and sparks. Decorative; the screen says everything in words.
 */
export function SunriseScene({ days, date, progress, burst, risen }: Props) {
  const [width, setWidth] = useState(0);
  const intro = useSharedValue(risen ? 1 : 0);
  useEffect(() => {
    if (width > 0 && !risen) intro.value = withDelay(250, withTiming(1, { duration: INTRO_MS, easing: Easing.out(Easing.cubic) }));
  }, [width, risen, intro]);

  const center = width / 2;
  const step = width > 0 ? (center - 16) / SIDE_DAYS : 0;
  const y = (mean: number) => HORIZON - 14 - ((mean - 1) / 4) * 70;

  const near = days.filter((day) => Math.abs(daysBetween(date, day.date)) <= SIDE_DAYS && day.date !== date);
  const before = near.filter((day) => day.date < date);
  const after = near.filter((day) => day.date > date);
  const dot = (day: InsightDay) => (
    <Circle key={day.date} cx={center + daysBetween(date, day.date) * step} cy={y(day.mean)} r={2.6} fill={moodColors[day.level].soft} />
  );

  // The helpers take plain numbers: Reanimated re-runs an animated prop only for shared values the
  // prop itself reads, not ones read inside a helper it calls.
  const sunY = (rise: number, opening: number) => {
    'worklet';
    return interpolate(rise, [0, 1], [SUN_DOWN, SUN_UP]) + interpolate(opening, [0.55, 1], [SUN_DEEP, 0], clamp);
  };
  const pulse = (t: number) => {
    'worklet';
    return Math.sin(Math.PI * t);
  };

  const sunProps = useAnimatedProps(() => ({ cy: sunY(progress.value, intro.value), r: SUN * (1 + 0.22 * pulse(burst.value)) }));
  const coreProps = useAnimatedProps(() => ({ cy: sunY(progress.value, intro.value) - SUN * 0.12, r: SUN * 0.62 * (1 + 0.3 * pulse(burst.value)) }));
  const glowProps = useAnimatedProps(() => ({
    cy: sunY(progress.value, intro.value),
    r: interpolate(progress.value, [0, 1], [SUN * 1.6, SUN * 3.2]) * (1 + 0.5 * pulse(burst.value)),
    opacity: interpolate(intro.value, [0.5, 1], [0, 1], clamp),
  }));
  const ringProps = useAnimatedProps(() => ({
    r: SUN + burst.value * SUN * 3.6,
    strokeWidth: 7 * (1 - burst.value),
    opacity: burst.value > 0 ? 1 - burst.value : 0,
  }));
  const horizonProps = useAnimatedProps(() => {
    const reach = interpolate(intro.value, [0, 0.45], [0, center], clamp);
    return { x1: center - reach, x2: center + reach };
  });
  const beforeProps = useAnimatedProps(() => ({
    opacity: interpolate(intro.value, [0.3, 0.7], [0, 1], clamp) * interpolate(progress.value, [0, 1], [0.9, 0.55]),
  }));
  const afterProps = useAnimatedProps(() => ({
    opacity: interpolate(intro.value, [0.45, 0.85], [0, 1], clamp) * interpolate(progress.value, [0, 1], [0.22, 1]),
  }));
  const tickProps = useAnimatedProps(() => ({ opacity: interpolate(intro.value, [0.1, 0.3], [0, 1], clamp) }));

  return (
    <View style={styles.scene} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <ClipPath id="sky">
              <Rect x={0} y={0} width={width} height={HORIZON} />
            </ClipPath>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={DAWN.sun} stopOpacity={0.55} />
              <Stop offset="1" stopColor={DAWN.sun} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <G clipPath="url(#sky)">
            <AnimatedCircle cx={center} cy={SUN_DOWN} r={SUN * 1.6} fill="url(#glow)" animatedProps={glowProps} />
            {Array.from({ length: RAYS }, (_, i) => (
              <Ray key={i} index={i} cx={center} burst={burst} />
            ))}
            <AnimatedCircle cx={center} cy={SUN_UP} r={SUN} fill="none" stroke="#FFF6D6" strokeWidth={0} opacity={0} animatedProps={ringProps} />
            {/* Solid layers, not a gradient: Android moves a gradient fill only on a React render, not with the animation. */}
            <AnimatedCircle cx={center} cy={SUN_DOWN} r={SUN} fill={DAWN.sun} animatedProps={sunProps} />
            <AnimatedCircle cx={center} cy={SUN_DOWN} r={SUN * 0.62} fill="#FFF6D6" opacity={0.55} animatedProps={coreProps} />
            {Array.from({ length: SPARKS }, (_, i) => (
              <Spark key={i} index={i} cx={center} burst={burst} />
            ))}
          </G>
          <AnimatedG animatedProps={beforeProps}>{before.map(dot)}</AnimatedG>
          <AnimatedG animatedProps={afterProps}>{after.map(dot)}</AnimatedG>
          <AnimatedLine x1={center} x2={center} y1={HORIZON} y2={HORIZON} stroke={DAWN.horizon} strokeWidth={1.5} animatedProps={horizonProps} />
          <AnimatedLine x1={center} x2={center} y1={HORIZON - 4} y2={HORIZON + 10} stroke={DAWN.sun} strokeWidth={2} strokeLinecap="round" animatedProps={tickProps} />
        </Svg>
      ) : null}
    </View>
  );
}

/** One ray of the burst: shoots out from the sun's edge, turning a little as it goes, and fades. */
function Ray({ index, cx, burst }: { index: number; cx: number; burst: SharedValue<number> }) {
  const props = useAnimatedProps(() => {
    const t = burst.value;
    const angle = (index / RAYS) * 2 * Math.PI + t * 0.5;
    const inner = SUN + 8 + t * 34;
    const outer = inner + 34 * Math.sin(Math.PI * t) * (index % 2 === 0 ? 1 : 0.6);
    return {
      x1: cx + Math.cos(angle) * inner,
      y1: SUN_UP + Math.sin(angle) * inner,
      x2: cx + Math.cos(angle) * outer,
      y2: SUN_UP + Math.sin(angle) * outer,
      opacity: t > 0 ? Math.sin(Math.PI * t) : 0,
    };
  });
  return <AnimatedLine x1={cx} y1={SUN_UP} x2={cx} y2={SUN_UP} opacity={0} stroke={DAWN.sun} strokeWidth={index % 2 === 0 ? 3.5 : 2} strokeLinecap="round" animatedProps={props} />;
}

/** A spark flung further than the rays, shrinking as it flies. */
function Spark({ index, cx, burst }: { index: number; cx: number; burst: SharedValue<number> }) {
  const props = useAnimatedProps(() => {
    const t = burst.value;
    const angle = ((index + 0.5) / SPARKS) * 2 * Math.PI - 0.2;
    const distance = SUN + 10 + t * (70 + (index % 3) * 18);
    return {
      cx: cx + Math.cos(angle) * distance,
      cy: SUN_UP + Math.sin(angle) * distance,
      r: 3.2 * (1 - t),
      opacity: t > 0 ? 1 - t * t : 0,
    };
  });
  return <AnimatedCircle cx={cx} cy={SUN_UP} r={0} opacity={0} fill="#FFF6D6" animatedProps={props} />;
}

const styles = StyleSheet.create({
  scene: { height: HEIGHT },
});
