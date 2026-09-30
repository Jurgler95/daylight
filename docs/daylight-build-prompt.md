# Build-Prompt: Daylight, lokales Stimmungstagebuch

> Diese Datei komplett in Claude Code einfügen oder dem Agenten sagen: "Lies
> docs/daylight-build-prompt.md und mach mit Phase N weiter." Phase für Phase bauen,
> nicht alles auf einmal.

---

## Übergabeprotokoll (gilt für jede Phase)

Jede Phase ist eine eigene Session. Kontext wird nicht mitgenommen, die Entscheidungsdateien
sind das Gedächtnis.

**Zu Beginn einer Phase:**

1. Diese Datei vollständig lesen.
2. Die versionierte Expo-Doku unter https://docs.expo.dev/versions/v57.0.0/ für jedes Paket
   lesen, das in der Phase neu angefasst wird (siehe `AGENTS.md`).
3. **Alle** Dateien in `docs/decisions/` der Reihe nach lesen. Sie sind verbindlich: nichts neu
   entscheiden, was eine frühere Phase entschieden hat, und keine Fragen stellen, die dort schon
   beantwortet sind.
4. Den Abschnitt "Offene Punkte" der letzten Entscheidungsdatei aufnehmen.
5. `npm run typecheck` und `npm test` laufen lassen, damit die Ausgangslage grün ist.

**Am Ende einer Phase:**

1. Prüfen: `npm run typecheck`, `npm test`, `npx expo export --platform android`. Alles muss
   durchlaufen. `npx expo-doctor` nur, wenn sich Abhängigkeiten geändert haben.
2. `docs/decisions/phase-N-<slug>.md` schreiben, mit den Abschnitten:
   - **Status**: Datum, Ergebnis der Prüfungen.
   - **Was existiert**: Tabelle der neuen oder geänderten Pfade und ihr Zweck.
   - **Entscheidungen**: nummerierte Liste jeder nicht offensichtlichen Entscheidung mit Grund,
     auch alles, was ohne Rückfrage entschieden wurde.
   - **Offene Punkte für spätere Phasen**: Provisorien, Stubs, bekannte Lücken.
3. `README.md` nachziehen, wenn sich Setup oder Architektur geändert haben.
4. Alles committen mit der Nachricht `Phase N: <slug>`.
5. Anhalten und für Paul zusammenfassen. Die nächste Phase nicht in derselben Session beginnen,
   außer es wird ausdrücklich verlangt.

**Commits:** an sinnvollen Zwischenpunkten committen, nicht nur am Ende. Ein guter Zwischenpunkt
ist ein grünes `typecheck` und `test` nach einem zusammenhängenden Stück Arbeit. Deutsche
Commit-Messages, keine Gedankenstriche.

Entscheidungsdateien, UI-Texte und Commit-Messages sind Deutsch.

---

## Rolle und Ziel

Du baust eine Android-App in Produktionsqualität: ein **Stimmungstagebuch nach dem Vorbild von
Daylio, zu 100 % lokal**. Keine Konten, keine Server, keine Analytics, keine Werbung, keine
Netzwerkzugriffe. Alle Daten liegen in einer SQLite-Datenbank auf dem Gerät und verlassen es nur
über einen ausdrücklichen Export.

Drei Dinge machen die App aus:

1. **Der bestehende Daylio-Export lässt sich vollständig importieren**, und der eigene Export der
   App lässt sich wieder importieren (in Daylight selbst und im selben CSV-Format wie Daylio).
2. **Analysen und Auswertungen** über Stimmung, Aktivitäten, Wochentage und Zeiträume, immer als
   Beschreibung der eigenen Daten, nie als medizinische Aussage.
3. **Ein ehrlicher Ausblick auf die nächsten Tage**, als Spanne mit Begründung, nur wenn er
   nachweislich besser ist als simples Raten.

**Vorbild für Aufbau und Code ist die Zyklus-App** unter `../menstruation-cycle`. Architektur,
Ordnerstruktur, Muster und Qualitätsstandards werden von dort übernommen (siehe
"Was aus Zyklus übernommen wird"). Vor Phase 1 deren `README.md`, den Build-Prompt
`docs/menstruation-cycle-build-prompt.md` und alle Dateien in `docs/decisions/` lesen.

**Design:** modernes App-Gefühl wie Zyklus. Große abgerundete Karten, eine Akzentfarbe plus fünf
Stimmungsfarben, Pill-Chips, viel Weißraum, keine erklärenden Texte in der Oberfläche, außer die
Spezifikation verlangt sie. Eine helle, warme Palette ("Tageslicht"), kein Dark Mode.

