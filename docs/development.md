# Daylight: Entwicklung

Technische Doku zu Daylight: Setup, Architektur, Logo und Release. Was die App kann, steht im [README](../README.md).

## Setup

```bash
npm install
npm start            # Metro starten, QR-Code mit Expo Go (Android) scannen
npm run android      # Dev-Client bauen und starten (braucht Android SDK)
npm run typecheck    # tsc --noEmit
npm test             # jest
npm run db:generate  # Drizzle-Migration aus db/schema.ts erzeugen
```

Voraussetzungen: Node 22+, Expo Go auf einem Android-Gerät im selben Netz.

Unter Node 24.14.1 stürzt gelegentlich ein Jest-Worker mit `SIGSEGV` in der Speicherbereinigung von V8 ab (etwa ein Lauf von zehn, die Suite meldet "A jest worker process ... was terminated"). Das ist ein Fehler in Node, nicht in den Tests: erneut laufen lassen, oder Node 22 LTS bzw. ein neueres Node 24 verwenden.

Nach neuen Dateien unter `app/` einmal `npx expo customize tsconfig.json` ausführen, damit `.expo/types/router.d.ts` die Typed Routes kennt.

`app.json` blockiert `INTERNET` über `android.blockedPermissions`. Ein Dev-Client-Build (nicht Expo Go) erreicht Metro nur, wenn der Eintrag vorübergehend entfernt wird. Vor dem Commit wieder eintragen.

## Architektur

