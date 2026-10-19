/**
 * td-skills.ts — the classes' skills as data (owner, 2026-10-20: "our 1st class, let it be a warlock"; "a skill menu …
 * think of tibia or diablo 2 … view passive skills like auras … we need to know what the skills do").
 *
 * One record per skill: what it is (an active on the bar, an aura that runs while chosen, a passive always on), what it
 * costs, how long it cools, and the words that say what it does — the skill window (Spellbook) reads exactly this, and
 * the fight (td-mobs.ts) carries out exactly this, so the two can never disagree.
 */
import type { KeeperStats, Vocation } from '../../shared/keeper-look/keeper-look.model';

export type SkillKind = 'active' | 'aura' | 'passive';
export type SkillId =
  | 'drain-life' | 'ember-curse' | 'hellfire-nova' | 'dark-ward'
  | 'aura-embers' | 'aura-siphon'
  | 'soul-harvest' | 'ember-bolt';

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
  /** Numbers the line quotes, so the words always match the fight. */
  vars: Readonly<Record<string, number>>;
  /** The pixel icon (svg rects inside a 16×16 box). */
  icon: string;
}

const I = (rects: string) => rects;

export const SKILLS: Readonly<Record<SkillId, SkillDef>> = {
  'ember-bolt': {
    id: 'ember-bolt', kind: 'passive', mana: 0, cd: .9, nameKey: 'skill.ember-bolt', textKey: 'skill.ember-bolt.text',
    vars: { min: 8, max: 13, range: 7 },
    icon: I('<rect x="9" y="2" width="5" height="5" fill="#ffd25a"/><rect x="7" y="5" width="5" height="4" fill="#ff8a2e"/><rect x="3" y="9" width="5" height="4" fill="#b06bff"/><rect x="1" y="12" width="3" height="3" fill="#6b3aa0"/>'),
  },
  'drain-life': {
    id: 'drain-life', kind: 'active', mana: 12, cd: 4, nameKey: 'skill.drain-life', textKey: 'skill.drain-life.text',
    vars: { min: 18, max: 26, heal: 50 },
    icon: I('<rect x="2" y="3" width="5" height="5" fill="#e2452a"/><rect x="3" y="4" width="3" height="3" fill="#ff8a7a"/><rect x="7" y="5" width="2" height="1" fill="#b06bff"/><rect x="9" y="6" width="2" height="1" fill="#b06bff"/><rect x="10" y="8" width="5" height="5" fill="#7fe08a"/><rect x="11" y="9" width="3" height="3" fill="#e6ffe9"/>'),
  },
  'ember-curse': {
    id: 'ember-curse', kind: 'active', mana: 10, cd: 6, nameKey: 'skill.ember-curse', textKey: 'skill.ember-curse.text',
    vars: { dps: 5, secs: 8, weaken: 20 },
    icon: I('<rect x="4" y="2" width="8" height="8" fill="#3b2140"/><rect x="5" y="4" width="2" height="2" fill="#ff6a2a"/><rect x="9" y="4" width="2" height="2" fill="#ff6a2a"/><rect x="6" y="7" width="4" height="1" fill="#ff6a2a"/><rect x="5" y="10" width="2" height="4" fill="#b06bff"/><rect x="9" y="10" width="2" height="5" fill="#b06bff"/>'),
  },
  'hellfire-nova': {
    id: 'hellfire-nova', kind: 'active', mana: 25, cd: 9, nameKey: 'skill.hellfire-nova', textKey: 'skill.hellfire-nova.text',
    vars: { min: 20, max: 30, radius: 3 },
    icon: I('<rect x="6" y="2" width="4" height="3" fill="#ffd25a"/><rect x="4" y="4" width="8" height="4" fill="#ff8a2e"/><rect x="3" y="7" width="10" height="5" fill="#e2552a"/><rect x="6" y="8" width="4" height="3" fill="#ffd25a"/><rect x="2" y="12" width="12" height="2" fill="#9e2e1c"/>'),
  },
  'dark-ward': {
    id: 'dark-ward', kind: 'active', mana: 20, cd: 18, nameKey: 'skill.dark-ward', textKey: 'skill.dark-ward.text',
    vars: { absorb: 40, secs: 12 },
    icon: I('<rect x="3" y="2" width="10" height="9" fill="#6b3aa0"/><rect x="4" y="3" width="8" height="7" fill="#b06bff"/><rect x="5" y="11" width="6" height="2" fill="#6b3aa0"/><rect x="7" y="13" width="2" height="2" fill="#6b3aa0"/><rect x="6" y="5" width="4" height="3" fill="#e9d8ff"/>'),
  },
  'aura-embers': {
    id: 'aura-embers', kind: 'aura', mana: 0, cd: 0, nameKey: 'skill.aura-embers', textKey: 'skill.aura-embers.text',
    vars: { dps: 3, radius: 3 },
    icon: I('<rect x="2" y="2" width="12" height="12" fill="#3b1c14"/><rect x="4" y="4" width="8" height="8" fill="#ff8a2e"/><rect x="6" y="6" width="4" height="4" fill="#ffd25a"/><rect x="1" y="7" width="1" height="2" fill="#ff8a2e"/><rect x="14" y="7" width="1" height="2" fill="#ff8a2e"/>'),
  },
  'aura-siphon': {
    id: 'aura-siphon', kind: 'aura', mana: 0, cd: 0, nameKey: 'skill.aura-siphon', textKey: 'skill.aura-siphon.text',
    vars: { heal: 2 },
    icon: I('<rect x="2" y="2" width="12" height="12" fill="#1c2a1c"/><rect x="4" y="4" width="8" height="8" fill="#5fd35a"/><rect x="7" y="5" width="2" height="6" fill="#e6ffe9"/><rect x="5" y="7" width="6" height="2" fill="#e6ffe9"/>'),
  },
  'soul-harvest': {
    id: 'soul-harvest', kind: 'passive', mana: 0, cd: 0, nameKey: 'skill.soul-harvest', textKey: 'skill.soul-harvest.text',
    vars: { mana: 8 },
    icon: I('<rect x="5" y="2" width="6" height="6" fill="#e9e4f0"/><rect x="6" y="4" width="1" height="2" fill="#2a1a24"/><rect x="9" y="4" width="1" height="2" fill="#2a1a24"/><rect x="4" y="9" width="8" height="5" fill="#5f8bff"/><rect x="6" y="10" width="4" height="3" fill="#c8dcff"/>'),
  },
};

