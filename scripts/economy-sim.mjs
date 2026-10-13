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
  // The Reels: RTP band and bet caps (a quick proof; --reels runs the full one).
  fails.push(...reelsScenario({ rounds: 300_000, plays: 0, quiet: true }));
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

if (argv.reels) {
  const fails = reelsScenario({ rounds: Number(argv.rounds ?? 2_000_000), plays: Number(argv.plays ?? 1_000_000), quiet: false });
  for (const f of fails) console.error(`  FAIL ${f}`);
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
