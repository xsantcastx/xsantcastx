/**
 * homestead-render.ts — the Homestead drawn into the side-scroller's canvas.
 *
 * The engine knows nothing about the economy. It holds an optional
 * `HomesteadView` (set with `engine.setHomesteadView`) and, each frame, calls
 * `draw()` in world space after the ground and before the stations; it skips
 * the body of any station the view `paints()`, and lets the view take over an
 * interaction with `interact()`. Everything here is presentation: the numbers
 * come in through `setModel()` from HomesteadService, which reads them off the
 * real services, and nothing in this file credits, prices or persists.
 *
 * Layout helpers are pure functions (tested under node in
 * scripts/homestead.test.cjs); the scene class keeps only short-lived effects.
 * Placeholder art is drawn in code; real paintings come through `frame.art`
 * (the engine's `artFor()` resolver), never a hand-written asset path.
 */
import { cycleAt, journeyAt, progressAt } from '../../shared/expedition/works-map.model';
import {
  HOME_FORGE_STATIONS, HOMESTEAD_BUILDINGS, HOMESTEAD_FORGE_STATION, HOMESTEAD_GATE_ID, HOMESTEAD_GATE_X, HOMESTEAD_ID,
  HomesteadBuildingId, buildingOfStation, homeStationOf,
} from '../world/homestead';
import type { HomeStationId } from '../../shared/minigames/home-forge.model';
import { collectable, emptyLedger, hasPending, homesteadT, Pending, PendingLedger, pendingLine } from '../homestead/homestead.model';
import { blit, HomesteadPixels, HP } from './homestead-pixel';
import { paintWorld } from './hub-pixel';
import { KeeperPainter } from '../../shared/keeper-look/keeper-paint';
import { townsfolkLook } from '../../shared/keeper-look/npc-looks';

/** A canvas can be made (a browser; not SSR or the node harness). The pixel figures and props need one. */
const canPaint = typeof document !== 'undefined' && typeof document.createElement === 'function';
/** Snap a height above the floor to the figures' 4 px grid (the floor line is the grid's origin). */
const up = (h: number) => Math.round(h / 4) * 4;

const FLOOR = 610;

/** What the engine hands the view each frame. Reused by the engine, so never keep a reference. */
export interface HomesteadFrame {
  /** The area being drawn ('infernal', 'homestead', a hunt…). */
  areaId: string;
  camera: number;
  viewport: number;
  /** Motion clock in seconds; 0 under reduced motion. */
  time: number;
  playerX: number;
  reduced: boolean;
  /** Draws an `artFor()` key; false until the image has loaded. */
  art: (key: string | undefined, x: number, y: number, width: number, height: number) => boolean;
}

/** The engine's whole contract with the Homestead. */
export interface HomesteadView {
  /** Draw in world space (the camera translate is already applied). Called every frame, every area. */
  draw(c: CanvasRenderingContext2D, frame: HomesteadFrame): void;
  /** True when the view paints this station's body; the engine then draws only its label and prompt. */
  paints(areaId: string, stationId: string): boolean;
  /** True when the view handled the Keeper's interaction with this station (the engine then does nothing else). */
  interact(areaId: string, stationId: string): boolean;
}

/** Real state, as the scene draws it. Built by HomesteadService from the live services. */
export interface HomesteadModel {
  gold: number;
  perSecond: number;
  perClick: number;
  /** Levels held per Furnace rung (forge ladder), cheapest first. */
  furnace: readonly number[];
  /** Levels held per automaton rung, cheapest first (apprentice, golem, eclipse). */
  automatons: readonly number[];
  /** Treasury multipliers held. */
  multipliers: number;
  explorers: { slots: number; idle: number; out: readonly { startedAt: number; duration: number; color: string }[] };
  thralls: readonly { working: boolean; lastRollAt: number; rollInterval: number; color: string }[];
  /** Plain "Unlock: … · cost" signs on unbuilt plots. */
  signs: Partial<Record<HomesteadBuildingId, string>>;
  /** Tiers (1..4) of the player's own Anvil and Enchanting Circle (home-forge model). */
  homeForge: Record<HomeStationId, number>;
}

export function emptyModel(): HomesteadModel {
  return { gold: 0, perSecond: 0, perClick: 1, furnace: [], automatons: [], multipliers: 0, explorers: { slots: 1, idle: 0, out: [] }, thralls: [], signs: {}, homeForge: { anvil: 1, circle: 1 } };
}

// ── Pure layout ──────────────────────────────────────────────────────────────

const X: Record<HomesteadBuildingId, number> = Object.fromEntries(
  HOMESTEAD_BUILDINGS.map(s => [buildingOfStation(s.id)!, s.x]),
) as Record<HomesteadBuildingId, number>;
/** World x of a building. */
export function buildingX(id: HomesteadBuildingId): number { return X[id]; }

const HOME_X: Record<HomeStationId, number> = Object.fromEntries(
  HOME_FORGE_STATIONS.map(s => [homeStationOf(s.id)!, s.x]),
) as Record<HomeStationId, number>;
/** World x of the player's own Anvil / Enchanting Circle. */
export function homeStationX(id: HomeStationId): number { return HOME_X[id]; }

/** Where the plot's fence ends: just past the last station. */
export const FENCE_END = Math.max(...[...HOMESTEAD_BUILDINGS, ...HOME_FORGE_STATIONS].map(s => s.x)) + 160;

/**
 * How the home Anvil looks at `tier` (1..4): it grows a little each tier, and
 * from tier II its face glows, brighter each tier. Pure, for the node test.
 */
export function anvilLook(tier: number): { scale: number; glow: number } {
  const t = Math.min(4, Math.max(1, Math.floor(Number.isFinite(tier) ? tier : 1)));
  return { scale: 1 + (t - 1) * 0.14, glow: t <= 1 ? 0 : 0.35 + (t - 2) * 0.3 };
}

/** How bright the Enchanting Circle's runes burn at `tier` (1..4), 0.25..1, and how many of its ten are lit. */
export function circleLook(tier: number): { bright: number; runes: number } {
  const t = Math.min(4, Math.max(1, Math.floor(Number.isFinite(tier) ? tier : 1)));
  return { bright: 0.25 + (t - 1) * 0.25, runes: 2 + t * 2 };
}

/** Most figures drawn per building; the panel says the true count. Ten pixel automatons fit round one anvil. */
export const MAX_FIGURES = 10;

/** Automaton figure slots: two rows around the anvil, centred on `cx`. */
export function automatonSlots(count: number, cx: number): { x: number; y: number; row: number }[] {
  const n = Math.max(0, Math.min(MAX_FIGURES, Math.floor(count)));
  const out: { x: number; y: number; row: number }[] = [];
  const perRow = 5;
  for (let i = 0; i < n; i++) {
    const row = i < perRow ? 0 : 1;
    const inRow = row === 0 ? Math.min(n, perRow) : n - perRow;
    const k = row === 0 ? i : i - perRow;
    // A pixel automaton is 10–14 art px (40–56 px) wide: 48 px apart, the back row a step up.
    const spacing = 48;
    out.push({ x: cx + (k - (inRow - 1) / 2) * spacing + row * 24, y: FLOOR - row * 16, row });
  }
  return out;
}