---

## Tech-Stack (fest, nicht austauschen)

Gleich wie Zyklus, damit Code direkt übernommen werden kann:

- **Expo SDK 57**, **React Native 0.86**, **TypeScript strict** (bereits im Grundgerüst)
- **expo-router** für die Navigation (bereits im Grundgerüst)
- **expo-sqlite** mit **Drizzle ORM** (`drizzle-orm` + `drizzle-kit`), Migrationen beim App-Start
- **zustand** für App-Zustand
- **date-fns** für alle Datumsrechnungen, importiert nur in `lib/dates`
- **react-native-gifted-charts** und **react-native-svg** für Diagramme
- **zod** für die Validierung aller Importe
- **i18next** / **react-i18next**, einzige Sprache Deutsch (`lib/i18n/locales/de.json`)
- **expo-file-system**, **expo-document-picker**, **expo-sharing** für Import und Export
- **expo-notifications** für lokale Erinnerungen
- **expo-local-authentication**, **expo-screen-capture** für die App-Sperre
- **expo-haptics**, **@expo/vector-icons**
- **jest** + **@testing-library/react-native**, Repositories gegen **better-sqlite3** in-memory

Einen CSV-Parser selbst schreiben (RFC 4180, klein und getestet) statt eine Bibliothek zu
installieren.

**Harte Vorgabe:** Das Android-Manifest darf kein `INTERNET` anfordern
(`android.blockedPermissions` in `app.json`, wie bei Zyklus). Braucht eine Abhängigkeit es,
vor der Installation Bescheid geben.

---

## Was aus Zyklus übernommen wird

Kopieren und anpassen, keine gemeinsame Bibliothek und kein Monorepo. Die beiden Apps sollen
unabhängig voneinander weiterleben.

| Aus Zyklus | Für Daylight |
| --- | --- |
| `db/client.ts`, `db/migrate.ts`, `db/testDb.ts`, `drizzle.config.ts`, `sql.d.ts`, Metro/Babel für `.sql` | unverändert übernehmen |
| `lib/dates/` inkl. `useToday` (Tageswechsel um Mitternacht) | unverändert übernehmen |
| `lib/theme/` inkl. Kontrast-Test | neue Palette, Kontrast-Test auf die Stimmungsfarben erweitern |
| `lib/i18n/`, `lib/haptics/`, `lib/changelog/` | übernehmen, Texte neu |
| `components/ui/` (AppText, Card, Button, Chip, Screen, ListRow, PressableScale, Segmented usw.) | übernehmen, Federn-Hintergrund weglassen |
| `app/(tabs)/_layout.tsx` (Tab-Bar über der Android-Navigation, `freezeOnBlur`) | übernehmen, Tabs neu |
| `components/calendar/` (Monatsliste, `WeekRow`, nur geänderte Wochen neu zeichnen) | übernehmen, `DayGlyph` neu |
| Tagesleiste auf "Heute" (Phase 12 von Zyklus) | übernehmen |
| `lib/export/` (zod-Schema, Format-Migration, Merge/Replace, Vorschau, Dateien, Backup-Erinnerung) | Muster übernehmen, Inhalt neu |
| `lib/search/fold.ts` | unverändert übernehmen |
| `lib/lock/`, `lib/notifications/plan.ts` + `client.ts` | Muster übernehmen |
| `.claude/skills/apk-release/` | übernehmen, Namen anpassen |

Grundsätze wie in Zyklus: reine Module in `lib/` ohne DB und React, daneben ein `use*.ts` als
Brücke; Screens lesen synchron über `useQuery` und schreiben über `mutate`; keine
Geschäftslogik in Komponenten; Kalendertage als `YYYY-MM-DD`-Strings.

---

## Der Daylio-Export (Analyse der Datei vom 2026-09-26)

Die Datei `daylio_export_2026_09_26.csv` ist die Referenz für den Import. Sie enthält private
Notizen und wird **nie** ins Repository übernommen (siehe Tests).

**Format:**

- UTF-8 **mit BOM** (`EF BB BF`), Zeilenende `\n`, Felder in doppelten Anführungszeichen,
  `""` als Escape für Anführungszeichen in Notizen, Kommas in Notizen.
- Kopfzeile: `full_date,date,weekday,time,mood,activities,scales,note_title,note`
- `full_date`: ISO `YYYY-MM-DD`. Die einzige verlässliche Datumsspalte.
- `date` ("25. September") und `weekday` ("Freitag") sind lokalisiert und redundant, beim Import
  ignorieren, beim Export erzeugen.
