/**
 * td-ashguard-skills.ts — the Ashguard's book as data (docs/design/design-bible.md §4.4, roadmap §10 item 15: "a second
 * way to play"). The melee knight of the Pyre Watch: shield, blade and oaths spoken aloud.
 *
 * Three trees, as the bible names them — **Brand** (fire on the blade), **Oath** (shield, taunt, guard) and **Ash**
 * (endurance, the "won't fall" tree) — twelve skills in all, ranked and synergised exactly like the Warlock's
 * (td-skills SkillDef, td-tree rules). The Spellbook reads these records and td-mobs.ts carries them out, so the words
 * on the card and the fight can never disagree. Every spell speaks the Seam-Cant with the iron root `brann` in it.
 *
 * The synergy graph is a tree (no pair feeds each other), and no word is shared with the Warlock's book.
 */
import type { SkillDef } from './td-skills';

export type AshSkillId =
  | 'watch-blade' | 'ember-brand' | 'cinder-cleave' | 'whirl-of-cinders'
  | 'shield-bash' | 'shield-oath' | 'watch-cry' | 'hold-the-line'
  | 'ash-stride' | 'aura-watchfire' | 'ember-blood' | 'last-watch';

/** The Ashguard's three trees (D2's three tabs), in the bible's order of feel: the blade, the shield, the endurance. */
export const ASH_TREES = ['brand', 'oath', 'ash'] as const;

const I = (rects: string) => rects;

