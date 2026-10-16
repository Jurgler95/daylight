import { dialUrl, helplineFor, helplineName, regionOf } from '../helplines';

describe('helplines', () => {
  it('reads the region from any locale form', () => {
    expect(regionOf('pt-BR')).toBe('BR');
    expect(regionOf('de_AT')).toBe('AT');
    expect(regionOf('zh-Hans-CN')).toBe('CN');
    expect(regionOf('es-419')).toBeNull();
    expect(regionOf('fr')).toBeNull();
  });

  it('picks the line of the region, not of the language', () => {
    expect(helplineFor('de-DE')?.number).toBe('0800 111 0 111');
    expect(helplineFor('en-DE')?.number).toBe('0800 111 0 111');
    expect(helplineFor('es-MX')?.name).toBe('Línea de la Vida');
    expect(helplineFor('es-ES')?.number).toBe('024');
    expect(helplineFor('pt-BR')?.number).toBe('188');
    expect(helplineFor('pt-PT')).toBeNull();
    expect(helplineFor('fr')).toBeNull();
  });

  it('names the Swiss line as each language region knows it', () => {
    const swiss = helplineFor('fr-CH')!;
    expect(helplineName(swiss, 'fr')).toBe('La Main Tendue');
    expect(helplineName(swiss, 'de')).toBe('Die Dargebotene Hand');
    expect(helplineName(swiss, 'en')).toBe('Die Dargebotene Hand');
  });

  it('dials the digits only', () => {
    expect(dialUrl(helplineFor('de-DE')!)).toBe('tel:08001110111');
    expect(dialUrl(helplineFor('it-IT')!)).toBe('tel:0223272327');
  });
});
