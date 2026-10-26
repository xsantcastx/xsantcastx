/**
 * keeper-budget.ts — what a Keeper can really deal, as the room reads it from the save (Hearth protocol 8, M2 of the
 * room-run world; docs/design/online.md §4d "Server-known stats").
 *
 * On join a signed-in Keeper's save is read ONCE (three documents in one request: its activity ledger for the
 * Hunting XP, its look for the calling, its inventory for the worn gear). From them the room knows the Keeper's real
 * level — the one its XP reads as on the game's own curve (keeper-level.ts), not the one its presence claims — and
 * how hard its worn gear lets it hit. A blow's claim is then budgeted from that, replacing protocol 7's
 * "the level the client reports, rising at most 3 a minute".
 *
 * The budget is a ceiling for honest play, not a damage model: REF_DPS is the simulated Keeper's sustained damage on
 * one creature (scripts/combat-sim.mjs --dps, the best of the four callings, gear rolled at its level), BUDGET_AOE the
 * headroom for a blow that lands on a crowd (the budget is one total over every creature in the window), and the worn
 * gear's damage, crit and speed lift it further when they are better than the sim's. A save cannot claim more than a
 * few times what its own level and gear allow; a level-5 save can never claim level-60 damage.
 *
 * Guests have no save: their budget stays the protocol-5 formula at their reported level (rising at most 3 a minute)
 * but never above GUEST_LEVEL_CAP — conservative on purpose.
 *
 * Pure: no Angular, no DOM. The Hearth bundles it (scripts/world-sim-build.mjs); Karma runs keeper-budget.spec.ts.
 */
import { claimDpsCap } from '../social/coop-rules';
import { unpackInventory } from '../../../../functions-game/src/trade-core';
import { keeperLevelForXp } from '../../shared/skills/keeper-level';
import { fightStats } from '../td/td-skills';
import { addSetBonuses } from '../../shared/rpg/set-items';
import type { ItemStats } from '../../shared/rpg/item.model';
import type { KeeperStats, Vocation } from '../../shared/keeper-look/keeper-look.model';
import { slackGuard, type KeeperGuard } from './keeper-life';

/**
 * The simulated Keeper's sustained damage a second on one creature, by level (combat-sim.mjs --dps, 2026-10-22: the
 * highest of warlock, ashguard, lanternwright and thornstrider). Log-linear between the points; past the last, the
 * last span's growth carries on (a little more generous than the curve itself).
 */
export const REF_DPS: readonly (readonly [number, number])[] = [[1, 24], [5, 75], [10, 163], [20, 407], [30, 829], [40, 1801], [60, 3412]];
/** Headroom for blows that land on several creatures at once (an arc, a burst, a stampede), over the sim's one target. */
export const BUDGET_AOE = 4;
/** The sim Keeper's own (1 + damage%)(1 + crit)(1 + speed) at its level, roughly: gear better than this lifts the budget. */
export const REF_BOOST = 1.4;
/** The most the worn gear can lift the budget over the sim's (a fully capped kit is well inside it). */
export const MAX_GEAR_LIFT = 3;
/** A guest's budget never grows past this level's (a guest has no save the room can read). */
export const GUEST_LEVEL_CAP = 30;

/** The simulated Keeper's sustained single-target damage a second at `level`. */
export function refDps(level: number): number {
  const L = Math.max(1, Number.isFinite(level) ? level : 1);
  for (let i = 1; i < REF_DPS.length; i++) {
    const [a, x] = REF_DPS[i - 1], [b, y] = REF_DPS[i];
    if (L <= b) return Math.exp(Math.log(x) + (L - a) / (b - a) * (Math.log(y) - Math.log(x)));
  }
  const [a, x] = REF_DPS[REF_DPS.length - 2], [b, y] = REF_DPS[REF_DPS.length - 1];
  const growth = Math.log(y / x) / Math.log(b / a);
  return y * Math.pow(L / b, growth);
}

/** What the room knows of a Keeper from its save. */
export interface KeeperBudget {
  /** The level its Hunting XP reads as (keeper-level.ts). */
  level: number;
  /** Its calling, from the look ('' when the look is missing). */
  vocation: string;
  /** The worn gear's lift: (1 + damage%)(1 + crit%)(1 + speed%). */
  boost: number;
  /** Damage a second the room believes, over the claim gate's window. */
  dps: number;
  /**
   * Protocol 10: the most the Keeper's declared guard may stand at (keeper-life.ts) — its save's own life, Defense and
   * resists (td-skills fightStats on its level, attributes and worn gear with their sets), lifted by the slack.
   */
  guard: KeeperGuard;
  /** Protocol 10: the worn gear's Gold Find and XP (%), for the room's credit caps (room-credit.ts). */
  goldFind: number;
  xpBonus: number;
}

type Rec = Record<string, unknown>;
const isObj = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
/** A save document's value: `{v, updatedAt}` envelopes unwrapped, a bare object as it is. */
const unwrap = (doc: unknown): Rec | null => (isObj(doc) ? (isObj(doc['v']) ? doc['v'] : doc) : null);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** The Hunting XP in an activity ledger (activity.model: progress.xpByDiscipline.hunting). */
export function huntingXp(activity: unknown): number {
  const v = unwrap(activity);
  const progress = v && isObj(v['progress']) ? v['progress'] : null;
  const by = progress && isObj(progress['xpByDiscipline']) ? progress['xpByDiscipline'] : null;
  return Math.max(0, num(by?.['hunting']));
}

