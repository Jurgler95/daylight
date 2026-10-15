# Serie halten und Erinnerung am Folgetag (Handover)

## Status

Teil A (Serie, „Heute“, Feiern, Erfolge-Fokus, Datenmodell) umgesetzt am 2026-10-13 auf `main`, nicht committet, keine Version gehoben, keine Updatehistorie, das macht `/deploy`. Teil B (Erinnerungen, Deep Link, Start-Sheet) am selben Tag, ebenso nicht committet, siehe „Erinnerungen (Teil B)“.

| Prüfung | Ergebnis |
| --- | --- |
| `npm run typecheck` | sauber |
| `npm test` | 66 Suites, 486 Tests grün. Neu: `lib/streak/__tests__/streak.test.ts`, `celebration.test.ts`, `celebrate.test.ts`, `lib/store/__tests__/overlays.test.ts`, `components/streak/__tests__/celebration.test.tsx`; ergänzt: `journal.test.ts`, `roundtrip.test.ts`, `achievements.test.ts`, `contrast.test.ts`, `today.test.tsx`, `screens.test.tsx` |
| Nach Teil B | `npm run typecheck` sauber, `npm test` 68 Suites, 528 Tests grün |
| Auf dem Gerät | noch nicht, siehe Offene Punkte |

## Was existiert

| Datei | Inhalt |
| --- | --- |
| `db/schema.ts`, `drizzle/0008_neat_blur.sql` | Neue Spalten in `settings`: `reminder_yesterday_enabled` (Standard an), `reminder_yesterday_time` (`10:00`), `reminder_prompt_done`, `streak_celebrated`, `streak_rescue_dismissed`. Die ersten beiden nutzt erst Teil B |
| `db/repositories/settings.ts`, `db/migrate.ts` | `reminder_yesterday_time` wird wie `reminder_time` geprüft, `streak_rescue_dismissed` als Datum. `settleReminderPrompt` setzt `reminder_prompt_done` bei jedem Start, wenn die Erinnerung schon an ist |
| `lib/streak/days.ts` | Tage mit Eintrag bis heute (`entryDaysUpTo`), Lauf bis zu einem Tag (`runEndingAt`). Teilen sich Serie und Erfolge |
| `lib/streak/streak.ts` | `entryStreak(entryDates, today): StreakState`, die Zustände `active`, `atRisk`, `broken`, `none`, dazu `rescue` für eine Lücke, die sich noch schließen lässt |
| `lib/streak/view.ts` | Chip (`streakChip`) und Rettungskarte (`showRescueCard`) aus dem Zustand |
| `lib/streak/celebration.ts` | Stufen (`milestoneFor`), gespeicherter Stand (`parseCelebrated`, `celebratedDays`, `shouldCelebrate`), was ein Speichern ausgelöst hat (`celebrationFor`), wie es sich zeigt (`celebrationStage`) |
| `lib/streak/celebrate.ts` | Brücke: Tage mit Eintrag je Datenstand aus `readInsightEntries` (`cached('entryDays')`), `celebrateSave` für den Editor |
| `lib/streak/useStreak.ts` | `useStreak` (Zustand, Chip, Rettungskarte), `useChipPulse`, `useStreakCelebration` |
| `lib/store/overlays.ts` | Gemeinsamer Platz für alles, was kurz über den Seiten liegt, mit Vorrang (siehe unten) |
| `components/today/StreakChip.tsx`, `StreakRiskCard.tsx`, `StreakRescueCard.tsx` | Chip neben dem Titel auf „Heute“, Karte „Gestern fehlt noch“, Rettungskarte |
| `components/streak/StreakCelebration.tsx` | Banner (50er-Schritte, gerettete Serie) und Overlay (200er-Schritte) |

Angepasst: `app/(tabs)/index.tsx` (Chip und Karten), `app/(tabs)/achievements.tsx` (Parameter `focus`), `app/_layout.tsx` (Feier neben dem StarToast), `components/achievements/StarToast.tsx` und `lib/achievements/useStarNews.ts` (Platz im Overlay-Store, Schlüssel für `focus`), `components/achievements/AchievementCard.tsx` (Rahmen zum Markieren), `components/ui/Screen.tsx` (`scrollRef`), `lib/entry/useEntryEditor.ts` (Auslöser), `lib/achievements/achievements.ts` (gemeinsame Tage), `lib/haptics` (`celebrate`), `lib/theme/tokens.ts` (`amber`, `amberSoft`), `lib/export/schema.ts` und `serialize.ts`, beide Sprachdateien.

