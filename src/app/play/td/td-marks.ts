/**
 * td-marks.ts — the Skill Book's marks (docs/design/skill-book.md, skills-100.md §0.2; owner 2026-10-26: "one skill per
 * row with its passives beneath. Extra effects come from the modifier nodes").
 *
 * Every row of the book (one shipped skill) carries six marks in two branches of three: A, Edge (what it does, harder)
 * and B, Craft (how it does it). A mark costs one skill point; A2/B2 need rank 5 in the row, A3/B3 rank 10; a branch is
 * taken in order; the two third marks are stars — a row takes one, never both. The ten old passives are folded into
 * marks under the skill they fed (`fold`): the passive's own numbers run at the row's rank while the mark is taken.
 *
 * One record per mark, as data. The book's line for a mark is BUILT from its effects (markLine), and the fight reads the
 * very same effects (castVars for the numbers, td-mobs `mark()` for the rest), so the words can never drift from the
 * behaviour (the truth harness, td-truth-marks.spec.ts, checks every one).
 *
 * The saved form is one number a row: a 6-bit mask, A1=1 A2=2 A3=4 B1=8 B2=16 B3=32 (KeeperSkillTree.nodes).
 */
import type { SkillId } from './td-skills';

export const MARK_SLOTS = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3'] as const;
export type MarkSlot = typeof MARK_SLOTS[number];
/** Each slot's bit in the row's mask. */
export const MARK_BIT: Readonly<Record<MarkSlot, number>> = { a1: 1, a2: 2, a3: 4, b1: 8, b2: 16, b3: 32 };
/** The row's rank a slot needs (node 1 at rank 1, node 2 at rank 5, node 3 at rank 10). */
export const MARK_RANK: Readonly<Record<MarkSlot, number>> = { a1: 1, a2: 5, a3: 10, b1: 1, b2: 5, b3: 10 };
/** The slot before this one on its branch (null: the first). */
export const MARK_PREV: Readonly<Record<MarkSlot, MarkSlot | null>> = { a1: null, a2: 'a1', a3: 'a2', b1: null, b2: 'b1', b3: 'b2' };
/** The two stars: a row holds one, never both. */
export const STAR_OTHER: Readonly<Partial<Record<MarkSlot, MarkSlot>>> = { a3: 'b3', b3: 'a3' };
export const FULL_MASK = 63;

/** The statuses a mark can lay on what it hits (skills-100.md §0.4; the ones the fight carries today). */
export type MarkStatus = 'burn' | 'bleed' | 'chill' | 'stun' | 'root' | 'blind' | 'hush' | 'taunt' | 'fear' | 'weaken';

/**
 * What a mark does (skills-100.md §0.2's node grammar):
 *  - `pct`: the row's vars `v` × (1 + n/100) — `dmg` means its damage (min, max, dps);
 *  - `add` / `set`: a var + n, or = n;
 *  - `cd`: seconds off the cooldown; `mana`: % on the mana cost;
 *  - `rider`: a status on whatever the skill hits (`pct`: a burn's or bleed's share of the hit a second; `chance` %);
 *  - `fold`: the folded passive `skill` runs at this row's rank;
 *  - `flag`: a rule the fight carries out by name (`MarkFlag`), with its numbers n / m / s (and a status or element).
 */
export type MarkFx =
  | { k: 'pct'; v: readonly string[]; n: number }
  | { k: 'add'; v: string; n: number }
  | { k: 'set'; v: string; n: number }
  | { k: 'cd'; n: number }
  | { k: 'mana'; n: number }
  | { k: 'rider'; st: MarkStatus; secs: number; pct?: number; chance?: number }
  | { k: 'fold'; skill: SkillId }
  | { k: 'flag'; f: MarkFlag; n?: number; m?: number; s?: number; c?: number; st?: MarkStatus; el?: 'fire' | 'cold' | 'all' };

