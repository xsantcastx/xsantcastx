/**
 * td-thorn-skills.ts — the Thornstrider's book as data (docs/design/design-bible.md §4.5, roadmap §10 item 15: the
 * fourth way to play). The Canopy Wardens' line: the one the wild lets through. A ranger whose pet is the heart of it.
 *
 * Three trees — **Thorn** (the bow: the Thorn Shot, a Barbed Shot that bleeds, a Volley, the Heartwood), **Wild** (the
 * beast: Command, Pack Bond, the Call of the Wilds, Wild Heart, the Stampede) and **Briar** (the ground: a Thornroot
 * Snare, a Bramble Trap, Rootwalk) — twelve skills, ranked and synergised exactly like the other three classes'
 * (td-skills SkillDef, td-tree rules). The Spellbook reads these records and td-mobs.ts carries them out. Every spell
 * speaks the Seam-Cant with the wild's root `thar` first, and no spell borrows another class's words (td-thorn.spec.ts).
 *
 * The synergy graph is a forest (no pair feeds each other).
 */
import type { SkillDef } from './td-skills';

export type ThornSkillId =
  | 'thorn-shot' | 'barbed-shot' | 'volley' | 'heartwood'
  | 'command' | 'pack-bond' | 'call-of-the-wilds' | 'wild-heart' | 'stampede'
  | 'thornroot-snare' | 'bramble-trap' | 'rootwalk'
  // S5's wait and S9 (skills-100.md §4): the rows to level 50.
  | 'hunters-mark' | 'pinning-shot' | 'heartseeker' | 'thornrain'
  | 'feral-leap' | 'elder-beast'
  | 'call-the-rain' | 'fogwalk' | 'lightning-call';

/** The Thornstrider's three trees (D2's three tabs): the bow, the beast, the briar on the ground. */
export const THORN_TREES = ['thorn', 'wild', 'briar'] as const;

const I = (rects: string) => rects;

