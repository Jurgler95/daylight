import type { Language } from '@/lib/i18n/language';

/**
 * Crisis lines for the "Talking helps" note, by the device's region, not by the app's language: a
 * Spanish phone in Mexico needs a Mexican number. Only national lines whose service is free,
 * checked in October 2026; Italy's is a Milan number at the normal call rate. A region without an
 * entry gets the note without a number.
 */
export interface Helpline {
  name: string;
  /** The name in another language of the country, where the line has one. */
  localNames?: Partial<Record<Language, string>>;
  /** As people write it in that country. */
  number: string;
  /** Daily hours, or null when the line answers around the clock. */
  hours: { from: number; to: number } | null;
}

const ALL_DAY = null;
const SAMARITANS: Helpline = { name: 'Samaritans', number: '116 123', hours: ALL_DAY };
const LIFELINE: Helpline = { name: '988 Lifeline', number: '988', hours: ALL_DAY };

const HELPLINES: Record<string, Helpline> = {
  DE: { name: 'TelefonSeelsorge', number: '0800 111 0 111', hours: ALL_DAY },
  AT: { name: 'Telefonseelsorge', number: '142', hours: ALL_DAY },
  CH: { name: 'Die Dargebotene Hand', localNames: { fr: 'La Main Tendue', it: 'Telefono Amico' }, number: '143', hours: ALL_DAY },
  ES: { name: 'Línea 024', number: '024', hours: ALL_DAY },
  FR: { name: 'Numéro national de prévention du suicide', number: '3114', hours: ALL_DAY },
  IT: { name: 'Telefono Amico Italia', number: '02 2327 2327', hours: { from: 9, to: 24 } },
  BR: { name: 'CVV', number: '188', hours: ALL_DAY },
  MX: { name: 'Línea de la Vida', number: '800 911 2000', hours: ALL_DAY },
  US: LIFELINE,
  CA: { name: '9-8-8', number: '988', hours: ALL_DAY },
  GB: SAMARITANS,
  IE: SAMARITANS,
};

/** The region of a locale like "pt-BR", "de_AT" or "zh-Hans-CN", upper case, or null. */
export function regionOf(locale: string): string | null {
  return locale.split(/[-_]/).find((part, index) => index > 0 && /^[a-z]{2}$/i.test(part))?.toUpperCase() ?? null;
}

export function helplineFor(locale: string): Helpline | null {
  const region = regionOf(locale);
  return region ? (HELPLINES[region] ?? null) : null;
}

/** The line for the device's region; without Intl, none. */
export function deviceHelpline(): Helpline | null {
  try {
    return helplineFor(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return null;
  }
}

/** The name a user of `language` knows the line by. */
export function helplineName(helpline: Helpline, language: Language): string {
  return helpline.localNames?.[language] ?? helpline.name;
}

/** "tel:08001110111". */
export function dialUrl(helpline: Helpline): string {
  return `tel:${helpline.number.replace(/\D/g, '')}`;
}
