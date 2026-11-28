# Auswertung: üblicher Bereich und geprüfte Zusammenhänge (Handover)

## Status

Umgesetzt am 2026-11-27 auf dem Branch `feature/auswertung-zusammenhaenge`, nicht committet, keine Version gehoben, keine Updatehistorie, das macht `/deploy`.

| Prüfung | Ergebnis |
| --- | --- |
| `npm run typecheck` | sauber |
| `npm test` | 98 Suites, 1075 Tests grün. Neu: `lib/insights/__tests__/usual.test.ts`, `links.test.ts`, `linksParity.test.ts`, `useLinks.test.tsx`, `db/__tests__/describesMoodMigration.test.ts`, `components/manage/__tests__/describesMood.test.tsx`; ergänzt: `overview.test.ts`, `screens.test.tsx` (Einblicke), `roundtrip.test.ts`, `catalog.test.ts`, `modes.test.ts` |
| Gleichheit mit den Vorlagen | 36 von 36 Tagebüchern: Stufe, Richtung und üblicher Bereich exakt, `t`, `tmin` und `q` auf 1e-6 |
| Auf dem Gerät | noch nicht, siehe Offene Punkte |

## Ziel

1. Der Verlauf soll auch Menschen etwas zeigen, die an 70 bis 85 % der Tage dieselbe Stufe wählen. Die fünf Stimmungsstufen bleiben.
2. Die App nennt Faktoren, die mit besseren oder schlechteren Tagen zusammengehen, und behauptet dabei möglichst wenig Falsches.
3. Alles läuft auf dem Gerät, ohne Wissen über die Bedeutung von Namen.

## Was existiert

| Datei | Inhalt |
| --- | --- |
| `lib/insights/usual.ts` | Üblicher Bereich je Tag (`usualRanges`), Lage eines Tages dazu (`usualPosition`), Monate mit Schnitt und Tagen darunter, darin und darüber (`usualView`) |
| `lib/insights/links.ts` | Reine Rechnung der Zusammenhänge als Generator (`linkSteps`), eigenes `erfc`, Aufbau der Zeilen und Spalten aus Tagen, Skalen und Health-Zeilen (`linkRows`), zwei Läufe mit Markierung (`linksSteps`, `buildLinks`), Signatur (`linksSignature`) |
| `lib/insights/useLinks.ts` | Brücke: rechnet außerhalb des Renderns in Scheiben von 12 ms, einmal je Signatur, nur solange der Abschnitt „Aktivitäten“ offen ist |
| `lib/insights/overview.ts` | `Insights.months` trägt jetzt die Zählung zum üblichen Bereich, neu `Insights.usual`. `nextDay` ist entfallen, `effects` bleibt (siehe Abweichungen) |
| `components/insights/MonthCard.tsx` | Je Monat eine Zeile, neuester oben: Schnitt als Zahl, Balken und Zählung der Tage darunter und darüber. Darüber der Bereich am Ende des Zeitraums |
| `components/insights/LinksCard.tsx` | Karte „Stabile Zusammenhänge“, ersetzt die beiden Karten „Stimmung mit und ohne“ und „Am Folgetag“ (`EffectsCard.tsx` ist gelöscht) |
| `db/schema.ts`, `drizzle/0021_third_boomer.sql` | Neue Spalte `describes_mood` an `activity_groups` und `scales`, Standard aus. Das angehängte `UPDATE` markiert die Gefühle-Gruppe |
| `lib/catalog/catalog.ts` | Namensregel (`describesMoodByName`, `feelingsGroupNames`, definiert bei den Standardnamen der Gruppen), `Catalog.groupById`, `activityDescribesMood` |
| `db/repositories/defaults.ts`, `groups.ts`, `scales.ts` | `ensureDefaults` markiert die Gefühle-Gruppe, die Patch-Typen kennen das Feld |
| `lib/export/schema.ts` | `describes_mood` an Gruppen und Skalen, optional beim Einlesen |
| `app/more/group/[id].tsx`, `app/more/scale/[id].tsx` | Schalter „Beschreibt die Stimmung“ mit erklärendem Satz |
| `lib/insights/__tests__/diaries/`, `expected/`, `diaries.ts` | 36 erzeugte Tagebücher mit ihrer Wahrheit, die Ergebnisse der beiden Vorlagen dazu, und der Adapter vom Tagebuchformat auf die App |
| `lib/i18n/locales/*.json` | Neue Texte in allen zehn Sprachen, fünf Texte der entfallenen Karten entfernt |

## Entscheidungen

### Üblicher Bereich

