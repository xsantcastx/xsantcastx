/**
 * td-party-boss.ts — the party bosses' mechanics (docs/design/monsters-abilities.md §5, §5.3, §6.3; campaign S10).
 *
 * One implementation of each of the nine mechanics (Fixate, Sunder, Burn the Room, Brand, Add wave, Interrupt cast,
 * Soak circle, Tether, Spread) plus the Antlered Storm's own two (Strike, Lowered Antlers), and the PARTY_FORMS that
 * put them in phases on each boss. The director runs wherever a MobSystem simulates (the room, a party host, the
 * combat-sim): td-mobs calls `partyStep` every frame for a boss whose form is awake, and `partyBite` on each of its
 * blows (Fixate's heavy, Sunder's stacks). Everything a Keeper must see goes out as a ring (a burst, the shipped
 * picture) or a PartyMark (a tether, a brand, the fixate pip, the cast bar); the director never draws.
 *
 * The rules it keeps (§1): every ring has a ground tell ≥ 0.6 s (never shorter on a phone); radii, counts and tells
 * never scale; damage is in B (the boss's own blow, its tier included); Nightmare's cooldowns ×0.85, Hell's ×0.7.
 * Pure: data and small functions; the arena is handed in.
 */
import type { DamageType } from '../../shared/loot/damage.model';
import type { TellTone } from './td-abilities';
import type { CoopEvent } from '../social/coop-protocol';

/** Tiles to art px (td-art TILE; kept local so this module stays importable anywhere). */
const T = 16;

export type PartyMech = 'fixate' | 'sunder' | 'burn-room' | 'brand' | 'adds' | 'interrupt' | 'soak' | 'tether' | 'spread' | 'strike' | 'charge';

/** One mechanic as a phase uses it. */
export interface MechUse {
  m: PartyMech;
  /** Seconds between uses (a timed one); its first comes `first` s into the phase (default: `every` / 2). */
  every?: number;
  first?: number;
  /** Damage in B (per tick for a burn / brand / tether's heat). */
  b?: number;
  el?: DamageType;
  tone: TellTone;
  /** Its Seam-Cant over the boss as the tell starts (canon §6.1). */
  words?: string;
  /** Rings (Strike), adds (Add wave). */
  n?: number;
  /** Add wave: the creatures that pour in, by MOBS id (a mix walks the list). */
  adds?: readonly string[];
  /** Interrupt: what the channel does if nobody stops it. */
  heal?: number;
  summon?: string;
  /** Tether: who it ties ('healer-tank': the one who mends to the one who holds; 'two': any two). */
  pair?: 'healer-tank' | 'two';
  /** Brand: how many Keepers it marks. */
  count?: number;
  /** Add wave: levels under the boss's (default MECH.addsUnder). */
  under?: number;
}
export interface PartyPhase {
  /** The phase holds while the boss's life share is above this (the last phase: 0). */
  to: number;
  /** Its name's i18n tail (`pb.phase.<id>`), shown when it starts. */
  id: string;
  uses: readonly MechUse[];
}
export interface PartyForm {
  /** The boss's MOBS id (a floor boss), or a world boss's id. */
  id: string;
  /** The arena's radius (tiles): Burn the Room reaches everyone inside; the adds pour in from its edge. */
  arena: number;
  phases: readonly PartyPhase[];
  /** The arena keeps everyone Wet (the Antlered Storm): lightning +25% (weather.model WET). */
  wet?: boolean;
}

