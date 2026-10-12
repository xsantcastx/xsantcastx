import type { RealmTownId, TownDef } from '../../play/world/world.model';
import { normaliseRoute, placeForRoute, worldPlaces } from './place-for-route';

describe('placeForRoute', () => {
  it('finds the Market in the Luminous town', () => {
    const place = placeForRoute('/market');
    expect(place).toEqual(jasmine.objectContaining({
      route: '/market', panel: 'market', stationId: 'market', townId: 'luminous',
      realmLabel: 'Luminous', href: '/play?at=market', queryParams: { at: 'market' },
    }));
    expect(place?.areaName).toBeTruthy();
  });

  it('prefers the town square over a hunt: the Seamworks bench, not the Homestead anvil', () => {
    const place = placeForRoute('/forge/crafting');
    expect(place?.townId).toBe('infernal');
    expect(place?.stationId).toBe('crafting');
    expect(place?.areaName).toBe('Basalt Seamworks');
  });

  it('places every hall that left the navbar', () => {
    const expected: Record<string, RealmTownId> = {
      '/market': 'luminous', '/gambler': 'umbral', '/exchange': 'umbral',
      '/forge/runes': 'infernal', '/forge/crafting': 'infernal', '/forge/enchanting': 'infernal',
      '/sanctum': 'verdant', '/codex': 'celestial', '/leaderboards': 'celestial',
      '/world/quests': 'verdant', '/world/arena': 'verdant', '/world/trials': 'verdant',
    };
    for (const [route, town] of Object.entries(expected)) {
      expect(placeForRoute(route)?.townId).withContext(route).toBe(town);
    }
  });

  it('ignores query, hash and a trailing slash', () => {
    expect(normaliseRoute('/codex/?tab=lore#x')).toBe('/codex');
    expect(placeForRoute('/codex?tab=lore')?.stationId).toBe('codex');
  });

  it('is null for a page with no station: Character, World, unknown URLs', () => {
    expect(placeForRoute('/character')).toBeNull();
    expect(placeForRoute('/world')).toBeNull();
    expect(placeForRoute('/play')).toBeNull();
    expect(placeForRoute('/nowhere')).toBeNull();
  });

  describe('with a fixture world', () => {
    const area = { background: 'bg', width: 1000, platforms: [], monsters: [], drops: { id: 'd', entries: [] }, spawnX: 10 };
    const hunt = { ...area, id: 'glade', name: 'The Glade', stations: [{ id: 'glade-stall', x: 50, label: 'STALL', kind: 'panel' as const, panel: 'market' as const }], hunts: [] };
    const verdant = { ...area, id: 'verdant', realm: 'verdant', name: 'Rootglass', stations: [], hunts: [hunt] } as unknown as TownDef;
    const registry = { market: { route: '/market' }, codex: { route: '/codex' } };

    it('falls back to a station in a hunting ground', () => {
      const place = placeForRoute('/market', { verdant }, registry);
      expect(place?.stationId).toBe('glade-stall');
      expect(place?.areaName).toBe('The Glade');
      expect(place?.townId).toBe('verdant');
    });

    it('ignores towns that are not built yet', () => {
      expect(placeForRoute('/market', { verdant: undefined }, registry)).toBeNull();
    });

    it('worldPlaces lists only the routes that have a station', () => {
      expect(worldPlaces({ verdant }, registry).map(p => p.route)).toEqual(['/market']);
    });
  });
});
