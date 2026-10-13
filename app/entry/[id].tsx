import { Redirect, useLocalSearchParams } from 'expo-router';

import { EntryEditor } from '@/components/entry/EntryEditor';

export default function EditEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entryId = Number(id);
  if (!Number.isInteger(entryId)) return <Redirect href="/" />;
  // Keyed like the new entry: the screen can be reused for another entry while the draft lives in state.
  return <EntryEditor key={entryId} target={{ kind: 'edit', id: entryId }} />;
}
