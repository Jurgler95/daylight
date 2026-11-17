import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { SvgAst, parse, type JsxAST } from 'react-native-svg';

import type { DesignKey } from '@/lib/seasons/designs';
import { appearanceOf } from '@/lib/seasons/appearance';
import { useDesign } from '@/lib/seasons/useDesign';
import { useTheme } from '@/lib/theme';

import { LogoShapes } from './Logo';
import { LOGO_GRID } from './logoPaths';

const VIEW_BOX = `0 0 ${LOGO_GRID} ${LOGO_GRID}`;
/**
 * The design preview Paul chose from sized the backdrop for its phone frame (232 wide) on a screen
 * 220 wide, so a seasonal backdrop is this much larger than the plain one, as it was there.
 */
const DESIGN_SCALE = 232 / 220;

/**
 * Parsed once per design and kept: every screen draws the same backdrop, and the markup of the
 * firework alone is some 24 KB.
 */
const parsed = new Map<string, JsxAST | null>();
function ast(id: string, markup: () => string): JsxAST | null {
  if (!parsed.has(id)) parsed.set(id, parse(markup()));
  return parsed.get(id) ?? null;
}

const backdropAst = (key: DesignKey) => ast(`${key}:backdrop`, () => `<svg viewBox="${VIEW_BOX}">${appearanceOf(key).backdrop}</svg>`);
const scatterAst = (key: DesignKey, i: number) =>
  ast(`${key}:scatter:${i}`, () => `<svg viewBox="-11 -11 22 22">${appearanceOf(key).scatter[i]?.markup ?? ''}</svg>`);

/**
 * The logo's wavy ring, spiral and sun in faded petrol and amber, oversized and cut off in the lower
 * right corner behind the content of a screen (from Zyklus' feather backdrop). While a seasonal
 * design is on (`lib/seasons`), its motifs and colours in the same pale tones. Purely decorative:
 * absolutely positioned, never interactive, hidden from assistive technology.
 */
export function LogoBackdrop() {
  const { colors } = useTheme();
  const design = useDesign();
  const { width } = useWindowDimensions();
  const scale = design ? DESIGN_SCALE : 1;
  const size = Math.max(width * 1.7 * scale, 560);
  // The logo's centre sits at 78 % of the width (a little left of that for a design) and 0.3 × size above the bottom edge.
  const place = { position: 'absolute', right: width * 0.22 * scale - size / 2, bottom: -size * 0.2 } as const;

  return (
    <View pointerEvents="none" style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {design ? (
        <SvgAst ast={backdropAst(design)} override={{ width: size, height: size, style: place }} />
      ) : (
        <Svg width={size} height={size} viewBox={VIEW_BOX} style={place}>
          <LogoShapes mark={colors.decorMark} sun={colors.decorSun} />
        </Svg>
      )}
    </View>
  );
}

/**
 * A few of the design's motifs strewn over the top of a screen, in the backdrop's pale tones, above
 * the backdrop as in the design preview. In `Screen`, next to the glow; nothing without a seasonal
 * design. Decorative like the backdrop.
 */
export function SeasonScatter() {
  const design = useDesign();
  const { width, height } = useWindowDimensions();
  const spots = design ? appearanceOf(design).scatter : [];
  if (!design || !spots.length) return null;

  return (
    <View pointerEvents="none" style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {spots.map((spot, i) => {
        const edge = spot.size * width;
        return (
          <SvgAst
            key={i}
            ast={scatterAst(design, i)}
            override={{ width: edge, height: edge, style: { position: 'absolute', left: spot.x * width - edge / 2, top: spot.y * height - edge / 2 } }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
});
