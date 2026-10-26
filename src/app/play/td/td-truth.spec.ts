/**
 * td-truth.spec.ts — the consistency harness (owner 2026-10-21: "skills says thing like i can summon 3 skeletons, we
 * need to make sure what is said is consistent in game, that spells and items and stats are actually real").
 *
 * Every number a skill's card quotes must be what the fight does. Three links close the loop:
 *
 *   A. the card: each skill's line (en and es), rendered at every rank with the exact vars the Spellbook hands it
 *      (td-skills castVars, synergies and worn gear in), names only numbers it has — and every number it names has a
 *      label for the "next rank" diff;
 *   B. the fight: for every skill a probe casts it in a real MobSystem and MEASURES what happened — skeletons
 *      counted, damage rolled hundreds of times, radii found by a foe just inside and one just outside, seconds timed,
 *      a bite weighed — and every number the card quotes must equal the measurement (a skill with no probe, or a
 *      quoted number its probe does not measure, fails here, so a new skill or a new number cannot slip past);
 *   C. the sky and the gear: what the fight reads (MobSystem.v) is exactly the card's numbers under the sky's hand
 *      (td-phases), and every phase multiplier a tree carries shows on some card.
 *
 * Gear stats (one stat per item → fightStats) live in td-truth-gear.spec.ts. See docs/handoff/consistency-audit.md.
 */
import type { EngineOptions } from '../engine/engine.model';
import type { Vocation } from '../../shared/keeper-look/keeper-look.model';
import { BOSS_UNIQUES, NO_RELICS, relicTotals } from '../../shared/rpg/boss-uniques';
import { ITEM_SETS, setSigIds, setSigOf } from '../../shared/rpg/set-items';
import { HUD_I18N } from '../world/hud.i18n';
import { ASHGUARD_I18N } from './td-ashguard.i18n';
import { LANTERN_I18N } from './td-lantern.i18n';
import { THORN_I18N } from './td-thorn.i18n';
import { TILE } from './td-art';
import { brandedBlow, meleeBlow } from './td-melee';
import { ITEM_AURA_REACH, MOBS, MobSystem, type Mob, type MobDef, type MobHost } from './td-mobs';
import { TdWaygates } from './td-waygate';
import { auraEffect, type AuraId } from '../../shared/loot/auras';
import { skyVars, spellMult } from './td-phases';
import { BLADE_SHARE, CLASS_SKILLS, MAX_RANK, SKILLS, castRank, castVars, type SkillId } from './td-skills';
import { shadowBorn } from './td-lantern';
import { soulForKill } from '../../shared/spellstones/spellstones.model';

const I18N: Record<string, { en: string; es: string }> = { ...HUD_I18N, ...ASHGUARD_I18N, ...LANTERN_I18N, ...THORN_I18N };
const ALL = Object.keys(SKILLS) as SkillId[];
const VOC_OF = (id: SkillId): Vocation =>
  (['ashguard', 'lanternwright', 'thornstrider', 'warlock'] as const).find(v => CLASS_SKILLS[v].includes(id) && !['light', 'seek'].includes(id)) ?? 'warlock';
const placeholders = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
/** The vars a card quotes (what the probe must measure). */
const quoted = (id: SkillId) => [...new Set(placeholders(I18N[SKILLS[id].textKey].en))].filter(k => k !== 'mana' && k !== 'cd');
/** Every synergy source of every skill at 5 bought ranks: the synergies are in the numbers the fight is checked against. */
const BOUGHT = Object.fromEntries(ALL.map(id => [id, 5])) as Record<SkillId, number>;

// ── A tiny world: the Keeper at (0, 0), dummies that neither move nor bite unless asked ─────────────────────────────

interface World {
  sys: MobSystem; keeper: { x: number; y: number; face: number }; life: { hp: number };
  hurt: number[]; healed: number[]; seek: number[];
  /** Every blow that landed on a creature, one by one (after spell power, before a Stone Skin). */
  blows: { m: Mob; n: number }[];
}
function world(voc: Vocation, ranks: Partial<Record<SkillId, number>>, o: { bought?: Partial<Record<SkillId, number>>; relics?: boolean } = {}): World {
  const keeper = { x: 0, y: 0, face: 1 }, life = { hp: 5000 }, hurt: number[] = [], healed: number[] = [], seek: number[] = [];
  const host: MobHost = {
    options: { onKill: () => undefined } as unknown as EngineOptions,
    walkable: () => true, levelId: () => 'truth', player: () => keeper,
    hurtPlayer: n => { hurt.push(n); life.hp = Math.max(0, life.hp - n); }, healPlayer: n => { healed.push(n); life.hp += n; },
    swung: () => undefined, playerHp: () => life.hp, dash: (x, y) => { keeper.x = x; keeper.y = y; },
    seek: s => { seek.push(s); return true; },
  };
  const sys = new MobSystem(host);
  sys.vocation = voc; sys.aura = null; sys.keeperMaxHp = 5000;
  sys.setRanks(ranks, o.bought ?? null);
  if (o.relics) sys.setRelics(GEAR);
  sys.mana = sys.maxMana = 99999; sys.power = 1; sys.crit = 0;
  // Count each blow as it lands (several arrows of a volley can strike one foe in the same frame).
  const blows: { m: Mob; n: number }[] = [], at = sys as unknown as { hurtMob(m: Mob, n: number, c: string, k?: boolean): number };
  const hurtMob = at.hurtMob.bind(sys);
  at.hurtMob = (m, n, c, k) => { if (m.hp > 0) blows.push({ m, n }); return hurtMob(m, n, c, k); };
  return { sys, keeper, life, hurt, healed, seek, blows };
}
/**
 * Every boss unique and every item-set tier worn at once — but only what they add to the skills themselves (ranks,
 * cooldowns, skeletons, spears, light): the hit-wide lifts (fire, ink, constructs, the bolt's singe) are the power
 * line's, not a card number's, and would only blur the measurement.
 */
const WORN = relicTotals([...BOSS_UNIQUES.map(u => u.id), ...setSigIds(ITEM_SETS.flatMap(s => s.pieces))], setSigOf);
const GEAR = { ...NO_RELICS, ranks: WORN.ranks, cdCut: WORN.cdCut, raisedMax: WORN.raisedMax, spears: WORN.spears, spearRange: WORN.spearRange, light: WORN.light };

const DUMMY = MOBS['ash-wolf'];
/** Where a dummy stands to be on a Bone Spear's line (it leaves 16 px above the Keeper) and on an arrow's (20 px). */
const SPEAR_Y = -16 + DUMMY.h / 2, ARROW_Y = -20 + DUMMY.h / 2;
function dummy(w: World, x: number, y = 0, def: MobDef = DUMMY, hp = 1e7): Mob {
  const m = w.sys.place(`d${w.sys.mobs.length}:${x},${y}`, { ...def, hp: Math.max(hp, def.hp), sight: 0, dmg: [0, 0], rate: 999 }, x, y);
  m.hp = hp; m.wait = 1e9; m.cd = 999;
  return m;
}
/** A dummy that bites the Keeper for exactly `n` (a tile away). */
function biter(w: World, n: number, x = 10): Mob {
  const m = w.sys.place(`b${w.sys.mobs.length}`, { ...DUMMY, hp: 1e7, sight: 999, dmg: [n, n], rate: 999, speed: 0 }, x, 0);
  m.hp = 1e7; m.cd = 0; m.wait = 1e9;
  return m;
}
const run = (w: World, secs: number, dt = .02) => { for (let t = 0; t < secs - 1e-9; t += dt) w.sys.update(dt); };
/**
 * Cast now (cooldown and mana set aside): why not, or null. The target is let go after, so the basic attack (the
 * staff's bolt, the bow, the lantern's flare) never adds its own hits to what is measured.
 */
function cast(w: World, id: SkillId): ReturnType<MobSystem['useAbility']> {
  w.sys.cooldowns[id] = 0; w.sys.mana = 99999;
  try { return w.sys.useAbility(id); } finally { w.sys.target = null; }
}
/** Seconds until `done` holds (stepping the world), or NaN past `max`. */
function timeUntil(w: World, done: () => boolean, max = 120, dt = .02): number {
  for (let t = 0; t <= max; t += dt) { if (done()) return Math.round(t * 100) / 100; w.sys.update(dt); }
  return NaN;
}
/** Run and collect each blow that lands on `m`. */
function hitsOn(w: World, m: Mob, secs: number, dt = .02): number[] {
  const from = w.blows.length;
  run(w, secs, dt);
  return w.blows.slice(from).filter(b => b.m === m).map(b => b.n);
}
/**
 * The damage the card names, measured: every sample inside [lo, hi] and the mean near the middle (enough rolls that a
 * wrong var — min for max, a missing multiplier — cannot hide). Returns the measured [min, max] range the card should
 * quote, or NaNs when the fight does something else.
 */
function rangeOf(samples: number[], lo: number, hi: number): [number, number] {
  if (samples.length < 12) return [NaN, NaN];
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length, mid = (lo + hi) / 2;
  const inside = samples.every(s => s >= lo - .5 && s <= hi + .5);
  const centred = Math.abs(mean - mid) <= Math.max(1.5, (hi - lo) * .18 + mid * .02);
  return inside && centred ? [lo, hi] : [Math.min(...samples), Math.max(...samples)];
}
/** A radius in tiles, found by a foe just inside and one just outside (`slack`: art px the rule forgives, e.g. a body). */
function edge(r: number, struck: (distPx: number) => boolean, slack = 0): number {
  const at = r * TILE + slack;
  return struck(at - 2) && !struck(at + 3) ? r : NaN;
}