/**
 * The named rules (each read once in td-mobs, each with its line `book.fx.<flag>` in book.i18n.ts):
 * generic ones any row can carry, and the few that belong to one skill.
 */
export type MarkFlag =
  // generic: on the row's own hits and kills
  | 'jump' | 'echo' | 'kill' | 'killHeal' | 'absorbHit' | 'healHit' | 'manaHit' | 'vsStatus' | 'vuln' | 'field' | 'nth' | 'nthCrit' | 'nthHeal'
  | 'pierceStack' | 'freeToggle' | 'wolfBearHart' | 'reach' | 'resist' | 'lowDouble' | 'struck' | 'pierce' | 'ringFan' | 'hearth' | 'hearthNear' | 'followFoe' | 'followSelf' | 'strip'
  // the Warlock's
  | 'fireUp' | 'ring' | 'slowZone' | 'cross' | 'split' | 'twin' | 'return' | 'captain' | 'crumble' | 'shards' | 'chain'
  | 'thorns' | 'breakRaise' | 'kinGuard' | 'overheal' | 'kinHeal' | 'spread' | 'hexRing' | 'cursedKill' | 'shroud'
  | 'breakBurst' | 'doomTwo' | 'doomOnDeath'
  // the Ashguard's
  | 'speed' | 'brandSpread' | 'keptFire' | 'blockBrand' | 'sunder' | 'pull' | 'whirlHaste' | 'concuss' | 'rush' | 'stampStun'
  | 'wideBash' | 'counter' | 'blockHeal' | 'blockMana' | 'fearsome' | 'again' | 'through' | 'wrath' | 'vowLeech' | 'vowTaunt'
  // the Lanternwright's
  | 'bane' | 'regen' | 'baneAura' | 'shutSpeed' | 'quietSight' | 'mothHours' | 'keptLight' | 'flareOpen' | 'unmakeHush'
  | 'zoneRegen' | 'zoneHush' | 'quickMend' | 'defBuff' | 'zoneGuard' | 'noChill' | 'breakHeal' | 'moteHeal' | 'swarm'
  | 'wispWard' | 'poleRegen' | 'twoBeacons' | 'poleSpeed'
  // the Thornstrider's
  | 'twinArrow' | 'bleedSpread' | 'commandWeaken' | 'vsCommanded' | 'sharedHurt' | 'biteHeal' | 'twoCalled' | 'herdHeal'
  | 'regrasp' | 'traps' | 'throwTrap' | 'leafCrit' | 'walkGuard'
  // S5: the marks that reach allies (skill-book-stand-ins.md's (c) swaps)
  | 'wardCopy' | 'rally' | 'warmGround' | 'vowShare' | 'twinLights' | 'mendMind' | 'selfWard'
  // S5: the tank's new rows
  | 'ricochet' | 'hook' | 'coldAsh' | 'molten' | 'shareSkin' | 'ashShell' | 'steadfast' | 'bannerRegen' | 'resolve' | 'carryAura'
  | 'steadyBreath' | 'lastBreath' | 'breathRoom' | 'battleBreath' | 'rescue' | 'bondOath' | 'twoBonds'
  | 'spikes' | 'gateGuard' | 'mobileGate' | 'gateOpens'
  // S5: the healer's new rows
  | 'warmHands' | 'cleanseCircle' | 'dryCloak' | 'steadyHands' | 'twoLamps' | 'steadySong' | 'choir' | 'walkingSong' | 'keptNote';

export interface MarkDef {
  slot: MarkSlot;
  /** i18n key of its name (`mark.<skill>.<slot>`; a folded passive keeps the passive's own name, `skill.<id>`). */
  nameKey: string;
  fx: readonly MarkFx[];
}

