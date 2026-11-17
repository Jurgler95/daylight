import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { DESIGN_KEYS } from '../designs';

// Plain CommonJS, as the config plugin loads it.
const { ALIAS_PREFIX, LAUNCHER_ALIASES, LOGO, aliasName } = require('../../../plugins/launcherAliases') as {
  ALIAS_PREFIX: string;
  LAUNCHER_ALIASES: string[];
  LOGO: string;
  aliasName: (key: string) => string;
};

const ROOT = path.join(__dirname, '../../..');
const KOTLIN = path.join(ROOT, 'modules/daylight-launcher/android/src/main/java/de/behla/daylight/launcher/LauncherIcons.kt');

/**
 * JS hands the key from here to the Kotlin module as it is (`useLauncherIcon.ts`), the plugin names
 * the aliases after it. All three must agree, or the icon silently never changes.
 */
describe('launcher aliases', () => {
  it('has an alias for the logo and for every design', () => {
    expect(LAUNCHER_ALIASES[0]).toBe(LOGO);
    for (const key of DESIGN_KEYS) expect(LAUNCHER_ALIASES).toContain(key);
    expect(new Set(LAUNCHER_ALIASES).size).toBe(LAUNCHER_ALIASES.length);
  });

  it('never loses an alias a device may have switched on', () => {
    // The aliases of the first release with seasonal icons. Add to this list, never take from it (plugins/launcherAliases.js).
    const shipped = ['logo', 'fruehling', 'sommer', 'herbst', 'winter', 'ostern', 'halloween', 'weihnachten', 'silvester', 'neujahrsfest'];
    for (const key of shipped) expect(LAUNCHER_ALIASES).toContain(key);
  });

  it('names each alias after its key exactly as the Kotlin module looks it up', () => {
    const kotlin = readFileSync(KOTLIN, 'utf8');
    expect(kotlin).toContain(`const val ALIAS_PREFIX = "${ALIAS_PREFIX}"`);
    expect(kotlin).toContain(`const val LOGO = "${LOGO}"`);
    for (const key of LAUNCHER_ALIASES) {
      // A valid last segment of a component name, and nothing the module would have to convert.
      expect(key).toMatch(/^[a-z]+$/);
      expect(aliasName(key)).toBe(`${ALIAS_PREFIX}${key}`);
    }
  });

  it('brings both icon layers for every alias but the logo', () => {
    for (const key of LAUNCHER_ALIASES.filter((key) => key !== LOGO)) {
      for (const layer of ['foreground', 'background']) {
        expect(existsSync(path.join(ROOT, `assets/launcher/${key}-${layer}.png`))).toBe(true);
      }
    }
  });
});