| Ordner | Inhalt |
| --- | --- |
| `app/` | expo-router Routen. `(tabs)/` enthält die fünf Tabs (Heute, Kalender, Einblicke, Verlauf, Mehr), `entry/` den Eintrag-Editor als Modal (`new?date=&mood=`, `[id]`), `more/` die Unterseiten (Verwaltung von Stimmungen, Aktivitäten, Gruppen und Skalen, Import-Vorschau, Löschen, Ausblick mit Backtest-Tabelle, Erinnerung, App-Sperre, Datenschutz, Updatehistorie, Über), `activity/[id]` und `mood/[level]` die Detailseiten der Einblicke. |
| `db/` | Drizzle-Schema (`schema.ts`), Verbindung (`client.ts`), Migrationsrunner (`migrate.ts`), synchrone Repositories (`repositories/`, inklusive Zusammenführen und Sortieren von Aktivitäten), Jest-Helfer (`testDb.ts`). |
| `drizzle/` | Von drizzle-kit generierte SQL-Migrationen. Nicht von Hand bearbeiten. |
| `lib/daylio/` | Daylio-CSV: Parser und Writer (`csv.ts`), Zeilen lesen (`parse.ts`), bekannte Namen (`known.ts`), reiner Importplan (`plan.ts`), Anwenden (`apply.ts`), Export (`write.ts`, `rows.ts`). |
| `lib/export/` | Daylight-JSON (zod, Formatmigration, Ersetzen, Zusammenführen), Formaterkennung, Import-Vorschau und Dateien. |
| `lib/entry/` | Entwurf des Editors (rein) und `useEntryEditor`. |
| `lib/calendar/`, `lib/mood/` | Monatsraster, Tagesmarker, Screenreader-Text je Tag; Tagesmittel der Stimmung. |
| `lib/search/` | Suche über Einträge (gefaltet, Chips mit UND, Stufen, Zeitraum) und Monatsabschnitte für den Verlauf. |
| `lib/insights/` | Alle Auswertungen als reine Funktionen über Tagen (`days.ts`: ein Tag = Mittel seiner Einträge, Vereinigung seiner Aktivitäten): Zeitraum (`range.ts`), Stimmungsverlauf, Verteilung, Monate (`mood.ts`), Wochentage (`weekdays.ts`), Schwankung und Serien (`swings.ts`), Pixel (`pixels.ts`), Wirkung von Aktivitäten mit und ohne, auch am Folgetag (`effects.ts`), Häufigkeit, Paare, Gruppentabelle (`activities.ts`), vor schwierigen Tagen (`beforeHard.ts`), Wörter (`words.ts`, `stopwords.ts`), Umfang (`coverage.ts`), Detailseiten (`detail.ts`), Schrumpfung und Statistik (`stats.ts`). `overview.ts` fasst alles für einen Zeitraum zusammen, `useInsights.ts` ist die Brücke. Stimmung nach Schlaf, Schritten und Training (`health.ts`). Der Ausblick nutzt `activityEffects` und `weekdayProfile` von hier. |
| `lib/outlook/` | Ausblick auf die nächsten sieben Tage, rein: Modell aus Langzeitmittel, Nachwirkung, Wochentag und Aktivitäten (`model.ts`), wiederkehrende Aktivitäten (`recurring.ts`), rollierender Backtest gegen Langzeitmittel und häufigste Stimmung (`backtest.ts`), Spanne und Begründung nur für Abstände, in denen das Modell beide schlägt (`outlook.ts`). `useOutlook.ts` rechnet den Backtest in Scheiben außerhalb des Renderns und hält die Fälle je Stichtag vor. |
| `lib/notifications/`, `lib/lock/`, `lib/support/` | Tägliche Erinnerung (reiner Plan in `plan.ts`, `client.ts` stellt sie über das eigene Modul `modules/daylight-reminders` ohne Firebase, siehe `docs/decisions/erinnerungen-ohne-firebase.md`), App-Sperre mit FLAG_SECURE (aus Zyklus), Hinweis bei längerem Tief. |
| `lib/health/` | Gesundheitsdaten aus Health Connect, nur lesend: reine Umrechnung in Tageswerte und Planung der Abgleichsfenster (`days.ts`), Abgleich mit Pause und Wiederaufnahme (`sync.ts`), `client.ts` lädt react-native-health-connect faul (nie in Expo Go), `useHealthSync.ts` gleicht beim Öffnen ab, `store.ts` treibt den Ladekreis. Details in `docs/decisions/gesundheitsdaten-health-connect.md`. |
| `lib/catalog/` | Stimmungen, Gruppen, Aktivitäten und Skalen mit Lookups, einmal je Datenstand gelesen. |
| `lib/dev/` | Synthetische Beispieldaten (ein Jahr), geladen über den Import-Pfad. |
| `lib/` sonst | `dates` (einziger Ort für date-fns, `useToday` für den Tageswechsel), `theme` (Palette "Tageslicht", Stimmungsfarben), `i18n`, `haptics`, `store` (`useQuery`/`mutate`, Einstellungen, gewählter Tag), `icons` (Typ und Symbolauswahl), `manage`, `changelog`. |
| `components/` | `ui/` Bausteine aus Zyklus (AppText, Card, Button, Chip, ListRow, Screen, Segmented, SelectRow usw., dazu `Logo` und der blasse `LogoBackdrop` mit der generierten Geometrie aus `logoPaths.ts`), `calendar/` Monatsliste und `DayGlyph` (künftige Tage mit Ausblick-Ring und Plänen), `today/` Tagesleiste, Sicherungs- und Tief-Hinweis, `outlook/` Tagesdetail künftiger Tage und Plan-Chips, `lock/` Sperrbildschirm, `settings/` Uhrzeitwahl, `entry/` Editor und Lesekarte, `history/` Verlauf und Suche, `manage/` Verwaltung (Sortieren per Ziehen, Symbolauswahl), `mood/`, `import/`, `insights/` Karten der Einblicke (Verlauf als eigenes SVG, Pixel, Wochentage, Monatsbalken mit gifted-charts, Aktivitätszeilen). |
| `scripts/` | `logo.mjs`: Icons, Splash und Logo-Geometrie aus `assets/logo.svg` (siehe Logo). `store-graphics.mjs`: Play-Store-Grafiken aus `store/graphics.html` (siehe Store-Grafiken). |
| `docs/decisions/` | Handover-Dokumente pro Phase. Vor jeder neuen Phase alle lesen. |

Grundsätze (wie in Zyklus):

