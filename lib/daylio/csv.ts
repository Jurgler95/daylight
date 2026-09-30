/**
 * Small RFC 4180 reader and writer. Comma separated, fields optionally in double quotes, `""` for a
 * quote inside a quoted field, line breaks inside quotes belong to the field. Written for Daylio's
 * export, but knows nothing about it.
 */

export const BOM = '\uFEFF';

export class CsvSyntaxError extends Error {
  override readonly name = 'CsvSyntaxError';
  constructor(
    message: string,
    /** 1-based line in the file where the problem starts. */
    readonly line: number,
  ) {
    super(message);
  }
}

export interface CsvRecord {
  /** 1-based line in the file where the record starts (the header is line 1). */
  line: number;
  fields: string[];
}

/**
 * Parses the whole text. A leading BOM is dropped, `\n`, `\r\n` and `\r` all end a record, blank
 * lines are skipped. Lenient about a stray quote inside an unquoted field (kept as text); an
 * unterminated quoted field is the one error, since everything after it would be misread.
 */
export function parseCsv(text: string): CsvRecord[] {
  const input = text.startsWith(BOM) ? text.slice(1) : text;
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = '';
  let line = 1;
  let recordLine = 1;
  let quoted = false;
  let quoteStartLine = 1;
  // True once the current record has any content, so a blank line does not become a record.
  let touched = false;

  const endField = () => {
    fields.push(field);
    field = '';
  };
  const endRecord = () => {
    endField();
    if (touched) records.push({ line: recordLine, fields });
    fields = [];
    touched = false;
  };

  for (let i = 0; i < input.length; i++) {
    const char = input[i] as string;
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        if (char === '\n') line++;
        field += char;
      }
      continue;
    }
    if (char === '"' && field === '') {
      quoted = true;
      quoteStartLine = line;
      touched = true;
    } else if (char === ',') {
      touched = true;
      endField();
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      endRecord();
      line++;
      recordLine = line;
    } else {
      touched = true;
      field += char;
    }
  }
  if (quoted) throw new CsvSyntaxError('unterminated quoted field', quoteStartLine);
  endRecord();
  return records;
}

/** Quotes a field when it has to (comma, quote, line break) or when asked to. */
export function formatCsvField(value: string, forceQuotes = false): string {
  if (forceQuotes || /[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** One line of CSV without its line ending. `alwaysQuote` names the columns that are quoted even when plain. */
export function formatCsvRow(fields: readonly string[], alwaysQuote: (column: number) => boolean = () => false): string {
  return fields.map((value, column) => formatCsvField(value, alwaysQuote(column))).join(',');
}
