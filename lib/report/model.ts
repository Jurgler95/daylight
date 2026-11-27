import type { MoodLevel } from '@/db/schema';
import { activityLabel, levelMood, type Catalog } from '@/lib/catalog/catalog';
import { addDaysToDateString, type DateString } from '@/lib/dates';
import { buildDays, type EntryFacts, type InsightDay } from '@/lib/insights/days';
import { scaleDayValue, type ScaleFacts } from '@/lib/insights/scales';
import { mean } from '@/lib/insights/stats';

/**
 * The report for a doctor or therapist: what the diary says about a period, as numbers and a
 * chart, never as a judgement. Pure, so the PDF and the tests see the same figures. Like the
 * insights it counts in days: a day is the mean of its entries and the union of their activities.
 */

/** Days counted back from today, today included. */
export const REPORT_PERIODS = ['28', '90', '182', '365'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];
export const DEFAULT_PERIOD: ReportPeriod = '90';

/** More rows of activity strips make the first page spill over. */
export const MAX_CHART_ACTIVITIES = 8;
/** Activities chosen for the chart when the screen opens. */
export const DEFAULT_CHART_ACTIVITIES = 6;
/** An activity on more than this share of days says little in a strip ("zu Hause", "Arbeit" on weekdays). */
const DEFAULT_STRIP_MAX_SHARE = 0.8;
/** Rows of the activity table with fewer days are printed grey: the mean says little. */
export const FEW_DAYS = 10;
/** Activities on fewer days are left out of the table. */
export const MIN_TABLE_DAYS = 3;
/** A monthly mean of a scale or of sleep needs this many values, else the cell says "too few". */
export const MIN_MONTH_VALUES = 5;
/** Rounded level at or below which a day counts as hard, as in the insights. */
export const HARD_LEVEL = 2;

export interface ReportOptions {
  period: ReportPeriod;
  /** Printed under the title; empty leaves the line out. */
  name: string;
  /** "What I want to bring up", printed on the first page; empty leaves the box out. */
  talkingPoints: string;
  sleep: boolean;
  scaleIds: readonly number[];
  chartActivityIds: readonly number[];
  /** Groups whose activities appear in the table "activities and mood"; none leaves the page out. */
  tableGroupIds: readonly number[];
  dayList: boolean;
  /** Notes in the day list. Off by default: they often name other people. */
  notes: boolean;
}

/** What the report reads from one entry; `EntryDetails` fits as it is. */
export interface ReportEntry extends EntryFacts {
  time: string;
}

export interface ReportSource {
  entries: readonly ReportEntry[];
  /** Health Connect days; only the sleep is used. */
  health: readonly { date: string; sleep_minutes: number | null }[];
  turningPoints: readonly { date: string; title: string }[];
  catalog: Catalog;
  today: DateString;
}

export interface ReportDay {
  date: DateString;
  /** Levels of the day's entries in the order of their time. Empty on a day without entry. */
  levels: MoodLevel[];
  mean: number | null;
  level: MoodLevel | null;
  sleep: number | null;
  /** Values of the chosen scales by id, only those given that day. */
  scales: Map<number, number>;
  /** Activity ids in catalogue order. */
  activities: number[];
  /** Notes and titles of the day's entries, only when notes are on. */
  notes: string[];
}

export interface ReportScale {
  id: number;
  name: string;
  min: number;
  max: number;
  kind: ScaleFacts['kind'];
  mean: number | null;
  days: number;
}

export interface ReportMonth {
  /** First day of the month. */
  month: DateString;
  /** Days with entry in the month (inside the period). */
  days: number;
  mean: number | null;
  /** Null when fewer than `MIN_MONTH_VALUES` nights were measured. */
  sleep: number | null;
  /** Per chosen scale, in the order of `scales`; null when too few values. */
  scales: (number | null)[];
}

export interface ReportActivityRow {
  id: number;
  label: string;
  days: number;
  withMean: number;
  /** Null when the activity was on every day with entry. */
  withoutMean: number | null;
  /** Days with the activity per rounded level. */
  levels: Record<MoodLevel, number>;
}

export interface ReportActivityGroup {
  name: string;
  rows: ReportActivityRow[];
}

export interface Report {
  from: DateString;
  to: DateString;
  /** Days in the period, `from` and `to` included. */
  length: number;
  name: string;
  talkingPoints: string;
  /** Best level first, with the name the user's moods give it. */
  levels: { level: MoodLevel; label: string }[];
  /** Every day of the period, oldest first, empty days included so gaps stay visible. */
  days: ReportDay[];
  daysWithEntry: number;
  entryCount: number;
  meanMood: number | null;
  hardDays: number;
  /** Null when sleep is off or no night in the period was measured. */
  sleep: { mean: number; days: number } | null;
  scales: ReportScale[];
  chartActivities: { id: number; label: string }[];
  distribution: { level: MoodLevel; label: string; days: number }[];
  months: ReportMonth[];
  turningPoints: { date: DateString; title: string }[];
  /** Null when no group is chosen. */
  activityTable: ReportActivityGroup[] | null;
  dayList: boolean;
  notes: boolean;
  /** Days with a note in the period, so the report can say they were left out. */
  daysWithNote: number;
}