/** Each class's book: its actives (the order is the default bar), its auras, its passives. */
export const CLASS_SKILLS: Readonly<Record<Vocation, readonly SkillId[]>> = {
  warlock: ['drain-life', 'ember-curse', 'hellfire-nova', 'dark-ward', 'aura-embers', 'aura-siphon', 'ember-bolt', 'soul-harvest'],
};

export const MAX_MANA = 60;

/**
 * What a level and the points spent give (Tibia's levels + D2's attributes): each level above 1 adds 8 life, 6 mana
 * and 5% spell power; each point of Vitality 6 life, of Energy 4 mana and a little regeneration, of Spirit 2% spell
 * power, of Agility 1% speed of foot and of the staff (to 30%).
 */
export const ATTR_STEP = { vit: 6, ene: 4, eneRegen: .15, spi: .02, agi: .01, agiCap: .3 } as const;
export function levelStats(level: number, stats: KeeperStats = { vit: 0, ene: 0, spi: 0, agi: 0 }): { maxHp: number; maxMana: number; power: number; regen: number; haste: number } {
  const n = Math.max(0, Math.floor(level) - 1);
  return {
    maxHp: 100 + n * 8 + stats.vit * ATTR_STEP.vit,
    maxMana: MAX_MANA + n * 6 + stats.ene * ATTR_STEP.ene,
    power: 1 + n * .05 + stats.spi * ATTR_STEP.spi,
    regen: MANA_REGEN + stats.ene * ATTR_STEP.eneRegen,
    haste: Math.min(ATTR_STEP.agiCap, stats.agi * ATTR_STEP.agi),
  };
}
/** Mana back per second. */
export const MANA_REGEN = 3;

/** The default bar (keys 1–4) and aura for a class. */
export function defaultBar(v: Vocation): SkillId[] { return CLASS_SKILLS[v].filter(id => SKILLS[id].kind === 'active').slice(0, 4); }
export function defaultAura(v: Vocation): SkillId | null { return CLASS_SKILLS[v].find(id => SKILLS[id].kind === 'aura') ?? null; }