- `time`: 24-Stunden `HH:mm`. Englische Daylio-Exporte schreiben `8:30 pm`, beides lesen.
- `mood`: Name der Stimmung. Deutsche Standardnamen Super, Gut, Ok, Schlecht, Lausig
  (Stufe 5 bis 1), englisch rad, good, meh, bad, awful. Eigene Stimmungsnamen möglich.
- `activities`: Namen, getrennt durch ` | `. **Die Gruppe steht nicht in der CSV.**
- `scales`: in dieser Datei immer leer. Das Format bei gefüllten Skalen ist unbekannt.
- `note_title`: in dieser Datei immer leer. `note`: Freitext, enthält `<br>` als Zeilenumbruch
  und potenziell HTML-Entities.
- Neueste Zeile zuerst. Mehrere Zeilen pro Tag sind in Daylio möglich (hier nicht vorhanden).

**Inhalt:**

Die konkreten Zahlen des privaten Exports sind in der öffentlichen Fassung dieser Datei
entfernt. Für den Bau zählt nur, was daraus folgt:

- Etwa ein Eintrag pro Tag über mehrere Monate, vereinzelte Lücken.
- Die Stimmungsverteilung ist stark schief: "immer die häufigste Stimmung raten" liegt in den
  meisten Fällen richtig. Jeder Ausblick muss das schlagen.
- Uhrzeit meist am Abend, also Standard für die Erinnerung 20:30.
- Fast jede Zeile hat eine Notiz, bis ca. 500 Zeichen.
- Einige Dutzend verschiedene Aktivitäten. Vorgeschlagene Gruppen (in der Import-Vorschau
  änderbar):

| Gruppe | Aktivitäten |
| --- | --- |
| Gefühle | Müde, Gestresst, Angespannt, Aufgeregt, Entspannt, Zufrieden, Glücklich, Unsicher, Verzweifelt, Dankbar, Wütend, Gelangweilt, Krank, Traurig |
| Schlaf | Mäßig, Schlecht, Gut |
| Wetter | Sonnig, Wolkig, Regnerisch, Wind, Hitze, Schnee, Sturm |
| Soziales | Familie, Besuche, Freunde, Party |
| Arbeit | Planmäßig beenden, Arbeit, Urlaub, Krankheitstag, Überstunden, Teambuilding, HomeOffice |
| Orte und Freizeit | zu Hause, Einkaufen, Reisen, Natur, Filme, Restaurant, Entspannen |

Achtung: "Gut" und "Schlecht" sind hier Schlafqualität, nicht Stimmung. Stimmung und Aktivität
leben in getrennten Tabellen, der Name allein ist also nie der Schlüssel über Gruppen hinweg.

---

## Datenmodell

`snake_case`-Spalten, Kalendertage als `YYYY-MM-DD`-Strings, Uhrzeiten als `HH:mm`-Strings,
Integer-Booleans. Das vollständige Schema entsteht in Phase 1, damit spätere Phasen keine
Migration für Grundtabellen brauchen.

- **`moods`**: `id`, `label`, `level` (1 bis 5), `icon`, `sort_order`, `archived`. Fünf
  Standardstimmungen werden beim ersten Start angelegt; eigene Stimmungen hängen immer an einer
  Stufe, damit jede Auswertung mit Zahlen rechnen kann.
- **`activity_groups`**: `id`, `name`, `sort_order`, `archived`.
- **`activities`**: `id`, `group_id`, `name`, `icon`, `sort_order`, `archived`. Eindeutig über
  (`group_id`, `name`).
- **`entries`**: `id`, `date`, `time`, `mood_id`, `note_title`, `note`, `source`
  (`app` / `daylio_csv` / `json`), `created_at`, `updated_at`. Index auf `date`. Mehrere Einträge
  pro Tag erlaubt.
- **`entry_activities`**: `entry_id`, `activity_id` (zusammengesetzter Primärschlüssel,
  `ON DELETE CASCADE`).
- **`scales`** und **`entry_scales`**: `scales` (`id`, `name`, `min`, `max`, `sort_order`,
  `archived`), `entry_scales` (`entry_id`, `scale_id`, `value`). Für Daylio-Skalen und eigene
  Werte wie Energie oder Stress.
- **`planned_activities`**: `date`, `activity_id`. Was für einen künftigen Tag geplant ist
  (Urlaub, Besuch, Arbeit). Futter für den Ausblick in Phase 4.
