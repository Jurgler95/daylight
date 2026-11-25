/**
 * Hermes on Android has no `Intl.PluralRules`. Without the polyfill i18next knows only "one" and
 * "other", which breaks Polish ("5 wpisu"). This removes it the way the phone lacks it.
 */
describe('plural rules without Intl.PluralRules', () => {
  // Hermes 0.86 has Collator, DateTimeFormat and NumberFormat, but none of these.
  const missing = ['PluralRules', 'Locale', 'ListFormat', 'RelativeTimeFormat', 'Segmenter', 'DisplayNames'] as const;
  const original = Object.fromEntries(missing.map((name) => [name, (Intl as Record<string, unknown>)[name]]));

  afterEach(() => {
    for (const name of missing) Object.defineProperty(Intl, name, { value: original[name], configurable: true, writable: true });
  });

  it('picks the Polish and French forms through the polyfill', () => {
    for (const name of missing) delete (Intl as Record<string, unknown>)[name];
    jest.isolateModules(() => {
      const i18n = require('../index').default as typeof import('i18next').default;
      const pl = i18n.getFixedT('pl');
      expect(pl('import.entries', { count: 1 })).toBe('1 wpis');
      expect(pl('import.entries', { count: 2 })).toBe('2 wpisy');
      expect(pl('import.entries', { count: 5 })).toBe('5 wpisów');
      expect(pl('import.entries', { count: 22 })).toBe('22 wpisy');
      expect(new Intl.PluralRules('fr').select(0)).toBe('one');
    });
  });
});
