/**
 * Colours of the turning point screen, the one place that leaves the daylight palette: a night sky
 * that warms into dawn. Fixed, not themed. White text on `sky` and `skyLow` clears 7:1, `textSoft`
 * on both clears 4.5:1.
 */
export const DAWN = {
  sky: '#0B1433',
  skyMid: '#1C2A5E',
  skyLow: '#3B2F63',
  warm: '#C75B4A',
  sun: '#FFC15E',
  horizon: 'rgba(255, 214, 160, 0.55)',
  text: '#FFFFFF',
  textSoft: '#C9D2F2',
  field: 'rgba(255, 255, 255, 0.08)',
  fieldLine: 'rgba(255, 255, 255, 0.35)',
  star: '#FFFFFF',
} as const;
