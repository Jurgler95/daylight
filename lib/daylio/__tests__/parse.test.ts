import { readFileSync } from 'node:fs';
import path from 'node:path';

import { DaylioFormatError, decodeNote, parseDaylioCsv, parseScales, parseTime } from '../parse';

const sample = readFileSync(path.join(__dirname, 'fixtures', 'sample.csv'), 'utf8');
const HEADER = 'full_date,date,weekday,time,mood,activities,scales,note_title,note';

describe('parseTime', () => {
  it('reads 24h and am/pm', () => {
    expect(parseTime('21:35')).toBe('21:35');
    expect(parseTime('8:30 pm')).toBe('20:30');
    expect(parseTime('8:30 PM')).toBe('20:30');
    expect(parseTime('12:05 am')).toBe('00:05');
    expect(parseTime('12:30 pm')).toBe('12:30');
    expect(parseTime('7:05')).toBe('07:05');
  });

  it('rejects nonsense', () => {
    for (const value of ['', '25:00', '13:00 pm', '0:10 am', '12:60', 'abends']) expect(parseTime(value)).toBeNull();
  });
});

describe('decodeNote', () => {
  it('turns <br> into line breaks and entities into characters', () => {
    expect(decodeNote('eins<br>zwei<br/>drei<BR />vier')).toBe('eins\nzwei\ndrei\nvier');
    expect(decodeNote('Tee &amp; Kuchen &lt;3 &#228; &#xE4; &quot;x&quot;')).toBe('Tee & Kuchen <3 ä ä "x"');
    expect(decodeNote('A & B, &unbekannt;')).toBe('A & B, &unbekannt;');
    expect(decodeNote('')).toBeNull();
  });
});

describe('parseScales', () => {
  it('reads name: value pairs and flags the rest', () => {
    expect(parseScales('')).toEqual({ scales: [], unreadable: false });
    expect(parseScales('Energie: 4 | Stress: 2')).toEqual({
      scales: [
        { name: 'Energie', value: 4 },
        { name: 'Stress', value: 2 },
      ],
      unreadable: false,
    });
    expect(parseScales('Energie: viel').unreadable).toBe(true);
  });
});

describe('parseDaylioCsv', () => {
  it('reads the synthetic sample with all its special cases', () => {
    const parsed = parseDaylioCsv(sample);
    expect(parsed.errors).toEqual([]);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.entries).toHaveLength(6);

    const [first, second, third, fourth, fifth] = parsed.entries;
    expect(first).toMatchObject({ line: 2, date: '2026-03-10', time: '21:05', mood: 'Super', noteTitle: null });
    expect(first?.note).toBe('Mit Oma gebacken, sie sagte "nie wieder" und lachte.\nAbends noch ein Spaziergang.');
    expect(first?.activities).toEqual(['Glücklich', 'Gut', 'Sonnig', 'Familie', 'zu Hause']);
    expect(second).toMatchObject({ time: '20:30', note: 'Neuer Kurs: Töpfern & Tee' });
    expect(third).toMatchObject({ date: '2026-03-09', time: '07:15', mood: 'Geht so', note: null });
    expect(fourth?.activities).toEqual([]);
    expect(fifth).toMatchObject({ time: '00:05', noteTitle: 'Kurze Nacht' });
  });

  it('collects broken rows with line number and reason instead of stopping', () => {
    const text = [
      HEADER,
      '2026-02-30,x,x,20:00,Gut,"","","",""',
      '2026-03-01,x,x,abends,Gut,"","","",""',
      '2026-03-02,x,x,20:00,,"","","",""',
      '2026-03-03,x,x,20:00,Gut',
      '2026-03-04,x,x,20:00,Gut,"","Energie: hoch","",""',
      '2026-03-05,x,x,20:00,Gut,"","","","ok"',
    ].join('\n');
    const parsed = parseDaylioCsv(text);
    expect(parsed.errors).toEqual([
      { line: 2, code: 'date', value: '2026-02-30' },
      { line: 3, code: 'time', value: 'abends' },
      { line: 4, code: 'mood', value: '' },
      { line: 5, code: 'columns', value: '5' },
    ]);
    expect(parsed.warnings).toEqual([{ line: 6, code: 'scales', value: 'Energie: hoch' }]);
    expect(parsed.entries.map((entry) => entry.line)).toEqual([6, 7]);
  });

  it('refuses files that are not a Daylio export', () => {
    expect(() => parseDaylioCsv('date,flow\n2026-01-01,light')).toThrow(DaylioFormatError);
    expect(() => parseDaylioCsv('')).toThrow(DaylioFormatError);
    expect(() => parseDaylioCsv(`${HEADER}\n2026-03-05,x,x,20:00,Gut,"offen`)).toThrow(DaylioFormatError);
  });

  it('keeps an activity named twice in one row once and says so', () => {
    const parsed = parseDaylioCsv(`${HEADER}\n2026-03-05,x,x,20:00,Gut,"Urlaub | Sonnig | urlaub","","",""`);
    expect(parsed.entries[0]?.activities).toEqual(['Urlaub', 'Sonnig']);
    expect(parsed.warnings).toEqual([{ line: 2, code: 'duplicateActivity', value: 'urlaub' }]);
  });

  it('finds columns by name, not by position', () => {
    const parsed = parseDaylioCsv('mood,full_date,time,activities\nGut,2026-03-05,20:00,"Arbeit"');
    expect(parsed.entries[0]).toMatchObject({ date: '2026-03-05', mood: 'Gut', activities: ['Arbeit'], note: null });
  });
});
