/**
 * bounty.model.ts — the Board Herald's three daily Delve bounties
 * (docs/world/delve-and-beyond.md §7.2, Phase 7 slice 7.5;
 * docs/handoff/bounties-map-v2.md).
 *
 * Pim Larkin, the Board Herald (life.ts), reads three bounties off the Quest
 * Board every day. They are DRAWN, not authored: a pure function of the
 * player's Delve seed, the calendar day, the deepest stratum reached and the
 * explored frontier east and west of the core, so the same player sees the
 * same three on every device that draws them that day, and two players see
 * different ones. Every bounty sends the Keeper into the endless Delve:
 *
 *   reach      walk N sector columns past the explored frontier, east or west
 *   dig        break N of one stratum's veins (a pickaxe, an axe, a sickle)
 *   structure  find one of a stratum's structures (a ruin, a waycache, a lake…)
 *   catch      land N fish in a lake past the core's walls
 *   torch      light N torches in a stratum
 *
 * Only strata the Keeper has reached are named. Each pays on rule I (5, 10 or
 * 15 minutes of income, with a floor) and Delving XP; `economy-sim --bounties`
 * holds them to the curve. The first bounty ever claimed comes with the Broken
 * Astral Compass, and every seventh day a bounty is claimed (days, never a
 * streak) with a Rift Map Fragment (map-tools.model.ts).
 *
 * Pure: imports only the import-free economy curve, so the economy sim and the
 * node tests load it as is.
 */
import { itemScaled } from '../economy/economy-curve';
import type { Bounty, BountyBoard, BountyKind } from './bounty-save.model';

export type { Bounty, BountyBoard, BountyKind } from './bounty-save.model';

/** The four shipped strata's first row past each (EMBER_DELVE biomes' `to`; pinned by the spec). */
export const STRATUM_ROWS: readonly number[] = [12, 26, 40, 56];
export const STRATUM_IDS: readonly string[] = ['root-hollows', 'basalt-caverns', 'glowcap-grotto', 'magma-halls'];
/** The core's sector columns are 0..3 (120 cells); the first wing column east is 4, west −1. */
export const CORE_EAST_SX = 3;
export const CORE_WEST_SX = 0;
/** World columns the hand-made core spans. */
export const CORE_COLS = 120;

export function stratumOfRow(row: number): number {
  for (let s = 0; s < STRATUM_ROWS.length; s++) if (row < STRATUM_ROWS[s]) return s;
  return STRATUM_ROWS.length - 1;
}

/** What one tier pays: seconds of income (rule I), a Gold floor (v2 figure × ρ), Delving XP. */
export interface BountyReward { goldSeconds: number; gold: number; delvingXp: number }
/** 5, 10 and 15 minutes of income: inside the daily band (REWARD_SECONDS.daily, 5–20 min). */
export const BOUNTY_REWARDS: Readonly<Record<1 | 2 | 3, BountyReward>> = {
  1: { goldSeconds: 5 * 60, gold: itemScaled(4_000), delvingXp: 40 },
  2: { goldSeconds: 10 * 60, gold: itemScaled(8_000), delvingXp: 70 },
  3: { goldSeconds: 15 * 60, gold: itemScaled(14_000), delvingXp: 110 },
};
/** Bounties a day. */
export const BOUNTIES_PER_DAY = 3;
/** Every this-many claim days, Pim adds a Rift Map Fragment. */
export const FRAGMENT_EVERY = 7;
export const COMPASS_ID = 'broken-astral-compass';
export const FRAGMENT_ID = 'rift-map-fragment';

/** Gold a claim pays: the floor, or the seconds of income when that is more. Whole Gold. */
export function bountyGold(reward: BountyReward, perSecond: number): number {
  const floor = Math.max(0, Math.floor(reward.gold));
  if (!Number.isFinite(perSecond) || perSecond <= 0) return floor;
  return Math.max(floor, Math.floor(perSecond * reward.goldSeconds));
}

// ── Templates ────────────────────────────────────────────────────────────────

