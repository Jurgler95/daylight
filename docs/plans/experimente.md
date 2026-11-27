# Experimente

Stand: 2026-11-27, Status: bereit zum Bau

## Kurzfassung

Man nimmt sich etwas vor und schaut, ob sich die eigenen Einträge dabei unterscheiden: „Ich probiere kein Kaffee nach 14 Uhr ab 1. Dezember für 4 Wochen.“ Schon während des Experiments und danach zeigt Daylight die Zeit davor neben der Zeit im Experiment, für Stimmung, eigene Skalen, Schlaf und Schritte aus Health Connect und Aktivitäten. Die App sagt ehrlich, wenn die Tage nicht reichen oder der Unterschied im Rahmen der üblichen Schwankungen liegt, und behauptet nie eine Ursache oder Wirkung. Anlass: In vier Nutzer-Communities kam dieselbe Frage, „Wirkt mein Medikament?“ bzw. „Wirkt das, was ich geändert habe?“.

## Ausgangslage

- **Wendepunkte** (`lib/turning/`, `app/turning/`, `components/turning/`): Vorher-Nachher-Vergleich um einen Tag. `lib/turning/compare.ts` liefert gleich lange Fenster, Tagesmittel der Stimmung, Verteilung (`moodDistribution`), `activityShifts`, `healthShifts`, Jahreszeiten-Hinweis (`seasonOf`), Mindestens `MIN_SIDE_DAYS = 7` Tage mit Eintrag je Seite. Bildschirm `app/turning/[id].tsx` mit `StatTile`, `MoodLineChart`, `LevelBar`, `ActivityLine`, Gesundheitszeilen. Wendepunkte hängen an einem Tag mit Eintrag, höchstens vier je Jahr, eigene Sonnenaufgang-Seite.
- **Tage als Einheit:** `lib/insights/days.ts` (`InsightDay`: Mittel der Einträge eines Tages, Vereinigung der Aktivitäten, Skalenwerte je Tag). Seit `fb0e5ea` gibt es mehrere Einträge pro Tag (`docs/decisions/mehrere-eintraege-und-erinnerungen.md`), die Auswertungen rechnen weiter je Tag.
- **Skalen:** `lib/insights/scales.ts` (`scaleDayValue`, `compareScales`, `ScaleFacts`). **Gesundheit:** `lib/insights/healthStats.ts` (`HEALTH_METRICS`, `settledValue`), Tabelle `health_days`.
- **Ehrlichkeit als Vorbild:** `lib/outlook/backtest.ts` zeigt den Ausblick nur, wenn er auf den eigenen Daten besser ist als Raten.
- **Sicherung:** `lib/export/` (`schema.ts`, `serialize.ts`, `import.ts`, `merge.ts`). `turning_points` ist dort ein optionales Feld ohne Versionssprung, das ist das Muster.
- **Migrationen:** letzte ist `drizzle/0017_hesitant_morgan_stark.sql`. Erzeugt mit `npm run db:generate`, nie von Hand.
- **Prüfstand vor dem Bau:** `npm run typecheck` sauber, `npx jest`: 84 Suites, 921 Tests grün (2 übersprungen), gemessen am 2026-11-27.

## Entscheidungen

