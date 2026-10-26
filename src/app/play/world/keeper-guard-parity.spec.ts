/**
 * keeper-guard-parity.spec.ts — the room's life ceiling and the HUD's orb read ONE number from the save
 * (Hearth protocol 10; 2026-10-26 "I got 261 health and it won't go above it").
 *
 * The room's save-derived guard (keeper-budget saveGuard) summed only the stored rolls of the worn records: every
 * rune in a well, every Socket Word, every armour ward and milestone passive the HUD counts was missing, so a socketed
 * Keeper's life was capped near half its orb. Here a matrix of real saves — each calling at levels 1/10/30/60, with
 * spent attributes, rolled gear in every slot, Socket Words, loose runes in armour wells, a set — goes through the
 * cloud's own shapes (itemToRecord → v2 ledger → packed document in its {v, updatedAt} envelope) and:
 *
 *  - the room's guard before the slack equals the HUD's fight numbers (maxHp, Defense, every resist) exactly;
 *  - the HUD's function equals the composition the HUD used before keeper-kit existed (nothing moved on screen);
 *  - an honest declaration is never clamped by the room's ceiling;
 *  - and the old roll-only read would have failed it (the matrix really exercises runes, words and sets).
 */
import { keeperBudget, saveGuard, wornItems } from './keeper-budget';
import { clampGuard } from './keeper-life';
import { keeperFight, keeperGear } from '../td/keeper-kit';
import { RESIST_STAT, fightStats, wornCombat } from '../td/td-skills';
import { ITEM_DEFINITIONS, mintEquipment } from '../../shared/rpg/item-definition';
import { SET_PIECES, addSetBonuses } from '../../shared/rpg/set-items';
import { SOCKET_WORDS, wornStats } from '../../shared/enchanting/socket-words';
import { itemBase, itemAffixFamily } from '../../shared/rpg/item-base';
import { oldRollTwins } from '../../shared/rpg/item-calling';
import { wornResists } from '../../shared/loot/aura-sources';
import { keeperAttributePoints, passiveBonus } from '../../shared/skills/keeper-milestones';
import { keeperXpForLevel } from '../../shared/skills/keeper-level';
import { sumStats, type GameItem, type ItemStats, type SlotId } from '../../shared/rpg/item.model';
import { itemToRecord } from '../../shared/rpg/inventory-ops';
import { packInventory } from '../../../../functions-game/src/trade-core';
import { ELEMENTS } from '../../shared/loot/damage.model';
import type { KeeperStats, Vocation } from '../../shared/keeper-look/keeper-look.model';

const VOCATIONS: Vocation[] = ['warlock', 'ashguard', 'lanternwright', 'thornstrider'];
const LEVELS = [1, 10, 30, 60];
const SLOTS: SlotId[] = ['head', 'chest', 'hands', 'weapon', 'off-hand', 'legs', 'feet', 'trinket', 'charm1'];

/** A seeded rng (mulberry32): the matrix is the same every run. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** A worn common in `slot` with a Socket Word set in it when one fits its base, else two loose runes. */
function wornPiece(slot: SlotId, level: number, r: () => number, n: number): GameItem | null {
  const defs = ITEM_DEFINITIONS.filter(d => d.slot === slot && !SET_PIECES.some(p => p.id === d.id));
  for (let i = 0; i < defs.length; i++) {
    const def = defs[(n + i) % defs.length];
    const item = mintEquipment(def.id, 'common', r, new Date(Date.UTC(2026, 9, 1, 0, n)).toISOString(), `p-${slot}-${n}`, Math.max(1, level));
    if (!item) continue;
    const base = itemBase(item);
    const word = base ? SOCKET_WORDS.find(w => w.bases.includes(base) && w.runes.length <= 3) : undefined;
    return { ...item, equipped: true, slot, sockets: word ? [...word.runes] : ['ember', 'shade'] };
  }
  return null;
}

/** A set piece worn in its own slot (stats as any gear of the slot: the authored base). */
function setPiece(id: string): GameItem {
  const p = SET_PIECES.find(x => x.id === id)!;
  return {
    id: `set-${id}`, name: p.name, type: ITEM_DEFINITIONS.find(d => d.id === id)?.type ?? 'artifact', rarity: 'mythic',
    stats: { ...(p.base as ItemStats) }, equipped: true, slot: p.slot as SlotId, definitionId: id, sellValue: 0, lore: p.lore,
    foundAt: '2026-10-01T00:00:00.000Z', soulbound: false, upgradeLevel: 0,
  };
}

interface Case { name: string; level: number; voc: Vocation; stats: KeeperStats; items: GameItem[] }

function cases(): Case[] {
  const out: Case[] = [];
  let n = 0;
  for (const voc of VOCATIONS) for (const level of LEVELS) {
    const r = rng(1000 + n);
    const pts = keeperAttributePoints(level);
    // Spent attributes, Vitality-heavy for the Ashguard, Energy-heavy for the casters.
    const vit = Math.floor(pts * (voc === 'ashguard' ? 0.6 : 0.3)), ene = Math.floor(pts * 0.3), spi = Math.floor(pts * 0.2);
    const stats: KeeperStats = { vit, ene, spi, agi: Math.max(0, pts - vit - ene - spi) };
    const items: GameItem[] = [];
    // Odd cases wear a set's head and chest in place of commons (sets × words × runes all at once).
    const set = n % 2 === 1 ? SET_PIECES.filter(p => p.set === SET_PIECES[(n >> 1) % SET_PIECES.length].set).slice(0, 2) : [];
    for (const slot of SLOTS) {
      const piece = set.find(p => p.slot === slot);
      const it = piece ? setPiece(piece.id) : wornPiece(slot, level, r, n);
      if (it) items.push(it);
    }
    // A bagged piece with runes and life must count for nothing.
    const bag = wornPiece('chest', level, r, n + 7);
    if (bag) items.push({ ...bag, id: 'bag-1', equipped: false, slot: undefined });
    out.push({ name: `${voc} L${level}`, level, voc, stats, items });
    n++;
  }
  return out;
}

