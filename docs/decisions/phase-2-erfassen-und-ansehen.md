# Phase 2: Erfassen und Ansehen (Handover)

## Status

Abgeschlossen am 2026-09-26, nicht interaktiv. Verifiziert:

- `npm run typecheck` sauber (Typed Routes neu erzeugt mit `npx expo customize tsconfig.json`).
- `npm test`: 169 Tests grün in 23 Suites, darunter zwei Suites gegen den echten Export unter `private/` (laufen nur, wenn die Datei existiert).
- `npx expo export --platform android` bündelt.
- `npx expo-doctor` 21/21 (Abhängigkeit hinzugekommen, siehe Entscheidung 1).
- `npx expo prebuild --platform android` in einer Kopie außerhalb des Repos: `INTERNET` weiterhin mit `tools:node="remove"`, `android:allowBackup="false"`.

Ergebnis gegen den echten Export (`private/__tests__/calendar.test.ts`): 270 Tage mit Marker, jeder in Farbe und Symbol seiner Stimmung, einzige Lücke zwischen 29.12.2025 und 25.09.2026 ist der 20.09.2026. Der Verlauf zeigt alle 270 Einträge in zehn Monatsabschnitten, jeder mit Notizauszug. Filter "Familie" findet 79 Einträge, Stufe 2 findet 8, wie in der Analyse.

**Nicht geprüft:** alles auf dem Gerät. In dieser Session gab es weder Gerät noch Emulator (Gerätezugriff der Umgebung abgeschaltet). Siehe "Offene Punkte".

## Was existiert

| Pfad | Zweck |
| --- | --- |
| `app/entry/new.tsx`, `app/entry/[id].tsx` | Eintrag-Editor als Modal. `new` nimmt `?date=` (nie in der Zukunft, sonst heute) und `?mood=` (vorgewählt). |
| `components/entry/EntryEditor.tsx` | Der Editor: Stimmung, Aktivitäten nach Gruppen (aufklappbar), Skalen, Titel und Notiz, Tag und Uhrzeit, Löschen mit Rückfrage. Fragt beim Verlassen mit Änderungen nach. |
| `components/entry/ActivityGroupCard.tsx`, `ScaleInput.tsx`, `DateTimeRows.tsx`, `EntryCard.tsx` | Gruppe mit Chips, Skala als Balkenreihe (aus Zyklus `ScaleRow`, für beliebige Bereiche), System-Picker für Tag und Uhrzeit, Lesekarte eines Eintrags auf Heute. |
| `lib/entry/draft.ts`, `useEntryEditor.ts`, `collapsedGroups.ts` | Rein: Entwurf, Vergleich "geändert?", Standarduhrzeit, Umwandlung in `EntryInput`. Brücke: Entwurf halten, speichern, löschen. Zugeklappte Gruppen für die Sitzung. |
| `app/(tabs)/index.tsx` | Heute: Tagesleiste, Überschrift relativ ("Gestern", "Vor 3 Tagen"), Lesekarten der Einträge, Stimmungswähler als Einstieg in den Editor. |
| `components/today/DayStrip.tsx` | Aus Zyklus: 365 Tage zurück, 30 voraus, startet auf dem gewählten Tag. |
| `lib/store/selectedDay.ts` | Welcher Tag auf Heute gezeigt wird, geteilt mit dem Kalender. `null` heißt heute. |
| `app/(tabs)/calendar.tsx`, `components/calendar/` | Kalender als Monatsliste aus Zyklus (`MonthList`, `WeekRow`, `DayCell`), neues `DayGlyph`, Legende unten angeheftet. Antippen öffnet den Tag auf Heute. |
| `lib/calendar/monthGrid.ts`, `dayLabel.ts`, `markers.ts`, `useDayMarkers.ts`, `useDayLabel.ts` | Monatsraster (aus Zyklus), Screenreader-Text je Tag, Marker je Tag (rein), Brücke mit stabilen Marker-Objekten wie in Zyklus 1.0.10. |
| `lib/mood/dayMood.ts` | Tagesmittel: Mittel der Stufen, gerundet, Anzahl. |
| `app/(tabs)/history.tsx`, `components/history/` | Verlauf: Timeline nach Monaten mit angehefteten Monatsköpfen, Suchfeld und Filterfeld oben (`SearchBar`, `FilterPanel`, `EntryRow`). |
| `lib/search/search.ts`, `timeline.ts`, `useEntrySearch.ts` | Rein: Index mit gefalteten Texten, Suche, Zeitraum, häufigste Aktivitäten, Notizauszug, Monatsabschnitte. Brücke mit Index je Datenstand. |
| `lib/catalog/catalog.ts`, `useCatalog.ts` | Stimmungen, Gruppen, Aktivitäten, Skalen mit Lookups, Name und Symbol je Stufe, Gruppen für den Editor. |
| `app/more/moods.tsx`, `mood/[id].tsx` | Stimmungen: Liste nach Stufe, neue anlegen, Name, Stufe, Symbol, archivieren. |
| `app/more/activities.tsx`, `activity/[id].tsx`, `groups.tsx`, `group/[id].tsx` | Aktivitäten je Gruppe mit Sortieren per Ziehen, neue Aktivität und Gruppe anlegen, Gruppen sortieren. Aktivität: Name, Symbol, Gruppe wechseln, zusammenführen, archivieren. Gruppe: Name, archivieren. |
| `app/more/scales.tsx`, `scale/[id].tsx` | Skalen anlegen (1 bis 5 oder 0 bis 10), sortieren, umbenennen, archivieren. |
| `components/manage/` | `SortableList` (Halten und Ziehen, Screenreader-Aktionen), `IconPicker`, `NameField` (speichert beim Verlassen und beim Schließen), `AddRow`, `ManageRow`, `useCommitOnUnmount` (aus Zyklus). |
| `lib/manage/useManageWrite.ts` | Schreibt und übersetzt die erwarteten Ablehnungen (Name vergeben, letzte Stimmung) in eine Meldung. |
| `lib/icons/catalog.ts` | Auswahl von rund 120 MaterialCommunityIcons in Abschnitten, enthält jedes Symbol aus `known.ts`. |
| `components/mood/MoodBadge.tsx`, `MoodPicker.tsx` | Stimmung als runde Plakette, Stimmungswähler. |
| `db/repositories/activities.ts`, `groups.ts`, `moods.ts`, `scales.ts`, `entries.ts`, `order.ts` | Neu: `mergeActivities`, `reorderActivities`, `reorderGroups`, `writeOrder`, `activityUsage`, `moodUsage`, `updateScale`, `saveEntry`, `getEntryDetails`, `listEntryMoods`. Umbenennen und Verschieben prüfen gefaltete Namen. |
| `db/types.ts` | `NameTakenError`, `LastMoodError`. |
| `components/ui/Chip.tsx`, `SelectRow.tsx` | Chip mit optionalem Symbol, SelectRow mit Platzhalter. |
| `lib/dates/index.ts` | `nowTime`, `toTimeString`, `toLocalDate`. |
| Tests | `lib/mood`, `lib/calendar` (Label, Marker, Monatsraster, privat), `lib/search`, `lib/entry`, `lib/catalog`, `lib/icons`, `db/__tests__/manage.test.ts`. |

