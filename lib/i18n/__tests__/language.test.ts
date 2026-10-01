import { formatDayMonth, formatLong, formatNumeric, formatRange, formatWeekdayLong, type DateString } from '@/lib/dates';
import { formatSteps } from '@/lib/health/format';
import { formatDecimal, formatPercent, formatSigned } from '@/lib/insights/format';

import i18n, { applyLanguage } from '..';
import { languageForLocale } from '../language';

const d = (value: string) => value as DateString;

describe('language switch', () => {
  afterEach(() => applyLanguage('de'));

  it('switches texts, dates and numbers together', () => {
    applyLanguage('en');
    expect(i18n.t('tabs.today')).toBe('Today');
    expect(i18n.t('history.count', { count: 2 })).toBe('2 entries');
    expect(formatLong(d('2026-03-14'))).toBe('Saturday, March 14');
    expect(formatRange(d('2026-03-14'), d('2026-03-17'))).toBe('Mar 14 to 17');
    expect(formatRange(d('2026-03-30'), d('2026-04-02'))).toBe('Mar 30 to Apr 2');
    expect(formatNumeric(d('2025-12-29'))).toBe('Dec 29, 2025');
    expect(formatDecimal(4.35)).toBe('4.4');
    expect(formatSigned(-0.04)).toBe('0.0');
    expect(formatPercent(0.74)).toBe('74%');
    expect(formatSteps(8412)).toBe('8,412');

    applyLanguage('de');
    expect(i18n.t('tabs.today')).toBe('Heute');
    expect(formatRange(d('2026-03-14'), d('2026-03-17'))).toBe('14. bis 17. März');
    expect(formatDecimal(4.35)).toBe('4,4');
    expect(formatPercent(0.74)).toBe('74 %');
    expect(formatSteps(8412)).toBe('8.412');
  });

  it('writes the Daylio CSV columns like Daylio in that language', () => {
    applyLanguage('en');
    expect(formatDayMonth(d('2026-03-01'))).toBe('March 1');
    expect(formatWeekdayLong(d('2026-03-01'))).toBe('Sunday');
    applyLanguage('de');
    expect(formatDayMonth(d('2026-03-01'))).toBe('1. März');
  });
});

describe('languageForLocale', () => {
  it('picks German for every German locale and English otherwise', () => {
    for (const locale of ['de-DE', 'de-AT', 'de-CH', 'de_CH', 'de', 'de-LU', 'de-BE', 'DE-de']) {
      expect(languageForLocale(locale)).toBe('de');
    }
    for (const locale of ['en-US', 'en-DE', 'fr-CH', 'it-IT', 'dev', '']) {
      expect(languageForLocale(locale)).toBe('en');
    }
  });
});
