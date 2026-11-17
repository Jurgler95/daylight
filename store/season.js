// Das Design, in dem das Store-Icon auftritt: ein Schlüssel aus lib/seasons/designs.ts ('fruehling',
// 'sommer', 'herbst', 'winter', 'ostern', 'halloween', 'weihnachten', 'silvester', 'neujahrsfest')
// oder null für das Logo. store/graphics.html zeigt dann store/icon-<schlüssel>.svg als Store-Icon.
// Das Icon auf dem Startbildschirm hängt nicht mehr hieran, das wählt das Gerät selbst nach dem Datum.
// Die geplante Action .github/workflows/store-icon.yml setzt den Wert jeden Tag nach dem Kalender in
// lib/seasons/calendar.ts und lädt das neue Icon hoch (docs/development.md, Store-Grafiken).
window.SEASON = 'herbst';
