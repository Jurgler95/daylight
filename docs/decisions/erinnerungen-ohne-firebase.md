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
| `.../ReminderReceiver.kt` | Zeigt eine fällige Erinnerung; stellt nach `BOOT_COMPLETED`, `REBOOT`, `QUICKBOOT_POWERON` und `MY_PACKAGE_REPLACED` alle offenen neu |
| `.../DaylightRemindersModule.kt` | Brücke zu JS: `createChannel`, `hasPermission`, `requestPermission`, `schedule`, `cancelAll` |
| `.../res/drawable-*/daylight_reminder_icon.png`, `values/colors.xml` | Benachrichtigungssymbol und Farbe `#11786A`, vorher vom Config-Plugin von expo-notifications erzeugt. `scripts/logo.mjs` schreibt die Symbole jetzt direkt hierher, `assets/notification-icon.png` ist entfallen |
| `lib/notifications/client.ts` | Gleiche Schnittstelle wie vorher, spricht das eigene Modul an |
| `.github/scripts/check-manifest.mjs` | Bricht ab, wenn `com.google.firebase` oder `com.google.android.gms` in den `.dex`-Dateien der APK steht |

## Was vom alten Verhalten übernommen ist

Nachgelesen im Quellcode von expo-notifications 57.0.21:

1. **Alarm:** `RTC_WAKEUP` mit `setExactAndAllowWhileIdle`, wenn genaue Alarme erlaubt sind (vor Android 12 immer), sonst `setAndAllowWhileIdle`. Daylight fordert `SCHEDULE_EXACT_ALARM` nicht an, ab Android 12 also wie bisher ungenau.
2. **Kanal** `reminders`: gleiche ID, Wichtigkeit `DEFAULT`, auf dem Sperrbildschirm `PRIVATE`, Vibration `[0, 200]`, Standardton. Bestehende Kanaleinstellungen der Nutzer bleiben, weil die ID gleich bleibt.
3. **Benachrichtigung:** Titel, Text als `BigTextStyle`, schließt sich beim Antippen, Priorität `HIGH` (wirkt ab Android 8 ohnehin nur über den Kanal). Ist die App im Vordergrund, kommt sie stumm, wie vorher mit `shouldPlaySound: false`.
4. **Antippen** öffnet die App über ihren Launcher-Intent.
5. **Neustart und Update:** offene Erinnerungen werden neu gestellt, verpasste verfallen.
6. **Berechtigung:** ab Android 13 `POST_NOTIFICATIONS` über das Berechtigungsmodul von Expo, davor der Systemschalter für Benachrichtigungen. Die Kanalanlage vor der Abfrage bleibt.

## Offene Punkte

- **Einmalig beim Update auf diese Version:** Die bis dahin von expo-notifications gestellten Erinnerungen verfallen, weil dessen Empfänger fehlt. Neu gestellt werden sie beim nächsten Öffnen der App. Wer nach dem Update die App gar nicht öffnet, bekommt bis dahin keine Erinnerung.
- iOS stellt keine Erinnerungen mehr. Daylight wird nur für Android gebaut.
- Für F-Droid fehlt noch: Abhängigkeitsbaum mit dem F-Droid-Scanner prüfen, Build-Rezept, Entscheidung zur Signatur.
