/**
 * td-life.spec.ts — how long a top-down creature lasts (td-life.ts; loot-and-combat.md §13, scripts/combat-sim.mjs).
 *
 * The life a creature rises with is its authored life × lifeScale; the Hunting XP its kill pays still follows the
 * authored life, so the combat balance never moves leveling.md's pace.
 */
import type { EngineOptions } from '../engine/engine.model';
import { DIFFICULTIES } from '../../shared/loot/difficulty.model';
import { CREATURE_LIFE, lifeScale, livedHp } from './td-life';
import { MOBS, MobSystem, type MobHost } from './td-mobs';
import { SEAM_ID, seamStats } from './td-seam';

describe('td-life: creature life', () => {
  it('an ordinary creature rises ×1 at level 1, climbs to ×normal over the ramp, then on by perLevel; a boss ×boss', () => {
    expect(lifeScale(1)).toBe(1);
    expect(lifeScale(1 + CREATURE_LIFE.ramp)).toBeCloseTo(CREATURE_LIFE.normal, 9);
    expect(lifeScale(11 + CREATURE_LIFE.ramp)).toBeCloseTo(CREATURE_LIFE.normal + 10 * CREATURE_LIFE.perLevel, 9);
    for (let L = 1; L < 100; L++) expect(lifeScale(L + 1)).withContext(`L${L}`).toBeGreaterThanOrEqual(lifeScale(L));
    // A champion or unique made of an ordinary creature rises as the creature does; only a boss takes the boss factor.
    expect(lifeScale(20, 'champion')).toBe(lifeScale(20));
    expect(lifeScale(20, 'boss')).toBe(CREATURE_LIFE.boss);
    expect(livedHp(100, 20, 'boss')).toBe(100 * CREATURE_LIFE.boss);
  });

  it('MOBS is the risen table: the first hunt is untouched, the rest and every boss rise', () => {
    expect(MOBS['ash-wolf'].hp).toBe(45);
    expect(MOBS['rivet-maw'].hp).toBe(60);
    expect(MOBS['bone-walker'].hp).toBe(livedHp(80, 6));
    expect(MOBS['ember-warden'].hp).toBe(420 * CREATURE_LIFE.boss);
    // The Seam Eater's life is its own curve (td-seam), the same boss factor inside it.
    expect(MOBS[SEAM_ID].hp).toBe(seamStats(20).hp);
  });

  it('a kill pays Hunting XP on the authored life, whatever the creature rose with and on any tier', () => {
    for (const [id, authored, tier] of [['bone-walker', 80, 'normal'], ['ember-warden', 420, 'nightmare'], ['lava-hound', 120, 'hell']] as const) {
      const kills: { hp: number }[] = [], keeper = { x: 0, y: 0 };
      const host: MobHost = {
        options: { onKill: (e: { hp: number }) => { kills.push(e); }, rollLoot: () => [] } as unknown as EngineOptions,
        walkable: () => true, levelId: () => 'life', player: () => keeper,
        hurtPlayer: () => undefined, healPlayer: () => undefined, swung: () => undefined, playerHp: () => 1e6,
      };
      const sys = new MobSystem(host);
      sys.setTier(DIFFICULTIES[tier]);
      const m = sys.place('t', { ...MOBS[id], sight: 0 }, 200, 0);
      expect(m.hp).withContext(id).toBe(Math.round(MOBS[id].hp * DIFFICULTIES[tier].hp));
      sys.smite(m);
      expect(kills[0]?.hp).withContext(id).toBe(authored);
    }
  });
});
