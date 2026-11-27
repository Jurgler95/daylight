# Automatische Sicherung

Stand: 27.11.2026. Daylight schreibt die Sicherung selbst in einen Ordner, den man einmal wählt. Ohne Internet, ohne Konto und mit `allowBackup: false` war die Sicherung von Hand bisher der einzige Schutz gegen ein verlorenes Handy.

## Entscheidungen

1. **Ein Ordner über Androids Ordnerauswahl.** `Directory.pickDirectoryAsync` aus expo-file-system holt sich die Freigabe dauerhaft (`takePersistableUriPermission`), die URI steht in `settings.auto_backup_dir`. Keine neue Berechtigung, kein nativer Code. Liegt der Ordner in einer Sync-App, wandert die Sicherung von dort weiter.
2. **Kein Hintergrunddienst.** `useAutoBackup` im Root-Layout startet einen Lauf 5 Sekunden nach dem Start und 3 Sekunden nach der letzten Änderung an den Daten (Versionszähler aus `lib/store/dataVersion.ts`). Wer die App nicht öffnet, ändert auch nichts, was verloren gehen könnte.
3. **Höchstens einmal am Kalendertag, nur bei Änderungen.** Eine Prüfsumme der Daten (ohne `exported_at`) steht in `auto_backup_hash`; sind die Daten seit der letzten Sicherung gleich, wird nichts geschrieben. So schreibt die App nach dem Abendeintrag, nicht beim Öffnen davor. „Jetzt sichern“ übergeht beide Grenzen.
4. **Dieselbe Datei wie von Hand.** `buildExport` und `writeBackupArchive`: ohne Fotos JSON, mit Fotos ZIP (`daylight.json` plus `photos/`). Name `daylight-auto-JJJJ-MM-TT-HHMM.zip` bzw. `.json`, Ortszeit, sortiert nach Alter. Wiederherstellen über „Importieren“ wie bisher.
5. **Sieben Sicherungen bleiben.** Gelöscht wird nur, was genau dem Namensmuster entspricht; alles andere im Ordner, auch `daylight-export-…` von Hand und Kopien mit „ (1)“, bleibt. Mit Fotos kostet jede Sicherung die ganze Fotogröße, deshalb nicht mehr.
6. **Erst schreiben, dann löschen.** Bricht das Schreiben ab (voller Speicher), wird die halbe Datei entfernt und die älteren bleiben. Ein Fehler landet in `auto_backup_error` und `auto_backup_tried_at`; der nächste Versuch frühestens nach einer Stunde, damit ein fehlender Ordner nicht bei jedem Speichern probiert wird. Die App läuft weiter.
7. **Hinweis auf „Heute“.** Die bestehende Sicherungskarte kommt jetzt nach 30 statt 60 Tagen, weil man sie wegtippen kann (dann 30 Tage Ruhe) und sie zur automatischen Sicherung führt. Mit funktionierender automatischer Sicherung kommt keine Karte. Schlägt sie fehl und ist die letzte gute Sicherung 3 Tage alt, zeigt die Karte das (weggetippt 7 Tage Ruhe).
8. **Gerätelokal.** Alle neuen Spalten (`auto_backup_*`, `backup_hint_dismissed_on`) stehen nicht in der Sicherung, Migration `0018`.

## Offene Punkte

- **Gerät**: Ordner wählen, App neu starten, Eintrag speichern, nach einigen Sekunden liegt die Datei im Ordner. Freigabe in den Android-Einstellungen entziehen oder Ordner löschen, dann muss „Automatische Sicherung“ den Fehler zeigen.
- **Andere Anbieter als der interne Speicher**: Bei Ordnern anderer Dokumentanbieter kann der Dateiname aus der URI anders aussehen. Dann erkennt die App ihre Dateien nicht und löscht nichts (sicher, aber der Ordner wächst).
- **Große Fotosammlungen**: Die ZIP entsteht wie bei der Sicherung von Hand im Speicher und wird am Stück geschrieben. Bei Hunderten MB auf dem Gerät beobachten.