| Nr. | Entscheidung | Begründung | von Paul, Datum |
|---|---|---|---|
| E1 | Eigene Tabelle `experiments`, kein Wendepunkt mit Zusatzfeldern. Die Rechnung wird mit `lib/turning/compare.ts` geteilt, nicht kopiert. | Start in Zukunft oder Vergangenheit, Dauer, vorzeitiges Ende, keine Eintragspflicht und keine Jahresgrenze passen nicht zu Wendepunkten. | Paul, 2026-11-27 |
| E2 | Rauschen wird an der eigenen Schwankung gemessen: Wie oft unterschieden sich in der Vorgeschichte zwei direkt aufeinanderfolgende Zeiträume gleicher Länge mindestens so stark? Nur wenn das selten ist, heißt es „größer als deine üblichen Schwankungen“. Kein t-Test, keine feste Schwelle. | Fängt ab, dass benachbarte Tage sich ähneln und dass die Stimmung je Person verschieden stark schwankt. Gleiche Haltung wie der Backtest des Ausblicks. | Paul, 2026-11-27 |
| E3 | Mehrere Experimente dürfen gleichzeitig laufen. Der Vergleich nennt Überschneidungen. | „Medikament“ und „Abendspaziergang“ sollen nebeneinander gehen, die Vermischung wird offen gesagt statt verboten. | Paul, 2026-11-27 |
| E4 | Optional je Experiment eine tägliche Ja/Nein-Frage „Heute eingehalten?“ (Schalter beim Anlegen, aus als Standard). Gefragt wird im Eintrag-Editor, nicht per Benachrichtigung. | Paul wünscht die Abfrage. Im Editor braucht es keine neue Berechtigung, und Erinnerungstexte dürfen keine Tagebuchinhalte nennen (Grundsatz in `docs/development.md`). | Paul (Idee), Umsetzung als Vorschlag, 2026-11-27 |
| E5 | Keine medizinischen Aussagen, keine Empfehlungen. Nur die eigenen Einträge im Vergleich. Wörter wie „wirkt“, „Effekt“, „verbessert“ kommen in keinem Text vor, nur „Unterschied“, „höher“, „niedriger“, „deine Einträge“. | Sonst rückt die App in Richtung Medizinprodukt. | Paul, 2026-11-27 |
| E6 | Keine neuen Berechtigungen, kein Internet, kein Konto. | Haltung der App. | Paul, 2026-11-27 |
| E7 | Texte in allen zehn Sprachen unter `lib/i18n/locales/`. | Wie überall. | Paul, 2026-11-27 |
| E8 | Experimente wandern in die JSON-Sicherung (Export, Ersetzen, Zusammenführen) als optionale Felder `experiments` und `experiment_days`, ohne Versionssprung. Nicht in die CSV. | Wie `turning_points`. Ältere App-Versionen verwerfen die unbekannten Felder. | Paul, 2026-11-27 |
| E9 | Die Migration ist eine einzige, kleine Datei (nur die zwei neuen Tabellen) in einem eigenen Commit. | Parallel entsteht auf einem anderen Branch die automatische Sicherung mit eigener `0018`. Beim Zusammenführen wird eine der beiden neu erzeugt. | Paul, 2026-11-27 |
| E11 | Urteil für jede Größe: Stimmung, jede Skala, jede Gesundheitsgröße, alle mit derselben Schwelle 0,1. Werden mehrere Größen beurteilt, steht darunter: „Je mehr Werte verglichen werden, desto eher fällt einer zufällig auf.“ Aktivitäten ohne Urteil, nur Anteile. | Paul will alles auswerten können; die Gefahr zufälliger Treffer wird offen gesagt statt weggerechnet. | Paul, 2026-11-27 |
| E12 | Urteilssatz erst, wenn das Experiment vorbei ist. Zahlen und Verlauf (Grafik) sind immer sichtbar, während es läuft mit „Zwischenstand, das Urteil kommt am Ende“. | Tägliches Neurechnen ließe das Urteil zufällig kippen. | Paul, 2026-11-27 |
| E13 | Keine Spalte für die geplante Dauer. „Davor“ ist so lang wie der tatsächliche Zeitraum (`end_date − start_date + 1`). Abbruch nach weniger als 7 Tagen heißt: kein Vergleich, und die Seite sagt das. | Für die Rechnung reicht der tatsächliche Zeitraum. Muss vor der Migration feststehen. | Paul, 2026-11-27 |
| E14 | Zweistufige Mindest-Vorgeschichte: Überdecken die Stichtage mindestens das Vierfache von Davor plus Experiment, gibt es ein normales Urteil; ab dem Zweifachen ein Urteil mit dem Zusatz „vorläufig“; darunter „nicht beurteilbar“. Bei 4 Wochen heißt das etwa 5 Monate Tagebuch vor dem Start für „vorläufig“ und etwa 10 Monate für das volle Urteil. | Benachbarte Stichtage sind keine unabhängigen Fälle; mit wenig Vorgeschichte erscheint „größer als üblich“ öfter zufällig. Die Stufe sagt das offen. | Paul, 2026-11-27 |
| E15 | Eine Nein-Antwort beendet das Experiment, nach Rückfrage. Kein Vergleich Ja-Tage gegen Nein-Tage. | Paul: Nein-Tage brechen das Experiment ab. Der Vergleich nimmt damit nur die eingehaltene Zeit. | Paul, 2026-11-27 |
| E16 | Ersetzen per CSV oder mit einer Sicherung ohne Experimente löscht die vorhandenen Experimente, wie bei den Wendepunkten. Die Import-Vorschau sagt das vorher deutlich („3 Experimente gehen verloren“). | Paul: muss dem Nutzer dargestellt werden. | Paul, 2026-11-27 |
| E10 | Kein Push, kein Pull Request, keine Versionsnummer, keine Updatehistorie. | Das macht später `/deploy`. | Paul, 2026-11-27 |

## Zielbild

### Datenmodell (Migration `0018`)

`experiments`
- `id` integer, Primärschlüssel
- `title` text, Pflicht, getrimmt, 1 bis 60 Zeichen
- `note` text, optional (was genau, warum)
- `start_date` text `YYYY-MM-DD`
- `end_date` text `YYYY-MM-DD`, letzter Tag einschließlich. Beim Anlegen aus Start und Dauer, beim vorzeitigen Beenden überschrieben. Keine Spalte für die geplante Dauer (E13)
- `check_in` boolean, Standard false (E4)
- `result_seen` boolean, Standard false (Karte auf Heute, siehe unten). Beim Anlegen eines Experiments, dessen Ende schon vor heute liegt, gleich true
- `created_at`, `updated_at` über den vorhandenen Helfer `timestamps`

`experiment_days`
- `experiment_id` integer, Fremdschlüssel auf `experiments.id` mit `on delete cascade`
- `date` text
- `kept` boolean
- Primärschlüssel (`experiment_id`, `date`)

Der Zustand wird nie gespeichert, sondern aus dem Datum abgeleitet: **geplant** (heute vor Start), **läuft** (Start bis Ende), **vorbei** (nach Ende).

### Regeln (`lib/experiments/rules.ts`, rein)

