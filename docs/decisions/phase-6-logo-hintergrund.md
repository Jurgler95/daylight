# Phase 6: Logo und Hintergrund (Handover)

## Status

Abgeschlossen am 2026-09-27, nicht interaktiv, direkt auf `main`, nicht gepusht. Paul hat das Logo "Wellenring" gewählt. Es ist jetzt App-Icon, Splash, Favicon und Benachrichtigungssymbol und liegt blass im Hintergrund jeder Seite, nach dem Muster der Zyklus-App (Commits `d8156b2` Federn-Logo und `d71f150` Federn als Hintergrund).

Version und `versionCode` sind **nicht** gehoben (weiter 1.0.2, `versionCode` 3), es wurde keine APK gebaut. Das macht Paul mit `/apk-release`; der Eintrag 1.0.3 in der Updatehistorie steht schon bereit.

| Prüfung | Ergebnis |
| --- | --- |
| `npm run typecheck` | sauber |
| `npm test` | 42 Suites, 293 Tests grün (vorher 41 und 276; neu: 2 Fälle in `components/ui/__tests__/logo.test.tsx`, 15 im Kontrasttest) |
| `npx expo export --platform android` | bündelt (8,1 MB Hermes-Bytecode) |
| `npx expo prebuild --platform android` | in einer Kopie außerhalb des Repos ohne `private/` und `.git`: `iconBackground` `#11786A`, Splash-Hintergrund `#FBF7F0`, `splashscreen_logo` 288 dp, Launcher-Icons rund und eckig aus den neuen Ebenen, `notification_icon` 96 px. Berechtigungen unverändert, `INTERNET` weiter mit `tools:node="remove"`, `allowBackup="false"`. Neu im Manifest sind nur zwei `meta-data`-Einträge für das Benachrichtigungssymbol (`expo.modules.notifications.default_notification_icon` und das FCM-Gegenstück), keine Berechtigung |
| Blässe | als Raster eines nachgebauten Heute-Bildschirms (390 × 844, resvg) in mehreren Tönen verglichen, siehe Entscheidung 4. Die echten Screens ließen sich nicht rendern: `react-native-web` ist nicht installiert und expo-sqlite braucht im Browser eigene Header |

## Was existiert

| Datei | Inhalt |
| --- | --- |
| `assets/logo.svg` | Quelle der Wahrheit, 108 × 108 (Raster eines Adaptive Icons). Gegenüber dem Anhang nur um `id`s (`background`, `ring`, `spiral`, `sun`) und `class="hour"` ergänzt, damit der Generator die Teile findet |
| `scripts/logo.mjs` | Erzeugt aus der Quelle alle PNGs in `assets/` und `components/ui/logoPaths.ts`. Rastert mit `npx @resvg/resvg-js-cli` (feste Version, landet nur im npx-Cache). `--paths-only` schreibt nur die Geometrie |
| `assets/icon.png` | 1024 px, vollflächig Petrol, Ausschnitt 12 bis 96 des Rasters |
| `assets/android-icon-foreground.png` | 512 px, Ring, Punkte, Spirale, Sonne auf transparent, volles Raster |
| `assets/android-icon-background.png` | 512 px, einfarbig Petrol `#11786A` |
| `assets/android-icon-monochrome.png` | 432 px, alles weiß auf transparent (Themed Icons ab Android 13) |
| `assets/splash-icon.png` | 1024 px, runde Petrol-Scheibe mit Logo, Radius 36 von 108, also genau der Kreis von zwei Dritteln, auf den Android 12+ das Splash-Symbol beschneidet |
| `assets/favicon.png` | 48 px, sichtbarer Ausschnitt 18 bis 90 |
| `assets/notification-icon.png` | 96 px, weiß auf transparent, Striche 1,5-fach für die Statusleiste (Vorgabe von expo-notifications) |
| `components/ui/logoPaths.ts` | Generiert: Ring, zwölf Stundenpunkte, Spirale, Sonne und die Logofarben |
| `components/ui/Logo.tsx` | `LogoShapes` (die Formen in wählbaren Farben) und `Logo` (runde Petrol-Scheibe wie das Launcher-Icon, für Screenreader verborgen) |
| `components/ui/LogoBackdrop.tsx` | Der blasse Hintergrund: absolut, `pointerEvents="none"`, für Screenreader verborgen |
| `components/ui/__tests__/logo.test.tsx` | `logoPaths.ts` stimmt mit `assets/logo.svg` überein; der Hintergrund ist weder berührbar noch für Screenreader sichtbar |

Eingebunden:

- **Hintergrund** in `Screen` (damit alle fünf Tabs, alle Unterseiten unter Mehr, die Detailseiten von Aktivität und Stimmung, Updatehistorie, Über), im Eintrag-Editor (neu und bearbeiten, auch "Eintrag gelöscht"), im Sperrbildschirm und im Fehlerbildschirm beim Start.
- **Logo** auf dem Sperrbildschirm (88 pt, statt des Schloss-Symbols) und auf der Seite Über (64 pt neben Name und Kurztext).
- **Karten** (`Card`) und die Kacheln der Einblicke (`StatTile`) sind zu 82 Prozent deckend (`CARD_OPACITY` in `lib/theme/tokens.ts`).
- `app.json`: `adaptiveIcon.backgroundColor` `#11786A`, expo-notifications mit `icon` und Farbe `#11786A` (vorher Bernstein `#98560A`).
- Updatehistorie: Eintrag 1.0.3 in `lib/changelog/index.ts`.

