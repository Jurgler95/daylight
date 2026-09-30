# Phase 5: Prüfung (Handover)

## Status

Abgeschlossen am 2026-09-26, nicht interaktiv, direkt auf `main`, nicht gepusht. Geprüft wurde das ganze Projekt gegen `docs/daylight-build-prompt.md` und die Übergaben der Phasen 1 bis 4, mit Zyklus (`../menstruation-cycle`) als Vergleich für übernommene Muster.

| Prüfung | Ergebnis |
| --- | --- |
| `npm run typecheck` | sauber (vor und nach den Korrekturen) |
| `npm test` | 272 Tests in 40 Suites grün (vorher 261 in 37). 26 volle Läufe, davon 12 während des Gradle-Builds: 24 grün, 2 rot, beide durch einen Absturz von Node selbst (Fund 14), kein Zeitlimit, kein fachlich roter Test |
| `npx expo export --platform android` | bündelt (7,9 MB Hermes-Bytecode) |
| `npx expo-doctor` | 21/21 (Abhängigkeiten seitdem unverändert) |
| `npx expo prebuild --platform android --clean` | in einer APFS-Kopie außerhalb des Repos ohne `private/` und `.git`: `INTERNET`, FCM und alle Badge-Rechte mit `tools:node="remove"`, `android:allowBackup="false"` |
| Release-Build | `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` mit JDK 17 in derselben Kopie, 3 min 38 s. `builds/daylight-1.0.1.apk`, 51,7 MB, `versionCode` 2, `versionName` 1.0.1, nur `arm64-v8a` |
| aapt2 (build-tools 37.0.0) | kein `android.permission.INTERNET`, keine FCM- oder Badge-Rechte, `allowBackup=false`; dieselben 12 Berechtigungen wie 1.0.0, das Manifest ist bis auf die Versionsnummern identisch. Der Eintrag `c2dm.permission.SEND` im Manifest ist kein angefordertes Recht, sondern die Absenderprüfung eines Empfängers aus expo-notifications (ohne Netz wirkungslos) |
| Netzwerk im Code | kein `fetch`, `XMLHttpRequest`, `WebSocket` und keine http(s)-Adresse im App-Code; einzige Außenwirkung ist `tel:` für die Telefonseelsorge |
| Gedankenstriche | weder U+2014 noch U+2013 (auch nicht U+2012, U+2015, U+2212) in `de.json`, Quelltexten, README, `docs/`, `.claude/skills/` und allen Commit-Messages |
| Vollständigkeit | Jeder Punkt der vier Phasen ist umgesetzt oder in einer Übergabe begründet zurückgestellt (Daylio-Backup, Skalenformat, Standardaktivitäten). Einzige Lücke ohne Umsetzung und ohne Begründung: der Wochenbeginn (Fund 9) |
| Doku-Konsistenz | README, Übergaben und Code widersprechen sich nicht. Die konsolidierte Liste der Phase 4 stimmt; ihr fehlten der Wochenbeginn (Fund 9) und die Ursache der roten Testläufe (Fund 14). Überholt ist ein Satz in Phase 3 Entscheidung 11 (Fund 3) |
| Dateigrößen, Typen | keine Quelldatei über 250 Zeilen (größte 198), `strict` mit `noUncheckedIndexedAccess`, kein `any`, kein `@ts-ignore` |

Die APK liegt unter `builds/daylight-1.0.1.apk` (gitignored) und wurde **nicht** ausgeliefert.

### Private Daten in der Git-Historie

Geprüft über alle 380 Blobs der Objektdatenbank (auch unerreichbare, `git cat-file --batch-all-objects`) und alle Commit-Messages, mit einem Wegwerfskript außerhalb des Repos, das nur Zählungen und Pfade ausgibt:

- Der Blob-Hash der CSV unter `private/` kommt nicht vor.
- Aus allen 270 Notizen jede Folge von vier Wörtern (ab 18 Zeichen) gegen jeden Blob: ein Treffer, eine allgemeine Wendung in den synthetischen Beispielnotizen (`lib/dev/notes.ts`).
- Seltene Wörter (ab 7 Buchstaben, in höchstens drei Notizen): alle Treffer sind Alltagswörter in Doku, Stoppwortliste, Locale oder Beispielnotizen. `lib/dev/notes.ts` teilt mit den echten Notizen nur allgemeine Wörter.