- Dauer 7 bis 84 Tage. Auswahl in Wochen: 1, 2, 3, 4, 6, 8, 12 (Standard 4).
- Start von 365 Tagen zurück bis 60 Tage voraus. Ein Start in der Vergangenheit ist gewollt („Ich nehme das Medikament seit zehn Tagen“).
- Vorzeitig beenden: nur während es läuft. `end_date` wird auf gestern gesetzt, am Starttag selbst auf den Starttag. Antworten nach dem neuen Ende werden entfernt. Ein geplantes Experiment wird nicht beendet, sondern gelöscht.
- Bearbeiten: Titel, Notiz, Schalter jederzeit. Start und Dauer nur, solange es geplant ist oder läuft, und das neue Ende darf nicht vor heute liegen (früher enden geht nur über „Jetzt beenden“). Antworten außerhalb des neuen Zeitraums werden beim Speichern entfernt.
- Überschneidung: zwei Experimente überschneiden sich, wenn sich ihre Zeiträume um mindestens einen Tag decken.
- Check-in-Antworten nur für Tage im Zeitraum und nicht nach heute.

### Vergleich (`lib/experiments/compare.ts`, rein)

- **Davor:** so viele Tage wie `end_date − start_date + 1`, direkt vor dem Start, gekürzt auf das, was das Tagebuch hergibt. Nach vorzeitigem Ende also so lang wie die tatsächliche Dauer; wer an Tag 5 abbricht, bekommt ehrlich keinen Vergleich (E13).
- **Im Experiment:** Start bis `min(Ende, heute)`. Während es läuft, heißt das „Zwischenstand nach N von M Tagen“.
- Je Seite mindestens `MIN_SIDE_DAYS` (7) Tage mit Eintrag, sonst nur die Tageszahlen und der Satz, dass es noch nicht reicht.
- Größen: Stimmung (Tagesmittel, Verteilung), jede aktive Skala mit mindestens 7 Werten je Seite, jede Gesundheitsgröße aus `HEALTH_METRICS` mit mindestens `MIN_HEALTH_DAYS` je Seite (`healthShifts` wiederverwenden), Aktivitäten (`activityShifts` wiederverwenden).
- Skalen und Gesundheit bekommen wie die Stimmung ein Rauschurteil je Größe (E11), kurz in ihrer Zeile; Aktivitäten werden nur als Anteile davor und im Experiment gezeigt, ohne Urteil. Tageswert einer Skala über `scaleDayValue`, Gesundheit über `healthShifts` (nutzt `settledValue`).
- **Gemeinsamer Code:** nichts verschieben. `activityShifts`, `healthShifts`, `seasonOf`, `MIN_SIDE_DAYS`, `MIN_HEALTH_DAYS` sind in `lib/turning/compare.ts` schon exportiert und nehmen Fenster bzw. Tageslisten. Neu dort nur eine exportierte Funktion `differentSeasons(before, after)` (heute inline in `compareTurningPoint` mit dem privaten `middle`), die `compareTurningPoint` dann selbst nutzt. `lib/experiments/compare.ts` importiert aus `@/lib/turning/compare`. Ein Kommentar sagt, dass `after`/`afterShare` dort „im Experiment“ heißt. Die Wendepunkt-Tests bleiben unverändert grün.
- **Hinweise:** „zeigt keine Ursache“ (eigener Schlüssel, sinngemäß wie `turning.noCause`). Jahreszeiten nur ab 6 Wochen Dauer, sonst feuert der Hinweis an jeder Monatsgrenze. Überschneidung mit anderen Experimenten im Experimentzeitraum („lief gleichzeitig mit: …“) und im Zeitraum davor („im Zeitraum davor lief: …“). Rückkehr zum Gewohnten: liegt das Mittel „Davor“ mindestens 0,3 Stufen unter dem Mittel aller Tage vor „Davor“ (mindestens 30 Tage mit Eintrag dort), der Satz „Die Zeit davor lag unter deinem Durchschnitt, ein Teil des Unterschieds kann die Rückkehr zum Gewohnten sein.“
- Experiment-Texte bekommen eigene Schlüssel unter `experiments.*`, Wendepunkt-Texte werden nicht wiederverwendet.
- Gerechnet wird nur auf der Vergleichsseite, nicht für Liste, Einblicke-Karte oder Heute.

### Eigene Schwankung (`lib/experiments/noise.ts`, rein, E2, E11, E12, E14)

Eine reine Funktion über eine Tagesreihe (Datum zu Wert oder kein Wert), angewandt auf die Stimmung (Tagesmittel), jede aktive Skala (`scaleDayValue`) und jede Gesundheitsgröße aus `HEALTH_METRICS` (`settledValue`, damit der unfertige heutige Tag fehlt). Nur wenn das Experiment vorbei ist (E12). Während es läuft, zeigt die Seite Zahlen und Verlauf mit „Zwischenstand. Ob der Unterschied über deine üblichen Schwankungen hinausgeht, zeigt Daylight am Ende.“

