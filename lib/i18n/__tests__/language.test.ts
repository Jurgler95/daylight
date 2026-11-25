import { formatDayMonth, formatLong, formatMonthYear, formatNumeric, formatRange, formatWeekdayLong, formatWeekdayShort, type DateString } from '@/lib/dates';
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

  it('formats dates and numbers in Spanish, Portuguese, French and Italian', () => {
    applyLanguage('es');
    expect(formatLong(d('2026-03-14'))).toBe('Sábado, 14 de marzo');
    expect(formatRange(d('2026-03-14'), d('2026-03-17'))).toBe('14 al 17 mar');
    expect(formatNumeric(d('2025-12-29'))).toBe('29/12/2025');
    expect(formatDecimal(4.35)).toBe('4,4');
    expect(formatPercent(0.74)).toBe('74 %');
    expect(formatSteps(8412)).toBe('8.412');

    applyLanguage('pt');
    expect(formatLong(d('2026-03-14'))).toBe('Sábado, 14 de março');
    expect(formatPercent(0.74)).toBe('74%');
    expect(formatWeekdayShort(d('2026-03-14'))).toBe('Sáb');

    applyLanguage('fr');
    expect(formatLong(d('2026-03-14'))).toBe('Samedi 14 mars');
    expect(formatRange(d('2026-03-14'), d('2026-03-17'))).toBe('14 au 17 mars');
    expect(formatSteps(8412)).toBe('8\u00a0412');
    expect(formatPercent(0.74)).toBe('74\u00a0%');

    applyLanguage('it');
    expect(formatLong(d('2026-03-14'))).toBe('Sabato 14 marzo');
    expect(formatWeekdayLong(d('2026-03-01'))).toBe('domenica');
    expect(formatSteps(8412)).toBe('8.412');
  });

  it('formats dates and numbers in Dutch, Polish, Turkish and Indonesian', () => {
    applyLanguage('nl');
    expect(formatLong(d('2026-03-14'))).toBe('Zaterdag 14 maart');
    expect(formatNumeric(d('2025-12-29'))).toBe('29-12-2025');
    expect(formatPercent(0.74)).toBe('74%');

    applyLanguage('pl');
    expect(formatLong(d('2026-03-14'))).toBe('Sobota, 14 marca');
    expect(formatMonthYear(d('2026-03-14'))).toBe('Marzec 2026');
    expect(formatSteps(8412)).toBe('8\u00a0412');
    expect(formatDecimal(4.35)).toBe('4,4');

    applyLanguage('tr');
    expect(formatLong(d('2026-03-14'))).toBe('14 Mart Cumartesi');
    expect(formatRange(d('2026-03-14'), d('2026-03-17'))).toBe('14 ile 17 Mar arası');
    expect(formatPercent(0.74)).toBe('%74');
    expect(formatSteps(8412)).toBe('8.412');

    applyLanguage('id');
    expect(formatLong(d('2026-03-14'))).toBe('Sabtu, 14 Maret');
    expect(formatRange(d('2026-03-14'), d('2026-03-17'))).toBe('14 sampai 17 Mar');
    expect(formatPercent(0.74)).toBe('74%');
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
  it('picks the language of every regional variant and English otherwise', () => {
    for (const locale of ['de-DE', 'de-AT', 'de-CH', 'de_CH', 'de', 'de-LU', 'de-BE', 'DE-de']) {
      expect(languageForLocale(locale)).toBe('de');
    }
    expect(languageForLocale('es-MX')).toBe('es');
    expect(languageForLocale('es-419')).toBe('es');
    expect(languageForLocale('pt-BR')).toBe('pt');
    expect(languageForLocale('pt_PT')).toBe('pt');
    expect(languageForLocale('fr-CH')).toBe('fr');
    expect(languageForLocale('it-IT')).toBe('it');
    expect(languageForLocale('nl-BE')).toBe('nl');
    expect(languageForLocale('pl-PL')).toBe('pl');
    expect(languageForLocale('tr-TR')).toBe('tr');
    expect(languageForLocale('id-ID')).toBe('id');
    expect(languageForLocale('in-ID')).toBe('id');
    for (const locale of ['en-US', 'en-DE', 'sv-SE', 'ja', 'dev', '']) {
      expect(languageForLocale(locale)).toBe('en');
    }
  });
});