/** Tent x positions for `n` slots around the camp centre. */
export function tentSlots(n: number, cx: number): number[] {
  const count = Math.max(1, Math.min(6, Math.floor(n)));
  // A pixel tent is 18 art px (72 px) wide; the row sits east of the camp's centre, the fire west of it.
  return Array.from({ length: count }, (_, i) => cx + 60 + (i - (count - 1) / 2) * 76);
}

/** How far an explorer walks off before they are "at the site" (world px). */
export const EXPEDITION_WALK = 300;

/**
 * Where an explorer out on a mission is drawn, from its real start + duration
 * (the Works map's journey maths). Null while at the site (out of sight).
 */
export function explorerWalk(startedAt: number, duration: number, now: number, campX: number): { x: number; alpha: number; facing: 1 | -1 } | null {
  const j = journeyAt(progressAt(startedAt, duration, now));
  if (j.phase === 'site') return null;
  if (j.phase === 'home') return { x: campX, alpha: 1, facing: -1 };
  const x = campX + 70 + j.along * EXPEDITION_WALK;
  const alpha = Math.max(0, Math.min(1, (1 - j.along) / 0.3));
  return { x, alpha, facing: j.phase === 'out' ? 1 : -1 };
}

/** Coin piles in the Treasury: one per order of magnitude of Gold held, 0–9. */
export function vaultPiles(gold: number): number {
  return Math.max(0, Math.min(9, Math.floor(Math.log10(Math.max(1, gold)))));
}

/** Furnace size: 0 = empty plot, else a body that widens with levels (log). */
export function furnaceScale(levels: number): number {
  return levels <= 0 ? 0 : Math.min(1.8, 1 + Math.log2(levels) * 0.12);
}

/** The forge's squash after a strike, 1 → 0.86 → 1 over 220ms. Reduced motion: always 1. */
export function forgeSquash(sinceStrikeMs: number, reduced: boolean): number {
  if (reduced || !(sinceStrikeMs >= 0) || sinceStrikeMs > 220) return 1;
  const t = sinceStrikeMs / 220;
  return 1 - 0.14 * Math.sin(t * Math.PI) * (1 - t * 0.3);
}

/** Pending Gold as a compact bubble label. */
export function compact(n: number): string {
  const a = Math.abs(n);
  const f = (v: number) => (v >= 100 ? v.toFixed(0) : v.toFixed(1)).replace(/\.0$/, '');
  return a >= 1e9 ? `${f(n / 1e9)}B` : a >= 1e6 ? `${f(n / 1e6)}M` : a >= 1e3 ? `${f(n / 1e3)}K` : String(Math.floor(n));
}

// ── The scene ────────────────────────────────────────────────────────────────

interface Fx { x: number; y: number; vx: number; vy: number; born: number; life: number; color: string; size: number; text?: string; big?: boolean }
interface Arc { fromX: number; toX: number; born: number; life: number }

const GOLD = '#ffd36d';
const EMBER = '#ff9a5a';
const VIOLET = '#c9a0ff';
const INK = '#fff1c9';
const MAX_FX = 160;

export class HomesteadScene implements HomesteadView {
  private model: HomesteadModel = emptyModel();
  private readonly ledger: PendingLedger = emptyLedger();
  private readonly lastCollect: Partial<Record<HomesteadBuildingId, number>> = {};
  private readonly flash: Partial<Record<HomesteadBuildingId, number>> = {};
  private readonly homeFlash: Partial<Record<HomeStationId, number>> = {};
  private fx: Fx[] = [];
  private arcs: Arc[] = [];
  private strikeAt = -Infinity;
  private strikes = 0;
  private autoBeatAt = -Infinity;
  private goldenAt = -Infinity;
  private vaultBump = -Infinity;
  private reduced = false;
  private readonly buildings = HOMESTEAD_BUILDINGS.map(s => ({ id: buildingOfStation(s.id)!, x: s.x }));
  /** The pixel figures and props (homestead-pixel.ts); null without a DOM, where the vector placeholders draw. */
  private readonly pixels = canPaint ? new HomesteadPixels() : null;
  /** Explorers are Keepers: one painter per look, kept. */
  private readonly explorerPainters = new Map<string, KeeperPainter>();

  /** Called when the Keeper strikes the Forge (click, tap or E). The host does the economy. */
  onStrike: (() => void) | null = null;
  /** Called when the Keeper interacts with any other building. Return false to let the engine open the panel. */
  onBuilding: ((id: HomesteadBuildingId) => boolean) | null = null;

  private clock(): number { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }

  setModel(model: HomesteadModel): void { this.model = model; }

  /** Pending receipts, for the panel's "since you were last here". Read-only copy. */
  pending(id: HomesteadBuildingId): Pending { return { ...this.ledger[id] }; }

  /** Every building's receipt summed (the Mirror Slate's Homestead tab). Read-only. */
  pendingAll(): Pending {
    const total: Pending = { gold: 0, runes: 0, returns: 0 };
    for (const p of Object.values(this.ledger)) { total.gold += p.gold; total.runes += p.runes; total.returns += p.returns; }
    return total;
  }

  /** Hand over every receipt at once (the Slate's Collect): zeroes them and returns what they held. Display only: already banked. */
  collectAll(): Pending {
    const total = this.pendingAll();
    const wall = Date.now();
    for (const [id, p] of Object.entries(this.ledger) as [HomesteadBuildingId, Pending][]) {
      p.gold = 0; p.runes = 0; p.returns = 0;
      this.lastCollect[id] = wall;
    }
    return total;
  }

  /** Add to a building's "since you were last here" receipt. Display only: the value is already banked. */
  addPending(id: HomesteadBuildingId, add: Partial<Pending>): void {
    const p = this.ledger[id];
    p.gold += add.gold ?? 0; p.runes += add.runes ?? 0; p.returns += add.returns ?? 0;
  }

  // ── Effects the host triggers ──

