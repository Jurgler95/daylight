/**
 * Versionshistorie der App, gepflegt vom Deploy-Skill (`.claude/skills/deploy`).
 *
 * Neue Einträge kommen immer oben dazu. Jeder Punkt beschreibt eine Änderung, die in der App
 * sichtbar oder spürbar ist: keine Umbauten im Code, keine Abhängigkeiten, keine Tests.
 * Kurz halten, ein Satz pro Punkt.
 */
export interface Release {
  /** Muss der `version` in `app.json` entsprechen. */
  version: string;
  /** Erscheinungsdatum als `YYYY-MM-DD`. */
  date: string;
  /** Kurze Stichpunkte, jeweils ohne Satzzeichen am Ende. */
  changes: string[];
}

export const RELEASES: Release[] = [
  {
    version: '1.0.13',
    date: '2026-09-30',
    changes: [
      'Daylight ist jetzt freie Software, Lizenz und Quellcode stehen unter „Über“',
      'Neuer Signaturschlüssel: vor dem Update eine Sicherung teilen, die alte App deinstallieren und die Sicherung danach wieder einspielen',
    ],
  },
  {
    version: '1.0.12',
    date: '2026-09-28',
    changes: ['Fotos in der Vollansicht lassen sich mit zwei Fingern oder per Doppeltipp vergrößern und im Zoom verschieben'],
  },
  {
    version: '1.0.11',
    date: '2026-09-28',
    changes: ['Kleinere Korrekturen im Hintergrund'],
  },
  {
    version: '1.0.10',
    date: '2026-09-27',
    changes: [
      'Ein Eintrag im Verlauf öffnet seinen Tag, bearbeitet wird von dort aus',
      'Heute ist aufgeräumt: ohne die Karte „Die nächsten Tage“ und ohne den Hinweis zum Schlaf',
    ],
  },
  {
    version: '1.0.9',
    date: '2026-09-27',
    changes: ['Der Rückblick auf Heute zeigt die Fotos der Tage, ein Tipp öffnet sie groß'],
  },
  {
    version: '1.0.8',
    date: '2026-09-27',
    changes: ['Zurück wechselt auf Android zum zuletzt geöffneten Tab, die App schließt sich erst auf Heute'],
  },
  {
    version: '1.0.7',
    date: '2026-09-27',
    changes: [
      'Einblicke sind in Bereiche aufgeteilt: Stimmung, Muster, Aktivitäten, Gesundheit, Zusammenhänge und Notizen',
      'Gesundheit zeigt Verlauf, Wochentage, Ziele mit Serien und Bestwerte für Schlaf, Schritte, Ruhepuls und Training',
      'Zusammenhänge vergleichen gute und schwierige Tage und zeigen, wie Schlaf und Bewegung mit der Stimmung zusammengehen',
      'Aktivitäten lassen sich mit Schlaf in der Nacht danach, Schritten, Ruhepuls und Training vergleichen',
    ],
  },
  {
    version: '1.0.6',
    date: '2026-09-27',
    changes: [
      'Heute zeigt Schlaf, Schritte, Training und Ruhepuls des gewählten Tages',
      'Im Verlauf steht an jedem Eintrag eine kurze Zeile mit Schlaf, Schritten und Training',
    ],
  },
  {
    version: '1.0.5',
    date: '2026-09-27',
    changes: [
      'Schritte, Schlaf, Ruhepuls und Training kommen aus Health Connect, etwa von Samsung Health und der Galaxy Watch',
      'Abgeglichen wird beim Öffnen der App und rückwirkend bis zum ersten Eintrag, ein kleiner Kreis oben rechts zeigt es an',
      'Einblicke zeigen die Stimmung nach Schlaf, Schritten und Training',
      'Daylight liest nur und schreibt nichts nach Health Connect, die Gesundheitsdaten lassen sich jederzeit trennen und löschen',
    ],
  },
  {
    version: '1.0.4',
    date: '2026-09-27',
    changes: [
      'Jeder Eintrag kann ein Foto haben, zu sehen in Heute, im Verlauf und groß per Tipp',
      'Die Daylio-Sicherung lässt sich importieren und bringt die Fotos zu vorhandenen Einträgen mit',
      'Mit Fotos ist die Sicherung eine ZIP-Datei, die alles wiederherstellt',
      'Kräftigere Farben mit blauem Akzent, der Kalender liegt auf einer weißen Fläche',
    ],
  },
  {
    version: '1.0.3',
    date: '2026-09-27',
    changes: [
      'Neues Logo: ein Wellenring mit zwölf Stunden und einer Spirale, deren Sonne auf den Abend zeigt',
      'Das Logo liegt blass im Hintergrund jeder Seite, Karten lassen es leicht durchscheinen',
      'Sperrbildschirm, Über und die tägliche Erinnerung zeigen das Logo',
    ],
  },
  {
    version: '1.0.2',
    date: '2026-09-26',
    changes: [
      'Pro Tag gibt es einen Eintrag, ein weiterer Tipp auf den Tag öffnet den vorhandenen',
      'Einträge haben keinen Titel mehr, ein alter Titel steht als erste Zeile in der Notiz',
      'Beim Schreiben der Notiz rutscht der Text über die Tastatur',
      'Heute zeigt einen Rückblick auf den Tag vor einer Woche, einem Monat, sechs Monaten und einem Jahr',
      'Die Stimmung Ok ist jetzt gelb statt blau',
    ],
  },
  {
    version: '1.0.1',
    date: '2026-09-26',
    changes: [
      'Die App-Sperre fragt nach dem Entsperren mit der Geräte-PIN nicht gleich wieder',
      'Erinnerungen werden sauber neu gestellt, auch wenn kurz nacheinander etwas passiert',
      'Einblicke: längste Folge in voller Länge, Wörter nur aus Tagen mit Notiz, übliche Uhrzeit auch nach Mitternacht, Zahlen richtig gerundet',
      'Unter Mehr lässt sich wählen, ob die Woche am Montag oder am Sonntag beginnt',
      'Der Screenreader nennt am Hinweis auf die Telefonseelsorge ihren Namen',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-09-26',
    changes: [
      'Erste Version: der Daylio-Export lässt sich vollständig importieren',
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
      'Sicherung als JSON und Export als Daylio-CSV',
      'Beispieldaten zum Ausprobieren',
    ],
  },
];
