# Phase 3: Analysen und Auswertungen (Handover)

## Status

Abgeschlossen am 2026-09-26, nicht interaktiv. Verifiziert:

- `npm run typecheck` sauber (Typed Routes neu erzeugt mit `npx expo customize tsconfig.json`, neue Routen `/activity/[id]` und `/mood/[level]`).
- `npm test`: 229 Tests grün in 31 Suites, darunter drei Suites bzw. Fälle gegen den echten Export unter `private/` (laufen nur, wenn die Datei existiert). Sechs Läufe hintereinander und drei parallele Läufe ohne Cache waren alle grün.
- `npx expo export --platform android` bündelt.
- `npx expo-doctor` nicht gelaufen: keine Abhängigkeit hat sich geändert.

Stichproben gegen die CSV: Ein eigenes Python-Skript (außerhalb des Repos, liest nur `private/`) hat Zahlen direkt aus der Datei gerechnet, unabhängig vom App-Code. `private/__tests__/insights.test.ts` vergleicht sie mit den Einblicken, alle stimmen auf vier Stellen:

Kennzahlen: Gesamtmittel, Mittel je Wochentag, Aktivitäten mit und ohne, Schlaf am Vortag, Monatsmittel und längste Folge ab "Gut". Die Zahlen selbst sind in der öffentlichen Fassung entfernt, weil sie aus dem privaten Tagebuch stammen. Alle stimmten zwischen Skript und Einblicken überein.

Außerdem liefen alle Karten gegen die echten Daten (höherer und niedrigerer Schnitt, Folgetag, oft zusammen, vor schwierigen Tagen, Schwankung, Zeitraumvergleich, Detailseite je Stimmung, Wörter, Umfang) und zeigten jeweils plausible Ergebnisse.

**Nicht geprüft:** alles auf dem Gerät (keine Geräte in der Umgebung). Siehe "Offene Punkte".

## Was existiert

