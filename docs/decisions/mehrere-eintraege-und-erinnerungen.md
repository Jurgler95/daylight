# Mehrere Einträge und mehrere Erinnerungen pro Tag (Issues 5 und 3)

## Status

Umgesetzt am 2026-11-26 auf `main`, nicht committet, keine Version gehoben, keine Updatehistorie, das macht `/deploy`. Die Issues 3 und 5 bleiben offen, bis die Version draußen ist.

| Prüfung | Ergebnis |
| --- | --- |
| `npm run typecheck` | sauber |
| `npm test` | 92 Suites, 945 Tests grün. Neu: `lib/notifications/__tests__/times.test.ts`, `db/__tests__/reminderTimesMigration.test.ts`, `components/entry/__tests__/newScreen.test.tsx`, `components/settings/__tests__/remindersScreen.test.tsx`; ergänzt: `plan.test.ts`, `journal.test.ts`, `roundtrip.test.ts`, `useEntryEditor.test.tsx`, `celebrate.test.ts`, `today.test.tsx`, `prompt.test.tsx` |
| Unabhängige Prüfung | Zwei Prüfer mit Anforderungen und Diff, ein dritter Durchgang hat die Befunde eingeordnet und behoben, siehe unten |
| Auf dem Gerät | noch nicht, siehe Offene Punkte. Die Kotlin-Änderungen an den Widgets sind ohne Build geschrieben |

## Was existiert

| Datei | Inhalt |
| --- | --- |
| `db/schema.ts`, `drizzle/0017_hesitant_morgan_stark.sql` | Neue Spalte `settings.reminder_times` (JSON-Liste, Standard `["20:30"]`). Die Migration füllt sie aus der bisherigen `reminder_time` |
| `lib/notifications/times.ts` | Regeln der Liste ohne Abhängigkeiten: bereinigen (`cleanReminderTimes`, `reminderTimesOr`), späteste Uhrzeit, hinzufügen, ändern, entfernen, Vorschlag für den Picker. Höchstens fünf (`MAX_REMINDER_TIMES`) |
| `db/repositories/settings.ts` | `updateSettings` hält beide Spalten zusammen: eine Liste wird bereinigt und `reminder_time` folgt mit der spätesten Uhrzeit; ein einzeln gesetztes `reminder_time` wird zur Liste mit dieser einen Uhrzeit |
| `lib/notifications/plan.ts` | `PlanInput.times` statt `time`, dazu `entryTimes`. Auslassregel `answered`, Schlüssel `daily:<Datum>T<HH:mm>` (`dailyKey`), Text `moment` bei mehreren Uhrzeiten, `doneReminderKeys` mit Uhrzeiten und Schreibzeitpunkt, `dailyKeysOfTimes`, `ANDROID_ALARM_LIMIT` |
| `lib/notifications/useReminderSync.ts`, `lib/streak/celebrate.ts` | Reicht die Liste, die Uhrzeiten der Einträge je Tag (`readEntryTimes`) und ihren Schreibzeitpunkt (`readEntryWritten`) an den Plan. Räumt Benachrichtigungen einer Uhrzeit ab, die die Liste verlässt |
| `app/more/reminders.tsx`, `components/settings/TimeRow.tsx` | Liste der Uhrzeiten mit Ändern und Entfernen, „Uhrzeit hinzufügen“ bis fünf, Hinweis bei doppelter Uhrzeit. `useTimePicker` öffnet den Picker auch ohne Zeile |
| `lib/export/schema.ts` | `reminder_times` optional und als beliebiger Wert gelesen, danach bereinigt |
| `app/entry/new.tsx`, `lib/entry/useEntryEditor.ts`, `components/entry/EntryEditor.tsx` | Keine Umleitung mehr, kein `dayTaken`, der Text `entry.dayTaken` ist in allen Sprachen entfernt |
| `app/(tabs)/index.tsx` | Einträge des Tages mit dem neuesten oben, darunter der Knopf „Weiterer Eintrag“ |
| `db/repositories/entries.ts`, `lib/widget/useWidgetSync.ts` | `lastMoodOnDate`: Stimmung des letzten Eintrags von heute für das Stimmungs-Widget |
| `modules/daylight-widget` (`DaysWidget.kt`, `StreakWidget.kt`), `app/today.tsx` | Ziele der Widget-Tipps, siehe Entscheidung 6 |
| `lib/i18n/locales/*.json` | Neue und geänderte Texte in allen zehn Sprachen |

