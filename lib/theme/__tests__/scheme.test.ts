import { resolveScheme } from '../index';

describe('resolveScheme', () => {
  it('follows the device while the user chose "System"', () => {
    expect(resolveScheme(null, 'dark')).toBe('dark');
    expect(resolveScheme(null, 'light')).toBe('light');
  });

  it('falls back to light when the device says nothing', () => {
    expect(resolveScheme(null, null)).toBe('light');
    expect(resolveScheme(null, 'unspecified')).toBe('light');
  });

  it('keeps a fixed choice whatever the device does', () => {
    expect(resolveScheme('dark', 'light')).toBe('dark');
    expect(resolveScheme('light', 'dark')).toBe('light');
  });
});
