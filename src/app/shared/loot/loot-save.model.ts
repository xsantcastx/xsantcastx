/**
 * loot-save.model.ts — the Keeper's loot & combat choices (`godforge-loot`).
 *
 *   filter    the loot filter (loot-tiers.ts)
 *   aura      the aura picked to run when several are worn (null = strongest)
 *   tier      the difficulty being played (difficulty.model.ts)
 *   unlocked  every tier opened (a gate boss fell on the tier below)
 *   seed      the player's loot seed: champion packs and drops are rolled from
 *             it per kill, so a reload never re-rolls what is in front of you
 *   purse     the corpse run: the Gold a fall left where the Keeper fell
 *   rolls     kills rolled so far: with the seed, the key of the next kill's
 *             drops (a reload continues the sequence, never repeats a kill)
 *
 * Synced (progress/loot). Merge: the later choice wins whole for filter, aura
 * and tier (`updatedAt`); unlocked tiers are a union (a tier is never lost);
 * the seed keeps the first one ever written; rolls take the higher; the purse is the later event
 * (`purseAt`), so a purse picked up on one device is gone on the other.
 *
 * No imports beyond pure models: cloud-save.model.ts is eager and imports this merge.
 */
import { isAuraId, type AuraId } from './auras';
import { DIFFICULTY_TIERS, isDifficulty, type DifficultyTier } from './difficulty.model';
import { isLootFilter, type LootFilter } from './loot-tiers';
import { GOLD_ERA } from '../economy/economy-curve';

export const LOOT_KEY = 'godforge-loot';

export interface FallenPurse {
  /** Area id the Keeper fell in. */
  area: string;
  x: number;
  y: number;
  gold: number;
  tier: DifficultyTier;
  /** The Gold era it was dropped in (economy-curve GOLD_ERA). A purse from before the wipe reads as none. */
  era: number;
}

export interface LootSave {
  version: 1;
  filter: LootFilter;
  aura: AuraId | null;
  tier: DifficultyTier;
  unlocked: DifficultyTier[];
  seed: number;
  purse: FallenPurse | null;
  rolls: number;
  /** ms of the last settings choice (filter / aura / tier). */
  updatedAt: number;
  /** ms of the last purse event (dropped or recovered). */
  purseAt: number;
}

export function defaultLoot(): LootSave {
  return { version: 1, filter: 'all', aura: null, tier: 'normal', unlocked: ['normal'], seed: 0, purse: null, rolls: 0, updatedAt: 0, purseAt: 0 };
}

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

function coercePurse(raw: unknown): FallenPurse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const gold = Math.floor(num(r['gold']));
  if (typeof r['area'] !== 'string' || !r['area'] || gold <= 0) return null;
  // The Gold wipe (GOLD_ERA): a purse dropped before it held the old balance's Gold; it is gone on every copy.
  const era = Math.floor(num(r['era']));
  if (era < GOLD_ERA) return null;
  return { area: r['area'], x: num(r['x']), y: num(r['y']), gold, tier: isDifficulty(r['tier']) ? r['tier'] : 'normal', era };
}

export function coerceLoot(raw: unknown): LootSave {
  const base = defaultLoot();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const r = raw as Record<string, unknown>;
  const unlocked = DIFFICULTY_TIERS.filter(t => t === 'normal' || (Array.isArray(r['unlocked']) && (r['unlocked'] as unknown[]).includes(t)));
  const tier = isDifficulty(r['tier']) && unlocked.includes(r['tier']) ? r['tier'] : 'normal';
  const seed = Math.floor(num(r['seed']));
  return {
    version: 1,
    filter: isLootFilter(r['filter']) ? r['filter'] : base.filter,
    aura: isAuraId(r['aura']) ? r['aura'] : null,
    tier,
    unlocked,
    seed: seed > 0 && seed < 2 ** 32 ? seed : 0,
    purse: coercePurse(r['purse']),
    rolls: Math.max(0, Math.floor(num(r['rolls']))),
    updatedAt: Math.max(0, Math.floor(num(r['updatedAt']))),
    purseAt: Math.max(0, Math.floor(num(r['purseAt']))),
  };
}

/** Two devices: see the header. Commutative; a tie keeps local. */
export function mergeLoot(remote: unknown, local: unknown): unknown {
  if (remote == null) return local;
  if (local == null) return remote;
  const r = coerceLoot(remote), l = coerceLoot(local);
  const settings = r.updatedAt > l.updatedAt ? r : l;
  const purse = r.purseAt > l.purseAt ? r : l;
  const unlocked = DIFFICULTY_TIERS.filter(t => r.unlocked.includes(t) || l.unlocked.includes(t));
  const seed = l.seed && r.seed ? Math.min(l.seed, r.seed) : (l.seed || r.seed);
  return {
    version: 1,
    filter: settings.filter,
    aura: settings.aura,
    tier: unlocked.includes(settings.tier) ? settings.tier : 'normal',
    unlocked,
    seed,
    purse: purse.purse,
    rolls: Math.max(r.rolls, l.rolls),
    updatedAt: settings.updatedAt,
    purseAt: purse.purseAt,
  } satisfies LootSave;
}