/** The worn records' summed stats and their definition ids (tombstoned and past-16 records left out). */
export function wornTotals(inventory: unknown): { stats: Record<string, number>; ids: string[] } {
  // The cloud document may be in the packed format (save format 3): read it as the v2 ledger it encodes.
  const v = unwrap(unpackInventory(unwrap(inventory)));
  const records = v && Array.isArray(v['records']) ? v['records'] as unknown[] : [];
  const tombs = new Map<string, number>();
  for (const t of v && Array.isArray(v['tombstones']) ? v['tombstones'] as unknown[] : []) if (isObj(t) && typeof t['id'] === 'string') tombs.set(t['id'], num(isObj(t['revision']) ? t['revision']['hlc'] : 0));
  const stats: Record<string, number> = {}, ids: string[] = [];
  let worn = 0;
  for (const r of records) {
    if (!isObj(r) || r['kind'] !== 'instance' || !isObj(r['location']) || r['location']['kind'] !== 'equipped') continue;
    const id = String(r['id']);
    if (tombs.has(id) && (tombs.get(id) ?? 0) >= num(isObj(r['revision']) ? r['revision']['hlc'] : 0)) continue;
    if (++worn > 16) break;
    if (typeof r['definitionId'] === 'string') ids.push(r['definitionId']);
    const st = isObj(r['stats']) ? r['stats'] : {};
    for (const [k, n] of Object.entries(st)) if (/^[A-Za-z]{1,32}$/.test(k)) stats[k] = (stats[k] ?? 0) + Math.max(-1000, Math.min(10000, num(n)));
  }
  return { stats, ids };
}

/** The worn gear's damage, crit and speed (the best family: the room does not need to know which one the calling reads). */
export function wornLift(inventory: unknown): number {
  const sum = wornTotals(inventory).stats;
  const g = (k: string) => Math.max(0, Math.min(1000, sum[k] ?? 0));
  const dmg = Math.min(500, Math.max(g('attackDamage'), g('spellDamage')));
  const crit = Math.min(100, g('critChance'));
  const speed = Math.min(200, Math.max(g('attackSpeed'), g('castSpeed')));
  return (1 + dmg / 100) * (1 + crit / 100) * (1 + speed / 100);
}

const VOCS: readonly string[] = ['warlock', 'ashguard', 'lanternwright', 'thornstrider'];
/** The guard the Keeper's save allows (before the slack): fightStats on its level, attributes and worn gear. */
export function saveGuard(level: number, look: unknown, inventory: unknown): KeeperGuard {
  const l = unwrap(look);
  const voc = (l && typeof l['vocation'] === 'string' && VOCS.includes(l['vocation']) ? l['vocation'] : 'warlock') as Vocation;
  const st = l && isObj(l['stats']) ? l['stats'] : {};
  const pts = (k: string) => Math.max(0, Math.min(5000, Math.floor(num(st[k]))));
  const stats: KeeperStats = { vit: pts('vit'), ene: pts('ene'), spi: pts('spi'), agi: pts('agi') };
  const worn = wornTotals(inventory);
  const gear = addSetBonuses(worn.stats as Partial<ItemStats>, worn.ids);
  const f = fightStats(level, stats, gear, voc, 0);
  return { max: f.maxHp, defense: f.defense, resists: { ...f.resists }, level };
}

/** Damage a second the room allows a Keeper of `level` whose gear lifts it by `boost`. Never below protocol 5's. */
export function budgetFor(level: number, boost = REF_BOOST): number {
  const lift = Math.max(1, Math.min(MAX_GEAR_LIFT, (Number.isFinite(boost) ? boost : REF_BOOST) / REF_BOOST));
  return Math.max(claimDpsCap(Math.min(999, level)), Math.round(BUDGET_AOE * refDps(level) * lift));
}

/** A guest's budget: protocol 5's at its (believed) level, the level capped at GUEST_LEVEL_CAP. */
export function guestBudget(level: number): number { return claimDpsCap(Math.min(GUEST_LEVEL_CAP, Math.max(1, Math.floor(level || 1)))); }

/** What the save says about a Keeper: the three documents as Firestore holds them (any may be missing). */
export function keeperBudget(save: { activity?: unknown; look?: unknown; inventory?: unknown }): KeeperBudget {
  const level = keeperLevelForXp(huntingXp(save.activity));
  const look = unwrap(save.look);
  const vocation = look && typeof look['vocation'] === 'string' && /^[a-z]{1,16}$/.test(look['vocation']) ? look['vocation'] : '';
  const boost = wornLift(save.inventory);
  const sum = wornTotals(save.inventory).stats;
  return {
    level, vocation, boost, dps: budgetFor(level, boost), guard: slackGuard(saveGuard(level, save.look, save.inventory)),
    goldFind: Math.max(0, num(sum['goldFind'])), xpBonus: Math.max(0, num(sum['xpBonus'])),
  };
}
