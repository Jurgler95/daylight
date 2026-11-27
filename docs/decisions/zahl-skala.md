# Zahl-Skalen, etwa für das Gewicht

## Status

Umgesetzt am 2026-11-27 auf Branch `feature/zahl-skala`, aufgebaut auf `integration/2026-11-27` (Experimente, PDF-Bericht, automatische Sicherung, Stimmung aus der Benachrichtigung). Noch nicht auf dem Gerät geprüft. Keine Version gehoben, keine Updatehistorie, das macht `/deploy`.

## Was es ist

Eine vierte Art von Skala neben 1 bis 5, 0 bis 10 und Dauer: eine Zahl zum Eintippen, mit Einheit (frei, bis 12 Zeichen) und 0 bis 2 Nachkommastellen. Gedacht für Gewicht, Gläser Wasser, Blutzucker und Ähnliches. Kein fester Bereich.

## Entscheidungen

- **Speicherung:** `scales` bekommt `unit` und `decimals` (Migration `0020_number_scales`, nur zwei `ADD COLUMN`). Der Wert bleibt in `entry_scales.value`. Die Spalte ist als `integer` deklariert, SQLite speichert 72.4 dort trotzdem verlustfrei als REAL (Integer-Affinität wandelt nur, was ohne Verlust geht). So braucht es keinen Tabellenumbau und keine Umrechnung beim Lesen.
- **Bereich:** Eine Zahl-Skala hat `min` und `max` 0. Überall, wo bisher der Bereich galt, gibt es einen eigenen Zweig: Diagramme schmiegen sich an die Werte (`numberChartRange`), die Stimmungs-Karte teilt die Tage an den Quartilen (`numberBuckets`), der Ausblick nimmt das 10. bis 90. Perzentil als Spanne (`withNumberSpans`), der Trend gilt ab 2 % des Niveaus, mindestens eine Stelle der letzten Nachkommastelle.
- **Mehrere Einträge am Tag:** Mittelwert, wie bei Bewertungen. Zwei Wiegungen am Tag ergeben ihren Schnitt.
- **Anzeige:** Ein Eintrag zeigt genau die Stellen der Skala mit Einheit („72,4 kg“), Mittelwerte mindestens eine Nachkommastelle („2,5“ Gläser).
- **Einheit und Stellen änderbar:** Beides lässt sich auf der Seite der Skala ändern. Weniger Stellen runden nur die Anzeige, gespeicherte Werte bleiben.
- **Eingabe:** Komma oder Punkt, Leerzeichen egal. Mehr Stellen als die Skala hat werden nicht gerundet, sondern angemahnt: „1.500“ auf einer Skala ohne Nachkommastellen ist ein Tausenderpunkt, still 2 zu speichern wäre falsch. Solange der Text keine passende Zahl ist, bleibt der letzte gültige Wert und eine Zeile sagt es.
- **Sicherung (JSON):** `unit` und `decimals` sind optional (ältere Sicherungen haben sie nicht). `entry_scales.value` darf nur bei Zahl-Skalen eine Kommazahl sein. Ältere App-Versionen lehnen eine Sicherung mit Zahl-Skala ab (unbekannte `kind`), wie damals bei der Dauer.
- **CSV:** Export schreibt Zahl-Skalen immer mit Nachkommastellen, mindestens einer („Gläser: 6.0“), sonst würde eine Skala mit ganzen Werten auf einem neuen Gerät zur Bewertung. Der Import liest Punkt und Komma und zählt die Stellen am Text. Eine neue Skala mit Stellen wird eine Zahl-Skala mit so vielen Stellen wie gesehen (höchstens 2; eine Skala ohne Stellen kommt also mit einer zurück). Auf einer bestehenden Zahl-Skala bleiben bis zu 2 Stellen erhalten, auf einer Bewertung wird gerundet.
- **PDF-Bericht:** Werte mit Einheit (escaped, die Einheit ist Nutzereingabe), Verlauf mit Spanne der Werte im Zeitraum als Beschriftung.

## Nicht gemacht

- Trend-Schwelle aus der Streuung: Bei Werten um 0 (etwa Temperaturabweichungen) ist 2 % des Niveaus sehr klein, dann gilt nur die Untergrenze von einer Stelle der letzten Nachkommastelle.

- Gewicht aus Health Connect (`READ_WEIGHT`). Wäre eine neue Berechtigung und eine Änderung an `check-manifest.mjs`.
- Negative Zahlen über die Tastatur bei Skalen mit Nachkommastellen: `decimal-pad` hat unter Android kein Minus. Bei 0 Stellen gibt es `numeric` mit Minus.
