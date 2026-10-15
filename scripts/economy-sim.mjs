#!/usr/bin/env node
/**
 * Eclipse Realms economy simulator — CURRENT (v2) vs PROPOSED (v3, shipped)
 * Gold curve.
 *
 * Pure Node, no Angular imports. The numbers are READ FROM SOURCE, not copied:
 *   - PROPOSED is built from src/app/shared/economy/economy-curve.ts, the file
 *     the game's catalogues are built from (single source of truth);
 *   - CURRENT's ladders come from economy-legacy-v2.ts (the frozen v2 table
 *     the save migration also reads); its other values cite the file:line they
 *     were read from (origin/main a0c9efe).
 * Both .ts files are import-free and are transpiled here with the repo's own
 * TypeScript. See docs/economy/rebalance-spec.md for the design.
 *
 *   node scripts/economy-sim.mjs --bounties      # the Board Herald's daily bounties (in --check too)
 *   node scripts/economy-sim.mjs --levels        # uncapped levels: time to 100/150/200/300 per skill (in --check too)
 *   node scripts/economy-sim.mjs --heights       # the high roads' caches and summits (in --check too)
 *   node scripts/economy-sim.mjs --pets          # the pets' helpers: the hedgehog's extra harvest, XP, bite (in --check too)
 *   node scripts/economy-sim.mjs --cabinets      # the Lost Cabinets' Gold, once each, and the set's final reward (in --check too)
 *   node scripts/economy-sim.mjs --living        # the Living World: mysteries, critter catches, strongboxes (in --check too)
 *   node scripts/economy-sim.mjs --check         # CI smoke: exit 1 when the
 *                                                # first purchase is > 15 s or
 *                                                # < 20 purchases in 10 min
 *   node scripts/economy-sim.mjs                 # both economies, default player
 *   node scripts/economy-sim.mjs --cps=6         # active click attempts per second
 *   node scripts/economy-sim.mjs --idleCpm=0     # clicks/min while the tab idles
 *   node scripts/economy-sim.mjs --no-expeditions
 *   node scripts/economy-sim.mjs --days=30
 *   node scripts/economy-sim.mjs --stages        # print the PROPOSED stage table
 *   node scripts/economy-sim.mjs --inventory --days=7  # satchel/Vault prices + rune-find pile-up
 *
 * The player is greedy-with-patience: at every decision point it picks the
 * purchase minimising (seconds to afford) + (payback seconds = cost / Δincome)
 * and buys it as soon as it is affordable. Clicks are throttled by the game's
 * strike cooldown, exactly as EconomyService.strike() does. Offline gaps pay
 * min(gap, cap) × Gold/s on return, as settleIdle() does. Deterministic: the
 * golden-spark and expedition rolls use a seeded RNG.
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ts = require('typescript');

/** Transpile an import-free .ts file and evaluate it as CommonJS. */
function loadTs(rel) {
  const file = resolve(here, '..', rel);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  return module.exports;
}

/** As loadTs, for a pure .ts module whose only imports are relative pure .ts modules. */
function loadTsTree(rel, cache = new Map()) {
  const file = resolve(here, '..', rel);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const req = name => (name.startsWith('.')
    ? loadTsTree(resolve(dirname(file), name.endsWith('.ts') ? name : `${name}.ts`).slice(resolve(here, '..').length + 1), cache)
    : require(name));
  new Function('require', 'module', 'exports', code)(req, module, module.exports);
  return module.exports;
}

const C = loadTs('src/app/shared/economy/economy-curve.ts');
const V2 = loadTs('src/app/shared/economy/economy-legacy-v2.ts');

// ───────────────────────────────────────────────────────────────────────────
// Economies
// ───────────────────────────────────────────────────────────────────────────

const CURRENT = {
  name: 'CURRENT',
  clickBase: V2.V2_BASE_GOLD_PER_CLICK,
  clickCooldownMs: V2.V2_CLICK_COOLDOWN_MS,
  centuryBonus: V2.V2_CENTURY_BONUS_GOLD, // +10 every 100th strike
  idleFloor: V2.V2_BASE_IDLE_PER_SECOND,
  priceScale: V2.V2_PRICE_SCALE,
  offlineCapS: 8 * 3600,     // economy.service.ts:115 MAX_OFFLINE_SECONDS
  // economy-legacy-v2.ts (was economy.model.ts:343-627)
  buildings: V2.V2_FURNACES.map(([id, cost, rate, free]) => free ? [id, cost, rate, true] : [id, cost, rate]),
  hammers: V2.V2_HAMMERS.map(([id, cost, flat]) => [id, cost, flat, 0]),
  multipliers: V2.V2_MULTIPLIERS.map(row => [...row]),
  autos: V2.V2_AUTOMATONS.map(row => [...row]),
  // explorer/explorer.model.ts:186-290 MISSIONS — one explorer (base slot).
  // Flat payout, no link to income.
  expeditions: [
    { id: 'scout', durS: 120, fee: 0, pay: () => 7_500 },
    { id: 'delve', durS: 600, fee: 500, pay: () => 35_000 },
    { id: 'expedition', durS: 3600, fee: 2_000, pay: () => 200_000 },
    { id: 'deep-dive', durS: 4 * 3600, fee: 10_000, pay: () => 950_000 },
    { id: 'grand', durS: 24 * 3600, fee: 50_000, pay: () => 6_000_000 },
  ],
  // Wandering trader — live/forge-view.component.ts:549-551,1580.
  // Every 90–240 s on the Forge View only, 25 s to take it, pays max(50, 60 s).
  spark: { minS: 90, maxS: 240, catch: 0.5, pay: (gps) => Math.max(50, gps * 60), frenzy: null },
  // prestige — economy.model.ts:1060-1080
  prestige: { threshold: V2.V2_PRESTIGE_GOLD_THRESHOLD, shards: (t) => V2.v2ShardsFor(t) },
  // one-off sinks, for "time until you could first afford it"
  sinks: {
    'rune strike (Common)': 10_000,      // rune-forge/rune.model.ts:157 STRIKE_COST
    'gambler Iron Chest': 5_000,         // gambler/mystery-box.ts:78
    'cheapest craft fee': 4_000,         // crafting/crafting.model.ts:183-396 (uncommon min)
    'vendor regional unit': 6_000,       // vendor/material-vendor.model.ts:67 (v3: the Vendor only buys)
    'Delve fee': 500,                    // explorer.model.ts (delve.cost)
    'reforge Common': 500,               // rpg/item-reforge.ts:76
    'temper +1 (base)': 50_000,          // rpg/item-upgrade.ts:50
    'Thrall (cheapest tier)': 50_000,    // thralls/thrall.model.ts:108
    'respec': 100_000,                   // rpg/player-stats.model.ts:136
    'explorer slot #2': 250_000,         // economy.model.ts:665
    'market explorer hire': 500_000,     // rpg/explorer-archetypes.ts:504
    'Thrall pull': 1_000_000,            // thralls/thrall.model.ts:55 (STRIKE_COST×100)
    'thrall slot #6': 2_000_000,         // economy.model.ts:703
    'epic craft fee (min)': 120_000,     // crafting.model.ts
    'legendary craft fee (min)': 560_000,
    'mythic craft (Eclipse Edge)': 3_200_000,
  },
};

/**
 * PROPOSED — the v3 curve as shipped, built from economy-curve.ts. Cookie-shaped:
 * rungs ~×7-15 apart in price and ×6-8 in rate, so the payback (cost / rate)
 * grows ~×1.5-2 per rung. PRICE_SCALE 1.15.
 */
const SPARK = C.GOLDEN_SPARK;
const MISSION_SECONDS = { scout: 120, delve: 600, expedition: 3600, 'deep-dive': 4 * 3600, grand: 24 * 3600 };
const PROPOSED = {
  name: 'PROPOSED',
  clickBase: C.BASE_GOLD_PER_CLICK,
  clickCooldownMs: C.CLICK_COOLDOWN_MS,
  centuryBonus: 0,           // replaced by "100th strike = N strikes' worth" (scales)
  centuryStrikes: C.CENTURY_STRIKE_MULTIPLIER,
  idleFloor: C.BASE_IDLE_PER_SECOND,
  priceScale: C.PRICE_SCALE,
  offlineCapS: C.MAX_OFFLINE_SECONDS,
  offlineRate: 1,            // unchanged: offline pays full rate (try 0.5 via --offlineRate)
  buildings: C.FURNACE_CURVE.map(r => [r.id, r.baseCost, r.ratePerSecond]),
  // Hammers are SINGLE-PURCHASE (Cookie's click upgrades): flat +strike early,
  // then "+N% of Gold/s per strike" so the Flame never stops mattering.
  singleHammers: true,
  hammers: C.HAMMER_CURVE.map(r => [r.id, r.baseCost, r.goldPerClick, r.incomeShare]),
  multipliers: C.MULTIPLIER_CURVE.map(r => [r.id, r.baseCost, r.bonus]),
  // Automatons strike at the FLAT click value only; they fade later.
  autos: C.AUTOMATON_CURVE.map(r => [r.id, r.baseCost, r.clicksPerSecond]),
  // Payout = max(floor, k × duration × Gold/s at launch).
  expeditions: C.EXPEDITION_CURVE.filter(m => MISSION_SECONDS[m.id]).map(m => {
    const durS = MISSION_SECONDS[m.id];
    return { id: m.id, durS, fee: m.fee, floor: m.floor, k: m.incomeShare, pay: (gps) => Math.max(m.floor, m.incomeShare * durS * gps) };
  }),
  // Golden Spark: sitewide, every minGap-maxGap s while visible, catchS to catch.
  spark: {
    minS: SPARK.minGapS, maxS: SPARK.maxGapS, catch: 0.7,
    pay: (gps, bank) => C.goldenSparkWindfall(gps, bank),
    frenzy: { p: SPARK.frenzyChance, mult: SPARK.frenzyMultiplier, durS: SPARK.frenzyS },
  },
  prestige: { threshold: C.PRESTIGE_GOLD_THRESHOLD, shards: (t) => C.shardsForTotal(t) },
  sinks: {
    'rune strike (Common)': 600,                     // rune.model.ts RUNE_TIERS.common.worth
    'gambler Iron Chest': 300,                       // gambler/mystery-box.ts
    'cheapest craft fee': C.CRAFT_FEE_FLOOR.uncommon,
    'Delve fee': C.EXPEDITION_CURVE.find(m => m.id === 'delve').fee,
    'reforge Common': 150,                           // rpg/item-reforge.ts REFORGE_GOLD
    'temper +1 (base)': 6_000,                       // rpg/item-upgrade.ts DEFAULT_TEMPER_GOLD_BASE
    'Thrall (cheapest tier)': 25_000,                // thralls/thrall.model.ts
    'respec': 20_000,                                // rpg/player-stats.model.ts RESPEC_COST (floor)
    'explorer slot #2': C.EXPLORER_SLOT_COST,
    'market explorer hire': 60_000,                  // rpg/explorer-archetypes.ts MARKET_HIRE_COST
    'Thrall pull': 600 * 100,                        // STRIKE_COST × 100
    'thrall slot #6': C.THRALL_SLOT_COST,
    'epic craft fee (min)': C.CRAFT_FEE_FLOOR.epic,
    'legendary craft fee (min)': C.CRAFT_FEE_FLOOR.legendary,
    'mythic craft (Eclipse Edge)': C.CRAFT_FEE_FLOOR.mythic,
    'home forge tier II': C.HOME_FORGE_PRICES[0],
    'home forge tier III': C.HOME_FORGE_PRICES[1],
    'home forge tier IV': C.HOME_FORGE_PRICES[2],
  },
};

// ───────────────────────────────────────────────────────────────────────────
// Player model
// ───────────────────────────────────────────────────────────────────────────

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));
const ACTIVE_CPS = Number(argv.cps ?? 4);          // click attempts/s, first 5 min
const IDLE_CPM = Number(argv.idleCpm ?? 10);        // clicks/min while tab sits open
const DAYS = Number(argv.days ?? 7);
const EXPEDITIONS = !argv['no-expeditions'];
const POLICY = argv.policy === 'patient' ? 'patient' : 'greedy';
if (argv.offlineRate !== undefined) PROPOSED.offlineRate = Number(argv.offlineRate);

/**
 * A day-one schedule, then a habitual one. Segments: [seconds, mode].
 *  active  — clicking at ACTIVE_CPS, buys every second
 *  open    — tab visible, IDLE_CPM clicks/min, glances at the shop every 2 min
 *  offline — tab closed; settles min(gap, cap) on return
 */
function schedule(days) {
  const s = [
    [5 * 60, 'active'],
    [55 * 60, 'open'],
    [7 * 3600, 'offline'],
    [20 * 60, 'active'],
    [40 * 60, 'open'],
    [4 * 3600, 'offline'],
    [15 * 60, 'active'],
    [45 * 60, 'open'],
    [10 * 3600, 'offline'],
  ]; // = 24 h
  for (let d = 1; d < days; d++) {
    s.push([15 * 60, 'active'], [15 * 60, 'open'], [9.5 * 3600, 'offline'],
      [15 * 60, 'active'], [45 * 60, 'open'], [4 * 3600, 'offline'],
      [10 * 60, 'active'], [50 * 60, 'open'], [8 * 3600, 'offline']); // = 24 h
  }
  return s;
}