## Entscheidungen

1. **Ein Serientag ist ein Tag mit mindestens einem Eintrag**, egal welche Stimmung und wann geschrieben. Nachtragen hält oder repariert die Serie. Grundlage ist dieselbe Menge wie beim Erfolg „Am Ball“ (`days`): `entryDaysUpTo` lässt Tage nach heute weg (die kommen nur über einen Import), in der Serie wie in `buildAchievements`. Dort zählen sie damit auch für „Dranbleiben“ und „Tagebuchtage“ nicht mehr. Stufen der Erfolge unverändert.
2. **Zustände relativ zu heute (T)**, geprüft in dieser Reihenfolge:
   - `atRisk`: T-1 fehlt, T-2 hat einen Eintrag, egal was T hat. `days` ist der Lauf bis T-2, `restoredDays` der Lauf nach dem Nachtragen von T-1 (mit T, falls T einen Eintrag hat).
   - `broken`: T-1 und T-2 fehlen, in [T-8, T-3] gibt es einen Eintrag. Anker ist der **älteste** solche Tag, so bleibt eine teilweise nachgetragene Lücke eine Lücke und der Lauf davor wird voll gezählt. `days` ist 1 mit Eintrag heute, sonst 0. Eine Lücke über sieben Tage ist `none` (oder `active` mit 1, wenn heute einen Eintrag hat).
   - `active`: T oder T-1 hat einen Eintrag.
   - `none`: sonst.
   Zusätzlich trägt der Zustand `start` (erster Tag des gezählten Laufs), `missing` (was nachzutragen ist, aufsteigend: gestern bei `atRisk`, sonst die Lücke aus `rescue`) und `restoredDays` (Länge danach).
