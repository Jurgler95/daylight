# Phase 4: Ausblick, Erinnerungen, Schutz, Release (Handover)

## Status

Abgeschlossen am 2026-09-26, nicht interaktiv, direkt auf `main`. Verifiziert:

- `npm run typecheck` sauber (Typed Routes neu erzeugt mit `npx expo customize tsconfig.json`, neue Routen `/more/outlook`, `/more/reminders`, `/more/lock`, `/more/privacy`, `/more/about`).
- `npm test`: 261 Tests grün in 37 Suites, dreimal hintereinander, auch während eines parallelen Gradle-Builds, darunter drei Suites bzw. Fälle gegen den echten Export unter `private/` für den Ausblick (laufen nur, wenn die Datei existiert).
- `npx expo export --platform android` bündelt.
- `npx expo-doctor` nicht gelaufen: keine Abhängigkeit hat sich geändert (alle Pakete dieser Phase sind seit Phase 1 bzw. 2 installiert).
- `npx expo prebuild --platform android --clean` in einer APFS-Kopie außerhalb des Repos (ohne `private/` und `.git`): `INTERNET` steht mit `tools:node="remove"` im Manifest, ebenso FCM (`c2dm`), Install Referrer und alle Launcher-Badges; `android:allowBackup="false"`.
- Lokaler Release-Build in derselben Kopie: `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` mit JDK 17 erfolgreich (erster Lauf 9 min 17 s, danach inkrementell mit dem Endstand 43 s). APK 51,7 MB, Paket `de.behla.daylight`, `versionCode` 1, `versionName` 1.0.0, nur `arm64-v8a`, geprüft mit `aapt2 dump badging` und `aapt2 dump xmltree` (build-tools 37.0.0): kein `INTERNET`, kein `c2dm`, keine Badge-Rechte, `allowBackup=false`. Abgelegt unter `builds/daylight-1.0.0.apk` (gitignored), nicht ausgeliefert.

**Ergebnis gegen den echten Export:** Der Ausblick schlägt „häufigste Stimmung“ (immer „Gut“) bei keinem Abstand und tritt zurück. Die Zahlen stehen unten unter „Backtest“.

**Nicht geprüft:** alles auf dem Gerät (keine Geräte in der Umgebung, die APK wurde bewusst nicht ausgeliefert). Siehe „Prüfanleitung auf dem Gerät“.

## Backtest

Rollierend über die Historie (`lib/outlook/backtest.ts`): Für jeden Kalendertag vom 30. Tag mit Eintrag (27.01.2026) bis zum vorletzten Tag (24.09.2026), 241 Stichtage, wird das Modell nur mit den Tagen bis zum Stichtag neu gefittet und nach den sieben Tagen danach gefragt. Jeder dieser Tage mit Eintrag ist ein Vergleichsfall. Fehler ist die mittlere absolute Abweichung in Stimmungsstufen vom Tagesmittel (MAE).

Verglichen werden (Entscheidung 4):

- **Ausblick**: die angezeigte Mitte, also der Erwartungswert gerundet auf eine Stufe. Entscheidet, ob gezeigt wird.
- **Erwartungswert**: derselbe Wert ungerundet. Nur berichtet.
- **Langzeitmittel**: das exponentiell gewichtete Mittel (Halbwertszeit 60 Tage), also das Modell ohne seine drei Zusätze.
- **Häufigste Stimmung**: die häufigste gerundete Stufe bis zum Stichtag (bei den echten Daten an jedem Stichtag „Gut“).

### Echter Export (`private/__tests__/outlook.test.ts`)

Die Tabellen mit den Fehlerwerten sind in der öffentlichen Fassung entfernt, weil sie aus dem privaten Tagebuch stammen. Das Ergebnis:

- Die gerundete Mitte des Ausblicks lag an jedem Stichtag auf derselben Stufe wie der naive Vergleich „häufigste Stimmung“, bei Abstand 1 bis 6 also gleichauf, bei Abstand 7 knapp schlechter. Das Modell bewegt den Erwartungswert nie weit genug, um eine andere Stufe zu zeigen.
- Der ungerundete Erwartungswert ist sogar schlechter als das Langzeitmittel: Wochentag, Nachwirkung und Aktivitäten fügen bei diesen Daten vor allem Rauschen hinzu.

**Ergebnis: Der Ausblick tritt bei allen sieben Abständen zurück.** Die Karte „Die nächsten Tage“ zeigt je Tag nur das bisherige Wochentagsmittel und gewohnte bzw. geplante Aktivitäten und sagt in einem Satz, warum („Ein Ausblick war bisher nicht genauer als „immer Gut“. Gezeigt: Wochentage und Gewohntes.“). Der Kalender zeigt keine Ringe, nur geplante Aktivitäten. Unter „Mehr, Ausblick“ steht dieselbe Tabelle in der App.

