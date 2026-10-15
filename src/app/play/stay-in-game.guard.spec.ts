import { staysInGame } from './stay-in-game.guard';
import { panelForRoute } from './world/panel-registry';

describe('stay-in-game guard', () => {
  it('lets the game navigate within itself and to the owner dashboard', () => {
    for (const url of ['/play', '/play?at=crafting', '/play?at=codex&tab=collection', '/admin', '/admin/players']) {
      expect(staysInGame(url)).withContext(url).toBe(true);
    }
  });

  it('refuses every other destination', () => {
    for (const url of ['/', '/world', '/codex', '/no-such-place', '/player', '/administrator']) {
      expect(staysInGame(url)).withContext(url).toBe(false);
    }
  });
});

describe('panelForRoute', () => {
  it('maps a retired page URL to the panel that replaced it', () => {
    expect(panelForRoute('/forge/crafting')).toBe('crafting');
    expect(panelForRoute('/character?item=x')).toBe('character');
    expect(panelForRoute('/world/realms/celestial/meridian-orrery')).toBe('orrery');
  });

  it('knows nothing of deleted pages', () => {
    expect(panelForRoute('/exchange')).toBeNull();
    expect(panelForRoute('/leaderboards')).toBeNull();
    expect(panelForRoute('/world')).toBeNull();
  });
});