// mulberry32
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Engine
// ───────────────────────────────────────────────────────────────────────────

function makeState(E) {
  return { owned: {}, bank: 0, total: 0, t: 0, frenzyUntil: -1 };
}
const lvl = (S, id) => S.owned[id] ?? 0;
function costOf(E, def, S, kind) {
  const [id, base, , free] = def;
  const n = lvl(S, id);
  if (kind === 'b' && free === true && n === 0) return 0;
  return Math.ceil(base * Math.pow(E.priceScale, n));
}
function mult(E, S) {
  let m = 1;
  for (const [id, , b] of E.multipliers) if (lvl(S, id)) m += b;
  return m;
}
function idleRaw(E, S) {
  let r = E.idleFloor;
  for (const [id, , rate] of E.buildings) r += rate * lvl(S, id);
  return r;
}
/**
 * "% of Gold/s per strike" — granted once by owning >= 1 level of the rung
 * (Cookie's mouse upgrades), never per level: a per-level share compounds into
 * a click that outgrows the furnace, which the first sim run showed (11T/s @1h).
 */
function shareOfRate(E, S) {
  let s = 0;
  for (const [id, , , share] of E.hammers) if (share && lvl(S, id)) s += share;
  return s;
}
/** Flat strike value before shared multipliers (baseGoldPerClick). Automatons pay this. */
function baseClick(E, S) {
  let c = E.clickBase;
  for (const [id, , flat] of E.hammers) c += flat * lvl(S, id);
  return c;
}
/** A hand strike: flat + a share of the furnace rate. Automatons do not get the share. */
function handClick(E, S) {
  return baseClick(E, S) + shareOfRate(E, S) * idleRaw(E, S);
}
function autoCps(E, S) {
  let r = 0;
  for (const [id, , cps] of E.autos) r += cps * lvl(S, id);
  return r;
}
function frenzy(E, S) { return S.t < S.frenzyUntil ? E.spark.frenzy.mult : 1; }
/** Gold/s from furnaces + automatons, multiplied (goldBreakdown.total). */
function gps(E, S) {
  return (idleRaw(E, S) + autoCps(E, S) * baseClick(E, S)) * mult(E, S) * frenzy(E, S);
}
function clickValue(E, S) {
  return handClick(E, S) * mult(E, S) * frenzy(E, S);
}
function effectiveCps(E, attempts) {
  return Math.min(attempts, 1000 / E.clickCooldownMs);
}
function expeditionRate(E, S) {
  if (!EXPEDITIONS) return 0;
  const m = E.expeditions[0];
  return (typeof m.pay === 'function' ? m.pay(gps(E, S)) : 0) / m.durS;
}
function income(E, S, cps) {
  const centuryBoost = E.centuryStrikes ? 1 + (E.centuryStrikes - 1) / 100 : 1;
  return gps(E, S) + cps * clickValue(E, S) * centuryBoost + cps * E.centuryBonus / 100;
}

function candidates(E) {
  return [
    ...E.buildings.map(d => ({ kind: 'b', def: d })),
    ...E.hammers.map(d => ({ kind: 'h', def: d })),
    ...E.multipliers.map(d => ({ kind: 'm', def: d })),
    ...E.autos.map(d => ({ kind: 'a', def: d })),
  ];
}

function bestPurchase(E, S, cps) {
  const now = income(E, S, cps) + expeditionRate(E, S);
  let best = null;
  for (const c of candidates(E)) {
    const id = c.def[0];
    if ((c.kind === 'm' || (c.kind === 'h' && E.singleHammers)) && lvl(S, id)) continue;
    const cost = costOf(E, c.def, S, c.kind);
    S.owned[id] = lvl(S, id) + 1;
    const after = income(E, S, cps) + expeditionRate(E, S);
    S.owned[id] -= 1;
    const gain = after - now;
    if (gain <= 0) continue;
    // greedy (the brief's player): only what is affordable now, best Gold per Δincome.
    // patient: also weighs saving up — (seconds to afford) + payback.
    if (POLICY === 'greedy' && cost > S.bank) continue;
    const wait = Math.max(0, cost - S.bank) / Math.max(now, 1e-9);
    const score = (POLICY === 'greedy' ? 0 : wait) + cost / gain;
    if (!best || score < best.score) best = { ...c, id, cost, score, gain };
  }
  return best;
}

function simulate(E, seed = 7) {
  const R = rng(seed);
  const S = makeState(E);
  const log = { buys: [], milestones: {}, at: {}, sinks: {}, sparkGold: 0, expGold: 0, offlineGold: 0, trace: [] };
  const sinkNames = Object.keys(E.sinks);
  let nextSpark = E.spark.minS + R() * (E.spark.maxS - E.spark.minS);
  let exp = null; // { endsAt, pay }
  let clickDebt = 0;
  const checkpoints = [60, 5 * 60, 10 * 60, 30 * 60, 3600, 3 * 3600, 86400, 3 * 86400, 7 * 86400, 14 * 86400, 30 * 86400];
  let cp = 0;

  const earn = (g, src) => { S.bank += g; S.total += g; if (src) log[src] += g; };
  const record = () => {
    // All-time Gold over time, for --place. A point when it has grown 1% or more.
    const lastTrace = log.trace[log.trace.length - 1];
    if (!lastTrace || S.total >= lastTrace[1] * 1.01 + 1) log.trace.push([S.t, S.total]);
    while (cp < checkpoints.length && S.t >= checkpoints[cp]) {
      log.at[checkpoints[cp]] = { gps: gps(E, S), bank: S.bank, total: S.total, buys: log.buys.length };
      cp++;
    }
    for (const n of sinkNames) {
      // "could first afford": banked it, or it is under a minute of income
      if (log.sinks[n] === undefined && (S.bank >= E.sinks[n] || gps(E, S) * 60 >= E.sinks[n])) {
        log.sinks[n] = S.t;
      }
    }
    if (log.milestones.prestige === undefined && S.total >= E.prestige.threshold) log.milestones.prestige = S.t;
  };
  const tryBuy = (cps) => {
    for (let guard = 0; guard < 500; guard++) {
      const b = bestPurchase(E, S, cps);
      if (!b || b.cost > S.bank) return;
      S.bank -= b.cost;
      S.owned[b.id] = lvl(S, b.id) + 1;
      log.buys.push({ t: S.t, id: b.id, cost: b.cost, paid: b.cost > 0 });
    }
  };
  const launchExp = () => {
    if (!EXPEDITIONS || exp) return;
    // Pick the longest mission whose fee costs < 2% of bank-or-minute and fits the next gap
    const m = E.expeditions[0];
    exp = { endsAt: S.t + m.durS, pay: m.pay(gps(E, S)) };
  };

  for (const [dur, mode] of schedule(DAYS)) {
    if (mode === 'offline') {
      const paid = Math.min(dur, E.offlineCapS) * gps(E, S) * (E.offlineRate ?? 1);
      S.t += dur;
      earn(paid, 'offlineGold');
      if (exp && exp.endsAt <= S.t) { earn(exp.pay, 'expGold'); exp = null; }
      record();
      tryBuy(0);
      continue;
    }
    const cps = mode === 'active' ? effectiveCps(E, ACTIVE_CPS) : effectiveCps(E, IDLE_CPM / 60);
    const glance = mode === 'active' ? 1 : 120;
    for (let s = 0; s < dur; s++) {
      S.t += 1;
      earn(gps(E, S), null);
      clickDebt += cps;
      while (clickDebt >= 1) {
        clickDebt -= 1;
        S._strikes = (S._strikes ?? 0) + 1;
        let v = clickValue(E, S);
        if (S._strikes % 100 === 0) v = E.centuryStrikes ? v * E.centuryStrikes : v + E.centuryBonus;
        earn(v, null);
      }
      if (exp && exp.endsAt <= S.t) { earn(exp.pay, 'expGold'); exp = null; }
      launchExp();
      if (S.t >= nextSpark) {
        nextSpark = S.t + E.spark.minS + R() * (E.spark.maxS - E.spark.minS);
        if (R() < E.spark.catch) {
          if (E.spark.frenzy && R() < E.spark.frenzy.p) S.frenzyUntil = S.t + E.spark.frenzy.durS;
          else earn(E.spark.pay(gps(E, S), S.bank), 'sparkGold');
        }
      }
      if (s % glance === 0) tryBuy(cps);
      record();
    }
  }
  return { S, log };
}

// ───────────────────────────────────────────────────────────────────────────
// Report
// ───────────────────────────────────────────────────────────────────────────