**Ergebnis: kein Inhalt aus `private/` in der Historie.** Die Tests gegen `private/` melden nur Zahlen.

### Rundreisen mit dem echten Export

| Rundreise | Test | Ergebnis |
| --- | --- | --- |
| Daylio-CSV importieren, als CSV exportieren | `private/__tests__/daylio.test.ts` | byte-gleich bis auf die Aktivitätsspalte (Reihenfolge nach Daylights Gruppen, "Urlaub" einmal statt zweimal in 9 Zeilen, Phase 1 Entscheidung 9) |
| eigene CSV in eine leere DB, Original erneut | ebenda | gleicher Bestand, 0 hinzugefügt |
| JSON-Sicherung, alles löschen, Ersetzen | `private/__tests__/export.test.ts` (neu) | Export danach tief gleich dem vorher |
| JSON in ein leeres Tagebuch zusammenführen | ebenda | gleiche Daylio-Zeilen, gleiche Zeilenzahlen |
| Sicherung, Daylio-Datei und eigene CSV erneut gegen denselben Bestand | ebenda | 0 hinzugefügt, keine Duplikate |

## Was existiert (neu oder geändert)

| Pfad | Zweck |
| --- | --- |
| `private/__tests__/export.test.ts` | JSON-Rundreisen mit dem echten Export (nur mit `private/`) |
| `lib/notifications/serial.ts`, `__tests__/serial.test.ts`, `useReminderSync.ts` | Warteschlange, damit Synchronisierungen der Erinnerung nacheinander laufen |
| `lib/lock/store.ts` (`shouldRelock`), `useAppLock.ts`, `__tests__/relock.test.ts` | Rücksperren nur nach festgehaltenem Verlassen |
| `lib/insights/swings.ts`, `overview.ts` | längste Folge über das ganze Tagebuch, sofern sie in den Zeitraum reicht |
| `lib/insights/words.ts`, `coverage.ts` | Wortverhältnis über Tage mit Notiz; übliche Uhrzeit mit Tageswechsel um 4 Uhr |
| `lib/insights/format.ts`, `lib/dates/index.ts` | dezimale Rundung; `formatRange` mit Jahren; `startOfMonthString`, `monthWeekDays` |
| `lib/calendar/monthGrid.ts` | ohne eigenen date-fns-Import |
| `app/(tabs)/settings.tsx`, `lib/i18n/locales/de.json` | Abschnitt "Kalender" mit "Woche beginnt am" |
| `components/ui/Button.tsx`, `components/today/LowMoodCard.tsx`, `app/(tabs)/history.tsx` | eigenes Screenreader-Label am Knopf, Tippziel "Zurücksetzen" |
| Tests in `lib/insights/__tests__/`, `lib/dates/__tests__/`, `lib/calendar/__tests__/` | zu den Korrekturen, NaN-Prüfung wirksam |
| `app.json`, `package.json`, `package-lock.json`, `lib/changelog/index.ts` | Version 1.0.1, `versionCode` 2, Updatehistorie |
| `README.md` | neuer privater Test, Hinweis auf den Absturz von Node 24.14.1 |

## Funde

Schweregrad: **hoch** (Daten oder Bedienung ernsthaft betroffen), **mittel** (falsches Ergebnis oder Lücke), **niedrig** (Randfall, Regelverstoß ohne sichtbaren Fehler).

