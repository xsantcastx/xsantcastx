/**
 * explorer-progression.ts — an explorer's own ladder, and what it is worth.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE EXPLORER LEVELS AT ALL, WHEN THE KEEPER ALREADY DOES
 * ─────────────────────────────────────────────────────────────────────────────
 * The Keeper's rank is a property of the *save*: every explorer benefits from
 * it equally, which means it can never make one of them yours. A roster where
 * the only difference between two Rares is which one was minted first is a
 * roster you sort rather than one you invest in.
 *
 * A per-explorer level is the smallest thing that fixes that. Sending Lyra out
 * forty times makes Lyra good — not the roster, not the account, her — and the
 * next time a hard site asks for level 10 the answer is a specific person's
 * name. That is the whole design goal: make the roster a set of relationships
 * rather than a set of stat blocks.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY LEVELS UNLOCK RATHER THAN GATE
 * ─────────────────────────────────────────────────────────────────────────────
 * Every milestone below *gives* something. None of them is required to run any
 * mission on the existing ladder, and that is deliberate: every save in the
 * wild already has explorers who can reach every rung, so a level wall on the
 * mission ladder would retroactively confiscate access a player already had and
 * did nothing to lose.
 *
 * The walls live on the expedition *sites* instead — new content, so a wall
 * there takes nothing from anybody. See the note in `expedition-site.model.ts`.
 *
 * Pure data and pure functions. No browser APIs.
 */
import { RealmId } from '../realms/realm.model';
import {
  ExplorerArchetype,
  ExplorerPassive,
  ExplorerTrait,
  archetypeById,
  traitOf,
} from './explorer-archetypes';
import { ExplorerRarity, RosterExplorer, explorerTier } from './explorer-roster.model';

/** Nobody goes past twenty. */
export const MAX_EXPLORER_LEVEL = 20;

/**
 * XP required to reach level `n` from level 1, cumulative.
 *
 * A gentle power curve rather than a table of twenty hand-written numbers,
 * because a table is twenty numbers to retune and a curve is two. The exponent
 * is 1.7: level 5 costs about 1,300 XP and level 20 about 19,000, which against
 * the mission ladder's payouts (a Deep Dive is 600 XP, a Grand 3,600) means
 * level 5 is a weekend of short runs and level 20 is a genuine commitment to
 * one person.
 *
 * Deliberately *not* scaled by rarity. A Common who has been out four hundred
 * times has earned level 20, and making the good explorers cheaper to level
 * would mean the ladder only ever ran under the people who least needed it.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = Math.min(MAX_EXPLORER_LEVEL, Math.max(1, Math.floor(level)));
  return Math.round(120 * Math.pow(n - 1, 1.7));
}

/** The level a given total XP buys. */
export function levelForXp(xp: number): number {
  const total = Math.max(0, Number.isFinite(xp) ? xp : 0);
  let level = 1;
  while (level < MAX_EXPLORER_LEVEL && total >= xpForLevel(level + 1)) level++;
  return level;
}

export interface LevelProgress {
  level: number;
  /** XP banked toward the next level, not total. */
  into: number;
  /** XP the next level costs, from the current one. Zero at the cap. */
  span: number;
  /** 0–100, for the bar. 100 at the cap. */
  percent: number;
  capped: boolean;
}

