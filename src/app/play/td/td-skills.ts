/**
 * td-skills.ts — the classes' skills as data (owner, 2026-10-20: "our 1st class, let it be a warlock"; "a skill menu …
 * think of tibia or diablo 2 … view passive skills like auras … we need to know what the skills do").
 *
 * One record per skill: what it is (an active on the bar, an aura that runs while chosen, a passive always on), what it
 * costs, how long it cools, and the words that say what it does — the skill window (Spellbook) reads exactly this, and
 * the fight (td-mobs.ts) carries out exactly this, so the two can never disagree.
 */
import type { KeeperStats, Vocation } from '../../shared/keeper-look/keeper-look.model';
import type { ItemStats } from '../../shared/rpg/item.model';
import { addSetBonuses } from '../../shared/rpg/set-items';
import { damageFamilyOf, type DamageFamily } from '../../shared/rpg/item-calling';
import type { RelicTotals } from '../../shared/rpg/boss-uniques';
import { LEVEL_GROWTH, levelSpeedBonus, levelSteps } from '../../shared/skills/keeper-level';
import { ELEMENTS, MAX_KEEPER_RESIST, MIN_RESIST, type DamageType, type Element } from '../../shared/loot/damage.model';
import { ASHGUARD_BOOK, ASHGUARD_SKILLS, ASHGUARD_STARTERS, ASH_TREES, type AshSkillId } from './td-ashguard-skills';
import { LAMP_TREES, LANTERN_BOOK, LANTERN_SKILLS, LANTERN_STARTERS, type LampSkillId } from './td-lantern-skills';
import { THORN_BOOK, THORN_SKILLS, THORN_STARTERS, THORN_TREES, type ThornSkillId } from './td-thorn-skills';

export type SkillKind = 'active' | 'aura' | 'passive';
export type SkillId =
  | 'drain-life' | 'ember-curse' | 'hellfire-nova' | 'dark-ward' | 'bone-spear' | 'raise-skeleton'
  | 'aura-embers' | 'aura-siphon'
  | 'soul-harvest' | 'ember-bolt'
  // The trees (docs/design/skill-trees.md, owner 2026-10-21: "spells — we need to work on spell trees or something").
  | 'cinder-rain' | 'flame-wall' | 'ember-mastery' | 'meteor'
  | 'corpse-burst' | 'skeleton-mastery' | 'bone-armor' | 'bone-storm'
  | 'weaken' | 'life-tap' | 'doom'
  // The spells every vocation learns (design-bible §4.6, roadmap §10 item 6): Glim's Light and Lumvesh, the Seek.
  | 'light' | 'seek' | 'waygate'
  // The Ashguard's book (td-ashguard-skills.ts, design-bible §4.4).
  | AshSkillId
  // The Lanternwright's book (td-lantern-skills.ts, design-bible §4.3).
  | LampSkillId
  // The Thornstrider's book (td-thorn-skills.ts, design-bible §4.5).
  | ThornSkillId;

/** The Warlock's three trees (D2's three tabs): fire, necromancy, curses and wards. */
export const TREES = ['ember', 'bone', 'shadow'] as const;
/**
 * The page every vocation shares (design-bible §4.6, Tibia's common spells): Light and the Seek. Not a class tree —
 * it carries no element, the sky does not touch it — but its ranks are bought with the same points.
 */
export const COMMON_TREE = 'common' as const;
/** The Spellbook's tabs: the class's three trees, then the common page (the Warlock's; bookTrees(v) for any class). */
export const BOOK_TREES = [...TREES, COMMON_TREE] as const;
export type TreeId = typeof BOOK_TREES[number] | typeof ASH_TREES[number] | typeof LAMP_TREES[number] | typeof THORN_TREES[number];
/** Each class's three trees, in tab order. */
export const CLASS_TREES: Readonly<Record<Vocation, readonly TreeId[]>> = { warlock: TREES, ashguard: ASH_TREES, lanternwright: LAMP_TREES, thornstrider: THORN_TREES };
/** A class's Spellbook tabs: its three trees, then the common page. */
export function bookTrees(v: Vocation): readonly TreeId[] { return [...(CLASS_TREES[v] ?? TREES), COMMON_TREE]; }
/** The level each tier opens at (D2: 1, 6, 12, 18, 24 …). */
export const TIER_LEVELS: readonly number[] = [1, 6, 12, 18, 24];
/** The most ranks a skill takes. */
export const MAX_RANK = 20;

export interface SkillDef {
  id: SkillId;
  kind: SkillKind;
  /** Mana spent per use (actives). */
  mana: number;
  /** Seconds between uses (actives). */
  cd: number;
  /** i18n keys: the name, and the one plain line of what it does (numbers in {{}}). */
  nameKey: string;
  textKey: string;
  /** Numbers the line quotes at rank 1, so the words always match the fight. */
  vars: Readonly<Record<string, number>>;
  /** What each rank above the first adds to a var (skillVars); a var not listed stays put. */
  grow: Readonly<Record<string, number>>;
  /** Its tree, its tier (0-based: TIER_LEVELS gives the level it needs) and its column (0–2) on the page. */
  tree: TreeId;
  tier: number;
  col: number;
  /** The skill that must hold a rank first (D2's prerequisite), or null. */
  req: SkillId | null;
  /** The level it opens at when that is not its tier's (the common spells: the Seek at 8, design-bible §4.6). */
  level?: number;
  /** The pixel icon (svg rects inside a 16×16 box). */
  icon: string;
  /**
   * The Seam-Cant (docs/design/design-bible.md §4.0): the words the Keeper speaks on the cast, built from the cant's
   * roots (what) and shapes (how) — never translated. Passives speak nothing.
   */
  words?: string;
  /** D2's synergies (design-bible §4.1): each bought rank of `from` adds `per` % to this skill's `what` (skillVars). */
  syn?: readonly Synergy[];
}

/** What a synergy feeds: damage (min/max, or dps for a skill that burns), radius, duration (secs), absorb, heal. */
export type SynergyVar = 'dmg' | 'radius' | 'dur' | 'absorb' | 'heal';
export interface Synergy { from: SkillId; per: number; what: SynergyVar }
/** The vars each synergy target moves. */
const SYN_VARS: Readonly<Record<SynergyVar, readonly string[]>> = {
  dmg: ['min', 'max', 'dps'], radius: ['radius'], dur: ['secs'], absorb: ['absorb'], heal: ['heal'],
};
/** No var takes more than +100% from synergies, however many points sit in the sources. */
export const SYN_CAP = 100;

const I = (rects: string) => rects;