2a. **Lücke hinter dem laufenden Lauf** (Nacharbeit auf Pauls Wunsch: dass Nachtragen die Serie rettet, soll immer sichtbar sein). Ist der Zustand `active` mit Start S, fehlt S-1, und gibt es in [T-8, S-2] einen Eintrag, bekommt der Zustand `rescue`. Das passiert, wenn eine Lücke vom falschen Ende her gefüllt wird (gestern zuerst), oder bei einer alten Lücke von einem Tag hinter einer laufenden Serie. Der Status bleibt `active`, der Chip zeigt den laufenden Lauf wie gewohnt, die Rettungskarte erscheint. `broken` trägt seine Lücke im selben Feld: `rescue = { anchor, missing, restoredDays, runBeforeGap }` mit dem ältesten Eintrag im Fenster als Anker, allen fehlenden Tagen zwischen Anker und T, der Länge nach dem Nachtragen (Lauf bis zum Anker, alle Tage zwischen Anker und T, heute mit Eintrag) und dem Lauf bis zum letzten Eintrag vor der Lücke. Eine Lücke, deren Tage weiter als sieben Tage zurückliegen, fällt aus dem Fenster und wird nicht mehr angeboten. `atRisk` bleibt ohne `rescue`.
3. **Chip und Erfolg weichen bei `atRisk` und `broken` bewusst ab.** Nur im Zustand `active` ist die Zahl am Chip gleich „Aktuell“ beim Erfolg „Am Ball“ (getestet). Fehlt gestern, zeigt der Erfolg 0, der Chip aber bernsteinfarben den Lauf bis vorgestern: das, was Nachtragen rettet. Bei `broken` zeigt der Chip gedämpft 0 (oder 1 mit Eintrag heute), solange die Rettungskarte sichtbar ist, danach wie bei `active` (1 mit Eintrag heute, sonst nichts). Der Chip erscheint ab einem Tag, nur wenn heute der gewählte Tag ist, und öffnet die Erfolge mit `focus=days`.
4. **Karte „Gestern fehlt noch“** bei `atRisk`, über den Eintragskarten, ohne Countdown, nicht wegzulegen. Der Knopf öffnet `/entry/new?date=<T-1>`.
5. **Rettungskarte**, sobald der Zustand `rescue` trägt (`broken` oder `active` mit Lücke dahinter): „K Tage fehlen. Nachtragen holt deine N Tage zurück.“ Der Knopf nennt und öffnet den ältesten fehlenden Tag, nach jedem Speichern rückt sie zum nächsten. „Später“ (wie bei der Tief-Karte, keine Wischgeste) speichert das Datum des Weglegens in `streak_rescue_dismissed`. Ausgeblendet bleibt sie, solange der Anker der Lücke älter ist als dieses Datum; eine neue Lücke hat immer einen jüngeren Anker.
6. **Feiern nur beim Speichern im Editor.** `useEntryEditor.save` ruft `celebrateSave`, das den Zustand vor und nach dem Schreiben vergleicht. Import und Beispieldaten schreiben über eigene Wege und feiern nie, das Öffnen der App auch nicht. Stufen: alle 10 Tage klein (Chip pulsiert, leichte Haptik `tick`), alle 50 groß (zusätzlich Banner, Haptik `confirm`), alle 200 am größten (Overlay mit großer Zahl und Funken, Haptik `celebrate`). Wo Stufen zusammenfallen, gewinnt die größte. Springt die Serie über mehrere Schwellen (eine Lücke auf einmal geschlossen), zählt die größte Stufe darunter (45 auf 103 ist groß wegen 50), das Banner nennt die neue Länge. Als Länge vorher gilt der laufende Lauf, bei `broken` der Lauf bis zum letzten Eintrag vor der Lücke (`rescue.runBeforeGap`).
7. **Jede Schwelle einmal je Serie.** `streak_celebrated` hält `{ start, days }` der letzten Feier. Dieselbe Serie ist es, solange der gespeicherte Start im aktuellen Lauf liegt (Nachtragen vor dem Start verschiebt ihn, bleibt aber dieselbe Serie). Gefeiert wird nur über `max(Länge vorher, gespeicherte Länge)`, Löschen und neu Anlegen feiert also nicht noch einmal.
8. **„Serie gerettet“**: schließt ein Speichern die ganze Lücke (vorher `atRisk`, `broken` oder `active` mit `rescue`, danach `active` mit mindestens `restoredDays`), zeigt das Banner „Serie gerettet: N Tage“. Trifft es zugleich eine Schwelle, nennt das Banner die Schwelle und darunter „Serie gerettet“, nie zwei Banner.
9. **Eine Haptik je Speichern.** Bringt das Speichern eine Feier, lässt `save` sein eigenes `confirm` weg; die Feier summt, wenn sie sich zeigt (bei der kleinen Stufe also erst, wenn der Chip pulsiert).
10. **Chip-Puls wird vorgemerkt.** Die Tabs laufen mit `freezeOnBlur`, und der Editor liegt als Modal über ihnen. `useChipPulse` spielt den Puls, sobald „Heute“ fokussiert ist und der Chip zu sehen ist.
11. **Bewegung reduzieren** (`useReducedMotion` aus Reanimated): kein Puls, kein Einfliegen, keine Funken; Banner und Overlay stehen still da. Das Overlay hat `accessibilityViewIsModal`, einen beschrifteten Schließen-Knopf und schließt mit der Zurück-Taste, das Banner ist eine höfliche Live-Region.
12. **Erfolge-Fokus.** `/achievements?focus=<key>` scrollt die Karte in die Mitte (Lage aus `onLayout` von Gruppe und Karte, weil die Karte ihre Lage relativ zur Gruppe meldet) und lässt ihren Rahmen etwa 1,5 Sekunden in der Akzentfarbe pulsieren. Der Parameter wird sofort mit `router.setParams` zurückgenommen, damit ein späterer Tab-Wechsel nicht erneut scrollt. Der StarToast übergibt das Erfolg mit den meisten neuen Sternen, der Willkommens-Toast keinen.
13. **Bernstein in der Palette.** `amber` (`#8A4B00`) auf `amberSoft` (`#FFE9C2`) und direkt auf Seite und Karte, in `contrast.test.ts` geprüft.

## Ein Platz für alles, was über den Seiten liegt

`lib/store/overlays.ts` (`useOverlayStore`) hält, wer gerade etwas zeigen will (`waiting`), und gibt den Platz nach Vorrang: `reminderPrompt` (Start-Sheet, Teil B) vor `streak` (Feier) vor `stars` (StarToast). Es ist immer nur eines zu sehen, die anderen warten. Kommt ein höheres dazu, verdrängt es das niedrigere; ein verdrängter StarToast zählt nicht als gesehen und kommt danach wieder.

- `useOverlaySlot(kind, wants)` fragt den Platz an, solange `wants` wahr ist, und liefert, ob diese Art gerade dran ist.
- `overlayBlocked(pathname)` hält alle Overlays über Editor, Foto und neuem Wendepunkt zurück (vorher nur im StarToast).
- Die Overlays hängen in `app/_layout.tsx` im Zweig ohne Sperrbildschirm, nie darüber.

