/**
 * Hermes on Android ships Intl without `PluralRules`, so i18next would fall back to "one" and
 * "other" only: Polish would read "5 wpisu" instead of "5 wpisów", French 0 would take "other".
 * The polyfill steps in only where `Intl.PluralRules` is missing or incomplete (not under Node).
 * Keep the locale list in step with `Language`.
 */
import '@formatjs/intl-pluralrules/polyfill.js';
import '@formatjs/intl-pluralrules/locale-data/de.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-pluralrules/locale-data/es.js';
import '@formatjs/intl-pluralrules/locale-data/fr.js';
import '@formatjs/intl-pluralrules/locale-data/id.js';
import '@formatjs/intl-pluralrules/locale-data/it.js';
import '@formatjs/intl-pluralrules/locale-data/nl.js';
import '@formatjs/intl-pluralrules/locale-data/pl.js';
import '@formatjs/intl-pluralrules/locale-data/pt.js';
import '@formatjs/intl-pluralrules/locale-data/tr.js';