1. Längen: `Lb` = Länge „Davor“, `Le` = Länge „Im Experiment“. Beobachteter Unterschied `d = Mittel(im Experiment) − Mittel(davor)`.
2. Mindestzahl Tage mit Wert je Fenster `m`: 7 (`MIN_SIDE_DAYS`) für Stimmung und Skalen, `MIN_HEALTH_DAYS` für Gesundheit. Hat schon das echte Paar weniger, wird die Größe gar nicht verglichen.
3. Vergleichspaare aus der Vorgeschichte: Für jeden Stichtag `s` ein erstes Fenster `[s − Lb, s − 1]` und ein zweites `[s, s + Le − 1]`. Ein Paar zählt nur, wenn das zweite Fenster spätestens am Tag vor `start_date` endet, das erste nicht vor dem ersten Tag der Reihe beginnt und beide Fenster mindestens `m` Tage mit Wert haben. Schritt ein Tag, höchstens die letzten 730 Stichtage. Die Paare überlappen also das Fenster „Davor“, aber nie das Experiment.
4. Rechnung linear: dichte Tagesreihe und laufende Summen von Wert und Anzahl, kein `daysIn` je Stichtag.
5. Spanne `S` = Tage vom ersten bis zum letzten gültigen Stichtag. Benachbarte Stichtage teilen fast alle Tage und sind keine unabhängigen Fälle, deshalb zählt die Spanne, nicht die Paarzahl (E14):
   - `S < 2 × (Lb + Le)`: **nicht beurteilbar**
   - `2 × (Lb + Le) ≤ S < 4 × (Lb + Le)`: Urteil mit Zusatz **vorläufig**
   - sonst: volles Urteil
   Konstanten `NOISE_SPAN_PRELIMINARY = 2`, `NOISE_SPAN_FULL = 4`.
6. Anteil `X` der gültigen Stichtage mit `|Unterschied| ≥ |d|`. Schwelle `NOISE_SHARE = 0,1`, gleich für jede Größe (E11).
7. Texte, immer mit Zahl:
   - **nicht beurteilbar:** „Für einen Vergleich mit deinen üblichen Schwankungen reicht die Zeit vor dem Experiment noch nicht.“
   - `X ≤ 0,1`, **größer als üblich:** „Ein so großer Unterschied kam in deiner Vorgeschichte nur an X % der Stichtage zwischen zwei gleich langen Zeiträumen vor.“
   - sonst **im Rahmen:** „Ein so großer Unterschied kam in deiner Vorgeschichte an X % der Stichtage vor. Er liegt im Rahmen deiner üblichen Schwankungen.“
   - Zusatz bei vorläufig: „Vorläufig: Deine Vorgeschichte ist dafür noch recht kurz.“
   - Werden mehr als eine Größe beurteilt, einmal unter allen: „Je mehr Werte verglichen werden, desto eher fällt einer zufällig auf.“
8. Kein Satz sagt, das Experiment habe gewirkt. Daneben steht immer „zeigt keine Ursache“.

Auf der Vergleichsseite steht das Urteil der Stimmung im Satz oben, das der übrigen Größen kurz in ihrer Zeile (etwa „im Rahmen, 34 %“ oder „größer als üblich, 6 %“).

Konstanten benannt im Modul, getestet mit synthetischen Reihen: flache Reihe mit Zufallsrauschen (im Rahmen), klarer Sprung genau ab Start (größer als üblich), kurze Vorgeschichte (nicht beurteilbar), mittlere (vorläufig), Paare enden nie im Experiment, gekürztes „Davor“, Lücken in der Reihe.

### Check-in (E4)

- Läuft ein Experiment mit `check_in` an dem Tag, für den der Editor einen Eintrag schreibt (nicht nach heute), zeigt der Editor je Experiment eine Zeile „<Titel>: eingehalten?“ mit Ja und Nein. Ohne Antwort bleibt der Tag offen. Erneutes Tippen auf die gewählte Antwort nimmt sie zurück (offen).
- **Nein beendet das Experiment (E15):** Ein Tipp auf Nein fragt sofort: „Dann endet „<Titel>“ am <Vortag>. Antworten ab diesem Tag werden entfernt. Beenden?“ Abbrechen lässt die Antwort offen. Bestätigen merkt sich im Entwurf Nein samt Beenden; ausgeführt wird erst mit „Speichern“ des Editors: `end_date = max(start_date, Tag − 1)`, die Nein-Antwort des Tages bleibt gespeichert, alle Antworten nach dem neuen Ende außer dieser werden entfernt. Verlässt man den Editor ohne Speichern, passiert nichts. Ein Nein am Starttag beendet das Experiment am Starttag; der Vergleich sagt dann ehrlich, dass es nicht reicht. Ein schon beendetes Experiment zeigt keine Frage mehr.
- Die Antwort gilt für den Tag, nicht für den Eintrag. Ein zweiter Eintrag am selben Tag zeigt die vorhandene Antwort und kann sie ändern. Antworten gibt es nur zusammen mit einem gespeicherten Eintrag (Folge von E4).
- **Entwurf:** `lib/entry/draft.ts` bekommt `check_ins: Record<number, boolean | null>` mit nur den Änderungen gegenüber der Datenbank. `sameDraft` berücksichtigt sie, damit eine geänderte Antwort `dirty` macht und die Rückfrage beim Verlassen auslöst. Die vorhandenen Antworten liest ein `useQuery` für `draft.date`. Wechselt der Tag im Editor, werden die Änderungen verworfen.
- **Speichern:** in `save()` von `lib/entry/useEntryEditor.ts` im selben `mutate` wie `saveEntry`, über eine eigene Repository-Funktion `setExperimentDays(db, date, answers)` in `db/repositories/experiments.ts`. `EntryInput` und `db/repositories/entries.ts` werden nicht um Experimente erweitert. Zwei Schreibvorgänge nacheinander sind erlaubt; geht es ohne Umbau in eine Transaktion, umso besser.
- Das Löschen eines Eintrags lässt die Antwort stehen.
- Vergleichsseite: „Eingehalten an X von Y Tagen mit Antwort“, und war es durch ein Nein beendet, „Beendet durch ein Nein am <Tag>“. Kein Vergleich Ja-Tage gegen Nein-Tage (E15). Die reine Zählung liegt in `lib/experiments/compare.ts` (Phase 1), die Anzeige kommt in Phase 3.

