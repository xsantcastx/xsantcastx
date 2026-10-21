/**
 * loot.spec.ts — drop tables and rates, the rarity mapping, aura math (Conviction
 * included), runeword (Socket Word) aura assembly, packs, difficulty and the save.
 */
import { RUNE_TIERS } from '../rune-forge/rune.model';
import { mintEquipment } from '../rpg/item-definition';
import { UNIQUE_ITEMS } from '../rpg/unique-items';
import type { GameItem } from '../rpg/item.model';
import { SOCKET_WORDS } from '../enchanting/socket-words';
import { RARITY_COLORS } from '../../play/engine/loot-fx';
import { LOOT_TIER_FX, LOOT_TIER_ORDER, shownUnderFilter } from './loot-tiers';
import {
  DROP_POOL, RUNG_LEVEL, expectedDropsPerHour, rarityChances, rarityOdds, rollCreatureLoot, runeCeiling, runeOdds, uniquesAt,
} from './drop-tables';
import { AURA_IDS, auraEffect, pickAura, type AuraSource } from './auras';
import { effectiveResist, isImmune, keeperResist, mitigate } from './damage.model';
import { AURA_LEVEL_BY_TIER, itemAuras, runeResist, wornAuraSources, wornResists } from './aura-sources';
import { MIN_WINDUP, packWindup, rollPack, seededRandom } from './champions';
import { creatureProfile, creatureResists, monsterLevel } from './creature-families';
import { DIFFICULTIES, deathCost, unlockedBy } from './difficulty.model';
import { coerceLoot, defaultLoot, mergeLoot } from './loot-save.model';

function socketed(defId: string, rarity: GameItem['rarity'], sockets: string[], equipped = true): GameItem {
  const item = mintEquipment(defId, rarity, seededRandom(1), '2026-10-15T00:00:00.000Z', `t-${defId}-${sockets.join('-')}`)!;
  return { ...item, sockets, equipped, slot: equipped ? (defId === 'eclipse-longblade' ? 'weapon' : 'chest') : undefined };
}

describe('loot tiers — one ladder, read the Diablo way', () => {
  it('maps every rung of the rune ladder, with its own colour, and louder going up', () => {
    expect(LOOT_TIER_ORDER.length).toBe(Object.keys(RUNE_TIERS).length);
    for (const tier of LOOT_TIER_ORDER) expect(RARITY_COLORS[tier]).withContext(tier).toBe(RUNE_TIERS[tier].color);
    for (let i = 1; i < LOOT_TIER_ORDER.length; i++) {
      const a = LOOT_TIER_FX[LOOT_TIER_ORDER[i - 1]], b = LOOT_TIER_FX[LOOT_TIER_ORDER[i]];
      expect(b.beam).withContext(b.tier).toBeGreaterThan(a.beam);
      expect(b.sparkles).withContext(b.tier).toBeGreaterThanOrEqual(a.sparkles);
    }
    expect(LOOT_TIER_FX.legendary.sfx).toBe('drop-legendary');
    expect(LOOT_TIER_FX.common.sfx).toBeNull();
    expect(LOOT_TIER_FX.rare.pip).toBeTrue();
    expect(LOOT_TIER_FX.uncommon.pip).toBeFalse();
  });

  it('the filter hides commons (then uncommons), never coins', () => {
    expect(shownUnderFilter('common', 'all')).toBeTrue();
    expect(shownUnderFilter('common', 'hide-common')).toBeFalse();
    expect(shownUnderFilter(undefined, 'hide-common')).toBeFalse();
    expect(shownUnderFilter(undefined, 'hide-common', true)).toBeTrue();
    expect(shownUnderFilter('uncommon', 'hide-common')).toBeTrue();
    expect(shownUnderFilter('uncommon', 'rare-plus')).toBeFalse();
    expect(shownUnderFilter('rare', 'rare-plus')).toBeTrue();
  });
});

