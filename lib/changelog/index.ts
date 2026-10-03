import type { Language } from '@/lib/i18n/language';

/**
 * Versionshistorie der App, gepflegt vom Deploy-Skill (`.claude/skills/deploy`).
 *
 * Neue Einträge kommen immer oben dazu. Jeder Punkt beschreibt eine Änderung, die in der App
 * sichtbar oder spürbar ist: keine Umbauten im Code, keine Abhängigkeiten, keine Tests.
 * Kurz halten, ein Satz pro Punkt. Jeder Eintrag steht auf Deutsch und Englisch, mit gleich vielen
 * Punkten in derselben Reihenfolge; die App zeigt die Sprache, die gerade eingestellt ist.
 */
export interface Release {
  /** Muss der `version` in `app.json` entsprechen. */
  version: string;
  /** Erscheinungsdatum als `YYYY-MM-DD`. */
  date: string;
  /** Kurze Stichpunkte je Sprache, jeweils ohne Satzzeichen am Ende. */
  changes: Record<Language, string[]>;
}

export const RELEASES: Release[] = [
  {
    version: '1.0.21',
    date: '2026-10-03',
    changes: {
      de: ['Überarbeitete Texte in der Updatehistorie'],
      en: ['Revised wording in the update history'],
    },
  },
  {
    version: '1.0.20',
    date: '2026-10-03',
    changes: {
      de: ['Beim ersten Start bringt jede Gruppe schon ein paar Aktivitäten mit, auf Deutsch oder Englisch'],
      en: ['On first start, every group already comes with a few activities, in English or German'],
    },
  },
  {
    version: '1.0.19',
    date: '2026-10-01',
    changes: {
      de: ['Beim Bearbeiten eines Tages legt das Plus in jeder Gruppe direkt eine neue Aktivität an', 'Viele neue Icons für Aktivitäten und Stimmungen zur Auswahl'],
      en: ['When editing a day, the plus in each group adds a new activity right away', 'Many new icons to choose from for activities and moods'],
    },
  },
  {
    version: '1.0.18',
    date: '2026-10-01',
    changes: {
      de: ['Beim ersten Start wählt die App Deutsch, wenn das Gerät auf Deutsch steht, sonst Englisch'],
      en: ['On first launch the app picks German if the device is set to German, otherwise English'],
    },
  },
  {
    version: '1.0.17',
    date: '2026-09-30',
    changes: {
      de: [
        '„Beispieldaten laden“ erzeugt ein Jahr auf Englisch, wenn die App auf Englisch eingestellt ist',
        'Beim Import englischer Dateien landen weitere Aktivitäten bei den passenden Standardaktivitäten',
      ],
      en: [
        '“Load sample data” creates a year in English when the app is set to English',
        'Importing English files matches more activities to the built-in ones',
      ],
    },
  },
  {
    version: '1.0.16',
    date: '2026-09-30',
    changes: {
      de: ['Erinnerungen kommen ohne Google-Dienste aus, die App enthält kein Firebase mehr'],
      en: ['Reminders work without Google services, the app no longer contains Firebase'],
    },
  },
  {
    version: '1.0.15',
    date: '2026-09-30',
    changes: {
      de: ['Die Updatehistorie gibt es jetzt auch auf Englisch'],
      en: ['The update history is now also available in English'],
    },
  },
  {
    version: '1.0.14',
    date: '2026-09-30',
    changes: {
      de: [
        'Daylight gibt es jetzt auch auf Englisch, umschalten lässt sich unter „Mehr“ bei „Sprache“',
        'Datum und Zahlen erscheinen passend zur gewählten Sprache',
        'Englische Dateien landen beim Import in den passenden Gruppen',
        'Neue Tagebücher starten mit eigenen Stimmungsnamen, die schwächste Stufe heißt jetzt „Mies“',
      ],
      en: [
        'Daylight is now also available in English, switch under “More” at “Language”',
        'Dates and numbers follow the chosen language',
        'English files land in the matching groups when imported',
        'New journals start with Daylight\'s own mood names: Great, Good, Okay, Bad and Awful',
      ],
    },
  },
  {
    version: '1.0.13',
    date: '2026-09-30',
    changes: {
      de: [
        'Daylight ist jetzt freie Software, Lizenz und Quellcode stehen unter „Über“',
        'Neuer Signaturschlüssel: vor dem Update eine Sicherung teilen, die alte App deinstallieren und die Sicherung danach wieder einspielen',
      ],
      en: [
        'Daylight is now free software, license and source code are under “About”',
        'New signing key: before updating, share a backup, uninstall the old app and restore the backup afterwards',
      ],
    },
  },
  {
    version: '1.0.12',
    date: '2026-09-28',
    changes: {
      de: [
        'Fotos in der Vollansicht lassen sich mit zwei Fingern oder per Doppeltipp vergrößern und im Zoom verschieben',
      ],
      en: [
        'Photos in full view can be zoomed with two fingers or a double tap and moved around while zoomed',
      ],
    },
  },
  {
    version: '1.0.11',
    date: '2026-09-28',
    changes: {
      de: [
        'Kleinere Korrekturen im Hintergrund',
      ],
      en: [
        'Minor fixes in the background',
      ],
    },
  },
  {
    version: '1.0.10',
    date: '2026-09-27',
    changes: {
      de: [
        'Ein Eintrag im Verlauf öffnet seinen Tag, bearbeitet wird von dort aus',
        'Heute ist aufgeräumt: ohne die Karte „Die nächsten Tage“ und ohne den Hinweis zum Schlaf',
      ],
      en: [
        'An entry in History opens its day, editing starts from there',
        'Today is tidier: without the “Next days” card and without the sleep note',
      ],
    },
  },
  {
    version: '1.0.9',
    date: '2026-09-27',
    changes: {
      de: [
        'Der Rückblick auf Heute zeigt die Fotos der Tage, ein Tipp öffnet sie groß',
      ],
      en: [
        'The look back on Today shows the photos of those days, a tap opens them full size',
      ],
    },
  },
  {
    version: '1.0.8',
    date: '2026-09-27',
    changes: {
      de: [
        'Zurück wechselt auf Android zum zuletzt geöffneten Tab, die App schließt sich erst auf Heute',
      ],
      en: [
        'Back on Android switches to the last opened tab, the app only closes on Today',
      ],
    },
  },
  {
    version: '1.0.7',
    date: '2026-09-27',
    changes: {
      de: [
        'Einblicke sind in Bereiche aufgeteilt: Stimmung, Muster, Aktivitäten, Gesundheit, Zusammenhänge und Notizen',
        'Gesundheit zeigt Verlauf, Wochentage, Ziele mit Serien und Bestwerte für Schlaf, Schritte, Ruhepuls und Training',
        'Zusammenhänge vergleichen gute und schwierige Tage und zeigen, wie Schlaf und Bewegung mit der Stimmung zusammengehen',
        'Aktivitäten lassen sich mit Schlaf in der Nacht danach, Schritten, Ruhepuls und Training vergleichen',
      ],
      en: [
        'Insights are split into sections: Mood, Patterns, Activities, Health, Connections and Notes',
        'Health shows trends, weekdays, goals with streaks and records for sleep, steps, resting heart rate and exercise',
        'Connections compare good and hard days and show how sleep and exercise go along with mood',
        'Activities can be compared with sleep the night after, steps, resting heart rate and exercise',
      ],
    },
  },
  {
    version: '1.0.6',
    date: '2026-09-27',
    changes: {
      de: [
        'Heute zeigt Schlaf, Schritte, Training und Ruhepuls des gewählten Tages',
        'Im Verlauf steht an jedem Eintrag eine kurze Zeile mit Schlaf, Schritten und Training',
      ],
      en: [
        'Today shows sleep, steps, exercise and resting heart rate of the selected day',
        'In History, every entry has a short line with sleep, steps and exercise',
      ],
    },
  },
  {
    version: '1.0.5',
    date: '2026-09-27',
    changes: {
      de: [
        'Schritte, Schlaf, Ruhepuls und Training kommen aus Health Connect, etwa von Samsung Health und der Galaxy Watch',
        'Abgeglichen wird beim Öffnen der App und rückwirkend bis zum ersten Eintrag, ein kleiner Kreis oben rechts zeigt es an',
        'Einblicke zeigen die Stimmung nach Schlaf, Schritten und Training',
        'Daylight liest nur und schreibt nichts nach Health Connect, die Gesundheitsdaten lassen sich jederzeit trennen und löschen',
      ],
      en: [
        'Steps, sleep, resting heart rate and exercise come from Health Connect, for example from Samsung Health and the Galaxy Watch',
        'Syncing happens when the app opens and goes back to the first entry, a small circle at the top right shows it',
        'Insights show mood by sleep, steps and exercise',
        'Daylight only reads and writes nothing to Health Connect, the health data can be disconnected and deleted at any time',
      ],
    },
  },
  {
    version: '1.0.4',
    date: '2026-09-27',
    changes: {
      de: [
        'Jeder Eintrag kann ein Foto haben, zu sehen in Heute, im Verlauf und groß per Tipp',
        'Sicherungen aus anderen Stimmungstagebüchern lassen sich importieren und bringen die Fotos zu vorhandenen Einträgen mit',
        'Mit Fotos ist die Sicherung eine ZIP-Datei, die alles wiederherstellt',
        'Kräftigere Farben mit blauem Akzent, der Kalender liegt auf einer weißen Fläche',
      ],
      en: [
        'Every entry can have a photo, shown on Today, in History and full size with a tap',
        'Backups from other mood journals can be imported and bring the photos to existing entries',
        'With photos, the backup is a ZIP file that restores everything',
        'Stronger colours with a blue accent, the calendar sits on a white surface',
      ],
    },
  },
  {
    version: '1.0.3',
    date: '2026-09-27',
    changes: {
      de: [
        'Neues Logo: ein Wellenring mit zwölf Stunden und einer Spirale, deren Sonne auf den Abend zeigt',
        'Das Logo liegt blass im Hintergrund jeder Seite, Karten lassen es leicht durchscheinen',
        'Sperrbildschirm, Über und die tägliche Erinnerung zeigen das Logo',
      ],
      en: [
        'New logo: a wave ring with twelve hours and a spiral whose sun points to the evening',
        'The logo lies faintly in the background of every page, cards let it show through slightly',
        'The lock screen, About and the daily reminder show the logo',
      ],
    },
  },
  {
    version: '1.0.2',
    date: '2026-09-26',
    changes: {
      de: [
        'Pro Tag gibt es einen Eintrag, ein weiterer Tipp auf den Tag öffnet den vorhandenen',
        'Einträge haben keinen Titel mehr, ein alter Titel steht als erste Zeile in der Notiz',
        'Beim Schreiben der Notiz rutscht der Text über die Tastatur',
        'Heute zeigt einen Rückblick auf den Tag vor einer Woche, einem Monat, sechs Monaten und einem Jahr',
        'Die Stimmung Ok ist jetzt gelb statt blau',
      ],
      en: [
        'There is one entry per day, another tap on the day opens the existing one',
        'Entries no longer have a title, an old title becomes the first line of the note',
        'While writing the note, the text moves above the keyboard',
        'Today shows a look back at the day a week, a month, six months and a year ago',
        'The mood Ok is now yellow instead of blue',
      ],
    },
  },
  {
    version: '1.0.1',
    date: '2026-09-26',
    changes: {
      de: [
        'Die App-Sperre fragt nach dem Entsperren mit der Geräte-PIN nicht gleich wieder',
        'Erinnerungen werden sauber neu gestellt, auch wenn kurz nacheinander etwas passiert',
        'Einblicke: längste Folge in voller Länge, Wörter nur aus Tagen mit Notiz, übliche Uhrzeit auch nach Mitternacht, Zahlen richtig gerundet',
        'Unter Mehr lässt sich wählen, ob die Woche am Montag oder am Sonntag beginnt',
        'Der Screenreader nennt am Hinweis auf die Telefonseelsorge ihren Namen',
      ],
      en: [
        'The app lock no longer asks again right after unlocking with the device PIN',
        'Reminders are rescheduled cleanly, even when several things happen in quick succession',
        'Insights: longest streak in full length, words only from days with a note, usual time also after midnight, numbers rounded correctly',
        'Under More you can choose whether the week starts on Monday or Sunday',
        'The screen reader names the TelefonSeelsorge on its note',
      ],
    },
  },
  {
    version: '1.0.0',
    date: '2026-09-26',
    changes: {
      de: [
        'Erste Version: Exporte aus anderen Stimmungstagebüchern lassen sich vollständig importieren',
        'Einträge mit Stimmung, Aktivitäten, Skalen und Notiz erfassen, auf Heute durch die Tage wischen',
        'Kalender mit Stimmungsfarbe und Symbol je Tag, Verlauf mit Suche und Filtern',
        'Stimmungen, Aktivitäten, Gruppen und Skalen verwalten, sortieren und zusammenführen',
        'Einblicke über 30 Tage, 90 Tage, ein Jahr oder alles: Verlauf, Verteilung, Jahr in Pixeln, Wochentage, Monate, Schwankung und Serien',
        'Aktivitäten im Vergleich: Stimmung mit und ohne, am Folgetag, oft zusammen, vor schwierigen Tagen, je Gruppe',
        'Häufige Wörter in Notizen und Umfang des Tagebuchs, alles nur auf dem Gerät berechnet',
        'Eigene Seite je Aktivität und je Stimmung',
        'Ausblick auf die nächsten sieben Tage, nur wo er bisher genauer war als „immer die häufigste Stimmung“, sonst Wochentage und Gewohntes',
        'Aktivitäten für künftige Tage planen, der Kalender zeigt sie an',
        'Tägliche Erinnerung zur gewählten Uhrzeit, die an Tagen mit Eintrag entfällt',
        'App-Sperre mit der Entsperrung des Geräts, Bildschirmfotos und Vorschau gesperrt',
        'Hinweis auf eine Sicherung nach 60 Tagen, ruhiger Hinweis auf die Telefonseelsorge nach vielen schweren Tagen',
        'Sicherung als JSON und Export als CSV',
        'Beispieldaten zum Ausprobieren',
      ],
      en: [
        'First version: exports from other mood journals can be imported completely',
        'Record entries with mood, activities, scales and note, swipe through the days on Today',
        'Calendar with mood colour and icon per day, History with search and filters',
        'Manage, sort and merge moods, activities, groups and scales',
        'Insights over 30 days, 90 days, a year or all: trend, distribution, year in pixels, weekdays, months, swings and streaks',
        'Activities compared: mood with and without, on the next day, often together, before hard days, per group',
        'Frequent words in notes and scope of the journal, all calculated only on the device',
        'A page for each activity and each mood',
        'Outlook on the next seven days, only where it was more accurate so far than “always the most frequent mood”, otherwise weekdays and habits',
        'Plan activities for future days, the calendar shows them',
        'Daily reminder at the chosen time, skipped on days with an entry',
        'App lock using the device unlock, screenshots and preview blocked',
        'Note about a backup after 60 days, quiet note about the TelefonSeelsorge after many hard days',
        'Backup as JSON and export as CSV',
        'Sample data to try things out',
      ],
    },
  },
];
