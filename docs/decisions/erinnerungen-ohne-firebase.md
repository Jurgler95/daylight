# Erinnerungen ohne Firebase (Handover)

## Status

Umgesetzt am 2026-09-30 auf Branch `firebase-raus`. Keine Version gehoben, keine Updatehistorie, das macht `/deploy`.

Ziel: Firebase und die Google Play Services aus der APK entfernen, ohne dass sich an den Erinnerungen etwas ändert. Anlass ist ein möglicher Weg zu F-Droid, das Firebase verbietet und die App selbst aus dem Quellcode baut. IzzyOnDroid kommt nicht in Frage, weil es Apps ablehnt, die mit generativer KI geschrieben wurden.

| Prüfung | Ergebnis |
| --- | --- |
| `npm run typecheck`, `npm test` | sauber, 47 Suites grün |
| Release-Build (arm64, Debug-Schlüssel) | APK 54,6 MB statt 55,9 MB. `check-manifest.mjs`: kein `com.google.firebase`, kein `com.google.android.gms` im Code. Gegenüber 1.0.15 fällt nur `WAKE_LOCK` weg (kam mit Firebase), sonst gleiche Berechtigungen |
| Emulator Pixel 9, Android 16 | Einschalten fragt nach der Berechtigung, danach 14 Alarme `RTC_WAKEUP` um 20:30 mit bis zu einer Stunde Spielraum (wie vorher ohne `SCHEDULE_EXACT_ALARM`). Kanal `reminders` wie vorher. Nach einem Update über die installierte App alle offenen wieder gestellt. Uhr vorgestellt: Erinnerung mit Symbol, Farbe und Ton bei geschlossener App, stumm bei offener App. Antippen öffnet Daylight und schließt die Benachrichtigung. Ausschalten löscht alle Alarme |
| Auf Pauls Handy | noch nicht |

## Warum ein eigenes Modul

expo-notifications bindet `com.google.firebase:firebase-messaging` fest ein, auch wenn eine App nur lokale Erinnerungen stellt. Daylight hat nie Push genutzt, Firebase startete ohne `google-services.json` auch nie, und `INTERNET` war blockiert. Es lag trotzdem als Code in der APK, samt Teilen der Play Services.

Verworfen:
- **expo-notifications patchen** (`compileOnly` für Firebase, Firebase-Service aus dem Manifest): Firebase fehlt dann in der APK, wird aber zum Kompilieren weiter aus Googles Maven-Repo geladen. F-Droid baut nur mit freier Software, und sein Scanner schlägt auf die Gradle-Zeile an. Ein Patch, der die elf Firebase-Dateien löscht, müsste bei jedem Expo-Update neu passen.
- **Notifee**: bringt vorkompilierte Binärdateien mit, die F-Droid ebenfalls ungern sieht.

## Was existiert

| Datei | Inhalt |
| --- | --- |
| `modules/daylight-reminders/` | Lokales Expo-Modul, nur Android, automatisch verlinkt. `index.ts` liefert das Modul oder `null` (Expo Go, iOS, Jest) |
| `.../Reminders.kt` | Kanal anlegen, Erinnerung stellen, alle löschen, nach Neustart wiederherstellen, anzeigen. Offene Erinnerungen liegen in den SharedPreferences `daylight_reminders` |
| `.../ReminderReceiver.kt` | Zeigt eine fällige Erinnerung; stellt nach `BOOT_COMPLETED`, `REBOOT`, `QUICKBOOT_POWERON`, `MY_PACKAGE_REPLACED`, `TIMEZONE_CHANGED` und `TIME_SET` alle offenen neu |
| `.../DaylightRemindersModule.kt` | Brücke zu JS: `createChannel`, `hasPermission`, `requestPermission`, `schedule` (mit Deep Link), `cancelAll`, `dismiss` |
| `.../res/drawable-*/daylight_reminder_icon.png`, `values/colors.xml` | Benachrichtigungssymbol und Farbe `#11786A`, vorher vom Config-Plugin von expo-notifications erzeugt. `scripts/logo.mjs` schreibt die Symbole jetzt direkt hierher, `assets/notification-icon.png` ist entfallen |
| `lib/notifications/client.ts` | Gleiche Schnittstelle wie vorher, spricht das eigene Modul an |
| `.github/scripts/check-manifest.mjs` | Bricht ab, wenn `com.google.firebase` oder `com.google.android.gms` in den `.dex`-Dateien der APK steht |

## Was vom alten Verhalten übernommen ist

Nachgelesen im Quellcode von expo-notifications 57.0.21:

