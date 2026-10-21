/**
 * td-lantern-skills.ts — the Lanternwright's book as data (docs/design/design-bible.md §4.3, roadmap §10 item 15: the
 * third way to play). The lamp-keepers' order, Glim's own: the one who carries the light in. Support, healer, the
 * undoing of the dead.
 *
 * Three trees, as the bible names them — **Lamp** (light as a weapon: the lantern's flare, the blinding flash, Banish,
 * Dawn at Noon, and the lantern itself), **Hearth** (mending, wards, safe ground) and **Moth** (the lantern's kin: a
 * wisp at the shoulder, a beacon on the ground) — thirteen skills in all, ranked and synergised exactly like the other
 * two classes' (td-skills SkillDef, td-tree rules). The Spellbook reads these records and td-mobs.ts carries them out,
 * so the words on the card and the fight never disagree. Every spell speaks the Seam-Cant with the light root `lum` or
 * the hearth root `hesk` in it, and no spell borrows another class's words (td-lantern.spec.ts).
 *
 * The synergy graph is a forest (no pair feeds each other).
 */
import type { SkillDef } from './td-skills';

export type LampSkillId =
  | 'kindle' | 'blinding-flash' | 'lantern-aura' | 'shutter-lantern' | 'banish' | 'dawn-at-noon'
  | 'hearthlight' | 'hearth-circle' | 'lantern-ward' | 'last-light'
  | 'lamp-wisp' | 'moth-kin' | 'beacon';

/** The Lanternwright's three trees (D2's three tabs): the light as a weapon, the hearth, the lantern's kin. */
export const LAMP_TREES = ['lamp', 'hearth', 'moth'] as const;

const I = (rects: string) => rects;