### Versuchte Verbesserungen (echter Export)

Ein Wegwerf-Test (nicht im Repo) hat Varianten auf denselben Stichtagen gerechnet, jede nur mit Daten bis zum Stichtag: das Modell ohne Wochentag, ohne Aktivitäten, nur Langzeitmittel und Nachwirkung, Nachwirkung vom letzten Tag statt vom 7-Tage-Mittel, Erwartungswert plus Median der bisherigen Fehler, Median früherer Fälle mit ähnlichem Erwartungswert, Rundung auf eine Stufe (übernommen, Entscheidung 4) und das einfache Mittel aller Tage. Keine schlägt „häufigste Stimmung“.

Die Ursache ist strukturell: Der mittlere absolute Fehler ist am kleinsten für den Median, und wenn die große Mehrheit aller Tage „Gut“ ist, ist der Median fast immer „Gut“. Ein ungerundeter Erwartungswert knapp darunter zahlt auf jedem „Gut“-Tag etwas und holt das an den seltenen anderen Tagen nicht herein. Eine Stufe zu zeigen, die nicht „Gut“ ist, lohnt sich nur, wenn das Modell einen Tag wirklich erkennt, und das gelingt bei diesen Daten nicht. Die Schwellen (Halbwertszeiten, Schrumpfung, Mindestmengen) wurden bewusst nicht an den Backtest angepasst: Mit einigen hundert Tagen wäre jede Abstimmung auf denselben Daten eine Überanpassung.

### Beispieldaten (synthetisch, `lib/outlook/__tests__/sample.test.ts`)

Mit eingebauten Wirkungen von Schlaf, Arbeit, Sozialem und Vortag gewinnt der Ausblick knapp bei allen Abständen (334 Stichtage): Ausblick 0,410 / 0,411 / 0,409 / 0,407 / 0,406 / 0,404 / 0,402 gegen häufigste Stimmung 0,416 / 0,414 / 0,415 / 0,414 / 0,415 / 0,413 / 0,411 und Langzeitmittel 0,464 bis 0,470. Die Karte zeigt dort Spannen, Begründungen und Ringe; so lässt sich die Oberfläche mit „Beispieldaten laden“ ansehen. Der Vorsprung ist klein; die Regel verlangt laut Spezifikation nur „besser als beide“, keinen Mindestabstand (Entscheidung 6).

## Was existiert