| Nr. | Bereich | Schweregrad | Fund | Status |
| --- | --- | --- | --- | --- |
| 1 | App-Sperre | hoch (plausibel, nicht auf dem Gerät bestätigt) | Bei Verzögerung "Sofort" zählte eine Rückkehr in die App ohne festgehaltenes Verlassen als 0 Sekunden Abwesenheit und sperrte. Der PIN-Rückfall ist eine eigene Aktivität; kommt ihr "zurück im Vordergrund" nach dem Entsperren an, sperrt die App sofort wieder, bei jedem Versuch. Gleicher Code wie Zyklus. | behoben `228a813` (`shouldRelock`, getestet) |
| 2 | Erinnerung | mittel | Zwei Synchronisierungen konnten sich überlappen. Jede löscht alle Termine und stellt ihren Plan; die ältere konnte nach dem Löschen der neueren weiter stellen, etwa den heutigen Termin, obwohl gerade ein Eintrag gespeichert wurde. | behoben `dbb2b12` (Warteschlange, getestet) |
| 3 | Einblicke, Serien | mittel | Die längste Folge wurde am Zeitraumbeginn abgeschnitten, die aktuelle nicht; die aktuelle konnte länger sein als die längste. | behoben `e41208e`: die längste Folge, die in den Zeitraum reicht, zählt in voller Länge. Ersetzt Phase 3 Entscheidung 11, Satz "Die längste Folge gilt im Zeitraum" |
| 4 | Einblicke, Wörter | mittel | Das Verhältnis teilte durch alle Tage einer Seite, auch ohne Notiz. Wer an schwächeren Tagen öfter schreibt, sah jedes Wort auf der Seite der übrigen Tage. Pauls Daten sind nicht betroffen (jeder Tag hat eine Notiz). | behoben `c081889` |
| 5 | Einblicke, Umfang | niedrig | Übliche Uhrzeit als Median ab 0 Uhr: Einträge um 23:50 und 0:10 ergaben Mittag. | behoben `c081889`: der Tag wechselt dafür um 4 Uhr |
| 6 | Zahlen | niedrig | `toFixed` rundete auf dem Binärwert: 4,35 wurde 4,3, 28,5 % wurden 28 %, -0,04 wurde "-0,0". | behoben `32e081b` |
| 7 | Datumsbereiche | niedrig | `formatRange` ignorierte das Jahr ("5. bis 8. Jan." für einen Bereich über ein Jahr). | behoben `32e081b` |
| 8 | Tests | mittel | Die NaN-Prüfung in `overview.test.ts` konnte nie anschlagen: `JSON.stringify` macht aus NaN `null`. | behoben `8d3cd5f` |
| 9 | Vollständigkeit | mittel | `first_day_of_week` steht seit Phase 1 in den Einstellungen und steuert Kalender, Schwankung und Wochentage, ließ sich aber nirgends ändern; in keiner Übergabe erwähnt. | behoben `f162af1`: "Mehr, Kalender, Woche beginnt am" (Montag oder Sonntag, wie Zyklus) |
| 10 | Standards | niedrig | `lib/calendar/monthGrid.ts` importierte date-fns (aus Zyklus geerbt). | behoben `6888b6a`, Test ergänzt `ecb250e` |
| 11 | Barrierefreiheit | niedrig | `Button` überschrieb ein übergebenes `accessibilityLabel`; der vorbereitete Text "Telefonseelsorge anrufen, 0800 111 0 111" kam nie an. | behoben `4e04a3d` |
| 12 | Barrierefreiheit | niedrig | "Zurücksetzen" im Verlauf hatte etwa 32 Punkte Tippfläche. | behoben `4e04a3d` |
| 13 | Tests | mittel | Die JSON-Rundreise war nur mit Beispieldaten getestet, nicht mit dem echten Export. | behoben `208ec4c` |
| 14 | Tests, Flakiness | mittel | Rote Läufe stammen nicht aus dem Code: Node 24.14.1 stürzt gelegentlich in der Speicherbereinigung von V8 ab (`SIGSEGV` in `ClearStaleLeftTrimmedPointerVisitor`, drei Absturzberichte heute unter `~/Library/Logs/DiagnosticReports/node-*.ips`). Jest meldet dann "A jest worker process ... was terminated" für eine zufällige Suite. Der Bericht von 18:18:47 fällt sekundengenau auf den Phase-2-Commit `3deb15a`: das war der rote Lauf aus Phase 2, nicht ein Zeitlimit wie in Phase 3 Entscheidung 20 vermutet. Der rote Lauf aus Phase 4 war dagegen ein echtes Zeitlimit und ist mit `2dfeff2` behoben. | im README beschrieben (`ef80e21`); nicht im Repo behebbar, siehe Empfehlung 9 |

Version 1.0.1 mit Updatehistorie: `ef80e21`. 1.0.0 war bereits ausgeliefert, deshalb ein neuer Eintrag statt Ergänzung.

### Geprüft und in Ordnung