export const LANTERN_SKILLS: Readonly<Record<LampSkillId, SkillDef>> = {
  // ── Lamp: light as a weapon ──
  'kindle': {
    id: 'kindle', kind: 'passive', mana: 0, cd: 1, nameKey: 'skill.kindle', textKey: 'skill.kindle.text',
    vars: { min: 7, max: 11, range: 4 }, grow: { min: 3, max: 4 }, tree: 'lamp', tier: 0, col: 0, req: null,
    icon: I('<rect x="10" y="2" width="4" height="4" fill="#fffbe8"/><rect x="11" y="3" width="2" height="2" fill="#ffffff"/><rect x="8" y="5" width="3" height="3" fill="#ffd27a"/><rect x="6" y="7" width="3" height="2" fill="#c99a3e"/><rect x="4" y="9" width="2" height="2" fill="#c99a3e"/><rect x="2" y="11" width="2" height="2" fill="#8a6a3a"/><rect x="1" y="13" width="1" height="1" fill="#8a6a3a"/><rect x="13" y="7" width="1" height="1" fill="#fff2a8"/><rect x="8" y="1" width="1" height="1" fill="#fff2a8"/>'),
    words: 'lum sha',
  },
  'blinding-flash': {
    id: 'blinding-flash', kind: 'active', mana: 14, cd: 8, nameKey: 'skill.blinding-flash', textKey: 'skill.blinding-flash.text',
    vars: { min: 8, max: 12, radius: 3, stun: 2 }, grow: { min: 2, max: 3, radius: .05, stun: .1 }, tree: 'lamp', tier: 0, col: 1, req: null,
    icon: I('<rect x="7" y="1" width="2" height="3" fill="#fff2a8"/><rect x="7" y="12" width="2" height="3" fill="#fff2a8"/><rect x="1" y="7" width="3" height="2" fill="#fff2a8"/><rect x="12" y="7" width="3" height="2" fill="#fff2a8"/><rect x="3" y="3" width="2" height="2" fill="#ffd27a"/><rect x="11" y="3" width="2" height="2" fill="#ffd27a"/><rect x="3" y="11" width="2" height="2" fill="#ffd27a"/><rect x="11" y="11" width="2" height="2" fill="#ffd27a"/><rect x="5" y="5" width="6" height="6" fill="#ffd27a"/><rect x="6" y="6" width="4" height="4" fill="#fffbe8"/><rect x="7" y="7" width="2" height="2" fill="#ffffff"/>'),
    words: 'lum orum',
    syn: [{ from: 'lantern-aura', per: 4, what: 'radius' }],
  },
  'lantern-aura': {
    id: 'lantern-aura', kind: 'aura', mana: 0, cd: 0, nameKey: 'skill.lantern-aura', textKey: 'skill.lantern-aura.text',
    vars: { light: 2, radius: 3, weaken: 10 }, grow: { light: .1, radius: .05, weaken: .5 }, tree: 'lamp', tier: 0, col: 2, req: null,
    icon: I('<rect x="2" y="2" width="12" height="12" fill="#3a2a14"/><rect x="3" y="3" width="10" height="10" fill="#5a4020"/><rect x="6" y="3" width="4" height="1" fill="#c99a3e"/><rect x="5" y="4" width="6" height="1" fill="#8a6a3a"/><rect x="5" y="5" width="6" height="5" fill="#ffd27a"/><rect x="6" y="6" width="4" height="3" fill="#fffbe8"/><rect x="5" y="10" width="6" height="1" fill="#8a6a3a"/><rect x="1" y="7" width="1" height="2" fill="#ffd27a"/><rect x="14" y="7" width="1" height="2" fill="#ffd27a"/><rect x="7" y="13" width="2" height="1" fill="#ffd27a"/>'),
    words: 'lum ka',
    syn: [{ from: 'kindle', per: 2, what: 'radius' }],
  },
  'shutter-lantern': {
    // Level 1 although it sits on the second row: the first shy chest can come before the first level.
    id: 'shutter-lantern', kind: 'active', mana: 0, cd: 1, nameKey: 'skill.shutter-lantern', textKey: 'skill.shutter-lantern.text',
    vars: {}, grow: {}, tree: 'lamp', tier: 1, col: 2, req: null, level: 1,
    icon: I('<rect x="6" y="1" width="4" height="1" fill="#8a6a3a"/><rect x="5" y="2" width="6" height="1" fill="#c99a3e"/><rect x="4" y="3" width="8" height="9" fill="#3a2a14"/><rect x="5" y="4" width="6" height="7" fill="#ffd27a"/><rect x="5" y="4" width="2" height="7" fill="#5a4020"/><rect x="9" y="4" width="2" height="7" fill="#5a4020"/><rect x="7" y="5" width="2" height="4" fill="#fffbe8"/><rect x="4" y="12" width="8" height="1" fill="#c99a3e"/><rect x="6" y="13" width="4" height="2" fill="#8a6a3a"/><rect x="2" y="6" width="1" height="3" fill="#6b3aa0"/><rect x="13" y="6" width="1" height="3" fill="#6b3aa0"/>'),
    words: 'lum un ka',
  },
  'banish': {
    id: 'banish', kind: 'active', mana: 22, cd: 6, nameKey: 'skill.banish', textKey: 'skill.banish.text',
    vars: { min: 30, max: 46, reach: 6, below: 25 }, grow: { min: 6, max: 9 }, tree: 'lamp', tier: 2, col: 1, req: 'blinding-flash',
    icon: I('<rect x="6" y="1" width="4" height="13" fill="#ffd27a"/><rect x="7" y="1" width="2" height="13" fill="#fffbe8"/><rect x="7" y="3" width="1" height="9" fill="#ffffff"/><rect x="3" y="13" width="10" height="2" fill="#c99a3e"/><rect x="4" y="4" width="1" height="1" fill="#fff2a8"/><rect x="11" y="6" width="1" height="1" fill="#fff2a8"/><rect x="3" y="8" width="1" height="1" fill="#ffd27a"/><rect x="12" y="10" width="1" height="1" fill="#ffd27a"/><rect x="4" y="11" width="2" height="2" fill="#e8e1cf"/><rect x="10" y="11" width="2" height="2" fill="#a89f8a"/>'),
    words: 'lum un',
    syn: [{ from: 'kindle', per: 6, what: 'dmg' }],
  },
  'dawn-at-noon': {
    id: 'dawn-at-noon', kind: 'active', mana: 40, cd: 45, nameKey: 'skill.dawn-at-noon', textKey: 'skill.dawn-at-noon.text',
    vars: { radius: 4, secs: 8, dps: 14 }, grow: { radius: .05, secs: .2, dps: 3 }, tree: 'lamp', tier: 4, col: 1, req: 'banish',
    icon: I('<rect x="1" y="1" width="14" height="14" fill="#2a1f45"/><rect x="3" y="3" width="10" height="10" fill="#ffd27a"/><rect x="4" y="4" width="8" height="8" fill="#fff2a8"/><rect x="5" y="5" width="6" height="6" fill="#fffbe8"/><rect x="7" y="7" width="2" height="2" fill="#ffffff"/><rect x="7" y="1" width="2" height="1" fill="#fff2a8"/><rect x="7" y="14" width="2" height="1" fill="#fff2a8"/><rect x="1" y="7" width="1" height="2" fill="#fff2a8"/><rect x="14" y="7" width="1" height="2" fill="#fff2a8"/><rect x="2" y="2" width="1" height="1" fill="#c99a3e"/><rect x="13" y="2" width="1" height="1" fill="#c99a3e"/><rect x="2" y="13" width="1" height="1" fill="#c99a3e"/><rect x="13" y="13" width="1" height="1" fill="#c99a3e"/>'),
    words: 'lum ul orum',
    syn: [{ from: 'banish', per: 5, what: 'dmg' }, { from: 'blinding-flash', per: 4, what: 'radius' }],
  },
  // ── Hearth: mending, wards, safe ground ──
  'hearthlight': {
    id: 'hearthlight', kind: 'active', mana: 12, cd: 6, nameKey: 'skill.hearthlight', textKey: 'skill.hearthlight.text',
    vars: { heal: 30, secs: 3 }, grow: { heal: 6 }, tree: 'hearth', tier: 0, col: 1, req: null,
    icon: I('<rect x="2" y="12" width="12" height="2" fill="#8a6a3a"/><rect x="4" y="10" width="8" height="2" fill="#c99a3e"/><rect x="6" y="5" width="4" height="5" fill="#ffd27a"/><rect x="7" y="3" width="2" height="3" fill="#fff2a8"/><rect x="7" y="7" width="2" height="2" fill="#fffbe8"/><rect x="3" y="4" width="1" height="3" fill="#7fe08a"/><rect x="2" y="5" width="3" height="1" fill="#7fe08a"/><rect x="12" y="2" width="1" height="3" fill="#7fe08a"/><rect x="11" y="3" width="3" height="1" fill="#7fe08a"/>'),
    words: 'hesk ka',
  },
  'hearth-circle': {
    id: 'hearth-circle', kind: 'active', mana: 24, cd: 14, nameKey: 'skill.hearth-circle', textKey: 'skill.hearth-circle.text',
    vars: { heal: 4, radius: 3, secs: 10, slow: 20 }, grow: { heal: 1, radius: .05 }, tree: 'hearth', tier: 1, col: 0, req: 'hearthlight',
    icon: I('<rect x="5" y="1" width="6" height="1" fill="#8a6a3a"/><rect x="2" y="3" width="2" height="2" fill="#a89a90"/><rect x="12" y="3" width="2" height="2" fill="#a89a90"/><rect x="1" y="7" width="2" height="2" fill="#a89a90"/><rect x="13" y="7" width="2" height="2" fill="#a89a90"/><rect x="2" y="11" width="2" height="2" fill="#a89a90"/><rect x="12" y="11" width="2" height="2" fill="#a89a90"/><rect x="5" y="14" width="6" height="1" fill="#8a6a3a"/><rect x="6" y="10" width="4" height="2" fill="#6e4526"/><rect x="6" y="6" width="4" height="4" fill="#ffb347"/><rect x="7" y="4" width="2" height="3" fill="#ffd27a"/><rect x="7" y="7" width="2" height="2" fill="#fff2a8"/>'),
    words: 'hesk orum',
    syn: [{ from: 'hearthlight', per: 4, what: 'heal' }],
  },
  'lantern-ward': {
    id: 'lantern-ward', kind: 'active', mana: 20, cd: 18, nameKey: 'skill.lantern-ward', textKey: 'skill.lantern-ward.text',
    vars: { absorb: 50, secs: 12, radius: 3, stun: 2 }, grow: { absorb: 10, secs: .3 }, tree: 'hearth', tier: 2, col: 2, req: 'hearthlight',
    icon: I('<rect x="2" y="2" width="12" height="1" fill="#c99a3e"/><rect x="2" y="13" width="12" height="1" fill="#c99a3e"/><rect x="2" y="2" width="1" height="12" fill="#c99a3e"/><rect x="13" y="2" width="1" height="12" fill="#c99a3e"/><rect x="3" y="3" width="1" height="1" fill="#fff2a8"/><rect x="12" y="3" width="1" height="1" fill="#fff2a8"/><rect x="3" y="12" width="1" height="1" fill="#fff2a8"/><rect x="12" y="12" width="1" height="1" fill="#fff2a8"/><rect x="6" y="4" width="4" height="1" fill="#8a6a3a"/><rect x="5" y="5" width="6" height="6" fill="#ffd27a"/><rect x="6" y="6" width="4" height="4" fill="#fffbe8"/><rect x="5" y="11" width="6" height="1" fill="#8a6a3a"/>'),
    words: 'lum hesk ka',
    syn: [{ from: 'hearth-circle', per: 5, what: 'absorb' }],
  },
  'last-light': {
    id: 'last-light', kind: 'passive', mana: 0, cd: 0, nameKey: 'skill.last-light', textKey: 'skill.last-light.text',
    vars: { secs: 3, every: 600 }, grow: { secs: .1 }, tree: 'hearth', tier: 3, col: 1, req: 'hearth-circle',
    icon: I('<rect x="1" y="1" width="14" height="14" fill="#140c1c"/><rect x="1" y="1" width="14" height="1" fill="#fff2a8"/><rect x="1" y="14" width="14" height="1" fill="#fff2a8"/><rect x="1" y="1" width="1" height="14" fill="#fff2a8"/><rect x="14" y="1" width="1" height="14" fill="#fff2a8"/><rect x="7" y="4" width="2" height="2" fill="#fff2a8"/><rect x="6" y="6" width="4" height="4" fill="#ffd27a"/><rect x="7" y="7" width="2" height="2" fill="#ffffff"/><rect x="6" y="10" width="4" height="1" fill="#c99a3e"/><rect x="7" y="11" width="2" height="2" fill="#8a6a3a"/>'),
  },
  // ── Moth: the lantern's kin ──
  'lamp-wisp': {
    id: 'lamp-wisp', kind: 'active', mana: 18, cd: 12, nameKey: 'skill.lamp-wisp', textKey: 'skill.lamp-wisp.text',
    vars: { min: 4, max: 7, secs: 30, count: 1, range: 5 }, grow: { min: 1, max: 2, secs: 1, count: .1 }, tree: 'moth', tier: 0, col: 1, req: null,
    icon: I('<rect x="6" y="5" width="4" height="5" fill="#ffd27a"/><rect x="7" y="6" width="2" height="3" fill="#fffbe8"/><rect x="2" y="3" width="4" height="3" fill="#e8dcc0"/><rect x="10" y="3" width="4" height="3" fill="#e8dcc0"/><rect x="3" y="8" width="3" height="3" fill="#c9b894"/><rect x="10" y="8" width="3" height="3" fill="#c9b894"/><rect x="7" y="3" width="1" height="2" fill="#8a6a3a"/><rect x="8" y="3" width="1" height="2" fill="#8a6a3a"/><rect x="7" y="10" width="2" height="2" fill="#c99a3e"/><rect x="1" y="13" width="1" height="1" fill="#fff2a8"/><rect x="14" y="12" width="1" height="1" fill="#fff2a8"/>'),
    words: 'lum teth',
    syn: [{ from: 'moth-kin', per: 6, what: 'dmg' }],
  },
  'moth-kin': {
    id: 'moth-kin', kind: 'passive', mana: 0, cd: 0, nameKey: 'skill.moth-kin', textKey: 'skill.moth-kin.text',
    vars: { pct: 10 }, grow: { pct: 3 }, tree: 'moth', tier: 1, col: 0, req: 'lamp-wisp',
    icon: I('<rect x="7" y="4" width="2" height="8" fill="#5a4020"/><rect x="2" y="2" width="5" height="4" fill="#e8dcc0"/><rect x="9" y="2" width="5" height="4" fill="#e8dcc0"/><rect x="3" y="7" width="4" height="4" fill="#c9b894"/><rect x="9" y="7" width="4" height="4" fill="#c9b894"/><rect x="4" y="3" width="2" height="2" fill="#ffd27a"/><rect x="10" y="3" width="2" height="2" fill="#ffd27a"/><rect x="6" y="1" width="1" height="2" fill="#8a6a3a"/><rect x="9" y="1" width="1" height="2" fill="#8a6a3a"/><rect x="5" y="13" width="6" height="1" fill="#c99a3e"/>'),
  },
  'beacon': {
    id: 'beacon', kind: 'active', mana: 26, cd: 16, nameKey: 'skill.beacon', textKey: 'skill.beacon.text',
    vars: { min: 6, max: 10, secs: 12, range: 5 }, grow: { min: 2, max: 3, secs: .3 }, tree: 'moth', tier: 2, col: 1, req: 'lamp-wisp',
    icon: I('<rect x="7" y="6" width="2" height="8" fill="#6e4526"/><rect x="7" y="6" width="1" height="8" fill="#a06a3b"/><rect x="4" y="14" width="8" height="1" fill="#5a4020"/><rect x="6" y="1" width="4" height="1" fill="#8a6a3a"/><rect x="5" y="2" width="6" height="4" fill="#ffd27a"/><rect x="6" y="3" width="4" height="2" fill="#fffbe8"/><rect x="2" y="3" width="2" height="1" fill="#fff2a8"/><rect x="12" y="3" width="2" height="1" fill="#fff2a8"/><rect x="1" y="1" width="1" height="1" fill="#fff2a8"/><rect x="14" y="1" width="1" height="1" fill="#fff2a8"/>'),
    words: 'lum dra',
    syn: [{ from: 'lamp-wisp', per: 5, what: 'dur' }],
  },
};

/** The Lanternwright's book in the order the bar fills: the first four actives are the default keys 1–4. */
export const LANTERN_BOOK: readonly LampSkillId[] = [
  'hearthlight', 'blinding-flash', 'lamp-wisp', 'shutter-lantern', 'banish', 'hearth-circle', 'lantern-ward', 'beacon', 'dawn-at-noon',
  'lantern-aura', 'kindle', 'moth-kin', 'last-light',
];
/** What a new Lanternwright holds free at rank 1: the flare, the four keys and the lantern's aura. */
export const LANTERN_STARTERS: readonly LampSkillId[] = ['kindle', 'hearthlight', 'blinding-flash', 'lamp-wisp', 'shutter-lantern', 'lantern-aura'];
