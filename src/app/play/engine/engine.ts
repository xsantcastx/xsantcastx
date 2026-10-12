import { Atmosphere } from './atmosphere';
import { createKeeperMotion, KEEPER, KEEPER_HAND, KEEPER_RIG, KeeperMotion, poseKeeper, trackKeeper } from './rig-poses';
import { resetPose, RigSprite } from './rig';
import { CreatureRigDef, creatureRigFor, RIVET_MAW_CREATURE } from './creature-rigs';
import { beamColor, beamHeight, FLIGHT_TIME, flightPoint, RARITY_COLORS, satchelPoint } from './loot-fx';
import { aimFromBladeRotation, createHeldTransform, HeldItem, heldTransform, KEEPER_BACK_HAND, KeeperLoadout, OFFHAND_DEFAULTS, WEAPON_DEFAULTS } from './loadout';
import { advanceBody, Body, EngineInput, EngineOptions, EngineState, FLOOR, InteractionTarget, KeeperAnimation, meleeHits, walkDirection } from './engine.model';
import { AreaDef, areaOf, clientToWorld, DropEntry, LootRarity, MonsterDef, nearestStation, StationDef, stationAt, TownDef } from '../world/world.model';
import { INFERNAL_TOWN } from '../world/towns/infernal';
import type { HomesteadFrame, HomesteadView } from './homestead-render';
export type { EngineInput, EngineOptions, EngineState, InteractionTarget, KeeperAnimation } from './engine.model';
export type { HeldItem, KeeperLoadout } from './loadout';

