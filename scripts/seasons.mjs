/**
 * Lädt die Designs und den Kalender aus `lib/seasons/` für die Skripte. Node 22.18+ entfernt die
 * Typen selbst, ohne Abhängigkeit; die Warnung, dass `package.json` keinen `type` nennt, ist hier
 * erwartet und wird ausgeblendet (die App nutzt dieselben Dateien über Metro).
 */
const [print] = process.listeners('warning');
if (print) {
  process.removeListener('warning', print);
  process.on('warning', (warning) => {
    if (warning.code !== 'MODULE_TYPELESS_PACKAGE_JSON') print(warning);
  });
}

export const designs = await import('../lib/seasons/designs.ts');
export const calendar = await import('../lib/seasons/calendar.ts');
