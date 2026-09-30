# Gesundheitsdaten aus Health Connect (Handover)

## Status

Umgesetzt am 2026-09-27 auf Branch `feature/gesundheitsdaten` (abgezweigt von `feature/fotos`, damit sich die Migrationen nicht in die Quere kommen). Keine Version gehoben, keine Updatehistorie, das macht `/apk-release`. Paul nutzt eine Galaxy Watch mit Samsung Health, die ihre Daten an Health Connect weitergibt.

Ziel: Schritte, Schlaf, Ruhepuls und Training nur lesend und rückwirkend aus Health Connect übernehmen, beim Öffnen der App abgleichen und dabei oben rechts einen kleinen Ladekreis zeigen.

| Prüfung | Ergebnis |
| --- | --- |
| `npm run typecheck` | sauber |
| `npm test` | 49 Suites, 338 Tests grün, mit den privaten Daten (vorher 45 und 316; neu: `lib/health/__tests__/days.test.ts`, `sync.test.ts`, `db/__tests__/health.test.ts`, `lib/insights/__tests__/health.test.ts`) |
| `npx expo prebuild --platform android` | Manifest hat genau `health.READ_STEPS`, `READ_SLEEP`, `READ_RESTING_HEART_RATE`, `READ_EXERCISE`, `READ_HEALTH_DATA_HISTORY`. Alle passenden `WRITE_*` und `READ_HEALTH_DATA_IN_BACKGROUND` mit `tools:node="remove"`, `INTERNET` weiter entfernt. Rationale-Intent am Main-Activity und `ViewPermissionUsageActivity`-Alias sind da. `android.minSdkVersion=26` |
| Release-Build | `assembleRelease` (arm64) erfolgreich, 3,5 Minuten, APK 56 MB. aapt2 auf der fertigen APK: die fünf `health.READ_*`, kein `health.WRITE_*`, kein `INTERNET`, `allowBackup` false. `ACCESS_NETWORK_STATE` steht schon seit den Fotos drin (kommt von expo-image), nicht von Health Connect. Kein Versionssprung, daher nicht nach `builds/` kopiert |
| Auf dem Gerät | noch nicht, siehe Offene Punkte |

## Was existiert

| Datei | Inhalt |
| --- | --- |
| `db/schema.ts`, `drizzle/0003_sad_rocket_raccoon.sql` | Tabelle `health_days` (`date` als Schlüssel, `steps`, `sleep_minutes`, `resting_hr`, `exercise_minutes`, alle nullable, `synced_at`). In `settings`: `health_enabled`, `health_synced_from`, `health_last_sync_at`, `health_last_error` |
| `db/repositories/health.ts` | `replaceHealthDays` (ersetzt einen Bereich, Tage ohne Wert fallen weg), `listHealthDays`, `firstHealthDate`, `countHealthDays`, `clearHealthDays` |
| `lib/health/days.ts` | Rein: Tageswerte aus den Aggregat-Buckets, Schlafminuten je Tag, Zusammenführen, Planung der Abgleichsfenster (`planSync`), Pause (`withinPause`) |
| `lib/health/client.ts` | Lädt `react-native-health-connect` faul (nicht in Expo Go, nicht in Jest). Status, Berechtigungen, Lesen eines Fensters, Health Connect öffnen, Zugriff zurückgeben |
| `lib/health/sync.ts` | Ein Abgleich über alle geplanten Fenster, jedes Fenster wird sofort gespeichert. Die Quelle wird hineingereicht, daher testbar mit einer Fake-Quelle gegen better-sqlite3 |
| `lib/health/useHealthSync.ts` | `runHealthSync` (nie zwei gleichzeitig) und der Hook im Root-Layout: beim Start, bei jeder Rückkehr in den Vordergrund und nach dem Entsperren |
| `lib/health/store.ts`, `components/health/HealthSyncIndicator.tsx` | Zustand des Abgleichs und der Ladekreis oben rechts |
| `app/more/health.tsx` | Seite „Gesundheitsdaten“ unter Mehr, Abschnitt „Gesundheit“ |
| `lib/insights/health.ts`, `components/insights/HealthCard.tsx` | Karte „Schlaf und Bewegung“ in den Einblicken, eigene Gruppe „Gesundheit“ |

