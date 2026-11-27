import { renderHook } from '@testing-library/react-native';
import * as Print from 'expo-print';

import '@/lib/i18n';
import { buildCatalog } from '@/lib/catalog/catalog';
import type { DateString } from '@/lib/dates';
import { discardFile, saveBase64ToPickedDirectory, shareBase64 } from '@/lib/export/files';

import { defaultReportOptions, type ReportSource } from '../model';
import { useCreateReport } from '../useReport';

/** Creating the PDF and handing it on; the printer's own copy in the cache never stays. */
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('@/lib/export/files', () => ({
  discardFile: jest.fn(),
  shareBase64: jest.fn(() => Promise.resolve()),
  saveBase64ToPickedDirectory: jest.fn(() => Promise.resolve(true)),
}));
jest.mock('@/db/client', () => ({ getDb: () => null, DATABASE_NAME: 'test.db' }));

const PRINTED = 'file:///data/user/0/app/cache/Print/0b6c.pdf';
const today = '2026-11-26' as DateString;
const source: ReportSource = {
  entries: [{ date: '2026-11-20', time: '20:00', level: 4, activity_ids: [], note: null, note_title: null, scales: [] }],
  health: [],
  turningPoints: [],
  catalog: buildCatalog({ moods: [], groups: [], activities: [], scales: [] }),
  today,
};
const printToFile = Print.printToFileAsync as jest.Mock;

describe('useCreateReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    printToFile.mockResolvedValue({ uri: PRINTED, numberOfPages: 1, base64: 'JVBERi0x' });
  });

  it('renders the report as A4 HTML, shares the PDF and deletes the printed file', async () => {
    const { result } = await renderHook(() => useCreateReport());
    await expect(result.current(source, defaultReportOptions(source), 'share')).resolves.toBe(true);
    const [options] = printToFile.mock.calls[0]!;
    expect(options).toMatchObject({ width: 595, height: 842, base64: true });
    expect(options.html).toContain('<html');
    expect(shareBase64).toHaveBeenCalledWith('daylight-bericht-2026-11-26.pdf', 'application/pdf', 'JVBERi0x');
    expect(discardFile).toHaveBeenCalledWith(PRINTED);
  });

  it('saves into a picked folder and reports a cancelled pick', async () => {
    (saveBase64ToPickedDirectory as jest.Mock).mockResolvedValueOnce(false);
    const { result } = await renderHook(() => useCreateReport());
    await expect(result.current(source, defaultReportOptions(source), 'save')).resolves.toBe(false);
    expect(saveBase64ToPickedDirectory).toHaveBeenCalledWith('daylight-bericht-2026-11-26.pdf', 'application/pdf', 'JVBERi0x');
    expect(shareBase64).not.toHaveBeenCalled();
    expect(discardFile).toHaveBeenCalledWith(PRINTED);
  });

  it('deletes the printed file even when it brought no content', async () => {
    printToFile.mockResolvedValue({ uri: PRINTED, numberOfPages: 1 });
    const { result } = await renderHook(() => useCreateReport());
    await expect(result.current(source, defaultReportOptions(source), 'share')).rejects.toThrow('No PDF content');
    expect(discardFile).toHaveBeenCalledWith(PRINTED);
    expect(shareBase64).not.toHaveBeenCalled();
  });

  it('names the shared copy so that "Alle Daten löschen" finds it in every language', () => {
    for (const language of ['de', 'en', 'es', 'fr', 'id', 'it', 'nl', 'pl', 'pt', 'tr']) {
      const strings = require(`@/lib/i18n/locales/${language}.json`) as { report: { fileName: string } };
      expect([language, strings.report.fileName.startsWith('daylight-')]).toEqual([language, true]);
    }
  });
});
