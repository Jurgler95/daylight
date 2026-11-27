import i18n from '@/lib/i18n';
import { listActivities, listGroups, listMoods, listScales } from '@/db/repositories';
import { listEntryDetails } from '@/db/repositories/entries';
import type { Activity, ActivityGroup, Mood, Scale } from '@/db/schema';
import { createTestDb } from '@/db/testDb';
import { buildCatalog, type Catalog } from '@/lib/catalog/catalog';
import { addDaysToDateString, type DateString } from '@/lib/dates';
import { generateSample } from '@/lib/dev/generateSample';
import { applySample } from '@/lib/dev/sample';
import { setCurrentLanguage, LANGUAGES } from '@/lib/i18n/language';

import { renderReportHtml, type Translate } from '../html';
import { buildReport, defaultReportOptions, reportWindow, type ReportEntry, type ReportOptions, type ReportSource } from '../model';

const today = '2026-11-26' as DateString;
const stamp = { created_at: '', updated_at: '' };

function catalog(): Catalog {
  const moods = ([5, 4, 3, 2, 1] as const).map((level, index): Mood => ({ id: index + 1, label: ['Super', 'Gut', 'Ok', 'Schlecht', 'Lausig'][index]!, level, icon: 'x', sort_order: index, archived: false, ...stamp }) as Mood);
  const groups: ActivityGroup[] = [
    { id: 1, name: 'Gefühle', sort_order: 0, archived: false, ...stamp } as ActivityGroup,
    { id: 2, name: 'Arbeit', sort_order: 1, archived: false, ...stamp } as ActivityGroup,
  ];
  const activities: Activity[] = [
    { id: 10, group_id: 1, name: 'Gestresst', icon: 'x', sort_order: 0, archived: false, ...stamp } as Activity,
    { id: 11, group_id: 1, name: 'Entspannt <b>', icon: 'x', sort_order: 1, archived: false, ...stamp } as Activity,
    { id: 20, group_id: 2, name: 'Arbeit', icon: 'x', sort_order: 0, archived: false, ...stamp } as Activity,
  ];
  const scales: Scale[] = [{ id: 3, name: 'Stress', min: 1, max: 5, kind: 'rating', unit: '', decimals: 0, sort_order: 0, archived: false, ...stamp } as Scale];
  return buildCatalog({ moods, groups, activities, scales });
}

function entry(date: string, time: string, level: number, activity_ids: number[], extra: Partial<ReportEntry> = {}): ReportEntry {
  return { date, time, level, activity_ids, note: null, note_title: null, scales: [], ...extra };
}

/** Ten days: work on every day, stress on four, two entries on the 20th, a note on the 21st. */
function source(): ReportSource {
  const entries: ReportEntry[] = [];
  for (let i = 0; i < 10; i++) {
    const date = addDaysToDateString('2026-11-17' as DateString, i);
    if (date === '2026-11-19') continue;
    const stressed = i % 3 === 0;
    entries.push(entry(date, '20:00', stressed ? 2 : 4, stressed ? [10, 20] : [11, 20], { scales: [{ scale_id: 3, value: stressed ? 5 : 2 }] }));
  }
  entries.push(entry('2026-11-20', '08:00', 5, [11]));
  entries.find((e) => e.date === '2026-11-21')!.note = 'Mit <Lena> gesprochen';
  return {
    entries,
    health: [
      { date: '2026-11-18', sleep_minutes: 420 },
      { date: '2026-11-20', sleep_minutes: 300 },
    ],
    turningPoints: [
      { date: '2026-11-21', title: 'Neue Stelle' },
      { date: '2025-01-01', title: 'Zu früh' },
    ],
    catalog: catalog(),
    today,
  };
}

function options(patch: Partial<ReportOptions> = {}): ReportOptions {
  return { ...defaultReportOptions(source()), ...patch };
}

const de: Translate = (key, values) => i18n.t(key, { ...values, lng: 'de' }) as string;

describe('reportWindow', () => {
  it('ends today and starts no earlier than the first entry', () => {
    expect(reportWindow('28', today, null)).toEqual({ from: '2026-10-30', to: today });
    expect(reportWindow('90', today, '2026-11-17' as DateString)).toEqual({ from: '2026-11-17', to: today });
  });
});

describe('defaultReportOptions', () => {
  it('leaves out activities on nearly every day and chooses every scale and group', () => {
    const chosen = defaultReportOptions(source());
    expect(chosen.chartActivityIds).toEqual([11, 10]);
    expect(chosen.scaleIds).toEqual([3]);
    expect(chosen.tableGroupIds).toEqual([1, 2]);
    expect(chosen.notes).toBe(false);
  });
});

