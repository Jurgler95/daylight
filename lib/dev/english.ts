import type { SampleData } from './generateSample';

/**
 * English version of the sample data. The generator stays German, so seeds and tests are the same
 * in both languages; this maps every name and every note sentence afterwards.
 */

const MOODS: Record<string, string> = { Super: 'Great', Gut: 'Good', Ok: 'Okay', Schlecht: 'Bad', Mies: 'Awful' };

/** Sleep shares "Gut" and "Schlecht" with the moods, so activities get their own table. */
const ACTIVITIES: Record<string, string> = {
  Glücklich: 'Happy',
  Aufgeregt: 'Excited',
  Dankbar: 'Grateful',
  Entspannt: 'Relaxed',
  Zufrieden: 'Content',
  Müde: 'Tired',
  Unsicher: 'Unsure',
  Angespannt: 'Anxious',
  Wütend: 'Angry',
  Gestresst: 'Stressed',
  Traurig: 'Sad',
  Verzweifelt: 'Desperate',
  Gut: 'Good sleep',
  Mäßig: 'Medium sleep',
  Schlecht: 'Bad sleep',
  Sonnig: 'Sunny',
  Wolkig: 'Cloudy',
  Regnerisch: 'Rainy',
  Wind: 'Windy',
  Hitze: 'Heat',
  Schnee: 'Snow',
  Sturm: 'Storm',
  Familie: 'Family',
  Freunde: 'Friends',
  Besuche: 'Visits',
  Party: 'Party',
  Arbeit: 'Work',
  'Planmäßig beenden': 'Left on time',
  Überstunden: 'Overtime',
  HomeOffice: 'Work from home',
  Teambuilding: 'Team building',
  Urlaub: 'Vacation',
  Krankheitstag: 'Sick day',
  'zu Hause': 'Home',
  Einkaufen: 'Shopping',
  Reisen: 'Travel',
  Natur: 'Nature',
  Filme: 'Movies',
  Restaurant: 'Restaurant',
};

const TITLES: Record<string, string> = { 'Kurzer Tag': 'Short day', Notiz: 'Note', Merken: 'Remember' };

const SENTENCES: Record<string, string> = {
  'Im Büro viel geschafft.': 'Got a lot done at the office.',
  'Lange Besprechung, danach Ruhe.': 'Long meeting, quiet afterwards.',
  'Projekt kommt voran, aber zäh.': 'The project is moving, slowly.',
  'Pünktlich Feierabend gemacht.': 'Left work on time.',
  'Früh raus, gut so.': 'Out early, felt right.',
  'Wieder länger geblieben, das zieht.': 'Stayed late again, it wears on me.',
  'Abgabe drückt, bis spät gearbeitet.': 'Deadline pressure, worked until late.',
  'Abendessen mit der Familie.': 'Dinner with the family.',
  'Lange mit meiner Schwester telefoniert.': 'Long call with my sister.',
  'Mit den Eltern spazieren gewesen.': 'Went for a walk with my parents.',
  'Besuch zum Kaffee, war schön.': 'Friends over for coffee, lovely.',
  'Freunde der Familie waren da.': 'Family friends came by.',
  'Mit Freunden unterwegs.': 'Out with friends.',
  'Endlich mal wieder alle zusammen.': 'Finally all together again.',
  'Geburtstag gefeiert, laut und lustig.': 'Birthday party, loud and fun.',
  'Ausgeschlafen, Meer gesehen.': 'Slept in, saw the sea.',
  'Urlaubstag ohne Plan.': 'A vacation day without a plan.',
  'Neue Stadt erkundet, müde Füße.': 'Explored a new city, tired feet.',
  'Krank im Bett, Tee und Serien.': 'Sick in bed, tea and series.',
  'Sonne getankt.': 'Soaked up the sun.',
  'Draußen gesessen, herrlich.': 'Sat outside, wonderful.',
  'Regen den ganzen Tag.': 'Rain all day.',
  'Nass geworden auf dem Heimweg.': 'Got soaked on the way home.',
  'Großeinkauf erledigt.': 'Did the big grocery run.',
  'Neue Schuhe gekauft.': 'Bought new shoes.',
  'Im Wald gewesen, ganz still dort.': 'Walked in the woods, so quiet.',
  'Schlecht geschlafen, zäher Start.': 'Slept badly, slow start.',
  'Richtig guter Tag.': 'A really good day.',
  'Alles hat gepasst.': 'Everything just fit.',
  'Viel gelacht.': 'Laughed a lot.',
  'Ein ruhiger, guter Tag.': 'A calm, good day.',
  'Zufrieden ins Bett.': 'Went to bed content.',
  'Solide.': 'Solid.',
  'Nichts Besonderes.': 'Nothing special.',
  'Etwas durchwachsen.': 'A bit mixed.',
  'Geht so, morgen wird besser.': 'So-so, tomorrow will be better.',
  'Anstrengend.': 'Exhausting.',
  'Kopf voll, wenig Energie.': 'Head full, little energy.',
  'Streit gehabt, das hängt nach.': 'Had an argument, still on my mind.',
  'Harter Tag.': 'Hard day.',
  'Einfach alles zu viel.': 'Simply too much.',
  'Jemand sagte: "Morgen ist auch noch ein Tag", und hatte recht.': 'Someone said: "Tomorrow is another day", and they were right.',
  'Mittags kurz notiert.': 'Quick note at lunch.',
};

/** Longest first, so no sentence is replaced inside a longer one. */
const SENTENCE_ORDER = Object.keys(SENTENCES).sort((a, b) => b.length - a.length);

function translateNote(note: string): string {
  let text = note;
  for (const german of SENTENCE_ORDER) text = text.split(german).join(SENTENCES[german] as string);
  return text;
}

const activity = (name: string) => ACTIVITIES[name] ?? name;

export const SAMPLE_SCALE_EN = { name: 'Energy', min: 1, max: 5 } as const;

export function sampleInEnglish(data: SampleData): SampleData {
  return {
    entries: data.entries.map((entry) => ({
      ...entry,
      mood: MOODS[entry.mood] ?? entry.mood,
      activities: entry.activities.map(activity),
      scales: entry.scales.map((scale) => ({ ...scale, name: SAMPLE_SCALE_EN.name })),
      noteTitle: entry.noteTitle === null ? null : (TITLES[entry.noteTitle] ?? entry.noteTitle),
      note: entry.note === null ? null : translateNote(entry.note),
    })),
    plans: data.plans.map((plan) => ({ ...plan, activity: activity(plan.activity) })),
  };
}
