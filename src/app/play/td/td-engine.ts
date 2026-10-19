/**
 * td-engine.ts — the top-down engine, Phase 1 (docs/design/top-down.md §2).
 *
 * Draws a hand-authored town (seamworks-square.ts) in a cozy 3/4 view: baked
 * ground chunks, y-sorted buildings/stalls/trees/props/people, roofs and tree
 * crowns that fade when the Keeper walks behind them, chimney smoke, and a
 * half-resolution night pass lit by windows, lamps and string lights, driven
 * by the world clock (setWorldHour). The Keeper walks in 8 directions: WASD /
 * arrows, a drag-anywhere joystick on touch, or tap/click-to-walk with A*.
 *
 * It speaks the side-scroller's contract (EngineOptions in, EngineState out,
 * the same setters), so the play component keeps all its wiring; members the
 * top-down world has no use for yet are no-ops (see createTopDownEngine).
 */
import type { EngineOptions, EngineState, EngineInput } from '../engine/engine.model';
import type { StationDef } from '../world/world.model';
import { KeeperPainter } from '../../shared/keeper-look/keeper-paint';
import { FRONT_AX, FRONT_AY, FRONT_H, FRONT_W, PHONE_FRAME, frontFrame, frontSheet } from '../../shared/keeper-look/keeper-front';
import { NPC_LOOKS } from '../../shared/keeper-look/npc-looks';
import { defaultLook, randomLook, type KeeperLook } from '../../shared/keeper-look/keeper-look.model';
import type { KeeperGear } from '../../shared/keeper-look/keeper-gear';
import { PAL, paintEdge, paintGround, TILE, type Ground, type Sprite } from './td-art';
import { buildSeamworksSquare, type TdMap, type TdObject, type TdStall } from './seamworks-square';

const CHUNK = 16;
const SPEED = 74;              // art px / s
const REACH = 26;              // art px from a stall's interaction spot
const FOOT = { w: 8, h: 4 };   // the Keeper's collision box at the feet (art px)
const FOLK = 16;               // townsfolk strolling the square (the references' busy plaza)
const FOLK_SPEED = 30;         // art px / s: a stroll, under half the Keeper's pace

interface Person { painter: KeeperPainter | null; x: number; y: number; face: 1 | -1; dir: 'side' | 'down' | 'up'; name?: string; moving: boolean; t: number }
/** A townsperson: strolls a route to somewhere in town, lingers, picks somewhere new. */
interface Folk extends Person { path: { x: number; y: number }[]; wait: number }
interface Puff { x: number; y: number; age: number; life: number; r: number }