describe('buildReport', () => {
  const report = buildReport(source(), options());

  it('keeps every day of the period, empty ones included', () => {
    expect(report.from).toBe('2026-11-17');
    expect(report.length).toBe(10);
    expect(report.days.find((day) => day.date === '2026-11-19')?.levels).toEqual([]);
    expect(report.daysWithEntry).toBe(9);
    expect(report.entryCount).toBe(10);
  });

  it('orders the entries of a day by time and averages them', () => {
    const day = report.days.find((d) => d.date === '2026-11-20')!;
    expect(day.levels).toEqual([5, 2]);
    expect(day.mean).toBe(3.5);
  });

  it('counts hard days on the rounded level', () => {
    // Stress on the 17th, 23rd and 26th; the 20th rounds to 4 with its second entry.
    expect(report.hardDays).toBe(3);
  });

  it('averages measured sleep and needs five nights for a month', () => {
    expect(report.sleep).toEqual({ mean: 360, days: 2 });
    expect(report.months).toHaveLength(1);
    expect(report.months[0]!.sleep).toBeNull();
    expect(report.months[0]!.scales[0]).not.toBeNull();
  });

  it('compares activities with and without, and drops rare ones', () => {
    const feelings = report.activityTable!.find((group) => group.name === 'Gefühle')!;
    expect(feelings.rows.map((row) => row.id)).toEqual([11, 10]);
    const work = report.activityTable!.find((group) => group.name === 'Arbeit')!.rows[0]!;
    expect(work.withoutMean).toBeNull();
  });

  it('keeps only turning points inside the period', () => {
    expect(report.turningPoints).toEqual([{ date: '2026-11-21', title: 'Neue Stelle' }]);
  });

  it('leaves notes out unless asked', () => {
    expect(report.days.every((day) => day.notes.length === 0)).toBe(true);
    expect(report.daysWithNote).toBe(1);
    const withNotes = buildReport(source(), options({ notes: true }));
    expect(withNotes.days.find((day) => day.date === '2026-11-21')?.notes).toEqual(['Mit <Lena> gesprochen']);
  });

  it('drops sleep, scales and the table when they are switched off', () => {
    const bare = buildReport(source(), options({ sleep: false, scaleIds: [], tableGroupIds: [], chartActivityIds: [] }));
    expect(bare.sleep).toBeNull();
    expect(bare.scales).toEqual([]);
    expect(bare.activityTable).toBeNull();
  });
});

describe('renderReportHtml', () => {
  const name = (id: number) => source().catalog.activityById.get(id)?.name ?? '';

  it('escapes everything the user wrote', () => {
    const html = renderReportHtml(buildReport(source(), options({ notes: true, name: '<script>x</script>', talkingPoints: 'a & b' })), de, name, 'de');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<Lena>');
    expect(html).toContain('&lt;Lena&gt;');
    expect(html).toContain('a &amp; b');
    expect(html).toContain('Entspannt &lt;b&gt;');
  });

  it('prints no note text unless notes are on', () => {
    const html = renderReportHtml(buildReport(source(), options()), de, name, 'de');
    expect(html).not.toContain('Lena');
    expect(html).toContain('Notizen nicht aufgenommen (Tage mit Notiz: 1).');
  });

  it('has no script, no external resource and no NaN', () => {
    const html = renderReportHtml(buildReport(source(), options({ notes: true })), de, name, 'de');
    expect(html).not.toMatch(/<script|https?:\/\/(?!www\.w3\.org\/2000\/svg)|NaN|undefined|Infinity|\{\{/);
  });
});

describe('a number scale in the report', () => {
  /** The ten days with a weight each, two weighings on the 20th, and a unit that needs escaping. */
  function weighed(): ReportSource {
    const base = source();
    const weight = { id: 4, name: 'Gewicht', min: 0, max: 0, kind: 'number', unit: '<kg>', decimals: 1, sort_order: 1, archived: false, ...stamp } as Scale;
    const scales = [...base.catalog.scales, weight];
    const catalog = buildCatalog({ moods: [...base.catalog.moods], groups: [...base.catalog.groups], activities: [...base.catalog.activities], scales });
    const entries = base.entries.map((e, i) => ({ ...e, scales: [...(e.scales ?? []), { scale_id: 4, value: 72 + i * 0.3 }] }));
    return { ...base, catalog, entries };
  }

  it('prints values with unit and decimals, escaped, and no NaN on the chart', () => {
    const src = weighed();
    const report = buildReport(src, { ...defaultReportOptions(src), scaleIds: [4] });
    expect(report.scales[0]).toMatchObject({ kind: 'number', unit: '<kg>', decimals: 1 });
    const html = renderReportHtml(report, de, (id) => src.catalog.activityById.get(id)?.name ?? '', 'de');
    expect(html).toContain('72,0 &lt;kg&gt;');
    expect(html).not.toContain('<kg>');
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
  });
});

describe('the report against a sample year', () => {
  const db = createTestDb();
  applySample(db, generateSample({ today }));
  const sample: ReportSource = {
    entries: listEntryDetails(db),
    health: [],
    turningPoints: [],
    catalog: buildCatalog({
      moods: listMoods(db, { includeArchived: true }),
      groups: listGroups(db),
      activities: listActivities(db, { includeArchived: true }),
      scales: listScales(db, { includeArchived: true }),
    }),
    today,
  };
  afterAll(() => setCurrentLanguage('de'));

  it.each(['28', '90', '182', '365'] as const)('renders %s days in every language without a missing text', (period) => {
    for (const language of LANGUAGES) {
      setCurrentLanguage(language);
      const t: Translate = (key, values) => i18n.t(key, { ...values, lng: language }) as string;
      const chosen = { ...defaultReportOptions(sample), period, notes: true };
      const html = renderReportHtml(buildReport(sample, chosen), t, (id) => sample.catalog.activityById.get(id)?.name ?? '', language);
      expect([language, html.match(/report\.\w+/)?.[0] ?? null]).toEqual([language, null]);
      expect([language, /NaN|undefined|Infinity|\{\{/.test(html)]).toEqual([language, false]);
    }
  });
});