// ── Builders (the catalogue below reads like skills-100.md) ──
const P = (n: number, ...v: string[]): MarkFx => ({ k: 'pct', v, n });
const A = (v: string, n: number): MarkFx => ({ k: 'add', v, n });
const S = (v: string, n: number): MarkFx => ({ k: 'set', v, n });
const CD = (n: number): MarkFx => ({ k: 'cd', n });
const MN = (n: number): MarkFx => ({ k: 'mana', n });
const R = (st: MarkStatus, secs: number, pct?: number, chance?: number): MarkFx => ({ k: 'rider', st, secs, ...(pct !== undefined ? { pct } : {}), ...(chance !== undefined ? { chance } : {}) });
const FOLD = (skill: SkillId): MarkFx => ({ k: 'fold', skill });
const F = (f: MarkFlag, o: { n?: number; m?: number; s?: number; c?: number; st?: MarkStatus; el?: 'fire' | 'cold' | 'all' } = {}): MarkFx => ({ k: 'flag', f, ...(f === 'echo' ? { m: 1 } : {}), ...o });

type Row = readonly [readonly MarkFx[], readonly MarkFx[], readonly MarkFx[], readonly MarkFx[], readonly MarkFx[], readonly MarkFx[]];
/** Six marks a row, in slot order a1 a2 a3 b1 b2 b3. */
const ROWS: Readonly<Partial<Record<SkillId, Row>>> = {
  // ── Warlock · Ember ──
  'ember-bolt': [[P(5, 'dmg')], [R('burn', 2, 8)], [FOLD('ember-mastery')], [A('range', 2)], [F('jump', { n: 50, m: 1, s: 3, c: 25 })], [F('kill', { n: 3 })]],
  'hellfire-nova': [[P(15, 'dmg')], [F('field', { n: 15, s: 3, m: 2 })], [F('echo', { n: 40, s: .4 })], [A('radius', 1)], [CD(-2)], [F('absorbHit', { n: 4, m: 40, s: 5 })]],
  'aura-embers': [[P(20, 'dps')], [F('struck', { st: 'burn', s: 2 })], [F('fireUp', { n: 8 })], [A('radius', 1)], [F('kill', { n: 2 })], [F('resist', { el: 'fire', n: 15 })]],
  'cinder-rain': [[P(15, 'dmg')], [R('burn', 1, 25)], [F('followFoe', { n: 1 })], [A('radius', .5)], [A('secs', 1.5)], [F('vsStatus', { st: 'burn', n: 30 })]],
  'flame-wall': [[P(20, 'dps')], [R('burn', 3, 50)], [F('ring', { n: 2 })], [A('length', 2)], [F('slowZone', { n: 40 })], [F('cross', { n: 70 })]],
  'meteor': [[P(15, 'dmg')], [F('field', { n: 10, s: 4, m: 2 })], [F('echo', { n: 60, s: .5 })], [A('delay', -.4)], [CD(-3)], [F('split', { n: 35, m: 4 })]],
  // ── Warlock · Bone ──
  'bone-spear': [[P(15, 'dmg')], [R('bleed', 3, 10)], [F('twin', { n: 10 })], [FOLD('soul-harvest')], [A('range', 3)], [F('return', { n: 50 })]],
  'raise-skeleton': [[FOLD('skeleton-mastery')], [R('burn', 2, 20)], [F('captain', { n: 2, m: 6, s: 1.5 })], [CD(-4)], [A('count', 1)], [F('crumble', { n: 30, m: 1.5 })]],
  'corpse-burst': [[P(15, 'dmg')], [F('shards', { n: 30, m: 4, s: 3 })], [F('chain', { m: 3, s: 3 })], [A('radius', .5)], [A('reach', 3)], [R('hush', 1)]],
  'bone-armor': [[P(20, 'absorb')], [F('thorns', { n: 20 })], [F('breakRaise', { n: 1 })], [A('secs', 5)], [CD(-4)], [F('kinGuard', { n: 50 }), F('wardCopy', { n: 50, m: 6 })]],
  'bone-storm': [[P(15, 'dmg')], [F('pierceStack', { n: 10, m: 30 })], [F('ringFan')], [A('count', 2)], [MN(-25)], [F('echo', { n: 50, s: .3 })]],
  // ── Warlock · Shadow ──
  'drain-life': [[P(15, 'min', 'max')], [F('overheal', { n: 30 })], [F('jump', { n: 50, m: 2, s: 3 })], [F('reach', { n: 2 })], [MN(-20)], [F('kinHeal', { n: 50, m: 6 })]],
  'ember-curse': [[P(25, 'dps')], [F('spread', { s: 3 })], [F('hexRing', { n: 2 })], [A('secs', 4)], [F('cursedKill', { n: 3 })], [R('fear', 1.5)]],
  'dark-ward': [[P(20, 'absorb')], [FOLD('life-tap')], [F('shroud', { n: 4 })], [A('secs', 5)], [CD(-3)], [F('breakBurst', { n: 40, m: 2 }), F('wardCopy', { n: 50, m: 6 })]],
  'aura-siphon': [[P(25, 'heal')], [F('manaHit', { n: 1 })], [F('kinHeal', { n: 50, m: 6 })], [A('heal', 1), F('reach', { n: 1 })], [F('lowDouble', { n: 40 })], [F('killHeal', { n: 3 })]],
  'weaken': [[A('weaken', 5)], [F('vuln', { st: 'weaken', n: 10 })], [R('chill', 3)], [A('radius', 1)], [MN(-30)], [A('secs', 4)]],
  'doom': [[P(15, 'dmg')], [F('doomTwo', { s: 3 })], [F('strip', { s: 6 })], [A('secs', -1.5)], [MN(-25)], [F('doomOnDeath', { n: 150 })]],
  // ── Ashguard · Brand ──
  'watch-blade': [[P(5, 'dmg')], [A('arc', 30)], [F('nth', { m: 5, n: 180, s: .5 })], [F('speed', { n: 8 })], [F('vsStatus', { st: 'chill', n: 15 })], [F('absorbHit', { n: 2, m: 20, s: 4 })]],
  'ember-brand': [[A('pct', 10)], [F('brandSpread', { s: 3 })], [F('keptFire')], [A('secs', 4)], [MN(-30)], [F('blockBrand')]],
  'cinder-cleave': [[P(10, 'pct')], [R('burn', 2, 20)], [S('arc', 360), P(-20, 'pct')], [A('reach', .5)], [MN(-25)], [F('sunder', { n: 5, m: 3, s: 6 })]],
  'whirl-of-cinders': [[A('hits', 1)], [F('pull', { n: 1, m: 3 })], [F('whirlHaste', { n: 20 })], [A('radius', .5)], [MN(-25)], [R('taunt', 1)]],
  // ── Ashguard · Oath ──
  'shield-bash': [[P(15, 'dmg')], [F('concuss', { s: 2 })], [F('rush', { n: 3 })], [CD(-1.5)], [F('stampStun', { n: 1, s: .5 })], [F('wideBash', { n: 90, m: 1.5 })]],
  'shield-oath': [[FOLD('hold-the-line')], [F('counter', { n: 50 })], [F('blockHeal', { n: 2 })], [A('secs', 3)], [MN(-30)], [F('blockMana', { n: 3 })]],
  'watch-cry': [[A('radius', 1)], [A('guard', 5), F('rally', { n: 10, m: 6 })], [F('pull', { n: 1 })], [CD(-3)], [A('secs', 2)], [F('fearsome', { s: 1.5 })]],
  // ── Ashguard · Ash ──
  'ash-stride': [[P(15, 'pct')], [R('burn', 2, 25)], [F('again', { s: 2 })], [A('reach', 2)], [CD(-2)], [F('through')]],
  'aura-watchfire': [[FOLD('ember-blood')], [P(25, 'regen'), F('warmGround')], [F('lowDouble', { n: 40 })], [P(15, 'def')], [F('resist', { el: 'fire', n: 10 })], [F('hearth')]],
  'last-watch': [[A('heal', 10)], [F('wrath', { n: 20 })], [F('vowLeech', { n: 5 }), F('vowShare', { m: 6, s: 4 })], [A('secs', 2)], [CD(-15)], [F('vowTaunt', { n: 4, s: 2 })]],
  // ── Ashguard · S5: the tank's kit (skills-100.md §2) ──
  'brand-throw': [[P(15, 'pct')], [R('burn', 3, 20)], [F('ricochet', { n: 2 })], [A('range', 3)], [CD(-2)], [F('hook', { n: 3 })]],
  'cinder-skin': [[A('reflect', 10)], [F('coldAsh', { el: 'cold', n: 20 })], [F('molten', { st: 'burn', s: 2 })], [A('secs', 5)], [F('shareSkin', { n: 50, m: 3 })], [F('ashShell')]],
  'banner-of-the-watch': [[A('cut', 3)], [F('steadfast')], [F('bannerRegen', { n: .5 })], [A('radius', 2)], [F('resolve')], [F('carryAura', { n: 50 })]],
  'second-wind': [[A('heal', 5)], [F('steadyBreath')], [F('lastBreath', { n: 25 })], [CD(-8)], [F('breathRoom', { n: 2, m: 1 })], [F('battleBreath', { n: 1, m: 6, s: 3 })]],
  'intercept': [[S('share', 60)], [F('rescue', { n: 1 })], [F('bondOath')], [A('reach', 3)], [CD(-4)], [F('twoBonds', { n: 35 })]],
  'hold-the-gate': [[S('cut', 50)], [F('spikes', { n: 30 })], [F('gateGuard', { n: 20, m: 4 })], [A('radius', 2)], [F('mobileGate', { n: 40 })], [F('gateOpens', { n: 150 })]],
  // ── Lanternwright · S5: the healer's kit (skills-100.md §3) ──
  'cleanse': [[F('warmHands', { n: 8 })], [A('immune', 2)], [F('cleanseCircle', { n: 3 })], [A('reach', 4)], [MN(-50)], [F('dryCloak', { s: 10 })]],
  'rekindle': [[S('pct', 60)], [F('steadyHands')], [A('window', 60)], [A('channel', -1)], [CD(-40)], [F('twoLamps', { n: 3 })]],
  'hearthsong': [[P(15, 'heal')], [F('steadySong')], [F('choir', { n: 2 })], [F('walkingSong', { n: 40 })], [MN(-30)], [F('keptNote', { s: 4 })]],
  // ── Lanternwright · Lamp ──
  'kindle': [[P(5, 'dmg')], [R('burn', 2, 8)], [F('nthHeal', { m: 4, n: 15 })], [A('range', 2)], [F('bane', { n: 10 })], [F('jump', { n: 50, m: 1, s: 3 })]],
  'blinding-flash': [[P(15, 'dmg')], [R('blind', 2)], [A('stun', 1)], [A('radius', 1)], [CD(-2)], [F('healHit', { n: 10 })]],
  'lantern-aura': [[A('weaken', 5)], [F('regen', { n: .5 })], [F('resist', { el: 'all', n: 15 })], [A('radius', 1)], [A('light', 1)], [F('baneAura', { n: 15 })]],
  'shutter-lantern': [[F('shutSpeed', { n: 10 })], [F('quietSight', { n: 2 })], [F('mothHours')], [F('freeToggle')], [F('keptLight', { n: 1 })], [F('flareOpen', { n: 50 })]],
  'banish': [[P(5, 'dmg')], [A('below', 10)], [F('strip', { s: 10 })], [A('reach', 3)], [CD(-2)], [F('unmakeHush', { n: 4, s: 2 })]],
  'dawn-at-noon': [[P(15, 'dps')], [F('zoneRegen', { n: 1.5 })], [F('followSelf')], [A('radius', 1)], [A('secs', 3)], [F('hearth')]],
  // ── Lanternwright · Hearth ──
  'hearthlight': [[P(15, 'heal')], [F('quickMend', { n: 50 })], [F('twinLights', { n: 60, s: 3 })], [P(10, 'heal'), A('reach', 2)], [MN(-30)], [F('defBuff', { n: 10, s: 5 })]],
  'hearth-circle': [[P(20, 'heal')], [F('zoneGuard', { n: 10 })], [F('followSelf')], [A('radius', 1)], [A('secs', 4)], [F('noChill'), F('mendMind')]],
  'lantern-ward': [[P(20, 'absorb')], [F('breakHeal', { n: 25 })], [FOLD('last-light')], [A('secs', 5)], [MN(-35)], [F('breakBurst', { n: 50, m: 3 }), F('selfWard', { n: 50 })]],
  // ── Lanternwright · Moth ──
  'lamp-wisp': [[FOLD('moth-kin')], [F('moteHeal', { n: 1 })], [F('swarm', { m: 2, n: 50 })], [A('secs', 15)], [MN(-30)], [F('wispWard')]],
  'beacon': [[P(15, 'dmg')], [F('poleRegen', { n: 1, m: 3 })], [F('twoBeacons', { n: 2 })], [A('secs', 6)], [F('poleSpeed', { n: 10, m: 4 })], [F('hearthNear', { n: 3 })]],
  // ── Thornstrider · Thorn ──
  'thorn-shot': [[FOLD('heartwood')], [R('bleed', 2, 20, 20)], [F('nthCrit', { m: 5 })], [A('range', 2)], [A('pierce', 10)], [F('vsStatus', { st: 'bleed', n: 15 })]],
  'barbed-shot': [[P(20, 'dps')], [F('vuln', { st: 'bleed', n: 10 })], [R('hush', 1.5)], [CD(-1.5)], [F('twinArrow', { n: 50 })], [F('bleedSpread', { m: 2, s: 3 })]],
  'volley': [[P(15, 'dmg')], [F('pierce', { n: 1 })], [F('ringFan')], [A('count', 2)], [MN(-25)], [P(-55, 'dmg'), F('echo', { n: 100, s: .3, m: 2 })]],
  // ── Thornstrider · Wild ──
  'command': [[A('pct', 15)], [R('chill', 1)], [F('commandWeaken', { n: 20 })], [A('secs', 3)], [CD(-2)], [F('vsCommanded', { n: 10 })]],
  'pack-bond': [[FOLD('wild-heart')], [F('sharedHurt', { n: 20 })], [A('guard', 5), A('pct', 5)], [A('radius', 2)], [F('resist', { el: 'all', n: 10 })], [F('biteHeal', { n: 5 })]],
  'call-of-the-wilds': [[P(20, 'dmg')], [F('wolfBearHart', { n: 1, m: 40, s: 30 })], [F('twoCalled', { n: 60 })], [A('secs', 15)], [MN(-30)], [F('jump', { n: 50, m: 1, s: 1.5 })]],
  'stampede': [[P(15, 'dmg')], [R('stun', .5)], [F('echo', { n: 50, s: .8 })], [A('length', 4)], [MN(-20)], [F('herdHeal', { n: 2 })]],
  // ── Thornstrider · Briar & Sky ──
  'thornroot-snare': [[P(20, 'dmg')], [F('regrasp', { s: 3 })], [F('ring', { n: 2 })], [A('length', 2)], [A('secs', 4)], [A('root', .5)]],
  'bramble-trap': [[P(15, 'dmg')], [R('bleed', 3, 15)], [F('traps', { n: 3 })], [A('radius', .5)], [F('throwTrap', { n: 5 })], [R('stun', 1)]],
  'rootwalk': [[A('pct', 10)], [F('leafCrit')], [F('walkGuard', { n: 15 })], [A('secs', 2)], [CD(-4)], [F('hearth')]],
};