Das Start-Sheet der Erinnerung (`components/reminders/ReminderPrompt.tsx`) hängt dort vor `<StreakCelebration />` und `<StarToast />` und meldet sich mit `useOverlaySlot('reminderPrompt', …)` an. Damit wartet der Willkommens-Toast, bis das Sheet geschlossen ist.

## Erinnerungen (Teil B)

| Datei | Inhalt |
| --- | --- |
| `lib/notifications/plan.ts` | Plan für Abend (`daily:D`) und Morgen (`yesterday:D`) mit Text, Ziel des Tipps (`openDate`) und Signatur samt Text. `yesterdayCandidates` (Morgen), `doneReminderKeys` (angezeigte, aber erledigte), `entryLink` |
| `lib/notifications/prompt.ts` | `shouldOfferReminder`: ob das Start-Sheet fragt |
| `lib/notifications/useReminderSync.ts`, `client.ts` | Texte je Erinnerung übersetzen, mit Deep Link stellen, erledigte von der Leiste nehmen |
| `modules/daylight-reminders` | `schedule` nimmt einen Link, `dismiss` entfernt angezeigte Benachrichtigungen (Details in `erinnerungen-ohne-firebase.md`) |
| `components/reminders/ReminderPrompt.tsx` | Start-Sheet |
| `app/more/reminders.tsx` | Zweiter Schalter „Erinnerung am nächsten Morgen“ mit eigener Uhrzeit |
| `app/_layout.tsx`, `app/entry/new.tsx`, `app/entry/[id].tsx` | `unstable_settings.anchor`, Start-Sheet, Editor mit `key` |

Tests: `lib/notifications/__tests__/plan.test.ts` (erweitert), `prompt.test.ts`, `components/reminders/__tests__/prompt.test.tsx`.

1. **Morgen-Erinnerung am Tag D nur, wenn D-1 fehlt und D-2 einen Eintrag hat.** Damit kommt sie höchstens einmal je Lücke. Weil der Plan bei jedem Start, jeder Rückkehr und jedem Schreiben neu entsteht, reicht es, aus heute (T) drei Kandidaten abzuleiten: T, wenn T-1 fehlt, T-2 einen Eintrag hat und die Uhrzeit noch nicht vorbei ist; T+1, wenn T leer ist und T-1 einen Eintrag hat; T+2, wenn T einen Eintrag hat (T+1 gilt als leer, ein Eintrag dort plant ohnehin neu). T+1 und T+2 schließen sich aus, möglich ist also z. B. {T, T+2}. Alle Kombinationen sind getestet. Sie gilt nur mit der täglichen Erinnerung (`reminder_enabled`) und hat eigenen Schalter und eigene Uhrzeit (Standard an, 10:00).
2. **Text mit Zahl nur in der jeweils nächsten Erinnerung jeder Art.** Weiter im Voraus geplante bekommen den allgemeinen Text, weil die Zahl bis dahin veraltet sein kann. Abend: „Wie war dein Tag? Tag N deiner Serie.“ nur, wenn D-1 einen Eintrag hat; N ist der Lauf bis D-1 plus D, also mindestens 2 (Abend an T ohne Eintrag heute, gestern mit Eintrag: Länge + 1). Morgen: „Gestern fehlt noch. Trag es nach, dann bleiben deine N Tage.“ mit N = Lauf bis D-2 (bei N = 1 „dann geht deine Serie weiter“), sonst „Gestern fehlt noch ein Eintrag.“.
3. **Die Signatur des Plans enthält Titel, Text und Ziel.** Wächst die Serie, ändert sich der Text, und die Erinnerungen werden neu gestellt. Ein Sprachwechsel ändert die Texte und damit ebenfalls die Signatur. Seit 2026-10-15 gehört auch die Zeitzone dazu, siehe `docs/decisions/erinnerungen-ohne-firebase.md`, Zeitzone.
4. **Tipp öffnet den passenden Tag.** JS baut den Link `daylight://entry/new?date=…` (Abend: der Tag selbst, Morgen: der Tag davor) und übergibt ihn an `schedule`. Das Modul speichert ihn mit, öffnet ihn als `ACTION_VIEW` mit dem Link als Daten auf die Launch-Activity (nur so meldet React Native die URL an JS) und gibt jeder Erinnerung einen eigenen `requestCode`. `export const unstable_settings = { anchor: '(tabs)' }` in `app/_layout.tsx` legt beim Kaltstart die Tabs unter den Editor, „Zurück“ führt zu „Heute“. Ist die App-Sperre aktiv, liegt der Sperrbildschirm über dem Navigator, der Editor ist nach dem Entsperren da. Der Editor ist nach Tag (bzw. Eintrag) geschlüsselt, damit ein Link bei offenem Editor den richtigen Tag zeigt.
5. **Angezeigte Erinnerungen erledigter Tage verschwinden.** Bei jedem Abgleich nimmt `dismiss` die Abend-Erinnerungen von Tagen mit Eintrag und die Morgen-Erinnerungen, deren Vortag nachgetragen ist, aus der Leiste (die letzten 14 Tage, unbekannte IDs sind harmlos).
6. **Start-Sheet einmal.** Neuinstallationen beim ersten Start, bestehende Installationen einmal nach dem Update, wenn die Erinnerung aus ist. Nur auf „Heute“ (Pfad `/`, also nicht über Editor oder Import), nie über dem Sperrbildschirm, vor Feier und StarToast. Ohne natives Modul (Expo Go) bleibt es weg, ohne als beantwortet zu gelten. „Erinnern“ fragt die Berechtigung; gewährt: tägliche Erinnerung zur gewählten Uhrzeit (Standard 20:30) und Morgen-Erinnerung an. Abgelehnt: alles bleibt aus, das Sheet zeigt fünf Sekunden „Du kannst sie jederzeit unter Mehr › Erinnerung einschalten.“ und schließt. „Später“ und die Zurück-Taste schließen. In jedem Fall steht danach `reminder_prompt_done`, und es fragt nie wieder. Ein Tipp neben das Sheet schließt es nicht, weil das endgültig wäre. Wer die Erinnerung unter „Mehr“ einschaltet, beantwortet das Sheet damit ebenfalls.
7. **Texte ehrlich.** „Verrät nichts aus dem Tagebuch“ stimmt nicht mehr ganz: Die Zahl der Serie und „Gestern fehlt“ sagen etwas über die Nutzung. `reminders.discreet` und `privacy.reminders` sagen jetzt, dass der Text höchstens die Länge der Serie oder den fehlenden Vortag nennt, nie Inhalte.