| Pfad | Zweck |
| --- | --- |
| `lib/outlook/model.ts` | Rein: `fitModel(days, cutoff)` (Langzeitmittel HWZ 60, jüngeres Mittel HWZ 7, φ als Autokorrelation bei Abstand 1 auf 0 bis 0,9 begrenzt, Wochentagseffekte und Aktivitätseffekte aus `lib/insights`, Anteil jeder Aktivität je Wochentag), `expectDay(model, target, planned)` mit den Bestandteilen. Filtert selbst alles nach dem Stichtag weg. |
| `lib/outlook/recurring.ts` | Rein: wiederkehrende Aktivitäten (mindestens 70 % der erfassten gleichen Wochentage der letzten 8 Wochen, mindestens 4 solche Tage, Anteil 0,25 über den übrigen Tagen). |
| `lib/outlook/backtest.ts` | Rein: `backtestOrigins`, `casesForOrigin`, `backtestCases`, `scoreBacktest`, `backtest`, `mostFrequentLevel`, `quantile`, `originKeys` (Schlüssel je Stichtag für den Zwischenspeicher). Konstanten `HORIZONS`, `MIN_OUTLOOK_DAYS = 30`, `MIN_BACKTEST_CASES = 20`, `MAX_ORIGINS = 365`. |
| `lib/outlook/outlook.ts` | Rein: `buildOutlook({ days, today, plans, backtest })` liefert „zu wenig Daten“ oder sieben Tage mit Spanne (nur gewonnene Abstände), Wahrscheinlichkeit schwieriger Tag über 15 %, Deckkraft, bis zu drei Begründungen, Plänen, wiederkehrenden Aktivitäten, Wochentagsmittel. `confidenceOf`. |
| `lib/outlook/plans.ts` | `plansByDay`: Planzeilen nach Tag gruppiert. |
| `lib/outlook/useOutlook.ts` | Brücke: Backtest außerhalb des Renderns in Scheiben von 12 ms, einmal je Tagebuchstand, von allen Screens geteilt, Fälle je Stichtag zwischengespeichert. `useOutlook(today)`, `useFuturePlans(today)`, für Tests `backtestIdle`, `resetBacktest`. |
| `lib/outlook/__tests__/` | `outlook.test.ts` (Fixtures aus der Spezifikation, Cache-Schlüssel), `sample.test.ts` (Beispieldaten), `private.test.ts` (echter Export, Zahlen oben). |
| `lib/support/lowMood.ts`, `useLowMoodNote.ts`, `__tests__/lowMood.test.ts` | Tief-Hinweis: 7 der letzten 10 Tage (heute eingeschlossen) auf Stufe 2 oder darunter, 14 Tage ausblendbar. |
| `lib/notifications/plan.ts`, `client.ts`, `useReminderSync.ts`, `index.ts`, `__tests__/plan.test.ts` | Erinnerung nach Zyklus: Plan rein (Einzeltermine für 14 Tage, heute entfällt bei Eintrag oder vorbeier Uhrzeit), Client lädt expo-notifications faul und nie in Expo Go auf Android, Synchronisierung im Root-Layout. |
| `lib/lock/` | Aus Zyklus: `auth.ts`, `store.ts`, `useAppLock.ts` (Verzögerung, FLAG_SECURE über expo-screen-capture solange die Sperre an ist), `index.ts`. |
| `components/lock/LockScreen.tsx` | Sperrbildschirm aus Zyklus ohne Federn-Hintergrund. |
| `components/settings/TimeRow.tsx` | Aus Zyklus: System-Uhrzeitwahl, speichert `HH:mm`. |
| `components/outlook/` | `OutlookCard` (Die nächsten Tage), `OutlookDayCard` (künftiger Tag auf Heute), `PlanCards` (Plan-Chips wie im Editor), `useOutlookTexts` (Sätze), `__tests__/today.test.tsx` (Render-Test). |
| `components/today/BackupCard.tsx`, `LowMoodCard.tsx` | Sicherungserinnerung (aus Zyklus Phase 10), ruhiger Hinweis mit Telefonseelsorge. |
| `components/calendar/DayGlyph.tsx`, `DayCell.tsx`, `WeekRow.tsx`, `MonthList.tsx`, `components/today/DayStrip.tsx` | Künftige Tage: hohler Ring in der Farbe der erwarteten Stufe mit blassem Stimmungssymbol, sonst bis zu zwei Symbole geplanter Aktivitäten. |
| `lib/calendar/dayLabel.ts`, `markers.ts`, `useDayMarkers.ts`, `useDayLabel.ts` | `AheadMarker`, `CalendarMarker`, `buildAheadMarkers`, `useCalendarMarkers(today)`; Screenreader-Text „Ausblick Gut, geplant: Familie“. |
| `app/(tabs)/index.tsx` | Heute: Tief-Hinweis, „Die nächsten Tage“, Sicherungskarte; ein künftiger Tag zeigt Ausblick bzw. Wochentagsprofil und die Plan-Chips. |
| `app/(tabs)/calendar.tsx` | Kalender mit `useCalendarMarkers`, Legende „Ausblick“ nur, wenn ein Ring zu sehen ist. |
| `app/(tabs)/settings.tsx` | Mehr: Abschnitte Ausblick, Schutz (Erinnerung, App-Sperre), Info (Datenschutz, Updatehistorie, Über). |
| `app/more/outlook.tsx`, `reminders.tsx`, `lock.tsx`, `privacy.tsx`, `about.tsx` | Schalter „Ausblick zeigen“ und Backtest-Tabelle; Erinnerung; App-Sperre (aus Zyklus); Datenschutz in Klartext; Über. |
| `app/more/delete.tsx` | Stellt vor dem Löschen alle geplanten Erinnerungen ab. |
| `app/_layout.tsx`, `lib/useAppBootstrap.ts` | Sperre ab dem ersten Bild, Sperrbildschirm über dem Navigator, Erinnerungs-Synchronisierung. |
| `db/schema.ts`, `drizzle/0001_romantic_norman_osborn.sql` | `settings.low_mood_dismissed_on` (gerätelokal, wie `last_export_at` nicht im Export). |
| `db/repositories/entries.ts`, `settings.ts`, `lib/export/serialize.ts` | `hasEntryOn`; Datumsprüfung für das neue Feld; Feld aus dem Export gestrichen. |
| `lib/i18n/locales/de.json` | Neue Namespaces `outlook`, `lowMood`, `backup`, `reminders`, `notify`, `lock`, `privacy`, `about`. |
| `lib/changelog/index.ts` | Punkte dieser Phase in 1.0.0 (noch nicht veröffentlicht). |
| `.claude/skills/apk-release/` | Release-Skill aus Zyklus, Namen angepasst, Manifestprüfung mit aapt2 als Pflichtschritt ergänzt. |

