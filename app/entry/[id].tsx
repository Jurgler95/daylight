import { Redirect, useLocalSearchParams } from 'expo-router';

import { EntryEditor } from '@/components/entry/EntryEditor';

export default function EditEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entryId = Number(id);
  if (!Number.isInteger(entryId)) return <Redirect href="/" />;
  return <EntryEditor target={{ kind: 'edit', id: entryId }} />;
}
