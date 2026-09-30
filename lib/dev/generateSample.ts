import { addDaysToDateString, weekdayOf, type DateString } from '@/lib/dates';
import type { RawEntry } from '@/lib/daylio/parse';

import { createRandom, type Random } from './random';
import { noteFor } from './notes';

/**
 * Synthetic journal with the structure of a real Daylio export: about a year, mostly one entry a
 * day in the evening, a few gaps and a few days with two entries, a mood distribution skewed to
 * "Gut", activities from the standard groups with plausible effects on the mood. Pure and
 * deterministic, so tests can build on it. Nothing here comes from real data.
 */

export const SAMPLE_SCALE = { name: 'Energie', min: 1, max: 5 } as const;
const MOOD_BY_LEVEL = ['', 'Mies', 'Schlecht', 'Ok', 'Gut', 'Super'] as const;

export interface SampleData {
  entries: RawEntry[];
  /** Planned activities for the coming two weeks. */
  plans: { date: DateString; activity: string }[];
}

interface Day {
  date: DateString;
  weekday: number;
  month: number;
  holiday: boolean;
}

function pickSome(random: Random, pool: readonly string[], min: number, max: number): string[] {
  const count = random.int(min, max);
  const left = [...pool];
  const picked: string[] = [];
  while (picked.length < count && left.length) picked.push(left.splice(random.int(0, left.length - 1), 1)[0] as string);
  return picked;
}

function weather(random: Random, month: number): string[] {
  const winter = month === 12 || month <= 2;
  const summer = month >= 6 && month <= 8;
  const odds: [string, number][] = winter
    ? [['Sonnig', 0.3], ['Wolkig', 0.55], ['Regnerisch', 0.25], ['Schnee', 0.2], ['Wind', 0.1], ['Sturm', 0.05]]
    : summer
      ? [['Sonnig', 0.75], ['Wolkig', 0.3], ['Regnerisch', 0.15], ['Hitze', 0.25], ['Sturm', 0.03]]
      : [['Sonnig', 0.5], ['Wolkig', 0.5], ['Regnerisch', 0.3], ['Wind', 0.08], ['Sturm', 0.02]];
  const picked = odds.filter(([, p]) => random.chance(p)).map(([name]) => name);
  return picked.length ? picked : ['Wolkig'];
}

/** Activities of one day in group order, plus the mood effect they carry. */
function activitiesFor(random: Random, day: Day): { names: string[]; effect: number } {
  const weekend = day.weekday === 0 || day.weekday === 6;
  let effect = 0;
  const sleep = random.pick(['Gut', 'Mäßig', 'Mäßig', 'Mäßig', 'Mäßig', 'Mäßig', 'Schlecht']);
  effect += sleep === 'Gut' ? 0.4 : sleep === 'Schlecht' ? -0.6 : 0;
  const sky = weather(random, day.month);
  effect += sky.includes('Sonnig') ? 0.1 : 0;
  effect -= sky.includes('Sturm') ? 0.2 : 0;

  const social: string[] = [];
  if (random.chance(weekend ? 0.5 : 0.25)) social.push('Familie');
  if (random.chance(weekend ? 0.4 : 0.15)) social.push('Besuche');
  if (random.chance(0.07)) social.push('Freunde');
  if (random.chance(day.weekday === 6 ? 0.15 : 0.02)) social.push('Party');
  effect += social.length * 0.15;

  const work: string[] = [];
  if (day.holiday) {
    work.push('Urlaub');
    effect += 0.4;
  } else if (!weekend) {
    if (random.chance(0.02)) {
      work.push('Krankheitstag');
      effect -= 0.8;
    } else {
      work.push('Arbeit');
      if (random.chance(0.55)) work.push('Planmäßig beenden');
      if (random.chance(0.05)) work.push('Überstunden');
      if (random.chance(0.05)) work.push('HomeOffice');
      if (random.chance(0.01)) work.push('Teambuilding');
      effect -= work.includes('Überstunden') ? 0.5 : 0;
    }
  }

  const places: string[] = [];
  if (random.chance(day.holiday ? 0.5 : 0.92)) places.push('zu Hause');
  if (random.chance(0.07)) places.push('Einkaufen');
  if (day.holiday && random.chance(0.4)) places.push('Reisen');
  if (random.chance(weekend ? 0.08 : 0.01)) places.push('Natur');
  if (random.chance(0.02)) places.push('Filme');
  if (random.chance(0.03)) places.push('Restaurant');

  return { names: [sleep, ...sky, ...social, ...work, ...places], effect };
}