// ── The vocabulary's numbers (§5.1) ──────────────────────────────────────────────────────────────────────────────
export const MECH = Object.freeze({
  /** Fixate: every 4th bite on the fixated is a heavy, 2.5B, after a 0.6 s red arc. */
  heavyEvery: 4, heavyB: 2.5, heavyTell: .6,
  /** Sunder: each bite on the fixated adds a stack (10 s, max 5) that lifts what it takes by 8%; at 5 the next bite is ×2. */
  sunderPct: .08, sunderSecs: 10, sunderMax: 5,
  /** Burn the Room: 0.8B to everyone in the arena after a 1.0 s tell, then a 6 s burn at 0.2B a second. */
  burnB: .8, burnTell: 1, burnSecs: 6, burnDotB: .2,
  /** Brand: 0.3B a second for 8 s unless Cleansed. */
  brandSecs: 8, brandB: .3,
  /** Interrupt: a 2.5 s channel; unstopped, the boss mends 10% (or calls an elite pack). */
  castSecs: 2.5, castHeal: .1,
  /** Soak: a ring r1.5 that bursts after 3 s for 4B split among those inside; empty, everyone takes 2B. */
  soakR: 1.5, soakTell: 3, soakB: 4, soakEmptyB: 2,
  /** Tether: 10 s; more than 6 tiles apart it snaps for 2B each, closer than 2 it burns 0.2B a second each. */
  tetherSecs: 10, tetherFar: 6, tetherNear: 2, tetherSnapB: 2, tetherHeatB: .2,
  /** Spread: a ring r1.5 on everyone for 3 s; each Keeper whose ring overlaps another's takes 1.2B per overlap. */
  spreadR: 1.5, spreadTell: 3, spreadB: 1.2,
  /** Strike (the Antlered Storm): rings r1.5 under three Keepers, a 1.2 s tell, 1.6B lightning. */
  strikeR: 1.5, strikeTell: 1.2,
  /** Lowered Antlers: a 0.6 s lane to the farthest Keeper, 2.0B to whoever stands at its end (r1.2). */
  chargeTell: .6, chargeR: 1.2,
  /** The Add wave's creatures come at the boss's level − 4. */
  addsUnder: 4,
  /** A wet Keeper takes lightning ×1.25 (weather.model WET.lightningTaken). */
  wetLightning: 1.25,
});

const F = (o: MechUse): MechUse => o;
const FIX = F({ m: 'fixate', tone: 'ember' });
const SUNDER = F({ m: 'sunder', tone: 'ember' });

/**
 * The party forms: the ten floor bosses on Nightmare and Hell (§5.3; the Seam Eater's is §6.1) and the world bosses
 * (§6). The solo form is the shipped fight; a form adds these on top of it (it never takes the solo kit away).
 */
