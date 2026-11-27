export { escapeHtml, PAGE_HEIGHT, PAGE_WIDTH, renderReportHtml, type Translate } from './html';
export {
  activityDays,
  buildReport,
  DEFAULT_PERIOD,
  defaultReportOptions,
  FEW_DAYS,
  hasSleep,
  MAX_CHART_ACTIVITIES,
  MIN_MONTH_VALUES,
  MIN_TABLE_DAYS,
  REPORT_PERIODS,
  reportWindow,
  scalesWithValues,
  type Report,
  type ReportDay,
  type ReportEntry,
  type ReportOptions,
  type ReportPeriod,
  type ReportSource,
} from './model';
export { reportHtml, useCreateReport, useReportSource, type ReportDelivery } from './useReport';
