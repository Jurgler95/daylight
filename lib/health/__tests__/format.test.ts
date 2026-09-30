import { formatDuration, formatDurationShort, formatSteps } from '../format';

describe('health formatting', () => {
  it('groups steps with a dot', () => {
    expect(formatSteps(412)).toBe('412');
    expect(formatSteps(8412)).toBe('8.412');
    expect(formatSteps(12345.6)).toBe('12.346');
  });

  it('writes durations in hours and minutes', () => {
    expect(formatDuration(440)).toBe('7 h 20 min');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(480)).toBe('8 h');
    expect(formatDurationShort(440)).toBe('7:20 h');
    expect(formatDurationShort(425)).toBe('7:05 h');
  });
});
