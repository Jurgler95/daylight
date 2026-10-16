import { CONTENT } from '@/lib/i18n/content';
import { fold } from '@/lib/search/fold';

import { resources } from '..';
import { LANGUAGES } from '../language';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [inner, text] of flatten(value, path)) out.set(inner, text);
  }
  return out;
}

const PLURAL = /_(zero|one|two|few|many|other)$/;
const texts = Object.fromEntries(LANGUAGES.map((language) => [language, flatten(resources[language].translation as Tree)]));
const variables = (text: string) => [...text.matchAll(/\{\{\s*(\w+)/g)].map((match) => match[1]).sort();

describe.each(LANGUAGES)('locale %s', (language) => {
  const own = texts[language]!;
  const english = texts.en!;
  const base = (keys: Iterable<string>) => new Set([...keys].map((key) => key.replace(PLURAL, '')));

  it('has every text of the English file and nothing else', () => {
    expect([...base(own.keys())].sort()).toEqual([...base(english.keys())].sort());
  });

  it('has every plural form the language needs', () => {
    const categories = new Intl.PluralRules(language).resolvedOptions().pluralCategories;
    const plurals = base([...english.keys()].filter((key) => PLURAL.test(key)));
    for (const key of plurals) {
      for (const category of categories) expect(own.has(`${key}_${category}`) ? `${key}_${category}` : `missing ${key}_${category}`).toBe(`${key}_${category}`);
    }
  });

  it('keeps the variables of every text', () => {
    for (const [key, text] of own) {
      const reference = english.get(key) ?? english.get(key.replace(PLURAL, '_other'));
      if (reference === undefined) continue;
      expect([key, variables(text).filter((name) => name !== 'count')]).toEqual([key, variables(reference).filter((name) => name !== 'count')]);
    }
  });

  it('has no empty texts', () => {
    for (const [key, text] of own) expect([key, text.trim().length > 0]).toEqual([key, true]);
  });
});

describe.each(Object.entries(CONTENT))('default names in %s', (language, content) => {
  it('names every activity, mood and group once', () => {
    for (const names of [Object.values(content.activities), [...content.moods], Object.values(content.groups)]) {
      const folded = names.map(fold);
      expect([language, folded.filter((name, index) => folded.indexOf(name) !== index)]).toEqual([language, []]);
    }
  });
});

describe('mood names across languages', () => {
  it('never give one name two different levels', () => {
    const levels = new Map<string, number>();
    const sets: (readonly string[])[] = [['Super', 'Gut', 'Ok', 'Schlecht', 'Mies'], ['Great', 'Good', 'Okay', 'Bad', 'Awful'], ...Object.values(CONTENT).map((content) => content.moods)];
    for (const moods of sets) {
      moods.forEach((name, index) => {
        const level = 5 - index;
        expect([name, levels.get(fold(name)) ?? level]).toEqual([name, level]);
        levels.set(fold(name), level);
      });
    }
  });
});