const fmtT = (s) => {
  if (s === undefined) return 'never';
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)}d`;
};
const fmtN = (n) => {
  if (n === undefined || !Number.isFinite(n)) return '-';
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  if (a >= 100) return n.toFixed(0);
  return n.toFixed(2);
};

function report(E) {
  const { S, log } = simulate(E);
  const paid = log.buys.filter(b => b.paid);
  const first10 = paid.filter(b => b.t <= 600);
  const gaps = [];
  let prev = 0;
  for (const b of first10) { gaps.push(b.t - prev); prev = b.t; }
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : undefined;
  const out = [];
  out.push(`== ${E.name} ==  (active ${ACTIVE_CPS} clicks/s → effective ${effectiveCps(E, ACTIVE_CPS)}/s; open-tab ${IDLE_CPM}/min; expeditions ${EXPEDITIONS ? 'on (Scout loop)' : 'off'})`);
  out.push(`  first paid purchase ............ ${fmtT(paid[0]?.t)}  (${paid[0]?.id ?? '-'})`);
  const firstRung = log.buys.find(b => E.buildings.some(d => d[0] === b.id));
  out.push(`  first furnace rung owned ........ ${fmtT(firstRung?.t)}  (${firstRung?.id ?? '-'}${firstRung && !firstRung.paid ? ', free' : ''})`);
  const free = log.buys.find(b => !b.paid);
  if (free) out.push(`  (free first rung taken at ${fmtT(free.t)}: ${free.id})`);
  out.push(`  paid purchases in first 10 min . ${first10.length}  (median gap ${fmtT(median)}, longest gap ${fmtT(sorted.at(-1))})`);
  out.push(`  first 10 min order ............. ${first10.slice(0, 14).map(b => `${b.id.split('-')[0]}@${fmtT(b.t)}`).join(' ') || '-'}`);
  // "A NEW thing": the first level of an item never owned before (Cookie's
  // cadence is about new rungs/upgrades appearing, not the 40th Cursor).
  const seen = new Set();
  const firsts = log.buys.filter(b => !seen.has(b.id) && seen.add(b.id));
  const newIn = (a, z) => firsts.filter(b => b.t > a && b.t <= z);
  const ng = []; let p0 = 0;
  for (const b of newIn(-1, 600)) { ng.push(b.t - p0); p0 = b.t; }
  out.push(`  NEW items unlocked: 10m ${newIn(-1, 600).length} (longest wait ${fmtT(Math.max(0, ...ng))}) | 10m–1h ${newIn(600, 3600).length} | 1h–1d ${newIn(3600, 86400).length} | after 1d ${newIn(86400, Infinity).length} of ${candidates(E).length}`);
  out.push(`    ${newIn(-1, 3600).map(b => `${b.id}@${fmtT(b.t)}`).join(', ')}`);
  out.push(`  Gold/s  1m ${fmtN(log.at[60]?.gps)} | 10m ${fmtN(log.at[600]?.gps)} | 1h ${fmtN(log.at[3600]?.gps)} | 1d ${fmtN(log.at[86400]?.gps)} | 3d ${fmtN(log.at[3 * 86400]?.gps)} | 7d ${fmtN(log.at[7 * 86400]?.gps)}${DAYS >= 30 ? ` | 30d ${fmtN(log.at[30 * 86400]?.gps)}` : ''}`);
  out.push(`  all-time Gold 1h ${fmtN(log.at[3600]?.total)} | 1d ${fmtN(log.at[86400]?.total)} | 7d ${fmtN(log.at[7 * 86400]?.total)}  · upgrades owned at 1d: ${log.at[86400]?.buys ?? '-'}`);
  out.push(`  first Eclipse threshold (${fmtN(E.prestige.threshold)}) ... ${fmtT(log.milestones.prestige)}  · shards on offer at end: ${E.prestige.shards(S.total)}`);
  const share = (k) => `${((log[k] / S.total) * 100).toFixed(1)}%`;
  out.push(`  income mix: expeditions ${share('expGold')} · offline ${share('offlineGold')} · sparks ${share('sparkGold')} · rest live`);
  out.push(`  first affordable (banked, or ≤ 60 s of income):`);
  for (const [n, c] of Object.entries(E.sinks)) {
    out.push(`    ${n.padEnd(30, '.')} ${fmtN(c).padStart(7)}  → ${fmtT(log.sinks[n])}`);
  }
  if (argv.debug) out.push('  owned: ' + JSON.stringify(S.owned));
  return out.join('\n');
}

function stageTable(E) {
  const { log } = simulate(E);
  const rows = [['time', 'Gold/s', 'all-time Gold']];
  for (const [t, v] of Object.entries(log.at)) rows.push([fmtT(Number(t)), fmtN(v.gps), fmtN(v.total)]);
  return rows.map(r => '  ' + r.map((c, i) => String(c).padEnd(i ? 14 : 6)).join(' ')).join('\n');
}

/** CI smoke: the v3 opening must feel like Cookie Clicker. */
function check(E) {
  const { log } = simulate(E);
  const paid = log.buys.filter(b => b.paid);
  const first = paid[0]?.t;
  const inTen = paid.filter(b => b.t <= 600).length;
  const fails = [];
  if (!(first <= 15)) fails.push(`first purchase at ${fmtT(first)} (must be <= 15 s)`);
  if (inTen < 20) fails.push(`${inTen} purchases in the first 10 min (must be >= 20)`);
  console.log(`economy-sim --check (${E.name}): first purchase ${fmtT(first)}, ${inTen} purchases in 10 min`);
  // The Mirror Slate (Lune Coyne's shortcut price, rule S): 1-10 minutes of income at the half-hour stage.
  {
    const gps = log.at[1800]?.gps ?? 0;
    const minutes = gps > 0 ? C.MIRROR_SLATE.price / gps / 60 : Infinity;
    console.log(`  Mirror Slate: ${fmtN(C.MIRROR_SLATE.price)} Gold = ${minutes.toFixed(1)} min of income at 30m; earned free after ${C.MIRROR_SLATE.awardPlays} plays`);
    if (!(minutes >= 1 && minutes <= 10)) fails.push(`Mirror Slate price is ${minutes.toFixed(1)} min of income at 30m (must be 1-10)`);
  }
  // The Reels: RTP band and bet caps (a quick proof; --reels runs the full one).
  fails.push(...reelsScenario({ rounds: 300_000, plays: 0, quiet: true }));
  // Fishing (Phase 6): Gold share, crate values, rod gates and the 99 band (`--fishing` prints the table).
  fails.push(...fishingScenario({ quiet: true }));
  // The Underhearth (Phase 8): rule I rewards, the furnace is no farm, tool V on the ladder (`--underhearth` prints it).
  fails.push(...underhearthScenario({ quiet: true }));
  // The Board Herald's daily bounties (Phase 7.5): rule I band, the daily envelope, XP, the draw (`--bounties` prints it).
  fails.push(...bountiesScenario({ quiet: true }));
  // Uncapped levels: 1-99 untouched, 99 -> 100 continuous, time to 300 per skill (`--levels` prints it).
  fails.push(...levelsScenario({ quiet: true }));
  // The high roads (surface height): once-only caches and summits on the rule I bands (`--heights` prints them).
  fails.push(...heightsScenario({ quiet: true }));
  // The pets (shared/pets): small helpers, never a Gold strategy (`--pets` prints it).
  fails.push(...petsScenario({ quiet: true }));
  // The Lost Cabinets (shared/cabinets): once-only Gold on the rule I bands (`--cabinets` prints it).
  fails.push(...cabinetsScenario({ quiet: true }));
  // The Living World (play/engine/living-world.ts): finds, catches and the day's mysteries stay a side line (`--living`).
  fails.push(...livingScenario({ quiet: true }));
  // Sera Quill's Eclipse Ledger (shared/world-clock): per-eclipse tips and once-only marks (`--eclipse` prints it).
  fails.push(...eclipseScenario({ quiet: true }));
  // Rune Drop, Seam Sweeper, Eclipse Ascent: exact proofs + a quick simulation each.
  fails.push(...plinkoScenario({ plays: 200_000, quiet: true }));
  fails.push(...minesScenario({ rounds: 400_000, quiet: true }));
  fails.push(...crashScenario({ rounds: 400_000, quiet: true }));
  if (fails.length) {
    for (const f of fails) console.error(`  FAIL ${f}`);
    process.exit(1);
  }
  console.log('  ok');
}

/** When the all-time total first reached `n` (linear between trace points). */
function timeToTotal(trace, n) {
  for (let i = 0; i < trace.length; i++) {
    const [t, total] = trace[i];
    if (total >= n) {
      if (i === 0) return t;
      const [t0, g0] = trace[i - 1];
      return t0 + (t - t0) * (n - g0) / Math.max(1e-9, total - g0);
    }
  }
  return undefined;
}
/** The all-time total at time `t`. */
function totalAt(trace, t) {
  let last = 0;
  for (const [tt, total] of trace) { if (tt > t) break; last = total; }
  return last;
}

/**
 * --place=100000,1000000,...: for each v2 all-time Gold target, when the v2
 * player reached it and what the v3 player has banked all-time by then — the
 * v3 target that keeps the same wall-clock pacing from a fresh start.
 */
function place(targets) {
  const cur = simulate(CURRENT).log.trace;
  const pro = simulate(PROPOSED).log.trace;
  console.log('v2 target -> reached at -> v3 all-time Gold then');
  for (const n of targets) {
    const t = timeToTotal(cur, n);
    console.log(`  ${fmtN(n).padStart(8)} -> ${fmtT(t).padStart(7)} -> ${t === undefined ? '-' : fmtN(totalAt(pro, t))}`);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// --inventory: satchel rows + Vault tabs on the v3 curve, and how fast rune
// finds fill a bag (docs/inventory/inventory-spec.md §1 and §3).
// ───────────────────────────────────────────────────────────────────────────

/** Storage prices, read from economy-curve.ts STORAGE_CURVE (inventory spec §3). */
const TAB_LABELS = { materials: 'Materials tab', supplies: 'Supplies tab', gear: 'Gear tab',
  'general-2': 'General tab II', 'general-3': 'General tab III', 'general-4': 'General tab IV' };
const STORAGE_PRICES = [
  ...C.STORAGE_CURVE.satchelRows.map((c, i) => [`satchel row ${i + 1} (${41 + 8 * i}-${48 + 8 * i})`, c]),
  ...Object.entries(C.STORAGE_CURVE.tabs).map(([id, c]) => [`Vault: ${TAB_LABELS[id] ?? id}`, c]),
];

function inventoryScenario(E) {
  const sinks = { ...E.sinks };
  E.sinks = Object.fromEntries(STORAGE_PRICES);
  const { log } = simulate(E);
  E.sinks = sinks;
  const stages = [[1800, '30m'], [3600, '1h'], [86400, '1d'], [3 * 86400, '3d'], [7 * 86400, '7d']];
  console.log(`Inventory scenario · ${DAYS} day(s) · v3 curve (PROPOSED)\n`);
  console.log('Storage prices: first affordable (banked, or <= 60 s of income) and seconds of income at each stage');
  console.log('  ' + 'purchase'.padEnd(26) + 'price'.padStart(8) + '  first'.padEnd(10) + stages.map(([, l]) => l.padStart(9)).join(''));
  for (const [n, c] of STORAGE_PRICES) {
    const secs = stages.map(([t]) => {
      const g = log.at[t]?.gps;
      if (!g) return '-'.padStart(9);
      const s = c / g;
      return (s < 1 ? '<1s' : fmtT(s)).padStart(9);
    });
    console.log('  ' + n.padEnd(26) + fmtN(c).padStart(8) + '  ' + fmtT(log.sinks[n]).padEnd(8) + secs.join(''));
  }

  // Rune finds. Before slice S2 every find (strike or expedition) minted one
  // empty-stat "<Rune> Sigil" record (or a charm at 0.24%), and at 250 records
  // the bag deleted the cheapest thing in it. Sigil items are gone now: a find
  // is a count in the Rune Forge ledger, and only the charms are records.
  // A session = one 'active' segment of the sim's schedule; strikes per
  // session are the Strike ×10 / ×100 / ×1000 buttons (rune-reel.ts BULK_ROLLS).
  const CHARM = 0.0024;
  const sessions = schedule(DAYS).filter(([, m]) => m === 'active').length;
  const profiles = [['light (x10 a session)', 10], ['typical (x100)', 100], ['heavy (x1000)', 1000], ['grinder (x1000 x5)', 5000]];
  const CAP = 250; // the retired INVENTORY_BAG_CAP
  console.log(`\nRune finds over ${DAYS} day(s) (${sessions} active sessions)`);
  console.log('  ' + 'profile'.padEnd(24) + 'finds'.padStart(9) + 'charms'.padStart(8) + '  | pre-S2: rows / evicted'.padEnd(27) + '| now: records added');
  for (const [label, perSession] of profiles) {
    const finds = sessions * perSession;
    const charms = Math.round(finds * CHARM);
    console.log('  ' + label.padEnd(24) + String(finds).padStart(9) + String(charms).padStart(8)
      + `  | ${Math.min(CAP, finds)} / ${Math.max(0, finds - CAP)}`.padEnd(27) + `| ${charms} (charms only)`);
  }
  console.log('\n  "evicted" = records the old 250-row cap tombstoned (lowest sell value first, so gear went');
  console.log('  before sigils). Now nothing is evicted, and a rune find adds no record.');
}

// ───────────────────────────────────────────────────────────────────────────
// --reels: the Croupier's Reels (src/app/shared/reels/reels.model.ts) and the
// shared bet ladder (economy-curve GAMES_BET). Gold only; a sink.
//   RTP proof: exact base lines + scatter + trigger, the Eclipse Round
//   simulated `rounds` times, prizes priced exactly per stake; then whole
//   plays on the shared harness (games/rtp-sim.ts) as a cross-check.
// ───────────────────────────────────────────────────────────────────────────

const RTP_BAND = [0.92, 0.94];

function reelsScenario({ rounds, plays, quiet }) {
  const R = loadTsTree('src/app/shared/reels/reels.model.ts');
  const G = loadTsTree('src/app/shared/games/rtp-sim.ts');
  const rng = loadTsTree('src/app/shared/games/seeded-rng.ts');
  const fails = [];
  const pct = x => `${(x * 100).toFixed(2)}%`;

  const th = R.reelsTheory(rng.seededRng('economy-sim:reels'), rounds);
  const stakes = [10, 100, 1_000, 100_000, 1e9];
  const totals = stakes.map(b => [b, th.goldRtp + R.prizeRtp(b, th)]);
  if (!quiet) {
    console.log(`Reels · RTP proof (${fmtN(rounds)} simulated Eclipse Rounds)\n`);
    console.log(`  base lines        ${pct(th.baseLines)}   (exact)`);
    console.log(`  Eclipse scatter   ${pct(th.scatter)}   (exact)`);
    console.log(`  Eclipse Round     1 in ${(1 / th.trigger).toFixed(1)} plays (exact), pays ${th.roundMean.toFixed(2)}× bet on average (sd ${th.roundSd.toFixed(1)}), ${th.roundSpins.toFixed(2)} free spins`);
    console.log(`  Gold RTP          ${pct(th.goldRtp)} ± ${pct(th.goldRtpSe)} (1 s.e.)   stated: ${pct(R.REELS_STATS.goldRtp)}`);
    console.log('  with prizes       ' + totals.map(([b, t]) => `${fmtN(b)}: ${pct(t)}`).join(' · '));
    console.log(`  a 1e6-play measurement has sd ${pct(th.sdOf1e6)}`);
  }
  if (Math.abs(th.goldRtp - R.REELS_STATS.goldRtp) > 0.005) fails.push(`Gold RTP ${pct(th.goldRtp)} drifted from the stated ${pct(R.REELS_STATS.goldRtp)}`);
  for (const [b, t] of totals) if (t < RTP_BAND[0] || t > RTP_BAND[1]) fails.push(`RTP at bet ${b} is ${pct(t)}, outside ${pct(RTP_BAND[0])}–${pct(RTP_BAND[1])}`);
  if (R.MAX_WIN_X > 10_000) fails.push('max win above ×10,000');

  if (plays) {
    const rep = G.simulateRtp({ play: R.playReels, value: R.reelsReturn,
      tags: (o, b) => [o.bonus && 'bonus', G.winTier(o.win, b)].filter(Boolean) }, plays, 100, 'economy-sim:plays');
    const oneIn = k => (rep.tags[k] ? `1 in ${(plays / rep.tags[k]).toFixed(0)}` : '-');
    if (!quiet) {
      console.log(`\n  ${fmtN(plays)} whole plays at bet 100: RTP ${pct(rep.rtp)}, hit 1 in ${(1 / rep.hitRate).toFixed(2)}, round ${oneIn('bonus')}, Big ${oneIn('big')}, Mega ${oneIn('mega')}, Eclipse Win ${oneIn('eclipse')}, max ×${fmtN(rep.maxX)}`);
    }
    if (Math.abs(rep.rtp - R.REELS_STATS.rtp) > 0.01) fails.push(`${plays} plays returned ${pct(rep.rtp)}, more than 1 point from ${pct(R.REELS_STATS.rtp)}`);
  }

  // Bet ladder against the curve: the first bet within minutes, and the cap
  // never more than two minutes of income past the floor.
  const { log } = simulate(PROPOSED);
  const stages = [[60, '1m'], [300, '5m'], [1800, '30m'], [3600, '1h'], [86400, '1d'], [7 * 86400, '7d']];
  if (!quiet) console.log('\n  Bet cap (two minutes of income, floor 50):  ' + stages.map(([t, l]) => `${l}: ${fmtN(C.gamesBetCap(log.at[t]?.gps ?? 0))}`).join(' · '));
  const minBet = C.GAMES_BET.min;
  const bankAt = t => log.trace.filter(([tt]) => tt <= t).map(([, total]) => total).pop() ?? 0;
  if (!(bankAt(120) >= minBet)) fails.push(`the first ${minBet}-Gold bet is not affordable by 2 min`);
  for (const [t] of stages) {
    const gps = log.at[t]?.gps ?? 0;
    const cap = C.gamesBetCap(gps);
    if (cap > Math.max(C.GAMES_BET.floorCap, C.GAMES_BET.incomeSeconds * gps)) fails.push(`cap ${cap} above two minutes of income at ${t}s`);
  }

  console.log(`economy-sim reels: Gold RTP ${pct(th.goldRtp)}, total ${pct(totals[0][1])}–${pct(totals[totals.length - 1][1])} across stakes`);
  return fails;
}

// ───────────────────────────────────────────────────────────────────────────
// --fishing: Fishing v1 on the v3 curve (docs/world/delve-and-beyond.md §5.7).
// Fishing is a materials, XP and discovery loop, not a Gold strategy. Per stage
// of the simulation: catches a minute by level and rod (actively at the Good
// grade, auto at Off), fish and crates sold at the vendor floor, the Merchant's
// standing fish order, the daily Ledger Catch (reported; a daily, not a rate),
// and the rods' gates. `--check` runs the four checks; CI's --check includes it.
// ───────────────────────────────────────────────────────────────────────────

const FISH = loadTsTree('src/app/shared/fishing/fishing.model.ts');
/** Seconds of a cast that are not the bite wait: the hook reaction, the reel (or auto's instant land), the recast. */
const CAST_OVERHEAD = { active: .3 + 2.8 + 1, auto: .6 + 2.8 + .6 };
/** The Merchant's standing fish order (delve-missions.model `fish-merchant-order`), read from the source text. */
function merchantOrder() {
  const text = readFileSync(resolve(here, '../src/app/shared/npc/delve-missions.model.ts'), 'utf8');
  const block = text.slice(text.indexOf("id: 'fish-merchant-order'"), text.indexOf("id: 'fish-merchant-debt'"));
  const items = [...block.matchAll(/materialId: '([a-z-]+)', count: (\d+)/g)].map(m => [m[1], Number(m[2])]);
  const seconds = Number((/goldSeconds: (\d+)/.exec(block) || [])[1] ?? 0);
  const floor = Number((/itemScaled\(([\d_]+)\)/.exec(block) || [])[1]?.replace(/_/g, '') ?? 0) * C.ITEM_ECONOMY_SCALE;
  return { items, seconds, floor };
}
/** Each rod's recipe gate (crafting.model FISHING_RECIPES), read from the source text: { gold, level, skill }. */
function rodRecipe(id) {
  const text = readFileSync(resolve(here, '../src/app/shared/crafting/crafting.model.ts'), 'utf8');
  const at = text.indexOf(`'${id}', [`) >= 0 ? text.indexOf(`'${id}', [`) : text.indexOf(`, '${id}',\n`);
  const tail = text.slice(at, at + 600);
  const m = /\]\s*,\s*\n?\s*([\d_]+),\s*(\d+),/.exec(tail);
  const skill = (/skill: '([a-z]+)'/.exec(tail.slice(0, tail.indexOf('}),') + 3)) || [])[1];
  return m ? { gold: Number(m[1].replace(/_/g, '')), level: Number(m[2]), skill } : null;
}
const xpFor = L => Math.floor(100 * Math.pow(Math.max(0, L - 1), 2.2));
const buyback = anchor => Math.max(1, Math.floor(Math.round(anchor * C.ITEM_ECONOMY_SCALE) * C.VENDOR_BUYBACK_FRACTION) - 1);
const anchorOf = id => FISH.catchById(id)?.anchor ?? ({ 'world-root-bark': 1500, thornroot: 1400, 'ember-grub': 200, 'cinder-ore': 420, torch: 300, 'slag-fragment': 260, 'ember-residue': 1800 })[id] ?? 300;

/** The best rod and bait at a Fishing level, and what a minute of fishing gives in one water. */
function fishingRate(level, water, mode) {
  const held = id => FISH.RODS.some(r => r.id === id && r.level <= level) ? 1 : 0;
  const rod = FISH.rodFor(held, level);
  if (!rod || !rod.works.liquids.includes(FISH.WATERS[water].liquid)) return null;
  // Bait a fisher of that level keeps: Shadow-Root Cuttings from 10, Ember Grubs before.
  const bait = level >= 10 ? .35 : .1;
  const perks = FISH.fishingPerks(level);
  const bite = rod.works.bite * (1 + bait) * perks.bite;
  const seconds = 6 / bite + CAST_OVERHEAD[mode];
  const perMin = 60 / seconds;
  const grade = mode === 'active' ? 'good' : 'off';
  const table = FISH.catchTable({ water, bait, cratePerk: perks.crate });
  let xp = 0, gold = 0;
  const per = {};
  for (const row of table) {
    xp += row.p * FISH.catchXp(water, row.rarity, grade);
    const value = row.rarity === 'crate'
      ? FISH.crateExpectedAnchor(row.id, anchorOf) * C.ITEM_ECONOMY_SCALE * C.VENDOR_BUYBACK_FRACTION
      : buyback(row.p ? anchorOf(row.id) : 0);
    gold += row.p * value;
    per[row.id] = (per[row.id] ?? 0) + row.p * perMin * (1 + perks.double);
  }
  return { perMin, xpMin: xp * perMin, goldMin: gold * perMin, per, crateP: table.filter(r => r.rarity === 'crate').reduce((s, r) => s + r.p, 0), table };
}

// ───────────────────────────────────────────────────────────────────────────
// Uncapped levels, Tibia-style (docs/handoff/uncapped-levels.md)
// ───────────────────────────────────────────────────────────────────────────
// The real curve (mining-level.ts) and each skill's best XP a minute at level
// 99, read from the source: a gathering site pays its top tier's XP once per
// recovery (the level cut stops at 36, so 99 and 300 recover alike), Fishing
// is the scenario above at its best water. The five skills with no per-minute
// model of their own (Woodcutting, Smithing, Delving, Enchanting, Hunting)
// are shown at the median of the four measured rates, marked ≈. Rates do not
// rise past 99 — the per-minute caps stay — so every hour below is the curve
// alone.
const CURVE = loadTs('src/app/shared/activity/mining-level.ts');
const MINE = loadTsTree('src/app/shared/activity/activity.model.ts');
const RECOVERY = loadTsTree('src/app/shared/activity/mining-recovery.ts');
const FORAGE = loadTsTree('src/app/shared/activity/foraging.model.ts');
const PROSPECT = loadTsTree('src/app/shared/activity/prospecting.model.ts');

function levelsScenario({ quiet = false } = {}) {
  const fails = [];
  const say = line => { if (!quiet) console.log(line); };
  const best = tiers => Math.max(...tiers.map(t => t.xpPerAction));
  // A level-99 site recovers like a level-36 one: 35% off the 2.5 s base (mining-recovery.ts, foraging-ops.ts).
  const siteMs = RECOVERY.effectiveMiningRecoveryMs(99, 0);
  const fishMin = Math.max(...['seep', 'mere', 'magma'].map(w => fishingRate(99, w, 'active')?.xpMin ?? 0));
  const measured = {
    mining: best(MINE.MINING_TIERS) * 60_000 / siteMs,
    foraging: best(FORAGE.FORAGING_TIERS) * 60_000 / siteMs,
    prospecting: best(PROSPECT.PROSPECTING_TIERS) * 60_000 / PROSPECT.PROSPECTING_RECOVERY_MS,
    fishing: fishMin,
  };
  const sorted = Object.values(measured).sort((a, b) => a - b);
  const median = (sorted[1] + sorted[2]) / 2;
  const skills = ['mining', 'foraging', 'woodcutting', 'smithing', 'delving', 'enchanting', 'hunting', 'prospecting', 'fishing'];
  const targets = [100, 150, 200, 300];
  const hoursFrom99 = (rate, L) => (CURVE.xpForLevel(L) - CURVE.xpForLevel(99)) / rate / 60;
  const fmtH = h => h < 10 ? h.toFixed(1) + ' h' : h < 1000 ? Math.round(h) + ' h' : (h / 1000).toFixed(1) + 'k h';

  say('Uncapped levels · xp(L) = xp(99) + floor(53,607 · (S(L) − S(99)) / 99²), S(n) = Σk² (k ≤ n)');
  say(`  XP to reach:  99 ${fmtN(CURVE.xpForLevel(99))} · 100 ${fmtN(CURVE.xpForLevel(100))} · 150 ${fmtN(CURVE.xpForLevel(150))} · 200 ${fmtN(CURVE.xpForLevel(200))} · 300 ${fmtN(CURVE.xpForLevel(300))}`);
  say(`  one level at:  99 ${fmtN(CURVE.MASTERY_STEP)} · 150 ${fmtN(CURVE.xpForLevel(150) - CURVE.xpForLevel(149))} · 200 ${fmtN(CURVE.xpForLevel(200) - CURVE.xpForLevel(199))} · 300 ${fmtN(CURVE.xpForLevel(300) - CURVE.xpForLevel(299))}\n`);
  say('  active hours past 99, at the best rate a level-99 Keeper has (rates are capped: 300 earns what 99 earns)');
  say('  ' + 'skill'.padEnd(13) + 'XP/min'.padStart(8) + targets.map(L => `→${L}`.padStart(10)).join(''));
  for (const skill of skills) {
    const rate = measured[skill] ?? median;
    const mark = measured[skill] ? ' ' : '≈';
    say('  ' + skill.padEnd(13) + (mark + Math.round(rate)).padStart(8) + targets.map(L => fmtH(hoursFrom99(rate, L)).padStart(10)).join(''));
  }

  // 1. Levels 1-99 cost exactly what they always did (the sim's own copy of the old formula).
  for (let L = 1; L <= 99; L++) if (CURVE.xpForLevel(L) !== xpFor(L)) { fails.push(`level ${L} moved: ${CURVE.xpForLevel(L)} vs ${xpFor(L)}`); break; }
  // 2. 99 -> 100 is continuous: within 3% of the 98 -> 99 step, and under 5 hours at the slowest measured rate (Fishing).
  const step100 = CURVE.xpForLevel(100) - CURVE.xpForLevel(99);
  if (!(step100 / CURVE.MASTERY_STEP < 1.03)) fails.push(`99 -> 100 costs ${step100} (> 3% over the step to 99)`);
  const slowest = sorted[0];
  if (hoursFrom99(slowest, 100) > 5) fails.push(`99 -> 100 takes ${hoursFrom99(slowest, 100).toFixed(1)} h at ${Math.round(slowest)} XP/min`);
  // 3. The long climb is long but finite: 300 lands between 500 and 5,000 active hours at the fastest measured rate.
  const h300 = hoursFrom99(sorted[3], 300);
  if (h300 < 500 || h300 > 5000) fails.push(`300 takes ${Math.round(h300)} h at the fastest rate (band 500-5,000)`);
  if (quiet) console.log(`economy-sim levels: 99->100 ${fmtH(hoursFrom99(median, 100))}, ->300 ${fmtH(hoursFrom99(median, 300))} at ${Math.round(median)} XP/min; ${fails.length ? fails.length + ' fail(s)' : 'curve ok'}`);
  return fails;
}

function fishingScenario({ quiet = false } = {}) {
  const fails = [];
  const { log } = simulate(PROPOSED);
  const say = (...a) => { if (!quiet) console.log(...a); };
  const order = merchantOrder();
  say(`Fishing scenario · v3 curve (PROPOSED) · order ${order.items.map(([id, n]) => `${n} ${id}`).join(' + ')} for max(${order.floor}, ${order.seconds} s of income)\n`);
  const stages = [[600, '10m', 5], [1800, '30m', 8], [3600, '1h', 12], [3 * 3600, '3h', 20], [86400, '1d', 30], [3 * 86400, '3d', 45], [7 * 86400, '7d', 60], [14 * 86400, '14d', 80], [30 * 86400, '30d', 99]];
  say('  ' + 'stage'.padEnd(6) + 'Fish'.padStart(5) + 'forge G/min'.padStart(14) + 'sell G/min'.padStart(12) + 'order G/min'.padStart(13) + 'share'.padStart(8) + 'ledger (daily)'.padStart(16) + 'XP/min'.padStart(9));
  for (const [t, label, level] of stages) {
    const gps = log.at[t]?.gps;
    if (!gps) continue;
    const forgeMin = gps * 60;
    // The fisher splits time between the Mere and Magma lava (once a Seam Rod works) to fill the order.
    const mere = fishingRate(level, 'mere', 'active');
    const magma = fishingRate(level, 'magma', 'active');
    // Phase 8: the Underhearth's lava (any lava rod works it); a fisher with lava open adds it to the rotation.
    const hearth = fishingRate(level, 'hearth', 'active');
    const rotation = [mere, magma, hearth].filter(Boolean);
    const mix = magma ? .5 : 1;
    const sell = rotation.reduce((s, w) => s + w.goldMin, 0) / rotation.length;
    // Order fills a minute: limited by its scarcest item at this mix.
    let fills = Infinity;
    for (const [id, n] of order.items) {
      const rate = (mere.per[id] ?? 0) * mix + (magma ? (magma.per[id] ?? 0) * (1 - mix) : 0);
      fills = Math.min(fills, rate / n);
    }
    if (!Number.isFinite(fills)) fills = 0;
    const orderMin = fills * Math.max(order.floor, gps * order.seconds);
    const share = (sell + orderMin) / forgeMin;
    const ledger = Math.max(FISH.LEDGER_REWARD.goldFloor, gps * FISH.LEDGER_REWARD.goldSeconds);
    const xpMin = rotation.reduce((s, w) => s + w.xpMin, 0) / rotation.length;
    say('  ' + label.padEnd(6) + String(level).padStart(5) + fmtN(forgeMin).padStart(14) + fmtN(sell).padStart(12) + fmtN(orderMin).padStart(13) + `${(share * 100).toFixed(1)}%`.padStart(8) + fmtN(ledger).padStart(16) + xpMin.toFixed(0).padStart(9));
    // 1. Fishing's Gold a minute (selling everything plus the standing order) ≤ 10% of the forge's, after the first 10 minutes.
    if (t > 600 && share > .10) fails.push(`fishing pays ${(share * 100).toFixed(1)}% of the forge's Gold/min at ${label} (must be <= 10%)`);
    // 2. A crate's vendor value ≤ the Gold the forge earns in the minutes it took to fish it.
    for (const water of ['mere', 'magma', 'hearth']) {
      const r = water === 'mere' ? mere : water === 'magma' ? magma : hearth;
      if (!r) continue;
      const crate = FISH.WATERS[water].crate;
      const value = FISH.crateExpectedAnchor(crate, anchorOf) * C.ITEM_ECONOMY_SCALE * C.VENDOR_BUYBACK_FRACTION;
      const minutes = 1 / Math.max(1e-9, r.crateP * r.perMin);
      if (value > forgeMin * minutes) fails.push(`${crate} worth ${value.toFixed(0)} beats ${minutes.toFixed(0)} min of the forge at ${label}`);
    }
  }
  // 3. No rod is bought past its gate: each rod's recipe asks for the Fishing level that wears it.
  say('\n  Rods: recipe gate and Gold');
  for (const rod of FISH.RODS.filter(r => r.id !== 'worn-rod')) {
    const recipe = rodRecipe(rod.id);
    say(`    ${rod.name.padEnd(14)} Fishing ${String(rod.level).padStart(2)}  recipe: ${recipe ? `${recipe.skill} ${recipe.level}, ${fmtN(recipe.gold)} Gold` : 'missing'}`);
    if (!recipe) fails.push(`${rod.id}: no recipe`);
    else if (recipe.skill !== 'fishing' || recipe.level !== rod.level) fails.push(`${rod.id} can be crafted before Fishing ${rod.level} (recipe gate: ${recipe.skill} ${recipe.level})`);
  }
  // 4. 99 Fishing takes 60–250 active hours (the band the other skills sit in): the best water at each level, active.
  let hours = 0;
  for (let L = 1; L < 99; L++) {
    const best = Math.max(...['seep', 'mere', 'magma', 'hearth'].map(w => fishingRate(L, w, 'active')?.xpMin ?? 0));
    hours += (xpFor(L + 1) - xpFor(L)) / best / 60;
  }
  let autoHours = 0;
  for (let L = 1; L < 99; L++) {
    const best = Math.max(...['seep', 'mere', 'magma', 'hearth'].map(w => fishingRate(L, w, 'auto')?.xpMin ?? 0));
    autoHours += (xpFor(L + 1) - xpFor(L)) / best / 60;
  }
  say(`\n  99 Fishing: ${hours.toFixed(0)} active hours at the Good grade (${autoHours.toFixed(0)} h on auto at Off); band 60-250 h`);
  if (hours < 60 || hours > 250) fails.push(`99 Fishing takes ${hours.toFixed(0)} active hours (must be 60-250)`);
  if (!quiet) for (const f of fails) console.error(`  FAIL ${f}`);
  if (quiet) console.log(`economy-sim fishing: 99 Fishing in ${hours.toFixed(0)} h; ${fails.length ? fails.length + ' fail(s)' : 'gold share, crates and rod gates ok'}`);
  return fails;
}