| Pfad | Zweck |
| --- | --- |
| `lib/insights/days.ts` | `InsightDay` (Datum, Mittel, gerundete Stufe, Zahl der Einträge, Aktivitäten als Set), `buildDays`, `byDate`, `dayTexts`. Eingabe `EntryFacts`, `EntryDetails` passt direkt. |
| `lib/insights/stats.ts` | `mean`, `median`, `standardDeviation` (Population), `shrinkFactor(n, k) = n / (n + k)`, `SHRINK_K = 10`. |
| `lib/insights/range.ts` | `INSIGHT_RANGES` (30, 90, 365, all), `rangeWindow`, `previousWindow`, `daysIn`, `windowLength`. |
| `lib/insights/mood.ts` | `moodSeries` (Tagesmittel und gleitendes 7-Tage-Mittel), `moodDistribution` (mit vorigem Zeitraum), `monthMeans`, `overallMean`. |
| `lib/insights/weekdays.ts` | `weekdayProfile` (Mittel, Anzahl, Differenz, geschrumpfter Effekt je Wochentag), `orderWeekdays`. |
| `lib/insights/swings.ts` | `weeklySwings` (Streuung je Woche, ruhigste und unruhigste), `goodStreaks` (längste und aktuelle Folge ab "Gut"), `weekStart`. |
| `lib/insights/pixels.ts` | `yearPixels`, `pixelYears`. |
| `lib/insights/effects.ts` | `activityEffects(days, { lag, k, minSide })`, `splitEffects`, `effectMap`. Kern für Phase 4. |
| `lib/insights/activities.ts` | `activityCounts` (mit vorigem Zeitraum), `activityPairs` (Lift), `groupRows` (Gruppenblick). |
| `lib/insights/beforeHard.ts` | `beforeHardDays`: Aktivitäten in den zwei Tagen vor Tagen mit Stufe 2 oder darunter. |
| `lib/insights/words.ts`, `stopwords.ts` | `words` (Tokenisierung, gefaltet, Stoppwörter), `noteWords` (gute gegen übrige Tage). |
| `lib/insights/coverage.ts` | Einträge, Tage, Abdeckung, übliche Uhrzeit, Einträge je Stunde. |
| `lib/insights/detail.ts` | `activityDetail` (Tage, Stimmung mit und ohne, Wochentage, Begleiter, Monate), `levelDetail` (typische und seltene Aktivitäten je Stufe). |
| `lib/insights/format.ts` | Deutsche Zahlen: `formatDecimal`, `formatSigned`, `formatPercent`, `formatRatio`. |
| `lib/insights/overview.ts` | `buildInsights({ entries, range, today, firstDayOfWeek })`: alles, was der Tab zeigt, rein. |
| `lib/insights/useInsights.ts` | Brücke: `readInsightEntries`, `readInsightDays` (je Datenstand gecacht), `useInsights`, `useActivityDetail`, `useLevelDetail`. |
| `lib/insights/index.ts` | Öffentliche Schnittstelle. |
| `lib/insights/__tests__/` | `days`, `mood`, `effects`, `words`, `detail`, `overview` (leere DB, Beispieldaten) gegen kleine, von Hand nachgerechnete Fixtures (`fixtures.ts`); `private.test.ts` gegen den echten Export. |
| `app/(tabs)/insights.tsx` | Einblicke: Zeitraum oben angeheftet, Kacheln Schnitt und Abdeckung, drei Gruppen Stimmung, Aktivitäten, Notizen. |
| `app/activity/[id].tsx` | Detailseite je Aktivität (ganzes Tagebuch). Erreichbar aus jeder Aktivitätszeile der Einblicke, aus Begleitern, aus der Stimmungsseite und aus der Verwaltung ("Einblicke"). |
| `app/mood/[level].tsx` | Detailseite je Stimmungsstufe. Erreichbar aus "Verteilung" und aus der Verwaltung der Stimmung. |
| `components/insights/` | `InsightCard`, `ActivityLine`, `StatTile` (aus Zyklus), `MoodLineChart` (SVG), `DistributionCard`, `PixelsCard` (SVG), `WeekdayCard`, `MonthCard` (gifted-charts, Muster aus Zyklus `Chart.tsx`), `SwingsCard`, `StreakCard`, `FrequencyCard`, `EffectsCard`, `PairsCard`, `BeforeHardCard`, `GroupCard`, `WordsCard`, `CoverageCard`, `LevelBar`, `MiniBars`, `DayList`, `names.ts`. |
| `components/insights/__tests__/screens.test.tsx` | Rendert Einblicke und beide Detailseiten mit leerer DB, Beispieldaten und echtem Export in allen Zeiträumen; schlägt an bei "NaN", "undefined" oder fehlendem Textschlüssel. |
| `lib/catalog/catalog.ts` | `activityLabel`: Name plus Gruppe, wenn der Name mehrdeutig ist ("Schlecht (Schlaf)"). |
| `lib/dates/index.ts` | `formatMonthShort`, `formatMonthLong`, `formatMonthNarrow`; `formatRange` schreibt "bis" statt Strich. |
| `app/more/activity/[id].tsx`, `app/more/mood/[id].tsx` | Knopf "Einblicke" zur Detailseite. |
| `package.json` | `jest.testTimeout` 15000 (Entscheidung 20). |

## Entscheidungen