### Oberfläche

- **Liste** `app/experiments/index.tsx`: Abschnitte Läuft, Geplant, Vorbei. Zeile mit Titel, Zeitraum, Fortschritt („Tag 9 von 28“). Knopf „Neues Experiment“. Leerer Zustand erklärt in einem Satz, was ein Experiment ist.
- **Anlegen und Bearbeiten** `app/experiments/new.tsx` (`?id=` bearbeitet): Titel mit Beispiel-Platzhalter („Kein Kaffee nach 14 Uhr“), Notiz, Start (eigene kleine Datumszeile mit Minimum und Maximum in `components/experiments/`, `DateTimeRows` aus dem Editor koppelt Tag und Uhrzeit und kennt kein Minimum), Dauer in Wochen, Schalter „Täglich fragen, ob ich es eingehalten habe“. Ein Satz unter dem Formular: Daylight vergleicht nur deine Einträge und sagt nichts über Ursachen oder Behandlungen. Schlichte Seite im normalen Tageslicht-Design, keine Sonnenaufgang-Inszenierung.
- **Vergleich** `app/experiments/[id].tsx`: Kopf mit Titel, Zeitraum, Zustand und Fortschritt, Notiz. Darunter wie bei Wendepunkten: zwei `StatTile` (Davor, Im Experiment), Satz mit Rauschurteil, Fenster und Hinweisen, `MoodLineChart` über beide Fenster mit Markierung des Starts, `LevelBar`, Skalen, Gesundheit, Aktivitäten, Check-in-Block. Unten Bearbeiten, „Jetzt beenden“ (nur wenn es läuft, mit Rückfrage), Löschen (mit Rückfrage).
- **Einstiege:** Karte „Experimente“ im Tab Einblicke, Abschnitt Stimmung, oben (laufende mit Fortschritt, sonst Einladung mit Knopf). Zeile „Experimente“ in `app/(tabs)/settings.tsx` direkt unter „Wendepunkte“, führt auf `/experiments`.
- **`result_seen` setzen (Phase 2):** Die Vergleichsseite setzt es in einem Effekt, nicht beim Rendern, und nur wenn das Experiment vorbei ist und der Wert noch false ist (sonst löst jedes Öffnen über `mutate` ein Neulesen aus).
- **Karte auf Heute (Phase 3):** ist ein Experiment vorbei, `result_seen` false und das Ende höchstens 14 Tage her, zeigt Heute eine kleine Karte „<Titel> ist vorbei. Vergleich ansehen“ mit Schließen. In `app/(tabs)/index.tsx` nach `ReviewCard`, nur beim heutigen Tag (`offset === 0`). Enden mehrere zugleich, nur eine Karte (das zuletzt beendete). Schließen setzt `result_seen`.
- Nach neuen Dateien unter `app/` einmal `npx expo customize tsconfig.json` (Typed Routes, siehe `docs/development.md`).

### Sicherung (E8)

- `serialize.ts`: beide Tabellen, `experiments` mit allen Spalten, `experiment_days`.
- `schema.ts`: beide optional, Prüfung in `superRefine`: Ende nicht vor Start, Dauer 1 bis 84 Tage (ältere Grenzen großzügig, damit ein Import nicht am Rand scheitert), Verweise in `experiment_days` gültig, keine doppelten (`experiment_id`, `date`). Kommentar oben im Schema ergänzen.
- `import.ts` (Ersetzen): beide Tabellen mit ids, `result_seen` wie in der Sicherung.
- `merge.ts` (Zusammenführen): ein Experiment mit gleichem Titel (gefaltet mit `fold` wie sonst in `merge.ts`) und exakt gleichem Start gilt als vorhanden und bleibt, dessen fehlende Antworten werden ergänzt, vorhandene nicht überschrieben. Neue Experimente bekommen neue ids und `result_seen = true`, damit keine alten Karten auftauchen; ihre Antworten folgen.
- Rundreise-Test in `lib/export/__tests__/` (Export, Ersetzen, gleiche Daten; Zusammenführen ohne Dopplung).
- **Pflicht:** `clearJournal` in `db/repositories/maintenance.ts` leert beide Tabellen, `experiment_days` vor `experiments` (Fremdschlüssel sind an). Ohne das scheitert das Ersetzen am Primärschlüssel. „Alles löschen“ in `app/more/delete.tsx` löscht die Datenbankdatei und braucht nichts.
- Folge (E16): Ersetzen per CSV und Ersetzen mit einer Sicherung ohne die Felder löschen alle Experimente, genau wie heute die Wendepunkte. Die Import-Vorschau sagt das vorher: Sie nennt die Zahl der Experimente in der Datei, und beim Ersetzen, wenn vorhandene Experimente verloren gehen, einen deutlichen Hinweis („3 Experimente gehen verloren“), für JSON und CSV. Die Zählung liegt rein in `lib/export/summary.ts` (Phase 1), die Anzeige in der Vorschau (`app/more/` Import-Vorschau, `components/import/`) in Phase 2.

