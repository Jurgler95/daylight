import type { Language } from '../language';
import { content as es } from './es';
import { content as fr } from './fr';
import { content as id } from './id';
import { content as it } from './it';
import { content as nl } from './nl';
import { content as pl } from './pl';
import { content as pt } from './pt';
import { content as tr } from './tr';
import type { LanguageContent } from './types';

export type { ActivityKey, GroupKey, LanguageContent, SentenceKey } from './types';

/** The languages beyond German and English, whose names come from a content file. */
export type ContentLanguage = Exclude<Language, 'de' | 'en'>;

export const CONTENT: Record<ContentLanguage, LanguageContent> = { es, pt, fr, it, nl, pl, tr, id };
