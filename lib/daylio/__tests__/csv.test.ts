import { BOM, CsvSyntaxError, formatCsvField, formatCsvRow, parseCsv } from '../csv';

describe('parseCsv', () => {
  it('drops the BOM and splits plain fields', () => {
    expect(parseCsv(`${BOM}a,b,c\n1,2,3`)).toEqual([
      { line: 1, fields: ['a', 'b', 'c'] },
      { line: 2, fields: ['1', '2', '3'] },
    ]);
  });

  it('reads quoted fields with commas, escaped quotes and empty values', () => {
    const [record] = parseCsv('"Kaffee, Kuchen","er sagte ""hallo""","",x');
    expect(record?.fields).toEqual(['Kaffee, Kuchen', 'er sagte "hallo"', '', 'x']);
  });

  it('keeps line breaks inside quotes and counts lines from where a record starts', () => {
    const records = parseCsv('h1,h2\n"zwei\nZeilen",b\nnext,row\r\nlast,one');
    expect(records.map((r) => r.line)).toEqual([1, 2, 4, 5]);
    expect(records[1]?.fields).toEqual(['zwei\nZeilen', 'b']);
    expect(records[3]?.fields).toEqual(['last', 'one']);
  });

  it('skips blank lines and a trailing line break', () => {
    expect(parseCsv('a\n\nb\n').map((r) => r.fields)).toEqual([['a'], ['b']]);
  });

  it('keeps a trailing empty field', () => {
    expect(parseCsv('a,')[0]?.fields).toEqual(['a', '']);
  });

  it('reports an unterminated quote with the line it starts on', () => {
    expect(() => parseCsv('a,b\n1,"offen\nweiter')).toThrow(CsvSyntaxError);
    try {
      parseCsv('a,b\n1,"offen\nweiter');
    } catch (error) {
      expect((error as CsvSyntaxError).line).toBe(2);
    }
  });
});

describe('formatCsvField', () => {
  it('quotes only when needed unless forced', () => {
    expect(formatCsvField('plain')).toBe('plain');
    expect(formatCsvField('a,b')).toBe('"a,b"');
    expect(formatCsvField('sagte "ja"')).toBe('"sagte ""ja"""');
    expect(formatCsvField('zwei\nZeilen')).toBe('"zwei\nZeilen"');
    expect(formatCsvField('', true)).toBe('""');
  });

  it('round-trips through the parser', () => {
    const fields = ['a', 'b, c', '"q"', '', 'x\ny'];
    const line = formatCsvRow(fields, (column) => column > 2);
    expect(parseCsv(line)[0]?.fields).toEqual(fields);
  });
});
