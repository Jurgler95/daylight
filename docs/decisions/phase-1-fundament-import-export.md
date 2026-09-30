# Phase 1: Fundament, Datenmodell, Import und Export (Handover)

## Status

Abgeschlossen am 2026-09-26, nicht interaktiv. Verifiziert:

- `npm run typecheck` sauber (mit generierten Typed Routes, siehe Entscheidung 24).
- `npm test`: 108 Tests grün in 13 Suites, darunter `private/__tests__/daylio.test.ts` gegen den echten Export (läuft nur, wenn `private/daylio_export_2026_09_26.csv` existiert).
- `npx expo export --platform android` bündelt.
- `npx expo-doctor` 21/21 (Abhängigkeiten haben sich geändert).
- `npx expo prebuild --platform android` in einer Kopie außerhalb des Repos: `INTERNET` steht mit `tools:node="remove"` im Manifest, `android:allowBackup="false"`.

Ergebnis gegen den echten Export (`private/`, nie im Repo): 270 Einträge vom 29.12.2025 bis 25.09.2026, keine fehlerhafte Zeile, 4 Stimmungen (alle auf die Standardstimmungen abgebildet), 42 Aktivitäten, davon 42 neu, keine landet in "Importiert". Zusammenführen fügt 270 Einträge hinzu, 0 sind schon vorhanden. Ein zweiter Import fügt 0 hinzu. Der eigene CSV-Export entspricht dem Original Spalte für Spalte, die Aktivitäten als Menge verglichen (Ausnahme: Entscheidung 9).

**Nicht geprüft:** Import auf dem Handy. In dieser Session gab es weder Gerät noch Emulator. Die Prüfung steht unter "Offene Punkte".

## Was existiert

