import Svg, { Circle, G, Path } from 'react-native-svg';

import { HOURS, LOGO_CENTER, LOGO_COLORS, RING, SPIRAL, SUN } from './logoPaths';

/** Half the visible part of the adaptive icon grid: the round launcher icon ends here. */
const RADIUS = 36;

/** Ring, hour dots, spiral and sun of the logo in the 108 grid, in the given colours. */
export function LogoShapes({ mark, sun }: { mark: string; sun: string }) {
  return (
    <G>
      <Path d={RING.d} stroke={mark} strokeWidth={RING.width} strokeLinejoin="round" fill="none" />
      {HOURS.map((hour, i) => (
        <Circle key={i} cx={hour.cx} cy={hour.cy} r={hour.r} fill={mark} opacity={hour.opacity} />
      ))}
      <Path d={SPIRAL.d} stroke={mark} strokeWidth={SPIRAL.width} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={SUN.cx} cy={SUN.cy} r={SUN.r} fill={sun} />
    </G>
  );
}

/**
 * The app logo as the round launcher shows it: petrol disc, cream ring and spiral, amber sun.
 * Decorative next to the app name, so it is hidden from assistive technology.
 */
export function Logo({ size = 72 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`${LOGO_CENTER - RADIUS} ${LOGO_CENTER - RADIUS} ${RADIUS * 2} ${RADIUS * 2}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle cx={LOGO_CENTER} cy={LOGO_CENTER} r={RADIUS} fill={LOGO_COLORS.background} />
      <LogoShapes mark={LOGO_COLORS.mark} sun={LOGO_COLORS.sun} />
    </Svg>
  );
}