- **Daylio-CSV**: BOM, `""`, Kommas und Zeilenumbrüche in Anführungszeichen, `\r\n`, Leerzeilen, nicht geschlossenes Anführungszeichen als einziger Dateifehler; Uhrzeit 24 h und am/pm (12 am wird 00); `<br>` und Entities; Fehler je Zeile mit Nummer; doppelte Aktivität in einer Zeile als Warnung. Writer: Spaltenlayout wie Daylio, neueste zuerst, `<br>` für Umbrüche.
- **Duplikaterkennung** über Datum, Uhrzeit, Stufe und Notiz, gegen DB und innerhalb der Datei, für CSV und JSON gleich (`entryKey`). **Transaktion**: CSV und JSON laufen in einer; Fehler lassen die DB unverändert (Tests mit Zeile 17 und mit Abbruch mitten im Schreiben).
- **JSON**: zod mit Verweisprüfung vor jedem Schreiben, Migrationskette ab Version 1 (leer, korrekt verkettet), Ersetzen mit ids und erhaltenem `last_export_at`, Zusammenführen nach Bedeutung.
- **Tagesmittel** und kaufmännische Rundung, alle Kennzahlen in `lib/insights/` (Schrumpfung auf die kleinere Seite, Lift, Folgetag nur für echte Folgetage, Zeiträume ohne Off-by-one, keine NaN bei 0 bis 3 Tagen).
- **Datumsrechnung**: Tage sind überall Strings; `addDaysToDateString` und `daysBetween` rechnen auf dem UTC-Kalender ohne Sommerzeitfehler; `useToday` wechselt um Mitternacht und bei Rückkehr in die App (wie Zyklus).
- **Erinnerungsplan**: 14 Einzeltermine, heute entfällt bei Eintrag oder vorbeier Uhrzeit, Berechtigung erst beim Einschalten, Kanal vor der Anfrage.
- **Tief-Hinweis**, **Sicherungserinnerung**: Regeln wie spezifiziert und getestet.

### Ausblick: Backtest fair und korrekt

Der Backtest schaut nicht in die Zukunft: `fitModel` filtert selbst auf Tage bis zum Stichtag, `casesForOrigin` schneidet die Historie vorher ab, wiederkehrende Aktivitäten, Wochentags- und Aktivitätseffekte, häufigste Stimmung und Langzeitmittel entstehen nur aus dieser Historie, und ein Test prüft, dass spätere Tage nichts ändern. Die Schwellen sind nicht auf die Daten abgestimmt. Beide Vergleiche sind fair gewählt (Phase 4 Entscheidung 4 und 5). Die Zahlen aus Phase 4 sind mit dem aktuellen Code unverändert (`private/__tests__/outlook.test.ts` grün).

Dass der Ausblick zurücktritt, ist eine Folge der Kennzahl, nicht ein Fehler: Der mittlere absolute Fehler wird vom Median minimiert, und wenn die große Mehrheit der Tage "Gut" ist, ist der Median fast immer "Gut". Um zu gewinnen, müsste das Modell eine andere Stufe als "Gut" zeigen und damit öfter richtig als falsch liegen. Bei so schiefen Daten ist das fast unerreichbar, auch für ein Modell, das etwas Echtes erkennt. Siehe Empfehlung 1.

## Empfehlungen (nicht umgesetzt, Paul entscheidet)

1. **Ausblick als Wahrscheinlichkeit statt als Stufe.** Statt "erwartet Gut, zwischen Ok und Gut" je Tag zwei Chancen: "besserer Tag als üblich" (Stufe über der häufigsten, bei Paul "Super") und "schwierigerer Tag als üblich" (darunter, bei Paul "Ok" und schlechter). Bewertet mit Brier-Score und Log-Loss gegen die Grundhäufigkeit bis zum Stichtag; gezeigt nur, wo der Brier Skill Score über den Mindestfällen positiv ist, am besten mit kleinem Mindestvorsprung. Anzeige etwa "Chance auf einen besseren Tag: 20 % (sonst 12 %)", nur wenn deutlich von der Grundhäufigkeit verschieden. Das Modell bleibt, sein Erwartungswert wird je Abstand logistisch kalibriert, gefittet nur auf Fällen, deren Zieltag vor dem Stichtag liegt.
   - Wegwerfrechnung (nicht im Repo, gleiche Stichtage, nur Daten bis zum Stichtag, nichts abgestimmt), echte Daten, 1659 Fälle über die Abstände 1 bis 7: "besser" Grundhäufigkeit Brier 0,0923, kalibriert 0,0857 (Skill +7 %), Log-Loss 0,339 gegen 0,313; "schwieriger" 0,1310 gegen 0,1324 (Skill -1 %, also zurücktreten). Beispieldaten: +2 bis +4 % für beide.
   - Vorsicht: Die sieben Abstände teilen sich dieselben rund 240 Stichtage, die Fälle sind nicht unabhängig; die +7 % sollten mit einem Block-Bootstrap über Stichtage bestätigt werden, bevor die Karte sie zeigt.
   - Aufwand etwa 1 bis 1,5 Tage: reine Funktionen für Kalibrierung und Bewertung mit Tests (0,5 Tage), Backtest und `useOutlook` erweitern (0,25), Karte, Kalender und Texte ohne "Vorhersage" (0,25 bis 0,5), Übergabe.
