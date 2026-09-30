# Phase 7: Fotos und Daylio-Sicherung (Handover)

## Status

Auf Branch `feature/fotos`, nicht committet, keine Version gehoben, keine APK gebaut. Paul wollte die Fotos aus Daylio nachholen, die der CSV-Export nicht enthält, und künftig ein Foto pro Tag erfassen.

| Prüfung | Ergebnis |
| --- | --- |
| `npm run typecheck` | sauber |
| `npm test` | 45 Suites, 316 Tests grün (vorher 42 und 302; neu: `lib/daylio/__tests__/backup.test.ts`, `backupPrivate.test.ts`, `lib/export/__tests__/archive.test.ts`, ein Fall in `journal.test.ts`) |
| Echte Daylio-Sicherung (`private/backup_2026_09_27.daylio`) | 270 Einträge ohne Fehler, 61 Fotodateien, 60 Verweise an 57 Einträgen (57 Tage). Jeder Eintrag entspricht dem der CSV (Datum, Uhrzeit, Stimmung, Notiz, Aktivitäten). Nach dem CSV-Import fügt die Sicherung 0 Einträge und 60 Fotos hinzu, ein zweiter Import 0 Fotos. Ein Foto gehört zu keinem Eintrag und wird nicht behalten |
| `npx expo-doctor` | 21/21 |
| `npx expo export --platform android` | bündelt |
| `npx expo prebuild --platform android` | in einer Kopie: `CAMERA`, `RECORD_AUDIO`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_VISUAL_USER_SELECTED` und weiter `INTERNET` mit `tools:node="remove"`, `allowBackup="false"` |

**Nicht geprüft:** alles auf dem Gerät (Fotoauswahl, Verkleinern, Anzeige, Import der `.daylio` über die Dateiauswahl, Sicherung als ZIP teilen und in einen Ordner speichern). Siehe offene Punkte.

## Das Format der Daylio-Sicherung

Am echten Export abgelesen (Daylio `version` 15, `backup_version` 2, Android): eine ZIP-Datei mit `backup.daylio` (Base64 eines JSON-Objekts) und den Fotos unter `/assets/photos/<Jahr>/<Monat>/<Prüfsumme>`, JPEG ohne Endung, von Daylio schon verkleinert (etwa 768 × 1020, 100 KB). Die Namen im ZIP beginnen mit `/`. Im JSON: `dayEntries` mit `year`, `month` (ab 0), `day`, `hour`, `minute`, `mood` (id in `customMoods`), `note` (mit `<br>` und Entities wie in der CSV), `tags` (ids), `assets` (ids); `assets` verbindet die id mit `checksum` und `type` (1 = Foto); `customMoods` mit `mood_group_id` 1 (rad) bis 5 (awful) und leerem `custom_name` für die Standardstimmungen; `tags` und `tag_groups` mit Namen und Reihenfolge.

## Entscheidungen

1. **Fotos gehören zum Eintrag, nicht zum Tag.** Wie in Daylio. Der Editor erlaubt eins pro Eintrag, und weil ein neuer Eintrag ohnehin einen freien Tag braucht, ist das ein Foto pro Tag. Einträge aus Daylio behalten alle ihre Fotos (bei Paul haben 3 Einträge zwei).
2. **Dateien im privaten Ordner, die Zeile nennt nur den Namen.** `Paths.document/photos/`, nicht Galerie, nicht Cache. Tabelle `entry_photos` (`entry_id` mit `cascade`, `file_name` eindeutig, `sort_order`, `created_at`), Migration `0002`. `lib/photos/store.ts` beschreibt die Ablage als Schnittstelle, `fileStore.ts` ist die echte, `memoryPhotoStore` die für Tests. So laufen Import und Sicherung in Jest.
3. **Aufräumen über einen Abgleich** (`sweepPhotos`): Dateien, auf die keine Zeile zeigt, werden gelöscht. Beim Start, nach jedem Import, in den Entwicklerwerkzeugen. Beim Speichern und Löschen im Editor gehen die entfernten Dateien sofort. Ein gewähltes, aber nie gespeichertes Foto bleibt bis zum nächsten Start. "Alle Daten löschen" löscht den ganzen Ordner.
4. **Neue Fotos**: System-Fotoauswahl von `expo-image-picker` (keine Berechtigung, keine Kamera), dann mit `expo-image-manipulator` auf höchstens 1600 px lange Kante und JPEG 0,8. Angezeigt mit `expo-image`, `cachePolicy` "memory", damit keine zweite Kopie in einem Cache landet, den "Alle Daten löschen" nicht erreicht.
5. **Dateinamen**: `photo-<Zeit>-<Zufall>.jpg` aus der App, `daylio-<Prüfsumme>.jpg` aus Daylio. Die Prüfsumme lässt einen zweiten Import dasselbe Foto wiedererkennen. Namen aus Dateien werden gegen `[A-Za-z0-9._-]` geprüft, bevor irgendetwas geschrieben wird, damit kein Name aus dem Fotoordner hinausführt.
6. **Die `.daylio` läuft durch den CSV-Importer.** `lib/daylio/backup.ts` macht aus dem JSON dieselben `RawEntry`-Datensätze wie die CSV, plus Fotonamen; Planung, Zuordnung, Vorschau und Duplikaterkennung bleiben dieselben. Standardstimmungen bekommen die deutschen Namen ihrer Stufe, damit sie auf dieselben Stimmungen fallen wie beim CSV-Import. Aktivitäten werden je Eintrag in Daylios Reihenfolge (Gruppe, dann Tag) sortiert, damit `fileOrder` dieselben Ketten sieht. Daylios eigene Gruppen werden **nicht** übernommen, neue Aktivitäten landen wie beim CSV über `known.ts` in den Daylight-Gruppen.
7. **Fotos gehen auch an vorhandene Einträge.** Nach dem Anlegen der neuen Einträge sucht der Import für jeden Datensatz mit Fotos den Eintrag mit gleichem `entryKey` und hängt dort an, was noch fehlt. So holt die Sicherung die Fotos zu Einträgen nach, die vorher aus der CSV kamen. Ein in Daylight geänderter Eintrag (andere Notiz) wird nicht erkannt und käme als neuer Eintrag dazu, wie schon beim CSV-Import.
8. **Dateien vor der Transaktion, Aufräumen danach.** Keine Zeile zeigt je auf eine fehlende Datei; schlägt die Transaktion fehl, entfernt der Abgleich die geschriebenen Dateien wieder.
9. **Daylight-Sicherung Version 2.** `schema_version` 2 mit `entry_photos` (Eintrag, Dateiname, Reihenfolge, Zeitstempel); Version 1 wird mit leerer Liste gelesen. Mit mindestens einem Foto ist die Sicherung eine ZIP-Datei (`daylight.json` plus `photos/<Name>`), sonst wie bisher reines JSON. Beide Menüpunkte ("teilen", "in Ordner speichern") wählen das selbst. Fotozeilen, deren Datei weder im ZIP noch auf dem Gerät liegt, werden beim Import verworfen.
10. **Die ZIP wird in Stücken geschrieben**, ein Foto nach dem anderen, gesammelt in Blöcken von 4 MB in eine Datei im Cache. Fotos ungepackt (JPEG schrumpft nicht), das JSON komprimiert. In einen über Android gewählten Ordner wird die fertige Datei am Stück geschrieben, dort ist Anhängen nicht verlässlich.
11. **Import liest die Datei als Bytes** und erkennt ZIP am Anfang `PK\3\4`: mit `backup.daylio` eine Daylio-Sicherung, mit `daylight.json` eine Daylight-Sicherung, sonst Text wie bisher. Die Vorschau nennt zusätzlich "Dazu 60 Fotos, davon 60 neu."
12. **Skalen aus der Daylio-Sicherung** werden nicht gelesen (Pauls Datei hat keine, das Format ist unbekannt); Einträge mit Skalenwerten bekommen einen Hinweis.

## Offene Punkte

- **Geräteprüfung**: `.daylio` über "Importieren" wählen, Vorschau muss "0 Einträge hinzu, 270 schon vorhanden, dazu 60 Fotos, davon 60 neu" zeigen. Danach Fotos in Heute und im Verlauf ansehen, ein Foto groß öffnen, im Editor ein Foto hinzufügen und entfernen, Sicherung teilen (ZIP) und in eine frische Installation zurückspielen.
- **Drehung**: ob `expo-image-manipulator` die EXIF-Ausrichtung eines Handyfotos anwendet, sagt die Doku nicht. Hochkant aufgenommene Fotos auf dem Gerät prüfen.
- **Speicher beim Import**: `.daylio` und Daylight-ZIP werden ganz entpackt, also etwa die doppelte Dateigröße im Speicher. Bei Pauls 8 MB kein Thema; bei Jahren mit einem Foto pro Tag (rund 100 MB pro Jahr) auf dem Gerät beobachten, sonst auf streamendes Entpacken umstellen.
- **Android beendet die App** manchmal während der Fotoauswahl; `ImagePicker.getPendingResultAsync` ist noch nicht eingebaut, das Foto wäre dann verloren und müsste neu gewählt werden.
- Der Kalender zeigt keine Fotos, nur Heute und Verlauf.
- Updatehistorie und Version macht `/apk-release`.
