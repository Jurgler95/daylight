import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg from 'react-native-svg';

import { useTheme } from '@/lib/theme';

import { LogoShapes } from './Logo';
import { LOGO_GRID } from './logoPaths';

/**
 * The logo's wavy ring, spiral and sun in faded petrol and amber, oversized and cut off in the lower
 * right corner behind the content of a screen (from Zyklus' feather backdrop). Purely decorative:
 * absolutely positioned, never interactive, hidden from assistive technology.
 */
export function LogoBackdrop() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const size = Math.max(width * 1.7, 560);

  return (
    <View pointerEvents="none" style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* The logo's centre sits at 78 % of the width and 0.3 × size above the bottom edge. */}
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${LOGO_GRID} ${LOGO_GRID}`}
        style={{ position: 'absolute', right: width * 0.22 - size / 2, bottom: -size * 0.2 }}
      >
        <LogoShapes mark={colors.decorMark} sun={colors.decorSun} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
});