2. **Geschäftslogik aus Komponenten ziehen** (etwa 0,5 bis 1 Tag): Löschablauf in `app/more/delete.tsx` (in einen Hook wie `useDataTransfer`), Top-Aktivitäten je Gruppe in `components/insights/FrequencyCard.tsx`, `writeOrder` auf die Skalentabelle direkt in `app/more/scales.tsx` (fehlendes `reorderScales`), Plan-Lesen und -Schreiben in `components/outlook/PlanCards.tsx`, "archiviert, wenn die Gruppe archiviert ist" in `app/more/activities.tsx`, Sperrregeln in `app/more/lock.tsx`. Kein Fehler, aber gegen die Regel "keine Geschäftslogik in Komponenten".
3. **Fehlermeldungen übersetzen** (2 bis 3 Stunden): Alerts zeigen rohe Texte von zod, `SyntaxError` und englische Repository-Fehler (`db/validate.ts`), etwa bei einer beschädigten Sicherung. Bekannte Fehler auf Texte in `de.json` abbilden, den Rest mit einem allgemeinen Satz.
4. **Barrierefreiheit** (je unter einer Stunde, außer a): (a) Symbolauswahl liest die englische Symbol-ID vor ("emoticon happy outline"), braucht deutsche Namen für rund 120 Symbole; (b) Spalten der Karte "Die nächsten Tage" sind auf 360 dp etwa 37 Punkte breit, wie die Kalendertage eine bewusste Ausnahme oder die ganze Karte als ein Ziel; (c) `AppText` begrenzt die Systemschrift auf 1,6-fach, Android erlaubt 2,0; `MonthList` hat einen festen Kopf von 64; (d) Auswahl nur über Farbe bzw. Füllung: Chips (kein Häkchen), "Ausblick schlägt Vergleich" in der Backtest-Tabelle, Treffer im Verlauf, geplant gegen gewohnt in der Ausblickskarte.
5. **JSON-Ersetzen übernimmt `reminder_enabled` und `app_lock_enabled`** aus der Datei. Auf einem neuen Gerät ohne Benachrichtigungsrecht steht die Erinnerung dann auf "an", gestellt wird nichts, bis sie aus- und wieder eingeschaltet wird. Vorschlag: nach dem Ersetzen die Berechtigung prüfen und sonst ausschalten (klein).
6. **zod-Schema** prüft doppelte ids nur für Stimmungen und Einträge. Doppelte Gruppen-, Aktivitäts- oder Skalen-ids (nur in handgebauten Dateien) scheitern erst an der Datenbank; die Transaktion rollt zurück, die Meldung ist technisch. Klein.
7. **Aufräumen**: `components/ui/StepperRow.tsx` ist unbenutzt und hat feste deutsche Texte; 8 unbenutzte Schlüssel in `de.json`; `expo-linear-gradient` wird nirgends importiert. Rund 20 ungeprüfte Casts `as IconName`/`as MoodLevel` auf Datenbankwerte.
8. **Kleine Randfälle ohne Handlungsdruck**: "Sicherung teilen" zählt als Sicherung, auch wenn das Teilen abgebrochen wird (Android meldet es nicht, wie Zyklus); `useToday` plant keinen neuen Timer, falls der Mitternachts-Timer zu früh feuert (wie Zyklus, theoretisch); Skalenwerte aus einer Sicherung werden nicht gegen den Bereich einer bestehenden Skala geprüft.
9. **Node für Tests**: Node 22 LTS oder ein neueres Node 24 verwenden, etwa per `.nvmrc` und `engines`. Beides greift in die Umgebung auf Pauls Rechner ein und ist deshalb nicht gesetzt.
10. **Die Korrekturen 1 und 2 auch in Zyklus prüfen**: `lib/lock/useAppLock.ts` ist dort identisch.