## Entscheidungen

### Teil A: Mehrere Einträge pro Tag

1. **Beliebig viele Einträge pro Tag**, jeder mit eigener Uhrzeit, ohne Fächer und ohne Obergrenze. Das Datenmodell konnte das schon, es fielen nur die drei Sperren weg.
2. **„Heute“:** Ein leerer Tag zeigt die große Stimmungsauswahl. Ab dem ersten Eintrag steht unter den Eintragskarten der schlichte Knopf „Weiterer Eintrag“, auch auf vergangenen Tagen, nicht auf künftigen. Er öffnet den Editor ohne vorgewählte Stimmung.
3. **Reihenfolge:** der neueste Eintrag oben, bei gleicher Uhrzeit der später angelegte. „Heute“ dreht dafür die Liste um, der Verlauf sortierte schon so, der Kalender öffnet den Tag auf „Heute“. Der Rückblick zeigt je Tag eine Zeile: die Stimmung wie im Kalender (Mittel der Einträge), die Notiz des neuesten Eintrags mit Notiz, die Fotos aller Einträge und bei mehreren den Zusatz „N Einträge“ (`summariseDay` in `lib/today/lookback.ts`).
4. **Neuer Eintrag startet leer.** Uhrzeit: heute die aktuelle, an vergangenen Tagen die späteste Erinnerungszeit (`reminder_time`).
5. **`dangerouslySingular` bleibt**, mit dem Tag als Kennung: Ein Link für denselben Tag kommt zum offenen Entwurf zurück, statt ihn zu verdecken. Nach dem Speichern ist der Bildschirm weg (`router.back()`), der nächste neue Eintrag bekommt einen frischen Editor. Folge: Ein Tipp auf eine Stimmung im Widget, während für heute schon ein ungespeicherter neuer Eintrag offen ist, führt zu diesem Entwurf und übernimmt die getippte Stimmung nicht. Das war vorher so und schützt den Entwurf.
6. **Widgets:** Jeder Tipp auf eine Stimmung und der Schnelleintrag legen einen neuen Eintrag an. Das Stimmungs-Widget markiert die Stimmung des letzten Eintrags von heute, das Verlaufs-Widget bleibt beim Tagesmittel. Lücke im Plan, selbst entschieden: Das Verlaufs-Widget und das Serien-Widget öffneten bisher über `/entry/new` den vorhandenen Eintrag des Tages. Damit daraus nicht bei jedem Tipp ein neuer Eintrag wird, öffnet ein Tag mit Einträgen jetzt „Heute“ auf diesem Tag (`daylight://today?date=`), ein leerer Tag weiter direkt den Editor. Das Serien-Widget öffnet „Heute“, sobald heute ein Eintrag da ist.
7. **Unverändert:** Tageswert als Mittel, Einblicke, Ausblick, Serie, Erfolge. Ein zweiter Eintrag am selben Tag feiert nichts, weil die Feier den Zustand der Serie vor und nach dem Speichern vergleicht (getestet).
8. **Geprüft, nicht umgebaut:** Karte „Gestern fehlt“, Rettungskarte und Tief-Karte rechnen mit Tagen. `turningPointLostBy` fragt schon nach weiteren Einträgen des Tages. Suche, CSV-Export und Sicherung arbeiten je Eintrag.

### Teil B: Mehrere Erinnerungen pro Tag