// --underhearth: Phase 8 on the v3 curve (docs/handoff/underhearth.md). The
// stratum's Gold comes from missions (rule I: a v2 floor × ρ and the NPC band's
// seconds of income), the Banked Furnace's drops (its first fall, then at most
// once a real day) and the vendor floor of what is dug; none of it may become a
// Gold strategy. Read from source text, like the fishing scenario.
// ───────────────────────────────────────────────────────────────────────────
function underhearthScenario({ quiet = false } = {}) {
  const fails = [];
  const say = (...a) => { if (!quiet) console.log(...a); };
  const missions = readFileSync(resolve(here, '../src/app/shared/npc/delve-missions.model.ts'), 'utf8');
  const ids = ['kael-flooded-seams', 'kael-four-1', 'kael-four-2', 'verrin-four-3', 'verrin-endings-kept-warm',
    // The realm Delves behind the Rift Gates (docs/handoff/rift-gates.md, realm-delves.md): the same rule I, a step up each.
    'verrin-ink-1', 'verrin-ink-2', 'verrin-ink-3',
    'kesh-roots-1', 'siv-roots-2', 'kesh-roots-3',
    'aureth-prism-1', 'lune-prism-2', 'aureth-prism-3',
    'sera-wells-1', 'sera-wells-2', 'sera-wells-3'];
  const { log } = simulate(PROPOSED);
  const gpsAt = t => log.at[t]?.gps ?? 0;
  // The stratum opens at Mining 45 / Smithing 45 / Delving 15: a week into the curve at the earliest.
  const t7 = 7 * 86400, gps = gpsAt(t7);
  say(`Underhearth scenario · v3 curve (PROPOSED) · forge ${fmtN(gps * 60)} Gold/min at 7d\n`);
  for (const id of ids) {
    const at = missions.indexOf(`id: '${id}'`);
    if (at < 0) { fails.push(`mission ${id} is missing`); continue; }
    const block = missions.slice(at, missions.indexOf('\n  },', at));
    // 1. Every reward is paid in seconds of income with a v2 floor (rule I), never a flat sum.
    const v2 = /incomeGold\(([\d_]+)\)/.exec(block);
    if (!v2) { fails.push(`${id} does not pay by rule I (incomeGold)`); continue; }
    const floor = Number(v2[1].replace(/_/g, '')) * C.ITEM_ECONOMY_SCALE;
    say(`  ${id.padEnd(26)} floor ${fmtN(floor).padStart(8)} Gold`);
  }
  // 2. The Banked Furnace's repeat fights: its coins once a day stay a rounding error of a day's forge income.
  const infernal = readFileSync(resolve(here, '../src/app/play/world/towns/infernal.ts'), 'utf8');
  const drops = infernal.slice(infernal.indexOf('BANKED_FURNACE_DROPS'), infernal.indexOf('BANKED_FURNACE_FLAG'));
  const coins = /base: (\d+), spread: (\d+)/.exec(drops);
  const perDay = coins ? Number(coins[1]) + Number(coins[2]) : Infinity;
  const share = perDay / (gps * 86400);
  say(`\n  Banked Furnace rematch: at most ${perDay} coins a day = ${(share * 100).toFixed(4)}% of a day's forge income at 7d`);
  if (!(share < .001)) fails.push(`the furnace's daily coins are ${(share * 100).toFixed(3)}% of a day's forge income (must be < 0.1%)`);
  const engine = readFileSync(resolve(here, '../src/app/play/engine/engine.ts'), 'utf8');
  // 3. Its spilled embers pay nothing (no drop table, no kill tally): no farm while it is awake.
  if (!/drops: \{ id: 'furnace-ember', entries: \[\] \}/.test(engine)) fails.push('the furnace\'s spilled embers have a drop table');
  // 4. Tool tier V sits on the tool ladder: ×3-×5 tier IV's fee.
  const crafting = readFileSync(resolve(here, '../src/app/shared/crafting/crafting.model.ts'), 'utf8');
  const gold = (/const TOOL_GOLD = \[([\d_,\s]+)\]/.exec(crafting)?.[1] ?? '').split(',').map(s => Number(s.trim().replace(/_/g, '')));
  const ratio = gold[5] / gold[4];
  say(`  Tool V fee ${fmtN(gold[5] ?? 0)} Gold (×${ratio.toFixed(1)} tier IV) = ${(gold[5] / (gps * 60)).toFixed(1)} min of the forge at 7d`);
  if (!(ratio >= 3 && ratio <= 5)) fails.push(`tool tier V costs ×${ratio} tier IV (must be ×3-×5)`);
  if (!quiet) for (const f of fails) console.error(`  FAIL ${f}`);
  if (quiet) console.log(`economy-sim underhearth: ${fails.length ? fails.length + ' fail(s)' : 'rule I rewards, a furnace that is no farm, tool V on the ladder'}`);
  return fails;
}

