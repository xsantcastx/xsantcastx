import { coarseDevice, renderBudget, type RenderBudget } from './render-budget';
import { Atmosphere } from './atmosphere';
import { LifeFrame, TownLife } from './town-life';
import type { KeeperContext } from '../world/keeper-lines';
import { createKeeperMotion, KEEPER, KEEPER_HAND, KEEPER_RIG, KeeperMotion, poseKeeper, trackKeeper } from './rig-poses';
import { resetPose, RigSprite } from './rig';
import { CREATURE_STRIKE, CREATURE_WINDUP, CreatureRigDef, creatureRigFor, RIVET_MAW_CREATURE } from './creature-rigs';
import {
  CREATURE_SPRITE_FALLBACKS, createSpriteAnchor, createSpriteClock, frameAt, frameAtProgress, KEEPER_SPRITE_FALLBACKS, SpriteClock, SpriteDraw, SpriteRenderer, tickClock,
} from './sprite';
import { spriteFor } from '../../shared/art/sprite-manifest.generated';
import { beamColor, beamHeight, FLIGHT_TIME, flightPoint, RARITY_COLORS, satchelPoint } from './loot-fx';
import { aimFromBladeRotation, createHeldTransform, HeldItem, heldTransform, KEEPER_BACK_HAND, KeeperLoadout, OFFHAND_DEFAULTS, WEAPON_DEFAULTS } from './loadout';
import { advanceBody, Body, EngineInput, EngineOptions, EngineState, FLOOR, InteractionTarget, KeeperAnimation, meleeHits, SITE_CUE_RISE, STATION_CUE_Y, walkDirection, WORLD_ACTION_UNPAID } from './engine.model';
import {
  applyTerrainDiff, BLAST_TOOLS, BodyBox, boxHits, CELL, cellKey, coneCells, generateTerrain, isAir, nodeIndex, PlaceableDef, PlaceableId, placeableById,
  climbTerrainBody, findNode, glowIntensity, INTERACT_REACH, isClimbable, isOneWay, isTakeable, onLadder, placeTarget, stepTerrainBody, SWING_TOOLS, takeTarget, Terrain, TERRAIN_NODE_LIST, TERRAIN_NODES, TerrainNodeDef, terrainLayout, TOOL_ACTION, ToolKind, toolFor, toolName, ToolTiers,
  blastCells, CHARGE_FUSE, CHARGE_RADIUS, isLoose, supportNear,
  applyLiquidDiff, LIQUID_FULL, LIQUID_IDS, LIQUID_LAVA, LIQUID_WATER, liquidDiff, liquidLayout, LiquidKind,
} from './terrain';
import { immersion, LiquidSim, SWIM, surfaceY, WOODEN_IDS } from './liquids';
import { drawLiquids, lavaLights } from './liquid-render';
import { AmbientMotes, Debris, GlowHalos, TerrainRenderer } from './terrain-render';
import { createFog, MapSource, revealAround } from './delve-map';
import type { BucketId, DelvePersistence, FishingPhase, GatherPersistence } from './engine.model';
import { regrowSecondsLeft } from '../../shared/skills/gather-save.model';
import { ambientDarkness, DarknessLayer, DEFAULT_LANTERN, LIGHT_CAP, LightPool, selectLights } from './lighting';
import { ART, RockShade, sparkleOffset, TILE, tileVariant } from './tile-art';
import { CaveBackdrop } from './cave-backdrop';
import { ParallaxBackdrop } from './parallax';
import { GroundStrip } from './ground-strip';
import type { DisciplineId } from '../../shared/activity/activity.model';
import { AreaDef, areaOf, clientToWorld, DropEntry, GatherNodeDef, LootRarity, MonsterDef, NODE_REACH, nearestStation, StationDef, stationAt, TownDef } from '../world/world.model';
import { INFERNAL_TOWN } from '../world/towns/infernal';
import type { HomesteadFrame, HomesteadView } from './homestead-render';
import { GlimSprite } from './glim-sprite';
export type { BucketEvent, BucketId, DelvePersistence, DiscoverEvent, EngineInput, EngineOptions, EngineState, FishEvent, InteractionTarget, KeeperAnimation, KillEvent, PlaceEvent, UseEvent, WorldActionEvent } from './engine.model';
export type { PlaceableId, ToolTiers } from './terrain';
export type { HeldItem, KeeperLoadout } from './loadout';

// `flash`, `knock`, `dying`, `born` and `shownHp` are presentation only: they
// shape how a Maw is drawn and never feed back into position, HP or loot.
/** Why a thing cannot be placed: the English line and its play.delve.* key. */
interface PlaceProblem { key: string; en: string; vars?: Record<string, string | number> }
interface Monster {
  def: MonsterDef; maxHp: number;
  x: number; spawn: number; hp: number; phase: 'idle' | 'windup' | 'strike' | 'recover'; timer: number; facing: number; respawn: number;
  flash: number; knock: number; dying: number; born: number; shownHp: number;
  /** Hit recoil 1 → 0, drives each creature's hurt pose. Presentation only. */
  recoil: number;
}
/** `ore` is the material quantity (legacy name). `art`/`label`/`short` come from the drop entry. */
interface Drop {
  id: string; x: number; y: number; coins: number; ore: number; material?: string; art?: string; label?: string; short?: string; age: number; spin: number;
  /** Presentation, fixed at spill time so the render allocates nothing: beam colour/height, hover caption and its measured width. */
  rarity?: LootRarity; color: string; beam: number; caption: string; captionW: number;
}
/**
 * A gathering node's live state. `at` is the last harvest (epoch ms, null =
 * none on record): the one fact saved, read from `GatherPersistence` on the
 * first visit. `ready` and `timer` (seconds left) are derived from it against
 * the wall clock every step (`refreshSite`), never counted down, so a reload
 * or a closed panel shows each node exactly as far along as it is.
 * `gen` counts harvests this session: it keys the grant's mutation id, so
 * each regrowth is a new grant and a retried break is the same one. `shake`
 * is presentation only.
 */
interface GatherSite { def: GatherNodeDef; hp: number; at: number | null; ready: boolean; timer: number; gen: number; shake: number }
/** A picked-up item flying to the satchel, in canvas CSS px. Pooled; render-only. */
interface Flight { active: boolean; t: number; sx: number; sy: number; ex: number; ey: number; art?: string; coins: boolean; color: string }
/** Lit ground in the Delve takes on the lantern's and torches' warmth (DarknessLayer.draw `warm`). */
const WARM_LIGHT = { color: '#ffb066', alpha: .14 };
const FLIGHT_POOL = 16;
/**
 * Frame pacing. A 120 Hz display would otherwise draw twice as often as the
 * game needs; a town where nothing the player drives has moved for a while
 * draws at half rate. Heat, not looks: the fixed 60 Hz step is unchanged.
 */
