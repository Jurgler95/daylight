---
name: deploy
description: Neue Daylight-Version veröffentlichen: hebt die Versionsnummer, schreibt einen kurzen Eintrag in die Updatehistorie der App, committet, pusht und startet die GitHub-Action, die die APK baut, ihr Manifest prüft (kein INTERNET, keine Cloud-Sicherung, Health Connect nur lesend) und sie als GitHub-Release mit Versions-Tag ablegt. Meldet am Ende den Link zum Release, von dem das Handy die APK lädt. Nutzen, wenn nach einem Deploy, Release, einer neuen Version, einem APK-Build oder "/deploy" bzw. "/apk-release" gefragt wird.
---

# Deploy

Ein Durchlauf bringt eine neue sideloadbare Version heraus: Versionsnummer hoch, Updatehistorie
ergänzt, Commit gepusht, dann `.github/workflows/release.yml` auf dem Branch gestartet. Die
Pipeline baut die APK und das App Bundle für den Play Store, prüft Manifest und Signatur, legt
beides mit den Stichpunkten als GitHub-Release ab und
setzt dabei den Tag `vX.Y.Z`. Gebaut wird nicht mehr lokal. Den Tag nie selbst setzen oder pushen:
der Workflow bricht ab, wenn er schon existiert. Die Schritte laufen in dieser Reihenfolge, nichts
überspringen. Übernommen aus der Zyklus-App (`../menstruation-cycle/.claude/skills/deploy/`),
ergänzt um die Manifestprüfung.

Argument (optional): `patch` (Standard), `minor` oder `major` für die Art des Versionssprungs.

Das Repo gehört dem GitHub-Konto `Jurgler95`, das aktive `gh`-Konto sieht es nicht. Deshalb jeden
`gh`-Aufruf so starten:

```bash
GH_TOKEN=$(gh auth token --user Jurgler95) gh ... --repo Jurgler95/daylight
```

## 1. Arbeitsverzeichnis und Branch prüfen

```bash
git status --short
git branch --show-current
git log --oneline -20
```

Uncommittete Änderungen sind in Ordnung, sie gehören meistens genau zu diesem Release und werden in
Schritt 6 mitcommittet. Kurz melden, was offen ist.

Der Aufruf des Skills ist die Zusage, zu committen, zu taggen und zu pushen. Nur wenn der Branch
nicht `main` ist: fragen, ob wirklich von diesem Branch veröffentlicht werden soll, und die Antwort
abwarten. Der Workflow läuft dann auf diesem Branch, und der Tag zeigt auf einen Commit außerhalb
von `main`. Der Gradle-Cache wird nur auf `main` geschrieben, der Build dauert dann länger.

## 2. Was hat sich in der App geändert

Quelle sind die Commits seit dem letzten Versions-Tag und die offenen Änderungen im
Arbeitsverzeichnis:

```bash
sed -n 's/.*"version": "\(.*\)".*/\1/p' app.json | head -1
sed -n '1,40p' lib/changelog/index.ts
git describe --tags --abbrev=0 --match 'v*' 2>/dev/null
git log --oneline <letzter-tag>..HEAD
git diff --stat
```

Gibt es noch keinen Tag, ist der erste Eintrag in `lib/changelog/index.ts` der Anker: alles, was
danach kam, wird zum neuen Eintrag verdichtet.

Regeln für die Stichpunkte, die in der App und im GitHub-Release landen:

- Nur Verhalten, das man in der App sieht oder merkt. Refactorings, Tests, Abhängigkeiten,
  Build-Änderungen und interne Umbauten kommen nicht vor.
- Höchstens fünf Punkte. Weniger ist besser, verwandte Punkte zusammenfassen.
- Ein kurzer Satz pro Punkt, aktiv formuliert, kein Punkt am Ende, keine Gedankenstriche.
- Deutsch, in der Sprache der App. Keine Dateinamen, keine Funktionsnamen, keine Commit-Hashes.
- Wenn sich in der App nichts geändert hat: das sagen und nachfragen, ob das Release trotzdem raus
  soll. Dann reicht ein Punkt wie „Kleinere Korrekturen im Hintergrund".

Gut: „Der Kalender zeigt geplante Aktivitäten an künftigen Tagen"
Schlecht: „AheadMarker in useCalendarMarkers eingeführt"

## 3. Version heben

Die neue Nummer folgt aus `version` in `app.json` und der Art des Sprungs (Standard: Patch, also
`1.0.1` → `1.0.2`). `versionCode` unter `android` wird immer um eins erhöht, sonst nimmt Android
das Update nicht an. `npm version` zieht `package.json` und `package-lock.json` mit.

