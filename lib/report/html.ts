import type { MoodLevel } from '@/db/schema';
import { formatMonthLong, formatMonthShort, formatNumeric, formatRange, formatShort, formatWeekdayShort } from '@/lib/dates';
import { formatDuration } from '@/lib/health/format';
import { formatDecimal } from '@/lib/insights/format';
import { formatEntryValue, formatScaleValue } from '@/lib/scales/format';
import { roundToDecimals } from '@/lib/scales/number';
import { numberChartRange } from '@/lib/scales/range';
import { moodColors } from '@/lib/theme/tokens';

import { FEW_DAYS, MIN_MONTH_VALUES, type Report, type ReportScale } from './model';

/**
 * The report as a self-contained HTML page for the print WebView: A4, no script, no external
 * resource, the chart as inline SVG. Mood is never told by colour alone: every dot sits at its
 * level's height and every legend carries the number. Pure; texts come in through `t`.
 */

export type Translate = (key: string, options?: Record<string, unknown>) => string;

/** A4 at the 72 points per inch the print module renders with. */
export const PAGE_WIDTH = 595;
export const PAGE_HEIGHT = 842;
const MARGIN = 34;
/** Width of the chart in points: the page less its margins. */
const CHART_WIDTH = PAGE_WIDTH - 2 * MARGIN;

const INK = '#1d2330';
const MUTED = '#4a5263';
const FAINT = '#8a91a1';
const LINE = '#e3e6ec';

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function color(level: MoodLevel): string {
  return moodColors[level].strong;
}

function dot(level: MoodLevel): string {
  return `<span class="dot" style="background:${color(level)}">${level}</span>`;
}

function scaleValue(scale: Pick<ReportScale, 'kind' | 'unit' | 'decimals'>, value: number): string {
  if (scale.kind === 'duration') return formatDuration(value);
  // A number as entered, with its unit; a mean of several with at least one decimal.
  if (scale.kind === 'number') return roundToDecimals(value, scale.decimals) === value ? formatEntryValue(scale, value) : formatScaleValue(scale, value);
  // One entry gives a whole number; a mean of several keeps its decimal.
  return Number.isInteger(value) ? String(value) : formatDecimal(value);
}

function sleepValue(minutes: number): string {
  return formatDuration(minutes);
}

const n = (value: number) => Math.round(value * 10) / 10;