1. **Regel:** die mittlere Stufe der letzten 365 Kalendertage, erweitert zur häufigeren Nachbarstufe, bis mindestens die Hälfte der Tage darin liegt. Die mittlere Stufe ist die niedrigste, deren aufsummierter Anteil 50 % erreicht, nicht der Lehrbuch-Median. Bei gleich häufigen Nachbarn geht es nach unten, wenn der Schnitt der Stufen unter der Mitte des Bereichs liegt, sonst nach oben.
2. **Trägheit:** Der Bereich bleibt, solange der Bereich für 45 % in ihm liegt und er im Bereich für 55 % liegt. Sonst wechselt er sofort auf den Bereich für 50 %.
3. **Bezugsfenster:** die letzten 365 Kalendertage. Für die ersten 28 Tage mit Eintrag gelten diese 28 (auch die späteren darunter). Liegen in den letzten 365 Tagen weniger als 28 Tage mit Eintrag, zählen die letzten 28 Tage mit Eintrag, egal wie alt.
4. **Ab 14 Tagen mit Eintrag.** Darunter zeigt die Monatskarte nur den Schnitt und sagt, ab wann der Bereich erscheint.
5. **Immer über das ganze Tagebuch gerechnet**, dann auf den Zeitraum zugeschnitten: Der Bereich eines Tages hängt vom Tag davor ab.
6. **Verglichen wird die gerundete Tagesstufe** (`InsightDay.level`), an dem Bereich, der an diesem Tag galt.
7. **Nicht übernommen** aus der Vorlage: Prozentrang, `z`, Markierung auffälliger Monate.

### Zusammenhänge

1. **Verfahren:** Stimmung und jeder Faktor werden zu Abweichungen vom eigenen langsamen Niveau (Wochentag, Dreiecksmittel über 10 Kalendertage zu jeder Seite, wieder Wochentag). Jeder Faktor wird allein und zusammen mit den direkt mit ihm verbundenen Faktoren getestet, es zählt der schwächere der beiden Werte, bei Vorzeichenwechsel nichts. Alle Tests eines Tagebuchs teilen sich ein Fehlerbudget (Bonferroni über beide Abstände). „Stabil“ bis 10 %, „Hinweis“ bis 50 %.
2. **Eingang:** alle Tage mit Eintrag der letzten 730 Kalendertage bis heute, unabhängig vom gewählten Zeitraum. Für längere Tagebücher gibt es keine Messung.
3. **Faktoren:** jede Aktivität, jede Skala (Wert über `scaleDayValue`), dazu Schlafdauer und Schritte. Archivierte zählen mit. Die Schritte von heute zählen nicht, Health-Zeilen von Tagen ohne Eintrag auch nicht. Eine Dauer von null Minuten ist ein fehlender Wert.
4. **Zwei Läufe mit Markierung:** Lauf 1 nur über die unmarkierten Faktoren, daraus die Listen „Stabiler Zusammenhang“ und „Hinweis“. Lauf 2 über alle Faktoren, daraus nur die markierten für „Beschreibt die Stimmung“. Ohne Markierung entfällt Lauf 2.
5. **Keine Liste „in Beobachtung“**, keine Stärke in der Zeile, keine Ursachenaussage. Eine Zeile nennt Name, Richtung und die Zahl der Tage mit der Aktivität oder mit einem Wert.
6. **Rechenzeit:** außerhalb des Renderns, zwischengespeichert je Signatur (Datum, Stimmung, Aktivitäten, Skalenwerte, Schlaf und Schritte der Tage mit Eintrag, heute, Markierungen). Die Rechnung gibt nach jedem Faktor, jeder Matrixzeile und jeder geprüften Spalte ab. Gemessen in Node auf dem Entwicklungsrechner: das größte Testtagebuch (435 Tage, 73 Faktoren) braucht rund 100 ms ohne und rund 190 ms mit Markierung, alle anderen unter 60 ms.
7. **`erfc`** gibt es in JavaScript nicht. Unter 3 rechnet die Reihe von `erf` mit nur positiven Gliedern, ab 3 der Kettenbruch. Gegen Pythons `math.erfc` liegt der relative Fehler unter 1e-10.

### Markierung „beschreibt die Stimmung“

1. **Feld an Gruppen und Skalen**, eine Aktivität erbt die Markierung ihrer Gruppe, auch einer archivierten.
2. **Voreinstellung an für die mitgelieferte Gruppe „Gefühle“:** bei Neuinstallation, nach „alle Daten löschen“ und beim CSV-Import im Modus Ersetzen, jeweils über `ensureDefaults`.
3. **Migration:** markiert jede Gruppe, deren Name exakt einem Namen der Gefühle-Gruppe in einer der zehn Sprachen entspricht. Umbenannte Gruppen und andere Schreibweisen bleiben unmarkiert. Ein Test hält die Namen im SQL und in `GROUP_NAMES.feelings` gleich.
4. **Sicherung:** Das Feld wird mitgeschrieben, `EXPORT_SCHEMA_VERSION` bleibt 2. Fehlt es beim Einlesen, gilt für Gruppen dieselbe Namensregel wie in der Migration, Skalen bleiben unmarkiert. Beim Zusammenführen behalten vorhandene Gruppen und Skalen ihre Markierung, neue übernehmen die der Sicherung. Eine ältere App-Version liest eine neue Sicherung weiter, ihr Schema verwirft das Feld.

### Oberfläche

