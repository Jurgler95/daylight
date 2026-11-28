import { buildReminderMoods, onePerLevel, REMINDER_MOOD_SLOTS } from '../moods';

const mood = (id: number, level: number, icon: string, label: string) => ({ id, level, icon, label });

describe('buildReminderMoods', () => {
  const glyphs = { 'emoticon-excited-outline': 0xf0002, 'emoticon-happy-outline': 0xf0003, odd: 'x' };

  it('keeps the moods in the order it gets them, with their icon code points and the font', () => {
    expect(buildReminderMoods([mood(7, 5, 'emoticon-excited-outline', 'Super'), mood(3, 4, 'emoticon-happy-outline', 'Gut')], glyphs, 'font_res')).toEqual({
      font: 'font_res',
      moods: [
        { id: 7, level: 5, glyph: 0xf0002, label: 'Super' },
        { id: 3, level: 4, glyph: 0xf0003, label: 'Gut' },
      ],
    });
  });

  it('draws an unknown icon as 0, which the module shows as the initial', () => {
    expect(buildReminderMoods([mood(1, 3, 'missing', 'Okay'), mood(2, 2, 'odd', 'Mies')], glyphs, null).moods.map((m) => m.glyph)).toEqual([0, 0]);
  });

  it('shows at most five', () => {
    const many = Array.from({ length: 7 }, (_, i) => mood(i + 1, 5 - (i % 5), 'missing', `M${i}`));
    expect(buildReminderMoods(many, glyphs, null).moods.map((m) => m.id)).toEqual([1, 2, 3, 4, 5]);
    expect(REMINDER_MOOD_SLOTS).toBe(5);
  });

  it('gives every level one button after an import doubled the moods', () => {
    const doubled = [
      mood(1, 5, 'missing', 'Great'),
      mood(6, 5, 'missing', 'Super'),
      mood(2, 4, 'missing', 'Good'),
      mood(7, 4, 'missing', 'Gut'),
      mood(3, 3, 'missing', 'Okay'),
      mood(8, 3, 'missing', 'Ok'),
      mood(4, 2, 'missing', 'Bad'),
      mood(9, 2, 'missing', 'Schlecht'),
      mood(5, 1, 'missing', 'Awful'),
      mood(10, 1, 'missing', 'Mies'),
    ];
    expect(buildReminderMoods(doubled, glyphs, null).moods.map((m) => m.label)).toEqual(['Great', 'Good', 'Okay', 'Bad', 'Awful']);
  });

  it('puts the best level first, whatever the picker order', () => {
    expect(onePerLevel([mood(1, 1, 'x', 'Mies'), mood(2, 3, 'x', 'Ok'), mood(3, 5, 'x', 'Super'), mood(4, 3, 'x', 'Naja')]).map((m) => m.id)).toEqual([3, 2, 1]);
  });

  it('never carries which mood was chosen', () => {
    const built = buildReminderMoods([mood(1, 5, 'missing', 'Super')], glyphs, null);
    expect(Object.keys(built).sort()).toEqual(['font', 'moods']);
    expect(Object.keys(built.moods[0]!).sort()).toEqual(['glyph', 'id', 'label', 'level']);
  });
});