export const PARTY_FORMS: Readonly<Record<string, PartyForm>> = {
  'ember-warden': { id: 'ember-warden', arena: 10, phases: [
    { to: .6, id: 'warden-1', uses: [FIX, F({ m: 'charge', every: 8, b: 1.6, el: 'fire', tone: 'ember' })] },
    { to: .25, id: 'warden-2', uses: [FIX, F({ m: 'interrupt', every: 14, first: 3, words: 'vael brann', heal: .1, tone: 'ember' })] },
    { to: 0, id: 'warden-3', uses: [FIX, F({ m: 'burn-room', every: 15, el: 'fire', tone: 'ember', words: 'vael orum' })] },
  ] },
  'the-uncounted': { id: 'the-uncounted', arena: 10, phases: [
    { to: .6, id: 'uncounted-1', uses: [FIX] },
    { to: .25, id: 'uncounted-2', uses: [FIX, F({ m: 'spread', every: 14, first: 2, tone: 'bone', words: 'teth orum' })] },
    { to: 0, id: 'uncounted-3', uses: [FIX, F({ m: 'adds', first: 1, n: 6, adds: ['bone-walker'], tone: 'bone', words: 'teth' })] },
  ] },
  'anvil-warden': { id: 'anvil-warden', arena: 10, phases: [
    { to: .6, id: 'anvil-1', uses: [FIX, SUNDER] },
    { to: .25, id: 'anvil-2', uses: [FIX, SUNDER, F({ m: 'interrupt', every: 16, first: 3, words: 'brann sha teth', summon: 'cinder-bailiff', tone: 'parchment' })] },
    { to: 0, id: 'anvil-3', uses: [FIX, SUNDER, F({ m: 'soak', every: 12, el: 'physical', tone: 'dust', words: 'brann dra' })] },
  ] },
  'magma-tyrant': { id: 'magma-tyrant', arena: 11, phases: [
    { to: .6, id: 'tyrant-1', uses: [FIX] },
    { to: .25, id: 'tyrant-2', uses: [FIX, F({ m: 'strike', every: 12, n: 3, b: 1.4, el: 'fire', tone: 'ember', words: 'vael dra' })] },
    { to: 0, id: 'tyrant-3', uses: [FIX, F({ m: 'burn-room', every: 15, el: 'fire', tone: 'ember' }), F({ m: 'adds', first: 1, n: 4, adds: ['lava-hound'], tone: 'ember' })] },
  ] },
  'bone-dragon': { id: 'bone-dragon', arena: 12, phases: [
    { to: .6, id: 'dragon-1', uses: [FIX] },
    { to: .25, id: 'dragon-2', uses: [FIX, F({ m: 'tether', every: 18, first: 2, pair: 'two', tone: 'bone', words: 'vael mur' }), F({ m: 'adds', first: 1, n: 2, adds: ['bone-priest'], tone: 'bone' })] },
    { to: 0, id: 'dragon-3', uses: [FIX, F({ m: 'spread', every: 12, first: 2, tone: 'bone', words: 'teth orum' })] },
  ] },
  'cinder-sovereign': { id: 'cinder-sovereign', arena: 12, phases: [
    { to: .6, id: 'sovereign-1', uses: [FIX, SUNDER] },
    { to: .25, id: 'sovereign-2', uses: [FIX, SUNDER, F({ m: 'brand', every: 14, first: 3, count: 1, el: 'fire', tone: 'ember', words: 'vael sha' }), F({ m: 'adds', first: 1, n: 4, adds: ['lava-hound', 'cinder-bailiff'], tone: 'ember' })] },
    { to: 0, id: 'sovereign-3', uses: [FIX, F({ m: 'burn-room', every: 20, el: 'fire', tone: 'ember', words: 'vael orum' }), F({ m: 'soak', every: 12, el: 'fire', tone: 'gold', words: 'brann dra' })] },
  ] },
  'mossbound-colossus': { id: 'mossbound-colossus', arena: 12, phases: [
    { to: .6, id: 'colossus-1', uses: [FIX] },
    { to: .25, id: 'colossus-2', uses: [FIX, F({ m: 'brand', every: 16, first: 3, count: 2, el: 'physical', tone: 'moss', words: 'teth mur' }), F({ m: 'adds', first: 1, n: 4, adds: ['vine-lasher'], tone: 'moss' })] },
    { to: 0, id: 'colossus-3', uses: [FIX, F({ m: 'soak', every: 12, el: 'physical', tone: 'moss' })] },
  ] },
  'elder-rootwyrm': { id: 'elder-rootwyrm', arena: 12, phases: [
    { to: .6, id: 'wyrm-1', uses: [FIX] },
    { to: .25, id: 'wyrm-2', uses: [FIX, F({ m: 'tether', every: 18, first: 2, pair: 'two', tone: 'glass', words: 'teth mur' }), F({ m: 'interrupt', every: 16, first: 6, words: 'nyr teth', heal: .1, tone: 'life' })] },
    { to: 0, id: 'wyrm-3', uses: [FIX, F({ m: 'burn-room', every: 15, el: 'physical', tone: 'glass' }), F({ m: 'spread', every: 14, first: 4, tone: 'glass' })] },
  ] },
  'ink-abbess': { id: 'ink-abbess', arena: 12, phases: [
    { to: .6, id: 'abbess-1', uses: [FIX] },
    { to: .25, id: 'abbess-2', uses: [FIX, F({ m: 'brand', every: 16, first: 3, count: 2, el: 'arcane', tone: 'ink', words: 'nyr sha' }), F({ m: 'adds', first: 1, n: 4, adds: ['ink-hound'], tone: 'ink' })] },
    { to: 0, id: 'abbess-3', uses: [FIX, F({ m: 'interrupt', every: 10, first: 3, words: 'nyr orum lum', heal: .1, tone: 'ink' }), F({ m: 'spread', every: 14, first: 6, tone: 'ink' })] },
  ] },
  'seam-eater': { id: 'seam-eater', arena: 12, phases: [
    { to: .6, id: 'seam-1', uses: [FIX] },
    { to: .3, id: 'seam-2', uses: [FIX, F({ m: 'tether', every: 16, first: 2, pair: 'two', tone: 'shadow', words: 'ul mur' })] },
    { to: 0, id: 'seam-3', uses: [FIX, F({ m: 'burn-room', every: 15, el: 'arcane', tone: 'shadow', words: 'ul orum' }), F({ m: 'soak', every: 12, el: 'arcane', tone: 'shadow' })] },
  ] },
  // §6.3: the Antlered Storm, the first world boss (always a party boss; a solo Keeper meets the same fight).
  'antlered-storm': { id: 'antlered-storm', arena: 10, wet: true, phases: [
    { to: .6, id: 'storm-1', uses: [FIX, SUNDER,
      F({ m: 'charge', every: 9, first: 4, b: 2, el: 'physical', tone: 'glass' }),
      F({ m: 'strike', every: 8, first: 2, n: 3, b: 1.6, el: 'lightning', tone: 'storm', words: 'lum vor dra' })] },
    { to: .3, id: 'storm-2', uses: [FIX, SUNDER,
      F({ m: 'spread', every: 14, first: 3, tone: 'storm', words: 'lum vor orum' }),
      F({ m: 'tether', every: 20, first: 6, pair: 'healer-tank', tone: 'storm', words: 'vor mur' }),
      F({ m: 'adds', first: .5, every: 20, under: 0, n: 10, adds: ['canopy-bat', 'canopy-bat', 'canopy-bat', 'canopy-bat', 'rootglass-hart'], tone: 'moss', words: 'vor teth' }),
      F({ m: 'strike', every: 11, first: 7, n: 2, b: 1.6, el: 'lightning', tone: 'storm' })] },
    { to: 0, id: 'storm-3', uses: [FIX, SUNDER,
      F({ m: 'soak', every: 10, first: 3, el: 'lightning', tone: 'storm', words: 'vor dra' }),
      F({ m: 'burn-room', every: 15, first: 6, el: 'lightning', tone: 'storm', words: 'lum vor orum' }),
      F({ m: 'interrupt', every: 18, first: 9, words: 'vor nyr', heal: .08, tone: 'life' })] },
  ] },
};

