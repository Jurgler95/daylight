# Stimmung direkt aus der Erinnerung

## Status

Gebaut am 2026-11-27 auf dem Branch `feature/stimmung-aus-benachrichtigung`. Keine Version gehoben, keine Updatehistorie, das macht `/deploy`. Einfache Stufe: Ein Tipp öffnet den Editor, gespeichert wird erst dort.

## Was existiert

| Datei | Inhalt |
| --- | --- |
| `modules/daylight-reminders/android/.../MoodButtons.kt` | Ausgeklappte Ansicht mit Titel, Text und bis zu fünf Stimmungsknöpfen, Badges aus der Icon-Schrift wie im Widget. Speichert die Stimmungen, die die App übergibt |
| `modules/daylight-reminders/android/.../MoodTapActivity.kt` | Unsichtbare Activity hinter jedem Knopf: nimmt die Benachrichtigung weg, öffnet den Link in der App, schließt sich |
| `modules/daylight-reminders/android/src/main/res/layout/daylight_reminder_moods.xml` | Layout der ausgeklappten Ansicht |
| `modules/daylight-reminders/android/.../Reminders.kt`, `DaylightRemindersModule.kt`, `index.ts` | `schedule` bekommt `moodUrl` (achtes Argument, das Maximum für Expo-Module), neu `setMoods(json)` |
| `lib/notifications/plan.ts` | `moodLink`: Link für die Knöpfe je Erinnerung |
| `lib/notifications/moods.ts` | `buildReminderMoods`: aktive Stimmungen in der Reihenfolge der App, höchstens fünf, mit Code-Punkt des Icons |
| `lib/notifications/useReminderSync.ts`, `client.ts` | Übergibt die Stimmungen nach jeder Änderung des Katalogs, ohne neu zu planen |
| `lib/icons/font.ts` | `iconFont` und `iconGlyphs`, aus `useWidgetSync` herausgezogen, damit Widget und Erinnerung dieselbe Quelle nutzen |
| `app/more/reminders.tsx`, `lib/i18n/locales/*.json` | Hinweis `reminders.moodButtons` auf der Einstellungsseite in allen zehn Sprachen |

## Entscheidungen

1. **Eigenes Layout statt Aktionsknöpfen.** Android zeigt höchstens drei Aktionen, für fünf Stimmungen reicht das nicht. Die Knöpfe stehen in einer eigenen Ansicht im System-Rahmen (`DecoratedCustomViewStyle`): App-Icon, Name und Uhrzeit zeichnet das System, Farben der Texte kommen aus den Notification-Styles von androidx, damit Hell und Dunkel stimmen. Seit Android 12 rahmt das System jede eigene Ansicht ohnehin so ein, ganz eigene Benachrichtigungen gibt es nicht mehr.
2. **Nur ausgeklappt.** Eingeklappt bleibt die normale Benachrichtigung mit Titel und Text. Seit Android 12 hat eine eigene eingeklappte Ansicht nur 48 dp Höhe, Text und fünf Knöpfe passen da nicht sauber hinein, und ohne Text wüsste man nicht, worum es geht. Die oberste Benachrichtigung zeigt Android meist schon ausgeklappt, sonst genügt ein Wisch nach unten. Der Kanal hat die Wichtigkeit „Standard“, es gibt also keine Heads-up-Anzeige, die eine dritte Ansicht bräuchte.
3. **Verschwinden nach dem Tipp über eine Activity.** Knöpfe in einer eigenen Ansicht schließen die Benachrichtigung nicht wie ein Tipp auf sie selbst (`setAutoCancel`). Ein BroadcastReceiver als Zwischenschritt darf seit Android 12 keine Activity mehr starten (Trampolin-Sperre), eine Activity schon. `MoodTapActivity` ist nicht exportiert, ohne Anzeige (`Theme.NoDisplay`), in eigener Task-Affinität und ohne Eintrag in den letzten Apps. Sie braucht keine Berechtigung.
4. **Gleicher Weg wie das Widget.** Der Link ist `daylight://entry/new?date=<Tag>&mood=<id>`. Es gelten die Regeln von `docs/decisions/mehrere-eintraege-und-erinnerungen.md`: immer ein neuer Eintrag (B6), und `dangerouslySingular` (A5): Ist für denselben Tag schon ein ungespeicherter neuer Eintrag offen, führt der Tipp zu diesem Entwurf und übernimmt die Stimmung nicht.
5. **Aktuelle Stimmungen.** Die App übergibt die aktiven Stimmungen (`catalog.moods`, wie die Stimmungsauswahl, höchstens fünf wie im Widget) nach jeder Änderung an das Modul. Die Erinnerung liest sie erst beim Anzeigen, umbenannte, archivierte oder neue Stimmungen sind also dabei, ohne dass Alarme neu gestellt werden. Eine archivierte Stimmung aus einer schon angezeigten Benachrichtigung wählt der Editor nicht vor (`app/entry/new.tsx` prüft gegen die aktiven).
6. **App-Sperre.** Die Knöpfe zeigen nur Icon und Bezeichnung jeder Stimmung, nie welche zuletzt gewählt wurde, mit und ohne Sperre. Nach dem Tipp greift die Sperre der App wie bei jedem Link. Der Text der Erinnerung bleibt wie bisher (höchstens die Länge der Serie, siehe `reminders.discreet`).
7. **Abend und alle weiteren Uhrzeiten** bekommen Knöpfe für einen neuen Eintrag an ihrem Tag.
8. **Morgenerinnerung für gestern mit Knöpfen**, für einen neuen Eintrag am Vortag. Sie fragt nach genau einem fehlenden Tag, das Datum steht im Link, die Stimmung ist der erste Schritt dieses Eintrags. Für gestern gibt es sonst keinen schnellen Weg, das Widget trägt immer für heute ein. Der Text („Gestern fehlt noch …“) macht klar, für welchen Tag.
9. **Ausblick ohne Knöpfe:** Er fragt nach nichts.
10. **Ohne übergebene Stimmungen** (erste Erinnerung nach dem Update, bevor die App lief) und für Alarme, die eine ältere Version gestellt hat (ohne `moodUrl`), bleibt es bei der bisherigen Benachrichtigung.

## Offene Punkte

Auf dem Gerät prüfen:

- Ausgeklappte Erinnerung zeigt fünf Stimmungen mit Icons und Namen, hell und dunkel, auch auf Android 8 bis 11 (dort sieht der Rahmen anders aus).
- Tipp auf eine Stimmung: Editor öffnet mit dieser Stimmung, kalt und warm, und die Benachrichtigung ist weg. Mit App-Sperre erst entsperren, danach der Editor.
- Tipp auf eine Stimmung auf dem Sperrbildschirm: Gerät fragt nach dem Entsperren.
- Mehrere Uhrzeiten, zwei Erinnerungen gleichzeitig sichtbar: Tipp in einer nimmt nur diese weg.
- Morgenerinnerung: Tipp öffnet den Eintrag für gestern.
- Stimmung umbenennen oder archivieren, App schließen, nächste Erinnerung zeigt den neuen Stand.
- TalkBack liest die Bezeichnungen der Knöpfe.
