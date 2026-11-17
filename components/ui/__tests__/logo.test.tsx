import { act, render, screen } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createTestDb } from '@/db/testDb';
import type { Database } from '@/db/types';
import { DesignProvider } from '@/lib/seasons/useDesign';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { colors } from '@/lib/theme';

import { LogoBackdrop, SeasonScatter } from '../LogoBackdrop';
import { HOURS, LOGO_COLORS, RING, SPIRAL, SUN } from '../logoPaths';

let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));
// Halloween: the pumpkins are strewn over the top.
jest.mock('@/lib/dates/useToday', () => ({ useToday: () => '2026-10-31' }));

beforeEach(() => {
  mockDb = createTestDb();
  useSettingsStore.getState().load();
});

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
  it.each([
    ['backdrop', LogoBackdrop],
    ['strewn motifs', SeasonScatter],
  ])('%s stays out of the way of touch and the screen reader', async (_, Decoration) => {
    await render(
      <DesignProvider>
        <Decoration />
      </DesignProvider>,
    );
    const wrap = screen.toJSON();
    if (!wrap || Array.isArray(wrap)) throw new Error('expected a single root view');
    expect(wrap.props.pointerEvents).toBe('none');
    expect(wrap.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(wrap.props.accessibilityElementsHidden).toBe(true);
  });

  it('wears the design of the day, and the plain logo once the designs are off', async () => {
    // react-native-svg hands colours on as ARGB numbers.
    const decorMark = String((0xff000000 | parseInt(colors.decorMark.slice(1), 16)) >>> 0);
    await render(
      <DesignProvider>
        <LogoBackdrop />
      </DesignProvider>,
    );
    // The pumpkin in place of the sun is drawn from ellipses.
    expect(JSON.stringify(screen.toJSON())).toContain('RNSVGEllipse');
    expect(JSON.stringify(screen.toJSON())).not.toContain(decorMark);
    await act(async () => useSettingsStore.getState().update({ design_seasons: false }));
    expect(JSON.stringify(screen.toJSON())).not.toContain('RNSVGEllipse');
    expect(JSON.stringify(screen.toJSON())).toContain(decorMark);
  });

  it('strews nothing over the top without a design', async () => {
    useSettingsStore.getState().update({ design_seasons: false });
    await render(
      <DesignProvider>
        <SeasonScatter />
      </DesignProvider>,
    );
    expect(screen.toJSON()).toBeNull();
  });
});