| Pfad | Zweck |
| --- | --- |
| `package.json`, `app.json`, `babel.config.js`, `metro.config.js`, `sql.d.ts`, `drizzle.config.ts` | Tech-Stack installiert, `android.blockedPermissions` wie in Zyklus (INTERNET, FCM, Badges), `.sql` über `babel-plugin-inline-import` und Metro `sourceExts`, Skripte `db:generate` und `db:check`. |
| `.gitignore` | `private/` für den echten Export. |
| `db/schema.ts`, `drizzle/0000_*.sql` | Vollständiges Schema: `moods`, `activity_groups`, `activities`, `entries`, `entry_activities`, `scales`, `entry_scales`, `planned_activities`, `settings`. |
| `db/client.ts`, `db/migrate.ts`, `db/testDb.ts`, `db/types.ts` | Aus Zyklus. Datei `daylight.db`. Migration plus `ensureDefaults` beim Start und in Tests. |
| `db/validate.ts`, `db/chunks.ts` | Prüfungen für Datum, `HH:mm`, Stufe, Namen. `chunked` teilt Mehrzeilen-Inserts (SQLite-Variablengrenze). |
| `db/repositories/` | Synchron, `db` als erstes Argument: `moods`, `groups`, `activities`, `entries` (inklusive Aktivitäten und Skalenwerten, `listEntryDetails`), `scales`, `plans`, `settings`, `defaults` (Standardstimmungen und -gruppen), `maintenance` (`clearJournal`, `deleteAllData`, `countRows`). |
| `db/__tests__/journal.test.ts` | Repository-Tests. |
| `lib/daylio/csv.ts` | RFC-4180-Parser und -Writer, BOM, Zeilennummern je Datensatz. |
| `lib/daylio/parse.ts` | Zeile zu `RawEntry`, zod je Zeile, Fehler mit Zeile und Code, Warnungen (Skalen, doppelte Aktivität), Uhrzeit 24h und am/pm, `<br>` und Entities. |
| `lib/daylio/known.ts` | Standardstimmungen, Standardgruppen, bekannte Daylio-Namen (deutsch, englisch) mit Stufe bzw. Gruppe und Icon. |
| `lib/daylio/plan.ts` | Rein: `buildImportPlan` (neue Stimmungen, Gruppen, Aktivitäten, Skalen, Einträge, Duplikate), `entryKey`, `fileOrder`. |
| `lib/daylio/apply.ts` | `readCatalog`, `previewDaylioImport`, `applyDaylioImport` in einer Transaktion. |
| `lib/daylio/write.ts`, `lib/daylio/rows.ts` | Daylio-CSV aus dem Bestand, im Layout von Daylio. |
| `lib/export/` | JSON: `schema.ts` (zod mit Verweisprüfung), `migrateFormat.ts`, `serialize.ts`, `import.ts` (Vorschau, Ersetzen), `merge.ts` (Zusammenführen nach Bedeutung), `detect.ts` (Formaterkennung), `pending.ts` (geparste Datei zwischen "Mehr" und Vorschau), `summary.ts` (Vorschautext), `files.ts`, `backup.ts` (Regel aus Zyklus, noch ohne Karte), Hooks `useDataTransfer`, `useImportPreview`, `useBackupStatus`. |
| `lib/dev/` | `generateSample.ts` und `notes.ts` (synthetisches Jahr), `sample.ts` (lädt über den Import-Pfad), `random.ts` aus Zyklus. |
| `lib/dates/` | Aus Zyklus, dazu `formatNumeric`, `formatDayMonth`, `formatWeekdayLong`, `weekdayOf`. |
| `lib/theme/` | Palette "Tageslicht", `moodColors` je Stufe, Kontrasttest auf Stimmungsfarben erweitert. |
| `lib/icons/` | Typ `IconName` für MaterialCommunityIcons. |
| `lib/i18n/`, `lib/haptics/`, `lib/search/fold.ts`, `lib/store/`, `lib/changelog/` | Aus Zyklus, Texte neu. |
| `components/ui/` | Aus Zyklus ohne `FeatherBackdrop`, Karten deckend. |
| `components/import/` | `IssueList`, `MoodMapping`, `ActivityMapping`. |
| `app/_layout.tsx`, `app/(tabs)/` | Splash bis zur Migration, fünf Tabs. Heute zeigt nur die Zahl der Einträge, Kalender, Einblicke und Verlauf sind Platzhalter. |
| `app/(tabs)/settings.tsx` | "Mehr": Import, Sicherung teilen oder speichern, Daylio-CSV, alles löschen, Updatehistorie, Beispieldaten bei leerer DB, Entwicklerkarte unter `__DEV__`. |
| `app/more/import.tsx`, `app/more/delete.tsx`, `app/more/changelog.tsx` | Import-Vorschau mit Zuordnung, Löschen mit getipptem `LÖSCHEN`, Updatehistorie. |
| `lib/daylio/__tests__/fixtures/sample.csv` | Synthetisch: BOM, Kommas und `""` in Notizen, `<br>`, Entity, leere Spalten, zwei Einträge an einem Tag, am/pm, eigene Stimmung "Geht so", unbekannte Aktivität "Töpfern". |

## Entscheidungen