export const SKILLS: Readonly<Record<SkillId, SkillDef>> = {
  // ── Ember: fire ──
  'ember-bolt': {
    id: 'ember-bolt', kind: 'passive', mana: 0, cd: .9, nameKey: 'skill.ember-bolt', textKey: 'skill.ember-bolt.text',
    vars: { min: 8, max: 13, range: 7 }, grow: { min: 4, max: 6 }, tree: 'ember', tier: 0, col: 0, req: null,
    icon: I('<rect x="9" y="2" width="5" height="5" fill="#ffd25a"/><rect x="7" y="5" width="5" height="4" fill="#ff8a2e"/><rect x="3" y="9" width="5" height="4" fill="#b06bff"/><rect x="1" y="12" width="3" height="3" fill="#6b3aa0"/>'),
    words: 'vael sha',
  },
  'hellfire-nova': {
    id: 'hellfire-nova', kind: 'active', mana: 25, cd: 9, nameKey: 'skill.hellfire-nova', textKey: 'skill.hellfire-nova.text',
    vars: { min: 20, max: 30, radius: 3 }, grow: { min: 4, max: 6, radius: .1 }, tree: 'ember', tier: 0, col: 1, req: null,
    icon: I('<rect x="6" y="2" width="4" height="3" fill="#ffd25a"/><rect x="4" y="4" width="8" height="4" fill="#ff8a2e"/><rect x="3" y="7" width="10" height="5" fill="#e2552a"/><rect x="6" y="8" width="4" height="3" fill="#ffd25a"/><rect x="2" y="12" width="12" height="2" fill="#9e2e1c"/>'),
    words: 'vael orum',
    syn: [{ from: 'aura-embers', per: 5, what: 'dmg' }],
  },
  'aura-embers': {
    id: 'aura-embers', kind: 'aura', mana: 0, cd: 0, nameKey: 'skill.aura-embers', textKey: 'skill.aura-embers.text',
    vars: { dps: 3, radius: 3 }, grow: { dps: 1, radius: .1 }, tree: 'ember', tier: 0, col: 2, req: null,
    icon: I('<rect x="2" y="2" width="12" height="12" fill="#3b1c14"/><rect x="4" y="4" width="8" height="8" fill="#ff8a2e"/><rect x="6" y="6" width="4" height="4" fill="#ffd25a"/><rect x="1" y="7" width="1" height="2" fill="#ff8a2e"/><rect x="14" y="7" width="1" height="2" fill="#ff8a2e"/>'),
    words: 'vael ka',
    syn: [{ from: 'hellfire-nova', per: 3, what: 'radius' }],
  },
  'cinder-rain': {
    id: 'cinder-rain', kind: 'active', mana: 18, cd: 7, nameKey: 'skill.cinder-rain', textKey: 'skill.cinder-rain.text',
    vars: { min: 6, max: 10, radius: 2, secs: 3 }, grow: { min: 2, max: 3, radius: .05, secs: .1 }, tree: 'ember', tier: 1, col: 1, req: 'hellfire-nova',
    icon: I('<rect x="2" y="2" width="12" height="4" fill="#3b2140"/><rect x="3" y="3" width="10" height="2" fill="#6b3aa0"/><rect x="3" y="7" width="2" height="2" fill="#ffd25a"/><rect x="8" y="8" width="2" height="2" fill="#ff8a2e"/><rect x="12" y="7" width="2" height="2" fill="#ffd25a"/><rect x="5" y="11" width="2" height="2" fill="#ff8a2e"/><rect x="10" y="12" width="2" height="2" fill="#ffd25a"/><rect x="2" y="14" width="12" height="1" fill="#9e2e1c"/>'),
    words: 'vael dra',
    syn: [{ from: 'hellfire-nova', per: 6, what: 'dmg' }],
  },
  'flame-wall': {
    id: 'flame-wall', kind: 'active', mana: 22, cd: 10, nameKey: 'skill.flame-wall', textKey: 'skill.flame-wall.text',
    vars: { dps: 8, length: 4, secs: 5 }, grow: { dps: 2, length: .1, secs: .2 }, tree: 'ember', tier: 2, col: 1, req: 'cinder-rain',
    icon: I('<rect x="1" y="12" width="14" height="3" fill="#9e2e1c"/><rect x="2" y="7" width="3" height="5" fill="#e2552a"/><rect x="6" y="4" width="4" height="8" fill="#ff8a2e"/><rect x="11" y="7" width="3" height="5" fill="#e2552a"/><rect x="3" y="9" width="1" height="3" fill="#ffd25a"/><rect x="7" y="7" width="2" height="5" fill="#ffd25a"/><rect x="12" y="9" width="1" height="3" fill="#ffd25a"/><rect x="7" y="2" width="2" height="2" fill="#ff8a2e"/>'),
    words: 'vael mur',
    syn: [{ from: 'cinder-rain', per: 8, what: 'dur' }],
  },
  'ember-mastery': {
    id: 'ember-mastery', kind: 'passive', mana: 0, cd: 0, nameKey: 'skill.ember-mastery', textKey: 'skill.ember-mastery.text',
    vars: { pct: 10 }, grow: { pct: 3 }, tree: 'ember', tier: 3, col: 0, req: 'ember-bolt',
    icon: I('<rect x="3" y="1" width="10" height="1" fill="#c8963c"/><rect x="3" y="14" width="10" height="1" fill="#c8963c"/><rect x="1" y="3" width="1" height="10" fill="#c8963c"/><rect x="14" y="3" width="1" height="10" fill="#c8963c"/><rect x="2" y="2" width="1" height="1" fill="#c8963c"/><rect x="13" y="2" width="1" height="1" fill="#c8963c"/><rect x="2" y="13" width="1" height="1" fill="#c8963c"/><rect x="13" y="13" width="1" height="1" fill="#c8963c"/><rect x="6" y="4" width="4" height="8" fill="#ff8a2e"/><rect x="5" y="7" width="6" height="5" fill="#e2552a"/><rect x="7" y="7" width="2" height="4" fill="#ffd25a"/><rect x="7" y="3" width="2" height="1" fill="#ffd25a"/>'),
  },
  'meteor': {
    id: 'meteor', kind: 'active', mana: 35, cd: 12, nameKey: 'skill.meteor', textKey: 'skill.meteor.text',
    vars: { min: 60, max: 90, radius: 2, delay: 1 }, grow: { min: 10, max: 14, radius: .05 }, tree: 'ember', tier: 4, col: 1, req: 'flame-wall',
    icon: I('<rect x="1" y="1" width="3" height="3" fill="#ffd25a"/><rect x="3" y="3" width="3" height="3" fill="#ff8a2e"/><rect x="5" y="5" width="3" height="3" fill="#e2552a"/><rect x="7" y="7" width="7" height="7" fill="#5a3a2a"/><rect x="8" y="8" width="5" height="5" fill="#8a5a3a"/><rect x="9" y="9" width="2" height="2" fill="#ffd25a"/><rect x="7" y="7" width="1" height="1" fill="#ffd25a"/>'),
    words: 'vael ul dra',
    syn: [{ from: 'flame-wall', per: 5, what: 'dmg' }, { from: 'cinder-rain', per: 5, what: 'dmg' }],
  },
  // ── Bone: necromancy ──
  'bone-spear': {
    id: 'bone-spear', kind: 'active', mana: 14, cd: 3, nameKey: 'skill.bone-spear', textKey: 'skill.bone-spear.text',
    vars: { min: 22, max: 32, range: 8 }, grow: { min: 4, max: 6 }, tree: 'bone', tier: 0, col: 0, req: null,
    icon: I('<rect x="12" y="1" width="3" height="3" fill="#ffffff"/><rect x="10" y="3" width="3" height="3" fill="#e8e1cf"/><rect x="8" y="5" width="3" height="3" fill="#e8e1cf"/><rect x="6" y="7" width="3" height="3" fill="#b8ac92"/><rect x="4" y="9" width="3" height="3" fill="#b8ac92"/><rect x="1" y="11" width="4" height="4" fill="#b06bff"/><rect x="2" y="12" width="2" height="2" fill="#e9d8ff"/>'),
    words: 'osk sha',
    syn: [{ from: 'bone-storm', per: 5, what: 'dmg' }],
  },
  'raise-skeleton': {
    id: 'raise-skeleton', kind: 'active', mana: 30, cd: 12, nameKey: 'skill.raise-skeleton', textKey: 'skill.raise-skeleton.text',
    vars: { count: 2, cap: 2, reach: 5, hp: 50, dmg: 7 }, grow: { count: .15, cap: .25, hp: 10, dmg: 1 }, tree: 'bone', tier: 0, col: 1, req: null,
    icon: I('<rect x="5" y="1" width="6" height="5" fill="#ddd2ea"/><rect x="6" y="3" width="1" height="1" fill="#b06bff"/><rect x="9" y="3" width="1" height="1" fill="#b06bff"/><rect x="6" y="6" width="4" height="1" fill="#a99bc0"/><rect x="4" y="7" width="8" height="1" fill="#ddd2ea"/><rect x="5" y="9" width="6" height="1" fill="#ddd2ea"/><rect x="7" y="7" width="2" height="5" fill="#a99bc0"/><rect x="2" y="12" width="12" height="3" fill="#3b2140"/><rect x="3" y="12" width="10" height="1" fill="#6b3aa0"/>'),
    words: 'osk teth',
  },
  'soul-harvest': {
    id: 'soul-harvest', kind: 'passive', mana: 0, cd: 0, nameKey: 'skill.soul-harvest', textKey: 'skill.soul-harvest.text',
    vars: { mana: 8, soul: .2 }, grow: { mana: 1, soul: .2 }, tree: 'bone', tier: 0, col: 2, req: null,
    icon: I('<rect x="5" y="2" width="6" height="6" fill="#e9e4f0"/><rect x="6" y="4" width="1" height="2" fill="#2a1a24"/><rect x="9" y="4" width="1" height="2" fill="#2a1a24"/><rect x="4" y="9" width="8" height="5" fill="#5f8bff"/><rect x="6" y="10" width="4" height="3" fill="#c8dcff"/>'),
  },
  'corpse-burst': {
    id: 'corpse-burst', kind: 'active', mana: 15, cd: 4, nameKey: 'skill.corpse-burst', textKey: 'skill.corpse-burst.text',
    vars: { min: 18, max: 28, radius: 2, reach: 6 }, grow: { min: 4, max: 6, radius: .05 }, tree: 'bone', tier: 1, col: 0, req: 'bone-spear',
    icon: I('<rect x="5" y="5" width="6" height="5" fill="#e8e1cf"/><rect x="6" y="7" width="1" height="1" fill="#2a1a24"/><rect x="9" y="7" width="1" height="1" fill="#2a1a24"/><rect x="6" y="10" width="4" height="1" fill="#a89f8a"/><rect x="1" y="2" width="2" height="2" fill="#e8e1cf"/><rect x="13" y="2" width="2" height="2" fill="#e8e1cf"/><rect x="1" y="12" width="2" height="2" fill="#b06bff"/><rect x="13" y="12" width="2" height="2" fill="#b06bff"/><rect x="7" y="1" width="2" height="2" fill="#b06bff"/><rect x="7" y="13" width="2" height="2" fill="#e8e1cf"/>'),
    words: 'osk un',
    syn: [{ from: 'bone-spear', per: 6, what: 'dmg' }],
  },
  'skeleton-mastery': {
    id: 'skeleton-mastery', kind: 'passive', mana: 0, cd: 0, nameKey: 'skill.skeleton-mastery', textKey: 'skill.skeleton-mastery.text',
    vars: { pct: 10 }, grow: { pct: 5 }, tree: 'bone', tier: 1, col: 1, req: 'raise-skeleton',
    icon: I('<rect x="4" y="1" width="2" height="2" fill="#c8963c"/><rect x="7" y="0" width="2" height="3" fill="#c8963c"/><rect x="10" y="1" width="2" height="2" fill="#c8963c"/><rect x="4" y="3" width="8" height="1" fill="#c8963c"/><rect x="4" y="4" width="8" height="6" fill="#ddd2ea"/><rect x="5" y="6" width="2" height="2" fill="#6b3aa0"/><rect x="9" y="6" width="2" height="2" fill="#6b3aa0"/><rect x="5" y="10" width="6" height="2" fill="#a99bc0"/><rect x="6" y="12" width="1" height="2" fill="#ddd2ea"/><rect x="9" y="12" width="1" height="2" fill="#ddd2ea"/><rect x="2" y="14" width="12" height="1" fill="#3b2140"/>'),
  },
  'bone-armor': {
    id: 'bone-armor', kind: 'active', mana: 18, cd: 16, nameKey: 'skill.bone-armor', textKey: 'skill.bone-armor.text',
    vars: { absorb: 30, secs: 15 }, grow: { absorb: 8, secs: .5 }, tree: 'bone', tier: 2, col: 2, req: 'soul-harvest',
    icon: I('<rect x="3" y="2" width="10" height="2" fill="#e8e1cf"/><rect x="7" y="2" width="2" height="12" fill="#a89f8a"/><rect x="3" y="5" width="4" height="1" fill="#e8e1cf"/><rect x="9" y="5" width="4" height="1" fill="#e8e1cf"/><rect x="3" y="8" width="4" height="1" fill="#e8e1cf"/><rect x="9" y="8" width="4" height="1" fill="#e8e1cf"/><rect x="4" y="11" width="3" height="1" fill="#e8e1cf"/><rect x="9" y="11" width="3" height="1" fill="#e8e1cf"/><rect x="2" y="3" width="1" height="9" fill="#6b3aa0"/><rect x="13" y="3" width="1" height="9" fill="#6b3aa0"/><rect x="6" y="14" width="4" height="1" fill="#6b3aa0"/>'),
    words: 'osk ka',
    syn: [{ from: 'raise-skeleton', per: 5, what: 'absorb' }],
  },
  'bone-storm': {
    id: 'bone-storm', kind: 'active', mana: 30, cd: 8, nameKey: 'skill.bone-storm', textKey: 'skill.bone-storm.text',
    vars: { count: 5, min: 14, max: 22, range: 6 }, grow: { count: .2, min: 3, max: 4 }, tree: 'bone', tier: 3, col: 0, req: 'corpse-burst',
    icon: I('<rect x="7" y="1" width="2" height="3" fill="#ffffff"/><rect x="7" y="4" width="2" height="6" fill="#e8e1cf"/><rect x="1" y="3" width="2" height="2" fill="#ffffff"/><rect x="3" y="5" width="2" height="2" fill="#e8e1cf"/><rect x="5" y="7" width="2" height="2" fill="#b8ac92"/><rect x="13" y="3" width="2" height="2" fill="#ffffff"/><rect x="11" y="5" width="2" height="2" fill="#e8e1cf"/><rect x="9" y="7" width="2" height="2" fill="#b8ac92"/><rect x="5" y="10" width="6" height="5" fill="#b06bff"/><rect x="6" y="11" width="4" height="3" fill="#e9d8ff"/>'),
    words: 'osk orum sha',
    syn: [{ from: 'bone-spear', per: 4, what: 'dmg' }],
  },
  // ── Shadow: curses and wards ──
  'drain-life': {
    id: 'drain-life', kind: 'active', mana: 12, cd: 4, nameKey: 'skill.drain-life', textKey: 'skill.drain-life.text',
    vars: { min: 18, max: 26, heal: 50 }, grow: { min: 3, max: 5, heal: 1 }, tree: 'shadow', tier: 0, col: 0, req: null,
    icon: I('<rect x="2" y="3" width="5" height="5" fill="#e2452a"/><rect x="3" y="4" width="3" height="3" fill="#ff8a7a"/><rect x="7" y="5" width="2" height="1" fill="#b06bff"/><rect x="9" y="6" width="2" height="1" fill="#b06bff"/><rect x="10" y="8" width="5" height="5" fill="#7fe08a"/><rect x="11" y="9" width="3" height="3" fill="#e6ffe9"/>'),
    words: 'nyr hesk',
    syn: [{ from: 'aura-siphon', per: 4, what: 'dmg' }],
  },
  'ember-curse': {
    id: 'ember-curse', kind: 'active', mana: 10, cd: 6, nameKey: 'skill.ember-curse', textKey: 'skill.ember-curse.text',
    vars: { dps: 5, secs: 8, weaken: 20 }, grow: { dps: 1, secs: .2, weaken: 1 }, tree: 'shadow', tier: 0, col: 1, req: null,
    icon: I('<rect x="4" y="2" width="8" height="8" fill="#3b2140"/><rect x="5" y="4" width="2" height="2" fill="#ff6a2a"/><rect x="9" y="4" width="2" height="2" fill="#ff6a2a"/><rect x="6" y="7" width="4" height="1" fill="#ff6a2a"/><rect x="5" y="10" width="2" height="4" fill="#b06bff"/><rect x="9" y="10" width="2" height="5" fill="#b06bff"/>'),
    words: 'vael un',
    syn: [{ from: 'weaken', per: 5, what: 'dmg' }],
  },
  'dark-ward': {
    id: 'dark-ward', kind: 'active', mana: 20, cd: 18, nameKey: 'skill.dark-ward', textKey: 'skill.dark-ward.text',
    vars: { absorb: 40, secs: 12 }, grow: { absorb: 10, secs: .5 }, tree: 'shadow', tier: 0, col: 2, req: null,
    icon: I('<rect x="3" y="2" width="10" height="9" fill="#6b3aa0"/><rect x="4" y="3" width="8" height="7" fill="#b06bff"/><rect x="5" y="11" width="6" height="2" fill="#6b3aa0"/><rect x="7" y="13" width="2" height="2" fill="#6b3aa0"/><rect x="6" y="5" width="4" height="3" fill="#e9d8ff"/>'),
    words: 'nyr ka',
    syn: [{ from: 'life-tap', per: 6, what: 'absorb' }],
  },
  'aura-siphon': {
    id: 'aura-siphon', kind: 'aura', mana: 0, cd: 0, nameKey: 'skill.aura-siphon', textKey: 'skill.aura-siphon.text',
    vars: { heal: 2 }, grow: { heal: .5 }, tree: 'shadow', tier: 1, col: 0, req: 'drain-life',
    icon: I('<rect x="2" y="2" width="12" height="12" fill="#1c2a1c"/><rect x="4" y="4" width="8" height="8" fill="#5fd35a"/><rect x="7" y="5" width="2" height="6" fill="#e6ffe9"/><rect x="5" y="7" width="6" height="2" fill="#e6ffe9"/>'),
    words: 'nyr hesk ka',
    syn: [{ from: 'drain-life', per: 4, what: 'heal' }],
  },
  'weaken': {
    id: 'weaken', kind: 'active', mana: 12, cd: 8, nameKey: 'skill.weaken', textKey: 'skill.weaken.text',
    vars: { weaken: 25, radius: 2, secs: 8 }, grow: { weaken: 1, radius: .1, secs: .3 }, tree: 'shadow', tier: 1, col: 1, req: 'ember-curse',
    icon: I('<rect x="2" y="2" width="12" height="12" fill="#3b2140"/><rect x="7" y="3" width="2" height="5" fill="#b06bff"/><rect x="4" y="8" width="8" height="2" fill="#b06bff"/><rect x="5" y="10" width="6" height="1" fill="#b06bff"/><rect x="6" y="11" width="4" height="1" fill="#b06bff"/><rect x="7" y="12" width="2" height="1" fill="#e9d8ff"/>'),
    words: 'nyr un',
    syn: [{ from: 'ember-curse', per: 4, what: 'radius' }],
  },
  'life-tap': {
    id: 'life-tap', kind: 'active', mana: 0, cd: 10, nameKey: 'skill.life-tap', textKey: 'skill.life-tap.text',
    vars: { life: 20, mana: 30 }, grow: { mana: 4 }, tree: 'shadow', tier: 2, col: 2, req: 'dark-ward',
    icon: I('<rect x="1" y="3" width="3" height="3" fill="#e2452a"/><rect x="4" y="3" width="3" height="3" fill="#e2452a"/><rect x="2" y="6" width="4" height="2" fill="#e2452a"/><rect x="3" y="8" width="2" height="1" fill="#9e2e1c"/><rect x="7" y="7" width="2" height="1" fill="#b06bff"/><rect x="11" y="5" width="2" height="2" fill="#5f8bff"/><rect x="10" y="7" width="4" height="5" fill="#5f8bff"/><rect x="11" y="8" width="2" height="2" fill="#c8dcff"/>'),
    words: 'hesk un',
  },
  'doom': {
    id: 'doom', kind: 'active', mana: 28, cd: 14, nameKey: 'skill.doom', textKey: 'skill.doom.text',
    vars: { secs: 4, min: 50, max: 80, radius: 2 }, grow: { min: 9, max: 13, radius: .05 }, tree: 'shadow', tier: 3, col: 1, req: 'weaken',
    icon: I('<rect x="3" y="1" width="10" height="1" fill="#6b3aa0"/><rect x="2" y="2" width="12" height="12" fill="#2a1a24"/><rect x="3" y="14" width="10" height="1" fill="#6b3aa0"/><rect x="5" y="4" width="6" height="5" fill="#e9e4f0"/><rect x="6" y="6" width="1" height="1" fill="#ff6a2a"/><rect x="9" y="6" width="1" height="1" fill="#ff6a2a"/><rect x="6" y="9" width="4" height="2" fill="#a99bc0"/><rect x="1" y="7" width="1" height="2" fill="#b06bff"/><rect x="14" y="7" width="1" height="2" fill="#b06bff"/>'),
    words: 'nyr un ul',
    syn: [{ from: 'weaken', per: 6, what: 'dmg' }, { from: 'ember-curse', per: 4, what: 'dmg' }],
  },
  // ── Common: the spells every vocation learns (design-bible §4.6) ──
  'light': {
    id: 'light', kind: 'active', mana: 10, cd: 3, nameKey: 'skill.light', textKey: 'skill.light.text',
    vars: { radius: 3, secs: 300 }, grow: { radius: .1, secs: 15 }, tree: 'common', tier: 0, col: 1, req: null,
    icon: I('<rect x="6" y="1" width="4" height="1" fill="#c99a3e"/><rect x="5" y="2" width="6" height="2" fill="#ffd27a"/><rect x="4" y="4" width="8" height="5" fill="#ffd27a"/><rect x="6" y="5" width="4" height="3" fill="#fffbe8"/><rect x="5" y="9" width="6" height="2" fill="#c99a3e"/><rect x="6" y="11" width="4" height="3" fill="#8a6a3a"/><rect x="1" y="6" width="2" height="1" fill="#ffd27a"/><rect x="13" y="6" width="2" height="1" fill="#ffd27a"/><rect x="2" y="2" width="1" height="1" fill="#fffbe8"/><rect x="13" y="2" width="1" height="1" fill="#fffbe8"/>'),
    words: 'lum',
  },
  'seek': {
    id: 'seek', kind: 'active', mana: 20, cd: 8, nameKey: 'skill.seek', textKey: 'skill.seek.text',
    vars: { secs: 6 }, grow: { secs: .5 }, tree: 'common', tier: 1, col: 1, req: null, level: 8,
    icon: I('<rect x="3" y="3" width="10" height="10" fill="#3a2a14"/><rect x="4" y="4" width="8" height="8" fill="#5a4020"/><rect x="2" y="7" width="1" height="2" fill="#b08a55"/><rect x="13" y="7" width="1" height="2" fill="#b08a55"/><rect x="7" y="2" width="2" height="1" fill="#b08a55"/><rect x="7" y="13" width="2" height="1" fill="#b08a55"/><rect x="9" y="4" width="2" height="2" fill="#fffbe8"/><rect x="8" y="6" width="2" height="2" fill="#ffd27a"/><rect x="6" y="8" width="2" height="2" fill="#c99a3e"/><rect x="5" y="10" width="1" height="1" fill="#8a6a3a"/>'),
    words: 'lum vesh',
  },
  // A town portal (td-waygate.ts, owner 2026-10-21): a gate here, its twin by the nearest hearth. Early: level 2.
  'waygate': {
    id: 'waygate', kind: 'active', mana: 25, cd: 10, nameKey: 'skill.waygate', textKey: 'skill.waygate.text',
    vars: { secs: 300 }, grow: { secs: 15 }, tree: 'common', tier: 0, col: 2, req: null, level: 2,
    icon: I('<rect x="5" y="1" width="6" height="1" fill="#140c1c"/><rect x="4" y="2" width="8" height="12" fill="#3a1f63"/><rect x="3" y="4" width="10" height="8" fill="#3a1f63"/><rect x="4" y="3" width="1" height="10" fill="#d9b8ff"/><rect x="11" y="3" width="1" height="10" fill="#7b3fc4"/><rect x="6" y="4" width="4" height="8" fill="#ffd27a"/><rect x="7" y="6" width="2" height="4" fill="#fff4c2"/><rect x="5" y="14" width="6" height="1" fill="#140c1c"/><rect x="2" y="15" width="12" height="1" fill="#7b3fc4"/>'),
    words: 'ul hesk vesh',
  },
  // ── The Ashguard's three trees (td-ashguard-skills.ts) ──
  ...ASHGUARD_SKILLS,
  // ── The Lanternwright's three trees (td-lantern-skills.ts) ──
  ...LANTERN_SKILLS,
  // ── The Thornstrider's three trees (td-thorn-skills.ts) ──
  ...THORN_SKILLS,
};