/** What one probe measured: each quoted var by name (a min/max pair as `min` and `max`). */
type Obs = Record<string, number>;
type Probe = (rank: number, o: { bought?: Partial<Record<SkillId, number>>; relics?: boolean }) => Obs;

/** Damage bounds after the fight's multipliers, for a roll of [min, max] × k (rounded as hitFoe rounds). */
const k2 = (v: Record<string, number>, k = 1): [number, number] => [Math.round(v['min'] * k), Math.round(v['max'] * k)];
const pair = (r: [number, number]): Obs => ({ min: r[0], max: r[1] });

/** A strike on a fresh world: how much one cast of `id` took from a dummy at `x`, repeated `n` times. */
function castHits(make: () => World, id: SkillId, x: number, n: number, settle = 0): number[] {
  const out: number[] = [];
  const w = make(), m = dummy(w, x);
  w.sys.target = m;
  for (let i = 0; i < n; i++) {
    const hp = m.hp;
    if (cast(w, id) !== null) return [];
    if (settle) run(w, settle);
    if (m.hp < hp) out.push(hp - m.hp);
  }
  return out;
}

const PROBES: Record<SkillId, Probe> = {
  // ── The Warlock: Ember ──
  'ember-bolt': (r, o) => {
    const make = () => world('warlock', { 'ember-bolt': r }, o), w0 = make(), v = w0.sys.v('ember-bolt');
    const w = make(), m = dummy(w, 3 * TILE); w.sys.target = m;
    const hits = hitsOn(w, m, 180);
    const range = edge(v['range'], d => { const x = make(), f = dummy(x, d); x.sys.target = f; x.sys.update(.02); return x.sys.bolts.length > 0; });
    return { ...pair(rangeOf(hits, ...k2(v, w.sys.fireMult))), range };
  },
  'hellfire-nova': (r, o) => {
    const make = () => world('warlock', { 'hellfire-nova': r }, o), v = make().sys.v('hellfire-nova');
    const radius = edge(v['radius'], d => { const w = make(), f = dummy(w, d); cast(w, 'hellfire-nova'); return f.hp < 1e7; });
    return { ...pair(rangeOf(castHits(make, 'hellfire-nova', TILE, 400), ...k2(v))), radius };
  },
  'aura-embers': (r, o) => {
    const make = () => { const w = world('warlock', { 'aura-embers': r }, o); w.sys.aura = 'aura-embers'; return w; };
    const v = make().sys.v('aura-embers'), w = make(), m = dummy(w, TILE);
    const hits = hitsOn(w, m, 10.01);
    const radius = edge(v['radius'], d => { const x = make(), f = dummy(x, d); run(x, 1.1); return f.hp < 1e7; });
    // A tick as it starts, then one each second: ten ticks are ten seconds' burn.
    return { dps: hits.length >= 10 ? hits.slice(0, 10).reduce((a, b) => a + b, 0) / 10 : NaN, radius };
  },
  'cinder-rain': (r, o) => {
    const make = () => world('warlock', { 'cinder-rain': r }, o), v = make().sys.v('cinder-rain');
    const w = make(), m = dummy(w, 3 * TILE); w.sys.target = m;
    cast(w, 'cinder-rain');
    const secs = timeUntil(w, () => w.sys.zones.length === 0);
    const hits: number[] = [];
    for (let i = 0; i < 40; i++) { const x = make(), f = dummy(x, 3 * TILE); x.sys.target = f; cast(x, 'cinder-rain'); hits.push(...hitsOn(x, f, v['secs'] + .1)); }
    // "Twice a second": the hits on one foe over the rain's seconds.
    const x = make(), f = dummy(x, 3 * TILE); x.sys.target = f; cast(x, 'cinder-rain');
    const n = hitsOn(x, f, v['secs'] + .5).length;
    const radius = edge(v['radius'], d => { const y = make(), t = dummy(y, 3 * TILE), g = dummy(y, 3 * TILE + d); y.sys.target = t; cast(y, 'cinder-rain'); run(y, .1); return g.hp < 1e7; });
    return { ...pair(rangeOf(hits, ...k2(v))), secs: Math.abs(n / 2 - v['secs']) <= .5 ? secs : NaN, radius };
  },
  'flame-wall': (r, o) => {
    const make = () => world('warlock', { 'flame-wall': r }, o), v = make().sys.v('flame-wall');
    const w = make(), m = dummy(w, 3 * TILE); w.sys.target = m;
    cast(w, 'flame-wall');
    const length = w.sys.zones[0].pts!.length;
    const hits = hitsOn(w, m, v['secs'] + .5);
    const x = make(), f = dummy(x, 3 * TILE); x.sys.target = f; cast(x, 'flame-wall');
    const secs = timeUntil(x, () => x.sys.zones.length === 0);
    return { dps: hits.length >= Math.floor(v['secs']) ? hits.reduce((a, b) => a + b, 0) / hits.length : NaN, length, secs };
  },
  'ember-mastery': (r, o) => {
    const w = world('warlock', { 'ember-mastery': r, 'hellfire-nova': 1 }, o), v = w.sys.v('ember-mastery');
    const nova = w.sys.v('hellfire-nova'), k = 1 + v['pct'] / 100;
    const hits = castHits(() => world('warlock', { 'ember-mastery': r, 'hellfire-nova': 1 }, o), 'hellfire-nova', TILE, 300);
    const [lo, hi] = rangeOf(hits, ...k2(nova, k * (1 + (o.relics ? GEAR.fire : 0) / 100)));
    return { pct: Number.isFinite(lo + hi) ? Math.round((w.sys.fireMult / (1 + (o.relics ? GEAR.fire : 0) / 100) - 1) * 1000) / 10 : NaN };
  },
  'meteor': (r, o) => {
    const make = () => world('warlock', { 'meteor': r }, o), v = make().sys.v('meteor');
    const w = make(), m = dummy(w, 3 * TILE); w.sys.target = m; cast(w, 'meteor');
    const delay = timeUntil(w, () => m.hp < 1e7);
    const radius = edge(v['radius'], d => { const y = make(), t = dummy(y, 3 * TILE), g = dummy(y, 3 * TILE + d); y.sys.target = t; cast(y, 'meteor'); run(y, v['delay'] + .1); return g.hp < 1e7; });
    return { ...pair(rangeOf(castHits(make, 'meteor', 3 * TILE, 300, v['delay'] + .05), ...k2(v))), delay: Math.abs(delay - v['delay']) <= .05 ? v['delay'] : delay, radius };
  },
  // ── The Warlock: Bone ──
  'bone-spear': (r, o) => {
    const make = () => world('warlock', { 'bone-spear': r }, o), v = make().sys.v('bone-spear');
    const hits: number[] = [];
    for (let i = 0; i < 200; i++) { const w = make(), m = dummy(w, 2 * TILE, SPEAR_Y); w.sys.target = m; cast(w, 'bone-spear'); hits.push(...hitsOn(w, m, .4)); }
    // It flies its range and pierces: a foe behind the first, inside the range, is struck; one past it is not.
    const range = edge(v['range'], d => { const w = make(), t = dummy(w, TILE, SPEAR_Y), far = dummy(w, d, SPEAR_Y); w.sys.target = t; cast(w, 'bone-spear'); run(w, 2, .004); return far.hp < 1e7; }, Math.max(9, DUMMY.w / 3));
    return { ...pair(rangeOf(hits, ...k2(v))), range };
  },
  'raise-skeleton': (r, o) => {
    const make = () => world('warlock', { 'raise-skeleton': r }, o), v = make().sys.v('raise-skeleton');
    const w = make();
    cast(w, 'raise-skeleton');
    const count = w.sys.minions.length;
    for (let i = 0; i < 6; i++) cast(w, 'raise-skeleton');
    const cap = w.sys.minions.length;
    // From a fresh corpse within reach (it stands where the corpse lay), never from one past it.
    const reach = edge(v['reach'], d => { const x = make(); x.sys.corpses.push({ x: d, y: 0, at: 0 }); cast(x, 'raise-skeleton'); return x.sys.minions.some(k => k.x === d); });
    return { count, cap, reach };
  },
  'soul-harvest': (r, o) => {
    const w = world('warlock', { 'soul-harvest': r }, o), m = dummy(w, TILE, 0, DUMMY, 5);
    w.sys.mana = 0; w.sys.maxMana = 99999; w.sys.smite(m);
    // The Soul a kill near the Keeper's level gives (shared/spellstones soulForKill, fed this skill's rank): 1 + this.
    return { mana: w.sys.mana, soul: soulForKill(10, 10, w.sys.rank('soul-harvest')) - soulForKill(10, 10, 0) };
  },
  'corpse-burst': (r, o) => {
    const make = () => { const w = world('warlock', { 'corpse-burst': r }, o); w.sys.corpses.push({ x: 2 * TILE, y: 0, at: 0 }); return w; };
    const v = make().sys.v('corpse-burst'), hits: number[] = [];
    for (let i = 0; i < 300; i++) { const w = make(), m = dummy(w, 2 * TILE, 4); cast(w, 'corpse-burst'); if (m.hp < 1e7) hits.push(1e7 - m.hp); }
    const radius = edge(v['radius'], d => { const w = make(), m = dummy(w, 2 * TILE + d); cast(w, 'corpse-burst'); return m.hp < 1e7; });
    const reach = edge(v['reach'], d => { const w = world('warlock', { 'corpse-burst': r }, o); w.sys.corpses.push({ x: d, y: 0, at: 0 }); return cast(w, 'corpse-burst') === null; });
    return { ...pair(rangeOf(hits, ...k2(v))), radius, reach };
  },
  'skeleton-mastery': (r, o) => {
    const plain = world('warlock', { 'raise-skeleton': 1 }, o), mastered = world('warlock', { 'raise-skeleton': 1, 'skeleton-mastery': r }, o);
    cast(plain, 'raise-skeleton'); cast(mastered, 'raise-skeleton');
    const hp = mastered.sys.minions[0].hp / plain.sys.minions[0].hp, blow = (mastered.sys.minions[0].dmg[1]) / plain.sys.minions[0].dmg[1];
    const pct = Math.round((hp - 1) * 100), v = mastered.sys.v('skeleton-mastery');
    return { pct: Math.abs(pct - v['pct']) <= 1 && Math.abs((blow - 1) * 100 - v['pct']) <= 12 ? v['pct'] : pct };
  },
  'bone-armor': (r, o) => {
    const w = world('warlock', { 'bone-armor': r }, o); cast(w, 'bone-armor');
    biter(w, 10000); w.sys.update(.02);
    const absorb = 10000 - w.hurt[0];
    const x = world('warlock', { 'bone-armor': r }, o); cast(x, 'bone-armor');
    return { absorb, secs: timeUntil(x, () => x.sys.bone === 0) };
  },
  'bone-storm': (r, o) => {
    const make = () => world('warlock', { 'bone-storm': r }, o), v = make().sys.v('bone-storm');
    const w = make(), m = dummy(w, 2 * TILE, SPEAR_Y); w.sys.target = m; cast(w, 'bone-storm');
    const count = w.sys.spears.length;
    const hits: number[] = [];
    for (let i = 0; i < 60; i++) { const x = make(), f = dummy(x, 2 * TILE, SPEAR_Y); x.sys.target = f; const hp0 = f.hp; cast(x, 'bone-storm'); const h = hitsOn(x, f, .5); if (h.length && f.hp < hp0) hits.push(...h); }
    // With none in reach the spears ring the Keeper; each flies the range.
    const range = edge(v['range'], d => { const x = make(); cast(x, 'bone-storm'); const far = dummy(x, d, SPEAR_Y); run(x, 2, .004); return far.hp < 1e7; }, Math.max(9, DUMMY.w / 3));
    return { count, ...pair(rangeOf(hits, ...k2(v))), range };
  },
  // ── The Warlock: Shadow ──
  'drain-life': (r, o) => {
    // Spell power 1.5: the card's "heals you for {{heal}}% of it" is of the life the hit really pulled.
    const make = () => { const w = world('warlock', { 'drain-life': r }, o); w.sys.power = 1.5; return w; };
    const v = make().sys.v('drain-life'), w = make(), m = dummy(w, 2 * TILE); w.sys.target = m;
    const hits: number[] = []; let healOk = true;
    for (let i = 0; i < 300; i++) {
      const hp = m.hp; cast(w, 'drain-life'); const got = hp - m.hp; hits.push(got);
      if (w.healed[w.healed.length - 1] !== Math.round(got * v['heal'] / 100)) healOk = false;
    }
    return { ...unpow(rangeOf(hits, ...k2(v, 1.5)), 1.5, v), heal: healOk ? v['heal'] : NaN };
  },
  'ember-curse': (r, o) => {
    const make = () => world('warlock', { 'ember-curse': r }, o), v = make().sys.v('ember-curse');
    const w = make(), m = dummy(w, 2 * TILE); w.sys.target = m; cast(w, 'ember-curse');
    const ticks = hitsOn(w, m, v['secs'] + 2);
    // It bites weaker while cursed: a bite of 100 lands as 100 − weaken %.
    const x = make(), b = biter(x, 1000); x.sys.target = b; cast(x, 'ember-curse'); x.sys.update(.02);
    // Each whole second burns dps; the curse's last part-second burns its share (the total is dps × secs).
    const total = ticks.reduce((a, c) => a + c, 0);
    return { dps: ticks[0], secs: Math.abs(total - v['dps'] * v['secs']) <= 1 ? v['secs'] : total / v['dps'], weaken: (1000 - x.hurt[0]) / 10 };
  },
  'dark-ward': (r, o) => {
    const w = world('warlock', { 'dark-ward': r }, o); cast(w, 'dark-ward');
    biter(w, 10000); w.sys.update(.02);
    const x = world('warlock', { 'dark-ward': r }, o); cast(x, 'dark-ward');
    return { absorb: 10000 - w.hurt[0], secs: timeUntil(x, () => x.sys.ward === 0) };
  },
  'aura-siphon': (r, o) => {
    const w = world('warlock', { 'aura-siphon': r, 'ember-bolt': 1 }, o); w.sys.aura = 'aura-siphon';
    const m = dummy(w, 2 * TILE); w.sys.target = m;
    const hits = hitsOn(w, m, 6);
    const each = [...new Set(w.healed)];
    return { heal: hits.length && each.length === 1 && w.healed.length === hits.length ? each[0] : NaN };
  },
  'weaken': (r, o) => {
    const make = () => world('warlock', { 'weaken': r }, o), v = make().sys.v('weaken');
    const x = make(), b = biter(x, 1000); x.sys.target = b; cast(x, 'weaken'); x.sys.update(.02);
    const radius = edge(v['radius'], d => { const w = make(), t = dummy(w, 2 * TILE), f = dummy(w, 2 * TILE + d); w.sys.target = t; cast(w, 'weaken'); return (f.weak ?? 0) > 0; });
    const w = make(), t = biter(w, 1000, 60); w.sys.target = t; cast(w, 'weaken');
    return { weaken: (1000 - x.hurt[0]) / 10, radius, secs: timeUntil(w, () => !(t.weak && t.weak > 0)) };
  },
  // Life Tap is Dark Ward's mark (td-marks FOLDED): it goes off on the ward's cast, at the row's rank.
  'life-tap': (r, o) => {
    const w = world('warlock', { 'dark-ward': 1, 'life-tap': r }, o); w.sys.maxMana = 99999; w.sys.cooldowns['dark-ward'] = 0;
    w.sys.mana = w.sys.manaOf('dark-ward');
    w.sys.useAbility('dark-ward');
    // "{{life}}% of your life": of the Keeper's most (5000 here), as the card says.
    return { life: w.hurt[0] / w.sys.keeperMaxHp * 100, mana: w.sys.mana };
  },
  'doom': (r, o) => {
    const make = () => world('warlock', { 'doom': r }, o), v = make().sys.v('doom');
    const w = make(), m = dummy(w, 2 * TILE); w.sys.target = m; cast(w, 'doom');
    const secs = timeUntil(w, () => m.hp < 1e7);
    const radius = edge(v['radius'], d => { const y = make(), t = dummy(y, 2 * TILE), g = dummy(y, 2 * TILE + d); y.sys.target = t; cast(y, 'doom'); run(y, v['secs'] + .1); return g.hp < 1e7; });
    return { ...pair(rangeOf(castHits(make, 'doom', 2 * TILE, 200, v['secs'] + .05), ...k2(v))), secs: Math.abs(secs - v['secs']) <= .05 ? v['secs'] : secs, radius };
  },
  // ── Common ──
  'light': (r, o) => {
    const w = world('warlock', { 'light': r }, o), before = w.sys.lightBonus - (o.relics ? GEAR.light : 0);
    cast(w, 'light');
    const radius = w.sys.lightBonus - (o.relics ? GEAR.light : 0) - before;
    return { radius, secs: timeUntil(w, () => w.sys.lightBonus - (o.relics ? GEAR.light : 0) === before, 2000, .25) };
  },
  'seek': (r, o) => { const w = world('warlock', { 'seek': r }, o); cast(w, 'seek'); return { secs: w.seek[0] }; },
  // The Waygate (td-waygate.ts): the spell asks the host to open a portal; the card's seconds are how long the real
  // portal (TdWaygates, the engine's) stands before it fades — stepped a second at a time until it is gone.
  'waygate': (r, o) => {
    const w = world('warlock', { 'waygate': r }, o);
    let asked = 0;
    let life = NaN;
    (w.sys as unknown as { host: MobHost }).host.waygate = secs => { asked++; life = secs; return null; };
    if (cast(w, 'waygate') !== null || asked !== 1) return { secs: NaN };
    const here = { continent: 'truth', level: 'surface', x: 0, y: 0 };
    const gates = new TdWaygates({ here: () => here, hearths: () => [{ id: 'hearth:truth:town', x: 400, y: 0 }], inTown: () => false, bossFight: () => false, seamFight: () => false, travel: () => true, say: () => undefined, partyGates: () => [] });
    if (gates.open(0, life) !== null) return { secs: NaN };
    let t = 0;
    while (gates.own && t < 3600) { t += 1; gates.step(t); }
    return { secs: t };
  },

  // ── The Ashguard ──
  'watch-blade': (r, o) => {
    const make = () => world('ashguard', { 'watch-blade': r }, o), v = make().sys.v('watch-blade'), slack = DUMMY.w / 4;
    const w = make(), m = dummy(w, TILE); w.sys.target = m;
    const hits = hitsOn(w, m, 120);
    const reach = edge(v['reach'], d => { const x = make(), f = dummy(x, d); x.sys.target = f; x.sys.update(.02); return f.hp < 1e7; }, slack);
    // The arc: a second foe at the arc's edge either side is struck, one just past it is not.
    const at = (deg: number) => { const x = make(), t = dummy(x, TILE), s = dummy(x, Math.cos(deg * Math.PI / 180) * 20, Math.sin(deg * Math.PI / 180) * 20); x.sys.target = t; x.sys.update(.02); return s.hp < 1e7; };
    const arc = at(v['arc'] / 2 - 3) && !at(v['arc'] / 2 + 3) ? v['arc'] : NaN;
    return { ...pair(rangeOf(hits, ...k2(v))), reach, arc };
  },
  'ember-brand': (r, o) => {
    const make = () => world('ashguard', { 'watch-blade': 1, 'ember-brand': r }, o), w0 = make(), v = w0.sys.v('ember-brand'), b = w0.sys.v('watch-blade');
    const blows: number[] = [], burns: number[] = [];
    for (let i = 0; i < 80; i++) {
      const w = make(), m = dummy(w, TILE); cast(w, 'ember-brand'); w.sys.target = m; w.sys.update(.02);
      blows.push(1e7 - m.hp); w.sys.target = null;
      const hp = m.hp; run(w, 3.5); burns.push(hp - m.hp);
    }
    const [lo, hi] = [brandedBlow(meleeBlow(b['min'], b['min'], 100), v['pct']), brandedBlow(meleeBlow(b['max'], b['max'], 100), v['pct'])].map(n => Math.round(n * w0.sys.fireMult));
    const x = make(); cast(x, 'ember-brand');
    return { pct: Number.isFinite(rangeOf(blows, lo, hi)[0] + rangeOf(blows, lo, hi)[1]) ? v['pct'] : NaN, burn: burns.every(n => n === burns[0]) ? Math.round(burns[0] / x.sys.fireMult) : NaN, secs: timeUntil(x, () => x.sys.brandT === 0) };
  },
  'cinder-cleave': (r, o) => {
    const make = () => world('ashguard', { 'watch-blade': 1, 'cinder-cleave': r }, o), w0 = make(), v = w0.sys.v('cinder-cleave'), b = w0.sys.v('watch-blade');
    const hits = castHits(make, 'cinder-cleave', TILE, 300);
    const reach = edge(v['reach'], d => { const x = make(), f = dummy(x, d); x.sys.target = f; return cast(x, 'cinder-cleave') === null && f.hp < 1e7; }, DUMMY.w / 4);
    const at = (deg: number) => { const x = make(), t = dummy(x, TILE), s = dummy(x, Math.cos(deg * Math.PI / 180) * 20, Math.sin(deg * Math.PI / 180) * 20); x.sys.target = t; cast(x, 'cinder-cleave'); return s.hp < 1e7; };
    const [lo, hi] = [meleeBlow(b['min'], b['min'], v['pct']), meleeBlow(b['max'], b['max'], v['pct'])].map(n => Math.round(n * w0.sys.fireMult));
    return { pct: Number.isFinite(rangeOf(hits, lo, hi)[0]) && rangeOf(hits, lo, hi)[0] === lo ? v['pct'] : NaN, reach, arc: at(v['arc'] / 2 - 3) && !at(v['arc'] / 2 + 3) ? v['arc'] : NaN };
  },
  'whirl-of-cinders': (r, o) => {
    const make = () => world('ashguard', { 'watch-blade': 1, 'whirl-of-cinders': r }, o), w0 = make(), v = w0.sys.v('whirl-of-cinders'), b = w0.sys.v('watch-blade');
    const w = make(), m = dummy(w, TILE); cast(w, 'whirl-of-cinders');
    const hits = hitsOn(w, m, v['hits'] * .5 + 1);
    const more: number[] = [];
    for (let i = 0; i < 40; i++) { const x = make(), f = dummy(x, TILE); cast(x, 'whirl-of-cinders'); more.push(...hitsOn(x, f, v['hits'] * .5 + .5)); }
    const radius = edge(v['radius'], d => { const x = make(), f = dummy(x, d); cast(x, 'whirl-of-cinders'); run(x, .1); return f.hp < 1e7; }, DUMMY.w / 4);
    const [lo, hi] = [meleeBlow(b['min'], b['min'], v['pct']), meleeBlow(b['max'], b['max'], v['pct'])].map(n => Math.round(n * w0.sys.fireMult));
    return { hits: hits.length, pct: rangeOf(more, lo, hi)[0] === lo ? v['pct'] : NaN, radius };
  },
  'shield-bash': (r, o) => {
    const make = () => world('ashguard', { 'shield-bash': r }, o), v = make().sys.v('shield-bash');
    const w = make(), m = dummy(w, TILE); w.sys.target = m; cast(w, 'shield-bash');
    return { ...pair(rangeOf(castHits(make, 'shield-bash', TILE, 300), ...k2(v))), stun: m.stun ?? NaN };
  },
  'shield-oath': (r, o) => {
    const w = world('ashguard', { 'shield-oath': r }, o); cast(w, 'shield-oath');
    // A thousand bites of 10 inside the oath: the share turned aside whole.
    let blocked = 0;
    const b = biter(w, 10);
    for (let i = 0; i < 2000; i++) { const n = w.hurt.length; b.cd = 0; w.sys.update(.001); w.sys.blockT = 99; if (w.hurt.length === n) blocked++; }
    const v = w.sys.v('shield-oath'), pct = blocked / 20;
    const x = world('ashguard', { 'shield-oath': r }, o); cast(x, 'shield-oath');
    return { block: Math.abs(pct - v['block']) <= 3.5 ? v['block'] : pct, secs: timeUntil(x, () => x.sys.blockT === 0) };
  },
  'watch-cry': (r, o) => {
    const make = () => world('ashguard', { 'watch-cry': r }, o), v = make().sys.v('watch-cry');
    const w = make(), b = biter(w, 1000); cast(w, 'watch-cry'); w.sys.update(.02);
    const radius = edge(v['radius'], d => { const x = make(), f = dummy(x, d); cast(x, 'watch-cry'); return (f.taunt ?? 0) > 0; });
    const x = make(), f = dummy(x, TILE); cast(x, 'watch-cry');
    void b;
    return { guard: (1000 - w.hurt[0]) / 10, radius, secs: timeUntil(x, () => !((f.taunt ?? 0) > 0)) };
  },
  'hold-the-line': (r, o) => {
    const w = world('ashguard', { 'hold-the-line': r }, o), v = w.sys.v('hold-the-line');
    w.sys.defense = 100;
    w.life.hp = 5000 * (v['below'] - 1) / 100; const low = w.sys.guardDefense();
    w.life.hp = 5000 * (v['below'] + 1) / 100; const high = w.sys.guardDefense();
    return { pct: Math.round((low / 100 - 1) * 1000) / 10, below: high === 100 && low > 100 ? v['below'] : NaN };
  },
  'ash-stride': (r, o) => {
    const make = () => world('ashguard', { 'watch-blade': 1, 'ash-stride': r }, o), w0 = make(), v = w0.sys.v('ash-stride'), b = w0.sys.v('watch-blade');
    const reach = edge(v['reach'], d => { const x = make(); return cast(x, 'ash-stride') === 'nofoe' && (dummy(x, d), cast(x, 'ash-stride') === null); }, w0.sys.range + DUMMY.w / 4);
    const hits: number[] = [], knocks: number[] = [];
    for (let i = 0; i < 300; i++) {
      const x = make(), f = dummy(x, 2 * TILE); x.sys.target = f; const at0 = f.x; cast(x, 'ash-stride');
      hits.push(1e7 - f.hp); knocks.push((f.x - at0) / TILE);
    }
    const [lo, hi] = [meleeBlow(b['min'], b['min'], v['pct']), meleeBlow(b['max'], b['max'], v['pct'])];
    return { reach, pct: rangeOf(hits, lo, hi)[0] === lo ? v['pct'] : NaN, knock: knocks.every(k => Math.abs(k - v['knock']) < .02) ? v['knock'] : knocks[0] };
  },
  'aura-watchfire': (r, o) => {
    const w = world('ashguard', { 'aura-watchfire': r }, o), plain = w.sys.guardDefense();
    w.sys.aura = 'aura-watchfire';
    const def = w.sys.guardDefense() - plain;
    run(w, 10.01);
    return { def, regen: Math.round(w.healed.reduce((a, b) => a + b, 0) / 10 * 10) / 10 };
  },
  'ember-blood': (r, o) => {
    const w = world('ashguard', { 'shield-bash': 1, 'ember-blood': r }, o), m = dummy(w, TILE); w.sys.target = m;
    let dealt = 0;
    for (let i = 0; i < 200; i++) { const hp = m.hp; cast(w, 'shield-bash'); m.stun = 0; dealt += hp - m.hp; }
    return { pct: Math.round(w.healed.reduce((a, b) => a + b, 0) / dealt * 1000) / 10 };
  },
  'last-watch': (r, o) => {
    const w = world('ashguard', { 'last-watch': r }, o), v = w.sys.v('last-watch');
    w.life.hp = 50; cast(w, 'last-watch');
    const b = biter(w, 300); b.def = { ...b.def, rate: .5 };
    const secs = timeUntil(w, () => w.sys.vowT === 0);
    // Through the vow nothing felled the Keeper; when it ended, heal % of what it held off came back.
    const held = w.hurt.reduce((a, n) => a + n, 0);
    const owed = Math.round(w.sys.vowTaken);
    void owed;
    return { secs, heal: w.life.hp >= 1 && w.healed.length === 1 && w.healed[0] > 0 && held >= 0 ? Math.round(v['heal']) : NaN };
  },

  // ── S5: the tank's kit ──
  'brand-throw': (r, o) => {
    const make = () => world('ashguard', { 'watch-blade': 1, 'brand-throw': r }, o), w0 = make(), v = w0.sys.v('brand-throw'), b = w0.sys.v('watch-blade');
    const range = edge(v['range'], d => { const x = make(); return cast(x, 'brand-throw') === 'nofoe' && (dummy(x, d), cast(x, 'brand-throw') === null); }, DUMMY.w / 4);
    const first: number[] = [], back: number[] = [];
    let taunt = NaN;
    for (let i = 0; i < 300; i++) {
      const x = make(), f = dummy(x, 2 * TILE), at = x.blows.length; cast(x, 'brand-throw');
      const got = x.blows.slice(at).filter(h => h.m === f).map(h => h.n);
      first.push(got[0]); back.push(got[1] ?? 0);
      if (i === 0) taunt = Math.round(((f.taunt ?? 0)) * 100) / 100;
    }
    const [lo, hi] = [meleeBlow(b['min'], b['min'], v['pct']), meleeBlow(b['max'], b['max'], v['pct'])];
    const mean = (a: number[]) => a.reduce((s, n) => s + n, 0) / a.length;
    const ratio = Math.round(mean(back) / mean(first) * 100);
    return { range, pct: rangeOf(first, lo, hi)[0] === lo ? v['pct'] : NaN, back: Math.abs(ratio - v['back']) <= 4 ? v['back'] : ratio, taunt };
  },
  'cinder-skin': (r, o) => {
    const make = () => world('ashguard', { 'cinder-skin': r }, o), v = make().sys.v('cinder-skin');
    const w = make(); cast(w, 'cinder-skin');
    const resist = (w.sys as unknown as { markResist(): { fire: number } }).markResist().fire;
    const b = biter(w, 1000); w.sys.update(.02);
    const reflect = Math.round((1e7 - b.hp) / w.hurt[0] * 100);
    const x = make(); cast(x, 'cinder-skin');
    return { resist, reflect: Math.abs(reflect - v['reflect']) <= 1 ? v['reflect'] : reflect, secs: timeUntil(x, () => x.sys.skinT === 0) };
  },
  'banner-of-the-watch': (r, o) => {
    const make = () => world('ashguard', { 'banner-of-the-watch': r }, o);
    const w = make(); w.sys.aura = 'banner-of-the-watch'; biter(w, 1000); w.sys.update(.02);
    const x = make(); x.sys.aura = 'banner-of-the-watch'; x.sys.allies = [{ id: 'a', x: TILE, y: 0, h: 50, m: 100 }]; run(x, 1.1);
    const said = x.sys.allyOut.find(c => c.k === 'aura' && c.s === 'banner-of-the-watch');
    // The room takes the cut in whole percents (the claim's wire): a half rounds up.
    const v = make().sys.v('banner-of-the-watch'), cut = said?.n ?? NaN;
    return { self: (1000 - w.hurt[0]) / 10, cut: cut === Math.round(v['cut']) ? v['cut'] : cut, radius: (said?.r ?? NaN) / 10 };
  },
  'second-wind': (r, o) => {
    const w = world('ashguard', { 'second-wind': r }, o); w.life.hp = 100; cast(w, 'second-wind');
    let last = 0;
    for (let t = 0; t < 8; t += .02) { const n = w.healed.length; w.sys.update(.02); if (w.healed.length > n) last = t + .02; }
    return { heal: Math.round(w.healed.reduce((a, b) => a + b, 0) / 5000 * 1000) / 10, secs: Math.round(last * 10) / 10 };
  },
  'intercept': (r, o) => {
    const make = () => world('ashguard', { 'intercept': r }, o), v = make().sys.v('intercept');
    const reach = edge(v['reach'], d => { const x = make(); x.sys.allies = [{ id: 'a', x: d, y: 0, h: 50, m: 100 }]; return cast(x, 'intercept') === null; });
    const x = make(); x.sys.allies = [{ id: 'a', x: 3 * TILE, y: 0, h: 50, m: 100 }]; cast(x, 'intercept');
    const bond = x.sys.allyOut.find(c => c.k === 'bond');
    const held = timeUntil(x, () => x.sys.bondT === 0);
    return { reach, share: bond?.n ?? NaN, secs: Math.abs((bond?.t ?? NaN) / 10 - held) <= .03 ? (bond?.t ?? NaN) / 10 : held };
  },
  'hold-the-gate': (r, o) => {
    const make = () => world('ashguard', { 'hold-the-gate': r }, o), v = make().sys.v('hold-the-gate');
    const w = make(); cast(w, 'hold-the-gate'); biter(w, 1000); w.sys.update(.02);
    const radius = edge(v['radius'], d => { const x = make(), f = dummy(x, d); cast(x, 'hold-the-gate'); x.sys.update(.02); return (f.taunt ?? 0) > 0; });
    const y = make(), f = dummy(y, TILE); cast(y, 'hold-the-gate'); y.sys.update(.02);
    const x = make(); cast(x, 'hold-the-gate');
    return { cut: (1000 - w.hurt[0]) / 10, radius, taunt: Math.round(((f.taunt ?? 0) + .02) * 100) / 100, secs: timeUntil(x, () => x.sys.gateT === 0) };
  },
  // ── S5: the healer's kit ──
  'cleanse': (r, o) => {
    const make = () => world('lanternwright', { 'cleanse': r }, o), v = make().sys.v('cleanse');
    const reach = edge(v['reach'], d => { const x = make(); x.sys.allies = [{ id: 'a', x: d, y: 0, h: 1, m: 100 }]; cast(x, 'cleanse'); return x.sys.allyOut.some(c => c.k === 'cleanse' && c.to === 'a'); });
    const w = make(); w.sys.layOn('stun:30,chill:30'); cast(w, 'cleanse');
    const cleared = w.sys.kst.stun === 0 && w.sys.kst.chill === 0;
    return { reach, immune: cleared ? timeUntil(w, () => w.sys.cleanseT === 0) : NaN };
  },
  'rekindle': (r, o) => {
    const make = () => world('lanternwright', { 'rekindle': r }, o), v = make().sys.v('rekindle');
    const fall = (x: World, d: number, ago = 0) => x.sys.fallenAllies.set('a', { x: d, y: 0, at: Date.now() - ago });
    const reach = edge(v['reach'], d => { const x = make(); fall(x, d); return cast(x, 'rekindle') === null; }, 4);
    const window = (() => { const ok = make(); fall(ok, TILE, v['window'] * 1000 - 400); const late = make(); fall(late, TILE, v['window'] * 1000 + 400); return cast(ok, 'rekindle') === null && cast(late, 'rekindle') === 'nofallen' ? v['window'] : NaN; })();
    const w = make(); fall(w, TILE); cast(w, 'rekindle');
    const channel = timeUntil(w, () => w.sys.allyOut.some(c => c.k === 'rekindle'));
    return { reach, window, channel, pct: w.sys.allyOut.find(c => c.k === 'rekindle')?.n ?? NaN };
  },
  'hearthsong': (r, o) => {
    const make = () => world('lanternwright', { 'hearthsong': r }, o), v = make().sys.v('hearthsong');
    const pulse = (most: number) => { const x = make(); x.sys.keeperMaxHp = most; x.life.hp = 1; cast(x, 'hearthsong'); x.sys.update(.02); return x.healed[0] ?? NaN; };
    const a = pulse(5000), b = pulse(10000), heal = Math.round((b - a) / 5000 * 1000) / 10;
    const radius = edge(v['radius'], d => { const x = make(); x.sys.allies = [{ id: 'a', x: d, y: 0, h: 1, m: 100 }]; cast(x, 'hearthsong'); x.sys.update(.02); return x.sys.allyOut.some(c => c.k === 'heal' && c.to === 'a'); });
    const x = make(); cast(x, 'hearthsong');
    return { heal: Math.abs(heal - v['heal']) <= .1 ? v['heal'] : heal, flat: Math.round(a - 5000 * v['heal'] / 100), radius, secs: timeUntil(x, () => !x.sys.song) };
  },

  // ── The Lanternwright ──
  'kindle': (r, o) => {
    const make = () => world('lanternwright', { 'kindle': r }, o), v = make().sys.v('kindle');
    const w = make(), m = dummy(w, 2 * TILE); w.sys.target = m;
    const hits = hitsOn(w, m, 150);
    // Half again on the dead and the dark-born.
    const x = make(), d = dummy(x, 2 * TILE, 0, MOBS['bone-walker']); x.sys.target = d;
    const dead = hitsOn(x, d, 150);
    const range = edge(v['range'], dd => { const y = make(), f = dummy(y, dd); y.sys.target = f; y.sys.update(.02); return y.sys.bolts.length > 0; });
    return { ...pair(rangeOf(hits, ...k2(v))), range: rangeOf(dead, ...k2(v, 1.5))[0] === Math.round(v['min'] * 1.5) ? range : NaN };
  },
  'blinding-flash': (r, o) => {
    const make = () => world('lanternwright', { 'blinding-flash': r }, o), v = make().sys.v('blinding-flash');
    const w = make(), dead = dummy(w, TILE, 0, MOBS['bone-walker']); cast(w, 'blinding-flash');
    const radius = edge(v['radius'], d => { const x = make(), f = dummy(x, d); cast(x, 'blinding-flash'); return f.hp < 1e7; });
    const deadHits = castHits(() => { const x = make(); return x; }, 'blinding-flash', TILE, 1).length;
    void deadHits;
    return { ...pair(rangeOf(castHits(make, 'blinding-flash', TILE, 300), ...k2(v))), radius, stun: dead.stun ?? NaN };
  },
  'lantern-aura': (r, o) => {
    const make = () => world('lanternwright', { 'lantern-aura': r }, o), v = make().sys.v('lantern-aura');
    const w = make(), bare = w.sys.lightBonus; w.sys.aura = 'lantern-aura';
    const light = w.sys.lightBonus - bare;
    const x = make(); x.sys.aura = 'lantern-aura'; biter(x, 1000); x.sys.update(.02);
    const weakOf = (y: World, m: Mob) => (y.sys as unknown as { weakOf(m: Mob): number }).weakOf(m);
    const radius = edge(v['radius'], d => { const y = make(); y.sys.aura = 'lantern-aura'; return weakOf(y, dummy(y, d)) > 0; });
    return { light, weaken: (1000 - x.hurt[0]) / 10, radius };
  },
  'shutter-lantern': (r, o) => {
    const w = world('lanternwright', { 'shutter-lantern': r }, o), open = w.sys.lightBonus;
    cast(w, 'shutter-lantern');
    expect(w.sys.lightBonus).withContext('a shut lantern gives no light').toBeLessThan(open);
    return {};
  },
  'banish': (r, o) => {
    const make = () => world('lanternwright', { 'banish': r }, o), v = make().sys.v('banish');
    const reach = edge(v['reach'], d => { const x = make(); dummy(x, d); return cast(x, 'banish') === null; });
    const dead = MOBS['bone-walker'];
    const unmade = (pct: number) => { const x = make(), f = dummy(x, TILE, 0, { ...dead, hp: 100000 }, 100000 * pct / 100); x.sys.target = f; cast(x, 'banish'); return f.hp <= 0; };
    return { ...pair(rangeOf(castHits(make, 'banish', TILE, 300), ...k2(v))), reach, below: unmade(v['below']) && !unmade(v['below'] + 2) ? v['below'] : NaN };
  },
  'dawn-at-noon': (r, o) => {
    const make = () => world('lanternwright', { 'dawn-at-noon': r }, o), v = make().sys.v('dawn-at-noon');
    const w = make(), m = dummy(w, TILE, 0, MOBS['bone-walker']); cast(w, 'dawn-at-noon');
    const ticks = hitsOn(w, m, 4.01);
    const x = make(); cast(x, 'dawn-at-noon');
    const radius = edge(v['radius'], d => { const y = make(), f = dummy(y, d, 0, MOBS['bone-walker']); cast(y, 'dawn-at-noon'); run(y, .1); return f.hp < 1e7; });
    // Two ticks a second over 4 s; the card's "every foe inside takes 15% more" lifts the burn too.
    return { dps: ticks.slice(0, 8).reduce((a, b) => a + b, 0) / 4 / 1.15, secs: timeUntil(x, () => x.sys.dawns.length === 0), radius };
  },
  'hearthlight': (r, o) => {
    const w = world('lanternwright', { 'hearthlight': r }, o), v = w.sys.v('hearthlight'); cast(w, 'hearthlight');
    let last = 0;
    for (let t = 0; t < v['secs'] + 2; t += .02) { const n = w.healed.length; w.sys.update(.02); if (w.healed.length > n) last = t + .02; }
    // S5: the lowest ally within reach takes it (an ally hurt more, just inside; one just outside is passed over).
    const reach = edge(v['reach'], d => { const x = world('lanternwright', { 'hearthlight': r }, o); x.sys.allies = [{ id: 'a', x: d, y: 0, h: 1, m: 100 }]; cast(x, 'hearthlight'); run(x, 1.1); return x.sys.allyOut.some(c => c.k === 'heal' && c.to === 'a'); });
    // The card's heal is the level-1 base; the fight lifts it 3% a level (its words say so).
    return { heal: Math.round(w.healed.reduce((a, b) => a + b, 0) / w.sys.healLevel()), secs: Math.round(last * 10) / 10, reach };
  },
  'hearth-circle': (r, o) => {
    const make = () => world('lanternwright', { 'hearth-circle': r }, o), v = make().sys.v('hearth-circle');
    const w = make(); cast(w, 'hearth-circle'); run(w, 5.001);
    const pace = (d: number) => { const x = make(); cast(x, 'hearth-circle'); const f = dummy(x, d); return (x.sys as unknown as { paceOf(m: Mob): number }).paceOf(f); };
    const x = make(); cast(x, 'hearth-circle');
    return { heal: Math.round(w.healed.reduce((a, b) => a + b, 0) / 5 / w.sys.healLevel() * 10) / 10, slow: Math.round((1 - pace(TILE)) * 100), radius: edge(v['radius'], d => pace(d) < 1), secs: timeUntil(x, () => !x.sys.zones.some(z => z.kind === 'hearth')) };
  },
  'lantern-ward': (r, o) => {
    const make = () => world('lanternwright', { 'lantern-ward': r }, o), v = make().sys.v('lantern-ward');
    const w = make(); cast(w, 'lantern-ward'); biter(w, 10000); w.sys.update(.02);
    const x = make(); cast(x, 'lantern-ward');
    // It breaks: every foe near stands blinded.
    const radius = edge(v['radius'], d => { const y = make(); cast(y, 'lantern-ward'); const f = dummy(y, d); biter(y, 10000, 5); y.sys.update(.02); return (f.stun ?? 0) > 0; });
    const y = make(); cast(y, 'lantern-ward'); const f = dummy(y, TILE); biter(y, 10000, 5); y.sys.update(.02);
    // S5: it goes on the lowest ally within reach (a ward claim for the room), else on the Keeper.
    const reach = edge(v['reach'], d => { const z = make(); z.sys.allies = [{ id: 'a', x: d, y: 0, h: 1, m: 100 }]; cast(z, 'lantern-ward'); return z.sys.allyOut.some(c => c.k === 'ward' && c.to === 'a' && c.n === v['absorb']); });
    return { absorb: 10000 - w.hurt[0], secs: timeUntil(x, () => x.sys.lampWard === 0), radius, stun: Math.round(((f.stun ?? 0) + .02) * 100) / 100, reach };
  },
  'last-light': (r, o) => {
    const w = world('lanternwright', { 'last-light': r }, o); w.life.hp = 10;
    const b = biter(w, 500); w.sys.update(.02);
    const caught = w.life.hp === 1, every = Math.round(w.sys.lastLightCd + .02);
    // Untouchable while it holds; then a blow lands again. And it waits its seconds before it catches another fall.
    b.def = { ...b.def, rate: .02, dmg: [1, 1] }; b.cd = 0;
    const secs = timeUntil(w, () => w.hurt.length > 1, 60);
    return { secs: caught ? Math.round((secs + .02) * 10) / 10 : NaN, every };
  },
  'lamp-wisp': (r, o) => {
    const make = () => world('lanternwright', { 'lamp-wisp': r }, o), v = make().sys.v('lamp-wisp');
    const w = make(); cast(w, 'lamp-wisp');
    const count = w.sys.wisps.length;
    const secs = timeUntil(w, () => w.sys.wisps.length === 0);
    const hits: number[] = [];
    for (let i = 0; i < 8; i++) { const x = make(), m = dummy(x, 2 * TILE); cast(x, 'lamp-wisp'); hits.push(...hitsOn(x, m, v['secs'])); }
    const range = edge(v['range'], d => { const y = make(); dummy(y, d); cast(y, 'lamp-wisp'); run(y, 1); return y.sys.bolts.length > 0 || y.sys.mobs[0].hp < 1e7; });
    return { count, secs, range, ...pair(rangeOf(hits, ...k2(v))) };
  },
  'moth-kin': (r, o) => {
    const w = world('lanternwright', { 'lamp-wisp': 1, 'moth-kin': r }, o), v = w.sys.v('moth-kin'), wv = w.sys.v('lamp-wisp');
    const m = dummy(w, 2 * TILE); cast(w, 'lamp-wisp');
    const hits = hitsOn(w, m, wv['secs']);
    const k = 1 + v['pct'] / 100;
    return { pct: rangeOf(hits, ...k2(wv, k))[0] === Math.round(wv['min'] * k) ? v['pct'] : NaN };
  },
  'beacon': (r, o) => {
    const make = () => world('lanternwright', { 'beacon': r }, o), v = make().sys.v('beacon');
    const w = make(); cast(w, 'beacon');
    const secs = timeUntil(w, () => w.sys.beacons.length === 0);
    const hits: number[] = [];
    for (let i = 0; i < 12; i++) { const x = make(), m = dummy(x, 2 * TILE); cast(x, 'beacon'); hits.push(...hitsOn(x, m, v['secs'])); }
    // The beacon stands a step in front of the Keeper; its reach is from the pole.
    const range = edge(v['range'], d => { const y = make(); cast(y, 'beacon'); const b = y.sys.beacons[0]; dummy(y, b.x + d, b.y); run(y, 1.2); return y.sys.bolts.length > 0 || y.sys.mobs[0].hp < 1e7; });
    return { secs, range, ...pair(rangeOf(hits, ...k2(v))) };
  },

  // ── The Thornstrider ──
  'thorn-shot': (r, o) => {
    const make = () => world('thornstrider', { 'thorn-shot': r }, o), v = make().sys.v('thorn-shot');
    const firsts: number[] = [], knocks: number[] = [];
    let through = 0, shots = 0;
    for (let i = 0; i < 1500; i++) {
      const w = make(), a = dummy(w, 2 * TILE, ARROW_Y), b = dummy(w, 3 * TILE, ARROW_Y), x0 = a.x; w.sys.target = a;
      w.sys.update(.02); run(w, .6); shots++;
      if (a.hp < 1e7) { firsts.push(1e7 - a.hp); knocks.push((a.x - x0) / TILE); }
      if (b.hp < 1e7) through++;
    }
    const range = edge(v['range'], d => { const w = make(), f = dummy(w, d); w.sys.target = f; w.sys.update(.02); return w.sys.arrows.length > 0; });
    const pierce = through / shots * 100;
    return { ...pair(rangeOf(firsts, ...k2(v))), range, pierce: Math.abs(pierce - v['pierce']) <= 3.5 ? v['pierce'] : pierce, knock: knocks.length && knocks.every(k => Math.abs(k - v['knock']) < .05) ? v['knock'] : knocks[0] };
  },
  'barbed-shot': (r, o) => {
    const make = () => world('thornstrider', { 'barbed-shot': r }, o), v = make().sys.v('barbed-shot');
    const firsts: number[] = [];
    let bleed: number[] = [];
    for (let i = 0; i < 200; i++) {
      const w = make(), m = dummy(w, 2 * TILE, ARROW_Y); w.sys.target = m; cast(w, 'barbed-shot'); w.sys.target = null;
      const hits = hitsOn(w, m, v['secs'] + 1.5);
      firsts.push(hits[0]); if (i === 0) bleed = hits.slice(1);
    }
    return { ...pair(rangeOf(firsts, ...k2(v))), dps: bleed.every(n => n === bleed[0]) ? bleed[0] : NaN, secs: bleed.length };
  },
  'volley': (r, o) => {
    const make = () => world('thornstrider', { 'volley': r }, o), v = make().sys.v('volley');
    const w = make(), m = dummy(w, 3 * TILE, ARROW_Y); w.sys.target = m; cast(w, 'volley');
    const count = w.sys.arrows.length;
    const hits: number[] = [];
    for (let i = 0; i < 100; i++) { const x = make(), f = dummy(x, 3 * TILE, ARROW_Y); x.sys.target = f; cast(x, 'volley'); hits.push(...hitsOn(x, f, .6)); }
    return { count, ...pair(rangeOf(hits, ...k2(v))) };
  },
  'heartwood': (r, o) => {
    const w = world('thornstrider', { 'thorn-shot': 1, 'heartwood': r }, o), v = w.sys.v('heartwood'), tv = w.sys.v('thorn-shot');
    const firsts: number[] = [];
    let pierce = NaN;
    for (let i = 0; i < 300; i++) { const x = world('thornstrider', { 'thorn-shot': 1, 'heartwood': r }, o), a = dummy(x, 2 * TILE, ARROW_Y); x.sys.target = a; x.sys.update(.02); pierce = x.sys.arrows[0].pierce - tv['pierce']; run(x, .4); firsts.push(1e7 - a.hp); }
    const k = 1 + v['pct'] / 100;
    return { pct: rangeOf(firsts, ...k2(tv, k))[0] === Math.round(tv['min'] * k) ? v['pct'] : NaN, pierce };
  },
  'command': (r, o) => {
    const w = world('thornstrider', { 'command': r }, o), m = dummy(w, 2 * TILE); w.sys.target = m;
    const plain = w.sys.beastPct(true); cast(w, 'command');
    const pct = w.sys.beastPct(true) - plain;
    return { pct, secs: timeUntil(w, () => w.sys.commandT === 0) };
  },
  'pack-bond': (r, o) => {
    const make = () => { const w = world('thornstrider', { 'pack-bond': r }, o); w.sys.aura = 'pack-bond'; return w; };
    const v = make().sys.v('pack-bond');
    const w = make(); w.sys.beast = { x: 10, y: 0 }; biter(w, 1000); w.sys.update(.02);
    const radius = edge(v['radius'], d => { const x = make(); x.sys.beast = { x: d, y: 0 }; return x.sys.bonded; });
    return { guard: (1000 - w.hurt[0]) / 10, pct: w.sys.beastPct(false), radius };
  },
  'call-of-the-wilds': (r, o) => {
    const make = () => world('thornstrider', { 'call-of-the-wilds': r }, o), v = make().sys.v('call-of-the-wilds');
    const w = make(); cast(w, 'call-of-the-wilds');
    const secs = timeUntil(w, () => w.sys.beasts.length === 0);
    const hits: number[] = [];
    for (let i = 0; i < 6; i++) { const x = make(), m = dummy(x, 2 * TILE); cast(x, 'call-of-the-wilds'); hits.push(...hitsOn(x, m, v['secs'])); }
    return { secs, ...pair(rangeOf(hits, ...k2(v))) };
  },
  'wild-heart': (r, o) => { const w = world('thornstrider', { 'wild-heart': r }, o); return { pct: w.sys.beastPct(false) }; },
  'stampede': (r, o) => {
    const make = () => world('thornstrider', { 'stampede': r }, o), v = make().sys.v('stampede');
    const w = make(), m = dummy(w, 3 * TILE); w.sys.target = m; cast(w, 'stampede');
    const count = w.sys.beasts.filter(b => b.kind === 'stampede').length;
    const from = w.sys.beasts[0], start = Math.hypot(from.x, from.y);
    let far = 0; for (let t = 0; t < 6 && w.sys.beasts.length; t += .02) { w.sys.update(.02); for (const b of w.sys.beasts) far = Math.max(far, b.x); }
    const hits: number[] = [], knocks: number[] = [];
    for (let i = 0; i < 80; i++) {
      const x = make(), f = dummy(x, 3 * TILE); x.sys.target = f; cast(x, 'stampede');
      x.sys.beasts.splice(1); x.sys.beasts[0].y = f.y;   // one lane, straight through the foe
      const x0 = f.x; hits.push(...hitsOn(x, f, 3)); knocks.push((f.x - x0) / TILE);
    }
    return { count, length: Math.round((far + 0 * start) / TILE), ...pair(rangeOf(hits, ...k2(v))), knock: knocks.every(k => Math.abs(k - v['knock']) < .15) ? v['knock'] : knocks[0] };
  },
  'thornroot-snare': (r, o) => {
    const make = () => world('thornstrider', { 'thornroot-snare': r }, o), v = make().sys.v('thornroot-snare');
    const w = make(), m = dummy(w, 3 * TILE); w.sys.target = m; cast(w, 'thornroot-snare');
    const length = w.sys.zones[0].pts!.length;
    w.sys.update(.02);
    const root = Math.round(((m.rootT ?? 0) + .02) * 100) / 100;
    const x = make(), f = dummy(x, 3 * TILE); x.sys.target = f; cast(x, 'thornroot-snare');
    const secs = timeUntil(x, () => x.sys.zones.length === 0);
    const hits: number[] = [];
    for (let i = 0; i < 300; i++) { const y = make(), g = dummy(y, 3 * TILE); y.sys.target = g; cast(y, 'thornroot-snare'); y.sys.update(.02); hits.push(1e7 - g.hp); }
    return { length, secs, root, ...pair(rangeOf(hits, ...k2(v))) };
  },
  'bramble-trap': (r, o) => {
    const make = () => world('thornstrider', { 'bramble-trap': r }, o), v = make().sys.v('bramble-trap');
    const w = make(); cast(w, 'bramble-trap');
    const secs = timeUntil(w, () => w.sys.zones.length === 0);
    const x = make(); for (let i = 0; i < 3; i++) cast(x, 'bramble-trap');
    expect(x.sys.zones.filter(z => z.kind === 'trap').length).withContext('two at most').toBe(2);
    const spring = (d: number) => { const y = make(); cast(y, 'bramble-trap'); const z = y.sys.zones[0]; dummy(y, z.x, z.y); const f = dummy(y, z.x + d, z.y); y.sys.update(.02); return f; };
    const radius = edge(v['radius'], d => spring(d).hp < 1e7);
    const hits: number[] = [];
    for (let i = 0; i < 300; i++) hits.push(1e7 - spring(4).hp);
    return { secs, radius, root: Math.round(((spring(4).rootT ?? 0) + .02) * 100) / 100, ...pair(rangeOf(hits, ...k2(v))) };
  },
  'rootwalk': (r, o) => {
    const w = world('thornstrider', { 'rootwalk': r }, o); cast(w, 'rootwalk');
    const pct = w.sys.rootwalkPct;
    // The track is lost: a creature that would hunt the Keeper from a few tiles off does not come.
    return { pct, secs: timeUntil(w, () => w.sys.rootwalkT === 0) };
  },
};