export const ASHGUARD_SKILLS: Readonly<Record<AshSkillId, SkillDef>> = {
  // ── Brand: fire on the blade ──
  'watch-blade': {
    id: 'watch-blade', kind: 'passive', mana: 0, cd: .8, nameKey: 'skill.watch-blade', textKey: 'skill.watch-blade.text',
    vars: { min: 9, max: 14, reach: 1.6, arc: 110 }, grow: { min: 1, max: 2 }, tree: 'brand', tier: 0, col: 0, req: null,
    icon: I('<rect x="11" y="1" width="3" height="2" fill="#f2f5fa"/><rect x="9" y="3" width="3" height="2" fill="#c3cad6"/><rect x="7" y="5" width="3" height="2" fill="#c3cad6"/><rect x="5" y="7" width="3" height="2" fill="#7d8796"/><rect x="2" y="7" width="3" height="1" fill="#c99a3e"/><rect x="5" y="10" width="1" height="3" fill="#c99a3e"/><rect x="3" y="9" width="2" height="2" fill="#6e4526"/><rect x="1" y="11" width="2" height="2" fill="#e2552a"/><rect x="12" y="10" width="1" height="1" fill="#ffb347"/><rect x="13" y="12" width="1" height="1" fill="#ffb347"/><rect x="10" y="13" width="1" height="1" fill="#e2552a"/>'),
  },
  'ember-brand': {
    id: 'ember-brand', kind: 'active', mana: 12, cd: 12, nameKey: 'skill.ember-brand', textKey: 'skill.ember-brand.text',
    vars: { pct: 40, burn: 6, secs: 8 }, grow: { pct: 4, burn: 1, secs: .3 }, tree: 'brand', tier: 0, col: 1, req: null,
    icon: I('<rect x="7" y="1" width="2" height="9" fill="#ffb347"/><rect x="7" y="1" width="1" height="9" fill="#fff2a8"/><rect x="6" y="3" width="1" height="5" fill="#e2552a"/><rect x="9" y="3" width="1" height="5" fill="#e2552a"/><rect x="4" y="10" width="8" height="1" fill="#c99a3e"/><rect x="7" y="11" width="2" height="3" fill="#6e4526"/><rect x="7" y="14" width="2" height="1" fill="#e0b25a"/><rect x="4" y="2" width="1" height="1" fill="#ffb347"/><rect x="11" y="4" width="1" height="1" fill="#fff2a8"/><rect x="3" y="6" width="1" height="1" fill="#e2552a"/>'),
    words: 'brann vael sha',
    syn: [{ from: 'ember-blood', per: 4, what: 'dur' }],
  },
  'cinder-cleave': {
    id: 'cinder-cleave', kind: 'active', mana: 14, cd: 5, nameKey: 'skill.cinder-cleave', textKey: 'skill.cinder-cleave.text',
    vars: { pct: 100, reach: 2, arc: 160 }, grow: { pct: 4, reach: .03 }, tree: 'brand', tier: 1, col: 1, req: 'ember-brand',
    icon: I('<rect x="2" y="3" width="3" height="2" fill="#e2552a"/><rect x="4" y="2" width="4" height="2" fill="#ffb347"/><rect x="8" y="2" width="4" height="2" fill="#fff2a8"/><rect x="11" y="3" width="3" height="2" fill="#ffb347"/><rect x="13" y="5" width="2" height="3" fill="#e2552a"/><rect x="1" y="5" width="2" height="2" fill="#9e2e1c"/><rect x="6" y="7" width="2" height="7" fill="#c3cad6"/><rect x="6" y="7" width="1" height="7" fill="#f2f5fa"/><rect x="4" y="12" width="6" height="1" fill="#c99a3e"/>'),
    words: 'brann vael mur',
    syn: [{ from: 'ember-brand', per: 5, what: 'dmg' }],
  },
  'whirl-of-cinders': {
    id: 'whirl-of-cinders', kind: 'active', mana: 26, cd: 10, nameKey: 'skill.whirl-of-cinders', textKey: 'skill.whirl-of-cinders.text',
    vars: { pct: 60, hits: 4, radius: 2 }, grow: { pct: 4, radius: .05 }, tree: 'brand', tier: 3, col: 1, req: 'cinder-cleave',
    icon: I('<rect x="6" y="1" width="4" height="2" fill="#ffb347"/><rect x="11" y="3" width="2" height="3" fill="#e2552a"/><rect x="12" y="7" width="2" height="3" fill="#ffb347"/><rect x="9" y="12" width="4" height="2" fill="#e2552a"/><rect x="3" y="12" width="4" height="2" fill="#ffb347"/><rect x="2" y="7" width="2" height="3" fill="#e2552a"/><rect x="3" y="3" width="2" height="3" fill="#ffb347"/><rect x="7" y="6" width="2" height="4" fill="#c3cad6"/><rect x="6" y="7" width="4" height="2" fill="#f2f5fa"/><rect x="7" y="7" width="2" height="2" fill="#fff2a8"/>'),
    words: 'vael orum brann',
    syn: [{ from: 'cinder-cleave', per: 5, what: 'dmg' }],
  },
  // ── Oath: shield, taunt, guard ──
  'shield-bash': {
    id: 'shield-bash', kind: 'active', mana: 8, cd: 6, nameKey: 'skill.shield-bash', textKey: 'skill.shield-bash.text',
    vars: { min: 10, max: 16, stun: 1.2 }, grow: { min: 2, max: 3, stun: .05 }, tree: 'oath', tier: 0, col: 0, req: null,
    icon: I('<rect x="2" y="2" width="9" height="11" fill="#8a6a2a"/><rect x="3" y="3" width="7" height="9" fill="#e0b25a"/><rect x="4" y="4" width="5" height="7" fill="#5a3a2a"/><rect x="6" y="5" width="1" height="5" fill="#ffb347"/><rect x="5" y="7" width="3" height="1" fill="#ffb347"/><rect x="11" y="5" width="2" height="1" fill="#fff2c8"/><rect x="12" y="7" width="3" height="1" fill="#fff2c8"/><rect x="11" y="9" width="2" height="1" fill="#fff2c8"/><rect x="5" y="13" width="3" height="1" fill="#8a6a2a"/>'),
    words: 'brann mur',
  },
  'shield-oath': {
    id: 'shield-oath', kind: 'active', mana: 12, cd: 16, nameKey: 'skill.shield-oath', textKey: 'skill.shield-oath.text',
    vars: { block: 30, secs: 6 }, grow: { block: 1, secs: .2 }, tree: 'oath', tier: 0, col: 2, req: null,
    icon: I('<rect x="1" y="1" width="14" height="1" fill="#e0b25a"/><rect x="1" y="14" width="14" height="1" fill="#e0b25a"/><rect x="1" y="1" width="1" height="14" fill="#e0b25a"/><rect x="14" y="1" width="1" height="14" fill="#e0b25a"/><rect x="4" y="3" width="8" height="9" fill="#8a6a2a"/><rect x="5" y="4" width="6" height="7" fill="#5a3a2a"/><rect x="7" y="5" width="2" height="5" fill="#fff2c8"/><rect x="6" y="12" width="4" height="1" fill="#8a6a2a"/><rect x="7" y="13" width="2" height="1" fill="#8a6a2a"/>'),
    words: 'brann ka',
    syn: [{ from: 'hold-the-line', per: 5, what: 'dur' }],
  },
  'watch-cry': {
    id: 'watch-cry', kind: 'active', mana: 10, cd: 10, nameKey: 'skill.watch-cry', textKey: 'skill.watch-cry.text',
    vars: { radius: 4, secs: 3, guard: 15 }, grow: { secs: .1, guard: .5 }, tree: 'oath', tier: 1, col: 0, req: 'shield-bash',
    icon: I('<rect x="7" y="2" width="2" height="7" fill="#fff2c8"/><rect x="7" y="11" width="2" height="2" fill="#fff2c8"/><rect x="2" y="4" width="1" height="1" fill="#e0b25a"/><rect x="1" y="7" width="1" height="2" fill="#e0b25a"/><rect x="2" y="11" width="1" height="1" fill="#e0b25a"/><rect x="13" y="4" width="1" height="1" fill="#e0b25a"/><rect x="14" y="7" width="1" height="2" fill="#e0b25a"/><rect x="13" y="11" width="1" height="1" fill="#e0b25a"/><rect x="4" y="2" width="1" height="1" fill="#8a6a2a"/><rect x="11" y="2" width="1" height="1" fill="#8a6a2a"/><rect x="4" y="13" width="1" height="1" fill="#8a6a2a"/><rect x="11" y="13" width="1" height="1" fill="#8a6a2a"/>'),
    words: 'brann orum',
    syn: [{ from: 'shield-oath', per: 6, what: 'dur' }],
  },
  'hold-the-line': {
    id: 'hold-the-line', kind: 'passive', mana: 0, cd: 0, nameKey: 'skill.hold-the-line', textKey: 'skill.hold-the-line.text',
    vars: { below: 40, pct: 20 }, grow: { pct: 2 }, tree: 'oath', tier: 2, col: 2, req: 'shield-oath',
    icon: I('<rect x="1" y="12" width="14" height="2" fill="#5a3a2a"/><rect x="2" y="4" width="3" height="8" fill="#8a6a2a"/><rect x="6" y="3" width="4" height="9" fill="#e0b25a"/><rect x="11" y="4" width="3" height="8" fill="#8a6a2a"/><rect x="7" y="4" width="2" height="7" fill="#fff2c8"/><rect x="3" y="5" width="1" height="5" fill="#e0b25a"/><rect x="12" y="5" width="1" height="5" fill="#e0b25a"/>'),
  },
  // ── Ash: endurance, the tree that won't fall ──
  'ash-stride': {
    id: 'ash-stride', kind: 'active', mana: 10, cd: 7, nameKey: 'skill.ash-stride', textKey: 'skill.ash-stride.text',
    vars: { reach: 3, pct: 80, knock: 1 }, grow: { reach: .05, pct: 5 }, tree: 'ash', tier: 0, col: 0, req: null,
    icon: I('<rect x="1" y="6" width="2" height="5" fill="#5e5450"/><rect x="4" y="5" width="2" height="6" fill="#a89a90"/><rect x="7" y="4" width="3" height="7" fill="#efe6dc"/><rect x="10" y="5" width="2" height="2" fill="#efe6dc"/><rect x="12" y="6" width="3" height="1" fill="#e0b25a"/><rect x="11" y="9" width="2" height="2" fill="#a89a90"/><rect x="2" y="12" width="12" height="1" fill="#5e5450"/><rect x="8" y="2" width="2" height="2" fill="#efe6dc"/>'),
    words: 'brann sha',
  },
  'aura-watchfire': {
    id: 'aura-watchfire', kind: 'aura', mana: 0, cd: 0, nameKey: 'skill.aura-watchfire', textKey: 'skill.aura-watchfire.text',
    vars: { def: 10, regen: 1, radius: 3 }, grow: { def: 3, regen: .2, radius: .05 }, tree: 'ash', tier: 0, col: 1, req: null,
    icon: I('<rect x="2" y="2" width="12" height="12" fill="#2a2228"/><rect x="3" y="11" width="10" height="2" fill="#5e5450"/><rect x="5" y="9" width="6" height="2" fill="#8a6a2a"/><rect x="6" y="5" width="4" height="4" fill="#ffb347"/><rect x="7" y="3" width="2" height="3" fill="#e2552a"/><rect x="7" y="6" width="2" height="2" fill="#fff2a8"/><rect x="1" y="7" width="1" height="2" fill="#e0b25a"/><rect x="14" y="7" width="1" height="2" fill="#e0b25a"/>'),
    words: 'brann hesk ka',
  },
  'ember-blood': {
    id: 'ember-blood', kind: 'passive', mana: 0, cd: 0, nameKey: 'skill.ember-blood', textKey: 'skill.ember-blood.text',
    vars: { pct: 3 }, grow: { pct: .2 }, tree: 'ash', tier: 2, col: 1, req: 'aura-watchfire',
    icon: I('<rect x="6" y="2" width="4" height="2" fill="#e2552a"/><rect x="5" y="4" width="6" height="3" fill="#e2452a"/><rect x="4" y="7" width="8" height="4" fill="#9e2e1c"/><rect x="5" y="11" width="6" height="2" fill="#9e2e1c"/><rect x="6" y="5" width="2" height="2" fill="#ff8a7a"/><rect x="7" y="8" width="2" height="2" fill="#ffb347"/><rect x="8" y="9" width="1" height="1" fill="#fff2a8"/><rect x="12" y="3" width="2" height="2" fill="#7fe08a"/>'),
  },
  'last-watch': {
    id: 'last-watch', kind: 'active', mana: 30, cd: 60, nameKey: 'skill.last-watch', textKey: 'skill.last-watch.text',
    vars: { secs: 8, heal: 25 }, grow: { secs: .2, heal: 1 }, tree: 'ash', tier: 4, col: 1, req: 'ember-blood',
    icon: I('<rect x="6" y="1" width="4" height="1" fill="#8a6a2a"/><rect x="5" y="2" width="6" height="2" fill="#e0b25a"/><rect x="4" y="4" width="8" height="6" fill="#e0b25a"/><rect x="3" y="10" width="10" height="2" fill="#8a6a2a"/><rect x="5" y="4" width="2" height="5" fill="#fff2c8"/><rect x="7" y="12" width="2" height="2" fill="#5a3a2a"/><rect x="1" y="5" width="1" height="3" fill="#efe6dc"/><rect x="14" y="5" width="1" height="3" fill="#efe6dc"/>'),
    words: 'brann ul ka',
    syn: [{ from: 'hold-the-line', per: 5, what: 'dur' }],
  },
};

/** The Ashguard's book in the order the bar fills: the first four actives are the default keys 1–4. */
export const ASHGUARD_BOOK: readonly AshSkillId[] = [
  'shield-bash', 'ember-brand', 'ash-stride', 'shield-oath', 'cinder-cleave', 'watch-cry', 'whirl-of-cinders', 'last-watch',
  'aura-watchfire', 'watch-blade', 'hold-the-line', 'ember-blood',
];
/** What a new Ashguard holds free at rank 1: the swing, the four keys and the watchfire. */
export const ASHGUARD_STARTERS: readonly AshSkillId[] = ['watch-blade', 'shield-bash', 'ember-brand', 'ash-stride', 'shield-oath', 'aura-watchfire'];