- **`settings`**: typisierter Singleton wie in Zyklus. Erster Wochentag, Erinnerungszeit,
  Erinnerung an/aus, App-Sperre, Sperrverzögerung, `last_export_at` (gerätelokal, nicht im
  Export), Ausblick an/aus.

**Tageswert:** Die Stimmung eines Tages ist der Mittelwert der Stufen aller Einträge des Tages.
Kalender und Pixel färben nach gerundetem Mittelwert, mehrere Einträge zeigen einen kleinen Punkt.

---

## Import und Export

Kernfunktion, kein Anhängsel. Drei Formate, alle drei importierbar:

| Format | Richtung | Verlustfrei? |
| --- | --- | --- |
| **Daylight-JSON** (`daylight-export-YYYY-MM-DD.json`) | Export und Import | ja: Gruppen, Icons, Reihenfolgen, Skalen, Pläne, Einstellungen |
| **Daylio-CSV** (Format oben) | Import aus Daylio und Daylight, Export aus Daylight | nein: Gruppen, Icons und Pläne fehlen, der Rest bleibt |
| **Daylio-Backup** (`.daylio`) | offen, siehe Phase 4 | |

**JSON:** Aufbau wie Zyklus, mit `schema_version`, `app_version`, `exported_at` und allen
Tabellen. Format-Migrationskette ab Version 1.

**Daylio-CSV-Export:** byte-genau im Daylio-Format: BOM, gleiche Kopfzeile, `date` und `weekday`
deutsch, Aktivitäten in Gruppen- und dann Sortierreihenfolge, Zeilenumbrüche in Notizen als
`<br>`, neueste Zeile zuerst. So bleibt der eigene Export mit denselben Werkzeugen lesbar wie der
von Daylio und lässt sich wieder in Daylight importieren.

**Import (alle Formate):**

1. Datei wählen (expo-document-picker), Format an Kopfzeile bzw. JSON-Struktur erkennen.
2. Parsen und die ganze Datei mit zod validieren, **bevor** die Datenbank angefasst wird.
   Fehlerhafte Zeilen werden mit Zeilennummer und Grund gesammelt.
3. **Zuordnung** (nur CSV): unbekannte Stimmungsnamen einer Stufe zuordnen, neue Aktivitäten
   einer Gruppe zuordnen. Vorschläge kommen aus einer festen Tabelle bekannter Daylio-Namen
   (deutsch und englisch, `lib/daylio/known.ts`), Rest in die Gruppe "Importiert". Bestehende
   Aktivitäten werden über den gefalteten Namen (`fold.ts`) wiedergefunden.
4. **Vorschau:** "120 Einträge vom 01.03.2026 bis 28.06.2026, 5 Stimmungen, 30 Aktivitäten
   (davon 12 neu). Zusammenführen fügt 120 Einträge hinzu, 0 sind schon vorhanden."
   Fehlerhafte Zeilen werden gelistet und nur nach ausdrücklicher Bestätigung übersprungen.
5. **Modus:** Zusammenführen (Standard) oder Ersetzen. Ein Eintrag gilt als vorhanden, wenn
   Datum, Uhrzeit, Stimmungsstufe und Notiz übereinstimmen. Dieselbe Datei zweimal importieren
   erzeugt keine Duplikate.
6. Anwenden in **einer** Transaktion. Schlägt etwas fehl, bleibt die Datenbank unverändert.

---

## Screens

Fünf Tabs wie in Zyklus:

- **Heute**: Tagesleiste zum Wischen durch Tage. Einträge des Tages als Lesekarten, großer
  Stimmungswähler für einen neuen Eintrag, darunter ab Phase 4 die Karte "Die nächsten Tage".
- **Kalender**: Monatsliste, jeder Tag in Stimmungsfarbe **und** mit Stimmungs-Icon (nie nur
  Farbe). Zukünftige Tage zeigen ab Phase 4 den Ausblick als hohlen Ring und geplante
  Aktivitäten. Antippen öffnet den Tag.
- **Einblicke**: Auswertungen, siehe Phase 3.
- **Verlauf**: umgekehrt chronologische Timeline aller Einträge mit Notizauszug, Suche oben.
- **Mehr**: Stimmungen, Aktivitäten und Gruppen verwalten, Daten (Import, Export, alles löschen),
  Erinnerungen, App-Sperre, Datenschutz, Updatehistorie, Über.

