// Die Jahreszeit, in der Store-Icon und App-Icon auftreten, etwa 'herbst', oder null für das Logo.
// Ein Schalter für beide: store/graphics.html zeigt dann store/icon-<jahreszeit>.svg als Store-Icon,
// scripts/logo.mjs rendert das Icon auf dem Startbildschirm nach SEASONS[<jahreszeit>]. Nach dem
// Umschalten beides neu rendern, den Store-Eintrag hochladen und eine neue Version veröffentlichen
// (docs/development.md, Logo und Store-Grafiken).
window.SEASON = 'herbst';