interface Template { kind: Exclude<BountyKind, 'reach'>; stratum: number; target: string; n: readonly [number, number] }

/** What each stratum can ask for. Only veins a starting tool works, only structures the stratum holds. */
export const BOUNTY_TEMPLATES: readonly Template[] = [
  { kind: 'dig', stratum: 0, target: 'shadow-root', n: [3, 6] },
  { kind: 'dig', stratum: 0, target: 'petrified-trunk', n: [3, 5] },
  { kind: 'structure', stratum: 0, target: 'ruin', n: [1, 1] },
  { kind: 'torch', stratum: 0, target: 'torch', n: [3, 4] },
  { kind: 'dig', stratum: 1, target: 'cinder-vein', n: [6, 10] },
  { kind: 'structure', stratum: 1, target: 'waycache', n: [1, 1] },
  { kind: 'structure', stratum: 1, target: 'maw-den', n: [1, 1] },
  { kind: 'structure', stratum: 1, target: 'flooded-shaft', n: [1, 1] },
  { kind: 'torch', stratum: 1, target: 'torch', n: [3, 5] },
  { kind: 'dig', stratum: 2, target: 'glowcap', n: [4, 8] },
  { kind: 'structure', stratum: 2, target: 'lake', n: [1, 1] },
  { kind: 'structure', stratum: 2, target: 'rift-shrine', n: [1, 1] },
  { kind: 'catch', stratum: 2, target: 'water', n: [2, 4] },
  { kind: 'dig', stratum: 3, target: 'ember-rock', n: [6, 10] },
  { kind: 'structure', stratum: 3, target: 'lava-basin', n: [1, 1] },
  { kind: 'structure', stratum: 3, target: 'bailiff-hall', n: [1, 1] },
  { kind: 'torch', stratum: 3, target: 'torch', n: [3, 5] },
];

/** What the draw reads: never the clock beyond the day, never Math.random. */
export interface BountyContext {
  /** The player's Delve seed (0 before the first visit). */
  seed: number;
  /** Local calendar day, 'YYYY-MM-DD'. */
  day: string;
  /** Deepest stratum reached, 0..3. */
  deepest: number;
  /** Explored sector columns: the furthest east (≥ CORE_EAST_SX) and west (≤ CORE_WEST_SX). */
  frontierEast: number;
  frontierWest: number;
}

/** 'YYYY-MM-DD' for a date on this device's calendar. */
export function dayKey(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}
/** Days since 1970-01-01 for a day key (a stable integer for the hash). */
export function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** murmur3's finaliser: the same mixer the sector generator uses, so the draw is the same bytes everywhere. */
function mix(x: number): number {
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = mix((s + 0x9e3779b9) >>> 0); return s / 4294967296; };
}

/**
 * Today's three bounties. Slot 0 is always a "reach" (the endless Delve's own
 * verb); slots 1 and 2 are two different kinds from the strata reached. Pure
 * and deterministic: the same context always draws the same board.
 */