Angepasst: `app/_layout.tsx` (Hook und Ladekreis, der Kreis nur ohne Sperrbildschirm), `app/(tabs)/settings.tsx` (Zeile unter Mehr), `app/more/privacy.tsx` und `de.json` (Absatz zu Health Connect), `app/more/delete.tsx` (gibt den Zugriff zurück), `db/repositories/maintenance.ts` (`deleteAllData` leert `health_days`), `lib/export/serialize.ts` (Health-Felder bleiben aus der Sicherung), `app.json`, `.claude/skills/apk-release/SKILL.md` (Manifestprüfung), README.

## Entscheidungen

1. **Bibliothek `react-native-health-connect` 4.1.3.** Gebaut gegen RN 0.86.2 und `@expo/config-plugins` 57, das Expo-Plugin steckt seit v4 im Paket. `expo-health-connect` ist veraltet und darf nicht zusätzlich installiert werden (doppelte Kotlin-Klasse). Dazu `expo-build-properties` für `minSdkVersion` 26, Health Connect verlangt das. Android 7 fällt damit weg.
2. **Nur lesen, im Manifest erzwungen.** `android.permissions` nennt nur die fünf `health.READ_*`, `blockedPermissions` die passenden `WRITE_*`, `WRITE_EXERCISE_ROUTE` und `READ_HEALTH_DATA_IN_BACKGROUND`. `/apk-release` prüft das an der fertigen APK.
3. **Vier Datenarten als Tageswerte.** Schritte, Ruhepuls (Tagesmittel) und Training (Minuten) über `aggregateGroupByPeriod` mit Tagesscheiben. Health Connect entdoppelt dabei selbst, wenn Handy und Uhr dieselben Schritte melden. Ein Tag ohne Datenquelle kommt von der Bibliothek als 0 zurück und wird als „keine Daten“ gelesen, nicht als 0 Schritte.
4. **Schlaf gehört dem Tag, an dem er endet**, in der Zeitzone, die das Gerät mitgeschrieben hat. Die Nacht von Montag auf Dienstag ist Dienstags Schlaf, also die Nacht vor dem Tag, den sie prägt. Wach- und Aufstehphasen (`AWAKE`, `OUT_OF_BED`) zählen nicht. Ohne Phasen zählt die ganze Sitzung. Überlappende Sitzungen (Uhr und Handy) werden vereinigt, nicht addiert. Nickerchen zählen am selben Tag mit.
5. **Rückwirkend bis zum ersten Eintrag**, mindestens 30 Tage. Der Dialog fragt `READ_HEALTH_DATA_HISTORY` mit an. Ob das erlaubt wurde, lässt sich nicht zurücklesen: die Bibliothek lässt diese Berechtigung in `getGrantedPermissions` weg. Deshalb zeigt die Seite stattdessen, wie weit die Daten tatsächlich zurückreichen („ältester am …“). Wurde der Verlauf erst später erlaubt, setzt „Alles neu einlesen“ den Stand zurück und holt alles nach.
6. **Fenster, neueste zuerst.** Jeder Abgleich liest die letzten 7 Tage (Uhren liefern spät nach), nach längerer Pause zusätzlich ab 7 Tage vor dem letzten erfolgreichen Abgleich. Danach monatsweise der fehlende Teil der Rückschau. Jedes Fenster wird sofort gespeichert, `health_synced_from` wandert mit. Ein abgebrochener Lauf macht beim nächsten Öffnen dort weiter. Wird ein älterer Daylio-Export importiert, liest der nächste Abgleich die neuen Monate automatisch nach.
7. **Pause 15 Minuten**, gemessen am letzten erfolgreichen Abgleich. Solange die Rückschau nicht fertig ist, gilt keine Pause. „Jetzt abgleichen“ auf der Seite übergeht sie.
8. **Kein Abgleich im Hintergrund**, kein Worker, keine Hintergrund-Berechtigung. Beim Öffnen reicht für ein Tagebuch.
9. **Ladekreis oben rechts** über allen Seiten, fängt keine Berührungen, auf halbdeckendem Grund. Bei längerer Rückschau steht der gelesene Monat daneben. Für den Screenreader als höfliche Live-Region („Gesundheitsdaten werden abgeglichen, August 2026“). Unter dem Sperrbildschirm wird nichts gezeigt, abgeglichen wird erst nach dem Entsperren.
10. **Fehler still.** Kein Alert beim Öffnen, sondern „Letzter Fehler: …“ auf der Seite. Alles bis zum Fehler Gespeicherte bleibt.
11. **Einschalten fragt, Ausschalten pausiert, Trennen löscht.** Der Dialog kommt nur beim Einschalten, nie beim Start. Ausschalten behält die Daten und hält einen laufenden Abgleich nach dem aktuellen Monat an. „Trennen und Daten löschen“ gibt den Zugriff zurück (`revokeAllPermissions`, ab Android 14 erst nach Neustart der App wirksam) und leert `health_days`. „Alle Daten löschen“ tut beides ebenfalls.
12. **Nicht in der Sicherung.** Weder `health_days` noch die `health_*`-Einstellungen gehen in JSON oder CSV. Das Format bleibt unverändert, ein neuer Abgleich holt die Werte zurück. Ein Ersetzen-Import (`clearJournal`) lässt die Gesundheitstage stehen, sie gehören nicht zum Tagebuch.
13. **Einblicke: „Schlaf und Bewegung“.** Tagesmittel der Stimmung nach Schlaf der Nacht davor (unter 6, 6 bis 7, 7 bis 8, ab 8 Stunden), nach Schritten (unter 5.000, 5.000 bis 10.000, ab 10.000) und mit oder ohne Training. Nur Tage mit Eintrag und Wert, im gewählten Zeitraum. Unter drei Tagen je Klasse nur die Anzahl. Der Balken läuft von 1 bis 5 in der Farbe der gerundeten Stimmung. Die Karte erscheint erst, wenn es Gesundheitstage gibt, und sagt, dass das keine Ursache beschreibt. Ruhepuls wird gespeichert, aber (noch) nicht ausgewertet. In den Ausblick geht nichts davon ein.