1. **Die Einheit jeder Auswertung ist der Tag, nicht der Eintrag.** Ein Tag zählt einmal, mit dem Mittel seiner Stufen (wie der Kalender) und der Vereinigung der Aktivitäten aller Einträge. Sonst hätte ein Tag mit drei Einträgen dreifaches Gewicht in "mit und ohne". Verteilung, Pixel, Serien und "schwierig" arbeiten mit der gerundeten Stufe (Regel aus Phase 2), alle Mittelwerte mit dem ungerundeten Tagesmittel.
2. **Zeiträume enden heute und zählen heute mit** (30 Tage = heute und 29 davor), "Alles" beginnt beim ersten Eintrag. Standard beim Öffnen ist 90 Tage: lang genug für "mit und ohne", kurz genug, um aktuell zu sein. Der Zeitraum gilt für die Sitzung, nicht dauerhaft.
3. **Vergleich mit dem Zeitraum davor nur, wenn das Tagebuch ihn ganz abdeckt** (erster Eintrag am oder vor dem Beginn des vorigen Zeitraums), sonst ohne Vergleich. Ein halb gefüllter Vorzeitraum hätte einen Trend gezeigt, der nur der Anfang des Tagebuchs ist. Für "Alles" gibt es nie einen Vergleich, für "Jahr" bei den echten Daten auch nicht.
4. **Schrumpfung mit `k = 10` auf die kleinere Seite.** `effect = (mit − ohne) · n / (n + 10)` mit `n = min(Tage mit, Tage ohne)`. Die kleinere Seite begrenzt die Sicherheit: Eine Aktivität an fast allen Tagen hat nur wenige Tage "ohne" und wird entsprechend gezogen. Eine Aktivität mit 6 Tagen behält 38 % ihrer Differenz und landet hinter einer mit großer Differenz auf breiter Basis. Angezeigt werden die rohen Mittel und die Anzahl (nachrechenbar), sortiert und gefiltert wird nach dem geschrumpften Wert. Dasselbe `k` für Wochentage.
5. **Mindestmengen** (Konstanten neben den Funktionen): `MIN_SIDE_DAYS = 5` je Seite für "mit und ohne" (Spezifikation); `MIN_SHOWN_EFFECT = 0,1` Stufen geschrumpft, darunter weder "höher" noch "niedriger" (ein Zehntel Stufe ist bei einer typischen Streuung um eine halbe Stufe je Woche die Grenze, ab der ein Unterschied sichtbar ist); `MIN_PAIR_DAYS = 5` und Lift ab 1,2 (Spezifikation, plus Schwelle gegen Paare, die nur zufällig oft zusammen sind); `MIN_WEEK_DAYS = 4` für die Schwankung einer Woche; `MIN_HARD_DAYS = 3`, `MIN_BEFORE_HARD = 3`, Verhältnis ab 1,25 und `BEFORE_HARD_K = 5` (schwierige Tage sind selten, `k = 10` hätte jedes Ergebnis verschluckt); `MIN_WORD_DAYS = 3` (Spezifikation) und Verhältnis ab 1,5; `MIN_GROUP_ROW_DAYS = 3` für ein Mittel im Gruppenblick; Detailseite: 3 Tage für "häufiger", 5 andere Tage für "seltener", Verhältnis ab 1,25 bzw. bis 0,8.
6. **Überschriften "Höherer Schnitt" und "Niedrigerer Schnitt" statt "hebt" und "drückt".** Die Spezifikation nennt beides: "hebt/drückt" und "Zusammenhänge, keine Ursachen". "Hebt" behauptet eine Ursache; die Sätze bleiben beim Muster "An Tagen mit Sport im Schnitt 4,2 statt 3,8 (24 Tage)". Die Karte heißt "Stimmung mit und ohne".
7. **Am Folgetag** zählt nur Paare aus zwei aufeinanderfolgenden Tagen mit Eintrag; Aktivität vom ersten, Stimmung vom zweiten. Die Anzahl im Satz ist die Zahl der Paare mit der Aktivität.
8. **Vor schwierigen Tagen:** schwierig heißt gerundete Stufe 2 oder darunter. Bezugsmenge sind alle Tage mit mindestens einem Eintrag in den zwei Tagen davor; eine Aktivität zählt je Tag einmal, auch wenn sie an beiden Vortagen vorkam. Gezeigt: Anteil vor schwierigen Tagen gegen Anteil vor allen Tagen. Die Rechnung sieht nur die Tage im Zeitraum, am Anfang des Zeitraums fehlen also Vortage; ebenso bei "Am Folgetag". Einfacher und ohne Wirkung auf 90 Tage und mehr.
9. **Wörter vergleichen Tage ab "Gut" mit allen übrigen**, nicht mit Tagen ab Stufe 2 abwärts. Bei den echten Daten gibt es nur wenige solche Tage; kaum ein Wort erreicht dort 3 Tage. Die Überschrift nennt die Grenze ("Häufiger an Tagen ab Gut", "Häufiger an den übrigen Tagen"). Gezählt wird in Tagen, nicht Vorkommen; Verhältnis mit Plus-eins-Glättung. Wörter werden gefaltet verglichen und in ihrer häufigsten Schreibweise gezeigt. Wortzeichen sind lateinische Buchstaben mit Umlauten und Akzenten (ohne `\p{L}`, damit es sicher auf Hermes läuft). Die Stoppwortliste ist eine eigene, rund 280 Wörter, inklusive Tagebuchfüllwörtern (heute, abends, eigentlich).
10. **Schwankung ist die Populations-Standardabweichung** der Tagesmittel einer Woche; die Einblicke beschreiben, sie schätzen nichts. Wochen beginnen mit dem ersten Wochentag aus den Einstellungen. Die typische Schwankung ist der Median über alle Wochen. Bei wenigen Wochen teilen sich "ruhigste" und "unruhigste" die Wochen, keine erscheint doppelt; Gleichstände gehen an die neuere Woche.
11. **Serien:** Folge aufeinanderfolgender Tage mit gerundeter Stufe ab 4. Eine Lücke beendet eine Folge, mehr nicht. Die aktuelle Folge läuft weiter, solange heute noch kein Eintrag da ist (endet sie gestern, zählt sie noch). Die längste Folge gilt im Zeitraum, die aktuelle über das ganze Tagebuch. Keine Flammen, keine Belohnung, kein Hinweis auf Lücken.
12. **Verteilung zählt Tage je gerundeter Stufe**, nicht Einträge je Stimmung. Eigene Stimmungen hängen an einer Stufe (Phase 1) und fallen dort hinein; die Zeile trägt den Namen der Stufe (`levelMood`).
13. **Jahr in Pixeln ignoriert den Zeitraum.** Ein Jahr ist der Sinn der Karte; Jahre mit Einträgen sind Chips, Standard ist das neueste. Zwölf Zeilen zu 31 Kästchen, Monate als Buchstaben. Antippen öffnet den Tag auf Heute wie im Kalender. Die Kästchen sind rund 10 Punkte groß und damit kleiner als 44; die Karte ist eine Übersicht, der Kalender bleibt der barrierefreie Weg zu jedem Tag. Screenreader hören je Monat die Zahl der Tage je Stimmung. Eine Legende mit Namen steht darunter.
14. **Verlauf als eigenes SVG statt gifted-charts:** ein Jahr hat 365 Punkte; eine Pfadlinie je Stufe ist billig, wo die Bibliothek eine Komponente je Punkt zeichnet. Punkte in der Stimmungsfarbe, Linie in Textfarbe, links die Stimmungssymbole als Achse (Bedeutung nie nur über Farbe). Die Linie bricht bei Lücken über 7 Tage. Das gleitende Mittel schaut über den Zeitraumbeginn zurück, damit die Linie nicht mit einem Sprung beginnt. **Monate** nutzen `BarChart` aus gifted-charts mit dem Achsen-Muster aus Zyklus (`yAxisOffset`), Balken in der Farbe des gerundeten Mittels.
15. **Wochentage als Balken um den Gesamtschnitt**, nicht von 1 bis 5. Die Unterschiede sind Zehntel und wären auf voller Skala unsichtbar; die Zahlen stehen daneben, die Skala reicht mindestens ±0,5, damit kleine Unterschiede nicht dramatisch wirken.
16. **Detailseiten rechnen über das ganze Tagebuch**, nicht im gewählten Zeitraum: sie sind aus mehreren Stellen erreichbar (Verwaltung, Begleiter), dort gibt es keinen Zeitraum. Die Aktivitätsseite zeigt die Tagesliste zuerst mit 10 Tagen und "Alle zeigen"; Antippen öffnet den Tag auf Heute. Die Stimmungsseite ist je Stufe (`/mood/[level]`), nicht je Stimmung, passend zu Entscheidung 12.
17. **Mehrdeutige Aktivitätsnamen bekommen die Gruppe** (`activityLabel`): "Schlecht (Schlaf)", "Gut (Schlaf)". Außerhalb ihrer Gruppe wären sie mit den Stimmungen gleichen Namens verwechselbar. Gleiches gilt für zwei Aktivitäten gleichen Namens in verschiedenen Gruppen.
18. **Paare** öffnen beim Antippen die Seite der ersten Aktivität; die Seite zeigt die zweite unter "Begleiter".
19. **Datumsbereiche mit "bis"** statt Strich (`formatRange`), wegen der Schreibregel ohne Gedankenstriche. Die Funktion war bisher unbenutzt.
20. **Flakiger Testlauf aus Phase 2:** In dieser Phase nicht aufgetreten, auch nicht bei drei parallelen Läufen ohne Cache. Kein Test hängt von der Uhrzeit ab (`today` ist überall fest, `useToday` im Render-Test gemockt). Die langsamsten Fälle (CSV-Rundreise gegen den echten Export, 1,3 s) liegen bei Last nah genug an Jests Standardgrenze von 5 s, dass ein einzelner roter Lauf durch Zeitüberschreitung die wahrscheinlichste Erklärung ist. Deshalb `testTimeout` 15000 in `package.json`. Das ist eine Vorsorge, keine nachgewiesene Ursache.
21. **Render-Test mit Mocks:** reanimated, worklets, safe-area, Icons, expo-router und gifted-charts sind im Test gemockt, `getDb` zeigt auf eine better-sqlite3-Datenbank. Geprüft wird, dass jede Karte ohne Absturz, NaN oder fehlenden Text rendert; Aussehen und Diagramme nur auf dem Gerät.

