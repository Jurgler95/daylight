import { render, screen } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { LogoBackdrop } from '../LogoBackdrop';
import { HOURS, LOGO_COLORS, RING, SPIRAL, SUN } from '../logoPaths';

/**
 * The backdrop and the logo in the app draw from `logoPaths.ts`, the icons from `assets/logo.svg`.
 * If the two drift apart, `node scripts/logo.mjs` was not run after the source changed.
 */
describe('logo geometry', () => {
  const svg = readFileSync(path.join(__dirname, '../../../assets/logo.svg'), 'utf8');

  it('matches assets/logo.svg', () => {
    expect(svg).toContain(`d="${RING.d}"`);
    expect(svg).toContain(`d="${SPIRAL.d}"`);
    expect(svg).toContain(`fill="${LOGO_COLORS.background}"`);
    expect(svg).toContain(`stroke="${LOGO_COLORS.mark}"`);
    expect(svg).toMatch(new RegExp(`id="sun" cx="${SUN.cx.toFixed(2)}" cy="${SUN.cy.toFixed(2)}" r="${SUN.r}" fill="${LOGO_COLORS.sun}"`));
    const hours = [...svg.matchAll(/class="hour" cx="([\d.]+)" cy="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(hours).toEqual(HOURS.map((hour) => [hour.cx, hour.cy]));
  });
});

describe('LogoBackdrop', () => {
  it('stays out of the way of touch and the screen reader', async () => {
    await render(<LogoBackdrop />);
    const wrap = screen.toJSON();
    if (!wrap || Array.isArray(wrap)) throw new Error('expected a single root view');
    expect(wrap.props.pointerEvents).toBe('none');
    expect(wrap.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(wrap.props.accessibilityElementsHidden).toBe(true);
  });
});