// `flash`, `knock`, `dying`, `born` and `shownHp` are presentation only: they
// shape how a Maw is drawn and never feed back into position, HP or loot.
interface Monster {
  def: MonsterDef; maxHp: number;
  x: number; spawn: number; hp: number; phase: 'idle' | 'windup' | 'strike' | 'recover'; timer: number; facing: number; respawn: number;
  flash: number; knock: number; dying: number; born: number; shownHp: number;
  /** Hit recoil 1 → 0, drives each creature's hurt pose. Presentation only. */
  recoil: number;
}
/** `ore` is the material quantity (legacy name). `art`/`label`/`short` come from the drop entry. */
interface Drop {
  id: string; x: number; coins: number; ore: number; material?: string; art?: string; label?: string; short?: string; age: number; spin: number;
  /** Presentation, fixed at spill time so the render allocates nothing: beam colour/height, hover caption and its measured width. */
  rarity?: LootRarity; color: string; beam: number; caption: string; captionW: number;
}
/** A picked-up item flying to the satchel, in canvas CSS px. Pooled; render-only. */
interface Flight { active: boolean; t: number; sx: number; sy: number; ex: number; ey: number; art?: string; coins: boolean; color: string }
const FLIGHT_POOL = 16;
/** Seconds a felled Maw takes to dissolve, and a respawn takes to rise. */
const DEATH_FADE = .45;
const SPAWN_RISE = .4;
const KEEPER_ANIMATIONS = new Set<KeeperAnimation>(['idle', 'run', 'jump', 'fall', 'attack', 'dodge', 'hurt']);
export interface RemoteKeeper { id: string; name: string; x: number; y: number; area: string; facing?: number; animation?: string }
interface PeerView { peer: RemoteKeeper; x: number; y: number; facing: number; motion: KeeperMotion }
interface Speech { text: string; at: number }
/** Fixed-step farming runtime with reversible camp and hunting-ground portals. */
export class SeamworksEngine {
  private readonly context: CanvasRenderingContext2D;
  private readonly images: Record<string, HTMLImageElement> = {};
  /** Lazily loaded art for world-data keys (creatures, materials, station art, scenes). null = unresolvable. */
  private readonly lazyImages = new Map<string, HTMLImageElement | null>();
  private readonly input = new Set<EngineInput>();
  private readonly peers = new Map<string, PeerView>();
  private speech = new Map<string, Speech>();
  private selfId = '';
  private town: TownDef;
  /** The area the Keeper stands in: the town, or one of its hunts. */
  private areaDef!: AreaDef;
  /** `scene:<background>`, the lazy-image key of the area's painting. Set on entry, never per frame. */
  private sceneKey = '';
  private readonly player: Body = { x: 160, y: FLOOR, vy: 0, grounded: true };
  /** Click-to-move: a target x walked toward in the fixed step until arrival or a key press. */
  private walking = false;
  private walkX = 0;
  private onArrive: (() => void) | null = null;
  /** Station under the pointer, highlighted in the render. */
  private hovered: string | null = null;
  private frame: number | null = null;
  private observer: ResizeObserver;
  private previous = 0;
  private accumulator = 0;
  private elapsed = 0;
  private readonly atmosphere = new Atmosphere();
  /** Mesh rigs bending the single Keeper and Maw paintings. Render-only. */
  private readonly keeperRig = new RigSprite(KEEPER_RIG);
  /** One rig per creature art key, built on first sight and shared by every monster using that painting. */
  private readonly creatureRigs = new Map<string, { def: CreatureRigDef; sprite: RigSprite }>();
  private readonly creaturePose = { phase: 'idle' as Monster['phase'], timer: 0, time: 0, seed: 0, reduced: false, hurt: 0 };
  /** Worn gear drawn on the Keeper (see setLoadout). Images by URL, cached. */
  private loadout: KeeperLoadout = {};
  private readonly urlImages = new Map<string, HTMLImageElement>();
  private readonly held = createHeldTransform();
  private readonly backHand = { x: 0, y: 0, angle: 0 };
  /** Pickup flights to the satchel. Preallocated; never grows. */
  private readonly flights: Flight[] = Array.from({ length: FLIGHT_POOL }, () => ({ active: false, t: 0, sx: 0, sy: 0, ex: 0, ey: 0, coins: false, color: '' }));
  private readonly flightAt = { x: 0, y: 0, scale: 1 };
  private readonly satchelAt = { x: 0, y: 0 };
  private satchelTarget: (() => { x: number; y: number } | null | undefined) | null = null;
  /** Arrival pulse on the satchel point, 1 → 0. */
  private satchelPulse = 0;
  private satchelPulseColor = '';
  /** Last pointer position in world px (from pick), for drop captions. NaN = none. */
  private pointerX = NaN;
  private pointerY = NaN;
  /** Gradients built once per colour in local units and reused every frame. */
  private readonly beamGradients = new Map<string, CanvasGradient>();
  private readonly auraGradients = new Map<string, CanvasGradient>();
  private readonly playerMotion = createKeeperMotion();
  private readonly hand = { x: 0, y: 0, angle: 0 };
  /** Real seconds since the last drawn frame (0 during hitstop), for springs only. */
  private frameDt = 0;
  /** Real seconds since the last drawn frame, hitstop included: flights keep flying through a freeze. */
  private flightDelta = 0;
  private pixelRatio = 1;
  private pixelScale = 1;
  private readonly reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private landing = 0;
  private stepAt = 0;
  private reportAt = 0;
  private width = 1100;
  private height = 650;
  private camera = 0;
  private facing = 1;
  private hp = 100;
  /** Health ceiling, from the worn loadout via `setStats`. 100 until told otherwise. */
  private maxHp = 100;
  /** Melee damage from the worn loadout via `setStats`; null keeps the legacy 10/20. */
  private damage: number | null = null;
  private monsters: Monster[] = [];
  private drops: Drop[] = [];
  private readonly lootSession = crypto.randomUUID();
  private coins = 0;
  private kills = 0;
  private guardianDefeated = false;
  private attackTime = 0;
  private attackCooldown = 0;
  private dodgeTime = 0;
  private dodgeCooldown = 0;
  private hurtTime = 0;
  /** Game feel, render-only: frozen frames on impact, camera shake, red edge on a wound. */
  private hitstop = 0;
  private shake = 0;
  private wound = 0;
  private equipped = false;
  private restored = false;
  private paused = false;
  private complete = false;
  private destroyed = false;
  private message = 'Find the Cinder Ore deposit. Walk close and interact.';
  // ── Homestead hook (homestead-render.ts owns the drawing; this is the whole seam) ──
  private homestead: HomesteadView | null = null;
  private readonly homesteadFrame: HomesteadFrame = { areaId: '', camera: 0, viewport: 0, time: 0, playerX: 0, reduced: false, art: (key, x, y, w, h) => this.art(key, x, y, w, h) };
  /** Plug in (or remove) the Homestead's view: drawn each frame, may paint stations and take interactions. */
  setHomesteadView(view: HomesteadView | null): void { this.homestead = view; }
  private get stations(): readonly StationDef[] { return this.areaDef.stations; }
  private get isTown(): boolean { return this.areaDef === this.town; }
  private createMonsters(): Monster[] {
    const monsters: Monster[] = [];
    for (const def of this.areaDef.monsters) {
      for (const x of def.spawnXs) {
        monsters.push({ def, maxHp: def.hp, x, spawn: x, hp: def.hp, phase: 'idle', timer: 1, facing: -1, respawn: 0, flash: 0, knock: 0, dying: 0, born: 0, shownHp: def.hp, recoil: 0 });
      }
    }
    return monsters;
  }
  private enter(area: AreaDef): void {
    this.areaDef = area; this.sceneKey = `scene:${area.background}`; this.monsters = this.createMonsters(); this.drops = [];
  }
  private resetPosition(x: number): void {
    this.cancelMove();
    this.player.x = x; this.player.y = FLOOR; this.player.vy = 0; this.player.grounded = true;
    this.hp = this.maxHp; this.hurtTime = 1.5; this.attackTime = 0; this.attackCooldown = 0;
    this.dodgeTime = 0; this.dodgeCooldown = 0; this.complete = false; this.setPaused(false);
  }
  returnToCamp(): void {
    this.enter(this.town);
    this.resetPosition(this.town.spawnX); this.message = 'Back at camp. Your equipment and collected loot are safe.'; this.report();
  }
  restartHunt(): void {
    this.monsters = this.createMonsters(); this.drops = []; this.resetPosition(this.areaDef.spawnX);
    this.message = 'A fresh hunt begins. Monsters respawn after defeat; collect their drops.'; this.report();
  }
  constructor(private readonly canvas: HTMLCanvasElement, private readonly options: EngineOptions) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser does not support Canvas 2D.');
    this.context = context;
    this.town = options.town ?? INFERNAL_TOWN;
    this.satchelTarget = options.satchelTarget ?? null;
    this.enter(this.town);
    for (const [key, url] of Object.entries(options.assets)) {
      const image = new Image(); image.src = url; this.images[key] = image;
    }
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.clearInput);
    document.addEventListener('visibilitychange', this.visibilityChanged);
    this.resize();
  }
  start(): void {
    if (this.frame === null && !this.destroyed) {
      // The component can start during Angular's view pass, before the first
      // ResizeObserver delivery. Read the laid-out canvas here so the first
      // frame is drawn at the viewport size instead of the 300×150 fallback.
      this.resize();
      this.previous = 0;
      this.frame = requestAnimationFrame(this.tick);
      this.report();
      this.render();
    }
  }
  destroy(): void {
    this.destroyed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null; this.observer.disconnect(); this.input.clear();
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.clearInput);
    document.removeEventListener('visibilitychange', this.visibilityChanged);
  }
  setProgress(progress: { equipped: boolean; restored: boolean }): void {
    this.equipped = progress.equipped; this.restored = progress.restored;
    if (this.restored) this.guardianDefeated = true;
    this.report();
  }
  /**
   * Combat numbers derived from the worn loadout (see rpg/keeper-combat.ts).
   * A max-HP change keeps the Keeper's *share* of health, so equipping mid-fight
   * neither heals nor wounds; a fallen Keeper stays fallen.
   */
  setStats(stats: { damage: number; maxHp: number }): void {
    if (Number.isFinite(stats.damage)) this.damage = Math.max(1, Math.round(stats.damage));
    const maxHp = Math.round(stats.maxHp);
    if (Number.isFinite(maxHp) && maxHp >= 1 && maxHp !== this.maxHp) {
      const share = this.hp / this.maxHp;
      this.maxHp = maxHp;
      if (this.hp > 0) this.hp = Math.max(1, Math.min(maxHp, Math.round(maxHp * share)));
    }
    this.report();
  }
  /**
   * The Keeper's worn gear, drawn in the world. Call whenever equipment changes;
   * repeated calls with the same URLs are cheap (images are cached by URL).
   *
   *   setLoadout({
   *     weapon?:  { art, rarity?, grip?, tilt?, size? } | null,  // front hand, follows the swing
   *     offhand?: { art, rarity?, grip?, tilt?, size? } | null,  // back arm, behind the body
   *     auraRarity?: LootRarity | null,                         // subtle glow in that tier's colour
   *   })
   *
   * `art` is an image URL (e.g. `artFor(key).src`) or an `artFor()` key.
   * `grip` is where the hand closes on the painting (normalised; weapon default
   * {u:.24, v:.78}, off-hand {u:.5, v:.55}); `tilt` is the painted angle of the
   * item's grip → tip axis (weapon default -PI/4 = diagonal up-right, off-hand
   * -PI/2 = upright); `size` is world px (72 / 52). Pass null or {} to clear.
   * With no weapon, the quest Basalt Edge still shows once `setProgress` says
   * it is equipped. Visual only: damage and HP come from `setStats`.
   */
  setLoadout(loadout: KeeperLoadout | null): void {
    this.loadout = loadout ? { weapon: loadout.weapon ?? null, offhand: loadout.offhand ?? null, auraRarity: loadout.auraRarity ?? null } : {};
    this.heldImage(this.loadout.weapon); this.heldImage(this.loadout.offhand);
  }
  /**
   * Where picked-up loot flies: a function returning the satchel HUD's centre in
   * CLIENT (viewport) px, e.g. `() => { const r = satchel.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }`.
   * Called once per pickup, never per frame. null (or returning null) → the
   * canvas's top-right corner. Same as the `satchelTarget` engine option.
   */
  setSatchelTarget(target: (() => { x: number; y: number } | null | undefined) | null): void { this.satchelTarget = target; }
  /** Forget the pointer (pointer left the canvas): hover captions on drops hide. */
  clearPointer(): void { this.pointerX = NaN; this.pointerY = NaN; }
  setPeers(peers: RemoteKeeper[]): void {
    const present = new Set<string>();
    for (const peer of peers) {
      if (!Number.isFinite(peer.x) || !Number.isFinite(peer.y)) continue;
      present.add(peer.id);
      const previous = this.peers.get(peer.id);
      const facing = peer.facing === -1 ? -1 : 1;
      const snapshot = {
        ...peer, facing, animation: KEEPER_ANIMATIONS.has(peer.animation as KeeperAnimation) ? peer.animation : 'idle',
        name: peer.name.slice(0, 24), x: Math.max(30, Math.min(this.areaDef.width - 30, peer.x)), y: Math.max(-300, Math.min(FLOOR, peer.y)),
      };
      if (previous && previous.peer.area === peer.area) previous.peer = snapshot;
      else this.peers.set(peer.id, { peer: snapshot, x: snapshot.x, y: snapshot.y, facing, motion: createKeeperMotion() });
    }
    for (const id of this.peers.keys()) if (!present.has(id)) this.peers.delete(id);
  }
  setChat(messages: { playerId: string; text: string; at: number }[], selfId = ''): void {
    this.selfId = selfId;
    const next = new Map<string, Speech>();
    for (const message of messages) {
      if (!message?.playerId || typeof message.text !== 'string' || !Number.isFinite(message.at)) continue;
      const text = message.text.replace(/\s+/g, ' ').trim().slice(0, 80);
      if (!text) continue;
      const current = next.get(message.playerId);
      if (!current || message.at >= current.at) next.set(message.playerId, { text, at: message.at });
    }
    this.speech = next;
  }
  setPaused(paused: boolean): void { this.paused = paused; this.input.clear(); this.accumulator = 0; if (paused) this.cancelMove(); this.report(); }
  /**
   * Walk the Keeper to world x, then call `onArrive` from the fixed-step update.
   * Any left/right press, a pause, a reset or travel cancels it (no callback).
   * Returns false when the Keeper cannot move right now.
   */
  moveTo(x: number, onArrive?: () => void): boolean {
    if (this.paused || this.hp <= 0 || !Number.isFinite(x)) return false;
    this.walking = true;
    this.walkX = Math.max(30, Math.min(this.areaDef.width - 30, x));
    this.onArrive = onArrive ?? null;
    return true;
  }
  cancelMove(): void { this.walking = false; this.onArrive = null; }
  /** True while a click-to-move walk is in progress. */
  get moving(): boolean { return this.walking; }
  /** The current area's stations, for the Places list. */
  get places(): readonly StationDef[] { return this.areaDef.stations; }
  get townId(): string { return this.town.id; }
  /** True while the Keeper stands in the town rather than one of its hunts. */
  get inTown(): boolean { return this.isTown; }
  /**
   * Walk to a station and interact on arrival; `instant` places the Keeper
   * there first (reduced motion, deep links). Unknown ids return false.
   */
  goToStation(id: string, instant = false): boolean {
    const station = this.stations.find(row => row.id === id);
    if (!station || this.paused || this.hp <= 0) return false;
    if (instant) { this.placeAt(station.x); this.interact(); return true; }
    return this.moveTo(station.x, () => this.interact());
  }
  /** Waystone travel: stand in another town's spawn. Monsters, drops and any walk reset. */
  setTown(town: TownDef): void {
    this.town = town; this.enter(town); this.resetPosition(town.spawnX);
    this.message = town.arrival ?? town.name; this.report();
  }
  /** Stand the Keeper on the floor at x in the current area. No interaction. */
  placeAt(x: number): void {
    this.cancelMove();
    this.player.x = Math.max(30, Math.min(this.areaDef.width - 30, x));
    this.player.y = FLOOR; this.player.vy = 0; this.player.grounded = true;
    this.report();
  }
  /** Client (pointer) coordinates to a world point and the station under it. */
  pick(clientX: number, clientY: number): { x: number; y: number; station: StationDef | null } {
    const rect = this.canvas.getBoundingClientRect();
    const point = clientToWorld(clientX, clientY, {
      left: rect.left, top: rect.top, rectWidth: rect.width, rectHeight: rect.height,
      cssWidth: this.width, cssHeight: this.height, camera: this.camera,
    });
    this.pointerX = point.x; this.pointerY = point.y;
    return { x: point.x, y: point.y, station: stationAt(this.stations, point.x, point.y, FLOOR) };
  }
  /** Highlight a station (pointer hover). Render-only. */
  setHover(id: string | null): void { this.hovered = id; }
  retry(): void { this.restartHunt(); }
  setInput(action: EngineInput, pressed: boolean): void {
    if (!pressed) { this.input.delete(action); return; }
    if (this.paused || this.hp <= 0 || this.input.has(action)) return;
    this.input.add(action);
    if (action === 'left' || action === 'right') this.cancelMove();
    if (action === 'jump' && this.player.grounded) { this.player.vy = -680; this.player.grounded = false; }
    if (action === 'attack' && this.attackCooldown <= 0) {
      {
        this.attackTime = .4; this.attackCooldown = .52;
        for (const monster of this.monsters) {
          if (monster.hp <= 0 || !meleeHits(this.player, monster.x, this.facing)) continue;
          const damage = this.damage ?? (this.equipped ? 20 : 10);
          this.atmosphere.burst(monster.x, FLOOR - 85, String(damage));
          monster.hp = Math.max(0, monster.hp - damage);
          monster.flash = .14; monster.recoil = 1;
          this.impact(monster.hp === 0 ? .09 : .055, monster.hp === 0 ? 7 : 3);
          if (!this.reducedMotion) monster.knock = Math.sign(monster.x - this.player.x || this.facing) * 22;
          if (monster.hp === 0) {
            monster.dying = DEATH_FADE;
            monster.respawn = 8; this.kills++; this.guardianDefeated = true;
            this.spill(monster);
          }
        }
      }
    }
    if (action === 'dodge' && this.dodgeCooldown <= 0) { this.dodgeTime = .26; this.dodgeCooldown = 1.05; }
    this.report();
  }
  /** Roll the monster's drop table (or its area's) and spill the results around the body. */
  private spill(monster: Monster): void {
    const entries = (monster.def.drops ?? this.areaDef.drops).entries;
    const names: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry: DropEntry = entries[i];
      if (entry.chance !== undefined && entry.chance < 1 && this.random() >= entry.chance) continue;
      const offset = (i - (entries.length - 1) / 2) * 50;
      const id = `${this.lootSession}:${this.kills}:${entry.id}`;
      const spin = offset < 0 ? -1 : 1;
      const rarity = entry.rarity;
      if (entry.kind === 'coins') {
        const coins = entry.base + (entry.spread ? this.kills % entry.spread : 0);
        this.drops.push({ id, x: monster.x + offset, coins, ore: 0, age: 0, spin,
          rarity, color: beamColor(rarity, true), beam: beamHeight(rarity, true), caption: `${coins} coins`, captionW: 0 });
        names.push('coins');
      } else {
        this.drops.push({ id, x: monster.x + offset, coins: 0, ore: entry.qty, material: entry.material, art: entry.art, label: entry.label, short: entry.short, age: 0, spin,
          rarity, color: beamColor(rarity, false), beam: beamHeight(rarity, false), caption: entry.qty > 1 ? `${entry.qty} x ${entry.label}` : entry.label, captionW: 0 });
        names.push(entry.label);
      }
    }
    this.message = names.length
      ? `${monster.def.name} defeated! Walk over the ${names.join(' and ')} to collect them.`
      : `${monster.def.name} defeated!`;
  }
  /** RNG for drop chances. Replaceable in tests; a table of certain drops never calls it. */
  random: () => number = Math.random;
  interact(): void {
    if (this.paused || this.hp <= 0) return;
    const station = this.nearbyStation();
    if (!station) { this.message = 'Move closer to a marked location to interact.'; this.report(); return; }
    const locked = station.requires === 'guardian' ? !this.guardianDefeated : station.requires === 'beacon' ? !this.restored : false;
    if (locked) this.message = station.lockedMessage ?? 'This way is not open yet.';
    else if (this.homestead?.interact(this.areaDef.id, station.id)) { /* handled by the Homestead view */ }
    else if (station.kind === 'passage') {
      const area = station.to ? areaOf(this.town, station.to) : undefined;
      if (area) {
        this.enter(area);
        this.resetPosition(station.arriveX ?? area.spawnX);
        this.message = area.arrival ?? area.name;
      }
    } else if (station.kind === 'panel' || station.kind === 'waystone') this.options.onStation?.(station);
    else this.options.onInteract(station.id as InteractionTarget);
    this.report();
  }
  /** Freeze a few frames and kick the camera. Reduced motion keeps neither. */
  private impact(stop: number, kick: number): void {
    if (this.reducedMotion) return;
    this.hitstop = Math.max(this.hitstop, stop);
    this.shake = Math.max(this.shake, kick);
  }
  private nearbyStation(): StationDef | null {
    return this.player.y > 475 ? nearestStation(this.stations, this.player.x) : null;
  }
  private nearby(): string | null { return this.nearbyStation()?.id ?? null; }
  private action(key: string): EngineInput | undefined {
    return ({ ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyJ: 'attack', KeyK: 'dodge' } as Record<string, EngineInput>)[key];
  }
  // Key/pointer releases can be lost when focus leaves the game. Release held
  // controls without pausing the shared world or discarding an active action.
  private readonly clearInput = (): void => { this.input.clear(); };
  private readonly visibilityChanged = (): void => {
    if (document.hidden) this.clearInput();
  };
  private readonly keyDown = (event: KeyboardEvent): void => {
    // A paused world (an in-world panel is open) leaves every key to the page;
    // so does anything typed inside an element marked data-engine-ignore.
    if (this.paused) return;
    if (event.target instanceof HTMLElement && (event.target.matches('input,textarea,select') || event.target.isContentEditable || event.target.closest('[data-engine-ignore]'))) return;
    const action = this.action(event.code);
    if (action) { event.preventDefault(); if (!event.repeat) this.setInput(action, true); }
    if (!event.repeat && event.code === 'KeyE') { event.preventDefault(); this.interact(); }
  };
  private readonly keyUp = (event: KeyboardEvent): void => { const action = this.action(event.code); if (action) this.setInput(action, false); };
  private resize(): void {
    const bounds = this.canvas.getBoundingClientRect();
    const parent = this.canvas.parentElement?.getBoundingClientRect();
    const cssWidth = this.canvas.parentElement?.clientWidth || parent?.width || bounds.width;
    const cssHeight = this.canvas.parentElement?.clientHeight || parent?.height || bounds.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.pixelRatio = ratio;
    this.width = Math.max(320, cssWidth || this.canvas.clientWidth || 320); this.height = Math.max(300, cssHeight || this.canvas.clientHeight || 300);
    this.canvas.width = Math.round(this.width * ratio); this.canvas.height = Math.round(this.height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  private readonly tick = (now: number): void => {
    if (this.destroyed) return;
    const delta = this.previous ? Math.min((now - this.previous) / 1000, .1) : 0;
    this.previous = now;
    // Presence continues to arrive while the local game is paused or unfocused.
    for (const view of this.peers.values()) {
      const dx = view.peer.x - view.x;
      if (Math.abs(dx) > 2) view.facing = Math.sign(dx);
      else if (view.peer.facing === -1 || view.peer.facing === 1) view.facing = view.peer.facing;
      const blend = 1 - Math.exp(-12 * delta);
      view.x += dx * blend; view.y += (view.peer.y - view.y) * blend;
    }
    this.shake = Math.max(0, this.shake - delta * 30);
    this.wound = Math.max(0, this.wound - delta * 1.8);
    this.frameDt = this.hitstop > 0 ? 0 : delta;
    this.flightDelta = delta;
    // Hitstop holds the simulation for a beat; the frame still draws so the
    // impact flash is what the eye lands on.
    if (this.hitstop > 0) this.hitstop = Math.max(0, this.hitstop - delta);
    else if (!this.paused && this.hp > 0) {
      this.accumulator += delta;
      while (this.accumulator >= 1 / 60) { this.update(1 / 60); this.accumulator -= 1 / 60; }
    }
    this.render();
    if (now - this.reportAt >= 100) { this.reportAt = now; this.report(); }
    this.frame = requestAnimationFrame(this.tick);
  };
  private update(dt: number): void {
    this.elapsed += dt;
    this.atmosphere.update(dt);
    this.landing = Math.max(0, this.landing - dt);
    this.attackTime = Math.max(0, this.attackTime - dt); this.attackCooldown -= dt;
    this.dodgeTime = Math.max(0, this.dodgeTime - dt); this.dodgeCooldown -= dt; this.hurtTime -= dt;
    let direction = Number(this.input.has('right')) - Number(this.input.has('left'));
    if (direction) this.cancelMove();
    else if (this.walking) {
      direction = walkDirection(this.player.x, this.walkX);
      if (direction === 0) {
        const arrive = this.onArrive;
        this.cancelMove();
        arrive?.();
      }
    }
    if (direction) this.facing = direction;
    const wasGrounded = this.player.grounded;
    advanceBody(this.player, this.dodgeTime > 0 ? this.facing * 620 : direction * 265, dt, this.areaDef.platforms, this.areaDef.width);
    if (!wasGrounded && this.player.grounded) { this.landing = .18; this.atmosphere.burst(this.player.x, this.player.y - 4); }
    if (direction && this.player.grounded && this.elapsed - this.stepAt > .2) {
      this.stepAt = this.elapsed; if (!this.reducedMotion) this.atmosphere.burst(this.player.x - direction * 16, this.player.y - 3);
    }
    for (const drop of this.drops) {
      drop.age += dt;
      if (drop.age > .3 && Math.abs(drop.x - this.player.x) < 65 && Math.abs(this.player.y - FLOOR) < 80) {
        if (this.options.onLoot?.({ id: drop.id, coins: drop.coins, ore: drop.ore, material: drop.material }) === false) continue;
        this.atmosphere.burst(drop.x, FLOOR - 45, drop.coins ? `+${drop.coins} coins` : `+${drop.ore} ${drop.short ?? 'ore'}`);
        this.coins += drop.coins; drop.age = -1;
        this.launchFlight(drop);
        this.message = drop.coins ? `Collected ${drop.coins} coins.` : `Collected ${drop.label ?? 'Cinder Ore'}.`;
      }
    }
    this.drops = this.drops.filter(drop => drop.age >= 0 && drop.age < 120);
    for (const monster of this.monsters) {
      monster.flash = Math.max(0, monster.flash - dt);
      monster.recoil = Math.max(0, monster.recoil - dt * 3);
      monster.knock *= Math.exp(-14 * dt);
      monster.dying = Math.max(0, monster.dying - dt);
      monster.born = Math.max(0, monster.born - dt);
      monster.shownHp += (monster.hp - monster.shownHp) * (1 - Math.exp(-6 * dt));
      if (monster.hp <= 0) {
        monster.respawn -= dt;
        if (monster.respawn <= 0) { monster.hp = monster.maxHp; monster.shownHp = monster.maxHp; monster.x = monster.spawn; monster.phase = 'idle'; monster.timer = 1; monster.born = SPAWN_RISE; }
        continue;
      }
      monster.timer -= dt;
      const safeX = this.areaDef.safeX ?? 0;
      if (safeX && this.player.x < safeX) {
        monster.x += Math.sign(monster.spawn - monster.x) * Math.min(Math.abs(monster.spawn - monster.x), 65 * dt);
        monster.phase = 'idle'; monster.timer = .5;
        continue;
      }
      const distance = this.player.x - monster.x;
      if (monster.phase === 'idle') {
        if (Math.abs(distance) < 380 && Math.abs(distance) > 95) monster.x = Math.max(safeX || 30, monster.x + Math.sign(distance) * 65 * dt);
        if (Math.abs(distance) < 170 && monster.timer <= 0) {
          monster.phase = 'windup'; monster.timer = .85; monster.facing = Math.sign(distance) || -1;
        }
      } else if (monster.timer <= 0) {
        if (monster.phase === 'windup') {
          monster.phase = 'strike'; monster.timer = .2;
          if (Math.abs(distance) < 170 && distance * monster.facing > -40 && this.player.y > FLOOR - 105 && this.dodgeTime <= 0 && this.hurtTime <= 0) {
            this.hp = Math.max(0, this.hp - 12); this.hurtTime = .8; this.wound = 1;
            this.impact(.07, this.hp === 0 ? 12 : 8);
            if (this.hp === 0) this.message = 'The Keeper falls. Restart the hunt or return to camp.';
          }
        } else if (monster.phase === 'strike') { monster.phase = 'recover'; monster.timer = 1.1; }
        else { monster.phase = 'idle'; monster.timer = .35; }
      }
    }
  }

  private report(): void {
    const living = this.monsters.filter(monster => monster.hp > 0);
    const nearest = living.sort((a, b) => Math.abs(a.x - this.player.x) - Math.abs(b.x - this.player.x))[0];
    const station = this.nearbyStation();
    this.options.onState({ hp: this.hp, enemyHp: nearest ? Math.round(nearest.hp / nearest.maxHp * 100) : 0, nearby: station?.id ?? null, nearbyLabel: station?.label, nearbyKind: station?.kind,
      x: Math.round(this.player.x), y: Math.round(this.player.y), paused: this.paused,
      defeated: this.hp <= 0, enemyDefeated: this.guardianDefeated, complete: false, message: this.message,
      coins: this.coins, kills: this.kills, area: this.areaDef.name, areaId: this.areaDef.id,
      facing: this.facing, animation: this.pose() });
  }
  private pose(): KeeperAnimation {
    if (this.hp <= 0 || this.hurtTime > 0) return 'hurt';
    if (this.dodgeTime > 0) return 'dodge';
    if (this.attackTime > 0) return 'attack';
    if (!this.player.grounded) return this.player.vy < 0 ? 'jump' : 'fall';
    if (this.input.has('left') || this.input.has('right') || this.walking) return 'run';
    return 'idle';
  }
  /** Idle Keepers standing at the fire settle. The room still reports them as idle. */
  private present(animation: string | undefined, x: number, y: number): string | undefined {
    return animation === 'idle' && this.isTown && x > 70 && x < 430 && y > 560 ? 'rest' : animation;
  }
  private keeperMotion(animation: string | undefined, time: number): { bob: number; tilt: number; sx: number; sy: number; alpha: number; sway: number } {
    if (this.reducedMotion) return { bob: 0, tilt: 0, sx: 1, sy: 1, alpha: animation === 'dodge' ? .5 : 1, sway: 0 };
    switch (animation) {
      case 'run': {
        const phase = time * 9;
        const lift = Math.sin(phase);
        return {
          bob: lift > 0 ? -lift * 10 : lift * 1.6,
          tilt: Math.cos(phase) * .06,
          sx: 1 + Math.max(0, -lift) * .07,
          sy: 1 - Math.max(0, -lift) * .09,
          alpha: 1,
          sway: Math.cos(phase) * 5,
        };
      }
      case 'jump': return { bob: -4, tilt: -.1, sx: .94, sy: 1.08, alpha: 1, sway: 0 };
      case 'fall': return { bob: 2, tilt: .08, sx: 1.06, sy: .92, alpha: 1, sway: 0 };
      case 'attack': return { bob: 0, tilt: 0, sx: 1, sy: 1, alpha: 1, sway: 0 };
      case 'dodge': return { bob: 2, tilt: .28, sx: 1.08, sy: .9, alpha: .5, sway: 6 };
      case 'hurt': return { bob: 1, tilt: -.1, sx: 1.08, sy: .92, alpha: .55, sway: -3 };
      case 'rest': {
        const rock = Math.sin(time * 1.1);
        return { bob: rock * .6, tilt: rock * .015, sx: 1.02, sy: .985, alpha: 1, sway: rock * 1.1 };
      }
      default: {
        const breath = Math.sin(time * 2.2);
        return { bob: 0, tilt: Math.sin(time * 1.3) * .012, sx: 1 + breath * .012, sy: 1 - breath * .018, alpha: 1, sway: 0 };
      }
    }
  }
  /** One illustration. Pose it as a whole figure — a waist cut tears the armor. */
  private posedKeeper(
    c: CanvasRenderingContext2D,
    boxX: number, boxY: number, boxW: number, boxH: number,
    animation: string | undefined, _time: number,
    motion: { bob: number; tilt: number; sx: number; sy: number; sway: number },
    attackT: number, swing: number, armed: boolean,
  ): void {
    c.save();
    c.translate(motion.sway + (attackT > 0 ? swing * 8 : 0), 0);
    if (animation === 'dodge') c.transform(1, 0, .28, 1, 0, 0);
    c.rotate(motion.tilt + (attackT > 0 ? swing * .08 : 0));
    c.scale(motion.sx, motion.sy);
    if (!this.art('keeper', boxX, boxY + motion.bob, boxW, boxH)) { c.fillStyle = '#c9addf'; c.fillRect(-22, -110, 44, 110); }
    if (armed) this.drawBlade(c, swing, attackT);
    c.restore();
  }
  /**
   * A Keeper through the mesh rig: bones posed per animation, cape/hem/head on
   * springs, a motion smear on fast moves and a rim flash on strike or hurt.
   * Falls back to the whole-painting pose when the painting has not loaded.
   */
  private drawKeeper(
    c: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number },
    shown: string | undefined, time: number, motion: KeeperMotion, worldX: number, worldY: number, facing: number,
    attackT: number, swing: number, armed: boolean, feel: { landing: number; recoil: number; rim: number },
    fallback: { bob: number; tilt: number; sx: number; sy: number; sway: number },
    gear = false,
  ): void {
    trackKeeper(motion, worldX, worldY, this.frameDt);
    const rig = this.keeperRig;
    poseKeeper(rig.pose, motion, {
      animation: shown, time, attackT, swing, landing: feel.landing, recoil: feel.recoil,
      facing, dt: this.frameDt, reduced: this.reducedMotion,
    });
    if (!rig.render(this.images['keeper'], box.x, box.y, box.w, box.h, this.pixelScale)) {
      this.posedKeeper(c, box.x, box.y, box.w, box.h, shown, time, fallback, attackT, swing, armed);
      return;
    }
    // Worn gear (player only): aura and off-hand sit behind the body.
    const aura = gear ? this.loadout.auraRarity : null;
    if (aura) this.drawAura(c, aura, time);
    const offhand = gear ? this.loadout.offhand : null;
    const offhandImage = this.heldImage(offhand);
    if (offhand && offhandImage && rig.attach(KEEPER.ARM_B, KEEPER_BACK_HAND.u, KEEPER_BACK_HAND.v, this.backHand)) {
      heldTransform(this.backHand.x, this.backHand.y, -Math.PI / 2 + this.backHand.angle * .6, offhand, OFFHAND_DEFAULTS, this.held);
      this.drawHeld(c, offhandImage);
    }
    const speed = motion.vx * facing;
    if (!this.reducedMotion && Math.abs(speed) > 420) {
      // Smear: two fading after-images trail the direction of travel.
      const reach = Math.min(1, (Math.abs(speed) - 420) / 300);
      c.save(); c.shadowBlur = 0;
      const alpha = c.globalAlpha;
      c.globalAlpha = alpha * .1 * reach; rig.blit(c, -speed * .04, 0);
      c.globalAlpha = alpha * .22 * reach; rig.blit(c, -speed * .02, 0);
      c.restore();
    }
    rig.blit(c);
    if (feel.rim > .01) {
      // Rim light: an additive copy nudged toward the light brightens the leading edge.
      c.save(); c.shadowBlur = 0; c.filter = 'none';
      c.globalCompositeOperation = 'lighter'; c.globalAlpha *= Math.min(1, feel.rim) * .45;
      rig.blit(c, 1.6, -1.2);
      c.restore();
    }
    // Main hand: the worn weapon's own art, else the quest Basalt Edge once equipped.
    const weapon = gear ? this.loadout.weapon : null;
    const weaponImage = this.heldImage(weapon);
    if ((weaponImage || armed) && rig.attach(KEEPER.ARM_F, KEEPER_HAND.u, KEEPER_HAND.v, this.hand)) {
      const rotation = -.95 + swing * 1.85 + (attackT > 0 ? 0 : this.hand.angle * .6);
      if (weapon && weaponImage) {
        heldTransform(this.hand.x, this.hand.y, aimFromBladeRotation(rotation), weapon, WEAPON_DEFAULTS, this.held);
        this.drawHeld(c, weaponImage, attackT > .3 ? 1.06 : 1);
      } else {
        c.save();
        c.translate(this.hand.x, this.hand.y);
        c.rotate(rotation);
        if (attackT > .3) c.scale(1.06, 1.06);
        this.art('blade', -8, -78, 58, 92);
        c.restore();
      }
    }
  }
  /** An image by URL (or an `artFor()` key when it is not URL-shaped), loaded once and cached. */
  private urlImage(art: string | undefined): HTMLImageElement | undefined {
    if (!art) return undefined;
    if (!/[/.:]/.test(art)) return this.image(art);
    let image = this.urlImages.get(art);
    if (!image) { image = new Image(); image.src = art; this.urlImages.set(art, image); }
    return image;
  }
  private heldImage(item: HeldItem | null | undefined): HTMLImageElement | undefined {
    const image = item ? this.urlImage(item.art) : undefined;
    return image?.complete && image.naturalWidth ? image : undefined;
  }
  /** Draw a held item at the current `held` transform. */
  private drawHeld(c: CanvasRenderingContext2D, image: HTMLImageElement, grow = 1): void {
    const t = this.held;
    c.save();
    c.translate(t.x, t.y); c.rotate(t.rotation);
    if (grow !== 1) c.scale(grow, grow);
    c.drawImage(image, t.drawX, t.drawY, t.size, t.size);
    c.restore();
  }
  /** A soft aura behind the Keeper in the highest worn rarity's colour. One cached gradient per colour. */
  private drawAura(c: CanvasRenderingContext2D, rarity: LootRarity, time: number): void {
    const color = RARITY_COLORS[rarity];
    if (!color) return;
    let gradient = this.auraGradients.get(color);
    if (!gradient) {
      gradient = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0, `${color}55`); gradient.addColorStop(.55, `${color}22`); gradient.addColorStop(1, `${color}00`);
      this.auraGradients.set(color, gradient);
    }
    const breath = this.reducedMotion ? 0 : Math.sin(time * 1.6) * .08;
    c.save();
    c.shadowBlur = 0; c.filter = 'none'; c.globalCompositeOperation = 'lighter';
    c.translate(0, -96); c.scale(70 * (1 + breath), 108 * (1 + breath));
    c.fillStyle = gradient; c.beginPath(); c.arc(0, 0, 1, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  /** Start a pickup's flight to the satchel. Visual only; the loot is already granted. */
  private launchFlight(drop: Drop): void {
    if (this.reducedMotion) return;
    const flight = this.flights.find(row => !row.active);
    if (!flight) return;
    const scale = this.height / 720;
    let target: { x: number; y: number } | null | undefined = null;
    try { target = this.satchelTarget?.(); } catch { target = null; }
    const rect = this.canvas.getBoundingClientRect();
    satchelPoint(target, rect, this.width, this.height, this.satchelAt);
    flight.active = true; flight.t = 0;
    flight.sx = (drop.x - this.camera) * scale; flight.sy = (FLOOR - 18) * scale;
    flight.ex = this.satchelAt.x; flight.ey = this.satchelAt.y;
    flight.art = drop.art; flight.coins = drop.coins > 0; flight.color = drop.color;
  }
  /** Flights and the satchel's arrival pulse, in canvas CSS px (after the world transform is popped). */
  private drawFlights(c: CanvasRenderingContext2D, delta: number): void {
    const scale = this.height / 720;
    for (const flight of this.flights) {
      if (!flight.active) continue;
      flight.t += delta / FLIGHT_TIME;
      if (flight.t >= 1) {
        flight.active = false;
        this.satchelPulse = 1; this.satchelPulseColor = flight.color; this.satchelAt.x = flight.ex; this.satchelAt.y = flight.ey;
        continue;
      }
      flightPoint(flight.sx, flight.sy, flight.ex, flight.ey, flight.t, this.flightAt);
      const at = this.flightAt, size = 30 * scale * at.scale;
      c.save();
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = .55; c.fillStyle = flight.color;
      c.beginPath(); c.arc(at.x, at.y, size * .75, 0, Math.PI * 2); c.fill();
      c.restore();
      if (flight.coins) {
        c.fillStyle = '#ffd36d'; c.beginPath(); c.arc(at.x, at.y, size * .4, 0, Math.PI * 2); c.fill();
      } else if (!this.art(flight.art, at.x - size / 2, at.y - size / 2, size, size)) {
        c.fillStyle = flight.color; c.fillRect(at.x - size / 4, at.y - size / 4, size / 2, size / 2);
      }
    }
    if (this.satchelPulse > 0) {
      const k = this.satchelPulse;
      c.save(); c.strokeStyle = this.satchelPulseColor; c.lineWidth = 3; c.globalAlpha = k;
      c.beginPath(); c.arc(this.satchelAt.x, this.satchelAt.y, 12 + (1 - k) * 26, 0, Math.PI * 2); c.stroke();
      c.restore();
      this.satchelPulse = Math.max(0, k - delta * 3.5);
    }
  }
  /** A drop's light beam and ground ring, coloured by rarity. Two fills and an ellipse. */
  private drawDropBeam(c: CanvasRenderingContext2D, drop: Drop, time: number): void {
    const grow = Math.max(0, Math.min(1, (drop.age - .35) / .4));
    if (grow <= 0) return;
    let gradient = this.beamGradients.get(drop.color);
    if (!gradient) {
      gradient = c.createLinearGradient(0, 0, 0, -1);
      gradient.addColorStop(0, `${drop.color}cc`); gradient.addColorStop(.35, `${drop.color}55`); gradient.addColorStop(1, `${drop.color}00`);
      this.beamGradients.set(drop.color, gradient);
    }
    const pulse = this.reducedMotion ? .85 : .75 + Math.sin(time * 3 + drop.x * .05) * .25;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = drop.color; c.globalAlpha = .3 * pulse * grow;
    c.beginPath(); c.ellipse(drop.x, FLOOR + 1, 26, 6, 0, 0, Math.PI * 2); c.fill();
    c.translate(drop.x, FLOOR); c.scale(1, drop.beam * grow);
    c.fillStyle = gradient;
    c.globalAlpha = .45 * pulse; c.fillRect(-13, -1, 26, 1);
    c.globalAlpha = pulse; c.fillRect(-3.5, -1, 7, 1);
    c.restore();
  }
  /** The drop's name, shown while the Keeper stands near it or the pointer is over it. */
  private drawDropCaption(c: CanvasRenderingContext2D, drop: Drop, y: number): void {
    const near = Math.abs(drop.x - this.player.x) < 170 && Math.abs(this.player.y - FLOOR) < 120;
    const pointed = Math.abs(drop.x - this.pointerX) < 45 && Math.abs(FLOOR - 30 - this.pointerY) < 70;
    if (!near && !pointed) return;
    c.font = '600 13px system-ui'; c.textAlign = 'center';
    if (!drop.captionW) drop.captionW = Math.min(200, c.measureText(drop.caption).width + 16);
    const w = drop.captionW, top = y - 46;
    c.fillStyle = '#1a120fe6'; c.fillRect(drop.x - w / 2, top, w, 20);
    c.fillStyle = drop.color; c.fillRect(drop.x - w / 2, top + 19, w, 1);
    c.fillStyle = '#fff1d6'; c.fillText(drop.caption, drop.x, top + 14, w - 8);
  }
  /** A soft contact shadow on the ground below a figure, smaller and fainter the higher it is. */
  private groundShadow(c: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    let ground = FLOOR;
    for (const platform of this.areaDef.platforms) {
      if (platform.y >= y - 1 && platform.y < ground && x + 16 > platform.x && x - 16 < platform.x + platform.width) ground = platform.y;
    }
    const lift = 1 / (1 + Math.max(0, ground - y) / 140);
    c.save(); c.fillStyle = '#0a0608';
    c.globalAlpha = .18 * lift; c.beginPath(); c.ellipse(x, ground + 1, radius * 1.35 * lift, 9 * lift, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = .3 * lift; c.beginPath(); c.ellipse(x, ground + 1, radius * .8 * lift, 5.5 * lift, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  private drawBlade(c: CanvasRenderingContext2D, swing: number, attackT: number): void {
    c.save();
    c.translate(22 + Math.max(0, swing) * 16, -96);
    c.rotate(-.95 + swing * 1.85);
    if (attackT > .3) c.scale(1.06, 1.06);
    this.art('blade', -8, -78, 58, 92);
    c.restore();
  }
  private stepDust(c: CanvasRenderingContext2D, animation: string | undefined, time: number): void {
    if (this.reducedMotion || animation !== 'run') return;
    const step = Math.sin(time * 9);
    c.save();
    c.fillStyle = '#1a1216'; c.globalAlpha = .35;
    c.beginPath(); c.ellipse(step * 9, 3, 16 + Math.abs(step) * 4, 4, 0, 0, Math.PI * 2); c.fill();
    if (Math.abs(step) >= .72) {
      c.globalAlpha = (Math.abs(step) - .72) / .28 * .4; c.fillStyle = '#cbb09a';
      c.beginPath(); c.ellipse(step > 0 ? -14 : 12, -1, 12, 3.5, 0, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  private speechBubble(c: CanvasRenderingContext2D, id: string, anchorY: number): void {
    const speech = this.speech.get(id);
    if (!speech || Date.now() - speech.at > 7000) return;
    c.save();
    c.font = '600 15px "Cormorant Garamond", Georgia, serif'; c.textAlign = 'center';
    const width = Math.min(260, c.measureText(speech.text).width + 22);
    const x = -width / 2;
    c.fillStyle = '#fff6ea'; c.beginPath();
    if (typeof c.roundRect === 'function') c.roundRect(x, anchorY, width, 26, 8);
    else c.rect(x, anchorY, width, 26);
    c.fill();
    c.fillStyle = '#2a1c16'; c.fillText(speech.text, 0, anchorY + 17, width - 16);
    c.restore();
  }

  /**
   * An image by key: a legacy pre-resolved asset (`keeper`, `blade`, `ore`,
   * `creature`, `background`) or a world-data art key resolved once through
   * `options.art` and cached. Allocates only on the first request for a key.
   */
  private image(key: string | undefined): HTMLImageElement | undefined {
    if (!key) return undefined;
    const legacy = this.images[key];
    if (legacy) return legacy;
    let lazy = this.lazyImages.get(key);
    if (lazy === undefined) {
      const url = key.startsWith('scene:') ? this.options.scene?.(key.slice(6)) : this.options.art?.(key);
      lazy = null;
      if (url) { lazy = new Image(); lazy.src = url; }
      this.lazyImages.set(key, lazy);
    }
    return lazy ?? undefined;
  }
  private art(key: string | undefined, x: number, y: number, width: number, height: number): boolean {
    const image = this.image(key);
    if (!image?.complete || !image.naturalWidth) return false;
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    this.context.drawImage(image, x + (width - image.naturalWidth * scale) / 2, y + height - image.naturalHeight * scale, image.naturalWidth * scale, image.naturalHeight * scale);
    return true;
  }
  /** The area's painted scene, or the legacy background until it resolves. */
  private sceneImage(): HTMLImageElement | undefined {
    const scene = this.image(this.sceneKey);
    return scene?.complete && scene.naturalWidth ? scene : this.images['background'];
  }
  /** One station: its building, its label, and the prompt or hover cue. Render-only. */
  private drawStation(c: CanvasRenderingContext2D, station: StationDef, near: boolean, hovered: boolean, time: number): void {
    const x = station.x;
    const hot = near || hovered;
    if (hot) {
      // A warm pool of light on the boards marks the place the pointer or the Keeper is on.
      c.save(); c.globalAlpha = near ? .4 : .26; c.fillStyle = '#ffb46a';
      c.beginPath(); c.ellipse(x, FLOOR + 2, (station.width ?? 120) * .55, 11, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    if (!this.homestead?.paints(this.areaDef.id, station.id)) switch (station.kind) {
      case 'resource':
        if (!this.art(station.art, x - 58, FLOOR - 92, 116, 92)) this.art('ore', x - 58, FLOOR - 92, 116, 92);
        break;
      case 'quest':
        if (station.id === 'beacon') {
          c.fillStyle = '#423f51'; c.fillRect(x - 20, FLOOR - 160, 40, 160);
          c.shadowColor = this.restored ? '#b8e6ec' : '#f29b68'; c.shadowBlur = 35;
          c.fillStyle = this.restored ? '#d5fffa' : '#b96d55'; c.beginPath(); c.arc(x, FLOOR - 173, 20, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
        } else {
          c.fillStyle = '#493543'; c.fillRect(x - 46, FLOOR - 60, 92, 60);
          c.fillStyle = '#ffaf62'; c.fillRect(x - 34, FLOOR - 52, 68, 8);
          if (!this.art(station.art, x - 35, FLOOR - 160, 70, 95)) this.art('blade', x - 35, FLOOR - 160, 70, 95);
        }
        break;
      case 'passage':
        c.strokeStyle = this.restored ? '#99e3cb' : '#574658'; c.lineWidth = 12; c.beginPath(); c.arc(x, FLOOR - 70, 48, Math.PI, 0); c.lineTo(x + 48, FLOOR); c.moveTo(x - 48, FLOOR - 70); c.lineTo(x - 48, FLOOR); c.stroke();
        break;
      case 'waystone':
        this.drawWaystone(c, station, hot, time);
        break;
      default:
        this.drawStall(c, station, hot);
    }
    c.font = '600 12px system-ui'; c.textAlign = 'center'; c.fillStyle = hot ? '#fff1c9' : '#c9bdc8'; c.fillText(station.label, x, FLOOR + 35);
    if (near) { c.fillStyle = '#fff0cb'; c.fillText('[ E ] INTERACT', x, FLOOR + 58); }
    else if (hovered) { c.fillStyle = '#e7d3b4'; c.fillText('CLICK TO WALK HERE', x, FLOOR + 58); }
  }
  /** A timber market stall: posts, a striped awning, a counter, and the station's art on a lit plaque. */
  private drawStall(c: CanvasRenderingContext2D, station: StationDef, hot: boolean): void {
    const x = station.x;
    const half = (station.width ?? 150) / 2;
    c.save();
    c.fillStyle = '#4b332c'; c.fillRect(x - half + 4, FLOOR - 176, 9, 176); c.fillRect(x + half - 13, FLOOR - 176, 9, 176);
    // Back wall, dim, so the plaque reads against it.
    c.fillStyle = '#2a1d22'; c.fillRect(x - half + 13, FLOOR - 150, half * 2 - 26, 90);
    // Awning: alternating ember and brass stripes, scalloped edge.
    const stripes = 6; const stripe = half * 2 / stripes;
    for (let i = 0; i < stripes; i++) {
      c.fillStyle = i % 2 ? '#c2a26a' : '#8d3f36';
      c.fillRect(x - half + i * stripe, FLOOR - 186, stripe, 26);
      c.beginPath(); c.arc(x - half + (i + .5) * stripe, FLOOR - 160, stripe / 2, 0, Math.PI); c.fill();
    }
    c.fillStyle = '#e1c29a'; c.fillRect(x - half - 4, FLOOR - 190, half * 2 + 8, 5);
    // Counter.
    c.fillStyle = '#4a3238'; c.fillRect(x - half, FLOOR - 58, half * 2, 58);
    c.fillStyle = '#a67858'; c.fillRect(x - half - 6, FLOOR - 62, half * 2 + 12, 8);
    c.fillStyle = '#f6a668'; c.fillRect(x - half, FLOOR - 62, half * 2, 1);
    // Plaque with the station's art.
    c.shadowColor = '#ffb46a'; c.shadowBlur = hot ? 28 : 12;
    c.fillStyle = '#1d1418'; c.beginPath(); c.arc(x, FLOOR - 108, 34, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = hot ? '#ffe0a8' : '#a68456'; c.lineWidth = hot ? 3 : 2; c.stroke();
    if (!this.art(station.art, x - 27, FLOOR - 135, 54, 54)) { c.fillStyle = '#c2a26a'; c.fillRect(x - 8, FLOOR - 116, 16, 16); }
    if (hot) { c.strokeStyle = '#ffe0a8'; c.lineWidth = 2; c.strokeRect(x - half - 6, FLOOR - 192, half * 2 + 12, 192); }
    c.restore();
  }
  /** A standing stone with a rift burning at its crown. The glow breathes unless motion is reduced. */
  private drawWaystone(c: CanvasRenderingContext2D, station: StationDef, hot: boolean, time: number): void {
    const x = station.x;
    c.save();
    c.fillStyle = '#3d3446';
    c.beginPath(); c.moveTo(x - 26, FLOOR); c.lineTo(x - 14, FLOOR - 170); c.lineTo(x, FLOOR - 186); c.lineTo(x + 14, FLOOR - 170); c.lineTo(x + 26, FLOOR); c.closePath(); c.fill();
    c.strokeStyle = hot ? '#ffe0a8' : '#7d6a86'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = '#c9a0ff'; c.globalAlpha = .55; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x - 6, FLOOR - 40); c.lineTo(x + 6, FLOOR - 70); c.lineTo(x - 6, FLOOR - 100); c.lineTo(x + 6, FLOOR - 130); c.stroke();
    c.globalAlpha = 1;
    const pulse = this.reducedMotion ? .5 : .5 + Math.sin(time * 2) * .5;
    c.shadowColor = '#c9a0ff'; c.shadowBlur = 18 + pulse * 18 + (hot ? 12 : 0);
    if (!this.art(station.art, x - 34, FLOOR - 252, 68, 68)) { c.fillStyle = '#c9a0ff'; c.beginPath(); c.arc(x, FLOOR - 214, 16, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
  private render(): void {
    const c = this.context; const scale = this.height / 720; const viewport = this.width / scale;
    this.pixelScale = scale * this.pixelRatio;
    this.camera = Math.max(0, Math.min(this.areaDef.width - viewport, this.player.x - viewport * .38));
    c.clearRect(0, 0, this.width, this.height); c.save(); c.scale(scale, scale);
    c.fillStyle = '#11101a'; c.fillRect(0, 0, viewport, 720);
    const bg = this.sceneImage();
    if (bg?.complete && bg.naturalWidth) {
      const bgWidth = Math.max(viewport + 500, 720 * bg.naturalWidth / bg.naturalHeight);
      c.globalAlpha = .94; c.drawImage(bg, -this.camera * .16, 0, bgWidth, 720); c.globalAlpha = 1;
    }
    const shade = c.createLinearGradient(0, 0, 0, 720); shade.addColorStop(0, '#b97a4530'); shade.addColorStop(1, '#30232b99');
    c.fillStyle = shade; c.fillRect(0, 0, viewport, 720);
    const jolt = this.shake > 0 ? this.shake : 0;
    c.translate(-this.camera + (jolt ? (Math.random() * 2 - 1) * jolt : 0), jolt ? (Math.random() * 2 - 1) * jolt * .6 : 0);
    const motionTime = this.reducedMotion ? 0 : this.elapsed;
    this.atmosphere.scenery(c, motionTime, this.camera, viewport);
    for (const platform of this.areaDef.platforms) {
      c.fillStyle = '#3b3034'; c.fillRect(platform.x, platform.y, platform.width, platform.y === FLOOR ? 110 : 24);
      c.fillStyle = '#a67858'; c.fillRect(platform.x, platform.y, platform.width, 4);
      c.fillStyle = '#f6a668'; c.fillRect(platform.x + 8, platform.y, Math.max(0, platform.width - 16), 1);
      for (let x = platform.x + 18; x < platform.x + platform.width; x += 65) { c.fillStyle = '#3c3039'; c.fillRect(x, platform.y + 12, 32, 7); }
    }
    if (this.isTown && this.areaDef.scenery === 'seamworks-hub') this.atmosphere.hub(c, motionTime, this.areaDef.safeX || 1120);
    if (this.homestead) {
      const f = this.homesteadFrame;
      f.areaId = this.areaDef.id; f.camera = this.camera; f.viewport = viewport; f.time = motionTime; f.playerX = this.player.x; f.reduced = this.reducedMotion;
      this.homestead.draw(c, f);
    }
    const nearId = this.nearby();
    for (const station of this.stations) {
      if (station.x < this.camera - 200 || station.x > this.camera + viewport + 200) continue;
      this.drawStation(c, station, station.id === nearId, station.id === this.hovered, motionTime);
    }
    for (const drop of this.drops) this.drawDropBeam(c, drop, motionTime);
    for (const drop of this.drops) {
      // Spilled from the body: an arc out and a short bounce, then the idle bob.
      const t = Math.min(1, drop.age / .5);
      const arc = this.reducedMotion ? 0 : t < .7 ? Math.sin(t / .7 * Math.PI) * 70 : Math.sin((t - .7) / .3 * Math.PI) * 12;
      const fling = this.reducedMotion ? 0 : drop.spin * 24 * (1 - t);
      const y = FLOOR - 18 - arc + (t < 1 ? 0 : Math.sin(motionTime * 5 + drop.x) * 4);
      c.save(); c.translate(-fling, 0);
      c.shadowBlur = 14; c.shadowColor = drop.color;
      if (drop.coins) {
        c.fillStyle = '#ffd36d'; c.beginPath(); c.ellipse(drop.x, y, 3 + Math.abs(Math.cos(motionTime * 3)) * 7, 13, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#9e602c'; c.font = 'bold 14px system-ui'; c.textAlign = 'center'; c.fillText('$', drop.x, y + 5);
      } else if (!this.art(drop.art, drop.x - 15, y - 15, 30, 30) && !this.art('ore', drop.x - 15, y - 15, 30, 30)) { c.fillStyle = '#ed9069'; c.fillRect(drop.x - 8, y - 8, 16, 16); }
      c.shadowBlur = 0; c.restore();
      if (t >= 1) this.drawDropCaption(c, drop, y);
    }
    for (const monster of this.monsters) {
      if (monster.hp <= 0 && monster.dying <= 0) continue;
      if (monster.x < this.camera - 220 || monster.x > this.camera + viewport + 220) continue;
      if (monster.hp <= 0) { this.dissolve(c, monster); continue; }
      const warning = monster.phase === 'windup' || monster.phase === 'strike';
      const rigDef = this.creatureRig(monster.def.creature).def;
      const crown = FLOOR - rigDef.box.h - 20;
      if (warning) {
        c.fillStyle = monster.phase === 'strike' ? '#ff765caa' : '#ff765c40';
        c.fillRect(monster.facing < 0 ? monster.x - 170 : monster.x, FLOOR - 10, 170, 10);
        c.fillStyle = '#ffc589'; c.font = 'bold 18px system-ui'; c.textAlign = 'center'; c.fillText('!', monster.x, crown - 20);
      }
      const rise = monster.born > 0 ? 1 - monster.born / SPAWN_RISE : 1;
      this.groundShadow(c, monster.x + monster.knock, FLOOR, rigDef.shadow * (.6 + rise * .4));
      // Turn the painting toward its target. Purely a drawing choice.
      const looking = monster.phase === 'idle' ? Math.sign(this.player.x - monster.x) || monster.facing : monster.facing;
      const mirror = rigDef.facesLeft ? looking > 0 : looking < 0;
      c.save(); c.translate(monster.x + monster.knock, FLOOR);
      c.globalAlpha = rise; c.scale((.6 + rise * .4) * (mirror ? -1 : 1), .6 + rise * .4);
      this.creature(c, monster.flash > 0, monster.def.creature, monster);
      c.restore();
      // The chip bar trails the real HP so a hit reads as a chunk taken.
      const full = monster.maxHp || 1;
      c.fillStyle = '#302530'; c.fillRect(monster.x - 45, crown, 90, 6);
      c.fillStyle = '#ffe2c4'; c.fillRect(monster.x - 45, crown, Math.max(monster.hp, monster.shownHp) / full * 90, 6);
      c.fillStyle = '#dd866f'; c.fillRect(monster.x - 45, crown, monster.hp / full * 90, 6);
    }
    for (const view of this.peers.values()) {
      if (view.peer.area !== this.areaDef.name || view.x < this.camera - 160 || view.x > this.camera + viewport + 160) continue;
      // Spawn puts every Keeper on the same tile. Spread guests so names and sprites stay readable.
      const spread = (([...view.peer.id].reduce((hash, char) => (hash * 33 + char.charCodeAt(0)) >>> 0, 0) % 5) - 2) * 46;
      this.groundShadow(c, view.x + spread, view.y, 40);
      c.save(); c.translate(view.x + spread, view.y);
      c.strokeStyle = '#edc9ff'; c.fillStyle = '#edc9ff25'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(0, 0, 32, 8, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.font = '600 16px "Cormorant Garamond", Georgia, serif'; c.textAlign = 'center';
      const labelWidth = Math.min(240, c.measureText(view.peer.name).width + 22);
      c.fillStyle = '#1a120fe6'; c.fillRect(-labelWidth / 2, -208, labelWidth, 24);
      c.fillStyle = '#ffe1b0'; c.fillText(view.peer.name, 0, -190, 220);
      this.speechBubble(c, view.peer.id, -214);
      const shown = this.present(view.peer.animation, view.peer.x, view.y);
      const motion = this.keeperMotion(shown, motionTime + view.x);
      const warm = shown === 'rest';
      const attackT = shown === 'attack' ? (motionTime * 3.2) % 1 : 0;
      const swing = attackT === 0 ? 0 : attackT < .3 ? -attackT / .3 : Math.sin((attackT - .3) / .7 * Math.PI);
      c.scale(view.facing, 1); this.stepDust(c, shown, motionTime + view.x);
      c.globalAlpha = motion.alpha;
      c.shadowColor = warm ? '#ffc27a' : '#deb8f3'; c.shadowBlur = warm ? 12 : 6; c.filter = 'none';
      this.drawKeeper(c, { x: -70, y: -176, w: 140, h: 176 }, shown, motionTime + view.x, view.motion, view.x, view.y, view.facing,
        attackT, swing, false, { landing: 0, recoil: shown === 'hurt' ? .6 : 0, rim: 0 }, motion);
      c.restore();
    }
    // Keep the player readable against the dark realm art at narrow viewport sizes.
    const byFire = this.isTown && this.areaDef.scenery === 'seamworks-hub' && Math.abs(this.player.x - 245) < 220;
    this.groundShadow(c, this.player.x, this.player.y, 44);
    c.save(); c.translate(this.player.x, this.player.y);
    c.strokeStyle = byFire ? '#ffc27a' : '#b8e6ec'; c.fillStyle = byFire ? '#ffc27a30' : '#b8e6ec30'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(0, 0, 46, 10, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.font = '600 15px "Cormorant Garamond", Georgia, serif';
    const youWidth = Math.min(120, c.measureText('You').width + 20);
    c.fillStyle = '#1a120fe6'; c.textAlign = 'center';
    c.fillRect(-youWidth / 2, -204, youWidth, 22);
    c.beginPath(); c.moveTo(-6, -182); c.lineTo(6, -182); c.lineTo(0, -174); c.closePath(); c.fill();
    c.fillStyle = '#ffe1b0';
    c.fillText('You', 0, -188);
    this.speechBubble(c, this.selfId, -234);
    c.restore();
    c.save(); c.translate(this.player.x, this.player.y); c.scale(this.facing, 1);
    const shown = this.present(this.pose(), this.player.x, this.player.y);
    const motion = this.keeperMotion(shown, this.elapsed);
    if (this.landing > 0 && !this.reducedMotion) {
      const squash = .1 * this.landing / .18;
      motion.sx += squash; motion.sy -= squash; motion.bob += squash * 8;
    }
    const attackT = this.attackTime > 0 ? 1 - this.attackTime / .4 : 0;
    const swing = attackT === 0 ? 0 : attackT < .3 ? -attackT / .3 : Math.sin((attackT - .3) / .7 * Math.PI);
    this.stepDust(c, shown, this.elapsed);
    if (this.hurtTime > 0) c.globalAlpha = .45 + Math.sin(this.elapsed * 35) * .2;
    else if (this.dodgeTime > 0) c.globalAlpha = motion.alpha;
    c.shadowColor = shown === 'rest' ? '#ffc27a' : '#b8e6ec'; c.shadowBlur = shown === 'rest' ? 12 : 6;
    c.filter = 'none';
    const strikeGlow = attackT > .3 ? Math.max(0, 1 - Math.abs(attackT - .45) / .2) : 0;
    this.drawKeeper(c, { x: -78, y: -196, w: 156, h: 196 }, shown, motionTime, this.playerMotion, this.player.x, this.player.y, this.facing,
      attackT, swing, this.equipped, {
        landing: this.landing > 0 ? this.landing / .18 : 0,
        recoil: this.hp <= 0 ? 1 : Math.max(0, Math.min(1, this.hurtTime / .8)),
        rim: Math.max(strikeGlow, this.wound * .9),
      }, motion, true);
    c.filter = 'none'; c.shadowBlur = 0; c.globalAlpha = 1;
    if (attackT > .3) {
      const u = (attackT - .3) / .7;
      c.save(); c.shadowColor = '#ffe7c2'; c.shadowBlur = 12; c.lineCap = 'round';
      c.globalAlpha = .35 * (1 - u); c.strokeStyle = '#ffb46a'; c.lineWidth = 14;
      c.beginPath(); c.arc(24, -82, 100, -1.05, -1.05 + Math.max(0, u - .12) * 2.15); c.stroke();
      c.globalAlpha = .92 * (1 - u * .35); c.strokeStyle = '#ffd7a1'; c.lineWidth = 6;
      c.beginPath(); c.arc(24, -82, 94, -1.1, -1.1 + u * 2.2); c.stroke();
      c.strokeStyle = '#fff6ea'; c.lineWidth = 2; c.stroke();
      c.restore();
    }
    c.restore();
    this.atmosphere.feedback(c, this.reducedMotion);
    c.restore();
    this.drawFlights(c, this.flightDelta);
    if (this.wound > 0) {
      // A wound reddens the edges of the screen, not the Keeper: the eye stays on the fight.
      const edge = c.createRadialGradient(this.width / 2, this.height / 2, Math.min(this.width, this.height) * .35, this.width / 2, this.height / 2, Math.max(this.width, this.height) * .75);
      edge.addColorStop(0, '#c0303000'); edge.addColorStop(1, `rgba(192, 48, 48, ${(.42 * this.wound).toFixed(3)})`);
      c.fillStyle = edge; c.fillRect(0, 0, this.width, this.height);
    }
  }
  /** The rig for a creature art key, built once per key. */
  private creatureRig(key: string): { def: CreatureRigDef; sprite: RigSprite } {
    let entry = this.creatureRigs.get(key);
    if (!entry) {
      const def = creatureRigFor(key);
      entry = { def, sprite: new RigSprite(def.spec) };
      this.creatureRigs.set(key, entry);
    }
    return entry;
  }
  /**
   * The creature through its own rig, or a white silhouette of it for the frames
   * after a hit. Until the painting loads, the legacy `creature` asset (the Rivet
   * Maw) stands in through the Maw rig, so a pose is never applied to the wrong body.
   */
  private creature(c: CanvasRenderingContext2D, flash: boolean, key: string, monster?: Monster): void {
    const painted = this.image(key);
    const ready = !!(painted?.complete && painted.naturalWidth);
    const entry = this.creatureRig(ready ? key : RIVET_MAW_CREATURE.key);
    const def = entry.def;
    const rig = entry.sprite;
    const sprite = ready ? key : 'creature';
    if (monster) {
      const input = this.creaturePose;
      input.phase = monster.phase; input.timer = monster.timer; input.time = this.reducedMotion ? 0 : this.elapsed;
      input.seed = monster.spawn * .013; input.reduced = this.reducedMotion; input.hurt = monster.recoil;
      def.pose(rig.pose, input);
    } else resetPose(rig.pose);
    // Contain-fit, bottom aligned, then lowered so the painted feet touch the floor.
    const box = def.box, drawn = Math.min(box.w, box.h);
    const boxX = -box.w / 2, boxY = -box.h + (1 - def.ground) * drawn;
    if (rig.render(this.image(sprite), boxX, boxY, box.w, box.h, this.pixelScale)) {
      // brightness() whitens the painted sprite in place, so no tinted copy is needed.
      if (flash) c.filter = 'brightness(3.2) saturate(0)';
      rig.blit(c);
      c.filter = 'none';
      if (monster?.phase === 'strike' && !flash) {
        c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= .35; rig.blit(c, -1.5, -1); c.restore();
      }
      return;
    }
    if (!flash) {
      if (!this.art(sprite, boxX, boxY, box.w, box.h)) { c.fillStyle = '#b26460'; c.fillRect(-35, -75, 70, 75); }
      return;
    }
    // brightness() whitens the painted sprite in place, so no tinted copy is needed.
    c.filter = 'brightness(3.2) saturate(0)';
    if (!this.art(sprite, boxX, boxY, box.w, box.h)) { c.fillStyle = '#fff4ea'; c.fillRect(-35, -75, 70, 75); }
    c.filter = 'none';
  }
  /** A felled Maw sinks, flattens and fades, shedding embers as it goes. */
  private dissolve(c: CanvasRenderingContext2D, monster: Monster): void {
    const t = 1 - monster.dying / DEATH_FADE;
    c.save(); c.translate(monster.x + monster.knock, FLOOR);
    c.globalAlpha = 1 - t;
    if (!this.reducedMotion) c.scale(1 + t * .35, 1 - t * .7);
    this.creature(c, t < .25, monster.def.creature);
    c.restore();
    if (this.reducedMotion) return;
    c.save(); c.fillStyle = '#ffb46a';
    for (let n = 0; n < 7; n++) {
      const a = n * 2.4 + monster.spawn;
      c.globalAlpha = (1 - t) * .8;
      c.beginPath(); c.arc(monster.x + Math.cos(a) * 40 * t, FLOOR - 50 - t * 70 - Math.sin(a) * 18, 3 * (1 - t) + 1, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
}