## Entscheidungen

1. **Nur eindeutige Fehler und kleine Lücken behoben**, jeweils mit Test und eigenem Commit; Umbauten und Designfragen stehen oben als Empfehlungen.
2. **Fund 1 ist nicht auf dem Gerät bestätigt.** Die Reihenfolge von "Entsperrt" und "zurück im Vordergrund" hängt vom Gerät ab. Die Korrektur ist für beide Reihenfolgen richtig und ändert sonst nichts: Gesperrt wird nach jedem festgehaltenen Verlassen wie bisher.
3. **Version 1.0.1, `versionCode` 2**, weil 1.0.0 bereits aufs Handy gebracht wurde (Ablauf des Release-Skills; Schritte "fragen" und "aufs Handy" entfallen, weil die Session nicht interaktiv ist und der Koordinator ausliefert). `package-lock.json` trägt dieselbe Version.
4. **Wochenbeginn als Umschalter** in einem neuen Abschnitt "Kalender" unter "Mehr", Montag oder Sonntag, wie in Zyklus. Andere Wochentage erlaubt die Datenbank, die Oberfläche bietet sie nicht an.
5. **Der Ausblick bleibt, wie er ist.** Die Wahrscheinlichkeitsvariante ist eine Designentscheidung für Paul (Empfehlung 1).

## Offene Punkte (konsolidiert, Phase 1 bis 5)

**Geräteprüfung** (weiterhin nichts auf einem Gerät gesehen; APK `builds/daylight-1.0.1.apk`, installiert sich als Update über 1.0.0, Daten bleiben):

- Alle Punkte der Prüfanleitung aus Phase 4 (Import und Alltag, Ausblick mit echten Daten und mit Beispieldaten, Pläne, Erinnerung, App-Sperre, Tief-Hinweis, Sicherungskarte), darin die offenen Geräteprüfungen aus Phase 1 bis 3.
- Neu: **App-Sperre mit PIN statt Fingerabdruck** und Verzögerung "Sofort": nach dem Entsperren bleibt die App offen (Fund 1). Mit Fingerabdruck ebenso.
- Neu: **Erinnerung** einschalten, App schließen und öffnen, sofort einen Eintrag speichern: für heute kommt keine Benachrichtigung (Fund 2).
- Neu: **Wochenbeginn** auf Sonntag stellen: Kalender, Wochentagskarte und Schwankung beginnen mit Sonntag.
- Neu: TalkBack auf dem Tief-Hinweis liest "Telefonseelsorge anrufen, 0800 111 0 111".
- Große Systemschrift: `DayGlyph`, Wochenzeile, `MonthList`-Kopf, Wochentagszeilen der Einblicke und Ausblick-Spalten haben feste Maße; `AppText` ist auf 1,6-fach begrenzt.
- Laufzeit des Backtests auf dem Gerät; Sperrbildschirm über dem modalen Editor.

**Fachlich offen:**

- **Ausblick**: tritt bei den echten Daten zurück (gültiges Ergebnis). Entscheidung über die Wahrscheinlichkeitsvariante (Empfehlung 1).
- **"Urlaub" doppelt** (Phase 1, Entscheidung 9): Frage an Paul.
- **Daylio-Backup (`.daylio`)** und **Daylio-Skalen**: brauchen Beispieldateien.
- Aktivitätsreihenfolge nach dem Import einmal selbst ordnen.
- Skalen fließen in keine Auswertung und nicht in den Ausblick ein.
- Erinnerung endet nach 14 Tagen ohne App-Start.
- SQLCipher nicht umgesetzt; eigener Keystore für Veröffentlichung.
- Empfehlungen 2 bis 10 oben.

**Kleinigkeiten aus früheren Phasen** (unverändert offen): geparste Importdatei bleibt nach abgebrochener Vorschau im Store; Ersetzen zeigt in der Vorschau die Zahlen des Zusammenführens; Umlaut-Umschreibungen in der Suche ("muede"); Tagesleiste reicht 365 Tage zurück; Stimmungen lassen sich nur archivieren; Pixel-Kästchen kleiner als 44 Punkte; Wörter nur lateinische Buchstaben, feste Stoppwortliste; "Vor schwierigen Tagen" und "Am Folgetag" verlieren am Zeitraumanfang Vortage; gewählter Zeitraum der Einblicke wird nicht gespeichert.
