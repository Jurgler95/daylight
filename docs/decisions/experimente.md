# Experimente

## Status

Gebaut am 2026-11-27 auf dem Branch `feature/experimente` in drei Phasen nach `docs/plans/experimente.md`. Nicht gepusht, kein Pull Request, keine Version gehoben, keine Updatehistorie, das macht `/deploy`. Der Plan ist die Spezifikation, seine Tabelle „Entscheidungen“ (E1 bis E16) gilt, Abweichungen stehen dort unter „Abweichungen beim Bau“.

| Prüfung | Ergebnis |
| --- | --- |
| `npm run typecheck` | sauber |
| `npx jest` | 94 Suites, 1037 Tests grün, 2 übersprungen (vor dem Bau 84 Suites, 921 Tests). Neu: `db/__tests__/experiments.test.ts`, `lib/experiments/__tests__/` (`rules`, `compare`, `noise`, `view`), `lib/export/__tests__/experiments.test.ts`, `lib/i18n/__tests__/experimentWords.test.ts`, `components/experiments/__tests__/` (`screens`, `checkIn`, `doneCard`); ergänzt: `draft.test.ts`, `useEntryEditor.test.tsx`, `summary.test.ts` |
| Unabhängige Prüfung | Eine Prüfrunde zwischen Phase 2 und 3 (im Plan „Nach Prüfung R1“), die Abschlussprüfung steht noch aus |
| Auf dem Gerät | noch nicht, siehe Offene Punkte |

## Was existiert

| Datei | Inhalt |
| --- | --- |
| `db/schema.ts`, `drizzle/0018_odd_stick.sql` | Tabellen `experiments` (Titel, Notiz, Start, Ende einschließlich, `check_in`, `result_seen`, Zeitstempel) und `experiment_days` (Antwort je Experiment und Tag, Kaskade beim Löschen). Keine Spalte für die geplante Dauer, kein gespeicherter Zustand |
| `db/repositories/experiments.ts` | Anlegen, Bearbeiten, „Jetzt beenden“, Löschen, `markExperimentSeen`, Antworten lesen. `setExperimentDays` speichert die Antworten des Editors für einen Tag und führt ein Nein selbst aus, in einer Transaktion |
| `lib/experiments/rules.ts` | Dauer 7 bis 84 Tage, Start ein Jahr zurück bis 60 Tage voraus, Zustand aus dem Datum (`experimentState`), Bearbeiten, Beenden, Überschneidung, wann gefragt wird (`canAnswer`, `askingOn`), Schlüssel zum Zusammenführen (`experimentKey`) |
| `lib/experiments/compare.ts` | „Davor“ gegen „Im Experiment“ für Stimmung, Skalen, Gesundheit und Aktivitäten, Hinweise (Überschneidung, Jahreszeiten, Rückkehr zum Gewohnten), Zählung der Antworten (`checkInCounts`). Teilt die Rechnung mit `lib/turning/compare.ts` |
| `lib/experiments/noise.ts` | Urteil an der eigenen Schwankung (E2, E11, E14): nicht beurteilbar, vorläufig, im Rahmen oder größer als üblich |
| `lib/experiments/view.ts`, `useExperiments.ts` | Abschnitte der Liste, Auswahl der Dauer, Urteil in Worten, welches Experiment die Karte auf Heute zeigt (`finishedToShow`); die Brücke zu den Bildschirmen |
| `app/experiments/` | Liste (`index.tsx`), Anlegen und Bearbeiten (`new.tsx`, `?id=`), Vergleich (`[id].tsx`) mit Check-in-Block, Jetzt beenden und Löschen |
| `components/experiments/` | Zeile der Liste, Karte in Einblicke, Datumszeile mit Grenzen, Frage im Editor (`CheckInCard.tsx`), Karte auf Heute (`ExperimentDoneCard.tsx`) |
| `lib/entry/draft.ts`, `lib/entry/useEntryEditor.ts`, `components/entry/EntryEditor.tsx` | Antworten im Entwurf (`check_ins`, nur Änderungen), geschrieben mit „Speichern“ im selben `mutate` wie der Eintrag |
| `app/(tabs)/index.tsx`, `app/(tabs)/insights.tsx`, `app/(tabs)/settings.tsx` | Karte auf Heute, Karte in Einblicke, Zeile „Experimente“ unter „Mehr“ |
| `lib/export/`, `db/repositories/maintenance.ts`, `app/more/import.tsx` | Sicherung mit `experiments` und `experiment_days` (optional, ohne Versionssprung), Zusammenführen, Verlust-Hinweis in der Import-Vorschau, `clearJournal` leert beide Tabellen |
| `lib/i18n/locales/*.json` | Alle Texte unter `experiments.*` in zehn Sprachen, geprüft vom Worttest |