/** Vars that count whole things (skeletons, spears, the most raised at once): a rank adds a fraction, the fight takes the whole part. */
const WHOLE_VARS = new Set(['count', 'cap', 'length', 'soul']);
/** The synergies a skill gets now: each source, its bought ranks, and the % it adds (0 when none are bought). */
export function synergies(id: SkillId, bought: Readonly<Partial<Record<SkillId, number>>> | null = null): { from: SkillId; per: number; what: SynergyVar; ranks: number; pct: number }[] {
  return (SKILLS[id].syn ?? []).map(s => {
    // Only another skill's ranks count (never this skill's own, never its numbers), so a pair that feeds each other
    // (Nova ↔ Aura of Embers) can't loop: a bonus is read off points, not off another bonus.
    const ranks = s.from === id ? 0 : Math.max(0, Math.min(MAX_RANK, Math.floor(bought?.[s.from] ?? 0) || 0));
    return { ...s, ranks, pct: ranks * s.per };
  });
}
/**
 * A skill's numbers at a rank (rank 0 reads as rank 1: what the first point would give). Never smaller at a higher
 * rank. `bought` (td-tree boughtRanks): the points bought in each skill — the synergies (design-bible §4.1) add their
 * per-rank % on top, each var capped at +SYN_CAP %; none bought (or null) leaves the numbers exactly as before.
 */
