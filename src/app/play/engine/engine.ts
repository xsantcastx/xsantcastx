import { coarseDevice, renderBudget, type RenderBudget } from './render-budget';
import { Atmosphere } from './atmosphere';
import { LifeFrame, TownLife } from './town-life';
import type { KeeperContext } from '../world/keeper-lines';
import { FIGURE_TOP, KeeperPainter } from '../../shared/keeper-look/keeper-paint';
import { CREATURE_ART, CREATURE_PIXEL, creatureFrame, CreaturePainter } from './creature-pixel';
import { PropPainter } from './prop-pixel';
import { itemIcon, plaqueIcon } from '../../shared/art/item-icons';
import { keeperAction, type KeeperGear } from '../../shared/keeper-look/keeper-gear';
import { lookFromSeed, type KeeperLook } from '../../shared/keeper-look/keeper-look.model';
import { createKeeperMotion, KEEPER, KEEPER_HAND, KEEPER_RIG, KeeperMotion, poseKeeper, trackKeeper } from './rig-poses';
import { resetPose, RigSprite } from './rig';
import { CREATURE_STRIKE, CREATURE_WINDUP, CreatureRigDef, creatureRigFor, RIVET_MAW_CREATURE } from './creature-rigs';
import {
  CREATURE_SPRITE_FALLBACKS, createSpriteAnchor, createSpriteClock, frameAt, frameAtProgress, KEEPER_SPRITE_FALLBACKS, SpriteClock, SpriteDraw, SpriteRenderer, tickClock,
} from './sprite';
import { spriteFor } from '../../shared/art/sprite-manifest.generated';
import { beamColor, beamHeight, FLIGHT_TIME, flightPoint, RARITY_COLORS, satchelPoint } from './loot-fx';
import { aimFromBladeRotation, createHeldTransform, HeldItem, heldTransform, KEEPER_BACK_HAND, KeeperLoadout, OFFHAND_DEFAULTS, WEAPON_DEFAULTS } from './loadout';
import { SurfaceMover, type SurfaceGeo } from './surface-body';
import { SurfaceRender } from './surface-render';
import { FIND_REACH, hollisFolk, hollisRealm, type AreaHeights, type HeightFind, type HeightFolk } from '../world/heights';
import { advanceBody, Body, EngineInput, EngineOptions, EngineSfx, EngineState, FLOOR, InteractionTarget, KeeperAnimation, meleeHits, SITE_CUE_RISE, STATION_CUE_Y, walkDirection, WORLD_ACTION_UNPAID } from './engine.model';
import {
  applyTerrainDiff, BLAST_TOOLS, BodyBox, boxHits, CELL, cellKey, coneCells, generateTerrain, isAir, nodeIndex, PlaceableDef, PlaceableId, placeableById,
  climbTerrainBody, findNode, glowIntensity, INTERACT_REACH, isClimbable, isOneWay, isTakeable, onLadder, placeTarget, stepTerrainBody, SWING_TOOLS, takeTarget, Terrain, TERRAIN_NODE_LIST, TERRAIN_NODES, TerrainNodeDef, terrainLayout, TOOL_ACTION, ToolKind, toolFor, toolName, ToolTiers,
  blastCells, CHARGE_FUSE, CHARGE_RADIUS, isLoose, supportNear,
  applyLiquidDiff, LIQUID_FULL, LIQUID_IDS, LIQUID_INK, LIQUID_LAVA, LIQUID_WATER, liquidDiff, liquidLayout, LiquidKind,
  isRail, BiomeDef,
} from './terrain';
import {
  cartPoint, mountCart, railUnder, ropeCells, ropeStrand, ropeTie, stepCart, stepGrapple, throwGrapple, grappleTarget, nextRail,
  type Cart, type Grapple,
} from './traversal';
import { douseVent, FURNACE_TUNING, furnaceBreathing, furnaceOpen, furnaceWarning, inMouth, newFurnace, pullAt, stepFurnace, type FurnaceState } from './furnace';
import { FURNACE, MARK_PREFIX } from './underhearth-gen';
import { realmArrival } from './realm-gen';
import {
  BRAZIER_BURN, circleMeetsRect, inInk, litBy, pocketPhase, rectsMeet, SHADE_SPEED, SHADE_WINDUP, SHIFT_PERIOD, tideAt, WARDEN_CALL,
  type CellRect, type TidePhase,
} from './umbral';
import { enteredFlag, REALM_ARRIVAL, realmOfArea, realmOfGateNode, RIFT_GATES, ruleFlag, type RiftRealm } from '../../shared/delve/rift-gates.model';
import { cellKey as rootKey, GRAFT_CALL, GRAFT_HEAL, GRAFT_SHARE, heldOpen, isAlive, reaching, regrowProgress, REGROW_DELAY, regrowsAs, SPORE_STING, type Regrowth } from './verdant';
import { applyLight, BEAM_MAX, FLARE_CELLS, FLARE_HIT, isLightMade, K as LUM, LIGHT_TICK, LIT_PANE, lightPanes, PRISM_FLARE, traceBeams, turned, unlit, type LightWindow } from './luminous';
import { CORE_HALL } from './realm-kit';
import { ANCHOR_MAX, GRAPPLE_CELLS, THORNROOT_GRAPPLE, UNDERHEARTH_REACHED_FLAG, UNDERHEARTH_TOP } from '../../shared/delve/underhearth.model';
import { immersion, LiquidSim, SWIM, surfaceY, WOODEN_IDS } from './liquids';
import { drawLiquids, lavaLights } from './liquid-render';
import { drawFishShadows, placeFish, type FishShadow } from './fish-shadows';
import { AmbientMotes, Debris, GlowHalos, TerrainRenderer } from './terrain-render';
import { createFog, findMark, MapSource, MarkTarget, revealAround, terrainReader } from './delve-map';
import { Column, PlacedStructure, SectorWorld } from './sector-world';
import { SECTOR } from './sector-gen';
import { FIELD_NOTE_PREFIX } from '../../shared/delve/field-notes.model';
import type { BucketId, DelvePersistence, FishingPhase, GatherPersistence } from './engine.model';
import { regrowSecondsLeft } from '../../shared/skills/gather-save.model';
import { ambientDarkness, DarknessLayer, DEFAULT_LANTERN, LIGHT_CAP, LightPool, selectLights } from './lighting';
import { ART, RockShade, sparkleOffset, TILE, tileVariant } from './tile-art';
import { CaveBackdrop } from './cave-backdrop';
import { ParallaxBackdrop } from './parallax';
import { PixelParallax } from './pixel-parallax';
import { GroundStrip } from './ground-strip';
import type { DisciplineId } from '../../shared/activity/activity.model';
import { AreaDef, areaOf, clientToWorld, DropEntry, GatherNodeDef, LootRarity, MonsterDef, NODE_REACH, nearestStation, StationDef, stationAt, TownDef } from '../world/world.model';
import { INFERNAL_TOWN } from '../world/towns/infernal';
import type { HomesteadFrame, HomesteadView } from './homestead-render';
import { GlimSprite } from './glim-sprite';
export type { BucketEvent, BucketId, DelvePersistence, DiscoverEvent, EngineInput, EngineOptions, EngineSfx, EngineState, FishEvent, InteractionTarget, KeeperAnimation, KillEvent, PlaceEvent, UseEvent, WorldActionEvent } from './engine.model';
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
  /** The endless Delve: the sector column whose hall it lives in (it leaves with the column). */
  sx?: number;
  /** A dormant creature (a Banked Ember) has been struck awake. */
  awake?: boolean;
  /** Spilled by the Banked Furnace: gone for good once felled (no respawn). */
  minion?: boolean;
  /** A shade (the Ink Deeps) standing in strong light, or the Hollow Sun caught in a beam: it cannot move or strike. */
  frozen?: boolean;
}
/** The hand's extra tools (not placed): the Thornroot Grapple. */
export type HandToolId = typeof THORNROOT_GRAPPLE;
export function isHandTool(id: string | null | undefined): id is HandToolId { return id === THORNROOT_GRAPPLE; }
/** Set once the Keeper has been told what regrowth is (the delve save's `claimed`). */
const REGROWTH_FLAG = 'delve-regrowth-seen';
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
/** World px per art px of a pixel Keeper at figure scale 1 (the 196 box / 49; keeper-paint.ts). */
const KEEPER_ART_PX = 4;
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
/** No skill level multiplies a tool's damage past this (×1.5 at 99, approaching ×2.0 past it — tool-level.ts MAX_LEVEL_POWER; guards a bad setTools value). */
const MAX_POWER = 2;
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
const USE_LABEL: Readonly<Record<string, string>> = {
  inscription: 'CARVED INSCRIPTION', chest: 'CHEST', camp: 'YOUR CAMP', shrine: 'RIFT SHRINE',
  mark: 'HAMMER-MARK', anchor: 'RIFT ANCHOR', furnace: 'THE BANKED FURNACE', rail: 'KAEL\'S RAIL',
  gate: 'RIFT GATE', brazier: 'GLOAM BRAZIER', mirror: 'PRISM MIRROR',
};
/** Node kinds the Underhearth's engine code keys on (looked up once). */
const ROPE_KIND = TERRAIN_NODE_LIST.findIndex(node => node.id === 'rope');
const ANCHOR_KIND = TERRAIN_NODE_LIST.findIndex(node => node.id === 'rift-anchor');
const VENT_KIND = TERRAIN_NODE_LIST.findIndex(node => node.id === 'furnace-vent');
/** The Ink Deeps' node kinds the engine keys on (realm-gen.ts, umbral.ts). */
const BRAZIER_KIND = TERRAIN_NODE_LIST.findIndex(node => node.id === 'gloam-brazier');
const BRAZIER_LIT_KIND = TERRAIN_NODE_LIST.findIndex(node => node.id === 'gloam-brazier-lit');
const DRIFT_KIND = TERRAIN_NODE_LIST.findIndex(node => node.id === 'drift-shale');
/** The Root Deeps' node kinds the engine keys on (verdant-gen.ts, verdant.ts). */
const SPORE_KIND = TERRAIN_NODE_LIST.findIndex(node => node.id === 'spore-pod');
const VINE_KIND = TERRAIN_NODE_LIST.findIndex(node => node.id === 'living-vine');
const HEART_ROOT_KIND = TERRAIN_NODE_LIST.findIndex(node => node.id === 'heart-root');
const RAIL_KINDS = Uint8Array.from(TERRAIN_NODE_LIST, node => node.rail ? 1 : 0);
/** How far a launched or released Keeper's momentum carries, and how fast it bleeds (on the ground / in the air), 1/s. */
const CARRY_GROUND = 9, CARRY_AIR = .5;
/**
 * What the cart's rider must clear: the body above the cart's rim, narrowed (on a slope the Keeper
 * straddles two columns a row apart, and the cart, not the feet, rides the lower one).
 */
