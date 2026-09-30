import type { EntryDetails } from '@/db/repositories/entries';
import type { DateString } from '@/lib/dates';

import { defaultTime, draftFromEntry, draftToInput, newDraft, sameDraft, setScale, toggleId } from '../draft';

const d = (s: string) => s as DateString;

const saved: EntryDetails = {
  id: 7,
  date: '2026-09-20',
  time: '20:15',
  mood_id: 2,
  level: 4,
  note_title: null,
  note: 'Spaziergang',
  source: 'daylio_csv',
  created_at: '',
  updated_at: '',
  activity_ids: [3, 1],
  scales: [{ scale_id: 5, value: 2 }],
  photos: [],
};

describe('entry draft', () => {
  it('reads a saved entry and gives it back unchanged', () => {
    const draft = draftFromEntry(saved);
    expect(draft).toEqual({ date: '2026-09-20', time: '20:15', mood_id: 2, activity_ids: [3, 1], scales: { 5: 2 }, note_title: '', note: 'Spaziergang', photos: [] });
    expect(draftToInput(draft)).toEqual({
      date: '2026-09-20',
      time: '20:15',
      mood_id: 2,
      note_title: null,
      note: 'Spaziergang',
      activity_ids: [3, 1],
      scales: [{ scale_id: 5, value: 2 }],
      photos: [],
    });
  });

  it('folds an old title into the first line of the note', () => {
    expect(draftFromEntry({ ...saved, note_title: 'Sonntag' }).note).toBe('Sonntag\nSpaziergang');
    expect(draftFromEntry({ ...saved, note_title: 'Sonntag', note: null }).note).toBe('Sonntag');
    expect(draftToInput(draftFromEntry({ ...saved, note_title: 'Sonntag' }))).toMatchObject({ note_title: null, note: 'Sonntag\nSpaziergang' });
  });

  it('is only dirty when something that is saved changed', () => {
    const draft = draftFromEntry(saved);
    expect(sameDraft(draft, { ...draft, activity_ids: [1, 3] })).toBe(true);
    expect(sameDraft(draft, { ...draft, note: 'Spaziergang  ' })).toBe(true);
    expect(sameDraft(draft, { ...draft, note: 'Spaziergang.' })).toBe(false);
    expect(sameDraft(draft, { ...draft, activity_ids: toggleId(draft.activity_ids, 4) })).toBe(false);
    expect(sameDraft(draft, { ...draft, scales: setScale(draft.scales, 5, null) })).toBe(false);
    expect(sameDraft(draft, { ...draft, time: '20:16' })).toBe(false);
  });

  it('cannot be saved without a mood', () => {
    expect(draftToInput(newDraft(d('2026-09-26'), '20:30'))).toBeNull();
    expect(draftToInput(newDraft(d('2026-09-26'), '20:30', 4))).toMatchObject({ mood_id: 4, note: null, activity_ids: [], scales: [] });
  });

  it('toggles ids and scale values', () => {
    expect(toggleId([1, 2], 2)).toEqual([1]);
    expect(toggleId([1], 2)).toEqual([1, 2]);
    expect(setScale({ 1: 3 }, 2, 0)).toEqual({ 1: 3, 2: 0 });
  });

  it('uses the current time today and the reminder time for earlier days', () => {
    expect(defaultTime(d('2026-09-26'), d('2026-09-26'), '09:12', '20:30')).toBe('09:12');
    expect(defaultTime(d('2026-09-24'), d('2026-09-26'), '09:12', '20:30')).toBe('20:30');
  });
});
