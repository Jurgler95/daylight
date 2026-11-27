import type { EntryDetails } from '@/db/repositories/entries';
import type { DateString } from '@/lib/dates';

import { checkInAnswer, defaultTime, draftFromEntry, draftToInput, newDraft, sameDraft, setScale, tapCheckIn, toggleId } from '../draft';

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
    expect(draft).toEqual({ date: '2026-09-20', time: '20:15', mood_id: 2, activity_ids: [3, 1], scales: { 5: 2 }, note_title: '', note: 'Spaziergang', photos: [], check_ins: {} });
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

  it('holds only the answers that differ from the stored ones', () => {
    const none = new Map<number, boolean>();
    const kept = new Map<number, boolean>([[1, true]]);
    // A first tap picks, the same tap again takes it back to open, which is no change any more.
    expect(tapCheckIn({}, none, 1, true)).toEqual({ 1: true });
    expect(tapCheckIn({ 1: true }, none, 1, true)).toEqual({});
    expect(tapCheckIn({ 1: true }, none, 1, false)).toEqual({ 1: false });
    // A stored "kept" is shown, a tap on it takes it back, a second tap brings it back unchanged.
    expect(checkInAnswer({}, kept, 1)).toBe(true);
    expect(tapCheckIn({}, kept, 1, true)).toEqual({ 1: null });
    expect(checkInAnswer({ 1: null }, kept, 1)).toBeNull();
    expect(tapCheckIn({ 1: null }, kept, 1, true)).toEqual({});
    expect(tapCheckIn({}, kept, 1, false)).toEqual({ 1: false });
  });

  it('is dirty when an answer changed', () => {
    const draft = draftFromEntry(saved);
    expect(sameDraft(draft, { ...draft, check_ins: {} })).toBe(true);
    expect(sameDraft(draft, { ...draft, check_ins: { 1: true } })).toBe(false);
    expect(sameDraft(draft, { ...draft, check_ins: { 1: null } })).toBe(false);
    expect(sameDraft({ ...draft, check_ins: { 1: true } }, { ...draft, check_ins: { 1: false } })).toBe(false);
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