export function skillVars(id: SkillId, rank: number, bought: Readonly<Partial<Record<SkillId, number>>> | null = null): Record<string, number> {
  const sk = SKILLS[id], r = Math.max(1, Math.min(MAX_RANK, Math.floor(rank) || 1)), out: Record<string, number> = {};
  const boost: Record<string, number> = {};
  for (const s of synergies(id, bought)) for (const k of SYN_VARS[s.what]) boost[k] = (boost[k] ?? 0) + s.pct;
  for (const [k, base] of Object.entries(sk.vars)) {
    const g = sk.grow[k] ?? 0, v = (base + g * (r - 1)) * (100 + Math.min(SYN_CAP, boost[k] ?? 0)) / 100;
    // A var that counts in whole numbers (damage, absorb) stays whole when a synergy lifts it, a half rounding up; a
    // skeleton count that grows by fractions takes the whole part.
    out[k] = Number.isInteger(base) && Number.isInteger(g) ? Math.round(v) : WHOLE_VARS.has(k) ? Math.floor(v + 1e-9) : Math.round(v * 10) / 10;
  }
  return out;
}

/**
 * What worn gear adds to a skill (the boss uniques' and the item sets' signatures, rpg/boss-uniques relicTotals) — the
 * one place both the fight (td-mobs MobSystem) and the Spellbook's card read, so the card's numbers are the fight's.
 */
