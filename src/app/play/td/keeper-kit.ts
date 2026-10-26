/**
 * keeper-kit.ts — the ONE read of what a Keeper's worn kit gives the fight, from its items.
 *
 * The HUD (side-scroller gearCombat → td-engine setKeeperBuild) and the room (world/keeper-budget saveGuard: the
 * ceiling of the life, Defense and resists a Keeper may declare, Hearth protocol 10) both call this, so the most life
 * the orb shows and the most the room keeps are the same number from the same save:
 *
 *  - each worn piece as it *pays* (socket-words wornStats): its roll, the runes in its wells, its seated Socket Word,
 *    a grave-good's curse or whisper;
 *  - an old roll's fighter twins (item-calling oldRollTwins), the item sets' tiers (wornCombat → addSetBonuses);
 *  - runes set in armour wells ward against their element (aura-sources wornResists);
 *  - the level's milestone passives (keeper-milestones passiveBonus).
 *
 * The room once summed only the stored rolls: every rune, Socket Word, armour ward and passive was missing from its
 * ceiling, so a socketed Keeper's life stopped at roughly half the orb (2026-10-26).
 *
 * Pure: no Angular, no DOM. The Hearth bundles it through keeper-budget.ts (scripts/world-sim-build.mjs).
 */
import { sumStats, type GameItem, type ItemStats } from '../../shared/rpg/item.model';
import { wornStats } from '../../shared/enchanting/socket-words';
import { oldRollTwins } from '../../shared/rpg/item-calling';
import { itemAffixFamily } from '../../shared/rpg/item-base';
import { wornResists } from '../../shared/loot/aura-sources';
import { passiveBonus } from '../../shared/skills/keeper-milestones';
import { ELEMENTS } from '../../shared/loot/damage.model';
import type { KeeperStats, Vocation } from '../../shared/keeper-look/keeper-look.model';
import { RESIST_STAT, fightStats, wornCombat, type FightStats } from './td-skills';

/** The pieces the Keeper itself wears (not an explorer's). */
export function wornPieces(items: readonly GameItem[]): GameItem[] {
  return items.filter(i => i.equipped && !i.explorerId);
}

/** The worn kit's combat totals at `level` (what fightStats reads as `gear`). `items`: everything the Keeper holds. */
export function keeperGear(items: readonly GameItem[], level: number): Partial<ItemStats> {
  const worn = wornPieces(items);
  // The inventory's equippedTotals: each slotted piece as it pays (inventory.service snapshotOf).
  const totals = sumStats(worn.filter(i => !!i.slot).map(wornStats));
  const old = oldRollTwins(worn.map(i => ({ family: itemAffixFamily(i), stats: wornStats(i) })));
  const ids = worn.filter(i => !!i.definitionId).map(i => i.definitionId!);
  const g: Partial<ItemStats> = { ...wornCombat({ equippedTotals: totals, equippedOldRolls: old }, ids) };
  const runes = wornResists(items);
  for (const el of ELEMENTS) if (runes[el]) g[RESIST_STAT[el]] = (g[RESIST_STAT[el]] ?? 0) + (runes[el] ?? 0);
  for (const [stat, n] of Object.entries(passiveBonus(level)) as [keyof ItemStats, number][]) g[stat] = ((g[stat] as number | undefined) ?? 0) + n;
  return g;
}

/** The Keeper's fight from its level, attributes, calling and items: the HUD's numbers, and the room's ceiling's. */
export function keeperFight(level: number, stats: KeeperStats, items: readonly GameItem[], v: Vocation, resistPenalty = 0): FightStats {
  return fightStats(level, stats, keeperGear(items, level), v, resistPenalty);
}