const LEVELS: readonly MoodLevel[] = [5, 4, 3, 2, 1];

/** First and last day of a period: it ends today and starts no earlier than the diary. */
export function reportWindow(period: ReportPeriod, today: DateString, firstEntry: DateString | null): { from: DateString; to: DateString } {
  const start = addDaysToDateString(today, -(Number(period) - 1));
  return { from: firstEntry && firstEntry > start ? firstEntry : start, to: today };
}

function firstEntryDate(entries: readonly ReportEntry[]): DateString | null {
  let first: string | null = null;
  for (const entry of entries) if (first === null || entry.date < first) first = entry.date;
  return first as DateString | null;
}

function inPeriod(date: string, from: DateString, to: DateString): boolean {
  return date >= from && date <= to;
}

function emptyLevels(): Record<MoodLevel, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

function noteText(entry: ReportEntry): string | null {
  const text = [entry.note_title, entry.note].map((part) => part?.trim()).filter((part): part is string => !!part).join('\n');
  return text || null;
}

/** Activities in the order the catalogue shows them: by group, then within the group. */
function catalogOrder(catalog: Catalog): Map<number, number> {
  const groupRank = new Map(catalog.groups.map((group, index) => [group.id, index]));
  const sorted = [...catalog.activities].sort(
    (a, b) => (groupRank.get(a.group_id) ?? 999) - (groupRank.get(b.group_id) ?? 999) || a.sort_order - b.sort_order || a.id - b.id,
  );
  return new Map(sorted.map((activity, index) => [activity.id, index]));
}

/** How many days in the period carry each activity. */
export function activityDays(source: ReportSource, period: ReportPeriod): Map<number, number> {
  const { from, to } = reportWindow(period, source.today, firstEntryDate(source.entries));
  const days = new Map<string, Set<number>>();
  for (const entry of source.entries) {
    if (!inPeriod(entry.date, from, to)) continue;
    const set = days.get(entry.date) ?? new Set<number>();
    for (const id of entry.activity_ids) set.add(id);
    days.set(entry.date, set);
  }
  const counts = new Map<number, number>();
  for (const set of days.values()) for (const id of set) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** Scales with at least one value in the period, in catalogue order. */
export function scalesWithValues(source: ReportSource, period: ReportPeriod): ScaleFacts[] {
  const { from, to } = reportWindow(period, source.today, firstEntryDate(source.entries));
  const used = new Set<number>();
  for (const entry of source.entries) if (inPeriod(entry.date, from, to)) for (const { scale_id } of entry.scales ?? []) used.add(scale_id);
  return source.catalog.scales.filter((scale) => used.has(scale.id));
}

export function hasSleep(source: ReportSource, period: ReportPeriod): boolean {
  const { from, to } = reportWindow(period, source.today, firstEntryDate(source.entries));
  return source.health.some((day) => day.sleep_minutes !== null && inPeriod(day.date, from, to));
}

/**
 * What the screen starts with: the last 90 days, sleep and every scale that has values, the six
 * most frequent activities that are not on nearly every day, every group in the table, the day
 * list without notes.
 */
export function defaultReportOptions(source: ReportSource): ReportOptions {
  const period = DEFAULT_PERIOD;
  const counts = activityDays(source, period);
  const { from, to } = reportWindow(period, source.today, firstEntryDate(source.entries));
  const total = new Set(source.entries.filter((entry) => inPeriod(entry.date, from, to)).map((entry) => entry.date)).size;
  const archived = new Set(source.catalog.activities.filter((activity) => activity.archived).map((activity) => activity.id));
  const strips = [...counts]
    .filter(([id, days]) => !archived.has(id) && days < total * DEFAULT_STRIP_MAX_SHARE)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, DEFAULT_CHART_ACTIVITIES)
    .map(([id]) => id);
  return {
    period,
    name: '',
    talkingPoints: '',
    sleep: true,
    scaleIds: scalesWithValues(source, period).map((scale) => scale.id),
    chartActivityIds: strips,
    tableGroupIds: source.catalog.groups.map((group) => group.id),
    dayList: true,
    notes: false,
  };
}

function meanOrNull(values: readonly number[], minimum = 1): number | null {
  return values.length >= minimum ? mean(values) : null;
}

