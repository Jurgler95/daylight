# Bericht als PDF für Arzt oder Therapie (Handover)

## Status

Umgesetzt am 2026-11-27 auf Branch `feature/pdf-bericht`, noch nicht auf dem Gerät geprüft. Keine Version gehoben, keine Updatehistorie, das macht `/deploy`.

| Prüfung | Ergebnis |
| --- | --- |
| `npm run typecheck` | sauber |
| `npm test` | alle Suites grün, neu `lib/report/__tests__/report.test.ts` (Zeitraum, Kennzahlen, Mindestmengen, Notizen, Escaping, alle Sprachen und Zeiträume gegen das Beispieljahr ohne fehlenden Text, `NaN` oder offenen Platzhalter) |
| Druckbild | Beispieljahr, 90 Tage, mit Chrome headless als PDF gedruckt (dieselbe Druck-Engine wie die Android-WebView): Seite 1 passt, Tabelle auf Seite 2, Tagesliste ab Seite 3 mit wiederholtem Tabellenkopf |
| Berechtigungen | `expo-print` bringt ein leeres Android-Manifest mit, also keine Berechtigung. Nicht geprüft: aapt2 auf einer fertigen APK |

## Was existiert

| Datei | Inhalt |
| --- | --- |
| `lib/report/model.ts` | Rein: `reportWindow`, `defaultReportOptions`, `buildReport`, dazu `activityDays`, `scalesWithValues`, `hasSleep` für den Bildschirm |
| `lib/report/html.ts` | Rein: `renderReportHtml`, A4-Seite (595 × 842 Punkte bei 72 dpi, Rand über `@page`), Verlauf als SVG, alles Eingegebene über `escapeHtml` |
| `lib/report/useReport.ts` | `useReportSource` (Einträge, Gesundheitstage, Wendepunkte, Katalog je Datenstand), `useCreateReport` (PDF mit `expo-print`, dann Teilen oder Ordner) |
| `app/more/report.tsx` | Seite „Bericht als PDF“, erreichbar unter Mehr, Daten |
| `lib/i18n/locales/*.json` | Abschnitt `report` und `settings.report` in allen zehn Sprachen |

## Entscheidungen

1. **Nur zeigen, nicht bewerten.** Keine Ampeln, kein „auffällig“, keine Empfehlung, keine Ursache. „Mit und ohne“ wie in den Einblicken, mit dem Satz, dass Zusammenhänge keine Ursachen sind. Ein Bericht, der bewertet oder empfiehlt, rückt in Richtung Medizinprodukt.
2. **Seite 1 reicht für den Termin:** Kopf mit Skala, optional „Was ich ansprechen möchte“, vier Kennzahlen, Verlauf, Verteilung, Monate und eigene Wendepunkte. Seite 2 ist die Tabelle „Aktivitäten und Stimmung“, ab Seite 3 folgt die Tagesliste.
3. **Eine gemeinsame Zeitachse** für Stimmung, gemessenen Schlaf, Skalen und bis zu acht Aktivitäten als Leisten. Gemessener Schlaf (Health Connect) und eigene Schlaf-Aktivitäten stehen getrennt und klar beschriftet, weil sie sich widersprechen können (eine nicht getragene Uhr misst eine kurze Nacht).
4. **Kein Wochenmittel im Verlauf.** Bei einem Eintrag am Tag und ruhigem Verlauf zeigte es mit echten Daten fast nichts. Mehrere Einträge eines Tages erscheinen als senkrechte Linie vom niedrigsten zum höchsten.
5. **Mindestmengen:** Monatswerte für Schlaf und Skalen erst ab 5 Werten (sonst „zu wenig“; ohne diese Regel stand mit echten Daten ein Septemberschnitt aus einem einzigen Wert). Aktivitäten erst ab 3 Tagen in der Tabelle, unter 10 Tagen grau.
6. **Lücken bleiben leer**, nichts wird verbunden oder aufgefüllt. Der Zeitraum beginnt nicht vor dem ersten Eintrag.
7. **Notizen standardmäßig aus.** Mit echten Daten hatte jeder Tag eine Notiz, viele mit Namen anderer Menschen. Wenn aus, sagt der Bericht, an wie vielen Tagen es Notizen gab. Fotos kommen nie hinein.
8. **Nichts wird gespeichert:** Zeitraum, Name, Gesprächsnotiz und Auswahl leben nur, solange die Seite offen ist. Ein Name oder eine Notiz für den Termin soll nicht in der App bleiben. Auch das PDF nicht: Die Datei, die `expo-print` unter `cache/Print/` ablegt, wird gleich nach dem Lesen gelöscht. Die Kopie für den Teilen-Dialog (`daylight-…pdf`) muss bleiben, solange die andere App sie liest, was Android nicht meldet; sie geht mit dem nächsten Bericht desselben Tages oder mit „Alle Daten löschen“, das auch `cache/Print/` leert.
9. **Voreinstellung:** 90 Tage, Schlaf und alle Skalen mit Werten, die sechs häufigsten Aktivitäten, die nicht an mehr als 80 % der Tage vorkommen („zu Hause“ als Leiste sagt nichts), alle Gruppen in der Tabelle, Tagesliste an.
10. **PDF auf dem Gerät mit `expo-print`**, statt selbst PDF zu schreiben: HTML und CSS reichen für Tabellen über mehrere Seiten (`thead` wiederholt sich, Zeilen brechen nicht). Das HTML hat kein Skript und keine externe Quelle; Farben werden mit `print-color-adjust: exact` gedruckt. Stimmung nie nur über Farbe: Punkte stehen auf der Höhe ihrer Stufe, Legenden tragen die Zahl.

## Offene Punkte

- **Auf dem Gerät prüfen:** PDF erzeugen, teilen und in Ordner speichern, Druckbild aus der Android-WebView (Schrift, Farben, Seitenumbrüche, Rand), Zeitraum 1 Jahr mit Tagesliste (Dauer und Größe), App-Sperre beim Teilen.
- Release-APK mit aapt2 prüfen, dass `expo-print` keine Berechtigung mitbringt.
- Keine Seitenzahlen: Ränder mit Zähler (`@page`-Randboxen) kann die WebView nicht sicher.
- Skala „Happiness“ und ähnliche erscheinen, wenn gewählt; ob Ärztinnen Skalen im Verlauf brauchen, ist offen.
