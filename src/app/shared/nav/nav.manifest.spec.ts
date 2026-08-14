import { CANONICAL } from '../canonical-routes';
import { MORE_NAV, NAV_MANIFEST, PRIMARY_NAV } from './nav.manifest';

describe('NAV_MANIFEST', () => {
  it('has exactly five primary destinations', () => {
    expect(PRIMARY_NAV.length).toBe(5);
  });

  it('primary routes are the PR0 player set', () => {
    expect(PRIMARY_NAV.map(d => d.route)).toEqual([
      CANONICAL.world,
      CANONICAL.character,
      '/market',
      CANONICAL.forge,
      '/codex',
    ]);
  });

  it('does not list unimplemented chrome destinations', () => {
    const routes = NAV_MANIFEST.map(d => d.route);
    for (const banned of ['/social', '/guild', '/inventory', '/settings']) {
      expect(routes).not.toContain(banned);
    }
  });

  it('marks World as an exact active match', () => {
    const world = PRIMARY_NAV.find(d => d.id === 'world');
    expect(world?.exact).toBeTrue();
    expect(world?.route).toBe(CANONICAL.world);
  });

  it('pins remounted halls to CANONICAL', () => {
    expect(PRIMARY_NAV.find(d => d.id === 'character')?.route).toBe(CANONICAL.character);
    expect(PRIMARY_NAV.find(d => d.id === 'forge')?.route).toBe(CANONICAL.forge);
    expect(MORE_NAV.find(d => d.id === 'quests')?.route).toBe(CANONICAL.quests);
    expect(MORE_NAV.find(d => d.id === 'trials')?.route).toBe(CANONICAL.trials);
  });
});