export function buildReport(source: ReportSource, options: ReportOptions): Report {
  const { catalog, today } = source;
  const { from, to } = reportWindow(options.period, today, firstEntryDate(source.entries));
  const entries = source.entries.filter((entry) => inPeriod(entry.date, from, to));
  const insightDays = buildDays(entries);
  const byDate = new Map<string, InsightDay>(insightDays.map((day) => [day.date, day]));
  const order = catalogOrder(catalog);
  const scales = options.scaleIds.map((id) => catalog.scaleById.get(id)).filter((scale): scale is NonNullable<typeof scale> => !!scale);
  const sleepByDate = new Map<string, number>();
  if (options.sleep) for (const day of source.health) if (day.sleep_minutes !== null && inPeriod(day.date, from, to)) sleepByDate.set(day.date, day.sleep_minutes);

  const entriesByDate = new Map<string, ReportEntry[]>();
  for (const entry of entries) entriesByDate.set(entry.date, [...(entriesByDate.get(entry.date) ?? []), entry]);

  const days: ReportDay[] = [];
  for (let date = from; date <= to; date = addDaysToDateString(date, 1)) {
    const own = (entriesByDate.get(date) ?? []).slice().sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
    const insight = byDate.get(date);
    const values = new Map<number, number>();
    if (insight) for (const scale of scales) {
      const value = scaleDayValue(insight, scale);
      if (value !== null) values.set(scale.id, value);
    }
    days.push({
      date,
      levels: own.map((entry) => entry.level as MoodLevel),
      mean: insight?.mean ?? null,
      level: insight?.level ?? null,
      sleep: sleepByDate.get(date) ?? null,
      scales: values,
      activities: insight ? [...insight.activities].sort((a, b) => (order.get(a) ?? 1e6) - (order.get(b) ?? 1e6) || a - b) : [],
      notes: options.notes ? own.map(noteText).filter((text): text is string => text !== null) : [],
    });
  }

  const withEntry = days.filter((day) => day.mean !== null);
  const label = (level: MoodLevel) => levelMood(catalog, level).label;
  const distribution = LEVELS.map((level) => ({ level, label: label(level), days: withEntry.filter((day) => day.level === level).length }));
  const sleepValues = days.map((day) => day.sleep).filter((value): value is number => value !== null);

  const reportScales: ReportScale[] = scales.map((scale) => {
    const values = days.map((day) => day.scales.get(scale.id)).filter((value): value is number => value !== undefined);
    return { id: scale.id, name: scale.name, min: scale.min, max: scale.max, kind: scale.kind, mean: meanOrNull(values), days: values.length };
  });

  const monthKeys = [...new Set(days.map((day) => day.date.slice(0, 7)))];
  const months: ReportMonth[] = monthKeys.map((key) => {
    const inMonth = days.filter((day) => day.date.startsWith(key));
    const moods = inMonth.map((day) => day.mean).filter((value): value is number => value !== null);
    return {
      month: `${key}-01` as DateString,
      days: moods.length,
      mean: meanOrNull(moods),
      sleep: meanOrNull(inMonth.map((day) => day.sleep).filter((value): value is number => value !== null), MIN_MONTH_VALUES),
      scales: scales.map((scale) =>
        meanOrNull(inMonth.map((day) => day.scales.get(scale.id)).filter((value): value is number => value !== undefined), MIN_MONTH_VALUES),
      ),
    };
  });

  let activityTable: ReportActivityGroup[] | null = null;
  if (options.tableGroupIds.length) {
    const chosen = new Set(options.tableGroupIds);
    activityTable = catalog.groups
      .filter((group) => chosen.has(group.id))
      .map((group) => {
        const rows = catalog.activities
          .filter((activity) => activity.group_id === group.id)
          .map((activity): ReportActivityRow | null => {
            const on = withEntry.filter((day) => day.activities.includes(activity.id));
            if (on.length < MIN_TABLE_DAYS) return null;
            const off = withEntry.filter((day) => !day.activities.includes(activity.id));
            const levels = emptyLevels();
            for (const day of on) levels[day.level as MoodLevel] += 1;
            return {
              id: activity.id,
              label: activityLabel(catalog, activity.id),
              days: on.length,
              withMean: mean(on.map((day) => day.mean as number)) ?? 0,
              withoutMean: meanOrNull(off.map((day) => day.mean as number)),
              levels,
            };
          })
          .filter((row): row is ReportActivityRow => row !== null)
          .sort((a, b) => b.days - a.days || a.id - b.id);
        return { name: group.name, rows };
      })
      .filter((group) => group.rows.length > 0);
  }

  return {
    from,
    to,
    length: days.length,
    name: options.name.trim(),
    talkingPoints: options.talkingPoints.trim(),
    levels: LEVELS.map((level) => ({ level, label: label(level) })),
    days,
    daysWithEntry: withEntry.length,
    entryCount: entries.length,
    meanMood: meanOrNull(withEntry.map((day) => day.mean as number)),
    hardDays: withEntry.filter((day) => (day.level as number) <= HARD_LEVEL).length,
    sleep: sleepValues.length ? { mean: mean(sleepValues) ?? 0, days: sleepValues.length } : null,
    scales: reportScales,
    chartActivities: options.chartActivityIds.slice(0, MAX_CHART_ACTIVITIES).map((id) => ({ id, label: activityLabel(catalog, id) })).filter((row) => row.label !== ''),
    distribution,
    months,
    turningPoints: source.turningPoints
      .filter((point) => inPeriod(point.date, from, to))
      .map((point) => ({ date: point.date as DateString, title: point.title }))
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
    activityTable,
    dayList: options.dayList,
    notes: options.notes,
    daysWithNote: new Set(entries.filter((entry) => noteText(entry) !== null).map((entry) => entry.date)).size,
  };
}