export type GearSig = Pick<RelicTotals, 'ranks' | 'cdCut' | 'raisedMax' | 'spears' | 'spearRange'>;
export const NO_GEAR_SIG: GearSig = { ranks: {}, cdCut: {}, raisedMax: 0, spears: 0, spearRange: 0 };
/** A skill's rank in the fight: the tree's, plus the ranks worn gear adds to a skill already learnt (never past MAX_RANK). */
export function castRank(id: SkillId, treeRank: number, sig: GearSig = NO_GEAR_SIG, allRanks = 0): number {
  const base = Math.max(0, Math.floor(treeRank) || 0);
  // `allRanks`: a caster's worn +Spells (item-affixes skillRanks, fightStats ranks) — every learnt skill, D2's +skills.
  return base > 0 ? Math.min(MAX_RANK, base + Math.max(0, sig.ranks[id] ?? 0) + Math.max(0, Math.floor(allRanks) || 0)) : 0;
}
/**
 * A skill's numbers in the fight (before the sky's hand, td-phases): its rank's and synergies' (skillVars), plus what
 * worn gear adds — more skeletons at once, more spears in a storm, a spear that flies further.
 */
export function castVars(id: SkillId, rank: number, bought: Readonly<Partial<Record<SkillId, number>>> | null = null, sig: GearSig = NO_GEAR_SIG): Record<string, number> {
  const out = skillVars(id, rank, bought);
  if (id === 'raise-skeleton') out['cap'] += Math.max(0, sig.raisedMax);
  if (id === 'bone-storm') out['count'] = Math.max(1, out['count'] + Math.max(0, sig.spears));
  // The Splinterbow (boss-uniques.ts): the same "more missiles" signature looses more arrows in a Volley.
  if (id === 'volley') out['count'] = Math.max(1, out['count'] + Math.max(0, sig.spears));
  if (id === 'bone-spear') out['range'] += Math.max(0, sig.spearRange);
  return out;
}
/** A spell's cooldown (seconds, before cast speed): its own, less what worn gear cuts from it, never under half a second. */
export function castCd(id: SkillId, sig: GearSig = NO_GEAR_SIG): number {
  return Math.max(.5, SKILLS[id].cd - Math.max(0, sig.cdCut[id] ?? 0));
}
/** The cooldown the Keeper actually waits: castCd ÷ (1 + worn cast speed), to a tenth. */
export function cooldownNow(id: SkillId, castSpeed: number, sig: GearSig = NO_GEAR_SIG): number {
  return Math.round(castCd(id, sig) / (1 + Math.max(0, castSpeed)) * 10) / 10;
}