export const THORN_SKILLS: Readonly<Record<ThornSkillId, SkillDef>> = {
  // ── Thorn: the bow ──
  'thorn-shot': {
    id: 'thorn-shot', kind: 'passive', mana: 0, cd: .85, nameKey: 'skill.thorn-shot', textKey: 'skill.thorn-shot.text',
    vars: { min: 6, max: 10, range: 6, pierce: 15, knock: .25 }, grow: { min: 2, max: 3, pierce: .5 }, tree: 'thorn', tier: 0, col: 0, req: null,
    icon: I('<rect x="2" y="12" width="2" height="2" fill="#4a3420"/><rect x="4" y="10" width="2" height="2" fill="#7a5a32"/><rect x="6" y="8" width="2" height="2" fill="#7a5a32"/><rect x="8" y="6" width="2" height="2" fill="#a07a4a"/><rect x="10" y="4" width="2" height="2" fill="#6eae52"/><rect x="12" y="2" width="2" height="2" fill="#e8f5b0"/><rect x="11" y="2" width="1" height="1" fill="#b4e08a"/><rect x="13" y="4" width="1" height="1" fill="#467a38"/><rect x="1" y="11" width="1" height="2" fill="#c9b894"/><rect x="2" y="14" width="2" height="1" fill="#c9b894"/><rect x="0" y="13" width="1" height="1" fill="#e8dcc0"/>'),
    words: 'thar sha',
  },
  'barbed-shot': {
    id: 'barbed-shot', kind: 'active', mana: 10, cd: 4, nameKey: 'skill.barbed-shot', textKey: 'skill.barbed-shot.text',
    vars: { min: 8, max: 12, dps: 4, secs: 5 }, grow: { min: 2, max: 3, dps: 1 }, tree: 'thorn', tier: 0, col: 1, req: null,
    icon: I('<rect x="2" y="12" width="2" height="2" fill="#4a3420"/><rect x="4" y="10" width="2" height="2" fill="#7a5a32"/><rect x="6" y="8" width="2" height="2" fill="#7a5a32"/><rect x="8" y="6" width="2" height="2" fill="#a07a4a"/><rect x="10" y="3" width="3" height="3" fill="#e8f5b0"/><rect x="9" y="4" width="1" height="1" fill="#6eae52"/><rect x="11" y="6" width="1" height="1" fill="#6eae52"/><rect x="13" y="2" width="1" height="1" fill="#ffffff"/><rect x="12" y="8" width="2" height="2" fill="#c43a3a"/><rect x="13" y="11" width="1" height="2" fill="#c43a3a"/><rect x="11" y="12" width="1" height="1" fill="#8a2020"/><rect x="14" y="9" width="1" height="1" fill="#8a2020"/>'),
    words: 'thar un sha',
    syn: [{ from: 'thorn-shot', per: 5, what: 'dmg' }],
  },
  'volley': {
    id: 'volley', kind: 'active', mana: 14, cd: 6, nameKey: 'skill.volley', textKey: 'skill.volley.text',
    vars: { min: 5, max: 8, count: 5 }, grow: { min: 1, max: 2, count: .1 }, tree: 'thorn', tier: 0, col: 2, req: null,
    icon: I('<rect x="2" y="13" width="2" height="2" fill="#7a5a32"/><rect x="4" y="9" width="1" height="4" fill="#7a5a32"/><rect x="4" y="5" width="1" height="4" fill="#a07a4a"/><rect x="4" y="2" width="1" height="3" fill="#e8f5b0"/><rect x="5" y="11" width="2" height="1" fill="#7a5a32"/><rect x="7" y="9" width="2" height="1" fill="#a07a4a"/><rect x="9" y="6" width="2" height="2" fill="#e8f5b0"/><rect x="5" y="13" width="4" height="1" fill="#7a5a32"/><rect x="9" y="12" width="3" height="1" fill="#a07a4a"/><rect x="12" y="11" width="2" height="2" fill="#e8f5b0"/><rect x="3" y="1" width="3" height="1" fill="#6eae52"/><rect x="10" y="5" width="2" height="1" fill="#6eae52"/><rect x="13" y="10" width="2" height="1" fill="#6eae52"/>'),
    words: 'thar orum sha',
    syn: [{ from: 'thorn-shot', per: 4, what: 'dmg' }],
  },
  'heartwood': {
    id: 'heartwood', kind: 'passive', mana: 0, cd: 0, nameKey: 'skill.heartwood', textKey: 'skill.heartwood.text',
    vars: { pct: 5 }, grow: { pct: 1.5 }, tree: 'thorn', tier: 2, col: 1, req: 'barbed-shot',
    icon: I('<rect x="9" y="1" width="2" height="14" fill="#7a5a32"/><rect x="9" y="1" width="1" height="14" fill="#a07a4a"/><rect x="7" y="2" width="2" height="2" fill="#7a5a32"/><rect x="5" y="4" width="2" height="3" fill="#7a5a32"/><rect x="4" y="7" width="2" height="2" fill="#7a5a32"/><rect x="5" y="9" width="2" height="3" fill="#7a5a32"/><rect x="7" y="12" width="2" height="2" fill="#7a5a32"/><rect x="5" y="5" width="1" height="6" fill="#e8dcc0"/><rect x="11" y="6" width="3" height="3" fill="#6eae52"/><rect x="12" y="7" width="1" height="1" fill="#b4e08a"/><rect x="11" y="10" width="2" height="2" fill="#467a38"/><rect x="2" y="7" width="2" height="1" fill="#e8f5b0"/>'),
  },
  // ── Wild: the beast ──
  'command': {
    id: 'command', kind: 'active', mana: 8, cd: 8, nameKey: 'skill.command', textKey: 'skill.command.text',
    vars: { pct: 60, secs: 6 }, grow: { pct: 6, secs: .2 }, tree: 'wild', tier: 0, col: 0, req: null,
    icon: I('<rect x="2" y="9" width="7" height="4" fill="#4cb898"/><rect x="2" y="9" width="7" height="1" fill="#9af0d0"/><rect x="7" y="6" width="4" height="4" fill="#4cb898"/><rect x="8" y="6" width="2" height="1" fill="#9af0d0"/><rect x="7" y="4" width="1" height="2" fill="#2a7a64"/><rect x="10" y="4" width="1" height="2" fill="#2a7a64"/><rect x="11" y="8" width="2" height="1" fill="#2a7a64"/><rect x="9" y="7" width="1" height="1" fill="#f0fff8"/><rect x="2" y="13" width="1" height="2" fill="#2a7a64"/><rect x="7" y="13" width="1" height="2" fill="#2a7a64"/><rect x="0" y="9" width="2" height="1" fill="#2a7a64"/><rect x="12" y="2" width="1" height="4" fill="#e8f5b0"/><rect x="13" y="1" width="2" height="1" fill="#e8f5b0"/><rect x="14" y="2" width="1" height="1" fill="#e8f5b0"/>'),
    words: 'thar sha teth',
    syn: [{ from: 'pack-bond', per: 3, what: 'dur' }],
  },
  'pack-bond': {
    id: 'pack-bond', kind: 'aura', mana: 0, cd: 0, nameKey: 'skill.pack-bond', textKey: 'skill.pack-bond.text',
    vars: { guard: 10, pct: 15, radius: 4 }, grow: { guard: .5, pct: 2, radius: .05 }, tree: 'wild', tier: 0, col: 2, req: null,
    icon: I('<rect x="2" y="2" width="12" height="12" fill="#1c3a1a"/><rect x="3" y="3" width="10" height="10" fill="#2a5226"/><rect x="4" y="8" width="4" height="3" fill="#e8dcc0"/><rect x="4" y="6" width="2" height="2" fill="#e8dcc0"/><rect x="8" y="5" width="4" height="3" fill="#9af0d0"/><rect x="10" y="3" width="2" height="2" fill="#9af0d0"/><rect x="7" y="7" width="2" height="2" fill="#e8f5b0"/><rect x="1" y="7" width="1" height="2" fill="#6eae52"/><rect x="14" y="7" width="1" height="2" fill="#6eae52"/><rect x="7" y="1" width="2" height="1" fill="#6eae52"/><rect x="7" y="14" width="2" height="1" fill="#6eae52"/>'),
    words: 'thar ka',
  },
  'call-of-the-wilds': {
    id: 'call-of-the-wilds', kind: 'active', mana: 22, cd: 24, nameKey: 'skill.call-of-the-wilds', textKey: 'skill.call-of-the-wilds.text',
    vars: { min: 5, max: 8, secs: 20 }, grow: { min: 2, max: 3, secs: 1 }, tree: 'wild', tier: 1, col: 1, req: 'command',
    icon: I('<rect x="1" y="1" width="14" height="14" fill="#1c3a1a"/><rect x="3" y="8" width="8" height="4" fill="#9af0d0"/><rect x="3" y="8" width="8" height="1" fill="#f0fff8"/><rect x="9" y="5" width="4" height="4" fill="#9af0d0"/><rect x="9" y="3" width="1" height="2" fill="#4cb898"/><rect x="12" y="3" width="1" height="2" fill="#4cb898"/><rect x="11" y="6" width="1" height="1" fill="#1c3a1a"/><rect x="3" y="12" width="1" height="2" fill="#4cb898"/><rect x="9" y="12" width="1" height="2" fill="#4cb898"/><rect x="1" y="7" width="2" height="2" fill="#4cb898"/><rect x="2" y="3" width="1" height="1" fill="#b4e08a"/><rect x="5" y="2" width="1" height="1" fill="#b4e08a"/><rect x="13" y="12" width="1" height="1" fill="#b4e08a"/>'),
    words: 'thar teth',
    syn: [{ from: 'command', per: 5, what: 'dmg' }, { from: 'pack-bond', per: 4, what: 'dur' }],
  },
  'wild-heart': {
    id: 'wild-heart', kind: 'passive', mana: 0, cd: 0, nameKey: 'skill.wild-heart', textKey: 'skill.wild-heart.text',
    vars: { pct: 10 }, grow: { pct: 1.5 }, tree: 'wild', tier: 2, col: 2, req: 'pack-bond',
    icon: I('<rect x="3" y="4" width="4" height="4" fill="#6eae52"/><rect x="9" y="4" width="4" height="4" fill="#6eae52"/><rect x="2" y="5" width="12" height="4" fill="#6eae52"/><rect x="3" y="9" width="10" height="2" fill="#467a38"/><rect x="5" y="11" width="6" height="2" fill="#467a38"/><rect x="7" y="13" width="2" height="1" fill="#2a5226"/><rect x="4" y="5" width="2" height="1" fill="#b4e08a"/><rect x="7" y="6" width="2" height="3" fill="#9af0d0"/><rect x="6" y="7" width="4" height="1" fill="#9af0d0"/><rect x="1" y="2" width="1" height="1" fill="#e8f5b0"/><rect x="14" y="2" width="1" height="1" fill="#e8f5b0"/>'),
  },
  'stampede': {
    id: 'stampede', kind: 'active', mana: 45, cd: 40, nameKey: 'skill.stampede', textKey: 'skill.stampede.text',
    vars: { min: 40, max: 60, count: 5, length: 7, knock: 1 }, grow: { min: 8, max: 12, count: .1 }, tree: 'wild', tier: 4, col: 1, req: 'call-of-the-wilds',
    icon: I('<rect x="1" y="1" width="14" height="14" fill="#14261a"/><rect x="2" y="4" width="5" height="2" fill="#4cb898"/><rect x="6" y="3" width="2" height="2" fill="#4cb898"/><rect x="5" y="8" width="5" height="2" fill="#9af0d0"/><rect x="9" y="7" width="2" height="2" fill="#9af0d0"/><rect x="2" y="11" width="5" height="2" fill="#4cb898"/><rect x="6" y="10" width="2" height="2" fill="#4cb898"/><rect x="10" y="6" width="1" height="1" fill="#f0fff8"/><rect x="11" y="9" width="3" height="1" fill="#e8f5b0"/><rect x="8" y="4" width="2" height="1" fill="#b4e08a"/><rect x="8" y="12" width="2" height="1" fill="#b4e08a"/><rect x="12" y="4" width="2" height="1" fill="#2a7a64"/><rect x="12" y="12" width="2" height="1" fill="#2a7a64"/>'),
    words: 'thar ul teth',
    syn: [{ from: 'call-of-the-wilds', per: 5, what: 'dmg' }, { from: 'pack-bond', per: 4, what: 'dmg' }],
  },
  // ── Briar: the ground ──
  'thornroot-snare': {
    id: 'thornroot-snare', kind: 'active', mana: 12, cd: 9, nameKey: 'skill.thornroot-snare', textKey: 'skill.thornroot-snare.text',
    vars: { min: 6, max: 10, length: 3, secs: 8, root: 1.5 }, grow: { min: 2, max: 3, root: .05 }, tree: 'briar', tier: 0, col: 1, req: null,
    icon: I('<rect x="1" y="12" width="14" height="2" fill="#4a3420"/><rect x="1" y="12" width="14" height="1" fill="#7a5a32"/><rect x="2" y="8" width="1" height="4" fill="#7a5a32"/><rect x="1" y="7" width="1" height="2" fill="#c9a66b"/><rect x="6" y="5" width="1" height="7" fill="#7a5a32"/><rect x="5" y="4" width="1" height="2" fill="#c9a66b"/><rect x="7" y="7" width="1" height="1" fill="#c9a66b"/><rect x="10" y="7" width="1" height="5" fill="#7a5a32"/><rect x="11" y="6" width="1" height="2" fill="#c9a66b"/><rect x="13" y="9" width="1" height="3" fill="#7a5a32"/><rect x="14" y="8" width="1" height="1" fill="#c9a66b"/><rect x="3" y="10" width="2" height="1" fill="#6eae52"/><rect x="8" y="9" width="2" height="1" fill="#6eae52"/><rect x="11" y="10" width="2" height="1" fill="#6eae52"/>'),
    words: 'thar mur',
    syn: [{ from: 'rootwalk', per: 4, what: 'dur' }],
  },
  'bramble-trap': {
    id: 'bramble-trap', kind: 'active', mana: 16, cd: 6, nameKey: 'skill.bramble-trap', textKey: 'skill.bramble-trap.text',
    vars: { min: 20, max: 30, radius: 1.5, root: 2, secs: 30 }, grow: { min: 5, max: 7, radius: .05 }, tree: 'briar', tier: 1, col: 0, req: 'thornroot-snare',
    icon: I('<rect x="3" y="7" width="10" height="5" fill="#4a3420"/><rect x="4" y="8" width="8" height="3" fill="#7a5a32"/><rect x="5" y="9" width="6" height="1" fill="#a07a4a"/><rect x="2" y="4" width="1" height="3" fill="#c9a66b"/><rect x="5" y="3" width="1" height="4" fill="#c9a66b"/><rect x="8" y="2" width="1" height="5" fill="#c9a66b"/><rect x="11" y="3" width="1" height="4" fill="#c9a66b"/><rect x="13" y="4" width="1" height="3" fill="#c9a66b"/><rect x="2" y="12" width="12" height="1" fill="#2a1c10"/><rect x="7" y="8" width="2" height="2" fill="#6eae52"/><rect x="1" y="13" width="14" height="1" fill="#467a38"/>'),
    words: 'thar un',
    syn: [{ from: 'thornroot-snare', per: 5, what: 'dmg' }],
  },
  'rootwalk': {
    id: 'rootwalk', kind: 'active', mana: 10, cd: 16, nameKey: 'skill.rootwalk', textKey: 'skill.rootwalk.text',
    vars: { secs: 4, pct: 30 }, grow: { secs: .1, pct: 1 }, tree: 'briar', tier: 2, col: 2, req: 'thornroot-snare',
    icon: I('<rect x="3" y="2" width="3" height="4" fill="#7a5a32"/><rect x="3" y="2" width="1" height="4" fill="#a07a4a"/><rect x="2" y="6" width="5" height="2" fill="#7a5a32"/><rect x="9" y="8" width="3" height="4" fill="#7a5a32"/><rect x="9" y="8" width="1" height="4" fill="#a07a4a"/><rect x="8" y="12" width="5" height="2" fill="#7a5a32"/><rect x="2" y="9" width="2" height="1" fill="#6eae52"/><rect x="4" y="10" width="2" height="1" fill="#467a38"/><rect x="12" y="4" width="2" height="1" fill="#6eae52"/><rect x="11" y="5" width="2" height="1" fill="#467a38"/><rect x="6" y="13" width="1" height="1" fill="#b4e08a"/><rect x="1" y="14" width="2" height="1" fill="#b4e08a"/>'),
    words: 'thar vesh',
  },
  // ── S5's wait and S9: the rows to level 50 (skills-100.md §4) ──
  'hunters-mark': {
    id: 'hunters-mark', kind: 'active', mana: 8, cd: 6, nameKey: 'skill.hunters-mark', textKey: 'skill.hunters-mark.text',
    vars: { range: 10, secs: 12, pct: 12 }, grow: { pct: .5 }, tree: 'thorn', tier: 1, col: 1, req: null, level: 6,
    icon: I('<rect x="7" y="1" width="2" height="2" fill="#b4e08a"/><rect x="5" y="3" width="6" height="2" fill="#6eae52"/><rect x="4" y="5" width="8" height="3" fill="#8fc25a"/><rect x="5" y="8" width="6" height="2" fill="#6eae52"/><rect x="7" y="10" width="2" height="4" fill="#467a38"/><rect x="2" y="2" width="1" height="1" fill="#e8f5b0"/><rect x="13" y="2" width="1" height="1" fill="#e8f5b0"/><rect x="1" y="13" width="14" height="1" fill="#4a6b2a"/>'),
    // skills-100.md names *thar vesh*, which the shipped Rootwalk already speaks: the mark is laid, so *thar un vesh*.
    words: 'thar un vesh',
  },
  'pinning-shot': {
    id: 'pinning-shot', kind: 'active', mana: 12, cd: 8, nameKey: 'skill.pinning-shot', textKey: 'skill.pinning-shot.text',
    vars: { pct: 110, root: 1.5, hush: 1 }, grow: { pct: 4, root: .05 }, tree: 'thorn', tier: 2, col: 2, req: null, level: 12,
    icon: I('<rect x="2" y="2" width="2" height="2" fill="#e8f5b0"/><rect x="4" y="4" width="2" height="2" fill="#a07a4a"/><rect x="6" y="6" width="2" height="2" fill="#a07a4a"/><rect x="8" y="8" width="2" height="2" fill="#a07a4a"/><rect x="10" y="10" width="2" height="2" fill="#a07a4a"/><rect x="1" y="13" width="14" height="2" fill="#3e2a18"/><rect x="3" y="11" width="1" height="2" fill="#7a5a32"/><rect x="12" y="11" width="1" height="2" fill="#7a5a32"/><rect x="11" y="12" width="2" height="1" fill="#6eae52"/>'),
    words: 'thar mur sha',
  },
  'heartseeker': {
    id: 'heartseeker', kind: 'active', mana: 20, cd: 6, nameKey: 'skill.heartseeker', textKey: 'skill.heartseeker.text',
    vars: { pct: 400, draw: 1, range: 12, marked: 2 }, grow: { pct: 12 }, tree: 'thorn', tier: 4, col: 1, req: null, level: 24,
    icon: I('<rect x="1" y="7" width="10" height="2" fill="#a07a4a"/><rect x="11" y="6" width="2" height="4" fill="#e8f5b0"/><rect x="13" y="7" width="2" height="2" fill="#ffffff"/><rect x="1" y="5" width="2" height="2" fill="#6eae52"/><rect x="1" y="9" width="2" height="2" fill="#467a38"/><rect x="6" y="3" width="3" height="2" fill="#c43a3a"/><rect x="5" y="2" width="2" height="2" fill="#f08070"/><rect x="8" y="2" width="2" height="2" fill="#f08070"/>'),
    words: 'thar vesh sha',
  },
  'thornrain': {
    id: 'thornrain', kind: 'active', mana: 28, cd: 10, nameKey: 'skill.thornrain', textKey: 'skill.thornrain.text',
    vars: { radius: 3, secs: 3, rate: 8, min: 12, max: 18 }, grow: { min: 2, max: 3 }, tree: 'thorn', tier: 4, col: 2, req: null, level: 42,
    icon: I('<rect x="2" y="1" width="1" height="4" fill="#8fc25a"/><rect x="6" y="2" width="1" height="4" fill="#8fc25a"/><rect x="10" y="1" width="1" height="4" fill="#8fc25a"/><rect x="13" y="3" width="1" height="4" fill="#8fc25a"/><rect x="4" y="6" width="1" height="4" fill="#e8f5b0"/><rect x="8" y="7" width="1" height="4" fill="#e8f5b0"/><rect x="12" y="8" width="1" height="3" fill="#e8f5b0"/><rect x="1" y="13" width="14" height="2" fill="#3e2a18"/><rect x="3" y="12" width="1" height="1" fill="#7a5a32"/><rect x="9" y="12" width="1" height="1" fill="#7a5a32"/>'),
    words: 'thar dra',
    syn: [{ from: 'volley', per: 4, what: 'dmg' }],
  },
  'feral-leap': {
    id: 'feral-leap', kind: 'active', mana: 10, cd: 8, nameKey: 'skill.feral-leap', textKey: 'skill.feral-leap.text',
    vars: { length: 4, pct: 100, root: .5 }, grow: {}, tree: 'wild', tier: 3, col: 1, req: null, level: 18,
    icon: I('<rect x="1" y="12" width="3" height="2" fill="#467a38"/><rect x="3" y="9" width="2" height="2" fill="#6eae52"/><rect x="5" y="6" width="2" height="2" fill="#8fc25a"/><rect x="8" y="4" width="4" height="3" fill="#9af0d0"/><rect x="11" y="3" width="3" height="2" fill="#f0fff8"/><rect x="12" y="7" width="2" height="2" fill="#4cb898"/><rect x="11" y="12" width="4" height="2" fill="#467a38"/><rect x="13" y="10" width="1" height="2" fill="#6eae52"/>'),
    words: 'thar sha ka',
  },
  'elder-beast': {
    id: 'elder-beast', kind: 'active', mana: 40, cd: 60, nameKey: 'skill.elder-beast', textKey: 'skill.elder-beast.text',
    vars: { secs: 15, life: 60, bite: 40, radius: 1.5 }, grow: { secs: .3 }, tree: 'wild', tier: 4, col: 2, req: null, level: 50,
    icon: I('<rect x="3" y="6" width="10" height="6" fill="#4cb898"/><rect x="4" y="7" width="8" height="4" fill="#9af0d0"/><rect x="11" y="4" width="4" height="4" fill="#9af0d0"/><rect x="12" y="5" width="1" height="1" fill="#140c1c"/><rect x="11" y="1" width="1" height="3" fill="#c9a66b"/><rect x="14" y="1" width="1" height="3" fill="#c9a66b"/><rect x="4" y="5" width="5" height="1" fill="#6eae52"/><rect x="4" y="12" width="2" height="2" fill="#4cb898"/><rect x="10" y="12" width="2" height="2" fill="#4cb898"/>'),
    words: 'thar teth ka',
  },
  'call-the-rain': {
    id: 'call-the-rain', kind: 'active', mana: 20, cd: 20, nameKey: 'skill.call-the-rain', textKey: 'skill.call-the-rain.text',
    vars: { radius: 4, secs: 10, every: 2, min: 30, max: 44 }, grow: { secs: .3, min: 4, max: 6 }, tree: 'briar', tier: 3, col: 1, req: null, level: 18,
    icon: I('<rect x="3" y="2" width="10" height="4" fill="#6e7a8a"/><rect x="2" y="4" width="12" height="3" fill="#8a96a6"/><rect x="5" y="1" width="5" height="2" fill="#a8b4c4"/><rect x="3" y="8" width="1" height="3" fill="#cfefff"/><rect x="6" y="9" width="1" height="3" fill="#8fd8ff"/><rect x="9" y="8" width="1" height="3" fill="#cfefff"/><rect x="12" y="9" width="1" height="3" fill="#8fd8ff"/><rect x="2" y="14" width="12" height="1" fill="#4a6a9a"/>'),
    words: 'vor dra',
  },
  'fogwalk': {
    id: 'fogwalk', kind: 'active', mana: 22, cd: 24, nameKey: 'skill.fogwalk', textKey: 'skill.fogwalk.text',
    vars: { radius: 4, secs: 10, lose: 2, first: 50 }, grow: { secs: .3 }, tree: 'briar', tier: 4, col: 1, req: null, level: 30,
    icon: I('<rect x="1" y="4" width="14" height="3" fill="#a8b4c4"/><rect x="2" y="8" width="12" height="3" fill="#cfd8e0"/><rect x="1" y="12" width="14" height="2" fill="#8a96a6"/><rect x="7" y="6" width="2" height="6" fill="#4a6b2a"/><rect x="6" y="5" width="4" height="2" fill="#6eae52"/><rect x="3" y="2" width="4" height="1" fill="#cfd8e0"/><rect x="10" y="2" width="3" height="1" fill="#cfd8e0"/>'),
    words: 'vor nyr',
  },
  'lightning-call': {
    id: 'lightning-call', kind: 'active', mana: 24, cd: 5, nameKey: 'skill.lightning-call', textKey: 'skill.lightning-call.text',
    vars: { tell: .6, radius: 1.5, min: 50, max: 72, chain: 2 }, grow: { min: 8, max: 11 }, tree: 'briar', tier: 4, col: 2, req: null, level: 42,
    icon: I('<rect x="3" y="1" width="10" height="3" fill="#6e7a8a"/><rect x="8" y="4" width="3" height="3" fill="#ffe36d"/><rect x="6" y="7" width="4" height="2" fill="#fffbe8"/><rect x="7" y="9" width="2" height="3" fill="#ffe36d"/><rect x="5" y="12" width="2" height="2" fill="#fffbe8"/><rect x="2" y="14" width="12" height="1" fill="#3e2a18"/><rect x="11" y="13" width="2" height="1" fill="#ffe36d"/>'),
    words: 'lum vor dra',
    syn: [{ from: 'call-the-rain', per: 5, what: 'dmg' }],
  },
};

/** The Thornstrider's book in the order the bar fills: the first four actives are the default keys 1–4. */
export const THORN_BOOK: readonly ThornSkillId[] = [
  'command', 'barbed-shot', 'thornroot-snare', 'volley', 'call-of-the-wilds', 'bramble-trap', 'rootwalk', 'stampede',
  'hunters-mark', 'pinning-shot', 'feral-leap', 'call-the-rain', 'heartseeker', 'fogwalk', 'lightning-call', 'thornrain', 'elder-beast',
  'pack-bond', 'thorn-shot', 'heartwood', 'wild-heart',
];
/** What a new Thornstrider holds free at rank 1: the bow's shot, the four keys and Pack Bond. */
export const THORN_STARTERS: readonly ThornSkillId[] = ['thorn-shot', 'command', 'barbed-shot', 'thornroot-snare', 'volley', 'pack-bond'];