- Kalendertage als `YYYY-MM-DD`, Uhrzeiten als `HH:mm`, als Strings gespeichert und verglichen. Rechnen mit Tagen nur über `lib/dates`.
- Reine Module in `lib/` ohne DB und React, daneben ein `use*.ts` als Brücke. Keine Geschäftslogik in Komponenten.
- Repositories sind synchron und nehmen `db` als erstes Argument. Tests laufen gegen better-sqlite3 in-memory, migriert mit denselben SQL-Dateien wie die App.
- Screens lesen über `useQuery` und schreiben über `mutate`.
- Jeder Import wird vollständig geparst und validiert, bevor die Datenbank angefasst wird, zeigt eine Vorschau und läuft in einer Transaktion.
- Stimmungen und Aktivitäten tragen MaterialCommunityIcons, die Oberfläche Ionicons.
- Der Eintrag-Editor schreibt erst mit "Speichern" und fragt beim Verlassen mit Änderungen nach. Felder in der Verwaltung speichern beim Verlassen und beim Schließen der Seite.
- Stimmungen, Gruppen, Aktivitäten und Skalen werden archiviert, nicht gelöscht. Doppelte Aktivitäten werden zusammengeführt.
- `android.allowBackup` steht auf `false`, damit Android Auto Backup keine Daten in die Cloud kopiert. Als Ausgleich erinnert Heute nach 60 Tagen ohne JSON-Sicherung.
- Der Ausblick wird nur für Abstände gezeigt, in denen er im Backtest besser war als Langzeitmittel und häufigste Stimmung. Sonst zeigt ein künftiger Tag das Wochentagsmittel und Gewohntes. Auf Heute gibt es keine eigene Ausblickskarte mehr.
- Erinnerungen fragen die Berechtigung erst beim Einschalten, ihr Text verrät nichts aus dem Tagebuch.
- Health Connect wird nur gelesen: `app.json` fordert ausschließlich `health.READ_*` an und sperrt die `WRITE_*`-Varianten. Die Gesundheitstage (`health_days`) sind gerätelokal und nicht Teil der Sicherung.
- Das Logo liegt blass hinter jeder Seite (`LogoBackdrop` in `Screen`, Editor, Sperr- und Fehlerbildschirm), Karten sind zu 82 Prozent deckend. Die Deko-Töne `decorMark` und `decorSun` sind so hell, dass jede Textfarbe darauf 4,5:1 hält; `contrast.test.ts` prüft das.

## Logo

Das Logo "Wellenring" liegt als `assets/logo.svg` im Raster eines Android-Adaptive-Icons (108 × 108, sichtbar 18 bis 90). Es ist die einzige Quelle: App-Icon, die drei Ebenen des Adaptive Icons (Vordergrund, Hintergrund, Monochrom), Splash, Favicon, Benachrichtigungssymbol und die Geometrie für die App (`components/ui/logoPaths.ts`) werden daraus erzeugt:

```bash
node scripts/logo.mjs               # alles neu erzeugen
node scripts/logo.mjs --paths-only  # nur logoPaths.ts
```

Das Skript rastert mit `npx @resvg/resvg-js-cli` in fester Version; npx lädt es beim ersten Lauf in seinen Cache, es ist keine Abhängigkeit des Projekts. Ein Test (`components/ui/__tests__/logo.test.tsx`) schlägt an, wenn `logoPaths.ts` nicht mehr zur Quelle passt. Details in `docs/decisions/phase-6-logo-hintergrund.md`.

## Store-Grafiken

App-Icon (512 × 512), Feature Graphic (1024 × 500) und sieben Screenshots (1080 × 1920) für Google Play liegen auf Deutsch und Englisch in `fastlane/metadata/android/de-DE/images/` und `en-US/images/`, der Ordnerstruktur von fastlane supply, die auch F-Droid liest. Quelle ist die Vorlage `store/graphics.html` mit den App-Screenshots aus `store/screens/de/` und `store/screens/en/`. Neu rendern mit headless Chrome:

```bash
node scripts/store-graphics.mjs
```

Einzelne Grafik im Browser ansehen: `store/graphics.html?asset=shot-3&lang=en` (oder `icon`, `feature`; ohne `lang` Deutsch).

Die App-Screenshots stammen aus dem Pixel-9-Emulator mit den Beispieldaten, die in der Sprache der App geladen werden. Vorher die App-Sprache setzen (`adb shell cmd locale set-app-locales de.behla.daylight --locales en-US`), dann erst die Daten zurücksetzen und „Beispieldaten laden“, sonst tragen Stimmungen und Gruppen die Namen der anderen Sprache. Uhr und Statusleiste über den Demo-Modus der System-UI auf 20:30 festsetzen.

## Release

Der ganze Ablauf steckt im Skill `deploy` (`.claude/skills/deploy/SKILL.md`): er hebt `version` und `versionCode`, schreibt einen kurzen Eintrag auf Deutsch und Englisch in `lib/changelog/index.ts`, committet, pusht und startet die GitHub-Action `.github/workflows/release.yml` auf `main`. Die baut die APK (nur `arm64-v8a`) und das App Bundle für den Play Store (`arm64-v8a` und `armeabi-v7a`), prüft das Manifest der APK (`.github/scripts/check-manifest.mjs`: kein `INTERNET`, `allowBackup=false`, Health Connect nur lesend, weder Firebase noch Play Services im Code), prüft die Signatur beider Dateien, legt sie mit den Stichpunkten aus der Updatehistorie (Deutsch, darunter Englisch) als GitHub-Release ab und setzt dabei den Tag `vX.Y.Z`. Aufs Handy kommt die APK direkt aus dem GitHub-Release, die `.aab` wird von Hand in der Play Console hochgeladen. Der Daylight-Schlüssel ist dort als App-Signaturschlüssel hinterlegt, Play-Version und APK lassen sich also übereinander installieren.