## Phasen

### Phase 1: Daten, Rechnung, Sicherung

- Umfang: Schema und Migration, Repository, `lib/experiments/` (rules, compare, noise, `useExperiments.ts` als Brücke), gemeinsame Teile mit `lib/turning/compare.ts`, Sicherung komplett.
- Dateien und Bereiche: `db/schema.ts`, `drizzle/0018_*.sql` samt `drizzle/meta/` und `drizzle/migrations.js` (nur über `npm run db:generate`), `db/repositories/experiments.ts` und `index.ts`, `lib/experiments/`, `lib/turning/compare.ts` (nur Herausziehen), `lib/export/`, Löschen aller Daten.
- Commits: erst Schema und Migration allein („Datenbank: Tabellen für Experimente“), dann der Rest der Phase.
- Tests: Repository gegen die Test-DB (anlegen, bearbeiten, beenden, löschen mit Kaskade, Antworten setzen und außerhalb des Zeitraums entfernen), Regeln, Vergleich (zu wenig Tage, Zwischenstand, gekürztes Davor, Überschneidung, Jahreszeiten), Schwankung (drei Fälle oben), Sicherung (Rundreise, Zusammenführen, ältere Sicherung ohne Felder, kaputte Verweise abgelehnt). Wendepunkt-Tests unverändert grün.
- Fertig, wenn: `npm run typecheck` sauber, `npx jest` grün, die Migration ist ein eigener Commit und enthält nur die zwei Tabellen.

### Phase 2: Bildschirme und Texte

- Umfang: Liste, Anlegen und Bearbeiten, Vergleichsseite inklusive Jetzt beenden und Löschen, Karte in Einblicke, Zeile unter Mehr, Hinweis in der Import-Vorschau (E16), alle Texte in zehn Sprachen.
- Dateien und Bereiche: `app/experiments/`, `components/experiments/`, `app/(tabs)/insights.tsx`, `app/(tabs)/settings.tsx`, Import-Vorschau (`app/more/`, `components/import/`), `lib/i18n/locales/*.json`.
- Tests: Rendertests für Liste (leer, mit Abschnitten), Anlegen (Validierung Titel, Dauer), Vergleichsseite (zu wenig Tage, Zwischenstand, vorbei mit Urteil, nicht beurteilbar). Schlüsselgleichheit samt Pluralformen prüft `lib/i18n/__tests__/locales.test.ts` schon. Neu ein Test, der alle Texte unter `experiments.*` je Sprache gegen eine kurze Wortliste prüft (de: wirk, effekt, verbesser, heil, empfehl; en: effect, works, improv, cure, treat, recommend; für die übrigen acht Sprachen die Entsprechungen) und auf Gedankenstriche („—“, „–“). Nur dieser Zweig, die übrige App sagt bewusst „nicht Ursache und Wirkung“.
- Fertig, wenn: Typecheck und Tests grün, der Worttest ist grün.

### Phase 3: Check-in, Karte auf Heute, Doku

- Umfang: Check-in im Eintrag-Editor und auf der Vergleichsseite, Karte auf Heute nach dem Ende, ihre Texte in zehn Sprachen (unter `experiments.*`, damit der Worttest greift), Doku.
- Dateien und Bereiche: `lib/entry/draft.ts`, `components/entry/`, `lib/entry/useEntryEditor.ts`, `app/(tabs)/index.tsx`, `components/experiments/`, `docs/decisions/experimente.md` (Handover im Stil der anderen Dateien dort), `docs/development.md` (Architekturtabelle, Zeile `lib/experiments/`), `README.md` und `README.de.md` (Funktionsliste, beide gleich).
- Tests: Nein fragt nach, Abbrechen lässt offen, Bestätigen plus Speichern beendet am Vortag (am Starttag am Starttag) und entfernt spätere Antworten, Verlassen ohne Speichern ändert nichts. Editor zeigt die Frage nur bei laufendem Experiment mit Schalter und Tag nicht nach heute, Antwort wird mit Speichern geschrieben und bei zweitem Eintrag vorbelegt, geänderte Antwort macht den Entwurf `dirty`, Tageswechsel verwirft sie, Zurücknehmen funktioniert. Karte auf Heute erscheint, nicht für schon beim Anlegen beendete Experimente, höchstens eine, verschwindet nach Schließen.
- Fertig, wenn: Typecheck und Tests grün, Doku nennt Migration `0018` und den Hinweis zum Zusammenführen mit dem Sicherungs-Branch.

## Abnahme