**Eintrag-Editor** (`app/entry/[id].tsx`, `app/entry/new.tsx?date=`) als Modal: Stimmung, dann
Aktivitäten nach Gruppen (aufklappbar, Reihenfolge aus der Verwaltung), dann Skalen, Notiz mit
Titel, Datum und Uhrzeit änderbar. Der häufigste Fall muss schnell sein: Stimmung antippen,
Aktivitäten antippen, speichern.

---

## Die vier Phasen

Jede Phase ist ungefähr gleich groß und endet mit einer lauffähigen App. Der Import kommt
bewusst zuerst: ab Phase 2 wird jeder Screen und jede Auswertung gegen echte Tage
entwickelt statt gegen Zufallsdaten.

### Phase 1: Fundament, Datenmodell, Import und Export

**Ziel:** Die App startet, die Datenbank steht, der Daylio-Export ist drin und kommt verlustfrei
wieder heraus.

- Abhängigkeiten aus dem Tech-Stack installieren, `INTERNET` blockieren, Metro/Babel für
  `.sql`-Migrationen wie in Zyklus.
- Übernahmen aus Zyklus laut Tabelle: `db/`-Grundgerüst, `lib/dates`, `lib/theme` (neue
  Palette mit fünf Stimmungsfarben, Kontrast-Test), `lib/i18n`, `components/ui`, Tab-Layout mit
  fünf leeren Tabs, Bootstrap mit Splash bis zur Migration.
- Vollständiges Drizzle-Schema, erste Migration, Standardstimmungen und Standardgruppen als Seed
  in der Migration bzw. beim ersten Start.
- Repositories (`db/repositories/`) für Stimmungen, Gruppen, Aktivitäten, Einträge (inkl.
  Aktivitäten und Skalen), Pläne, Einstellungen. Synchron, `db` als erstes Argument, getestet.
- `lib/daylio/`: `csv.ts` (Parser und Writer nach RFC 4180, BOM), `parse.ts` (Zeile zu
  Rohdatensatz, Uhrzeit 24h und am/pm, `<br>` und Entities zu Text), `known.ts` (bekannte
  Stimmungen und Aktivitäten mit Gruppe und Icon), `plan.ts` (rein: aus Rohdaten und bestehendem
  Bestand einen Importplan mit neuen Stimmungen, Aktivitäten, Einträgen, Duplikaten und Fehlern),
  `write.ts` (Daylio-CSV aus dem Bestand).
- `lib/export/`: JSON-Schema, Serialisierung, Format-Migration, Merge/Replace, Dateien, wie in
  Zyklus.
- Minimaler "Mehr"-Tab mit dem Abschnitt Daten: Import mit Zuordnung und Vorschau, Export JSON,
  Export CSV, alles löschen mit getippter Bestätigung.
- Beispieldaten: synthetischer Generator (`lib/dev/`) für ~12 Monate, gleiche Struktur wie der
  echte Export, bei leerer Datenbank unter "Mehr" einmalig anbieten.

**Tests:**
- Fixture `lib/daylio/__tests__/fixtures/sample.csv`: **synthetisch**, aber mit allen Sonderfällen
  der echten Datei (BOM, Kommas und `""` in Notizen, `<br>`, leere Spalten, mehrere Einträge an
  einem Tag, am/pm, eigene Stimmung, unbekannte Aktivität).
- Der echte Export liegt nur lokal unter `private/` (in `.gitignore`). Ein Test, der ihn liest,
  wenn er existiert, und sonst übersprungen wird: Zahl der Einträge, Aktivitäten und Stimmungen
  wie in der Analyse, keine Fehler.
- Rundreise CSV: Import, Export, erneuter Import in eine leere DB ergibt denselben Bestand;
  der exportierte Text entspricht dem Original bis auf die Gruppenreihenfolge der Aktivitäten.
- Rundreise JSON: Beispieldaten exportieren, DB leeren, importieren, tiefe Gleichheit.
- Doppelter Import erzeugt keine Duplikate. Fehler in Zeile 17 lässt die DB unverändert.

**Fertig, wenn:** Der echte Export auf dem Handy importiert ist und alle Zahlen der Vorschau mit
der Analyse oben übereinstimmen.

### Phase 2: Erfassen und Ansehen

**Ziel:** Die App ersetzt Daylio im Alltag.

- **Eintrag-Editor** als Modal, neu und bearbeiten, löschen mit Rückfrage. Eingaben gehen beim
  Schließen nicht verloren (Lehre aus Zyklus 1.0.10).
- **Heute** mit Tagesleiste, Lesekarten der Einträge, Stimmungswähler als Einstieg in den Editor.
- **Kalender** als Monatsliste mit `DayGlyph` (Farbe plus Icon, Punkt bei mehreren Einträgen),
  Legende, Screenreader-Text je Tag (`lib/calendar/dayLabel.ts`).