## Schnittstellen für Phase 4 (Ausblick)

`lib/outlook/` soll diese Funktionen direkt verwenden, nicht nachbauen, damit Einblicke und Ausblick dieselben Zahlen nennen:

- **Tage:** `buildDays(entries)` liefert `InsightDay[]` (älteste zuerst). Für den Backtest einfach `days.filter((d) => d.date <= stichtag)` übergeben; keine Funktion schaut auf "heute" oder in die Zukunft. In Hooks `readInsightDays()` (je Datenstand gecacht) nehmen.
- **Wochentag:** `weekdayProfile(days, k?).weekdays[weekdayOf(tag)].effect` ist die geschrumpfte Abweichung vom Gesamtmittel, `overall` das Gesamtmittel (ungewichtet; das exponentiell gewichtete Langzeitmittel baut Phase 4 selbst).
- **Aktivitäten:** `effectMap(activityEffects(days))` gibt je Aktivität `effect` (geschrumpfte Differenz), `withDays`, `withoutDays`, `withMean`, `withoutMean`. Für Aktivitäten unter der Mindestmenge fehlt der Eintrag, der Ausblick nimmt dann 0. `activityEffects(days, { lag: 1 })` liefert die Wirkung auf den Folgetag, falls der Ausblick sie braucht. `minSide` und `k` sind einstellbar.
- **Hilfen:** `shrinkFactor`, `SHRINK_K`, `mean`, `median`, `standardDeviation` aus `lib/insights/stats.ts`; `formatDecimal`, `formatSigned` für Texte.
- Die Summe mehrerer Aktivitätseffekte ist nicht unabhängig (manche Aktivitäten kommen deutlich öfter zusammen vor als zufällig); Phase 4 sollte das beim Addieren bedenken, etwa über den Backtest.