export class TopDownEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly map: TdMap;
  private readonly chunks = new Map<string, HTMLCanvasElement[]>();
  private readonly player: Person;
  private readonly keepers: Person[] = [];
  private readonly folk: Folk[] = [];
  /** Walkable street tiles (cobble, plank, dirt) where townsfolk start and stroll to. */
  private readonly streets: number[] = [];
  private readonly keys = new Set<string>();
  private path: { x: number; y: number }[] = [];
  private arrive: (() => void) | null = null;
  private joy: { id: number; sx: number; sy: number; x: number; y: number; active: boolean } | null = null;
  private puffs: Puff[] = [];
  private raf = 0;
  private last = 0;
  private time = 0;
  private paused = false;
  private hour = 12;
  /** 0 day … 1 full night, from the world clock (setSky); `?hour=` pins it for screenshots and tests. */
  private darkness = 0;
  private dusk = 0;
  private pinned: number | null = null;
  private scale = 2;
  private cam = { x: 0, y: 0, w: 0, h: 0 };
  private stateTimer = 0;
  private message = '';
  private nearby: TdStall | null = null;
  private glim = { x: 0, y: 0, shown: true };
  private dark: HTMLCanvasElement | null = null;
  private lightSprite: HTMLCanvasElement | null = null;
  private glowSprite: HTMLCanvasElement | null = null;
  private readonly unbind: (() => void)[] = [];
  /** The Slate is open: the Keeper faces the camera and looks at it in their hands. */
  private phone = false;
  /** The minimap's ground, one pixel per tile, painted once. */
  private miniGround: HTMLCanvasElement | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly options: EngineOptions) {
    this.ctx = canvas.getContext('2d')!;
    this.map = buildSeamworksSquare();
    this.player = { painter: new KeeperPainter(defaultLook()), x: this.map.spawn.x, y: this.map.spawn.y, face: 1, dir: 'down', moving: false, t: 0 };
    this.glim.x = this.player.x + 12; this.glim.y = this.player.y - 40;
    for (const s of this.map.stalls) {
      if (!s.keeper) continue;
      const npc = NPC_LOOKS[s.keeper.id];
      this.keepers.push({ painter: npc ? new KeeperPainter(npc.look, npc.gear, npc.garb) : null, x: s.keeper.x, y: s.keeper.y, face: 1, dir: 'down', name: s.keeper.name, moving: false, t: Math.random() * 4 });
    }
    this.spawnFolk();
    this.bindInput();
    try { const h = new URLSearchParams(window.location.search).get('hour'); if (h !== null && h !== '') { this.pinned = Math.max(0, Math.min(24, Number(h))); this.darkness = TopDownEngine.darknessAt(this.pinned); } } catch { /* no URL */ }
  }
  private static darknessAt(h: number): number { return h >= 21 || h < 5 ? 1 : h >= 18 ? (h - 18) / 3 : h < 7 ? (7 - h) / 2 : 0; }

  // ── Lifecycle (the component's contract) ───────────────────────────────────

  start(): void {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now: number) => {
      // rAF stamps the frame's start, which can precede the performance.now() taken in start(): never step backwards.
      const dt = Math.max(0, Math.min(.05, (now - this.last) / 1000));
      this.last = now;
      if (!this.paused) this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  destroy(): void {
    cancelAnimationFrame(this.raf); this.raf = 0;
    for (const off of this.unbind) off();
  }
  setPaused(paused: boolean): void { this.paused = paused; if (paused) { this.keys.clear(); this.joy = null; } }
  setPhone(on: boolean): void { this.phone = on; if (on) { this.player.dir = 'down'; this.player.moving = false; this.path = []; } }
  setWorldHour(hour: number): void { this.hour = ((hour % 24) + 24) % 24; }
  /** The world clock's sky (world-clock.model.ts Sky): light 1 = day, 0 = dark; glow = dawn/dusk gold. */
  setSky(sky: { light: number; glow: number; eclipse: number }): void {
    if (this.pinned !== null) return;
    this.darkness = Math.max(0, Math.min(1, 1 - sky.light));
    this.dusk = sky.glow;
  }
  setKeeperLook(look: KeeperLook | null, gear: KeeperGear | null = null): void {
    this.player.painter = new KeeperPainter(look ?? defaultLook(), gear);
  }
  setInput(action: EngineInput, pressed: boolean): void {
    // The side view's on-screen buttons: left/right walk, down walks south, jump walks north.
    const key = action === 'left' ? 'a' : action === 'right' ? 'd' : action === 'down' ? 's' : action === 'jump' ? 'w' : '';
    if (!key) return;
    if (pressed) { this.keys.add(key); this.path = []; } else this.keys.delete(key);
  }
  interact(): void {
    if (this.nearby) this.options.onStation?.(this.nearby.station);
  }
  get inTown(): boolean { return true; }
  get places(): readonly StationDef[] { return this.map.stalls.map(s => s.station); }
  get settlementKeepers(): readonly { id: string; x: number; y: number; upstairs: boolean; mark: '!' | '?' | null }[] {
    return this.map.stalls.filter(s => s.keeper).map(s => ({ id: s.keeper!.id, x: s.keeper!.x, y: s.keeper!.y, upstairs: false, mark: null }));
  }
  get glimView(): { shown: boolean; x: number; targetX: number | null; arrived: boolean; dimmed: boolean; bright: boolean; mood: string; trail: number | null; lamp: number } {
    return { shown: this.glim.shown, x: this.glim.x, targetX: null, arrived: true, dimmed: false, bright: false, mood: 'calm', trail: null, lamp: 0 };
  }
  get petView(): null { return null; }
  get realm(): null { return null; }
  get placeable(): null { return null; }
  /** Walk to a station and open it on arrival (`instant`: stand there now). */
  goToStation(id: string, instant = false): boolean {
    const s = this.map.stalls.find(st => st.station.id === id);
    if (!s) return false;
    if (instant) { this.player.x = s.x; this.player.y = s.y + 10; return true; }
    return this.walkTo(s.x, s.y + 10, () => this.options.onStation?.(s.station));
  }
  moveTo(x: number, onArrive?: () => void): boolean { return this.walkTo(x, this.player.y, onArrive); }

  // ── Simulation ─────────────────────────────────────────────────────────────

  private update(dt: number): void {
    this.time += dt;
    let vx = 0, vy = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) vx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) vx += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) vy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) vy += 1;
    if (this.joy?.active) {
      const dx = this.joy.x - this.joy.sx, dy = this.joy.y - this.joy.sy, len = Math.hypot(dx, dy);
      if (len > 6) { const k = Math.min(1, len / 48); vx = dx / len * k; vy = dy / len * k; }
    }
    if (vx || vy) this.path = [];
    else if (this.path.length) {
      const p = this.path[0], dx = p.x - this.player.x, dy = p.y - this.player.y, d = Math.hypot(dx, dy);
      if (d < 3) { this.path.shift(); if (!this.path.length) { const go = this.arrive; this.arrive = null; go?.(); } }
      else { vx = dx / d; vy = dy / d; }
    }
    const len = Math.hypot(vx, vy);
    if (len > 1) { vx /= len; vy /= len; }
    this.player.moving = len > .05;
    if (this.player.moving) {
      if (Math.abs(vx) > .2) this.player.face = vx < 0 ? -1 : 1;
      // Mostly vertical: show the face (south) or the back (north); otherwise the side view.
      this.player.dir = Math.abs(vy) > Math.abs(vx) * 1.2 ? (vy > 0 ? 'down' : 'up') : 'side';
      this.tryMove(vx * SPEED * dt, 0);
      this.tryMove(0, vy * SPEED * dt);
    }
    // Glim drifts to the Keeper's shoulder.
    const gx = this.player.x + this.player.face * -14, gy = this.player.y - 44 + Math.sin(this.time * 2.4) * 3;
    this.glim.x += (gx - this.glim.x) * Math.min(1, dt * 4);
    this.glim.y += (gy - this.glim.y) * Math.min(1, dt * 4);
    this.updateFolk(dt);
    // Keepers breathe and turn toward the Keeper when near.
    for (const k of this.keepers) { k.t += dt; if (Math.abs(this.player.x - k.x) < 120) k.face = this.player.x < k.x ? -1 : 1; }
    // The nearest stall within reach (the HUD's prompt and E).
    let best: TdStall | null = null, bestD = REACH;
    for (const s of this.map.stalls) {
      const d = Math.hypot(this.player.x - s.x, this.player.y - (s.y + 10));
      if (d < bestD) { best = s; bestD = d; }
    }
    this.nearby = best;
    this.updateSmoke(dt);
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) { this.stateTimer = .1; this.report(); }
  }

  private tryMove(dx: number, dy: number): void {
    const nx = this.player.x + dx, ny = this.player.y + dy;
    if (this.free(nx, ny)) { this.player.x = nx; this.player.y = ny; }
  }
  private free(x: number, y: number): boolean {
    const m = this.map;
    for (const [px, py] of [[x - FOOT.w / 2, y - FOOT.h], [x + FOOT.w / 2, y - FOOT.h], [x - FOOT.w / 2, y - 1], [x + FOOT.w / 2, y - 1]]) {
      const c = Math.floor(px / TILE), r = Math.floor(py / TILE);
      if (c < 0 || r < 0 || c >= m.cols || r >= m.rows || !m.walkable[r * m.cols + c]) return false;
    }
    return true;
  }

  private report(): void {
    const s = this.nearby;
    const state: EngineState = {
      hp: 100, enemyHp: 0, nearby: s ? s.station.id : null,
      nearbyLabel: s?.station.label, nearbyKind: s?.station.kind,
      x: Math.round(this.player.x), y: Math.round(this.player.y),
      area: 'Basalt Seamworks', areaId: 'infernal', facing: this.player.face,
      animation: this.player.moving ? 'run' : 'idle', delve: false, coins: 0, kills: 0,
      paused: this.paused, defeated: false, enemyDefeated: false, complete: false, message: this.message,
    };
    this.options.onState(state);
  }

  // ── Walking to a point (A* over the tile grid, 8-way, no corner cutting) ──

  private walkTo(x: number, y: number, onArrive?: () => void): boolean {
    const route = this.route(this.player.x, this.player.y, x, y);
    if (!route) return false;
    this.path = route; this.arrive = onArrive ?? null;
    if (!route.length) { this.arrive = null; onArrive?.(); }
    return true;
  }
  private route(fx: number, fy: number, tx: number, ty: number): { x: number; y: number }[] | null {
    const m = this.map, C = m.cols;
    const at = (x: number, y: number) => [Math.floor(x / TILE), Math.floor((y - 1) / TILE)] as const;
    const [sc, sr] = at(fx, fy);
    let [ec, er] = at(tx, ty);
    const ok = (c: number, r: number) => c >= 0 && r >= 0 && c < C && r < m.rows && !!m.walkable[r * C + c];
    if (!ok(ec, er)) {
      // Nearest walkable tile to the target (a tap on a roof or the river).
      let best: [number, number] | null = null, bd = 1e9;
      for (let r = er - 4; r <= er + 4; r++) for (let c = ec - 4; c <= ec + 4; c++) if (ok(c, r)) { const d = (c - ec) ** 2 + (r - er) ** 2; if (d < bd) { bd = d; best = [c, r]; } }
      if (!best) return null;
      [ec, er] = best;
    }
    const start = sr * C + sc, goal = er * C + ec;
    const g = new Map<number, number>([[start, 0]]), from = new Map<number, number>();
    const open: [number, number][] = [[0, start]];
    const h = (i: number) => Math.hypot((i % C) - ec, Math.floor(i / C) - er);
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]);
      const [, cur] = open.shift()!;
      if (cur === goal) break;
      const cc = cur % C, cr = Math.floor(cur / C);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nc = cc + dc, nr = cr + dr;
        if (!ok(nc, nr) || (dc && dr && (!ok(cc + dc, cr) || !ok(cc, cr + dr)))) continue;
        const ni = nr * C + nc, ng = g.get(cur)! + (dc && dr ? 1.414 : 1);
        if (ng < (g.get(ni) ?? Infinity)) { g.set(ni, ng); from.set(ni, cur); open.push([ng + h(ni), ni]); }
      }
      if (g.size > 4000) break;
    }
    if (!g.has(goal)) return null;
    const pts: { x: number; y: number }[] = [];
    for (let i = goal; i !== start; i = from.get(i)!) pts.unshift({ x: (i % C) * TILE + TILE / 2, y: Math.floor(i / C) * TILE + TILE - 2 });
    if (pts.length) pts[pts.length - 1] = { x: tx, y: ty };
    return pts;
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private bindInput(): void {
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || this.paused) return;
      // E opens the stall in reach (the side view handled E inside its own engine).
      if (down && !e.repeat && (k === 'e' || k === 'enter') && this.nearby) { e.preventDefault(); this.interact(); return; }
      if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) return;
      if (down) { this.keys.add(k); this.path = []; } else this.keys.delete(k);
    };
    const kd = onKey(true), ku = onKey(false);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    this.unbind.push(() => window.removeEventListener('keydown', kd), () => window.removeEventListener('keyup', ku));
    const c = this.canvas;
    const down = (e: PointerEvent) => {
      if (this.paused) return;
      this.joy = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, active: false };
      try { c.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    };
    const move = (e: PointerEvent) => {
      if (!this.joy || this.joy.id !== e.pointerId) return;
      this.joy.x = e.clientX; this.joy.y = e.clientY;
      if (Math.hypot(e.clientX - this.joy.sx, e.clientY - this.joy.sy) > 12) { this.joy.active = true; this.path = []; }
    };
    const up = (e: PointerEvent) => {
      if (!this.joy || this.joy.id !== e.pointerId) return;
      const tap = !this.joy.active;
      this.joy = null;
      if (tap) this.tap(e.clientX, e.clientY);
    };
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    this.unbind.push(() => { c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up); });
  }
  /** A tap: on a stall or its keeper walks there and opens it; anywhere else walks there. */
  private tap(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const wx = this.cam.x + (clientX - rect.left) * (this.canvas.width / rect.width) / this.scale;
    const wy = this.cam.y + (clientY - rect.top) * (this.canvas.height / rect.height) / this.scale;
    const hit = this.map.stalls.find(s => Math.abs(wx - s.x) < 34 && wy > s.y - 46 && wy < s.y + 16);
    if (hit) { this.walkTo(hit.x, hit.y + 10, () => this.options.onStation?.(hit.station)); return; }
    this.walkTo(wx, wy);
  }

  // ── Minimap (the round compass in the HUD's top-right, like the references) ──

  /** Draw the town round the Keeper into a small square canvas (the HUD clips it round). */
  drawMinimap(target: HTMLCanvasElement): void {
    const c = target.getContext('2d');
    if (!c) return;
    const m = this.map;
    if (!this.miniGround) {
      const g = document.createElement('canvas'); g.width = m.cols; g.height = m.rows;
      const gc = g.getContext('2d')!;
      const col: Partial<Record<Ground, string>> = { grass: PAL.grass[0], flowers: PAL.grass[1], dirt: PAL.dirt[0], cobble: PAL.cobble[0], sand: PAL.sand[0], plank: PAL.plank[0], water: PAL.water[0], ember: PAL.ember[0] };
      for (let i = 0; i < m.ground.length; i++) { gc.fillStyle = col[m.ground[i]] ?? PAL.grass[0]; gc.fillRect(i % m.cols, Math.floor(i / m.cols), 1, 1); }
      for (const o of m.objects) {
        if (!o.block || (o.kind !== 'building' && o.kind !== 'tree')) continue;
        gc.fillStyle = o.kind === 'building' ? PAL.roofRed[2] : PAL.leaf[2];
        const fc = Math.floor(o.x / TILE), fr = Math.floor((o.y - 1) / TILE);
        gc.fillRect(fc - Math.floor((o.block.w - 1) / 2), fr - o.block.h + 1, o.block.w, o.block.h);
      }
      this.miniGround = g;
    }
    const W = target.width, H = target.height, k = Math.max(2, Math.round(W / 22));   // ~22 tiles across
    c.imageSmoothingEnabled = false;
    c.fillStyle = PAL.grass[3]; c.fillRect(0, 0, W, H);
    const px = this.player.x / TILE, py = this.player.y / TILE;
    c.drawImage(this.miniGround, Math.round(W / 2 - px * k), Math.round(H / 2 - py * k), m.cols * k, m.rows * k);
    const dot = (tx: number, ty: number, r: number, fill: string) => {
      const x = Math.round(W / 2 + (tx / TILE - px) * k), y = Math.round(H / 2 + (ty / TILE - py) * k);
      c.fillStyle = PAL.outline; c.fillRect(x - r - 1, y - r - 1, r * 2 + 2, r * 2 + 2);
      c.fillStyle = fill; c.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (const s of m.stalls) dot(s.x, s.y, Math.max(1, k >> 1), PAL.glow);
    for (const f of this.folk) { c.fillStyle = 'rgba(42,26,36,.55)'; c.fillRect(Math.round(W / 2 + (f.x / TILE - px) * k), Math.round(H / 2 + (f.y / TILE - py) * k), Math.max(1, k >> 1), Math.max(1, k >> 1)); }
    dot(this.player.x, this.player.y, Math.max(2, k - 1), '#ffffff');
  }

  // ── Fireflies: dusk and night, round the trees and the flower beds (the references' summer evenings) ──

  private drawFireflies(): void {
    const night = Math.max(this.darkness, this.dusk * .6);
    if (night < .25) return;
    const c = this.ctx, s = this.scale, cam = this.cam;
    c.setTransform(1, 0, 0, 1, 0, 0);
    let n = 0;
    for (const o of this.map.objects) {
      if (o.kind !== 'tree') continue;
      for (let j = 0; j < 3; j++) {
        const seed = (n++ * 7.31) % 6.283;
        const t = this.time * (.35 + (j * .13)) + seed * 3;
        const wx = o.x + Math.sin(t + j) * 18 + Math.sin(t * 2.3) * 4, wy = o.y - 18 - j * 7 + Math.cos(t * .8 + seed) * 10;
        const sx = (wx - cam.x) * s, sy = (wy - cam.y) * s;
        if (sx < -10 || sy < -10 || sx > this.canvas.width + 10 || sy > this.canvas.height + 10) continue;
        const blink = Math.max(0, Math.sin(this.time * (1.7 + j * .4) + seed * 5));
        if (blink < .15) continue;
        c.globalAlpha = blink * Math.min(1, (night - .25) * 2);
        c.fillStyle = '#fff6a8'; c.fillRect(Math.round(sx), Math.round(sy), s, s);
        c.globalAlpha *= .35; c.fillStyle = '#ffd27a'; c.fillRect(Math.round(sx - s), Math.round(sy - s), s * 3, s * 3);
      }
    }
    c.globalAlpha = 1;
  }

  // ── Townsfolk ──────────────────────────────────────────────────────────────

  private spawnFolk(): void {
    const m = this.map;
    for (let i = 0; i < m.ground.length; i++) {
      const g = m.ground[i];
      if (m.walkable[i] && (g === 'cobble' || g === 'plank' || g === 'dirt')) this.streets.push(i);
    }
    if (!this.streets.length) return;
    // Seeded, so the square looks the same on every visit (and in every screenshot).
    let a = 0x5eed;
    const rand = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let n = 0; n < FOLK; n++) {
      const i = this.streets[Math.floor(rand() * this.streets.length)];
      const x = (i % m.cols) * TILE + TILE / 2, y = Math.floor(i / m.cols) * TILE + TILE - 2;
      // Not on top of the Keeper's arrival spot.
      if (Math.hypot(x - m.spawn.x, y - m.spawn.y) < 40) { n--; continue; }
      this.folk.push({ painter: new KeeperPainter(randomLook(rand)), x, y, face: rand() < .5 ? -1 : 1, dir: 'down', moving: false, t: rand() * 4, path: [], wait: rand() * 4 });
    }
  }
  private updateFolk(dt: number): void {
    const m = this.map;
    for (const f of this.folk) {
      f.t += dt;
      if (!f.path.length) {
        f.moving = false;
        f.wait -= dt;
        if (f.wait > 0) continue;
        // Somewhere new: often a stall (browsing the market), otherwise any street within a few tiles' stroll.
        let tx: number, ty: number;
        if (Math.random() < .35 && m.stalls.length) { const s = m.stalls[Math.floor(Math.random() * m.stalls.length)]; tx = s.x + (Math.random() * 24 - 12); ty = s.y + 12; }
        else { const i = this.streets[Math.floor(Math.random() * this.streets.length)]; tx = (i % m.cols) * TILE + TILE / 2; ty = Math.floor(i / m.cols) * TILE + TILE - 2; }
        if (Math.hypot(tx - f.x, ty - f.y) > 260) { f.wait = .5; continue; }
        f.path = this.route(f.x, f.y, tx, ty) ?? [];
        f.wait = 1.5 + Math.random() * 4;
        if (!f.path.length) continue;
      }
      const p = f.path[0], dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy);
      if (d < 2) { f.path.shift(); if (!f.path.length) { f.moving = false; f.dir = 'down'; } continue; }
      const vx = dx / d, vy = dy / d, step = Math.min(d, FOLK_SPEED * dt);
      f.x += vx * step; f.y += vy * step; f.moving = true;
      if (Math.abs(vx) > .2) f.face = vx < 0 ? -1 : 1;
      f.dir = Math.abs(vy) > Math.abs(vx) * 1.2 ? (vy > 0 ? 'down' : 'up') : 'side';
    }
  }

  // ── Smoke ──────────────────────────────────────────────────────────────────

  private updateSmoke(dt: number): void {
    for (const p of this.puffs) { p.age += dt; p.y -= 9 * dt; p.x += Math.sin(p.age * 1.6 + p.r) * 3 * dt + 2 * dt; }
    this.puffs = this.puffs.filter(p => p.age < p.life);
    if (this.puffs.length > 60) return;
    for (const o of this.map.objects) {
      const s = o.sprite();
      for (const m of s.smoke ?? []) if (Math.random() < dt * 1.4) this.puffs.push({ x: o.x + m.x, y: o.y + m.y, age: 0, life: 2.8 + Math.random(), r: Math.random() * 6 });
    }
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    // 1.5 CSS px per art px on phones (~16 tiles across), 2 on tablets, 3 on wide screens; whole device pixels so pixels stay crisp.
    const css = this.canvas.clientWidth >= 1100 ? 3 : this.canvas.clientWidth >= 700 ? 2 : 1.5;
    this.scale = Math.max(1, Math.round(css * dpr));
    this.cam.w = w / this.scale; this.cam.h = h / this.scale;
    const mw = this.map.cols * TILE, mh = this.map.rows * TILE;
    this.cam.x = Math.round(Math.max(0, Math.min(mw - this.cam.w, this.player.x - this.cam.w / 2)));
    this.cam.y = Math.round(Math.max(0, Math.min(mh - this.cam.h, this.player.y - 20 - this.cam.h / 2)));
    if (this.cam.w > mw) this.cam.x = Math.round((mw - this.cam.w) / 2);
    if (this.cam.h > mh) this.cam.y = Math.round((mh - this.cam.h) / 2);
  }

  private chunk(cx: number, cy: number, frame: number): HTMLCanvasElement {
    const key = `${cx},${cy}`;
    let frames = this.chunks.get(key);
    if (!frames) {
      frames = [];
      const m = this.map;
      const kind = (c: number, r: number): Ground => m.ground[Math.max(0, Math.min(m.rows - 1, r)) * m.cols + Math.max(0, Math.min(m.cols - 1, c))];
      let liquid = false;
      for (let r = cy * CHUNK; r < (cy + 1) * CHUNK && r < m.rows; r++) for (let c = cx * CHUNK; c < (cx + 1) * CHUNK && c < m.cols; c++) if (kind(c, r) === 'water' || kind(c, r) === 'ember') liquid = true;
      for (let f = 0; f < (liquid ? 4 : 1); f++) {
        const el = document.createElement('canvas');
        el.width = CHUNK * TILE; el.height = CHUNK * TILE;
        const g = el.getContext('2d')!;
        for (let r = cy * CHUNK; r < (cy + 1) * CHUNK && r < m.rows; r++) for (let c = cx * CHUNK; c < (cx + 1) * CHUNK && c < m.cols; c++) {
          const ox = (c - cx * CHUNK) * TILE, oy = (r - cy * CHUNK) * TILE, k = kind(c, r);
          paintGround(g, k, c, r, ox, oy, f);
          paintEdge(g, k, kind(c, r - 1), 'n', c, r, ox, oy);
          paintEdge(g, k, kind(c, r + 1), 's', c, r, ox, oy);
          paintEdge(g, k, kind(c - 1, r), 'w', c, r, ox, oy);
          paintEdge(g, k, kind(c + 1, r), 'e', c, r, ox, oy);
        }
        frames.push(el);
      }
      this.chunks.set(key, frames);
    }
    return frames[((frame % frames.length) + frames.length) % frames.length];
  }

  private draw(): void {
    this.resize();
    const c = this.ctx, s = this.scale, cam = this.cam;
    c.imageSmoothingEnabled = false;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#2a1a24'; c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
    // Ground.
    const frame = Math.floor(this.time * 3) % 4;
    const span = CHUNK * TILE;
    for (let cy = Math.floor(cam.y / span); cy <= Math.floor((cam.y + cam.h) / span); cy++) {
      for (let cx = Math.floor(cam.x / span); cx <= Math.floor((cam.x + cam.w) / span); cx++) {
        if (cx < 0 || cy < 0 || cx * CHUNK >= this.map.cols || cy * CHUNK >= this.map.rows) continue;
        c.drawImage(this.chunk(cx, cy, frame), cx * span, cy * span);
      }
    }
    // Y-sorted world: objects, keepers, the Keeper, Glim.
    type Item = { y: number; draw: () => void };
    const items: Item[] = [];
    const inView = (x: number, y: number, pad = 80) => x > cam.x - pad && x < cam.x + cam.w + pad && y > cam.y - pad && y < cam.y + cam.h + pad * 2;
    const roofs: { o: TdObject; sp: Sprite }[] = [];
    for (const o of this.map.objects) {
      if (!inView(o.x, o.y, 120)) continue;
      const sp = o.sprite();
      items.push({ y: o.y, draw: () => c.drawImage(sp.img, Math.round(o.x - sp.ax), Math.round(o.y - sp.ay)) });
      if (sp.roof) roofs.push({ o, sp });
    }
    for (const k of this.keepers) if (inView(k.x, k.y)) items.push({ y: k.y, draw: () => this.drawPerson(k, 'idle') });
    for (const f of this.folk) if (inView(f.x, f.y)) items.push({ y: f.y, draw: () => this.drawPerson(f, f.moving ? 'walk' : 'idle') });
    items.push({ y: this.player.y, draw: () => this.drawPerson(this.player, this.player.moving ? 'run' : 'idle') });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();
    // Roofs and crowns, faded when the Keeper is behind or under them.
    for (const { o, sp } of roofs) {
      const r = sp.roof!;
      const x0 = o.x + r.x, y0 = o.y + r.y, x1 = x0 + r.img.width, y1 = y0 + r.img.height;
      const under = this.player.x > x0 + 2 && this.player.x < x1 - 2 && this.player.y - 20 > y0 && this.player.y - 20 < y1 + 4 && this.player.y < o.y;
      c.globalAlpha = under ? .32 : 1;
      c.drawImage(r.img, Math.round(x0), Math.round(y0));
      c.globalAlpha = 1;
    }
    // Smoke.
    for (const p of this.puffs) {
      const t = p.age / p.life;
      c.globalAlpha = (1 - t) * .55;
      c.fillStyle = '#e9e4ef';
      const r = 2 + t * 5;
      c.fillRect(Math.round(p.x - r / 2), Math.round(p.y - r / 2), Math.round(r), Math.round(r));
    }
    c.globalAlpha = 1;
    // Glim: a small warm light with a pixel core.
    c.fillStyle = '#fff4c2'; c.fillRect(Math.round(this.glim.x) - 1, Math.round(this.glim.y) - 1, 3, 3);
    c.fillStyle = '#ffd27a'; c.fillRect(Math.round(this.glim.x) - 2, Math.round(this.glim.y), 1, 1); c.fillRect(Math.round(this.glim.x) + 2, Math.round(this.glim.y), 1, 1);
    // Night.
    this.drawLight();
    this.drawFireflies();
    // The drag joystick: a ring where the thumb landed and a knob under it (screen space).
    if (this.joy?.active) {
      const r = this.canvas.getBoundingClientRect(), k = this.canvas.width / Math.max(1, r.width);
      const sx = (this.joy.sx - r.left) * k, sy = (this.joy.sy - r.top) * k;
      let dx = (this.joy.x - this.joy.sx) * k, dy = (this.joy.y - this.joy.sy) * k;
      const max = 48 * k, len = Math.hypot(dx, dy);
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = .5; c.strokeStyle = '#f3e7cf'; c.lineWidth = 3 * k;
      c.beginPath(); c.arc(sx, sy, max, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = .75; c.fillStyle = '#f3e7cf';
      c.beginPath(); c.arc(sx + dx, sy + dy, 18 * k, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
    }
    // World UI: name plates for keepers, the label of the stall in reach.
    c.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
    c.textAlign = 'center'; c.textBaseline = 'bottom';
    for (const k of this.keepers) if (k.name && inView(k.x, k.y) && Math.hypot(this.player.x - k.x, this.player.y - k.y) < 90) this.plate(k.name, k.x, k.y - 38, '#f3e7cf');
    if (this.nearby) this.plate(this.nearby.station.label, this.nearby.x, this.nearby.y - (this.nearby.keeper ? 58 : 36), '#ffd27a');
  }

  private drawPerson(p: Person, action: 'idle' | 'run' | 'walk'): void {
    const c = this.ctx, s = this.scale, cam = this.cam;
    // Soft shadow under the feet.
    c.fillStyle = 'rgba(30,18,26,.28)';
    c.fillRect(Math.round(p.x - 6), Math.round(p.y - 2), 12, 3);
    if (!p.painter) return;
    if (p.dir !== 'side') {
      const sheet = frontSheet(p.painter), row = p.dir === 'down' ? 0 : 1;
      const f = p === this.player && this.phone && row === 0 ? PHONE_FRAME : frontFrame(this.time + p.t, p.moving);
      c.drawImage(sheet, f * FRONT_W, row * FRONT_H, FRONT_W, FRONT_H, Math.round(p.x) - FRONT_AX, Math.round(p.y) - FRONT_AY, FRONT_W, FRONT_H);
      return;
    }
    c.save();
    c.setTransform(s * p.face, 0, 0, s, (Math.round(p.x) - cam.x) * s, (Math.round(p.y) - cam.y) * s);
    p.painter.draw(c, 1, { action, time: this.time + p.t, attackT: 0, weapon: p === this.player });
    c.restore();
  }

  private plate(text: string, x: number, y: number, color: string): void {
    const c = this.ctx;
    c.font = '7px "Pixelify Sans", monospace';
    const w = Math.ceil(c.measureText(text).width) + 6;
    c.fillStyle = 'rgba(26,16,30,.82)';
    c.fillRect(Math.round(x - w / 2), Math.round(y - 9), w, 9);
    c.fillStyle = color;
    c.fillText(text, Math.round(x), Math.round(y - 1));
  }

  /** Darkness by the hour (day clear → dusk amber → night blue), holes for every light. */
  private drawLight(): void {
    const night = this.darkness;
    if (this.dusk > .05 && night < .5) {
      // Dawn and dusk: a warm wash before the dark.
      const c0 = this.ctx; c0.setTransform(1, 0, 0, 1, 0, 0); c0.globalAlpha = .16 * this.dusk; c0.fillStyle = '#ff9a4a';
      c0.fillRect(0, 0, this.canvas.width, this.canvas.height); c0.globalAlpha = 1;
    }
    if (night <= .02) return;
    const cam = this.cam, s = this.scale;
    const hw = Math.max(1, Math.ceil(cam.w / 2)), hh = Math.max(1, Math.ceil(cam.h / 2));
    if (!this.dark || this.dark.width !== hw || this.dark.height !== hh) { this.dark = document.createElement('canvas'); this.dark.width = hw; this.dark.height = hh; }
    if (!this.lightSprite) {
      const l = document.createElement('canvas'); l.width = l.height = 64;
      const g = l.getContext('2d')!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(.55, 'rgba(0,0,0,.6)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
      this.lightSprite = l;
    }
    const d = this.dark.getContext('2d')!;
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, hw, hh);
    d.fillStyle = `rgba(18,20,52,${(.62 * night).toFixed(3)})`;
    d.fillRect(0, 0, hw, hh);
    d.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number) => d.drawImage(this.lightSprite!, (x - cam.x - r) / 2, (y - cam.y - r) / 2, r, r);
    const glows: { x: number; y: number; r: number }[] = [];
    for (const o of this.map.objects) {
      const sp = o.sprite();
      for (const l of sp.lights ?? []) { hole(o.x + l.x, o.y + l.y, l.r * 2); if (l.warm) glows.push({ x: o.x + l.x, y: o.y + l.y, r: l.r }); }
    }
    // The ember river lights its banks.
    const m = this.map;
    for (let r = Math.max(0, Math.floor(cam.y / TILE)); r < Math.min(m.rows, Math.ceil((cam.y + cam.h) / TILE)); r++) {
      for (let cc = Math.max(0, Math.floor(cam.x / TILE)); cc < Math.min(m.cols, Math.ceil((cam.x + cam.w) / TILE)); cc += 2) {
        if (m.ground[r * m.cols + cc] === 'ember') hole(cc * TILE + 8, r * TILE + 8, 40);
      }
    }
    hole(this.player.x, this.player.y - 16, 70);
    hole(this.glim.x, this.glim.y, 56);
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.dark, 0, 0, hw * 2 * s, hh * 2 * s);
    c.imageSmoothingEnabled = false;
    // Warm glow added on top for windows and lamps: a soft round sprite, never squares.
    if (!this.glowSprite) {
      const l = document.createElement('canvas'); l.width = l.height = 64;
      const g = l.getContext('2d')!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,190,96,1)'); grad.addColorStop(.4, 'rgba(255,150,60,.45)'); grad.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
      this.glowSprite = l;
    }
    c.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
    c.imageSmoothingEnabled = true;
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = .38 * night;
    for (const g of glows) if (g.x > cam.x - 60 && g.x < cam.x + cam.w + 60 && g.y > cam.y - 60 && g.y < cam.y + cam.h + 60) c.drawImage(this.glowSprite, g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
    c.globalAlpha = 1;
    c.imageSmoothingEnabled = false;
    c.globalCompositeOperation = 'source-over';
  }
}

/**
 * The top-down engine behind the side-scroller's type: every member the play
 * component calls that the top-down world does not implement yet answers as a
 * harmless no-op (undefined / null), so the component's wiring stays intact
 * while the phases fill them in (docs/design/top-down.md §5).
 */
export function createTopDownEngine(canvas: HTMLCanvasElement, options: EngineOptions): TopDownEngine {
  const engine = new TopDownEngine(canvas, options);
  const noop = () => undefined;
  return new Proxy(engine, {
    get(target, key, receiver) {
      if (key in target) {
        const value = Reflect.get(target, key, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      }
      return noop;
    },
  });
}

/** The top-down gate: `?td=1` turns it on for this browser, `?td=0` off. Off by default. */
export function topDownGate(): boolean {
  // Top-down is the game now (owner, 2026-10-19): on unless this device chose the old view with `?td=0`.
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search).get('td');
    if (q === '1') localStorage.removeItem('eclipse-td');
    if (q === '0') localStorage.setItem('eclipse-td', '0');
    return localStorage.getItem('eclipse-td') !== '0';
  } catch { return true; }
}