  /** A strike paid `gold`. Squash, sparks, a "+N" pop and coins flying to the Treasury. */
  strikeFx(gold: number, milestone = false): void {
    const now = this.clock();
    this.strikeAt = now; this.strikes++;
    const x = X.forge;
    this.pushText(x, FLOOR - 250, `+${compact(gold)}`, milestone ? GOLD : INK, milestone, now);
    if (this.reduced) { this.vaultBump = now; return; }
    const n = milestone ? 22 : 7;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - .5) * 2.2;
      const s = 160 + Math.random() * 260;
      this.push({ x: x + (Math.random() - .5) * 40, y: FLOOR - 120, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: now, life: 500 + Math.random() * 300, color: i % 3 ? EMBER : GOLD, size: 2 + Math.random() * 2.5 });
    }
    this.arcs.push({ fromX: x, toX: X.treasury, born: now, life: 650 });
    if (this.arcs.length > 24) this.arcs.shift();
  }

  /** The automatons' once-a-second beat (EconomyService.autoStrike$). */
  autoBeat(): void { this.autoBeatAt = this.clock(); }

  /** A building grew (a purchase landed). Flash it and float the line. */
  grew(id: HomesteadBuildingId, line: string): void {
    const now = this.clock();
    this.flash[id] = now;
    this.pushText(X[id], FLOOR - 270, line, '#a6ffcf', true, now);
    if (this.reduced) return;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      this.push({ x: X[id], y: FLOOR - 90, vx: Math.cos(a) * 220, vy: Math.sin(a) * 160 - 60, born: now, life: 700, color: i % 2 ? GOLD : '#a6ffcf', size: 3 });
    }
  }

  /** A home station was upgraded: a burst and its new tier floating up. */
  homeGrew(id: HomeStationId, line: string): void {
    const now = this.clock();
    const x = HOME_X[id];
    this.homeFlash[id] = now;
    this.pushText(x, FLOOR - 250, line, '#a6ffcf', true, now);
    if (this.reduced) return;
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const color = id === 'anvil' ? (i % 2 ? GOLD : EMBER) : (i % 2 ? VIOLET : GOLD);
      this.push({ x, y: FLOOR - 70, vx: Math.cos(a) * 240, vy: Math.sin(a) * 170 - 70, born: now, life: 800, color, size: 3 });
    }
  }

  /** A coin popping out of a building on an idle tick, landing on its pile. */
  tick(id: HomesteadBuildingId): void {
    if (this.reduced) return;
    const now = this.clock();
    this.push({ x: X[id] + 30, y: FLOOR - 130, vx: 40 + Math.random() * 30, vy: -220, born: now, life: 700, color: GOLD, size: 5 });
  }

  /** A Thrall pulled a rune: a violet shard leaps off the anvil. */
  rune(color = VIOLET): void {
    if (this.reduced) return;
    const now = this.clock();
    this.push({ x: X.workshop + (Math.random() - .5) * 60, y: FLOOR - 70, vx: (Math.random() - .5) * 80, vy: -260, born: now, life: 900, color, size: 6 });
  }

  /**
   * HOOK for the economy rebalance: a "golden spark" burst over the Forge.
   * Presentation only — no reward is attached here. Whatever grants a bonus
   * must credit it through EconomyService and only then call this.
   */
  goldenSpark(): void {
    const now = this.clock();
    this.goldenAt = now;
    this.pushText(X.forge, FLOOR - 300, homesteadT('homestead.canvas.spark'), GOLD, true, now);
    if (this.reduced) return;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, s = 120 + Math.random() * 320;
      this.push({ x: X.forge, y: FLOOR - 170, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: now, life: 1100, color: i % 2 ? GOLD : '#fff6d0', size: 3 + Math.random() * 3 });
    }
  }

  private push(f: Fx): void {
    if (this.fx.length >= MAX_FX) this.fx.shift();
    this.fx.push(f);
  }
  private pushText(x: number, y: number, text: string, color: string, big: boolean, now: number): void {
    this.push({ x, y, vx: 0, vy: this.reduced ? 0 : -40, born: now, life: big ? 2200 : 900, color, size: 0, text, big });
  }

  // ── HomesteadView ──

  paints(areaId: string, stationId: string): boolean {
    if (areaId === HOMESTEAD_ID) return buildingOfStation(stationId) !== null || homeStationOf(stationId) !== null;
    return stationId === HOMESTEAD_GATE_ID && areaId !== HOMESTEAD_ID && this.gateArea(areaId);
  }

  interact(areaId: string, stationId: string): boolean {
    if (areaId !== HOMESTEAD_ID) return false;
    if (stationId === HOMESTEAD_FORGE_STATION) { this.onStrike?.(); return true; }
    const id = buildingOfStation(stationId);
    return id ? (this.onBuilding?.(id) ?? false) : false;
  }

  private gateArea(areaId: string): boolean { return areaId === 'infernal'; }

  draw(c: CanvasRenderingContext2D, frame: HomesteadFrame): void {
    this.reduced = frame.reduced;
    if (this.gateArea(frame.areaId)) { this.drawGate(c, frame); return; }
    if (frame.areaId !== HOMESTEAD_ID) return;
    const now = this.clock();
    const wall = Date.now();
    // Walking past a building hands over its receipt.
    for (const id of collectable(this.ledger, this.buildings, frame.playerX, wall, this.lastCollect)) this.collect(id, now, wall);
    const visible = (x: number) => x > frame.camera - 260 && x < frame.camera + frame.viewport + 260;
    c.save();
    this.drawFence(c, frame);
    if (visible(X.treasury)) this.drawTreasury(c, frame, now);
    if (visible(X.forge)) this.drawForge(c, frame, now);
    if (visible(X.furnace)) this.drawFurnace(c, frame, now);
    if (visible(X.automatons)) this.drawAutomatons(c, frame, now);
    if (visible(X.camp)) this.drawCamp(c, frame, wall);
    if (visible(X.workshop)) this.drawWorkshop(c, frame, wall);
    if (visible(HOME_X.anvil)) this.drawHomeAnvil(c, frame, now);
    if (visible(HOME_X.circle)) this.drawHomeCircle(c, frame, now);
    for (const b of this.buildings) if (visible(b.x)) this.drawPending(c, b.id, frame);
    this.drawArcs(c, now);
    this.drawFx(c, now);
    c.restore();
  }

  private collect(id: HomesteadBuildingId, now: number, wall: number): void {
    const p = this.ledger[id];
    const line = pendingLine(p);
    p.gold = 0; p.runes = 0; p.returns = 0;
    this.lastCollect[id] = wall;
    if (!line) return;
    this.pushText(X[id], FLOOR - 230, line, GOLD, true, now);
    this.vaultBump = now;
    if (this.reduced) return;
    for (let i = 0; i < 14; i++) {
      this.push({ x: X[id] + (Math.random() - .5) * 60, y: FLOOR - 60, vx: (Math.random() - .5) * 140, vy: -300 - Math.random() * 160, born: now, life: 800, color: GOLD, size: 4 });
    }
  }

  // ── Drawing ──

  private label(c: CanvasRenderingContext2D, text: string, x: number, y: number, color = INK, size = 13, weight = 600): void {
    c.font = `${weight} ${size}px system-ui`; c.textAlign = 'center'; c.fillStyle = color; c.fillText(text, x, y);
  }

  /** A wooden sign on two stakes for an unbuilt plot. */
  private drawSign(c: CanvasRenderingContext2D, x: number, text: string): void {
    c.setLineDash([6, 6]); c.strokeStyle = '#a6785888'; c.lineWidth = 2;
    c.strokeRect(x - 90, FLOOR - 70, 180, 70); c.setLineDash([]);
    c.fillStyle = '#5a3d2e'; c.fillRect(x - 4, FLOOR - 120, 8, 120);
    c.font = '600 13px system-ui';
    const w = Math.min(260, c.measureText(text).width + 24);
    c.fillStyle = '#3a2a22'; c.fillRect(x - w / 2, FLOOR - 160, w, 40);
    c.strokeStyle = '#c2a26a'; c.lineWidth = 2; c.strokeRect(x - w / 2, FLOOR - 160, w, 40);
    c.textAlign = 'center'; c.fillStyle = INK; c.fillText(text, x, FLOOR - 135, w - 12);
  }

  private flashGlow(c: CanvasRenderingContext2D, id: HomesteadBuildingId, now: number, w: number): void {
    const t = (now - (this.flash[id] ?? -Infinity)) / 900;
    if (t < 0 || t > 1) return;
    c.save(); c.globalAlpha = (1 - t) * .55; c.fillStyle = '#a6ffcf';
    c.beginPath(); c.ellipse(X[id], FLOOR - 70, w * (0.7 + t * .4), 110, 0, 0, Math.PI * 2); c.fill(); c.restore();
  }

  private drawGate(c: CanvasRenderingContext2D, f: HomesteadFrame): void {
    const x = HOMESTEAD_GATE_X;
    if (x < f.camera - 200 || x > f.camera + f.viewport + 200) return;
    c.save();
    c.fillStyle = '#5a3d2e'; c.fillRect(x - 46, FLOOR - 150, 12, 150); c.fillRect(x + 34, FLOOR - 150, 12, 150);
    c.fillStyle = '#7a5440'; c.fillRect(x - 56, FLOOR - 160, 112, 14);
    const glow = f.reduced ? .5 : .5 + Math.sin(f.time * 2.4) * .5;
    c.shadowColor = GOLD; c.shadowBlur = 8 + glow * 14;
    c.fillStyle = '#3a2a22'; c.fillRect(x - 40, FLOOR - 136, 80, 34);
    c.shadowBlur = 0; c.strokeStyle = '#c2a26a'; c.lineWidth = 2; c.strokeRect(x - 40, FLOOR - 136, 80, 34);
    if (!f.art('gold', x - 14, FLOOR - 134, 28, 28)) { c.fillStyle = GOLD; c.beginPath(); c.arc(x, FLOOR - 119, 10, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }

  private drawFence(c: CanvasRenderingContext2D, f: HomesteadFrame): void {
    c.fillStyle = '#4b332c';
    const start = Math.max(220, Math.floor((f.camera - 40) / 60) * 60), end = Math.min(FENCE_END, f.camera + f.viewport + 40);
    for (let x = start; x < end; x += 60) c.fillRect(x, FLOOR - 36, 8, 36);
    c.fillRect(Math.max(220, f.camera - 40), FLOOR - 28, Math.min(FENCE_END, f.camera + f.viewport + 40) - Math.max(220, f.camera - 40), 4);
    c.fillStyle = '#6a4a3c';
    for (let x = start; x < end; x += 60) c.fillRect(x, FLOOR - 36, 4, 36);
  }

  private drawTreasury(c: CanvasRenderingContext2D, f: HomesteadFrame, now: number): void {
    const x = X.treasury, m = this.model;
    this.flashGlow(c, 'treasury', now, 110);
    const banners = Math.min(4, m.multipliers), piles = vaultPiles(m.gold);
    if (this.pixels) {
      const el = this.pixels.world(`treasury:${banners}:${piles}`, () => paintWorld(192, 176, x - 96, FLOOR - 176, b => this.treasuryBody(b, x, banners, piles)));
      blit(c, el, x - 96, FLOOR - 176);
    } else this.treasuryBody(c, x, banners, piles);
    this.treasuryPurse(c, f, now);
  }

  /** The Treasury's house, banners and coin piles (world px; painted once per look in a browser). */
  private treasuryBody(c: CanvasRenderingContext2D, x: number, banners: number, piles: number): void {
    c.fillStyle = '#3d3446'; c.fillRect(x - 80, FLOOR - 120, 160, 120);
    c.fillStyle = '#524660'; c.beginPath(); c.moveTo(x - 92, FLOOR - 120); c.lineTo(x, FLOOR - 170); c.lineTo(x + 92, FLOOR - 120); c.closePath(); c.fill();
    c.fillStyle = '#1d1418'; c.fillRect(x - 34, FLOOR - 80, 68, 80);
    c.strokeStyle = '#c2a26a'; c.lineWidth = 4; c.beginPath(); c.arc(x, FLOOR - 40, 18, 0, Math.PI * 2); c.stroke();
    // One banner per Treasury multiplier held.
    for (let i = 0; i < banners; i++) {
      const bx = x - 60 + i * 40;
      c.fillStyle = '#8d3f36'; c.fillRect(bx, FLOOR - 112, 16, 26);
      c.fillStyle = GOLD; c.fillRect(bx + 6, FLOOR - 104, 4, 4);
    }
    // Coin piles: one per order of magnitude held.
    for (let i = 0; i < piles; i++) {
      const px = x - 70 + (i % 5) * 35 + (i >= 5 ? 17 : 0), py = FLOOR - 4 - (i >= 5 ? 10 : 0);
      for (let k = 0; k < 3; k++) { c.fillStyle = k % 2 ? '#e8b94e' : GOLD; c.beginPath(); c.ellipse(px, py - k * 6, 12, 4, 0, 0, Math.PI * 2); c.fill(); }
    }
  }

  /** The purse over the Treasury: real text, bumping when Gold lands. */
  private treasuryPurse(c: CanvasRenderingContext2D, f: HomesteadFrame, now: number): void {
    const x = X.treasury, m = this.model;
    const bump = (now - this.vaultBump) / 300;
    const s = bump >= 0 && bump < 1 && !f.reduced ? 1 + Math.sin(bump * Math.PI) * .18 : 1;
    c.save(); c.translate(x, FLOOR - 206); c.scale(s, s);
    c.fillStyle = '#1a120fe6'; c.fillRect(-90, -26, 180, 40);
    this.label(c, homesteadT('homestead.canvas.purse', { n: Math.floor(m.gold).toLocaleString('en-US') }), 0, 0, GOLD, 18, 700);
    c.restore();
    this.label(c, homesteadT('homestead.canvas.perSecond', { n: compact(m.perSecond) }), x, FLOOR - 176, '#e7d3b4', 12);
  }

  private drawForge(c: CanvasRenderingContext2D, f: HomesteadFrame, now: number): void {
    const x = X.forge;
    const squash = forgeSquash(now - this.strikeAt, f.reduced);
    const near = Math.abs(f.playerX - x) < 130;
    const glow = f.reduced ? .6 : .6 + Math.sin(f.time * 3) * .25 + Math.max(0, 1 - (now - this.strikeAt) / 300) * .6;
    // Halo.
    c.save(); c.globalAlpha = .35 * glow; c.fillStyle = EMBER;
    c.beginPath(); c.ellipse(x, FLOOR - 120, 150, 120, 0, 0, Math.PI * 2); c.fill(); c.restore();
    const golden = (now - this.goldenAt) / 1500;
    if (golden >= 0 && golden < 1) { c.save(); c.globalAlpha = (1 - golden) * .6; c.fillStyle = GOLD; c.beginPath(); c.arc(x, FLOOR - 170, 80 + golden * 140, 0, Math.PI * 2); c.fill(); c.restore(); }
    c.save(); c.translate(x, FLOOR); c.scale(1 + (1 - squash) * .6, squash);
    if (this.pixels) {
      // The pixel hearth (painted once), its violet fire (two frames) and the anvil in front.
      blit(c, this.pixels.world('forge', () => paintWorld(200, 152, -100, -152, b => this.forgeHearth(b))), -100, -152);
      this.pixels.forgeFire(c, 0, -40, f.reduced ? 0 : f.time);
      blit(c, this.pixels.world('forge-anvil', () => paintWorld(120, 36, -60, -36, b => this.forgeAnvil(b))), -60, -36);
    } else {
      this.forgeHearth(c);
      c.shadowColor = EMBER; c.shadowBlur = 30 * glow;
      c.fillStyle = EMBER; c.beginPath(); c.moveTo(-26, -44); c.quadraticCurveTo(0, -150, 26, -44); c.closePath(); c.fill();
      c.shadowBlur = 0;
      this.forgeAnvil(c);
    }
    c.restore();
    // The call to action floats over the forge until it has been struck a few times.
    if (this.strikes < 5) {
      const bob = f.reduced ? 0 : Math.sin(f.time * 4) * 5;
      c.fillStyle = '#1a120fe6'; c.fillRect(x - 70, FLOOR - 222 + bob, 140, 28);
      this.label(c, homesteadT(near ? 'homestead.canvas.pressE' : 'homestead.canvas.clickMe'), x, FLOOR - 203 + bob, GOLD, 15, 700);
    } else {
      this.label(c, homesteadT('homestead.canvas.perStrike', { n: compact(this.model.perClick) }), x, FLOOR - 200, '#e7d3b4', 12);
    }
  }

  /** The Forge's stone hearth and its arch (origin at its foot). */
  private forgeHearth(c: CanvasRenderingContext2D): void {
    c.fillStyle = '#423846'; c.beginPath(); c.moveTo(-100, 0); c.lineTo(-80, -148); c.lineTo(80, -148); c.lineTo(100, 0); c.closePath(); c.fill();
    c.fillStyle = '#5a4e60'; c.fillRect(-80, -148, 160, 8);
    c.fillStyle = '#1d1418'; c.beginPath(); c.arc(0, -82, 52, Math.PI, 0); c.lineTo(52, -40); c.lineTo(-52, -40); c.closePath(); c.fill();
  }
  /** The anvil before the Forge's mouth. */
  private forgeAnvil(c: CanvasRenderingContext2D): void {
    c.fillStyle = '#2a2430'; c.fillRect(-60, -36, 120, 20); c.fillRect(-24, -16, 48, 16);
    c.fillStyle = '#6d6474'; c.fillRect(-60, -36, 120, 4);
  }

  private drawFurnace(c: CanvasRenderingContext2D, f: HomesteadFrame, now: number): void {
    const x = X.furnace, levels = this.model.furnace.reduce((a, b) => a + b, 0);
    if (levels <= 0) { this.drawSign(c, x, this.model.signs.furnace ?? homesteadT('homestead.sign.furnace')); return; }
    this.flashGlow(c, 'furnace', now, 100);
    // The body grows with levels in whole art pixels, so each size is one cached sprite.
    const s = furnaceScale(levels);
    const w = up(60 * s), h = up(90 * s);
    const rungs = this.model.furnace.map((lv, i) => ({ lv, i })).filter(r => r.lv > 0);
    const chimneyX = (k: number) => up(x - w + 10 + (k + .5) * ((w * 2 - 20) / rungs.length) - x) + x;
    const body = (b: CanvasRenderingContext2D) => {
      b.fillStyle = '#4a3238'; b.fillRect(x - w, FLOOR - h, w * 2, h);
      b.fillStyle = '#a67858'; b.fillRect(x - w - 8, FLOOR - h - 8, w * 2 + 16, 8);
      b.fillStyle = '#2a1d22'; b.fillRect(up(x - w * .45 - x) + x - 4, FLOOR - up(h * .5) - 4, up(w * .9) + 8, up(h * .4) + 8);
      // One chimney per distinct rung held: each Market purchase of a new rung adds one.
      rungs.forEach((r, k) => { b.fillStyle = '#3b3034'; b.fillRect(chimneyX(k) - 8, FLOOR - h - 8 - up(30 + r.i * 6), 16, up(30 + r.i * 6)); });
    };
    const top = FLOOR - h - 8 - up(30 + Math.max(0, ...rungs.map(r => r.i)) * 6);
    if (this.pixels) {
      const el = this.pixels.world(`furnace:${w}:${h}:${rungs.map(r => r.i).join('.')}`, () => paintWorld(w * 2 + 24, FLOOR - top + 4, x - w - 12, top - 4, body));
      blit(c, el, x - w - 12, top - 4);
    } else body(c);
    const fire = f.reduced ? .7 : .7 + Math.sin(f.time * 5 + 1) * .3;
    c.save(); c.shadowColor = EMBER; c.shadowBlur = 20 * fire; c.fillStyle = `rgba(255, 140, 70, ${(.55 + fire * .4).toFixed(2)})`;
    c.fillRect(up(x - w * .45 - x) + x, FLOOR - up(h * .5), up(w * .9), up(h * .4)); c.restore();
    if (!f.reduced) rungs.forEach((r, k) => {
      // Smoke: square puffs that grow a pixel at a time.
      const puff = (f.time * .6 + k * .37) % 1, n = puff < .4 ? 2 : puff < .75 ? 3 : 4;
      c.save(); c.globalAlpha = (1 - puff) * .35; c.fillStyle = '#c9bdc8';
      c.fillRect(chimneyX(k) - n * 2 + up(puff * 10), FLOOR - h - 8 - up(30 + r.i * 6) - up(puff * 60) - n * HP, n * HP, n * HP); c.restore();
    });
    this.label(c, homesteadT(levels === 1 ? 'homestead.canvas.part.one' : 'homestead.canvas.part.many', { n: levels }), x, FLOOR - h - 70, '#e7d3b4', 12);
  }

  /** A figure hammering: size and colour by rung (apprentice, golem, eclipse). */
  private drawAutomatons(c: CanvasRenderingContext2D, f: HomesteadFrame, now: number): void {
    const x = X.automatons;
    const kinds: number[] = [];
    this.model.automatons.forEach((lv, rung) => { for (let i = 0; i < lv && kinds.length < MAX_FIGURES; i++) kinds.push(rung); });
    const total = this.model.automatons.reduce((a, b) => a + b, 0);
    if (total <= 0) { this.drawSign(c, x, this.model.signs.automatons ?? homesteadT('homestead.sign.automatons')); return; }
    this.flashGlow(c, 'automatons', now, 130);
    const beat = Math.max(0, 1 - (now - this.autoBeatAt) / 250);
    if (this.pixels) {
      blit(c, this.pixels.world('auto-anvil', () => paintWorld(88, 40, x - 44, FLOOR - 40, b => {
        b.fillStyle = '#2a2430'; b.fillRect(x - 40, FLOOR - 40, 80, 16); b.fillRect(x - 16, FLOOR - 24, 32, 24);
        b.fillStyle = '#6d6474'; b.fillRect(x - 40, FLOOR - 40, 80, 4);
      })), x - 44, FLOOR - 40);
      // Back row first, so the front row stands in front of it.
      const slots = automatonSlots(kinds.length, x);
      for (const row of [1, 0]) slots.forEach((slot, i) => {
        if (slot.row !== row) return;
        const swing = f.reduced ? 0 : Math.sin(f.time * 7 + i * 1.3);
        this.pixels!.automaton(c, kinds[i], slot.x, slot.y, swing > 0);
        if (beat > 0 && !f.reduced) { c.fillStyle = `rgba(255, 211, 109, ${beat.toFixed(2)})`; c.fillRect(slot.x + 28, slot.y - 48, HP, HP); }
      });
      if (total > MAX_FIGURES) this.label(c, `x${total}`, x + 150, FLOOR - 60, GOLD, 14, 700);
      return;
    }
    c.fillStyle = '#2a2430'; c.fillRect(x - 40, FLOOR - 40, 80, 16); c.fillRect(x - 14, FLOOR - 24, 28, 24);
    automatonSlots(kinds.length, x).forEach((slot, i) => {
      const rung = kinds[i];
      const size = rung === 0 ? 1 : rung === 1 ? 1.35 : 1.2;
      const body = rung === 0 ? '#8a6a52' : rung === 1 ? '#6d6474' : '#5b3f8a';
      const swing = f.reduced ? 0 : Math.sin(f.time * 7 + i * 1.3);
      c.save(); c.translate(slot.x, slot.y); c.scale(size, size);
      if (rung === 2) { c.shadowColor = VIOLET; c.shadowBlur = 12; }
      c.fillStyle = body; c.fillRect(-8, -34, 16, 22); c.fillRect(-6, -12, 5, 12); c.fillRect(1, -12, 5, 12);
      c.beginPath(); c.arc(0, -40, 7, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
      c.fillStyle = rung === 2 ? VIOLET : '#ffcf8a'; c.fillRect(-3, -42, 2, 2); c.fillRect(2, -42, 2, 2);
      c.save(); c.translate(6, -30); c.rotate(-0.9 + swing * .8);
      c.fillStyle = '#5a3d2e'; c.fillRect(0, -2, 18, 3); c.fillStyle = '#9aa0a8'; c.fillRect(15, -6, 7, 11);
      c.restore(); c.restore();
      if (beat > 0 && !f.reduced) { c.fillStyle = `rgba(255, 211, 109, ${beat.toFixed(2)})`; c.beginPath(); c.arc(slot.x + 22 * size, slot.y - 30 * size, 4, 0, Math.PI * 2); c.fill(); }
    });
    if (total > MAX_FIGURES) this.label(c, `x${total}`, x + 120, FLOOR - 60, GOLD, 14, 700);
  }

  private drawCamp(c: CanvasRenderingContext2D, f: HomesteadFrame, wall: number): void {
    if (this.pixels) { this.drawCampPixel(c, f, wall); return; }
    const x = X.camp, e = this.model.explorers;
    const tents = tentSlots(e.slots, x);
    tents.forEach((tx, i) => {
      const away = i < e.out.length;
      c.fillStyle = away ? '#5a4a3e' : '#8d6a4a';
      c.beginPath(); c.moveTo(tx - 24, FLOOR); c.lineTo(tx, FLOOR - 46); c.lineTo(tx + 24, FLOOR); c.closePath(); c.fill();
      c.fillStyle = '#2a1d22'; c.beginPath(); c.moveTo(tx - 6, FLOOR); c.lineTo(tx, FLOOR - 20); c.lineTo(tx + 6, FLOOR); c.closePath(); c.fill();
      if (away) {
        // The mission's real progress, as a bar over its tent.
        const run = e.out[i];
        const p = progressAt(run.startedAt, run.duration, wall);
        c.fillStyle = '#302530'; c.fillRect(tx - 20, FLOOR - 62, 40, 5);
        c.fillStyle = run.color; c.fillRect(tx - 20, FLOOR - 62, 40 * p, 5);
      }
    });
    // Campfire and whoever is home.
    const fire = f.reduced ? .7 : .7 + Math.sin(f.time * 6) * .3;
    const fx = x + tents.length * 26 + 30;
    c.save(); c.shadowColor = EMBER; c.shadowBlur = 14 * fire; c.fillStyle = EMBER;
    c.beginPath(); c.moveTo(fx - 9, FLOOR - 4); c.quadraticCurveTo(fx, FLOOR - 30 * fire, fx + 9, FLOOR - 4); c.closePath(); c.fill(); c.restore();
    for (let i = 0; i < Math.min(4, e.idle); i++) this.figure(c, fx - 30 - i * 22, FLOOR, '#b8a27e', 1, 1, true);
    // Explorers on the road, placed from their own start + duration.
    e.out.forEach(run => {
      const at = explorerWalk(run.startedAt, run.duration, wall, x);
      if (!at || f.reduced) return;
      const bob = Math.abs(Math.sin(f.time * 8)) * 3;
      this.figure(c, at.x, FLOOR - bob, run.color, at.alpha, at.facing, false);
    });
  }

  /**
   * The camp in pixels: tents in a row behind a small fire, whoever is home sitting
   * by it (Keepers, in their realm's cloth), the ones out walking the road.
   */
  private drawCampPixel(c: CanvasRenderingContext2D, f: HomesteadFrame, wall: number): void {
    const x = X.camp, e = this.model.explorers, px = this.pixels!;
    const tents = tentSlots(e.slots, x);
    tents.forEach((tx, i) => {
      const away = i < e.out.length;
      px.tent(c, tx, FLOOR, away, away ? '#5a4a3e' : '#8d6a4a');
      if (away) {
        // The mission's real progress, as a bar over its tent.
        const run = e.out[i];
        const p = progressAt(run.startedAt, run.duration, wall);
        c.fillStyle = '#302530'; c.fillRect(tx - 20, FLOOR - 68, 40, 4);
        c.fillStyle = run.color; c.fillRect(tx - 20, FLOOR - 68, up(40 * p), 4);
      }
    });
    // The fire burns in front of the tents' west end, clear of every tent's door.
    const fx = tents[0] - 76;
    const fire = f.reduced ? 0 : Math.sin(f.time * 6) * .5 + .5;
    c.save(); c.shadowColor = EMBER; c.shadowBlur = 14;
    px.fire(c, fx, FLOOR, fire);
    c.restore();
    // Up to two who are home sit either side of the fire, facing it.
    for (let i = 0; i < Math.min(2, e.idle); i++) {
      const sx = fx + (i ? 56 : -56);
      this.explorer(c, `home:${i}`, i ? '#8d4f58' : '#4a6a8a', sx, FLOOR, i ? -1 : 1, 'rest', 0, 1);
    }
    // Explorers on the road, placed from their own start + duration.
    e.out.forEach((run, i) => {
      const at = explorerWalk(run.startedAt, run.duration, wall, x);
      if (!at || f.reduced) return;
      this.explorer(c, `out:${i}:${run.color}`, run.color, at.x, FLOOR, at.facing, 'walk', at.x / 18, at.alpha);
    });
  }

  /** An explorer: a Keeper in cloth of `color` (their realm), painted by the player's own painter. */
  private explorer(c: CanvasRenderingContext2D, seed: string, color: string, x: number, floor: number, facing: number, action: 'rest' | 'walk', phase: number, alpha: number): void {
    let painter = this.explorerPainters.get(seed);
    if (!painter) {
      const npc = townsfolkLook(seed, { robe: color, shade: '#3a2a30', trim: '#c2a26a', skin: '#d9a07a' }, 'coat');
      painter = new KeeperPainter(npc.look, npc.gear, npc.garb);
      this.explorerPainters.set(seed, painter);
    }
    c.save(); c.globalAlpha *= alpha; c.translate(Math.round(x), floor); if (facing < 0) c.scale(-1, 1);
    painter.draw(c, HP, { action, time: phase, attackT: 0, weapon: false, reduced: action === 'rest' });
    c.restore();
  }

  private drawWorkshop(c: CanvasRenderingContext2D, f: HomesteadFrame, wall: number): void {
    const x = X.workshop, list = this.model.thralls;
    if (!list.length) { this.drawSign(c, x, this.model.signs.workshop ?? homesteadT('homestead.sign.thrall')); return; }
    if (this.pixels) {
      blit(c, this.pixels.world('workshop', () => paintWorld(208, 132, x - 104, FLOOR - 132, b => {
        b.fillStyle = '#3b3034'; b.fillRect(x - 100, FLOOR - 128, 200, 12);
        b.fillStyle = '#4b332c'; b.fillRect(x - 100, FLOOR - 128, 8, 128); b.fillRect(x + 92, FLOOR - 128, 8, 128);
        b.fillStyle = '#2a2430'; b.fillRect(x - 32, FLOOR - 36, 64, 16); b.fillRect(x - 12, FLOOR - 20, 24, 20);
        b.fillStyle = '#6d6474'; b.fillRect(x - 32, FLOOR - 36, 64, 4);
      })), x - 104, FLOOR - 132);
      const shown = list.slice(0, 6);
      shown.forEach((t, i) => {
        const tx = x - 85 + i * 34;
        // The hammer's angle IS the time to the Thrall's next real pull.
        const cyc = f.reduced ? 0 : cycleAt(t.lastRollAt, t.rollInterval, wall);
        this.pixels!.thrall(c, t.color, tx, FLOOR, cyc, !t.working, tx < x ? 1 : -1);
      });
      if (list.length > shown.length) this.label(c, `x${list.length}`, x, FLOOR - 146, VIOLET, 14, 700);
      return;
    }
    c.fillStyle = '#3b3034'; c.fillRect(x - 100, FLOOR - 130, 200, 10);
    c.fillStyle = '#4b332c'; c.fillRect(x - 100, FLOOR - 130, 8, 130); c.fillRect(x + 92, FLOOR - 130, 8, 130);
    c.fillStyle = '#2a2430'; c.fillRect(x - 30, FLOOR - 36, 60, 14); c.fillRect(x - 10, FLOOR - 22, 20, 22);
    const shown = list.slice(0, 8);
    shown.forEach((t, i) => {
      const tx = x - 84 + i * 24 + (i >= 4 ? 30 : 0);
      if (!t.working) { this.figure(c, tx, FLOOR, '#6d6474', .6, 1, true); return; }
      // The hammer's angle IS the time to the Thrall's next real pull.
      const cyc = f.reduced ? 0 : cycleAt(t.lastRollAt, t.rollInterval, wall);
      this.figure(c, tx, FLOOR, t.color, 1, tx < x ? 1 : -1, false, -1.4 + cyc * 1.8);
    });
    if (list.length > shown.length) this.label(c, `x${list.length}`, x, FLOOR - 146, VIOLET, 14, 700);
  }

  /** The tier as a small plaque over a home station: "I" .. "IV". */
  private tierPlaque(c: CanvasRenderingContext2D, x: number, tier: number, color: string): void {
    const text = ['I', 'II', 'III', 'IV'][Math.min(4, Math.max(1, tier)) - 1];
    c.fillStyle = '#1a120fe6'; c.fillRect(x - 22, FLOOR - 200, 44, 24);
    c.strokeStyle = color; c.lineWidth = 2; c.strokeRect(x - 22, FLOOR - 200, 44, 24);
    this.label(c, text, x, FLOOR - 182, color, 15, 800);
  }

  private homeFlashGlow(c: CanvasRenderingContext2D, id: HomeStationId, now: number, color: string): void {
    const t = (now - (this.homeFlash[id] ?? -Infinity)) / 900;
    if (t < 0 || t > 1) return;
    c.save(); c.globalAlpha = (1 - t) * .55; c.fillStyle = color;
    c.beginPath(); c.ellipse(HOME_X[id], FLOOR - 60, 120 * (0.7 + t * .4), 100, 0, 0, Math.PI * 2); c.fill(); c.restore();
  }

  /** The player's own anvil: a stone block and an iron anvil that grows, and glows from tier II. */
  private drawHomeAnvil(c: CanvasRenderingContext2D, f: HomesteadFrame, now: number): void {
    const x = HOME_X.anvil, tier = this.model.homeForge.anvil;
    const look = anvilLook(tier);
    this.homeFlashGlow(c, 'anvil', now, '#a6ffcf');
    if (look.glow > 0) {
      const pulse = f.reduced ? 1 : .85 + Math.sin(f.time * 2.2) * .15;
      c.save(); c.globalAlpha = look.glow * pulse * .6; c.fillStyle = EMBER;
      c.beginPath(); c.ellipse(x, FLOOR - 58 * look.scale, 90 * look.scale, 50 * look.scale, 0, 0, Math.PI * 2); c.fill(); c.restore();
    }
    if (this.pixels) {
      // The anvil painted once per tier at its grown size; the glowing face is light, drawn live.
      const el = this.pixels.world(`home-anvil:${tier}`, () => paintWorld(170, 120, x - 90, FLOOR - 120, b => {
        b.translate(x, FLOOR); b.scale(look.scale, look.scale); this.homeAnvilBody(b, false);
      }));
      blit(c, el, x - 90, FLOOR - 120);
      if (look.glow > 0) {
        c.save(); c.shadowColor = EMBER; c.shadowBlur = 10 + look.glow * 22;
        c.fillStyle = `rgba(255, 170, 90, ${(0.45 + look.glow * 0.5).toFixed(2)})`;
        c.fillRect(x - up(46 * look.scale), FLOOR - up(84 * look.scale), up(92 * look.scale), HP);
        c.restore();
      }
    } else {
      c.save(); c.translate(x, FLOOR); c.scale(look.scale, look.scale);
      this.homeAnvilBody(c, look.glow > 0);
      if (look.glow > 0) { c.fillStyle = `rgba(255, 170, 90, ${(0.45 + look.glow * 0.5).toFixed(2)})`; c.fillRect(-46, -84, 92, 4); }
      c.restore();
    }
    // Sparks drifting off an upgraded anvil: one more per tier.
    if (look.glow > 0 && !f.reduced) {
      for (let i = 0; i < tier; i++) {
        const u = (f.time * .7 + i * .31) % 1;
        c.save(); c.globalAlpha = (1 - u) * .8; c.fillStyle = i % 2 ? GOLD : EMBER;
        c.fillRect(up(x - 20 + i * 14 + Math.sin(u * 6 + i) * 6 - x) + x, FLOOR - up(90 * look.scale + u * 70), HP, HP); c.restore();
      }
    }
    this.tierPlaque(c, x, tier, GOLD);
  }

  /** The home anvil's stone block, anvil and resting hammer (origin at its foot, before the tier's scale). */
  private homeAnvilBody(c: CanvasRenderingContext2D, glow: boolean): void {
    // Stone block.
    c.fillStyle = '#4b332c'; c.fillRect(-34, -40, 68, 40);
    c.fillStyle = '#5a3d2e'; c.fillRect(-38, -44, 76, 6);
    // Anvil: waist, body, horn.
    c.fillStyle = '#2a2430'; c.fillRect(-14, -62, 28, 18);
    if (glow) { c.shadowColor = EMBER; c.shadowBlur = 16; }
    c.fillStyle = '#3e3846'; c.fillRect(-46, -84, 92, 22);
    c.beginPath(); c.moveTo(-46, -84); c.lineTo(-74, -78); c.lineTo(-46, -66); c.closePath(); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#6d6474'; c.fillRect(-46, -84, 92, 4);
    // A hammer resting on it.
    c.fillStyle = '#5a3d2e'; c.fillRect(10, -98, 30, 4);
    c.fillStyle = '#9aa0a8'; c.fillRect(36, -104, 10, 16);
  }

  /** The player's own enchanting circle: a ring on the ground whose runes brighten per tier. */
  private drawHomeCircle(c: CanvasRenderingContext2D, f: HomesteadFrame, now: number): void {
    const x = HOME_X.circle, tier = this.model.homeForge.circle;
    const look = circleLook(tier);
    this.homeFlashGlow(c, 'circle', now, VIOLET);
    const breathe = f.reduced ? 1 : .85 + Math.sin(f.time * 1.6) * .15;
    c.save();
    // The ring, seen from the side: an ellipse on the floor.
    c.globalAlpha = .25 + look.bright * .35 * breathe; c.fillStyle = VIOLET;
    c.beginPath(); c.ellipse(x, FLOOR - 8, 110, 26, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    const rings = (b: CanvasRenderingContext2D) => {
      b.strokeStyle = '#c2a26a'; b.lineWidth = 4;
      b.beginPath(); b.ellipse(x, FLOOR - 8, 110, 26, 0, 0, Math.PI * 2); b.stroke();
      b.strokeStyle = VIOLET; b.lineWidth = 4;
      b.beginPath(); b.ellipse(x, FLOOR - 8, 80, 18, 0, 0, Math.PI * 2); b.stroke();
    };
    if (this.pixels) blit(c, this.pixels.world('circle', () => paintWorld(236, 68, x - 118, FLOOR - 42, rings, false)), x - 118, FLOOR - 42);
    else { c.globalAlpha = .5 + look.bright * .5; rings(c); c.globalAlpha = 1; }
    // Ten standing runes around it: more are lit, and they burn brighter, per tier.
    const total = 10, spin = f.reduced ? 0 : f.time * .25;
    for (let i = 0; i < total; i++) {
      const a = (i / total) * Math.PI * 2 + spin;
      const rx = x + Math.cos(a) * 110, ry = FLOOR - 8 + Math.sin(a) * 26;
      const lit = i < look.runes;
      c.globalAlpha = lit ? Math.min(1, look.bright * breathe + .1) : .25;
      c.shadowColor = VIOLET; c.shadowBlur = lit ? 6 + look.bright * 16 : 0;
      c.fillStyle = lit ? '#e6d4ff' : '#5b4a72';
      // A standing rune on the grid: a 2 px stem and a 3 px bar.
      const gx = up(rx - x) + x, gy = FLOOR - up(FLOOR - ry);
      c.fillRect(gx - HP, gy - 20, HP * 2, 16);
      c.fillRect(gx - HP * 2 + 2, gy - 16, HP * 3, HP);
    }
    c.shadowBlur = 0;
    // From tier III a rune hovers over the centre.
    if (tier >= 3) {
      const bob = f.reduced ? 0 : Math.sin(f.time * 2) * 6;
      c.globalAlpha = look.bright; c.shadowColor = VIOLET; c.shadowBlur = 20;
      c.fillStyle = '#e6d4ff';
      // A pixel diamond, bobbing a whole pixel at a time.
      const top = FLOOR - 120 + up(bob);
      for (let k = 0; k < 6; k++) { const half = (k < 3 ? k + 1 : 6 - k) * HP; c.fillRect(x - half, top + k * HP * 2, half * 2, HP * 2); }
      c.shadowBlur = 0;
    }
    c.restore();
    this.tierPlaque(c, x, tier, VIOLET);
  }

  /** A small stick figure: the placeholder until sprites land. */
  private figure(c: CanvasRenderingContext2D, x: number, y: number, color: string, alpha: number, facing: number, sitting: boolean, arm = 0): void {
    c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(facing, 1);
    c.fillStyle = color;
    const legs = sitting ? 6 : 12;
    c.fillRect(-5, -legs - 20, 10, 20); c.fillRect(-5, -legs, 3, legs); c.fillRect(2, -legs, 3, legs);
    c.beginPath(); c.arc(0, -legs - 26, 6, 0, Math.PI * 2); c.fill();
    if (arm) { c.save(); c.translate(4, -legs - 16); c.rotate(arm); c.fillRect(0, -1.5, 14, 3); c.fillStyle = '#9aa0a8'; c.fillRect(12, -5, 6, 10); c.restore(); }
    c.restore();
  }

  /** A bobbing receipt bubble over a building with something to collect. */
  private drawPending(c: CanvasRenderingContext2D, id: HomesteadBuildingId, f: HomesteadFrame): void {
    const p = this.ledger[id];
    if (!hasPending(p)) return;
    const text = p.gold >= 1 ? `+${compact(p.gold)}` : p.runes ? homesteadT(p.runes === 1 ? 'homestead.canvas.rune.one' : 'homestead.canvas.rune.many', { n: p.runes }) : homesteadT('homestead.canvas.home', { n: p.returns });
    const bob = f.reduced ? 0 : Math.sin(f.time * 3 + X[id]) * 4;
    const y = FLOOR - 300 + bob;
    c.font = '700 13px system-ui';
    const w = c.measureText(text).width + 34;
    c.fillStyle = '#1a120fe6'; c.beginPath(); c.roundRect?.(X[id] - w / 2, y - 18, w, 26, 13); c.fill();
    c.fillStyle = GOLD; c.beginPath(); c.arc(X[id] - w / 2 + 13, y - 5, 6, 0, Math.PI * 2); c.fill();
    c.textAlign = 'center'; c.fillText(text, X[id] + 8, y);
  }

  private drawArcs(c: CanvasRenderingContext2D, now: number): void {
    this.arcs = this.arcs.filter(a => now - a.born < a.life);
    for (const a of this.arcs) {
      const t = (now - a.born) / a.life;
      for (let k = 0; k < 3; k++) {
        const u = Math.max(0, Math.min(1, t - k * .08));
        const x = a.fromX + (a.toX - a.fromX) * u;
        const y = FLOOR - 140 - Math.sin(u * Math.PI) * 140 + u * 60;
        c.fillStyle = GOLD; c.fillRect(up(x) - HP, up(y) - HP, HP * 3, HP * 3);
        c.fillStyle = '#fff1b0'; c.fillRect(up(x) - HP, up(y) - HP, HP, HP);
      }
      if (t > .9) this.vaultBump = Math.max(this.vaultBump, a.born + a.life * .9);
    }
  }

  private drawFx(c: CanvasRenderingContext2D, now: number): void {
    this.fx = this.fx.filter(p => now - p.born < p.life);
    for (const p of this.fx) {
      const age = (now - p.born) / 1000;
      const t = (now - p.born) / p.life;
      c.globalAlpha = Math.max(0, 1 - t * t);
      if (p.text) {
        c.font = `${p.big ? 800 : 700} ${p.big ? 20 : 18}px system-ui`; c.textAlign = 'center';
        c.lineWidth = 4; c.strokeStyle = '#1a120f'; c.strokeText(p.text, p.x, p.y + p.vy * age);
        c.fillStyle = p.color; c.fillText(p.text, p.x, p.y + p.vy * age);
      } else {
        c.fillStyle = p.color;
        const n = p.size < 3.5 ? HP : HP * 2;
        c.fillRect(up(p.x + p.vx * age), up(p.y + p.vy * age + 600 * age * age), n, n);
      }
    }
    c.globalAlpha = 1;
  }
}