1. **Monatskarte** als Liste statt Balkendiagramm, neuester Monat oben, sechs Monate und „Alle zeigen“. Der Monatsschnitt bleibt als Zahl.
2. **Karte „Stabile Zusammenhänge“** im Abschnitt Aktivitäten: je Abstand („Am selben Tag“, „Am Folgetag“) die Listen „Stabiler Zusammenhang“ und „Hinweis“, darunter getrennt „Beschreibt die Stimmung“ mit vier Zeilen und „Alle zeigen“. Aktivitäten öffnen ihre Detailseite, Skalen, Schlaf und Schritte sind reine Zeilen.
3. **Leere Zustände:** unter 30 Tagen mit Eintrag, „noch kein Zusammenhang gefunden“, und „Wird berechnet“ bis zum ersten Ergebnis.
4. **Sprache:** „geht mit besseren Tagen einher“, bei Skalen und Körperwerten „höhere Werte gehen mit …“. Ein Satz erklärt die zwei Stufen und dass ein Zusammenhang keine Ursache ist.

## Messung

Stabile Treffer gegen die Wahrheit der Testtagebücher, gezählt wie im Harness (echt: echter Effekt mit richtiger Richtung; falsch: Scheinzusammenhang, Rauschen oder falsche Richtung; beschreibende Faktoren und echte Effekte am anderen Abstand zählen nicht). Vor dem Festschreiben in `links.test.ts` mit der Python-Vorlage nachgemessen, die Portierung trifft dieselben Zahlen.

| Lauf | Entwicklungssatz | Zurückgehaltener Satz |
| --- | --- | --- |
| ohne Markierung | 32 echt, 4 falsch | 31 echt, 2 falsch |
| Gruppe „Feelings“ markiert | 32 echt, 5 falsch | 32 echt, 2 falsch |

Die sechs Tagebücher ohne Wirkung haben in keinem Lauf einen stabilen Treffer.

## Abweichungen vom Plan

- **`Insights.effects` bleibt bestehen**, nur `nextDay` ist entfallen. Eine lokale Prüfung außerhalb des Repos liest das Feld noch, und ohne es schlägt `npm run typecheck` fehl. Keine Karte der Seite zeigt es mehr. Es kann weg, sobald diese Prüfung angepasst ist.
- **`lib/dev/generateSample.ts` ist unverändert.** Die Beispieldaten laufen über `ensureDefaults` und bekommen die Markierung der Gefühle-Gruppe von dort, die Beispielskala „Energie“ bleibt unmarkiert.
- **`monthMeans` in `mood.ts` bleibt**, wird aber von der Seite nicht mehr benutzt, `usualView` liefert die Monate.

## Bekannte Schwächen

- Der übliche Bereich wechselt bei breiter Verteilung häufig (71 Wechsel über alle 36 Tagebücher, in einem Tagebuch ohne Wirkung 7 in 188 Tagen) und ist nur auf dem Entwicklungssatz geprüft.
- Für Tagebücher über zwei Jahre gibt es keine Messung der Zusammenhänge, deshalb die Grenze von 730 Tagen.
- Die Güte ist an erzeugten Tagebüchern gemessen, nicht an echten.

## Nicht gebaut

Tiefs und Hochs, Liste „in Beobachtung“, Gruppen-Treffer, Selbstexperimente, Prozentrang-Satz, Markierung auffälliger Monate, Ruhepuls und Training als Faktoren. Der Ausblick (`lib/outlook`), `activityEffects`, die Aktivitätsseite, die Korrelationskarten im Abschnitt „Zusammenhänge“ und die festen Schwellen `GOOD_MIN`, `HARD_MAX`, `HARD_LEVEL`, `STREAK_MIN_LEVEL` sind unverändert.

## Offene Punkte

- **Auf dem Gerät prüfen:** Monatskarte und Zusammenhänge in hell und dunkel, mit langen Namen und großer Schrift, mit TalkBack. Rechenzeit auf dem Handy bei einem langen Tagebuch mit vielen Aktivitäten, und ob die Seite währenddessen flüssig bleibt.
- **Migration auf einem echten Bestand** einmal durchlaufen lassen, auch mit umbenannter Gefühle-Gruppe.
- **`react-native-gifted-charts`** wird nach dem Umbau der Monatskarte von keiner Karte mehr benutzt. Die Abhängigkeit steht noch in `package.json`, der Mock in `screens.test.tsx` ebenfalls.
- **Migrationsnummer:** Die Migration lief zuerst als 0018 auf einem Testgerät und kam beim Zusammenführen mit den Zahl-Skalen hinter deren 0018 bis 0020. Sie heißt jetzt 0021, ihr Zeitstempel im Journal ist der alte geblieben: Er ist jünger als 0020, läuft also überall, wo 0020 die letzte war, und auf dem Testgerät nicht ein zweites Mal. Kommt vor dem Release eine weitere Migration dazu, muss ihr Zeitstempel jünger sein.
- **Übersetzungen** der neuen Texte sind nicht von Muttersprachlern gegengelesen.