- **Ziel-Prüffrage:** Kann jemand, der vier Wochen „kein Kaffee nach 14 Uhr“ probiert, auf der Vergleichsseite ehrlich ablesen, ob sich seine Einträge unterschieden haben, und sagt die App bei wenigen Tagen oder einem Unterschied im Rauschen genau das, ohne irgendwo eine Wirkung, Ursache oder Empfehlung zu behaupten?
- Sollzahlen: Tests mindestens 921 grün plus neue, Typecheck sauber, genau eine neue Migration `0018` in eigenem Commit.
- Durchklick-Wege (Emulator `Pixel_9`, Beispieldaten geladen, die ein Jahr umfassen): Experiment mit Start vor 30 Tagen und 4 Wochen anlegen (schon vorbei, keine Karte auf Heute), Vergleich mit Urteil sehen; Experiment mit Start vor 10 Tagen (Zwischenstand ohne Urteil); im Check-in Nein tippen, Rückfrage, speichern, Experiment beendet; Import-Vorschau mit Ersetzen zeigt den Verlust-Hinweis; Experiment ab morgen anlegen (geplant, kein Vergleich); laufendes Experiment mit Check-in, im Editor beantworten, zweiten Eintrag am Tag öffnen; vorzeitig beenden; Karte auf Heute; Sicherung exportieren, alles löschen, Sicherung einspielen, Experimente wieder da; Dark Mode einmal ansehen.

## Nicht im Umfang

- Benachrichtigungen zum Experiment (Start, Halbzeit, Ende, Check-in).
- Markierung des Experimentzeitraums in den Grafiken der Einblicke und im Kalender.
- Verknüpfung mit einer vorhandenen Aktivität.
- Vorlagen für häufige Experimente, Teilen, PDF-Bericht.
- Wendepunkte umbauen, außer dem Herausziehen gemeinsamer Funktionen.
- Erfolge für Experimente.
- CSV-Export.
- Versionsnummer, Updatehistorie, Store-Texte, Screenshots.

## Offene Fragen

F1 Zusammenführen mit dem Branch der automatischen Sicherung: Wer zuerst nach main geht, behält `0018`. Der andere löscht seine Migration samt Snapshot und Journal-Eintrag, holt main und erzeugt sie mit `npm run db:generate` neu. Klärt Paul beim Mergen.

## Abweichungen beim Bau

Tragen die Bau-Agents ein: was, warum, welche Phase.

Phase 1:
- `setExperimentDays(db, date, answers, today)` führt ein Nein selbst aus: Ende auf `max(start_date, Tag − 1)`, das Nein bleibt, spätere Antworten gehen. Phase 3 muss im Editor also nur nachfragen und dann speichern. Grund: Die Regel gehört in die Datenbankschicht und läuft so in einer Transaktion.
- Repository-Funktionen mit Regeln (`createExperiment`, `updateExperiment`, `endExperiment`, `setExperimentDays`) nehmen `today` als letztes, optionales Argument (Standard `today()`), damit Tests feste Tage nutzen. Start und Dauer ändert `updateExperiment` über `dates: { start_date, days }`, weil es keine Dauer-Spalte gibt.
- Verlust beim Ersetzen (`experimentsLost` in `lib/export/summary.ts`): gezählt werden vorhandene Experimente, die die Datei nicht mit gleichem gefaltetem Titel und gleichem Start wieder mitbringt. Bei CSV und Sicherung ohne Experimente sind das alle. `ImportSummary` hat dafür `experiments` und `experimentsLost`. `summarizePlan` nimmt die vorhandenen Experimente als optionales zweites Argument, `useImportPreview` reicht sie schon durch; angezeigt wird erst in Phase 2.
- Spanne der Stichtage in `noise.ts`: erster bis letzter gültiger Stichtag einschließlich (`letzter − erster + 1`). Nach Prüfung R1 ersetzt, siehe unten.
- Gemeinsamer Schlüssel `experimentKey` (gefalteter Titel und Start) in `lib/experiments/rules.ts`, genutzt von Zusammenführen und Import-Vorschau.

Phase 2:
- Reine Anzeigehilfen in `lib/experiments/view.ts`: Abschnitte der Liste (Läuft und Geplant nach Start, Vorbei mit dem jüngsten Ende zuerst), Auswahl der Dauer und das Urteil in Worten (Satz für die Stimmung, Kurzform für die Zeilen). Grund: keine Logik in Komponenten.
- Dauer als `SelectRow` mit 1 bis 12 Wochen. Eine gespeicherte Länge, die keine ganze Wochenzahl der Auswahl ist (etwa aus einer Sicherung), erscheint dort zusätzlich in Tagen, damit Bearbeiten sie nicht stillschweigend ändert.
- Das Formular fragt beim Verlassen mit Änderungen nach, wie bei den Wendepunkten. Nach dem Anlegen öffnet sich gleich die Vergleichsseite (`router.replace`).
- Gibt es vor dem Start gar keine Einträge, sagt die Vergleichsseite das in einem eigenen Satz (`experiments.noBefore`) statt „zu wenige Tage“.
- Texte der Import-Vorschau liegen unter `experiments.import.*`, damit der Worttest greift. Die Zahl der Experimente in der Datei hängt `summaryText` an; „N Experimente gehen verloren“ steht beim Ersetzen rot unter dem Ersetzen-Hinweis und zusätzlich in der Rückfrage.
- Worttest (`lib/i18n/__tests__/experimentWords.test.ts`): in es, it und pt „curar“/„curare“ statt „cura“ (sonst trifft „procura“, „sicura“), in tr „etkis“/„etkil“ statt „etki“ (sonst trifft „etkinlik“), in pl „lecz“ bleibt, deshalb nutzen die polnischen Texte das Wort nicht. Der Satz unter dem Formular sagt außerhalb des Deutschen „Therapien“ statt „Behandlungen“, weil „treat“, „tratamiento“, „behandel“ usw. auf der Liste stehen.