/** The Ashguard's skills that strike with a share of the Watch Blade's blow (their damage is the blade's, td-mobs strike). */
export const BLADE_SHARE: ReadonlySet<SkillId> = new Set<SkillId>(['ember-brand', 'cinder-cleave', 'whirl-of-cinders', 'ash-stride']);
/** The skills whose damage is fire (td-mobs fireMult: Ember Mastery and worn fire lift them). */
export const FIRE_SKILLS: ReadonlySet<SkillId> = new Set<SkillId>(['ember-bolt', 'hellfire-nova', 'aura-embers', 'cinder-rain', 'flame-wall', 'meteor', 'ember-curse', 'ember-brand', 'cinder-cleave', 'whirl-of-cinders']);
/**
 * Does the skill's damage land through the fight's hit (td-mobs hitFoe), so spell power and crits lift it? Anything
 * with damage numbers on its card, and the blade's shares. (A raised skeleton's blow has the power baked in already.)
 */
export function dealsDamage(id: SkillId): boolean {
  const v = SKILLS[id].vars;
  return 'min' in v || 'dps' in v || BLADE_SHARE.has(id);
}

/** The skills a new Keeper of the class starts with at rank 1, free (a new Warlock fights as before the trees). */
export const STARTER_RANKS: Readonly<Record<Vocation, readonly SkillId[]>> = {
  // Light is Glim's first word, taught the first night: every Keeper holds it free (design-bible §4.6).
  warlock: ['ember-bolt', 'drain-life', 'ember-curse', 'hellfire-nova', 'dark-ward', 'aura-embers', 'soul-harvest', 'light'],
  ashguard: [...ASHGUARD_STARTERS, 'light'],
  lanternwright: [...LANTERN_STARTERS, 'light'],
  thornstrider: [...THORN_STARTERS, 'light'],
};

/** Each class's book: its actives (the order is the default bar), its auras, its passives. */
export const CLASS_SKILLS: Readonly<Record<Vocation, readonly SkillId[]>> = {
  // The first four actives are the default bar; Bone Spear and Raise Skeleton wait in the Spellbook to be put on a key.
  warlock: ['drain-life', 'ember-curse', 'hellfire-nova', 'dark-ward', 'bone-spear', 'raise-skeleton', 'aura-embers', 'aura-siphon', 'ember-bolt', 'soul-harvest',
    'cinder-rain', 'flame-wall', 'ember-mastery', 'meteor', 'corpse-burst', 'skeleton-mastery', 'bone-armor', 'bone-storm', 'weaken', 'life-tap', 'doom',
    // The common page (every vocation's): Light, the Seek and the Waygate.
    'light', 'seek', 'waygate'],
  ashguard: [...ASHGUARD_BOOK, 'light', 'seek', 'waygate'],
  lanternwright: [...LANTERN_BOOK, 'light', 'seek', 'waygate'],
  thornstrider: [...THORN_BOOK, 'light', 'seek', 'waygate'],
};

