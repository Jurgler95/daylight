import type { Random } from './random';

/**
 * Made-up note text for the sample data. Covers what the real export contains in shape only:
 * commas, quotation marks, line breaks, a few hundred characters at most.
 */

const BY_ACTIVITY: Record<string, readonly string[]> = {
  Arbeit: ['Im Büro viel geschafft.', 'Lange Besprechung, danach Ruhe.', 'Projekt kommt voran, aber zäh.'],
  'Planmäßig beenden': ['Pünktlich Feierabend gemacht.', 'Früh raus, gut so.'],
  Überstunden: ['Wieder länger geblieben, das zieht.', 'Abgabe drückt, bis spät gearbeitet.'],
  Familie: ['Abendessen mit der Familie.', 'Lange mit meiner Schwester telefoniert.', 'Mit den Eltern spazieren gewesen.'],
  Besuche: ['Besuch zum Kaffee, war schön.', 'Freunde der Familie waren da.'],
  Freunde: ['Mit Freunden unterwegs.', 'Endlich mal wieder alle zusammen.'],
  Party: ['Geburtstag gefeiert, laut und lustig.'],
  Urlaub: ['Ausgeschlafen, Meer gesehen.', 'Urlaubstag ohne Plan.', 'Neue Stadt erkundet, müde Füße.'],
  Krankheitstag: ['Krank im Bett, Tee und Serien.'],
  Sonnig: ['Sonne getankt.', 'Draußen gesessen, herrlich.'],
  Regnerisch: ['Regen den ganzen Tag.', 'Nass geworden auf dem Heimweg.'],
  Einkaufen: ['Großeinkauf erledigt.', 'Neue Schuhe gekauft.'],
  Natur: ['Im Wald gewesen, ganz still dort.'],
  Schlecht: ['Schlecht geschlafen, zäher Start.'],
};

const BY_LEVEL: Record<number, readonly string[]> = {
  5: ['Richtig guter Tag.', 'Alles hat gepasst.', 'Viel gelacht.'],
  4: ['Ein ruhiger, guter Tag.', 'Zufrieden ins Bett.', 'Solide.'],
  3: ['Nichts Besonderes.', 'Etwas durchwachsen.', 'Geht so, morgen wird besser.'],
  2: ['Anstrengend.', 'Kopf voll, wenig Energie.', 'Streit gehabt, das hängt nach.'],
  1: ['Harter Tag.', 'Einfach alles zu viel.'],
};

export function noteFor(random: Random, activities: readonly string[], level: number): string | null {
  if (random.chance(0.08)) return null;
  const pool = activities.flatMap((name) => BY_ACTIVITY[name] ?? []);
  const sentences = [random.pick(BY_LEVEL[level] ?? BY_LEVEL[3] ?? ['']), ...(pool.length ? [random.pick(pool)] : [])];
  if (pool.length > 1 && random.chance(0.4)) sentences.push(random.pick(pool));
  if (random.chance(0.06)) sentences.push('Jemand sagte: "Morgen ist auch noch ein Tag", und hatte recht.');
  const text = [...new Set(sentences)].join(' ');
  return random.chance(0.05) ? text.replace('. ', '.\n') : text;
}