export function drawBounties(ctx: BountyContext): BountyBoard {
  const deepest = Math.max(0, Math.min(3, Math.floor(ctx.deepest) || 0));
  const random = rng(mix((ctx.seed >>> 0) ^ Math.imul(dayNumber(ctx.day), 0x27d4eb2f)));
  const list: Bounty[] = [];
  // Reach: 1-3 sector columns past the frontier, east or west.
  const east = random() < .5;
  const steps = 1 + Math.floor(random() * 3);
  const from = east ? Math.max(CORE_EAST_SX, ctx.frontierEast) : Math.min(CORE_WEST_SX, ctx.frontierWest);
  const sx = east ? from + steps : from - steps;
  const past = east ? sx - CORE_EAST_SX : CORE_WEST_SX - sx;
  list.push({ id: `${ctx.day}:0:reach:${east ? 'east' : 'west'}:${past}`, slot: 0, kind: 'reach', tier: steps as 1 | 2 | 3, stratum: 0, target: east ? 'east' : 'west', n: past, sx });
  // Two more, of two different kinds, from the strata reached (deeper ones a little likelier).
  const pool = BOUNTY_TEMPLATES.filter(t => t.stratum <= deepest);
  const used = new Set<BountyKind>();
  for (let slot = 1; slot < BOUNTIES_PER_DAY; slot++) {
    const open = pool.filter(t => !used.has(t.kind));
    if (!open.length) break;
    const weights = open.map(t => 1 + t.stratum);
    let roll = random() * weights.reduce((a, b) => a + b, 0), pick = open[open.length - 1];
    for (let i = 0; i < open.length; i++) { roll -= weights[i]; if (roll < 0) { pick = open[i]; break; } }
    used.add(pick.kind);
    const [lo, hi] = pick.n;
    const n = lo + Math.floor(random() * (hi - lo + 1));
    // The top of a range, or a deep stratum, pays more.
    const span = hi - lo, share = span ? (n - lo) / span : .5;
    const tier = Math.max(1, Math.min(3, Math.round(1 + share + pick.stratum / 3))) as 1 | 2 | 3;
    list.push({ id: `${ctx.day}:${slot}:${pick.kind}:${pick.target}:${n}`, slot, kind: pick.kind, tier, stratum: pick.stratum, target: pick.target, n });
  }
  return { day: ctx.day, deepest, list };
}

// ── Reading progress ─────────────────────────────────────────────────────────

/** A thing that happened in the Delve, offered to every bounty on today's board. */
export type BountyEvent =
  /** A generated cell broke (`node` its terrain id) at `row`; `token` is the cell. */
  | { kind: 'dig'; node: string; row: number; token: string }
  /** A torch was placed at `row`; `token` is the cell. */
  | { kind: 'torch'; row: number; token: string }
  /** A fish was landed from `liquid` at world column `col`, `row`; `token` is the cast. */
  | { kind: 'catch'; liquid: string; col: number; row: number; token: string }
  /** The Keeper stood inside a generated structure; `token` names it. */
  | { kind: 'structure'; structure: string; token: string };

/** Whether `event` counts toward `b` (a token is still only counted once, by the caller). */
export function bountyCounts(b: Bounty, event: BountyEvent): boolean {
  switch (event.kind) {
    case 'dig': return b.kind === 'dig' && b.target === event.node && stratumOfRow(event.row) === b.stratum;
    case 'torch': return b.kind === 'torch' && stratumOfRow(event.row) === b.stratum;
    // A lake past the core's walls (the wings' lakes and lava basins), never the core's own Mere.
    case 'catch': return b.kind === 'catch' && b.target === event.liquid && (event.col < 0 || event.col >= CORE_COLS);
    case 'structure': return b.kind === 'structure' && b.target === event.structure;
  }
}

/** How far a bounty has got: counted tokens, or (reach) whether the frontier has passed its column. */
export function bountyObserved(b: Bounty, tokens: readonly string[], frontier: { east: number; west: number }): number {
  if (b.kind === 'reach') {
    const there = b.target === 'east' ? frontier.east >= (b.sx ?? Infinity) : frontier.west <= (b.sx ?? -Infinity);
    return there ? b.n : Math.max(0, Math.min(b.n - 1, b.target === 'east' ? frontier.east - CORE_EAST_SX : CORE_WEST_SX - frontier.west));
  }
  return Math.min(b.n, tokens.length);
}

/** The i18n key and variables of a bounty's one plain line (bounties.i18n.ts). */
export function bountyLine(b: Bounty): { key: string; vars: Record<string, string | number> } {
  const stratum = `bounty.stratum.${STRATUM_IDS[b.stratum]}`;
  switch (b.kind) {
    case 'reach': return { key: `bounty.line.reach.${b.target}`, vars: { n: b.n } };
    case 'dig': return { key: `bounty.line.dig.${b.target}`, vars: { n: b.n, stratum } };
    case 'structure': return { key: `bounty.line.structure.${b.target}`, vars: {} };
    case 'catch': return { key: `bounty.line.catch.${b.target}`, vars: { n: b.n } };
    case 'torch': return { key: 'bounty.line.torch', vars: { n: b.n, stratum } };
  }
}
