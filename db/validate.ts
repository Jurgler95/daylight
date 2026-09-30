import { isDateString, type DateString } from '@/lib/dates';

import type { MoodLevel } from './schema';
import { RepositoryError } from './types';

export function assertDate(value: string, field = 'date'): DateString {
  if (!isDateString(value)) throw new RepositoryError(`${field}: "${value}" is not YYYY-MM-DD`);
  return value;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isTimeString(value: string): boolean {
  return TIME.test(value);
}

export function assertTime(value: string, field = 'time'): string {
  if (!isTimeString(value)) throw new RepositoryError(`${field}: "${value}" is not HH:mm`);
  return value;
}

export function assertLevel(value: number): MoodLevel {
  if (!Number.isInteger(value) || value < 1 || value > 5) throw new RepositoryError(`level: ${value} must be 1..5`);
  return value as MoodLevel;
}

export function assertName(value: string, field = 'name'): string {
  const clean = value.trim();
  if (!clean) throw new RepositoryError(`${field} is required`);
  return clean;
}

/** Empty strings become null, so "no note" has exactly one representation. */
export function optionalText(value: string | null | undefined): string | null {
  return value === undefined || value === null || value === '' ? null : value;
}

export function now(): string {
  return new Date().toISOString();
}