Nach Prüfung R1 (zwischen Phase 2 und 3):
- Mindest-Vorgeschichte (E14) zählt die gültigen Stichtage statt der Spanne vom ersten bis zum letzten. Grund: Eine monatelange Lücke im Tagebuch ließ die Spanne groß erscheinen, obwohl kaum Vorgeschichte da war. Ohne Lücken ist beides gleich. Die Konstanten `NOISE_SPAN_PRELIMINARY` und `NOISE_SPAN_FULL` behalten ihre Namen und Werte.
- Beenden am Starttag: „Jetzt beenden“ gibt es erst ab dem zweiten Tag (`canEndEarly` verlangt `heute > start_date`), am Starttag bleibt nur Löschen. Ein Nein am Starttag beendet weiter am Starttag (`end_date = start_date`). Damit es sofort vorbei ist, gilt in `experimentState`: Ein Experiment von genau einem Tag ist ab diesem Tag vorbei, nicht erst am Tag danach. Ein eintägiges Experiment kann nur durch ein Nein am Starttag (oder am Tag danach) entstehen, weil die kürzeste Wahl eine Woche ist. `canAnswer` (und damit `askingOn`) fragt nur an Tagen, an denen das Experiment läuft (`experimentState(experiment, Tag) === 'running'`), also nach einem Nein am Starttag auch dort nicht mehr. Bearbeiten von Start und Dauer ist dann gesperrt, Liste und Einblicke führen es unter Vorbei. Grund: Sonst lief ein am Starttag beendetes Experiment als „Tag 1 von 1“ weiter. Es braucht dafür keine Antworten in den Regeln und keine neue Spalte.
- Zusammenführen: Neue Experimente bekommen `result_seen = true` nur, wenn ihr Ende vor heute liegt; laufende und geplante bekommen `false`, damit sie nach dem Ende ihre Karte auf Heute zeigen. Der Zweck aus dem Plan (keine alten Karten aus einer alten Sicherung) bleibt gewahrt. `mergeImport` nimmt dafür `today` als optionales drittes Argument. Für ein schon vorhandenes Experiment werden nur Antworten aus seinem eigenen Zeitraum ergänzt, weil eine Antwort nach seinem Ende sonst als „Beendet durch ein Nein“ gelesen würde.
- Sicherung: Titel eines Experiments höchstens 60 Zeichen (nach dem Trimmen), wie beim Anlegen.
- Abschnitt „Vergleich“ korrigiert: Dort stand, Skalen und Gesundheit kämen ohne Rauschurteil. Das widersprach E11 und „Eigene Schwankung“; gebaut war schon in Phase 1 nach E11 (Urteil je Größe, Aktivitäten ohne).
- Rückkehr zum Gewohnten nur, wenn das Mittel im Experiment über dem Mittel „Davor“ liegt; bei weiterem Abfall kann es keine Rückkehr sein. „Lief gleichzeitig mit“ prüft gegen „Im Experiment“ (Start bis heute), damit ein noch nicht begonnenes Experiment nicht genannt wird.

Phase 3:
- Rückfrage beim Nein sagt „Dein Nein bleibt gespeichert, spätere Antworten werden entfernt. Das passiert, sobald du den Eintrag speicherst.“ statt „Antworten ab diesem Tag werden entfernt“. Grund: Das Nein des Tages bleibt (E15), der Plantext klang, als ginge es mit. Unter der Zeile steht nach dem Bestätigen „Mit dem Speichern endet das Experiment am …“, damit sichtbar ist, dass noch nichts passiert ist.
- Die Frage im Editor liegt als `CheckInCard` in `components/experiments/`, eingebunden in `EntryEditor` nach den Skalen. `useEntryEditor` liefert die fragenden Experimente samt angezeigter Antwort (`checkIns`) und `tapCheckIn`; die Rückfrage stellt die Karte. Beim Speichern gehen nur Antworten für Experimente an `setExperimentDays`, die an dem Tag noch fragen, damit ein inzwischen beendetes Experiment das Speichern des Eintrags nicht scheitern lässt. Heute kommt aus `useToday`.
- Eine Antwort, die wieder dem gespeicherten Stand entspricht, fällt aus `check_ins` (`tapCheckIn` in `lib/entry/draft.ts`), sonst bliebe der Entwurf nach Hin- und Zurücktippen `dirty`.
- Check-in-Block auf der Vergleichsseite nur, wenn die Frage an ist oder Antworten da sind, nicht bei geplanten. Ohne Antwort ein eigener Satz („Noch keine Antwort …“).
- Welche Karte Heute zeigt, rechnet rein `finishedToShow` in `lib/experiments/view.ts` (Konstante `RESULT_CARD_DAYS = 14`), bei gleichem Ende das später angelegte.