1. **Eine bis fünf Uhrzeiten**, ohne doppelte, immer aufsteigend sortiert, ohne Mindestabstand.
2. **Auslassen nach der nächstgelegenen Uhrzeit** (geändert am 2026-11-26 nach dem ersten Bau): Ein Eintrag zählt für die Erinnerung, die seiner Uhrzeit am nächsten liegt, davor oder danach. Die Abschnitte treffen sich in der Mitte zwischen zwei Erinnerungen, genau in der Mitte zählt der Eintrag für die spätere. Der Abschnitt der ersten Erinnerung beginnt um Mitternacht, der der letzten reicht bis Tagesende. Es zählt die Uhrzeit am Eintrag, nicht der Moment des Speicherns. Mit 09:00, 14:00 und 21:00 liegen die Grenzen bei 11:30 und 17:30: Ein Eintrag um 09:05 oder 11:29 beantwortet 09:00, einer um 11:30 oder 15:00 beantwortet 14:00, einer ab 17:30 beantwortet 21:00.
   - Grund: Die ursprünglich abgestimmte Regel („nach der vorigen Erinnerung bis zu dieser“) ließ bei einer Antwort um 09:05 auf die Erinnerung von 09:00 die von 14:00 ausfallen. Paul hat das als falsch eingestuft. Dafür lässt ein Eintrag um 10:00 die Erinnerung um 14:00 nicht mehr ausfallen, anders als im ursprünglichen Beispiel.
   - Bei genau einer Uhrzeit gehört der ganze Tag zu ihr, irgendein Eintrag genügt, wie bisher.
   - `reminder_always` schaltet das Auslassen ganz ab.
   - Die Uhrzeit des Eintrags legt die Erinnerung nicht fest: Ein neuer Eintrag für heute bekommt immer die aktuelle Uhrzeit, nur beim Nachtragen eines vergangenen Tages wird die späteste Erinnerungszeit vorgeschlagen.
3. **Angezeigte Benachrichtigungen** verschwinden, wenn ihr Abschnitt (nach der Regel oben) oder ein späterer einen Eintrag hat, oder wenn nach ihrer Auslösezeit ein Eintrag für ihren Tag angelegt wurde (`created_at`, auf die Minute in Ortszeit), auch wenn er auf eine frühere Uhrzeit datiert ist. Bei einer Uhrzeit räumt jeder Eintrag des Tages ab. Ein Import, der Einträge für einen Tag anlegt, räumt dessen Benachrichtigungen ebenfalls ab. Ein alter Eintrag, der nachträglich auf den Tag verschoben wird, zählt nicht als danach geschrieben.
4. **Schlüssel** `daily:<Datum>T<HH:mm>`. Jeder Abgleich löscht zuerst alle Alarme, die das Modul kennt, egal mit welchem Schlüssel, damit bleiben nach dem Update keine alten liegen und eine entfernte Uhrzeit verliert ihre Alarme. Der alte Schlüssel `daily:<Datum>` steht weiter in `doneReminderKeys`, damit eine alte, noch angezeigte Benachrichtigung verschwindet. Verlässt eine Uhrzeit die Liste, nimmt sie ihre angezeigten Benachrichtigungen der letzten 14 Tage mit.
5. **Text:** Bei einer Uhrzeit alles wie bisher. Bei mehreren heißt jede „Wie geht es dir gerade?“. Der Serienzusatz steht in allen Erinnerungen des nächsten Tages, der noch keinen Eintrag hat: heute, solange heute leer ist, sonst morgen. Die Zahl hängt nur von den Tagen davor ab und kann dort nicht veralten.
6. **Tipp** öffnet immer einen neuen Eintrag für den Tag der Erinnerung.
7. **Speicherung:** `reminder_times` als Liste, `reminder_time` trägt immer die späteste Uhrzeit. Bei zu vielen Uhrzeiten bleiben die ersten fünf in der gelieferten Reihenfolge.
8. **Start-Sheet:** unverändert bei einer Uhrzeit. Liegt schon eine Liste mit mehreren vor (wiederhergestellte Sicherung mit ausgeschalteter Erinnerung), ersetzt es nur die späteste, die es anzeigt.
9. **Menge der Alarme:** Fünf Uhrzeiten mal 14 Tage plus zwei Morgen und zwei Ausblicke sind höchstens 74, Android erlaubt 500 (`ANDROID_ALARM_LIMIT`, getestet).
10. **Texte:** Der Hinweis unter „Tägliche Erinnerung“ hat eine eigene Fassung für mehrere Uhrzeiten, „Auch mit Eintrag erinnern“ sagt jetzt „Kommt auch, wenn es schon einen Eintrag gibt“, der Datenschutztext spricht von den festgelegten Uhrzeiten statt vom Abend. Unter „Mehr“ zeigt die Zeile „Erinnerung“ alle Uhrzeiten.