export function partyFormOf(id: string | undefined | null): PartyForm | null { return id ? PARTY_FORMS[id] ?? null : null; }

// ── The runtime ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A Keeper in the arena as the director sees it. */
export interface PartyKeeper { id: string; self: boolean; x: number; y: number }
/** What a Keeper must see (pictures; the screen draws them, the director never does). */
export interface PartyMark {
  /** fix: the boss is fixed on `a`. brand: `a` is Branded. tether: `a`–`b` are tied. cast: the boss channels (words). eye: the storm's eye is open. sunder: `a`'s stacks (`n`). */
  m: 'fix' | 'brand' | 'tether' | 'cast' | 'eye' | 'sunder' | 'phase';
  /** The boss's own id on the wire (its nid), or the Mob itself on the simulating side. */
  i?: string;
  a?: string; b?: string;
  /** Seconds it lasts; 0 ends it. */
  t: number;
  n?: number;
  /** Words (a cast's), or a phase's id. */
  w?: string;
  /** Where (a cast: the boss). */
  x?: number; y?: number;
}

/** The boss's state while its form is awake (on the Mob, `Mob.pb`). */
export interface PartyState {
  form: PartyForm;
  phase: number;
  /** Seconds into the phase, and each use's next time (by index in the phase's uses). */
  t: number;
  next: number[];
  /** Bites on the fixated since the last heavy, the heavy's arc showing. */
  bites: number;
  heavyArc: boolean;
  fixOn: string | null;
  /** The Sunder stacks last shown on the fixated; seconds until the fixate pip is said again (a Keeper who arrives late sees it). */
  sunderShown: number;
  fixT: number;
  /** Sunder stacks by Keeper id: [stacks, seconds left]. */
  sunder: Map<string, [number, number]>;
  /** Burns (Burn the Room), brands and the tether: per Keeper, seconds left and damage a second. */
  dots: { id: string; t: number; dps: number; type: DamageType; brand?: boolean; tick: number }[];
  tether: { a: string; b: string; t: number; tick: number; dps: number; snap: number } | null;
  /** Rings waiting to burst (the director's own: soak, spread, strike, charge, the room's burn). */
  rings: { m: PartyMech; x: number; y: number; r: number; t: number; dmg: number; type: DamageType; on?: string }[];
  /** A channel under way: seconds left and what it does. */
  cast: { t: number; use: MechUse } | null;
  /** Healing each Keeper gave (the healer is the one who gives most). */
  healed: Map<string, number>;
  /** Stats (the sim reads them). */
  stats: { heavies: number; interrupted: number; casts: number; soaked: number; soakEmpty: number; snapped: number; overlaps: number; cleansed: number; brands: number; adds: number };
}