const CART_BOX: BodyBox = { halfWidth: 8, height: 64 }, CART_LIFT = 20;
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
  /** The player's own pixel Keeper (setKeeperLook): their chosen look wearing their gear. */
  private keeperPainter: KeeperPainter | null = null;
  /** Other Keepers in the room: a stable look from their id, so nobody looks the same. */
  private readonly peerPainters = new Map<string, KeeperPainter>();
  /** Pixel creatures (creature-pixel.ts), one painter per creature key; null = keep the sheet / rig. */
  private readonly creaturePainters = new Map<string, CreaturePainter | null>();
  /** Pixel props (prop-pixel.ts): stalls, waystone, arches, nodes, coins. Null without a DOM: the vector fallbacks draw. */
  private readonly props: PropPainter | null = typeof document !== 'undefined' && typeof document.createElement === 'function' ? new PropPainter() : null;
  /** Where each creature was last drawn, to tell a stride from a breath. */
  private readonly creatureLastX = new WeakMap<Monster, number>();
  /** The pixel Keeper paints into small canvases; without a DOM (the node harness) Keepers keep the rig. */
  private readonly canPaint = typeof document !== 'undefined' && typeof document.createElement === 'function';
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
  /** The reflection under a mirrored ceiling keeps its own motion state (it walks a step behind). */
  private readonly mirrorMotion = createKeeperMotion();
  private readonly hand = { x: 0, y: 0, angle: 0 };
  /** Real seconds since the last drawn frame (0 during hitstop), for springs only. */
  private frameDt = 0;
  /** Real seconds since the last drawn frame, hitstop included: flights keep flying through a freeze. */
  private flightDelta = 0;
  /** Fish under the water this frame (fish-shadows.ts), reused slots; and the last count, for the HUD's data attribute. */
  private readonly fish: FishShadow[] = [];
  private fishCount = 0;
  /** A landed fish arcing out of the water into the Keeper (world px), 0..1 progress; null when none. */
  private catchArc: { sx: number; sy: number; t: number; label: string } | null = null;
  /** Ripples on the water at the bob (a bite), world px, 0..1 age each. */
  private ripples: { x: number; y: number; t: number }[] = [];
  private pixelRatio = 1;
  private pixelScale = 1;
  private readonly reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** Full on desktop; lite on phones (render-budget.ts): a lower backing-store cap and no shadowBlur glows. */
  private readonly budget: RenderBudget;
  /** A shadowBlur radius under the render budget: as given on desktop, 0 on a phone. */
  private blur(radius: number): number { return this.budget.glows ? radius : 0; }
  private landing = 0;
  /** A flash of feeling on the Keeper's face (loot, a level up) and when it ends (engine seconds). */
  private feelFace: 'happy' | 'surprised' | null = null;
  private feelUntil = 0;
  private stepCount = 0;
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
  /**
   * The endless Delve (Phase 7): the loaded world round the Keeper when the
   * area's spec is `endless` and the save holds sectors (sector-world.ts).
   * Its ring is `terrain`; null in the plain core (tests, SSR) and in towns.
   */
  private world: SectorWorld | null = null;
  private readonly worlds = new Map<string, SectorWorld>();
  /** The sector column (and sector row) the Keeper last stood in: the regrowth line is said on entering a healed one. */
  private worldAt = '';
  // ── The Underhearth's traversal (Phase 8, traversal.ts) ──
  /** Riding Kael's rails in the Seam Cart, or null. */
  private cart: Cart | null = null;
  /** The Thornroot Grapple's line, or null. */
  private grapple: Grapple | null = null;
  /** Momentum a launch off a rail or a grapple release carries, px/s along x; bleeds away. */
  private carryX = 0;
  /** What the Keeper carries that is not placed: a Seam Cart (rides rails), a Thornroot Grapple. */
  private gear = { cart: false, grapple: false, veil: false, shears: false, lens: false };
  /** The Banked Furnace's fight while it is up: its state, its vents' cells, its trough's cells. */
  private furnace: { monster: Monster; state: FurnaceState; vents: number[]; trough: number[] } | null = null;
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
  /** The procedural pixel parallax every town and hunt stands on until its W8 layers are imported. */
  private readonly pixelBackdrop = new PixelParallax();
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
  /** Vertical camera, world px. 0 outside delves and flat areas; negative while looking up a surface with height. */
  private cameraY = 0;
  // ── A surface with height (world/heights.ts, surface-body.ts) ──
  private heights: AreaHeights | null = null;
  private geo: SurfaceGeo | null = null;
  private readonly mover = new SurfaceMover();
  private readonly surface = new SurfaceRender();
  /** Finds this player has already used (ids), from the host. */
  private heightsFound: ReadonlySet<string> = new Set();
  private folk: HeightFolk[] = [];
  /** Smoothed vertical look-ahead, world px. */
  private lookY = 0;
  /** Which folk line is showing (index into folk), its line and when it started. */
  private folkSay = { who: -1, line: 0, at: -99, armed: true };
  /** The day number Hollis's walk is read for (tests set it). */
  private day = () => Math.floor(Date.now() / 86_400_000);
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
    const fresh = !this.worlds.has(area.id);
    this.terrain = this.terrainFor(area); this.world = this.terrain ? this.worlds.get(area.id) ?? null : null;
    // A world already loaded keeps its ring: its halls' creatures come back with the area.
    if (this.world && !fresh) for (const column of this.world.loadedColumns()) this.spawnHalls(area, column);
    this.worldAt = '';
    this.terrainRenderer.attach(this.terrain); this.cameraY = 0;
    this.liquid = this.terrain ? this.sims.get(area.id) ?? null : null;
    this.chars.clear(); this.line = null; this.recast = 0;
    this.breath = this.breathMax; this.burning = 0; this.immersed = 0; this.headUnder = false;
    this.fog = this.terrain ? this.fogs.get(area.id) ?? null : null; this.fogAt = NaN;
    this.holdMode = null; this.clearAim(); this.dropTime = 0; this.jumpBuffer = 0;
    this.cart = null; this.grapple = null; this.carryX = 0; this.furnace = null;
    this.braziers.clear(); this.inkBlind = false; this.mirror = null; this.mirrorTrail.length = 0; this.wardenCall = WARDEN_CALL;
    this.regrowth.clear(); this.heartRoots = -1; this.graftCall = GRAFT_CALL; this.lightClock = 0; this.litCells.clear(); this.flareIn = PRISM_FLARE;
    this.blastTime = 0; this.blastFlash = 0; this.interactAt = -1;
    this.fuses = [];
    for (const r of this.rubble) r.active = false;
    this.sites = this.sitesFor(area);
    this.enterHeights(area);
    this.motes.reset();
    this.life.enter(area, this.town);
  }
  /** Build the high ground's collision and its people for an area (nothing for a flat one). */
  private enterHeights(area: AreaDef): void {
    const h = area.heights ?? null;
    this.heights = h; this.mover.reset(); this.lookY = 0; this.folkSay.who = -1; this.folkSay.armed = true;
    this.geo = h ? { platforms: [...area.platforms, ...h.ledges], solids: h.solids, climbs: h.trees, width: area.width } : null;
    this.folk = h ? [...h.folk, ...(hollisRealm(this.day()) === h.realm ? [hollisFolk(h)] : [])] : [];
    this.surface.enter(h);
  }
  private static readonly HOLLIS = { robe: '#5a4228', shade: '#3a2a1c', trim: '#c08a3e', skin: '#c4926a', glow: '#7fd5a3' };
  /** The traveller on the high ground, their name tag and the line they are saying. */
  private drawFolk(c: CanvasRenderingContext2D, viewport: number, time: number): void {
    const f = this.lifeFrame, tr = this.options.translate;
    f.camera = this.camera; f.viewport = viewport; f.time = time; f.reduced = this.reducedMotion; f.playerX = this.player.x; f.pixelScale = this.pixelScale;
    this.folk.forEach((p, i) => {
      if (p.x < this.camera - 200 || p.x > this.camera + viewport + 200) return;
      const talking = this.folkSay.who === i;
      this.life.drawAt(c, f, `npc-${p.id}-figure`, p.x, p.y, Math.sign(this.player.x - p.x) || 1, SeamworksEngine.HOLLIS, 'coat', 3.1 + i, talking);
      const name = tr?.(p.nameKey) ?? 'Hollis Fenn', title = tr?.(p.titleKey) ?? '';
      c.save(); c.textAlign = 'center';
      c.font = '600 14px "Cormorant Garamond", Georgia, serif';
      c.fillStyle = '#1a120fe6'; c.fillRect(p.x - 80, p.y - 196, 160, 35);
      c.fillStyle = SeamworksEngine.HOLLIS.glow; c.fillRect(p.x - 80, p.y - 163, 160, 2);
      c.fillStyle = '#ffe1b0'; c.fillText(name, p.x, p.y - 180, 150);
      c.font = 'italic 600 11px "Cormorant Garamond", Georgia, serif'; c.fillStyle = '#d9bf98'; c.fillText(title, p.x, p.y - 166, 150);
      if (talking && tr) {
        const text = tr(p.lines[this.folkSay.line % p.lines.length]);
        c.font = '600 15px "Cormorant Garamond", Georgia, serif';
        const w = Math.min(320, c.measureText(text).width + 24), lines = w >= 320 ? 2 : 1, h = lines * 19 + 10, y = p.y - 206 - h;
        c.fillStyle = '#fff6ea'; c.fillRect(p.x - w / 2, y, w, h);
        c.fillStyle = '#2a1c16';
        if (lines === 1) c.fillText(text, p.x, y + 19, w - 16);
        else { const cut = text.lastIndexOf(' ', Math.floor(text.length / 2) + 4); c.fillText(text.slice(0, cut), p.x, y + 19, w - 16); c.fillText(text.slice(cut + 1), p.x, y + 38, w - 16); }
      }
      c.restore();
    });
  }
  /** One line at a time as the Keeper comes near on the same height; again after walking away. */
  private updateFolk(): void {
    if (!this.folk.length) return;
    const say = this.folkSay;
    if (say.who >= 0 && this.elapsed - say.at > 6) say.who = -1;
    this.folk.forEach((p, i) => {
      const dx = Math.abs(this.player.x - p.x), dy = Math.abs(this.player.y - p.y);
      if (dx > 320 || dy > 200) { if (say.who !== i) say.armed = true; return; }
      if (dx < 170 && dy < 60 && say.armed && say.who < 0) { say.who = i; say.at = this.elapsed; say.line = (say.line + (say.at > 0 ? 1 : 0)) % p.lines.length; say.armed = false; }
    });
  }
  /** The host's record of used finds (ids). The engine never writes it. */
  setHeightsFound(found: ReadonlySet<string>): void { this.heightsFound = found; }
  /** The find the Keeper stands at, or null. */
  private findInReach(): HeightFind | null {
    const h = this.heights;
    if (!h) return null;
    for (const f of h.finds) if (Math.abs(f.x - this.player.x) <= FIND_REACH.x && Math.abs(f.y - this.player.y) <= FIND_REACH.y && this.player.grounded) return f;
    return null;
  }
  private useFind(f: HeightFind): void {
    const found = this.heightsFound.has(f.id);
    this.options.onHeightFind?.({ areaId: this.areaDef.id, id: f.id, kind: f.kind, found });
    if (f.textKey && (found || f.kind === 'carving')) this.say(f.textKey, this.options.translate?.(f.textKey) ?? f.textKey);
    else if (found) this.say('play.height.opened', this.options.translate?.('play.height.opened') ?? 'Already opened.');
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
    if (spec.endless && this.delve?.sectors) return this.endlessFor(area, seed);
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
   * The endless Delve's world for an area: the ring round the area's spawn,
   * its liquid sim and fog. Creatures of a column's halls come and go with it.
   */
  private endlessFor(area: AreaDef, seed: number): Terrain {
    const spec = area.terrain!;
    let sim: LiquidSim | null = null;
    const world = new SectorWorld(spec, seed, area.id, this.delve, {
      loaded: column => {
        sim?.wakeColumns(column.sx * SECTOR - 1, (column.sx + 1) * SECTOR + 1);
        if (this.areaDef === area) this.spawnHalls(area, column);
      },
      unloading: column => this.columnLeaving(world, column, sim),
    });
    const t = world.t;
    world.center(t.colAt(area.spawnX));
    this.worlds.set(area.id, world);
    this.terrains.set(area.id, t);
    this.layouts.set(area.id, world.layout);
    this.liquidLayouts.set(area.id, world.wet);
    sim = new LiquidSim(t, {
      canSet: index => this.terrain !== t || !this.bodyIn(t, index),
      reacted: (index, made) => this.reacted(t, area.id, index, made),
      char: index => { if (this.terrain === t && !this.chars.has(index)) this.chars.set(index, CHAR_TIME); },
    });
    sim.wakeAll();
    this.sims.set(area.id, sim);
    this.fogs.set(area.id, world.fog);
    return t;
  }
  /** A column's hall creatures, from the area's own creature of that kind (its HP and drops), in the hall. */
  private spawnHalls(area: AreaDef, column: Column): void {
    const t = this.terrain;
    for (const hall of column.gen.halls) {
      const base = area.monsters.find(m => m.creature === hall.creature && !m.once && !m.summoned);
      if (!base) continue;
      const x0 = hall.col0 * CELL + 40, x1 = hall.col1 * CELL - 40;
      const xs = Array.from({ length: hall.count }, (_, n) => Math.round(x0 + (x1 - x0) * (n + .5) / hall.count));
      const def: MonsterDef = { ...base, spawnXs: xs, floorY: (t?.top ?? FLOOR) + hall.floorRow * CELL, range: [x0, x1] };
      for (const x of xs) this.monsters.push({ def, maxHp: def.hp, x, spawn: x, hp: def.hp, phase: 'idle', timer: 1, facing: -1, respawn: 0, flash: 0, knock: 0, dying: 0, born: 0, shownHp: def.hp, recoil: 0, sx: column.sx });
    }
  }
  /** A column is leaving the ring: its creatures go, and nothing here holds its cells any more. */
  private columnLeaving(world: SectorWorld, column: Column, sim: LiquidSim | null): void {
    const t = world.t, col0 = column.sx * SECTOR, col1 = col0 + SECTOR;
    sim?.forgetColumns(col0, col1);
    // The Prism Mines: a column leaving keeps none of the light (luminous.ts); it is laid again when it comes back.
    if (world.spec.realm === 'luminous') {
      for (let row = 0; row < t.rows; row++) for (let col = col0; col < col1; col++) {
        const k = t.kind[t.index(col, row)];
        if (isLightMade(k)) t.set(col, row, unlit(k));
      }
    }
    if (this.world === world) {
      this.monsters = this.monsters.filter(m => m.sx !== column.sx);
      const gone = (index: number) => { const col = t.colOf(index); return col >= col0 && col < col1; };
      for (const index of [...this.chars.keys()]) if (gone(index)) this.chars.delete(index);
      for (const index of [...this.placedGen.keys()]) if (gone(index)) this.placedGen.delete(index);
      this.fuses = this.fuses.filter(fuse => !gone(fuse.index));
      this.dragQueue = []; this.dragLast = -1; this.interactAt = -1;
      if (this.line && this.line.col >= col0 && this.line.col < col1) this.line = null;
    }
  }
  /**
   * Keep the endless Delve's ring round the Keeper: a teleport (the camp, a
   * reload) re-centres it, walking shifts it a sector column at a time. The
   * first step into a regrown sector says what happened, once per player.
   */
  private keepWorld(): void {
    const world = this.world;
    if (!world) return;
    const t = world.t, col = t.colAt(this.player.x);
    if (col < t.colLo + 8 || col >= t.colHi - 8) world.center(col);
    else world.follow(col);
    const row = Math.max(0, Math.min(t.rows - 1, t.rowAt(this.player.y - DELVE_BOX.height * .5)));
    const sx = Math.floor(col / SECTOR), sy = Math.floor(row / SECTOR), at = `${sx},${sy}`;
    if (at === this.worldAt) return;
    this.worldAt = at;
    if (world.cached(sx)?.healed[sy] && !this.flagged(REGROWTH_FLAG)) {
      this.setFlag(REGROWTH_FLAG);
      this.say('play.delve.regrown', 'The Delve keeps what is held. A torch, a block, a chest, a camp: these it leaves. An empty tunnel it takes back, slowly, and fills with something new. Mark what you mean to keep.');
    }
  }
  /** A stable id for a cell of the current delve (what chests are filed by): the core keeps its v1 index. */
  private cellIdOf(t: Terrain, index: number): number {
    return this.world && this.world.t === t ? this.world.cellId(t.colOf(index), t.rowOf(index)) : index;
  }
  /**
   * Plug in (or replace) where per-player delves come from. Cached terrains
   * are dropped so the next entry regenerates from the save; a delve the
   * Keeper stands in is rebuilt now (cloud save adopted another device's dig).
   */
  setDelve(delve: DelvePersistence | null): void {
    this.delve = delve;
    this.terrains.clear(); this.layouts.clear(); this.fogs.clear(); this.sims.clear(); this.liquidLayouts.clear(); this.worlds.clear();
    if (this.areaDef?.terrain) {
      this.monsters = this.monsters.filter(m => m.sx === undefined);
      this.terrain = this.terrainFor(this.areaDef);
      this.world = this.worlds.get(this.areaDef.id) ?? null;
      // The rebuilt ring stands where the Keeper is, not at the spawn.
      if (this.world) { this.world.center(this.world.t.colAt(this.player.x)); this.worldAt = ''; }
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
    if (sim) sim.wakeAround(t.colOf(index), t.rowOf(index));
    // The Root Deeps: a hole in living wood grows back (verdant.ts); the root's living parts are never saved as gone.
    if (this.terrain === t && this.areaDef.terrain?.realm === 'verdant' && this.rootDug(t, index)) return;
    if (this.world && this.world.t === t) { this.world.record(index); return; }
    if (!this.delve) return;
    const layout = this.layouts.get(this.areaDef.id);
    if (!layout) return;
    try { this.delve.changed(this.areaDef.id, layout, index, t.kind[index] === t.base[index] ? null : t.kind[index]); } catch { /* the dig still stands this session */ }
  }
  // ── Building ─────────────────────────────────────────────────────────────

  /** The hotbar's choice: what B (or a long-press) places. */
  private placing: PlaceableId | BucketId | HandToolId | null = null;
  /** Bumped per placement: makes each placement's mutation id, and a re-dig of a placed cell, unique. */
  private placeSeq = 0;
  /** Cell index → the placement that filled it this session, so its re-dig is a new grant. */
  private readonly placedGen = new Map<number, number>();
  /** Choose what to place (the hotbar). Unknown ids clear it. */
  setPlaceable(id: PlaceableId | BucketId | HandToolId | string | null): void { this.placing = isBucket(id) || isHandTool(id) ? id : placeableById(id)?.id ?? null; }
  get placeable(): PlaceableId | BucketId | HandToolId | null { return this.placing; }
  /**
   * B: place the chosen thing in front of the Keeper (below, holding Down).
   * See `placeTarget` for which cell. False, with a plain message, when it
   * cannot go anywhere.
   */
  place(): boolean {
    const t = this.terrain;
    if (!t || this.paused || this.hp <= 0) return false;
    if (isBucket(this.placing)) return this.useBucket(this.placing, this.bucketTarget(t, this.placing === 'seam-bucket'));
    if (isHandTool(this.placing)) {
      // The grapple: at the aimed cell, else up and ahead at 45 degrees.
      const aim = this.aimCell();
      const hand = this.handPoint();
      return aim ? this.throwAt(aim.col, aim.row) : this.throwAt(t.colAt(hand.x + this.facing * CELL * 6), t.rowAt(hand.y - CELL * 6));
    }
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
    // The grapple reaches far past a swing.
    if (isHandTool(this.placing)) return t.inside(col, row) ? this.throwAt(col, row) : false;
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
    if (def?.single && this.findPlaced(t, def.node)) return { key: 'play.delve.single', en: `You already have a ${def.label.toLowerCase()} in the Delve. Take it back first (X beside it).`, vars: { item: def.id } };
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
    const col = t.colOf(index), row = t.rowOf(index);
    const node = TERRAIN_NODES[def.node];
    const problem: PlaceProblem | null = node ? this.placeProblem(t, col, row, node, def) : { key: 'play.delve.cannotPlace', en: 'That cannot be placed.' };
    if (problem) { this.say(problem.key, problem.en, problem.vars); this.report(); return false; }
    // A charge is lit from a staff: none, and nothing leaves the satchel.
    if (node!.charge && !(this.tools.staff ?? 0)) {
      this.say('play.delve.needStaff', 'You need a staff to light the fuse (Staff I or better).'); this.report(); return false;
    }
    // Rift Anchors: at most `max` in the Delve at once.
    if (def.max && this.findAllPlaced(t, def.node).length >= def.max) {
      this.say('play.uh.anchor.max', `Eight anchors already hold in your Delve. Take one back first (X beside it).`, { n: def.max }); this.report(); return false;
    }
    // Bark Rope: tied at a ledge, it unrolls to the floor, one coil a cell.
    if (def.spool) return this.spoolRope(def, col, row);
    const gen = ++this.placeSeq;
    const accepted = this.options.onPlace?.({
      item: def.id, areaId: this.areaDef.id, cellKey: cellKey(col, row), index: this.cellIdOf(t, index),
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
  /** Every placed `id` in this Delve (the endless world: everywhere the player has been). */
  private findAllPlaced(t: Terrain, id: string): { col: number; row: number }[] {
    const world = [...this.worlds.values()].find(w => w.t === t);
    if (world) return world.findAll(nodeIndex(id));
    const kind = nodeIndex(id), out: { col: number; row: number }[] = [];
    for (let i = 0; i < t.kind.length; i++) if (t.kind[i] === kind) out.push({ col: t.colOf(i), row: t.rowOf(i) });
    return out;
  }
  /** Tie a Bark Rope at (col, row) and let it unroll to the floor: the host takes one coil per cell it fills. */
  private spoolRope(def: PlaceableDef, col: number, row: number): boolean {
    const t = this.terrain;
    if (!t) return false;
    if (!ropeTie(t, col, row)) { this.say('play.uh.rope.noTie', 'Nothing to tie the rope to here. Tie it at a ledge or under rock.'); this.report(); return false; }
    const cells = ropeCells(t, col, row);
    const gen = ++this.placeSeq;
    const accepted = this.options.onPlace?.({
      item: def.id, areaId: this.areaDef.id, cellKey: cellKey(col, row), index: this.cellIdOf(t, t.index(col, row)), count: cells.length,
      mutationId: `delve-place:${this.lootSession}:${this.areaDef.id}:${cellKey(col, row)}:${gen}`,
    });
    if (accepted === false || accepted === 0) { this.report(); return false; }
    const n = typeof accepted === 'number' ? Math.max(1, Math.min(cells.length, Math.floor(accepted))) : cells.length;
    const node = TERRAIN_NODES[def.node];
    for (let k = 0; k < n; k++) this.fill(t, t.colOf(cells[k]), t.rowOf(cells[k]), node, gen);
    this.say('play.uh.rope.spooled', `The rope unrolls ${n} ${n === 1 ? 'cell' : 'cells'} down. Climb it like a ladder.`, { n });
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
    const col = t.colOf(index), row = t.rowOf(index);
    const node = t.nodeAt(col, row);
    const def = placeableById(node.placeable);
    if (!def || node.solid) return false;
    if (def.spool) return this.takeRope(def, col, row);
    const accepted = this.options.onTakeBack?.({
      item: def.id, areaId: this.areaDef.id, cellKey: cellKey(col, row), index: this.cellIdOf(t, index),
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
  /** A rope comes back whole: every coil of its strand, in one grant. */
  private takeRope(def: PlaceableDef, col: number, row: number): boolean {
    const t = this.terrain;
    if (!t) return false;
    const strand = ropeStrand(t, col, row);
    if (!strand.length) return false;
    const top = strand[0];
    const accepted = this.options.onTakeBack?.({
      item: def.id, areaId: this.areaDef.id, cellKey: cellKey(t.colOf(top), t.rowOf(top)), index: this.cellIdOf(t, top), count: strand.length,
      mutationId: `delve-take:${this.lootSession}:${this.areaDef.id}:${cellKey(t.colOf(top), t.rowOf(top))}:${++this.placeSeq}`,
    });
    if (accepted === false) { this.report(); return false; }
    for (const index of strand) { t.set(t.colOf(index), t.rowOf(index), 0); this.placedGen.delete(index); this.recordCell(t, index); }
    this.debris.chip((col + .5) * CELL, t.top + (row + .5) * CELL, TERRAIN_NODE_LIST[ROPE_KIND].fleck, this.reducedMotion ? 2 : 6);
    this.say('play.uh.rope.taken', `The rope rolls back up: ${strand.length} coils in the satchel.`, { n: strand.length });
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
    return !!t && !!this.findPlaced(t, 'camp');
  }
  /**
   * Where a node is, as a world cell: in the plain core a scan of the grid; in
   * the endless Delve anywhere the player has been (the ring, the cached
   * columns, then the saved sectors). Null when there is none.
   */
  private findPlaced(t: Terrain, id: string): { col: number; row: number } | null {
    const world = [...this.worlds.values()].find(w => w.t === t);
    if (world) return world.find(nodeIndex(id));
    const index = findNode(t, id);
    return index >= 0 ? { col: t.colOf(index), row: t.rowOf(index) } : null;
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
    const camp = t ? this.findPlaced(t, 'camp') : null;
    if (!entrance || !t || !camp) return false;
    const { col, row } = camp;
    // The endless Delve: bring the camp's sectors into the ring before anything is asked of its cells.
    this.worlds.get(entrance.area.id)?.center(col);
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
  // ── The Underhearth: grapple, cart, anchors (Phase 8) ─────────────────────

  /** Where the grapple leaves the hand (world px). */
  private handPoint(): { x: number; y: number } { return { x: this.player.x + this.facing * 10, y: this.player.y - DELVE_BOX.height * .6 }; }
  /** Throw the Thornroot Grapple toward cell (col, row): it bites the first rock on the way, within reach. */
  private throwAt(col: number, row: number): boolean {
    const t = this.terrain;
    if (!t || this.paused || this.hp <= 0 || this.cart) return false;
    if (!this.gear.grapple) { this.say('play.uh.grapple.none', 'You need a Thornroot Grapple (Crafting Bench, Smithing 20).'); this.report(); return false; }
    const hand = this.handPoint();
    const target = grappleTarget(t, hand.x, hand.y, col, row, GRAPPLE_CELLS * CELL);
    if (!target) { this.say('play.uh.grapple.miss', 'Nothing in reach for the grapple to bite there.'); this.report(); return false; }
    this.grapple = throwGrapple(hand.x, hand.y, target);
    this.cancelMove(); this.climbing = false; this.carryX = 0;
    if (Math.abs(target.x - this.player.x) > 4) this.facing = target.x > this.player.x ? 1 : -1;
    this.say('play.uh.grapple.thrown', 'The thornroot grows to the rock and pulls. Jump to let go.');
    this.report();
    return true;
  }
  /** Let go of the grapple, keeping a little of the swing. */
  private releaseGrapple(jump: boolean): void {
    if (!this.grapple) return;
    this.grapple = null;
    if (jump) { this.player.vy = -520; this.player.grounded = false; this.carryX = this.facing * 160; }
  }
  /** Board the Seam Cart on the rail cell `index`. */
  private boardCart(index: number): void {
    const t = this.terrain;
    if (!t) return;
    if (!this.gear.cart) { this.say('play.uh.cart.none', 'You need a Seam Cart to ride the rails. Kael has the pattern.'); this.report(); return; }
    const cart = mountCart(t.colOf(index), t.rowOf(index), this.facing);
    const at = cartPoint(t, cart);
    if (boxHits(t, at.x, at.y, DELVE_BOX)) { this.say('play.uh.cart.blocked', 'No room to stand in the cart there.'); this.report(); return; }
    this.cart = cart; this.grapple = null; this.carryX = 0; this.climbing = false;
    this.cancelMove();
    this.player.x = at.x; this.player.y = at.y; this.player.vy = 0; this.player.grounded = true;
    this.say('play.uh.cart.board', 'In the cart. Left and Right push it, Down brakes, Jump leaps out, E steps off.');
    this.report();
  }
  /** Step out of the cart, carrying (vx, vy). */
  private leaveCart(vx: number, vy: number): void {
    if (!this.cart) return;
    this.cart = null;
    this.carryX = vx;
    if (vy) { this.player.vy = vy; this.player.grounded = false; }
  }
  /** One fixed step riding the rails. */
  private rideCart(dt: number, t: Terrain): void {
    const cart = this.cart!;
    const push = Number(this.input.has('right')) - Number(this.input.has('left'));
    if (this.input.has('down')) cart.speed = Math.max(0, cart.speed - 1100 * dt);
    const step = stepCart(t, cart, push, dt, (x, y) => boxHits(t, x, y - CART_LIFT, CART_BOX));
    const at = cartPoint(t, cart);
    this.player.x = at.x; this.player.y = at.y; this.player.vy = 0; this.player.grounded = true;
    this.facing = cart.dir;
    if (step.launched) {
      this.leaveCart(step.launched.vx, Math.min(step.launched.vy, 0) - 240);
      this.say('play.uh.cart.launched', 'Off the end of the line! The cart stays; you do not.');
      this.impact(.03, 3);
    }
  }
  /** One fixed step on the grapple's line. */
  private pullGrapple(dt: number, t: Terrain): void {
    const g = this.grapple!;
    if (!stepGrapple(g, this.player, DELVE_BOX, t, dt)) { this.grapple = null; this.say('play.uh.grapple.lost', 'The rock it bit is gone. The line drops.'); return; }
    // Walking off a hang lets go.
    if (g.phase === 'hang' && (this.input.has('left') || this.input.has('right'))) this.releaseGrapple(false);
  }
  /** True while riding the rails (HUD, tests). */
  get riding(): boolean { return !!this.cart; }

  /**
   * Every Rift Anchor in this town's Delve (the endless world: everywhere the
   * player has been), west to east. Generates the Delve once if it has not been.
   */
  delveAnchors(): { col: number; row: number }[] {
    const home = this.anchorWorld();
    return home ? this.findAllPlaced(home.t, 'rift-anchor') : [];
  }
  /** Where Rift Anchors are looked for: the realm Delve the Keeper stands in, else this town's Delve. */
  private anchorWorld(): { area: AreaDef; t: Terrain } | null {
    if (this.areaDef.terrain?.realm && this.terrain) return { area: this.areaDef, t: this.terrain };
    const entrance = this.delveEntrance();
    const t = entrance ? this.terrainFor(entrance.area) : null;
    return entrance && t ? { area: entrance.area, t } : null;
  }
  /**
   * Step through a Rift Anchor: from town or anywhere in its Delve, stand
   * beside the anchor at (col, row). Nothing is simulated in between (a fade).
   * Unlike the camp from town, it does not heal: it is a door, not a rest.
   * False (nothing moves) when there is no anchor there or no room beside it.
   */
  travelToAnchor(col: number, row: number): boolean {
    if (this.paused || this.hp <= 0) return false;
    const home = this.anchorWorld();
    const entrance = home ? { area: home.area } : null, t = home?.t ?? null;
    if (!entrance || !t) return false;
    this.worlds.get(entrance.area.id)?.center(col);
    if (!t.inside(col, row) || t.kind[t.index(col, row)] !== ANCHOR_KIND) return false;
    const x = (col + .5) * CELL, feet = t.top + (row + 1) * CELL;
    if (boxHits(t, x, feet, DELVE_BOX)) {
      this.say('play.uh.anchor.blocked', 'Something fills the space round that anchor. Dig it clear from this side first.');
      this.report();
      return false;
    }
    const fromTown = this.areaDef !== entrance.area;
    if (fromTown) { this.enter(entrance.area); this.resetPosition(x); }
    this.cart = null; this.grapple = null; this.carryX = 0; this.climbing = false;
    this.cancelMove();
    this.player.x = x; this.player.y = feet; this.player.vy = 0; this.player.grounded = true;
    this.worldAt = ''; this.fogAt = NaN;
    this.say('play.uh.anchor.arrive', 'The anchor holds, and both ends agree. You step through.');
    this.report();
    return true;
  }

  /** The node id at a cell of an area the engine has loaded, or null (another area, not generated yet). */
  nodeIdAt(areaId: string, index: number): string | null {
    const world = this.worlds.get(areaId);
    if (world) {
      // The endless Delve files cells by a stable id (SectorWorld.cellId); null when that cell is not in memory.
      const at = world.cellOf(index);
      const kind = at ? world.kindAt(at.col, at.row) : null;
      return kind === null ? null : TERRAIN_NODE_LIST[kind].id;
    }
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
    if (this.world) for (const column of this.world.loadedColumns()) this.spawnHalls(this.areaDef, column);
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
  /**
   * The player's Keeper as chosen at the Glass of Becoming, wearing `gear`
   * (keeper-gear.ts layers: helm, chest, cloak, gloves, greaves, boots, the held
   * weapon at its grip). Cheap to call repeatedly: the painter (and its cached
   * frames) is rebuilt only when the look or the gear changes. null → the
   * painted rig Keeper.
   */
  setKeeperLook(look: KeeperLook | null, gear: KeeperGear | null = null): void {
    if (!look || !this.canPaint) { this.keeperPainter = null; return; }
    const next = new KeeperPainter(look, gear);
    if (next.key !== this.keeperPainter?.key) this.keeperPainter = next;
  }
  /** Light up the pixel Keeper's face for a moment: joy on a level up, surprise on a rare find. Visual only. */
  keeperFeel(face: 'happy' | 'surprised', seconds = 1): void {
    this.feelFace = face; this.feelUntil = this.elapsed + seconds;
  }
  private peerPainter(id: string): KeeperPainter | null {
    if (!this.canPaint) return null;
    let painter = this.peerPainters.get(id);
    if (!painter) {
      if (this.peerPainters.size > 32) this.peerPainters.clear();
      painter = new KeeperPainter(lookFromSeed(id));
      this.peerPainters.set(id, painter);
    }
    return painter;
  }
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
   * What the Keeper carries that the world uses without placing it (Phase 8):
   * a Seam Cart (E on a rail boards it) and a Thornroot Grapple (chosen on the
   * hotbar, a press on a cell within GRAPPLE_CELLS throws it).
   */
  setGear(gear: { cart?: boolean; grapple?: boolean; veil?: boolean; shears?: boolean; lens?: boolean }): void {
    // The Veil Lantern (the Ink Deeps): carried, it lets the lantern reach further in the gloom and keep some light under ink.
    // The Rootsever Billhook (the Root Deeps): what you dig is cut at the root. The Dawn Lens (the Prism Mines): your lantern lights shadow glass.
    this.gear = { cart: !!gear.cart, grapple: !!gear.grapple, veil: !!gear.veil, shears: !!gear.shears, lens: !!gear.lens };
    if (!this.gear.cart && this.cart) this.leaveCart(0, 0);
    if (!this.gear.grapple) this.grapple = null;
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
    if (mode === 'place' && isHandTool(this.placing)) {
      // A grapple is thrown once, at the pressed cell: no drag.
      this.holdMode = null;
      if (this.throwAt(aim.col, aim.row)) this.holdActs++;
      return;
    }
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
    let col = t.colOf(this.dragLast), row = t.rowOf(this.dragLast);
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
      const col = t.colOf(index), row = t.rowOf(index);
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
    this.walkX = this.clampX(x);
    this.onArrive = onArrive ?? null;
    return true;
  }
  cancelMove(): void { this.walking = false; this.onArrive = null; }
  /** An x the Keeper can stand at: inside the area, or (the endless Delve) inside the loaded ring. */
  private clampX(x: number): number { return this.world ? this.world.t.clampX(x, this.areaDef.width) : Math.max(30, Math.min(this.areaDef.width - 30, x)); }
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
    this.glim.flyTo(x, this.terrain ? this.player.y - 110 : FLOOR - 130);
    return x;
  }
  /** The bond's sense: Glim glows brighter (the host decides when; a Mirror Substitute's dim still wins). */
  setGlimBright(bright: boolean): void { this.glim.bright = bright; }
  /** Where Glim is, for the HUD's data attributes and the tell: world x, the Show me target, dimmed, brightened. */
  get glimView(): { shown: boolean; x: number; targetX: number | null; arrived: boolean; dimmed: boolean; bright: boolean } {
    const g = this.glim;
    return { shown: g.shown, x: Math.round(g.x), targetX: g.targetX, arrived: g.arrived, dimmed: g.dim, bright: g.bright && !g.dim };
  }
  /** Waystone travel: stand in another town's spawn. Monsters, drops and any walk reset. */
  setTown(town: TownDef): void {
    this.town = town; this.enter(town); this.resetPosition(town.spawnX);
    this.message = town.arrival ?? town.name; this.report();
  }
  /** Stand the Keeper on the floor at x in the current area. No interaction. */
  placeAt(x: number): void {
    this.cancelMove();
    this.player.x = this.clampX(x);
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
    if (this.cart) { this.leaveCart(this.cart.dir * this.cart.speed * .9, -560); return; }
    if (this.grapple) { this.releaseGrapple(true); return; }
    if (this.geo) {
      const dir = (Number(this.input.has('right')) - Number(this.input.has('left'))) as -1 | 0 | 1;
      if (this.mover.pressJump(this.player, { dir, jump: true, down: this.input.has('down'), facing: this.facing }, this.geo)) { this.climbing = this.mover.busy; this.cancelMove(); return; }
      this.climbing = false;
    }
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
    if (monster.def.trait === 'furnace' && !(this.furnace?.monster === monster && furnaceOpen(this.furnace.state))) {
      monster.flash = .08;
      this.clang(monster.x, floor - 140 * this.figure, 'Banked. Douse its four vents with water');
      return;
    }
    if (monster.def.trait === 'warden' && !monster.frozen) {
      monster.flash = .08;
      this.clang(monster.x, floor - 120 * this.figure, 'It is not there while it is dark. Light a brazier and hold it in the light');
      return;
    }
    if (monster.def.trait === 'prism' && !monster.frozen) {
      monster.flash = .08;
      this.clang(monster.x, floor - 120 * this.figure, 'The blow passes through light. Turn the mirror and catch it in the beam');
      return;
    }
    // The Graftmother, held by a heart-root: a blow does a quarter (verdant.ts).
    if (monster.def.trait === 'graft' && this.heartRoots > 0) {
      damage = Math.max(1, Math.round(damage * GRAFT_SHARE));
      this.clang(monster.x, floor - 120 * this.figure, 'Her roots drink the blow. Cut the heart-roots');
    }
    if (monster.def.trait === 'dormant' && !monster.awake) {
      // Struck, it remembers: the heat it took comes out, and so does it.
      monster.awake = true; monster.timer = .7;
      this.debris.chip(monster.x, floor - 20 * this.figure, '#ffb066', this.reducedMotion ? 3 : 10);
    }
    this.atmosphere.burst(monster.x, floor - 85 * this.figure, String(damage));
    monster.hp = Math.max(0, monster.hp - damage);
    monster.flash = .14; monster.recoil = 1;
    this.impact(monster.hp === 0 ? .09 : .055, monster.hp === 0 ? 7 : 3);
    if (!this.reducedMotion) monster.knock = Math.sign(monster.x - this.player.x || this.facing) * 22 * this.figure;
    if (monster.hp === 0 && monster.minion) {
      // The furnace's own ember: it gives its heat back. No drop, no tally (nothing to farm).
      monster.dying = DEATH_FADE; monster.respawn = Infinity; this.spentMinions = true;
      return;
    }
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
    if (!def || (def.once && this.flagged(def.once) && !def.rematch) || this.monsters.some(m => m.def === def && m.hp > 0)) return false;
    const [lo, hi] = def.range ?? [this.clampX(-Infinity), this.clampX(Infinity)];
    const at = Math.max(lo, Math.min(hi, x));
    const monster: Monster = { def, maxHp: def.hp, x: at, spawn: at, hp: def.hp, phase: 'idle', timer: 1.5, facing: -1, respawn: 0, flash: 0, knock: 0, dying: 0, born: SPAWN_RISE, shownHp: def.hp, recoil: 0 };
    this.monsters.push(monster);
    if (def.trait === 'furnace') {
      this.startFurnace(monster);
      this.say('play.uh.furnace.wakes', 'The Banked Furnace wakes, and the hall breathes with it. Douse its four vents with water from the trough, then strike its core.');
    }
    else this.say('play.fish.lampRises', `${def.name} rises, and every light in the cavern dims. Light a torch beside it to fight it.`, { name: def.name });
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
    let broke = 0, chipped = 0, blocked = 0, rich = false, sound = '';
    for (let n = 0; n < count; n++) {
      const index = this.hitScratch[n];
      const col = t.colOf(index), row = t.rowOf(index);
      const node = t.nodeAt(col, row);
      const result = this.hitCell(col, row, allowed, quiet || blocked > 0);
      if (result === HIT_BROKE) { broke++; rich ||= !!node.yield; sound ||= node.id; }
      else if (result === HIT_CHIP || result === HIT_REFUSED) { chipped++; sound ||= node.id; }
      else if (result === HIT_BLOCKED) blocked++;
    }
    // One sound for the whole swing: the cell that gave, else the cell that chipped, else a clang.
    if (broke) this.sfx('break', sound); else if (chipped) this.sfx('dig', sound); else if (blocked && !quiet) this.sfx('clang');
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
    // The skill first, then the story (the Banked seal: Delving 15, then Kael's word).
    const level = node.minLevel && this.skillLevels ? this.skillLevels[node.discipline] ?? 1 : Infinity;
    if (node.minLevel && level < node.minLevel) {
      this.debris.chip(cx, cy, '#ffe2a8', quiet ? 2 : 6);
      if (!quiet) this.clang(cx, cy, `Clang! Needs ${titleCase(SKILL_NAME[node.discipline] ?? node.discipline)} ${node.minLevel}`);
      return HIT_BLOCKED;
    }
    if (node.guard && !this.flagged(node.guard.flag)) {
      this.debris.chip(cx, cy, node.fleck, quiet ? 2 : 6);
      if (!quiet) this.clang(cx, cy, node.guard.refusal); else this.message = `${node.guard.refusal}.`;
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
        kind: TOOL_ACTION[check.tool], areaId: this.areaDef.id, cellKey: cellKey(col, row), node: node.id,
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
    const col = t.colOf(index), row = t.rowOf(index);
    const x0 = col * CELL, y0 = t.top + row * CELL, p = this.player;
    return p.x + DELVE_BOX.halfWidth > x0 && p.x - DELVE_BOX.halfWidth < x0 + CELL && p.y > y0 && p.y - DELVE_BOX.height < y0 + CELL;
  }
  /** Water met lava: save the obsidian cell (a made cell: its block only, never XP), hiss and say so. */
  private reacted(t: Terrain, areaId: string, index: number, made: boolean): void {
    const col = t.colOf(index), row = t.rowOf(index);
    if (made && this.terrain === t) {
      this.placedGen.delete(index);
      this.recordCell(t, index);
    } else if (made && this.worlds.get(areaId)?.t === t) {
      this.worlds.get(areaId)!.record(index);
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
    if (this.world && this.world.t === t) { this.world.saveLiquids(); return; }
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
    if (!this.immersed && imm.body) this.sfx('splash', LIQUID_IDS[imm.body] ?? undefined);
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
    const col = t.colOf(index), row = t.rowOf(index);
    const accepted = this.options.onTakeBack?.({
      item: def.id, areaId: this.areaDef.id, cellKey: cellKey(col, row), index: this.cellIdOf(t, index),
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
    const col = t.colOf(index), row = t.rowOf(index);
    // The world must take it before the satchel is asked.
    const ok = full ? sim.pour(index, type, true) : sim.scoop(index, true) === type;
    if (!ok) {
      if (full) this.say('play.delve.bucket.noRoom', 'No room to pour there.');
      else this.say('play.delve.bucket.tooShallow', 'Too shallow: a bucket needs a full cell of it, joined together.');
      this.report(); return false;
    }
    if (!full && type === LIQUID_INK) {
      this.say('play.rift.ink.bucket', 'The ink runs straight back out of the bucket. It will not be carried out of the dark.');
      this.report(); return false;
    }
    const to: BucketId = full ? 'seam-bucket' : BUCKET_FOR[type];
    const accepted = this.options.onBucket?.({
      from: bucket, to, areaId: this.areaDef.id, cellKey: cellKey(col, row), index: this.cellIdOf(t, index), liquid: LIQUID_IDS[type] as LiquidKind,
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
      if (col < t.colLo || col >= t.colHi) break;
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
    const col = t.colOf(index), row = t.rowOf(index);
    this.cancelMove();
    this.line = {
      phase: 'wait', liquid: t.liqType[index], biome: t.biomeAt(row).id, col, row,
      timer: this.biteWait(3, 9), bobX: (col + .5) * CELL, bobY: surfaceY(t, row, t.liqLevel[index]), castId: '',
    };
    if (Math.abs(this.line.bobX - this.player.x) > 4) this.facing = this.line.bobX > this.player.x ? 1 : -1;
    this.say('play.fish.cast', 'The line is in. When the bob dips, press E (or tap).');
    this.sfx('cast');
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
  landFish(recastIn = .6, label?: string): void {
    if (!this.line) return;
    // With a label ("+1 Blindfin") the fish leaves the water and arcs into the Keeper's
    // hands, and the label rises where it lands (visual only; the catch is already the host's).
    if (label !== undefined) {
      if (this.reducedMotion) { this.atmosphere.burst(this.player.x, this.player.y - 130 * this.figure, label); this.sfx('catch'); }
      else this.catchArc = { sx: this.line.bobX, sy: this.line.bobY, t: 0, label };
    }
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
      this.sfx('bite');
      // Rings on the water where the fish took it.
      if (!this.reducedMotion) { this.ripples.push({ x: line.bobX, y: line.bobY, t: 0 }, { x: line.bobX, y: line.bobY, t: -.25 }); if (this.ripples.length > 6) this.ripples.splice(0, this.ripples.length - 6); }
      // Auto-fish: Use held through the dip hooks at once (the Off grade, no mini-game).
      if (this.useHeld) this.hook(true);
      this.report();
      return;
    }
    // Missed the dip: nothing lost, it nibbles again (and a tap in the next moment is a late hook, not a reel-in).
    line.phase = 'wait'; line.timer = this.biteWait(1, 3); this.lateHook = LATE_HOOK;
    this.say('play.fish.missed', 'Missed it. It is still down there: wait for the next dip.');
  }
  // -- World feel: sounds out, fish, ripples and the catch's arc (shared/sound, fish-shadows.ts) --

  /** Hand a world sound to the host. Never throws into the step. */
  private sfx(kind: EngineSfx['kind'], node?: string): void {
    const on = this.options.onSfx;
    if (!on) return;
    try { on(node ? { kind, node } : { kind }); } catch { /* sound is never worth a frame */ }
  }
  /** The terrain node under the Keeper's feet (undefined on a town street or in the air). */
  private groundNode(): string | undefined {
    const t = this.terrain;
    if (!t) return undefined;
    const col = t.colAt(this.player.x), row = t.rowAt(this.player.y + 1);
    return t.inside(col, row) && t.solid(col, row) ? t.nodeAt(col, row).id : undefined;
  }
  /** Water, lava or ink within a few cells (the ambience beds). Sparse sampling, at report rate. */
  private liquidsNear(t: Terrain): { water: boolean; lava: boolean; ink: boolean } {
    let water = false, lava = false, ink = false;
    const c0 = t.colAt(this.player.x), r0 = t.rowAt(this.player.y - CELL);
    for (let dr = -4; dr <= 4; dr += 2) for (let dc = -8; dc <= 8; dc += 2) {
      const col = c0 + dc, row = r0 + dr;
      if (!t.inside(col, row)) continue;
      const i = t.index(col, row);
      if (!t.liqLevel[i]) continue;
      const k = t.liqType[i];
      if (k === LIQUID_WATER) water = true; else if (k === LIQUID_LAVA) lava = true; else if (k === LIQUID_INK) ink = true;
    }
    return { water, lava, ink };
  }
  /** The Keeper's head in canvas CSS px (0,0 = the canvas's top-left), for popups the host floats over it. */
  keeperScreen(): { x: number; y: number } {
    const scale = this.height / 720;
    return { x: (this.player.x - this.camera) * scale, y: (this.player.y - 160 * this.figure - this.cameraY) * scale };
  }
  /** The fish under the water in view (over the water's body, as shadows seen through it). */
  private drawFish(c: CanvasRenderingContext2D, t: Terrain, c0: number, c1: number, r0: number, r1: number, time: number): void {
    const line = this.line && this.line.liquid === LIQUID_WATER ? { col: this.line.col, row: this.line.row, phase: this.line.phase, bobX: this.line.bobX } : null;
    this.fishCount = placeFish(t, c0, c1, r0, r1, this.reducedMotion ? 0 : time, line, this.fish, this.budget.tier === 'lite' ? 10 : 24);
    drawFishShadows(c, this.fish, this.fishCount);
  }
  /** Bite ripples (pixel rings on the surface) and the landed fish's arc into the Keeper. World px. */
  private drawCatchFx(c: CanvasRenderingContext2D, delta: number): void {
    if (this.ripples.length) {
      c.save(); c.fillStyle = '#d0f6ff';
      for (const r of this.ripples) {
        r.t += delta / .9;
        if (r.t <= 0 || r.t >= 1) continue;
        const w = Math.round((4 + r.t * 18) / ART) * ART, y = Math.round(r.y / ART) * ART;
        c.globalAlpha = .7 * (1 - r.t);
        c.fillRect(r.x - w, y, ART * 2, ART); c.fillRect(r.x + w - ART, y, ART * 2, ART);
        c.fillRect(r.x - w * .6, y - ART, ART, ART); c.fillRect(r.x + w * .6, y - ART, ART, ART);
      }
      c.restore();
      this.ripples = this.ripples.filter(r => r.t < 1);
    }
    const arc = this.catchArc;
    if (!arc) return;
    arc.t += delta / .7;
    if (arc.t >= 1) {
      this.catchArc = null;
      this.atmosphere.burst(this.player.x, this.player.y - 130 * this.figure, arc.label);
      this.sfx('catch');
      return;
    }
    const ex = this.player.x, ey = this.player.y - 120 * this.figure;
    const u = arc.t, x = arc.sx + (ex - arc.sx) * u, y = arc.sy + (ey - arc.sy) * u - Math.sin(u * Math.PI) * 90;
    const d = ex >= arc.sx ? 1 : -1, px = Math.round(x / ART) * ART, py = Math.round(y / ART) * ART;
    c.save();
    // Droplets off the tail, then the fish: silver, a dark eye, flipping as it flies.
    c.fillStyle = '#d0f6ff'; c.globalAlpha = .8 * (1 - u);
    c.fillRect(px - d * ART * 7, py + ART * 2, ART, ART); c.fillRect(px - d * ART * 9, py - ART, ART, ART);
    c.globalAlpha = 1;
    const flip = Math.floor(u * 6) & 1 ? 1 : -1;
    c.fillStyle = '#cfe3ea'; c.fillRect(px - ART * 3, py - ART, ART * 6, ART * 2);
    c.fillStyle = '#8fb3c2'; c.fillRect(px - d * ART * 5 - (d > 0 ? 0 : ART), py - ART * (flip > 0 ? 2 : 0), ART * 2, ART * 2);
    c.fillStyle = '#140a1f'; c.fillRect(px + d * ART * 2 - (d < 0 ? ART : 0), py - ART, ART, ART);
    c.restore();
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
      for (let col = Math.max(t.colLo, pc - 8); col <= Math.min(t.colHi - 1, pc + 8); col++) {
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
    const col = t.colOf(picked), row = t.rowOf(picked);
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
    const col = t.colOf(index), row = t.rowOf(index);
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
    const col = t.colOf(index), row = t.rowOf(index);
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
    return !!t && (t.inscriptions.has(index) || !!TERRAIN_NODE_LIST[t.kind[index]].use || (this.gear.cart && !this.cart && RAIL_KINDS[t.kind[index]] === 1));
  }
  /** Read a carved wall, or ask the host to open a chest or camp. */
  private useCell(index: number): void {
    const t = this.terrain;
    if (!t) return;
    if (t.inscriptions.has(index)) { this.readInscription(index); return; }
    if (RAIL_KINDS[t.kind[index]] === 1) { this.boardCart(index); return; }
    const use = TERRAIN_NODE_LIST[t.kind[index]].use;
    if (!use || use === 'mark') return;
    const col = t.colOf(index), row = t.rowOf(index);
    if (use === 'shrine') { this.touchShrine(t, col, row); return; }
    if (use === 'mirror') { this.turnMirror(t, col, row); return; }
    this.report();
    this.options.onUse?.({ kind: use, areaId: this.areaDef.id, cellKey: cellKey(col, row), index: this.cellIdOf(t, index),
      ...(use === 'anchor' || use === 'furnace' || use === 'gate' || use === 'brazier' ? { col, row } : {}),
      ...(use === 'gate' ? { node: TERRAIN_NODE_LIST[t.kind[index]].id } : {}) });
  }
  /**
   * A rift shrine: "a passage created by difference". Touched, it shows the
   * tunnels round it on the map (a sector column either side, as far as the
   * loaded world reaches) and the host pays its first touch.
   */
  private touchShrine(t: Terrain, col: number, row: number): void {
    const world = this.world;
    if (world?.revealRect(col - SECTOR, col + SECTOR, 0, t.rows - 1)) world.flushFog();
    this.debris.chip((col + .5) * CELL, t.top + (row + .5) * CELL, '#b88cff', this.reducedMotion ? 2 : 10);
    this.blastFlash = Math.max(this.blastFlash, .6);
    this.say('play.delve.shrine.touched', 'The shrine shows you the tunnels round it. Open the map (M) to see them.');
    this.report();
    this.options.onDiscover?.({ kind: 'shrine', id: `rift:${col},${row}`, biome: t.biomeAt(row).id });
  }
  /** The carved wall, chest or camp the Keeper's body stands against (cell index), or -1. No allocation. */
  private findInteractive(): number {
    const t = this.terrain;
    if (!t) return -1;
    const p = this.player;
    const c0 = t.colAt(p.x - DELVE_BOX.halfWidth - INTERACT_REACH), c1 = t.colAt(p.x + DELVE_BOX.halfWidth + INTERACT_REACH);
    const r0 = t.rowAt(p.y - DELVE_BOX.height), r1 = t.rowAt(p.y - .01);
    for (let row = Math.max(0, r0); row <= Math.min(t.rows - 1, r1); row++) {
      for (let col = Math.max(t.colLo, c0); col <= Math.min(t.colHi - 1, c1); col++) {
        const index = t.index(col, row);
        if (this.usable(index)) return index;
      }
    }
    // A prism mirror set in the floor (the Prism Mines' sunwells): the one usable thing under the feet.
    if (this.areaDef.terrain?.realm === 'luminous' && r1 + 1 < t.rows) {
      for (let col = Math.max(t.colLo, c0); col <= Math.min(t.colHi - 1, c1); col++) {
        const index = t.index(col, r1 + 1);
        if (t.kind[index] === LUM.mirrorA || t.kind[index] === LUM.mirrorB) return index;
      }
    }
    return -1;
  }
  /** Read a carved wall: tell the host (it decides if this is a first reading), glint it. */
  private readInscription(index: number): void {
    const t = this.terrain;
    const id = t?.inscriptions.get(index);
    if (!t || !id) return;
    const col = t.colOf(index), row = t.rowOf(index);
    const cx = (col + .5) * CELL, cy = t.top + (row + .5) * CELL;
    this.debris.chip(cx, cy, '#e8c47a', this.reducedMotion ? 2 : 6);
    if (id.startsWith(MARK_PREFIX)) {
      // A hammer-mark: the Keeper takes a rubbing (the host files it once, for Kael).
      const n = id.slice(MARK_PREFIX.length);
      this.say('play.uh.mark.rubbing', 'A hammer-mark, cut where one of the Four stood. You take a rubbing of it.');
      this.report();
      this.options.onDiscover?.({ kind: 'mark', id: `hammer-mark-${n}`, biome: t.biomeAt(row).id });
      return;
    }
    if (id.startsWith(FIELD_NOTE_PREFIX)) this.say('play.delve.fieldNoteTrace', 'Someone left a note in the rock for whoever came next.');
    else this.say('play.delve.inscriptionTrace', 'You trace the carving with a finger. The words are older than the Seamworks.');
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
    // In the cart, E steps off where it stands (momentum and all).
    if (this.cart) { this.leaveCart(this.cart.dir * this.cart.speed * .6, 0); this.say('play.uh.cart.off', 'You step off the cart.'); this.report(); return; }
    // A line in the water: E hooks a bite, or reels the line back in (a tap just
    // after a dip is a late hook, not a reel-in: the fish is still there).
    if (this.line) {
      if (this.hook()) return;
      if (this.lateHook > 0) { this.say('play.fish.missed', 'Missed it. It is still down there: wait for the next dip.'); this.report(); return; }
      this.reelIn(); return;
    }
    const station = this.nearbyStation();
    const find = station ? null : this.findInReach();
    if (find) { this.useFind(find); this.report(); return; }
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
    this.updateFolk();
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
      // The endless Delve: the loaded ring follows the Keeper (a sector column at a time).
      this.keepWorld();
      // In water or lava the Keeper wades and swims: slower, sinking slowly, and Jump held swims up.
      this.sense(this.terrain);
      const swim = this.immersed ? SWIM[this.immersed] : null;
      if (this.cart) { this.climbing = false; this.rideCart(dt, this.terrain); }
      else if (this.grapple) { this.climbing = false; this.pullGrapple(dt, this.terrain); }
      else {
        if (swim) velocityX *= swim.speed;
        // Reeling a fish in holds the Keeper still.
        if (this.line?.phase === 'hooked') velocityX = 0;
        // On a ladder (or a rope) Up (jump) climbs and Down descends; anywhere else Down drops through platforms.
        this.climbing = onLadder(this.terrain, this.player.x, this.player.y, DELVE_BOX);
        if (this.climbing) {
          this.carryX = 0;
          const climb = this.input.has('down') ? 1 : this.input.has('jump') ? -1 : 0;
          climbTerrainBody(this.player, velocityX, climb, dt, this.terrain, DELVE_BOX, this.areaDef.width);
        } else {
          // Momentum a launch off a rail or a grapple release carried, and the Banked Furnace's breath.
          velocityX += this.carryX + this.furnacePull();
          if (swim && this.input.has('jump') && this.line?.phase !== 'hooked') this.player.vy = Math.max(-swim.rise, this.player.vy - 2400 * dt);
          stepTerrainBody(this.player, velocityX, dt, this.terrain, DELVE_BOX, this.areaDef.platforms, this.areaDef.width, this.input.has('down') || this.dropTime > 0, swim);
        }
        if (this.carryX) {
          // Walking against it, or standing on the ground, bleeds it fast; in the air it carries.
          const against = direction && Math.sign(direction) !== Math.sign(this.carryX);
          this.carryX *= Math.exp(-(this.player.grounded || against ? CARRY_GROUND : CARRY_AIR) * dt);
          if (Math.abs(this.carryX) < 6) this.carryX = 0;
        }
      }
      this.reachedUnderhearth(this.terrain);
    } else if (this.geo) {
      this.mover.step(this.player, { dir: direction as -1 | 0 | 1, jump: this.input.has('jump'), down: this.input.has('down'), facing: this.facing }, velocityX, dt, this.geo);
      this.climbing = this.mover.busy;
      if (this.mover.event === 'grab' || this.mover.event === 'walljump') this.cancelMove();
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
      this.updateFurnace(dt, this.terrain);
      if (this.areaDef.terrain?.realm) this.updateRealm(dt, this.terrain);
    } else if (this.sites.length && this.input.has('attack') && this.attackCooldown <= 0 && this.siteInReach()) this.attack();
    const now = this.clock();
    for (const sites of this.siteCache.values()) for (const s of sites) {
      s.shake = Math.max(0, s.shake - dt * 5);
      if (!s.ready) this.refreshSite(s, now);
    }
    if (!wasGrounded && this.player.grounded && !this.climbing) { this.landing = .18; this.atmosphere.burst(this.player.x, this.player.y - 4); this.sfx('land', this.groundNode()); }
    if (direction && this.player.grounded && this.elapsed - this.stepAt > .2) {
      this.stepAt = this.elapsed; if (!this.reducedMotion) this.atmosphere.burst(this.player.x - direction * 16, this.player.y - 3);
      // A footstep every other dust puff: about the pace of a walk.
      if ((this.stepCount = (this.stepCount + 1) & 1) === 0) this.sfx('step', this.groundNode());
    }
    for (const drop of this.drops) {
      drop.age += dt;
      if (drop.age > .3 && Math.abs(drop.x - this.player.x) < 65 && Math.abs(this.player.y - drop.y) < 80) {
        if (this.options.onLoot?.({ id: drop.id, coins: drop.coins, ore: drop.ore, material: drop.material }) === false) continue;
        this.atmosphere.burst(drop.x, FLOOR - 45, drop.coins ? `+${drop.coins} coins` : `+${drop.ore} ${drop.short ?? 'ore'}`);
        this.coins += drop.coins; drop.age = -1;
        this.keeperFeel('happy', .8);
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
      // The Banked Furnace never walks or swings: its fight is its breath (updateFurnace).
      if (monster.def.trait === 'furnace') continue;
      // A Banked Ember lies cold until something strikes it.
      if (monster.def.trait === 'dormant' && !monster.awake) { monster.phase = 'idle'; continue; }
      // The Ink Deeps' shades: frozen in light, fast in the dark (umbral.ts).
      if (monster.def.trait === 'shade' || monster.def.trait === 'warden') { this.stepShade(monster, dt); continue; }
      // The Hollow Sun caught in a beam cannot move or strike (luminous.ts).
      if (monster.def.trait === 'prism' && monster.frozen) { monster.phase = 'idle'; monster.timer = Math.max(monster.timer, .3); continue; }
      const safeX = this.areaDef.safeX ?? 0;
      const floor = monster.def.floorY ?? FLOOR, k = this.figure;
      // In a delve a Maw only cares about a Keeper standing in its cavern.
      const away = (!!this.terrain || !!this.heights) && Math.abs(this.player.y - floor) > 120;
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
          // An Ironwood Sentinel shoulders the ceiling where it should be: unsupported loose rock comes down.
          if (monster.def.trait === 'shoulder') this.shoulderCeiling(monster);
          if (Math.abs(distance) < 170 * k && distance * monster.facing > -40 * k && this.player.y > floor - 105 * Math.max(k, .6) && this.player.y < floor + 40 && this.dodgeTime <= 0 && this.hurtTime <= 0) {
            this.hp = Math.max(0, this.hp - 12); this.hurtTime = .8; this.wound = 1;
            this.impact(.07, this.hp === 0 ? 12 : 8);
            if (this.hp === 0) this.say('play.hud.eng.keeperFalls', 'The Keeper falls. Restart the hunt or return to camp.');
          }
        } else if (monster.phase === 'strike') { monster.phase = 'recover'; monster.timer = 1.1; }
        else { monster.phase = 'idle'; monster.timer = .35; }
      }
    }
    // The furnace's spent embers leave once they have faded (they never come back on their own).
    if (this.spentMinions) {
      this.spentMinions = false;
      this.monsters = this.monsters.filter(m => !(m.minion && m.hp <= 0 && m.dying <= 0));
      if (this.monsters.some(m => m.minion && m.hp <= 0)) this.spentMinions = true;
    }
  }

  // ── The Rift Gates and the realm Delves behind them (rift-gates.model.ts, umbral.ts) ──

  /** Where the Keeper came in from (the Ember Delve's gate cell), so the way out is the way in. */
  private realmReturn: { areaId: string; col: number; row: number } | null = null;
  /** The realm Delve's own clock (seconds since stepping in): the tide runs on it, so every arrival is at low tide. */
  private realmTime = 0;
  private tide: { phase: TidePhase; rows: number; next: number } = { phase: 'low', rows: 0, next: 0 };
  /** The dark's last chance to move the drift pockets (SHIFT_PERIOD epochs of realm time). */
  private shiftEpoch = 0;
  /** Lit braziers: cell index → seconds left. Session only (a reloaded brazier is out). */
  private readonly braziers = new Map<number, number>();
  /** The Keeper's head is under ink (a pool or the tide): the lantern all but goes out. */
  private inkBlind = false;
  /** The mirrored ceiling over the Keeper (its underside's world y), while standing under one. */
  private mirror: { y: number } | null = null;
  /** Where the Keeper was, the last few tenths of a second (the reflection walks a little behind). */
  private readonly mirrorTrail: { x: number; y: number; facing: number }[] = [];
  private wardenCall = WARDEN_CALL;

  /** The realm whose Delve the Keeper stands in, or null. */
  get realm(): RiftRealm | null { return this.areaDef?.terrain?.realm ? realmOfArea(this.areaDef.id) : null; }
  /**
   * Step through a Rift Gate (the cell at `from` in the Ember Delve) into the
   * realm Delve `areaId`, beside its return gate. Nothing between is simulated;
   * it does not heal (a door, not a rest). False when there is no such Delve.
   */
  enterRealm(areaId: string, from: { col: number; row: number }): boolean {
    if (this.paused || this.hp <= 0) return false;
    const area = areaOf(this.town, areaId), realm = realmOfArea(areaId);
    if (!area?.terrain || !realm) return false;
    this.realmReturn = { areaId: this.areaDef.id, col: from.col, row: from.row };
    this.terrainFor(area);
    this.worlds.get(area.id)?.center(REALM_ARRIVAL.col);
    this.enter(area);
    const t = this.terrain!, at = realmArrival(t.top);
    this.cancelMove(); this.climbing = false;
    this.player.x = at.x; this.player.y = at.feet; this.player.vy = 0; this.player.grounded = true;
    this.worldAt = ''; this.fogAt = NaN;
    this.realmTime = 0; this.tide = tideAt(0); this.shiftEpoch = 0;
    this.setFlag(enteredFlag(realm));
    if (realm === 'verdant') {
      if (!this.tell('roots', 'play.rift.rule.roots', 'Glim: The walls are wood here, and the wood is awake. Listen: it creaks when nobody is digging.')) {
        this.say('play.rift.arrive.verdant', 'You step out into the Root Deeps. The gate behind you holds.');
      }
    } else if (realm === 'luminous') {
      this.lightClock = 0;
      if (!this.tell('light', 'play.rift.rule.light', 'Glim: The light here is heavy. Where a beam crosses open air, you can stand on it. Where it falls down, you can climb it.')) {
        this.say('play.rift.arrive.luminous', 'You step out into the Prism Mines. The gate behind you holds.');
      }
    } else if (!this.tell('dark', 'play.rift.rule.dark', 'Glim: Ink-blind down here. My light barely reaches past your hands. Torches push the dark back; set them as you go.')) {
      this.say('play.rift.arrive', 'You step out into the Ink Deeps. The gate behind you holds.');
    }
    this.report();
    return true;
  }
  /** Step back out through the realm's gate: the Ember Delve, beside the gate you came in by. False outside a realm Delve. */
  leaveRealm(): boolean {
    const realm = this.realm;
    if (!realm || this.paused || this.hp <= 0) return false;
    const entrance = this.delveEntrance();
    if (!entrance) return false;
    const t = this.terrainFor(entrance.area);
    const back = this.realmReturn?.areaId === entrance.area.id ? this.realmReturn : t ? this.gateCellOf(entrance.area, realm) : null;
    if (!t || !back) return false;
    this.worlds.get(entrance.area.id)?.center(back.col);
    // Beside the gate's opening, east of it, feet on its frame.
    let east = back.col, floor = back.row;
    for (let c = back.col - 2; c <= back.col + 2; c++) for (let r = back.row - 3; r <= back.row + 3; r++) {
      if (t.inside(c, r) && TERRAIN_NODE_LIST[t.kind[t.index(c, r)]].use === 'gate') { east = Math.max(east, c); floor = Math.max(floor, r); }
    }
    this.enter(entrance.area);
    this.cancelMove(); this.climbing = false;
    this.player.x = (east + 2.5) * CELL; this.player.y = t.top + (floor + 1) * CELL; this.player.vy = 0; this.player.grounded = true;
    this.worldAt = ''; this.fogAt = NaN;
    if (realm === 'verdant') this.say('play.rift.back.verdant', 'Back through the gate. The Root Hollows\' roots lie still, the way roots should.');
    else if (realm === 'luminous') this.say('play.rift.back.luminous', 'Back through the gate. The Grotto\'s glowcaps seem very dim after that.');
    else this.say('play.rift.back', 'Back through the gate. The Underhearth\'s heat feels like a welcome after that.');
    this.report();
    return true;
  }
  /** The Ember Delve's gate of `realm`, from the seed (its lattice cell and stratum), as a cell of its opening. */
  private gateCellOf(area: AreaDef, realm: RiftRealm): { col: number; row: number } | null {
    const world = this.worlds.get(area.id);
    if (!world) return null;
    const place = RIFT_GATES[realm].place;
    const deep = place.stratum === 'deep';
    const s = world.structuresNear(place.cell * 64 + 32, 0).find(p => p.kind === 'rift-gate' && (p.row >= 56) === deep);
    return s ? { col: s.col + 3, row: s.row + 4 } : null;
  }
  /** The Rift Gate within `cells` columns of the Keeper (and in sight of their row), its realm and its opening's cell, or null. */
  gateNear(cells: number): { realm: RiftRealm; col: number; row: number; id: string } | null {
    const at = this.keeperCell(), t = this.terrain;
    const world = this.world && this.world.t === t ? this.world : null;
    if (!at || !t || !world || this.areaDef.terrain?.realm) return null;
    for (const s of world.structuresNear(at.col, 1)) {
      if (s.kind !== 'rift-gate' || Math.abs(s.col + s.w / 2 - at.col) > cells || Math.abs(s.row + 3 - at.row) > 10) continue;
      const col = s.col + 3, row = s.row + 4;
      if (!t.inside(col, row)) continue;
      const realm = realmOfGateNode(TERRAIN_NODE_LIST[t.kind[t.index(col, row)]].id);
      if (realm) return { realm, col, row, id: s.id };
    }
    return null;
  }
  /** Light a gloam brazier (the host has taken the torch). False when it is not one, or the tide stands over it. */
  lightBrazier(col: number, row: number): boolean {
    const t = this.terrain;
    if (!t || !t.inside(col, row) || t.kind[t.index(col, row)] !== BRAZIER_KIND) return false;
    if (inInk(t, (col + .5) * CELL, t.top + (row + .5) * CELL, this.tide.rows)) {
      this.say('play.rift.brazier.drowned', 'The tide is over it. Wait for the ink to fall.');
      this.report(); return false;
    }
    const index = t.index(col, row);
    t.set(col, row, BRAZIER_LIT_KIND);
    this.braziers.set(index, BRAZIER_BURN);
    this.debris.chip((col + .5) * CELL, t.top + (row + .5) * CELL, '#ffd8a0', this.reducedMotion ? 2 : 8);
    this.say('play.rift.brazier.lit', 'The brazier takes the torch. Anything standing in its light stands still.');
    this.report();
    return true;
  }
  /** A broken rule's telegraph, said once per player (the flag is the record). True when it was said now. */
  private tell(rule: string, key: string, en: string): boolean {
    const realm = this.realm;
    if (!realm) return false;
    const flag = ruleFlag(realm, rule);
    if (this.flagged(flag)) return false;
    this.setFlag(flag);
    this.say(key, en);
    return true;
  }
  /** The lantern's reach here: the biome's gloom (ink-blind), and almost none with the head under ink. */
  private lanternShare(t: Terrain): number {
    const gloom = t.biomeAt(Math.max(0, Math.min(t.rows - 1, t.rowAt(this.player.y - 50)))).gloom;
    if (!gloom) return 1;
    // The Veil Lantern: half the gloom's toll, and the ink only halves what is left.
    const reach = this.gear.veil ? gloom + (1 - gloom) * .5 : gloom;
    return reach * (this.inkBlind ? (this.gear.veil ? .5 : .35) : 1);
  }
  /** One fixed step of the Ink Deeps' rule: the tide, ink-blindness, braziers, drift pockets, the mirror, the Warden. */
  private updateRealm(dt: number, t: Terrain): void {
    // The Root Deeps and the Prism Mines break their own rules (verdant.ts, luminous.ts).
    const realm = this.realm;
    if (realm === 'verdant') { this.updateVerdant(dt, t); return; }
    if (realm === 'luminous') { this.updateLuminous(dt, t); return; }
    this.realmTime += dt;
    const was = this.tide.phase;
    this.tide = tideAt(this.realmTime);
    if (this.tide.phase === 'rising' && was !== 'rising') {
      if (!this.tell('tide', 'play.rift.rule.tide', 'Glim: The ink is rising. At high tide it stands over the low passages and puts out braziers. It never drowns you; it blinds you. Wait high, or cross at low tide.')) {
        this.say('play.rift.tide.rising', 'The ink is rising.');
      }
      this.report();
    }
    const blind = inInk(t, this.player.x, this.player.y - DELVE_BOX.height * .85, this.tide.rows);
    if (blind !== this.inkBlind) {
      this.inkBlind = blind;
      if (blind) this.tell('ink', 'play.rift.rule.ink', 'Glim: Under the ink I can hardly see you. It does not drown you. It just takes the light.');
      this.report();
    }
    for (const [index, left] of this.braziers) {
      const col = t.colOf(index), row = t.rowOf(index);
      const drowned = inInk(t, (col + .5) * CELL, t.top + (row + .5) * CELL, this.tide.rows);
      if (left - dt > 0 && !drowned && t.kind[index] === BRAZIER_LIT_KIND) { this.braziers.set(index, left - dt); continue; }
      this.braziers.delete(index);
      if (t.kind[index] === BRAZIER_LIT_KIND) t.set(col, row, BRAZIER_KIND);
      if (Math.abs(col - t.colAt(this.player.x)) < 30) this.say(drowned ? 'play.rift.brazier.tide' : 'play.rift.brazier.out', drowned ? 'The tide puts a brazier out.' : 'A brazier gutters out.');
    }
    const epoch = Math.floor(this.realmTime / SHIFT_PERIOD);
    if (epoch !== this.shiftEpoch) { this.shiftEpoch = epoch; this.shiftPockets(t, epoch); }
    // The mirrored ceiling: the reflection walks above you, a little behind.
    const at = this.keeperCell();
    const room = at && this.world ? this.world.structureAt(at.col, at.row) : null;
    this.mirror = room && (room.kind === 'mirror-cavern' || room.kind === 'warden-hall') ? { y: t.top + room.row * CELL } : null;
    if (this.mirror) {
      this.tell('mirror', 'play.rift.rule.mirror', 'Glim: Look up. The ceiling is ink, polished by the tide. That is you up there, walking a step behind.');
      this.mirrorTrail.push({ x: this.player.x, y: this.player.y, facing: this.facing });
      if (this.mirrorTrail.length > 22) this.mirrorTrail.shift();
    } else this.mirrorTrail.length = 0;
    // Shades: said the first time one is within a dozen cells.
    for (const m of this.monsters) {
      if (m.hp <= 0 || (m.def.trait !== 'shade' && m.def.trait !== 'warden') || Math.abs(m.x - this.player.x) > 12 * CELL || Math.abs((m.def.floorY ?? FLOOR) - this.player.y) > 4 * CELL) continue;
      if (this.tell('shade', 'play.rift.rule.shade', 'Glim: A shade. In the dark it is fast; in light it cannot move at all. Keep it in the light: a torch, a brazier, my glow right beside you.')) this.report();
      // The Gloam Warden calls shadelings out of the dark while nothing lights it.
      if (m.def.trait === 'warden' && !m.frozen && (this.wardenCall -= dt) <= 0) {
        this.wardenCall = WARDEN_CALL;
        const base = this.areaDef.monsters.find(def => def.trait === 'shade');
        if (base) for (const dx of [-90, 90]) {
          const x = m.x + dx, def: MonsterDef = { ...base, spawnXs: [x], floorY: m.def.floorY, range: m.def.range };
          this.monsters.push({ def, maxHp: def.hp, x, spawn: x, hp: def.hp, phase: 'idle', timer: 1.2, facing: -1, respawn: 0, flash: 0, knock: 0, dying: 0, born: SPAWN_RISE, shownHp: def.hp, recoil: 0, minion: true });
        }
        this.say('play.rift.warden.calls', 'The Warden calls two shades out of the dark.');
      }
    }
  }
  /**
   * The dark's chance to move the drift pockets near the Keeper: each one that
   * no light reaches, nobody can see and nothing holds takes this epoch's state
   * (umbral.ts pocketPhase). The change is saved like a dig, so a reload shows
   * the pocket as it was left.
   */
  private shiftPockets(t: Terrain, epoch: number): void {
    const world = this.world, at = this.keeperCell();
    if (!world || world.t !== t || !at) return;
    const scale = this.height / 720 || 1, vw = (this.width || 1280) / scale;
    const view: CellRect = { c0: t.colAt(this.camera) - 1, c1: t.colAt(this.camera + vw) + 1, r0: t.rowAt(this.cameraY) - 1, r1: t.rowAt(this.cameraY + 720) + 1 };
    const lantern = this.lanternRadius * this.lanternShare(t);
    let moved = false;
    for (const s of world.structuresNear(at.col, 3)) {
      if (s.kind !== 'drift-pocket') continue;
      const rect: CellRect = { c0: s.col, c1: s.col + s.w - 1, r0: s.row, r1: s.row + s.h - 1 };
      if (!t.inside(rect.c0, rect.r0) || !t.inside(rect.c1, rect.r1)) continue;
      // Seen, or lit by the lantern: it holds still.
      if (rectsMeet(rect, view) || circleMeetsRect(this.player.x, this.player.y - 50, lantern, rect, t.top)) continue;
      // Anything placed in or beside it (a torch, a ladder, a block) pins it for good; so does a living creature in it.
      let pinned = false;
      for (let r = rect.r0 - 1; r <= rect.r1 + 1 && !pinned; r++) for (let c = rect.c0 - 1; c <= rect.c1 + 1 && !pinned; c++) {
        if (!t.inside(c, r)) continue;
        const k = t.kind[t.index(c, r)];
        const inside = r >= rect.r0 && r <= rect.r1 && c >= rect.c0 && c <= rect.c1;
        if ((inside && k !== 0 && k !== DRIFT_KIND) || (TERRAIN_NODE_LIST[k].placeable && TERRAIN_NODE_LIST[k].glow)) pinned = true;
      }
      if (pinned || this.monsters.some(m => m.hp > 0 && m.x >= rect.c0 * CELL && m.x <= (rect.c1 + 1) * CELL && Math.abs(t.rowAt((m.def.floorY ?? FLOOR) - 1) - rect.r1) <= 1)) continue;
      const want = pocketPhase(world.seed, s.id, epoch), now = t.kind[t.index(rect.c0, rect.r0)] === DRIFT_KIND ? 1 : 0;
      if (want === now) continue;
      for (let r = rect.r0; r <= rect.r1; r++) for (let c = rect.c0; c <= rect.c1; c++) {
        const index = t.index(c, r);
        t.set(c, r, want ? DRIFT_KIND : 0);
        this.recordCell(t, index);
      }
      if (Math.abs(s.col - at.col) < 48) moved = true;
    }
    if (moved && this.tell('shift', 'play.rift.rule.shift', 'Glim: Somewhere behind us a passage just moved. Rock here does not stay put while nobody looks. A torch inside one pins it.')) this.report();
  }
  /**
   * Whether a shade stands in strong light (umbral.ts litBy): the bright middle
   * of a placed light, a lit brazier, a glowing vein a tunnel exposes, or the
   * lantern's own core. Read from the cells round it, never from a frame (so it
   * is the same whether or not anything was drawn).
   */
  private shadeLit(m: Monster): boolean {
    const t = this.terrain;
    if (!t) return false;
    const y = (m.def.floorY ?? FLOOR) - 40 * this.figure;
    const lights = this.shadeLights;
    let count = 0;
    const col = t.colAt(m.x), row = t.rowAt(y);
    for (let r = row - 6; r <= row + 6; r++) for (let c = col - 6; c <= col + 6; c++) {
      if (!t.inside(c, r) || count >= lights.length) continue;
      const node = TERRAIN_NODE_LIST[t.kind[t.index(c, r)]];
      if (!node.glow || (node.solid && !t.exposed(c, r)) || (node.struckGlow && t.hp[t.index(c, r)] >= node.hp)) continue;
      const l = lights[count++];
      l.x = (c + .5) * CELL; l.y = t.top + (r + .5) * CELL; l.radius = node.glow.radius * 1.6;
    }
    const lantern = { x: this.player.x, y: this.player.y - 50, radius: this.lanternRadius * this.lanternShare(t) };
    return litBy(m.x, y, lights, count, lantern);
  }
  private readonly shadeLights = Array.from({ length: 24 }, () => ({ x: 0, y: 0, radius: 0 }));
  /** One fixed step of a shade: frozen in light; in the dark it crosses fast and lunges. */
  private stepShade(m: Monster, dt: number): void {
    const floor = m.def.floorY ?? FLOOR, k = this.figure;
    const lit = this.shadeLit(m);
    if (lit !== !!m.frozen) {
      m.frozen = lit;
      if (lit) this.debris.chip(m.x, floor - 30 * k, '#e8d8ff', this.reducedMotion ? 2 : 5);
    }
    if (lit) { if (m.phase !== 'idle') { m.phase = 'idle'; m.timer = .4; } return; }
    const away = !!this.terrain && Math.abs(this.player.y - floor) > 120;
    if (away) {
      m.x += Math.sign(m.spawn - m.x) * Math.min(Math.abs(m.spawn - m.x), 65 * dt);
      m.phase = 'idle'; m.timer = .5;
      return;
    }
    const distance = this.player.x - m.x;
    if (m.phase === 'idle') {
      // A shade senses a Keeper across its whole hall (a hall is a screen or two wide).
      if (Math.abs(distance) < 900 && Math.abs(distance) > 70 * k) m.x += Math.sign(distance) * SHADE_SPEED * (m.def.trait === 'warden' ? .7 : 1) * dt;
      const range = m.def.range;
      if (range) m.x = Math.max(range[0], Math.min(range[1], m.x));
      if (Math.abs(distance) < 170 * k && m.timer <= 0) { m.phase = 'windup'; m.timer = SHADE_WINDUP; m.facing = Math.sign(distance) || -1; }
    } else if (m.timer <= 0) {
      if (m.phase === 'windup') {
        m.phase = 'strike'; m.timer = .2;
        if (Math.abs(distance) < 170 * k && distance * m.facing > -40 * k && this.player.y > floor - 105 * Math.max(k, .6) && this.player.y < floor + 40 && this.dodgeTime <= 0 && this.hurtTime <= 0) {
          this.hp = Math.max(0, this.hp - (m.def.trait === 'warden' ? 26 : 18)); this.hurtTime = .8; this.wound = 1;
          this.impact(.07, this.hp === 0 ? 12 : 8);
          if (this.hp === 0) this.say('play.hud.eng.keeperFalls', 'The Keeper falls. Restart the hunt or return to camp.');
        }
      } else if (m.phase === 'strike') { m.phase = 'recover'; m.timer = .9; }
      else { m.phase = 'idle'; m.timer = .3; }
    }
  }
  /** A shade: a tall wisp of the dark, eyes like two struck sparks; stone-grey and still while lit. Returns its height (world px). */
  private drawShade(c: CanvasRenderingContext2D, m: Monster, time: number, flash: boolean): number {
    const big = m.def.trait === 'warden' ? 2 : 1;
    const W = 10 * big, H = 26 * big;
    const frozen = !!m.frozen, hot = m.phase === 'windup' || m.phase === 'strike';
    const sway = frozen || this.reducedMotion ? 0 : Math.round(Math.sin(time * 5 + m.spawn) * 1);
    const body = flash ? '#e8d8ff' : frozen ? '#5a5466' : '#120a1e', edge = frozen ? '#8a8496' : '#3a2a5a';
    for (let y = 0; y < H; y++) {
      // A wisp: narrow head, broad middle, frayed hem.
      const u = y / H, half = Math.max(1, Math.round((u < .25 ? .3 + u * 2 : u < .8 ? .8 : .8 - (u - .8) * 2.5) * W / 2));
      const dx = frozen ? 0 : Math.round(Math.sin(time * 3 + y * .4 + m.spawn) * (u > .7 ? 1 : 0));
      c.fillStyle = edge; c.fillRect((-half - 1 + dx + (y < H * .3 ? sway : 0)) * ART, (y - H) * ART, (half * 2 + 2) * ART, ART);
      c.fillStyle = body; c.fillRect((-half + dx + (y < H * .3 ? sway : 0)) * ART, (y - H) * ART, half * 2 * ART, ART);
    }
    if (frozen) for (let n = 0; n < 3 * big; n++) { c.fillStyle = '#c8c0d8'; c.fillRect(((n * 3) % W - W / 2) * ART, (-H + 4 + n * 5) * ART, ART, ART * 2); }
    return H * ART;
  }
  /** Shades' eyes, over the darkness: you always see where they are. Brighter as they wind up to lunge. */
  private drawShadeEyes(c: CanvasRenderingContext2D, time: number, viewport: number): void {
    for (const m of this.monsters) {
      if (m.hp <= 0 || (m.def.trait !== 'shade' && m.def.trait !== 'warden') || m.x < this.camera - 60 || m.x > this.camera + viewport + 60) continue;
      const big = m.def.trait === 'warden' ? 2 : 1, floor = m.def.floorY ?? FLOOR;
      const looking = m.phase === 'idle' ? Math.sign(this.player.x - m.x) || m.facing : m.facing;
      const y = floor - (26 * big - 4 * big) * ART, x = m.x + looking * ART * big;
      const hot = m.phase === 'windup' || m.phase === 'strike';
      c.globalAlpha = m.frozen ? .35 : hot ? 1 : .8 + (this.reducedMotion ? 0 : .2 * Math.sin(time * 4 + m.spawn));
      c.fillStyle = hot ? '#fff4dc' : m.frozen ? '#8a8496' : '#c8b8ff';
      c.fillRect(x - 2 * ART * big, y, ART * big, ART * big); c.fillRect(x + ART * big, y, ART * big, ART * big);
    }
    c.globalAlpha = 1;
  }
  /** The ink tide standing over every pool in view (umbral.ts): over the figures, under the dark. */
  private drawTide(c: CanvasRenderingContext2D, t: Terrain, c0: number, c1: number, r0: number, r1: number): void {
    const rows = this.tide.rows;
    if (rows <= 0) return;
    const alpha = c.globalAlpha;
    for (let col = Math.max(t.colLo, c0); col <= Math.min(t.colHi - 1, c1); col++) {
      for (let row = Math.max(1, r0); row <= Math.min(t.rows - 1, r1); row++) {
        const i = t.index(col, row);
        if (!t.liqLevel[i] || t.liqType[i] !== LIQUID_INK) continue;
        const above = t.index(col, row - 1);
        if (t.liqLevel[above] && t.liqType[above] === LIQUID_INK) continue;
        const surface = t.top + (row + 1) * CELL - t.liqLevel[i] * (CELL / 8);
        let top = surface - rows * CELL;
        for (let k = 1; k <= Math.ceil(rows) + 1; k++) if (t.solid(col, row - k)) { top = Math.max(top, t.top + (row - k + 1) * CELL); break; }
        if (top >= surface) continue;
        c.globalAlpha = alpha * .9; c.fillStyle = '#120a22'; c.fillRect(col * CELL, top, CELL, surface - top);
        c.globalAlpha = alpha; c.fillStyle = '#6a4adf'; c.fillRect(col * CELL, top, CELL, ART);
      }
    }
    c.globalAlpha = alpha;
  }
  /** Under a mirrored ceiling: the Keeper's reflection walks on it, upside down, a step behind. */
  private drawReflection(c: CanvasRenderingContext2D, t: Terrain, k: number): void {
    const was = this.mirrorTrail[0];
    if (!was || !this.mirror) return;
    const shown = this.present(this.pose(), was.x, was.y);
    c.save();
    c.globalAlpha = .42;
    c.translate(was.x, this.mirror.y); c.scale(was.facing * k, -k);
    this.drawKeeper(c, { x: -78, y: -196, w: 156, h: 196 }, shown, this.reducedMotion ? 0 : this.elapsed, this.mirrorMotion, was.x, this.mirror.y * 2 - was.y, was.facing,
      0, 0, this.equipped, { landing: 0, recoil: 0, rim: 0 }, this.keeperMotion(shown, this.elapsed), true);
    c.restore();
    void t;
  }

  // ── The Root Deeps: dug rock grows back (verdant.ts, verdant-gen.ts) ──

  /** Holes in living wood waiting to fill, by world cell (verdant.ts cellKey). Session only. */
  private readonly regrowth = new Map<number, Regrowth>();
  /** Holes grown back this session (the HUD's hint, the e2e's evidence). */
  private regrown = 0;
  /** Heart-roots standing in the Graftmother's hall (-1: not counted yet). */
  private heartRoots = -1;
  private heartClock = 0;
  private graftCall = GRAFT_CALL;
  /**
   * A cell of the Root Deeps changed: if it was dug out of living wood, it waits
   * to grow back (unless the Rootsever Billhook cut it clean). True when the
   * change is the root's living part (a heart-root, a spore pod): never saved.
   */
  private rootDug(t: Terrain, index: number): boolean {
    if (t.kind[index] !== 0) return false;
    const as = regrowsAs(t.base[index]);
    if (as < 0) return false;
    const col = t.colOf(index), row = t.rowOf(index), alive = isAlive(t.base[index]);
    // A clean cut (the billhook) leaves wood dead; a living part always comes back.
    if (this.gear.shears && !alive) {
      this.tell('cut', 'play.rift.rule.cut', 'Glim: The billhook cuts the root clean. That one stays open.');
      return false;
    }
    this.regrowth.set(rootKey(col, row), { col, row, at: this.realmTime, kind: as });
    if (this.tell('regrow', 'play.rift.rule.regrow', 'Glim: Did you see the wood flinch? What you dig here grows back. Burn it with a torch, prop it with a support, or cut it clean, or it closes behind you.')) this.report();
    return alive;
  }
  /** True when the Keeper's body or a living creature stands in a cell (the roots wait for them to move). */
  private bodyInCell(t: Terrain, col: number, row: number): boolean {
    const p = this.player;
    if (col >= t.colAt(p.x - DELVE_BOX.halfWidth) && col <= t.colAt(p.x + DELVE_BOX.halfWidth - .01)
      && row >= t.rowAt(p.y - DELVE_BOX.height) && row <= t.rowAt(p.y - .01)) return true;
    const x = (col + .5) * CELL, y = t.top + (row + .5) * CELL;
    return this.monsters.some(m => m.hp > 0 && Math.abs(m.x - x) < CELL && y < (m.def.floorY ?? FLOOR) && y > (m.def.floorY ?? FLOOR) - 3 * CELL);
  }
  /** One fixed step of the Root Deeps' rule: holes grow back, spore pods burst, the Graftmother's roots hold her. */
  private updateVerdant(dt: number, t: Terrain): void {
    this.realmTime += dt;
    for (const [key, g] of this.regrowth) {
      if (!t.inside(g.col, g.row) || t.kind[t.index(g.col, g.row)] !== 0) { this.regrowth.delete(key); continue; }
      if (this.realmTime - g.at < REGROW_DELAY) continue;
      const why = heldOpen(t, g.col, g.row);
      if (why) {
        this.regrowth.delete(key);
        if (why === 'burnt') this.tell('burn', 'play.rift.rule.burn', 'Glim: The roots pulled back from the torch. Fire holds a tunnel open here.');
        else this.tell('held', 'play.rift.rule.held', 'Glim: The support held it. The roots went round.');
        continue;
      }
      // Never on top of anyone: it waits for them to step out.
      if (this.bodyInCell(t, g.col, g.row)) { g.at = this.realmTime - REGROW_DELAY + .5; continue; }
      const index = t.index(g.col, g.row);
      t.set(g.col, g.row, g.kind);
      this.recordCell(t, index);
      this.regrowth.delete(key);
      this.regrown++;
      this.debris.chip((g.col + .5) * CELL, t.top + (g.row + .5) * CELL, '#7fb85a', this.reducedMotion ? 2 : 6);
    }
    // Spore pods burst under the feet or against the head (struck from the side with a sickle, they give their sap).
    const p = this.player;
    const c0 = t.colAt(p.x - DELVE_BOX.halfWidth), c1 = t.colAt(p.x + DELVE_BOX.halfWidth - .01);
    for (const row of [t.rowAt(p.y + 1), t.rowAt(p.y - DELVE_BOX.height - 1)]) {
      for (let col = c0; col <= c1; col++) {
        if (!t.inside(col, row) || t.kind[t.index(col, row)] !== SPORE_KIND) continue;
        const index = t.index(col, row);
        t.set(col, row, 0);
        this.recordCell(t, index);
        this.debris.chip((col + .5) * CELL, t.top + (row + .5) * CELL, '#c8e86a', this.reducedMotion ? 3 : 14);
        if (this.hurtTime <= 0 && this.dodgeTime <= 0 && this.hp > 0) {
          this.hp = Math.max(0, this.hp - SPORE_STING); this.hurtTime = .8; this.wound = 1;
          this.impact(.05, 4);
          if (this.hp === 0) this.say('play.hud.eng.keeperFalls', 'The Keeper falls. Restart the hunt or return to camp.');
        }
        if (!this.tell('spore', 'play.rift.rule.spore', 'Glim: A spore pod. They burst if you tread on them. Strike one from the side with a sickle and it gives its sap instead.')) {
          this.say('play.rift.spore', 'A spore pod bursts.');
        }
        this.report();
      }
    }
    // A vine within reach: said once.
    const hand = { col: t.colAt(p.x), row: Math.max(0, t.rowAt(p.y - 1)) };
    if (this.climbing && t.inside(hand.col, hand.row) && t.kind[t.index(hand.col, hand.row)] === VINE_KIND) {
      this.tell('vine', 'play.rift.rule.vine', 'Glim: The vines are alive, and they hold. Climb them like a ladder: Up and Down.');
    }
    // The Graftmother: held while any heart-root in her hall stands (verdant.ts).
    const boss = this.monsters.find(m => m.def.trait === 'graft' && m.hp > 0);
    if (!boss) { this.heartRoots = -1; return; }
    if ((this.heartClock -= dt) <= 0 || this.heartRoots < 0) {
      this.heartClock = .25;
      let n = 0;
      const H = CORE_HALL;
      for (let row = H.row; row < H.row + H.h; row++) for (let col = H.col; col < H.col + H.w; col++) if (t.inside(col, row) && t.kind[t.index(col, row)] === HEART_ROOT_KIND) n++;
      if (this.heartRoots > 0 && n === 0) { this.say('play.rift.graft.unrooted', 'The last heart-root is cut. The Graftmother staggers: nothing holds her now.'); this.report(); }
      this.heartRoots = n;
    }
    const near = Math.abs(boss.x - p.x) < 14 * CELL && Math.abs((boss.def.floorY ?? FLOOR) - p.y) < 4 * CELL;
    if (near && this.tell('graft', 'play.rift.rule.graft', 'Glim: The Graftmother. Those red roots on the floor hold her: while one stands, she heals and shrugs off your blows. Cut them, and burn the stumps.')) this.report();
    if (this.heartRoots > 0) {
      boss.hp = Math.min(boss.maxHp, boss.hp + GRAFT_HEAL * dt);
      if (near && (this.graftCall -= dt) <= 0) {
        this.graftCall = GRAFT_CALL;
        const base = this.areaDef.monsters.find(def => def.creature === 'graftling');
        if (base) for (const dx of [-110, 110]) {
          const x = boss.x + dx, def: MonsterDef = { ...base, spawnXs: [x], floorY: boss.def.floorY, range: boss.def.range };
          this.monsters.push({ def, maxHp: def.hp, x, spawn: x, hp: def.hp, phase: 'idle', timer: 1.2, facing: -1, respawn: 0, flash: 0, knock: 0, dying: 0, born: SPAWN_RISE, shownHp: def.hp, recoil: 0, minion: true });
        }
        this.say('play.rift.graft.calls', 'The Graftmother grows two graftlings out of the wall.');
      }
    }
  }
  /** Roots reaching into holes about to fill (verdant.ts): drawn over the terrain, so it is never a surprise. */
  private drawRegrowth(c: CanvasRenderingContext2D, t: Terrain): void {
    if (!this.regrowth.size) return;
    const time = this.realmTime;
    for (const g of this.regrowth.values()) {
      if (!reaching(g, time) || !t.inside(g.col, g.row)) continue;
      const k = regrowProgress(g, time), x = g.col * CELL, y = t.top + g.row * CELL;
      const reach = Math.round(k * 8) * ART, node = TERRAIN_NODE_LIST[g.kind];
      c.fillStyle = node.base;
      // Tendrils from each side, growing in on the 2 px grid.
      for (let n = 0; n < 4; n++) {
        const along = (3 + n * 4) * ART;
        c.fillRect(x, y + along, reach, ART); c.fillRect(x + CELL - reach, y + along + ART * 2, reach, ART);
        c.fillRect(x + along, y, ART, reach); c.fillRect(x + along + ART, y + CELL - reach, ART, reach);
      }
      c.fillStyle = node.fleck;
      c.fillRect(x + reach - ART, y + 6 * ART, ART, ART); c.fillRect(x + CELL - reach, y + 10 * ART, ART, ART);
    }
  }

  // ── The Prism Mines: light is solid (luminous.ts, luminous-gen.ts) ──

  /** Seconds until the light is worked out again. */
  private lightClock = 0;
  /** The last light worked out: cell index → LIT_BRIDGE / LIT_SHAFT / LIT_PANE (reused). */
  private readonly litCells = new Map<number, number>();
  private beams = 0;
  private bridges = 0;
  private flareIn = PRISM_FLARE;
  /** Work the light out round the Keeper: beams from every sun-prism, shadow glass under placed light (and the Dawn Lens). */
  private relight(t: Terrain): void {
    const col = t.colAt(this.player.x), reach = 40;
    const near: LightWindow = { c0: col - reach, c1: col + reach, r0: 0, r1: t.rows - 1 };
    const wide: LightWindow = { c0: near.c0 - BEAM_MAX, c1: near.c1 + BEAM_MAX, r0: 0, r1: t.rows - 1 };
    const lit = this.litCells;
    lit.clear();
    this.beams = traceBeams(t, wide, lit);
    lightPanes(t, near, this.gear.lens ? { col, row: t.rowAt(this.player.y + 1) } : null, lit);
    const sim = this.liquid;
    applyLight(t, near, lit, sim ? (c, r) => sim.wakeAround(c, r) : undefined);
    let n = 0;
    for (const v of lit.values()) if (v !== LIT_PANE) n++;
    this.bridges = n;
  }
  /** E at a prism mirror: it turns, and the beam with it. Saved like a dig (it stays turned). */
  private turnMirror(t: Terrain, col: number, row: number): void {
    const index = t.index(col, row);
    t.set(col, row, turned(t.kind[index]));
    this.recordCell(t, index);
    this.debris.chip((col + .5) * CELL, t.top + (row + .5) * CELL, '#fff1b0', this.reducedMotion ? 2 : 8);
    this.lightClock = LIGHT_TICK;
    this.relight(t);
    if (!this.tell('mirror', 'play.rift.rule.mirror.turn', 'Glim: The mirror turned the beam. Look: where it crosses the dark, it is a floor now.')) {
      this.say('play.rift.mirror.turned', 'The mirror turns. The beam turns with it.');
    }
    this.report();
  }
  /** One fixed step of the Prism Mines' rule: the light, the bridges it lays, shadow glass, the Hollow Sun. */
  private updateLuminous(dt: number, t: Terrain): void {
    this.realmTime += dt;
    if ((this.lightClock -= dt) <= 0) { this.lightClock = LIGHT_TICK; this.relight(t); }
    const p = this.player, col = t.colAt(p.x), feet = t.rowAt(p.y + 1);
    const under = t.inside(col, feet) ? t.kind[t.index(col, feet)] : 0;
    if (p.grounded && (under === LUM.bridge || under === LUM.shaft)) this.tell('bridge', 'play.rift.rule.bridge', 'Glim: You are standing on the light. It holds as long as the beam does.');
    if (p.grounded && under === LUM.lit) this.tell('glass', 'play.rift.rule.glass', 'Glim: That black glass is a floor while the light is on it. In the dark it is a hole. Bring a torch.');
    if (!p.grounded && p.vy > 200 && t.inside(col, feet - 3) && t.kind[t.index(col, feet - 3)] === LUM.pane) {
      this.tell('fall', 'play.rift.rule.fall', 'Glim: Shadow glass. No light on it, so nothing under you. You will land; there is always a way back up.');
    }
    if (this.interactAt >= 0 && (t.kind[this.interactAt] === LUM.mirrorA || t.kind[this.interactAt] === LUM.mirrorB)) {
      this.tell('mirrors', 'play.rift.rule.mirrors', 'Glim: A prism mirror. Press E and it turns the beam a corner.');
    }
    // The Hollow Sun: caught while a beam crosses it; it flares free every PRISM_FLARE seconds.
    const boss = this.monsters.find(m => m.def.trait === 'prism' && m.hp > 0);
    if (!boss) return;
    const floor = boss.def.floorY ?? FLOOR;
    let caught = false;
    for (let r = t.rowAt(floor - 3 * CELL); r <= t.rowAt(floor - 1) && !caught; r++) {
      for (let c = t.colAt(boss.x - 24); c <= t.colAt(boss.x + 24) && !caught; c++) {
        if (!t.inside(c, r)) continue;
        const v = this.litCells.get(t.index(c, r));
        if (v !== undefined && v !== LIT_PANE) caught = true;
      }
    }
    if (caught !== !!boss.frozen) {
      boss.frozen = caught;
      if (caught) { this.debris.chip(boss.x, floor - 40, '#fff1b0', this.reducedMotion ? 2 : 10); this.say('play.rift.prism.caught', 'Caught in the beam: the Hollow Sun cannot move. Strike now.'); this.report(); }
    }
    const near = Math.abs(boss.x - p.x) < 16 * CELL && Math.abs(floor - p.y) < 4 * CELL;
    if (near && this.tell('prism', 'play.rift.rule.prism', 'Glim: The Hollow Sun. Blows pass through it while it is free. Turn the mirror by the shaft and catch it in the beam; then it cannot move.')) this.report();
    if (!near) return;
    if ((this.flareIn -= dt) > 0) return;
    this.flareIn = PRISM_FLARE;
    // The flare: every mirror in its hall turns the wrong way, and anyone close is burnt.
    const H = CORE_HALL;
    for (let row = H.row; row < H.row + H.h; row++) for (let c = H.col; c < H.col + H.w; c++) {
      if (!t.inside(c, row)) continue;
      const index = t.index(c, row), k = t.kind[index];
      if (k !== LUM.mirrorA && k !== LUM.mirrorB) continue;
      t.set(c, row, turned(k)); this.recordCell(t, index);
    }
    this.lightClock = 0;
    this.blastFlash = Math.max(this.blastFlash, .8);
    if (Math.abs(boss.x - p.x) < FLARE_CELLS * CELL && this.dodgeTime <= 0 && this.hurtTime <= 0) {
      this.hp = Math.max(0, this.hp - FLARE_HIT); this.hurtTime = .8; this.wound = 1;
      this.impact(.07, this.hp === 0 ? 12 : 8);
      if (this.hp === 0) this.say('play.hud.eng.keeperFalls', 'The Keeper falls. Restart the hunt or return to camp.');
    }
    this.say('play.rift.prism.flare', 'The Hollow Sun flares, and the mirrors turn away. Turn them back.');
    this.report();
  }

  // ── The Underhearth: the Banked Furnace, the Sentinels, the stratum's door (Phase 8) ──

  /** A spilled ember has been spent this step (the monster list sheds it once it has faded). */
  private spentMinions = false;
  /** The Underhearth's arrival line was checked this session. */
  private reachedSaid = false;
  /** Times the furnace's breath was announced this fight (the first two only: the vents' flare says it after). */
  private furnaceWarned = 0;

  /** The first step into the Underhearth: the flag (Kael's first step) and the line, once per player. */
  private reachedUnderhearth(t: Terrain): void {
    if (this.reachedSaid || !this.world || this.world.t !== t || this.areaDef.terrain?.realm) return;
    if (t.rowAt(this.player.y - DELVE_BOX.height * .5) < UNDERHEARTH_TOP) return;
    this.reachedSaid = true;
    if (this.flagged(UNDERHEARTH_REACHED_FLAG)) return;
    this.setFlag(UNDERHEARTH_REACHED_FLAG);
    this.say('play.uh.reached', 'Under the Halls. The heat here is heavy, not hot: fire pressed so long it became something else.');
    this.report();
  }
  /** The Banked Furnace wakes: its four vents (floor cells round its mouth) and the Four's trough, full. */
  private startFurnace(monster: Monster): void {
    const t = this.terrain;
    if (!t) return;
    const floorRow = t.rowAt((monster.def.floorY ?? FLOOR) - 1), mouth = t.colAt(monster.x);
    const vents: number[] = [];
    for (let col = mouth - 20; col <= mouth + 20; col++) if (t.inside(col, floorRow) && t.kind[t.index(col, floorRow)] === VENT_KIND) vents.push(t.index(col, floorRow));
    const trough: number[] = [];
    const T = FURNACE.trough;
    for (let row = T.row; row < T.row + T.h; row++) for (let col = T.col; col < T.col + T.w; col++) if (t.inside(col, row)) trough.push(t.index(col, row));
    this.furnace = { monster, state: newFurnace(), vents: vents.slice(0, 4), trough };
    this.furnaceWarned = 0;
    this.refillTrough();
  }
  /** The trough fills to the brim again (it is fed from above; it never holds more than it was made with). */
  private refillTrough(): void {
    const t = this.terrain, f = this.furnace;
    if (!t || !f) return;
    let changed = false;
    for (const i of f.trough) {
      if (t.solid(t.colOf(i), t.rowOf(i)) || (t.liqLevel[i] === LIQUID_FULL && t.liqType[i] === LIQUID_WATER)) continue;
      t.liqType[i] = LIQUID_WATER; t.liqLevel[i] = LIQUID_FULL; changed = true;
      this.liquid?.wakeAround(t.colOf(i), t.rowOf(i));
    }
    if (changed) t.liquidRev++;
  }
  /** The furnace's breath on the Keeper this step, px/s along x. */
  private furnacePull(): number {
    const f = this.furnace;
    if (!f || f.monster.hp <= 0) return 0;
    return pullAt(f.state, f.monster.x, f.monster.def.floorY ?? FLOOR, this.player.x, this.player.y);
  }
  /** One fixed step of the Banked Furnace's fight (furnace.ts decides; this moves the world). */
  private updateFurnace(dt: number, t: Terrain): void {
    const f = this.furnace;
    if (!f) return;
    const m = f.monster;
    if (!this.monsters.includes(m) || m.hp <= 0) {
      this.furnace = null;
      if (m.hp <= 0) this.say('play.uh.furnace.out', 'The Banked Furnace goes dark. The fire the Four banked is out.');
      return;
    }
    const floorY = m.def.floorY ?? FLOOR;
    // Water on a burning vent douses it (the water is spent in steam). Anything else poured there just sits.
    for (let n = 0; n < f.vents.length; n++) {
      const i = f.vents[n];
      if (!t.liqLevel[i]) continue;
      const water = t.liqType[i] === LIQUID_WATER;
      if (f.state.doused[n] || !water) continue;
      t.liqLevel[i] = 0; t.liqType[i] = 0; t.liquidRev++;
      this.liquid?.wakeAround(t.colOf(i), t.rowOf(i));
      douseVent(f.state, n);
      const left = f.state.doused.filter(d => !d).length;
      this.debris.chip((t.colOf(i) + .5) * CELL, t.top + t.rowOf(i) * CELL, '#d8e8f0', this.reducedMotion ? 3 : 12);
      if (left) this.say('play.uh.furnace.doused', `Steam! One vent out. ${left} still burn.`, { n: left });
    }
    const tick = stepFurnace(f.state, dt, m.hp / m.maxHp);
    if (tick.warn && this.furnaceWarned < 2) { this.furnaceWarned++; this.say('play.uh.furnace.breath', 'The vents flare: it is about to breathe in. Walk away from the mouth.'); }
    if (tick.spill) this.spillEmbers(m, tick.spill);
    if (tick.opened) { this.say('play.uh.furnace.open', 'All four vents out: its core shows. Strike it now!'); this.impact(.05, 6); }
    if (tick.rebanked) { this.refillTrough(); this.say('play.uh.furnace.rebanked', 'It banks itself again: the vents relight and the trough refills. Douse them again.'); }
    if (tick.enraged) this.say('play.uh.furnace.remembers', 'It remembers what it was banked for. It breathes harder now.');
    // The mouth burns while it breathes in.
    if (inMouth(f.state, m.x, floorY, this.player.x, this.player.y) && this.hurtTime <= 0) {
      this.hurtBy(FURNACE_TUNING.burnShare * dt);
      this.wound = Math.max(this.wound, .5);
    }
    // Loose drops slide toward the mouth too (they stop at its lip: nothing is eaten).
    if (furnaceBreathing(f.state)) {
      for (const drop of this.drops) {
        const pull = pullAt(f.state, m.x, floorY, drop.x, drop.y);
        if (pull && Math.abs(drop.x - m.x) > 48) drop.x += pull * dt;
      }
    }
  }
  /** The furnace spills Banked Embers from its mouth, awake, up to three at once. */
  private spillEmbers(furnace: Monster, count: number): void {
    const base = this.areaDef.monsters.find(m => m.creature === 'banked-ember' && !m.summoned);
    if (!base) return;
    const out = this.monsters.filter(m => m.minion && m.hp > 0).length;
    const n = Math.min(count, FURNACE_TUNING.embers - out);
    const floorY = furnace.def.floorY ?? FLOOR;
    const t = this.terrain;
    const hall = t ? [Math.max(t.left + 60, furnace.x - 15 * CELL), Math.min(t.right - 60, furnace.x + 13 * CELL)] as const : [furnace.x - 400, furnace.x + 400] as const;
    const def: MonsterDef = { ...base, spawnXs: [], floorY, range: hall, drops: { id: 'furnace-ember', entries: [] } };
    for (let k = 0; k < n; k++) {
      const x = furnace.x + (k % 2 === 0 ? -1 : 1) * (70 + 20 * k);
      this.monsters.push({ def, maxHp: Math.round(def.hp * .5), x, spawn: x, hp: Math.round(def.hp * .5), phase: 'idle', timer: 1.2, facing: -1, respawn: Infinity, flash: 0, knock: 0, dying: 0, born: SPAWN_RISE, shownHp: Math.round(def.hp * .5), recoil: 0, awake: true, minion: true });
    }
  }
  /**
   * An Ironwood Sentinel's strike shoulders the ceiling where it should be:
   * up to two loose, unsupported rocks over the Keeper come down (the same
   * rule as digging loose rock out). A support within reach holds them.
   */
  private shoulderCeiling(monster: Monster): void {
    const t = this.terrain;
    if (!t || Math.abs(this.player.x - monster.x) > 300 * this.figure) return;
    const pc = t.colAt(this.player.x), head = t.rowAt(this.player.y - DELVE_BOX.height);
    let dropped = 0;
    for (let row = head - 1; row >= head - 7 && dropped < 2; row--) {
      for (const col of [pc, pc - 1, pc + 1]) {
        if (dropped >= 2 || !t.inside(col, row) || t.solid(col, row + 1) || !isLoose(t, col, row) || supportNear(t, col, row)) continue;
        const node = t.nodeAt(col, row), index = t.index(col, row);
        t.set(col, row, 0);
        this.recordCell(t, index);
        this.dropRubble((col + .5) * CELL, t.top + (row + .5) * CELL, node.base);
        dropped++;
      }
    }
    this.impact(.04, 5);
    if (dropped) this.say('play.uh.sentinel.caveIn', 'The Sentinel shoulders the ceiling and loose rock comes down. A support nearby holds it.');
  }

  /** Fill in the map round the Keeper (once per cell moved), and tell the save. */
  private revealMap(t: Terrain): void {
    const fog = this.fog;
    if (!fog) return;
    const col = t.colAt(this.player.x), row = t.rowAt(this.player.y - DELVE_BOX.height * .5);
    const at = col * 64 + row;
    if (at === this.fogAt) return;
    this.fogAt = at;
    if (this.world && this.world.t === t) { if (this.world.reveal(col, row)) this.world.flushFog(); return; }
    if (!revealAround(t, fog, col, row)) return;
    const layout = this.layouts.get(this.areaDef.id);
    try { if (layout) this.delve?.explored?.(this.areaDef.id, layout, fog); } catch { /* explored for this session */ }
  }
  // ── Map v2 (bounties, the compass, the fragment, Glim's mark) ─────────────

  /** The Keeper's world cell in a delve, or null outside one. */
  keeperCell(): { col: number; row: number } | null {
    const t = this.terrain;
    return t ? { col: t.colAt(this.player.x), row: t.rowAt(this.player.y - DELVE_BOX.height * .5) } : null;
  }
  /** The generated structure the Keeper stands in (the endless Delve), or null. */
  structureHere(): PlacedStructure | null {
    const at = this.keeperCell();
    return at && this.world && this.world.t === this.terrain ? this.world.structureAt(at.col, at.row) : null;
  }
  /**
   * The Broken Astral Compass: the nearest thing the map has not been told
   * about, a structure no lantern has touched or a carving in the core not yet
   * copied (`isRead`), whichever is nearer. Null when there is none near.
   */
  compassTarget(isRead: (id: string) => boolean): { col: number; row: number } | null {
    const at = this.keeperCell();
    if (!at) return null;
    const world = this.world && this.world.t === this.terrain ? this.world : null;
    const s = world?.nearestUnseen(at.col, at.row) ?? null;
    const carving = findMark(world ? world.coreReader() : terrainReader(this.terrain!), [{ unread: true }], at, isRead);
    const sAt = s ? { col: s.col + (s.w >> 1), row: s.row + (s.h >> 1) } : null;
    if (!sAt) return carving;
    if (!carving) return sAt;
    const d = (p: { col: number; row: number }) => (p.col - at.col) ** 2 + (p.row - at.row) ** 2;
    return d(carving) <= d(sAt) ? carving : sAt;
  }
  /**
   * Read a Rift Map Fragment: the nearest structure no lantern has touched
   * shows on the map, room and surroundings, once `spend` (the host takes the
   * fragment) says yes. Returns it, or null when there is none within reach of
   * the reading or the spend was refused (nothing is drawn then).
   */
  readRiftMap(spend: (s: PlacedStructure) => boolean): PlacedStructure | null {
    const at = this.keeperCell();
    const world = this.world && this.world.t === this.terrain ? this.world : null;
    if (!at || !world) return null;
    const s = world.nearestUnseen(at.col, at.row);
    if (!s || !spend(s)) return null;
    world.revealArea(s.col - 4, s.col + s.w + 3, s.row - 3, s.row + s.h + 2);
    return s;
  }
  /**
   * The bond's notice (glim-bond.ts GLIM_RARE_KINDS): the nearest structure of
   * one of these kinds no lantern has touched, within `cells` columns, or null.
   */
  rareNear(kinds: readonly string[], cells: number): PlacedStructure | null {
    const at = this.keeperCell();
    const world = this.world && this.world.t === this.terrain ? this.world : null;
    if (!at || !world) return null;
    let best: PlacedStructure | null = null, bestD = Infinity;
    for (const s of world.structuresNear(at.col, 2)) {
      if (!kinds.includes(s.kind) || world.structureSeen(s)) continue;
      const d = Math.abs(s.col + s.w / 2 - at.col);
      if (d <= cells && d < bestD) { bestD = d; best = s; }
    }
    return best;
  }
  /** Glim's mark: the cell of the first target the core still holds, nearest the Keeper. */
  findMark(targets: readonly MarkTarget[], isRead: (id: string) => boolean): { col: number; row: number } | null {
    const at = this.keeperCell();
    if (!at) return null;
    const world = this.world && this.world.t === this.terrain ? this.world : null;
    return findMark(world ? world.coreReader() : terrainReader(this.terrain!), targets, at, isRead);
  }

  /** What the map draws: the delve, its explored cells, the Keeper's cell and the ways out. Null outside a delve. */
  mapSource(): MapSource | null {
    const t = this.terrain, fog = this.fog;
    if (!t || !fog) return null;
    return {
      t, fog,
      keeper: { col: t.colAt(this.player.x), row: t.rowAt(this.player.y - DELVE_BOX.height * .5) },
      shafts: this.stations.filter(station => station.kind === 'passage').map(station => t.colAt(station.x)),
      ...(this.world && this.world.t === t ? { world: this.world.map() } : {}),
    };
  }
  private report(): void {
    const nearest = this.nearestFoe();
    const station = this.nearbyStation();
    const t = this.terrain;
    const at = !station && t && this.interactAt >= 0 ? this.interactAt : -1;
    // A carved wall reads as 'inscription'; a placed chest or camp by its use.
    const use = at >= 0 ? (t!.inscriptions.has(at) ? (t!.inscriptions.get(at)!.startsWith(MARK_PREFIX) ? 'mark' : 'inscription')
      : RAIL_KINDS[t!.kind[at]] === 1 ? 'rail' : TERRAIN_NODE_LIST[t!.kind[at]].use ?? null) : null;
    const find = !station && !use ? this.findInReach() : null;
    const site = !station && !use && !find ? this.siteInReach() : null;
    const need = site ? this.siteNeed(site.def) : null;
    const depth = t ? Math.max(0, Math.floor((this.player.y - t.top) / CELL)) : undefined;
    this.options.onState({ hp: this.hp, enemyHp: nearest ? Math.max(1, Math.round(nearest.hp / nearest.maxHp * 100)) : 0, enemyName: nearest?.def.name, enemyId: nearest?.def.creature,
      ...(this.keyed && this.keyed.en === this.message ? { messageKey: this.keyed.key, ...(this.keyed.vars ? { messageVars: this.keyed.vars } : {}) } : {}),
      nearby: use ?? station?.id ?? (find ? 'height' : site ? 'gather' : null), nearbyLabel: use ? USE_LABEL[use] : station?.label ?? site?.def.label.toUpperCase(), nearbyKind: station?.kind,
      height: find ? { id: find.id, kind: find.kind, found: this.heightsFound.has(find.id) } : undefined,
      y: Math.round(this.player.y), climbing: this.heights ? this.mover.mode : undefined,
      gather: site ? { id: site.def.id, label: site.def.label, ready: site.ready, seconds: Math.ceil(site.timer), materialId: site.def.yield.materialId, ...(need ? { need } : {}) } : undefined,
      x: Math.round(this.player.x), paused: this.paused,
      boss: !!nearest?.def.once,
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
        near: this.liquidsNear(t), fishShadows: this.fishCount,
        riding: !!this.cart, grappling: this.grapple?.phase ?? null,
        ...(this.areaDef.terrain?.realm === 'umbral' ? { realm: {
          id: realmOfArea(this.areaDef.id) ?? '', tide: this.tide.phase, tideRows: Math.round(this.tide.rows * 10) / 10, nextTide: Math.ceil(this.tide.next),
          inkBlind: this.inkBlind, mirror: !!this.mirror, shift: this.shiftEpoch,
        } } : this.areaDef.terrain?.realm ? { realm: {
          id: realmOfArea(this.areaDef.id) ?? '',
          ...(this.areaDef.terrain.realm === 'verdant' ? { regrowing: this.regrowth.size, regrown: this.regrown, heartRoots: Math.max(0, this.heartRoots) }
            : { beams: this.beams, bridges: this.bridges }),
        } } : {}),
        ...(this.furnace ? { furnace: {
          phase: this.furnace.state.phase, doused: this.furnace.state.doused.filter(Boolean).length,
          open: Math.ceil(this.furnace.state.open), breathing: furnaceBreathing(this.furnace.state),
          vents: this.furnace.state.doused.map(d => (d ? '1' : '0')).join(''),
        } } : {}),
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
    gear = false, clock?: SpriteClock, fallen = false, painter: KeeperPainter | null = null,
  ): void {
    trackKeeper(motion, worldX, worldY, this.frameDt);
    if (painter) {
      // The pixel Keeper (keeper-paint.ts): its own frames, gear as layers, the weapon at its grip.
      const aura = gear ? this.loadout.auraRarity : null;
      if (aura) this.drawAura(c, aura, time);
      // The player's own Keeper (gear) shows the landing squash and a flash of feeling; peers stay plain.
      const face = gear && this.feelFace && this.elapsed < this.feelUntil ? this.feelFace : undefined;
      painter.draw(c, box.h / 49, {
        action: keeperAction(shown, fallen), time, attackT, rim: feel.rim, reduced: this.reducedMotion, weapon: gear,
        squash: feel.landing, ...(face ? { face } : {}),
      });
      return;
    }
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
  /**
   * A pixel icon (item-icons.ts) centred on (cx, cy), `size` world px square, unsmoothed:
   * 64 is the figures' 4 px grid in towns, 32 the Delve's 2 px. One cached image, one blit.
   */
  private pixelIcon(c: CanvasRenderingContext2D, src: string | undefined, cx: number, cy: number, size: number): boolean {
    const image = this.urlImage(src);
    if (!image?.complete || !image.naturalWidth) return false;
    const smoothing = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    c.drawImage(image, Math.round(cx - size / 2), Math.round(cy - size / 2), size, size);
    c.imageSmoothingEnabled = smoothing;
    return true;
  }
  /** A station's plaque or crown: its pixel icon when it has one, else the painted art in a `box`-px square. */
  private plaque(c: CanvasRenderingContext2D, key: string | undefined, cx: number, cy: number, size: number, box: number): boolean {
    const icon = plaqueIcon(key);
    return icon ? this.pixelIcon(c, icon.src, cx, cy, size) : this.art(key, cx - box / 2, cy + box / 2 - box, box, box);
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
        if (station.id === 'beacon' && this.props) {
          // The lamp's halo is the engine's light, not the sprite's.
          c.save(); c.shadowColor = this.restored ? '#b8e6ec' : '#f29b68'; c.shadowBlur = this.blur(24);
          this.props.beacon(c, x, FLOOR, this.restored);
          c.restore();
        } else if (station.id === 'beacon') {
          c.fillStyle = '#423f51'; c.fillRect(x - 20, FLOOR - 160, 40, 160);
          c.shadowColor = this.restored ? '#b8e6ec' : '#f29b68'; c.shadowBlur = this.blur(35);
          c.fillStyle = this.restored ? '#d5fffa' : '#b96d55'; c.beginPath(); c.arc(x, FLOOR - 173, 20, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
        } else {
          if (this.props) this.props.pedestal(c, x, FLOOR);
          else { c.fillStyle = '#493543'; c.fillRect(x - 46, FLOOR - 60, 92, 60); c.fillStyle = '#ffaf62'; c.fillRect(x - 34, FLOOR - 52, 68, 8); }
          if (!this.art(station.art, x - 35, FLOOR - 160, 70, 95)) this.art('blade', x - 35, FLOOR - 160, 70, 95);
        }
        break;
      case 'passage':
        if (this.props) { this.props.arch(c, x, FLOOR, this.restored); break; }
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
    if (this.props) {
      if (def.kind === 'wood') this.props.tree(c, x, FLOOR, ready);
      else if (def.kind === 'ore') this.props.outcrop(c, x, FLOOR, ready, glow);
      else this.props.herbs(c, x, FLOOR, ready, glow);
    } else if (def.kind === 'wood') {
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
      const pin = itemIcon(def.yield.materialId);
      const shown = pin ? this.pixelIcon(c, pin.src, x, iconY + 15, 32) : this.art(def.yield.materialId, x - 15, iconY, 30, 30);
      if (!shown) { c.fillStyle = glow; c.beginPath(); c.arc(x, iconY + 15, 8, 0, Math.PI * 2); c.fill(); }
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
    if (this.props) {
      this.props.stall(c, x, FLOOR, half * 2, hot);
      if (!this.plaque(c, station.art, x, FLOOR - 108, 64, 54)) { c.fillStyle = '#c2a26a'; c.fillRect(x - 8, FLOOR - 116, 16, 16); }
      if (hot) { c.strokeStyle = '#ffe0a8'; c.lineWidth = 4; c.strokeRect(x - half - 6, FLOOR - 198, half * 2 + 12, 198); }
      c.restore();
      return;
    }
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
    if (!this.plaque(c, station.art, x, FLOOR - 108, 64, 54)) { c.fillStyle = '#c2a26a'; c.fillRect(x - 8, FLOOR - 116, 16, 16); }
    if (hot) { c.strokeStyle = '#ffe0a8'; c.lineWidth = 2; c.strokeRect(x - half - 6, FLOOR - 192, half * 2 + 12, 192); }
    c.restore();
  }
  /** A standing stone with a rift burning at its crown. The glow breathes unless motion is reduced. */
  private drawWaystone(c: CanvasRenderingContext2D, station: StationDef, hot: boolean, time: number): void {
    const x = station.x;
    c.save();
    if (this.props) this.props.waystone(c, x, FLOOR, hot);
    else {
    c.fillStyle = '#3d3446';
    c.beginPath(); c.moveTo(x - 26, FLOOR); c.lineTo(x - 14, FLOOR - 170); c.lineTo(x, FLOOR - 186); c.lineTo(x + 14, FLOOR - 170); c.lineTo(x + 26, FLOOR); c.closePath(); c.fill();
    c.strokeStyle = hot ? '#ffe0a8' : '#7d6a86'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = '#c9a0ff'; c.globalAlpha = .55; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x - 6, FLOOR - 40); c.lineTo(x + 6, FLOOR - 70); c.lineTo(x - 6, FLOOR - 100); c.lineTo(x + 6, FLOOR - 130); c.stroke();
    c.globalAlpha = 1;
    }
    const pulse = this.reducedMotion ? .5 : .5 + Math.sin(time * 2) * .5;
    c.shadowColor = '#c9a0ff'; c.shadowBlur = this.blur(18 + pulse * 18 + (hot ? 12 : 0));
    if (!this.plaque(c, station.art, x, FLOOR - 218, 64, 68)) { c.fillStyle = '#c9a0ff'; c.beginPath(); c.arc(x, FLOOR - 214, 16, 0, Math.PI * 2); c.fill(); }
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
  /**
   * Phones only (render-budget.ts `cacheBackdrop`): the Delve's sky while its surface is in view — the floor
   * colour, the painting at 50% and the dusk shade, as the live path draws them, but from two baked canvases:
   * the painting pre-scaled to device pixels (laid at the parallax offset snapped to a whole device pixel, so
   * the blit is a copy, not a resample) and the shade, which is screen-fixed, baked at the frame's size (a
   * copy instead of a gradient shaded per pixel). Rebuilt when the painting, view or pixel scale changes.
   * The two were ~4 ms of an unthrottled software-raster phone frame on the wide traverse.
   */
  private delveSky: { paint: HTMLCanvasElement; shade: HTMLCanvasElement; image: HTMLImageElement; width: number; view: number; scale: number } | null = null;
  private delveSkyFailed = false;
  private drawDelveSky(c: CanvasRenderingContext2D, bg: HTMLImageElement, viewport: number): boolean {
    if (this.delveSkyFailed) return false;
    const bgWidth = Math.max(viewport + 500, 720 * bg.naturalWidth / bg.naturalHeight);
    const ps = this.pixelScale;
    let sky = this.delveSky;
    if (!sky || sky.image !== bg || sky.width !== bgWidth || sky.view !== viewport || sky.scale !== ps) {
      const make = () => typeof document !== 'undefined' && typeof document.createElement === 'function' ? document.createElement('canvas') : null;
      const paint = sky?.paint ?? make(), shade = sky?.shade ?? make();
      const p = paint?.getContext('2d'), s = shade?.getContext('2d');
      if (!paint || !shade || !p || !s) { this.delveSkyFailed = true; return false; }
      paint.width = Math.ceil(bgWidth * ps); paint.height = Math.ceil(720 * ps);
      p.setTransform(ps, 0, 0, ps, 0, 0); p.clearRect(0, 0, bgWidth, 720);
      p.globalAlpha = .5; p.drawImage(bg, 0, 0, bgWidth, 720); p.globalAlpha = 1;
      shade.width = Math.ceil(viewport * ps); shade.height = Math.ceil(720 * ps);
      s.setTransform(ps, 0, 0, ps, 0, 0); s.clearRect(0, 0, viewport, 720);
      s.fillStyle = this.sceneShade(s); s.fillRect(0, 0, viewport, 720);
      sky = this.delveSky = { paint, shade, image: bg, width: bgWidth, view: viewport, scale: ps };
    }
    const snap = (v: number) => Math.round(v * ps) / ps;
    const w = sky.paint.width / ps, h = sky.paint.height / ps;
    c.fillStyle = '#11101a'; c.fillRect(0, 0, viewport, 720);
    const oy = snap(-this.cameraY * .6);
    if (this.world) {
      // Endless: the painting repeats, so a sky far east or west of the shaft is never bare.
      // The two copies abut on a whole device pixel: each lays exactly round(bgWidth · ps) columns.
      const ox = snap(-((((this.camera * .16) % bgWidth) + bgWidth) % bgWidth)), sw = Math.min(sky.paint.width, Math.round(bgWidth * ps));
      c.drawImage(sky.paint, 0, 0, sw, sky.paint.height, ox, oy, sw / ps, h);
      c.drawImage(sky.paint, 0, 0, sw, sky.paint.height, ox + sw / ps, oy, sw / ps, h);
    } else c.drawImage(sky.paint, snap(-this.camera * .16), oy, w, h);
    c.drawImage(sky.shade, 0, 0, sky.shade.width / ps, sky.shade.height / ps);
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
    const t = this.terrain;
    // The endless Delve has no west wall at 0: the camera stays inside the loaded ring (always wider than the view).
    this.camera = this.world ? Math.max(this.world.left, Math.min(this.world.right - viewport, this.player.x - viewport * .38))
      : Math.max(0, Math.min(this.areaDef.width - viewport, this.player.x - viewport * .38));
    if (t) {
      // Delves follow the Keeper down; the surface sits low in the frame at the top.
      const target = Math.max(0, Math.min(t.bottom + 40 - 720, this.player.y - 720 * .58));
      this.cameraY += (target - this.cameraY) * (this.reducedMotion ? 1 : 1 - Math.exp(-7 * this.frameDt));
    } else if (this.heights) {
      // A surface with height: follow the Keeper up, with a look-ahead the way they are heading.
      const look = this.mover.climbing && this.input.has('jump') ? -120 : this.player.vy < -200 ? -80 : this.player.vy > 420 ? 80 : 0;
      this.lookY += (look - this.lookY) * (this.reducedMotion ? 1 : 1 - Math.exp(-3 * this.frameDt));
      const target = Math.max(this.heights.top, Math.min(0, this.player.y - 720 * .62 + this.lookY));
      this.cameraY += (target - this.cameraY) * (this.reducedMotion ? 1 : 1 - Math.exp(-6 * this.frameDt));
      if (Math.abs(this.cameraY) < .05) this.cameraY = 0;
    } else this.cameraY = 0;
    c.clearRect(0, 0, this.width, this.height); c.save(); c.scale(scale, scale);
    // Looking up a surface with height, the backdrop sinks at 0.6 of the camera (as a delve's does) and sky fills above it.
    const lift = !t && this.cameraY < 0 ? -this.cameraY * .6 : 0;
    if (lift) { c.save(); c.translate(0, lift); }
    // Imported parallax layers replace everything once every one of them has loaded (RND-2);
    // until then a town or hunt stands on its procedural pixel set (pixel-parallax.ts), and
    // the painting is only fetched where neither can draw (the Delve's surface, no DOM).
    const layered = !t && this.parallax.draw(c, this.town.realm, this.camera, viewport, FLOOR, this.pixelScale > 1.25);
    const pixelBack = !t && !layered && this.pixelBackdrop.draw(c, this.town.realm, this.isTown ? 'town' : 'hunt', this.camera, viewport, FLOOR);
    const bg = layered || pixelBack ? undefined : this.sceneImage();
    const cached = !t && !layered && !pixelBack && !!bg?.complete && !!bg.naturalWidth && this.budget.cacheBackdrop && this.drawCachedBackdrop(c, bg, viewport);
    if (lift) c.restore();
    // Below a delve's surface the distant cave fills the frame (it shows through the caverns);
    // the town painting and its shade are drawn only while the surface is in view.
    const underground = !!t && t.top - this.cameraY <= 0;
    const baked = !cached && !underground && !!t && !!bg?.complete && !!bg.naturalWidth && this.budget.cacheBackdrop && this.drawDelveSky(c, bg, viewport);
    if (!cached && !underground && !layered && !pixelBack && !baked) {
      c.fillStyle = '#11101a'; c.fillRect(0, 0, viewport, 720);
      if (bg?.complete && bg.naturalWidth) {
        const bgWidth = Math.max(viewport + 500, 720 * bg.naturalWidth / bg.naturalHeight);
        c.globalAlpha = t ? .5 : .94;
        if (this.world) {
          // Endless: the painting repeats, so a sky far east or west of the shaft is never bare.
          const ox = -((((this.camera * .16) % bgWidth) + bgWidth) % bgWidth);
          c.drawImage(bg, ox, -this.cameraY * .6, bgWidth, 720); c.drawImage(bg, ox + bgWidth, -this.cameraY * .6, bgWidth, 720);
        } else c.drawImage(bg, -this.camera * .16, -this.cameraY * .6, bgWidth, 720);
        c.globalAlpha = 1;
      }
      c.fillStyle = this.sceneShade(c); c.fillRect(0, 0, viewport, 720);
    }
    if (lift) this.surface.sky(c, viewport, lift);
    if (t) this.caveBackdrop.draw(c, t, this.camera, this.cameraY, viewport, 720, this.budget.maskBackdrop ? this.pixelScale : 0);
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
    if (this.heights) this.surface.draw(c, this.camera, this.cameraY, viewport, this.heightsFound, motionTime);
    if (this.isTown && this.areaDef.scenery === 'seamworks-hub') this.atmosphere.hub(c, motionTime, this.areaDef.safeX || 1120);
    if (t) this.terrainRenderer.draw(c, this.camera, this.cameraY, viewport, 720, this.pixelScale);
    if (t) this.drawRails(c, t, viewport, motionTime);
    if (t) this.drawFurnaceFacade(c, t, viewport, motionTime);
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
    if (this.folk.length) this.drawFolk(c, viewport, motionTime);
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
      if (drop.coins && this.props) {
        this.props.coin(c, drop.x, y, this.reducedMotion ? 0 : Math.floor(motionTime * 8 + drop.x));
      } else if (drop.coins) {
        c.fillStyle = '#ffd36d'; c.beginPath(); c.ellipse(drop.x, y, 3 + Math.abs(Math.cos(motionTime * 3)) * 7, 13, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#9e602c'; c.font = 'bold 14px system-ui'; c.textAlign = 'center'; c.fillText('$', drop.x, y + 5);
      } else if (!this.art(drop.art, drop.x - 15, y - 15, 30, 30) && !this.art('ore', drop.x - 15, y - 15, 30, 30)) { c.fillStyle = '#ed9069'; c.fillRect(drop.x - 8, y - 8, 16, 16); }
      c.shadowBlur = 0; c.restore();
      if (t >= 1) this.drawDropCaption(c, drop, y);
    }
    for (const monster of this.monsters) {
      if (monster.hp <= 0 && monster.dying <= 0) continue;
      if (monster.x < this.camera - 220 || monster.x > this.camera + viewport + 220) continue;
      // A delve stacks halls: a creature on a floor above or below the view is not drawn (nor its rig deformed).
      // Its body stands on the floor; 720 world px above it covers the tallest figure, the Banked Furnace.
      if (t) { const floor = monster.def.floorY ?? FLOOR; if (floor < this.cameraY - 60 || floor - 720 > this.cameraY + 720) continue; }
      // The Underhearth's creatures are pixel figures of their own (no painting yet).
      if (monster.def.trait && monster.def.trait !== 'graft' && monster.def.trait !== 'prism') { this.drawDeepCreature(c, monster, motionTime); continue; }
      if (monster.hp <= 0) { this.dissolve(c, monster); continue; }
      const warning = monster.phase === 'windup' || monster.phase === 'strike';
      const rigDef = this.creatureRig(monster.def.creature).def;
      // A sprite sheet faces right and stands on its pivot; so do the pixel creatures; a painting has its own box and facing.
      const sheet = this.readySprite(monster.def.creature);
      const pixel = sheet ? null : this.pixelCreature(monster.def.creature);
      const floor = monster.def.floorY ?? FLOOR;
      const crown = floor - ((sheet ? sheet.entry.pivotY : pixel ? pixel.height * CREATURE_PIXEL : rigDef.box.h) + 20) * k;
      if (warning) {
        c.fillStyle = monster.phase === 'strike' ? '#ff765caa' : '#ff765c40';
        c.fillRect(monster.facing < 0 ? monster.x - 170 * k : monster.x, floor - 10, 170 * k, 10);
        c.fillStyle = '#ffc589'; c.font = 'bold 18px system-ui'; c.textAlign = 'center'; c.fillText('!', monster.x, crown - 20);
      }
      const rise = monster.born > 0 ? 1 - monster.born / SPAWN_RISE : 1;
      if (!t) this.groundShadow(c, monster.x + monster.knock, FLOOR, rigDef.shadow * (.6 + rise * .4));
      // Turn the painting toward its target. Purely a drawing choice.
      const looking = monster.phase === 'idle' ? Math.sign(this.player.x - monster.x) || monster.facing : monster.facing;
      const mirror = sheet || pixel ? looking < 0 : rigDef.facesLeft ? looking > 0 : looking < 0;
      c.save(); c.translate(pixel ? Math.round(monster.x + monster.knock) : monster.x + monster.knock, floor);
      c.globalAlpha = rise; c.scale((.6 + rise * .4) * (mirror ? -1 : 1) * k, (.6 + rise * .4) * k);
      if (pixel) {
        const last = this.creatureLastX.get(monster) ?? monster.x;
        this.creatureLastX.set(monster, monster.x);
        const frame = creatureFrame(monster.phase, monster.recoil, Math.abs(monster.x - last) > .05, this.elapsed + monster.spawn * .013, this.reducedMotion);
        pixel.draw(c, CREATURE_PIXEL, frame, monster.flash > 0);
        if (monster.phase === 'strike' && monster.flash <= 0) {
          c.globalCompositeOperation = 'lighter'; c.globalAlpha *= .3; c.translate(-CREATURE_PIXEL, 0);
          pixel.draw(c, CREATURE_PIXEL, frame, false);
        }
      } else this.creature(c, monster.flash > 0, monster.def.creature, monster);
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
      const peerTop = -((this.peerPainter(view.peer.id)?.top ?? FIGURE_TOP + 6) * KEEPER_ART_PX + 12);
      c.fillStyle = '#1a120fe6'; c.fillRect(-labelWidth / 2, peerTop - 24, labelWidth, 24);
      c.fillStyle = '#ffe1b0'; c.fillText(view.peer.name, 0, peerTop - 6, 220);
      this.speechBubble(c, view.peer.id, peerTop - 30);
      const shown = this.present(view.peer.animation, view.peer.x, view.y);
      const motion = this.keeperMotion(shown, motionTime + view.x);
      const warm = shown === 'rest';
      const attackT = shown === 'attack' ? (motionTime * 3.2) % 1 : 0;
      const swing = attackT === 0 ? 0 : attackT < .3 ? -attackT / .3 : Math.sin((attackT - .3) / .7 * Math.PI);
      c.scale(view.facing, 1); this.stepDust(c, shown, motionTime + view.x);
      c.globalAlpha = motion.alpha;
      c.shadowColor = warm ? '#ffc27a' : '#deb8f3'; c.shadowBlur = this.blur(warm ? 12 : 6); c.filter = 'none';
      // Same box as the player's: every pixel Keeper on one grid (4 world px per art px).
      this.drawKeeper(c, { x: -78, y: -196, w: 156, h: 196 }, shown, motionTime + view.x, view.motion, view.x, view.y, view.facing,
        attackT, swing, false, { landing: 0, recoil: shown === 'hurt' ? .6 : 0, rim: 0 }, motion, false, view.clock, false, this.peerPainter(view.peer.id));
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
    // The plate rides just over the head: the chibi Keeper's own top (hair, hat, helm crest), else the painting's.
    const tip = -(this.keeperPainter ? this.keeperPainter.top * KEEPER_ART_PX + 8 : 174);
    c.fillStyle = '#1a120fe6'; c.textAlign = 'center';
    c.fillRect(-youWidth / 2, tip - 30, youWidth, 22);
    c.beginPath(); c.moveTo(-6, tip - 8); c.lineTo(6, tip - 8); c.lineTo(0, tip); c.closePath(); c.fill();
    c.fillStyle = '#ffe1b0';
    c.fillText('You', 0, tip - 14);
    this.speechBubble(c, this.selfId, tip - 60);
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
      }, motion, true, this.playerClock, this.hp <= 0, this.keeperPainter);
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
    if (t && this.mirror) this.drawReflection(c, t, k);
    if (t && this.cart) this.drawCart(c, motionTime);
    if (t && this.grapple) this.drawGrappleLine(c);
    if (t) {
      // Liquids over the figures (a wading Keeper reads as in the water), under the darkness.
      const c0 = t.colAt(this.camera) - 1, c1 = t.colAt(this.camera + viewport) + 1;
      const r0 = t.rowAt(this.cameraY) - 1, r1 = t.rowAt(this.cameraY + 720) + 1;
      drawLiquids(c, t, c0, c1, r0, r1, this.reducedMotion ? 0 : Math.floor(this.elapsed * 2.5) & 1);
      this.drawFish(c, t, c0, c1, r0, r1, this.elapsed);
      if (this.areaDef.terrain?.realm === 'umbral') this.drawTide(c, t, c0, c1, r0, r1);
      else if (this.areaDef.terrain?.realm === 'verdant') this.drawRegrowth(c, t);
      this.drawLine(c, motionTime);
      this.drawCatchFx(c, this.flightDelta);
    }
    if (t) this.drawDelveLight(c, t, scale, viewport, motionTime);
    if (t && this.areaDef.terrain?.realm === 'umbral') this.drawShadeEyes(c, motionTime, viewport);
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
  /** Per-frame inputs of drawHeat, refilled each frame (no closure per frame). */
  private readonly heatFrame = { t: null as Terrain | null, biome: null as BiomeDef | null, time: 0, viewport: 0, count: 0, scale: 1, folded: false };
  /** DarknessLayer's `over` hook: the heat drawn into the phone overlay, in its pixels (`k` overlay px per CSS px). */
  private readonly heatInOverlay = (o: CanvasRenderingContext2D, k: number): void => {
    const f = this.heatFrame, s = f.scale * k;
    o.setTransform(s, 0, 0, s, -this.camera * s, -this.cameraY * s);
    this.drawHeat(o);
    f.folded = true;
  };
  /**
   * Coloured light from exposed glowing cells (glowcaps wash the Grotto blue, embers the Halls red) and the
   * heat columns, in world coordinates on `c` (the frame, or the phone's darkness overlay).
   */
  private drawHeat(c: CanvasRenderingContext2D): void {
    const f = this.heatFrame, t = f.t!, biome = f.biome!, time = f.time, viewport = f.viewport;
    for (let n = 0; n < f.count; n++) {
      const index = this.halosAt[n], col = t.colOf(index), row = t.rowOf(index);
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
    pool.add(this.player.x, this.player.y - 50, this.lanternRadius * flicker * (this.veiledUp() ? .55 : 1) * this.lanternShare(t), 1);
    if (this.cameraY < t.top) for (let x = 0; x < viewport + 400; x += 360) pool.add(this.camera - 200 + x, t.top - 160, 460, .85);
    if (this.blastFlash > 0) {
      const at = this.blastAt;
      pool.add(at.x + at.dx * at.range * .6, at.y + at.dy * at.range * .6, at.range * 1.5 * this.blastFlash, this.blastFlash);
    }
    // The Banked Furnace's mouth: dull while banked, white-hot when its core is open.
    if (this.furnace) {
      const m = this.furnace.monster, open = furnaceOpen(this.furnace.state);
      pool.add(m.x, (m.def.floorY ?? FLOOR) - 70, open ? 420 : 240, open ? 1 : .7);
    }
    // A struck Banked Ember gives off the heat it took.
    for (const m of this.monsters) {
      if (m.def.trait === 'dormant' && m.awake && m.hp > 0 && Math.abs(m.x - this.player.x) < 900) pool.add(m.x, (m.def.floorY ?? FLOOR) - 14, 90, .55);
    }
    // A lit fuse throws a flickering light of its own.
    for (const fuse of this.fuses) {
      const col = t.colOf(fuse.index), row = t.rowOf(fuse.index);
      pool.add((col + .5) * CELL, t.top + row * CELL + 6, 70 + (this.reducedMotion ? 0 : Math.sin(time * 31) * 10), .75);
    }
    const c0 = Math.max(t.colLo, t.colAt(this.camera)), c1 = Math.min(t.colHi - 1, t.colAt(this.camera + viewport));
    const r0 = Math.max(0, t.rowAt(this.cameraY)), r1 = Math.min(t.rows - 1, t.rowAt(this.cameraY + 720));
    const reach = this.lanternRadius * 1.6;
    let haloCount = 0;
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const node = TERRAIN_NODE_LIST[t.kind[t.index(col, row)]];
        if (!node.glow) continue;
        // Cold coal is dark until struck; a doused furnace vent is out.
        if (node.struckGlow && t.hp[t.index(col, row)] >= node.hp) continue;
        if (this.furnace && t.kind[t.index(col, row)] === VENT_KIND && this.ventDoused(t.index(col, row))) continue;
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
    // Ink-blind (BiomeDef.gloom): the unlit dark is deeper than any stratum's.
    const ambient = biome.gloom ? Math.max(.92, ambientDarkness(this.cameraY + 360 - t.top)) : ambientDarkness(this.cameraY + 360 - t.top);
    // Phone: the coloured halos and heat columns are plain source-over, so they ride inside the darkness
    // overlay after its dark (source-over is associative: the same pixels at the overlay's resolution, on a
    // ninth of the pixels). Desktop keeps them additive on the frame.
    const heat = this.heatFrame;
    heat.t = t; heat.biome = biome; heat.time = time; heat.viewport = viewport; heat.count = haloCount;
    heat.scale = scale; heat.folded = false;
    const dark = this.darkness.draw(c, this.width, this.height, scale, this.camera, this.cameraY, pool.lights, count, ambient, biome.dark, fold, this.budget.smoothDarkness, this.rockShade.update(t), WARM_LIGHT, this.lavaPool.lights, this.lavaPool.count,
      this.budget.blendModes ? undefined : this.heatInOverlay);
    c.restore();
    if (fold && !dark) {
      // No overlay canvas: the tint on its own, as before.
      c.save(); c.globalAlpha = fold.alpha;
      c.fillStyle = fold.color; c.fillRect(this.camera, this.cameraY, viewport, 720);
      c.restore();
    }
    // Restored at the end: the motes and glints below draw under the same composite as the heat.
    c.save(); c.globalCompositeOperation = this.budget.blendModes ? 'lighter' : 'source-over';
    if (!heat.folded) this.drawHeat(c);
    this.motes.update(this.frameDt, biome, this.camera, this.cameraY, viewport, 720, this.reducedMotion);
    this.motes.draw(c);
    for (let n = 0; n < this.glintCount; n++) {
      const index = this.glints[n], col = t.colOf(index), row = t.rowOf(index);
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
      const col = t.colOf(fuse.index), row = t.rowOf(fuse.index);
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
  // ── The Underhearth's pixel art (Phase 8): rails, the cart, the grapple, its creatures, the furnace ──

  /** Whether a furnace vent cell is doused this banking. */
  private ventDoused(index: number): boolean {
    const f = this.furnace;
    if (!f) return false;
    const n = f.vents.indexOf(index);
    return n >= 0 && f.state.doused[n];
  }
  /** One art pixel run (world px, snapped to the 2 px grid). */
  private px(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
    c.fillStyle = color; c.fillRect(Math.round(x / ART) * ART, Math.round(y / ART) * ART, w * ART, h * ART);
  }
  /**
   * Rails in view: a sleeper under every rail cell, the rail itself joined to
   * its east neighbour (level or one row up or down, stepped on the art grid),
   * and timber trestles under rail that runs over open air.
   */
  private drawRails(c: CanvasRenderingContext2D, t: Terrain, viewport: number, time: number): void {
    const c0 = Math.max(t.colLo, t.colAt(this.camera) - 1), c1 = Math.min(t.colHi - 1, t.colAt(this.camera + viewport) + 1);
    const r0 = Math.max(0, t.rowAt(this.cameraY) - 1), r1 = Math.min(t.rows - 1, t.rowAt(this.cameraY + 720) + 1);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const i = t.index(col, row);
        if (RAIL_KINDS[t.kind[i]] !== 1) continue;
        const node = TERRAIN_NODE_LIST[t.kind[i]];
        const x = col * CELL, floor = t.top + (row + 1) * CELL;
        // Trestle: over open air, posts down to the next rock (every other column), braced.
        if (!t.solid(col, row + 1) && !isRail(t, col, row + 1)) {
          let depth = 1;
          while (depth < 24 && !t.solid(col, row + depth) && row + depth < t.rows) depth++;
          if ((col & 1) === 0) {
            this.px(c, x + 6, floor, 2, (depth - 1) * TILE, '#2a1c12');
            this.px(c, x + 8, floor, 1, (depth - 1) * TILE, '#6a5040');
          }
          this.px(c, x, floor + 4, TILE, 1, '#3a2a18');
        }
        // Sleeper.
        this.px(c, x + 4, floor - 4, TILE - 4, 2, node.dark);
        this.px(c, x + 4, floor - 4, TILE - 4, 1, node.base);
        // The rail to the east neighbour (or a stub when the line ends here).
        const next = nextRail(t, col, row, 1);
        const y0 = floor - 6, y1 = next ? t.top + (next.row + 1) * CELL - 6 : y0;
        const span = next ? TILE : TILE / 2;
        for (let s = 0; s <= span; s++) {
          const y = y0 + (y1 - y0) * s / TILE;
          // A two-pixel iron rail with a bright running edge: it reads against any rock.
          this.px(c, x + CELL / 2 + s * ART, y - ART, 1, 1, '#d8c8bc');
          this.px(c, x + CELL / 2 + s * ART, y, 1, 1, node.light);
          this.px(c, x + CELL / 2 + s * ART, y + ART, 1, 1, node.dark);
        }
        if (!nextRail(t, col, row, -1)) for (let s = 0; s <= TILE / 2; s++) {
          this.px(c, x + s * ART, y0 - ART, 1, 1, '#d8c8bc'); this.px(c, x + s * ART, y0, 1, 1, node.light); this.px(c, x + s * ART, y0 + ART, 1, 1, node.dark);
        }
      }
    }
  }
  /** The Seam Cart under the Keeper: iron, Kael's stencil upside down, four wheels turning. */
  private drawCart(c: CanvasRenderingContext2D, time: number): void {
    const cart = this.cart;
    if (!cart) return;
    const x = this.player.x, y = this.player.y + 6;
    const spin = this.reducedMotion ? 0 : Math.floor((time * cart.speed) / 12) & 1;
    this.px(c, x - 18, y - 22, 18, 1, '#140a1f');
    this.px(c, x - 18, y - 21, 18, 7, '#443540');
    this.px(c, x - 18, y - 21, 18, 1, '#7a656e');
    this.px(c, x - 16, y - 18, 3, 1, '#c4501e'); this.px(c, x + 8, y - 18, 3, 1, '#c4501e');
    this.px(c, x - 18, y - 8, 18, 1, '#171116');
    for (const wx of [x - 12, x + 8]) {
      this.px(c, wx - 2, y - 7, 4, 4, '#171116');
      this.px(c, wx - 1 + spin * 2, y - 6 + spin * 2, 1, 1, '#a49cac');
    }
  }
  /** The grapple's line: thornroot growing out to its mark, thorns on it. */
  private drawGrappleLine(c: CanvasRenderingContext2D): void {
    const g = this.grapple;
    if (!g) return;
    const hand = this.handPoint();
    const tx = g.phase === 'grow' ? g.tipX : g.tx, ty = g.phase === 'grow' ? g.tipY : g.ty;
    const d = Math.hypot(tx - hand.x, ty - hand.y), steps = Math.max(1, Math.floor(d / ART));
    for (let s = 0; s <= steps; s++) {
      const x = hand.x + (tx - hand.x) * s / steps, y = hand.y + (ty - hand.y) * s / steps;
      this.px(c, x, y, 1, 1, s % 3 === 0 ? '#7fb04a' : '#6a4a2c');
      if (s % 7 === 3) this.px(c, x + ART, y - ART, 1, 1, '#c9a06a');
    }
    this.px(c, tx - ART, ty - ART, 2, 2, '#c9a06a');
    this.px(c, tx, ty - ART * 2, 1, 1, '#7fb04a');
  }
  /** A Banked Ember or an Ironwood Sentinel (pixel figures), or the Banked Furnace's mouth and vents. */
  private drawDeepCreature(c: CanvasRenderingContext2D, m: Monster, time: number): void {
    const trait = m.def.trait, floor = m.def.floorY ?? FLOOR;
    if (trait === 'furnace') { this.drawFurnace(c, m, time); return; }
    const fade = m.hp <= 0 ? Math.max(0, m.dying / DEATH_FADE) : 1;
    const rise = m.born > 0 ? 1 - m.born / SPAWN_RISE : 1;
    const looking = m.phase === 'idle' ? Math.sign(this.player.x - m.x) || m.facing : m.facing;
    const warning = m.phase === 'windup' || m.phase === 'strike';
    if (warning && m.hp > 0) {
      c.fillStyle = m.phase === 'strike' ? '#ff765caa' : '#ff765c40';
      c.fillRect(m.facing < 0 ? m.x - 170 * this.figure : m.x, floor - 10, 170 * this.figure, 10);
    }
    c.save();
    c.globalAlpha = fade * rise;
    c.translate(Math.round(m.x + m.knock), floor);
    if (looking < 0) c.scale(-1, 1);
    const flash = m.flash > 0;
    const top = trait === 'dormant' ? this.drawEmber(c, m, time, flash) : trait === 'shade' || trait === 'warden' ? this.drawShade(c, m, time, flash) : this.drawSentinel(c, m, time, flash);
    c.restore();
    if (m.hp <= 0) return;
    const full = m.maxHp || 1, bar = 64, crown = floor - top - 12;
    c.fillStyle = '#302530'; c.fillRect(m.x - bar / 2, crown, bar, 5);
    c.fillStyle = '#ffe2c4'; c.fillRect(m.x - bar / 2, crown, Math.max(m.hp, m.shownHp) / full * bar, 5);
    c.fillStyle = '#dd866f'; c.fillRect(m.x - bar / 2, crown, m.hp / full * bar, 5);
  }
  /** A Banked Ember: a coal lump, cracks dull while it sleeps, ember-bright awake. Returns its height (world px). */
  private drawEmber(c: CanvasRenderingContext2D, m: Monster, time: number, flash: boolean): number {
    const awake = !!m.awake;
    const bob = awake && !this.reducedMotion ? Math.round(Math.sin(time * 6 + m.spawn) * 1) * ART : 0;
    const hot = m.phase === 'windup' || m.phase === 'strike';
    const crack = flash ? '#fff4dc' : !awake ? '#3a2a30' : hot ? '#fff4dc' : (Math.sin(time * 4 + m.spawn) > 0 || this.reducedMotion ? '#ffd08a' : '#ff9b4f');
    const SHAPE = [
      '....oooooo....',
      '..oobbbbbboo..',
      '.obbcbbbbcbbo.',
      'obbbbbcbbbbbbo',
      'obcbbbbbbcbbbo',
      'obbbbcbbbbbcbo',
      'obbcbbbbcbbbbo',
      '.obbbbbcbbbbo.',
      '..oobbbbbboo..',
      '....oooooo....',
    ];
    const colors: Record<string, string> = { o: '#0e0a12', b: flash ? '#d8c8bc' : awake ? '#2e2238' : '#1c1420', c: crack };
    const w = SHAPE[0].length, h = SHAPE.length;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = SHAPE[y][x];
      if (ch === '.') continue;
      c.fillStyle = colors[ch]; c.fillRect((x - w / 2) * ART, (y - h) * ART + bob, ART, ART);
    }
    // Eyes when awake.
    if (awake && !flash) { c.fillStyle = '#fff4dc'; c.fillRect(2 * ART, (3 - h) * ART + bob, ART, ART); c.fillRect(4 * ART, (3 - h) * ART + bob, ART, ART); }
    return h * ART;
  }
  /** An Ironwood Sentinel: a walking pillar, ember in its grain, shoulders raised to strike. Returns its height (world px). */
  private drawSentinel(c: CanvasRenderingContext2D, m: Monster, time: number, flash: boolean): number {
    const W = 12, H = 46;
    const lift = m.phase === 'windup' ? 3 : m.phase === 'strike' ? -1 : 0;
    const walk = !this.reducedMotion && m.phase === 'idle' ? Math.floor(time * 4 + m.spawn) & 1 : 0;
    const P = (x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = flash ? '#fff4ea' : color; c.fillRect((x - W / 2) * ART, (y - H) * ART, w * ART, h * ART); };
    // Feet, stepping.
    P(1, H - 2 - walk, 4, 2, '#2a2027'); P(7, H - 2 - (1 - walk), 4, 2, '#2a2027');
    // The pillar: outline, wood, grain, a lit edge, ember seams.
    P(1, 6, 10, H - 8, '#171116');
    P(2, 6, 8, H - 8, '#4a3a30');
    for (let gx = 3; gx < 10; gx += 3) P(gx, 8, 1, H - 12, '#2a2027');
    P(2, 6, 1, H - 8, '#6e5a48');
    for (let n = 0; n < 5; n++) P(4 + (n & 1) * 2, 12 + n * 6, 2, 1, '#c4501e');
    // Shoulders: a beam across the top, raised to bring the ceiling down.
    P(0, 2 - lift, W, 4, '#171116'); P(1, 3 - lift, W - 2, 2, '#6e5a48');
    // Eyes in the grain.
    P(4, 9, 1, 1, '#ffd08a'); P(7, 9, 1, 1, '#ffd08a');
    return H * ART;
  }
  /**
   * The Banked Furnace's face, drawn over its brick body whether it is awake
   * or not (it is the hall's set piece): mortar seams that glow with its heat,
   * a lit pilaster edge, the stack on its crown with smoke, two eye-slits, the
   * glowing rim of the mouth arch, and the grate over its mouth while banked.
   * Cold and dim asleep; ember while awake; white-hot when its core is open.
   */
  private drawFurnaceFacade(c: CanvasRenderingContext2D, t: Terrain, viewport: number, time: number): void {
    if (!this.world || this.world.t !== t) return;
    const B = FURNACE.body, M = FURNACE.mouth;
    const x0 = B.col * CELL, x1 = (B.col + B.w) * CELL, y0 = t.top + B.row * CELL, floor = t.top + FURNACE.floorRow * CELL;
    if (x1 < this.camera - 96 || x0 > this.camera + viewport + 96 || !t.inside(B.col, B.row) || !t.inside(B.col + B.w - 1, B.row)) return;
    const f = this.furnace, awake = !!f && f.monster.hp > 0;
    const open = awake && furnaceOpen(f!.state), hot = awake && (furnaceBreathing(f!.state) || furnaceWarning(f!.state));
    const pulse = this.reducedMotion ? .5 : .5 + .5 * Math.sin(time * (open ? 8 : hot ? 6 : 1.6));
    const seam = open ? '#ffd08a' : awake ? '#E8752A' : '#7a2a12';
    // Mortar seams across the brick, alternate courses offset.
    c.save();
    c.globalAlpha = awake ? .55 + .35 * pulse : .35;
    for (let r = 1; r < B.h; r++) this.px(c, x0 + 4, y0 + r * CELL - ART, (x1 - x0 - 8) / ART, 1, seam);
    for (let r = 0; r < B.h; r++) for (let k = (r & 1) ? 1 : 0; k < B.w; k += 2) this.px(c, x0 + k * CELL + CELL / 2, y0 + r * CELL, 1, TILE - 1, seam);
    c.restore();
    // A lit edge on its west side, a shadow on its east.
    this.px(c, x0, y0, 1, B.h * TILE, '#9c6a4a');
    this.px(c, x1 - ART, y0, 1, B.h * TILE, '#140a1f');
    // The stack on its crown, and smoke while it is awake.
    const sx = (B.col + (B.w >> 1) - 1) * CELL;
    this.px(c, sx - ART, y0 - 3 * CELL, 3 * TILE + 2, 3 * TILE, '#2a1418');
    this.px(c, sx, y0 - 3 * CELL, 3 * TILE, 1, '#7a3a2a');
    this.px(c, sx + 2 * ART, y0 - 3 * CELL + ART, 3 * TILE - 4, 2, awake ? seam : '#3a1c18');
    if (awake && !this.reducedMotion) {
      for (let w = 0; w < 4; w++) {
        const u = (time * .35 + w * .25) % 1;
        c.globalAlpha = .45 * (1 - u);
        this.px(c, sx + CELL + Math.sin(time + w * 1.7) * 10, y0 - 3 * CELL - u * 120, 4 + Math.floor(u * 4), 3, '#6a5878');
      }
      c.globalAlpha = 1;
    }
    // Its eyes: two slits that brighten as it breathes in, white when it is open.
    const eye = open ? '#fff4dc' : hot ? '#ffd08a' : awake ? '#E8752A' : '#3a1c18';
    const ey = y0 + 2 * CELL;
    for (const ex of [x0 + 2 * CELL, x1 - 4 * CELL]) {
      this.px(c, ex, ey, 2 * TILE, 4, '#0e0a12');
      this.px(c, ex + ART, ey + ART, 2 * TILE - 2, 2, eye);
    }
    // The mouth: a glowing rim on the arch, and the grate while it is banked.
    const mx0 = M.col * CELL, mx1 = (M.col + M.w) * CELL, my0 = t.top + M.row * CELL;
    this.px(c, mx0, my0, (mx1 - mx0) / ART, 1, open ? '#fff4dc' : seam);
    if (!open) {
      for (let bx = mx0 + 6; bx < mx1 - 4; bx += 14) {
        this.px(c, bx, my0 + ART, 2, (floor - my0) / ART - 1, '#171116');
        this.px(c, bx, my0 + ART, 1, (floor - my0) / ART - 1, '#57474f');
      }
      this.px(c, mx0, my0 + 2 * CELL, (mx1 - mx0) / ART, 1, '#171116');
    }
  }
  /**
   * The Banked Furnace awake: its core in the mouth (dull behind the grate
   * while banked, white-hot when open), its breath (embers streaming in along
   * the floor while it breathes in, a beat after the vents flare), the vents'
   * flames or steam, and its strength over its crown.
   */
  private drawFurnace(c: CanvasRenderingContext2D, m: Monster, time: number): void {
    const t = this.terrain, f = this.furnace;
    if (!t) return;
    const floor = m.def.floorY ?? FLOOR, mx = m.x;
    const open = !!f && furnaceOpen(f.state), breathing = !!f && furnaceBreathing(f.state), warning = !!f && furnaceWarning(f.state);
    const fade = m.hp <= 0 ? Math.max(0, m.dying / DEATH_FADE) : 1;
    const pulse = this.reducedMotion ? .5 : .5 + .5 * Math.sin(time * (open ? 9 : 3));
    c.save(); c.globalAlpha = fade;
    // The core: a round heart of ember, rings brightening inward.
    const cy = floor - 2 * CELL, grow = open ? 1 + .12 * pulse : 1;
    const rings: readonly [number, string][] = open
      ? [[30, '#c4501e'], [24, '#ff9b4f'], [17, '#ffd08a'], [9, '#fff4dc']]
      : warning || breathing ? [[26, '#7a2a12'], [20, '#c4501e'], [12, '#ff9b4f'], [5, '#ffd08a']]
        : [[24, '#3a1410'], [18, '#7a2a12'], [10, '#c4501e']];
    for (const [r, color] of rings) {
      const rr = r * grow;
      for (let dy = -rr; dy <= rr; dy += ART) {
        const half = Math.floor(Math.sqrt(Math.max(0, rr * rr - dy * dy)) / ART) * ART;
        this.px(c, mx - half, cy + dy, (2 * half) / ART, 1, m.flash > 0 ? '#fff4ea' : color);
      }
    }
    // The breath: embers streaming in along the floor from both sides.
    if (breathing && !this.reducedMotion) {
      for (let n = 0; n < 18; n++) {
        const side = n & 1 ? 1 : -1, u = ((time * .9 + n * .137) % 1);
        const x = mx + side * (1 - u) * 520, y = floor - 10 - ((n * 37) % 80);
        this.px(c, x, y, 3, 1, n % 3 ? '#ff9b4f' : '#ffd08a');
      }
    }
    c.restore();
    // The vents: tall flames while they burn (flaring before a breath), steam once doused.
    if (f) {
      for (let n = 0; n < f.vents.length; n++) {
        const i = f.vents[n], vx = (t.colOf(i) + .5) * CELL, vy = t.top + (t.rowOf(i) + 1) * CELL - 2 * ART;
        if (f.state.doused[n]) {
          if (this.reducedMotion) { this.px(c, vx - 4, vy - 24, 4, 2, '#b8c0c8'); continue; }
          for (let w = 0; w < 4; w++) { const u = (time * .7 + w * .25) % 1; c.globalAlpha = .8 * (1 - u); this.px(c, vx - 4 + Math.sin(time * 2 + w) * 5, vy - 12 - u * 56, 3, 2, '#b8c0c8'); }
          c.globalAlpha = 1;
          continue;
        }
        const tall = (warning || breathing ? 22 : 13) + (this.reducedMotion ? 0 : Math.floor(Math.sin(time * 14 + n * 2) * 2));
        this.px(c, vx - 8, vy - tall * ART, 8, tall, '#c4501e');
        this.px(c, vx - 6, vy - (tall - 3) * ART, 6, tall - 3, '#ff9b4f');
        this.px(c, vx - 3, vy - (tall - 7) * ART, 3, Math.max(1, tall - 7), '#ffd08a');
      }
    }
    if (m.hp <= 0) return;
    const full = m.maxHp || 1, bar = 220, crown = t.top + (FURNACE.body.row - 4) * CELL;
    c.fillStyle = '#302530'; c.fillRect(mx - bar / 2, crown, bar, 8);
    c.fillStyle = '#ffe2c4'; c.fillRect(mx - bar / 2, crown, Math.max(m.hp, m.shownHp) / full * bar, 8);
    c.fillStyle = open ? '#ffd08a' : '#dd866f'; c.fillRect(mx - bar / 2, crown, m.hp / full * bar, 8);
  }
  /** The pixel creature for an art key (creature-pixel.ts), or null: no art written, or no DOM. */
  private pixelCreature(key: string): CreaturePainter | null {
    let painter = this.creaturePainters.get(key);
    if (painter === undefined) {
      const art = this.canPaint && Object.prototype.hasOwnProperty.call(CREATURE_ART, key) ? CREATURE_ART[key] : null;
      painter = art ? new CreaturePainter(art) : null;
      this.creaturePainters.set(key, painter);
    }
    return painter;
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
    const pixel = sheet ? null : this.pixelCreature(monster.def.creature);
    if ((sheet || pixel) && monster.facing < 0) c.scale(-1, 1);
    if (pixel) {
      // Felled: the hurt frame sinks and fades (flashing white at first), as the painting did.
      if (!this.reducedMotion) c.scale(1 + t * .2, 1 - t * .6);
      pixel.draw(c, CREATURE_PIXEL, 'hurt', t < .25);
    } else {
      if (!this.reducedMotion && !sheet?.entry.actions['death']) c.scale(1 + t * .35, 1 - t * .7);
      this.creature(c, t < .25, monster.def.creature, sheet ? monster : undefined, sheet ? t : -1);
    }
    c.restore();
    if (this.reducedMotion) return;
    // Embers shed as it goes: whole art pixels, on the figure's grid.
    const g = CREATURE_PIXEL * k;
    c.save(); c.fillStyle = '#ffb46a';
    for (let n = 0; n < 7; n++) {
      const a = n * 2.4 + monster.spawn;
      c.globalAlpha = (1 - t) * .8;
      const x = monster.x + Math.cos(a) * 40 * t * k, y = floor - (50 + t * 70 + Math.sin(a) * 18) * k;
      c.fillRect(Math.round(x / g) * g, Math.round(y / g) * g, t < .5 ? g : g / 2, t < .5 ? g : g / 2);
    }
    c.restore();
  }
}