const MAX_FPS = 60;
const QUIET_FPS = 30;
const QUIET_AFTER_MS = 2500;
/** Seconds a felled Maw takes to dissolve, and a respawn takes to rise. */
const DEATH_FADE = .45;
const SPAWN_RISE = .4;
/** The Keeper's body in a delve (figure scale 0.5): fits a three-cell tunnel. */
const DELVE_BOX: BodyBox = { halfWidth: 13, height: 90 };
/** How far from the Keeper's chest a click, a tap or the smart cursor reaches a cell, in cells (Terraria's tile reach). */
export const REACH_CELLS = 4.5;
const DELVE_REACH = CELL * REACH_CELLS;
/** Forgiving jumps: a jump pressed this long before landing still happens, and one pressed this long after walking off a ledge too. */
const JUMP_BUFFER = .12;
const COYOTE = .1;
/** Down + Jump on a platform: one-way floors are ignored this long, so the Keeper drops through. */
const DROP_THROUGH = .25;
/** Seconds between swings: combat, and digging/gathering with a starter tool. */
const BASE_SWING = .52;
/** No tool pace may beat this (guards a bad setTools value). */
const MIN_SWING = .25;
/** Holding to place along a drag: one block per this many seconds, never faster than the fastest swing. */
const PLACE_PACE = MIN_SWING;
/** No skill level multiplies a tool's damage past this (level 99 is ×1.5; guards a bad setTools value). */
const MAX_POWER = 1.5;
const BLAST_TIME = .3;
const BLAST_COOLDOWN = 1.1;
/** Loose rock: the groan before it falls (s), its fastest fall, and its bruise as a share of max HP. */
const RUBBLE_WAIT = .45;
const TERMINAL_RUBBLE = 900;
const RUBBLE_SHARE = .08;
/** What a blasting charge does to a creature in its round. */
const CHARGE_DAMAGE = 60;
/** Breath under water, seconds (a Gill Draught multiplies it), then drowning takes this share of max HP a second. */
const BREATH = 8;
const DROWN_SHARE = .06;
/** Lava: this share of max HP a second while in it, then the after-burn for BURN_TIME seconds at BURN_SHARE. */
const LAVA_SHARE = .15;
const BURN_TIME = 2;
const BURN_SHARE = .05;
/** A wooden thing lava reaches chars this long, then goes back to the satchel. */
const CHAR_TIME = 3;
/** A veiled creature is exposed by a placed light this many cells away. */
const VEIL_CELLS = 4;
/** Fishing: how far a cast reaches, in cells; the hook window after the dip; a nibble after a miss. */
const CAST_CELLS = 6;
const HOOK_WINDOW = .6;
const LATE_HOOK = .6;
/** The buckets, empty and full. */
const BUCKET_FOR: Readonly<Record<number, BucketId>> = { [LIQUID_WATER]: 'seam-bucket-water', [LIQUID_LAVA]: 'seam-bucket-lava' };
const BUCKET_LIQUID: Readonly<Record<string, number>> = { 'seam-bucket': 0, 'seam-bucket-water': LIQUID_WATER, 'seam-bucket-lava': LIQUID_LAVA };
export function isBucket(id: string | null | undefined): id is BucketId { return !!id && id in BUCKET_LIQUID; }
/** What hitCell did to one cell. */
const HIT_NONE = 0, HIT_CHIP = 1, HIT_BROKE = 2, HIT_BLOCKED = 3, HIT_REFUSED = 4;
/** Gathering nodes: the glow of a ready node and the colour of its chips, by kind. */
const SITE_GLOW: Readonly<Record<GatherNodeDef['kind'], string>> = { herb: '#b6f28a', wood: '#e8c47a', ore: '#8fd6cf' };
const SITE_FLECK: Readonly<Record<GatherNodeDef['kind'], string>> = { herb: '#7fb85a', wood: '#b08a55', ore: '#9fd0c8' };
/** Where an outcrop's nuggets glint, relative to its foot. */
const SITE_NUGGETS: readonly (readonly [number, number])[] = [[-18, -26], [6, -44], [20, -22], [-4, -14]];
/** The skill a node's discipline trains, where the stored id differs ("Needs Foraging 6"). */
const SKILL_NAME: Partial<Record<DisciplineId, string>> = { forge: 'smithing', exploration: 'delving' };
/** 'cinder-ore' → 'Cinder Ore'. */
function titleCase(id: string): string { return id.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()); }
/** The prompt over a usable cell. */
const USE_LABEL: Readonly<Record<string, string>> = { inscription: 'CARVED INSCRIPTION', chest: 'CHEST', camp: 'YOUR CAMP' };
const KEEPER_ANIMATIONS = new Set<KeeperAnimation>(['idle', 'run', 'jump', 'fall', 'attack', 'dodge', 'hurt']);
export interface RemoteKeeper { id: string; name: string; x: number; y: number; area: string; facing?: number; animation?: string }
interface PeerView { peer: RemoteKeeper; x: number; y: number; facing: number; motion: KeeperMotion; clock: SpriteClock }
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
  /** `start()` ran: a parked loop may be resumed (see `setPaused`). */
  private started = false;
  /**
   * Last time (rAF clock) anything the player drives moved: input, a walk, a
   * swing, a flight, the Keeper's position. A town with none of that for
   * QUIET_AFTER_MS draws at QUIET_FPS (townsfolk and motes still move, just
   * less often); everywhere else, and the moment anything moves, at MAX_FPS.
   */
  private activeAt = 0;
  private lastX = NaN;
  private lastY = NaN;
  private observer: ResizeObserver;
  private previous = 0;
  private accumulator = 0;
  private elapsed = 0;
  private readonly atmosphere = new Atmosphere();
  /** Keepers and townsfolk in the current town. Visual only. */
  private readonly life = new TownLife();
  private readonly lifeFrame: LifeFrame = {
    camera: 0, viewport: 0, time: 0, reduced: false, playerX: 0, pixelScale: 1,
    image: key => this.image(key),
    translate: key => this.options.translate?.(key) ?? key,
    sprite: id => this.readySprite(id),
    spriteImage: () => this.readyImage,
  };
  /** Mesh rigs bending the single Keeper and Maw paintings. Render-only. */
  private readonly keeperRig = new RigSprite(KEEPER_RIG);
  /** One rig per creature art key, built on first sight and shared by every monster using that painting. */
  private readonly creatureRigs = new Map<string, { def: CreatureRigDef; sprite: RigSprite }>();
  private readonly creaturePose = { phase: 'idle' as Monster['phase'], timer: 0, time: 0, seed: 0, reduced: false, hurt: 0 };
  /**
   * World-layer sprite sheets by id, resolved once (null = no sheet, keep the
   * rig). With a sheet, a figure is drawn from its frames; without one,
   * exactly as before. `readyImage` is the image the last `readySprite` hit chose.
   */
  private readonly sprites = new Map<string, SpriteRenderer | null>();
  private readyImage: HTMLImageElement | undefined;
  private readonly playerClock = createSpriteClock();
  private readonly spriteHand = createSpriteAnchor();
  private readonly spriteDraw: SpriteDraw = {};
  /** The one SpriteDraw options object, refilled per draw (no per-frame literals). */
  private spriteOpts(scale: number, offsetX = 0, offsetY = 0, flash = false): SpriteDraw {
    const o = this.spriteDraw;
    o.scale = scale; o.offsetX = offsetX; o.offsetY = offsetY; o.flash = flash; o.mirror = false;
    return o;
  }
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
  /** Full on desktop; lite on phones (render-budget.ts): a lower backing-store cap and no shadowBlur glows. */
  private readonly budget: RenderBudget;
  /** A shadowBlur radius under the render budget: as given on desktop, 0 on a phone. */
  private blur(radius: number): number { return this.budget.glows ? radius : 0; }
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
  /**
   * The i18n key (play.delve.*, play.hud.*) and vars of a message, valid only while
   * `message` is still the English it was set with: any other assignment to
   * `message` silently retires it, so a stale key can never mask a new line.
   * `vars.item` is a placeable id the HUD turns into a translated name.
   */
  private keyed: { en: string; key: string; vars?: Record<string, string | number> } | null = { en: this.message, key: 'play.hud.obj.start' };
  private say(key: string, en: string, vars?: Record<string, string | number>): void {
    this.message = en;
    this.keyed = { en, key, ...(vars ? { vars } : {}) };
  }
  // ── Homestead hook (homestead-render.ts owns the drawing; this is the whole seam) ──
  private homestead: HomesteadView | null = null;
  private readonly homesteadFrame: HomesteadFrame = { areaId: '', camera: 0, viewport: 0, time: 0, playerX: 0, reduced: false, art: (key, x, y, w, h) => this.art(key, x, y, w, h) };
  /** Plug in (or remove) the Homestead's view: drawn each frame, may paint stations and take interactions. */
  setHomesteadView(view: HomesteadView | null): void { this.homestead = view; }
  /**
   * The current area's diggable terrain, or null outside a delve. Generated
   * from the player's seed with their saved diff laid over it (see `delve`);
   * without a save, dug state lives for this engine session.
   */
  private terrain: Terrain | null = null;
  /** Glim, the Keeper's companion and the Delve's lantern (glim-sprite.ts). Drawn once met. */
  private readonly glim = new GlimSprite();
  private readonly terrains = new Map<string, Terrain>();
  /** `terrainLayout()` each cached terrain was generated under: the key its diff is saved by. */
  private readonly layouts = new Map<string, string>();
  private delve: DelvePersistence | null = null;
  private readonly terrainRenderer = new TerrainRenderer();
  private readonly motes = new AmbientMotes();
  private readonly halos = new GlowHalos();
  /** The carved wall, chest or camp within reach, as a cell index (-1 = none). Refreshed in the fixed step. */
  private interactAt = -1;
  private readonly darkness = new DarknessLayer();
  /** How far light reaches into the rock, per cell; rebuilt only when a cell changes. */
  private readonly rockShade = new RockShade();
  /** The distant cave behind the generated caverns (two parallax layers per biome). */
  private readonly caveBackdrop = new CaveBackdrop(url => this.urlImage(url));
  /** Imported W8 parallax layers for towns and hunting grounds (none until commissioned). */
  private readonly parallax = new ParallaxBackdrop(url => this.urlImage(url));
  /** The town ground as pixel art, per realm. */
  private readonly ground = new GroundStrip();
  private readonly lightPool = new LightPool(96);
  /** Lava surfaces in view this frame: extra light-grid sources, never one of the capped slots. */
  private readonly lavaPool = new LightPool(64);
  /** Liquids per delve area (with its terrain), and the current one. */
  private liquid: LiquidSim | null = null;
  private readonly sims = new Map<string, LiquidSim>();
  /** `liquidLayout()` each area's liquid diff is saved under. */
  private readonly liquidLayouts = new Map<string, string>();
  /** Breath left (s) and its most; lava's after-burn (s); the Ember Elixir's ward (s, game time). */
  private breath = BREATH;
  private breathMax = BREATH;
  private burning = 0;
  private lavaWard = 0;
  /** What the Keeper's body is in (LIQUID_*), and whether the head is under. Refreshed each fixed step. */
  private immersed = 0;
  private headUnder = false;
  /** Wooden placed things lava is charring: cell index → seconds left (negative: the host refused, it holds). */
  private readonly chars = new Map<number, number>();
  /** Fishing: the rod (setFishing), the line in the water, and Use held (auto-fish). */
  private rod: { tier: number; liquids: readonly LiquidKind[]; bite: number } = { tier: 0, liquids: [], bite: 1 };
  private line: { phase: FishingPhase; liquid: number; biome: string; col: number; row: number; timer: number; bobX: number; bobY: number; castId: string } | null = null;
  private useHeld = false;
  private castSeq = 0;
  /** Seconds until an auto-fish recast. */
  private recast = 0;
  private readonly debris = new Debris();
  /** Glinting cells this frame (indices), drawn over the darkness. */
  private readonly glints = new Int32Array(64);
  private glintCount = 0;
  /** Exposed glowing cells in view this frame (indices), for their coloured halos. */
  private readonly halosAt = new Int32Array(32);
  private readonly hitScratch = new Int32Array(160);
  /** Cells one charge clears (CHARGE_RADIUS 2.3 reaches 21). */
  private readonly blastScratch = new Int32Array(32);
  private tools: ToolTiers = {};
  /** Seconds per digging/gathering swing, by tool (setTools({ swing })). Combat swings stay BASE_SWING. */
  private swing: Partial<Record<ToolKind, number>> = {};
  /** Damage multiplier per tool from the wielding skill's level (setTools({ power })); 1 when absent. */
  private power: Partial<Record<ToolKind, number>> = {};
  /** The tool the last hitCell worked with, so the swing takes that tool's pace. */
  private swingTool: ToolKind | null = null;
  /** The current area's gathering nodes, and every visited area's (regrowth timers keep running per session). */
  private sites: GatherSite[] = [];
  private readonly siteCache = new Map<string, GatherSite[]>();
  /** Saved harvest times (null: session only), and the wall clock regrowth is measured against. */
  private gathering: GatherPersistence | null = null;
  private clock: () => number = () => Date.now();
  private lanternRadius = DEFAULT_LANTERN;
  private skillLevels: Partial<Record<DisciplineId, number>> | null = null;
  /** True while the Keeper is on a ladder (set in the fixed step): Up climbs instead of jumping. */
  private climbing = false;
  /** Forgiving jumps: seconds a jump press waits for the ground, and seconds since the Keeper last stood on it. */
  private jumpBuffer = 0;
  private airTime = 0;
  /** Down + Jump on a platform: seconds one-way floors are ignored. */
  private dropTime = 0;
  /** Explored cells per delve area (the map's fog of war), from the save or fresh, and the live one. */
  private readonly fogs = new Map<string, Uint8Array>();
  private fog: Uint8Array | null = null;
  /** The cell the map was last revealed round: it only grows when the Keeper moves a cell. */
  private fogAt = NaN;
  /**
   * Smart cursor (Terraria): the aimed point as world px from the camera, so it
   * stays under the pointer while the camera moves. NaN = nothing aimed.
   */
  private aimVX = NaN;
  private aimVY = NaN;
  private readonly aimScratch = { col: 0, row: 0, index: 0, inReach: false };
  /** A held press: dig the aimed cell at the tool's pace, or place along the drag. Null = not held. */
  private holdMode: 'dig' | 'place' | null = null;
  /** Things the current hold did (a swing, a placement, a take-back). */
  private holdActs = 0;
  private placeWait = 0;
  /** Cells a drag crossed, placed in order, one per PLACE_PACE. */
  private dragQueue: number[] = [];
  private dragLast = -1;
  /** Vertical camera, world px. 0 outside delves. */
  private cameraY = 0;
  private blastTime = 0;
  private blastCooldown = 0;
  /** The blast's afterglow lighting the delve, 1 → 0. */
  private blastFlash = 0;
  private readonly blastAt = { x: 0, y: 0, dx: 1, dy: 0, range: 0 };
  /** When the last "clang" was shown: one per beat, not one per cell. */
  private clangAt = -1;
  /** Lit blasting charges: cell index and seconds left. Session only (a reloaded charge is an unlit one). */
  private fuses: { index: number; left: number }[] = [];
  /** Loose rock coming down: a short groan (`wait`, dust only), then a fall that hurts on the Keeper. Pooled. */
  private readonly rubble = Array.from({ length: 6 }, () => ({ active: false, x: 0, y: 0, vy: 0, wait: 0, color: '' }));
  /** Next loose-rock dust trickle, and whether this session has named the danger yet. */
  private dustAt = 0;
  private looseHinted = false;
  private get stations(): readonly StationDef[] { return this.areaDef.stations; }
  /** Draw scale of figures in this area (delves draw the Keeper at half size). */
  private get figure(): number { return this.areaDef.figureScale ?? 1; }
  private get isTown(): boolean { return this.areaDef === this.town; }
  /** Once-per-player flags set this session (a felled guardian); the save holds them across sessions. */
  private readonly flags = new Set<string>();
  /** True when a once-per-player flag is set, this session or in the player's save. */
  flagged(id: string): boolean {
    if (this.flags.has(id)) return true;
    try { return !!this.delve?.isClaimed?.(id); } catch { return false; }
  }
  private setFlag(id: string): void {
    this.flags.add(id);
    try { this.delve?.claim?.(id); } catch { /* still set for this session */ }
  }
  private createMonsters(): Monster[] {
    const monsters: Monster[] = [];
    for (const def of this.areaDef.monsters) {
      // A guardian this player has already felled stays down; a summoned one waits to be called.
      if (def.once && this.flagged(def.once)) continue;
      if (def.summoned) continue;
      for (const x of def.spawnXs) {
        monsters.push({ def, maxHp: def.hp, x, spawn: x, hp: def.hp, phase: 'idle', timer: 1, facing: -1, respawn: 0, flash: 0, knock: 0, dying: 0, born: 0, shownHp: def.hp, recoil: 0 });
      }
    }
    return monsters;
  }
  private enter(area: AreaDef): void {
    this.areaDef = area; this.sceneKey = `scene:${area.background}`; this.monsters = this.createMonsters(); this.drops = [];
    this.terrain = this.terrainFor(area); this.terrainRenderer.attach(this.terrain); this.cameraY = 0;
    this.liquid = this.terrain ? this.sims.get(area.id) ?? null : null;
    this.chars.clear(); this.line = null; this.recast = 0;
    this.breath = this.breathMax; this.burning = 0; this.immersed = 0; this.headUnder = false;
    this.fog = this.terrain ? this.fogs.get(area.id) ?? null : null; this.fogAt = NaN;
    this.holdMode = null; this.clearAim(); this.dropTime = 0; this.jumpBuffer = 0;
    this.blastTime = 0; this.blastFlash = 0; this.interactAt = -1;
    this.fuses = [];
    for (const r of this.rubble) r.active = false;
    this.sites = this.sitesFor(area);
    this.motes.reset();
    this.life.enter(area, this.town);
  }
  /** An area's gathering nodes, created on the first visit (harvest times from the save) and kept for the session. */
  private sitesFor(area: AreaDef): GatherSite[] {
    if (!area.nodes?.length) return [];
    let sites = this.siteCache.get(area.id);
    if (!sites) {
      const now = this.clock();
      sites = area.nodes.map(def => this.refreshSite({ def, hp: def.hp, at: this.savedHarvest(area.id, def.id), ready: true, timer: 0, gen: 0, shake: 0 }, now));
      this.siteCache.set(area.id, sites);
    }
    return sites;
  }
  private savedHarvest(areaId: string, nodeId: string): number | null {
    try { return this.gathering?.harvestedAt(areaId, nodeId) ?? null; } catch { return null; }
  }
  /** Derive `ready`/`timer` from the harvest time. A node that comes back is whole again. */
  private refreshSite(site: GatherSite, now: number): GatherSite {
    const left = regrowSecondsLeft(site.at, site.def.respawn, now);
    if (left <= 0 && !site.ready) site.hp = site.def.hp;
    site.ready = left <= 0; site.timer = left;
    return site;
  }
  /**
   * Plug in (or replace) where gathering harvest times are saved. Every node
   * already seen this session re-reads its time (cloud save merged another
   * device's harvests in); the later of the saved and the in-memory one wins.
   */
  setGathering(gathering: GatherPersistence | null): void {
    this.gathering = gathering;
    const now = this.clock();
    for (const [areaId, sites] of this.siteCache) for (const site of sites) {
      const saved = this.savedHarvest(areaId, site.def.id);
      if (saved !== null && (site.at === null || saved > site.at)) site.at = saved;
      this.refreshSite(site, now);
    }
  }
  /** The area's terrain: cached for the session, else generated from the player's seed with their diff applied. */
  private terrainFor(area: AreaDef): Terrain | null {
    const spec = area.terrain;
    if (!spec) return null;
    const cached = this.terrains.get(area.id);
    if (cached) return cached;
    let seed = spec.seed;
    try {
      const own = this.delve?.seed(area.id);
      if (Number.isInteger(own)) seed = (own as number) >>> 0;
    } catch { /* a broken save falls back to the shared seed */ }
    const terrain = generateTerrain(spec, seed);
    const layout = terrainLayout(spec, seed);
    try {
      const cells = this.delve?.cells(area.id, layout);
      if (cells) applyTerrainDiff(terrain, cells);
    } catch { /* an unreadable diff is fresh rock, not a crash */ }
    this.terrains.set(area.id, terrain);
    this.layouts.set(area.id, layout);
    // Liquids: the lakes as generated, then the player's settled liquid over them (only where open now).
    const wet = liquidLayout(spec, seed);
    try {
      const liquids = this.delve?.liquids?.(area.id, wet);
      if (liquids) applyLiquidDiff(terrain, liquids);
    } catch { /* an unreadable liquid save is the lakes as generated */ }
    this.liquidLayouts.set(area.id, wet);
    const sim = new LiquidSim(terrain, {
      canSet: index => this.terrain !== terrain || !this.bodyIn(terrain, index),
      reacted: (index, made) => this.reacted(terrain, area.id, index, made),
      char: index => { if (this.terrain === terrain && !this.chars.has(index)) this.chars.set(index, CHAR_TIME); },
    });
    // Anything dug since the liquid last settled: let it find the new space.
    sim.wakeAll();
    this.sims.set(area.id, sim);
    let fog: Uint8Array | null = null;
    try { fog = this.delve?.seenCells?.(area.id, layout, terrain.kind.length) ?? null; } catch { /* an unreadable map is unexplored, not a crash */ }
    this.fogs.set(area.id, fog && fog.length === (terrain.kind.length + 7) >> 3 ? fog : createFog(terrain.kind.length));
    return terrain;
  }
  /**
   * Plug in (or replace) where per-player delves come from. Cached terrains
   * are dropped so the next entry regenerates from the save; a delve the
   * Keeper stands in is rebuilt now (cloud save adopted another device's dig).
   */
  setDelve(delve: DelvePersistence | null): void {
    this.delve = delve;
    this.terrains.clear(); this.layouts.clear(); this.fogs.clear(); this.sims.clear(); this.liquidLayouts.clear();
    if (this.areaDef?.terrain) {
      this.terrain = this.terrainFor(this.areaDef);
      this.liquid = this.sims.get(this.areaDef.id) ?? null; this.chars.clear(); this.line = null;
      this.fog = this.fogs.get(this.areaDef.id) ?? null; this.fogAt = NaN;
      this.terrainRenderer.attach(this.terrain);
      // A Keeper the new rock now buries is lifted to the surface ledge.
      if (this.terrain && boxHits(this.terrain, this.player.x, this.player.y, DELVE_BOX)) {
        this.cancelMove();
        this.player.x = this.areaDef.spawnX; this.player.y = FLOOR; this.player.vy = 0; this.player.grounded = true;
      }
    }
  }
  /** Tell the save about a cell that changed, as a diff against what was generated. */
  private recordCell(t: Terrain, index: number): void {
    // Any changed cell lets the liquid round it move (a dug wall, a placed block).
    const sim = this.terrain === t ? this.liquid : null;
    if (sim) { const col = index % t.cols; sim.wakeAround(col, (index - col) / t.cols); }
    if (!this.delve) return;
    const layout = this.layouts.get(this.areaDef.id);
    if (!layout) return;
    try { this.delve.changed(this.areaDef.id, layout, index, t.kind[index] === t.base[index] ? null : t.kind[index]); } catch { /* the dig still stands this session */ }
  }
  // ── Building ─────────────────────────────────────────────────────────────

  /** The hotbar's choice: what B (or a long-press) places. */
  private placing: PlaceableId | BucketId | null = null;
  /** Bumped per placement: makes each placement's mutation id, and a re-dig of a placed cell, unique. */
  private placeSeq = 0;
  /** Cell index → the placement that filled it this session, so its re-dig is a new grant. */
  private readonly placedGen = new Map<number, number>();
  /** Choose what to place (the hotbar). Unknown ids clear it. */
  setPlaceable(id: PlaceableId | BucketId | string | null): void { this.placing = isBucket(id) ? id : placeableById(id)?.id ?? null; }
  get placeable(): PlaceableId | BucketId | null { return this.placing; }
  /**
   * B: place the chosen thing in front of the Keeper (below, holding Down).
   * See `placeTarget` for which cell. False, with a plain message, when it
   * cannot go anywhere.
   */
  place(): boolean {
    const t = this.terrain;
    if (!t || this.paused || this.hp <= 0) return false;
    if (isBucket(this.placing)) return this.useBucket(this.placing, this.bucketTarget(t, this.placing === 'seam-bucket'));
    const def = placeableById(this.placing);
    if (!def) { this.say('play.delve.chooseFirst', 'Choose something to place first (keys 1-0, or tap the bar).'); this.report(); return false; }
    const down = this.input.has('down');
    const index = placeTarget(t, this.player.x, this.player.y, this.facing, down, DELVE_BOX, def.aim);
    if (index < 0) { this.say(down ? 'play.delve.noSpaceBelow' : 'play.delve.noSpaceAhead', `No open space ${down ? 'under your feet' : 'in front of you'} for the ${def.label.toLowerCase()}.`, { item: def.id }); this.report(); return false; }
    return this.placeItem(def, index);
  }
  /**
   * A long-press (or right-click) on a cell within reach: place the chosen
   * thing there, or take back the placed thing already there.
   */
  placeAtClient(clientX: number, clientY: number): boolean {
    const t = this.terrain;
    if (!t || this.paused || this.hp <= 0) return false;
    const point = this.pick(clientX, clientY);
    const col = t.colAt(point.x), row = t.rowAt(point.y);
    if (!t.inside(col, row) || !this.inReach(col, row)) return false;
    if (isBucket(this.placing)) return this.useBucket(this.placing, t.index(col, row));
    if (isTakeable(t, col, row)) return this.takeItem(t.index(col, row));
    const def = placeableById(this.placing);
    if (!def) { this.say('play.delve.chooseFirst', 'Choose something to place first (keys 1-0, or tap the bar).'); this.report(); return false; }
    return this.placeItem(def, t.index(col, row));
  }
  /** True when a cell's centre is within a swing of the Keeper's chest. */
  private inReach(col: number, row: number): boolean {
    const t = this.terrain;
    if (!t) return false;
    const cx = (col + .5) * CELL, cy = t.top + (row + .5) * CELL;
    return Math.hypot(cx - this.player.x, cy - (this.player.y - DELVE_BOX.height * .5)) <= DELVE_REACH;
  }
  /** Why `node` cannot go into a cell right now, or null. */
  private placeProblem(t: Terrain, col: number, row: number, node: TerrainNodeDef, def?: PlaceableDef): PlaceProblem | null {
    if (!t.inside(col, row) || row < 0) return { key: 'play.delve.outside', en: 'That is outside the Delve.' };
    if (!isAir(t, col, row)) return { key: 'play.delve.occupied', en: 'Something is already there.' };
    if (def?.grounded && !t.solid(col, row + 1) && !isOneWay(t, col, row + 1)) return { key: 'play.delve.needsGround', en: `The ${def.label.toLowerCase()} needs solid ground under it.`, vars: { item: def.id } };
    if (t.liquidAt(col, row) === LIQUID_LAVA && WOODEN_IDS.includes(node.id)) return { key: 'play.delve.liquid.tooHot', en: 'Too hot: that would char in the lava.' };
    if (def?.single && findNode(t, def.node) >= 0) return { key: 'play.delve.single', en: `You already have a ${def.label.toLowerCase()} in the Delve. Take it back first (X beside it).`, vars: { item: def.id } };
    if (!node.solid) return null;
    const x0 = col * CELL, y0 = t.top + row * CELL;
    const overlaps = (x: number, feet: number, halfWidth: number, height: number) =>
      x + halfWidth > x0 && x - halfWidth < x0 + CELL && feet > y0 && feet - height < y0 + CELL;
    if (overlaps(this.player.x, this.player.y, DELVE_BOX.halfWidth, DELVE_BOX.height)) return { key: 'play.delve.standing', en: 'You are standing there.' };
    for (const monster of this.monsters) {
      if (monster.hp > 0 && overlaps(monster.x, monster.def.floorY ?? FLOOR, 30 * this.figure, 110 * this.figure)) return { key: 'play.delve.creatureInWay', en: 'A creature is in the way.' };
    }
    return null;
  }
  /** Ask the host for one `def` from the satchel, then fill the cell and save it. */
  private placeItem(def: PlaceableDef, index: number): boolean {
    const t = this.terrain;
    if (!t) return false;
    const col = index % t.cols, row = (index - col) / t.cols;
    const node = TERRAIN_NODES[def.node];
    const problem: PlaceProblem | null = node ? this.placeProblem(t, col, row, node, def) : { key: 'play.delve.cannotPlace', en: 'That cannot be placed.' };
    if (problem) { this.say(problem.key, problem.en, problem.vars); this.report(); return false; }
    // A charge is lit from a staff: none, and nothing leaves the satchel.
    if (node!.charge && !(this.tools.staff ?? 0)) {
      this.say('play.delve.needStaff', 'You need a staff to light the fuse (Staff I or better).'); this.report(); return false;
    }
    const gen = ++this.placeSeq;
    const accepted = this.options.onPlace?.({
      item: def.id, areaId: this.areaDef.id, cellKey: cellKey(col, row), index,
      mutationId: `delve-place:${this.lootSession}:${this.areaDef.id}:${cellKey(col, row)}:${gen}`,
    });
    // Refused: the host already said why (none left, the save failed).
    if (accepted === false) { this.report(); return false; }
    this.fill(t, col, row, node!, gen);
    if (node!.charge) {
      this.fuses.push({ index, left: CHARGE_FUSE });
      this.say('play.delve.fuseLit', 'Fuse lit! Stand back. (X beside it pinches the fuse out.)');
      this.report();
      return true;
    }
    if (node!.support) this.say('play.delve.supportPlaced', `${def.label} placed. Loose rock within ${node!.support} cells of it holds.`, { item: def.id, n: node!.support });
    else this.say('play.delve.placed', `${def.label} placed.`, { item: def.id });
    this.report();
    return true;
  }
  /** X: take back the placed thing beside the Keeper (or where they stand). */
  takeBack(): boolean {
    const t = this.terrain;
    if (!t || this.paused || this.hp <= 0) return false;
    // The same reach as E: the cell the prompt names wins, so "Open the chest" and X agree.
    const index = takeTarget(t, this.player.x, this.player.y, this.facing, DELVE_BOX, this.findInteractive());
    if (index < 0) { this.say('play.delve.nothingToTake', 'Nothing placed here to take back. Blocks are dug, like rock.'); this.report(); return false; }
    return this.takeItem(index);
  }
  /** Ask the host to return the placed thing to the satchel, then clear the cell. */
  private takeItem(index: number): boolean {
    const t = this.terrain;
    if (!t) return false;
    const col = index % t.cols, row = (index - col) / t.cols;
    const node = t.nodeAt(col, row);
    const def = placeableById(node.placeable);
    if (!def || node.solid) return false;
    const accepted = this.options.onTakeBack?.({
      item: def.id, areaId: this.areaDef.id, cellKey: cellKey(col, row), index,
      mutationId: `delve-take:${this.lootSession}:${this.areaDef.id}:${cellKey(col, row)}:${++this.placeSeq}`,
    });
    if (accepted === false) { this.report(); return false; }
    t.set(col, row, 0);
    this.placedGen.delete(index);
    this.recordCell(t, index);
    this.debris.chip((col + .5) * CELL, t.top + (row + .5) * CELL, node.fleck, this.reducedMotion ? 2 : 4);
    const lit = this.fuses.some(fuse => fuse.index === index);
    if (lit) this.fuses = this.fuses.filter(fuse => fuse.index !== index);
    if (lit) this.say('play.delve.fusePinched', 'You pinch the fuse out. The charge is back in the satchel.');
    else this.say('play.delve.takenBack', `${def.label} back in the satchel.`, { item: def.id });
    this.report();
    return true;
  }
  /** The town's way into its delve (a passage station to an area with terrain), or null. */
  private delveEntrance(): { station: StationDef; area: AreaDef } | null {
    for (const station of this.town.stations) {
      const area = station.kind === 'passage' && station.to ? areaOf(this.town, station.to) : undefined;
      if (area?.terrain) return { station, area };
    }
    return null;
  }
  /** True when this town's delve holds the player's camp (generates that delve once if it has not been yet). */
  hasDelveCamp(): boolean {
    const entrance = this.delveEntrance();
    const t = entrance ? this.terrainFor(entrance.area) : null;
    return !!t && findNode(t, 'camp') >= 0;
  }
  /**
   * "Descend to your camp": from town, straight to the camp placed in this
   * town's delve, standing beside it. False (nothing moves) when there is no
   * camp, or the cells round it have been filled so the Keeper would not fit.
   */
  descendToCamp(): boolean {
    if (this.paused || this.hp <= 0 || !this.isTown) return false;
    const entrance = this.delveEntrance();
    const t = entrance ? this.terrainFor(entrance.area) : null;
    const index = t ? findNode(t, 'camp') : -1;
    if (!entrance || !t || index < 0) return false;
    const col = index % t.cols, row = (index - col) / t.cols;
    const x = (col + .5) * CELL, feet = t.top + (row + 1) * CELL;
    if (boxHits(t, x, feet, DELVE_BOX)) {
      this.say('play.delve.campBlocked', 'Something fills the space round your camp. Take the Delve shaft and dig your way down.');
      this.report();
      return false;
    }
    this.enter(entrance.area);
    this.resetPosition(x);
    this.player.y = feet;
    this.say('play.delve.campArrive', 'You climb down the ropes to your camp. The fire is still warm.');
    this.report();
    return true;
  }
  /** The node id at a cell of an area the engine has loaded, or null (another area, not generated yet). */
  nodeIdAt(areaId: string, index: number): string | null {
    const t = this.terrains.get(areaId);
    if (!t || index < 0 || index >= t.kind.length) return null;
    return TERRAIN_NODE_LIST[t.kind[index]].id;
  }
  private fill(t: Terrain, col: number, row: number, node: TerrainNodeDef, gen: number): void {
    const index = t.index(col, row);
    t.set(col, row, nodeIndex(node.id));
    this.placedGen.set(index, gen);
    this.recordCell(t, index);
    this.debris.chip((col + .5) * CELL, t.top + (row + .5) * CELL, node.fleck, this.reducedMotion ? 2 : 5);
  }
  /**
   * Put a node into an open cell and save it, with no satchel cost (the
   * persistence seam; tests and tools). Refuses (false) outside a delve, off
   * the grid, into anything but open air, onto a carved wall, or a solid
   * block into the Keeper or a living creature.
   */
  placeCell(col: number, row: number, nodeId: string): boolean {
    const t = this.terrain;
    const node = TERRAIN_NODES[nodeId];
    if (!t || !node || !Number.isFinite(node.hp) || (!node.solid && !node.placeable) || this.placeProblem(t, col, row, node)) return false;
    this.fill(t, col, row, node, ++this.placeSeq);
    return true;
  }
  private resetPosition(x: number): void {
    this.cancelMove();
    this.player.x = x; this.player.y = FLOOR; this.player.vy = 0; this.player.grounded = true;
    this.hp = this.maxHp; this.hurtTime = 1.5; this.attackTime = 0; this.attackCooldown = 0;
    this.dodgeTime = 0; this.dodgeCooldown = 0; this.complete = false; this.setPaused(false);
  }
  returnToCamp(): void {
    this.enter(this.town);
    this.resetPosition(this.town.spawnX); this.say('play.hud.eng.backAtCamp', 'Back at camp. Your equipment and collected loot are safe.'); this.report();
  }
  restartHunt(): void {
    this.monsters = this.createMonsters(); this.drops = []; this.resetPosition(this.areaDef.spawnX);
    this.say('play.hud.eng.freshHunt', 'A fresh hunt begins. Monsters respawn after defeat; collect their drops.'); this.report();
  }
  constructor(private readonly canvas: HTMLCanvasElement, private readonly options: EngineOptions) {
    this.budget = renderBudget({ coarse: coarseDevice(window) }, options.lite);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser does not support Canvas 2D.');
    this.context = context;
    this.town = options.town ?? INFERNAL_TOWN;
    this.satchelTarget = options.satchelTarget ?? null;
    this.delve = options.delve ?? null;
    this.gathering = options.gathering ?? null;
    if (options.now) this.clock = options.now;
    this.enter(this.town);
    for (const [key, url] of Object.entries(options.assets)) {
      const image = new Image(); image.src = url; this.images[key] = image;
    }
    // A parked loop (a place covers the world) still repaints once at the new size: resizing clears the canvas.
    this.observer = new ResizeObserver(() => { this.resize(); if (this.started && this.frame === null && !this.destroyed) this.render(); });
    this.observer.observe(canvas);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.clearInput);
    document.addEventListener('visibilitychange', this.visibilityChanged);
    this.resize();
  }
  start(): void {
    if (this.frame === null && !this.destroyed) {
      this.started = true;
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
  /**
   * The Keeper's tools, by tier (0 or absent = none), and the lantern:
   *
   *   setTools({ pickaxe?, axe?, sickle?, blade?, staff?, lanternRadius?, levels? })
   *
   * A swing works a terrain cell with the best of pickaxe/axe/sickle/blade that
   * meets the cell's minimum tier; the staff works only through its blast (L).
   * The lantern: `lanternTiles` is the Skills unit (toolTiers().lanternRadius,
   * which grows with Delving), one tile = one CELL; `lanternRadius` is the
   * same reach in world px, for callers that already have px. Tiles win when
   * both are given. Default DEFAULT_LANTERN (7 tiles). `levels` (optional)
   * are skill levels by discipline: a cell or gathering node with a higher
   * `minLevel` clangs before the host is asked, instead of cracking all the
   * way and being refused.
   */
  setTools(tools: ToolTiers & { lanternTiles?: number; lanternRadius?: number; levels?: Partial<Record<DisciplineId, number>>; swing?: Partial<Record<ToolKind, number>>; power?: Partial<Record<ToolKind, number>> }): void {
    const next: ToolTiers = {};
    const swing: Partial<Record<ToolKind, number>> = {};
    const power: Partial<Record<ToolKind, number>> = {};
    for (const tool of ['pickaxe', 'axe', 'sickle', 'blade', 'staff'] as ToolKind[]) {
      const tier = tools[tool];
      if (Number.isFinite(tier) && (tier as number) > 0) next[tool] = Math.floor(tier as number);
      const pace = tools.swing?.[tool];
      if (Number.isFinite(pace) && (pace as number) > 0) swing[tool] = Math.min(BASE_SWING, Math.max(MIN_SWING, pace as number));
      const boost = tools.power?.[tool];
      if (Number.isFinite(boost) && (boost as number) > 0) power[tool] = Math.min(MAX_POWER, Math.max(1, boost as number));
    }
    this.tools = next;
    this.swing = swing;
    this.power = power;
    if (Number.isFinite(tools.lanternTiles) && (tools.lanternTiles as number) > 0) this.lanternRadius = (tools.lanternTiles as number) * CELL;
    else if (Number.isFinite(tools.lanternRadius) && (tools.lanternRadius as number) > 0) this.lanternRadius = tools.lanternRadius as number;
    if (tools.levels) this.skillLevels = { ...tools.levels };
  }
  /**
   * Delves: a click or tap on a solid cell within reach of the Keeper swings
   * at it. Returns false when there was nothing to swing at (the host walks
   * there instead).
   */
  strikeAt(clientX: number, clientY: number): boolean {
    if (this.paused || this.hp <= 0) return false;
    if (!this.terrain) return this.sites.length ? this.strikeSite(this.pick(clientX, clientY)) : false;
    const point = this.pick(clientX, clientY);
    return this.strikeCell(point.x, point.y);
  }
  /**
   * A click on a gathering node: work it when the Keeper is beside it, else
   * walk there and swing once on arrival. False when the click missed every node.
   */
  private strikeSite(point: { x: number; y: number }): boolean {
    let site: GatherSite | null = null;
    for (const s of this.sites) if (Math.abs(s.def.x - point.x) <= 46 && point.y > FLOOR - 150 && point.y < FLOOR + 30) { site = s; break; }
    if (!site) return false;
    const target = site;
    if (Math.abs(target.def.x - this.player.x) <= NODE_REACH && this.player.y > FLOOR - 120) {
      this.cancelMove();
      if (this.attackCooldown <= 0) this.workSite(target);
      this.report();
      return true;
    }
    const side = this.player.x < target.def.x ? -1 : 1;
    this.moveTo(target.def.x + side * 44, () => { if (this.attackCooldown <= 0) this.workSite(target); this.report(); });
    return true;
  }
  /** The gathering node the Keeper stands at (nearest within reach, on the floor), or null. */
  private siteInReach(): GatherSite | null {
    if (!this.sites.length || this.player.y < FLOOR - 120) return null;
    let best: GatherSite | null = null, bestDistance = NODE_REACH;
    for (const site of this.sites) {
      const d = Math.abs(site.def.x - this.player.x);
      if (d <= bestDistance) { best = site; bestDistance = d; }
    }
    return best;
  }
  /** What still stops the Keeper working a node ("Sickle II", "Foraging 6"), or null. */
  private siteNeed(def: GatherNodeDef): string | null {
    const check = toolFor(def, this.tools, SWING_TOOLS, this.power);
    if (!check.ok) return check.need ? toolName(check.need.tool, check.need.tier) : 'nothing';
    const level = def.minLevel && this.skillLevels ? this.skillLevels[def.discipline] : undefined;
    if (def.minLevel && level !== undefined && level < def.minLevel) return `${titleCase(SKILL_NAME[def.discipline] ?? def.discipline)} ${def.minLevel}`;
    return null;
  }
  /**
   * One swing at a gathering node: the Delve's rule (best swing tool that
   * meets the node's tier; 1 + (tier - min) / 2 per hit), then the skill
   * level, then the host books the break. A refusal leaves it standing on
   * its last crack; a harvest rests it for `respawn` seconds.
   */
  private workSite(site: GatherSite): void {
    const def = site.def;
    this.attackTime = .4; this.attackCooldown = BASE_SWING;
    if (Math.abs(def.x - this.player.x) > 6) this.facing = def.x > this.player.x ? 1 : -1;
    const top = FLOOR - (def.kind === 'wood' ? 120 : 50);
    if (!site.ready) {
      this.say('play.hud.eng.growingBack', `The ${def.label.toLowerCase()} is growing back (${Math.ceil(site.timer)}s).`, { lname: def.label.toLowerCase(), n: Math.ceil(site.timer) });
      return;
    }
    const check = toolFor(def, this.tools, SWING_TOOLS, this.power);
    const need = this.siteNeed(def);
    if (!check.ok || need) {
      this.debris.chip(def.x, top, '#ffe2a8', 6);
      this.clang(def.x, top, check.ok ? `Clang! Needs ${need}` : `Clang! Need ${need}`);
      return;
    }
    this.attackCooldown = this.swingFor(check.tool);
    site.shake = 1;
    const left = site.hp - check.damage;
    if (left > 1e-3) {
      site.hp = left;
      this.debris.chip(def.x, top, SITE_FLECK[def.kind], this.reducedMotion ? 2 : 5);
      this.impact(.025, 1.6);
      return;
    }
    let material: string | undefined;
    const pays = def.yield;
    if (pays.chance === undefined || pays.chance >= 1 || this.random() < pays.chance) material = pays.materialId;
    const accepted = this.options.onWorldAction?.({
      kind: TOOL_ACTION[check.tool], areaId: this.areaDef.id, cellKey: def.id, site: def.id,
      materialId: material, qty: material ? pays.qty : undefined, discipline: def.discipline, xp: def.xp,
      mutationId: `gather:${this.lootSession}:${this.areaDef.id}:${def.id}:${site.gen}`,
    });
    if (accepted === false) { site.hp = Math.min(site.hp, 1e-3); this.debris.chip(def.x, top, SITE_FLECK[def.kind], 3); return; }
    site.at = this.clock(); site.ready = false; site.timer = def.respawn; site.gen++; site.hp = def.hp;
    try { this.gathering?.harvested(this.areaDef.id, def.id, site.at); } catch { /* still resting for this session */ }
    for (let n = 0; n < (this.reducedMotion ? 4 : 10); n++) this.debris.chip(def.x + (n - 5) * 4, top, SITE_FLECK[def.kind], 1);
    this.impact(.05, 3);
    if (material) {
      this.atmosphere.burst(def.x, top - 16, `+${pays.qty} ${titleCase(material)}`);
      this.say('play.hud.eng.siteGathered', `${titleCase(material)} gathered from the ${def.label.toLowerCase()}. It grows back in ${def.respawn}s.`, { name: titleCase(material), lsite: def.label.toLowerCase(), n: def.respawn });
    } else this.say('play.hud.eng.siteNothing', `Nothing worth keeping on the ${def.label.toLowerCase()} this time. It grows back in ${def.respawn}s.`, { lsite: def.label.toLowerCase(), n: def.respawn });
  }
  /** Swing at the cell under a world point, if it is solid and in reach. */
  strikeCell(x: number, y: number): boolean {
    const t = this.terrain;
    if (!t || this.paused || this.hp <= 0) return false;
    const col = t.colAt(x), row = t.rowAt(y);
    if (!t.inside(col, row)) return false;
    const cx = (col + .5) * CELL, cy = t.top + (row + .5) * CELL;
    const inReach = Math.hypot(cx - this.player.x, cy - (this.player.y - DELVE_BOX.height * .5)) <= DELVE_REACH;
    // A tap on a carved wall, a chest or a camp within reach uses it.
    if (inReach && this.usable(t.index(col, row))) { this.cancelMove(); this.useCell(t.index(col, row)); this.report(); return true; }
    if (!t.solid(col, row) || !inReach) return false;
    this.cancelMove();
    if (this.attackCooldown > 0) return true;
    this.swingAtCell(t, col, row);
    this.report();
    return true;
  }
  /** One tool swing at one cell (reach and cooldown already checked): face it, work it, wait the tool's pace. */
  private swingAtCell(t: Terrain, col: number, row: number): void {
    const cx = (col + .5) * CELL;
    if (Math.abs(cx - this.player.x) > 6) this.facing = cx > this.player.x ? 1 : -1;
    this.attackTime = .4; this.attackCooldown = BASE_SWING;
    this.hitScratch[0] = t.index(col, row);
    this.swingTool = null;
    this.hitCells(1, SWING_TOOLS, false);
    this.attackCooldown = this.swingFor(this.swingTool);
  }

  // -- Delve: smart cursor and held use (Terraria) ---------------------------

  /** Aim the smart cursor at the cell under a client point (the mouse, or a finger). Delves only. */
  aimAt(clientX: number, clientY: number): void {
    if (!this.terrain) return;
    const point = this.pick(clientX, clientY);
    this.aimVX = point.x - this.camera; this.aimVY = point.y - this.cameraY;
    if (this.holdMode === 'place') this.queueDrag();
  }
  /** Nothing aimed (the pointer left, a finger lifted): the cursor hides. */
  clearAim(): void { this.aimVX = NaN; this.aimVY = NaN; }
  /** The aimed cell and whether it is within reach, or null. One shared object: read it at once. */
  aimCell(): { col: number; row: number; index: number; inReach: boolean } | null {
    const t = this.terrain;
    if (!t || !Number.isFinite(this.aimVX)) return null;
    const col = t.colAt(this.camera + this.aimVX), row = t.rowAt(this.cameraY + this.aimVY);
    if (!t.inside(col, row)) return null;
    const out = this.aimScratch;
    out.col = col; out.row = row; out.index = t.index(col, row); out.inReach = this.inReach(col, row);
    return out;
  }
  /**
   * A press held on the world: 'dig' swings at the aimed cell at the tool's
   * pace while it is held (never faster than a held J); 'place' puts the
   * hotbar's choice into the pressed cell and every cell the drag then
   * crosses, one per PLACE_PACE, while there are some left and each is in
   * reach. A 'place' press on a placed thing takes it back, once. Acts at
   * once when it can. `useRelease` ends it.
   */
  useHold(clientX: number, clientY: number, mode: 'dig' | 'place'): void {
    this.holdActs = 0; this.dragQueue = []; this.dragLast = -1; this.placeWait = 0; this.holdMode = null;
    const t = this.terrain;
    if (!t || this.paused || this.hp <= 0) return;
    this.aimAt(clientX, clientY);
    const aim = this.aimCell();
    if (!aim) return;
    this.holdMode = mode;
    if (mode === 'place' && isBucket(this.placing)) {
      // A bucket acts once, on the pressed cell: no drag.
      this.holdMode = null;
      if (aim.inReach && this.useBucket(this.placing, aim.index)) this.holdActs++;
      return;
    }
    if (mode === 'place') {
      if (aim.inReach && isTakeable(t, aim.col, aim.row)) {
        this.holdMode = null;
        if (this.takeItem(aim.index)) this.holdActs++;
        return;
      }
      this.queueDrag();
    }
    this.updateHold(0);
  }
  /** The press ended. Returns what it did, so the click that follows does not do it again. */
  useRelease(): number {
    const acts = this.holdActs;
    this.holdMode = null; this.holdActs = 0; this.dragQueue = []; this.dragLast = -1;
    return acts;
  }
  /** Queue the cells between the last dragged cell and the aimed one (a line, so a fast drag leaves no gaps). */
  private queueDrag(): void {
    const aim = this.aimCell(), t = this.terrain;
    if (!aim || !t || aim.index === this.dragLast) return;
    if (this.dragLast < 0) { this.dragQueue.push(aim.index); this.dragLast = aim.index; return; }
    let col = this.dragLast % t.cols, row = (this.dragLast - col) / t.cols;
    const dc = Math.abs(aim.col - col), dr = -Math.abs(aim.row - row), sc = col < aim.col ? 1 : -1, sr = row < aim.row ? 1 : -1;
    let err = dc + dr;
    while ((col !== aim.col || row !== aim.row) && this.dragQueue.length < 32) {
      const e2 = 2 * err;
      if (e2 >= dr) { err += dr; col += sc; }
      if (e2 <= dc) { err += dc; row += sr; }
      this.dragQueue.push(t.index(col, row));
    }
    this.dragLast = aim.index;
  }
  /** One fixed step of a held press. */
  private updateHold(dt: number): void {
    const t = this.terrain;
    if (!t || !this.holdMode || this.paused || this.hp <= 0) return;
    if (this.holdMode === 'dig') {
      const aim = this.aimCell();
      if (!aim || !aim.inReach || !t.solid(aim.col, aim.row) || this.attackCooldown > 0) return;
      this.cancelMove();
      this.swingAtCell(t, aim.col, aim.row);
      this.holdActs++;
      this.report();
      return;
    }
    this.placeWait -= dt;
    if (this.placeWait > 0) return;
    const def = placeableById(this.placing);
    const node = def ? TERRAIN_NODES[def.node] : undefined;
    while (this.dragQueue.length) {
      const index = this.dragQueue.shift()!;
      const col = index % t.cols, row = (index - col) / t.cols;
      if (!this.inReach(col, row)) continue;
      if (!def || !node) {
        this.say('play.delve.chooseFirst', 'Choose something to place first (keys 1-0, or tap the bar).'); this.report();
        this.holdMode = null; return;
      }
      // Only the pressed cell says why it cannot take the thing; cells a drag merely crosses are skipped quietly.
      if (this.holdActs > 0 && this.placeProblem(t, col, row, node, def)) continue;
      if (!this.placeItem(def, index)) {
        // A refusal from the satchel (none left, the save failed) ends the hold; a bad first cell only skips it.
        if (this.holdActs > 0 || !this.placeProblem(t, col, row, node, def)) { this.holdMode = null; return; }
        continue;
      }
      this.holdActs++;
      this.placeWait = PLACE_PACE;
      return;
    }
  }
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
      else this.peers.set(peer.id, { peer: snapshot, x: snapshot.x, y: snapshot.y, facing, motion: createKeeperMotion(), clock: createSpriteClock() });
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
  /**
   * Pause the world (an in-world place is open over it). A paused world draws
   * one more frame and then parks its loop: the place covers the canvas, so
   * drawing it sixty times a second behind an opaque panel only heats the
   * device. Unpausing resumes the loop.
   */
  setPaused(paused: boolean): void {
    this.paused = paused; this.input.clear(); this.accumulator = 0; if (paused) this.cancelMove(); this.report();
    if (!paused && this.started && this.frame === null && !this.destroyed) {
      this.previous = 0;
      this.frame = requestAnimationFrame(this.tick);
    }
  }
  /** True while the loop is parked behind a place (for tests and the HUD). */
  get parked(): boolean { return this.started && this.frame === null && !this.destroyed; }
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
  /**
   * The town keepers' lines follow the Keeper's story beats and station deeds
   * (world/keeper-lines.ts). The host calls this only when either changed.
   */
  setKeeperContext(context: KeeperContext): void { this.life.setContext(context); }
  /**
   * Glim (glim-sprite.ts). `shown` once the Keeper has met it; `arrive` flies it
   * in from above to the shoulder (the Prologue meeting, once).
   */
  setGlim(shown: boolean, arrive = false): void {
    if (shown && arrive) this.glim.arrive(this.player.x - 240, this.player.y - 460);
    this.glim.shown = shown;
  }
  /** Show me: Glim flies ahead to a station (or a floor x) and back. The x it flies to, or null. */
  glimShowMe(target: { station: string } | { x: number }): number | null {
    if (!this.glim.shown) return null;
    const x = 'station' in target ? this.stations.find(row => row.id === target.station)?.x : target.x;
    if (x === undefined || !Number.isFinite(x)) return null;
    this.glim.flyTo(x, this.terrain ? this.player.y - 150 : FLOOR - 170);
    return x;
  }
  /** Where Glim is, for the HUD's data attributes and the tell: world x, the Show me target, dimmed. */
  get glimView(): { shown: boolean; x: number; targetX: number | null; arrived: boolean; dimmed: boolean } {
    const g = this.glim;
    return { shown: g.shown, x: Math.round(g.x), targetX: g.targetX, arrived: g.arrived, dimmed: g.dim };
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
      cssWidth: this.width, cssHeight: this.height, camera: this.camera, cameraY: this.cameraY,
    });
    this.pointerX = point.x; this.pointerY = point.y;
    // A click on a keeper opens the station it keeps.
    return { x: point.x, y: point.y, station: stationAt(this.stations, point.x, point.y, FLOOR) ?? this.life.stationAt(point.x, point.y) };
  }
  /** Highlight a station (pointer hover). Render-only. */
  setHover(id: string | null): void { this.hovered = id; }
  retry(): void { this.restartHunt(); }
  setInput(action: EngineInput, pressed: boolean): void {
    if (!pressed) { this.input.delete(action); return; }
    if (this.paused || this.hp <= 0 || this.input.has(action)) return;
    // Reeling a hooked fish holds the Keeper: the keys belong to the reel (the host's Line Tension bar).
    if (this.line?.phase === 'hooked') return;
    this.input.add(action);
    if (action === 'left' || action === 'right') this.cancelMove();
    // Walking, jumping or swinging pulls the line out.
    if (this.line && action !== 'down' && action !== 'dodge') this.reelIn();
    if (action === 'jump') this.pressJump();
    if (action === 'attack' && this.attackCooldown <= 0) this.attack();
    if (action === 'blast') this.blast();
    if (action === 'dodge' && this.dodgeCooldown <= 0) { this.dodgeTime = .26; this.dodgeCooldown = 1.05; }
    this.report();
  }
  /**
   * Jump pressed. In a delve, Down + Jump on a platform drops through it, and
   * Up beside a ladder grabs it. Otherwise a jump: from the ground, within
   * COYOTE of walking off a ledge, or (buffered JUMP_BUFFER) on landing.
   */
  private pressJump(): void {
    const t = this.terrain;
    if (this.climbing) return;
    if (t && this.input.has('down') && this.player.grounded && isOneWay(t, t.colAt(this.player.x), t.rowAt(this.player.y + 1))) {
      this.dropTime = DROP_THROUGH; this.player.grounded = false;
      return;
    }
    if (t && this.grabLadder(t)) return;
    this.jumpBuffer = JUMP_BUFFER;
    this.tryJump();
  }
  private tryJump(): void {
    if (this.jumpBuffer <= 0 || this.climbing || (!this.player.grounded && this.airTime > COYOTE && !this.immersed)) return;
    if (this.line?.phase === 'hooked') return;
    // Swimming: a softer stroke (holding Jump keeps swimming up, see update).
    this.player.vy = this.immersed && !this.player.grounded ? -Math.max(-this.player.vy, 300) : this.terrain ? -520 : -680; this.player.grounded = false;
    // One jump per take-off: the coyote window closes with it.
    this.jumpBuffer = 0; this.airTime = COYOTE + 1;
  }
  /** Up at a ladder the body overlaps but is not centred on: step onto it so the climb starts. True when grabbed. */
  private grabLadder(t: Terrain): boolean {
    const p = this.player, mid = t.rowAt(p.y - DELVE_BOX.height * .5), feet = t.rowAt(p.y - .01);
    for (const x of [p.x - DELVE_BOX.halfWidth, p.x + DELVE_BOX.halfWidth - .01]) {
      const col = t.colAt(x);
      if (!isClimbable(t, col, mid) && !isClimbable(t, col, feet)) continue;
      const cx = (col + .5) * CELL;
      if (boxHits(t, cx, p.y, DELVE_BOX)) continue;
      p.x = cx; p.vy = 0; this.climbing = true; this.cancelMove();
      return true;
    }
    return false;
  }
  /** Seconds until the next swing after working with `tool` (a forged tool swings faster). */
  private swingFor(tool: ToolKind | null): number { return (tool && this.swing[tool]) || BASE_SWING; }
  /** One swing: monsters in reach take the hit; in a delve, a swing at nothing living works the rock instead. */
  private attack(): void {
    this.attackTime = .4; this.attackCooldown = BASE_SWING;
    let struck = false;
    const k = this.figure;
    for (const monster of this.monsters) {
      if (monster.hp <= 0 || !meleeHits(this.player, monster.x, this.facing, monster.def.floorY ?? FLOOR, k)) continue;
      this.hurtMonster(monster, this.damage ?? (this.equipped ? 20 : 10));
      struck = true;
    }
    if (!struck && this.terrain) {
      this.swingTool = null;
      this.hitCells(this.swingTargets(), SWING_TOOLS, false);
      this.attackCooldown = this.swingFor(this.swingTool);
    } else if (!struck) { const site = this.siteInReach(); if (site) this.workSite(site); }
  }
  private hurtMonster(monster: Monster, damage: number): void {
    const floor = monster.def.floorY ?? FLOOR;
    if (monster.def.veiled && !this.exposed(monster)) {
      monster.flash = .08;
      this.clang(monster.x, floor - 60 * this.figure, 'Its light swallows the blow. Light a torch beside it');
      return;
    }
    this.atmosphere.burst(monster.x, floor - 85 * this.figure, String(damage));
    monster.hp = Math.max(0, monster.hp - damage);
    monster.flash = .14; monster.recoil = 1;
    this.impact(monster.hp === 0 ? .09 : .055, monster.hp === 0 ? 7 : 3);
    if (!this.reducedMotion) monster.knock = Math.sign(monster.x - this.player.x || this.facing) * 22 * this.figure;
    if (monster.hp === 0) {
      monster.dying = DEATH_FADE;
      monster.respawn = 8; this.kills++; this.guardianDefeated = true;
      this.spill(monster);
      this.options.onKill?.({ id: `${this.lootSession}:${this.kills}`, areaId: this.areaDef.id, creature: monster.def.creature, name: monster.def.name, hp: monster.maxHp });
      if (monster.def.once) {
        // Felled for good: saved per player, never respawns, and what it guarded opens.
        monster.respawn = Infinity;
        this.setFlag(monster.def.once);
        this.say('play.hud.eng.fallsForGood', `${monster.def.name} falls, and stays fallen. What it guarded is open now.`, { name: monster.def.name });
      }
    }
  }

  /** A veiled creature is exposed while a placed light (a torch, a camp) burns within VEIL_CELLS of it. */
  private exposed(monster: Monster): boolean {
    const t = this.terrain;
    if (!t) return true;
    const col = t.colAt(monster.x), row = t.rowAt((monster.def.floorY ?? FLOOR) - 1);
    for (let r = row - VEIL_CELLS; r <= row + 1; r++) for (let c = col - VEIL_CELLS; c <= col + VEIL_CELLS; c++) {
      if (!t.inside(c, r)) continue;
      const node = TERRAIN_NODE_LIST[t.kind[t.index(c, r)]];
      if (!node.solid && node.glow && node.placeable) return true;
    }
    return false;
  }
  /** A veiled creature of this area is up (the lantern dims). */
  private veiledUp(): boolean { return this.monsters.some(m => m.def.veiled && m.hp > 0); }
  /**
   * Call up a summoned creature of this area (the Drowned Lamp, by a night
   * cast). Near `x`, inside its range. False when it is not this area's, is
   * already up, or has fallen for good.
   */
  summon(creature: string, x: number): boolean {
    const def = this.areaDef.monsters.find(m => m.creature === creature && m.summoned);
    if (!def || (def.once && this.flagged(def.once)) || this.monsters.some(m => m.def === def && m.hp > 0)) return false;
    const [lo, hi] = def.range ?? [0, this.areaDef.width];
    const at = Math.max(lo, Math.min(hi, x));
    this.monsters.push({ def, maxHp: def.hp, x: at, spawn: at, hp: def.hp, phase: 'idle', timer: 1.5, facing: -1, respawn: 0, flash: 0, knock: 0, dying: 0, born: SPAWN_RISE, shownHp: def.hp, recoil: 0 });
    this.say('play.fish.lampRises', `${def.name} rises, and every light in the cavern dims. Light a torch beside it to fight it.`, { name: def.name });
    this.report();
    return true;
  }

  // -- Delve: tools hitting the world -------------------------------------

  /**
   * The cells a swing reaches, written to hitScratch: holding Down, the cells
   * under the Keeper's feet; otherwise the column in front of the body.
   */
  private swingTargets(): number {
    const t = this.terrain;
    if (!t) return 0;
    const out = this.hitScratch, box = DELVE_BOX, p = this.player;
    let n = 0;
    if (this.input.has('down')) {
      const row = t.rowAt(p.y + 1);
      for (let col = t.colAt(p.x - box.halfWidth); col <= t.colAt(p.x + box.halfWidth - .01); col++) {
        if (t.inside(col, row) && t.solid(col, row)) out[n++] = t.index(col, row);
      }
      return n;
    }
    const col = t.colAt(p.x + this.facing * (box.halfWidth + CELL * .5));
    for (let row = t.rowAt(p.y - box.height); row <= t.rowAt(p.y - .01); row++) {
      if (t.inside(col, row) && t.solid(col, row)) out[n++] = t.index(col, row);
    }
    return n;
  }
  /** Work the first `count` cells of hitScratch, then give the whole swing one feel. */
  private hitCells(count: number, allowed: readonly ToolKind[], quiet: boolean): void {
    const t = this.terrain;
    if (!t || !count) return;
    let broke = 0, chipped = 0, blocked = 0, rich = false;
    for (let n = 0; n < count; n++) {
      const index = this.hitScratch[n];
      const col = index % t.cols, row = (index - col) / t.cols;
      const node = t.nodeAt(col, row);
      const result = this.hitCell(col, row, allowed, quiet || blocked > 0);
      if (result === HIT_BROKE) { broke++; rich ||= !!node.yield; }
      else if (result === HIT_CHIP || result === HIT_REFUSED) chipped++;
      else if (result === HIT_BLOCKED) blocked++;
    }
    if (broke) this.impact(rich ? .07 : .04, rich ? 5 : 3);
    else if (chipped) this.impact(.025, 1.6);
    else if (blocked && !quiet) this.impact(.02, 1);
  }
  /** One tool strike on one cell. Asks the host before a paying cell breaks. */
  private hitCell(col: number, row: number, allowed: readonly ToolKind[], quiet: boolean): number {
    const t = this.terrain;
    if (!t || !t.inside(col, row)) return HIT_NONE;
    const node = t.nodeAt(col, row);
    if (!node.solid) return HIT_NONE;
    const cx = (col + .5) * CELL, cy = t.top + (row + .5) * CELL;
    const check = toolFor(node, this.tools, allowed, this.power);
    if (!check.ok) {
      this.debris.chip(cx, cy, '#ffe2a8', quiet ? 2 : 6);
      if (!quiet) this.clang(cx, cy, check.need ? `Clang! Need ${toolName(check.need.tool, check.need.tier)}` : `${node.label} will not break`);
      return HIT_BLOCKED;
    }
    if (node.guard && !this.flagged(node.guard.flag)) {
      this.debris.chip(cx, cy, node.fleck, quiet ? 2 : 6);
      if (!quiet) this.clang(cx, cy, node.guard.refusal); else this.message = `${node.guard.refusal}.`;
      return HIT_BLOCKED;
    }
    const level = node.minLevel && this.skillLevels ? this.skillLevels[node.discipline] ?? 1 : Infinity;
    if (node.minLevel && level < node.minLevel) {
      this.debris.chip(cx, cy, '#ffe2a8', quiet ? 2 : 6);
      if (!quiet) this.clang(cx, cy, `Clang! Needs ${titleCase(node.discipline)} ${node.minLevel}`);
      return HIT_BLOCKED;
    }
    const index = t.index(col, row);
    // The pace of a swing is the tool that actually bit.
    if (!this.swingTool || (this.swing[check.tool] ?? BASE_SWING) < (this.swing[this.swingTool] ?? BASE_SWING)) this.swingTool = check.tool;
    const left = t.hp[index] - check.damage;
    if (left > 1e-3) {
      t.setHp(col, row, left);
      this.debris.chip(cx, cy, node.fleck, this.reducedMotion ? 2 : 4);
      return HIT_CHIP;
    }
    // Loose rock with no support near comes down when it is dug out (checked before it is gone).
    const falls = isLoose(t, col, row) && !supportNear(t, col, row);
    let material: string | undefined;
    let qty = 0;
    // Only generated cells pay (spec §4.2): a cell the Keeper placed or a reaction made
    // (obsidian) breaks into its block with no XP and no yield, so no liquid farm mints anything.
    const generated = t.base[index] === t.kind[index];
    const xp = generated ? node.xp : 0;
    const pays = generated ? node.yield : undefined;
    if (pays && (pays.chance === undefined || pays.chance >= 1 || this.random() < pays.chance)) { material = pays.materialId; qty = pays.qty; }
    if (xp > 0 || pays || node.block) {
      // A cell the Keeper placed this session is a new grant each time it is dug.
      const gen = this.placedGen.get(index);
      const accepted = this.options.onWorldAction?.({
        kind: TOOL_ACTION[check.tool], areaId: this.areaDef.id, cellKey: cellKey(col, row),
        materialId: material, qty: material ? qty : undefined, discipline: node.discipline, xp,
        mutationId: `delve:${this.lootSession}:${this.areaDef.id}:${cellKey(col, row)}${gen ? `:p${gen}` : ''}`,
        ...(node.block ? { block: node.block } : {}),
      });
      if (accepted === false) {
        // Refused: it stands, cracked to the last stage, and the next hit asks again.
        t.setHp(col, row, Math.min(t.hp[index], 1e-3));
        this.debris.chip(cx, cy, node.fleck, 3);
        return HIT_REFUSED;
      }
      // Broken, but the host paid nothing for it (the seam's breath): no "+1 ore" line.
      if (accepted === WORLD_ACTION_UNPAID) material = undefined;
    }
    t.set(col, row, 0);
    this.recordCell(t, index);
    this.debris.crumble(cx, cy, node.base, node.fleck, this.reducedMotion);
    if (material) {
      this.atmosphere.burst(cx, cy - 12, `+${qty} ${titleCase(material)}`);
      this.say('play.hud.eng.cellGathered', `${titleCase(material)} gathered from the ${node.label.toLowerCase()}.`, { name: titleCase(material), lsite: node.label.toLowerCase() });
    }
    if (falls) this.dropRubble(cx, cy, node.base);
    return HIT_BROKE;
  }

  // -- Delve: liquids (liquids.ts), buckets and fishing ----------------------

  /** True when cell `index` overlaps the Keeper's body (a reaction never sets rock into them). */
  private bodyIn(t: Terrain, index: number): boolean {
    const col = index % t.cols, row = (index - col) / t.cols;
    const x0 = col * CELL, y0 = t.top + row * CELL, p = this.player;
    return p.x + DELVE_BOX.halfWidth > x0 && p.x - DELVE_BOX.halfWidth < x0 + CELL && p.y > y0 && p.y - DELVE_BOX.height < y0 + CELL;
  }
  /** Water met lava: save the obsidian cell (a made cell: its block only, never XP), hiss and say so. */
  private reacted(t: Terrain, areaId: string, index: number, made: boolean): void {
    const col = index % t.cols, row = (index - col) / t.cols;
    if (made && this.terrain === t) {
      this.placedGen.delete(index);
      this.recordCell(t, index);
    } else if (made) {
      try { const layout = this.layouts.get(areaId); if (layout) this.delve?.changed(areaId, layout, index, t.kind[index] === t.base[index] ? null : t.kind[index]); } catch { /* this session */ }
    }
    if (this.terrain !== t) return;
    this.debris.chip((col + .5) * CELL, t.top + (row + .5) * CELL, '#d8e8f0', this.reducedMotion ? 2 : 8);
    if (made) this.say('play.delve.liquid.obsidian', 'Water meets lava with a hiss, and sets into obsidian.');
    else this.say('play.delve.liquid.steam', 'Water meets lava right where you stand: it all goes up in steam.');
  }
  /** Save the liquid as it is now, filed by its liquid layout. */
  private saveLiquids(t: Terrain, sim: LiquidSim): void {
    sim.markSaved();
    const layout = this.liquidLayouts.get(this.areaDef.id);
    if (!layout || !this.delve?.liquidsChanged) return;
    try { this.delve.liquidsChanged(this.areaDef.id, layout, liquidDiff(t)); } catch { /* flowing for this session */ }
  }
  private wardMax = 0;
  /**
   * The Keeper's wards against liquids, from what they carry: `lavaWard`
   * (seconds of lava immunity an Ember Elixir worn as a charm holds; it
   * recharges out of lava) and `breath` (a multiplier: a Gill Draught is ×3).
   */
  setWards(wards: { lavaWard?: number; breath?: number }): void {
    const breath = Number.isFinite(wards.breath) && (wards.breath as number) >= 1 ? Math.min(5, wards.breath as number) : 1;
    const max = BREATH * breath;
    if (max !== this.breathMax) { this.breath = Math.min(max, this.breath * max / this.breathMax); this.breathMax = max; }
    const ward = Number.isFinite(wards.lavaWard) && (wards.lavaWard as number) > 0 ? Math.min(60, wards.lavaWard as number) : 0;
    if (ward !== this.wardMax) { this.wardMax = ward; this.lavaWard = ward; }
  }
  /** Where the Keeper's body sits in liquid (refreshed each fixed step). */
  private sense(t: Terrain): void {
    const imm = immersion(t, this.player.x, this.player.y, DELVE_BOX.height);
    this.immersed = imm.body;
    this.headUnder = !!imm.head;
  }
  /** One fixed step of liquids: flow, saving, charring, and what the liquid does to the Keeper. */
  private updateLiquids(dt: number, t: Terrain): void {
    const sim = this.liquid;
    if (sim) {
      sim.step(dt);
      if (sim.dirty && (sim.settled || sim.urgent)) this.saveLiquids(t, sim);
    }
    for (const [index, left] of this.chars) {
      if (left < 0) continue;
      if (left - dt > 0) { this.chars.set(index, left - dt); continue; }
      this.charCell(t, index);
    }
    // Breath: under water it runs down, then drowning hurts; above, it comes back fast.
    if (this.headUnder && this.immersed === LIQUID_WATER) {
      if (this.breath === this.breathMax) this.say('play.delve.liquid.breath', 'Holding your breath. Surface before it runs out.');
      this.breath = Math.max(0, this.breath - dt);
      if (this.breath <= 0) {
        if (this.burning >= 0) this.say('play.delve.liquid.drowning', 'Out of breath! Swim up (hold Jump).');
        this.hurtBy(DROWN_SHARE * dt);
      }
    } else this.breath = Math.min(this.breathMax, this.breath + dt * 4);
    // Lava: burns while in it and for a moment after, unless the Ember Elixir's ward holds.
    const inLava = this.immersed === LIQUID_LAVA;
    if (inLava && this.lavaWard > 0) this.lavaWard = Math.max(0, this.lavaWard - dt);
    else if (!inLava && this.lavaWard < this.wardMax) this.lavaWard = Math.min(this.wardMax, this.lavaWard + dt / 3);
    if (inLava && this.lavaWard <= 0) {
      if (this.burning <= 0) this.say('play.delve.liquid.lava', 'Lava! Get out. An Ember Elixir worn as a charm wards it off for a while.');
      this.burning = BURN_TIME;
      this.hurtBy(LAVA_SHARE * dt);
    } else if (this.burning > 0) {
      this.burning = Math.max(0, this.burning - dt);
      if (!inLava) this.hurtBy(BURN_SHARE * dt);
    }
  }
  /** A liquid's hurt: a share of max HP, never below 0 (the shipped defeat flow takes over at 0). */
  private hurtBy(share: number): void {
    if (this.hp <= 0) return;
    this.hp = Math.max(0, this.hp - this.maxHp * share);
    this.wound = Math.max(this.wound, .35);
    if (this.hp === 0) this.say('play.hud.eng.keeperFalls', 'The Keeper falls. Restart the hunt or return to camp.');
  }
  /** Lava has charred a wooden placed thing: back to the satchel (the host's take-back), and the lava flows on. */
  private charCell(t: Terrain, index: number): void {
    const node = TERRAIN_NODE_LIST[t.kind[index]];
    const def = placeableById(node.placeable);
    if (!def || node.solid) { this.chars.delete(index); return; }
    const col = index % t.cols, row = (index - col) / t.cols;
    const accepted = this.options.onTakeBack?.({
      item: def.id, areaId: this.areaDef.id, cellKey: cellKey(col, row), index,
      mutationId: `delve-char:${this.lootSession}:${this.areaDef.id}:${cellKey(col, row)}:${++this.placeSeq}`,
    });
    // Refused (a chest with things in it): it holds the lava back.
    if (accepted === false) { this.chars.set(index, -1); return; }
    this.chars.delete(index);
    t.set(col, row, 0);
    this.placedGen.delete(index);
    this.recordCell(t, index);
    this.debris.chip((col + .5) * CELL, t.top + (row + .5) * CELL, '#3a2a22', this.reducedMotion ? 3 : 8);
    this.say('play.delve.liquid.charred', `The lava charred your ${def.label.toLowerCase()}. It is back in your satchel.`, { item: def.id });
  }

  // Buckets: a Seam Bucket scoops one full cell of water or lava, and pours it back out.

  /** The cell a bucket acts on without a pointer: liquid in front (or under the feet) to scoop; open space ahead to pour. */
  private bucketTarget(t: Terrain, scoop: boolean): number {
    const p = this.player, feetRow = t.rowAt(p.y - .01), own = t.colAt(p.x);
    const front = this.facing < 0 ? t.colAt(p.x - DELVE_BOX.halfWidth) - 1 : t.colAt(p.x + DELVE_BOX.halfWidth - .01) + 1;
    if (scoop) {
      for (const col of [front, own]) for (let row = feetRow - 1; row <= feetRow + 2; row++) if (t.inside(col, row) && t.liqLevel[t.index(col, row)]) return t.index(col, row);
      return -1;
    }
    for (let row = feetRow + 1; row >= feetRow - 1; row--) if (t.inside(front, row) && !t.solid(front, row)) return t.index(front, row);
    return -1;
  }
  /** Scoop or pour with the chosen bucket at a cell. The satchel swaps first (host), then the world changes. */
  private useBucket(bucket: BucketId, index: number): boolean {
    const t = this.terrain, sim = this.liquid;
    const full = BUCKET_LIQUID[bucket];
    const type = t && index >= 0 ? full || (t.liqLevel[index] ? t.liqType[index] : 0) : 0;
    if (!t || !sim || !type) { this.say('play.delve.bucket.nothing', 'Nothing here for the bucket: stand at the edge of water or lava.'); this.report(); return false; }
    const col = index % t.cols, row = (index - col) / t.cols;
    // The world must take it before the satchel is asked.
    const ok = full ? sim.pour(index, type, true) : sim.scoop(index, true) === type;
    if (!ok) {
      if (full) this.say('play.delve.bucket.noRoom', 'No room to pour there.');
      else this.say('play.delve.bucket.tooShallow', 'Too shallow: a bucket needs a full cell of it, joined together.');
      this.report(); return false;
    }
    const to: BucketId = full ? 'seam-bucket' : BUCKET_FOR[type];
    const accepted = this.options.onBucket?.({
      from: bucket, to, areaId: this.areaDef.id, cellKey: cellKey(col, row), index, liquid: LIQUID_IDS[type] as LiquidKind,
      mutationId: `delve-bucket:${this.lootSession}:${this.areaDef.id}:${cellKey(col, row)}:${++this.placeSeq}`,
    });
    if (accepted === false) { this.report(); return false; }
    if (full) sim.pour(index, type); else sim.scoop(index);
    this.debris.chip((col + .5) * CELL, t.top + (row + .5) * CELL, type === LIQUID_LAVA ? '#ffb066' : '#86d2e6', this.reducedMotion ? 2 : 6);
    // A pour that set obsidian has already said so (reacted).
    if (full && t.solid(col, row)) { /* the hiss is the line */ }
    else if (full) this.say(type === LIQUID_LAVA ? 'play.delve.bucket.pouredLava' : 'play.delve.bucket.pouredWater', type === LIQUID_LAVA ? 'You pour out the lava.' : 'You pour out the water.');
    else this.say(type === LIQUID_LAVA ? 'play.delve.bucket.scoopedLava' : 'play.delve.bucket.scoopedWater', type === LIQUID_LAVA ? 'The bucket holds a cell of lava. Mind your hands.' : 'The bucket holds a cell of water.');
    this.saveLiquids(t, sim);
    this.report();
    return true;
  }

  // Fishing: cast at liquid, wait for the dip, hook it; the host reels (or auto-fish settles it).

  /**
   * The rod the Keeper carries (the best in the satchel; tier 0 = none), the
   * liquids it works in, and its bite speed (a multiplier ≥ 1: bait, level,
   * rod and charms together; the host works it out).
   */
  setFishing(rod: { tier: number; liquids: readonly LiquidKind[]; bite?: number }): void {
    const bite = Number.isFinite(rod.bite) && (rod.bite as number) >= 1 ? Math.min(4, rod.bite as number) : 1;
    this.rod = { tier: Math.max(0, Math.floor(rod.tier || 0)), liquids: [...rod.liquids], bite };
  }
  /** Use held (E, or the touch Use button): a bite is hooked and settled at once, and the line recast (auto-fish). */
  setUseHeld(held: boolean): void { this.useHeld = held; if (!held) this.recast = 0; }
  /** The liquid surface a cast would land on (cell index), or -1: in the facing direction, within CAST_CELLS. */
  private castTarget(t: Terrain): number {
    if (!this.rod.tier) return -1;
    const p = this.player, own = t.colAt(p.x), mid = t.rowAt(p.y - DELVE_BOX.height * .5);
    for (let d = 0; d <= CAST_CELLS; d++) {
      const col = own + this.facing * d;
      if (col < 0 || col >= t.cols) break;
      for (let row = Math.max(0, mid - 1); row <= Math.min(t.rows - 1, mid + CAST_CELLS); row++) {
        const i = t.index(col, row);
        if (t.solid(col, row)) { if (row > mid) break; continue; }
        if (!t.liqLevel[i]) continue;
        // The top liquid cell of this column is the surface the bob floats on.
        const kind = LIQUID_IDS[t.liqType[i]];
        if (kind && this.rod.liquids.includes(kind)) return i;
        break;
      }
    }
    return -1;
  }
  /** Fishable liquid within a cast (the HUD's Fish prompt), or null. */
  private fishable(t: Terrain): LiquidKind | null {
    const i = this.castTarget(t);
    return i >= 0 ? LIQUID_IDS[t.liqType[i]] : null;
  }
  /** Cast the line. True when it went in. */
  cast(): boolean {
    const t = this.terrain;
    if (!t || this.paused || this.hp <= 0 || this.line) return false;
    if (!this.rod.tier) { this.say('play.fish.noRod', 'You need a rod to fish. The Lodge Warden in the Rootglass Canopy keeps a worn one for you.'); this.report(); return false; }
    const index = this.castTarget(t);
    if (index < 0) { this.say('play.fish.noWater', 'Nothing to fish here: face water your rod can work, within six cells.'); this.report(); return false; }
    const col = index % t.cols, row = (index - col) / t.cols;
    this.cancelMove();
    this.line = {
      phase: 'wait', liquid: t.liqType[index], biome: t.biomeAt(row).id, col, row,
      timer: this.biteWait(3, 9), bobX: (col + .5) * CELL, bobY: surfaceY(t, row, t.liqLevel[index]), castId: '',
    };
    if (Math.abs(this.line.bobX - this.player.x) > 4) this.facing = this.line.bobX > this.player.x ? 1 : -1;
    this.say('play.fish.cast', 'The line is in. When the bob dips, press E (or tap).');
    this.report();
    return true;
  }
  /** Seconds to the next bite: lo..hi, shortened by the rod's bite speed. */
  private biteWait(lo: number, hi: number): number { return (lo + (hi - lo) * this.random()) / this.rod.bite; }
  /** Pull the line out (moving away, or E with nothing biting). */
  reelIn(quiet = false): void {
    if (!this.line || this.line.phase === 'hooked') return;
    this.line = null;
    if (!quiet) { this.say('play.fish.reeledIn', 'You reel the line in.'); this.report(); }
  }
  /** E (or a tap) during the dip: hooked. The host reels it in (FishEvent): once hooked it is always landed. */
  hook(auto = false): boolean {
    const line = this.line;
    if (!line || !this.terrain || line.phase !== 'bite') return false;
    line.phase = 'hooked';
    line.castId = `fish:${this.lootSession}:${++this.castSeq}`;
    this.report();
    this.options.onFish?.({ areaId: this.areaDef.id, biome: line.biome, liquid: LIQUID_IDS[line.liquid] as LiquidKind, castId: line.castId, auto, col: line.col, row: line.row });
    return true;
  }
  /**
   * The host landed the fish: the line comes out. With Use still held it is
   * recast after `recastIn` seconds (auto-fish waits out the reel it skipped,
   * so auto never outpaces playing).
   */
  landFish(recastIn = .6): void {
    if (!this.line) return;
    this.line = null;
    if (this.useHeld) this.recast = Math.max(.6, recastIn);
    this.report();
  }
  /** Seconds after a dip passes in which E is a late hook (forgiven), not a reel-in. */
  private lateHook = 0;
  private updateLine(dt: number, t: Terrain): void {
    this.lateHook = Math.max(0, this.lateHook - dt);
    if (this.recast > 0) { this.recast -= dt; if (this.recast <= 0 && this.useHeld && !this.line) this.cast(); }
    const line = this.line;
    if (!line) return;
    const i = t.index(line.col, line.row);
    // The water it was cast into drained away: the line comes out (a hooked fish is still landed by the host).
    if (!t.liqLevel[i] || t.liqType[i] !== line.liquid) {
      if (line.phase !== 'hooked') { this.line = null; this.say('play.fish.waterGone', 'The water went from under your bob.'); }
      return;
    }
    line.bobY = surfaceY(t, line.row, t.liqLevel[i]);
    if (line.phase === 'hooked') return;
    line.timer -= dt;
    if (line.timer > 0) return;
    if (line.phase === 'wait') {
      line.phase = 'bite'; line.timer = HOOK_WINDOW;
      this.say('play.fish.bite', 'A bite! Press E (or tap) now!');
      // Auto-fish: Use held through the dip hooks at once (the Off grade, no mini-game).
      if (this.useHeld) this.hook(true);
      this.report();
      return;
    }
    // Missed the dip: nothing lost, it nibbles again (and a tap in the next moment is a late hook, not a reel-in).
    line.phase = 'wait'; line.timer = this.biteWait(1, 3); this.lateHook = LATE_HOOK;
    this.say('play.fish.missed', 'Missed it. It is still down there: wait for the next dip.');
  }
  /** The line, the bob and its dip (world px; before the darkness, so it is lit like the world). */
  private drawLine(c: CanvasRenderingContext2D, time: number): void {
    const line = this.line;
    if (!line) return;
    const k = this.figure;
    const hx = this.player.x + this.facing * 34 * k, hy = this.player.y - 150 * k;
    const dip = line.phase === 'bite' ? ART * 2 : line.phase === 'hooked' ? ART * 3 : 0;
    const bob = this.reducedMotion || line.phase !== 'wait' ? 0 : Math.round(Math.sin(time * 3) * .5) * ART;
    const bx = Math.round(line.bobX / ART) * ART, by = Math.round((line.bobY - ART * 2) / ART) * ART + dip + bob;
    c.save();
    c.strokeStyle = 'rgba(232, 220, 200, .75)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo((hx + bx) / 2, Math.max(hy, by) + 20, bx + ART, by); c.stroke();
    // A pixel bob: red cap, ivory belly, a dark outline.
    c.fillStyle = '#140a1f'; c.fillRect(bx - ART, by - ART, ART * 4, ART * 4);
    c.fillStyle = '#e04a3a'; c.fillRect(bx, by, ART * 2, ART);
    c.fillStyle = '#f4ead6'; c.fillRect(bx, by + ART, ART * 2, ART);
    if (line.phase === 'bite' && !this.reducedMotion) {
      c.fillStyle = '#d0f6ff';
      c.fillRect(bx - ART * 3, by + ART * 2, ART, ART); c.fillRect(bx + ART * 4, by + ART * 2, ART, ART);
    }
    c.restore();
  }

  // -- Delve: loose rock, supports and blasting charges ---------------------

  /** Loose rock lets go: dust for a beat (the warning), then a chunk falls straight down. */
  private dropRubble(x: number, y: number, color: string): void {
    const slot = this.rubble.find(r => !r.active);
    if (!slot) return;
    slot.active = true; slot.x = x; slot.y = y; slot.vy = 0; slot.wait = RUBBLE_WAIT; slot.color = color;
    this.say('play.delve.rockGroans', 'The rock groans. Loose rock! A timber or basalt support nearby would hold it.');
    this.impact(.02, 2);
  }
  /** Advance falling rubble: a chunk on the Keeper hurts (never below 1 HP); on the floor it crumbles. */
  private updateRubble(dt: number, t: Terrain): void {
    const p = this.player;
    for (const r of this.rubble) {
      if (!r.active) continue;
      if (r.wait > 0) {
        r.wait -= dt;
        if (!this.reducedMotion && Math.random() < .5) this.debris.chip(r.x + (Math.random() - .5) * CELL, r.y - CELL * .4, '#b8a69a', 1);
        continue;
      }
      r.vy = Math.min(TERMINAL_RUBBLE, r.vy + 1500 * dt);
      const ny = r.y + r.vy * dt;
      const onKeeper = Math.abs(r.x - p.x) < DELVE_BOX.halfWidth + 10 && ny + 8 >= p.y - DELVE_BOX.height && r.y - 8 <= p.y;
      if (onKeeper) {
        r.active = false;
        this.debris.crumble(r.x, ny, r.color, '#b8a69a', this.reducedMotion);
        if (this.dodgeTime > 0 || this.hurtTime > 0 || this.hp <= 0) continue;
        const hit = Math.max(4, Math.round(this.maxHp * RUBBLE_SHARE));
        // Gentle on purpose: rubble bruises, it never fells a Keeper.
        this.hp = Math.max(1, this.hp - hit); this.hurtTime = .6; this.wound = .7;
        this.atmosphere.burst(p.x, p.y - DELVE_BOX.height - 8, `-${hit}`);
        this.impact(.06, 7);
        this.say('play.delve.rockHits', `Loose rock hits you (-${hit}). Place a support near loose rock (cracked, dusting) before you dig it.`, { n: hit });
        continue;
      }
      if (t.solidAt(r.x, ny + 8) || ny > t.bottom) {
        r.active = false;
        this.debris.crumble(r.x, Math.min(ny, t.bottom), r.color, '#b8a69a', this.reducedMotion);
        continue;
      }
      r.y = ny;
    }
  }
  /**
   * The telegraph: exposed loose rock near the Keeper with no support sheds a
   * little dust now and then, and the first time one is close the Keeper is
   * told what it means. Reduced motion keeps the cracks (drawn on the cell) only.
   */
  private updateLooseDust(t: Terrain): void {
    if (this.elapsed < this.dustAt) return;
    this.dustAt = this.elapsed + .35;
    const pc = t.colAt(this.player.x), pr = t.rowAt(this.player.y - 1);
    if (!t.biomeAt(pr).loose) return;
    let picked = -1, seen = 0, close = false;
    for (let row = Math.max(0, pr - 6); row <= Math.min(t.rows - 1, pr + 2); row++) {
      for (let col = Math.max(0, pc - 8); col <= Math.min(t.cols - 1, pc + 8); col++) {
        if (t.solid(col, row + 1) || !isLoose(t, col, row) || supportNear(t, col, row)) continue;
        seen++;
        if (Math.abs(col - pc) <= 2 && row < pr) close = true;
        // Reservoir pick: every candidate equally likely, no allocation.
        if (Math.random() * seen < 1) picked = t.index(col, row);
      }
    }
    if (close && !this.looseHinted) {
      this.looseHinted = true;
      this.say('play.delve.looseOverhead', 'Loose rock overhead: cracked and shedding dust. Dig it out with a support nearby, or it comes down.');
    }
    if (picked < 0 || this.reducedMotion) return;
    const col = picked % t.cols, row = (picked - col) / t.cols;
    this.debris.chip((col + .2 + Math.random() * .6) * CELL, t.top + (row + 1) * CELL, '#b8a69a', 1);
  }
  /** A lit charge burns down; at zero it goes off, if it is still there. */
  private updateFuses(dt: number): void {
    if (!this.fuses.length) return;
    for (const fuse of this.fuses) fuse.left -= dt;
    const due = this.fuses.filter(fuse => fuse.left <= 0);
    if (!due.length) return;
    this.fuses = this.fuses.filter(fuse => fuse.left > 0);
    for (const fuse of due) this.detonate(fuse.index);
  }
  /**
   * A charge goes off: every cell `blastCells` allows in CHARGE_RADIUS is
   * cleared through the host like a dig (kind 'blast', the same per-cell
   * mutation id, so a cell is paid once), paying at least 1 XP (Mining for
   * rock, Delving for the rest) and its yield. A cell the Keeper placed pays
   * its block back and no XP. Creatures in the blast take a heavy hit. The
   * Keeper is never hurt by their own charge. Power: staff tier + 1.
   */
  private detonate(index: number): number {
    const t = this.terrain;
    if (!t || index < 0 || index >= t.kind.length || !TERRAIN_NODE_LIST[t.kind[index]].charge) return 0;
    const col = index % t.cols, row = (index - col) / t.cols;
    const cx = (col + .5) * CELL, cy = t.top + (row + .5) * CELL;
    t.set(col, row, 0); this.placedGen.delete(index); this.recordCell(t, index);
    const power = 1 + Math.max(1, this.tools.staff ?? 0);
    const count = blastCells(t, col, row, power, flag => this.flagged(flag), this.blastScratch);
    let cleared = 0;
    for (let n = 0; n < count; n++) if (this.blastCell(this.blastScratch[n], n)) cleared++;
    const reach = CHARGE_RADIUS * CELL * 1.3;
    for (const monster of this.monsters) {
      if (monster.hp <= 0) continue;
      const d = Math.hypot(monster.x - cx, (monster.def.floorY ?? FLOOR) - 40 * this.figure - cy);
      if (d <= reach) this.hurtMonster(monster, CHARGE_DAMAGE);
    }
    const at = this.blastAt;
    at.x = cx; at.y = cy; at.dx = 0; at.dy = 0; at.range = CHARGE_RADIUS * CELL * 1.6;
    this.blastFlash = 1;
    this.debris.crumble(cx, cy, '#6a2a22', '#ffd36d', this.reducedMotion);
    this.atmosphere.burst(cx, cy - 20, 'BOOM');
    this.impact(.12, 16);
    if (cleared) this.say('play.delve.chargeCleared', `The charge goes off: ${cleared} cells of rock come down.`, { n: cleared });
    else this.say('play.delve.chargeNothing', 'The charge goes off, but nothing here would give.');
    this.report();
    return cleared;
  }
  /** One cell a blast reaches. False when it stood (a skill level short, or the host refused). */
  private blastCell(index: number, n: number): boolean {
    const t = this.terrain;
    if (!t) return false;
    const col = index % t.cols, row = (index - col) / t.cols;
    const node = TERRAIN_NODE_LIST[t.kind[index]];
    const level = node.minLevel && this.skillLevels ? this.skillLevels[node.discipline] ?? 1 : Infinity;
    if (node.minLevel && level < node.minLevel) return false;
    const placed = t.kind[index] !== t.base[index];
    let material: string | undefined, qty = 0;
    // A placed or made cell (obsidian) pays its block only, as a dig does.
    const pays = placed ? undefined : node.yield;
    if (pays && (pays.chance === undefined || pays.chance >= 1 || this.random() < pays.chance)) { material = pays.materialId; qty = pays.qty; }
    const gen = this.placedGen.get(index);
    const accepted = this.options.onWorldAction?.({
      kind: 'blast', areaId: this.areaDef.id, cellKey: cellKey(col, row),
      materialId: material, qty: material ? qty : undefined,
      discipline: node.discipline === 'mining' ? 'mining' : 'exploration', xp: placed ? 0 : Math.max(1, node.xp),
      mutationId: `delve:${this.lootSession}:${this.areaDef.id}:${cellKey(col, row)}${gen ? `:p${gen}` : ''}`,
      ...(placed && node.block ? { block: node.block } : {}),
    });
    if (accepted === false) { t.setHp(col, row, Math.min(t.hp[index], 1e-3)); return false; }
    t.set(col, row, 0); this.placedGen.delete(index); this.recordCell(t, index);
    // Every cell crumbles; past the first few only every other one throws dust (the pool is shared).
    if (n < 6 || n % 2 === 0) this.debris.crumble((col + .5) * CELL, t.top + (row + .5) * CELL, node.base, node.fleck, true);
    return true;
  }
  /** True for a cell E acts on: a carved wall, a placed chest or camp. */
  private usable(index: number): boolean {
    const t = this.terrain;
    return !!t && (t.inscriptions.has(index) || !!TERRAIN_NODE_LIST[t.kind[index]].use);
  }
  /** Read a carved wall, or ask the host to open a chest or camp. */
  private useCell(index: number): void {
    const t = this.terrain;
    if (!t) return;
    if (t.inscriptions.has(index)) { this.readInscription(index); return; }
    const use = TERRAIN_NODE_LIST[t.kind[index]].use;
    if (!use) return;
    const col = index % t.cols, row = (index - col) / t.cols;
    this.report();
    this.options.onUse?.({ kind: use, areaId: this.areaDef.id, cellKey: cellKey(col, row), index });
  }
  /** The carved wall, chest or camp the Keeper's body stands against (cell index), or -1. No allocation. */
  private findInteractive(): number {
    const t = this.terrain;
    if (!t) return -1;
    const p = this.player;
    const c0 = t.colAt(p.x - DELVE_BOX.halfWidth - INTERACT_REACH), c1 = t.colAt(p.x + DELVE_BOX.halfWidth + INTERACT_REACH);
    const r0 = t.rowAt(p.y - DELVE_BOX.height), r1 = t.rowAt(p.y - .01);
    for (let row = Math.max(0, r0); row <= Math.min(t.rows - 1, r1); row++) {
      for (let col = Math.max(0, c0); col <= Math.min(t.cols - 1, c1); col++) {
        const index = t.index(col, row);
        if (this.usable(index)) return index;
      }
    }
    return -1;
  }
  /** Read a carved wall: tell the host (it decides if this is a first reading), glint it. */
  private readInscription(index: number): void {
    const t = this.terrain;
    const id = t?.inscriptions.get(index);
    if (!t || !id) return;
    const col = index % t.cols, row = (index - col) / t.cols;
    const cx = (col + .5) * CELL, cy = t.top + (row + .5) * CELL;
    this.debris.chip(cx, cy, '#e8c47a', this.reducedMotion ? 2 : 6);
    this.say('play.delve.inscriptionTrace', 'You trace the carving with a finger. The words are older than the Seamworks.');
    // Reported before the host hears of it, so a message the host shows in reply is not cleared by this one.
    this.report();
    this.options.onDiscover?.({ kind: 'inscription', id, biome: t.biomeAt(row).id });
  }
  private clang(x: number, y: number, text: string): void {
    this.message = `${text}.`;
    if (this.clangAt >= 0 && this.elapsed - this.clangAt < .45) return;
    this.clangAt = this.elapsed;
    this.atmosphere.burst(x, y - 14, text);
  }
  /**
   * The staff's blast: a short bright cone ahead (or below, holding Down; above,
   * holding Jump) that works every cell the staff can in reach, hurts monsters
   * in it, and lights the delve for a moment.
   */
  private blast(): void {
    const t = this.terrain;
    if (!t) return;
    const staff = this.tools.staff ?? 0;
    if (!staff) { this.clang(this.player.x, this.player.y - 80, 'No staff to channel a blast'); return; }
    if (this.blastCooldown > 0) return;
    this.blastCooldown = BLAST_COOLDOWN; this.blastTime = BLAST_TIME; this.blastFlash = 1;
    const down = this.input.has('down'), up = this.input.has('jump') && !down;
    const dx = down || up ? 0 : this.facing, dy = down ? 1 : up ? -1 : 0;
    const at = this.blastAt;
    at.x = this.player.x + this.facing * 8; at.y = this.player.y - DELVE_BOX.height * .55;
    at.dx = dx; at.dy = dy; at.range = CELL * (5 + staff - 1);
    const count = coneCells(t, at.x, at.y, dx, dy, at.range, .5, this.hitScratch);
    this.hitCells(count, BLAST_TOOLS, true);
    for (const monster of this.monsters) {
      if (monster.hp <= 0) continue;
      const vx = monster.x - at.x, vy = (monster.def.floorY ?? FLOOR) - 40 * this.figure - at.y;
      const d = Math.hypot(vx, vy);
      if (d <= at.range && d > 0 && (vx * dx + vy * dy) / d >= Math.cos(.6)) this.hurtMonster(monster, Math.round((this.damage ?? 12) * 1.2));
    }
    for (let n = 0; n < 6; n++) this.debris.chip(at.x + dx * at.range * n / 6, at.y + dy * at.range * n / 6, '#d9c2ff', 2);
    this.impact(.05, 4);
    this.say('play.hud.eng.staffAnswers', 'The staff answers: a lance of light.');
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
        this.drops.push({ id, x: monster.x + offset, y: monster.def.floorY ?? FLOOR, coins, ore: 0, age: 0, spin,
          rarity, color: beamColor(rarity, true), beam: beamHeight(rarity, true), caption: `${coins} coins`, captionW: 0 });
        names.push('coins');
      } else {
        this.drops.push({ id, x: monster.x + offset, y: monster.def.floorY ?? FLOOR, coins: 0, ore: entry.qty, material: entry.material, art: entry.art, label: entry.label, short: entry.short, age: 0, spin,
          rarity, color: beamColor(rarity, false), beam: beamHeight(rarity, false), caption: entry.qty > 1 ? `${entry.qty} x ${entry.label}` : entry.label, captionW: 0 });
        names.push(entry.label);
      }
    }
    // `items` is joined in English; the HUD re-joins it in the player's language (hud.i18n.ts).
    if (names.length) this.say('play.hud.eng.defeatedDrops', `${monster.def.name} defeated! Walk over the ${names.join(' and ')} to collect them.`, { name: monster.def.name, items: names.join(' and ') });
    else this.say('play.hud.eng.defeated', `${monster.def.name} defeated!`, { name: monster.def.name });
  }
  /** RNG for drop chances. Replaceable in tests; a table of certain drops never calls it. */
  random: () => number = Math.random;
  interact(): void {
    if (this.paused || this.hp <= 0) return;
    // A line in the water: E hooks a bite, or reels the line back in (a tap just
    // after a dip is a late hook, not a reel-in: the fish is still there).
    if (this.line) {
      if (this.hook()) return;
      if (this.lateHook > 0) { this.say('play.fish.missed', 'Missed it. It is still down there: wait for the next dip.'); this.report(); return; }
      this.reelIn(); return;
    }
    const station = this.nearbyStation();
    if (!station && this.interactAt >= 0) { this.useCell(this.interactAt); this.report(); return; }
    const site = station ? null : this.siteInReach();
    if (site) { if (this.attackCooldown <= 0) this.workSite(site); this.report(); return; }
    if (!station && this.terrain && this.castTarget(this.terrain) >= 0) { this.cast(); return; }
    if (!station) { this.say('play.hud.eng.moveCloser', 'Move closer to a marked location to interact.'); this.report(); return; }
    const locked = station.requires === 'guardian' ? !this.guardianDefeated : station.requires === 'beacon' ? !this.restored : false;
    if (locked) { if (station.lockedMessage) this.message = station.lockedMessage; else this.say('play.hud.eng.notOpen', 'This way is not open yet.'); }
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
    return this.player.y > 475 && this.player.y <= FLOOR + 40 ? nearestStation(this.stations, this.player.x) : null;
  }
  private nearby(): string | null { return this.nearbyStation()?.id ?? null; }
  private action(key: string): EngineInput | undefined {
    return ({ ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyJ: 'attack', KeyK: 'dodge', ArrowDown: 'down', KeyS: 'down', KeyL: 'blast' } as Record<string, EngineInput>)[key];
  }
  // Key/pointer releases can be lost when focus leaves the game. Release held
  // controls without pausing the shared world or discarding an active action.
  private readonly clearInput = (): void => { this.input.clear(); this.useHeld = false; };
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
    if (!event.repeat && event.code === 'KeyE') { event.preventDefault(); this.interact(); this.setUseHeld(true); }
    if (!event.repeat && event.code === 'KeyB' && this.terrain) { event.preventDefault(); this.place(); }
    if (!event.repeat && event.code === 'KeyX' && this.terrain) { event.preventDefault(); this.takeBack(); }
  };
  private readonly keyUp = (event: KeyboardEvent): void => {
    if (event.code === 'KeyE') this.setUseHeld(false);
    const action = this.action(event.code); if (action) this.setInput(action, false);
  };
  private resize(): void {
    const bounds = this.canvas.getBoundingClientRect();
    const parent = this.canvas.parentElement?.getBoundingClientRect();
    const cssWidth = this.canvas.parentElement?.clientWidth || parent?.width || bounds.width;
    const cssHeight = this.canvas.parentElement?.clientHeight || parent?.height || bounds.height;
    const ratio = Math.min(window.devicePixelRatio || 1, this.budget.maxPixelRatio);
    this.pixelRatio = ratio;
    this.width = Math.max(320, cssWidth || this.canvas.clientWidth || 320); this.height = Math.max(300, cssHeight || this.canvas.clientHeight || 300);
    this.canvas.width = Math.round(this.width * ratio); this.canvas.height = Math.round(this.height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  private readonly tick = (now: number): void => {
    if (this.destroyed) return;
    // Pacing: skip this callback when it comes sooner than the target rate allows.
    const player = this.player;
    if (this.input.size || this.walking || this.hitstop > 0 || this.shake > 0 || this.attackTime > 0 || this.dodgeTime > 0
      || player.x !== this.lastX || player.y !== this.lastY || !this.isTown || this.flights.some(flight => flight.active)) {
      this.activeAt = now;
    }
    this.lastX = player.x; this.lastY = player.y;
    const fps = now - this.activeAt > QUIET_AFTER_MS ? QUIET_FPS : MAX_FPS;
    // 2 ms of slack: rAF stamps jitter, and a 60 Hz display must not drop to 30.
    if (this.previous && now - this.previous < 1000 / fps - 2) { this.frame = requestAnimationFrame(this.tick); return; }
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
    // Paused: that was the last frame until setPaused(false). The place covers the world.
    if (this.paused) { this.frame = null; return; }
    this.frame = requestAnimationFrame(this.tick);
  };
  private update(dt: number): void {
    this.elapsed += dt;
    this.atmosphere.update(dt);
    this.life.update(dt, this.player.x, this.elapsed);
    this.landing = Math.max(0, this.landing - dt);
    this.attackTime = Math.max(0, this.attackTime - dt); this.attackCooldown -= dt;
    this.dodgeTime = Math.max(0, this.dodgeTime - dt); this.dodgeCooldown -= dt; this.hurtTime -= dt;
    this.blastCooldown -= dt; this.blastTime = Math.max(0, this.blastTime - dt); this.blastFlash = Math.max(0, this.blastFlash - dt * 1.5);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt); this.dropTime = Math.max(0, this.dropTime - dt);
    this.debris.update(dt, this.terrain);
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
    // Delves move a half-size Keeper a little slower, through the terrain.
    const pace = this.terrain ? .72 : 1;
    let velocityX = (this.dodgeTime > 0 ? this.facing * 620 : direction * 265) * pace;
    if (this.terrain) {
      // In water or lava the Keeper wades and swims: slower, sinking slowly, and Jump held swims up.
      this.sense(this.terrain);
      const swim = this.immersed ? SWIM[this.immersed] : null;
      if (swim) velocityX *= swim.speed;
      // Reeling a fish in holds the Keeper still.
      if (this.line?.phase === 'hooked') velocityX = 0;
      // On a ladder Up (jump) climbs and Down descends; anywhere else Down drops through platforms.
      this.climbing = onLadder(this.terrain, this.player.x, this.player.y, DELVE_BOX);
      if (this.climbing) {
        const climb = this.input.has('down') ? 1 : this.input.has('jump') ? -1 : 0;
        climbTerrainBody(this.player, velocityX, climb, dt, this.terrain, DELVE_BOX, this.areaDef.width);
      } else {
        if (swim && this.input.has('jump') && this.line?.phase !== 'hooked') this.player.vy = Math.max(-swim.rise, this.player.vy - 2400 * dt);
        stepTerrainBody(this.player, velocityX, dt, this.terrain, DELVE_BOX, this.areaDef.platforms, this.areaDef.width, this.input.has('down') || this.dropTime > 0, swim);
      }
    } else advanceBody(this.player, velocityX, dt, this.areaDef.platforms, this.areaDef.width);
    // Coyote time: the clock since the feet last touched; a buffered press jumps on landing.
    if (this.player.grounded && !this.climbing) this.airTime = 0; else if (!this.climbing) this.airTime += dt;
    if (this.jumpBuffer > 0 && this.player.grounded) this.tryJump();
    if (this.terrain) {
      // Holding a tool button keeps working the rock: digging is held, not tapped.
      if (this.input.has('attack') && this.attackCooldown <= 0) this.attack();
      if (this.input.has('blast') && this.blastCooldown <= 0) this.blast();
      this.updateHold(dt);
      this.revealMap(this.terrain);
      this.interactAt = this.findInteractive();
      this.updateFuses(dt);
      this.updateRubble(dt, this.terrain);
      this.updateLooseDust(this.terrain);
      this.updateLiquids(dt, this.terrain);
      this.updateLine(dt, this.terrain);
    } else if (this.sites.length && this.input.has('attack') && this.attackCooldown <= 0 && this.siteInReach()) this.attack();
    const now = this.clock();
    for (const sites of this.siteCache.values()) for (const s of sites) {
      s.shake = Math.max(0, s.shake - dt * 5);
      if (!s.ready) this.refreshSite(s, now);
    }
    if (!wasGrounded && this.player.grounded && !this.climbing) { this.landing = .18; this.atmosphere.burst(this.player.x, this.player.y - 4); }
    if (direction && this.player.grounded && this.elapsed - this.stepAt > .2) {
      this.stepAt = this.elapsed; if (!this.reducedMotion) this.atmosphere.burst(this.player.x - direction * 16, this.player.y - 3);
    }
    for (const drop of this.drops) {
      drop.age += dt;
      if (drop.age > .3 && Math.abs(drop.x - this.player.x) < 65 && Math.abs(this.player.y - drop.y) < 80) {
        if (this.options.onLoot?.({ id: drop.id, coins: drop.coins, ore: drop.ore, material: drop.material }) === false) continue;
        this.atmosphere.burst(drop.x, FLOOR - 45, drop.coins ? `+${drop.coins} coins` : `+${drop.ore} ${drop.short ?? 'ore'}`);
        this.coins += drop.coins; drop.age = -1;
        this.launchFlight(drop);
        if (drop.coins) this.say('play.hud.eng.collectedCoins', `Collected ${drop.coins} coins.`, { n: drop.coins });
        else this.say('play.hud.eng.collected', `Collected ${drop.label ?? 'Cinder Ore'}.`, { name: drop.label ?? 'Cinder Ore' });
      }
    }
    // In place: this runs every fixed step, and drops are few and rarely leave.
    let kept = 0;
    for (const drop of this.drops) if (drop.age >= 0 && drop.age < 120) this.drops[kept++] = drop;
    this.drops.length = kept;
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
      const floor = monster.def.floorY ?? FLOOR, k = this.figure;
      // In a delve a Maw only cares about a Keeper standing in its cavern.
      const away = !!this.terrain && Math.abs(this.player.y - floor) > 120;
      if ((safeX && this.player.x < safeX) || away) {
        monster.x += Math.sign(monster.spawn - monster.x) * Math.min(Math.abs(monster.spawn - monster.x), 65 * dt);
        monster.phase = 'idle'; monster.timer = .5;
        continue;
      }
      const distance = this.player.x - monster.x;
      if (monster.phase === 'idle') {
        if (Math.abs(distance) < 380 * k && Math.abs(distance) > 95 * k) monster.x = Math.max(safeX || 30, monster.x + Math.sign(distance) * 65 * dt);
        const range = monster.def.range;
        if (range) monster.x = Math.max(range[0], Math.min(range[1], monster.x));
        if (Math.abs(distance) < 170 * k && monster.timer <= 0) {
          monster.phase = 'windup'; monster.timer = .85; monster.facing = Math.sign(distance) || -1;
        }
      } else if (monster.timer <= 0) {
        if (monster.phase === 'windup') {
          monster.phase = 'strike'; monster.timer = .2;
          if (Math.abs(distance) < 170 * k && distance * monster.facing > -40 * k && this.player.y > floor - 105 * Math.max(k, .6) && this.player.y < floor + 40 && this.dodgeTime <= 0 && this.hurtTime <= 0) {
            this.hp = Math.max(0, this.hp - 12); this.hurtTime = .8; this.wound = 1;
            this.impact(.07, this.hp === 0 ? 12 : 8);
            if (this.hp === 0) this.say('play.hud.eng.keeperFalls', 'The Keeper falls. Restart the hunt or return to camp.');
          }
        } else if (monster.phase === 'strike') { monster.phase = 'recover'; monster.timer = 1.1; }
        else { monster.phase = 'idle'; monster.timer = .35; }
      }
    }
  }

  /** Fill in the map round the Keeper (once per cell moved), and tell the save. */
  private revealMap(t: Terrain): void {
    const fog = this.fog;
    if (!fog) return;
    const col = t.colAt(this.player.x), row = t.rowAt(this.player.y - DELVE_BOX.height * .5);
    const at = row * t.cols + col;
    if (at === this.fogAt) return;
    this.fogAt = at;
    if (!revealAround(t, fog, col, row)) return;
    const layout = this.layouts.get(this.areaDef.id);
    try { if (layout) this.delve?.explored?.(this.areaDef.id, layout, fog); } catch { /* explored for this session */ }
  }
  /** What the map draws: the delve, its explored cells, the Keeper's cell and the ways out. Null outside a delve. */
  mapSource(): MapSource | null {
    const t = this.terrain, fog = this.fog;
    if (!t || !fog) return null;
    return {
      t, fog,
      keeper: { col: t.colAt(this.player.x), row: t.rowAt(this.player.y - DELVE_BOX.height * .5) },
      shafts: this.stations.filter(station => station.kind === 'passage').map(station => t.colAt(station.x)),
    };
  }
  private report(): void {
    const nearest = this.nearestFoe();
    const station = this.nearbyStation();
    const t = this.terrain;
    const at = !station && t && this.interactAt >= 0 ? this.interactAt : -1;
    // A carved wall reads as 'inscription'; a placed chest or camp by its use.
    const use = at >= 0 ? (t!.inscriptions.has(at) ? 'inscription' : TERRAIN_NODE_LIST[t!.kind[at]].use ?? null) : null;
    const site = !station && !use ? this.siteInReach() : null;
    const need = site ? this.siteNeed(site.def) : null;
    const depth = t ? Math.max(0, Math.floor((this.player.y - t.top) / CELL)) : undefined;
    this.options.onState({ hp: this.hp, enemyHp: nearest ? Math.max(1, Math.round(nearest.hp / nearest.maxHp * 100)) : 0, enemyName: nearest?.def.name, enemyId: nearest?.def.creature,
      ...(this.keyed && this.keyed.en === this.message ? { messageKey: this.keyed.key, ...(this.keyed.vars ? { messageVars: this.keyed.vars } : {}) } : {}),
      nearby: use ?? station?.id ?? (site ? 'gather' : null), nearbyLabel: use ? USE_LABEL[use] : station?.label ?? site?.def.label.toUpperCase(), nearbyKind: station?.kind,
      gather: site ? { id: site.def.id, label: site.def.label, ready: site.ready, seconds: Math.ceil(site.timer), materialId: site.def.yield.materialId, ...(need ? { need } : {}) } : undefined,
      x: Math.round(this.player.x), y: Math.round(this.player.y), paused: this.paused,
      defeated: this.hp <= 0, enemyDefeated: this.guardianDefeated, complete: false, message: this.message,
      coins: this.coins, kills: this.kills, area: this.areaDef.name, areaId: this.areaDef.id,
      facing: this.facing, animation: this.pose(),
      delve: !!t, depth, biome: t && depth !== undefined ? t.biomeAt(depth).name || undefined : undefined,
      ...(t ? {
        liquid: {
          in: LIQUID_IDS[this.immersed] ?? null,
          ...(this.headUnder && this.immersed === LIQUID_WATER || this.breath < this.breathMax ? { breath: this.breath / this.breathMax } : {}),
          ...(this.burning > 0 ? { burning: true } : {}),
          ...(this.wardMax ? { ward: this.lavaWard / this.wardMax } : {}),
        },
        fishing: this.line ? { phase: this.line.phase, liquid: LIQUID_IDS[this.line.liquid] as LiquidKind } : null,
        canFish: this.line ? null : this.fishable(t),
      } : {}) });
  }
  /**
   * The living creature the enemy bar should measure: the nearest one the
   * Keeper could actually meet. In a delve that means on about the Keeper's
   * level and within a screen; on open ground, within a screen and a half.
   * Null when nothing qualifies, and the bar hides.
   */
  private nearestFoe(): Monster | null {
    let best: Monster | null = null, bestDistance = Infinity;
    const delve = !!this.terrain;
    // On a town's safe ground the Maws ignore the Keeper (see the monster step),
    // so nothing is engaged and the HUD's enemy bar stays hidden.
    const safeX = this.areaDef.safeX ?? 0;
    if (safeX && this.player.x < safeX) return null;
    const reach = delve ? 900 : 1500;
    for (const monster of this.monsters) {
      if (monster.hp <= 0) continue;
      const dx = Math.abs(monster.x - this.player.x);
      if (dx > reach) continue;
      if (delve && Math.abs(this.player.y - (monster.def.floorY ?? FLOOR)) > 200) continue;
      if (dx < bestDistance) { best = monster; bestDistance = dx; }
    }
    return best;
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
  /** The one KeeperFeel, refilled by keeperMotion. Each caller uses it before the next call. */
  private readonly motionScratch = { bob: 0, tilt: 0, sx: 1, sy: 1, alpha: 1, sway: 0 };
  private feel(bob: number, tilt: number, sx: number, sy: number, alpha: number, sway: number): { bob: number; tilt: number; sx: number; sy: number; alpha: number; sway: number } {
    const m = this.motionScratch;
    m.bob = bob; m.tilt = tilt; m.sx = sx; m.sy = sy; m.alpha = alpha; m.sway = sway;
    return m;
  }
  /** Whole-figure motion for a Keeper (the painting fallback and the landing squash). Returns the shared scratch object. */
  private keeperMotion(animation: string | undefined, time: number): { bob: number; tilt: number; sx: number; sy: number; alpha: number; sway: number } {
    if (this.reducedMotion) return this.feel(0, 0, 1, 1, animation === 'dodge' ? .5 : 1, 0);
    switch (animation) {
      case 'run': {
        const phase = time * 9;
        const lift = Math.sin(phase);
        return this.feel(lift > 0 ? -lift * 10 : lift * 1.6, Math.cos(phase) * .06,
          1 + Math.max(0, -lift) * .07, 1 - Math.max(0, -lift) * .09, 1, Math.cos(phase) * 5);
      }
      case 'jump': return this.feel(-4, -.1, .94, 1.08, 1, 0);
      case 'fall': return this.feel(2, .08, 1.06, .92, 1, 0);
      case 'attack': return this.feel(0, 0, 1, 1, 1, 0);
      case 'dodge': return this.feel(2, .28, 1.08, .9, .5, 6);
      case 'hurt': return this.feel(1, -.1, 1.08, .92, .55, -3);
      case 'rest': {
        const rock = Math.sin(time * 1.1);
        return this.feel(rock * .6, rock * .015, 1.02, .985, 1, rock * 1.1);
      }
      default: {
        const breath = Math.sin(time * 2.2);
        return this.feel(0, Math.sin(time * 1.3) * .012, 1 + breath * .012, 1 - breath * .018, 1, 0);
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
    gear = false, clock?: SpriteClock, fallen = false,
  ): void {
    trackKeeper(motion, worldX, worldY, this.frameDt);
    const sheet = clock ? this.readySprite('keeper') : null;
    if (sheet && clock) {
      this.drawKeeperSprite(c, sheet, this.readyImage!, box.h / 196, fallen ? 'death' : shown, clock, motion.vx * facing, attackT, swing, armed, feel.rim, gear, time);
      return;
    }
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
  /**
   * The sprite sheet for `id` when it exists AND its image has loaded, else
   * null (the caller keeps its rig or placeholder). Sets `readyImage`. The 2x
   * sheet is chosen on dense screens, the 1x otherwise; either one stands in
   * while the other is still loading.
   */
  private readySprite(id: string): SpriteRenderer | null {
    let sheet = this.sprites.get(id);
    if (sheet === undefined) {
      const entry = (this.options.sprite ?? spriteFor)(id);
      sheet = entry ? new SpriteRenderer(entry) : null;
      this.sprites.set(id, sheet);
    }
    if (!sheet) return null;
    const sharp = this.pixelScale > 1.25;
    const first = this.urlImage(sharp ? sheet.entry.src2x : sheet.entry.src);
    let image = first?.complete && first.naturalWidth ? first : undefined;
    if (!image) {
      const other = this.urlImage(sharp ? sheet.entry.src : sheet.entry.src2x);
      image = other?.complete && other.naturalWidth ? other : undefined;
    }
    this.readyImage = image;
    return image ? sheet : null;
  }
  /**
   * A Keeper from the sprite sheet: the state picks the action, the attack
   * plays its frames across the game's attack window, gear rides the per-frame
   * hand anchors. The context is already at the feet and flipped to face.
   */
  private drawKeeperSprite(
    c: CanvasRenderingContext2D, sheet: SpriteRenderer, image: HTMLImageElement, scale: number,
    shown: string | undefined, clock: SpriteClock, speed: number, attackT: number, swing: number, armed: boolean, rim: number, gear: boolean, time: number,
  ): void {
    const wanted = shown ?? 'idle';
    const action = sheet.action(wanted, KEEPER_SPRITE_FALLBACKS[wanted]) ?? 'idle';
    const act = sheet.entry.actions[action];
    const into = tickClock(clock, action, this.reducedMotion ? 0 : this.elapsed);
    const frame = !act ? 0 : action === 'attack' ? frameAtProgress(act, attackT) : this.reducedMotion ? 0 : frameAt(act, into);
    const aura = gear ? this.loadout.auraRarity : null;
    if (aura) this.drawAura(c, aura, time);
    const hand = this.spriteHand;
    const offhand = gear ? this.loadout.offhand : null;
    const offhandImage = this.heldImage(offhand);
    if (offhand && offhandImage) {
      if (!sheet.anchor(action, 'hand_back', frame, false, hand, scale)) { hand.x = -16 * scale; hand.y = -100 * scale; hand.angled = false; }
      heldTransform(hand.x, hand.y, -Math.PI / 2 + (hand.angled ? hand.rotation : 0), offhand, OFFHAND_DEFAULTS, this.held);
      this.drawHeld(c, offhandImage);
    }
    if (!this.reducedMotion && Math.abs(speed) > 420) {
      // Smear: two fading after-images trail the direction of travel.
      const reach = Math.min(1, (Math.abs(speed) - 420) / 300);
      c.save(); c.shadowBlur = 0;
      const alpha = c.globalAlpha;
      c.globalAlpha = alpha * .1 * reach; sheet.draw(c, image, action, frame, this.spriteOpts(scale, -speed * .04));
      c.globalAlpha = alpha * .22 * reach; sheet.draw(c, image, action, frame, this.spriteOpts(scale, -speed * .02));
      c.restore();
    }
    sheet.draw(c, image, action, frame, this.spriteOpts(scale));
    if (rim > .01) {
      // Rim light: an additive copy nudged toward the light brightens the leading edge.
      c.save(); c.shadowBlur = 0; c.filter = 'none';
      c.globalCompositeOperation = 'lighter'; c.globalAlpha *= Math.min(1, rim) * .45;
      sheet.draw(c, image, action, frame, this.spriteOpts(scale, 1.6, -1.2));
      c.restore();
    }
    const weapon = gear ? this.loadout.weapon : null;
    const weaponImage = this.heldImage(weapon);
    if (!weaponImage && !armed) return;
    // The authored angle wins; a frame without one swings like the rig did.
    let rotation = -.95 + swing * 1.85;
    if (sheet.anchor(action, 'hand_front', frame, false, hand, scale)) { if (hand.angled) rotation = hand.rotation; }
    else { hand.x = (22 + Math.max(0, swing) * 16) * scale; hand.y = -96 * scale; }
    if (weapon && weaponImage) {
      heldTransform(hand.x, hand.y, aimFromBladeRotation(rotation), weapon, WEAPON_DEFAULTS, this.held);
      this.drawHeld(c, weaponImage, attackT > .3 ? 1.06 : 1);
    } else {
      c.save();
      c.translate(hand.x, hand.y); c.rotate(rotation);
      if (attackT > .3) c.scale(1.06, 1.06);
      this.art('blade', -8, -78, 58, 92);
      c.restore();
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
    flight.sx = (drop.x - this.camera) * scale; flight.sy = (drop.y - 18 - this.cameraY) * scale;
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
    c.beginPath(); c.ellipse(drop.x, drop.y + 1, 26, 6, 0, 0, Math.PI * 2); c.fill();
    c.translate(drop.x, drop.y); c.scale(1, drop.beam * grow);
    c.fillStyle = gradient;
    c.globalAlpha = .45 * pulse; c.fillRect(-13, -1, 26, 1);
    c.globalAlpha = pulse; c.fillRect(-3.5, -1, 7, 1);
    c.restore();
  }
  /** The drop's name, shown while the Keeper stands near it or the pointer is over it. */
  private drawDropCaption(c: CanvasRenderingContext2D, drop: Drop, y: number): void {
    const near = Math.abs(drop.x - this.player.x) < 170 && Math.abs(this.player.y - drop.y) < 120;
    const pointed = Math.abs(drop.x - this.pointerX) < 45 && Math.abs(drop.y - 30 - this.pointerY) < 70;
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
          c.shadowColor = this.restored ? '#b8e6ec' : '#f29b68'; c.shadowBlur = this.blur(35);
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
    // Near a station the HUD's action bar already says "Interact E"; a second
    // "[ E ] INTERACT" here sat under that bar and was clipped. Only the hover
    // cue remains, drawn over the station, clear of the bar (STATION_CUE_Y).
    if (hovered && !near) { c.fillStyle = '#e7d3b4'; c.fillText('CLICK TO WALK HERE', x, STATION_CUE_Y); }
  }
  /**
   * A gathering node, drawn in code: a herb patch, a tree or an outcrop. Ready,
   * it carries its material's art and a soft glow that breathes (held still
   * under reduced motion); harvested, it is a dim stump with a ring filling
   * as it grows back. Render-only.
   */
  private drawSite(c: CanvasRenderingContext2D, site: GatherSite, near: boolean, time: number): void {
    const def = site.def, x = def.x + (this.reducedMotion ? 0 : Math.sin(time * 60) * site.shake * 2.5);
    const ready = site.ready, glow = SITE_GLOW[def.kind];
    c.save();
    if (ready) {
      c.globalAlpha = (near ? .5 : .28) * (this.reducedMotion ? 1 : .8 + Math.sin(time * 2.4 + def.x) * .2);
      c.fillStyle = glow;
      c.beginPath(); c.ellipse(x, FLOOR + 2, def.kind === 'wood' ? 58 : 44, 10, 0, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
    } else c.globalAlpha = .55;
    if (def.kind === 'wood') {
      const h = ready ? 150 : 34;
      c.fillStyle = '#4a3324'; c.fillRect(x - 11, FLOOR - h, 22, h);
      c.fillStyle = '#7a5a36'; c.fillRect(x - 11, FLOOR - h, 4, h);
      if (ready) {
        c.fillStyle = '#2f4a2c'; c.beginPath(); c.arc(x, FLOOR - h, 46, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#4c6e3a'; c.beginPath(); c.arc(x - 16, FLOOR - h - 10, 26, 0, Math.PI * 2); c.arc(x + 18, FLOOR - h + 4, 24, 0, Math.PI * 2); c.fill();
      } else { c.fillStyle = '#c9a06a'; c.beginPath(); c.ellipse(x, FLOOR - h, 11, 4, 0, 0, Math.PI * 2); c.fill(); }
    } else if (def.kind === 'ore') {
      const lift = ready ? 1 : .32;
      c.fillStyle = '#3f3440'; c.beginPath(); c.moveTo(x - 40, FLOOR); c.lineTo(x - 30, FLOOR - 48 * lift); c.lineTo(x - 4, FLOOR - 62 * lift); c.lineTo(x + 26, FLOOR - 44 * lift); c.lineTo(x + 40, FLOOR); c.closePath(); c.fill();
      c.strokeStyle = '#6b5a6e'; c.lineWidth = 2; c.stroke();
      if (ready) { c.fillStyle = glow; for (const [dx, dy] of SITE_NUGGETS) c.fillRect(x + dx - 3, FLOOR + dy - 3, 6, 6); }
    } else {
      c.strokeStyle = ready ? '#5f8a46' : '#5a4a36'; c.lineWidth = 3;
      for (let i = -3; i <= 3; i++) {
        const h = ready ? 34 + (i & 1) * 12 : 8;
        c.beginPath(); c.moveTo(x + i * 6, FLOOR); c.quadraticCurveTo(x + i * 9, FLOOR - h * .6, x + i * 11, FLOOR - h); c.stroke();
      }
      if (ready) { c.fillStyle = glow; for (let i = -2; i <= 2; i += 2) { c.beginPath(); c.arc(x + i * 11, FLOOR - 40 - Math.abs(i) * 2, 5, 0, Math.PI * 2); c.fill(); } }
    }
    c.globalAlpha = 1;
    const iconY = FLOOR - (def.kind === 'wood' ? 228 : 104);
    if (ready) {
      c.shadowColor = glow; c.shadowBlur = this.blur(near ? 18 : 10);
      if (!this.art(def.yield.materialId, x - 15, iconY, 30, 30)) { c.fillStyle = glow; c.beginPath(); c.arc(x, iconY + 15, 8, 0, Math.PI * 2); c.fill(); }
      c.shadowBlur = 0;
    } else {
      // Regrowth: a ring filling clockwise as the node comes back.
      const share = 1 - site.timer / Math.max(1, def.respawn);
      c.lineWidth = 4;
      c.strokeStyle = '#3a3040'; c.beginPath(); c.arc(x, iconY + 15, 12, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = glow; c.beginPath(); c.arc(x, iconY + 15, 12, -Math.PI / 2, -Math.PI / 2 + share * Math.PI * 2); c.stroke();
    }
    if (near) {
      c.font = '600 12px system-ui'; c.textAlign = 'center'; c.fillStyle = '#fff1c9';
      c.fillText(def.label.toUpperCase(), x, FLOOR + 35);
      const need = ready ? this.siteNeed(def) : null;
      c.fillStyle = need ? '#ffb39a' : '#fff0cb';
      // Over the node's icon, not under its label: the floor band is the action bar's (SITE_CUE_RISE).
      c.fillText(!ready ? `GROWING BACK ${Math.ceil(site.timer)}s` : need ? `NEEDS ${need.toUpperCase()}` : '[ J / E ] GATHER', x, iconY - SITE_CUE_RISE);
    }
    c.restore();
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
    c.shadowColor = '#ffb46a'; c.shadowBlur = this.blur(hot ? 28 : 12);
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
    c.shadowColor = '#c9a0ff'; c.shadowBlur = this.blur(18 + pulse * 18 + (hot ? 12 : 0));
    if (!this.art(station.art, x - 34, FLOOR - 252, 68, 68)) { c.fillStyle = '#c9a0ff'; c.beginPath(); c.arc(x, FLOOR - 214, 16, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
  /**
   * Phones only (render-budget.ts `cacheBackdrop`): a town's or hunt's backdrop
   * (the floor colour, the scene painting at 94% and the dusk shade) composed
   * once into an offscreen canvas at the device's pixel scale, then laid down
   * each frame as ONE unscaled blit at the parallax offset. Uncached that is a
   * full-screen scaled image draw plus a full-screen gradient fill every frame,
   * the two largest fills in a town. Exact, not approximate: the same three
   * operations in the same order, only baked. The shade is vertical-only and a
   * town's camera never moves vertically, which is what makes it bakeable; the
   * Delve (vertical camera) keeps the live path. Rebuilt when the painting,
   * the view width or the pixel scale changes. False when no canvas can be made.
   */
  private backdrop: { canvas: HTMLCanvasElement; image: HTMLImageElement; width: number; scale: number } | null = null;
  private backdropFailed = false;
  private drawCachedBackdrop(c: CanvasRenderingContext2D, bg: HTMLImageElement, viewport: number): boolean {
    if (this.backdropFailed) return false;
    const bgWidth = Math.max(viewport + 500, 720 * bg.naturalWidth / bg.naturalHeight);
    const ps = this.pixelScale;
    let cache = this.backdrop;
    if (!cache || cache.image !== bg || cache.width !== bgWidth || cache.scale !== ps) {
      const canvas = cache?.canvas ?? (typeof document !== 'undefined' && typeof document.createElement === 'function' ? document.createElement('canvas') : null);
      const b = canvas?.getContext('2d');
      if (!canvas || !b) { this.backdropFailed = true; return false; }
      canvas.width = Math.ceil(bgWidth * ps); canvas.height = Math.ceil(720 * ps);
      b.setTransform(ps, 0, 0, ps, 0, 0);
      b.fillStyle = '#11101a'; b.fillRect(0, 0, bgWidth, 720);
      b.globalAlpha = .94; b.drawImage(bg, 0, 0, bgWidth, 720); b.globalAlpha = 1;
      b.fillStyle = this.sceneShade(b); b.fillRect(0, 0, bgWidth, 720);
      cache = this.backdrop = { canvas, image: bg, width: bgWidth, scale: ps };
    }
    const ox = -this.camera * .16;
    c.drawImage(cache.canvas, ox, 0, bgWidth, 720);
    // A very wide area can pan past the painting's right edge: that strip is floor and shade, as before.
    if (ox + bgWidth < viewport) {
      c.fillStyle = '#11101a'; c.fillRect(ox + bgWidth, 0, viewport - ox - bgWidth, 720);
      c.fillStyle = this.sceneShade(c); c.fillRect(ox + bgWidth, 0, viewport - ox - bgWidth, 720);
    }
    return true;
  }
  /** The warm-to-dusk wash over every scene. Built once per context rather than every frame. */
  private readonly shades = new WeakMap<CanvasRenderingContext2D, CanvasGradient>();
  private sceneShade(c: CanvasRenderingContext2D): CanvasGradient {
    let gradient = this.shades.get(c);
    if (!gradient) {
      gradient = c.createLinearGradient(0, 0, 0, 720); gradient.addColorStop(0, '#b97a4530'); gradient.addColorStop(1, '#30232b99');
      this.shades.set(c, gradient);
    }
    return gradient;
  }
  private render(): void {
    const c = this.context; const scale = this.height / 720; const viewport = this.width / scale;
    this.pixelScale = scale * this.pixelRatio;
    this.camera = Math.max(0, Math.min(this.areaDef.width - viewport, this.player.x - viewport * .38));
    const t = this.terrain;
    if (t) {
      // Delves follow the Keeper down; the surface sits low in the frame at the top.
      const target = Math.max(0, Math.min(t.bottom + 40 - 720, this.player.y - 720 * .58));
      this.cameraY += (target - this.cameraY) * (this.reducedMotion ? 1 : 1 - Math.exp(-7 * this.frameDt));
    } else this.cameraY = 0;
    c.clearRect(0, 0, this.width, this.height); c.save(); c.scale(scale, scale);
    const bg = this.sceneImage();
    // Imported parallax layers replace the painting once every one of them has loaded (RND-2).
    const layered = !t && this.parallax.draw(c, this.town.realm, this.camera, viewport, FLOOR, this.pixelScale > 1.25);
    const cached = !t && !layered && !!bg?.complete && !!bg.naturalWidth && this.budget.cacheBackdrop && this.drawCachedBackdrop(c, bg, viewport);
    // Below a delve's surface the distant cave fills the frame (it shows through the caverns);
    // the town painting and its shade are drawn only while the surface is in view.
    const underground = !!t && t.top - this.cameraY <= 0;
    if (!cached && !underground && !layered) {
      c.fillStyle = '#11101a'; c.fillRect(0, 0, viewport, 720);
      if (bg?.complete && bg.naturalWidth) {
        const bgWidth = Math.max(viewport + 500, 720 * bg.naturalWidth / bg.naturalHeight);
        c.globalAlpha = t ? .5 : .94; c.drawImage(bg, -this.camera * .16, -this.cameraY * .6, bgWidth, 720); c.globalAlpha = 1;
      }
      c.fillStyle = this.sceneShade(c); c.fillRect(0, 0, viewport, 720);
    }
    if (t) this.caveBackdrop.draw(c, t, this.camera, this.cameraY, viewport, 720);
    const jolt = this.shake > 0 ? this.shake : 0;
    c.translate(-this.camera + (jolt ? (Math.random() * 2 - 1) * jolt : 0), -this.cameraY + (jolt ? (Math.random() * 2 - 1) * jolt * .6 : 0));
    const motionTime = this.reducedMotion ? 0 : this.elapsed;
    const k = this.figure;
    // Towns and their hunting grounds carry the realm's ambient layer; delves have their own motes.
    if (!t) this.atmosphere.scenery(c, motionTime, this.camera, viewport, this.town.realm);
    // A delve's only platform is the net under its bedrock: nothing to draw.
    if (!t) for (const platform of this.areaDef.platforms) {
      const depth = platform.y === FLOOR ? 110 : 24;
      if (platform.x + platform.width < this.camera || platform.x > this.camera + viewport) continue;
      if (this.ground.draw(c, this.town.realm, platform.x, platform.y, platform.width, depth)) continue;
      c.fillStyle = '#3b3034'; c.fillRect(platform.x, platform.y, platform.width, depth);
      c.fillStyle = '#a67858'; c.fillRect(platform.x, platform.y, platform.width, 4);
      c.fillStyle = '#f6a668'; c.fillRect(platform.x + 8, platform.y, Math.max(0, platform.width - 16), 1);
      for (let x = platform.x + 18; x < platform.x + platform.width; x += 65) { c.fillStyle = '#3c3039'; c.fillRect(x, platform.y + 12, 32, 7); }
    }
    if (this.isTown && this.areaDef.scenery === 'seamworks-hub') this.atmosphere.hub(c, motionTime, this.areaDef.safeX || 1120);
    if (t) this.terrainRenderer.draw(c, this.camera, this.cameraY, viewport, 720, this.pixelScale);
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
    if (this.sites.length) {
      const near = this.nearbyStation() ? null : this.siteInReach();
      for (const site of this.sites) {
        if (site.def.x < this.camera - 120 || site.def.x > this.camera + viewport + 120) continue;
        this.drawSite(c, site, site === near, motionTime);
      }
    }
    if (this.isTown) {
      const f = this.lifeFrame;
      f.camera = this.camera; f.viewport = viewport; f.time = motionTime; f.reduced = this.reducedMotion;
      f.playerX = this.player.x; f.pixelScale = this.pixelScale;
      this.life.draw(c, f);
    }
    if (!t) this.debris.draw(c);
    for (const drop of this.drops) this.drawDropBeam(c, drop, motionTime);
    for (const drop of this.drops) {
      // Spilled from the body: an arc out and a short bounce, then the idle bob.
      const t = Math.min(1, drop.age / .5);
      const arc = this.reducedMotion ? 0 : t < .7 ? Math.sin(t / .7 * Math.PI) * 70 : Math.sin((t - .7) / .3 * Math.PI) * 12;
      const fling = this.reducedMotion ? 0 : drop.spin * 24 * (1 - t);
      const y = drop.y - 18 - arc + (t < 1 ? 0 : Math.sin(motionTime * 5 + drop.x) * 4);
      c.save(); c.translate(-fling, 0);
      c.shadowBlur = this.blur(14); c.shadowColor = drop.color;
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
      // A sprite sheet faces right and stands on its pivot; a painting has its own box and facing.
      const sheet = this.readySprite(monster.def.creature);
      const floor = monster.def.floorY ?? FLOOR;
      const crown = floor - ((sheet ? sheet.entry.pivotY : rigDef.box.h) + 20) * k;
      if (warning) {
        c.fillStyle = monster.phase === 'strike' ? '#ff765caa' : '#ff765c40';
        c.fillRect(monster.facing < 0 ? monster.x - 170 * k : monster.x, floor - 10, 170 * k, 10);
        c.fillStyle = '#ffc589'; c.font = 'bold 18px system-ui'; c.textAlign = 'center'; c.fillText('!', monster.x, crown - 20);
      }
      const rise = monster.born > 0 ? 1 - monster.born / SPAWN_RISE : 1;
      if (!t) this.groundShadow(c, monster.x + monster.knock, FLOOR, rigDef.shadow * (.6 + rise * .4));
      // Turn the painting toward its target. Purely a drawing choice.
      const looking = monster.phase === 'idle' ? Math.sign(this.player.x - monster.x) || monster.facing : monster.facing;
      const mirror = sheet ? looking < 0 : rigDef.facesLeft ? looking > 0 : looking < 0;
      c.save(); c.translate(monster.x + monster.knock, floor);
      c.globalAlpha = rise; c.scale((.6 + rise * .4) * (mirror ? -1 : 1) * k, (.6 + rise * .4) * k);
      this.creature(c, monster.flash > 0, monster.def.creature, monster);
      c.restore();
      // The chip bar trails the real HP so a hit reads as a chunk taken.
      const full = monster.maxHp || 1, bar = 90 * Math.max(k, .7);
      c.fillStyle = '#302530'; c.fillRect(monster.x - bar / 2, crown, bar, 6);
      c.fillStyle = '#ffe2c4'; c.fillRect(monster.x - bar / 2, crown, Math.max(monster.hp, monster.shownHp) / full * bar, 6);
      c.fillStyle = '#dd866f'; c.fillRect(monster.x - bar / 2, crown, monster.hp / full * bar, 6);
    }
    for (const view of this.peers.values()) {
      if (view.peer.area !== this.areaDef.name || view.x < this.camera - 160 || view.x > this.camera + viewport + 160) continue;
      // Spawn puts every Keeper on the same tile. Spread guests so names and sprites stay readable.
      const spread = (([...view.peer.id].reduce((hash, char) => (hash * 33 + char.charCodeAt(0)) >>> 0, 0) % 5) - 2) * 46;
      if (!t) this.groundShadow(c, view.x + spread, view.y, 40);
      c.save(); c.translate(view.x + spread, view.y); if (k !== 1) c.scale(k, k);
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
      c.shadowColor = warm ? '#ffc27a' : '#deb8f3'; c.shadowBlur = this.blur(warm ? 12 : 6); c.filter = 'none';
      this.drawKeeper(c, { x: -70, y: -176, w: 140, h: 176 }, shown, motionTime + view.x, view.motion, view.x, view.y, view.facing,
        attackT, swing, false, { landing: 0, recoil: shown === 'hurt' ? .6 : 0, rim: 0 }, motion, false, view.clock);
      c.restore();
    }
    // Keep the player readable against the dark realm art at narrow viewport sizes.
    const byFire = this.isTown && this.areaDef.scenery === 'seamworks-hub' && Math.abs(this.player.x - 245) < 220;
    if (!t) this.groundShadow(c, this.player.x, this.player.y, 44);
    c.save(); c.translate(this.player.x, this.player.y); if (k !== 1) c.scale(k, k);
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
    c.save(); c.translate(this.player.x, this.player.y); c.scale(this.facing * k, k);
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
    c.shadowColor = shown === 'rest' ? '#ffc27a' : '#b8e6ec'; c.shadowBlur = this.blur(shown === 'rest' ? 12 : 6);
    c.filter = 'none';
    const strikeGlow = attackT > .3 ? Math.max(0, 1 - Math.abs(attackT - .45) / .2) : 0;
    this.drawKeeper(c, { x: -78, y: -196, w: 156, h: 196 }, shown, motionTime, this.playerMotion, this.player.x, this.player.y, this.facing,
      attackT, swing, this.equipped, {
        landing: this.landing > 0 ? this.landing / .18 : 0,
        recoil: this.hp <= 0 ? 1 : Math.max(0, Math.min(1, this.hurtTime / .8)),
        rim: Math.max(strikeGlow, this.wound * .9),
      }, motion, true, this.playerClock, this.hp <= 0);
    c.filter = 'none'; c.shadowBlur = 0; c.globalAlpha = 1;
    if (attackT > .3) {
      const u = (attackT - .3) / .7;
      c.save(); c.shadowColor = '#ffe7c2'; c.shadowBlur = this.blur(12); c.lineCap = 'round';
      c.globalAlpha = .35 * (1 - u); c.strokeStyle = '#ffb46a'; c.lineWidth = 14;
      c.beginPath(); c.arc(24, -82, 100, -1.05, -1.05 + Math.max(0, u - .12) * 2.15); c.stroke();
      c.globalAlpha = .92 * (1 - u * .35); c.strokeStyle = '#ffd7a1'; c.lineWidth = 6;
      c.beginPath(); c.arc(24, -82, 94, -1.1, -1.1 + u * 2.2); c.stroke();
      c.strokeStyle = '#fff6ea'; c.lineWidth = 2; c.stroke();
      c.restore();
    }
    c.restore();
    if (t) {
      // Liquids over the figures (a wading Keeper reads as in the water), under the darkness.
      const c0 = t.colAt(this.camera) - 1, c1 = t.colAt(this.camera + viewport) + 1;
      const r0 = t.rowAt(this.cameraY) - 1, r1 = t.rowAt(this.cameraY + 720) + 1;
      drawLiquids(c, t, c0, c1, r0, r1, this.reducedMotion ? 0 : Math.floor(this.elapsed * 2.5) & 1);
      this.drawLine(c, motionTime);
    }
    if (t) this.drawDelveLight(c, t, scale, viewport, motionTime);
    this.drawGlim(c, motionTime);
    if (t) this.drawAim(c, t);
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
  /**
   * Glim, over everything in the world (in the Delve, over the darkness: it is
   * the light). It dims beside a living Mirror Substitute, the Atlas moth's
   * tell for a thing that performs certainty.
   */
  private drawGlim(c: CanvasRenderingContext2D, time: number): void {
    const g = this.glim;
    if (!g.shown) return;
    g.update({ dt: this.frameDt, time, reduced: this.reducedMotion, keeperX: this.player.x, keeperY: this.player.y, facing: this.facing, figure: this.figure, delve: !!this.terrain });
    g.dim = this.monsters.some(m => m.hp > 0 && m.def.creature === 'mirror-substitute' && Math.abs(m.x - this.player.x) < 480);
    g.draw(c, time, this.reducedMotion, this.budget.glows, this.figure);
  }
  /**
   * Delve light, in world space: debris, then the darkness overlay with the
   * lantern, exposed glowing cells and the blast's flash punched out of it,
   * then glints of veins near the lantern and the blast beam over the dark.
   */
  private drawDelveLight(c: CanvasRenderingContext2D, t: Terrain, scale: number, viewport: number, time: number): void {
    this.debris.draw(c);
    const pool = this.lightPool; pool.clear(); this.glintCount = 0;
    const flicker = this.reducedMotion ? 1 : 1 + Math.sin(time * 13) * .015 + Math.sin(time * 7.3 + 1) * .02;
    // A veiled creature (the Drowned Lamp) dims the lantern while it lives.
    pool.add(this.player.x, this.player.y - 50, this.lanternRadius * flicker * (this.veiledUp() ? .55 : 1), 1);
    if (this.cameraY < t.top) for (let x = 0; x < viewport + 400; x += 360) pool.add(this.camera - 200 + x, t.top - 160, 460, .85);
    if (this.blastFlash > 0) {
      const at = this.blastAt;
      pool.add(at.x + at.dx * at.range * .6, at.y + at.dy * at.range * .6, at.range * 1.5 * this.blastFlash, this.blastFlash);
    }
    // A lit fuse throws a flickering light of its own.
    for (const fuse of this.fuses) {
      const col = fuse.index % t.cols, row = (fuse.index - col) / t.cols;
      pool.add((col + .5) * CELL, t.top + row * CELL + 6, 70 + (this.reducedMotion ? 0 : Math.sin(time * 31) * 10), .75);
    }
    const c0 = Math.max(0, t.colAt(this.camera)), c1 = Math.min(t.cols - 1, t.colAt(this.camera + viewport));
    const r0 = Math.max(0, t.rowAt(this.cameraY)), r1 = Math.min(t.rows - 1, t.rowAt(this.cameraY + 720));
    const reach = this.lanternRadius * 1.6;
    let haloCount = 0;
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const node = TERRAIN_NODE_LIST[t.kind[t.index(col, row)]];
        if (!node.glow) continue;
        const x = (col + .5) * CELL, y = t.top + (row + .5) * CELL;
        // Placed torches always burn; a vein glows once a tunnel exposes it.
        const lift = glowIntensity(node, node.solid && t.exposed(col, row));
        if (lift > 0) {
          pool.add(x, y, node.glow.radius * 1.6, lift);
          if (haloCount < this.halosAt.length) this.halosAt[haloCount++] = t.index(col, row);
        }
        if (this.glintCount < this.glints.length && Math.hypot(x - this.player.x, y - this.player.y + 50) < reach) this.glints[this.glintCount++] = t.index(col, row);
      }
    }
    // The biome under the middle of the view sets the dark, the wash, the air.
    const biome = t.biomeAt(t.rowAt(this.cameraY + 360));
    // Desktop: a soft-light wash. Phone (render-budget.ts): a plain tint at the biome's own alpha, which
    // costs a fill instead of a read-back of every pixel; the darkness laid over it next keeps the blacks.
    // On a phone that tint rides inside the darkness overlay (DarknessLayer.draw `under`): same pixels,
    // one full-frame blend fewer.
    const wash = biome.wash.alpha > 0 ? biome.wash : null;
    if (wash && this.budget.blendModes) {
      c.save();
      c.globalCompositeOperation = 'soft-light'; c.globalAlpha = wash.alpha * 2.5;
      c.fillStyle = wash.color; c.fillRect(this.camera, this.cameraY, viewport, 720);
      c.restore();
    }
    const fold = wash && !this.budget.blendModes ? wash : undefined;
    const count = selectLights(pool.lights, pool.count, LIGHT_CAP, this.player.x, this.player.y);
    // Lava lights its cavern from its own surface: extra grid sources, outside the capped slots.
    this.lavaPool.clear();
    lavaLights(t, c0, c1, r0, r1, this.lavaPool, flicker);
    c.save();
    c.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    const dark = this.darkness.draw(c, this.width, this.height, scale, this.camera, this.cameraY, pool.lights, count, ambientDarkness(this.cameraY + 360 - t.top), biome.dark, fold, this.budget.smoothDarkness, this.rockShade.update(t), WARM_LIGHT, this.lavaPool.lights, this.lavaPool.count);
    c.restore();
    if (fold && !dark) {
      // No overlay canvas: the tint on its own, as before.
      c.save(); c.globalAlpha = fold.alpha;
      c.fillStyle = fold.color; c.fillRect(this.camera, this.cameraY, viewport, 720);
      c.restore();
    }
    c.save(); c.globalCompositeOperation = this.budget.blendModes ? 'lighter' : 'source-over';
    // Coloured light from exposed glowing cells: glowcaps wash the Grotto blue, embers the Halls red.
    for (let n = 0; n < haloCount; n++) {
      const index = this.halosAt[n], col = index % t.cols, row = (index - col) / t.cols;
      const glow = TERRAIN_NODE_LIST[t.kind[index]].glow;
      if (!glow) continue;
      const pulse = this.reducedMotion ? 1 : .85 + .15 * Math.sin(time * 1.7 + index * .37);
      // Placed lights (torches, the camp fire) throw a stronger warm pool than a glowing vein.
      const placed = !TERRAIN_NODE_LIST[t.kind[index]].solid;
      this.halos.halo(c, (col + .5) * CELL, t.top + (row + .5) * CELL, glow.radius * (placed ? 1.2 : 1.4), glow.color, (placed ? .3 : .2) * pulse, !this.budget.blendModes);
    }
    if (biome.shimmer) {
      // Heat rising: slow columns of warm air. Still under reduced motion.
      for (let n = 0; n < 4; n++) {
        const drift = this.reducedMotion ? 0 : Math.sin(time * .6 + n * 1.9) * 40;
        const x = this.camera + (n + .5) * viewport / 4 - 70 + drift;
        this.halos.band(c, x, this.cameraY, 140, 720, biome.wash.color, .05 + (this.reducedMotion ? 0 : .02 * Math.sin(time * 1.3 + n)));
      }
    }
    this.motes.update(this.frameDt, biome, this.camera, this.cameraY, viewport, 720, this.reducedMotion);
    this.motes.draw(c);
    for (let n = 0; n < this.glintCount; n++) {
      const index = this.glints[n], col = index % t.cols, row = (index - col) / t.cols;
      const kind = t.kind[index];
      const node: TerrainNodeDef = TERRAIN_NODE_LIST[kind];
      // On the nugget's brightest art pixel when the tile has one (tile-art.ts), else the cell's centre.
      const spark = node.solid ? sparkleOffset(kind, tileVariant(col, row)) : -1;
      const x = spark >= 0 ? col * CELL + (spark % TILE) * ART + ART / 2 : (col + .5) * CELL;
      const y = spark >= 0 ? t.top + row * CELL + Math.floor(spark / TILE) * ART + ART / 2 : t.top + (row + .5) * CELL;
      const near = 1 - Math.hypot(x - this.player.x, y - this.player.y + 50) / reach;
      const twinkle = this.reducedMotion ? .7 : .5 + .5 * Math.sin(time * 3 + index * 1.7);
      c.globalAlpha = Math.max(0, near) * twinkle;
      c.fillStyle = node.glow?.color ?? '#fff';
      // A pixel star: a centre art pixel and two-pixel arms, the arms dimmer.
      c.fillRect(x - ART / 2, y - ART / 2, ART, ART);
      c.globalAlpha *= .6;
      c.fillRect(x - ART * 2.5, y - ART / 2, ART * 2, ART); c.fillRect(x + ART / 2, y - ART / 2, ART * 2, ART);
      c.fillRect(x - ART / 2, y - ART * 2.5, ART, ART * 2); c.fillRect(x - ART / 2, y + ART / 2, ART, ART * 2);
    }
    this.drawFusesAndRubble(c, t, time);
    if (this.blastTime > 0) {
      const at = this.blastAt, u = 1 - this.blastTime / BLAST_TIME;
      const ex = at.x + at.dx * at.range, ey = at.y + at.dy * at.range;
      const px = -at.dy * at.range * .5, py = at.dx * at.range * .5;
      c.globalAlpha = .35 * (1 - u); c.fillStyle = '#c9a0ff';
      c.beginPath(); c.moveTo(at.x, at.y); c.lineTo(ex + px, ey + py); c.lineTo(ex - px, ey - py); c.closePath(); c.fill();
      c.globalAlpha = 1 - u; c.strokeStyle = '#f3e6ff'; c.lineWidth = 5 * (1 - u) + 1;
      c.beginPath(); c.moveTo(at.x, at.y); c.lineTo(ex, ey); c.stroke();
    }
    c.restore();
  }
  /**
   * Over the dark: each lit charge's spark and the ring it will clear (filling
   * in as the fuse burns down), and falling rubble.
   */
  /**
   * The smart cursor: the cells within reach outlined faintly round the Keeper,
   * and the aimed cell framed (gold in reach, pale out of it). On the 2 px art
   * grid: every edge is a whole art pixel.
   */
  private drawAim(c: CanvasRenderingContext2D, t: Terrain): void {
    const aim = this.aimCell();
    if (!aim || this.paused || this.hp <= 0) return;
    const { col: ac, row: ar, inReach } = aim;
    const pc = t.colAt(this.player.x), pr = t.rowAt(this.player.y - DELVE_BOX.height * .5), span = Math.ceil(REACH_CELLS) + 1;
    const reach = (col: number, row: number) => t.inside(col, row) && this.inReach(col, row);
    c.fillStyle = 'rgba(232, 200, 152, .28)';
    for (let row = pr - span; row <= pr + span; row++) {
      for (let col = pc - span; col <= pc + span; col++) {
        if (!reach(col, row)) continue;
        const x = col * CELL, y = t.top + row * CELL;
        if (!reach(col, row - 1)) c.fillRect(x, y, CELL, ART);
        if (!reach(col, row + 1)) c.fillRect(x, y + CELL - ART, CELL, ART);
        if (!reach(col - 1, row)) c.fillRect(x, y, ART, CELL);
        if (!reach(col + 1, row)) c.fillRect(x + CELL - ART, y, ART, CELL);
      }
    }
    const x = ac * CELL, y = t.top + ar * CELL;
    // A dark rim inside, then the frame, then corner ticks outside: reads on any rock.
    c.fillStyle = 'rgba(20, 10, 31, .7)';
    c.fillRect(x + ART, y + ART, CELL - ART * 2, ART); c.fillRect(x + ART, y + CELL - ART * 2, CELL - ART * 2, ART);
    c.fillRect(x + ART, y + ART, ART, CELL - ART * 2); c.fillRect(x + CELL - ART * 2, y + ART, ART, CELL - ART * 2);
    c.fillStyle = inReach ? '#e8c898' : 'rgba(248, 232, 200, .45)';
    c.fillRect(x, y, CELL, ART); c.fillRect(x, y + CELL - ART, CELL, ART); c.fillRect(x, y, ART, CELL); c.fillRect(x + CELL - ART, y, ART, CELL);
    if (inReach) {
      const k = ART * 3;
      c.fillRect(x - ART, y - ART, k, ART); c.fillRect(x - ART, y - ART, ART, k);
      c.fillRect(x + CELL - k + ART, y - ART, k, ART); c.fillRect(x + CELL, y - ART, ART, k);
      c.fillRect(x - ART, y + CELL, k, ART); c.fillRect(x - ART, y + CELL - k + ART, ART, k);
      c.fillRect(x + CELL - k + ART, y + CELL, k, ART); c.fillRect(x + CELL, y + CELL - k + ART, ART, k);
    }
  }
  private drawFusesAndRubble(c: CanvasRenderingContext2D, t: Terrain, time: number): void {
    for (const fuse of this.fuses) {
      const col = fuse.index % t.cols, row = (fuse.index - col) / t.cols;
      const x = (col + .5) * CELL, y = t.top + (row + .5) * CELL;
      const burnt = 1 - Math.max(0, fuse.left) / CHARGE_FUSE;
      const blink = this.reducedMotion ? 1 : .6 + .4 * Math.sin(time * (10 + burnt * 30));
      c.globalAlpha = .25 + .45 * burnt * blink;
      c.strokeStyle = '#ff6a3a'; c.lineWidth = 2; c.setLineDash([6, 6]);
      c.beginPath(); c.arc(x, y, CHARGE_RADIUS * CELL + 6, 0, Math.PI * 2); c.stroke();
      c.setLineDash([]);
      c.globalAlpha = blink;
      c.fillStyle = '#fff4d0';
      // The spark at the fuse's tip (tile-art.ts PLACED_ART), a pixel star on the 2 px art grid.
      const sx = x + 5, sy = y - 11 - (this.reducedMotion || Math.sin(time * 23) < 0 ? 0 : ART);
      c.fillRect(sx - ART, sy - ART, ART * 2, ART * 2);
      c.fillStyle = '#ffb066';
      const arm = blink > .8 ? ART * 3 : ART * 2;
      c.fillRect(sx - ART - arm, sy - ART / 2, arm, ART); c.fillRect(sx + ART, sy - ART / 2, arm, ART);
      c.fillRect(sx - ART / 2, sy - ART - arm, ART, arm); c.fillRect(sx - ART / 2, sy + ART, ART, arm);
    }
    c.globalAlpha = 1;
    for (const r of this.rubble) {
      if (!r.active || r.wait > 0) continue;
      // On the art grid, like the rock it fell from.
      const rx = Math.round((r.x - 9) / ART) * ART, ry = Math.round((r.y - 8) / ART) * ART;
      c.fillStyle = '#140a1f'; c.fillRect(rx - ART, ry, 18 + ART * 2, 16);
      c.fillStyle = r.color; c.fillRect(rx, ry, 18, 14);
      c.fillStyle = '#d8c8bc'; c.fillRect(rx, ry, 18, ART);
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
  private creature(c: CanvasRenderingContext2D, flash: boolean, key: string, monster?: Monster, dying = -1): void {
    const sheet = this.readySprite(key);
    if (sheet) { this.creatureSprite(c, sheet, this.readyImage!, flash, monster, dying); return; }
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
  /**
   * A creature from its sprite sheet (W2: idle/walk/windup/strike/hurt/death).
   * The windup and strike play across the game's own windows, so the tell the
   * player reads lands exactly when the hit does; a hit shows `hurt` while the
   * recoil lasts; `dying` (0..1) plays `death`. Flash is the cached white copy.
   */
  private creatureSprite(c: CanvasRenderingContext2D, sheet: SpriteRenderer, image: HTMLImageElement, flash: boolean, monster: Monster | undefined, dying: number): void {
    let wanted: string = monster?.phase ?? 'idle';
    if (dying >= 0) wanted = 'death';
    else if (monster && monster.recoil > .3 && sheet.entry.actions['hurt']) wanted = 'hurt';
    const action = sheet.action(wanted, CREATURE_SPRITE_FALLBACKS[wanted]) ?? 'idle';
    const act = sheet.entry.actions[action];
    let frame = 0;
    if (act && this.reducedMotion) frame = action === 'death' ? act.frames - 1 : 0;
    else if (act) {
      if (action === 'death') frame = frameAtProgress(act, dying);
      else if (action === 'hurt' && monster) frame = frameAtProgress(act, 1 - monster.recoil);
      else if (action === 'windup' && monster?.phase === 'windup') frame = frameAtProgress(act, 1 - monster.timer / CREATURE_WINDUP);
      else if (action !== 'idle' && monster?.phase === 'strike') frame = frameAtProgress(act, 1 - monster.timer / CREATURE_STRIKE);
      else frame = frameAt(act, this.elapsed + (monster ? monster.spawn * .013 : 0));
    }
    sheet.draw(c, image, action, frame, this.spriteOpts(1, 0, 0, flash));
    if (monster?.phase === 'strike' && !flash && dying < 0) {
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= .35;
      sheet.draw(c, image, action, frame, this.spriteOpts(1, -1.5, -1));
      c.restore();
    }
  }
  /** A felled Maw sinks, flattens and fades, shedding embers as it goes. */
  private dissolve(c: CanvasRenderingContext2D, monster: Monster): void {
    const t = 1 - monster.dying / DEATH_FADE;
    const floor = monster.def.floorY ?? FLOOR, k = this.figure;
    c.save(); c.translate(monster.x + monster.knock, floor);
    c.globalAlpha = 1 - t;
    c.scale(k, k);
    // A sheet with its own death frames plays them (no squash); everything else flattens as before.
    const sheet = this.readySprite(monster.def.creature);
    if (sheet && monster.facing < 0) c.scale(-1, 1);
    if (!this.reducedMotion && !sheet?.entry.actions['death']) c.scale(1 + t * .35, 1 - t * .7);
    this.creature(c, t < .25, monster.def.creature, sheet ? monster : undefined, sheet ? t : -1);
    c.restore();
    if (this.reducedMotion) return;
    c.save(); c.fillStyle = '#ffb46a';
    for (let n = 0; n < 7; n++) {
      const a = n * 2.4 + monster.spawn;
      c.globalAlpha = (1 - t) * .8;
      c.beginPath(); c.arc(monster.x + Math.cos(a) * 40 * t * k, floor - (50 + t * 70 + Math.sin(a) * 18) * k, 3 * (1 - t) + 1, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
}
