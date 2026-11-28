import i18n from '@/lib/i18n';

import { createdText, summaryText } from '../summary';

const none = { moods: [], groups: [], activities: [] };

describe('summaryText', () => {
  it('reads like the preview in the build prompt', () => {
    const text = summaryText(i18n.t, {
      entries: 120,
      from: '2026-03-01' as never,
      to: '2026-06-28' as never,
      moods: 5,
      newMoods: 0,
      activities: 30,
      newActivities: 12,
      toAdd: 120,
      duplicates: 0,
      photos: 0,
      newPhotos: 0,
      healthDays: 0,
      experiments: 0,
      experimentsLost: 0,
      created: none,
    });
    expect(text).toBe(
      '120 Einträge vom 01.03.2026 bis 28.06.2026, 5 Stimmungen, 30 Aktivitäten (davon 12 neu). Zusammenführen fügt 120 Einträge hinzu, 0 sind schon vorhanden.',
    );
  });

  it('names the experiments in the file', () => {
    const text = summaryText(i18n.t, { entries: 1, from: '2026-01-01' as never, to: '2026-01-01' as never, moods: 1, newMoods: 0, activities: 0, newActivities: 0, toAdd: 1, duplicates: 0, photos: 0, newPhotos: 0, healthDays: 0, experiments: 2, experimentsLost: 0, created: none });
    expect(text.endsWith(' Die Datei enthält 2 Selbstversuche.')).toBe(true);
  });

  it('uses the singular and handles an empty file', () => {
    const one = summaryText(i18n.t, { entries: 1, from: '2026-01-01' as never, to: '2026-01-01' as never, moods: 1, newMoods: 1, activities: 1, newActivities: 0, toAdd: 1, duplicates: 1, photos: 0, newPhotos: 0, healthDays: 0, experiments: 0, experimentsLost: 0, created: none });
    expect(one).toBe('1 Eintrag vom 01.01.2026 bis 01.01.2026, 1 Stimmung, 1 Aktivität (davon 0 neu). Zusammenführen fügt 1 Eintrag hinzu, 1 ist schon vorhanden.');
    expect(summaryText(i18n.t, { entries: 0, from: null, to: null, moods: 0, newMoods: 0, activities: 0, newActivities: 0, toAdd: 0, duplicates: 0, photos: 0, newPhotos: 0, healthDays: 0, experiments: 0, experimentsLost: 0, created: none })).toBe(
      'Die Datei enthält keine Einträge.',
    );
  });
});

describe('createdText', () => {
  it('says nothing when a merge creates nothing', () => {
    expect(createdText(i18n.t, none)).toBeNull();
  });

  it('names what a merge creates, briefly', () => {
    expect(createdText(i18n.t, { moods: ['Prima'], groups: [], activities: ['Yoga', 'Malen', 'Chor', 'Garten', 'Kino', 'Tanz', 'Töpfern'] })).toBe(
      'Neue Stimmungen: Prima. Neue Aktivitäten: Yoga, Malen, Chor, Garten, Kino und 2 weitere.',
    );
  });
});
