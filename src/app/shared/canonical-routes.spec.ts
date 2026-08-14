import {
  CANONICAL,
  canonicalizePlayerPath,
  rewriteCanonicalPageSet,
} from './canonical-routes';

describe('canonicalizePlayerPath', () => {
  it('collapses the World hub onto one path', () => {
    expect(canonicalizePlayerPath('/')).toBe(CANONICAL.world);
    expect(canonicalizePlayerPath('')).toBe(CANONICAL.world);
    expect(canonicalizePlayerPath('/home')).toBe(CANONICAL.world);
    expect(canonicalizePlayerPath('/world')).toBe(CANONICAL.world);
    expect(canonicalizePlayerPath('/home?lang=es')).toBe(CANONICAL.world);
  });

  it('aliases remounted halls', () => {
    expect(canonicalizePlayerPath('/forge-keeper')).toBe(CANONICAL.character);
    expect(canonicalizePlayerPath('/rune-forge')).toBe(CANONICAL.forge);
    expect(canonicalizePlayerPath('/forge')).toBe(CANONICAL.forge);
    expect(canonicalizePlayerPath('/quests')).toBe(CANONICAL.quests);
    expect(canonicalizePlayerPath('/arena')).toBe(CANONICAL.trials);
    expect(canonicalizePlayerPath('/games')).toBe(CANONICAL.trials);
  });

  it('does not collapse /arena/color-memory onto trials', () => {
    expect(canonicalizePlayerPath('/arena/color-memory')).toBe('/arena/color-memory');
    expect(canonicalizePlayerPath('/arena/realm-rush#score')).toBe('/arena/realm-rush');
  });

  it('collapses retired product paths onto World', () => {
    expect(canonicalizePlayerPath('/tools')).toBe(CANONICAL.world);
    expect(canonicalizePlayerPath('/tools/box-shadow-generator')).toBe(CANONICAL.world);
    expect(canonicalizePlayerPath('/tools?realm=luminous')).toBe(CANONICAL.world);
    expect(canonicalizePlayerPath('/mission-control')).toBe(CANONICAL.world);
    expect(canonicalizePlayerPath('/blueprint')).toBe(CANONICAL.world);
    expect(canonicalizePlayerPath('/skills')).toBe(CANONICAL.world);
    expect(canonicalizePlayerPath('/projects')).toBe(CANONICAL.world);
  });
});

describe('rewriteCanonicalPageSet', () => {
  it('does not grow when a save already has /home and the visit is /world', () => {
    const next = rewriteCanonicalPageSet(['/home', '/codex']);
    expect(next).toEqual([CANONICAL.world, '/codex']);
    expect(rewriteCanonicalPageSet([...next, '/world'])).toEqual(next);
  });

  it('drops a legacy member when the canonical is already present', () => {
    expect(rewriteCanonicalPageSet(['/world', '/home', '/arena', '/world/trials']))
      .toEqual([CANONICAL.world, CANONICAL.trials]);
  });

  it('leaves arena games alone', () => {
    expect(rewriteCanonicalPageSet(['/arena/color-memory', '/arena']))
      .toEqual(['/arena/color-memory', CANONICAL.trials]);
  });
});