// ───────────────────────────────────────────────────────────────────────────
// --bounties: the Board Herald's three daily Delve bounties (delve-and-beyond.md
// §7.2, Phase 7.5; src/app/shared/bounties/bounty.model.ts). They are a
// reason to go into the endless Delve, not a Gold strategy:
//   1. every tier pays inside the daily band of rule I (5-20 min of income);
//   2. its Gold floor never beats the income seconds after the first half hour
//      (the floor is only there for a brand-new save);
//   3. a whole day of bounties (all three at tier 3) is at most an hour of income;
//   4. a day's Delving XP is a nudge, not a ladder: under a quarter of one level
//      at Delving 20, and the per-claim XP under the world-action ceiling;
//   5. the draw: three bounties, three different kinds, a reach every day, only
//      strata reached, the same board for the same seed and day, and no two days
//      alike for a seed; gifts: the compass once, a fragment every 7th claim day.
// ───────────────────────────────────────────────────────────────────────────

// --heights: the high roads (src/app/play/world/heights.ts; docs/handoff/surface-height.md).
// Once-only finds at the top of a parkour route, so they are a reason to climb,
// not a Gold strategy:
//   1. a shelf or mesa cache pays inside the quest band of rule I (2-10 min of
//      income); a summit inside the daily band (5-20 min);
//   2. a whole realm's road (two caches and the summit) is at most 30 min of
//      income, and all five realms at most 2.5 h — paid once, ever;
//   3. no floor beats the income seconds after the first half hour;
//   4. each find is paid once (ids unique); materials are checked by heights.service.spec.
// ───────────────────────────────────────────────────────────────────────────

const HEIGHTS = loadTsTree('src/app/play/world/heights.ts');

function heightsScenario({ quiet = false } = {}) {
  const fails = [];
  const say = (...a) => { if (!quiet) console.log(...a); };
  const { log } = simulate(PROPOSED);
  const quest = C.REWARD_SECONDS.quest, daily = C.REWARD_SECONDS.daily;
  const gps30 = log.at[1800]?.gps ?? 0;
  say('High roads scenario · v3 curve (PROPOSED)\n');
  say('  realm        caches (s)   summit (s)   road total');
  let all = 0;
  const ids = new Set();
  for (const [area, h] of Object.entries(HEIGHTS.HUNT_HEIGHTS)) {
    let road = 0;
    for (const f of h.finds) {
      if (ids.has(f.id)) fails.push(`${f.id} is listed twice`);
      ids.add(f.id);
      const r = f.reward;
      if (!r) continue;
      road += r.goldSeconds;
      const band = f.kind === 'summit' ? daily : quest;
      if (r.goldSeconds < band.minS || r.goldSeconds > band.maxS) fails.push(`${f.id} pays ${r.goldSeconds} s of income (band ${band.minS}-${band.maxS} s)`);
      if (gps30 && r.gold > r.goldSeconds * gps30) fails.push(`${f.id}: its floor ${r.gold} still beats ${r.goldSeconds} s of income at 30 min`);
    }
    const caches = h.finds.filter(f => f.kind === 'cache').map(f => f.reward.goldSeconds).join(' + ');
    say(`  ${area.padEnd(22)} ${caches.padEnd(12)} ${String(h.finds.find(f => f.kind === 'summit').reward.goldSeconds).padEnd(12)} ${(road / 60).toFixed(0)} min`);
    if (road > 30 * 60) fails.push(`${area}'s road pays ${road / 60} min of income (must be <= 30)`);
    all += road;
  }
  say(`\n  All five roads, once: ${(all / 60).toFixed(0)} min of income.`);
  if (all > 150 * 60) fails.push(`the five roads pay ${all / 60} min of income (must be <= 150)`);
  if (quiet) console.log(`economy-sim heights: ${fails.length ? fails.length + ' fail(s)' : 'rule I bands, road envelope and floors ok'}`);
  else for (const f of fails) console.error(`  FAIL ${f}`);
  return fails;
}