export function levelProgress(xp: number): LevelProgress {
  const total = Math.max(0, Number.isFinite(xp) ? xp : 0);
  const level = levelForXp(total);
  if (level >= MAX_EXPLORER_LEVEL) {
    return { level: MAX_EXPLORER_LEVEL, into: 0, span: 0, percent: 100, capped: true };
  }
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const span = Math.max(1, ceil - floor);
  const into = Math.max(0, total - floor);
  return {
    level,
    into,
    span,
    percent: Math.max(0, Math.min(100, Math.round((into / span) * 100))),
    capped: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Milestones
// ─────────────────────────────────────────────────────────────────────────────

/** The level at which an archetype's passive strengthens. */
export const PASSIVE_UPGRADE_LEVEL = 10;

/** The level at which mastery lands. */
export const MASTERY_LEVEL = 20;

export interface LevelMilestone {
  level: number;
  label: string;
  /** What it does, in the same words the arithmetic uses. */
  detail: string;
}

/**
 * Four rungs, spaced so that each one is felt.
 *
 * Deliberately not "every level does something": a milestone at every step is a
 * milestone at no step, and nineteen small unlocks read as a progress bar with
 * extra words on it. Four is few enough that a player can name all of them and
 * far enough apart that reaching one is an event.
 */
export const LEVEL_MILESTONES: readonly LevelMilestone[] = [
  { level: 3, label: 'Inner sites', detail: 'Cleared for the middle site of every realm.' },
  { level: 5, label: 'One more hand', detail: '+1 find carried home from every expedition.' },
  { level: PASSIVE_UPGRADE_LEVEL, label: 'Mastered', detail: 'Their own ability strengthens by half again, and the deep sites open.' },
  { level: 15, label: 'One more strap', detail: '+1 equipment slot, past whatever their tier allows.' },
  { level: MASTERY_LEVEL, label: 'Peerless', detail: '+5% to Gold, XP, loot and speed. Permanently.' },
];

/** The milestones this level has passed. */
export function reachedMilestones(level: number): readonly LevelMilestone[] {
  return LEVEL_MILESTONES.filter(m => level >= m.level);
}

/** The next one they are working toward, or null at the cap. */
export function nextMilestone(level: number): LevelMilestone | null {
  return LEVEL_MILESTONES.find(m => m.level > level) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// The resolved bonus
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Everything an explorer brings to a mission, folded into one block.
 *
 * Resolved *once*, at dispatch, and frozen onto the expedition record — the same
 * discipline `Expedition.lootBonus` and `Expedition.yieldMultiplier` already
 * follow, and for the same reason: the reward is rolled on return, so reading
 * any of this live would let a player dispatch a Common, move every charm and
 * every level onto them mid-flight, and collect at the boosted rate.
 *
 * Every multiplier is relative to 1. A `speed` of 0.85 is 15% faster.
 */
export interface ExplorerBonus {
  speed: number;
  gold: number;
  xp: number;
  rune: number;
  materials: number;
  /** Percentage points of Magic Find, on top of tier and equipment. */
  magicFind: number;
  /** Extra table rolls on return. */
  extraSlots: number;
  /** Tiers the rune floor is raised by. */
  runeFloor: number;
  /** True when at least one rune is promised regardless of the gate. */
  guaranteeRune: boolean;
}

export function neutralBonus(): ExplorerBonus {
  return {
    speed: 1, gold: 1, xp: 1, rune: 1, materials: 1,
    magicFind: 0, extraSlots: 0, runeFloor: 0, guaranteeRune: false,
  };
}

/**
 * Realm affinity: what being *from* somewhere is worth.
 *
 * +25% loot quality and +10% on the rune gate, as briefed, applied only in the
 * archetype's own realm. Small on purpose — an affinity large enough to decide
 * where every explorer is sent would turn the realm picker back into a lookup
 * table, and the realm profile is already the axis that is meant to make that
 * choice.
 */
export const AFFINITY_MAGIC_FIND = 25;
export const AFFINITY_RUNE_MULTIPLIER = 1.1;

/**
 * Fold tier, archetype, trait, passive, level and realm into one block.
 *
 * The order matters in exactly one place and it is worth saying out loud:
 * `magnitude` for the multiplying passives is scaled toward 1 rather than
 * multiplied, so a level-10 upgrade of a 0.7 speed passive gives 0.55 (further
 * from 1, i.e. faster) and not 1.05 (which multiplying 0.7 by 1.5 would give —
 * a *slower* explorer as a reward for levelling). Getting that backwards is the
 * kind of bug that ships, because the number still moves.
 */
export function resolveExplorerBonus(
  explorer: Pick<RosterExplorer, 'rarity'> & { archetypeId?: string; xp?: number },
  realm: RealmId | string | undefined,
): ExplorerBonus {
  const bonus = neutralBonus();
  const level = levelForXp(explorer.xp ?? 0);
  const archetype = archetypeById(explorer.archetypeId);

  // ── Trait ────────────────────────────────────────────────────────────────
  const trait: ExplorerTrait | undefined = traitOf(archetype?.trait);
  if (trait) {
    bonus.speed *= trait.speed;
    bonus.gold *= trait.gold;
    bonus.xp *= trait.xp;
    bonus.rune *= trait.rune;
    bonus.materials *= trait.materials;
    bonus.magicFind += trait.loot;
  }

  // ── Affinity ─────────────────────────────────────────────────────────────
  if (archetype?.affinity && realm && archetype.affinity === realm) {
    bonus.magicFind += AFFINITY_MAGIC_FIND;
    bonus.rune *= AFFINITY_RUNE_MULTIPLIER;
  }

  // ── Passive ──────────────────────────────────────────────────────────────
  if (archetype) applyPassive(bonus, archetype.passive, level, realm);

  // ── Milestones ───────────────────────────────────────────────────────────
  if (level >= 5) bonus.extraSlots += 1;
  if (level >= MASTERY_LEVEL) {
    bonus.gold *= 1.05;
    bonus.xp *= 1.05;
    bonus.magicFind += 5;
    bonus.speed *= 0.95;
  }

  return bonus;
}

/**
 * Scale a multiplier's distance from 1 by `factor`.
 *
 * 1.4 at factor 1.5 becomes 1.6; 0.7 becomes 0.55. This is what "the passive
 * strengthens by half again" has to mean for a passive that works by making a
 * number smaller, and writing it out as a named function is what stops the next
 * reader from replacing it with a multiply.
 */
function amplify(multiplier: number, factor: number): number {
  return 1 + (multiplier - 1) * factor;
}

function applyPassive(
  bonus: ExplorerBonus,
  passive: ExplorerPassive,
  level: number,
  realm: RealmId | string | undefined,
): void {
  const upgraded = level >= PASSIVE_UPGRADE_LEVEL;
  const factor = upgraded ? 1.5 : 1;
  const m = passive.magnitude;

  switch (passive.kind) {
    case 'realm-gold':
      if (realm === passive.realm) bonus.gold *= amplify(m, factor);
      break;
    case 'realm-rune':
      if (realm === passive.realm) bonus.rune *= amplify(m, factor);
      break;
    case 'realm-materials':
      if (realm === passive.realm) bonus.materials *= amplify(m, factor);
      break;
    case 'gold':
      bonus.gold *= amplify(m, factor);
      break;
    case 'xp':
      bonus.xp *= amplify(m, factor);
      break;
    case 'speed':
      bonus.speed *= amplify(m, factor);
      break;
    case 'magic-find':
      bonus.magicFind += m * factor;
      break;
    case 'never-empty':
      bonus.guaranteeRune = true;
      break;
    case 'rune-floor':
      // Whole tiers, so the upgrade is +1 rather than ×1.5 — a floor of 1.5 is
      // not a tier and `rollRuneAtOrAbove` would index the table with it.
      bonus.runeFloor += Math.round(m) + (upgraded ? 1 : 0);
      break;
    case 'extra-slot':
      bonus.extraSlots += Math.round(m) + (upgraded ? 1 : 0);
      break;
  }
}

/** How many equipment slots this explorer actually has, after their level. */
export function equipCapacity(rarity: ExplorerRarity, xp: number): number {
  const base = explorerTier(rarity).maxEquipSlots;
  return base + (levelForXp(xp) >= 15 ? 1 : 0);
}

/**
 * XP an explorer earns from a mission.
 *
 * A share of the mission's own XP rather than a separate curve, so retuning the
 * ladder retunes both at once and the two can never disagree about which run is
 * worth more. A third, because an explorer who levelled at the Keeper's rate
 * would hit the cap long before the Keeper hit rank 5, and the ladder would be
 * over before the sites that need it opened.
 */
export const EXPLORER_XP_SHARE = 1 / 3;

export function explorerXpFor(missionXp: number, bonus: ExplorerBonus): number {
  return Math.max(1, Math.round(missionXp * EXPLORER_XP_SHARE * bonus.xp));
}

// ─────────────────────────────────────────────────────────────────────────────
// Display
// ─────────────────────────────────────────────────────────────────────────────

/** "×1.4 Gold" style chips for the card, built from a resolved bonus. */
export function bonusChips(bonus: ExplorerBonus): string[] {
  const chips: string[] = [];
  const pct = (v: number) => `${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`;
  if (Math.abs(bonus.gold - 1) > 0.005) chips.push(`${pct(bonus.gold)} Gold`);
  if (Math.abs(bonus.xp - 1) > 0.005) chips.push(`${pct(bonus.xp)} XP`);
  if (Math.abs(bonus.rune - 1) > 0.005) chips.push(`${pct(bonus.rune)} rune rate`);
  if (Math.abs(bonus.materials - 1) > 0.005) chips.push(`${pct(bonus.materials)} freight`);
  if (Math.abs(bonus.speed - 1) > 0.005) chips.push(`${pct(1 / bonus.speed)} faster`);
  if (bonus.magicFind) chips.push(`+${Math.round(bonus.magicFind)}% Magic Find`);
  if (bonus.extraSlots) chips.push(`+${bonus.extraSlots} find${bonus.extraSlots === 1 ? '' : 's'}`);
  if (bonus.runeFloor) chips.push(`+${bonus.runeFloor} rune tier${bonus.runeFloor === 1 ? '' : 's'}`);
  if (bonus.guaranteeRune) chips.push('never empty-handed');
  return chips;
}

/** The archetype behind an explorer, when they have one. */
export function archetypeOf(explorer: { archetypeId?: string }): ExplorerArchetype | undefined {
  return archetypeById(explorer.archetypeId);
}