export const MAX_MANA = 60;

/**
 * What a level and the points spent give (Tibia's levels + D2's attributes): each level above 1 adds 8 life, 6 mana
 * and 5% spell power; each point of Vitality 6 life, of Energy 4 mana and a little regeneration, of Spirit 2% spell
 * power, of Agility 1% speed of foot and of the staff (to 30%).
 */
export const ATTR_STEP = { vit: 6, ene: 4, eneRegen: .15, spi: .02, agi: .01, agiCap: .3 } as const;
/**
 * What a class's body is made of (design-bible §4.4: the Ashguard is Vitality-led): life and mana as shares of the
 * level's, and Defense it carries before any gear (a base, plus a little each level). The Warlock is the yardstick.
 */
export const VOCATION_BODY: Readonly<Record<Vocation, { life: number; mana: number; defense: number; defenseLevel: number; speed?: number }>> = {
  warlock: { life: 1, mana: 1, defense: 0, defenseLevel: 0 },
  ashguard: { life: 1.3, mana: .6, defense: 8, defenseLevel: 1 },
  // The Lanternwright (design-bible §4.3): a support's body — a little less life, a deep well of mana, no plate.
  lanternwright: { life: .9, mana: 1.4, defense: 0, defenseLevel: 0 },
  // The Thornstrider (design-bible §4.5): balanced, a little life over a little mana, light leather — and lighter feet
  // (`speed`: a share of pace added to Agility and worn Move Speed, under the same 40% cap; the level's pace on top).
  thornstrider: { life: 1.05, mana: .95, defense: 0, defenseLevel: 0, speed: .06 },
};
export function levelStats(level: number, stats: KeeperStats = { vit: 0, ene: 0, spi: 0, agi: 0 }, v: Vocation = 'warlock'): { maxHp: number; maxMana: number; power: number; regen: number; haste: number } {
  // Level steps: exactly level − 1 to 100, a gentle log taper past it so 10,000 stays sane (shared/skills/keeper-level.ts).
  const n = levelSteps(level), body = VOCATION_BODY[v] ?? VOCATION_BODY.warlock;
  return {
    maxHp: Math.round((100 + n * LEVEL_GROWTH.life) * body.life) + stats.vit * ATTR_STEP.vit,
    maxMana: Math.round((MAX_MANA + n * LEVEL_GROWTH.mana) * body.mana) + stats.ene * ATTR_STEP.ene,
    power: 1 + n * LEVEL_GROWTH.power + stats.spi * ATTR_STEP.spi,
    regen: MANA_REGEN + stats.ene * ATTR_STEP.eneRegen,
    haste: Math.min(ATTR_STEP.agiCap, stats.agi * ATTR_STEP.agi),
  };
}
/** Mana back per second. */
export const MANA_REGEN = 3;

/** Worn-total caps (docs/design/loot-and-combat.md §3): they bound the fight, never the roll. */
export const GEAR_CAPS = {
  spellDamage: 150, castSpeed: 40, critChance: 40, moveSpeed: 40,
  // §3.6: the fighters' twins and the families' own.
  attackDamage: 150, attackSpeed: 40, lifeLeech: 20, pierceChance: 50, blockChance: 50, skillRanks: 3,
} as const;
/** A crit hits this many times as hard. */
export const CRIT_MULT = 1.75;

/** The share of a blow Defense turns aside at this level: D ÷ (D + 40 + 6 × level). */
export function defenseReduction(defense: number, level: number): number {
  const d = Math.max(0, defense || 0);
  return d / (d + 40 + 6 * Math.max(1, Math.floor(level)));
}

export interface FightStats {
  maxHp: number;
  maxMana: number;
  /**
   * The damage multiplier: the level's, Spirit's, and the worn damage % of the class's own family (§3.6) — Spell
   * Damage for a caster (Warlock, Lanternwright), Martial Damage for a fighter (Ashguard, Thornstrider).
   */
  power: number;
  /** Which family `power` and `castSpeed` read: 'spell' (casters) or 'martial' (fighters). */
  family: DamageFamily;
  /** The worn damage % in `power` (the family's, after its cap): the Thornstrider's beast bites by it too. */
  damagePct: number;
  /** A fighter's Life Steal (0..0.2): this share of every blow he lands comes back as life. 0 for a caster. */
  leech: number;
  /** Worn Pierce, in points (0..50): added to every Thorn Shot's own chance. The Thornstrider's alone. */
  pierce: number;
  /** Worn Block (0..0.5): the chance a blow is turned aside whole. */
  block: number;
  /** A caster's worn +Spells (0..3): every learnt spell casts that many ranks higher (castRank). 0 for a fighter. */
  ranks: number;
  /** Mana back per second. */
  regen: number;
  /** Agility's quicker staff (fraction). */
  haste: number;
  /** Faster on foot: Agility + worn Movement Speed, together capped at 40%. */
  moveHaste: number;
  /** The level's own pace (Tibia: higher level, faster feet; keeper-level levelSpeedBonus, → 0.6). Multiplies moveHaste. */
  levelPace: number;
  /**
   * The class's own speed (§3.6): worn Cast Speed for a caster, Attack Speed for a fighter. Skill cooldowns and the
   * basic attack's pace (the bolt, the Kindle, the swing, the Thorn Shot) are divided by 1 + this.
   */
  castSpeed: number;
  /** Chance (0..1) a hit crits ×1.75. */
  crit: number;
  defense: number;
  /** Life back per second, always (negative: a curse drains it). */
  lifeRegen: number;
  /** Worn resists per element (its own + All Resist), each capped at 75. */
  resists: Record<Element, number>;
}

/** The ItemStats key that resists each element. */
export const RESIST_STAT: Readonly<Record<Element, 'fireResist' | 'coldResist' | 'lightningResist' | 'arcaneResist'>> = {
  fire: 'fireResist', cold: 'coldResist', lightning: 'lightningResist', arcane: 'arcaneResist',
};

/**
 * A creature's blow or shot on the Keeper (docs/design/loot-and-combat.md §6): physical is cut by Defense (as it
 * always was), an element by its worn resist alone — dmg × (1 − min(75, resist) ÷ 100). Never below 1.
 */
