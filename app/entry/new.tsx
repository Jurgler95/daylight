import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { EntryEditor } from '@/components/entry/EntryEditor';
import { useCatalog } from '@/lib/catalog/useCatalog';
import { isDateString, type DateString } from '@/lib/dates';
import { useToday } from '@/lib/dates/useToday';

/**
 * `/entry/new?date=YYYY-MM-DD&mood=<id>`. Without a (valid, not future) date the entry is for today.
 * Always a new entry, also on a day that already has some: a day holds as many as it takes.
 */
export default function NewEntryScreen() {
  const params = useLocalSearchParams<{ date?: string; mood?: string }>();
  const today = useToday();
  // Fixed when the screen opens. A link for another day opens its own screen (see `dangerouslySingular`
  // in the root layout), and midnight must not swap the day under a draft.
  const [date] = useState<DateString>(() => (params.date && isDateString(params.date) && params.date <= today ? params.date : today));
  const catalog = useCatalog();
  const mood = params.mood ? Number(params.mood) : NaN;
  const known = catalog.moods.some((candidate) => candidate.id === mood);
  return <EntryEditor target={{ kind: 'new', date, moodId: known ? mood : null }} />;
}