## Entscheidungen

1. **`@react-native-community/datetimepicker` installiert** (9.1.0, per `npx expo install`, mit Config-Plugin). Die Spezifikation verlangt Tag und Uhrzeit im Editor änderbar, und Phase 1 hatte ihn für Phase 4 schon angekündigt. Er fordert keine Berechtigung an (Manifest geprüft), Zyklus nutzt dieselbe Version.
2. **Der Editor speichert erst mit "Speichern"**, nicht bei jeder Änderung wie Zyklus. Ein Eintrag ist ein Ganzes (Stimmung ist Pflicht), und ein halber Eintrag in der Datenbank wäre schlimmer als keiner. Die Lehre aus Zyklus 1.0.10 ist trotzdem umgesetzt: alle Felder sind kontrolliert, der Entwurf hält jeden Tastendruck, und `usePreventRemove` fängt jedes Verlassen mit Änderungen ab (Schließen-Knopf, Android-Zurück, Geste) und fragt "Speichern / Verwerfen / Weiter bearbeiten". "Speichern" erscheint dort nur, wenn eine Stimmung gewählt ist.
3. **Zwei Taps**: Stimmung auf Heute antippen öffnet den Editor mit dieser Stimmung, "Speichern" steht oben rechts und ist sofort aktiv. Die vorgewählte Stimmung zählt nicht als Änderung, Schließen ohne weitere Eingabe fragt also nicht nach.
4. **Standarduhrzeit**: heute die aktuelle Uhrzeit, frühere Tage die Erinnerungszeit (20:30), weil ein Tag meist abends festgehalten wird und "jetzt" einen Nachtrag seltsam einsortieren würde.
5. **Keine Einträge in der Zukunft.** Heute zeigt für künftige Tage nur einen leeren Zustand, der Datumspicker endet bei heute, `entry/new` fällt bei einem künftigen Datum auf heute zurück. Künftige Tage gehören ab Phase 4 den Plänen und dem Ausblick.
6. **Tagesmittel wird kaufmännisch gerundet** (`floor(mittel + 0,5)`): ein Tag aus "Ok" und "Gut" ist "Gut". Feste Regel, damit derselbe Tag immer dieselbe Farbe hat. Das Symbol des Tages ist das des spätesten Eintrags auf der gerundeten Stufe, sonst das Symbol, für das die Stufe steht.
7. **Stimmung einer Stufe** (Legende, Filter, Screenreader) ist die erste aktive Stimmung dieser Stufe in Sortierreihenfolge, sonst der Standardname. Der Stimmungswähler sortiert nach Stufe absteigend, dann nach eigener Reihenfolge; ein Sortieren von Stimmungen gibt es deshalb nicht.
8. **Kalender öffnet den Tag auf Heute** statt direkt im Editor: an einem Tag können mehrere Einträge stehen, und Heute zeigt alle und kann einen weiteren anlegen. Der gewählte Tag liegt in `lib/store/selectedDay.ts`; "heute" wird als `null` gespeichert, damit der Tab um Mitternacht mitwandert (Zyklus 1.0.10). Die Tagesleiste scrollt zu einem Tag, der von außen gewählt wurde, aber nicht zu einem, der in ihr angetippt wurde.
9. **Kalender reicht drei Monate voraus**, Tagesleiste 30 Tage (Zyklus: 12 Monate bzw. 365 Tage). Ohne Ausblick und Pläne ist dort nichts zu sehen; Phase 4 kann beides verlängern (`MONTHS_AHEAD`, `STRIP_AHEAD_DAYS`).
10. **`DayGlyph`**: Tageszahl oben, darunter ein Kreis in der hellen Stimmungsfarbe mit dem Stimmungssymbol in der kräftigen, Punkt darunter bei mehreren Einträgen, Akzentring für heute, grauer Kreis für vergangene Tage ohne Eintrag, leerer für künftige. Wochenzeile deshalb 64 statt 54 Punkte hoch.
11. **Verlauf und Suche sind eine Liste.** Leere Suche zeigt alle Einträge; Text und Filter grenzen dieselbe Timeline ein. Ohne Deckel wie in Zyklus (200), weil die `SectionList` virtualisiert.
12. **Suche**: der Text wird in Wörter geteilt, jedes Wort muss irgendwo im Eintrag vorkommen (Notiz, Titel, Aktivität, Stimmung), gefaltet über `fold.ts`. Aktivitäts-Chips mit UND, Stimmungsstufen mit ODER, Zeitraum Alles, 30 Tage, 90 Tage, Jahr (jeweils bis heute). Als Chips stehen die 16 meistgenutzten Aktivitäten. Treffer in Aktivitäten werden im Verlauf in Akzentfarbe hervorgehoben. Der gefaltete Index entsteht einmal je Datenstand.
13. **Zusammenführen löscht die Quelle.** Einträge und Pläne der Quelle bekommen das Ziel (`INSERT OR IGNORE`, also keine doppelten Zeilen), danach wird die Quelle gelöscht, alles in einer Transaktion. Archivieren wäre eine zweite, nie mehr benutzte Aktivität. Zusammenführen geht über Gruppen hinweg; nach dem Zusammenführen öffnet sich die verbleibende Aktivität.
14. **Umbenennen und Verschieben prüfen den gefalteten Namen in der Zielgruppe** (archivierte eingeschlossen) und werfen `NameTakenError`; die Meldung verweist aufs Zusammenführen. Gruppen- und Skalennamen sind global eindeutig. Verschieben in eine andere Gruppe hängt die Aktivität dort ans Ende.
15. **"Urlaub"**: nicht neu entschieden, der Import bleibt wie in Phase 1. Im echten Export steht "Urlaub" in 24 Einträgen (die Analyse zählt 33 Nennungen, 9 Zeilen nennen es doppelt). Paul kann jetzt eine zweite Aktivität "Urlaub" in einer anderen Gruppe anlegen und Einträge über den Editor umhängen, oder die Aktivität in eine andere Gruppe verschieben.
16. **Keine Standardaktivitäten.** Eine Neuinstallation hat leere Gruppen (offener Punkt aus Phase 1). Wer Daylio importiert, bekäme sonst unbenutzte Aktivitäten wie "Sport" oder "Lesen" dazu. Der Editor zeigt ohne Aktivitäten einen Hinweis mit Knopf zur Verwaltung, neue Aktivitäten entstehen dort mit einer Zeile je Gruppe.
17. **Archivieren statt Löschen** für Stimmungen, Gruppen, Aktivitäten und Skalen (wie Phase 1, Entscheidung 22). Archivierte erscheinen im Editor nur, wenn sie am Eintrag gesetzt sind, damit sie sich abwählen lassen; Aktivitäten einer archivierten Gruppe hängen dann an der letzten Gruppe. Die letzte aktive Stimmung lässt sich nicht archivieren (`LastMoodError`).
18. **Sortieren per Ziehen** ohne neue Abhängigkeit: `react-native-gesture-handler` und `react-native-reanimated` sind seit dem Grundgerüst da. Ziehen am Griff links nach 180 ms Halten, damit ein Wisch über den Griff noch scrollt. Feste Zeilenhöhe (52), damit die Zielposition aus dem Weg folgt. Screenreader bekommen "Nach oben" und "Nach unten" als Aktionen am Griff (die Pfeile aus Zyklus Phase 15, nur unsichtbar). Die Spezifikation verlangt Ziehen ausdrücklich, deshalb nicht die Pfeile aus Zyklus.
19. **Namen in der Verwaltung speichern beim Verlassen des Feldes und beim Schließen der Seite** (`NameField` mit `useCommitOnUnmount`, Zyklus 1.0.10). Symbol, Stufe, Gruppe und Archiv speichern sofort.
20. **Neue Stimmungen** entstehen mit Stufe 3 und öffnen sofort ihre Seite, damit Stufe und Symbol gesetzt werden. Neue Skalen wählen zwischen 1 bis 5 und 0 bis 10; der Bereich einer Skala ist danach fest, damit gespeicherte Werte immer passen.
21. **Symbolauswahl** ist eine feste Liste von rund 120 Symbolen in Abschnitten (`lib/icons/catalog.ts`), nicht alle 7000 Glyphen. Ein Test stellt sicher, dass jedes Symbol existiert und jedes Symbol aus `known.ts` angeboten wird.
22. **Zugeklappte Gruppen im Editor** gelten für die Sitzung (zustand), nicht dauerhaft: die Einstellungen hätten dafür eine Migration gebraucht, und alle offen ist der sinnvolle Start.
23. **Lesekarten zeigen die ganze Notiz**, der Verlauf einen Auszug von 140 Zeichen um den Treffer (Muster aus Zyklus). Aktivitäten erscheinen in Verwaltungsreihenfolge, nicht in Tippreihenfolge.
24. **Stufenauswahl im Import** nennt jetzt die aktuellen Stimmungsnamen (offener Punkt aus Phase 1 erledigt).
25. **Updatehistorie**: Version 1.0.0 ist noch nicht veröffentlicht, die Punkte dieser Phase stehen deshalb dort.

