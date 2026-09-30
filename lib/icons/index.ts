import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

/**
 * Moods and activities carry a MaterialCommunityIcons glyph (a far larger set than Ionicons, with
 * weather, sleep and emoticons). The app chrome keeps using Ionicons. Type-only import, so pure
 * modules and Jest never load the icon font.
 */
export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export const FALLBACK_ACTIVITY_ICON: IconName = 'tag-outline';
