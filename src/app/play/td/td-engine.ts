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
import { vocationLook } from '../../shared/keeper-look/vocation-look';
import { CAST_FRAME, FRONT_AX, FRONT_AY, FRONT_H, FRONT_W, PHONE_FRAME, frontFrame, frontSheet } from '../../shared/keeper-look/keeper-front';
import { NPC_LOOKS } from '../../shared/keeper-look/npc-looks';
import { defaultLook, randomLook, type KeeperLook } from '../../shared/keeper-look/keeper-look.model';
import type { KeeperGear } from '../../shared/keeper-look/keeper-gear';
import { PAL, paintEdge, paintGround, TILE, type Ground, type Sprite } from './td-art';
import { type TdMap, type TdObject, type TdStall } from './seamworks-square';
import { TdWorld } from './td-world';
import { HandLevel, type TdLevel } from './td-level';
import { EMBER_MINE_1 } from './maps/ember-mine-1';
import { EMBER_MINE_2, EMBER_MINE_3 } from './maps/ember-mine-deep';
import type { TdMapDef } from './td-level';

/** Every hand-drawn level under (or over) the surface, by id. */
const LEVELS: Readonly<Record<string, TdMapDef>> = { 'ember-mine-1': EMBER_MINE_1, 'ember-mine-2': EMBER_MINE_2, 'ember-mine-3': EMBER_MINE_3 };
import { MobSystem, mobSheet, type Mob } from './td-mobs';
import { MAX_MANA, SKILLS, defaultBar, type SkillId } from './td-skills';

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
  private readonly world: TdWorld;
  /** The level the Keeper is on: the surface, or a hand-drawn floor under it. */
  private level: TdLevel;
  private readonly levels = new Map<string, HandLevel>();
  /** Monsters, the Keeper's fight and the loot on the ground (td-mobs.ts). */
  private readonly mobs: MobSystem;
  private hp = 100;
  private readonly maxHp = 100;
  private lastHurt = -99;
  private messageAge = 0;
  /** The engine's own line, as an i18n key the HUD translates (engineMessage). */
  private messageKey = '';
  private spawnTimer = 0;
  private chaseTimer = 0;
  /** The swing being played (seconds left) and which way it faces. */
  private actT = 0;
  /** A tree being cut: hits so far, the next swing's timer. */
  private chop: { c: number; r: number; x: number; y: number; hits: number; t: number } | null = null;
  private shake = 0;
  /** The stamped town (its stalls, keepers and streets); the ground and walls everywhere come from `world`. */
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
  private frameError = false;
  /** The objects drawn this frame (smoke, lights and fireflies read them). */
  private visible: TdObject[] = [];

  constructor(private readonly canvas: HTMLCanvasElement, private readonly options: EngineOptions) {
    this.ctx = canvas.getContext('2d')!;
    this.world = new TdWorld();
    this.map = this.world.town;
    this.level = this.world;
    this.mobs = new MobSystem({
      options: this.options,
      walkable: (c, r) => this.level.walkable(c, r),
      levelId: () => this.level.id,
      player: () => this.player,
      hurtPlayer: n => this.hurt(n),
      healPlayer: n => { this.hp = Math.min(this.maxHp, this.hp + n); },
      swung: at => { this.actT = .3; if (at && Math.abs(at.x - this.player.x) > 2) this.player.face = at.x < this.player.x ? -1 : 1; this.player.dir = 'side'; },
    });
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
      // Schedule first: one bad frame (a host callback throwing) must never stop the world.
      this.raf = requestAnimationFrame(loop);
      try {
        if (!this.paused) this.update(dt);
        this.draw();
      } catch (err) {
        if (!this.frameError) { this.frameError = true; console.error('[top-down] frame error', err); }
      }
    };
    this.raf = requestAnimationFrame(loop);
  }
  destroy(): void {
    cancelAnimationFrame(this.raf); this.raf = 0;
    for (const off of this.unbind) off();
  }
  setPaused(paused: boolean): void { this.paused = paused; if (paused) { this.keys.clear(); this.joy = null; } }
  setPhone(on: boolean): void {
    // Called on every HUD tick: turn to the camera only as the Slate comes out, never mid-walk afterwards.
    if (on && !this.phone && !this.player.moving) this.player.dir = 'down';
    this.phone = on;
  }
  setWorldHour(hour: number): void { this.hour = ((hour % 24) + 24) % 24; }
  /** The world clock's sky (world-clock.model.ts Sky): light 1 = day, 0 = dark; glow = dawn/dusk gold. */
  setSky(sky: { light: number; glow: number; eclipse: number }): void {
    if (this.pinned !== null) return;
    this.darkness = Math.max(0, Math.min(1, 1 - sky.light));
    this.dusk = sky.glow;
  }
  setKeeperLook(look: KeeperLook | null, gear: KeeperGear | null = null): void {
    const l = look ?? defaultLook();
    // The Warlock is undead (owner, 2026-10-20): grey-green skin, a dark violet robe with bone trim, a hood, eyes that
    // burn violet. Worn gear still shows over it; the hood stands in only when no head piece is worn.
    const v = vocationLook(l.vocation, gear);
    this.player.painter = new KeeperPainter(l, v.gear, v.garb);
  }
  setInput(action: EngineInput, pressed: boolean): void {
    // The side view's on-screen buttons: left/right walk, down walks south, jump walks north.
    if (action === 'attack') { this.mobs.attacking = pressed; return; }
    const key = action === 'left' ? 'a' : action === 'right' ? 'd' : action === 'down' ? 's' : action === 'jump' ? 'w' : '';
    if (!key) return;
    if (pressed) { this.keys.add(key); this.path = []; } else this.keys.delete(key);
  }
  interact(): void {
    if (this.nearby) { this.use(this.nearby); return; }
    const t = this.treeNear();
    if (t) this.startChop(t.c, t.r, t.x, t.y);
  }
  /** The skills on keys 1–4 (the Spellbook assigns them). */
  private bar: SkillId[] = defaultBar('warlock');
  /** Use a skill on the bar (by id, or by slot '1'–'4'). Returns why not, or null when it went off. */
  useAbility(idOrSlot: string): 'cooldown' | 'nofoe' | 'mana' | null {
    const id = /^[1-4]$/.test(idOrSlot) ? this.bar[Number(idOrSlot) - 1] : idOrSlot as SkillId;
    if (!id) return null;
    return this.paused ? 'cooldown' : this.mobs.useAbility(id);
  }
  /** The bar for the HUD: each slot's skill, cooldown left (0–1), and whether there is mana for it. */
  get abilities(): readonly { id: string; key: string; left: number; mana: number; ready: boolean }[] {
    return this.bar.map((id, i) => ({ id, key: String(i + 1), left: SKILLS[id].cd ? (this.mobs.cooldowns[id] ?? 0) / SKILLS[id].cd : 0, mana: SKILLS[id].mana, ready: this.mobs.mana >= SKILLS[id].mana }));
  }
  get mana(): number { return this.mobs.mana; }
  get maxMana(): number { return MAX_MANA; }
  get aura(): SkillId | null { return this.mobs.aura; }
  get ward(): number { return this.mobs.ward; }
  /** The Spellbook's choices: the bar (up to four actives) and the running aura. */
  setSkillLoadout(bar: readonly string[], aura: string | null): void {
    const ok = bar.filter((id): id is SkillId => id in SKILLS && SKILLS[id as SkillId].kind === 'active').slice(0, 4);
    if (ok.length) this.bar = ok;
    this.mobs.aura = aura && aura in SKILLS && SKILLS[aura as SkillId].kind === 'aura' ? aura as SkillId : null;
  }
  get hasted(): boolean { return this.mobs.haste > 0; }

  private say(key: string): void { this.messageKey = key; this.message = key; this.messageAge = 0; }

  // ── Woodcutting ────────────────────────────────────────────────────────────

  /** A standing tree beside the Keeper (surface only). */
  private treeNear(): { c: number; r: number; x: number; y: number } | null {
    if (this.level !== this.world) return null;
    const pc = Math.floor(this.player.x / TILE), pr = Math.floor((this.player.y - 1) / TILE);
    let best: { c: number; r: number; x: number; y: number } | null = null, bd = 26;
    for (let r = pr - 2; r <= pr + 2; r++) for (let c = pc - 2; c <= pc + 2; c++) {
      const o = this.world.treeAt(c, r);
      if (!o) continue;
      const d = Math.hypot(o.x - this.player.x, o.y - this.player.y);
      if (d < bd) { bd = d; best = { c, r, x: o.x, y: o.y }; }
    }
    return best;
  }
  private startChop(c: number, r: number, x: number, y: number): void {
    this.chop = { c, r, x, y, hits: 0, t: 0 };
    this.player.face = x < this.player.x ? -1 : 1;
  }
  private updateChop(dt: number): void {
    const ch = this.chop;
    if (!ch) return;
    ch.t -= dt;
    if (ch.t > 0) return;
    ch.t = .55;
    ch.hits++;
    this.actT = .3; this.player.dir = 'side'; this.player.face = ch.x < this.player.x ? -1 : 1;
    this.shake = .15;
    this.mobs.chips(ch.x, ch.y - 12);
    if (ch.hits < 4) return;
    // Felled: the host books Woodcutting XP and the bark (a roll) like any trunk in the old hunts.
    const bark = Math.random() < .6;
    const ok = this.options.onWorldAction?.({
      kind: 'chop', areaId: 'ember-quarry', cellKey: `${ch.c},${ch.r}`, discipline: 'woodcutting', xp: 4,
      mutationId: `td-chop:${ch.c},${ch.r}:${Date.now().toString(36)}`, site: 'td-tree',
      ...(bark ? { materialId: 'world-root-bark', qty: 1 } : {}),
    } as Parameters<NonNullable<EngineOptions['onWorldAction']>>[0]);
    if (ok !== false) this.world.fell(ch.c, ch.r, 90_000);
    this.chop = null;
  }
  /** Use a stall: the seam, the forge and the beacon are the play view's own deeds (onInteract); the rest open. */
  private use(s: TdStall): void {
    const id = s.station.id;
    // Down the mine shaft: the hand-drawn Ember Mine (never the old 2D Delve).
    if (id === 'delve' && this.level === this.world) { this.enter(this.handLevel('ember-mine-1'), 'mine-up'); return; }
    if (this.level instanceof HandLevel) {
      // A ladder, stairs or a hole: to the level it names, in front of its own way back.
      const exit = this.level.exits.get(id);
      if (exit) { this.enter(exit.to === 'surface' ? this.world : this.handLevel(exit.to), exit.arrive); return; }
    }
    if (id === 'ore' || id === 'forge' || id === 'beacon') this.options.onInteract?.(id);
    else this.options.onStation?.(s.station);
  }
  get inTown(): boolean { return true; }
  // The side view's queries the HUD dereferences: real answers, never the Proxy's undefined (a crash in onState froze the loop).
  pick(clientX: number, clientY: number): { x: number; y: number; station: StationDef | null } {
    const w = this.toWorld(clientX, clientY);
    return { x: w.x, y: w.y, station: this.stallAt(w.x, w.y)?.station ?? null };
  }
  delveAnchors(): readonly never[] { return []; }
  hasDelveCamp(): boolean { return false; }
  readRiftMap(): boolean { return false; }
  get places(): readonly StationDef[] { return this.level.stalls.map(s => s.station); }
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
    // The nearest of its kind (a floor has many seams of one ore).
    let s: TdStall | undefined, best = Infinity;
    for (const st of this.level.stalls) if (st.station.id === id) { const d = Math.hypot(st.x - this.player.x, st.y - this.player.y); if (d < best) { best = d; s = st; } }
    if (!s) return false;
    // Instant (reduced motion, a deep link): stand there and use it, as the side view's travel did.
    if (instant) { this.player.x = s.x; this.player.y = s.y + 10; this.path = []; this.use(s); return true; }
    return this.walkTo(s.x, s.y + 10, () => this.use(s));
  }
  moveTo(x: number, onArrive?: () => void): boolean { return this.walkTo(x, this.player.y, onArrive); }

  private handLevel(id: string): HandLevel {
    let lv = this.levels.get(id);
    if (!lv) { lv = new HandLevel(LEVELS[id] ?? EMBER_MINE_1); this.levels.set(id, lv); }
    return lv;
  }
  /** Change level: stand in front of `at` (a station on the new level), drop the old level's baked ground. */
  private enter(level: TdLevel, at: string): void {
    this.level = level;
    this.chunks.clear();
    this.path = []; this.arrive = null; this.puffs = [];
    this.mobs.enterLevel(level === this.world ? [] : level.spawnsIn(-1e6, -1e6, 1e6, 1e6));
    const s = level.stalls.find(st => st.station.id === at);
    if (s) { this.player.x = s.x; this.player.y = s.y + 14; }
    this.player.dir = 'down';
    this.glim.x = this.player.x + 12; this.glim.y = this.player.y - 40;
    this.report();
  }

  /** A creature's bite. At zero the Keeper wakes in the square, whole (a cozy fall: nothing is lost). */
  private hurt(n: number): void {
    this.hp = Math.max(0, this.hp - n);
    this.lastHurt = this.time;
    if (this.hp > 0) return;
    this.hp = this.maxHp;
    this.say('play.td.fell');
    this.enter(this.world, '');
    this.player.x = this.map.spawn.x; this.player.y = this.map.spawn.y;
    this.mobs.target = null;
  }

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
    if (vx || vy) { this.path = []; this.chop = null; }
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
      const speed = SPEED * (this.mobs.haste > 0 ? 1.5 : 1);
      this.tryMove(vx * speed * dt, 0);
      this.tryMove(0, vy * speed * dt);
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
    for (const s of this.level.stalls) {
      const d = Math.hypot(this.player.x - s.x, this.player.y - (s.y + 10));
      if (d < bestD) { best = s; bestD = d; }
    }
    this.nearby = best;
    this.updateSmoke(dt);
    this.updateFight(dt);
    this.updateChop(dt);
    this.actT = Math.max(0, this.actT - dt); this.shake = Math.max(0, this.shake - dt);
    // A line of the engine's own (a fall) fades from the HUD after a few seconds.
    if (this.message || this.messageKey) { this.messageAge += dt; if (this.messageAge > 4) { this.message = ''; this.messageKey = ''; this.messageAge = 0; } }
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) { this.stateTimer = .1; this.report(); }
  }

  private tryMove(dx: number, dy: number): void {
    const nx = this.player.x + dx, ny = this.player.y + dy;
    if (this.free(nx, ny)) { this.player.x = nx; this.player.y = ny; }
  }
  private free(x: number, y: number): boolean {
    for (const [px, py] of [[x - FOOT.w / 2, y - FOOT.h], [x + FOOT.w / 2, y - FOOT.h], [x - FOOT.w / 2, y - 1], [x + FOOT.w / 2, y - 1]]) {
      if (!this.level.walkable(Math.floor(px / TILE), Math.floor(py / TILE))) return false;
    }
    return true;
  }

  private report(): void {
    const s = this.nearby;
    const state: EngineState = {
      hp: Math.round(this.hp), enemyHp: 0, nearby: s ? s.station.id : this.treeNear() ? 'td-tree' : null,
      nearbyLabel: s ? s.station.label : this.treeNear() ? 'CHOP TREE' : undefined, nearbyKind: s?.station.kind ?? (this.treeNear() ? 'resource' : undefined),
      x: Math.round(this.player.x), y: Math.round(this.player.y),
      area: this.level.placeName(this.player.x, this.player.y), areaId: 'infernal', facing: this.player.face,
      animation: this.player.moving ? 'run' : 'idle', delve: false, coins: 0, kills: 0,
      paused: this.paused, defeated: false, enemyDefeated: false, complete: false, message: this.message, ...(this.messageKey ? { messageKey: this.messageKey } : {}),
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
    // The world has no edge: tiles are keyed by an offset pair, and the search gives up past a few thousand tiles.
    const K = 0x10000, O = 0x8000;
    const key = (c: number, r: number) => (c + O) * K + (r + O);
    const colOf = (k: number) => Math.floor(k / K) - O, rowOf = (k: number) => (k % K) - O;
    const at = (x: number, y: number) => [Math.floor(x / TILE), Math.floor((y - 1) / TILE)] as const;
    const [sc, sr] = at(fx, fy);
    let [ec, er] = at(tx, ty);
    const ok = (c: number, r: number) => this.level.walkable(c, r);
    if (!ok(ec, er)) {
      // Nearest walkable tile to the target (a tap on a roof or the river).
      let best: [number, number] | null = null, bd = 1e9;
      for (let r = er - 4; r <= er + 4; r++) for (let c = ec - 4; c <= ec + 4; c++) if (ok(c, r)) { const d = (c - ec) ** 2 + (r - er) ** 2; if (d < bd) { bd = d; best = [c, r]; } }
      if (!best) return null;
      [ec, er] = best;
    }
    const start = key(sc, sr), goal = key(ec, er);
    const g = new Map<number, number>([[start, 0]]), from = new Map<number, number>();
    const open: [number, number][] = [[0, start]];
    const h = (k: number) => Math.hypot(colOf(k) - ec, rowOf(k) - er);
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]);
      const [, cur] = open.shift()!;
      if (cur === goal) break;
      const cc = colOf(cur), cr = rowOf(cur);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nc = cc + dc, nr = cr + dr;
        if (!ok(nc, nr) || (dc && dr && (!ok(cc + dc, cr) || !ok(cc, cr + dr)))) continue;
        const ni = key(nc, nr), ng = g.get(cur)! + (dc && dr ? 1.414 : 1);
        if (ng < (g.get(ni) ?? Infinity)) { g.set(ni, ng); from.set(ni, cur); open.push([ng + h(ni), ni]); }
      }
      if (g.size > 4000) break;
    }
    if (!g.has(goal)) return null;
    const pts: { x: number; y: number }[] = [];
    for (let k = goal; k !== start; k = from.get(k)!) pts.unshift({ x: colOf(k) * TILE + TILE / 2, y: rowOf(k) * TILE + TILE - 2 });
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
      if (k === 'j' || k === ' ') { e.preventDefault(); this.mobs.attacking = down; return; }
      if (/^[1-4]$/.test(k)) { if (down && !e.repeat) { const why = this.useAbility(k); if (why) this.say(`play.td.ability.${why}`); } return; }
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
  private toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: this.cam.x + (clientX - rect.left) * (this.canvas.width / Math.max(1, rect.width)) / this.scale,
      y: this.cam.y + (clientY - rect.top) * (this.canvas.height / Math.max(1, rect.height)) / this.scale,
    };
  }
  private stallAt(wx: number, wy: number): TdStall | undefined {
    return this.level.stalls.find(s => Math.abs(wx - s.x) < 34 && wy > s.y - 46 && wy < s.y + 16);
  }
  private tap(clientX: number, clientY: number): void {
    const { x: wx, y: wy } = this.toWorld(clientX, clientY);
    // A creature under the finger is the target (Tibia's click-to-attack): the Keeper closes in and swings.
    const foe = this.mobs.mobAt(wx, wy);
    if (foe) { this.mobs.target = foe; this.chaseTimer = 0; return; }
    this.mobs.target = null;
    if (this.level === this.world) {
      const tc = Math.floor(wx / TILE), tr = Math.floor((wy + 6) / TILE);
      for (const [c, r] of [[tc, tr], [tc, tr + 1], [tc, tr + 2]]) {
        const o = this.world.treeAt(c, r);
        if (o) { this.walkTo(o.x, o.y + 12, () => this.startChop(c, r, o.x, o.y)); return; }
      }
    }
    const hit = this.stallAt(wx, wy);
    if (hit) { this.walkTo(hit.x, hit.y + 10, () => this.use(hit)); return; }
    this.walkTo(wx, wy);
  }

  // ── Minimap (the round compass in the HUD's top-right, like the references) ──

  /** Draw the town round the Keeper into a small square canvas (the HUD clips it round). */
  drawMinimap(target: HTMLCanvasElement): void {
    const c = target.getContext('2d');
    if (!c) return;
    const W = target.width, H = target.height, k = Math.max(2, Math.round(W / 24));   // ~24 tiles across
    const span = Math.ceil(W / k / 2) + 1;
    const pc = Math.floor(this.player.x / TILE), pr = Math.floor(this.player.y / TILE);
    const ox = W / 2 - (this.player.x / TILE - pc) * k, oy = H / 2 - (this.player.y / TILE - pr) * k;
    const col: Partial<Record<Ground, string>> = { grass: PAL.grass[0], flowers: PAL.grass[1], dirt: PAL.dirt[0], cobble: PAL.cobble[0], sand: PAL.sand[0], plank: PAL.plank[0], water: PAL.water[0], ember: PAL.ember[0], cave: '#6a564c', rock: '#1d1720' };
    c.imageSmoothingEnabled = false;
    // The ground round the Keeper, sampled from the world each time (it has no edge to pre-paint).
    for (let r = -span; r <= span; r++) for (let q = -span; q <= span; q++) {
      c.fillStyle = col[this.level.ground(pc + q, pr + r)] ?? PAL.grass[0];
      c.fillRect(Math.floor(ox + q * k - k / 2), Math.floor(oy + r * k - k / 2), k, k);
    }
    const toX = (x: number) => Math.round(W / 2 + (x - this.player.x) / TILE * k), toY = (y: number) => Math.round(H / 2 + (y - this.player.y) / TILE * k);
    const reach = span * TILE;
    for (const o of this.level.objectsIn(this.player.x - reach, this.player.y - reach, this.player.x + reach, this.player.y + reach)) {
      if (o.kind !== 'building' && o.kind !== 'tree') continue;
      const w = (o.block?.w ?? 1) * k, h = (o.block?.h ?? 1) * k;
      c.fillStyle = o.kind === 'building' ? PAL.roofRed[2] : PAL.leaf[2];
      c.fillRect(toX(o.x) - Math.floor(w / 2), toY(o.y) - h, w, h);
    }
    const dot = (x: number, y: number, r: number, fill: string) => {
      const sx = toX(x), sy = toY(y);
      c.fillStyle = PAL.outline; c.fillRect(sx - r - 1, sy - r - 1, r * 2 + 2, r * 2 + 2);
      c.fillStyle = fill; c.fillRect(sx - r, sy - r, r * 2, r * 2);
    };
    for (const st of this.level.stalls) dot(st.x, st.y, Math.max(1, k >> 1), PAL.glow);
    if (this.level === this.world) for (const f of this.folk) { c.fillStyle = 'rgba(42,26,36,.55)'; c.fillRect(toX(f.x), toY(f.y), Math.max(1, k >> 1), Math.max(1, k >> 1)); }
    dot(this.player.x, this.player.y, Math.max(2, k - 1), '#ffffff');
  }

  // ── Fireflies: dusk and night, round the trees and the flower beds (the references' summer evenings) ──

  private drawFireflies(): void {
    const night = Math.max(this.darkness, this.dusk * .6);
    if (night < .25) return;
    const c = this.ctx, s = this.scale, cam = this.cam;
    c.setTransform(1, 0, 0, 1, 0, 0);
    let n = 0;
    for (const o of this.visible) {
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

  // ── The fight ──────────────────────────────────────────────────────────────

  private updateFight(dt: number): void {
    // The endless surface hands over the spawns round the Keeper as they come into reach, and forgets far ones.
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.level === this.world) {
      this.spawnTimer = .5;
      const r = 420;
      this.mobs.addSpawns(this.world.spawnsIn(this.player.x - r, this.player.y - r, this.player.x + r, this.player.y + r));
      this.mobs.prune(900);
    }
    // Chasing a target (Tibia): walk into reach of it, re-aimed as it moves.
    const t = this.mobs.target;
    this.chaseTimer -= dt;
    if (t && this.chaseTimer <= 0 && !this.keys.size && !this.joy?.active) {
      this.chaseTimer = .4;
      // Close in only to the staff's range (a Warlock fights from a distance).
      if (Math.hypot(t.x - this.player.x, t.y - this.player.y) > this.mobs.range - 12) { const route = this.route(this.player.x, this.player.y, t.x, t.y); if (route) { this.path = route; this.arrive = null; } }
      else this.path = [];
    }
    this.mobs.update(dt);
    // Out of the fight a while: the Keeper mends.
    if (this.hp < this.maxHp && this.time - this.lastHurt > 4) this.hp = Math.min(this.maxHp, this.hp + 6 * dt);
  }

  // ── Smoke ──────────────────────────────────────────────────────────────────

  private updateSmoke(dt: number): void {
    for (const p of this.puffs) { p.age += dt; p.y -= 9 * dt; p.x += Math.sin(p.age * 1.6 + p.r) * 3 * dt + 2 * dt; }
    this.puffs = this.puffs.filter(p => p.age < p.life);
    if (this.puffs.length > 60) return;
    for (const o of this.visible) {
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
    // No edge to clamp to: the world runs on in every direction.
    this.cam.x = Math.round(this.player.x - this.cam.w / 2);
    this.cam.y = Math.round(this.player.y - 20 - this.cam.h / 2);
  }

  private chunk(cx: number, cy: number, frame: number): HTMLCanvasElement {
    const key = `${cx},${cy}`;
    let frames = this.chunks.get(key);
    if (!frames) {
      frames = [];
      const kind = (c: number, r: number): Ground => this.level.ground(c, r);
      let liquid = false;
      for (let r = cy * CHUNK; r < (cy + 1) * CHUNK; r++) for (let c = cx * CHUNK; c < (cx + 1) * CHUNK; c++) if (kind(c, r) === 'water' || kind(c, r) === 'ember') liquid = true;
      for (let f = 0; f < (liquid ? 4 : 1); f++) {
        const el = document.createElement('canvas');
        el.width = CHUNK * TILE; el.height = CHUNK * TILE;
        const g = el.getContext('2d')!;
        for (let r = cy * CHUNK; r < (cy + 1) * CHUNK; r++) for (let c = cx * CHUNK; c < (cx + 1) * CHUNK; c++) {
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
      // Far chunks go (the world never ends; their canvases must not pile up).
      if (this.chunks.size > 96) this.chunks.delete(this.chunks.keys().next().value!);
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
        c.drawImage(this.chunk(cx, cy, frame), cx * span, cy * span);
      }
    }
    // Y-sorted world: objects, keepers, the Keeper, Glim.
    type Item = { y: number; draw: () => void };
    const items: Item[] = [];
    const inView = (x: number, y: number, pad = 80) => x > cam.x - pad && x < cam.x + cam.w + pad && y > cam.y - pad && y < cam.y + cam.h + pad * 2;
    const roofs: { o: TdObject; sp: Sprite }[] = [];
    const visible = this.level.objectsIn(cam.x - 120, cam.y - 80, cam.x + cam.w + 120, cam.y + cam.h + 240);
    this.visible = visible;
    for (const o of visible) {
      const sp = o.sprite();
      const jig = this.chop && this.shake > 0 && o.kind === 'tree' && o.x === this.chop.x && o.y === this.chop.y ? Math.round(Math.sin(this.time * 70) * 1.5) : 0;
      items.push({ y: o.y, draw: () => c.drawImage(sp.img, Math.round(o.x - sp.ax) + jig, Math.round(o.y - sp.ay)) });
      if (sp.roof) roofs.push({ o, sp });
    }
    const surface = this.level === this.world;
    for (const k of this.keepers) if (surface && inView(k.x, k.y)) items.push({ y: k.y, draw: () => this.drawPerson(k, 'idle') });
    for (const f of this.folk) if (surface && inView(f.x, f.y)) items.push({ y: f.y, draw: () => this.drawPerson(f, f.moving ? 'walk' : 'idle') });
    for (const g of this.mobs.drops) if (inView(g.x, g.y)) items.push({ y: g.y - 6, draw: () => this.drawDrop(g.x, g.y, g.color, !!g.item || !!g.rune, g.coins > 0) });
    for (const m of this.mobs.mobs) if (inView(m.x, m.y)) items.push({ y: m.y, draw: () => this.drawMob(m) });
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
    for (const k of this.keepers) if (this.level === this.world && k.name && inView(k.x, k.y) && Math.hypot(this.player.x - k.x, this.player.y - k.y) < 90) this.plate(k.name, k.x, k.y - 38, '#f3e7cf');
    this.drawEffects();
    this.drawFightUi(inView);
    if (this.nearby) this.plate(this.nearby.station.label, this.nearby.x, this.nearby.y - (this.nearby.keeper ? 58 : 36), '#ffd27a');
  }

  private drawMob(m: Mob): void {
    const c = this.ctx, d = m.def, sheet = mobSheet(d), f = Math.floor(m.t * 4) % 2;
    c.fillStyle = 'rgba(30,18,26,.3)'; c.fillRect(Math.round(m.x - d.w / 2 + 2), Math.round(m.y - 2), d.w - 4, 3);
    // The target stands in a red pixel square (Tibia).
    if (m === this.mobs.target) { c.strokeStyle = '#ff4a3a'; c.lineWidth = 1; c.strokeRect(Math.round(m.x - d.w / 2) - 2.5, Math.round(m.y - d.h) - 2.5, d.w + 5, d.h + 5); }
    c.save();
    c.translate(Math.round(m.x), Math.round(m.y - d.h));
    if (m.face < 0) c.scale(-1, 1);
    c.drawImage(sheet, f * d.w, 0, d.w, d.h, -Math.floor(d.w / 2), 0, d.w, d.h);
    if (m.hit > 0) { c.globalCompositeOperation = 'source-atop'; c.globalAlpha = .7; c.fillStyle = '#ffffff'; c.fillRect(-d.w / 2, 0, d.w, d.h); }
    c.restore();
  }
  /** A drop on the ground: a coin pile, a sack, or gear lying in a beam of its rarity colour. */
  private drawDrop(x: number, y: number, color: string, gear: boolean, coins: boolean): void {
    const c = this.ctx, X = Math.round(x), Y = Math.round(y);
    if (gear) {
      c.globalAlpha = .28 + Math.sin(this.time * 4) * .08; c.fillStyle = color; c.fillRect(X - 1, Y - 26, 3, 24); c.globalAlpha = 1;
      c.fillStyle = '#2a1a24'; c.fillRect(X - 4, Y - 6, 9, 5); c.fillStyle = color; c.fillRect(X - 3, Y - 5, 7, 3); c.fillStyle = '#ffffff'; c.fillRect(X - 2, Y - 5, 2, 1);
    } else if (coins) {
      c.fillStyle = '#2a1a24'; c.fillRect(X - 5, Y - 5, 10, 5); c.fillStyle = '#e8a83a'; c.fillRect(X - 4, Y - 4, 8, 3); c.fillStyle = '#ffd25a'; c.fillRect(X - 3, Y - 5, 3, 2); c.fillRect(X + 1, Y - 4, 2, 1);
    } else {
      c.fillStyle = '#2a1a24'; c.fillRect(X - 4, Y - 8, 8, 8); c.fillStyle = '#a8743f'; c.fillRect(X - 3, Y - 7, 6, 6); c.fillStyle = '#c99657'; c.fillRect(X - 3, Y - 7, 6, 2);
    }
  }
  /** Slashes, the ember wave, healing motes, wood chips, haste dust: pixel pictures that live a moment. */
  private drawEffects(): void {
    const c = this.ctx;
    for (const e of this.mobs.effects) {
      if (e.age < 0) continue;
      const t = e.age / e.life, X = Math.round(e.x), Y = Math.round(e.y);
      c.globalAlpha = Math.max(0, 1 - t);
      if (e.kind === 'slash') {
        // Three bright strokes sweeping down across the foe.
        c.fillStyle = '#ffffff';
        for (let i = 0; i < 6; i++) { const k = Math.min(i, Math.floor(t * 9)); c.fillRect(X + e.dir * (-6 + k * 2), Y - 6 + k * 2, 2, 2); }
        c.fillStyle = '#ffe9a8'; for (let i = 0; i < 5; i++) c.fillRect(X + e.dir * (-4 + i * 2), Y - 8 + i * 2, 1, 1);
      } else if (e.kind === 'wave') {
        const r = 8 + t * 42;
        c.strokeStyle = '#ff8a2e'; c.lineWidth = 3; c.beginPath(); c.ellipse(X, Y, r, r * .55, 0, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = '#ffd25a'; c.lineWidth = 1; c.beginPath(); c.ellipse(X, Y, r * .8, r * .44, 0, 0, Math.PI * 2); c.stroke();
      } else if (e.kind === 'heal') {
        c.fillStyle = '#7fe08a';
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + t * 2; c.fillRect(Math.round(X + Math.cos(a) * 9), Math.round(Y - 10 - t * 22 + Math.sin(a) * 3), 2, 2); }
        c.fillStyle = '#e6ffe9'; c.fillRect(X - 1, Math.round(Y - 22 - t * 14), 3, 1); c.fillRect(X, Math.round(Y - 23 - t * 14), 1, 3);
      } else if (e.kind === 'chips') {
        for (let i = 0; i < 5; i++) {
          c.fillStyle = i % 2 ? '#c99657' : '#4f9440';
          c.fillRect(Math.round(X + e.dir * (i * 3 + t * 14) - 4), Math.round(Y - t * 10 + t * t * 26 + i), 2, 2);
        }
      } else if (e.kind === 'drain') {
        // A red thread of life pulled from the foe to the Keeper, beads running along it.
        const tx = e.tx ?? X, ty = e.ty ?? Y;
        for (let i = 0; i <= 10; i++) {
          const k = i / 10, bx = Math.round(X + (tx - X) * k), by = Math.round(Y + (ty - Y) * k + Math.sin(k * 6 + t * 12) * 3);
          c.fillStyle = (i + Math.floor(t * 20)) % 3 === 0 ? '#7fe08a' : '#e2452a'; c.fillRect(bx, by, 2, 2);
        }
      } else if (e.kind === 'curse') {
        c.fillStyle = '#b06bff';
        c.fillRect(X - 4, Y - 4, 8, 1); c.fillRect(X - 4, Y + 3, 8, 1); c.fillRect(X - 4, Y - 4, 1, 8); c.fillRect(X + 3, Y - 4, 1, 8);
        c.fillStyle = '#ff6a2a'; c.fillRect(X - 1, Y - 1, 2, 2);
      } else if (e.kind === 'ward') {
        c.strokeStyle = '#c8a8ff'; c.lineWidth = 2; c.beginPath(); c.ellipse(X, Y, 10 + t * 8, 14 + t * 8, 0, 0, Math.PI * 2); c.stroke();
      } else if (e.kind === 'bolt-hit') {
        c.fillStyle = '#ffd25a';
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; c.fillRect(Math.round(X + Math.cos(a) * t * 10), Math.round(Y + Math.sin(a) * t * 10), 2, 2); }
      } else {
        c.fillStyle = '#e9dcc0'; c.fillRect(X - 2, Math.round(Y - 2 - t * 4), Math.round(4 - t * 2), 2);
      }
    }
    c.globalAlpha = 1;
    // Bolts in flight: an ember core in a violet glow, a short trail.
    for (const b of this.mobs.bolts) {
      const X = Math.round(b.x), Y = Math.round(b.y);
      c.globalAlpha = .45; c.fillStyle = '#b06bff'; c.fillRect(X - 3, Y - 3, 6, 6);
      c.globalAlpha = 1; c.fillStyle = '#ff8a2e'; c.fillRect(X - 2, Y - 2, 4, 4); c.fillStyle = '#fff2a8'; c.fillRect(X - 1, Y - 1, 2, 2);
    }
    // The Dark Ward round the Keeper while it holds; curse marks over cursed foes.
    if (this.mobs.ward > 0) {
      c.globalAlpha = .35 + Math.sin(this.time * 5) * .1; c.strokeStyle = '#b06bff'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(Math.round(this.player.x), Math.round(this.player.y - 16), 13, 19, 0, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
    }
    for (const m of this.mobs.mobs) if (m.cursed > 0) {
      c.fillStyle = Math.floor(this.time * 6) % 2 ? '#b06bff' : '#ff6a2a';
      c.fillRect(Math.round(m.x - 1 + Math.sin(this.time * 3) * 5), Math.round(m.y - m.def.h - 8 - (this.time * 8) % 6), 2, 2);
    }
    // The Aura of Embers: a slow ring of sparks on the ground round the Keeper.
    if (this.mobs.aura === 'aura-embers' || this.mobs.aura === 'aura-siphon') {
      const col = this.mobs.aura === 'aura-embers' ? '#ff8a2e' : '#5fd35a', r = SKILLS['aura-embers'].vars['radius'] * TILE;
      c.globalAlpha = .55; c.fillStyle = col;
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + this.time * .6; c.fillRect(Math.round(this.player.x + Math.cos(a) * r * .55), Math.round(this.player.y - 2 + Math.sin(a) * r * .3), 2, 1); }
      c.globalAlpha = 1;
    }
  }

  /** Names and health over creatures, labels over gear on the ground, the numbers that float up. */
  private drawFightUi(inView: (x: number, y: number, pad?: number) => boolean): void {
    const c = this.ctx;
    c.textAlign = 'center'; c.textBaseline = 'bottom';
    for (const m of this.mobs.mobs) {
      if (!inView(m.x, m.y) || Math.hypot(m.x - this.player.x, m.y - this.player.y) > 150) continue;
      const top = m.y - m.def.h - 3, w = 18, frac = Math.max(0, m.hp / m.def.hp);
      c.fillStyle = '#1a1014'; c.fillRect(Math.round(m.x - w / 2) - 1, Math.round(top) - 1, w + 2, 4);
      c.fillStyle = frac > .6 ? '#5fd35a' : frac > .3 ? '#e8c23a' : '#e2452a'; c.fillRect(Math.round(m.x - w / 2), Math.round(top), Math.round(w * frac), 2);
      c.font = '6px "Pixelify Sans", monospace'; c.fillStyle = '#1a1014'; c.fillText(m.def.name, Math.round(m.x) + 1, Math.round(top) - 1);
      c.fillStyle = m === this.mobs.target ? '#ff8a7a' : '#f3e7cf'; c.fillText(m.def.name, Math.round(m.x), Math.round(top) - 2);
    }
    for (const g of this.mobs.drops) if ((g.item || g.rune) && inView(g.x, g.y) && Math.hypot(g.x - this.player.x, g.y - this.player.y) < 110) this.plate(g.label, g.x, g.y - 28, g.color);
    c.font = 'bold 8px "Pixelify Sans", monospace';
    for (const f of this.mobs.floaters) {
      c.globalAlpha = Math.max(0, 1 - f.age);
      c.fillStyle = '#1a1014'; c.fillText(f.text, Math.round(f.x) + 1, Math.round(f.y) + 1);
      c.fillStyle = f.color; c.fillText(f.text, Math.round(f.x), Math.round(f.y));
    }
    c.globalAlpha = 1;
  }

  private drawPerson(p: Person, action: 'idle' | 'run' | 'walk'): void {
    const c = this.ctx, s = this.scale, cam = this.cam;
    // Soft shadow under the feet.
    c.fillStyle = 'rgba(30,18,26,.28)';
    c.fillRect(Math.round(p.x - 6), Math.round(p.y - 2), 12, 3);
    if (!p.painter) return;
    const acting = p === this.player && this.actT > 0;
    if (p === this.player && (p.dir !== 'side' || acting)) {
      // The Warlock: front/back views with the staff in hand; every cast faces the camera, staff raised.
      const sheet = frontSheet(p.painter, true), row = acting ? 0 : p.dir === 'down' ? 0 : 1;
      const f = acting ? CAST_FRAME : this.phone && row === 0 && !p.moving ? PHONE_FRAME : frontFrame(this.time + p.t, p.moving);
      c.drawImage(sheet, f * FRONT_W, row * FRONT_H, FRONT_W, FRONT_H, Math.round(p.x) - FRONT_AX, Math.round(p.y) - FRONT_AY, FRONT_W, FRONT_H);
      return;
    }
    if (p.dir !== 'side') {
      const sheet = frontSheet(p.painter), row = p.dir === 'down' ? 0 : 1;
      const f = p === this.player && this.phone && row === 0 && !p.moving ? PHONE_FRAME : frontFrame(this.time + p.t, p.moving);
      c.drawImage(sheet, f * FRONT_W, row * FRONT_H, FRONT_W, FRONT_H, Math.round(p.x) - FRONT_AX, Math.round(p.y) - FRONT_AY, FRONT_W, FRONT_H);
      return;
    }
    c.save();
    c.setTransform(s * p.face, 0, 0, s, (Math.round(p.x) - cam.x) * s, (Math.round(p.y) - cam.y) * s);
    p.painter.draw(c, 1, acting ? { action: 'attack', time: this.time, attackT: 1 - this.actT / .3, weapon: true } : { action, time: this.time + p.t, attackT: 0, weapon: p === this.player });
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
    const night = this.level.dark ? .9 : this.darkness;
    if (!this.level.dark && this.dusk > .05 && night < .5) {
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
    for (const o of this.visible) {
      const sp = o.sprite();
      for (const l of sp.lights ?? []) { hole(o.x + l.x, o.y + l.y, l.r * 2); if (l.warm) glows.push({ x: o.x + l.x, y: o.y + l.y, r: l.r }); }
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

/** The top-down gate: on by default; `?td=0` keeps the old view on this device, `?td=1` clears that. */
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
