#!/usr/bin/env node
/**
 * Eclipse Realms economy simulator — CURRENT vs PROPOSED Gold curve.
 *
 * Pure Node, no Angular imports. Every number is re-declared here and each
 * CURRENT value cites the file:line it was read from (origin/main a0c9efe), so
 * a drift between this file and the game is a grep away. See
 * docs/economy/rebalance-spec.md for the design this script justifies.
 *
 *   node scripts/economy-sim.mjs                 # both economies, default player
 *   node scripts/economy-sim.mjs --cps=6         # active click attempts per second
 *   node scripts/economy-sim.mjs --idleCpm=0     # clicks/min while the tab idles
 *   node scripts/economy-sim.mjs --no-expeditions
 *   node scripts/economy-sim.mjs --days=30
 *   node scripts/economy-sim.mjs --stages        # print the PROPOSED stage table
 *
 * The player is greedy-with-patience: at every decision point it picks the
 * purchase minimising (seconds to afford) + (payback seconds = cost / Δincome)
 * and buys it as soon as it is affordable. Clicks are throttled by the game's
 * strike cooldown, exactly as EconomyService.strike() does. Offline gaps pay
 * min(gap, cap) × Gold/s on return, as settleIdle() does. Deterministic: the
 * golden-spark and expedition rolls use a seeded RNG.
 */

// ───────────────────────────────────────────────────────────────────────────
// Economies
// ───────────────────────────────────────────────────────────────────────────

