import { useState } from 'react';

import { TextField } from '@/components/ui';

import { useCommitOnUnmount } from './useCommitOnUnmount';

interface Props {
  label: string;
  value: string;
  /** Saves the new name; false when it was refused, which puts the old one back. */
  onCommit: (name: string) => boolean;
}

/** A name that saves when the field is left, and also when the screen is closed while typing. */
export function NameField({ label, value, onCommit }: Props) {
  const [text, setText] = useState(value);
  const commit = () => {
    const next = text.trim();
    if (!next || next === value) {
      setText(value);
      return;
    }
    if (!onCommit(next)) setText(value);
  };
  useCommitOnUnmount(commit);
  return <TextField label={label} value={text} onChangeText={setText} onBlur={commit} />;
}
