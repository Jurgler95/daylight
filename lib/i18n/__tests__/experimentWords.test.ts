import { resources } from '..';
import { LANGUAGES, type Language } from '../language';

/**
 * Experiments describe the own entries next to each other and never claim that something helped
 * (E5 in `docs/plans/experimente.md`). Every text under `experiments.*` is checked for the words of
 * cause, effect, cure and advice, per language, and for dashes. Only this branch: elsewhere the app
 * deliberately says "nicht Ursache und Wirkung".
 */
const FORBIDDEN: Record<Language, readonly string[]> = {
  de: ['wirk', 'effekt', 'verbesser', 'heil', 'empfehl'],
  en: ['effect', 'works', 'improv', 'cure', 'treat', 'recommend'],
  es: ['efect', 'funciona', 'mejor', 'curar', 'tratamiento', 'recomend', 'recomiend'],
  fr: ['effet', 'efficac', 'amélior', 'guéri', 'traitement', 'recommand', 'conseil'],
  id: ['efek', 'manjur', 'berhasil', 'membaik', 'perbaik', 'sembuh', 'pengobatan', 'rekomendasi', 'sarankan'],
  it: ['effett', 'funziona', 'miglior', 'guari', 'trattament', 'consigli', 'curare'],
  nl: ['effect', 'werkt', 'verbeter', 'genees', 'behandel', 'aanbevel', 'aanrad'],
  pl: ['efekt', 'działa', 'popraw', 'lecz', 'polec', 'zalec', 'kuracj'],
  pt: ['efeito', 'funciona', 'melhor', 'curar', 'tratamento', 'recomend'],
  tr: ['etkis', 'etkil', 'işe yar', 'iyileş', 'tedavi', 'öner', 'tavsiye'],
};

type Tree = { [key: string]: string | Tree };

function texts(tree: Tree, prefix: string): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}.${key}`, value] as [string, string]] : texts(value, `${prefix}.${key}`),
  );
}

describe.each(LANGUAGES)('experiment texts in %s', (language) => {
  const own = texts((resources[language].translation as Tree).experiments as Tree, 'experiments');

  it('exist', () => {
    expect(own.length).toBeGreaterThan(50);
  });

  it('claim no effect, cure or advice', () => {
    const hits = own.flatMap(([key, text]) => {
      const lower = text.toLocaleLowerCase(language);
      return FORBIDDEN[language].filter((word) => lower.includes(word)).map((word) => `${key}: ${word}`);
    });
    expect(hits).toEqual([]);
  });

  it('use no dashes', () => {
    expect(own.filter(([, text]) => /[—–]/.test(text)).map(([key]) => key)).toEqual([]);
  });
});
