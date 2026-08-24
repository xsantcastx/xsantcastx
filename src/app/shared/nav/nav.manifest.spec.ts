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

  it('MORE is the bench, quests, trials, sanctum, the exchange and the gambler only', () => {
    expect(MORE_NAV.map(d => d.route)).toEqual([
      // The crafting bench is a room reached from inside the Forge hall. Listed
      // here for the same reason the Gambler eventually had to be: a route only
      // linked from its parent page reads as a dead page to everyone who did
      // not happen to be standing on that page.
      '/forge/crafting',
      CANONICAL.quests,
      CANONICAL.trials,
      '/sanctum',
      // The Exchange is a hall in its own right, but the header row is already
      // five wide and does not shrink — see the nav-overflow note. The tome is
      // where it goes until that row can take a sixth.
      '/exchange',
      // Same reasoning, and the same kind of hall. Listed here rather than left
      // to the Market doorway alone, which is what made it read as a missing
      // page to anyone not already standing in the Market.
      '/gambler',
    ]);
    const routes = NAV_MANIFEST.map(d => d.route);
    for (const banned of ['/tools', '/mcp', '/blueprint', '/mission-control', '/sponsors', '/donate', '/pro']) {
      expect(routes).not.toContain(banned);
    }
  });
});