## Sicherung

- `reminder_times` geht in die JSON-Sicherung. Im zod-Schema ist das Feld optional und nimmt jeden Wert an; danach wird bereinigt (ungültige und doppelte weg, höchstens fünf, sortiert). Bleibt nichts übrig oder fehlt das Feld, wird die Liste aus `reminder_time` gebildet. Ein Import wird deshalb nie wegen der Uhrzeiten abgelehnt.
- Eine ältere App-Version liest eine neue Sicherung weiter: Ihr Schema verwirft das unbekannte Feld und findet in `reminder_time` die späteste Uhrzeit.
- Zusammenführen lässt die Einstellungen wie immer in Ruhe.

## Befunde der Prüfung

Kein Befund der Schwere hoch. Behoben: Benachrichtigung blieb bei rückdatiertem Eintrag stehen (jetzt Entscheidung B3), Benachrichtigung einer entfernten Uhrzeit blieb stehen (B4), Serienzusatz fehlte am Folgetag (B5), Start-Sheet verkürzte eine Liste (B8), „jede Uhrzeit“ las sich in Spanisch, Französisch, Polnisch und Türkisch wie „jede Stunde“, Datenschutztext sagte „am Abend“, Test für die Einstellungsseite fehlte.

Nach Rückmeldung von Paul geändert: die Auslassregel (jetzt nächstgelegene Uhrzeit, Entscheidung B2) und der Rückblick (siehe A3).

Bewusst nicht geändert: der Widget-Tipp bei offenem Entwurf (Entscheidung A5), `dailyHintAlways` („Jeden Abend“) und die Texte des Start-Sheets bei einer Uhrzeit, kein eigener Test für `useWidgetSync` und `dangerouslySingular` (hängen am nativen Modul und am Router).

## Featureidee für später

Auswertung nach Tageszeit (etwa „morgens im Schnitt besser als abends“): Mit mehreren Einträgen pro Tag erstmals sinnvoll, nicht gebaut.

## Offene Punkte

Auf dem Gerät prüfen:

- **Update von 1.0.41 mit einer Uhrzeit:** Die Uhrzeit steht danach als einzige in der Liste, die Erinnerung kommt wie bisher, und es feuert kein alter Alarm doppelt.
- **Mehrere Uhrzeiten:** Echte Benachrichtigungen zu zwei bis drei Uhrzeiten mit „Wie geht es dir gerade?“, Auslassen nach einem Eintrag im Abschnitt, die späteren kommen trotzdem, „Auch mit Eintrag erinnern“ lässt alle kommen.
- **Verschwinden von der Leiste:** nach einem Eintrag, auch nach einem rückdatierten, und nach dem Entfernen oder Ändern einer Uhrzeit.
- **Tipp auf die Erinnerung** öffnet einen neuen Eintrag, auch wenn der Tag schon einen hat, kalt und warm.
- **Einstellungsseite:** Hinzufügen, Ändern, Entfernen, Hinweis bei doppelter Uhrzeit, Verhalten mit TalkBack, Zeile „Erinnerung“ unter „Mehr“ mit fünf Uhrzeiten auf schmalem Bildschirm.
- **Auslassen:** Mit 09:00, 14:00 und 21:00 um 09:05 eintragen, 14:00 kommt trotzdem; um 12:00 eintragen, 14:00 fällt aus.
- **Rückblick:** Ein Tag mit mehreren Einträgen zeigt Mittel, neueste Notiz, alle Fotos und „N Einträge“.
- **„Heute“:** Knopf „Weiterer Eintrag“, zweiter neuer Eintrag direkt nach dem Speichern des ersten bekommt einen leeren Editor, Reihenfolge der Karten.
- **Widgets (Kotlin ohne Build geschrieben):** Tipp auf eine Stimmung legt einen neuen Eintrag an, markiert ist danach die Stimmung des letzten Eintrags; Verlaufs-Widget öffnet einen Tag mit Einträgen auf „Heute“ und einen leeren im Editor; Serien-Widget öffnet „Heute“, sobald heute ein Eintrag da ist.
- **Sicherung:** Export mit mehreren Uhrzeiten und Wiederherstellen per Ersetzen.
