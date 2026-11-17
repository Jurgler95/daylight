import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { HOURS, RING, SPIRAL, SUN } from '@/components/ui/logoPaths';

import { DESIGN_KEYS, DESIGNS, compose } from '../designs';

const ROOT = path.join(__dirname, '../../..');
const LOGO = { ring: RING, hours: HOURS, spiral: SPIRAL, sun: SUN };

/**
 * The store icons are generated files. If one drifts from `designs.ts`, `node scripts/logo.mjs`
 * was not run after a design changed. The launcher layers are only checked for being there
 * (`launcher.test.ts`); comparing their pixels would mean rendering them again.
 */
describe('generated design files', () => {
  it.each(DESIGN_KEYS)('store/icon-%s.svg matches the design', (key) => {
    const svg = readFileSync(path.join(ROOT, `store/icon-${key}.svg`), 'utf8');
    expect(svg).toContain(compose(DESIGNS[key], LOGO));
  });

  it('names a design or the logo in store/season.js', () => {
    const source = readFileSync(path.join(ROOT, 'store/season.js'), 'utf8');
    const value = source.match(/^window\.SEASON = (?:'([a-z]+)'|null);$/m);
    expect(value).not.toBeNull();
    if (value?.[1]) {
      expect(DESIGN_KEYS).toContain(value[1]);
      expect(existsSync(path.join(ROOT, `store/icon-${value[1]}.svg`))).toBe(true);
    }
  });
});