Cloud-Build über EAS, Profile in `eas.json` (braucht ein Expo-Konto, bisher nicht genutzt):

```bash
npx eas-cli build --platform android --profile preview        # APK zum Sideloaden
npx eas-cli build --platform android --profile production     # AAB für den Play Store
```

Lokal ohne Expo-Konto (Android SDK und JDK 17; JDK 26 bricht Gradle):

```bash
npx expo prebuild --platform android --clean
cd android
ANDROID_HOME=$HOME/Library/Android/sdk JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Danach das Manifest der fertigen APK prüfen, nicht das im Quellbaum:

```bash
AAPT2=$(ls -d $HOME/Library/Android/sdk/build-tools/*/ | sort -V | tail -1)aapt2
$AAPT2 dump badging android/app/build/outputs/apk/release/app-release.apk | grep uses-permission
$AAPT2 dump xmltree android/app/build/outputs/apk/release/app-release.apk --file AndroidManifest.xml | grep allowBackup
```

Erwartet: kein `android.permission.INTERNET`, keine FCM- oder Badge-Rechte, `allowBackup` gleich `0x0`.

### Signatur

Release-APKs signiert das Config-Plugin `plugins/withReleaseSigning.js` mit dem eigenen Schlüssel, sobald `DAYLIGHT_KEYSTORE` gesetzt ist, sonst mit dem Debug-Keystore der Vorlage. In der Pipeline kommen Keystore und Passwort aus den Secrets `DAYLIGHT_KEYSTORE_BASE64` und `DAYLIGHT_KEYSTORE_PASSWORD`, danach prüft der Schritt "Signatur prüfen" den Fingerabdruck aus dem README. Für einen lokalen Build mit dem echten Schlüssel vor `gradlew` setzen:

```bash
export DAYLIGHT_KEYSTORE=$HOME/.keystores/daylight-release.jks DAYLIGHT_KEY_ALIAS=daylight
export DAYLIGHT_KEYSTORE_PASSWORD=$(security find-generic-password -a daylight-release -s daylight-keystore -w)
export DAYLIGHT_KEY_PASSWORD=$DAYLIGHT_KEYSTORE_PASSWORD
```

Wer einen Fork baut, erzeugt einen eigenen Schlüssel; ohne die Variablen entsteht eine debug-signierte APK, die nur zum Ausprobieren taugt.

`android/` ist generiert und in `.gitignore`, gebaute `*.apk` ebenfalls.

## Sprache

Die App gibt es auf Deutsch und Englisch. Die Texte liegen in `lib/i18n/locales/de.json` und `en.json`, beide mit denselben Schlüsseln. Gewechselt wird unter „Mehr“ › „Sprache“. Solange dort nichts gewählt ist, folgt die App dem Gerät: Deutsch auf deutschen Geräten, sonst Englisch.

- Die Sprache steht in `settings.language` und gehört wie der Health-Connect-Stand zum Gerät, nicht in die Sicherung.
- Datumsangaben und Zahlen (`lib/dates`, `lib/insights/format`, `lib/health/format`) lesen die Sprache über `currentLanguage()`, auch die Spalten `date` und `weekday` im Daylio-CSV-Export.
- Standardstimmungen und -gruppen entstehen beim ersten Start in der Sprache der App, mit eigenen Namen (Super, Gut, Ok, Schlecht, Mies und Great, Good, Okay, Bad, Awful). Daylios Namen wie „rad“, „meh“ oder „Lausig“ erkennt der Import weiter über die Stufe. „Alle Daten löschen“ behält die gewählte Sprache.
- Daylio gibt es auf Deutsch und Englisch, der Import versteht beides. Gruppen haben in `lib/daylio/known.ts` einen festen Schlüssel mit Namen in beiden Sprachen; eine bekannte Aktivität landet in der vorhandenen Gruppe, egal in welcher Sprache sie heißt („happy“ in „Gefühle“ oder „Emotions“).
- Die Tests prüfen deutsche Texte; `jest.setup.ts` hält die Gerätesprache dafür auf Deutsch.
