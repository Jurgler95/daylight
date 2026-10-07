import { getDb } from '@/db';
import { listHealthDays } from '@/db/repositories/health';
import { listTurningPoints } from '@/db/repositories/turningPoints';
import type { TurningPoint } from '@/db/schema';
import type { DateString } from '@/lib/dates';
import { readInsightDays } from '@/lib/insights/useInsights';
import { cached, useQuery } from '@/lib/store/dataVersion';

import { compareTurningPoint, type TurningComparison, type TurningSpan } from './compare';

/** Every turning point, oldest first, read once per data version. */
export function readTurningPoints(): TurningPoint[] {
  return cached('turningPoints', () => listTurningPoints(getDb()));
}

export function useTurningPoints(): TurningPoint[] {
  return useQuery(readTurningPoints, []);
}

export function useTurningPointOn(date: DateString): TurningPoint | undefined {
  return useQuery(() => readTurningPoints().find((point) => point.date === date), [date]);
}

export function useTurningComparison(date: DateString | null, span: TurningSpan, today: DateString): TurningComparison | null {
  return useQuery(() => {
    if (!date) return null;
    const health = cached('healthDays', () => listHealthDays(getDb()));
    return compareTurningPoint({ days: readInsightDays(), health, date, span, today });
  }, [date, span, today]);
}
