import { File, Paths } from 'expo-file-system';

import type { DraftStorage } from './savedDrafts';

/**
 * The editor's drafts as one small file in the app's private document folder, next to the photos.
 * Nothing else can read it, and with `allowBackup` off it never leaves the phone. Synchronous, so a
 * draft is written before Android can end the app.
 */
function file(): File {
  return new File(Paths.document, 'entry-drafts.json');
}

export const fileDraftStorage: DraftStorage = {
  read: () => {
    const draft = file();
    return draft.exists ? draft.textSync() : null;
  },
  write: (text) => file().write(text),
  remove: () => {
    const draft = file();
    if (draft.exists) draft.delete();
  },
};