/** Every mark of every row, built once. */
export const MARKS: Readonly<Partial<Record<SkillId, readonly MarkDef[]>>> = Object.fromEntries(
  Object.entries(ROWS).map(([id, row]) => [id, (row as Row).map((fx, i) => {
    const slot = MARK_SLOTS[i], fold = fx.find((f): f is Extract<MarkFx, { k: 'fold' }> => f.k === 'fold');
    return { slot, nameKey: fold ? `skill.${fold.skill}` : `mark.${id}.${slot}`, fx } satisfies MarkDef;
  })]),
);

/** Does this row take marks? (The Common page's spells do not: skills-100.md §5.) */
export function hasMarks(id: SkillId): boolean { return !!MARKS[id]; }
export function markDef(id: SkillId, slot: MarkSlot): MarkDef | null { return MARKS[id]?.[MARK_SLOTS.indexOf(slot)] ?? null; }
export function maskHas(mask: number, slot: MarkSlot): boolean { return ((mask | 0) & MARK_BIT[slot]) !== 0; }
/** How many marks a mask holds (each cost one point). */
export function markCount(mask: number): number { let n = 0, m = mask & FULL_MASK; while (m) { n += m & 1; m >>= 1; } return n; }
/** The marks a row holds, in slot order. */
export function takenMarks(id: SkillId, mask: number): MarkDef[] { return (MARKS[id] ?? []).filter(d => maskHas(mask, d.slot)); }