1. **Standardstimmungen und -gruppen entstehen beim Start, nicht in der Migration.** `ensureDefaults` füllt nur leere Tabellen und läuft nach jeder Migration, in `createTestDb` und nach "alles löschen". Die SQL-Migration bleibt reines Schema, und es gibt genau einen Weg zu einer frischen Datenbank.
2. **Nur Gruppen, keine Standardaktivitäten.** Die Spezifikation nennt Standardstimmungen und -gruppen. Eine Neuinstallation ohne Import hat damit leere Gruppen. Ob Phase 2 Standardaktivitäten anlegt (Kandidaten stehen in `knownActivitiesByGroup()`), ist offen.
3. **Standardgruppen** sind die sechs Gruppen aus der Analyse (Gefühle, Schlaf, Wetter, Soziales, Arbeit, Orte und Freizeit). "Importiert" entsteht erst, wenn eine Aktivität keinen Vorschlag hat, und steht am Ende.
4. **Icons von Stimmungen und Aktivitäten sind MaterialCommunityIcons**, die Oberfläche bleibt bei Ionicons wie in Zyklus. Ionicons hat weder neutrale Emoticons noch Wettersymbole in dieser Breite. Gespeichert wird der Glyph-Name, `lib/icons` liefert den Typ.
5. **Palette "Tageslicht"**: Creme-Hintergrund `#FBF7F0`, Akzent Bernstein `#98560A`, je Stimmungsstufe eine kräftige und eine helle Farbe (Petrol, Grün, Blau, Rost, Himbeer). Die kräftige Farbe erreicht 4,5:1 auf allen Flächen und auf ihrer hellen Farbe, Weiß auf der kräftigen ebenfalls; benachbarte Stufen liegen im RGB-Abstand mindestens 50 auseinander. Alles in `contrast.test.ts`.
6. **Karten sind deckend.** Die Transparenz in Zyklus diente dem Federn-Hintergrund, der laut Tabelle wegfällt.
7. **Stimmungen im Import:** gleicher gefalteter Name findet die vorhandene Stimmung. Ein Standardname der anderen Sprache landet auf der Stimmung derselben Stufe ("rad" auf "Super"), damit ein englischer Export keine zweite Stimmungsreihe anlegt. Ein unbekannter Name wird neu angelegt, vorgeschlagen ist Stufe 3, die Vorschau lässt die Stufe wählen. Folge: ein englischer Export wird beim Zurückschreiben mit den deutschen Namen exportiert.
8. **Aktivitäten im Import** werden über den gefalteten Namen über alle Gruppen hinweg wiedergefunden (die erste in Anzeigereihenfolge). Neue bekommen Gruppe und Icon aus `known.ts`, sonst "Importiert" und `tag-outline`. **Reihenfolge neuer Aktivitäten** leitet sich aus der Datei ab: Daylio schreibt Aktivitäten in seiner Sortierung, jede Zeile ist also eine Kette von "kommt vor"-Hinweisen, `fileOrder` sortiert topologisch, Gleichstände und Widersprüche nach erstem Auftreten. Beim echten Export stehen nach dem Rundlauf 72 von 270 Zeilen wieder in exakt der Daylio-Reihenfolge; im Rest weicht die Reihenfolge ab, weil Daylios Gruppen andere sind als die vorgeschlagenen (etwa "Restaurant" nach "Arbeit").
9. **Eine Aktivität, die in einer Zeile doppelt steht, wird einmal übernommen.** Im echten Export steht "Urlaub" in 9 Zeilen zweimal (107 bis 115). Das sind vermutlich zwei Daylio-Aktivitäten gleichen Namens in verschiedenen Gruppen; die CSV enthält keine Gruppen, eine Zuordnung wäre geraten. Die Vorschau zeigt je Zeile einen Hinweis, die Zählung bleibt bei 42 Aktivitäten wie in der Analyse. Folge: Im eigenen CSV-Export steht "Urlaub" in diesen 9 Zeilen einmal. Das ist die einzige Abweichung vom Original außer der Aktivitätsreihenfolge.
10. **Ein Eintrag gilt als vorhanden**, wenn Datum, Uhrzeit, Stimmungsstufe und Notiz übereinstimmen (Notiztitel zählt nicht mit, wie in der Spezifikation). Das gilt gegen die Datenbank und innerhalb derselben Datei, für CSV und JSON.
11. **Fehlerhafte Zeilen** (falsche Spaltenzahl, ungültiges Datum, unlesbare Uhrzeit, fehlende Stimmung) werden mit Zeilennummer, Code und Wert gesammelt; die Texte kommen aus i18n. Ohne den Schalter "Fehlerhafte Zeilen überspringen" wirft `applyDaylioImport` vor der Transaktion `ImportHasErrorsError`. Nur eine fehlende Kopfzeile oder ein nicht geschlossenes Anführungszeichen lehnt die ganze Datei ab, weil danach nichts mehr verlässlich lesbar ist.
12. **HTML-Entities werden beim Import dekodiert, beim Export nicht kodiert.** Daylio kodiert `&` nicht (die echte Datei enthält `&` roh). Eine Notiz mit wörtlich "&amp;" würde beim Import zu "&". Bewusst in Kauf genommen.
13. **Layout des Daylio-Exports**, am echten Export abgelesen: BOM, Kopfzeile ungequotet, Spalten 1 bis 5 nur bei Bedarf in Anführungszeichen, Spalten 6 bis 9 immer, `\n` zwischen Zeilen, kein Zeilenumbruch nach der letzten, Zeilenumbrüche in Notizen als `<br>`, neueste Zeile zuerst (Datum, dann Uhrzeit absteigend). Die Uhrzeit wird immer 24h geschrieben. `date` und `weekday` kommen aus `lib/dates`.
14. **Skalen**: Der Parser liest `Name: Wert` getrennt durch ` | `, alles andere wird als Warnung gemeldet und übersprungen. Neue Skalen bekommen 0 bis 10 oder weiter, falls die Datei größere Werte enthält. Der Export schreibt dasselbe Format. Unverifiziert, weil kein Export mit Skalen vorliegt.
15. **Ersetzen per CSV** löscht Einträge, Stimmungen, Gruppen, Aktivitäten, Skalen und Pläne (`clearJournal`), legt die Standards neu an und importiert wie in eine leere Datenbank. Einstellungen bleiben. **Ersetzen per JSON** stellt alle Tabellen mit ids wieder her und überschreibt die Einstellungen aus der Datei, `last_export_at` bleibt dabei erhalten (in Zyklus ging es verloren). Die Vorschau nennt immer die Zahlen des Zusammenführens, beim Ersetzen erscheint ein Warnsatz und eine Rückfrage.
16. **JSON-Format**: `app: "daylight"`, `schema_version` 1, `app_version`, `exported_at`, `settings` (ohne id, Zeitstempel und `last_export_at`), dann jede Tabelle einzeln mit ids. Ein `superRefine` prüft Verweise (Eintrag auf Stimmung, Aktivität auf Gruppe, Verknüpfungen, Pläne) vor jedem DB-Zugriff. Das Feld `app` unterscheidet die Datei von einer Zyklus-Sicherung, die ebenfalls `schema_version` hat. Zusammenführen ordnet nach Bedeutung zu (Gruppen und Skalen über den gefalteten Namen, Stimmungen über Namen und Stufe, Aktivitäten über Gruppe und Namen), neue Zeilen hängen sich ans Ende.
17. **Mehrzeilen-Inserts in Blöcken von 200 Zeilen**, weil SQLite die Variablen je Anweisung begrenzt und einige tausend Einträge mit Verknüpfungen darüber lägen.
18. **Die Vorschau ist ein eigener Screen** (`/more/import`), nicht ein `Alert` wie in Zyklus: die Zuordnung von Stimmungen und Aktivitäten braucht Eingaben. "Mehr" liest und prüft die Datei, legt sie in einem zustand-Store ab und öffnet den Screen; geschrieben wird erst mit "Importieren". Jede Aktivität bekommt eine Auswahlzeile, bei 42 Aktivitäten eine lange, aber einfache Liste.
19. **Format wird am Inhalt erkannt** (`{` oder Daylio-Kopfzeile), nicht an der Endung: der Android-Picker liefert Namen oft ohne Endung. Ein Import gibt es also nur einmal in "Mehr", für alle Formate.
20. **Beispieldaten laufen durch denselben Import-Pfad** wie ein Daylio-Export (Quelle `app`), plus die Skala "Energie" (1 bis 5) und Pläne für die nächsten 14 Tage. Das Jahr ist deterministisch (Seed 42), ungefähr 3 % Lücken, 4 % Tage mit zwei Einträgen, Stimmung nach Schlaf, Wochentag, Arbeit und Sozialem mit Nachwirkung vom Vortag. Im Release-Build erscheint "Beispieldaten laden" nur bei null Einträgen, im Dev-Build die Karte "Entwicklung" wie in Zyklus.
21. **Alle Pakete aus dem Tech-Stack sind installiert**, auch die erst in Phase 4 genutzten (Benachrichtigungen, Sperre, Bildschirmschutz). `@react-native-community/datetimepicker` aus Zyklus steht nicht im Tech-Stack und fehlt deshalb; Phase 4 braucht ihn für die Erinnerungszeit vermutlich.
22. **Fremdschlüssel**: Eintrag auf Stimmung und Aktivität auf Gruppe mit `restrict`, Verknüpfungen mit `cascade`. Stimmungen, Gruppen, Aktivitäten und Skalen werden archiviert, nicht gelöscht. `activities` ist eindeutig über (`group_id`, `name`), die Repositories prüfen zusätzlich den gefalteten Namen.
23. **Einstellungen** als Singleton wie in Zyklus: `first_day_of_week` 1, `reminder_enabled` aus, `reminder_time` 20:30, `app_lock_enabled` aus, `app_lock_delay_seconds` 0, `outlook_enabled` an, `last_export_at`.
24. **Typed Routes**: Nach neuen Dateien unter `app/` einmal `npx expo customize tsconfig.json` (ändert die Datei nicht, erzeugt `.expo/types/router.d.ts`), sonst sind Pfade in `tsc` nicht geprüft.
25. **`SplashScreen.hide()` statt `hideAsync()`**: laut SDK-57-Doku ist `hideAsync` nur noch aus Kompatibilität da.
26. **Der Test gegen `private/`** meldet bei Abweichungen nur Zeilennummern und Spaltennamen, nie Inhalte, damit keine Notiz in einer Testausgabe landet. Er wird übersprungen, wenn die Datei fehlt.
27. **Heute zeigt in Phase 1 nur die Zahl der Einträge** und das erste Datum. Genug, um den Import auf dem Handy zu prüfen, ohne Phase 2 vorzugreifen.