/** The arena the director acts in (td-mobs provides it; the sim and the specs can stand one up). */
export interface PartyArena {
  /** The living Keepers within the arena of the boss. */
  keepers(): PartyKeeper[];
  /** A blow on one Keeper (through its defenses), with a status maybe. */
  strike(k: PartyKeeper, raw: number, type: DamageType): void;
  /** A ring on the ground (picture; the director decides what it hits). */
  ring(x: number, y: number, r: number, t: number, tone: TellTone): void;
  mark(e: PartyMark): void;
  say(words: string): void;
  /** Bring `n` creatures of `type` in at the arena's edge (two doors), at `level`. */
  adds(type: string, n: number, level: number, elite?: boolean): void;
  heal(n: number): void;
  /** Stunned, frozen or hushed now (an interrupt landed). */
  stopped(): boolean;
  rng(): number;
  /** The tier's cadence (§1.4): Nightmare ×0.85, Hell ×0.7. */
  cadence: number;
}
/** The boss as the director reads it. */
export interface PartyBoss { x: number; y: number; hp: number; def: { hp: number; dmg: readonly [number, number] | number[]; level: number }; threatOn?: string }

export function newPartyState(form: PartyForm): PartyState {
  return {
    form, phase: -1, t: 0, next: [], bites: 0, heavyArc: false, fixOn: null, sunderShown: 0, fixT: 0, sunder: new Map(), dots: [], tether: null, rings: [], cast: null, healed: new Map(),
    stats: { heavies: 0, interrupted: 0, casts: 0, soaked: 0, soakEmpty: 0, snapped: 0, overlaps: 0, cleansed: 0, brands: 0, adds: 0 },
  };
}

/** B: the boss's own blow (the mean of its roll, its tier and blows already in its def). */
export function blowOf(boss: PartyBoss): number { return (Number(boss.def.dmg[0]) + Number(boss.def.dmg[1])) / 2; }

