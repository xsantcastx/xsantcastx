/**
 * td-stones.spec.ts — a Spellstone going off in the fight (shared/spellstones, MobSystem.useStone): the spell at the
 * stone's rank, whatever the Keeper's trees hold, with no mana and no cooldown of its own.
 */
import type { EngineOptions } from '../engine/engine.model';
import { MobSystem, type MobHost } from './td-mobs';
import { SKILLS, skillVars } from './td-skills';

function world(): MobSystem {
  const keeper = { x: 0, y: 0 };
  const host: MobHost = {
    options: {} as EngineOptions, walkable: () => true, levelId: () => 'spec', player: () => keeper,
    hurtPlayer: () => undefined, healPlayer: () => undefined, swung: () => undefined,
  };
  const sys = new MobSystem(host);
  sys.aura = null;
  return sys;
}

describe('td-mobs: Spellstones', () => {
  it('casts at the stone\'s rank even when the Keeper holds no rank in the spell (any vocation can use one)', () => {
    const sys = world();
    sys.setRanks({});
    expect(sys.useAbility('dark-ward')).toBe('locked');
    expect(sys.useStone('dark-ward', 7)).toBeNull();
    expect(sys.ward).toBe(skillVars('dark-ward', 7)['absorb']);
    // The tree's rank is back where it was the moment after.
    expect(sys.rank('dark-ward')).toBe(0);
  });

  it('a higher-rank stone does more than a lower one, and the Keeper\'s own rank does not change it', () => {
    const lo = world(), hi = world();
    lo.setRanks({ 'dark-ward': 20 }); hi.setRanks({ 'dark-ward': 1 });
    lo.useStone('dark-ward', 1); hi.useStone('dark-ward', 12);
    expect(lo.ward).toBe(skillVars('dark-ward', 1)['absorb']);
    expect(hi.ward).toBe(skillVars('dark-ward', 12)['absorb']);
    expect(hi.ward).toBeGreaterThan(lo.ward);
  });

  it('costs no mana, and leaves the spell\'s own cooldown exactly as it was', () => {
    const sys = world();
    sys.setRanks({ 'dark-ward': 3 });
    sys.mana = 5;
    expect(SKILLS['dark-ward'].mana).toBeGreaterThan(5);
    expect(sys.useAbility('dark-ward')).toBe('mana');
    expect(sys.useStone('dark-ward', 3)).toBeNull();
    expect(sys.mana).toBe(5);
    expect(sys.cooldowns['dark-ward'] ?? 0).toBe(0);
    // While the spell cools from the bar, a stone still goes off and the cooldown is untouched.
    sys.mana = sys.maxMana;
    expect(sys.useAbility('dark-ward')).toBeNull();
    const cd = sys.cooldowns['dark-ward']!;
    expect(cd).toBeGreaterThan(0);
    expect(sys.useStone('dark-ward', 3)).toBeNull();
    expect(sys.cooldowns['dark-ward']).toBe(cd);
  });

  it('a stone that cannot go off says why and changes nothing', () => {
    const sys = world();
    const mana = sys.mana;
    expect(sys.useStone('drain-life', 4)).toBe('nofoe');
    expect(sys.mana).toBe(mana);
    expect(sys.useStone('ember-bolt', 4)).toBe('locked');
  });
});