/** Mood dots, measured sleep, each chosen scale and the activity strips on one time axis. */
function chart(report: Report, t: Translate): string {
  const days = report.days;
  const count = days.length;
  const left = 84;
  const width = CHART_WIDTH;
  const step = (width - left) / count;
  const x = (index: number) => left + step * index + step / 2;
  const top = 10;
  const moodHeight = 112;
  const y = (value: number) => top + ((5 - value) / 4) * moodHeight;
  const radius = Math.max(1.3, Math.min(2.8, step * 0.42));
  const bar = Math.max(0.6, step - Math.min(1.6, step * 0.25));
  const parts: string[] = [];
  const label = (text: string, yy: number, size = 8.5, fill = MUTED) =>
    `<text x="${left - 6}" y="${n(yy)}" font-size="${size}" fill="${fill}" text-anchor="end">${escapeHtml(text)}</text>`;

  for (const { level, label: name } of report.levels) {
    const yy = y(level);
    parts.push(`<line x1="${left}" x2="${width}" y1="${n(yy)}" y2="${n(yy)}" stroke="${LINE}" stroke-width="0.7"/>`);
    parts.push(`<circle cx="${left - 10}" cy="${n(yy)}" r="6" fill="${color(level)}"/>`);
    parts.push(`<text x="${left - 10}" y="${n(yy + 2.9)}" font-size="8" font-weight="700" fill="#fff" text-anchor="middle">${level}</text>`);
    parts.push(`<text x="${left - 20}" y="${n(yy + 3)}" font-size="8.5" fill="${MUTED}" text-anchor="end">${escapeHtml(name)}</text>`);
  }
  days.forEach((day, index) => {
    if (day.mean === null || day.level === null) return;
    if (day.levels.length > 1) {
      const low = Math.min(...day.levels);
      const high = Math.max(...day.levels);
      if (low !== high) parts.push(`<line x1="${n(x(index))}" x2="${n(x(index))}" y1="${n(y(high))}" y2="${n(y(low))}" stroke="${FAINT}" stroke-width="1.2"/>`);
    }
    parts.push(`<circle cx="${n(x(index))}" cy="${n(y(day.mean))}" r="${n(radius)}" fill="${color(day.level)}" stroke="#fff" stroke-width="0.6"/>`);
  });

  let row = top + moodHeight + 16;
  if (report.sleep) {
    const height = 40;
    const max = 600;
    parts.push(label(t('report.sleep'), row + 11));
    parts.push(label(t('report.measured'), row + 21, 7.5, FAINT));
    const hourLines = [4, 8].map((hours) => ({ hours, yy: row + height - ((hours * 60) / max) * height }));
    for (const { yy } of hourLines) parts.push(`<line x1="${left}" x2="${width}" y1="${n(yy)}" y2="${n(yy)}" stroke="#eceef3" stroke-width="0.7"/>`);
    days.forEach((day, index) => {
      if (day.sleep === null) return;
      const h = (Math.min(day.sleep, max) / max) * height;
      parts.push(`<rect x="${n(left + step * index + (step - bar) / 2)}" y="${n(row + height - h)}" width="${n(bar)}" height="${n(h)}" fill="#5b6478"/>`);
    });
    // Over the bars, with a white halo, so a full night does not hide them.
    for (const { hours, yy } of hourLines) {
      parts.push(`<text x="${width}" y="${n(yy - 1.5)}" font-size="7" fill="${MUTED}" stroke="#fff" stroke-width="2.2" paint-order="stroke" text-anchor="end">${hours} h</text>`);
    }
    row += height + 8;
  }
  for (const scale of report.scales) {
    const height = 18;
    const values = days.flatMap((day) => day.scales.get(scale.id) ?? []);
    // A number has no range of its own; the axis hugs the period's values, and the label says which.
    const [low, high] = scale.kind === 'number' ? numberChartRange(values, scale.decimals) : [scale.min, scale.max];
    const span = scale.kind === 'number' ? high - low : Math.max(1, scale.max - scale.min);
    parts.push(label(scale.name, row + 8));
    if (scale.kind === 'rating') parts.push(label(t('report.scaleRange', { min: scale.min, max: scale.max }), row + 17, 7, FAINT));
    if (scale.kind === 'number' && values.length > 0) {
      const range = t('report.scaleRange', { min: formatEntryValue(scale, Math.min(...values)), max: formatEntryValue(scale, Math.max(...values)) });
      parts.push(label(range, row + 17, 7, FAINT));
    }
    // Durations have no useful upper end; the longest day in the period fills the row.
    const longest = Math.max(60, ...days.map((day) => day.scales.get(scale.id) ?? 0));
    days.forEach((day, index) => {
      const value = day.scales.get(scale.id);
      if (value === undefined) return;
      const share = scale.kind === 'duration' ? Math.min(1, value / longest) : (value - low) / span;
      const h = Math.max(1, share * height);
      parts.push(`<rect x="${n(left + step * index + (step - bar) / 2)}" y="${n(row + height - h)}" width="${n(bar)}" height="${n(h)}" fill="${FAINT}"/>`);
    });
    row += height + 8;
  }
  for (const activity of report.chartActivities) {
    parts.push(label(activity.label, row + 7));
    days.forEach((day, index) => {
      if (day.activities.includes(activity.id)) parts.push(`<rect x="${n(left + step * index + (step - bar) / 2)}" y="${n(row)}" width="${n(bar)}" height="7.5" fill="${INK}"/>`);
    });
    row += 11;
  }
  const bottom = row;
  days.forEach((day, index) => {
    if (index !== 0 && !day.date.endsWith('-01')) return;
    const xx = left + step * index;
    if (index !== 0) parts.push(`<line x1="${n(xx)}" x2="${n(xx)}" y1="${top - 4}" y2="${n(bottom - 2)}" stroke="#c9ced8" stroke-width="0.6" stroke-dasharray="2 2"/>`);
    // A first month that starts late gets no label of its own when the next one follows within a few days.
    if (index === 0 && !day.date.endsWith('-01') && days.slice(1, 8).some((d) => d.date.endsWith('-01')) && count > 60) return;
    parts.push(`<text x="${n(xx + 2)}" y="${n(bottom + 8)}" font-size="8" fill="${MUTED}">${escapeHtml(formatMonthShort(day.date))}</text>`);
  });
  report.turningPoints.forEach((point, number) => {
    const index = days.findIndex((day) => day.date === point.date);
    if (index < 0) return;
    const xx = x(index);
    parts.push(`<line x1="${n(xx)}" x2="${n(xx)}" y1="${top - 6}" y2="${n(top + moodHeight + 4)}" stroke="${INK}" stroke-width="0.8"/>`);
    parts.push(`<circle cx="${n(xx)}" cy="${top - 6}" r="5" fill="${INK}"/>`);
    parts.push(`<text x="${n(xx)}" y="${top - 3.3}" font-size="7" font-weight="700" fill="#fff" text-anchor="middle">${number + 1}</text>`);
  });
  const height = bottom + 12;
  return `<svg width="${width}" height="${n(height)}" viewBox="-2 -12 ${width + 4} ${n(height + 12)}" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">${parts.join('')}</svg>`;
}