- **Verlauf** als Timeline, gruppiert nach Monat, mit Notizauszug und Aktivitäts-Icons.
- **Suche** (`lib/search/`, rein): in Notizen, Aktivitäten, Stimmungen, akzentunabhängig,
  mehrere Chips mit UND, Filter nach Stimmungsstufe und Zeitraum.
- **Verwaltung** unter "Mehr": Stimmungen (Name, Icon, Stufe), Gruppen und Aktivitäten
  (umbenennen, Icon, Reihenfolge per Ziehen, zwischen Gruppen verschieben, archivieren,
  **zwei Aktivitäten zusammenführen**). Das Zusammenführen braucht es nach dem Import, um
  Dubletten aufzuräumen.
- Skalen im Editor, sofern welche angelegt sind.
- Haptik und Tipp-Animationen wie in Zyklus (`PressableScale`).

**Tests:** Suche, Tagesmittel, Zusammenführen von Aktivitäten (Einträge hängen danach an der
verbleibenden, keine doppelten Zeilen in `entry_activities`), Tageslabels, Monatsraster.

**Fertig, wenn:** Ein Tag in zwei Taps erfasst ist, jeder importierte Tag im Kalender und im
Verlauf richtig erscheint und die Aktivitäten nach dem Import ordentlich sortiert sind.

### Phase 3: Analysen und Auswertungen

**Ziel:** Aus den Einträgen wird Erkenntnis. Alle Berechnungen sind reine Funktionen in
`lib/insights/`, jede mit Tests gegen kleine, von Hand nachrechenbare Fixtures.

**Zeitraum:** ein Umschalter oben auf "Einblicke": 30 Tage, 90 Tage, Jahr, alles. Jede Karte
rechnet im gewählten Zeitraum.

**Karten, in drei Gruppen:**

*Stimmung*
- **Verlauf**: Tagesmittel als Punkte, gleitender 7-Tage-Mittelwert als Linie.
- **Verteilung**: Anteil je Stimmung, im Vergleich zum vorigen gleich langen Zeitraum.
- **Jahr in Pixeln**: ein Kästchen je Tag, Farbe nach Stimmung, Lücken leer. Antippen zeigt den
  Tag.
- **Wochentage**: Mittel je Wochentag mit Anzahl.
- **Monate**: Mittel je Monat als Balken.
- **Schwankung**: Standardabweichung je Woche, die ruhigsten und unruhigsten Wochen.
- **Serien**: längste Folge von Tagen ab "Gut", aktuelle Folge. Sachlich, keine Belohnung,
  keine Schuld bei Lücken.

*Aktivitäten*
- **Häufigkeit**: Top-Aktivitäten je Gruppe im Zeitraum, mit Trend gegen den vorigen Zeitraum.
- **Wirkung auf die Stimmung**: je Aktivität das Stimmungsmittel an Tagen mit gegen ohne, mit
  Differenz und Anzahl. Erst ab 5 Tagen je Seite. Sortiert nach Differenz, getrennt in "hebt"
  und "drückt". Formulierung: "An Tagen mit Sport im Schnitt 4,2 statt 3,8 (24 Tage)", nie
  "Sport macht dich glücklicher".
- **Am Folgetag**: dieselbe Rechnung mit der Stimmung des nächsten Tages (z. B. Schlaf Schlecht
  oder Überstunden am Vortag).
- **Oft zusammen**: häufigste Paare von Aktivitäten (Lift über der Erwartung bei
  Unabhängigkeit, ab 5 gemeinsamen Tagen) und ihr Stimmungsmittel.
- **Vor schwierigen Tagen**: welche Aktivitäten in den zwei Tagen vor Tagen mit Stufe 2 oder
  darunter überdurchschnittlich oft vorkamen.
- **Gruppenblick**: für Gruppen wie Wetter und Schlaf eine kompakte Tabelle Aktivität zu
  Stimmungsmittel.

*Notizen*
- **Wörter**: häufige Wörter in Notizen an guten gegen schwierige Tage, gefaltet, mit deutscher
  Stoppwortliste, ab 3 Vorkommen. Rein lokal.
- **Umfang**: Einträge, Tage mit Eintrag, Abdeckung in Prozent, Uhrzeit der Einträge.

**Detailseite je Aktivität** (`app/activity/[id].tsx`): alle Tage mit dieser Aktivität,
Stimmungsverteilung mit und ohne, Wochentagsverteilung, Begleiter, Verlauf der Häufigkeit je
Monat. Erreichbar aus jeder Karte, in der die Aktivität vorkommt, und aus der Verwaltung.