## Offene Punkte für spätere Phasen

- **Geräteprüfung ausstehend**: echten Export auf dem Handy importieren (Dateiauswahl, Vorschau mit den Zahlen oben, Import), danach "Sicherung teilen", "Sicherung in Ordner speichern" und "Als Daylio-CSV exportieren" ausprobieren. Heute muss danach "270 Einträge seit 29.12.2025" zeigen.
- **"Urlaub" doppelt** (Entscheidung 9): Paul fragen, ob Daylio zwei Aktivitäten "Urlaub" in verschiedenen Gruppen hat. Falls ja und sie getrennt bleiben sollen, bräuchte es eine Zuordnung in der Vorschau; die Information steckt nur in den 9 Zeilen mit beiden.
- **Aktivitätsreihenfolge nach dem Import** folgt der Datei (Entscheidung 8), innerhalb der Gruppen also Daylios Reihenfolge, soweit ableitbar. Phase 2 baut die Verwaltung zum Umsortieren und Zusammenführen.
- **Standardaktivitäten** für eine Neuinstallation ohne Import (Entscheidung 2) in Phase 2 entscheiden.
- Kalender, Einblicke und Verlauf sind Platzhalter, Heute ist minimal. `components/calendar/`, `lib/calendar/`, Tagesleiste und `DayGlyph` sind noch nicht übernommen (Phase 2).
- `lib/lock/`, `lib/notifications/`, `.claude/skills/apk-release/` sind noch nicht übernommen (Phase 4). `lib/export/backup.ts` ist da, die Karte auf Heute fehlt noch.
- Die Stufenauswahl für neue Stimmungen beschriftet die Stufen mit den Standardnamen ("Gut (4)"), auch wenn die Stimmungen umbenannt wurden.
- Die geparste Datei bleibt im Store, wenn die Vorschau ohne Import verlassen wird. Harmlos, wird beim nächsten Import überschrieben.
- Skalenformat unverifiziert (Entscheidung 14).
- Ersetzen zeigt in der Vorschau die Zahlen des Zusammenführens.