function kpi(value: string, labelText: string): string {
  return `<div class="kpi"><div class="v">${escapeHtml(value)}</div><div class="l">${escapeHtml(labelText)}</div></div>`;
}

function firstPage(report: Report, t: Translate): string {
  const hardLabel = report.levels.find((level) => level.level === 2)?.label ?? '2';
  const kpis = [
    kpi(t('report.ofDays', { days: report.daysWithEntry, total: report.length }), t('report.kpiDays')),
    kpi(report.meanMood === null ? '' : formatDecimal(report.meanMood), t('report.kpiMean')),
    kpi(t('report.daysCount', { count: report.hardDays }), t('report.kpiHard', { mood: hardLabel })),
  ];
  if (report.sleep) kpis.push(kpi(formatDuration(report.sleep.mean), t('report.kpiSleep', { nights: report.sleep.days })));

  const legend = report.levels.map(({ level, label }) => `<span class="chip">${dot(level)}${escapeHtml(label)}</span>`).join('');
  const maxDays = Math.max(1, ...report.distribution.map((row) => row.days));
  const distribution = report.distribution
    .map(
      (row) =>
        `<div class="drow"><span class="chip">${dot(row.level)}${escapeHtml(row.label)}</span><div class="track"><div class="bar" style="width:${n((row.days / maxDays) * 100)}%;background:${color(row.level)}"></div></div><span class="num">${escapeHtml(t('report.daysCount', { count: row.days }))}</span></div>`,
    )
    .join('');

  const monthHead = [t('report.month'), t('report.meanMood'), ...(report.sleep ? [t('report.meanSleep')] : []), ...report.scales.map((scale) => `Ø ${scale.name}`)];
  const tooFew = `<span class="faint">${escapeHtml(t('report.tooFew'))}</span>`;
  const monthRows = report.months
    .map((month) => {
      const cells = [
        escapeHtml(formatMonthLong(month.month)),
        month.mean === null ? '' : formatDecimal(month.mean),
        ...(report.sleep ? [month.sleep === null ? tooFew : sleepValue(month.sleep)] : []),
        ...report.scales.map((scale, index) => {
          const value = month.scales[index];
          return value === null || value === undefined ? tooFew : escapeHtml(scaleValue(scale, value));
        }),
      ];
      return `<tr>${cells.map((cell, index) => `<td${index ? ' class="num"' : ''}>${cell}</td>`).join('')}</tr>`;
    })
    .join('');
  const turning = report.turningPoints.length
    ? `<h2>${escapeHtml(t('report.turningPoints'))}</h2><div class="turning">${report.turningPoints
        .map((point, index) => `<div><b>${index + 1}</b> ${escapeHtml(formatShort(point.date))}: ${escapeHtml(point.title)}</div>`)
        .join('')}</div>`
    : '';
  const talking = report.talkingPoints
    ? `<div class="talk"><div class="talk-title">${escapeHtml(t('report.talkingPoints'))}</div>${escapeHtml(report.talkingPoints).replace(/\n/g, '<br>')}</div>`
    : '';

  return `<section>
<div class="head"><div><h1>${escapeHtml(t('report.title'))}</h1>${report.name ? `<div class="sub">${escapeHtml(report.name)}</div>` : ''}<div class="legend">${legend}</div></div>
<div class="meta">${escapeHtml(t('report.period'))} <b>${escapeHtml(formatRange(report.from, report.to))}</b><br>${escapeHtml(t('report.daysCount', { count: report.length }))}<br>${escapeHtml(t('report.created', { date: formatNumeric(report.to) }))}</div></div>
<div class="disclaimer">${escapeHtml(t('report.disclaimer'))}</div>
${talking}
<h2>${escapeHtml(t('report.overview'))}</h2><div class="kpis k${kpis.length}">${kpis.join('')}</div>
<h2>${escapeHtml(t('report.course'))}</h2>${chart(report, t)}
<div class="note">${escapeHtml(t('report.chartNote'))}</div>
<div class="two"><div><h2>${escapeHtml(t('report.distribution'))}</h2>${distribution}</div>
<div><h2>${escapeHtml(t('report.months'))}</h2><table><thead><tr>${monthHead.map((head, index) => `<th${index ? ' class="num"' : ''}>${escapeHtml(head)}</th>`).join('')}</tr></thead><tbody>${monthRows}</tbody></table>
${report.sleep || report.scales.length ? `<div class="note">${escapeHtml(t('report.monthsNote', { min: MIN_MONTH_VALUES }))}</div>` : ''}${turning}</div></div>
</section>`;
}