const CURRENT = {
  name: 'CURRENT',
  clickBase: 1,              // economy.model.ts:255 BASE_GOLD_PER_CLICK
  clickCooldownMs: 500,      // economy.service.ts:135 CLICK_COOLDOWN_MS
  centuryBonus: 10,          // economy.service.ts strike(): +10 every 100th strike
  idleFloor: 0.1,            // economy.model.ts:253 BASE_IDLE_PER_SECOND
  priceScale: 1.25,          // economy.model.ts:285 PRICE_SCALE
  offlineCapS: 8 * 3600,     // economy.service.ts:115 MAX_OFFLINE_SECONDS
  // economy.model.ts:343-436 FORGE_UPGRADES
  buildings: [
    ['forge-bellows', 5_000, 0.5, true],
    ['ember-stoker', 20_000, 1],
    ['nether-furnace', 50_000, 2],
    ['eclipse-core', 200_000, 5],
    ['godforge-heart', 1_000_000, 10],
    ['realm-conduit', 5_000_000, 25],
    ['aether-siphon', 20_000_000, 50],
    ['nox-harvester', 50_000_000, 100],
    ['eclipse-reactor', 200_000_000, 250],
    ['the-first-sun', 1_000_000_000, 1_000],
  ],
  // economy.model.ts:457-511 HAMMER_UPGRADES  [id, cost, +perStrike, shareOfRate]
  hammers: [
    ['iron-hammer', 10_000, 2, 0],
    ['obsidian-mallet', 50_000, 5, 0],
    ['aether-striker', 200_000, 10, 0],
    ['nox-crusher', 500_000, 20, 0],
    ['eclipse-hammer', 2_000_000, 50, 0],
  ],
  // economy.model.ts:532-569 MULTIPLIER_UPGRADES (single purchase)
  multipliers: [
    ['forge-efficiency-i', 100_000, 0.10],
    ['forge-efficiency-ii', 1_000_000, 0.25],
    ['forge-efficiency-iii', 10_000_000, 0.50],
    ['forge-mastery', 100_000_000, 1.00],
  ],
  // economy.model.ts:599-627 AUTO_CLICKERS
  autos: [
    ['apprentice-striker', 500_000, 1],
    ['forge-golem', 5_000_000, 5],
    ['eclipse-automaton', 50_000_000, 20],
  ],
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
  prestige: { threshold: 1e9, shards: (t) => Math.floor(Math.sqrt(t / 100_000)) },
  // one-off sinks, for "time until you could first afford it"
  sinks: {
    'rune strike (Common)': 10_000,      // rune-forge/rune.model.ts:157 STRIKE_COST
    'gambler Iron Chest': 5_000,         // gambler/mystery-box.ts:78
    'cheapest craft fee': 4_000,         // crafting/crafting.model.ts:183-396 (uncommon min)
    'vendor regional unit': 6_000,       // vendor/material-vendor.model.ts:67
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
 * PROPOSED — Cookie-shaped. Rungs ~×7–15 apart in price and ×6–8 in rate, so
 * the payback (cost / rate) grows ~×1.5–2 per rung: 150 s, 100 s, 138 s, 255 s,
 * 500 s, 1,000 s… exactly the "each tier is a bit worse per Gold but much more
 * per click of attention" shape Cookie Clicker uses. PRICE_SCALE 1.15.
 */
const PROPOSED = {
  name: 'PROPOSED',
  clickBase: 1,
  clickCooldownMs: 125,      // 8 strikes/s ceiling: a human at 4–6/s is never throttled
  centuryBonus: 0,           // replaced by "100th strike = 10 strikes' worth" (scales); modelled below
  centuryStrikes: 10,
  idleFloor: 0,              // Cookie has none; the first Bellows is the floor
  priceScale: 1.15,
  offlineCapS: 8 * 3600,     // unchanged; offline pays at OFFLINE_RATE
  offlineRate: 1,            // unchanged: offline pays full rate (try 0.5 via --offlineRate)
  buildings: [
    ['forge-bellows', 15, 0.1],
    ['ember-stoker', 100, 1],
    ['nether-furnace', 1_100, 8],
    ['eclipse-core', 12_000, 47],
    ['godforge-heart', 130_000, 260],
    ['realm-conduit', 1_400_000, 1_400],
    ['aether-siphon', 20_000_000, 7_800],
    ['nox-harvester', 330_000_000, 44_000],
    ['eclipse-reactor', 5_100_000_000, 260_000],
    ['the-first-sun', 75_000_000_000, 1_600_000],
  ],
  // Hammers become SINGLE-PURCHASE (Cookie's click upgrades): flat +strike
  // early, then "+N% of Gold/s per strike" (Cookie's mouse upgrades) so the
  // Flame never stops mattering. Repeatable hammers × automatons is a product
  // of two bought counts — the quadratic engine that blows CURRENT up on day 3.
  singleHammers: true,
  hammers: [
    ['iron-hammer', 100, 1, 0],
    ['obsidian-mallet', 500, 2, 0],
    ['aether-striker', 10_000, 0, 0.01],
    ['nox-crusher', 1_000_000, 0, 0.02],
    ['eclipse-hammer', 100_000_000, 0, 0.03],
  ],
  multipliers: [
    ['forge-efficiency-i', 5_000, 0.10],
    ['forge-efficiency-ii', 250_000, 0.25],
    ['forge-efficiency-iii', 25_000_000, 0.50],
    ['forge-mastery', 2_500_000_000, 1.00],
  ],
  // Automatons strike at the FLAT click value only (no %-of-rate share — that
  // share × an exponential-cost-but-linear-gain count still runs away). They
  // are the early "hands-free" rung and fade later, as Cookie's cursors do.
  autos: [
    ['apprentice-striker', 200, 1],
    ['forge-golem', 5_000, 5],
    ['eclipse-automaton', 250_000, 20],
  ],
  // Payout = max(floor, k × duration × Gold/s at launch) — "N seconds of
  // income". k < 1 everywhere: a mission is a *top-up* on the forge, never a
  // replacement for it (CURRENT's flat 7.5k Scout is 12× the starting forge).
  // Each extra explorer slot is then worth ≈ k × 100% more active income.
  expeditions: [
    { id: 'scout', durS: 120, fee: 0, floor: 90, k: 0.5 },
    { id: 'delve', durS: 600, fee: 300, floor: 600, k: 0.4 },
    { id: 'expedition', durS: 3600, fee: 2_500, floor: 4_000, k: 0.33 },
    { id: 'deep-dive', durS: 4 * 3600, fee: 25_000, floor: 30_000, k: 0.25 },
    { id: 'grand', durS: 24 * 3600, fee: 400_000, floor: 300_000, k: 0.15 },
  ].map(m => ({ ...m, pay: (gps) => Math.max(m.floor, m.k * m.durS * gps) })),
  // Golden Spark: sitewide, 5–10 min apart while visible, 13 s to catch.
  //  85% Windfall: 60 s of income, rising to min(15% of bank, 900 s of income)
  //  15% Forge Frenzy: ×5 income for 60 s  (≈ 240 s of extra income)
  spark: {
    minS: 300, maxS: 600, catch: 0.7,
    pay: (gps, bank) => Math.max(gps * 60, Math.min(bank * 0.15, gps * 900)) + 25,
    frenzy: { p: 0.15, mult: 5, durS: 60 },
  },
  // First Eclipse at 1e13 all-time (~3 days); cube root like Cookie's heavenly chips.
  prestige: { threshold: 1e13, shards: (t) => Math.floor(Math.cbrt(t / 1e10)) },
  sinks: {
    'rune strike (Common)': 600,
    'gambler Iron Chest': 300,
    'cheapest craft fee': 1_000,
    'vendor regional unit': 360,
    'Delve fee': 300,
    'reforge Common': 150,
    'temper +1 (base)': 6_000,
    'Thrall (cheapest tier)': 25_000,
    'respec': 20_000,
    'explorer slot #2': 50_000,
    'market explorer hire': 60_000,
    'Thrall pull': 60_000,
    'thrall slot #6': 2_000_000,
    'epic craft fee (min)': 150_000,
    'legendary craft fee (min)': 2_500_000,
    'mythic craft (Eclipse Edge)': 60_000_000,
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
  const log = { buys: [], milestones: {}, at: {}, sinks: {}, sparkGold: 0, expGold: 0, offlineGold: 0 };
  const sinkNames = Object.keys(E.sinks);
  let nextSpark = E.spark.minS + R() * (E.spark.maxS - E.spark.minS);
  let exp = null; // { endsAt, pay }
  let clickDebt = 0;
  const checkpoints = [60, 5 * 60, 10 * 60, 30 * 60, 3600, 3 * 3600, 86400, 3 * 86400, 7 * 86400, 14 * 86400, 30 * 86400];
  let cp = 0;

  const earn = (g, src) => { S.bank += g; S.total += g; if (src) log[src] += g; };
  const record = () => {
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