/**
 * The folded passives (skills-100.md §6): each one's mark. Its own numbers (td-skills vars/grow) run at the row's rank
 * while the mark is taken; it has no row and takes no points of its own.
 */
export const FOLDED: Readonly<Partial<Record<SkillId, { into: SkillId; slot: MarkSlot }>>> = Object.fromEntries(
  Object.entries(MARKS).flatMap(([id, defs]) => (defs ?? []).flatMap(d => d.fx.filter(f => f.k === 'fold').map(f => [(f as Extract<MarkFx, { k: 'fold' }>).skill, { into: id as SkillId, slot: d.slot }]))),
);
export function isFolded(id: SkillId): boolean { return !!FOLDED[id]; }

/** The var groups a `pct` may name. */
const GROUPS: Readonly<Record<string, readonly string[]>> = { dmg: ['min', 'max', 'dps'] };
/**
 * The marks' numbers on a skill's vars (castVars calls this after rank and synergies): `pct`, `add`, `set`, in slot
 * order. A var the skill does not have is left alone. Whole numbers stay whole; tenths stay tenths.
 */
export function applyMarkVars(id: SkillId, vars: Record<string, number>, mask: number): Record<string, number> {
  if (!mask) return vars;
  const out = { ...vars };
  for (const d of takenMarks(id, mask)) for (const fx of d.fx) {
    if (fx.k === 'pct') {
      for (const g of fx.v) for (const key of GROUPS[g] ?? [g]) if (key in out) {
        const v = out[key] * (100 + fx.n) / 100;
        out[key] = Number.isInteger(vars[key]) ? Math.max(0, Math.round(v)) : Math.max(0, Math.round(v * 10) / 10);
      }
    } else if (fx.k === 'add' && fx.v in out) out[fx.v] = Math.max(0, Math.round((out[fx.v] + fx.n) * 100) / 100);
    else if (fx.k === 'set' && fx.v in out) out[fx.v] = fx.n;
  }
  return out;
}
/** Seconds the marks take off a cooldown (negative: shorter). */
export function markCd(id: SkillId, mask: number): number {
  let n = 0;
  for (const d of takenMarks(id, mask)) for (const fx of d.fx) if (fx.k === 'cd') n += fx.n;
  return n;
}
/** The marks' % on a skill's mana cost (negative: cheaper). */
export function markManaPct(id: SkillId, mask: number): number {
  let n = 0;
  for (const d of takenMarks(id, mask)) for (const fx of d.fx) if (fx.k === 'mana') n += fx.n;
  return n;
}
/** The rider statuses a skill's hits carry. */
export function markRiders(id: SkillId, mask: number): Extract<MarkFx, { k: 'rider' }>[] {
  const out: Extract<MarkFx, { k: 'rider' }>[] = [];
  for (const d of takenMarks(id, mask)) for (const fx of d.fx) if (fx.k === 'rider') out.push(fx);
  return out;
}
/** A named rule a skill holds (its numbers), or null. */
export function markFlag(id: SkillId, mask: number, f: MarkFlag): Extract<MarkFx, { k: 'flag' }> | null {
  for (const d of takenMarks(id, mask)) for (const fx of d.fx) if (fx.k === 'flag' && fx.f === f) return fx;
  return null;
}
/** Every named rule a skill holds. */
export function markFlags(id: SkillId, mask: number): Extract<MarkFx, { k: 'flag' }>[] {
  const out: Extract<MarkFx, { k: 'flag' }>[] = [];
  for (const d of takenMarks(id, mask)) for (const fx of d.fx) if (fx.k === 'flag') out.push(fx);
  return out;
}