14. **Tageswerte auf Heute und im Verlauf** (nach 1.0.5 ergänzt). Heute zeigt an jedem vergangenen Tag und heute die Karte „Gesundheit“ (`components/health/HealthDayCard.tsx`) mit bis zu vier Kacheln: Schlaf, Schritte, Training, Ruhepuls. Fehlende Werte lassen keine Lücke, ohne Daten fehlt die Karte. Der Verlauf zeigt am Eintrag eine kurze Zeile mit Symbolen (Schlaf „7:20 h“, Schritte, Trainingsminuten), ohne Ruhepuls, damit sie kurz bleibt. Beides liest über `useHealthDay` und `useHealthByDate` (`lib/health/useHealthDays.ts`), einmal je Datenstand. Zahlen formatiert `lib/health/format.ts` ohne Intl, damit Gerät und Tests gleich rechnen.

## Offene Punkte

**Nur auf dem Gerät zu prüfen:**

- Der Dialog von Health Connect auf Pauls Samsung: erscheinen alle vier Datenarten und „Vergangene Daten“?
- Welche Daten Samsung Health tatsächlich weitergibt. Schritte, Schlaf und Training sehr wahrscheinlich. Ob Samsung einen eigenen **Ruhepuls** schreibt, ist unklar. Bleibt die Spalte leer, wäre ein Tagesminimum aus `HeartRate` ein möglicher Ersatz (braucht `READ_HEART_RATE`).
- Wie weit die Daten zurückreichen. Health Connect enthält nur, was Samsung Health dorthin übertragen hat, oft erst ab dem Tag, an dem die Verbindung eingeschaltet wurde.
- Dauer des ersten Abgleichs über die ganze Tagebuchzeit (ein Monat sind vier Anfragen plus Schlafseiten).
- Tippt man im Health-Connect-Dialog auf den Datenschutz-Link, öffnet sich Daylight (Rationale-Intent), aber auf der zuletzt offenen Seite statt direkt auf „Datenschutz“. Die Seite ist über Mehr erreichbar. Direkt dorthin bräuchte es nativen Code, der die Intent-Action nach JS reicht.
- Dev-Client: wie bisher `INTERNET` vorübergehend aus `blockedPermissions` nehmen, Expo Go kann Health Connect nicht.