1. **Alarm:** `RTC_WAKEUP` mit `setExactAndAllowWhileIdle`, wenn genaue Alarme erlaubt sind (vor Android 12 immer), sonst `setAndAllowWhileIdle`. Daylight fordert `SCHEDULE_EXACT_ALARM` nicht an, ab Android 12 also wie bisher ungenau.
2. **Kanal** `reminders`: gleiche ID, Wichtigkeit `DEFAULT`, auf dem Sperrbildschirm `PRIVATE`, Vibration `[0, 200]`, Standardton. Bestehende Kanaleinstellungen der Nutzer bleiben, weil die ID gleich bleibt.
3. **Benachrichtigung:** Titel, Text als `BigTextStyle`, schließt sich beim Antippen, Priorität `HIGH` (wirkt ab Android 8 ohnehin nur über den Kanal). Ist die App im Vordergrund, kommt sie stumm, wie vorher mit `shouldPlaySound: false`.
4. **Antippen** öffnet die App über ihren Launcher-Intent. Seit der Morgen-Erinnerung (`docs/decisions/serie-und-erinnerung.md`) mit Deep Link, siehe unten.
5. **Neustart und Update:** offene Erinnerungen werden neu gestellt, verpasste verfallen.
6. **Berechtigung:** ab Android 13 `POST_NOTIFICATIONS` über das Berechtigungsmodul von Expo, davor der Systemschalter für Benachrichtigungen. Die Kanalanlage vor der Abfrage bleibt.

## Deep Link beim Antippen

Seit 2026-10-13 bekommt `schedule` als sechstes Argument einen Link (`daylight://entry/new?date=YYYY-MM-DD`, in JS gebaut), der den Editor für den passenden Tag öffnet.

- `Reminder` speichert ihn als `url` in den SharedPreferences. `fromJson` liest ihn nur, wenn er da ist: ältere Einträge ohne Link bleiben gültig und öffnen einfach die App. Nach Neustart oder Update stellt `restore` die Erinnerung samt Link wieder her.
- Der Content-Intent ist dann `ACTION_VIEW` mit dem Link als Daten, gerichtet an die Komponente des Launcher-Intents (`MainActivity`, `singleTask`). Extras würde React Native nicht melden; so kommt der Link beim Kaltstart als Start-URL, beim Warmstart als `url`-Ereignis bei expo-router an. Ohne Link bleibt es beim Launcher-Intent.
- Jede Erinnerung hat einen eigenen `requestCode` (`id.hashCode()`), damit sich zwei angezeigte nicht denselben PendingIntent teilen.
- `dismiss(ids)` nimmt angezeigte Benachrichtigungen per Tag (= Erinnerungs-ID) und fester Nummer 0 aus der Leiste, passend zu `notify(id, 0, …)`.

Keine neue Berechtigung, keine neue Abhängigkeit.

## Zeitzone

Seit 2026-10-15 behält eine Erinnerung ihre Uhrzeit, wenn sich die Zeitzone ändert (Reise, Umzug). Vorher rechnete JS „20:30 am Tag D“ einmal in einen absoluten Zeitpunkt um, und `RTC_WAKEUP` klingelte danach zur alten 20:30.

- `schedule` bekommt als siebtes Argument die Ortszeit `YYYY-MM-DDTHH:mm` (ein String, weil Expo-Funktionen höchstens acht Argumente nehmen). `Reminder` speichert sie als `date`, `hour` und `minute` neben `at`.
- `restore` rechnet `at` mit java.time (`ZonedDateTime`, `ZoneId.systemDefault()`) neu aus, verpasste fallen weg. java.time gibt es ab API 26, der minSdk von Daylight, Desugaring ist also nicht nötig. Liegt die Zeit in einer Lücke der Sommerzeit, rückt sie hinter die Lücke, wie bei `Date` in JS.
- Der Empfänger hört zusätzlich auf `TIMEZONE_CHANGED` und `TIME_SET`. Beide sind von den Einschränkungen für implizite Broadcasts ausgenommen, wirken also auch bei geschlossener App.
- Gespeicherte Einträge ohne Ortszeit (ältere Versionen) behalten ihr `at`, bis die App sie beim nächsten Öffnen neu stellt.
- In JS gehört die Zeitzone zur Signatur des Plans (`timeZoneKey`: IANA-Name aus Intl und aktueller Versatz). Kommt die App nach einem Wechsel zurück in den Vordergrund, stellt `useReminderSync` alles neu, auch mit Texten und Tagen, die sich mit dem neuen Datum geändert haben. Ein Wechsel der Sommerzeit ändert den Versatz und stellt ebenfalls neu, das schadet nicht.

## Offene Punkte

- **Einmalig beim Update auf diese Version:** Die bis dahin von expo-notifications gestellten Erinnerungen verfallen, weil dessen Empfänger fehlt. Neu gestellt werden sie beim nächsten Öffnen der App. Wer nach dem Update die App gar nicht öffnet, bekommt bis dahin keine Erinnerung.
- iOS stellt keine Erinnerungen mehr. Daylight wird nur für Android gebaut.
- Für F-Droid fehlt noch: Abhängigkeitsbaum mit dem F-Droid-Scanner prüfen, Build-Rezept, Entscheidung zur Signatur.