## Entscheidungen

1. **Formel wie spezifiziert**, mit einer Änderung bei den Aktivitäten: Der Wochentagseffekt enthält die an diesem Wochentag üblichen Aktivitäten schon. Eine Aktivität trägt deshalb `Effekt · (x − Anteil)` bei, mit `Anteil` = Teil der bisherigen gleichen Wochentage mit dieser Aktivität und `x` = 1 bei Plan oder Gewohnheit, 0, wenn ein Plan für den Tag eine gewohnte Aktivität weglässt. Sonst würde „Arbeit am Montag“ doppelt zählen. Unbekannte Aktivitäten tragen nichts bei. Effekte kommen unverändert aus `activityEffects` (geschrumpft, `k = 10`, ab 5 Tagen je Seite), Wochentagseffekte aus `weekdayProfile`, wie Phase 3 vorgibt.
2. **Ein Plan überschreibt die Gewohnheit ganz:** Hat ein Tag mindestens eine geplante Aktivität, gelten für ihn keine gewohnten Aktivitäten mehr (sie werden als „diesmal ohne“ gerechnet). Ein Tag ohne Plan nimmt die Gewohnheiten an.
3. **Wiederkehrend heißt an den Wochentag gebunden:** mindestens 70 % der erfassten gleichen Wochentage der letzten 8 Wochen (Spezifikation), mindestens 4 solche Tage, und der Anteil liegt mindestens 0,25 über dem an den übrigen Tagen. Ohne die letzte Bedingung wären „zu Hause“, Schlaf „Mäßig“ oder „Sonnig“ an jedem Wochentag „wiederkehrend“.
4. **Bewertet wird, was angezeigt wird: die Mitte als Stufe.** Die Karte zeigt die Mitte als Stimmungssymbol und der Kalender als Farbe, nie als Dezimalzahl. Also zählt im Backtest der auf eine Stufe gerundete Erwartungswert, und der ungerundete wird nur berichtet. Begründung: Der mittlere absolute Fehler belohnt den Median; ein Dezimalwert hätte gegen die häufigste Stufe schon aus diesem Grund verloren, auch wenn das Modell etwas erkennt (auf den Beispieldaten: ungerundet 0,463 gegen 0,416, gerundet 0,410). Für die echten Daten ändert diese Wahl nichts: gleichauf ist nicht besser, der Ausblick tritt so oder so zurück. Die Spanne kommt weiterhin aus den ungerundeten Fehlern.
5. **Vergleich „Langzeitmittel“ ist das exponentiell gewichtete Mittel des Modells** (HWZ 60), nicht das einfache Mittel. So muss das Modell zeigen, dass seine drei Zusätze helfen. Das einfache Mittel wäre bei den echten Daten sogar besser gewesen; beide verlieren gegen die häufigste Stimmung.
6. **Streng besser als beide, mindestens 20 Fälle je Abstand**, sonst kein Ausblick für diesen Abstand. Gleichstand zählt nicht als besser. Ein Mindestabstand ist nicht verlangt und nicht eingebaut; auf den Beispieldaten ist der Vorsprung klein (0,006 bis 0,011 Stufen).
7. **Stichtage:** jeder Kalendertag vom 30. Tag mit Eintrag bis zum Tag vor dem letzten Eintrag, höchstens die letzten 365. Abstand ist die Zahl der Kalendertage nach dem Stichtag. In der App ist der Stichtag heute (Daten bis heute, auch wenn heute noch kein Eintrag da ist), die sieben Tage sind morgen bis in sieben Tagen. Tage ohne Eintrag sind keine Fälle. Pläne gibt es für die Vergangenheit nicht, der Backtest rechnet also ohne Pläne; ob geplante Aktivitäten den Ausblick verbessern, misst er nicht.
8. **Konstante Stimmung zeigt keinen Ausblick.** Die Spezifikation verlangt als Test „konstante Stimmung ergibt flachen Ausblick mit schmaler Spanne“. Das Modell liefert dort genau das (Test mit erzwungenem Backtest: Spanne 4 bis 4, Deckkraft 1). Die echte Regel zeigt ihn trotzdem nicht, weil Modell und beide Vergleiche fehlerfrei sind und damit gleichauf. Das ist gewollt: Wo nichts zu schlagen ist, wird nichts behauptet.
9. **Spanne** ist das 20. bis 80. Perzentil der Backtest-Fehler desselben Abstands um den Erwartungswert, auf 1 bis 5 begrenzt, in Stufen: „zwischen Ok und Gut“ oder nur „Gut“, wenn beide Enden auf dieselbe Stufe fallen. **Schwieriger Tag**: Anteil der Fälle dieses Abstands, bei denen Erwartungswert plus Fehler unter 2,5 läge; genannt, wenn über 15 %. **Deckkraft** der Spalte `1 − Breite / 2`, mindestens 0,3.
10. **Begründungen:** Wochentag, Nachwirkung und jeder Aktivitätsbeitrag konkurrieren, gezeigt werden die bis zu drei größten ab 0,05 Stufen. Sätze beschreiben das Muster („Sonntag meist besser“, „Familie geplant, an solchen Tagen meist besser“, „Letzte Tage eher gut“), keine Ursache.
11. **Rückzug:** Ohne gewonnenen Abstand zeigt jede Spalte den Wochentag, das bisherige Wochentagsmittel als Zahl und Punkt auf derselben Skala, darunter Symbole geplanter oder sonst gewohnter Aktivitäten; ein Satz nennt den Grund. Werden nur einige Abstände gezeigt, sagt ein Satz, dass der Ausblick nur dort steht, wo er genauer war. Unter 30 Tagen: „Noch zu wenig Daten (12 von 30 Tagen)“. Schalter aus: keine Karte, keine Ringe, keine Ausblickskarte an künftigen Tagen; Pläne bleiben.
12. **Antippen einer Spalte öffnet den Tag auf Heute** (wie der Kalender), statt eines eigenen Dialogs. Dort stehen Spanne und Begründung bzw. das Wochentagsprofil und darunter die Plan-Chips. Pläne entstehen also für jeden künftigen Tag gleich: im Kalender oder in der Tagesleiste antippen, Aktivitäten wählen. Jeder Tipp schreibt sofort (kein Speichern), Gruppen ohne Plan sind anfangs zugeklappt.
13. **Kalender:** Ring nur an Tagen mit gezeigter Spanne, in der kräftigen Farbe der mittleren Stufe, mit deren Symbol blass im Ring (Bedeutung nie nur über Farbe). Geplante Aktivitäten ersetzen das Symbol (zwei, ein Punkt bei mehr). Die Tagesleiste zeigt dasselbe. Der Kalender reicht weiter drei Monate voraus.
14. **Backtest außerhalb des Renderns:** Auf dem Laptop kostet der volle Backtest mit den echten Daten etwa 0,33 s, auf dem Gerät vermutlich ein Vielfaches. Er läuft deshalb in Scheiben von 12 ms zwischen den Bildern, einmal je Tagebuchstand (Signatur aus Datum, Mittel und Aktivitäten je Tag; Notizen und Pläne ändern ihn nicht) und wird geteilt. Die Fälle jedes Stichtags werden unter einem Schlüssel gespeichert, der sich nur ändert, wenn sich ein Tag bis sieben Tage nach dem Stichtag ändert: Ein neuer Eintrag heute rechnet sechs Stichtage neu statt 241. Bis zum ersten Ergebnis fehlt die Karte; danach steht das vorige Ergebnis ein, bis das neue fertig ist.
15. **Tief-Hinweis:** gerundete Tagesstufe (Regel aus Phase 2), die letzten 10 Kalendertage einschließlich heute, Tage ohne Eintrag zählen nicht als schwer. Nur auf Heute am heutigen Tag, unter den Einträgen, gedämpfte Karte, Knopf „0800 111 0 111 anrufen“ (öffnet die Telefon-App über `tel:`, keine Berechtigung) und „Ausblenden“ für 14 Tage. Das Ausblenddatum liegt in `settings.low_mood_dismissed_on` (Migration 0001); es beschreibt das Gerät und bleibt wie `last_export_at` aus dem Export, `EXPORT_SCHEMA_VERSION` bleibt 1.
16. **Erinnerung als Einzeltermine statt Tagesauslöser:** Ein täglicher Auslöser kann einen Tag nicht auslassen, die Spezifikation verlangt aber, dass die Erinnerung entfällt, wenn heute schon ein Eintrag existiert. Der Plan stellt deshalb 14 einzelne Termine ab heute (heute nur ohne Eintrag und solange die Uhrzeit noch bevorsteht) und wird bei jedem Start, jeder Rückkehr in die App und jedem Schreiben neu gestellt, wenn sich die Signatur ändert. Wer die App zwei Wochen nicht öffnet, wird danach nicht weiter erinnert. Text: Titel „Erinnerung“, Inhalt „Wie war dein Tag?“, Kanal mit Sichtbarkeit `PRIVATE` auf dem Sperrbildschirm. Keine `SCHEDULE_EXACT_ALARM`-Berechtigung: Laut SDK-57-Doku braucht nur eine exakte Zustellung sie; für eine Tagebuch-Erinnerung reicht eine ungefähre Zeit.
17. **Berechtigung erst beim Einschalten**, nie beim Start (Zyklus). Vor der Anfrage wird der Kanal angelegt, weil Android 13 den Dialog laut Doku erst zeigt, wenn ein Kanal existiert (in Zyklus fehlte das).
18. **Sperrbildschirm über dem Navigator statt an seiner Stelle.** In Zyklus ersetzte der Sperrbildschirm den ganzen Navigator; ein halb geschriebener Eintrag wäre nach dem Entsperren weg. Hier bleibt der Navigator montiert, der Sperrbildschirm liegt deckend darüber, darunter ist nichts für Berührung und Screenreader erreichbar (`importantForAccessibility="no-hide-descendants"`), die Android-Zurück-Taste wird geschluckt, FLAG_SECURE hält es aus der App-Übersicht. Die Sperre gilt ab dem ersten Bild (`initialiseLock` im Bootstrap). Sonst wie Zyklus: Geräteentsperrung mit PIN als Rückfall, Einschalten verlangt eine erfolgreiche Entsperrung, Verzögerung sofort, 1, 5 oder 15 Minuten, ohne eingerichtete Bildschirmsperre schaltet sich die Sperre ab statt auszusperren.
19. **Sicherungserinnerung** wie Zyklus Phase 10 (60 Tage, nur JSON zählt, ohne Sicherung zählt der älteste Eintrag), als kompakte Karte unten auf Heute mit „Jetzt sichern“ (Ordner wählen). Die Regel stand seit Phase 1 in `lib/export/backup.ts` samt Tests.
20. **Datenschutzseite** in Klartext: was gespeichert wird, kein Netz, keine Android-Sicherung (mit der Folge), unverschlüsselte Sicherungsdatei, Einblicke und Ausblick nur lokal und keine medizinische Aussage, Erinnerungstext, Sperre, Löschen. Dazu eine Seite „Über“ mit Version, Lizenz MIT und dem Hinweis, dass Daylight kein Medizinprodukt ist.
21. **Keine neuen Abhängigkeiten.** expo-notifications, expo-local-authentication, expo-screen-capture und der datetimepicker waren installiert. Das Manifest der fertigen APK ist geprüft (siehe Status und „Berechtigungen der fertigen APK“).
22. **Version bleibt 1.0.0, `versionCode` 1.** 1.0.0 ist noch nie ausgeliefert worden; die Punkte dieser Phase stehen in ihrem Eintrag der Updatehistorie. Den ersten Versionssprung macht der Release-Skill beim ersten echten Release.
23. **Release-Skill** aus Zyklus kopiert, Namen auf `daylight-<version>.apk` geändert, Schritt „Manifest der fertigen APK mit aapt2 prüfen“ als Pflicht ergänzt (kein `INTERNET`, keine FCM- und Badge-Rechte, `allowBackup` aus). Der QR-Code-Weg bleibt, startet aber nur auf ausdrückliche Nachfrage. In dieser Session wurde nichts per WLAN ausgeliefert und nichts hochgeladen.
24. **Lokaler Build in einer Kopie außerhalb des Repos** (APFS-Klon in einem temporären Verzeichnis, `private/` und `.git` vorher entfernt), damit weder `android/` noch Tagebuchdaten in der Nähe des Builds liegen. JDK 17 (JDK 26 ist Standard auf dem Rechner und bricht Gradle, wie in Zyklus), nur `arm64-v8a`, signiert mit dem Debug-Keystore der Vorlage (nur zum Sideloaden).
25. **Render-Test mit Wartezeit für den Backtest.** `components/outlook/__tests__/today.test.tsx` wartet bis zu 20 s darauf, dass der Backtest fertig ist (`backtestIdle`), und setzt dafür sein Testlimit auf 60 s. Während des parallelen Gradle-Builds lief das Standardwarten von 1 s ab (Commit `bb9f087` ging mit diesem roten Lauf durch, `2dfeff2` behebt es). Der Backtest-Zwischenspeicher wird vor jedem Fall geleert (`resetBacktest`), damit kein Ergebnis eines anderen Tagebuchs einspringt.
26. **Daylio-Backup (`.daylio`) nicht gebaut.** Die Spezifikation führt es als „offen, siehe Phase 4“ und unter „Nicht im Umfang“ mit der Bedingung, dass zuerst eine Beispieldatei geprüft wird. Es gibt keine.