const FEELINGS: Record<'high' | 'mid' | 'low', readonly string[]> = {
  high: ['Glücklich', 'Zufrieden', 'Entspannt', 'Aufgeregt', 'Dankbar'],
  mid: ['Müde', 'Zufrieden', 'Entspannt', 'Gestresst', 'Angespannt'],
  low: ['Gestresst', 'Angespannt', 'Müde', 'Unsicher', 'Traurig', 'Verzweifelt', 'Wütend'],
};

function time(random: Random, meanMinutes: number, sd: number, min: number, max: number): string {
  const minutes = Math.round(random.normal(meanMinutes, sd, min, max));
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function generateSample(input: { today: DateString; seed?: number; days?: number }): SampleData {
  const random = createRandom(input.seed ?? 42);
  const span = input.days ?? 365;
  const start = addDaysToDateString(input.today, -span);
  const holidayStart = addDaysToDateString(input.today, -120);
  const entries: RawEntry[] = [];
  let previous = 0;

  for (let i = 0; i < span; i++) {
    const date = addDaysToDateString(start, i);
    const month = Number(date.slice(5, 7));
    const christmas = (month === 12 && Number(date.slice(8)) >= 23) || (month === 1 && Number(date.slice(8)) <= 2);
    const day: Day = { date, weekday: weekdayOf(date), month, holiday: christmas || (date >= holidayStart && date < addDaysToDateString(holidayStart, 14)) };
    if (random.chance(0.03)) continue;

    const { names, effect } = activitiesFor(random, day);
    const weekdayEffect = day.weekday === 0 ? 0.25 : day.weekday === 6 ? 0.15 : day.weekday === 1 ? -0.2 : 0;
    const deviation = 0.35 * previous + effect + weekdayEffect + random.normal(0, 0.45, -1.6, 1.6);
    previous = deviation;
    const level = Math.min(5, Math.max(1, Math.round(3.95 + deviation)));
    const feelings = pickSome(random, FEELINGS[level >= 5 ? 'high' : level >= 4 ? 'mid' : 'low'], 1, 3);
    const activities = [...feelings, ...names];

    entries.push({
      line: entries.length + 2,
      date,
      time: time(random, 20 * 60 + 50, 25, 19 * 60 + 30, 22 * 60 + 40),
      mood: MOOD_BY_LEVEL[level] as string,
      activities,
      scales: random.chance(0.6) ? [{ name: SAMPLE_SCALE.name, value: Math.min(5, Math.max(1, level - (names.includes('Schlecht') ? 1 : 0))) }] : [],
      noteTitle: random.chance(0.04) ? random.pick(['Kurzer Tag', 'Notiz', 'Merken']) : null,
      note: noteFor(random, activities, level),
      photos: [],
    });

    if (random.chance(0.04)) {
      const midday = Math.min(5, Math.max(1, level + random.int(-1, 1)));
      entries.push({
        line: entries.length + 2,
        date,
        time: time(random, 13 * 60, 30, 11 * 60 + 30, 14 * 60 + 45),
        mood: MOOD_BY_LEVEL[midday] as string,
        activities: activities.slice(0, 2),
        scales: [],
        noteTitle: null,
        note: random.chance(0.5) ? 'Mittags kurz notiert.' : null,
        photos: [],
      });
    }
  }

  const plans: SampleData['plans'] = [];
  for (let i = 1; i <= 14; i++) {
    const date = addDaysToDateString(input.today, i);
    const weekday = weekdayOf(date);
    if (i >= 9 && i <= 11) plans.push({ date, activity: 'Urlaub' });
    else if (weekday >= 1 && weekday <= 5) plans.push({ date, activity: 'Arbeit' });
    if (weekday === 6 && i <= 7) plans.push({ date, activity: 'Besuche' });
  }
  return { entries, plans };
}
