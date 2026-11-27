import type { Outlook } from './outlook';
import type { GoodTomorrow } from './tomorrow';

/**
 * Whether the outlook speaks against the hint "Morgen könnte ein guter Tag werden". Both look at
 * tomorrow with models of their own, and both cards sit on tomorrow's page, so the hint gives way
 * where the outlook's range for that day names a chance of a hard day, or where even its upper end
 * stays below the level the hint calls good. The outlook is the calmer statement; a cheerful hint
 * above a warning would read as a contradiction. Without a range for that day nothing contradicts.
 */
export function outlookContradicts(hint: GoodTomorrow, outlook: Outlook): boolean {
  if (outlook.status !== 'ready') return false;
  const range = outlook.days.find((day) => day.date === hint.date)?.range;
  if (!range) return false;
  return range.hardChance !== null || range.highLevel < hint.level;
}
