/**
 * What a language needs beyond the texts in `locales/`: the names the app creates on first start
 * (moods, groups, starter activities), the names it recognizes on import, and the sample data. One
 * file per language next to this one; German and English live in `lib/daylio/known.ts` and
 * `lib/dev/english.ts`, which these keys come from.
 */

export type GroupKey = 'feelings' | 'sleep' | 'weather' | 'social' | 'work' | 'leisure' | 'imported';

/** Every standard activity by its German name. "Gut", "Mäßig" and "Schlecht" are the sleep ones. */
export type ActivityKey =
  | 'Glücklich'
  | 'Aufgeregt'
  | 'Dankbar'
  | 'Entspannt'
  | 'Zufrieden'
  | 'Müde'
  | 'Unsicher'
  | 'Gelangweilt'
  | 'Angespannt'
  | 'Wütend'
  | 'Gestresst'
  | 'Traurig'
  | 'Verzweifelt'
  | 'Krank'
  | 'Gut'
  | 'Mäßig'
  | 'Schlecht'
  | 'Sonnig'
  | 'Wolkig'
  | 'Regnerisch'
  | 'Wind'
  | 'Hitze'
  | 'Schnee'
  | 'Sturm'
  | 'Familie'
  | 'Freunde'
  | 'Besuche'
  | 'Date'
  | 'Party'
  | 'Arbeit'
  | 'Planmäßig beenden'
  | 'Überstunden'
  | 'HomeOffice'
  | 'Teambuilding'
  | 'Urlaub'
  | 'Krankheitstag'
  | 'zu Hause'
  | 'Einkaufen'
  | 'Reisen'
  | 'Natur'
  | 'Filme'
  | 'Restaurant'
  | 'Entspannen'
  | 'Lesen'
  | 'Spielen'
  | 'Sport';

/** Every sentence of the sample notes (`lib/dev/notes.ts`) by its German text. */
export type SentenceKey =
  | 'Im Büro viel geschafft.'
  | 'Lange Besprechung, danach Ruhe.'
  | 'Projekt kommt voran, aber zäh.'
  | 'Pünktlich Feierabend gemacht.'
  | 'Früh raus, gut so.'
  | 'Wieder länger geblieben, das zieht.'
  | 'Abgabe drückt, bis spät gearbeitet.'
  | 'Abendessen mit der Familie.'
  | 'Lange mit meiner Schwester telefoniert.'
  | 'Mit den Eltern spazieren gewesen.'
  | 'Besuch zum Kaffee, war schön.'
  | 'Freunde der Familie waren da.'
  | 'Mit Freunden unterwegs.'
  | 'Endlich mal wieder alle zusammen.'
  | 'Geburtstag gefeiert, laut und lustig.'
  | 'Ausgeschlafen, Meer gesehen.'
  | 'Urlaubstag ohne Plan.'
  | 'Neue Stadt erkundet, müde Füße.'
  | 'Krank im Bett, Tee und Serien.'
  | 'Sonne getankt.'
  | 'Draußen gesessen, herrlich.'
  | 'Regen den ganzen Tag.'
  | 'Nass geworden auf dem Heimweg.'
  | 'Großeinkauf erledigt.'
  | 'Neue Schuhe gekauft.'
  | 'Im Wald gewesen, ganz still dort.'
  | 'Schlecht geschlafen, zäher Start.'
  | 'Richtig guter Tag.'
  | 'Alles hat gepasst.'
  | 'Viel gelacht.'
  | 'Ein ruhiger, guter Tag.'
  | 'Zufrieden ins Bett.'
  | 'Solide.'
  | 'Nichts Besonderes.'
  | 'Etwas durchwachsen.'
  | 'Geht so, morgen wird besser.'
  | 'Anstrengend.'
  | 'Kopf voll, wenig Energie.'
  | 'Streit gehabt, das hängt nach.'
  | 'Harter Tag.'
  | 'Einfach alles zu viel.'
  | 'Jemand sagte: "Morgen ist auch noch ein Tag", und hatte recht.'
  | 'Mittags kurz notiert.';

export interface LanguageContent {
  /** The five default moods, best first (levels 5 to 1). */
  moods: readonly [string, string, string, string, string];
  groups: Record<GroupKey, string>;
  /** Unique within the language, also after folding case and accents. */
  activities: Record<ActivityKey, string>;
  sample: {
    /** The sample scale, "Energie" in German. */
    scale: string;
    titles: Record<'Kurzer Tag' | 'Notiz' | 'Merken', string>;
    sentences: Record<SentenceKey, string>;
  };
}