export function incomingDamage(raw: number, type: DamageType, defense: number, level: number, resists: Partial<Record<Element, number>> = {}): number {
  if (!(raw > 0)) return 0;
  if (type === 'physical') return defense > 0 ? Math.max(1, Math.round(raw * (1 - defenseReduction(defense, level)))) : Math.round(raw);
  // A curse can take a resist below zero (Hollow Ward, a whisper): then the element bites harder, as D2's does.
  const r = Math.max(MIN_RESIST, Math.min(MAX_KEEPER_RESIST, resists[type] ?? 0));
  return Math.max(1, Math.round(raw * (1 - r / 100)));
}

/**
 * The worn gear's combat affixes, read key by key off the inventory's equipped totals — this is the fight's read
 * of each stat (scripts/check-meaning.js counts `equippedTotals.<key>` as a live stat).
 */
export function wornCombat(
  inventory: { readonly equippedTotals: Required<ItemStats>; readonly equippedOldRolls?: { attackDamage: number; attackSpeed: number } },
  worn: readonly string[] = [],
): Partial<ItemStats> {
  // `worn`: the definition ids worn, so the item sets' tiers (rpg/set-items.ts) ride on the totals into fightStats.
  // Old rolls (rpg/item-calling.ts): Spell Damage / Cast Speed on a piece that can no longer roll them also count as the
  // fighters' Martial Damage / Attack Speed — fightStats reads only the wearer's own family, so nothing counts twice.
  const old = inventory.equippedOldRolls ?? { attackDamage: 0, attackSpeed: 0 };
  return addSetBonuses({
    life: inventory.equippedTotals.life,
    mana: inventory.equippedTotals.mana,
    defense: inventory.equippedTotals.defense,
    spellDamage: inventory.equippedTotals.spellDamage,
    castSpeed: inventory.equippedTotals.castSpeed,
    moveSpeed: inventory.equippedTotals.moveSpeed,
    critChance: inventory.equippedTotals.critChance,
    lifeRegen: inventory.equippedTotals.lifeRegen,
    manaRegen: inventory.equippedTotals.manaRegen,
    fireResist: inventory.equippedTotals.fireResist,
    coldResist: inventory.equippedTotals.coldResist,
    lightningResist: inventory.equippedTotals.lightningResist,
    arcaneResist: inventory.equippedTotals.arcaneResist,
    allResist: inventory.equippedTotals.allResist,
    attackDamage: inventory.equippedTotals.attackDamage + old.attackDamage,
    attackSpeed: inventory.equippedTotals.attackSpeed + old.attackSpeed,
    lifeLeech: inventory.equippedTotals.lifeLeech,
    pierceChance: inventory.equippedTotals.pierceChance,
    blockChance: inventory.equippedTotals.blockChance,
    skillRanks: inventory.equippedTotals.skillRanks,
  }, worn);
}

/** The level and attributes (levelStats) with the worn gear totals on top. */
/**
 * `resistPenalty`: the difficulty tier's (shared/loot/difficulty.model: Nightmare 40, Hell 100), taken off every worn
 * resist before the 75 cap — D2's order, so resist piled past 75 is what holds the cap under a penalty.
 */
export function fightStats(level: number, stats?: KeeperStats, gear: Partial<ItemStats> = {}, v: Vocation = 'warlock', resistPenalty = 0): FightStats {
  const base = levelStats(level, stats, v), body = VOCATION_BODY[v] ?? VOCATION_BODY.warlock;
  const g = (n: number | undefined) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0);
  const signed = (n: number | undefined) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);
  // §3.6: each calling reads its own damage family — the casters Spell Damage and Cast Speed, the fighters Martial
  // Damage and Attack Speed (rpg/item-calling.ts). The other family's numbers do nothing for it.
  const family = damageFamilyOf(v), caster = family === 'spell';
  const damagePct = caster ? Math.min(GEAR_CAPS.spellDamage, g(gear.spellDamage)) : Math.min(GEAR_CAPS.attackDamage, g(gear.attackDamage));
  const speed = caster ? Math.min(GEAR_CAPS.castSpeed, g(gear.castSpeed)) : Math.min(GEAR_CAPS.attackSpeed, g(gear.attackSpeed));
  return {
    maxHp: base.maxHp + Math.round(g(gear.life)),
    maxMana: base.maxMana + Math.round(g(gear.mana)),
    power: base.power * (1 + damagePct / 100),
    family,
    damagePct,
    leech: caster ? 0 : Math.min(GEAR_CAPS.lifeLeech, g(gear.lifeLeech)) / 100,
    pierce: v === 'thornstrider' ? Math.min(GEAR_CAPS.pierceChance, g(gear.pierceChance)) : 0,
    block: Math.min(GEAR_CAPS.blockChance, g(gear.blockChance)) / 100,
    ranks: caster ? Math.min(GEAR_CAPS.skillRanks, Math.floor(g(gear.skillRanks))) : 0,
    regen: base.regen + g(gear.manaRegen),
    haste: base.haste,
    // A cursed grave-good's Leaden Step can push worn Move Speed below zero: slower feet, never below 70% pace.
    moveHaste: Math.max(-.3, Math.min(GEAR_CAPS.moveSpeed / 100, base.haste + signed(gear.moveSpeed) / 100 + (body.speed ?? 0))),
    levelPace: levelSpeedBonus(level),
    castSpeed: speed / 100,
    crit: Math.min(GEAR_CAPS.critChance, g(gear.critChance)) / 100,
    // The class's own Defense (an Ashguard's plate and shield) under the worn gear's.
    defense: g(gear.defense) + body.defense + Math.round(levelSteps(level) * body.defenseLevel),
    // Signed: a Grave-cold curse (shared/grave-goods) drains life slowly; the engine never lets it take the last point.
    lifeRegen: signed(gear.lifeRegen),
    // All Resist is signed (a Hollow Ward curse or a whispering item takes some away), so a resist can fall below zero
    // and that element then bites harder — the curse's "−15% All Resist" is a real price even with no resist worn.
    resists: Object.fromEntries(ELEMENTS.map(el => [el, Math.max(MIN_RESIST, Math.min(MAX_KEEPER_RESIST, g(gear[RESIST_STAT[el]]) + signed(gear.allResist) - Math.max(0, resistPenalty)))])) as Record<Element, number>,
  };
}

/** The default bar (keys 1–4) and aura for a class. */
export function defaultBar(v: Vocation): SkillId[] { return CLASS_SKILLS[v].filter(id => SKILLS[id].kind === 'active').slice(0, 4); }
export function defaultAura(v: Vocation): SkillId | null { return CLASS_SKILLS[v].find(id => SKILLS[id].kind === 'aura') ?? null; }