## Offene Punkte für spätere Phasen

- **Geräteprüfung ausstehend** (dazu die offenen aus Phase 1 und 2):
  - Einblicke mit dem echten Export: Zeitraum wechseln (fühlt sich die Neuberechnung flüssig an? 270 Tage kosten im Test rund 0,15 s für alle Zeiträume), Verlauf und Pixel sehen und lesen, Pixel antippen öffnet den Tag auf Heute, Wochentagsbalken, Monatsbalken von gifted-charts (Achsenbeschriftung, Abschneiden wie in Zyklus verhindert).
  - Aktivitätszeilen und Verteilungszeilen öffnen die Detailseiten; "Einblicke" in der Verwaltung; zurück aus der Detailseite.
  - Große Systemschrift: Wochentagszeilen haben feste Spaltenbreiten (28 und 40 Punkte), Pixel-Monatsbuchstaben passen sich der Kästchengröße an.
  - Screenreader: Karten, Pixel-Zusammenfassung, Balken.
  - Leistung auf dem Gerät bei "Alles" mit mehreren Jahren (Pixel sind 365 SVG-Rechtecke je Jahr, Verlauf ein Pfad je Stufe).
- Die Pixel-Kästchen sind kleiner als 44 Punkte (Entscheidung 13).
- Wörter kennen nur lateinische Buchstaben und eine feste deutsche Stoppwortliste; eigene Stoppwörter gibt es nicht.
- Skalen (Energie usw.) fließen noch in keine Auswertung ein. Kandidat: Skala als zweite Linie im Verlauf oder "mit und ohne" für Skalenwerte.
- "Vor schwierigen Tagen" und "Am Folgetag" verlieren am Anfang des Zeitraums die Vortage bzw. den ersten Folgetag (Entscheidung 8).
- Der gewählte Zeitraum wird nicht gespeichert (Entscheidung 2).
- Aus Phase 1 und 2 weiter offen: "Urlaub" doppelt (Frage an Paul), Skalenformat unverifiziert, geparste Datei bleibt nach abgebrochener Vorschau im Store, Ersetzen zeigt in der Vorschau die Zahlen des Zusammenführens, Umlaut-Umschreibungen in der Suche.