```bash
VERSION=$(node -e "
const fs = require('fs');
const bump = process.argv[1] || 'patch';
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const [ma, mi, pa] = app.expo.version.split('.').map(Number);
const next = bump === 'major' ? [ma + 1, 0, 0] : bump === 'minor' ? [ma, mi + 1, 0] : [ma, mi, pa + 1];
app.expo.version = next.join('.');
app.expo.android.versionCode += 1;
fs.writeFileSync('app.json', JSON.stringify(app, null, 2) + '\\n');
console.log(app.expo.version);
" patch)
npm version "$VERSION" --no-git-tag-version
```

Shell-Variablen überleben den einzelnen Aufruf nicht. In jedem späteren Befehl, der `$VERSION`
braucht, die Version neu lesen oder direkt einsetzen:

```bash
VERSION=$(node -p "require('./app.json').expo.version")
```

## 4. Updatehistorie ergänzen

Neuen Eintrag als erstes Element in `RELEASES` in `lib/changelog/index.ts` einfügen: `version` wie
eben gesetzt, `date` das heutige Datum als `YYYY-MM-DD`, `changes` die Stichpunkte aus Schritt 2.
Bestehende Einträge bleiben unverändert stehen. Ausnahme: Ist die vorige Version nie erschienen,
weil ihr Lauf an einem Codefehler oder an der Manifestprüfung scheiterte (kein Tag `v<vorige>` auf
GitHub), wird ihr Eintrag auf die neue Version umbenannt und ergänzt statt ein zweiter angelegt.

Die App zeigt die Liste unter „Mehr" → „Updatehistorie" ([app/more/changelog.tsx](app/more/changelog.tsx)),
der Eintrag zur laufenden Version ist dort hervorgehoben. Dieselben Stichpunkte landen in der
Beschreibung des GitHub-Releases.

## 5. Lokal prüfen

```bash
npm run typecheck && npm test
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .github/scripts/release-notes.mjs "$VERSION"
```

Die Pipeline prüft dasselbe noch einmal, aber lokal fällt ein Fehler in Sekunden auf statt nach
Minuten. Das Skript gibt die Release-Notes aus und bricht ab, wenn `app.json`, `package.json`,
`package-lock.json` und der oberste Eintrag der Updatehistorie nicht dieselbe Version tragen, wenn
der Eintrag leer ist oder wenn `versionCode` nicht über dem des letzten Versions-Tags liegt. Für
den letzten Vergleich vorher `git fetch --tags origin`. Schlägt etwas fehl:
abbrechen, melden, nichts committen.

Kam seit dem letzten Release eine neue native Abhängigkeit dazu, lohnt ein Blick, ob sie eine
Berechtigung mitbringt. Die trägt man in `app.json` unter `android.blockedPermissions` ein, sonst
scheitert die Manifestprüfung in der Pipeline erst nach dem Build.

## 6. Committen, pushen, Pipeline starten

Alles committen, was zum Release gehört. Die Commit-Message beschreibt auf Deutsch, was sich
geändert hat, und nennt die neue Version, wie bisher etwa „Version 1.0.11: ...". `builds/` und
`android/` stehen in `.gitignore` und bleiben außen vor.

```bash
git add -A
git commit -m "Version $VERSION: ..."
git push origin HEAD
GH_TOKEN=$(gh auth token --user Jurgler95) gh workflow run release.yml --repo Jurgler95/daylight --ref "$(git branch --show-current)" -f version="$VERSION"
```

Wird der Push abgelehnt, weil `origin` voraus ist: holen, neu aufsetzen, lokal erneut prüfen
(Schritt 5), dann pushen und erst danach die Pipeline starten. Der Workflow baut den Stand, der zum
Startzeitpunkt auf dem Branch liegt.

## 7. Pipeline beobachten

```bash
GH_TOKEN=$(gh auth token --user Jurgler95) gh run list --repo Jurgler95/daylight --workflow release.yml --event workflow_dispatch --limit 5 --json databaseId,displayTitle,status,url --jq ".[] | select(.displayTitle == \"Daylight $VERSION\")"
GH_TOKEN=$(gh auth token --user Jurgler95) gh run watch <id> --repo Jurgler95/daylight --exit-status --interval 30
```

Der Lauf trägt den Titel „Daylight X.Y.Z" und kann ein paar Sekunden brauchen, bis er in der Liste
auftaucht. Der Build dauert etwa 10 bis 20 Minuten: `gh run watch` im Hintergrund laufen lassen
(`run_in_background`), den Link zum Lauf gleich melden und auf die Benachrichtigung warten.

Schlägt der Lauf fehl:

