import { CANONICAL } from '../canonical-routes';
import { NAV_MANIFEST, PRIMARY_NAV } from './nav.manifest';

describe('NAV_MANIFEST', () => {
  it('is World only: Play and Character', () => {
    expect(NAV_MANIFEST.map(d => d.route)).toEqual(['/play', CANONICAL.character]);
    expect(PRIMARY_NAV).toEqual(NAV_MANIFEST.slice());
  });

  it('does not list unimplemented or retired destinations', () => {
    const routes = NAV_MANIFEST.map(d => d.route);
    for (const banned of ['/social', '/guild', '/inventory', '/settings', '/tools', '/mcp', '/donate', '/pro']) {
      expect(routes).not.toContain(banned);
    }
  });

  it('marks Play as an exact active match', () => {
    const play = PRIMARY_NAV.find(d => d.id === 'play');
    expect(play?.exact).toBeTrue();
    expect(play?.route).toBe('/play');
  });

  it('pins Character to CANONICAL', () => {
    expect(PRIMARY_NAV.find(d => d.id === 'character')?.route).toBe(CANONICAL.character);
  });

  it('gives both tabs painted icons', () => {
    for (const d of NAV_MANIFEST) expect(d.tabIcons).withContext(d.id).toBeTruthy();
  });
});
