import * as Print from 'expo-print';
import { useTranslation } from 'react-i18next';

import { getDb } from '@/db';
import { listHealthDays } from '@/db/repositories/health';
import { listTurningPoints } from '@/db/repositories/turningPoints';
import { activityLabel } from '@/lib/catalog/catalog';
import { useCatalog } from '@/lib/catalog/useCatalog';
import { discardFile, saveBase64ToPickedDirectory, shareBase64 } from '@/lib/export/files';
import type { DateString } from '@/lib/dates';
import { currentLanguage } from '@/lib/i18n/language';
import { readInsightEntries } from '@/lib/insights/useInsights';
import { cached, useQuery } from '@/lib/store/dataVersion';

import { PAGE_HEIGHT, PAGE_WIDTH, renderReportHtml, type Translate } from './html';
import { buildReport, type ReportOptions, type ReportSource } from './model';

/** Everything the report reads, once per data version. */
export function useReportSource(today: DateString): ReportSource {
  const catalog = useCatalog();
  const rest = useQuery(
    () => ({
      entries: readInsightEntries(),
      health: cached('reportHealth', () => listHealthDays(getDb())),
      turningPoints: cached('reportTurningPoints', () => listTurningPoints(getDb())),
    }),
    [],
  );
  return { ...rest, catalog, today };
}

export function reportHtml(source: ReportSource, options: ReportOptions, t: Translate): string {
  const report = buildReport(source, options);
  return renderReportHtml(report, t, (id) => activityLabel(source.catalog, id), currentLanguage());
}

export type ReportDelivery = 'share' | 'save';

/**
 * Renders the PDF on the device (Android's print framework in a WebView, no network) and hands it
 * to the share sheet or a folder the user picks. Returns false when the folder pick was cancelled.
 * The share sheet needs its copy (`daylight-…` in the cache) for as long as the receiving app reads
 * it, which Android does not report; it goes with the next report of the same day or with
 * "Alle Daten löschen".
 */
export function useCreateReport(): (source: ReportSource, options: ReportOptions, delivery: ReportDelivery) => Promise<boolean> {
  const { t } = useTranslation();
  return async (source, options, delivery) => {
    const html = reportHtml(source, options, (key, values) => t(key, values) as string);
    const { base64, uri } = await Print.printToFileAsync({ html, width: PAGE_WIDTH, height: PAGE_HEIGHT, base64: true });
    // expo-print leaves the PDF in `cache/Print/`; only the base64 is used, so the file goes right away.
    discardFile(uri);
    if (!base64) throw new Error('No PDF content');
    const name = `${t('report.fileName')}-${source.today}.pdf`;
    if (delivery === 'share') {
      await shareBase64(name, 'application/pdf', base64);
      return true;
    }
    return saveBase64ToPickedDirectory(name, 'application/pdf', base64);
  };
}
