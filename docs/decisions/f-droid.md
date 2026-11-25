# F-Droid

## Status

Vorbereitet am 2026-11-25, noch nicht eingereicht. Die Inclusion Policy verlangt drei Monate aktive Entwicklung; das Repo ist vom 2026-09-30, ein Merge Request auf fdroiddata hat also frühestens ab 2026-12-30 Aussicht. IzzyOnDroid kommt nicht in Frage, weil es mit generativer KI geschriebene Apps ablehnt. F-Droid selbst hat dazu keine Regel (Stand 2026-11, Diskussion in gitlab.com/fdroid/admin#641 offen), Apps mit offen angegebener KI-Nutzung wurden aufgenommen. Im Merge Request die KI-Nutzung offen nennen, wie im README.

## Entscheidung

- **Reproduzierbarer Build mit dem Daylight-Schlüssel**, nicht die F-Droid-Signatur. F-Droid baut selbst, vergleicht mit der signierten APK aus dem GitHub-Release (`Binaries:`) und veröffentlicht diese nur, wenn alles außer der Signatur gleich ist (`AllowedAPKSigningKeys: 9d5eff541970f609857fb6f8431ce86274b46efb2e1b56a59b63cc87041fc98a`). So lassen sich Play, GitHub und F-Droid übereinander aktualisieren. Später umstellen geht nicht. Nachteil: Weicht ein Build ab, erscheint auf F-Droid kein Update, bis der Unterschied behoben ist.
- **Expo-Module aus dem Quellcode** (`"expo": {"autolinking": {"android": {"buildFromSource": [".*"]}}}` in `package.json`). Seit SDK 53 nimmt Expo auf Android vorkompilierte AARs aus `node_modules/*/local-maven-repo` (bei Daylight 22 Module), die F-Droid nicht zulässt. Damit GitHub- und F-Droid-Build gleich sind, baut auch die Pipeline aus dem Quellcode. React Native und Hermes aus Maven Central erlaubt die Policy ausdrücklich.
- **Kein Baseline-Profil** (`plugins/withoutBaselineProfile.js`), weil `baseline.prof` nicht deterministisch ist.
- **NDK nicht eigens festgelegt.** Es gilt die Version von React Native (0.86: `27.1.12297006`, F-Droid `ndk: r27b`). Hebt ein Update von React Native sie, muss nur das Feld `ndk` im Rezept mitziehen.
- **Anti-Feature `NonFreeDep`** selbst angeben: Health Connect ist bis Android 13 die App von Google, ab Android 14 Teil des Systems, und in Daylight optional.

## Geprüft (2026-11-25)

- Abhängigkeiten (`releaseRuntimeClasspath`): nur Google Maven und Maven Central, kein Firebase, keine Play Services.
- fdroidserver-Scanner auf frischem Clone nach `npm ci` und `expo prebuild`: alle 170 Meldungen in `node_modules` (vorkompilierte AARs, iOS-Binärdateien, hermesc, ungenutzte libsql/sqlite-vec-Bibliotheken von expo-sqlite, lokale Maven-Pfade in build.gradle von Bibliotheken). Die übliche Lösung aller Expo-Apps auf F-Droid: `scandelete: node_modules` plus `scanignore`. Außerhalb von `node_modules` keine Meldung.
- Release-Build mit `buildFromSource` läuft, Manifestprüfung sauber. Gegen die GitHub-APK 1.0.40 (noch mit vorkompilierten Modulen, auf Linux gebaut) gleich: JS-Bundle, `classes.dex`, Ressourcen, alle `.so` aus Maven. Verschieden: `classes2.dex` und `resources.arsc` (vorkompiliert gegen selbst gebaut), 11 selbst kompilierte `.so` (macOS gegen Linux), `baseline.prof`.

## Offen

1. Nach dem nächsten Release (das erste mit diesen Einstellungen) das Rezept im Docker-Image `registry.gitlab.com/fdroid/fdroidserver:buildserver` unter Linux bauen und mit der Release-APK vergleichen. Erst das zeigt, ob der Build wirklich reproduzierbar ist (mögliche Quellen: JDK Temurin gegen Debian-OpenJDK, Node-Version, Pfade in nativen Bibliotheken).
2. Ab 2026-12-30: Fork von fdroiddata, `metadata/de.behla.daylight.yml`, Merge Request mit der Vorlage für neue Apps.

## Rezept (Entwurf)

Format geprüft mit `fdroid lint` und `fdroid rewritemeta` (fdroidserver 2.4.5). `versionName`, `versionCode` und `commit` auf das erste Release mit `buildFromSource` setzen. Angelehnt an andere reproduzierbare Expo-Apps in fdroiddata (`xyz.hub13.remindiary`, `com.evb.folderplayer`).

```yaml
AntiFeatures:
  NonFreeDep:
    en-US: Reading health data needs Health Connect. On Android 14 and later it is
      part of the system, on Android 13 and older it is Google's Health Connect app.
      The feature is optional.
Categories:
  - Mental Health
  - Writing
License: GPL-3.0-or-later
AuthorName: Paul Behla
WebSite: https://paul-behla.de/apps/daylight/
SourceCode: https://github.com/Jurgler95/daylight
IssueTracker: https://github.com/Jurgler95/daylight/issues
Changelog: https://github.com/Jurgler95/daylight/releases

AutoName: Daylight

RepoType: git
Repo: https://github.com/Jurgler95/daylight.git
Binaries: https://github.com/Jurgler95/daylight/releases/download/v%v/daylight-%v.apk

Builds:
  - versionName: X.Y.Z
    versionCode: N
    commit: <voller Commit-Hash des Tags vX.Y.Z>
    sudo:
      - echo "deb https://deb.debian.org/debian forky main" > /etc/apt/sources.list.d/forky.list
      - apt-get update
      - apt-get install -y -t forky nodejs npm
    init:
      - export CI=1 EXPO_NO_TELEMETRY=1
      - npm ci --no-audit --no-fund
    output: android/app/build/outputs/apk/release/app-release-unsigned.apk
    srclibs:
      - reproducible-apk-tools@v0.3.0
    prebuild:
      - npx expo prebuild --platform android --clean --no-install
      - sed -i -e '/signingConfig /d' android/app/build.gradle
      - printf '\norg.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g\n' >> android/gradle.properties
    scanignore:
      - node_modules/hermes-compiler/hermesc/linux64-bin/hermesc
      - node_modules/react-native/ReactAndroid/publish.gradle
      - node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle
      - node_modules/react-native-svg/android/build.gradle
      - node_modules/react-native-screens/android/build.gradle
      - node_modules/react-native-safe-area-context/android/build.gradle
      - node_modules/@react-native-masked-view/masked-view/android/build.gradle
      - node_modules/react-native-keyboard-controller/android/build.gradle
    scandelete:
      - node_modules
    build:
      - cd android
      - gradle :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
    ndk: r27b
    postbuild:
      - mv $$OUT$$ unaligned.apk
      - $$reproducible-apk-tools$$/zipalign.py --page-size 16 --pad-like-apksigner
        --replace unaligned.apk $$OUT$$

AllowedAPKSigningKeys: 9d5eff541970f609857fb6f8431ce86274b46efb2e1b56a59b63cc87041fc98a

AutoUpdateMode: Version
UpdateCheckMode: Tags ^v\d+\.\d+\.\d+$
CurrentVersion: X.Y.Z
CurrentVersionCode: N
```

Der Scanner löscht `gradlew` und `gradle-wrapper.jar`, deshalb `gradle` statt `./gradlew`. Ohne `DAYLIGHT_KEYSTORE` signiert `withReleaseSigning.js` mit dem Debug-Schlüssel; die `sed`-Zeile entfernt das, F-Droid braucht eine unsignierte APK.