// ───────────────────────────────────────────────────────────────────────────
// --cabinets: the Lost Cabinets (src/app/shared/cabinets/cabinets.model.ts; docs/handoff/lost-cabinets.md).
// Sixteen once-only cabinets found with the Slate's Scan, so a treasure hunt, never a Gold strategy:
//   1. each cabinet pays inside the quest band of rule I (2-10 min of income);
//      the set's final reward inside the daily band (5-20 min);
//   2. all sixteen and the final reward together are at most 2 h of income, paid once, ever;
//   3. no floor beats its income seconds after the first half hour;
//   4. ids unique (each is its own receipt); every deep cabinet pays at least a surface one.
// ───────────────────────────────────────────────────────────────────────────

const CABINETS_MODEL = loadTsTree('src/app/shared/cabinets/cabinets.model.ts');

// ───────────────────────────────────────────────────────────────────────────
// --eclipse: Sera Quill's Eclipse Ledger (src/app/shared/world-clock/eclipse.model.ts; docs/handoff/world-clock.md).
// Every eclipse a Keeper is in the world for pays a small observation; the ledger's marks pay once each:
//   1. a real day of eclipses, every one witnessed, pays at most the daily band's top (20 min of income):
//      an eclipse is a world event to enjoy, never a Gold strategy to camp;
//   2. each mark inside the daily band of rule I (5-20 min), the marks together at most 90 min, once, ever;
//   3. no floor beats its income seconds after the first half hour; marks ascend and their glass is small.
// ───────────────────────────────────────────────────────────────────────────

const ECLIPSE_MODEL = loadTsTree('src/app/shared/world-clock/eclipse.model.ts');
const CLOCK_MODEL = loadTsTree('src/app/shared/world-clock/world-clock.model.ts');

function eclipseScenario({ quiet = false } = {}) {
  const fails = [];
  const say = (...a) => { if (!quiet) console.log(...a); };
  const { log } = simulate(PROPOSED);
  const daily = C.REWARD_SECONDS.daily;
  const gps30 = log.at[1800]?.gps ?? 0;
  const o = ECLIPSE_MODEL.OBSERVATION;
  const realDayMs = 24 * 3600 * 1000;
  const perDay = Math.ceil(realDayMs / (CLOCK_MODEL.ECLIPSE.every * CLOCK_MODEL.WORLD_DAY_MS));
  say("Sera Quill's Eclipse Ledger · v3 curve (PROPOSED)\n");
  say(`  one eclipse every ${(CLOCK_MODEL.ECLIPSE.every * CLOCK_MODEL.WORLD_DAY_MS / 60000).toFixed(0)} real min: at most ${perDay} a real day`);
  say(`  an observation pays ${o.goldSeconds} s of income (floor ${o.gold}); all of a real day's: ${(perDay * o.goldSeconds / 60).toFixed(0)} min`);
  if (perDay * o.goldSeconds > daily.maxS) fails.push(`a real day of eclipses pays ${perDay * o.goldSeconds} s (must be <= ${daily.maxS})`);
  if (gps30 && o.gold > o.goldSeconds * gps30) fails.push(`the observation's floor ${o.gold} still beats ${o.goldSeconds} s of income at 30 min`);
  let all = 0, last = 0;
  const ids = new Set();
  say('\n  mark  at  pays (s)  glass  floor');
  for (const m of ECLIPSE_MODEL.LEDGER_MARKS) {
    if (ids.has(m.id)) fails.push(`${m.id} is listed twice`);
    ids.add(m.id);
    all += m.goldSeconds;
    if (m.at <= last) fails.push(`${m.id}: marks must ascend`);
    last = m.at;
    if (m.goldSeconds < daily.minS || m.goldSeconds > daily.maxS) fails.push(`${m.id} pays ${m.goldSeconds} s (band ${daily.minS}-${daily.maxS} s)`);
    if (gps30 && m.gold > m.goldSeconds * gps30) fails.push(`${m.id}: its floor ${m.gold} still beats ${m.goldSeconds} s of income at 30 min`);
    if (m.glass > 10) fails.push(`${m.id} hands over ${m.glass} Eclipse Glass (keep it small: <= 10)`);
    say(`  ${m.id.padEnd(16)} ${String(m.at).padEnd(4)} ${String(m.goldSeconds).padEnd(9)} ${String(m.glass).padEnd(6)} ${m.gold}`);
  }
  say(`\n  The marks, once: ${(all / 60).toFixed(0)} min of income.`);
  if (all > 90 * 60) fails.push(`the ledger marks pay ${(all / 60).toFixed(0)} min of income (must be <= 90)`);
  if (quiet) console.log(`economy-sim eclipse: ${fails.length ? fails.length + ' fail(s)' : 'daily envelope, rule I bands and floors ok'}`);
  else for (const x of fails) console.error(`  FAIL ${x}`);
  return fails;
}

function cabinetsScenario({ quiet = false } = {}) {
  const fails = [];
  const say = (...a) => { if (!quiet) console.log(...a); };
  const { log } = simulate(PROPOSED);
  const quest = C.REWARD_SECONDS.quest, daily = C.REWARD_SECONDS.daily;
  const gps30 = log.at[1800]?.gps ?? 0;
  say('Lost Cabinets scenario · v3 curve (PROPOSED)\n');
  say('  cabinet              place        pays (s)   floor');
  const ids = new Set();
  let all = 0, surfaceMax = 0, deepMin = Infinity;
  for (const c of CABINETS_MODEL.CABINETS) {
    if (ids.has(c.id)) fails.push(`${c.id} is listed twice`);
    ids.add(c.id);
    all += c.goldSeconds;
    if (c.needs) deepMin = Math.min(deepMin, c.goldSeconds); else surfaceMax = Math.max(surfaceMax, c.goldSeconds);
    if (c.goldSeconds < quest.minS || c.goldSeconds > quest.maxS) fails.push(`${c.id} pays ${c.goldSeconds} s of income (band ${quest.minS}-${quest.maxS} s)`);
    if (gps30 && c.gold > c.goldSeconds * gps30) fails.push(`${c.id}: its floor ${c.gold} still beats ${c.goldSeconds} s of income at 30 min`);
    say(`  ${c.id.padEnd(20)} ${c.place.padEnd(12)} ${String(c.goldSeconds).padEnd(10)} ${c.gold}`);
  }
  const f = CABINETS_MODEL.FINAL_REWARD;
  if (f.goldSeconds < daily.minS || f.goldSeconds > daily.maxS) fails.push(`the final reward pays ${f.goldSeconds} s (band ${daily.minS}-${daily.maxS} s)`);
  if (gps30 && f.gold > f.goldSeconds * gps30) fails.push(`the final reward's floor ${f.gold} still beats ${f.goldSeconds} s of income at 30 min`);
  all += f.goldSeconds;
  if (deepMin < surfaceMax) fails.push(`a deep cabinet pays ${deepMin} s, less than a surface one (${surfaceMax} s)`);
  say(`\n  The set's final reward: ${f.goldSeconds} s. All of it, once: ${(all / 60).toFixed(0)} min of income.`);
  if (all > 120 * 60) fails.push(`the Lost Cabinets pay ${(all / 60).toFixed(0)} min of income (must be <= 120)`);
  if (quiet) console.log(`economy-sim cabinets: ${fails.length ? fails.length + ' fail(s)' : 'rule I bands, envelope and floors ok'}`);
  else for (const x of fails) console.error(`  FAIL ${x}`);
  return fails;
}

// ───────────────────────────────────────────────────────────────────────────
// --living: the Living World (src/app/play/engine/living-world.ts; docs/handoff/living-world.md).
// Something to find every few sectors, never an income line. Upper bounds, a Keeper doing only that for an hour:
//   1. walking the wilds (a sector every 5.4 s): every surface mystery touched and every catchable
//      critter caught, sold back, is <= 25 % of the forge's income at every stage from 30 min on;
//   2. digging sideways through a stratum (a column a second): every strongbox crate and fossil
//      rivet, sold back, is <= 25 % of the forge's income from 30 min on;
//   3. a hermit's gift is once ever and small (<= 2 min of income at 30 min).
// ───────────────────────────────────────────────────────────────────────────

const LIVING = loadTsTree('src/app/play/engine/living-world.ts');
const TERRAIN = loadTsTree('src/app/play/engine/terrain.ts');

function livingScenario({ quiet = false } = {}) {
  const fails = [];
  const say = (...a) => { if (!quiet) console.log(...a); };
  const { log } = simulate(PROPOSED);
  const value = id => FISH.WATERS && Object.values(FISH.WATERS).some(w => w.crate === id)
    ? FISH.crateExpectedAnchor(id, anchorOf) * C.ITEM_ECONOMY_SCALE * C.VENDOR_BUYBACK_FRACTION : buyback(anchorOf(id));
  const node = id => TERRAIN.TERRAIN_NODE_LIST.find(n => n.id === id);
  // Walking: sectors an hour, mysteries one column in four (all of them on the surface: an upper bound), one catch a sector.
  const sectorsH = 3600 / (32 * 32 / 191);
  const R = LIVING.MYSTERY_REWARD, kinds = Object.keys(R);
  const mysteryEach = kinds.reduce((g, k) => g + (R[k].item ? value(R[k].item.materialId) * R[k].item.qty : 0), 0) / kinds.length;
  const catchEach = Object.values(LIVING.CRITTERS).filter(c => c.drop).reduce((g, c) => Math.max(g, value(c.drop.materialId) * c.drop.qty), 0);
  const walkH = sectorsH / 4 * mysteryEach + sectorsH * 1 * catchEach;
  // Digging: 3600 columns an hour = 112 sector columns of one stratum; a find in ~80 % of them, the best stratum's strongbox share.
  const cols = 3600 / 32;
  const box = Math.max(value(node('old-strongbox').yield.materialId), value(node('ember-strongbox').yield.materialId));
  const fossil = node('fossil-bone').yield;
  const digH = cols * .8 * (.35 * box + .4 * 20 * fossil.qty * (fossil.chance ?? 1) * value(fossil.materialId));
  say('Living World scenario · v3 curve (PROPOSED)\n');
  say(`  walking: ${fmtN(sectorsH)} sectors/h, a mystery ${fmtN(mysteryEach)} Gold, a catch ${fmtN(catchEach)} Gold -> ${fmtN(walkH)} Gold/h at most`);
  say(`  digging: ${fmtN(cols)} sector columns/h of one stratum, a strongbox ${fmtN(box)} Gold -> ${fmtN(digH)} Gold/h at most\n`);
  say('  stage   forge Gold/h   walking   digging');
  for (const [t, label] of [[1800, '30m'], [3600, '1h'], [3 * 3600, '3h'], [86400, '1d'], [7 * 86400, '7d']]) {
    const gps = log.at[t]?.gps;
    if (!gps) continue;
    const forge = gps * 3600;
    say(`  ${label.padEnd(6)}${fmtN(forge).padStart(14)}   ${(walkH / forge * 100).toFixed(1).padStart(6)}%   ${(digH / forge * 100).toFixed(1).padStart(6)}%`);
    if (walkH > .25 * forge) fails.push(`walking the wilds pays ${(walkH / forge * 100).toFixed(1)} % of the forge's income at ${label} (must be <= 25 %)`);
    if (digH > .25 * forge) fails.push(`the Living World's finds pay ${(digH / forge * 100).toFixed(1)} % of the forge's income at ${label} (must be <= 25 %)`);
  }
  const gps30 = log.at[1800]?.gps ?? 0;
  for (const h of LIVING.HERMITS) {
    const g = value(h.gift.materialId) * h.gift.qty;
    if (gps30 && g > 120 * gps30) fails.push(`${h.id}'s gift is worth ${fmtN(g)} Gold, over 2 min of income at 30 min`);
  }
  if (quiet) console.log(`economy-sim living: ${fails.length ? fails.length + ' fail(s)' : 'finds, catches and mysteries a side line'}`);
  else for (const f of fails) console.error(`  FAIL ${f}`);
  return fails;
}

// ───────────────────────────────────────────────────────────────────────────
// --pets: the pets' helpers (src/app/shared/pets/pets.model.ts; docs/handoff/pets.md).
// One small helper each, so a pet is a companion, never an income line:
//   1. the knobs stay small: gather <= 25 %, XP <= 10 %, bite <= x1.25;
//   2. the Moss Hedgehog's extra harvest, farming the Rootglass Thicket's nodes
//      as fast as they regrow and selling it all back, is <= 5 % of the forge's
//      income at every stage from 30 min on (it is a few herbs, not a mine);
//   3. a pet costs nothing and is found once: no source pays Gold.
// The roles (pet-roles.ts, docs/handoff/pets-and-glim-alive.md), on the same curve:
//   4. a combat pet at its top level adds <= 22 % to the Keeper's own damage
//      (a starter blow: 20 every .52 s), chomp's armour crack counted in;
//   5. a stun never holds a foe more than 20 % of the time (bite, howl, flare);
//   6. the Sunling's pulse heals no faster than the old mend (1 % a second);
//   7. what pets dig up (the Star Owlet's spots at its best, plus trinkets) is
//      <= 2 % of an hour of forge income at the 30-minute stage, every day;
//   8. the Ember Newt's kindle saves <= 8 % of a miner's swings; the moth's guide
//      stays under the Shade-kit's bite boost.
// ───────────────────────────────────────────────────────────────────────────