## Entscheidungen

Die Entscheidungen E1 bis E16 stehen im Plan. Hier, was beim Bau dazukam oder für spätere Arbeit wichtig ist.

1. **Zustand nur aus dem Datum.** Geplant vor dem Start, läuft bis zum Ende, danach vorbei. Ausnahme: Ein Experiment von genau einem Tag (nur durch ein Nein am Starttag möglich) ist ab diesem Tag vorbei.
2. **Nein beendet (E15).** Der Editor fragt sofort nach, merkt sich das Nein im Entwurf und schreibt erst mit „Speichern“. `setExperimentDays` setzt dann das Ende auf den Vortag (am Starttag auf den Starttag), behält das Nein und entfernt spätere Antworten. Ohne Speichern passiert nichts. Danach fragt das Experiment nicht mehr.
3. **Antworten im Entwurf.** `check_ins` hält nur die Änderungen gegenüber der Datenbank: `true`, `false` oder `null` (zurückgenommen). Ein Tipp auf die gewählte Antwort nimmt sie zurück; was wieder dem gespeicherten Stand entspricht, fällt aus dem Entwurf, damit er nicht grundlos als geändert gilt. Ein anderer Tag im Editor verwirft die Änderungen. Beim Speichern gehen nur Antworten für Experimente an die Datenbank, die an dem Tag noch fragen.
4. **Antworten hängen am Tag,** nicht am Eintrag. Ein zweiter Eintrag des Tages zeigt die vorhandene Antwort, das Löschen eines Eintrags lässt sie stehen.
5. **Vergleichsseite:** „Eingehalten an X von Y Tagen mit Antwort“ und, wenn ein Nein es beendet hat, „Beendet durch ein Nein am …“. Der Block erscheint, wenn die Frage an ist oder es Antworten gibt, nicht bei geplanten. Kein Vergleich Ja-Tage gegen Nein-Tage.
6. **Karte auf Heute:** nur am heutigen Tag nach der Bewertungskarte, für ein Experiment, das vorbei ist, dessen Vergleich noch nicht gesehen wurde und dessen Ende höchstens 14 Tage her ist. Bei mehreren nur das zuletzt beendete. „Schließen“ und das Öffnen des Vergleichs setzen `result_seen`. Wer ein schon beendetes Experiment anlegt, bekommt keine Karte; ein Nein am Starttag bringt sie sofort.
7. **Zusammenführen:** Neue Experimente aus einer Sicherung bekommen `result_seen = true`, wenn ihr Ende vor heute liegt; laufende und geplante behalten `false`, damit sie nach dem Ende ihre Karte zeigen.

## Zusammenführen mit dem Branch der automatischen Sicherung

Die Migration `drizzle/0018_odd_stick.sql` liegt in einem eigenen Commit („Datenbank: Tabellen für Experimente“) und enthält nur die zwei Tabellen. Der Branch der automatischen Sicherung erzeugt ebenfalls eine `0018` (Plan F1). Wer zuerst nach `main` geht, behält seine `0018`. Der andere Branch löscht seine Migration samt `drizzle/meta/0018_snapshot.json`, dem Eintrag in `drizzle/meta/_journal.json` und der Zeile in `drizzle/migrations.js`, holt `main` und erzeugt sie mit `npm run db:generate` neu (dann als `0019`). Danach die generierte SQL lesen und die Tests laufen lassen.

## Offene Punkte

Auf dem Gerät prüfen (Emulator `Pixel_9`, Beispieldaten über ein Jahr), die Wege aus dem Abschnitt „Abnahme“ im Plan:

- Experiment mit Start vor 30 Tagen und 4 Wochen anlegen: schon vorbei, keine Karte auf Heute, Vergleich mit Urteil.
- Start vor 10 Tagen: Zwischenstand ohne Urteil. Start ab morgen: geplant, kein Vergleich.
- Laufendes Experiment mit Frage: im Editor beantworten, zweiten Eintrag am Tag öffnen (Antwort vorbelegt), Nein tippen, Rückfrage, speichern, Experiment beendet, Karte auf Heute erscheint und verschwindet mit „Schließen“.
- Vorzeitig beenden, Import-Vorschau mit Ersetzen zeigt den Verlust-Hinweis, Sicherung exportieren, alles löschen, einspielen, Experimente wieder da.
- Dark Mode einmal ansehen, die Ja/Nein-Chips im Editor mit TalkBack.