**Detailseite je Stimmung**: typische Aktivitäten dieser Stimmung gegenüber dem Durchschnitt.

**Regeln für alle Auswertungen:**
- Leerer Zustand überall: ohne Daten keine Karte mit NaN, sondern ein kurzer leerer Zustand.
- Mindestmengen als Konstanten neben der Funktion, im Handover begründet.
- Zusammenhänge, keine Ursachen. Keine Diagnosen, keine Bewertung der Person.
- Kleine Stichproben werden zur Mitte gezogen (Shrinkage `n / (n + k)`), damit eine Aktivität
  mit 6 Tagen nicht ganz oben steht.

**Fertig, wenn:** Mit den echten Daten jede Karte etwas Sinnvolles zeigt, die Zahlen stichprobenartig
von Hand gegen die CSV nachgerechnet sind und die Einblicke mit Beispieldaten und mit leerer DB
fehlerfrei laufen.

### Phase 4: Ausblick, Erinnerungen, Schutz, Release

**Ziel:** Ein ehrlicher Blick auf die nächsten Tage, und die App ist bereit für den Alltag auf dem
Handy.

**Ausblick** (`lib/outlook/`, rein, plus `useOutlook.ts`):

Für jeden der nächsten 7 Tage ein erwarteter Stimmungswert als Spanne:

```
erwartet(Tag) = Langzeitmittel
              + Nachwirkung  = φ^h · (jüngeres Mittel − Langzeitmittel)
              + Wochentag    = geschrumpfter Wochentagseffekt
              + Aktivitäten  = Summe der geschrumpften Effekte geplanter bzw. wiederkehrender Aktivitäten
```

- **Langzeitmittel** und **jüngeres Mittel**: exponentiell gewichtet (Halbwertszeit ca. 60 bzw.
  7 Tage).
- **Nachwirkung**: φ ist die Autokorrelation der Abweichungen vom Mittel bei Abstand 1 Tag,
  geschätzt aus den eigenen Daten, auf 0 bis 0,9 begrenzt. Sie klingt mit jedem Tag Abstand ab.
- **Wochentag**: Abweichung des Wochentagsmittels vom Gesamtmittel, geschrumpft.
- **Aktivitäten**: geplante Aktivitäten aus `planned_activities` plus **wiederkehrende**, die die
  App selbst erkennt (z. B. Arbeit an mindestens 70 % der Montage der letzten 8 Wochen). Effekt
  aus Phase 3 (mit gegen ohne, geschrumpft). Ein Plan überschreibt die Annahme.
- **Spanne**: aus der Verteilung der Fehler im Backtest für denselben Abstand h (z. B. 20. bis
  80. Perzentil). Anzeige als Stimmungsstufen ("zwischen Ok und Gut") plus Wahrscheinlichkeit
  für einen schwierigen Tag (Stufe 2 oder darunter), wenn sie über 15 % liegt.
- **Begründung**: die zwei bis drei größten Beiträge in Worten ("Sonntag meist besser",
  "Besuch geplant", "letzte Tage eher gut").

**Ehrlichkeit vor Vollständigkeit:**
- Ab 30 Tagen mit Eintrag, vorher "Noch zu wenig Daten".
- **Backtest** (`lib/outlook/backtest.ts`): rollierend über die Historie, jeweils nur mit Daten
  bis zum Stichtag, mittlerer absoluter Fehler je Abstand 1 bis 7. Vergleich gegen zwei naive
  Verfahren: "Langzeitmittel" und "häufigste Stimmung". Der Ausblick wird nur für die Abstände
  gezeigt, in denen das Modell beide schlägt. Sonst zeigt die Karte nur Wochentagsprofil und
  wiederkehrende Aktivitäten. Die Backtest-Zahlen für die echten Daten kommen ins Handover.
- Wort "Ausblick", nie "Vorhersage" oder "Prognose". Keine Uhrzeiten, keine Einzelwerte ohne
  Spanne.

**Oberfläche:**
- Karte "Die nächsten Tage" auf Heute: 7 schmale Spalten mit Wochentag, Stimmungs-Icon der
  Mitte, Balken für die Spanne, Deckkraft nach Sicherheit. Antippen zeigt die Begründung.
- Kalender: zukünftige Tage mit hohlem Ring in der erwarteten Stimmungsfarbe und kleinen Icons
  geplanter Aktivitäten.