/** The save as the cloud holds it: the activity's Hunting XP, the look, the packed inventory, each in its envelope. */
function saveOf(c: Case): { activity: unknown; look: unknown; inventory: unknown } {
  const records = c.items.map(itemToRecord);
  const ledger = { version: 2, records, tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: 1, legacyBackup: null, era: 0 };
  return {
    activity: { v: { progress: { xpByDiscipline: { hunting: keeperXpForLevel(c.level) } } }, updatedAt: '' },
    look: { v: { vocation: c.voc, stats: c.stats }, updatedAt: '' },
    inventory: { v: packInventory(ledger as never), updatedAt: '' },
  };
}

/** The HUD's composition before keeper-kit (side-scroller gearCombat, 9c0cb7e2), kept here as the reference. */
function hudBefore(items: readonly GameItem[], level: number): Partial<ItemStats> {
  const worn = items.filter(i => i.equipped && !i.explorerId);
  const equippedTotals = sumStats(items.filter(i => i.equipped && i.slot).map(wornStats));
  const equippedOldRolls = oldRollTwins(worn.map(i => ({ family: itemAffixFamily(i), stats: wornStats(i) })));
  const g: Partial<ItemStats> = { ...wornCombat({ equippedTotals, equippedOldRolls }, worn.filter(i => i.definitionId).map(i => i.definitionId!)) };
  const runes = wornResists(items);
  for (const el of ELEMENTS) if (runes[el]) g[RESIST_STAT[el]] = (g[RESIST_STAT[el]] ?? 0) + (runes[el] ?? 0);
  for (const [stat, v] of Object.entries(passiveBonus(level)) as [keyof ItemStats, number][]) g[stat] = ((g[stat] as number | undefined) ?? 0) + v;
  return g;
}

/** The room's read before the fix: the stored rolls only, with the sets (keeper-budget saveGuard, 9c0cb7e2). */
function roomBefore(c: Case): number {
  const sum: Partial<ItemStats> = {};
  for (const i of c.items) if (i.equipped) for (const [k, v] of Object.entries(i.stats) as [keyof ItemStats, number][]) sum[k] = ((sum[k] as number | undefined) ?? 0) + v;
  return fightStats(c.level, c.stats, addSetBonuses(sum, c.items.filter(i => i.equipped && i.definitionId).map(i => i.definitionId!)), c.voc, 0).maxHp;
}

describe('keeper guard parity (protocol 10: the room\'s life ceiling is the HUD\'s own number)', () => {
  const all = cases();

  it('builds a real matrix: 4 callings × 4 levels, every slot worn, words and sets in it', () => {
    expect(all.length).toBe(16);
    for (const c of all) expect(c.items.filter(i => i.equipped).length).toBeGreaterThanOrEqual(8);
    expect(all.some(c => c.items.some(i => i.definitionId && SET_PIECES.some(p => p.id === i.definitionId)))).toBeTrue();
  });

  for (const c of all) {
    it(`${c.name}: the room's guard equals the HUD's maxHp, Defense and resists`, () => {
      const save = saveOf(c);
      // Every worn piece survives the cloud's round trip (a parser that dropped them would "agree" on nothing).
      expect(wornItems(save.inventory).length).toBe(c.items.filter(i => i.equipped).length);
      const hud = keeperFight(c.level, c.stats, c.items, c.voc, 0);
      const budget = keeperBudget(save);
      expect(budget.level).toBe(c.level);
      const room = saveGuard(budget.level, save.look, save.inventory);
      expect(room.max).toBe(hud.maxHp);
      expect(room.defense).toBe(hud.defense);
      for (const el of ELEMENTS) expect(room.resists[el]).toBe(hud.resists[el]);
    });

    it(`${c.name}: the HUD's function is the composition the HUD used before`, () => {
      expect(keeperGear(c.items, c.level)).toEqual(hudBefore(c.items, c.level));
    });

    it(`${c.name}: an honest declaration is never clamped`, () => {
      const save = saveOf(c);
      const hud = keeperFight(c.level, c.stats, c.items, c.voc, 0);
      const declared = { max: hud.maxHp, defense: hud.defense, resists: { ...hud.resists } };
      const used = clampGuard(declared, keeperBudget(save).guard);
      expect(used.max).toBe(hud.maxHp);
      expect(used.defense).toBe(hud.defense);
      for (const el of ELEMENTS) expect(used.resists[el]).toBe(hud.resists[el]);
    });
  }

  it('the old roll-only read undercounts this matrix (the regression it would have caught)', () => {
    const short = all.filter(c => roomBefore(c) < keeperFight(c.level, c.stats, c.items, c.voc, 0).maxHp);
    expect(short.length).toBeGreaterThan(all.length / 2);
  });

  it('a Hell Keeper\'s lower declared resists still pass (the ceiling reads no penalty)', () => {
    const c = all[all.length - 1], save = saveOf(c);
    const hell = keeperFight(c.level, c.stats, c.items, c.voc, 100);
    const used = clampGuard({ max: hell.maxHp, defense: hell.defense, resists: { ...hell.resists } }, keeperBudget(save).guard);
    for (const el of ELEMENTS) expect(used.resists[el]).toBe(hell.resists[el]);
  });
});
