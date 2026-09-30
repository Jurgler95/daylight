import { addDaysToDateString, weekdayOf, type DateString } from '@/lib/dates';
import { weekdayProfile, type InsightDay } from '@/lib/insights';
import { roundLevel } from '@/lib/mood/dayMood';
import type { MoodLevel } from '@/db/schema';

import { HORIZONS, MIN_OUTLOOK_DAYS, quantile, type BacktestResult } from './backtest';
import { expectDay, fitModel, type ActivitySource } from './model';

/** The spread shown around an expected value: 20th to 80th percentile of the backtest errors. */
export const SPREAD_LOW = 0.2;
export const SPREAD_HIGH = 0.8;
/** A hard day is one that rounds to level 2 or below; its chance is named above this share. */
export const HARD_CHANCE_MIN = 0.15;
const HARD_BELOW = 2.5;
/** Parts smaller than this (in mood steps) are too small to be named as a reason. */
export const REASON_MIN = 0.05;
export const MAX_REASONS = 3;

export type OutlookReason =
  | { kind: 'weekday'; weekday: number; value: number }
  | { kind: 'carry'; value: number }
  | { kind: 'activity'; activityId: number; source: ActivitySource; value: number };

export interface OutlookRange {
  /** Expected value, clamped to 1..5. */
  expected: number;
  low: number;
  high: number;
  mid: MoodLevel;
  lowLevel: MoodLevel;
  highLevel: MoodLevel;
  /** Share of backtest cases at this horizon that would have ended at level 2 or below; null up to 15 %. */
  hardChance: number | null;
  /** 0.3 (wide spread) to 1 (narrow), for the opacity of the column. */
  confidence: number;
  /** The two or three largest parts, largest first. */
  reasons: OutlookReason[];
}

export interface OutlookDay {
  date: DateString;
  horizon: number;
  weekday: number;
  /** Only set where the backtest showed the model beats both naive comparisons at this horizon. */
  range: OutlookRange | null;
  /** Planned for the day, in the order stored. */
  planned: number[];
  /** Recurring on this weekday and not overridden by a plan. */
  recurring: number[];
  /** What the insights say about this weekday so far; shown instead of a range. */
  weekdayMean: number | null;
  weekdayDays: number;
}

export type Outlook =
  | { status: 'tooFew'; days: number; needed: number }
  | { status: 'ready'; days: OutlookDay[]; backtest: BacktestResult; shownHorizons: number[] };

export interface OutlookInput {
  days: readonly InsightDay[];
  today: DateString;
  /** Plans by day. A day with at least one planned activity counts as planned. */
  plans: ReadonlyMap<DateString, readonly number[]>;
  backtest: BacktestResult;
}

function clampMood(value: number): number {
  return Math.min(5, Math.max(1, value));
}

/** Narrow spread, high confidence; two whole steps and more are the floor. */
export function confidenceOf(low: number, high: number): number {
  return Math.min(1, Math.max(0.3, 1 - (high - low) / 2));
}

/**
 * The seven days after `today`. Every day carries its weekday profile, plans and recurring
 * activities; only the horizons the backtest let through carry a range. Pure: the backtest comes in
 * from outside because it is the expensive part and does not depend on plans.
 */
export function buildOutlook({ days, today, plans, backtest }: OutlookInput): Outlook {
  const recorded = days.filter((day) => day.date <= today);
  if (recorded.length < MIN_OUTLOOK_DAYS) return { status: 'tooFew', days: recorded.length, needed: MIN_OUTLOOK_DAYS };
  const model = fitModel(recorded, today)!;
  const profile = weekdayProfile(recorded);
  const shownHorizons = backtest.horizons.filter((h) => h.beats).map((h) => h.horizon);

  const result = HORIZONS.map((horizon): OutlookDay => {
    const date = addDaysToDateString(today, horizon);
    const weekday = weekdayOf(date);
    const plan = plans.get(date);
    const expectation = expectDay(model, date, plan ?? null);
    const stat = profile.weekdays[weekday]!;
    const score = backtest.horizons.find((h) => h.horizon === horizon);
    let range: OutlookRange | null = null;
    if (score?.beats) {
      const expected = clampMood(expectation.value);
      const low = clampMood(expectation.value + quantile(score.residuals, SPREAD_LOW)!);
      const high = clampMood(expectation.value + quantile(score.residuals, SPREAD_HIGH)!);
      const hard = score.residuals.filter((r) => expectation.value + r < HARD_BELOW).length / score.residuals.length;
      const reasons: OutlookReason[] = [
        { kind: 'weekday', weekday, value: expectation.weekday },
        { kind: 'carry', value: expectation.carry },
        ...expectation.activities.map((part) => ({ kind: 'activity' as const, activityId: part.activityId, source: part.source, value: part.value })),
      ];
      range = {
        expected,
        low,
        high,
        mid: roundLevel(expected),
        lowLevel: roundLevel(low),
        highLevel: roundLevel(high),
        hardChance: hard > HARD_CHANCE_MIN ? hard : null,
        confidence: confidenceOf(low, high),
        reasons: reasons
          .filter((reason) => Math.abs(reason.value) >= REASON_MIN)
          .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
          .slice(0, MAX_REASONS),
      };
    }
    return {
      date,
      horizon,
      weekday,
      range,
      planned: plan ? [...plan] : [],
      recurring: plan ? [] : expectation.recurring,
      weekdayMean: stat.mean,
      weekdayDays: stat.days,
    };
  });
  return { status: 'ready', days: result, backtest, shownHorizons };
}