- Pläne eintragen: zukünftigen Tag antippen, Aktivitäten wählen (gleiche Chips wie im Editor).
- Schalter "Ausblick zeigen" in den Einstellungen, Standard an.
- **Hinweis bei längerem Tief:** Liegen 7 der letzten 10 Tage bei Stufe 2 oder darunter, zeigt
  Heute eine ruhige Karte mit dem Hinweis, dass Reden hilft, und der Nummer der
  Telefonseelsorge (0800 111 0 111). Kein Alarm, keine Wertung, wegklickbar für 14 Tage.

**Erinnerungen** (lokal, opt-in, standardmäßig aus): tägliche Erinnerung zur gewählten Uhrzeit
(Vorschlag 20:30), entfällt, wenn heute schon ein Eintrag existiert. Unverfänglicher Text wie
"Wie war dein Tag?". Planung rein in `lib/notifications/plan.ts` wie in Zyklus.

**Schutz:** App-Sperre über Geräteentsperrung mit Verzögerung, FLAG_SECURE bei aktiver Sperre,
Erinnerung an eine JSON-Sicherung nach 60 Tagen (`last_export_at`), Datenschutzseite in
Klartext.

**Release:** `apk-release`-Skill aus Zyklus übernehmen und anpassen, Updatehistorie in
`lib/changelog/`, `npx expo prebuild` plus lokaler Gradle-Build, Manifest ohne `INTERNET` und
mit `allowBackup=false` prüfen (`aapt2`). Seit 1.0.10 heißt der Skill `deploy` und startet
die GitHub-Release-Pipeline, die Build und Manifestprüfung übernimmt.

**Tests:** Ausblick auf Fixtures (konstante Stimmung ergibt flachen Ausblick mit schmaler Spanne,
reiner Wochentagsrhythmus wird erkannt, geplante Aktivität verschiebt den Tag, weniger als 30
Tage ergibt keinen Ausblick), Backtest nutzt nie Daten nach dem Stichtag, Erinnerungsplan,
Backup-Erinnerung, Tief-Hinweis.

**Fertig, wenn:** Die APK auf dem Handy läuft, der Ausblick mit den echten Daten den naiven
Vergleich schlägt (oder ehrlich zurücktritt) und die Backtest-Zahlen dokumentiert sind.

---

## Nicht im Umfang

Fotos und Sprachnotizen, Ziele und Erfolge, Cloud-Sync, Teilen mit anderen, weitere Sprachen,
Dark Mode. Kandidaten für spätere Phasen, falls sie im Alltag fehlen:

- **Daylio-Backup (`.daylio`)** importieren: enthält Gruppen, Icons und eigene Stimmungen, die in
  der CSV fehlen. Braucht eine Beispieldatei und eine Prüfung des Formats, bevor darauf gebaut
  wird.
- **Daylio-Skalen**: Format der Spalte `scales` an einem Export mit gefüllten Skalen prüfen. Bis
  dahin liest der Parser `Name: Wert`-Paare getrennt durch ` | ` und meldet alles andere als
  Warnung statt als Fehler.
- **Monats- oder Jahresrückblick als PDF** über expo-print, wie der Arztbericht in Zyklus.
- **Verbindung zur Zyklus-App**: Zyklustag als Einflussgröße im Ausblick. Nur über einen
  bewussten Export/Import zwischen beiden Apps, nie über geteilten Speicher.

---

## Standards

- Dateien unter ca. 250 Zeilen, nach Feature aufteilen, nicht nach Typ.
- Kein `any`. Keine Geschäftslogik in Komponenten.
- Jede Datumsrechnung über `lib/dates`, getestet. Tage als Strings speichern und vergleichen.
- Leerer Zustand überall: eine neue Installation ohne Daten zeigt nie einen Absturz, ein NaN
  oder einen leeren Bildschirm.
- Barrierefreiheit: Tippziele mindestens 44, Screenreader-Labels an allem Interaktiven,
  WCAG AA für alle Farbpaare (getestet), Bedeutung nie nur über Farbe, Systemschriftgröße
  respektieren.
- Keine Gamification, keine Serien-Belohnungen, keine Schuld für fehlende Einträge.
- Echte Tagebuchdaten kommen nie ins Repository, auch nicht als Test-Fixture.
- `README.md` aktuell halten.

Mit der nächsten offenen Phase weitermachen und das Übergabeprotokoll befolgen. Unklares vorher
fragen statt annehmen; ist die Session nicht interaktiv, entscheiden und die Entscheidung in der
Entscheidungsdatei der Phase festhalten.