## Sicherung

- `reminder_yesterday_enabled` und `reminder_yesterday_time` gehen wie `reminder_enabled` in die JSON-Sicherung. Im zod-Schema nur `.optional()`, ohne Standardwert: ein Ersetzen-Import schreibt die Einstellungen so, wie sie kommen, und eine ältere Sicherung soll die Wahl auf diesem Gerät nicht zurücksetzen (getestet). Zusammenführen lässt die Einstellungen ohnehin in Ruhe.
- `reminder_prompt_done`, `streak_celebrated` und `streak_rescue_dismissed` gehören zum Gerät und stehen in der Ausschlussliste von `settingsForExport`.
- `reminder_prompt_done` bekommt keine SQL-Datenmigration (`drizzle/` wird nur generiert). `settleReminderPrompt` in `runMigrations` setzt es bei jedem Start auf wahr, wenn die Erinnerung schon an ist. „Alle Daten löschen“ legt die Zeile neu an, alles steht dann wieder auf dem Stand einer Neuinstallation (getestet).

## Offene Punkte

- **Auf dem Gerät prüfen:** Puls des Chips nach dem Schließen des Editors, Banner und Overlay mit und ohne „Bewegung reduzieren“, Zurück-Taste am Overlay, Mittelpunkt beim Scrollen in den Erfolgen (gerechnet mit der Fensterhöhe, nicht mit der Höhe der Scrollfläche).
- **Erinnerungen auf dem Gerät prüfen:** Deep Link kalt und warm (`adb shell am start -a android.intent.action.VIEW -d "daylight://entry/new?date=YYYY-MM-DD"`, dann über eine echte Benachrichtigung), Zurück vom Editor nach Kaltstart landet auf „Heute“, Link bei offenem Editor eines anderen Tages, Wiederherstellung nach Neustart behält den Link, `dismiss` entfernt die Benachrichtigung nach dem Speichern, Start-Sheet mit Ablehnung der Berechtigung. Der Kotlin-Teil ist ohne Build geschrieben.
- Erinnerungen, die vor diesem Update gestellt wurden, haben keinen Link und öffnen nur die App, bis der nächste Abgleich sie neu stellt (beim nächsten Öffnen).
- Auf Android verbirgt `accessibilityViewIsModal` die Seiten unter dem Overlay nicht vor TalkBack; das Overlay meldet sich als Live-Region.
