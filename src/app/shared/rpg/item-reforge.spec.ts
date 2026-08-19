import {
  REFORGE_GOLD,
  REFORGE_LOCK_MULTIPLIER,
  canReforgeItem,
  previewReforge,
  reforgeDeltas,
  reforgeGoldCost,
  reforgeKeys,
  reforgeVerdict,
  rollReforge,
} from './item-reforge';
import { itemDefinitionById, rollItemStats } from './item-definition';
import { ITEM_STAT_KEYS, type GameItem, type ItemRarity } from './item.model';

function item(defId: string, rarity: ItemRarity, over: Partial<GameItem> = {}): GameItem {
  const def = itemDefinitionById(defId)!;
  return {
    id: `${defId}-instance`,
    name: def.name,
    type: def.type,
    rarity,
    stats: rollItemStats(def, rarity, () => 0.5),
    sellValue: 10,
    equipped: false,
    foundAt: '2026-08-19T00:00:00.000Z',
    soulbound: false,
    definitionId: def.id,
    upgradeLevel: 0,
    ...over,
  };
}

/** Deterministic rng: walks a fixed ring so a test can pin an exact roll. */
function seeded(values: readonly number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('item-reforge', () => {
  // ── cost ──────────────────────────────────────────────────────────────────

  it('prices a reroll off rarity, at the owner-specified ladder', () => {
    expect(REFORGE_GOLD.common).toBe(500);
    expect(REFORGE_GOLD.uncommon).toBe(2_000);
    expect(REFORGE_GOLD.rare).toBe(10_000);
    expect(REFORGE_GOLD.epic).toBe(50_000);
    expect(REFORGE_GOLD.legendary).toBe(200_000);
    expect(REFORGE_GOLD.mythic).toBe(1_000_000);
    // Not in the brief; extrapolates the same step and is the only tier above Mythic.
    expect(REFORGE_GOLD.singular).toBe(5_000_000);
  });

  it('rises strictly with rarity, and every tier has a price', () => {
    const order: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'singular'];
    for (let i = 1; i < order.length; i++) {
      expect(REFORGE_GOLD[order[i]]).toBeGreaterThan(REFORGE_GOLD[order[i - 1]]);
    }
  });

  it('doubles the bill when a stat is locked', () => {
    expect(REFORGE_LOCK_MULTIPLIER).toBe(2);
    expect(reforgeGoldCost('rare')).toBe(10_000);
    expect(reforgeGoldCost('rare', true)).toBe(20_000);
    expect(reforgeGoldCost('mythic', true)).toBe(2_000_000);
  });

  // ── eligibility ───────────────────────────────────────────────────────────

  it('reforges anything with rolled stats and refuses anything without', () => {
    const blade = item('eclipse-longblade', 'rare');
    expect(canReforgeItem(blade)).toBe(true);
    expect(reforgeKeys(blade).length).toBeGreaterThan(0);

    // Nothing rolled and nothing the catalogue recognises. The name has to go
    // too: definitionFor falls back to matching by name, which is how a
    // pre-catalogue save still reforges correctly — asserted just below.
    const nothing: GameItem = { ...blade, definitionId: undefined, name: 'Unrecorded Trinket', stats: {} };
    expect(canReforgeItem(nothing)).toBe(false);
    expect(previewReforge(nothing)).toBeNull();
  });

  it('still reforges a legacy instance that has no definitionId, matching by name', () => {
    const legacy: GameItem = { ...item('eclipse-longblade', 'rare'), definitionId: undefined };
    expect(canReforgeItem(legacy)).toBe(true);
    expect(reforgeKeys(legacy)).toEqual(reforgeKeys(item('eclipse-longblade', 'rare')));
    expect(rollReforge(legacy, null, () => 0.99)).not.toEqual(legacy.stats);
  });

  it('lists the keys in ITEM_STAT_KEYS order so the panel rows never reshuffle', () => {
    const keys = reforgeKeys(item('eclipse-longblade', 'rare'));
    const positions = keys.map(k => ITEM_STAT_KEYS.indexOf(k));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('previews the cost, the keys and the stats about to be gambled', () => {
    const blade = item('eclipse-longblade', 'epic', { upgradeLevel: 3 });
    const preview = previewReforge(blade)!;
    expect(preview.gold).toBe(REFORGE_GOLD.epic);
    expect(preview.lockedGold).toBe(REFORGE_GOLD.epic * 2);
    expect(preview.rarity).toBe('epic');
    expect(preview.upgradeLevel).toBe(3);
    expect(preview.current).toEqual(blade.stats);
  });

  // ── the roll ──────────────────────────────────────────────────────────────

  it('produces a different roll from a different rng, same item and rarity', () => {
    const blade = item('eclipse-longblade', 'rare');
    const low = rollReforge(blade, null, () => 0.01);
    const high = rollReforge(blade, null, () => 0.99);
    expect(low).not.toEqual(high);
    for (const key of reforgeKeys(blade)) {
      expect(high[key]!).toBeGreaterThan(low[key]!);
    }
  });

  it('can come out worse — the whole point of the sink', () => {
    // Minted at the top of the band, rerolled at the bottom of it.
    const lucky = item('eclipse-longblade', 'rare', {
      stats: rollItemStats(itemDefinitionById('eclipse-longblade')!, 'rare', () => 0.999),
    });
    const rerolled = rollReforge(lucky, null, () => 0);
    const rows = reforgeDeltas(lucky.stats, rerolled, reforgeKeys(lucky));
    expect(rows.every(r => r.delta < 0)).toBe(true);
    expect(reforgeVerdict(rows)).toBe('worse');
  });

  it('stays inside the item\'s own rarity band — a reroll never launders rarity', () => {
    const def = itemDefinitionById('eclipse-longblade')!;
    const common = item('eclipse-longblade', 'common');
    const best = rollReforge(common, null, () => 0.999999);
    const ceiling = rollItemStats(def, 'common', () => 0.999999);
    for (const key of reforgeKeys(common)) {
      expect(best[key]!).toBeLessThanOrEqual(ceiling[key]!);
    }
  });

  it('holds a locked stat at exactly its old value and rerolls the rest', () => {
    const blade = item('eclipse-longblade', 'rare');
    const keys = reforgeKeys(blade);
    const lock = keys[0];
    const rerolled = rollReforge(blade, lock, () => 0.01);
    expect(rerolled[lock]).toBe(blade.stats[lock]);
    // Everything else genuinely moved.
    for (const key of keys.slice(1)) {
      expect(rerolled[key]).not.toBe(blade.stats[key]);
    }
  });

  it('ignores a lock on a key the item does not roll', () => {
    const blade = item('eclipse-longblade', 'rare');
    const notRolled = ITEM_STAT_KEYS.find(k => !reforgeKeys(blade).includes(k))!;
    const rerolled = rollReforge(blade, notRolled, () => 0.01);
    expect(rerolled[notRolled]).toBeUndefined();
    expect(Object.keys(rerolled).sort()).toEqual([...reforgeKeys(blade)].sort());
  });

  // ── temper interaction — the part that protects the player's investment ───

  it('keeps a tempered piece tempered: the fresh roll is re-raised once per level', () => {
    const base = item('eclipse-longblade', 'rare');
    const plain = item('eclipse-longblade', 'rare', { upgradeLevel: 0 });
    const tempered = item('eclipse-longblade', 'rare', { upgradeLevel: 5 });

    const rerolledPlain = rollReforge(plain, null, seeded([0.5]));
    const rerolledTempered = rollReforge(tempered, null, seeded([0.5]));

    // Same base roll underneath (same rng, same rarity, same definition), but
    // five temper passes have been re-applied on top of the tempered one.
    for (const key of reforgeKeys(base)) {
      expect(rerolledTempered[key]!).toBeGreaterThan(rerolledPlain[key]!);
    }
  });

  it('does not touch rarity, definition, slot or upgradeLevel — rollReforge returns stats only', () => {
    const blade = item('eclipse-longblade', 'legendary', { upgradeLevel: 4 });
    const before = JSON.stringify(blade);
    rollReforge(blade, null, () => 0.2);
    expect(JSON.stringify(blade)).toBe(before);
  });

  it('returns the stats unchanged when there is nothing to roll', () => {
    const blade = item('eclipse-longblade', 'rare');
    const orphan: GameItem = { ...blade, definitionId: 'no-such-definition' };
    expect(rollReforge(orphan, null, () => 0.5)).toEqual(orphan.stats);
  });

  // ── the readout ───────────────────────────────────────────────────────────

  it('reports every rerolled key, including the ones that did not move', () => {
    const keys = reforgeKeys(item('eclipse-longblade', 'rare'));
    const rows = reforgeDeltas({ goldPerSec: 1, strikePower: 2 }, { goldPerSec: 1, strikePower: 3 }, keys);
    expect(rows.length).toBe(keys.length);
    const flat = rows.find(r => r.key === 'goldPerSec')!;
    expect(flat.delta).toBe(0);
    const moved = rows.find(r => r.key === 'strikePower')!;
    expect(moved.delta).toBe(1);
  });

  it('flags the locked row rather than hiding it', () => {
    const keys = reforgeKeys(item('eclipse-longblade', 'rare'));
    const rows = reforgeDeltas({ goldPerSec: 1, strikePower: 2 }, { goldPerSec: 1, strikePower: 3 }, keys, 'goldPerSec');
    expect(rows.find(r => r.key === 'goldPerSec')!.locked).toBe(true);
    expect(rows.find(r => r.key === 'strikePower')!.locked).toBe(false);
  });

  it('votes per key rather than summing, so one big-scale stat cannot drown the rest', () => {
    // goldPerSec down a whole point, magicFind and xpBonus each up a hundredth:
    // a raw sum would call this a loss; two keys out of three improved.
    const rows = reforgeDeltas(
      { goldPerSec: 2, magicFind: 0.02, xpBonus: 0.02 },
      { goldPerSec: 1, magicFind: 0.03, xpBonus: 0.03 },
      ['goldPerSec', 'magicFind', 'xpBonus'],
    );
    expect(reforgeVerdict(rows)).toBe('better');
  });

  it('calls an all-locked or all-flat reroll even, not better', () => {
    const flat = reforgeDeltas({ goldPerSec: 1 }, { goldPerSec: 1 }, ['goldPerSec']);
    expect(reforgeVerdict(flat)).toBe('even');
    const locked = reforgeDeltas({ goldPerSec: 1 }, { goldPerSec: 1 }, ['goldPerSec'], 'goldPerSec');
    expect(reforgeVerdict(locked)).toBe('even');
  });
});