```bash
GH_TOKEN=$(gh auth token --user Jurgler95) gh run view <id> --repo Jurgler95/daylight --log-failed | tail -80
```

Ursache melden. Lag es an der Pipeline selbst und nicht am Code (Runner, Netz, Cache, Upload),
lässt sich der Lauf mit `gh run rerun <id> --failed` wiederholen. Ein halb angelegter
Release-Entwurf wird dabei weiterverwendet. Ein Codefehler wird behoben und als neue
Patch-Version veröffentlicht, siehe die Ausnahme in Schritt 4.

Scheitert der Schritt „Signaturschlüssel bereitstellen" oder „Signatur prüfen": nicht ausliefern.
Fehlen die Secrets `DAYLIGHT_KEYSTORE_BASE64` und `DAYLIGHT_KEYSTORE_PASSWORD` im Repo, das
melden; sie kommen aus `~/.keystores/daylight-release.jks` und dem Schlüsselbund-Eintrag
`daylight-keystore` (siehe `docs/development.md`, Signatur). Nie einen neuen Schlüssel erzeugen: Updates über
die installierte App gehen nur mit demselben.

Scheitert der Schritt „Manifest prüfen": nicht ausliefern, nicht wiederholen. Das Log nennt die
Berechtigung oder Einstellung, die nicht passt. Eine neue Abhängigkeit, die eine Berechtigung
mitbringt, kommt in `app.json` unter `android.blockedPermissions`, dann als neue Patch-Version
veröffentlichen. Was erwartet wird, steht in `.github/scripts/check-manifest.mjs`: kein
`android.permission.INTERNET`, kein `c2dm`, keine Launcher-Badges, `android:allowBackup` aus und
von Health Connect genau die fünf lesenden Berechtigungen, kein `health.WRITE_*` und kein
`health.READ_HEALTH_DATA_IN_BACKGROUND` (`docs/decisions/gesundheitsdaten-health-connect.md`).

## 8. Release prüfen

```bash
GH_TOKEN=$(gh auth token --user Jurgler95) gh release view "v$VERSION" --repo Jurgler95/daylight --json url,assets --jq '{url, assets: [.assets[] | {name, size}]}'
```

```bash
git fetch --tags origin
```

Das Release muss genau eine `daylight-$VERSION.apk` und eine `daylight-$VERSION.aab` tragen, der
Fetch holt den Tag, den der Workflow gesetzt hat. Die `.aab` lädt Paul selbst in der Play Console
hoch. Aufs Handy kommt die APK direkt aus dem GitHub-Release, der Link reicht. Lehnt
das Handy die Installation ab: unter Android muss dem Browser einmalig erlaubt werden, Apps aus
unbekannten Quellen zu installieren. Meldet es einen Signaturkonflikt, stammt die installierte
Version aus einem Build mit anderem Schlüssel und muss einmal deinstalliert werden (vorher unter
„Mehr" eine Sicherung teilen).

## 9. Melden

Kurz zusammenfassen: neue Versionsnummer und `versionCode`, die Stichpunkte, die in der App
stehen, Link zum GitHub-Release, Größe von APK und App Bundle und dass Manifest- und
Signaturprüfung durchliefen. Beide sind mit dem eigenen Release-Schlüssel signiert (Fingerabdruck
im README), der zugleich der App-Signaturschlüssel in der Play Console ist. Erinnern, dass die
`.aab` für den Play Store von Hand in der Play Console hochgeladen wird.

## Notfall: lokal bauen

Nur wenn GitHub Actions nicht verfügbar ist oder die Minuten aufgebraucht sind. JDK 17, nicht
neuer, und `ANDROID_HOME` mitgeben, weil `prebuild --clean` die `local.properties` löscht:

```bash
export DAYLIGHT_KEYSTORE=$HOME/.keystores/daylight-release.jks DAYLIGHT_KEY_ALIAS=daylight
export DAYLIGHT_KEYSTORE_PASSWORD=$(security find-generic-password -a daylight-release -s daylight-keystore -w)
export DAYLIGHT_KEY_PASSWORD=$DAYLIGHT_KEYSTORE_PASSWORD
npx expo prebuild --platform android --clean
cd android && ANDROID_HOME=$HOME/Library/Android/sdk JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
mkdir -p builds && cp android/app/build/outputs/apk/release/app-release.apk "builds/daylight-$VERSION.apk"
node .github/scripts/check-manifest.mjs "builds/daylight-$VERSION.apk"
```

Dauert mehrere Minuten, im Hintergrund mit großzügigem Timeout (600000 ms) laufen lassen. Die
Manifestprüfung ist auch hier Pflicht, schlägt sie fehl, wird nicht ausgeliefert.