function activityPage(report: Report, t: Translate): string {
  if (!report.activityTable?.length) return '';
  const rows = report.activityTable
    .map(
      (group) =>
        `<tr class="grp"><td colspan="5">${escapeHtml(group.name)}</td></tr>` +
        group.rows
          .map((row) => {
            const bars = ([5, 4, 3, 2, 1] as const).map((level) => `<div style="width:${n((row.levels[level] / row.days) * 100)}%;background:${color(level)}"></div>`).join('');
            return `<tr${row.days < FEW_DAYS ? ' class="few"' : ''}><td>${escapeHtml(row.label)}</td><td class="num">${row.days}</td><td class="num">${formatDecimal(row.withMean)}</td><td class="num">${row.withoutMean === null ? '' : formatDecimal(row.withoutMean)}</td><td><div class="stack">${bars}</div></td></tr>`;
          })
          .join(''),
    )
    .join('');
  return `<section class="page">
<h2 class="first">${escapeHtml(t('report.activities'))}</h2>
<table><thead><tr><th>${escapeHtml(t('report.activity'))}</th><th class="num">${escapeHtml(t('report.days'))}</th><th class="num">${escapeHtml(t('report.withMean'))}</th><th class="num">${escapeHtml(t('report.withoutMean'))}</th><th class="w-stack">${escapeHtml(t('report.spread'))}</th></tr></thead><tbody>${rows}</tbody></table>
<div class="note">${escapeHtml(t('report.activitiesNote', { min: FEW_DAYS }))}</div>
</section>`;
}

function dayListPage(report: Report, t: Translate, activityName: (id: number) => string): string {
  if (!report.dayList) return '';
  const days = report.days.filter((day) => day.levels.length > 0);
  const head = [
    `<th class="w-date">${escapeHtml(t('report.date'))}</th>`,
    `<th class="w-mood">${escapeHtml(t('report.mood'))}</th>`,
    ...(report.sleep ? [`<th class="num w-num">${escapeHtml(t('report.sleep'))}</th>`] : []),
    ...report.scales.map((scale) => `<th class="num w-num">${escapeHtml(scale.name)}</th>`),
    `<th>${escapeHtml(t('report.activitiesColumn'))}</th>`,
  ];
  const columns = head.length;
  const rows = days
    .map((day) => {
      const cells = [
        `<td>${escapeHtml(`${formatWeekdayShort(day.date)} ${formatShort(day.date)}`)}</td>`,
        `<td>${day.levels.map(dot).join('')}</td>`,
        ...(report.sleep ? [`<td class="num">${day.sleep === null ? '' : sleepValue(day.sleep)}</td>`] : []),
        ...report.scales.map((scale) => {
          const value = day.scales.get(scale.id);
          return `<td class="num">${value === undefined ? '' : escapeHtml(scaleValue(scale, value))}</td>`;
        }),
        `<td>${escapeHtml(day.activities.map(activityName).filter(Boolean).join(', '))}</td>`,
      ];
      const note = day.notes.length ? `<tr class="noterow"><td></td><td colspan="${columns - 1}">${day.notes.map((text) => escapeHtml(text).replace(/\n/g, '<br>')).join('<br><br>')}</td></tr>` : '';
      return `<tbody class="day"><tr>${cells.join('')}</tr>${note}</tbody>`;
    })
    .join('');
  const notesLine = !report.notes && report.daysWithNote > 0 ? ` ${t('report.notesLeftOut', { days: report.daysWithNote })}` : '';
  return `<section class="page">
<h2 class="first">${escapeHtml(t('report.dayList'))}</h2>
<table class="days"><thead><tr>${head.join('')}</tr></thead>${rows}</table>
<div class="note">${escapeHtml(t('report.dayListNote') + notesLine)}</div>
</section>`;
}