const PETS = loadTsTree('src/app/shared/pets/pets.model.ts');
const ROLES = loadTsTree('src/app/shared/pets/pet-roles.ts');
const VERDANT = loadTsTree('src/app/play/world/towns/verdant.ts');

function petsScenario({ quiet = false } = {}) {
  const fails = [];
  const say = (...a) => { if (!quiet) console.log(...a); };
  const T = PETS.PET_TUNING;
  if (T.gatherChance > .25) fails.push(`the hedgehog's gather chance ${T.gatherChance} is over 25 %`);
  if (T.xpShare > .1) fails.push(`the moth-kit's XP share ${T.xpShare} is over 10 %`);
  if (T.biteBoost > 1.25) fails.push(`the shade-kit's bite boost ${T.biteBoost} is over x1.25`);
  const { log } = simulate(PROPOSED);
  const nodes = VERDANT.ROOTGLASS_THICKET.nodes ?? [];
  // Every node harvested the moment it regrows, an hour long: the hedgehog's share of it, sold back.
  const perHour = nodes.reduce((g, n) => g + 3600 / n.respawn * n.yield.qty * (n.yield.chance ?? 1) * T.gatherChance * buyback(anchorOf(n.yield.materialId)), 0);
  say('Pets scenario · v3 curve (PROPOSED)\n');
  say(`  helpers: gather ${T.gatherChance * 100}% · XP +${T.xpShare * 100}% · bite x${T.biteBoost} · glow ${T.glowRadius}px · fetch ${T.fetchReach}px · scent ${T.scentCells} cells`);
  say(`  the hedgehog's extra Thicket harvest, sold back: ${fmtN(perHour)} Gold/h (${nodes.length} nodes, all regrown at once)\n`);
  say('  stage   forge Gold/h   hedgehog share');
  for (const [t, label] of [[1800, '30m'], [3600, '1h'], [3 * 3600, '3h'], [86400, '1d'], [7 * 86400, '7d']]) {
    const gps = log.at[t]?.gps;
    if (!gps) continue;
    const share = perHour / (gps * 3600);
    say(`  ${label.padEnd(6)}${fmtN(gps * 3600).padStart(14)}   ${(share * 100).toFixed(2)}%`);
    if (share > .05) fails.push(`the hedgehog's extra harvest is ${(share * 100).toFixed(1)} % of the forge's income at ${label} (must be <= 5 %)`);
  }
  for (const pet of PETS.PETS) if (!pet.source || (!pet.source.tally && !pet.source.flag && !pet.source.claimDays)) fails.push(`${pet.id} has no source in play`);
  // The roles: combat next to the Keeper's own blow, stuns, the pulse, the finds.
  const A = ROLES.PET_ACT, top = ROLES.PET_LEVEL_MAX;
  const keeperDps = 20 / .52;
  say('\n  roles (pet-roles.ts) at level ' + top + ' · the Keeper\'s starter blow ' + keeperDps.toFixed(1) + '/s');
  for (const [id, r] of Object.entries(ROLES.PET_ROLES)) {
    if (r.role !== 'combat') continue;
    let dps = ROLES.moveDps(r.move, top);
    // The chomp's crack: every blow of the Keeper's lands `crack` harder while it holds (refreshed each chomp).
    if (r.move === 'chomp') dps += keeperDps * A.crack * Math.min(1, A.crackFor / A.chompRest);
    const share = dps / keeperDps;
    say(`  ${id.padEnd(16)} ${r.move.padEnd(6)} +${dps.toFixed(1)}/s (${(share * 100).toFixed(1)}% of the Keeper's)`);
    if (share > .22) fails.push(`${id}'s ${r.move} adds ${(share * 100).toFixed(1)} % to the Keeper's damage (must be <= 22 %)`);
  }
  const stuns = { bite: A.stun / (A.biteRest * A.stunEvery), howl: A.howlStun / A.howlRest, flare: A.flareStun / A.flareRest };
  for (const [k, v] of Object.entries(stuns)) if (v > .2) fails.push(`the ${k} holds a foe ${(v * 100).toFixed(0)} % of the time (must be <= 20 %)`);
  say(`  stun uptime: bite ${(stuns.bite * 100).toFixed(0)}% · howl ${(stuns.howl * 100).toFixed(0)}% · flare ${(stuns.flare * 100).toFixed(0)}%`);
  const pulse = A.pulseShare / A.pulseRest;
  if (pulse > T.mendShare) fails.push(`the Sunling's pulse heals ${(pulse * 100).toFixed(2)} %/s, faster than the mend`);
  const scoutDay = ROLES.FINDS_PER_DAY.scout * ROLES.scoutCoins(top, true);
  const hour30 = (log.at[1800]?.gps ?? 0) * 3600;
  const digShare = hour30 ? scoutDay / hour30 : 1;
  say(`  digs a day: ${ROLES.FINDS_PER_DAY.scout} spots (${scoutDay} Gold at best) + ${ROLES.FINDS_PER_DAY.trinket} trinkets · ${(digShare * 100).toFixed(2)}% of an hour's forge income at 30m`);
  if (digShare > .02) fails.push(`what pets dig up a day is ${(digShare * 100).toFixed(1)} % of an hour of forge income at 30m (must be <= 2 %)`);
  if (ROLES.FINDS_PER_DAY.trinket > 2) fails.push('more than two trinkets a day');
  // Kindle: a warm vein (3 hp, a starter pick chips 1) breaks in 1 swing instead of 3, one vein per rest.
  const saved = (3 - Math.ceil(3 / A.kindleBoost)) * .52 / A.kindleRest;
  say(`  kindle saves ${(saved * 100).toFixed(1)}% of a miner's swing time · guide x${A.guideBoost}`);
  if (saved > .08) fails.push(`the newt's kindle saves ${(saved * 100).toFixed(1)} % of swings (must be <= 8 %)`);
  if (A.guideBoost > T.biteBoost) fails.push('the moth\'s guide beats the Shade-kit\'s bite boost');
  if (quiet) console.log(`economy-sim pets: ${fails.length ? fails.length + ' fail(s)' : 'helpers small, the hedgehog no farm, roles on the curve'}`);
  else for (const f of fails) console.error(`  FAIL ${f}`);
  return fails;
}

const BOUNTY = loadTsTree('src/app/shared/bounties/bounty.model.ts');

function bountiesScenario({ quiet = false } = {}) {
  const fails = [];
  const say = (...a) => { if (!quiet) console.log(...a); };
  const { log } = simulate(PROPOSED);
  const band = C.REWARD_SECONDS.daily;
  const tiers = [1, 2, 3].map(t => BOUNTY.BOUNTY_REWARDS[t]);
  say('Bounties scenario · v3 curve (PROPOSED)\n');
  say('  tier  income   floor   Delving XP');
  tiers.forEach((r, i) => say(`  ${i + 1}     ${String(r.goldSeconds / 60).padStart(3)} min ${String(r.gold).padStart(6)}   ${r.delvingXp}`));
  for (const [i, r] of tiers.entries()) {
    if (r.goldSeconds < band.minS || r.goldSeconds > band.maxS) fails.push(`bounty tier ${i + 1} pays ${r.goldSeconds} s of income (rule I daily band ${band.minS}-${band.maxS} s)`);
    if (r.delvingXp > 500) fails.push(`bounty tier ${i + 1} XP ${r.delvingXp} is over the world-action ceiling`);
  }
  const day = 3 * Math.max(...tiers.map(r => r.goldSeconds));
  if (day > 3600) fails.push(`a day of bounties pays ${day / 60} min of income (must be <= 60)`);
  say(`\n  stage   Gold/s    tier 1    tier 3    a day (3 × tier 3)   floor wins?`);
  for (const [t, label] of [[600, '10m'], [1800, '30m'], [3600, '1h'], [3 * 3600, '3h'], [86400, '1d'], [3 * 86400, '3d'], [7 * 86400, '7d']]) {
    const gps = log.at[t]?.gps;
    if (!gps) continue;
    const pay = r => BOUNTY.bountyGold(r, gps);
    const floorWins = tiers.some(r => r.gold > r.goldSeconds * gps);
    say(`  ${label.padEnd(6)}${fmtN(gps).padStart(8)}${fmtN(pay(tiers[0])).padStart(10)}${fmtN(pay(tiers[2])).padStart(10)}${fmtN(3 * pay(tiers[2])).padStart(21)}   ${floorWins ? 'yes' : 'no'}`);
    if (t >= 1800 && floorWins) fails.push(`a bounty's Gold floor beats its income seconds at ${label} (the floor is for a new save only)`);
  }
  // 4. XP: a day of bounties against one Delving level at 20 (xpFor is the 1-99 curve).
  const dayXp = 3 * Math.max(...tiers.map(r => r.delvingXp));
  const level20 = xpFor(21) - xpFor(20);
  say(`\n  A day of bounties: ${dayXp} Delving XP; one level at Delving 20 is ${level20} XP (${(dayXp / level20 * 100).toFixed(1)}%).`);
  if (dayXp > level20 / 4) fails.push(`a day of bounties pays ${dayXp} Delving XP, over a quarter of a level at 20 (${level20})`);
  // 5. The draw.
  const kinds = new Set(), boards = new Set();
  let checked = 0;
  for (let seed = 1; seed <= 40; seed++) {
    for (let d = 0; d < 60; d++) {
      const date = new Date(Date.UTC(2026, 9, 1 + d));
      const dayKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
      const deepest = (seed + d) % 4;
      const ctx = { seed: seed * 7919, day: dayKey, deepest, frontierEast: 3 + (d % 5), frontierWest: -(d % 3) };
      const board = BOUNTY.drawBounties(ctx);
      const again = BOUNTY.drawBounties(ctx);
      checked++;
      if (JSON.stringify(board) !== JSON.stringify(again)) fails.push(`the draw is not deterministic (seed ${seed}, ${dayKey})`);
      if (board.list.length !== 3) fails.push(`${board.list.length} bounties on ${dayKey} (seed ${seed})`);
      if (board.list[0]?.kind !== 'reach') fails.push(`no reach bounty on ${dayKey} (seed ${seed})`);
      if (new Set(board.list.map(b => b.kind)).size !== board.list.length) fails.push(`two bounties of one kind on ${dayKey} (seed ${seed})`);
      for (const b of board.list) {
        kinds.add(b.kind);
        if (b.stratum > deepest) fails.push(`${b.id} names a stratum not reached (${b.stratum} > ${deepest})`);
        if (b.kind === 'reach' && !(b.target === 'east' ? b.sx > ctx.frontierEast : b.sx < ctx.frontierWest)) fails.push(`${b.id} is already reached at the draw`);
      }
      boards.add(JSON.stringify(board.list.map(b => b.id.slice(11))));
    }
  }
  for (const kind of ['reach', 'dig', 'structure', 'catch', 'torch']) if (!kinds.has(kind)) fails.push(`the draw never asks for a ${kind} bounty`);
  if (boards.size < checked * .5) fails.push(`only ${boards.size} different boards in ${checked} draws`);
  say(`\n  The draw: ${checked} boards (40 seeds × 60 days), ${boards.size} different, kinds ${[...kinds].join(', ')}.`);
  say(`  Gifts: the Broken Astral Compass with the first claim; a Rift Map Fragment every ${BOUNTY.FRAGMENT_EVERY}th claim day (never a streak).`);
  if (!quiet) for (const f of fails) console.error(`  FAIL ${f}`);
  if (quiet) console.log(`economy-sim bounties: ${fails.length ? fails.length + ' fail(s)' : 'rule I band, daily envelope, XP and the draw ok'}`);
  return fails;
}

// --plinko / --mines / --crash: the Croupier's other three games (Rune Drop,
// Seam Sweeper, Eclipse Ascent). Gold only; RTP must sit in 94–96%.
//   Each is proven EXACTLY (sums over the binomial board; the multiplier ×
//   survival identity; the crash tail P(C ≥ x) = RTP / x), then cross-checked
//   by simulating the shipped pure model on the seeded RNG. A simulation fails
//   only when it misses the exact value by more than 4 standard errors.
// ───────────────────────────────────────────────────────────────────────────

const OWNER_BAND = [0.94, 0.96];

/** Mean and standard error of per-play returns (in multiples of the bet). */
function moments(xs) {
  let s = 0, s2 = 0;
  for (const x of xs) { s += x; s2 += x * x; }
  const n = xs.length, mean = s / n;
  return { mean, se: Math.sqrt(Math.max(0, s2 / n - mean * mean) / n) };
}
const pctS = x => `${(x * 100).toFixed(2)}%`;