## Berechtigungen der fertigen APK

Geblieben sind (12): `USE_BIOMETRIC`, `USE_FINGERPRINT` (App-Sperre), `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, `VIBRATE` (Erinnerung, Haptik), `DETECT_SCREEN_CAPTURE` (expo-screen-capture), `READ_EXTERNAL_STORAGE` und `WRITE_EXTERNAL_STORAGE` (bis Android 12) sowie `READ_MEDIA_IMAGES` (bis Android 13) aus dem Datei-Stack, `ACCESS_NETWORK_STATE` (gewährt keinen Netzzugriff, Begründung wie Zyklus Phase 9, Entscheidung 8) und die interne `de.behla.daylight.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` von AndroidX. Das ist dieselbe Liste wie bei Zyklus 1.0.0. Nicht enthalten: `INTERNET`, `SCHEDULE_EXACT_ALARM`, FCM, Install Referrer, Launcher-Badges, `SYSTEM_ALERT_WINDOW`.

## Prüfanleitung auf dem Gerät

APK: `builds/daylight-1.0.0.apk` (in dieser Phase lokal gebaut, gitignored); künftige Versionen mit dem Skill `/apk-release`. Vor der Installation einer neuen Version eine Sicherung teilen.

1. **Import und Alltag** (offen seit Phase 1 bis 3): echten Export importieren, Vorschau mit den erwarteten Zahlen; danach die Punkte aus den Übergaben 1 bis 3 (Editor, Kalender, Verlauf, Verwaltung mit Ziehen, Einblicke, große Schrift, Screenreader).
2. **Ausblick mit echten Daten:** Heute zeigt „Die nächsten Tage“ mit sieben Spalten, je Wochentagsmittel und Punkt, darunter Symbole gewohnter Aktivitäten, und den Satz „Ein Ausblick war bisher nicht genauer als „immer Gut“ …“. Die Karte erscheint erst nach dem Backtest: Zeit vom Öffnen bis zur Karte schätzen, dabei scrollen und tippen (bleibt die App bedienbar?). Einen Eintrag speichern: kommt die Karte ohne spürbares Stocken wieder? „Mehr, Ausblick“ zeigt die Tabelle wie oben.
3. **Ausblick mit Beispieldaten** (neues Gerät oder nach „Alle Daten löschen“, dann „Beispieldaten laden“): Spalten mit Symbol und Balken, blasser bei breiter Spanne; Spalte antippen öffnet den Tag mit „zwischen … und …“ und Begründungen; im Kalender Ringe mit blassem Symbol an den nächsten sieben Tagen. Schalter „Ausblick zeigen“ aus: Karte und Ringe verschwinden, Pläne bleiben.
4. **Pläne:** künftigen Tag im Kalender antippen, auf Heute eine Gruppe aufklappen, Aktivität wählen; zurück im Kalender stehen ihre Symbole im Tag, der Screenreader sagt „geplant: …“.
5. **Erinnerung:** „Mehr, Erinnerung“ einschalten, der Android-13-Dialog erscheint (sonst: Kanal fehlt, Entscheidung 17). Uhrzeit auf zwei Minuten nach jetzt stellen, App schließen: Die Benachrichtigung „Wie war dein Tag?“ kommt ungefähr zur Zeit (ohne exakten Alarm sind Minuten Verzug möglich). Dann heute einen Eintrag speichern und die Uhrzeit erneut knapp in die Zukunft stellen: Es darf nichts kommen. Am Folgetag kommt sie wieder. Gerät neu starten: Termine bleiben (`RECEIVE_BOOT_COMPLETED`). Auf dem Sperrbildschirm ist der Text verborgen, wenn das Gerät private Inhalte ausblendet.
6. **App-Sperre:** einschalten (verlangt Entsperrung), Verzögerung „Sofort“, App in den Hintergrund und zurück: Sperrbildschirm, Entsperren per Fingerabdruck oder PIN. Mit offenem Eintrag-Editor und getipptem Text sperren lassen: nach dem Entsperren ist der Text noch da (Entscheidung 18). App-Übersicht zeigt eine leere Vorschau, ein Bildschirmfoto wird verweigert (FLAG_SECURE). Mit TalkBack prüfen, dass unter dem Sperrbildschirm nichts vorgelesen wird; die Zurück-Taste auf dem Sperrbildschirm darf nichts bewirken. Bildschirmsperre des Geräts entfernen, App öffnen: Sperre schaltet sich ab statt auszusperren.
7. **Tief-Hinweis:** in einem Testtagebuch (Beispieldaten sind dafür zu gut) sieben der letzten zehn Tage mit „Schlecht“ erfassen: Karte „Reden hilft“ auf Heute, „anrufen“ öffnet die Telefon-App mit 0800 111 0 111, „Ausblenden“ blendet sie aus; mit auf 14 Tage vorgestellter Gerätezeit kommt sie wieder.
8. **Sicherungskarte:** erscheint 60 Tage nach der letzten JSON-Sicherung bzw. dem ersten Eintrag (beim echten Export sofort, er beginnt am 29.12.2025); „Jetzt sichern“ öffnet die Ordnerwahl, danach ist die Karte weg.

## Offene Punkte (konsolidiert, Phase 1 bis 4)

**Geräteprüfung** (nichts davon ist auf einem Gerät gesehen worden):

- Alle Punkte der Prüfanleitung oben, darin die offenen Geräteprüfungen aus Phase 1 (Import auf dem Handy, Teilen, Ordner speichern, CSV-Export), Phase 2 (zwei Taps, Rückfrage beim Verlassen des Editors, System-Picker, Kalender, Verlauf, Ziehen zum Sortieren innerhalb der `ScrollView` von `Screen`) und Phase 3 (Einblicke flüssig beim Zeitraumwechsel, gifted-charts-Achsen, Detailseiten, Leistung bei „Alles“ mit mehreren Jahren).
- Große Systemschrift: `DayGlyph` und Wochenzeile haben feste Höhen (58 bzw. 64), die Wochentagszeilen der Einblicke feste Spalten, die Ausblick-Spalten eine feste Spurhöhe von 44; bei maximaler Schrift könnte Text beschnitten werden.
- Laufzeit des Backtests auf dem Gerät (Entscheidung 14). Falls die Karte spürbar spät kommt: `MAX_ORIGINS` senken oder das Ergebnis mit dem Tagebuchstand speichern.
- Sperrbildschirm über modal geöffneten Screens (Editor): auf Android liegt der native-stack-Modal im selben Fenster, das Overlay sollte ihn verdecken; nur auf dem Gerät prüfbar.

**Fachlich offen:**

- **Ausblick tritt bei den echten Daten zurück** (Backtest oben). Das ist ein gültiges Ergebnis, kein Fehler. Er kommt von selbst, sobald er auf dem Gerät besser wird als „immer Gut“; die Tabelle unter „Mehr, Ausblick“ zeigt, wie knapp es ist. Pläne fließen in den Backtest nicht ein (Entscheidung 7).
- **„Urlaub“ doppelt** (Phase 1, Entscheidung 9): Frage an Paul, ob Daylio zwei Aktivitäten „Urlaub“ in verschiedenen Gruppen hat.
- **Daylio-Backup (`.daylio`)** und **Daylio-Skalen**: brauchen eine Beispieldatei bzw. einen Export mit gefüllten Skalen (Phase 1, Entscheidung 14; Entscheidung 26 oben).
- Aktivitätsreihenfolge nach dem Import einmal selbst ordnen (Phase 1 und 2).
- Skalen fließen in keine Auswertung und nicht in den Ausblick ein (Phase 3).
- Erinnerung endet nach 14 Tagen ohne App-Start (Entscheidung 16).
- SQLCipher (Verschlüsselung der Datenbank) ist wie in Zyklus nicht umgesetzt; Schutz sind Sandbox, Sperre, FLAG_SECURE und keine Android-Sicherung.
- Für eine Veröffentlichung oder Updates über andere Wege braucht es einen eigenen Keystore; die lokale APK ist mit dem Debug-Keystore signiert.

**Kleinigkeiten aus früheren Phasen:** geparste Importdatei bleibt nach abgebrochener Vorschau im Store; Ersetzen zeigt in der Vorschau die Zahlen des Zusammenführens; Umlaut-Umschreibungen in der Suche („muede“); Tagesleiste reicht 365 Tage zurück; Stimmungen lassen sich nur archivieren; Pixel-Kästchen kleiner als 44 Punkte; Wörter nur lateinische Buchstaben, feste Stoppwortliste; „Vor schwierigen Tagen“ und „Am Folgetag“ verlieren am Zeitraumanfang Vortage; gewählter Zeitraum der Einblicke wird nicht gespeichert.