## Entscheidungen

1. **Geometrie aus einer Quelle.** Wie `featherPaths.ts` in Zyklus, aber generiert statt von Hand: `scripts/logo.mjs` liest `assets/logo.svg` und schreibt Icons und `logoPaths.ts` in einem Lauf, ein Test schlägt an, wenn beide auseinanderlaufen. Nach jeder Änderung am Logo: `node scripts/logo.mjs`.
2. **Werkzeug zum Rastern: `npx @resvg/resvg-js-cli`**, auf `2.6.2-beta.1` festgelegt, damit die PNGs reproduzierbar bleiben. `rsvg-convert` und ImageMagick liegen zwar auf dem Mac, sind aber globale Installationen.
3. **Splash als runde Scheibe auf Creme.** Das Logo ist hell auf Petrol und verschwände auf dem cremefarbenen Splash-Hintergrund. Die Scheibe entspricht dem runden Launcher-Icon und füllt genau den Kreis, den Android 12+ stehen lässt, dadurch wird nichts abgeschnitten. Der Splash-Hintergrund bleibt `#FBF7F0`, wie die App dahinter.
4. **Töne des Hintergrunds: Ring und Spirale `#E8EDE5` (8 % Petrol), Sonne `#FAEAD3` (16 % Bernstein)**, als `decorMark` und `decorSun` in den Tokens. Kräftigere Töne (bis 16 % Petrol) waren im Raster besser zu erkennen, aber Text liegt auf der Seite direkt über dem Hintergrund, darunter Stimmungsfarben (Verlauf, Rückblick). Petrol-Text braucht auf dem Ring mindestens 4,5:1; das lässt höchstens etwa 8 % zu. Der Kontrasttest prüft jetzt jede Textfarbe, die auf dem Seitenhintergrund steht, und alle Stimmungsfarben auch über beiden Deko-Tönen, dazu Text auf jeder durchscheinenden Kartenfarbe über jedem möglichen Untergrund, und dass der Hintergrund blass, aber nicht unsichtbar bleibt (Kontrast zur Seite zwischen 1,05 und 1,2).
5. **Lage: unten rechts, übergroß.** Seitenlänge des SVG 1,7-fache Bildschirmbreite (mindestens 560), Mittelpunkt bei 78 % der Breite und 0,3 Seitenlängen über dem unteren Rand. Sichtbar ist vor allem die linke obere Hälfte mit Spirale und Sonne. Wie in Zyklus bezieht sich der untere Rand auf die Seite, in den Tabs also auf die Oberkante der Tab-Leiste.
6. **Ring und Spirale in einem Ton**, wie im Logo selbst. Eine hellere Spirale (Zyklus hat zwei Töne) war neben dem Ring kaum noch zu sehen.
7. **Sperrbildschirm zeigt das Logo statt des Schlosses.** Der Knopf "Entsperren" sagt, was los ist; das Logo verrät nichts über den Inhalt.
8. **Benachrichtigungssymbol und -farbe aus dem Logo.** Ohne eigenes Symbol zeigt Android das Launcher-Icon als Silhouette. Die Farbe folgt dem Logo (Petrol) statt dem Bernstein-Akzent der Oberfläche.
9. **Undurchsichtig bleiben**: die festen Monatsköpfe in Kalender und Verlauf (Zeilen laufen darunter durch), die Zeilen der Sortierliste (die gezogene Zeile muss die anderen verdecken), Auswahl- und Symbol-Blätter, die Tab-Leiste und Eingabefelder. Ein Monatskopf schneidet beim Scrollen einen Streifen aus dem Hintergrund; bei diesen Tönen fällt das kaum auf.
10. **Kein Dark Mode**, die App bleibt bei einer hellen Palette; der Hintergrund hat nur helle Töne.

## Offene Punkte

**Nur auf dem Gerät zu sehen:**

- Wie blass der Hintergrund auf dem echten Display wirkt (Helligkeit, OLED). Bei Bedarf `decorMark` dunkler, dann aber Kontrasttest beachten: Petrol-Text fällt ab etwa 9 % unter 4,5:1.
- Themed Icon (Android 13+, Monochrom-Ebene), rundes und eckiges Launcher-Icon, Splash beim Kaltstart (erst im Release-Build echt, laut Expo-Doku zeigen Dev-Builds ihn nicht richtig).
- Benachrichtigungssymbol der Erinnerung in der Statusleiste: zwölf Stundenpunkte sind bei 24 dp sehr klein.
- Wie der Hintergrund hinter dem modalen Editor und hinter dem Sperrbildschirm aussieht, und ob die Tab-Leiste die Spirale an einer ungünstigen Stelle abschneidet.
- Karten mit Einblendanimation (Heute, Editor) sind jetzt durchscheinend; einmal auf Flackern achten.

**Sonst:**

- Version und `versionCode` heben, APK bauen und ausliefern: `/apk-release` (der Eintrag 1.0.3 in der Updatehistorie ist schon da, bis dahin steht er in der App über der hervorgehobenen 1.0.2).
- Alle offenen Punkte aus `phase-5-pruefung.md` gelten weiter.