function plinkoScenario({ plays, quiet }) {
  const D = loadTsTree('src/app/shared/rune-drop/rune-drop.model.ts');
  const rng = loadTsTree('src/app/shared/games/seeded-rng.ts');
  const fails = [];
  const rows = [];
  for (const risk of D.DROP_RISKS) for (let n = D.DROP_ROWS.min; n <= D.DROP_ROWS.max; n++) {
    const exact = D.dropRtp(risk, n);
    const pays = D.dropPays(risk, n);
    rows.push([risk, n, exact, pays]);
    if (exact < OWNER_BAND[0] || exact > OWNER_BAND[1]) fails.push(`Rune Drop ${risk}/${n} returns ${pctS(exact)}, outside 94–96%`);
    if (pays.some(t => !Number.isInteger(t) || t < 1)) fails.push(`Rune Drop ${risk}/${n} has a pay that is not whole tenths`);
    for (let k = 0; k < pays.length; k++) if (pays[k] !== pays[n - k]) fails.push(`Rune Drop ${risk}/${n} is not symmetric`);
  }
  if (!quiet) {
    console.log('Rune Drop · exact RTP per board (sum of C(n,k)/2^n × pay)\n');
    for (const risk of D.DROP_RISKS) {
      console.log(`  ${risk.padEnd(6)} ` + rows.filter(r => r[0] === risk).map(([, n, e]) => `${n}: ${pctS(e)}`).join(' · '));
    }
    console.log('\n  pay tables (× bet, edge → centre):');
    for (const [risk, n, , pays] of rows) console.log(`  ${risk.padEnd(6)} ${String(n).padStart(2)} rows  ${pays.slice(0, Math.floor(n / 2) + 1).map(t => t / 10).join(' · ')}`);
    console.log();
  }
  // Simulate the shipped play on a few boards.
  const sample = [['low', 8], ['medium', 12], ['high', 16], ['high', 8], ['low', 16]];
  for (const [risk, n] of sample) {
    const r = rng.seededRng(`economy-sim:plinko:${risk}:${n}`);
    const xs = new Array(plays);
    for (let i = 0; i < plays; i++) xs[i] = D.playRuneDrop(r, 10, risk, n).win / 10;
    const { mean, se } = moments(xs);
    const exact = D.dropRtp(risk, n);
    if (Math.abs(mean - exact) > 4 * se) fails.push(`Rune Drop ${risk}/${n}: ${plays} drops returned ${pctS(mean)}, exact ${pctS(exact)} (> 4 s.e. ${pctS(se)})`);
    if (!quiet) console.log(`  simulated ${risk}/${n}: ${fmtN(plays)} drops at bet 10 → ${pctS(mean)} ± ${pctS(se)} (exact ${pctS(exact)})`);
  }
  const all = rows.map(r => r[2]);
  console.log(`economy-sim plinko: every board ${pctS(Math.min(...all))}–${pctS(Math.max(...all))}, max ×${D.DROP_MAX_X}`);
  return fails;
}

function minesScenario({ rounds, quiet }) {
  const M = loadTsTree('src/app/shared/seam-sweeper/seam-sweeper.model.ts');
  const rng = loadTsTree('src/app/shared/games/seeded-rng.ts');
  const fails = [];
  if (M.SEAM_RTP < OWNER_BAND[0] || M.SEAM_RTP > OWNER_BAND[1]) fails.push(`Seam Sweeper RTP ${pctS(M.SEAM_RTP)} outside 94–96%`);
  // Exact: every (collapses, ore) cash-out the board offers returns RTP.
  let worst = 0, offered = 0, top = 0;
  for (let m = M.SEAM_COLLAPSES.min; m <= M.SEAM_COLLAPSES.max; m++) {
    const deep = M.seamDeepest(m);
    if (deep < 1) fails.push(`Seam Sweeper with ${m} collapses offers no dig`);
    for (let k = 1; k <= deep; k++) {
      offered++;
      worst = Math.max(worst, Math.abs(M.seamReturnAt(m, k) - M.SEAM_RTP));
      top = Math.max(top, M.seamMultiplier(m, k));
      // The survival chance the multiplier divides by, counted directly.
      let p = 1;
      for (let i = 0; i < k; i++) p *= (25 - m - i) / (25 - i);
      if (Math.abs(p * M.seamMultiplier(m, k) - M.SEAM_RTP) > 1e-9) fails.push(`Seam Sweeper ${m}/${k}: survival × multiplier is not RTP`);
    }
  }
  if (worst > 1e-9) fails.push(`Seam Sweeper exact return off by ${worst}`);
  if (top > M.SEAM_MAX_X) fails.push(`Seam Sweeper offers ×${top.toFixed(2)} > ×${M.SEAM_MAX_X}`);
  if (!quiet) {
    console.log(`Seam Sweeper · exact: all ${offered} (collapses, ore) cash-outs the board offers return ${pctS(M.SEAM_RTP)} (max error ${worst.toExponential(1)}); top multiplier ×${top.toFixed(2)}`);
    for (const m of [1, 3, 5, 10, 24]) {
      const ks = [1, 2, 3, 5, 8, 12].filter(k => k <= M.seamDeepest(m));
      console.log(`  ${String(m).padStart(2)} collapses: ` + ks.map(k => `${k} ore ×${M.seamMultiplier(m, k).toFixed(2)} (${pctS(1 / M.seamFair(m, k))})`).join(' · '));
    }
  }
  // Simulate whole rounds at the 10-Gold minimum (wholeGold rounding included):
  // random collapse count, random cash-out target, random dig order.
  const r = rng.seededRng('economy-sim:mines');
  const xs = new Array(rounds);
  for (let i = 0; i < rounds; i++) {
    const m = 1 + Math.floor(r() * 8);
    const target = 1 + Math.floor(r() * 5);
    xs[i] = M.playSeamRound(r, 10, m, target).win / 10;
  }
  const { mean, se } = moments(xs);
  if (Math.abs(mean - M.SEAM_RTP) > 4 * se) fails.push(`Seam Sweeper: ${rounds} rounds returned ${pctS(mean)}, exact ${pctS(M.SEAM_RTP)} (> 4 s.e. ${pctS(se)})`);
  if (!quiet) console.log(`  simulated: ${fmtN(rounds)} rounds at bet 10, 1–8 collapses + cash-out after 1–5 ore → ${pctS(mean)} ± ${pctS(se)}`);
  console.log(`economy-sim mines: exact ${pctS(M.SEAM_RTP)} on all ${offered} cash-outs, simulated ${pctS(mean)} ± ${pctS(se)}`);
  return fails;
}

function crashScenario({ rounds, quiet }) {
  const A = loadTsTree('src/app/shared/eclipse-ascent/eclipse-ascent.model.ts');
  const rng = loadTsTree('src/app/shared/games/seeded-rng.ts');
  const fails = [];
  if (A.ASCENT_RTP < OWNER_BAND[0] || A.ASCENT_RTP > OWNER_BAND[1]) fails.push(`Eclipse Ascent RTP ${pctS(A.ASCENT_RTP)} outside 94–96%`);
  // Exact: P(crash ≥ x) = RTP·100/x, so a cash-out at x returns x/100 × that = RTP.
  // The draw: crash ≥ x ⇔ floor(100·RTP/(1−a)) ≥ x ⇔ 1−a ≤ 100·RTP/x (x whole, a in [0,1)).
  const targets = [101, 150, 200, 500, 1_000, 10_000, 100_000];
  for (const x of targets) {
    const ret = (x / 100) * A.holdChance(x);
    if (Math.abs(ret - A.ASCENT_RTP) > 1e-12) fails.push(`Eclipse Ascent: cash-out at ${x} returns ${ret}`);
  }
  // Simulate: the break-point tail, the instant-break share, and whole rounds.
  const r = rng.seededRng('economy-sim:crash');
  const crashes = new Array(rounds);
  for (let i = 0; i < rounds; i++) crashes[i] = A.drawAscent(r).crash;
  for (const x of targets.slice(0, 5)) {
    const hit = crashes.filter(c => c >= x).length / rounds;
    const p = A.holdChance(x);
    const se = Math.sqrt((p * (1 - p)) / rounds);
    if (Math.abs(hit - p) > 4 * se + 1e-12) fails.push(`Eclipse Ascent: P(≥${x}) simulated ${hit}, exact ${p}`);
    if (!quiet) console.log(`  P(holds to ${A.fmtX(x)}) simulated ${pctS(hit)} · exact ${pctS(p)}`);
  }
  const instant = crashes.filter(c => c === A.ASCENT_FLOOR).length / rounds;
  const instantExact = 1 - A.holdChance(A.ASCENT_MIN_CASH);
  const instantSe = Math.sqrt((instantExact * (1 - instantExact)) / rounds);
  if (Math.abs(instant - instantExact) > 4 * instantSe) fails.push(`Eclipse Ascent: ${pctS(instant)} instant breaks, exact ${pctS(instantExact)}`);
  // Whole rounds at bet 10 with a log-uniform target from ×1.01 to ×100.
  const xs = new Array(rounds);
  for (let i = 0; i < rounds; i++) {
    const target = Math.max(A.ASCENT_MIN_CASH, Math.floor(101 * Math.exp(r() * Math.log(100))));
    xs[i] = A.playAscentRound(r, 10, target).win / 10;
  }
  const { mean, se } = moments(xs);
  if (Math.abs(mean - A.ASCENT_RTP) > 4 * se) fails.push(`Eclipse Ascent: ${rounds} rounds returned ${pctS(mean)} (> 4 s.e. ${pctS(se)} from ${pctS(A.ASCENT_RTP)})`);
  if (!quiet) {
    console.log(`Eclipse Ascent · exact: a cash-out at any ×x from ×1.01 to ×1,000 returns ${pctS(A.ASCENT_RTP)}; 1 − RTP/1.01 = ${pctS(instantExact)} of launches break at ×1.00 (simulated ${pctS(instant)})`);
    console.log(`  simulated: ${fmtN(rounds)} rounds at bet 10, log-uniform target ×1.01–×100 → ${pctS(mean)} ± ${pctS(se)}`);
  }
  console.log(`economy-sim crash: exact ${pctS(A.ASCENT_RTP)} at every target, simulated ${pctS(mean)} ± ${pctS(se)}`);
  return fails;
}

function runGame(fn, opts) {
  const fails = fn(opts);
  for (const f of fails) console.error(`  FAIL ${f}`);
  if (fails.length) process.exit(1);
  console.log('  ok');
}

if (argv.plinko) {
  runGame(plinkoScenario, { plays: Number(argv.plays ?? 1_000_000), quiet: false });
} else if (argv.mines) {
  runGame(minesScenario, { rounds: Number(argv.rounds ?? 2_000_000), quiet: false });
} else if (argv.crash) {
  runGame(crashScenario, { rounds: Number(argv.rounds ?? 2_000_000), quiet: false });
} else if (argv.reels) {
  const fails = reelsScenario({ rounds: Number(argv.rounds ?? 2_000_000), plays: Number(argv.plays ?? 1_000_000), quiet: false });
  for (const f of fails) console.error(`  FAIL ${f}`);
  if (fails.length) process.exit(1);
  console.log('  ok');
} else if (argv.underhearth && !argv.check) {
  const fails = underhearthScenario({ quiet: false });
  if (fails.length) process.exit(1);
  console.log('  ok');
} else if (argv.fishing && !argv.check) {
  const fails = fishingScenario({ quiet: false });
  if (fails.length) process.exit(1);
  console.log('  ok');
} else if (argv.levels && !argv.check) {
  const fails = levelsScenario({ quiet: false });
  for (const f of fails) console.error(`  FAIL ${f}`);
  if (fails.length) process.exit(1);
  console.log('  ok');
} else if (argv.pets && !argv.check) {
  const fails = petsScenario({ quiet: false });
  if (fails.length) process.exit(1);
  console.log('  ok');
} else if (argv.living && !argv.check) {
  const fails = livingScenario({ quiet: false });
  if (fails.length) process.exit(1);
  console.log('  ok');
} else if (argv.eclipse && !argv.check) {
  const fails = eclipseScenario({ quiet: false });
  if (fails.length) process.exit(1);
  console.log('  ok');
} else if (argv.cabinets && !argv.check) {
  const fails = cabinetsScenario({ quiet: false });
  if (fails.length) process.exit(1);
  console.log('  ok');
} else if (argv.heights && !argv.check) {
  const fails = heightsScenario({ quiet: false });
  if (fails.length) process.exit(1);
  console.log('  ok');
} else if (argv.bounties && !argv.check) {
  const fails = bountiesScenario({ quiet: false });
  if (fails.length) process.exit(1);
  console.log('  ok');
} else if (argv.inventory) {
  inventoryScenario(PROPOSED);
} else if (argv.place) {
  place(String(argv.place).split(',').map(Number));
} else if (argv.check) {
  check(PROPOSED);
} else {
  console.log(`Eclipse Realms economy sim · ${DAYS} day(s) · node scripts/economy-sim.mjs ${process.argv.slice(2).join(' ')}\n`);
  console.log(report(CURRENT));
  console.log();
  console.log(report(PROPOSED));
  if (argv.stages) {
    console.log('\nPROPOSED stage table (what N seconds of income means at each stage):');
    console.log(stageTable(PROPOSED));
    console.log('\nCURRENT stage table:');
    console.log(stageTable(CURRENT));
  }
}