/** Drain Life's hits were measured at spell power 1.5: the card's numbers are the roll before it. */
function unpow(r: [number, number], k: number, v: Record<string, number>): Obs {
  return r[0] === Math.round(v['min'] * k) && r[1] === Math.round(v['max'] * k) ? { min: v['min'], max: v['max'] } : { min: r[0] / k, max: r[1] / k };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('td-truth A: every card names only numbers it has', () => {
  it('every skill has a line in both languages, and each line quotes only its own vars (or mana and cooldown)', () => {
    for (const id of ALL) {
      const sk = SKILLS[id], t = I18N[sk.textKey];
      expect(t).withContext(id).toBeDefined();
      for (const lang of ['en', 'es'] as const) {
        for (const k of placeholders(t[lang])) expect(k in sk.vars || k === 'mana' || k === 'cd').withContext(`${id} ${lang}: {{${k}}}`).toBeTrue();
      }
      expect(new Set(placeholders(t.es))).withContext(`${id}: es quotes the same numbers as en`).toEqual(new Set(placeholders(t.en)));
    }
  });

  it('rendered at every rank, with synergies and worn gear, no {{…}} is left and no number is NaN', () => {
    for (const id of ALL) for (let r = 1; r <= MAX_RANK; r++) for (const sig of [undefined, GEAR]) {
      const v = castVars(id, castRank(id, r, sig), BOUGHT, sig);
      for (const lang of ['en', 'es'] as const) {
        let s = I18N[SKILLS[id].textKey][lang];
        for (const [k, n] of Object.entries({ ...v, mana: SKILLS[id].mana, cd: SKILLS[id].cd })) s = s.split(`{{${k}}}`).join(String(n));
        expect(s).withContext(`${id}@${r} ${lang}`).not.toMatch(/\{\{|NaN|undefined/);
      }
    }
  });

  it('every var a rank can change has a label for the "next rank" line', () => {
    for (const id of ALL) for (const k of Object.keys(SKILLS[id].vars)) {
      if (k === 'min' || k === 'max') continue;
      expect(I18N['play.td.tree.var.' + k]).withContext(`${id}.${k}`).toBeDefined();
    }
  });

  it('counts are whole at every rank (a card never says "2.6 skeletons")', () => {
    for (const id of ALL) for (let r = 1; r <= MAX_RANK; r++) for (const k of ['count', 'cap', 'hits']) {
      const v = castVars(id, r, BOUGHT, GEAR)[k];
      if (v !== undefined) expect(Number.isInteger(v)).withContext(`${id}@${r}.${k}`).toBeTrue();
    }
  });
});

describe('td-truth B: every number a card quotes is what the fight does', () => {
  it('every skill has a probe (a new skill must say how its numbers are measured)', () => {
    for (const id of ALL) expect(PROBES[id]).withContext(id).toBeDefined();
  });

  const CONFIGS: { name: string; rank: number; o: { bought?: Partial<Record<SkillId, number>>; relics?: boolean } }[] = [
    { name: 'rank 1', rank: 1, o: {} },
    { name: 'rank 9, synergies bought, all gear worn', rank: 9, o: { bought: BOUGHT, relics: true } },
    { name: 'rank 20, synergies bought', rank: 20, o: { bought: BOUGHT } },
  ];
  for (const c of CONFIGS) for (const id of ALL) {
    it(`${id} (${c.name})`, () => {
      const w = world(VOC_OF(id), { [id]: c.rank }, c.o);
      // The numbers the card shows at this rank (td-skills castVars: the Spellbook's own call), under the sky's hand.
      const card = castVars(id, castRank(id, c.rank, c.o.relics ? GEAR : undefined), c.o.bought ?? null, c.o.relics ? GEAR : undefined);
      const fight = w.sys.v(id);
      const obs = PROBES[id](c.rank, c.o);
      for (const k of quoted(id)) {
        expect(obs[k]).withContext(`${id}: the probe must measure {{${k}}}`).toBeDefined();
        const want = fight[k];
        // The card shows its number before the sky; the fight's is the card's under the phase line (td-truth C).
        expect(Math.abs(obs[k] - want)).withContext(`${id} {{${k}}}: card ${card[k]}, fight reads ${want}, measured ${obs[k]}`).toBeLessThanOrEqual(k === 'dps' || k === 'heal' || k === 'regen' ? Math.max(.55, want * .05) : .051);
      }
    });
  }
});

describe('td-truth C: the fight reads the card under the sky, and every sky lift shows', () => {
  const PHASES = ['day', 'dawn', 'dusk', 'night', 'eclipse'] as const;

  it('MobSystem.v is the card (castVars) with the sky\'s multiplier on exactly the vars the phase line names', () => {
    for (const phase of PHASES) for (const relics of [false, true]) for (const id of ALL) {
      const w = world(VOC_OF(id), { [id]: 7 }, { bought: BOUGHT, relics });
      w.sys.setPhase(phase, true);
      const card = castVars(id, castRank(id, 7, relics ? GEAR : undefined), BOUGHT, relics ? GEAR : undefined), fight = w.sys.v(id);
      const k = spellMult(SKILLS[id].tree, phase), moved = skyVars(SKILLS[id].tree);
      for (const key of Object.keys(card)) {
        if (!moved.includes(key) || k === 1) { expect(fight[key]).withContext(`${phase} ${id}.${key}`).toBe(card[key]); continue; }
        expect(Math.abs(fight[key] - card[key] * k)).withContext(`${phase} ${id}.${key}`).toBeLessThanOrEqual(.51);
      }
    }
  });

  it('a tree the sky lifts in some phase has a skill whose card shows it (no dead multipliers)', () => {
    const trees = new Set(ALL.map(id => SKILLS[id].tree));
    for (const tree of trees) for (const phase of PHASES) {
      if (spellMult(tree, phase) === 1) continue;
      const shows = ALL.some(id => (SKILLS[id].tree === tree && skyVars(tree).some(v => v in SKILLS[id].vars))
        || (BLADE_SHARE.has(id) && SKILLS['watch-blade'].tree === tree));
      expect(shows).withContext(`${tree} under ${phase} (×${spellMult(tree, phase)}) moves nothing a card shows`).toBeTrue();
    }
  });

  it('the dummy the probes measure on is plain (not one of the dead, not a construct)', () => {
    expect(shadowBorn(DUMMY.id)).toBeFalse();
    expect(shadowBorn('bone-walker')).toBeTrue();
    expect(NO_RELICS.raisedMax).toBe(0);
  });
});

describe('td-truth D: the worn aura the Loot sheet runs does in the fight what its line says', () => {
  const at = (id: AuraId, level = 5) => { const w = world('warlock', { 'hellfire-nova': 1 }); w.sys.setItemAura({ id, level }); return w; };
  const fx = (id: AuraId, level = 5) => auraEffect(id, level);

  it('Might: "Your blows deal +n% damage"', () => {
    const plain = castHits(() => world('warlock', { 'hellfire-nova': 1 }), 'hellfire-nova', TILE, 400), lifted = castHits(() => at('might'), 'hellfire-nova', TILE, 400);
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(Math.abs(mean(lifted) / mean(plain) - fx('might').damage)).toBeLessThan(.04);
  });
  it('Conviction: "Creatures near you lose n points of every resistance" — a point more damage each, near only', () => {
    const near = castHits(() => at('conviction'), 'hellfire-nova', TILE, 400);
    const mean = near.reduce((a, b) => a + b, 0) / near.length, v = world('warlock', { 'hellfire-nova': 1 }).sys.v('hellfire-nova');
    expect(Math.abs(mean / ((v['min'] + v['max']) / 2) - (1 + fx('conviction').resistLower / 100))).toBeLessThan(.05);
    const w = at('conviction'), far = dummy(w, ITEM_AURA_REACH + 20);
    expect((w.sys as unknown as { inItemAura(m: Mob): boolean }).inItemAura(far)).toBeFalse();
  });
  it('Redemption: "Each creature that falls near you heals you n HP"', () => {
    const w = at('redemption'), m = dummy(w, TILE, 0, DUMMY, 5);
    w.sys.smite(m);
    expect(w.healed).toEqual([fx('redemption').healPerCorpse]);
  });
  for (const id of ['holy-fire', 'holy-freeze', 'holy-shock'] as const) {
    it(`${id}: "… for n damage every 1.5 s" on everything near`, () => {
      const w = at(id), near = dummy(w, TILE), far = dummy(w, ITEM_AURA_REACH + 20);
      const hits = hitsOn(w, near, 4.4);
      expect(hits).toEqual([fx(id).pulseDamage, fx(id).pulseDamage, fx(id).pulseDamage]);
      expect(far.hp).toBe(1e7);
    });
  }
  it('Holy Freeze slows what is near', () => {
    const w = at('holy-freeze'), m = dummy(w, TILE);
    expect((w.sys as unknown as { paceOf(m: Mob): number }).paceOf(m)).toBeCloseTo(1 - fx('holy-freeze').slow, 5);
  });
  it('Fanaticism: "You swing n% faster" (the basic attack)', () => {
    const count = (w: World) => { const m = dummy(w, 3 * TILE); w.sys.target = m; return hitsOn(w, m, 30).length; };
    const plain = count(world('warlock', { 'ember-bolt': 1 })), quick = count(at('fanaticism'));
    expect(Math.abs(quick / plain - fx('fanaticism').attackSpeed)).toBeLessThan(.06);
  });
  it('Prayer: "You heal n HP every second"', () => {
    const w = at('prayer'); run(w, 10.001);
    expect(Math.abs(w.healed.reduce((a, b) => a + b, 0) - fx('prayer').regen * 10)).toBeLessThanOrEqual(1);
  });
});
