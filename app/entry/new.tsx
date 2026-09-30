import { Redirect, useLocalSearchParams } from 'expo-router';

import { EntryEditor } from '@/components/entry/EntryEditor';
import { getDb } from '@/db';
import { entryIdOnDate } from '@/db/repositories/entries';
import { useCatalog } from '@/lib/catalog/useCatalog';
import { isDateString, type DateString } from '@/lib/dates';
import { useToday } from '@/lib/dates/useToday';

/**
 * `/entry/new?date=YYYY-MM-DD&mood=<id>`. Without a (valid, not future) date the entry is for today.
 * One entry per day: a day that already has one opens that entry instead.
 */
export default function NewEntryScreen() {
  const params = useLocalSearchParams<{ date?: string; mood?: string }>();
  const today = useToday();
  const date: DateString = params.date && isDateString(params.date) && params.date <= today ? params.date : today;
  const catalog = useCatalog();
  const mood = params.mood ? Number(params.mood) : NaN;
  const known = catalog.moods.some((candidate) => candidate.id === mood);
  const existing = entryIdOnDate(getDb(), date);
  if (existing !== undefined) return <Redirect href={{ pathname: '/entry/[id]', params: { id: String(existing) } }} />;
  return <EntryEditor target={{ kind: 'new', date, moodId: known ? mood : null }} />;
}