const STYLE = `
@page { size: ${PAGE_WIDTH}px ${PAGE_HEIGHT}px; margin: ${MARGIN}px; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #fff; }
body { color: ${INK}; font-family: Roboto, "Noto Sans", Arial, sans-serif; font-size: 9.5px; line-height: 1.38; }
h1 { font-size: 17px; margin: 0; }
h2 { font-size: 9.5px; margin: 14px 0 5px; text-transform: uppercase; letter-spacing: .5px; color: ${MUTED}; }
h2.first { margin-top: 0; }
.page { break-before: page; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 1.3px solid ${INK}; padding-bottom: 8px; }
.sub { margin-top: 2px; color: ${MUTED}; font-size: 10.5px; }
.meta { text-align: right; color: ${MUTED}; white-space: nowrap; }
.meta b { color: ${INK}; }
.legend { display: flex; flex-wrap: wrap; gap: 4px 9px; margin-top: 7px; color: ${MUTED}; }
.chip { display: inline-flex; align-items: center; gap: 3px; }
.dot { width: 12px; height: 12px; border-radius: 50%; color: #fff; font-size: 7.5px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; margin-right: 2px; }
.disclaimer { color: ${FAINT}; font-size: 8px; margin-top: 4px; }
.talk { margin-top: 10px; border: 1px solid #c9ced8; border-radius: 5px; padding: 6px 8px; }
.talk-title { font-weight: 700; margin-bottom: 2px; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.kpis.k3 { grid-template-columns: repeat(3, 1fr); }
.kpi { border: 1px solid #d6dae3; border-radius: 5px; padding: 5px 7px; }
.kpi .v { font-size: 14px; font-weight: 700; }
.kpi .l { color: ${MUTED}; font-size: 8px; }
.note { color: #6b7385; font-size: 8px; margin-top: 4px; }
.faint { color: #9aa0ad; }
.two { display: grid; grid-template-columns: 1fr 1.15fr; gap: 16px; }
.drow { display: grid; grid-template-columns: 70px 1fr 46px; align-items: center; gap: 5px; margin-bottom: 2px; }
.track { background: #f1f2f6; border-radius: 2px; }
.bar { height: 8px; border-radius: 2px; }
.drow .num { text-align: right; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
th { text-align: left; font-weight: 600; color: ${MUTED}; border-bottom: 1px solid ${INK}; padding: 3px; font-size: 8.5px; }
td { padding: 2.5px 3px; border-bottom: 1px solid #e6e9ef; vertical-align: top; }
.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
tr { break-inside: avoid; }
tbody.day { break-inside: avoid; }
tr.grp td { font-weight: 700; color: ${MUTED}; padding-top: 7px; border-bottom: none; }
tr.few td { color: #9aa0ad; }
tr.few .stack { opacity: .45; }
.stack { display: flex; height: 8px; border-radius: 2px; overflow: hidden; margin-top: 2px; }
.w-stack { width: 140px; }
.w-date { width: 62px; } .w-mood { width: 52px; } .w-num { width: 42px; }
.noterow td { color: ${MUTED}; border-bottom: 1px solid #e6e9ef; padding-top: 0; font-size: 8.5px; }
.days tbody.day tr:first-child td { border-bottom: none; }
.days tbody.day tr:last-child td { border-bottom: 1px solid #e6e9ef; }
.turning div { margin-bottom: 2px; }
svg { display: block; margin-top: 4px; }
.end { margin-top: 14px; color: ${FAINT}; font-size: 8px; border-top: 1px solid #d6dae3; padding-top: 5px; }
`;

export function renderReportHtml(report: Report, t: Translate, activityName: (id: number) => string, language: string): string {
  return `<!DOCTYPE html><html lang="${escapeHtml(language)}"><head><meta charset="utf-8"><title>${escapeHtml(t('report.title'))}</title><style>${STYLE}</style></head><body>
${firstPage(report, t)}
${activityPage(report, t)}
${dayListPage(report, t, activityName)}
<div class="end">${escapeHtml(t('report.disclaimer'))}</div>
</body></html>`;
}
