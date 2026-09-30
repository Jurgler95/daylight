import { getDb } from '@/db';
import { listHealthDays } from '@/db/repositories/health';
import type { HealthDay } from '@/db/schema';
import { cached, useQuery } from '@/lib/store/dataVersion';

/** Every health day by date, read once per data version for Heute and Verlauf. */
function healthByDate(): Map<string, HealthDay> {
  return cached('healthByDate', () => new Map(listHealthDays(getDb()).map((day) => [day.date, day])));
}

export function useHealthDay(date: string): HealthDay | null {
  return useQuery(() => healthByDate().get(date) ?? null, [date]);
}

export function useHealthByDate(): Map<string, HealthDay> {
  return useQuery(healthByDate, []);
}