/** The few rows whose added number needs its own words ("+15% harder bites" for Command's +15 to its bite %). */
const ADD_UNIT: Readonly<Record<string, string>> = {
  'ember-brand.pct': 'book.unit.brandPct', 'command.pct': 'book.unit.bitePct', 'pack-bond.pct': 'book.unit.bitePct', 'rootwalk.pct': 'book.unit.walkPct',
  'raise-skeleton.count': 'book.unit.skeletons', 'bone-storm.count': 'book.unit.spears', 'volley.count': 'book.unit.arrows',
  'aura-siphon.heal': 'book.unit.siphon', 'last-watch.heal': 'book.unit.vowHeal', 'banish.below': 'book.unit.below',
  'second-wind.heal': 'book.unit.windHeal',
};
/**
 * A mark's line as the book shows it, as i18n calls: each effect one phrase (`book.fx.*`), joined. Built from the same
 * effects the fight reads, so the words are the behaviour. A folded passive reads its own card line (the caller fills
 * it with the passive's numbers at the row's rank).
 */
export function markPhrases(id: SkillId, def: MarkDef): { key: string; vars: Record<string, string | number> }[] {
  const out: { key: string; vars: Record<string, string | number> }[] = [];
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`.replace('-', '−'));
  for (const fx of def.fx) {
    if (fx.k === 'pct') out.push({ key: 'book.fx.pct', vars: { n: sign(fx.n), what: `book.var.${fx.v.length === 2 ? 'dmg' : fx.v[0]}` } });
    else if (fx.k === 'add') out.push({ key: 'book.fx.add', vars: { n: sign(fx.n), what: ADD_UNIT[`${id}.${fx.v}`] ?? `book.unit.${fx.v}` } });
    else if (fx.k === 'set') out.push({ key: `book.fx.set.${fx.v}`, vars: { n: fx.n } });
    else if (fx.k === 'cd') out.push({ key: 'book.fx.cd', vars: { n: sign(fx.n) } });
    else if (fx.k === 'mana') out.push({ key: 'book.fx.mana', vars: { n: sign(fx.n) } });
    else if (fx.k === 'rider') out.push({ key: fx.chance !== undefined ? 'book.fx.riderChance' : fx.pct !== undefined ? 'book.fx.riderPct' : 'book.fx.rider', vars: { st: `book.st.${fx.st}`, secs: fx.secs, pct: fx.pct ?? 0, chance: fx.chance ?? 100 } });
    else if (fx.k === 'fold') out.push({ key: `skill.${fx.skill}.text`, vars: {} });
    else out.push({ key: `book.fx.${fx.f}`, vars: { n: fx.n ?? 0, m: fx.m ?? 0, s: fx.s ?? 0, c: fx.c ?? 100, st: fx.st ? `book.st.${fx.st}` : '', el: fx.el ? `book.el.${fx.el}` : '' } });
  }
  return out;
}
