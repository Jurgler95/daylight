import type { IconName } from './index';

/**
 * The icons the pickers offer, in sections. A hand-picked set rather than all ~7000 glyphs:
 * enough for moods and everyday activities, small enough to scan. Every icon the import assigns
 * (`lib/daylio/known.ts`) is in here, so an imported activity can always be given its icon back.
 */
export interface IconSection {
  key: string;
  icons: readonly IconName[];
}

export const MOOD_ICONS: readonly IconName[] = [
  'emoticon-excited-outline',
  'emoticon-happy-outline',
  'emoticon-outline',
  'emoticon-neutral-outline',
  'emoticon-confused-outline',
  'emoticon-sad-outline',
  'emoticon-cry-outline',
  'emoticon-angry-outline',
  'emoticon-sick-outline',
  'emoticon-cool-outline',
  'emoticon-kiss-outline',
  'emoticon-lol-outline',
  'emoticon-tongue-outline',
  'emoticon-frown-outline',
  'emoticon-dead-outline',
  'emoticon-wink-outline',
  'emoticon-poop-outline',
  'emoticon-devil-outline',
];

export const ICON_SECTIONS: readonly IconSection[] = [
  { key: 'moods', icons: MOOD_ICONS },
  {
    key: 'feelings',
    icons: [
      'heart-outline',
      'hand-heart-outline',
      'flash-outline',
      'lightning-bolt-outline',
      'alert-outline',
      'spa-outline',
      'power-sleep',
      'weather-night',
      'thought-bubble-outline',
      'star-outline',
      'fire',
      'water-outline',
    ],
  },
  {
    key: 'sleep',
    icons: ['sleep', 'sleep-off', 'bed-outline', 'bed-king-outline', 'alarm', 'coffee-outline'],
  },
  {
    key: 'weather',
    icons: [
      'weather-sunny',
      'weather-partly-cloudy',
      'weather-cloudy',
      'weather-rainy',
      'weather-pouring',
      'weather-windy',
      'weather-snowy',
      'weather-lightning',
      'weather-fog',
      'thermometer-high',
      'thermometer-low',
      'umbrella-outline',
    ],
  },
  {
    key: 'people',
    icons: [
      'human-male-female-child',
      'account-multiple',
      'account-group-outline',
      'account-group',
      'account-outline',
      'heart-multiple-outline',
      'party-popper',
      'baby-face-outline',
      'dog',
      'cat',
      'phone-outline',
      'message-outline',
    ],
  },
  {
    key: 'work',
    icons: [
      'briefcase-outline',
      'check-circle-outline',
      'clock-alert-outline',
      'laptop',
      'school-outline',
      'book-education-outline',
      'beach',
      'hospital-box-outline',
      'calendar-check-outline',
      'cash',
      'email-outline',
      'office-building-outline',
    ],
  },
  {
    key: 'leisure',
    icons: [
      'home-outline',
      'cart-outline',
      'airplane',
      'car-outline',
      'train',
      'bike',
      'pine-tree',
      'movie-open-outline',
      'silverware-fork-knife',
      'sofa-outline',
      'book-open-variant',
      'gamepad-variant-outline',
      'run',
      'dumbbell',
      'swim',
      'yoga',
      'music-note-outline',
      'guitar-acoustic',
      'palette-outline',
      'camera-outline',
      'television-classic',
      'flower-outline',
      'walk',
      'hiking',
    ],
  },
  {
    key: 'health',
    icons: [
      'pill',
      'medical-bag',
      'stethoscope',
      'tooth-outline',
      'head-alert-outline',
      'water',
      'food-apple-outline',
      'glass-wine',
      'beer-outline',
      'smoking',
      'scale-bathroom',
      'shower',
    ],
  },
  {
    key: 'other',
    icons: ['tag-outline', 'broom', 'washing-machine', 'tools', 'hammer', 'leaf', 'church-outline', 'meditation', 'cellphone', 'gift-outline', 'map-marker-outline', 'flag-outline'],
  },
];