/** The phase the boss's life share puts it in. */
export function phaseAt(form: PartyForm, share: number): number {
  for (let i = 0; i < form.phases.length; i++) if (share > form.phases[i].to) return i;
  return form.phases.length - 1;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** The one who mends most (the healer), else the one farthest from the fixated. */
function healerOf(s: PartyState, ks: readonly PartyKeeper[]): PartyKeeper | null {
  let best: PartyKeeper | null = null, bh = 0;
  for (const k of ks) { const h = s.healed.get(k.id) ?? 0; if (h > bh) { bh = h; best = k; } }
  if (best && best.id !== s.fixOn) return best;
  const tank = ks.find(k => k.id === s.fixOn);
  return [...ks].filter(k => k.id !== s.fixOn).sort((a, b) => (tank ? dist(b, tank) - dist(a, tank) : 0))[0] ?? null;
}

/**
 * One frame of the boss's form: phases change on its life, timed uses fire, rings tick and burst, the burns, brands
 * and tether tick, a channel runs (and is stopped by a stun, a freeze or a hush). `fixOn`: whom it bites now (the top
 * threat: td-threat pickByThreat), '' this screen's own Keeper.
 */
export function partyStep(s: PartyState, boss: PartyBoss, A: PartyArena, dt: number, fixOn: string | null): void {
  const ks = A.keepers();
  const B = blowOf(boss), share = boss.def.hp > 0 ? boss.hp / boss.def.hp : 0;
  const lv = boss.def.level;
  // Fixate: the pip on the one it is fixed on.
  s.fixT -= dt;
  if (fixOn !== s.fixOn || (s.fixT <= 0 && fixOn !== null)) { s.fixOn = fixOn; s.fixT = 4; if (fixOn !== null) A.mark({ m: 'fix', a: fixOn, t: 5 }); }
  // A new phase: its clocks start, its name shows.
  const ph = phaseAt(s.form, share);
  if (ph !== s.phase && ph > s.phase) {
    s.phase = ph; s.t = 0;
    const uses = s.form.phases[ph].uses;
    s.next = uses.map(u => u.first ?? (u.every ? u.every / 2 : 0));
    A.mark({ m: 'phase', w: s.form.phases[ph].id, t: 3 });
    if (s.form.id === 'antlered-storm' && ph === 2) A.mark({ m: 'eye', t: 600, x: boss.x, y: boss.y });
  }
  const phase = s.form.phases[Math.max(0, s.phase)];
  s.t += dt;
  const wet = s.form.wet ? MECH.wetLightning : 1;
  const hit = (k: PartyKeeper, n: number, type: DamageType) => { if (n > 0) A.strike(k, n * (type === 'lightning' ? wet : 1), type); };
  // The channel: it runs unless stopped.
  if (s.cast) {
    if (A.stopped()) { s.cast = null; s.stats.interrupted++; A.mark({ m: 'cast', t: 0 }); }
    else {
      s.cast.t -= dt;
      if (s.cast.t <= 0) {
        const u = s.cast.use;
        s.cast = null;
        A.mark({ m: 'cast', t: 0 });
        if (u.summon) { A.adds(u.summon, 3, lv - MECH.addsUnder, true); s.stats.adds += 3; }
        else A.heal(Math.round(boss.def.hp * (u.heal ?? MECH.castHeal)));
      }
    }
  }
  // Timed uses.
  phase.uses.forEach((u, i) => {
    if (s.next[i] === undefined || s.t < s.next[i]) return;
    s.next[i] = u.every ? s.t + u.every * A.cadence : Infinity;
    if (u.words) A.say(u.words);
    use(s, u, boss, ks, A, B, lv);
  });
  // Rings.
  for (let i = s.rings.length - 1; i >= 0; i--) {
    const r = s.rings[i];
    r.t -= dt;
    if (r.t > 0) continue;
    s.rings.splice(i, 1);
    const live = A.keepers();
    if (r.m === 'soak') {
      const inside = live.filter(k => dist(k, r) <= r.r);
      if (inside.length) { s.stats.soaked++; for (const k of inside) hit(k, r.dmg / inside.length, r.type); }
      else { s.stats.soakEmpty++; for (const k of live) hit(k, MECH.soakEmptyB * B, r.type); }
    } else if (r.m === 'spread') {
      // Each marked Keeper's ring: every other ring it overlaps bursts on it.
      const me = live.find(k => k.id === r.on);
      if (!me) continue;
      const over = live.filter(k => k.id !== me.id && dist(k, me) < r.r * 2).length;
      if (over) { s.stats.overlaps += over; hit(me, over * r.dmg, r.type); }
    } else if (r.m === 'burn-room') {
      for (const k of live) { hit(k, r.dmg, r.type); s.dots.push({ id: k.id, t: MECH.burnSecs, dps: MECH.burnDotB * B, type: r.type, tick: 1 }); }
    } else {
      for (const k of live) if (dist(k, r) <= r.r) hit(k, r.dmg, r.type);
    }
  }
  // Burns and brands: once a second.
  for (let i = s.dots.length - 1; i >= 0; i--) {
    const d = s.dots[i];
    d.t -= dt; d.tick -= dt;
    const k = ks.find(x => x.id === d.id);
    if (d.tick <= 0) { d.tick += 1; if (k) hit(k, d.dps, d.type); }
    if (d.t <= 0 || !k) { s.dots.splice(i, 1); if (d.brand) A.mark({ m: 'brand', a: d.id, t: 0 }); }
  }
  // The tether: too far it snaps, too close it burns.
  const tt = s.tether;
  if (tt) {
    tt.t -= dt; tt.tick -= dt;
    const a = ks.find(k => k.id === tt.a), b = ks.find(k => k.id === tt.b);
    if (!a || !b || tt.t <= 0) { s.tether = null; A.mark({ m: 'tether', a: tt.a, b: tt.b, t: 0 }); }
    else {
      const d = dist(a, b) / T;
      if (d > MECH.tetherFar) { hit(a, tt.snap, 'lightning'); hit(b, tt.snap, 'lightning'); s.stats.snapped++; s.tether = null; A.mark({ m: 'tether', a: tt.a, b: tt.b, t: 0 }); }
      else if (tt.tick <= 0) { tt.tick += 1; if (d < MECH.tetherNear) { hit(a, tt.dps, 'fire'); hit(b, tt.dps, 'fire'); } }
    }
  }
  // Sunder's stacks on the fixated, shown as pips; they wear off.
  const sn = fixOn !== null ? s.sunder.get(fixOn)?.[0] ?? 0 : 0;
  if (sn !== s.sunderShown && fixOn !== null) { s.sunderShown = sn; A.mark({ m: 'sunder', a: fixOn, n: sn, t: sn ? MECH.sunderSecs : 0 }); }
  for (const [id, st] of s.sunder) { st[1] -= dt; if (st[1] <= 0) { s.sunder.delete(id); A.mark({ m: 'sunder', a: id, n: 0, t: 0 }); } }
}

/** One use goes off. */
function use(s: PartyState, u: MechUse, boss: PartyBoss, ks: readonly PartyKeeper[], A: PartyArena, B: number, lv: number): void {
  const type = u.el ?? 'physical';
  switch (u.m) {
    case 'burn-room': {
      // The whole arena: a ring round the boss as wide as the room, then the blow and the burn.
      const R = s.form.arena * T;
      A.ring(boss.x, boss.y, R, MECH.burnTell, u.tone);
      s.rings.push({ m: 'burn-room', x: boss.x, y: boss.y, r: R, t: MECH.burnTell, dmg: (u.b ?? MECH.burnB) * B, type });
      return;
    }
    case 'brand': {
      const pool = ks.filter(k => k.id !== s.fixOn);
      for (let c = 0; c < (u.count ?? 1) && pool.length; c++) {
        const k = pool.splice(Math.floor(A.rng() * pool.length), 1)[0];
        s.dots.push({ id: k.id, t: MECH.brandSecs, dps: (u.b ?? MECH.brandB) * B, type, brand: true, tick: 1 });
        s.stats.brands++;
        A.mark({ m: 'brand', a: k.id, t: MECH.brandSecs });
      }
      return;
    }
    case 'adds': {
      const list = u.adds ?? [];
      for (let i = 0; i < (u.n ?? 4); i++) A.adds(list[i % list.length], 1, lv - (u.under ?? MECH.addsUnder));
      s.stats.adds += u.n ?? 4;
      return;
    }
    case 'interrupt':
      if (s.cast) return;
      s.cast = { t: MECH.castSecs, use: u }; s.stats.casts++;
      A.mark({ m: 'cast', t: MECH.castSecs, w: u.words ?? '', x: boss.x, y: boss.y });
      return;
    case 'soak': {
      // On the fixated (the tear, the anvil, the bolt meant for the tree): the tank and one healthy Keeper step in.
      const on = ks.find(k => k.id === s.fixOn) ?? ks[0];
      if (!on) return;
      const R = MECH.soakR * T;
      A.ring(on.x, on.y, R, MECH.soakTell, u.tone);
      s.rings.push({ m: 'soak', x: on.x, y: on.y, r: R, t: MECH.soakTell, dmg: (u.b ?? MECH.soakB) * B, type });
      return;
    }
    case 'tether': {
      if (s.tether || ks.length < 2) return;
      let a: PartyKeeper | null, b: PartyKeeper | null;
      if (u.pair === 'healer-tank') { b = ks.find(k => k.id === s.fixOn) ?? null; a = healerOf(s, ks); }
      else { const pool = [...ks]; a = pool.splice(Math.floor(A.rng() * pool.length), 1)[0]; b = pool.splice(Math.floor(A.rng() * pool.length), 1)[0] ?? null; }
      if (!a || !b || a.id === b.id) return;
      s.tether = { a: a.id, b: b.id, t: MECH.tetherSecs, tick: 1, dps: MECH.tetherHeatB * B, snap: MECH.tetherSnapB * B };
      A.mark({ m: 'tether', a: a.id, b: b.id, t: MECH.tetherSecs });
      return;
    }
    case 'spread': {
      const R = MECH.spreadR * T;
      for (const k of ks) { A.ring(k.x, k.y, R, MECH.spreadTell, u.tone); s.rings.push({ m: 'spread', x: k.x, y: k.y, r: R, t: MECH.spreadTell, dmg: (u.b ?? MECH.spreadB) * B, type: u.el ?? 'lightning', on: k.id }); }
      return;
    }
    case 'strike': {
      // Under up to `n` Keepers (where they stand as the tell starts: a step aside saves them).
      const pool = [...ks];
      for (let c = 0; c < (u.n ?? 3) && pool.length; c++) {
        const k = pool.splice(Math.floor(A.rng() * pool.length), 1)[0], R = MECH.strikeR * T;
        A.ring(k.x, k.y, R, MECH.strikeTell, u.tone);
        s.rings.push({ m: 'strike', x: k.x, y: k.y, r: R, t: MECH.strikeTell, dmg: (u.b ?? 1.6) * B, type });
      }
      return;
    }
    case 'charge': {
      // Lowered Antlers: on the farthest Keeper.
      let far: PartyKeeper | null = null, fd = -1;
      for (const k of ks) { const d = dist(k, boss); if (d > fd) { fd = d; far = k; } }
      if (!far || ks.length < 2 && fd < 3 * T) return;
      const R = MECH.chargeR * T;
      A.ring(far.x, far.y, R, MECH.chargeTell, u.tone);
      s.rings.push({ m: 'charge', x: far.x, y: far.y, r: R, t: MECH.chargeTell, dmg: (u.b ?? 2) * B, type });
      return;
    }
    default: return;
  }
}

/**
 * One of the boss's blows lands on `to` (its fixated, the top threat): Fixate's every-4th heavy (2.5B), Sunder's stacks
 * (+8% each, 10 s, max 5; at 5 the blow is doubled and the stacks fall). Returns the blow as it lands; `arc` is called
 * a blow ahead of the heavy, so its 0.6 s red arc shows first.
 */
export function partyBite(s: PartyState, to: string, n: number, B: number, arc?: () => void): number {
  const uses = s.form.phases[Math.max(0, s.phase)]?.uses ?? [];
  let out = n;
  if (to === s.fixOn && uses.some(u => u.m === 'fixate')) {
    s.bites++;
    if (s.bites >= MECH.heavyEvery) { s.bites = 0; s.heavyArc = false; s.stats.heavies++; out = Math.max(out, MECH.heavyB * B); }
    else if (s.bites === MECH.heavyEvery - 1 && !s.heavyArc) { s.heavyArc = true; arc?.(); }
  }
  if (uses.some(u => u.m === 'sunder')) {
    const st = s.sunder.get(to) ?? [0, 0];
    if (st[0] >= MECH.sunderMax) { out *= 2; s.sunder.delete(to); return out; }
    out *= 1 + st[0] * MECH.sunderPct;
    s.sunder.set(to, [Math.min(MECH.sunderMax, st[0] + 1), MECH.sunderSecs]);
  }
  return out;
}

/** A Cleanse reached `id`: its Brand (and Burn the Room's burn on it) is lifted. */
export function partyCleanse(s: PartyState, id: string, A?: Pick<PartyArena, 'mark'>): boolean {
  const had = s.dots.some(d => d.id === id);
  if (!had) return false;
  for (let i = s.dots.length - 1; i >= 0; i--) if (s.dots[i].id === id) { if (s.dots[i].brand) A?.mark({ m: 'brand', a: id, t: 0 }); s.dots.splice(i, 1); }
  s.stats.cleansed++;
  return true;
}
/** A Keeper mended another (or itself): the director learns who the healer is. */
export function partyHealed(s: PartyState, by: string, n: number): void { if (n > 0) s.healed.set(by, (s.healed.get(by) ?? 0) + n); }
/** A Shield Oath / Vow / Hold the Gate on the one stacked: its Sunder falls (the tank's answer at 4 stacks). */
export function partyGuard(s: PartyState, id: string): void { s.sunder.delete(id); }

/** S10: a party boss's mark on the wire (td-party-boss PartyMark → CoopEvent 'mech'). */
export function mechEvent(e: PartyMark, i: string): CoopEvent {
  return {
    k: 'mech', m: e.m, i, t: Math.max(0, Math.min(600, Math.round(e.t * 10) / 10)),
    ...(e.a !== undefined ? { a: e.a } : {}), ...(e.b !== undefined ? { b: e.b } : {}), ...(e.n !== undefined ? { n: e.n } : {}),
    ...(e.w ? { w: e.w } : {}), ...(e.x !== undefined ? { x: Math.round(e.x) } : {}), ...(e.y !== undefined ? { y: Math.round(e.y) } : {}),
  };
}