## Offene Punkte für spätere Phasen

- **Geräteprüfung ausstehend** (auch die aus Phase 1): echten Export importieren, dann
  - Heute: Stimmung antippen, Speichern (zwei Taps), Karte erscheint; Tagesleiste wischen, Tag antippen; "Heute"-Knopf; um Mitternacht bzw. nach Rückkehr in die App springt Heute auf den neuen Tag.
  - Editor: Notiz tippen und per Android-Zurück schließen, die Rückfrage muss kommen; Datum und Uhrzeit über die System-Picker; Löschen.
  - Kalender: Farben und Symbole, Punkt bei zwei Einträgen (Beispieldaten haben solche Tage), Antippen öffnet Heute auf dem Tag, Legende.
  - Verlauf: Scrollen durch 270 Einträge, angeheftete Monatsköpfe, Suche und Filter.
  - Verwaltung: **Ziehen zum Sortieren** innerhalb der `ScrollView` von `Screen` (Gesten-Zusammenspiel nur auf dem Gerät prüfbar; falls die Seite beim Ziehen mitscrollt, `Screen` für diese Seiten auf eine `ScrollView` aus gesture-handler umstellen), Zusammenführen, Verschieben, Symbolauswahl.
  - Große Systemschrift: `DayGlyph` und die Wochenzeile haben feste Höhen (58 bzw. 64), bei maximaler Schrift könnte die Tageszahl beschnitten werden.
- **Aktivitätsreihenfolge nach dem Import** muss Paul einmal selbst ordnen; die Werkzeuge dafür sind da.
- **"Urlaub" doppelt** bleibt als Frage an Paul offen (Phase 1). Die Verwaltung erlaubt, es selbst aufzuteilen oder zusammenzulegen.
- Getippte Umschreibungen finden keine Umlaute ("muede" findet "Müde" nicht), wie in Zyklus.
- Die Tagesleiste reicht 365 Tage zurück; ältere Tage öffnet der Kalender auf Heute, die Leiste steht dann am Anfang.
- Kalender und Tagesleiste zeigen künftige Tage leer; Ausblick, Pläne eintragen und Ringe folgen in Phase 4. Heute hat noch keine Sicherungskarte (`lib/export/backup.ts` ist da, Phase 4).
- Stimmungen lassen sich nicht löschen, nur archivieren. Eine Stimmung, die nie benutzt wurde, bleibt im Archiv stehen.
- Aus Phase 1 weiter offen: Skalenformat unverifiziert, geparste Datei bleibt nach abgebrochener Vorschau im Store, Ersetzen zeigt in der Vorschau die Zahlen des Zusammenführens.