describe('drop tables and rates', () => {
  it('odds sum to one and gate the top rungs by level (a boss ignores the gate)', () => {
    for (const level of [1, 8, 20, 60]) {
      const o = rarityOdds(level, 0, 0);
      const sum = LOOT_TIER_ORDER.reduce((s, t) => s + o[t], 0);
      expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
      for (const t of LOOT_TIER_ORDER) if (level < RUNG_LEVEL[t]) expect(o[t]).withContext(`${t}@${level}`).toBe(0);
    }
    expect(rarityOdds(1, 0, 2, true).legendary).toBeGreaterThan(0);
  });

  it('Magic Find never makes the top rungs less likely, with diminishing returns', () => {
    const at = (mf: number) => rarityOdds(30, mf, 0);
    let prev = at(0);
    for (const mf of [50, 100, 200, 400]) {
      const now = at(mf);
      for (const t of ['legendary', 'mythic', 'singular'] as const) expect(now[t]).withContext(`${t}@${mf}`).toBeGreaterThanOrEqual(prev[t]);
      prev = now;
    }
    expect(at(400).legendary / at(0).legendary).toBeLessThan(2.7);
  });

  it('the higher the rung, the harder Magic Find is damped (D2: linear, 600, 500, 250, 150), and legendary+ stays an event', () => {
    const at = (mf: number) => rarityChances(30, mf, 0);
    const lift = (t: 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic') => at(300)[t] / at(0)[t];
    expect(at(100).uncommon / at(0).uncommon).toBeCloseTo(2, 9); // linear (the chance caps at 0.9 only far past any gear)
    expect(lift('rare')).toBeGreaterThan(lift('epic'));
    expect(lift('epic')).toBeGreaterThan(lift('legendary'));
    expect(lift('legendary')).toBeGreaterThan(lift('mythic'));
    expect(lift('mythic')).toBeLessThan(2.1);
    // An hour of 240 ordinary kills at level 20 and 100% Magic Find: well under one legendary-or-better.
    const per = expectedDropsPerHour({ creature: 'shadeling', level: 20, tier: 'normal', magicFind: 100, rank: 'normal' }, 240);
    expect(per.legendary + per.mythic + per.singular).toBeLessThan(0.3);
  });

  it('rolls are deterministic for a seed, bosses always drop, and uniques land only at their authored rarity', () => {
    const ctx = { creature: 'graftmother', level: 16, tier: 'normal' as const, magicFind: 0, rank: 'boss' as const };
    expect(rollCreatureLoot(ctx, seededRandom(5))).toEqual(rollCreatureLoot(ctx, seededRandom(5)));
    const rng = seededRandom(11);
    for (let i = 0; i < 400; i++) {
      const drops = rollCreatureLoot(ctx, rng);
      expect(drops.filter(d => d.kind === 'item').length).toBe(3);
      for (const d of drops) if (d.kind === 'item' && d.unique) {
        expect(uniquesAt(d.rarity).some(u => u.id === d.definitionId)).withContext(d.definitionId).toBeTrue();
      }
    }
  });

  it('the base pool is the Gambler\'s: no named uniques, nothing soulbound, everything rolls', () => {
    const uniques = new Set(UNIQUE_ITEMS.map(u => u.id));
    expect(DROP_POOL.length).toBeGreaterThan(10);
    for (const d of DROP_POOL) {
      expect(uniques.has(d.id)).withContext(d.id).toBeFalse();
      expect(!!d.soulbound).withContext(d.id).toBeFalse();
      expect(d.rollKeys.length).withContext(d.id).toBeGreaterThan(0);
    }
  });

  it('the rune ceiling is the difficulty\'s: Normal never drops past Rare', () => {
    expect(runeCeiling(200, 'normal')).toBe('rare');
    expect(runeCeiling(200, 'nightmare')).toBe('legendary');
    expect(runeCeiling(200, 'hell')).toBe('singular');
    expect(runeCeiling(1, 'hell')).toBe('common');
    const o = runeOdds(200, 'normal');
    expect(o.epic + o.legendary + o.mythic + o.singular).toBe(0);
  });

  it('a seeded sample agrees with the analytic per-hour table', () => {
    const ctx = { creature: 'shadeling', level: 12, tier: 'normal' as const, magicFind: 0, rank: 'normal' as const };
    const rng = seededRandom(99);
    const n = 20000;
    let rarePlus = 0;
    for (let i = 0; i < n; i++) for (const d of rollCreatureLoot(ctx, rng)) if (LOOT_TIER_ORDER.indexOf(d.rarity) >= 2) rarePlus++;
    const want = expectedDropsPerHour(ctx, n);
    const expected = LOOT_TIER_ORDER.slice(2).reduce((s, t) => s + want[t], 0);
    expect(Math.abs(rarePlus - expected) / expected).toBeLessThan(0.15);
  });
});

describe('damage, resists and auras', () => {
  it('Conviction lowers a creature\'s resist, at a fifth against an immunity', () => {
    const conviction = auraEffect('conviction', 1).resistLower;
    expect(conviction).toBe(20);
    expect(auraEffect('conviction', 20).resistLower).toBe(85);
    expect(effectiveResist(40, conviction)).toBe(20);
    expect(effectiveResist(120, 85)).toBe(103);
    expect(isImmune(120, 85)).toBeTrue();
    expect(isImmune(105, 85)).toBeFalse();
    expect(mitigate(100, 40, 0)).toBe(60);
    expect(mitigate(100, 40, conviction)).toBe(80);
    expect(mitigate(100, 0, 52)).toBe(152);
  });

  it('the Keeper\'s resist takes the tier\'s penalty and caps at 75', () => {
    expect(keeperResist(50, DIFFICULTIES.nightmare.resistPenalty)).toBe(10);
    expect(keeperResist(300, DIFFICULTIES.hell.resistPenalty)).toBe(75);
    expect(keeperResist(0, DIFFICULTIES.hell.resistPenalty, 25)).toBe(-100);
  });

  it('every aura does exactly one kind of thing at level 1', () => {
    const fx = (id: typeof AURA_IDS[number]) => auraEffect(id, 1);
    expect(fx('might').damage).toBeCloseTo(1.15, 5);
    expect(fx('fanaticism').attackSpeed).toBeCloseTo(1.15, 5);
    expect(fx('vigor').moveSpeed).toBeCloseTo(1.12, 5);
    expect(fx('prayer').regen).toBe(1.5);
    expect(fx('redemption').healPerCorpse).toBe(8);
    expect(fx('holy-fire').pulseDamage).toBe(5);
    expect(fx('holy-freeze').slow).toBeCloseTo(0.3, 5);
    expect(fx('holy-shock').pulseDamage).toBe(6);
  });

  it('one aura runs: the chosen one if worn, else the strongest', () => {
    const src = (aura: AuraSource['aura'], level: number): AuraSource => ({ aura, level, from: aura, name: aura });
    const worn = [src('might', 2), src('conviction', 7), src('prayer', 7)];
    expect(pickAura(worn, null)!.aura).toBe('conviction');
    expect(pickAura(worn, 'might')!.aura).toBe('might');
    expect(pickAura(worn, 'vigor')!.aura).toBe('conviction');
    expect(pickAura([], 'might')).toBeNull();
  });
});

describe('Socket Words assemble auras; armour runes ward', () => {
  it('a rare weapon spelling Verdict (Hollow · Sigil) carries Conviction at the word\'s tier', () => {
    const blade = socketed('eclipse-longblade', 'rare', ['hollow', 'sigil']);
    const auras = itemAuras(blade);
    expect(auras.length).toBe(1);
    expect(auras[0].aura).toBe('conviction');
    expect(auras[0].level).toBe(AURA_LEVEL_BY_TIER.rare);
    // Order matters: the reverse spells nothing.
    expect(itemAuras(socketed('eclipse-longblade', 'rare', ['sigil', 'hollow'])).length).toBe(0);
    // Tempering lifts it a level per three.
    expect(itemAuras({ ...blade, upgradeLevel: 6 })[0].level).toBe(AURA_LEVEL_BY_TIER.rare + 2);
  });

  it('only what the Keeper wears counts (not the bag, not an explorer)', () => {
    const worn = socketed('eclipse-longblade', 'rare', ['hollow', 'sigil']);
    expect(wornAuraSources([worn]).length).toBe(1);
    expect(wornAuraSources([{ ...worn, equipped: false }]).length).toBe(0);
    expect(wornAuraSources([{ ...worn, explorerId: 'x1' }]).length).toBe(0);
  });

  it('every aura has a source, and every aura word fits its frame', () => {
    for (const id of AURA_IDS) {
      const from = SOCKET_WORDS.filter(w => w.aura === id).length + UNIQUE_ITEMS.filter(u => u.aura === id).length;
      expect(from).withContext(id).toBeGreaterThan(0);
    }
  });

  it('runes in armour ward against their realm\'s element; in a weapon they do not', () => {
    expect(runeResist('ember')).toEqual({ fire: 6 });
    expect(runeResist('void')).toEqual({ fire: 20, cold: 20, lightning: 20, arcane: 20 });
    const chest = socketed('infernal-cuirass', 'epic', ['ember', 'veil']);
    expect(wornResists([chest])).toEqual({ fire: 6, cold: 9 });
    expect(wornResists([socketed('eclipse-longblade', 'rare', ['ember', 'veil'])])).toEqual({});
  });
});

describe('creatures, packs and difficulty', () => {
  it('levels add depth and the tier; resists climb with the tier', () => {
    expect(monsterLevel('rivet-maw')).toBe(1);
    expect(monsterLevel('rivet-maw', 80)).toBe(3);
    expect(monsterLevel('rivet-maw', 0, 'hell')).toBe(41);
    expect(creatureResists('banked-ember', 'normal').fire).toBe(75);
    expect(creatureResists('banked-ember', 'hell').fire).toBe(105);
    expect(creatureProfile('nobody-yet').role).toBe('melee');
  });

  it('packs are deterministic, never bosses, never the first hunt, and keep a readable wind-up', () => {
    expect(rollPack('shadeling', 12, false, 'normal', 'k')).toEqual(rollPack('shadeling', 12, false, 'normal', 'k'));
    expect(rollPack('graftmother', 16, true, 'hell', 'k').rank).toBe('boss');
    expect(rollPack('rivet-maw', 1, false, 'normal', 'k').rank).toBe('normal');
    let packs = 0;
    for (let i = 0; i < 2000; i++) if (rollPack('shadeling', 12, false, 'normal', `k${i}`).rank !== 'normal') packs++;
    expect(packs).toBeGreaterThan(80);
    expect(packs).toBeLessThan(260);
    expect(packWindup(0.85, 10)).toBe(MIN_WINDUP);
  });

  it('the gate boss opens the next tier; a fall costs a share of the purse and nothing else', () => {
    expect(unlockedBy('fallen-ephemeris', 'normal')).toBe('nightmare');
    expect(unlockedBy('fallen-ephemeris', 'hell')).toBeNull();
    expect(unlockedBy('rivet-maw', 'normal')).toBeNull();
    expect(deathCost(1000, 'normal')).toBe(50);
    expect(deathCost(1000, 'hell')).toBe(150);
    expect(deathCost(0, 'hell')).toBe(0);
  });
});

describe('loot save (godforge-loot)', () => {
  it('coerces junk, keeps the tier inside what is unlocked', () => {
    expect(coerceLoot(null)).toEqual(defaultLoot());
    const s = coerceLoot({ filter: 'rare-plus', tier: 'hell', unlocked: ['normal', 'nightmare'], seed: 5, aura: 'bogus' });
    expect(s.filter).toBe('rare-plus');
    expect(s.tier).toBe('normal');
    expect(s.aura).toBeNull();
    expect(s.seed).toBe(5);
  });

  it('merges: later settings win, tiers union, rolls take the higher, the later purse event wins', () => {
    const a = { ...defaultLoot(), filter: 'hide-common', updatedAt: 10, unlocked: ['normal', 'nightmare'], rolls: 4, purse: { area: 'a', x: 1, y: 2, gold: 9, tier: 'normal' }, purseAt: 5 };
    const b = { ...defaultLoot(), filter: 'rare-plus', updatedAt: 20, unlocked: ['normal'], rolls: 9, purse: null, purseAt: 6 };
    const m = coerceLoot(mergeLoot(a, b));
    expect(m.filter).toBe('rare-plus');
    expect(m.unlocked).toEqual(['normal', 'nightmare']);
    expect(m.rolls).toBe(9);
    expect(m.purse).toBeNull();
    expect(coerceLoot(mergeLoot(b, a))).toEqual(m);
  });
});
