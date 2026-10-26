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
import type { CorpseView, EngineOptions, EngineState, EngineInput, LootRow } from '../engine/engine.model';
import type { LootRarity, StationDef } from '../world/world.model';
import { FIGURE_K, KeeperPainter } from '../../shared/keeper-look/keeper-paint';
import { carriesStaff, vocationLook } from '../../shared/keeper-look/vocation-look';
import { CAST_FRAME, FRONT_AX, FRONT_AY, FRONT_H, FRONT_W, PHONE_FRAME, drawWornFront, frontFrame, frontSheet } from '../../shared/keeper-look/keeper-front';
import { NPC_LOOKS } from '../../shared/keeper-look/npc-looks';
import { defaultLook, randomLook, type KeeperLook, type KeeperStats } from '../../shared/keeper-look/keeper-look.model';
import type { KeeperGear } from '../../shared/keeper-look/keeper-gear';
import { PAL, hash, paintEdge, paintGround, TILE, type Ground, type Sprite } from './td-art';
import { paintRichGround, richEdge } from './td-ground';
import { castShadow } from './td-shade';
import { AURA_LOOKS, AuraFx, rimGlow, type AuraLook, type AuraLookId } from './td-aura';
// The art-direction prototype (td-artopt.ts, docs/handoff/artopt/): only reachable with ?artopt= in an automated browser.
import { optCamera, optHdFigures, optHdWorld } from './td-artopt';
import { AuraFx as LookAuraFx, rimGlow as lookRimGlow } from './td-aura-look';
import { backing, baseZoom, zoomFactor } from './td-zoom';
import { HD_KEEPER, HD_PET, HD_PET_ID, HD_SKEL, hdKeeperFrame, hdKeeperSheet, hdPetFrameIndex, hdPetSheet, hdSkeletonSheet } from './td-hd-art';
import { paintRichGroundHd } from './td-ground';
import { autoLowerDetail, envDetail, onEnvDetail, underTest } from './td-detail';
import { drawAbilityRing, drawAuraPip, drawBodyTell, drawCastTell, drawFalling, drawHazard, drawKeeperStatus, drawMobS6Air, drawPackAir, drawPackGround } from './td-ability-fx';
import { castable } from './td-abilities';
import { creatureProfile } from '../../shared/loot/creature-families';
import { AURA_NAMES_EN } from './td-elites';
import { type TdMap, type TdObject, type TdStall } from './seamworks-square';
import { TdWorld } from './td-world';
import { HandLevel, footFree, standNear, type TdLevel } from './td-level';
import { EMBER_MINE_1 } from './maps/ember-mine-1';
import { BLOCK } from './maps/ember-isle';
import { BARROW_DOOR_ID } from './maps/hushed-barrow';
import { SEXTON_CONTINENT, SEXTON_PAGE, SEXTON_STONES, SEXTON_VAULT, VAULT_GRAVE, VAULT_KEYHOLE, WALKER, WALKER_AT, chalkMark, ledgerPage, pageShown, seekSpot, stallSpot } from './td-sexton';
import type { ContinentDef } from './continent';
import { CONTINENTS, LEVELS } from './td-levels';
export { CONTINENTS, LEVELS };
import type { TdMapDef } from './td-level';

/** Out of the fight (4 s unhurt) the Keeper mends this much life a second, unless a curse's drain outweighs his regeneration. */
export const MEND_PER_SEC = 6;
/** The out-of-fight mend now (life a second): 6 after 4 s unhurt, none while a curse's drain outweighs regeneration. */
export function outOfFightMend(regen: number, unhurtSecs: number): number { return regen >= 0 && unhurtSecs > 4 ? MEND_PER_SEC : 0; }

/** The most creatures the minimap marks at once (owner's player notes 2026-10-21: "cap the count for performance"). */
/** Seconds of the Keeper standing still after which the pet stops strolling and settles beside him (td-roam). */
const PET_SETTLE = 14;
const MINI_MOBS = 40;
/** How far a thumb may miss a Keeper standing in the open and still tap them (art px sideways, up and down). */
const PEER_SLOP = 9;
/** The hidden-tab timer (ms) and the most time one tick of it catches up (s): stepHidden. */
const BG_TICK_MS = 250;
const BG_CATCHUP_SECS = 60;
/** A second tap on the Keeper whose card a tap just opened walks there (s). */
const PEER_AGAIN_SECS = 3;

/** Doors on the surface into a building's ground floor (a town's stall station id → the level and where to stand). */
/** The Seam-Cant's tone per tree: each element's body tone (effects-spec rule 2), so the words read as the spell's. */
const CANT_TONE: Readonly<Record<TreeId, string>> = {
  ember: FX.ember.body, bone: FX.bone.body, shadow: FX.shadow.body, common: LEVEL_UP.body,
  // The Ashguard's oaths speak in brass, the blade's fire in ember, the endurance in ash (td-ashguard-fx).
  brand: FX.ember.body, oath: ASH_FX.brass.body, ash: ASH_FX.ash.core,
  // The Lanternwright speaks in the lantern's glow, the hearth's fire and the kin's pale wings (td-lantern-fx).
  lamp: LAMP_FX.lamp.body, hearth: LAMP_FX.hearth.body, moth: LAMP_FX.moth.body,
  // The Thornstrider speaks in the bow's green, the wild beasts' spirit light and the briar's bark (td-thorn-fx).
  thorn: THORN_FX.thorn.body, wild: THORN_FX.wild.body, briar: THORN_FX.briar.core,
};
const DOORS: Readonly<Record<string, { to: string; arrive: string }>> = {
  'inn-door': { to: 'ember-inn-1', arrive: 'inn-out' }, 'spire-door': { to: 'pyre-spire-1', arrive: 'spire-out' },
  'salted-door': { to: 'salted-ember-1', arrive: 'salted-out' }, 'lodge-door': { to: 'woodward-lodge-1', arrive: 'lodge-out' },
  'bole-door': { to: 'rootglass-bole-0', arrive: 'bole-out' },
  'lantern-tower-door': { to: 'lantern-tower-0', arrive: 'lantern-tower-out' },
  'netloft-door': { to: 'netloft-1', arrive: 'netloft-out' }, 'herbal-door': { to: 'herbal-cottage-1', arrive: 'herbal-out' },
};
import { CORPSE_REACH, corpseAlpha, corpseStage, type Corpse } from './td-corpse';
import { corpseSize, corpseSprite, flyDots } from './td-corpse-art';
import { BOSS_TELL, CALL_TELL, CHANT_SECS, CHARGE_HIT, MOBS, MobSystem, RAISED_SKELETON, mobCell, mobSheet, windsUp, type Drop, type Minion, type Mob } from './td-mobs';
import { ELITE_TONES, FIRE_BURST, makePack, touchPack } from './td-elites';
import { mapSections, zoneLabels, type BandOverride, type LevelBand, type TdMapSection, type TdZoneLabel } from './td-map';
import { hardened, phaseOfHour, touchedRandom } from './td-phases';
import { SEAM_ID, riftPlace, riftTile, seamEaterAt, seamLeaves, seamRises } from './td-seam';
import { GAP_TONES, atZoneLevel, gapTone, graveyardZone, regionZone, seamLevelFor, zoneOf } from './td-zones';
import type { SkyPhase } from '../../shared/world-clock/world-clock.model';
import { drawAffixTells, drawBurstTell, drawEliteGround, drawElitePlate, eliteTint } from './td-elite-fx';
import { weaponSwing, type HeldWeapon } from './td-melee';
import { SKILLS, defaultBar, fightStats, type SkillId, type TreeId } from './td-skills';
import { ASH_FX, drawAshAir, drawAshGround, drawAshState } from './td-ashguard-fx';
import { LAMP_FX, drawBeacon, drawKindle, drawLampAir, drawLampGround, drawLampState, drawLampZones } from './td-lantern-fx';
import { THORN_FX, drawArrow, drawBeast, drawThornAir, drawThornGround, drawThornState, drawThornZones } from './td-thorn-fx';
import { SPIRIT_BEAST, THORN_PET, bondShare, spiritLevel, thornPetRest } from './td-thorn';
import { dropGlow, dropIconSrc } from './td-drop-art';
import { FX, HOSTILE_EDGE, LEVEL_UP, LOOT, beamMotes, beamSteps, burst, circlePixels, conePixels, discSprite, drawBurst, drawRing, fxNoise, glowSquare, groundRing, linePixels, lootBeam, polyPoints, ringArc, scorchSprite, type LootRung, type Tones } from './td-fx';
import type { ItemStats } from '../../shared/rpg/item.model';
import { ROAM, Stand, newRoam, stepRoam } from './td-roam';
import { GLIM_TD, TD_PET, TD_PET_FLIES, bossTelling, followSpot, glimIdle, glimPointer, idlePose, mendPulse, pastLeash, petBlow, pickFetchTarget, pickNipTarget, tdPetJob, type GlimSpot, type TdPetDoing } from './td-pets';
import { GLIM_H, GLIM_W, PET_H, PET_W, glimFrame, petFace, petFrameIndex, petSheet, type TdPetFrame } from './td-pet-art';
import { PET_ACT, petRole, type PetCommand, type PetMove, type PetRole, type PetSecond } from '../../shared/pets/pet-roles';
import type { PetAbility } from '../../shared/pets/pets.model';
import type { GlimMood } from '../../shared/glim/glim-art';
import type { LootFilter } from '../../shared/loot/loot-tiers';
import type { AuraId } from '../../shared/loot/auras';
import { drawHearth, drawPurse, drawShrine, drawWakeVeil, hearthContinent, hearthsOf, type TdHearth } from './td-hearth';
import { isBerth, pierById, pierOfMaster, routesFrom, fareFor, LANDS } from './td-harbour';
import { compass, levelLinks, levelSpawns, seekCost, townEntries, wayEntries, seekReading, type LevelLink, type SeekPlace, type SeekReading } from './td-seek';
import { relicRegen, relicTotals } from '../../shared/rpg/boss-uniques';
import { chestSetPiece } from '../../shared/rpg/set-items';
import { PARTY_PLATE, PEER_PLATE, TdPeers } from './td-peers';
import { TdCoop, type CoopRole } from './td-coop';
import { LifeMirror } from '../world/life-mirror';
import type { LifeView } from '../world/keeper-life';
import { ELEMENTS } from '../../shared/loot/damage.model';
import type { CoopAreas, CoopHitsMsg, CoopSnapMsg } from '../social/coop-protocol';
import type { WorldDrop } from '../social/world-protocol';
import { PAL_HEARTBEAT_MS, PAL_MS, PalBook, cleanPals, decodePresencePals, encodePresencePals, type CoopPal } from '../social/coop-pals';
import type { RemoteKeeper } from '../engine/engine';
import { relicSigOf } from '../../shared/rpg/unique-items';
import { DIFFICULTIES, type DifficultyTier } from '../../shared/loot/difficulty.model';
import { CHEST_GOLD_PILES, HUSH_CAPS, NIGHTROADS, SHADE_CHESTS, hushBand, type HushCap, type LightSpot } from './td-dark';
import { DarkLayer, type DarkFrame } from './td-dark-layer';
import { GLIM_OPEN_LIGHT, KEEPER_LIGHT, eyeGlow, findEyes, lightOpen, litAt, nightPass, skyOfHour, warmAt, type EyeSpot, type NightLight, type NightPass, type NightSetting } from './td-night';
import { floorEliteRows, guaranteeMagic } from './td-elites';
import { goldDropFor } from './td-mobs';
import { actionFor, defaultBindings, type Bindings } from '../../shared/keys/keymap.model';
import { TdWaygates, bossFighting, drawWaygate, waygateLeft } from './td-waygate';
import { FISH_REACH, GatherRuntime, SHADOW_CAP, SHADOW_CAP_LOW, type Campfire } from './td-gather';
import { WeatherFx } from './td-weather-fx';
import type { FishSpot } from './td-world';
import { FIRE_WARM } from '../../shared/gathering/gathering.model';
import { WEATHER_STATES, WET_LINGER_SECS, fireSecs, fogExtra, isWet, weatherAt, type WeatherNow, type WeatherShow, type WeatherState } from '../../shared/weather/weather.model';

/** The worn-gear keys the fight reads (they make up the build's cache key). */
export const GEAR_KEYS: readonly (keyof ItemStats)[] = ['life', 'mana', 'defense', 'spellDamage', 'castSpeed', 'moveSpeed', 'critChance', 'lifeRegen', 'manaRegen',
  'fireResist', 'coldResist', 'lightningResist', 'arcaneResist', 'allResist',
  // §3.6: the fighters' twins and the families' own.
  'attackDamage', 'attackSpeed', 'lifeLeech', 'pierceChance', 'blockChance', 'skillRanks'];

/** The Map window's ground colours (one pixel per tile, or per two on a continent). */
const MAP_COL: Partial<Record<Ground, string>> = {
  grass: PAL.grass[0], flowers: PAL.grass[1], dirt: PAL.dirt[0], cobble: PAL.cobble[0], sand: PAL.sand[0], plank: PAL.plank[0],
  water: PAL.water[0], ember: PAL.ember[0], cave: '#6a564c', rock: '#1d1720', wall: '#3a2a24', rug: '#8f3524',
  moss: PAL.moss[1], flagstone: PAL.temple[1], vinewall: '#2c3a2c', canopy: PAL.jungle[2], bark: PAL.bark[2],
  mire: PAL.mire[1], wetstone: PAL.wetstone[1], blackwater: '#202c38', drownwall: '#1f252b', boardwalk: PAL.boardwalk[3],
};
/** One pin on the Map: a place to go, where it lies (0..1 across and down the map), and its kind for its colour. */
export interface TdMapPin { id: string; label: string; blurb: string; kind: 'way' | 'ship' | 'stall' | 'npc' | 'harbour'; u: number; v: number;
  /** A task giver's mark ('!' a task to take, '?' one to hand in). */
  mark?: '!' | '?';
  /** A way down on the surface: the level it leads to (the Map opens its floors). */
  to?: string }
/** The Map window's view of one section (td-engine mapView). `me` is null on a section the Keeper is not on. */
export interface TdMapView {
  url: string; aspect: number; pins: TdMapPin[]; me: { u: number; v: number } | null;
  section: string; here: string; party: { id: string; name: string; u: number; v: number }[]; zones: TdZoneLabel[];
}
/** HUD portraits by look (heroPortrait). */
const portraits = new WeakMap<KeeperPainter, string>();
const CHUNK = 16;
/** The most ground chunks kept baked (≈ 0.26 MB each, four for water): the view and its ring, with room to turn back. */
const CHUNK_CAP = 40;
/** Grounds the HD painter (option B) paints edge to edge with each other. */
const GRASSY_HD = new Set<Ground>(['grass', 'flowers']);
/** Ground baking's share of a frame (ms) after the draw (docs/handoff/calm.md). */
const BAKE_MS = 3;
/** A ground chunk: its water frames' canvases and how many tile rows of each are painted (CHUNK = done). */
interface GroundChunk { cx: number; cy: number; frames: (HTMLCanvasElement | undefined)[]; rows: number[] }
/** A height over the feet that was set for the art-grid figure, grown with the fine figure (FIGURE_K). */
const up = (n: number) => Math.round(n * FIGURE_K);
const SPEED = 74;              // art px / s
const GUIDE_FAR_TILES = 40;     // Show me walks up to this far; past it Glim points instead
const REACH = 26;              // art px from a stall's interaction spot
/** The Row-Walker's spawn key (the Sexton's Count): its kill reads `td:surface:sexton:row-walker:…`, which the host credits. */
const WALKER_KEY = 'sexton:row-walker';
const FOLK = 16;               // townsfolk strolling the square (the references' busy plaza)
const FOLK_SPEED = 30;         // art px / s: a stroll, under half the Keeper's pace

interface Person { painter: KeeperPainter | null; x: number; y: number; face: 1 | -1; dir: 'side' | 'down' | 'up'; name?: string; moving: boolean; t: number; /** A keeper's id (its task mark). */ kid?: string }
/** A townsperson: strolls a route to somewhere in town, lingers, picks somewhere new. */
interface Folk extends Person { path: { x: number; y: number }[]; wait: number }
interface Puff { x: number; y: number; age: number; life: number; r: number }
/** A visual-only pixel of the effects pass: an aura's mote, a shard the Dark Ward sheds (docs/design/effects-spec.md). */
interface Mote { x: number; y: number; sx: number; sy: number; age: number; life: number; kind: 'ember' | 'life' | 'shard'; seed: number }
const NOVA_R = SKILLS['hellfire-nova'].vars['radius'] * TILE;
/** A Beacon's own light (art px): the dark layer's fixed light, half the night pass's hole. */
const BEACON_LIGHT = 60;
const MOTES = 10;              // an aura's motes alive at once (spec: ≤ 10)
const SHARDS = 8;
/** A loot pop: the small burst when gear lands on the ground or goes into the satchel (spec §Loot). */
interface LootPop { x: number; y: number; rung: LootRung; age: number; life: number; kind: 'drop' | 'pick'; seed: number }
/** The rung a drop stands on: gear and runes their own, anything else none (a coin pile, a sack). */
const rungOf = (g: Drop): LootRung | null => g.rarity ?? g.item?.rarity ?? (g.rune ? 'common' : null);
/** The pet following, in the world (td-pets.ts): where it is, what it is doing, what it carries, how tired it is. */
interface PetBody {
  id: string; role: PetRole; move: PetMove; level: number; command: PetCommand;
  x: number; y: number; face: 1 | -1; t: number; doing: TdPetDoing; moving: boolean;
  carried: Drop | null; goal: Drop | null; goalT: number; skip: Set<string>;
  cd: number; nips: number; stamina: number; restT: number; mendCd: number; mendT: number;
  feel: 'happy' | 'love' | 'trick' | 'alert' | null; feelT: number; hopT: number; stuckT: number; hurtT: number;
  idleT: number; lookT: number; way: { x: number; y: number } | null; wayT: number;
  hits: number; gathers: number; heals: number;
  /** The spirit beast standing in for a Thornstrider with no pet (td-thorn SPIRIT_BEAST): nothing of it is booked. */
  spirit?: boolean;
}
/** A spark Glim sheds (a find, a cheer): one pixel, a short arc. */
interface Spark { x: number; y: number; vx: number; vy: number; age: number; life: number; col: string }
const GLIM_FLAP = ['up', 'mid', 'down', 'mid'] as const;
/** A compass point as a unit step on the map (y grows south); null for none. */
function seekVector(dir: SeekReading['dir']): { x: number; y: number } | null {
  if (!dir) return null;
  const s = Math.SQRT1_2, V: Record<string, { x: number; y: number }> = {
    n: { x: 0, y: -1 }, ne: { x: s, y: -s }, e: { x: 1, y: 0 }, se: { x: s, y: s }, s: { x: 0, y: 1 }, sw: { x: -s, y: s }, w: { x: -1, y: 0 }, nw: { x: -s, y: -s },
  };
  return V[dir];
}

export class TopDownEngine {
  private readonly ctx: CanvasRenderingContext2D;
  /** The continent the Keeper is on (its surface); one is made per continent and kept (sailing back finds it as left). */
  private world: TdWorld;
  private readonly continents = new Map<string, TdWorld>();
  /** The level the Keeper is on: the surface, or a hand-drawn floor under it. */
  private level: TdLevel;
  private readonly levels = new Map<string, HandLevel>();
  /** Monsters, the Keeper's fight and the loot on the ground (td-mobs.ts). */
  private readonly mobs: MobSystem;
  /** Town portals (td-waygate.ts): the Keeper's own pair and the party's, from presence. */
  private readonly gates: TdWaygates;
  private gateSeen = '';
  private hp = 100;
  private maxHp = 100;
  /** Agility's speed of foot (0–0.3). */
  private agility = 0;
  /** The level's pace (0 → 0.6, keeper-level levelSpeedBonus): multiplies everything else that moves the Keeper. */
  private levelPace = 0;
  /** Worn Life Regen: life back each second, in the fight too. */
  private lifeRegen = 0;
  /** A potion still pouring in (potions.model.ts): life and mana left to give, over the seconds left. */
  private sip = { hp: 0, mana: 0, t: 0 };
  private lastHurt = -99;
  private messageAge = 0;
  /** The engine's own line, as an i18n key the HUD translates (engineMessage). */
  private messageKey = '';
  private spawnTimer = 0;
  private chaseTimer = 0;
  /** The swing being played (seconds left) and which way it faces. */
  private actT = 0;
  /** Is a point over a creature's body (an effect there stays ≤ 60%, effects-spec §Budget)? */
  private readonly overFoe = (x: number, y: number): boolean => this.mobs.mobs.some(m => Math.abs(x - m.x) < m.def.w / 2 && y < m.y && y > m.y - m.def.h);
  /** A tree being cut: hits so far, the next swing's timer. */
  private chop: { c: number; r: number; x: number; y: number; hits: number; t: number; swings?: number } | null = null;
  /** The gathering loops (td-gather.ts): the spot being fished, the pan, a light being struck, the campfires, a meal. */
  private readonly gather = new GatherRuntime();
  /** Weather v1 (shared/weather): what the sky does here now, drawn by td-weather-fx. */
  private readonly weatherFx = new WeatherFx();
  /** The host's clock and the room's rolls (setWeatherClock), read once a second. */
  private weatherIn: { ms: number; at: number; rolls: { window: number; lands: Readonly<Record<string, number>> } | null } | null = null;
  private weatherT = 0;
  /** `?weather=rain|storm|fog|overcast|clear`: the sky pinned for screenshots and tests. */
  private readonly weatherPin: WeatherState | null = typeof location !== 'undefined' ? ((WEATHER_STATES as readonly string[]).includes(new URLSearchParams(location.search).get('weather') ?? '') ? new URLSearchParams(location.search).get('weather') as WeatherState : null) : null;
  private weatherSeen = '';
  private gatherSeen = '';
  private gatherSeq = 0;
  /** The spots in view this frame (the draw's; the tap and the prompt read them). */
  private spotsInView: FishSpot[] = [];
  /** The last frame's step (s): the rain falls by it. */
  private frameDt = 0;
  private shake = 0;
  /** The stamped town (its stalls, keepers and streets); the ground and walls everywhere come from `world`. */
  private map: TdMap;
  private readonly chunks = new Map<string, GroundChunk>();
  /** The chunks the last draw showed [x0, y0, x1, y1] (prefetchGround bakes round them after the frame). */
  private groundView: [number, number, number, number] | null = null;
  private readonly player: Person;
  private readonly keepers: Person[] = [];
  private readonly folk: Folk[] = [];
  /** Walkable street tiles (cobble, plank, dirt) where townsfolk start and stroll to. */
  private readonly streets: number[] = [];
  private readonly keys = new Set<string>();
  private path: { x: number; y: number }[] = [];
  /** Walking a path: the closest the Keeper has come to the next step, and how long without getting closer. */
  private pathBest = Infinity;
  private pathStall = 0;
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
  /** The sky's phase (setSky) and the eclipse's depth: the world clock as a rule (td-phases.ts) and the eclipse's tint. */
  private skyPhase: SkyPhase = 'day';
  private eclipseDepth = 0;
  private phaseSeen = '';
  /**
   * For the phase specs (`?phase=night|dusk|eclipse`, only under an automated browser; the world clock jumps there):
   * a few of that sky's creatures laid round the Keeper once, standing calm — night creatures, or Eclipse-touched ones.
   */
  private readonly fxPhase: 'night' | 'eclipse' | null = typeof navigator !== 'undefined' && !!navigator.webdriver && typeof location !== 'undefined' ? ((/[?&]phase=(night|eclipse)\b/.exec(location.search)?.[1] ?? null) as 'night' | 'eclipse' | null) : null;
  private fxPhaseLaid = false;
  /**
   * The Seam Eater (td-seam.ts): the risen one, whether it fell this eclipse, each continent's rift (resolved once), and
   * what the canvas last said of it (`data-seam`: risen, half, slain, gone).
   */
  private seam: Mob | null = null;
  /** Shared creatures in a party (Hearth protocol 4; td-coop.ts): host, member, or solo as before. */
  private coop!: TdCoop;
  /** `?fxpeer=1` (automated browsers only): `window.__tdPeer` stands a Keeper beside a task giver, to tap. */
  private readonly fxPeer = typeof navigator !== 'undefined' && !!navigator.webdriver && typeof location !== 'undefined' && /[?&]fxpeer=1\b/.test(location.search);
  /** `?fxcoop=1` (automated browsers only): `window.__tdCoop` lays calm creatures, wounds them, reads the shared set. */
  private readonly fxCoop = typeof navigator !== 'undefined' && !!navigator.webdriver && typeof location !== 'undefined' && /[?&]fxcoop=1\b/.test(location.search);
  /** The co-op spec's quiet: no wild spawns (only what it lays). */
  private fxCoopQuiet = false;
  private coopRoleSeen = '';
  /** Other Keepers' companions (coop-pals.ts): the party's from its channel, everyone's pet and Glim from presence. */
  private readonly palBook = new PalBook();
  private palAcc = 0;
  private palKey = '';
  private palAt = -1e9;
  private seamSlain = false;
  private seamLast = '';
  private seamSeen = '';
  private readonly rifts = new Map<string, { x: number; y: number } | null>();
  /**
   * For the seam specs (`?fxseam=1`, only under an automated browser): the world clock jumps into an eclipse
   * (world-clock.service) and the Eater rises once, calm (no sight), a few steps from the Keeper on open ground;
   * `window.__tdSeam` makes it attack, wounds it to half, fells it, and holds the world still for a photograph.
   */
  private readonly fxSeam = typeof navigator !== 'undefined' && !!navigator.webdriver && typeof location !== 'undefined' && /[?&]fxseam=1\b/.test(location.search);
  private fxSeamLaid = false;
  private fxFrozen = false;
  private pinned: number | null = null;
  private scale = 2;
  private cam = { x: 0, y: 0, w: 0, h: 0 };
  private stateTimer = 0;
  private message = '';
  private nearby: TdStall | null = null;
  /** Head marks over task givers, by keeper id ('!' a task on offer, '?' one to hand in): setTaskMarks. */
  private taskMarks: Readonly<Record<string, '!' | '?'>> = {};
  private glim = { x: 0, y: 0, shown: true };
  /** Glim's face, its bond's glow and powers, a flight (pointing, a cheer, Show me), what it has pointed at, its sparks. */
  private glimFeel: { mood: GlimMood; t: number } = { mood: 'calm', t: 0 };
  private glimBright = false;
  private glimPowerSet = { lamp: false, missed: false };
  private glimFlight: { x: number; y: number; phase: 'out' | 'hold' | 'back'; hold: number } | null = null;
  private glimTrail: { x: number; y: number; t: number } | null = null;
  private readonly glimTold = new Set<string>();
  private glimPointT = 4;
  private glimDartT = 10;
  private glimFlashT = 0;
  private glimTellKey = '';
  private sparks: Spark[] = [];
  /** The pet following (setPet), the Keeper's stillness (the companions idle by it) and his breadcrumbs (the pet's way round corners). */
  private pet: PetBody | null = null;
  private stillT = 0;
  /** td-roam: where the Keeper stands, and the pet's own stroll. */
  private readonly petStand = new Stand();
  private readonly petRoam = newRoam();
  private readonly trail: { x: number; y: number }[] = [];
  /** The loot filter (setCombatRules): a pet fetches only the gear it shows. */
  private lootFilter: LootFilter = 'all';
  /** E2E only (e2e/td-pets.spec.ts): with `?petfetch=1` under an automated browser, two real materials lie a few steps off. */
  private readonly petFetchTest = typeof navigator !== 'undefined' && !!navigator.webdriver && typeof location !== 'undefined' && /[?&]petfetch=1\b/.test(location.search);
  private petFetchLaid: unknown = null;
  private dark: HTMLCanvasElement | null = null;
  /** The darkness pass (td-night.ts): the player's setting, this frame's pass and lights, the stepped sprites by radius. */
  private nightSetting: NightSetting = 'full';
  private night: NightPass = { rgb: [0, 0, 0], alpha: 0, warm: 0, amount: 0 };
  private nightLights: NightLight[] = [];
  private nightSeen = '';
  private readonly holeSprites = new Map<number, HTMLCanvasElement>();
  private readonly warmSprites = new Map<number, HTMLCanvasElement>();
  private readonly mobEyes = new Map<string, EyeSpot[][]>();
  private readonly mobShades = new Map<string, HTMLCanvasElement>();
  /** The fog pass: one tileable bank of mist, the half-resolution layer it is laid into, the clear patch round the Keeper. */
  private fogTile: HTMLCanvasElement | null = null;
  private fogLayer: HTMLCanvasElement | null = null;
  private fogHole: HTMLCanvasElement | null = null;
  private readonly unbind: (() => void)[] = [];
  /** The Slate is open: the Keeper faces the camera and looks at it in their hands. */
  private phone = false;
  private frameError = false;
  /** The objects drawn this frame (smoke, lights and fireflies read them). */
  private visible: TdObject[] = [];
  /** The effects pass: aura motes and ward shards (visual only), the ward last seen, reduced motion. */
  private motes: Mote[] = [];
  private moteT = 0;
  private wardSeen = 0;
  /** Loot pops alive, and the gear drops seen last frame (a new one pops as it lands, a vanished one at the feet as it is taken). */
  private pops: LootPop[] = [];
  private seenDrops = new Map<string, { x: number; y: number; rung: LootRung }>();
  private seenLevel: unknown = null;
  /**
   * Screenshot-only (e2e/td-fx2-shots.spec.ts): with `?fxloot=1` under an automated browser, one drop of every rung
   * lies round the Keeper. Drawn only — never in the MobSystem, so nothing can be picked up and nothing reaches a save.
   */
  /**
   * Screenshot-only (e2e/td-mobs-shots.spec.ts, S6): with `?fxs6=aura|raise|meteor|pets` under an automated browser, a
   * scene of the monsters' abilities and pack auras laid round the Keeper on open grass (calm, so the picture holds).
   */
  private readonly fxS6: string | null = typeof navigator !== 'undefined' && !!navigator.webdriver && typeof location !== 'undefined' ? (/[?&]fxs6=(aura|raise|meteor|pets|loot)\b/.exec(location.search)?.[1] ?? null) : null;
  private fxS6Laid = false;
  private fxS6T = 0;
  private readonly fxLoot = typeof navigator !== 'undefined' && !!navigator.webdriver && typeof location !== 'undefined' && /[?&]fxloot=1\b/.test(location.search);
  /** For the screenshot spec (`?fxgold=1`, only under an automated browser): three real Gold piles laid east of the Keeper, once. */
  private readonly fxGold = typeof navigator !== 'undefined' && !!navigator.webdriver && typeof location !== 'undefined' && /[?&]fxgold=1\b/.test(location.search);
  private fxGoldLaid = false;
  /**
   * The Cold Hearth (td-hearth.ts, design-bible §5.8): the hearths lit, the wake point and the blessings held (the host
   * hands them in: setHearths), the fallen purse (setFallenPurse), and the wake after a fall (the veil, then the hearth).
   */
  private hearthLit = new Set<string>();
  private hearthWake: string | null = null;
  private hearthBlessed = 0;
  private purse: { area: string; x: number; y: number; gold: number } | null = null;
  private waking: { t: number; moved: boolean } | null = null;
  private hearthSeen = '';
  /**
   * Protocol 10 (play/world/keeper-life.ts): the room keeps this Keeper's life. The screen still shows every blow,
   * heal and potion at once; what the room did not see goes to it as claims (LifeMirror), each snapshot's word is the
   * truth plus what is still on its way, and the fall is the room's call (`roomDown`).
   */
  private life: LifeMirror | null = null;
  /** Life after the last accounting; a room blow's local share since; other harm since; regen's fractions. */
  private lifeMark = 0;
  private lifeBiteLocal = 0;
  private lifeHurt = 0;
  private lifeFrac = 0;
  private inRoomBite = false;
  private lifeBusy = false;
  private lifeSentAt = 0;
  private lifeGuardSent = '';
  /** The room holds this Keeper down (its fall is under way until a hearth wakes it). */
  private roomDown = false;
  /** The room's most life (it may clamp the screen's). */
  private roomMax = 0;
  /** The wake claim's sequence: the room's "down" from before it took the wake is old news. */
  private wakeQ = 0;
  /** For the hearth specs (`?fxfall=1`, only under an automated browser): `window.__tdHearth` can fell the Keeper and stand him at a hearth. */
  /** For the party spec (`?fxparty=1`, only under an automated browser): `window.__tdParty` fells the nearest creature (the real kill path) or hurts the Keeper. */
  private readonly fxParty = typeof navigator !== 'undefined' && !!navigator.webdriver && typeof location !== 'undefined' && /[?&]fxparty=1\b/.test(location.search);
  private readonly fxFall = typeof navigator !== 'undefined' && !!navigator.webdriver && typeof location !== 'undefined' && /[?&]fxfall=1\b/.test(location.search);
  /**
   * For the elite specs (`?fxelite=1`, only under an automated browser): a champion pack east of the Keeper and a named
   * unique with three affixes west of him, once — real MobSystem packs, standing calm (no sight) so the shot holds still.
   * `?fxelite=fight` lets them hunt (sight kept), to see the affixes work.
   */
  private readonly fxElite = typeof navigator !== 'undefined' && !!navigator.webdriver && typeof location !== 'undefined' ? (/[?&]fxelite=(1|fight)\b/.exec(location.search)?.[1] ?? null) : null;
  private fxEliteLaid = false;
  private eliteSeen = '';
  private goldSeen = -1;
  private showcase: Drop[] = [];
  /** Items other Keepers (or this one) left on the ground, as the Hearth relays them (protocol 6; play/trade). */
  private shared: Drop[] = [];
  /** Protocol 7: room ground ids gone for good here (taken, crumbled), and those asked for and not yet answered. */
  private readonly roomGone = new Set<string>();
  private readonly roomTaking = new Set<string>();
  private roomArea = '';
  private groundSeen = '';
  private tellSeen = '';
  /** The Seam-Cant line over the Keeper (design-bible §4.0): the last spell's words, their tone, and how long they have hung. */
  private cant: { text: string; color: string; age: number } | null = null;
  private cantSeen = '';
  private popSeen = '';
  private showcaseLevel: unknown = null;
  private showcaseT = 0;
  /**
   * The mystery layer (td-dark.ts, design-bible §5.3–5.4): the Hush, the shapes at the light's edge, Hollow Footsteps,
   * shy chests, the Nightroads. Session state only (the Hush is a mood of this outing, not a save).
   */
  private readonly darkLayer = new DarkLayer(Math.floor(Math.random() * 1e9).toString(36), cue => this.options.onSfx?.({ kind: cue }));
  private readonly darkSeeded = new WeakSet<object>();
  private darkSeen = '';
  /**
   * The Sexton's Count (shared/sexton; td-sexton.ts): the step and the facts the host hands in (setSextonCount), the
   * stones and the page stood once on Ember Isle, and the Row-Walker's wait before it rises again.
   */
  private sexton: { step: string; facts: ReadonlySet<string> } = { step: 'offer', facts: new Set() };
  private readonly sextonSeeded = new WeakSet<object>();
  private sextonSeen = '';
  private walkerT = 0;
  private walkerUp = false;
  private fxSextonCalm = false;
  /** For the chain's e2e (`?fxsexton=1`, only under an automated browser): `window.__tdSexton` walks the Keeper to each place of it. */
  private readonly fxSexton = typeof navigator !== 'undefined' && !!navigator.webdriver && typeof location !== 'undefined' && /[?&]fxsexton=1\b/.test(location.search);
  /**
   * For the dark specs (only under an automated browser): `?hush=0..100` holds the Hush there (awake anywhere, any
   * level); `?fxdark=1` lets `window.__tdDark.lay()` stand two shapes at the light's edge (held for a photograph) with a spell
   * of footsteps; with either, `window.__tdDark` can walk the Keeper to a shy chest or a Nightroad and fire an omen.
   */
  private readonly fxHush: number | null = (() => {
    if (typeof navigator === 'undefined' || !navigator.webdriver || typeof location === 'undefined') return null;
    const m = /[?&]hush=(\d{1,3})\b/.exec(location.search);
    return m ? Math.max(0, Math.min(100, Number(m[1]))) : null;
  })();
  private readonly fxDark = typeof navigator !== 'undefined' && !!navigator.webdriver && typeof location !== 'undefined' && /[?&]fxdark=1\b/.test(location.search);
  private readonly peers = new TdPeers();
  /** The last Keeper a tap named, and when (a second tap on them walks through: tap()). */
  private peerTapped: { id: string; at: number } | null = null;
  private readonly reduceMq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  /** Reduced motion, read live: the same shapes, no travel (spec §Rules 6). */
  private get still(): boolean { return !!this.reduceMq?.matches; }

  constructor(private readonly canvas: HTMLCanvasElement, private readonly options: EngineOptions) {
    // Opaque (every frame paints the whole canvas): the compositor never blends it with the page under it.
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.world = new TdWorld();
    this.continents.set(this.world.continent, this.world);
    this.map = this.world.town;
    this.level = this.world;
    this.mobs = new MobSystem({
      options: this.options,
      walkable: (c, r) => this.level.walkable(c, r),
      levelId: () => this.level.id,
      player: () => this.player,
      hurtPlayer: n => this.hurt(n),
      healPlayer: n => { this.hp = Math.min(this.maxHp, this.hp + n); },
      playerHp: () => this.hp,
      lifeBite: (cut, land) => this.roomBite(cut, land),
      hover: (c, r) => this.level.walkable(c, r) || this.level.ground(c, r) === 'ember' || this.level.ground(c, r) === 'blackwater',
      passable: (c, r) => { const g = this.level.ground(c, r); return g !== 'rock' && g !== 'wall' && g !== 'vinewall' && g !== 'bark'; },
      // Sight (td-sight.ts): whatever the walkability map keeps feet off stops a ray and a shot — walls, rock, stalls,
      // trees, a shut door — except the low ground a shot flies over (water, embers, the fens, the leaf-sea).
      sight: (c, r) => { const g = this.level.ground(c, r); return g !== 'water' && g !== 'ember' && g !== 'blackwater' && g !== 'canopy' && !this.level.walkable(c, r); },
      swung: at => { this.actT = .3; if (at && Math.abs(at.x - this.player.x) > 2) this.player.face = at.x < this.player.x ? -1 : 1; this.player.dir = 'side'; },
      // No elite pack in a town, a village or the clear ground round them (td-elites.ts).
      safeAt: (x, y) => this.level === this.world && this.world.safeAt(Math.floor(x / TILE), Math.floor(y / TILE)),
      seek: secs => this.seekNow(secs),
      waygate: secs => this.gates.open(this.time, secs),
      dash: (x, y) => this.dashTo(x, y),
      say: key => this.say(key),
    });
    this.gates = new TdWaygates({
      here: () => this.whereabouts,
      hearths: () => this.hearths,
      inTown: () => this.level === this.world && this.world.inSettlement(Math.floor(this.player.x / TILE), Math.floor(this.player.y / TILE)),
      bossFight: () => bossFighting(this.player, this.mobs.mobs),
      seamFight: () => !!this.seam && this.seam.hp > 0,
      travel: to => { const ok = this.restoreWhereabouts(to); if (ok) { this.path = []; this.arrive = null; this.player.dir = 'down'; } return ok; },
      say: key => this.say(key),
      partyGates: () => this.peers.partyGates(),
    });
    // Elite packs (roadmap §10 item 3): on in the world, a fresh salt each session so the same spot is not always one.
    this.mobs.elites = true; this.mobs.levelGap = true;
    this.coop = new TdCoop(this.mobs, {
      send: body => this.options.onCoopSnap?.(body) ?? Promise.resolve(false),
      claim: body => this.options.onCoopHits?.(body) ?? Promise.resolve(false),
      killed: kill => this.options.onCoopKill?.(kill) ?? 'none',
      now: () => performance.now(),
      phase: () => (this.pinned !== null ? phaseOfHour(this.pinned) : this.skyPhase),
      still: () => this.still,
      role: (role, was) => this.coopRole(role, was),
      cue: why => this.options.cueText?.(why) ?? '',
      life: me => this.lifeHeard(me),
      down: (to, x, y, self) => this.coopDown(to, x, y, self),
    });
    this.mobs.eliteSalt = Math.floor(Math.random() * 1e9).toString(36);
    this.player = { painter: new KeeperPainter(defaultLook()), x: this.map.spawn.x, y: this.map.spawn.y, face: 1, dir: 'down', moving: false, t: 0 };
    this.placeCompanions();
    this.populate();
    this.bindInput();
    try { const h = new URLSearchParams(window.location.search).get('hour'); if (h !== null && h !== '') { this.pinned = Math.max(0, Math.min(24, Number(h))); const k = skyOfHour(this.pinned); this.darkness = k.darkness; this.dusk = k.glow; } } catch { /* no URL */ }
    this.darkLayer.pinned = this.fxHush;
    if (this.fxDark || this.fxHush !== null) (window as unknown as Record<string, unknown>)['__tdDark'] = {
      chest: (id?: string) => this.fxToChest(id),
      lay: () => { if (this.fxDark) this.layDarkShowcase(); return this.darkLayer.shapes.length; },
      road: (id?: string, where?: 'shore' | 'nook') => this.fxToRoad(id, where),
      omen: (kind: 'bell' | 'flicker' | 'whisper' | 'name') => this.darkLayer.fire(kind, 1, { keeper: this.player, own: this.ownLight(), glim: this.glimLight(), still: this.still }),
      hush: (n: number) => { this.darkLayer.pinned = Math.max(0, Math.min(100, n)); },
      state: () => this.darkState(),
    };
    // The zone specs (webdriver only): stand the Keeper on a tile of the world (the nearest walkable), lay a creature
    // at a zone's level beside him, and read the zone underfoot (td-zones.ts).
    // The art pass's camera (webdriver only; e2e/td-art-shots.spec.ts): the arcane aura on the Keeper, the motes alive.
    if (typeof navigator !== 'undefined' && navigator.webdriver) (window as unknown as Record<string, unknown>)['__tdArt'] = {
      aura: (on: boolean | AuraLookId) => { this.artAura = on === true ? 'arcane' : on ? on : null; },
      perf: () => this.perf?.splice(0) ?? [],
      motes: () => this.auraFx.alive,
      // The art-direction prototype's photographs: a pet at the Keeper's side (td-artopt.ts), a pulse now.
      pet: (id: string) => { this.setPet({ id, name: 'Kit', hat: false, ability: 'none' as unknown as PetAbility, level: 3, command: 'stay' as PetCommand }); return !!this.pet; },
      pulse: () => { this.lookAura.pulse(1.3); this.auraBeat = this.time; return this.lookAura.pulsing; },
      // Stand the Keeper on a hand-made level (or the surface) of this continent (or another), at tile (c, r) or the nearest free spot.
      visit: (level: string, c: number, r: number, continent?: string) => this.restoreWhereabouts({ continent: continent ?? this.world.continent, level, x: c * TILE + TILE / 2, y: r * TILE + TILE - 2 }),
      // The nearest worn road through grass (a dirt tile with grass to either side): the Keeper stands beside it.
      road: (dc = 1) => {
        const pc = Math.floor(this.player.x / TILE), pr = Math.floor(this.player.y / TILE), g = (c: number, r: number) => this.level.ground(c, r);
        for (let d = 0; d <= 60; d++) for (let y = -d; y <= d; y++) for (let x = -d; x <= d; x++) {
          if (Math.max(Math.abs(x), Math.abs(y)) !== d) continue;
          const c = pc + x, r = pr + y;
          if (g(c, r) !== 'dirt' || g(c + 3, r) !== 'grass' || g(c - 3, r + 2) !== 'grass' || !footFree(this.level, (c + dc) * TILE + TILE / 2, r * TILE + TILE - 2)) continue;
          this.player.x = (c + dc) * TILE + TILE / 2; this.player.y = r * TILE + TILE - 2; this.path = [];
          this.placeCompanions();
          return { c, r };
        }
        return null;
      },
    };
    // The gathering e2e (webdriver only): the spots near the Keeper and where their floats are on the page, a step to near
    // one (the spec still taps the float, and the Keeper still walks to its shore), and what the loops are doing.
    if (typeof navigator !== 'undefined' && navigator.webdriver) (window as unknown as Record<string, unknown>)['__tdGather'] = {
      spots: (reach = 900) => {
        const k = this.player;
        return this.level === this.world ? this.world.spotsIn(k.x - reach, k.y - reach, k.x + reach, k.y + reach)
          .map(sp => ({ id: sp.id, water: sp.water, x: sp.x, y: sp.y, shore: sp.shore, d: Math.round(Math.hypot(sp.x - k.x, sp.y - k.y)) }))
          .sort((a, b) => a.d - b.d) : [];
      },
      near: (x: number, y: number, dx = 0, dy = 48) => {
        const tx = x + dx, ty = y + dy;
        for (let d = 0; d < 80; d += 4) for (const [ox, oy] of [[0, d], [d, 0], [-d, 0], [0, -d], [d, d], [-d, d]]) {
          if (footFree(this.level, tx + ox, ty + oy)) { this.player.x = tx + ox; this.player.y = ty + oy; this.path = []; this.placeCompanions(); return true; }
        }
        return false;
      },
      page: (x: number, y: number) => {
        const r = this.canvas.getBoundingClientRect(), k = Math.max(1, this.canvas.width) / Math.max(1, r.width);
        return { x: Math.round(r.left + (x - this.cam.x) * this.scale / k), y: Math.round(r.top + (y - this.cam.y) * this.scale / k) };
      },
      fires: () => this.gather.fires.map(f => ({ x: Math.round(f.x), y: Math.round(f.y), left: Math.round(f.left), lv: f.lv })),
      hurt: (n: number) => { this.hp = Math.max(1, this.hp - n); return this.hp; },
      state: () => ({
        fishing: this.gather.fish ? { spot: this.gather.fish.spot.id, n: this.gather.fish.n, wait: this.gather.fish.wait } : null,
        cooking: this.gather.cook ? { n: this.gather.cook.n, range: this.gather.cook.range } : null,
        striking: !!this.gather.strike, fires: this.gather.fires.length, shadows: this.gather.shadowsDrawn, meal: this.gather.meal,
        weather: this.weatherFx.now, wet: this.mobs.kst.wet, flashes: this.weatherFx.flashes, wetness: this.weatherFx.wetness,
        hp: Math.round(this.hp), maxHp: this.maxHp, x: Math.round(this.player.x), y: Math.round(this.player.y), level: this.level.id, continent: this.world.continent,
      }),
    };
    if (typeof navigator !== 'undefined' && navigator.webdriver) (window as unknown as Record<string, unknown>)['__tdZones'] = {
      to: (c: number, r: number) => {
        for (let d = 0; d <= 12; d++) for (let y = -d; y <= d; y++) for (let x = -d; x <= d; x++) {
          if (Math.max(Math.abs(x), Math.abs(y)) !== d || !footFree(this.level, (c + x) * TILE + TILE / 2, (r + y) * TILE + TILE - 2)) continue;
          this.player.x = (c + x) * TILE + TILE / 2; this.player.y = (r + y) * TILE + TILE - 2; this.path = [];
          this.placeCompanions();
          return true;
        }
        return false;
      },
      foe: (type: string, level: number, dx = 40, dy = 0) => {
        const def = MOBS[type]; if (!def) return null;
        const p = this.player, m = this.mobs.place(`fx-zone:${type}:${level}:${this.mobs.mobs.length}`, { ...atZoneLevel(def, level), sight: 0 }, p.x + dx, p.y + dy);
        m.wait = 1e9;
        return m.def.level;
      },
      zone: () => this.zoneHere(),
      keeperLevel: () => this.mobs.keeperLevel,
    };
    // Sight's e2e (webdriver only; td-sight.ts): a wall between the Keeper and a calm boss, a raw bolt thrown at it
    // anyway, the raised laid on one spot to watch them spread.
    if (typeof navigator !== 'undefined' && navigator.webdriver) (window as unknown as Record<string, unknown>)['__tdLos'] = {
      // The nearest wall (three tiles of it) with open floor two tiles either side and no sight across: the Keeper on one
      // side, the boss (calm, sturdy) on the other. Its world spots, or null.
      arena: (type = 'ember-warden', hp = 5000) => {
        const def = MOBS[type]; if (!def) return null;
        const pc = Math.floor(this.player.x / TILE), pr = Math.floor((this.player.y - 1) / TILE), at = (c: number, r: number) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE - 2 });
        // Side by side first (the wall stands between them on the screen), then one above the other.
        for (const [ox, oy] of [[1, 0], [0, 1]] as const) for (let d = 0; d <= 40; d++) for (let y = -d; y <= d; y++) for (let x = -d; x <= d; x++) {
          if (Math.max(Math.abs(x), Math.abs(y)) !== d) continue;
          const c = pc + x, r = pr + y;
          if (!this.mobs.sight.solid(c, r)) continue;
          {
            // A real wall (three tiles of it across the line), not a lone post.
            if (!this.mobs.sight.solid(c - oy, r - ox) || !this.mobs.sight.solid(c + oy, r + ox)) continue;
            // The wall may be a few tiles thick: the boss on the first open floor past it, two tiles on.
            const a = at(c - 2 * ox, r - 2 * oy);
            let b: { x: number; y: number } | null = null;
            for (let g = 2; g <= 5 && !b; g++) { const q = at(c + g * ox, r + g * oy); if (footFree(this.level, q.x, q.y) && !this.mobs.sight.solid(c + (g - 1) * ox, r + (g - 1) * oy) && this.mobs.sight.solid(c + (g - 2) * ox, r + (g - 2) * oy)) b = q; }
            if (!b || !footFree(this.level, a.x, a.y) || this.mobs.sight.solid(c - ox, r - oy) || this.mobs.sight.sees(a.x, a.y, b.x, b.y)) continue;
            this.player.x = a.x; this.player.y = a.y; this.path = []; this.arrive = null; this.mobs.target = null;
            for (let i = this.mobs.mobs.length - 1; i >= 0; i--) if (this.mobs.mobs[i].key.startsWith('fx-los:')) this.mobs.mobs.splice(i, 1);
            const m = this.mobs.place(`fx-los:${type}`, { ...def, hp, sight: 0, ranged: undefined, rend: undefined, charge: undefined, summon: undefined }, b.x, b.y);
            m.wait = 1e9;
            this.placeCompanions();
            return { keeper: a, boss: b, wall: { c, r } };
          }
        }
        return null;
      },
      boss: () => { const m = this.mobs.mobs.find(x => x.key.startsWith('fx-los:')); return m ? { hp: m.hp, max: m.def.hp, x: Math.round(m.x), y: Math.round(m.y), seen: this.mobs.sees(m), target: this.mobs.target === m } : null; },
      // Where the boss's middle is on the page (for a real tap on it).
      page: () => {
        const m = this.mobs.mobs.find(x => x.key.startsWith('fx-los:')); if (!m) return null;
        const r = this.canvas.getBoundingClientRect(), k = Math.max(1, this.canvas.width) / Math.max(1, r.width);
        return { x: Math.round(r.left + (m.x - this.cam.x) * this.scale / k), y: Math.round(r.top + (m.y - m.def.h / 2 - this.cam.y) * this.scale / k) };
      },
      // An Ember Bolt thrown at the boss whatever stands between (the path the auto-attack never takes without sight).
      bolt: () => { const m = this.mobs.mobs.find(x => x.key.startsWith('fx-los:')); if (!m) return false; const p = this.player; this.mobs.bolts.push({ x: p.x, y: p.y - 22, to: m, dmg: 40, age: 0, lift: 22 }); return true; },
      cast: (id: string) => { this.mobs.cooldowns[id as SkillId] = 0; this.mobs.mana = this.mobs.maxMana; return this.useAbility(id); },
      attack: (on: boolean) => { this.mobs.attacking = on; },
      // `n` raised all on the Keeper's own feet (as a careless spell would lay them); where they stand now.
      raise: (n = 6) => { this.mobs.minions.length = 0; for (let i = 0; i < n; i++) this.mobs.minions.push({ id: 9100 + i, x: this.player.x, y: this.player.y, hp: 400, maxHp: 400, dmg: [3, 5], cd: .6, t: 1, face: 1, life: Infinity, hit: 0, target: null }); return n; },
      kin: () => this.mobs.minions.map(k => ({ x: Math.round(k.x), y: Math.round(k.y) })),
      state: () => ({ walled: this.mobs.walled, bolts: this.mobs.bolts.length, puffs: this.mobs.effects.filter(e => e.kind === 'puff').length, rays: this.mobs.sight.castTotal, asked: this.mobs.sight.asked, x: Math.round(this.player.x), y: Math.round(this.player.y), level: this.level.id }),
    };
    // The Ashguard's e2e (webdriver only): a creature at the Keeper's side to swing at, and the blade's count.
    if (typeof navigator !== 'undefined' && navigator.webdriver) (window as unknown as Record<string, unknown>)['__tdAsh'] = {
      foe: (type = 'ash-wolf', dx = 22) => { const def = MOBS[type]; if (!def) return null; const p = this.player; this.mobs.place(`fx-ash:${type}:${Math.round(this.time * 100)}`, def, p.x + dx, p.y); return this.mobs.mobs.length; },
      foes: () => this.mobs.mobs.filter(m => m.key.startsWith('fx-ash:')).length,
      swings: () => this.mobs.swings,
      state: () => ({ vocation: this.mobs.vocation, range: this.mobs.range, hp: this.hp, maxHp: this.maxHp, mana: Math.round(this.mobs.mana), maxMana: this.mobs.maxMana, defense: this.mobs.defense, brand: this.mobs.brandT > 0, block: this.mobs.blockT > 0, vow: this.mobs.vowT > 0, swing: this.mobs.weaponSwing }),
    };
    if (this.fxSexton) (window as unknown as Record<string, unknown>)['__tdSexton'] = {
      to: (where: string) => this.fxToSexton(where),
      smite: (what: 'walker' | 'uncounted') => this.fxSmite(what),
      // What Lumvesh would point at for the chain now (the target, its words and Glim's reading), without casting it.
      seek: () => {
        const here = this.seekPlace(this.world.continent, this.level === this.world ? null : this.level.id, this.player.x, this.player.y);
        const t = this.seekTargets().find(x => x.kind === 'story');
        return t ? { id: t.id, name: t.name, ...seekReading(here, t.place) } : null;
      },
      state: () => ({ step: this.sexton.step, level: this.level.id, near: this.nearby?.station.id ?? null, mobs: this.mobs.mobs.map(m => m.key), phase: this.phaseNow }),
    };
    // The Lanternwright's e2e (webdriver only): a creature at the Keeper's side (at his level or its own, the lower: no
    // level gap in the way of the spells it tests), a wound to mend, the lantern's count.
    if (typeof navigator !== 'undefined' && navigator.webdriver) (window as unknown as Record<string, unknown>)['__tdLamp'] = {
      // At dx east of the Keeper — or, when a wall stands there or between (walls stop sight and flares since td-sight),
      // the first open spot the same distance off that he can see (as __tdThorn's): a creature he cannot see he cannot fell.
      foe: (type = 'bone-walker', dx = 40) => {
        const def = MOBS[type] && atZoneLevel(MOBS[type], Math.min(MOBS[type].level, this.mobs.keeperLevel)); if (!def) return null;
        const p = this.player, d = Math.abs(dx) || 1;
        const tries: [number, number][] = [[dx, 0], [-dx, 0], [0, d], [0, -d], [d * .7, d * .7], [-d * .7, d * .7], [d * .7, -d * .7], [-d * .7, -d * .7]];
        const at = tries.find(([x, y]) => footFree(this.level, p.x + x, p.y + y) && this.petSees(p.x, p.y, p.x + x, p.y + y) && this.mobs.sees({ x: p.x + x, y: p.y + y })) ?? [dx, 0];
        this.mobs.place(`fx-lamp:${type}:${Math.round(this.time * 100)}:${this.mobs.mobs.length}`, def, p.x + at[0], p.y + at[1]);
        return this.mobs.mobs.length;
      },
      foes: () => this.mobs.mobs.filter(m => m.key.startsWith('fx-lamp:')).length,
      calm: () => { for (const m of this.mobs.mobs) if (m.key.startsWith('fx-lamp:')) { m.def = { ...m.def, sight: 0, dmg: [0, 0] }; m.wait = 1e9; } },
      wound: (n: number) => { this.hp = Math.max(1, this.hp - n); return this.hp; },
      state: () => ({
        vocation: this.mobs.vocation, range: this.mobs.range, hp: this.hp, maxHp: this.maxHp, mana: Math.round(this.mobs.mana), maxMana: this.mobs.maxMana,
        light: this.mobs.lightBonus, shuttered: this.mobs.shuttered, flares: this.mobs.flares, wisps: this.mobs.wisps.length, beacons: this.mobs.beacons.length,
        ward: this.mobs.lampWard, dawns: this.mobs.dawns.length, hearth: this.mobs.zones.filter(z => z.kind === 'hearth').length, phase: this.mobs.phase,
      }),
    };
    // The Thornstrider's e2e (webdriver only): a creature to shoot, the bow's and the beasts' counts.
    if (typeof navigator !== 'undefined' && navigator.webdriver) (window as unknown as Record<string, unknown>)['__tdThorn'] = {
      // At (dx, dy) from the Keeper — or, if a wall or a fence stands there or between, the first open spot the same
      // distance off that he (and his beast) can see straight to.
      foe: (type = 'ash-wolf', dx = 70, dy = 0) => {
        const def = MOBS[type]; if (!def) return null;
        const p = this.player, d = Math.hypot(dx, dy) || 1;
        const tries: [number, number][] = [[dx, dy], [-dx, -dy], [-dy, dx], [dy, -dx], [d * .7, d * .7], [-d * .7, d * .7], [d * .7, -d * .7], [-d * .7, -d * .7]];
        const at = tries.find(([x, y]) => footFree(this.level, p.x + x, p.y + y) && this.petSees(p.x, p.y, p.x + x, p.y + y)) ?? [dx, dy];
        this.mobs.place(`fx-thorn:${type}:${Math.round(this.time * 100)}:${this.mobs.mobs.length}`, def, p.x + at[0], p.y + at[1]);
        return this.mobs.mobs.length;
      },
      foes: () => this.mobs.mobs.filter(m => m.key.startsWith('fx-thorn:')).length,
      calm: () => { for (const m of this.mobs.mobs) if (m.key.startsWith('fx-thorn:')) { m.def = { ...m.def, sight: 0, dmg: [0, 0] }; m.wait = 1e9; } },
      tough: (hp = 4000) => { for (const m of this.mobs.mobs) if (m.key.startsWith('fx-thorn:')) { m.def = { ...m.def, hp }; m.hp = hp; } },
      target: () => { const f = this.mobs.mobs.find(m => m.key.startsWith('fx-thorn:')); this.mobs.target = f ?? null; return !!f; },
      // The nearest open meadow (a 13 × 9 block of walkable grass): the Keeper and his beast stand in the middle of it.
      clearing: () => {
        if (this.level !== this.world) return false;
        const pc = Math.floor(this.player.x / TILE), pr = Math.floor(this.player.y / TILE);
        const open = (c: number, r: number) => { for (let y = -4; y <= 4; y++) for (let x = -6; x <= 6; x++) { if (!this.level.walkable(c + x, r + y) || this.level.ground(c + x, r + y) !== 'grass') return false; } return true; };
        for (let d = 0; d <= 48; d++) for (let y = -d; y <= d; y++) for (let x = -d; x <= d; x++) {
          if (Math.max(Math.abs(x), Math.abs(y)) !== d || !open(pc + x, pr + y)) continue;
          this.player.x = (pc + x) * TILE + TILE / 2; this.player.y = (pr + y) * TILE + TILE - 2; this.player.dir = 'down'; this.path = [];
          this.placeCompanions();
          return true;
        }
        return false;
      },
      state: () => {
        const pb = this.pet;
        return {
          vocation: this.mobs.vocation, range: this.mobs.range, hp: this.hp, maxHp: this.maxHp, mana: Math.round(this.mobs.mana), maxMana: this.mobs.maxMana,
          speed: Math.round(this.walkSpeed * 10) / 10, loosed: this.mobs.loosed, arrows: this.mobs.arrows.length, phase: this.mobs.phase,
          pet: pb ? { id: pb.id, spirit: !!pb.spirit, doing: pb.doing, hits: pb.hits, x: Math.round(pb.x), y: Math.round(pb.y) } : null,
          commanded: !!this.mobs.commanded, commands: this.mobs.commands, bonded: this.mobs.bonded,
          called: this.mobs.beasts.filter(b => b.kind === 'called').length, stampede: this.mobs.beasts.filter(b => b.kind === 'stampede').length,
          snares: this.mobs.zones.filter(z => z.kind === 'snare').length, traps: this.mobs.zones.filter(z => z.kind === 'trap').length,
          rooted: this.mobs.mobs.filter(m => (m.rootT ?? 0) > 0).length, bleeding: this.mobs.mobs.filter(m => (m.bleedT ?? 0) > 0).length,
          rootwalk: this.mobs.rootwalkT > 0, foeHp: this.mobs.mobs.filter(m => m.key.startsWith('fx-thorn:')).map(m => m.hp),
        };
      },
    };
    // The Waygate specs (td-waygate.ts; only under an automated browser): cast it through the real spell, step off and
    // onto its ends, read where the Keeper stands.
    if (typeof navigator !== 'undefined' && navigator.webdriver) (window as unknown as Record<string, unknown>)['__tdWaygate'] = {
      cast: () => this.useAbility('waygate'),
      /** The scroll's way in (no mana, no cooldown): the same portal and the same refusals. */
      read: () => this.openWaygate(),
      where: () => ({ ...this.whereabouts, inTown: this.level === this.world && this.world.inSettlement(Math.floor(this.player.x / TILE), Math.floor(this.player.y / TILE)) }),
      gate: () => (this.gates.own ? { from: { ...this.gates.own.from }, town: { ...this.gates.own.town }, left: Math.ceil(waygateLeft(this.gates.own, this.time)) } : null),
      trips: () => this.gates.trips,
      /** Walk the Keeper `px` south (and `dx` east) of where he stands (on open ground), as a step off the portal would. */
      stepOff: (px = 24, dx = 0) => { const at = standNear(this.level, this.player.x + dx, this.player.y + px); this.player.x = at.x; this.player.y = at.y; this.path = []; this.player.dir = 'down'; return { x: at.x, y: at.y }; },
      /** Stand on an end of the Keeper's own portal (the next frame takes him through when it is armed). */
      stepOn: (side: 'from' | 'town') => { const g = this.gates.own; if (!g) return false; const e = g[side], here = this.whereabouts; if (e.continent !== here.continent || e.level !== here.level) return false; this.player.x = e.x; this.player.y = e.y; this.path = []; return true; },
      /** Go out of town: the nearest open ground at least `tiles` from every settlement (a field to open a portal in). */
      field: (tiles = 6) => this.fxField(tiles),
      /** Age the portal by `secs` (its lifetime, without waiting five minutes). */
      age: (secs: number) => { if (this.gates.own) this.gates.own.opened -= Math.max(0, secs); },
    };
    if (this.fxFall) (window as unknown as Record<string, unknown>)['__tdHearth'] = {
      fall: () => this.hurt(this.hp + 1e6),
      at: (what: 'hearth' | 'shrine' = 'hearth') => this.fxStandAt(what),
      hearths: () => this.hearths.map(h => h.id),
    };
    // `?fxworn=1` (automated browsers only): `window.__wornLineup` paints a sheet of Keepers wearing given items (the
    // worn-look screenshots, e2e/td-worn-shots.spec.ts). Loaded on demand, never in a player's bundle path.
    if (typeof navigator !== 'undefined' && navigator.webdriver && /[?&]fxworn=1\b/.test(location.search)) {
      void import('../../shared/keeper-look/worn-lineup').then(m => { (window as unknown as Record<string, unknown>)['__wornLineup'] = m.wornLineup; });
    }
    if (this.fxPeer) (window as unknown as Record<string, unknown>)['__tdPeer'] = {
      // The Keeper walks up to the first task giver here, and a Keeper named `name` stands `dx` px to the giver's right.
      lay: (name = 'Wick', dx = 14, worn = '') => {
        const g = this.level.stalls.find(s => s.keeper && s.station.id.startsWith('giver-'));
        if (!g?.keeper) return null;
        this.player.x = g.keeper.x - 70; this.player.y = g.keeper.y + 8; this.path = [];
        this.peers.pinned.length = 0;
        this.peers.pinnedWorn.set(`fx-${name}`, worn);
        this.peers.pinned.push({ id: `fx-${name}`, name, x: g.keeper.x + dx, y: g.keeper.y + 8, face: -1, dir: 'down', moving: false, vocation: 'warlock', level: 7, look: '', area: this.peerArea() });
        return { giver: g.keeper.name, gx: g.keeper.x, gy: g.keeper.y };
      },
      shown: () => this.peersOnScreen(),
      /** Where on the page a point `dx` px right of the Keeper's middle (world px) is. */
      page: (name: string, dx: number) => {
        const p = this.peers.drawn.find(q => q.name === name); if (!p) return null;
        const r = this.canvas.getBoundingClientRect(), k = Math.max(1, this.canvas.width) / Math.max(1, r.width);
        return { x: Math.round(r.left + (p.x + dx - this.cam.x) * this.scale / k), y: Math.round(r.top + (p.y - 16 - this.cam.y) * this.scale / k) };
      },
    };
    if (this.fxParty) (window as unknown as Record<string, unknown>)['__tdParty'] = {
      // A Rivet Maw laid beside the Keeper and felled at once, through the real kill (onKill: XP, the party's share).
      smite: (type = 'rivet-maw', dx = 24) => {
        const def = MOBS[type]; if (!def) return null;
        const p = this.player, m = this.mobs.place(`fx-party:${type}:${Math.round(this.time * 100)}:${this.mobs.mobs.length}`, def, p.x + dx, p.y);
        this.mobs.smite(m);
        return m.def.id;
      },
      hurt: (n: number) => { this.hp = Math.max(1, this.hp - n); this.lastHurt = this.time; },
      // The corpses lying here (stage, loot in them), and a jump forward in their clock (the decay timeline in a second).
      corpses: () => {
        const r = this.canvas.getBoundingClientRect(), k = Math.max(1, this.canvas.width) / Math.max(1, r.width);
        return this.mobs.remains.map(c => ({
          id: c.id, kind: c.kind.id, stage: corpseStage(this.mobs.age - c.born, c.boss), loot: this.mobs.corpseLoot(c.id).length, x: Math.round(c.x), y: Math.round(c.y),
          px: Math.round(r.left + (c.x - this.cam.x) * this.scale / k), py: Math.round(r.top + (c.y - 6 - this.cam.y) * this.scale / k), scale: this.scale / k,
        }));
      },
      // A heap of ember residue laid in the nearest corpse (the loot a walk-over would not reach).
      stock: () => { const c = this.mobs.remains[this.mobs.remains.length - 1]; if (!c) return false; this.mobs.drops.push({ id: `fx-stock:${this.mobs.drops.length}`, x: c.x + 8, y: c.y + 2, coins: 0, material: 'ember-residue', qty: 2, label: 'ember residue', color: '#c8c0b0', age: 1, corpse: c.id }); return true; },
      age: (secs: number) => { for (const c of this.mobs.remains) c.born -= secs; return this.mobs.remains.length; },
      openNearest: () => { const c = this.mobs.corpseNear(this.player.x, this.player.y, 400); return c ? this.openCorpse(c.id) : false; },
    };
    if (this.fxCoop) (window as unknown as Record<string, unknown>)['__tdCoop'] = {
      view: () => this.coop.view(),
      stats: () => ({ ...this.coop.stats }),
      // No wild spawns from now on, and none standing: only what the spec lays (a calm stage for comparing screens).
      quiet: () => { this.fxCoopQuiet = true; if (this.coop.role !== 'member') { this.mobs.mobs.length = 0; this.mobs.target = null; } return true; },
      // A calm creature `dx, dy` from the Keeper (the host's), given its wire id at once.
      lay: (type = 'ash-wolf', dx = 40, dy = 0, calm = true) => {
        const def = MOBS[type]; if (!def || this.coop.role === 'member') return null;
        const p = this.player, m = this.mobs.place(`fx-coop:${type}:${Math.round(this.time * 100)}:${this.mobs.mobs.length}`, calm ? { ...def, sight: 0 } : def, p.x + dx, p.y + dy);
        if (calm) m.wait = 1e9;
        return this.coop.name(m);
      },
      // A blow of `n` on the creature with this wire id, through the real path (a member's becomes a claim).
      hit: (id: string, n: number) => { const m = this.mobs.mobs.find(x => x.nid === id); if (!m) return false; this.mobs.wound(m, n); return true; },
      // Point the Keeper's own attack at it (its staff, its blade): the real auto-attack path.
      target: (id: string) => { const m = this.mobs.mobs.find(x => x.nid === id); this.mobs.target = m ?? null; return !!m; },
      hp: () => Math.round(this.hp),
      // Companions: the other Keepers' drawn here, this Keeper's own as sent, and `n` raised skeletons at his side.
      pals: () => this.palsShown(),
      mine: () => this.myPals(),
      raise: (n = 2) => { for (let i = 0; i < n; i++) this.mobs.minions.push({ id: 9000 + i, x: this.player.x + (i ? -16 : 16), y: this.player.y + 6, hp: 40, maxHp: 40, dmg: [3, 5], cd: .6, t: 1, face: 1, life: Infinity, hit: 0, target: null }); return this.mobs.minions.length; },
      // Protocol 7: the room's ground as this screen holds it, and a walk onto one piece of it (the real pick path).
      ground: () => this.mobs.drops.filter(d => d.room).map(d => ({ id: d.id, x: Math.round(d.x), y: Math.round(d.y), coins: d.coins, label: d.label, hold: Math.round((d.room?.hold ?? 0) * 10) / 10, corpse: d.corpse ?? '' })),
      walkTo: (id: string) => { const g = this.mobs.drops.find(d => d.id === id); if (!g) return false; this.player.x = g.x; this.player.y = g.y; return true; },
      // Protocol 10: cast a skill through the real path (a status it lays on a room creature is claimed), the life the
      // room keeps as this screen mirrors it, and harm the room did not deal (claimed as such).
      cast: (id: string) => this.mobs.useAbility(id as SkillId),
      life: () => this.lifeView(),
      harm: (n: number) => { this.hurt(n); return Math.round(this.hp); },
    };
  }

  // ── Lifecycle (the component's contract) ───────────────────────────────────

  start(): void {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now: number) => {
      // rAF stamps the frame's start, which can precede the performance.now() taken in start(): never step backwards.
      const dt = Math.max(0, Math.min(.05, (now - this.last) / 1000));
      this.watchFrames(now - this.last);
      this.last = now; this.frameAt = performance.now(); this.frameDt = this.paused ? 0 : dt;
      // Schedule first: one bad frame (a host callback throwing) must never stop the world.
      this.raf = requestAnimationFrame(loop);
      try {
        const t0 = this.perf ? performance.now() : 0;
        if (!this.paused && !this.fxFrozen) this.update(dt);
        // A host in a menu still keeps the party's creatures alive for the others (they are not paused); it is no prey meanwhile.
        else if (this.paused && !this.fxFrozen && this.coop.role === 'host') this.updateShared(dt);
        const t1 = this.perf ? performance.now() : 0;
        this.bakeMs = 0;
        this.draw();
        const gv = this.groundView;
        if (gv) this.prefetchGround(gv[0], gv[1], gv[2], gv[3]);
        if (this.perf) { const t2 = performance.now(); this.perf.push([t1 - t0, t2 - t1, this.bakeMs]); if (this.perf.length > 4000) this.perf.splice(0, 2000); }
      } catch (err) {
        if (!this.frameError) { this.frameError = true; console.error('[top-down] frame error', err); }
      }
    };
    this.raf = requestAnimationFrame(loop);
    // Never pause (owner 2026-10-26): a hidden or switched-away tab gets no animation frames at all, so the world keeps
    // running on a timer instead — creatures, regen, the companions, the room's presence. Browsers fire it about once a
    // second in a hidden tab (once a minute after five minutes); each tick steps the time missed, in frame-sized steps,
    // without drawing. A tab in view never takes this path (its frames are recent).
    this.frameAt = performance.now();
    this.bgTimer = setInterval(() => this.stepHidden(), BG_TICK_MS);
  }
  /** Environment detail changed (Menu → Settings, or measured slow frames): the ground is baked again in the new look. */
  private readonly offDetail = onEnvDetail(() => { this.chunks.clear(); });
  /**
   * Measured slow frames (td-detail autoLowerDetail): with no choice made, a device whose frames average over 22 ms
   * (under 45 a second) across four seconds, after the first eight while the world settles, drops to Low for the
   * session. Never in an automated browser (a loaded test machine is not a weak phone) unless `__tdAutoDetail` is set.
   */
  private slowWatch = { t: 0, n: 0, sum: 0, done: false };
  private watchFrames(dtMs: number): void {
    const w = this.slowWatch;
    if (w.done || document.hidden) return;
    if (underTest()) { w.done = true; return; }
    w.t += dtMs;
    if (w.t < 8000) return;
    w.n++; w.sum += dtMs;
    if (w.t < 12000) return;
    if (w.sum / w.n > 22) autoLowerDetail();
    w.done = true;
  }
  /** Frame work (webdriver only, e2e/td-perf-phone.spec.ts): [update ms, draw ms, of which ground baking ms] per frame. */
  private readonly perf: [number, number, number][] | null = typeof navigator !== 'undefined' && navigator.webdriver ? [] : null;
  private bakeMs = 0;
  /** When the last animation frame ran (performance.now ms), and the hidden-tab timer (start()). */
  private frameAt = 0;
  private bgTimer: ReturnType<typeof setInterval> | null = null;
  /** True while stepHidden catches the world up (one HUD report at the end, not one per tenth of a second). */
  private catchingUp = false;
  private stepHidden(): void {
    if (!this.raf) return;
    const now = performance.now();
    if (now - this.frameAt < BG_TICK_MS) return;
    let left = Math.max(0, Math.min(BG_CATCHUP_SECS, (now - this.last) / 1000));
    this.last = now;
    this.catchingUp = true;
    try {
      while (left > 1e-4) {
        const dt = Math.min(.05, left); left -= dt;
        if (!this.paused && !this.fxFrozen) this.update(dt);
        else if (this.paused && !this.fxFrozen && this.coop.role === 'host') this.updateShared(dt);
      }
    } catch (err) {
      if (!this.frameError) { this.frameError = true; console.error('[top-down] hidden step error', err); }
    } finally { this.catchingUp = false; }
    this.report();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.offDetail();
    if (this.bgTimer) { clearInterval(this.bgTimer); this.bgTimer = null; }
    if (this.fxFall) delete (window as unknown as Record<string, unknown>)['__tdHearth'];
    delete (window as unknown as Record<string, unknown>)['__tdWaygate'];
    delete (window as unknown as Record<string, unknown>)['__tdGather'];
    if (this.fxParty) delete (window as unknown as Record<string, unknown>)['__tdParty'];
    if (this.fxPeer) delete (window as unknown as Record<string, unknown>)['__tdPeer'];
    if (this.fxCoop) delete (window as unknown as Record<string, unknown>)['__tdCoop'];
    delete (window as unknown as Record<string, unknown>)['__tdDark'];
    delete (window as unknown as Record<string, unknown>)['__tdAsh'];
    delete (window as unknown as Record<string, unknown>)['__tdSexton'];
    delete (window as unknown as Record<string, unknown>)['__tdLamp'];
    delete (window as unknown as Record<string, unknown>)['__tdThorn'];
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
  setSky(sky: { light: number; glow: number; eclipse: number; phase?: SkyPhase }): void {
    if (this.pinned !== null) return;
    this.skyPhase = sky.phase ?? 'day';
    this.eclipseDepth = sky.eclipse;
    this.darkness = Math.max(0, Math.min(1, 1 - sky.light));
    this.dusk = sky.glow;
  }
  /**
   * The weather's clock (shared/weather): the host's world-clock ms, and the room's rolls while a Keeper is in its world
   * (the room owns the roll; alone, the rolls come from this clock). Called once a second.
   */
  setWeatherClock(input: { ms: number; rolls?: { window: number; lands: Readonly<Record<string, number>> } | null }): void {
    this.weatherIn = { ms: input.ms, at: this.time, rolls: input.rolls ?? null };
    if (!this.weatherT) this.stepWeather();
  }
  /** Menu → Settings → Weather: full, soft (no streaks, no flashes) or off (the pip only; the rules stay). */
  setWeatherShow(show: WeatherShow): void { this.weatherFx.show = show; }
  /** What the HUD's pip shows. */
  weatherView(): WeatherNow { return this.weatherFx.now; }
  private stepWeather(): void {
    const k = this.player, outdoors = this.level === this.world;
    let now: WeatherNow;
    if (this.weatherPin) now = { state: outdoors ? this.weatherPin : 'clear', level: outdoors ? 1 : 0, window: 0, next: this.weatherPin, leftMs: 360_000 };
    else if (!this.weatherIn) now = { state: 'clear', level: 0, window: 0, next: 'clear', leftMs: 0 };
    else {
      const ms = this.weatherIn.ms + (this.time - this.weatherIn.at) * 1000;
      const region = outdoors ? this.world.regionAt(Math.floor(k.x / TILE), Math.floor(k.y / TILE)) : '*';
      now = weatherAt({ land: this.world.continent, region, ms, rolls: this.weatherIn.rolls, indoors: !outdoors });
    }
    this.weatherFx.now = now;
    const tag = `${now.state}:${now.level.toFixed(1)}`;
    if (tag !== this.weatherSeen) { this.weatherSeen = tag; this.canvas.setAttribute('data-weather', tag); }
  }
  /** Rain on the Keeper now (outdoors, the sky wet). */
  private get rainedOn(): boolean { return this.level === this.world && isWet(this.weatherFx.now.state) && this.weatherFx.now.level > .3; }

  // ── Gathering (td-gather.ts; the host answers through onGather) ──────────

  /** Something to gather in reach: a fire, a fishing spot, a tree (E works on it). */
  private gatherNear(): boolean { return !!(this.gather.fireNear(this.player.x, this.player.y, 34) || this.spotNear() || this.treeNear()); }

  private gatherId(kind: string): string { return `td-${kind}:${Date.now().toString(36)}:${(++this.gatherSeq).toString(36)}`; }
  private tell(text: string | undefined): void { if (text) { this.message = text; this.messageKey = ''; this.messageAge = 0; } }
  /** The spot whose float is under a point (art px), if any is in view. */
  private spotAt(wx: number, wy: number): FishSpot | null {
    if (this.level !== this.world) return null;
    let best: FishSpot | null = null, bd = 14;
    for (const sp of this.world.spotsIn(wx - 24, wy - 24, wx + 24, wy + 24)) { const d = Math.hypot(sp.x - wx, sp.y - wy); if (d < bd) { bd = d; best = sp; } }
    return best;
  }
  /** The spot within casting reach of the Keeper. */
  private spotNear(): FishSpot | null {
    if (this.level !== this.world) return null;
    const k = this.player;
    let best: FishSpot | null = null, bd = FISH_REACH;
    for (const sp of this.world.spotsIn(k.x - 40, k.y - 40, k.x + 40, k.y + 40)) { const d = Math.hypot(sp.x - k.x, sp.y - (k.y - 6)); if (d < bd) { bd = d; best = sp; } }
    return best;
  }
  /** Cast at a spot: the host says whether (Fishing level, a rod, the room in the satchel) and how fast they bite. */
  private beginFish(sp: FishSpot): void {
    const a = this.options.onGather?.({ kind: 'fish', phase: 'start', water: sp.water, spot: sp.id, mutationId: this.gatherId('fish'), weather: this.weatherFx.now.state });
    if (!a) return;
    if (!a.ok) { this.tell(a.text); return; }
    this.chop = null;
    // Face the water: south, north, or to the side.
    const dx = sp.x - this.player.x, dy = sp.y - (this.player.y - 6);
    this.player.face = dx < 0 ? -1 : 1;
    this.player.dir = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? 'down' : 'up') : 'side';
    this.gather.startFish(sp, a.speed ?? 1, this.player, Math.random);
    this.tell(a.text);
    this.options.onSfx?.({ kind: 'cast' });
  }
  /** A lit fire (or a lit hearth: a range) in reach of a point. */
  private cookSourceNear(x: number, y: number): { fire: Campfire | null; x: number; y: number; range: boolean } | null {
    const f = this.gather.fireNear(x, y, 34);
    if (f) return { fire: f, x: f.x, y: f.y, range: false };
    if (this.level === this.world) for (const h of this.hearths) if (this.hearthLit.has(h.id) && Math.hypot(h.x - x, h.y - y) < 48) return { fire: null, x: h.x, y: h.y, range: true };
    return null;
  }
  private beginCook(src: { fire: Campfire | null; x: number; y: number; range: boolean }): void {
    const a = this.options.onGather?.({ kind: 'cook', phase: 'start', range: src.range, mutationId: this.gatherId('cook') });
    if (!a) return;
    if (!a.ok) { this.tell(a.text); return; }
    this.chop = null;
    this.player.face = src.x < this.player.x ? -1 : 1;
    this.gather.startCook(src.fire, src.x, src.y, src.range, this.player);
    this.tell(a.text);
  }
  /** Cook at the fire (or the lit hearth) in reach: the satchel card's Cook. Why not, or null. */
  startCooking(): 'nofire' | null {
    const src = this.cookSourceNear(this.player.x, this.player.y);
    if (!src) return 'nofire';
    this.beginCook(src);
    return null;
  }
  /** Strike a light with this log at the Keeper's feet (the satchel card's Light). Why not, or null. */
  lightFire(log: string): 'water' | 'busy' | null {
    const k = this.player;
    if (this.gather.strike) return 'busy';
    const c = Math.floor(k.x / TILE), r = Math.floor((k.y - 1) / TILE), g = this.level.ground(c, r);
    if (g === 'water' || g === 'blackwater' || !this.level.walkable(c, r)) return 'water';
    this.chop = null;
    this.gather.startStrike(log, k.x, k.y);
    this.actT = .3;
    return null;
  }
  /** A meal eaten from the satchel: it mends `heal` life over twelve seconds (a new one replaces the old). */
  eat(heal: number): void { this.gather.eat(heal); }
  private updateGather(dt: number): void {
    this.gather.lv = this.level.id;
    const out = this.gather.update(dt, this.time, this.player, this.rainedOn);
    if (out.heal > 0) this.hp = Math.min(this.maxHp, this.hp + out.heal);
    const f = this.gather.fish;
    if (out.bite && f) {
      this.options.onSfx?.({ kind: 'bite' });
      const a = this.options.onGather?.({ kind: 'fish', phase: 'bite', water: f.spot.water, spot: f.spot.id, mutationId: this.gatherId('fish'), weather: this.weatherFx.now.state });
      if (!a?.ok) { this.gather.fish = null; this.tell(a?.text); }
      else {
        this.mobs.floaters.push({ x: this.player.x, y: this.player.y - 34, text: a.label ?? '', color: '#bfe6ff', age: 0 });
        this.options.onSfx?.({ kind: 'catch' });
        this.gather.rearm(a.speed ?? f.speed, Math.random);
      }
    }
    const ck = this.gather.cook;
    if (out.cooked && ck) {
      const a = this.options.onGather?.({ kind: 'cook', phase: 'one', range: ck.range, mutationId: this.gatherId('cook') });
      if (!a?.ok) { this.gather.cook = null; this.tell(a?.text); }
      else { this.mobs.floaters.push({ x: this.player.x, y: this.player.y - 34, text: a.label ?? '', color: a.burnt ? '#9a948a' : '#ffd08a', age: 0 }); ck.n++; }
    }
    if (out.lit) {
      const s = out.lit;
      const a = this.options.onGather?.({ kind: 'fire', phase: 'lit', log: s.log, mutationId: this.gatherId('fire') });
      if (a?.ok) {
        this.gather.lightFire(s.x, s.y - 2, s.log, fireSecs(this.level === this.world ? this.weatherFx.now.state : 'clear'), this.level.id);
        this.mobs.chips(s.x, s.y - 6);
        // Step aside of the fire, RuneScape's way (west if the ground lets him, else east).
        for (const dx of [-14, 14]) if (footFree(this.level, this.player.x + dx, this.player.y)) { this.walkTo(this.player.x + dx, this.player.y); break; }
      }
      this.tell(a?.text);
    }
    // The fish under the water: their jumps (a jump at the spot being fished brings its bite two seconds sooner).
    if (this.level === this.world && this.spotsInView.length) {
      const sky = { dark: this.skyPhase === 'night' || this.skyPhase === 'eclipse', eclipse: this.skyPhase === 'eclipse' };
      this.gather.stepJumps(this.spotsInView, this.time, sky, () => this.options.onSfx?.({ kind: 'splash' }));
    }
    const tag = `${f ? `fishing:${f.n}` : ck ? `cooking:${ck.n}` : this.gather.strike ? 'striking' : ''}|${this.gather.fires.length}|${this.gather.shadowsDrawn}`;
    if (tag !== this.gatherSeen) {
      this.gatherSeen = tag;
      const [act, fires, shadows] = tag.split('|');
      this.canvas.setAttribute('data-gather', act); this.canvas.setAttribute('data-fires', fires); this.canvas.setAttribute('data-fish-shadows', shadows);
    }
  }

  /** Night darkness (Menu → Sound): 'full' or 'softer' (td-night.ts). */
  setNight(n: string): void { if (n === 'full' || n === 'softer') this.nightSetting = n; }
  setKeeperLook(look: KeeperLook | null, gear: KeeperGear | null = null): void {
    const l = look ?? defaultLook();
    // The Warlock is undead (owner, 2026-10-20): grey-green skin, a dark violet robe with bone trim, a hood, eyes that
    // burn violet. Worn gear still shows over it; the hood stands in only when no head piece is worn.
    const v = vocationLook(l.vocation, gear);
    this.player.painter = new KeeperPainter(l, v.gear, v.garb);
    // The class decides the basic attack (the staff's bolt or the Ashguard's blade) and the body's share of life.
    if (l.vocation !== this.mobs.vocation) { this.mobs.vocation = l.vocation; this.buildKey = ''; this.bar = defaultBar(l.vocation); }
  }
  /** Ash Stride: the Keeper is carried along the line toward (x, y), stopping at the last open step. */
  private dashTo(x: number, y: number): void {
    const p = this.player, d = Math.hypot(x - p.x, y - p.y), n = Math.max(1, Math.ceil(d / 4));
    let ok = { x: p.x, y: p.y };
    for (let i = 1; i <= n; i++) {
      const qx = p.x + (x - p.x) * i / n, qy = p.y + (y - p.y) * i / n;
      if (!this.level.walkable(Math.floor(qx / TILE), Math.floor(qy / TILE))) break;
      ok = { x: qx, y: qy };
    }
    p.x = ok.x; p.y = ok.y; this.path = []; this.arrive = null;
  }
  /** The key bindings the world's keys follow (shared/keys/keymap.model; the HUD hands over the player's). */
  private binds: Bindings = defaultBindings();
  /** Name plates over Keepers and passers-by (the Plates key toggles them; the HUD keeps the choice). */
  private platesOn = true;
  setPlates(on: boolean): void { this.platesOn = on; }
  /**
   * The Target key: the next creature in reach after the one targeted, nearest first (wrapping round); none in reach
   * clears the target. True when something is targeted.
   */
  cycleTarget(): boolean {
    const near = this.mobs.mobs.filter(m => m.hp > 0 && Math.hypot(m.x - this.player.x, m.y - this.player.y) <= 240)
      .sort((a, b) => Math.hypot(a.x - this.player.x, a.y - this.player.y) - Math.hypot(b.x - this.player.x, b.y - this.player.y));
    if (!near.length) { this.mobs.target = null; return false; }
    const at = this.mobs.target ? near.indexOf(this.mobs.target) : -1;
    this.mobs.target = near[(at + 1) % near.length]; this.chaseTimer = 0;
    return true;
  }
  setBindings(b: Bindings): void { this.binds = b; }
  setInput(action: EngineInput, pressed: boolean): void {
    // The side view's on-screen buttons: left/right walk, down walks south, jump walks north.
    if (action === 'attack') { this.mobs.attacking = pressed; return; }
    const key = action === 'left' ? 'left' : action === 'right' ? 'right' : action === 'down' ? 'down' : action === 'jump' ? 'up' : '';
    if (!key) return;
    if (pressed) { this.keys.add(key); this.path = []; } else this.keys.delete(key);
  }
  interact(): void {
    // A corpse with loot in reach beats a stall that is farther than it (the nearest thing wins).
    const cp = this.mobs.corpseNear(this.player.x, this.player.y);
    if (cp && (!this.nearby || Math.hypot(cp.x - this.player.x, cp.y - this.player.y) < Math.hypot(this.nearby.x - this.player.x, this.nearby.y - this.player.y))) { this.openCorpse(cp.id); return; }
    if (this.nearby) { this.use(this.nearby); return; }
    // The gathering skills: a fire in reach (cook), a fishing spot in reach (cast), then a tree (chop).
    const src = this.cookSourceNear(this.player.x, this.player.y);
    if (src?.fire) { this.beginCook(src); return; }
    const sp = this.spotNear();
    if (sp) { this.beginFish(sp); return; }
    const t = this.treeNear();
    if (t) this.startChop(t.c, t.r, t.x, t.y);
  }
  /** The skills on keys 1–4 (the Spellbook assigns them). */
  private bar: SkillId[] = defaultBar('warlock');
  /** Use a skill on the bar (by id, or by slot '1'–'4'). Returns why not, or null when it went off. */
  useAbility(idOrSlot: string): ReturnType<MobSystem['useAbility']> {
    const id = /^[1-8]$/.test(idOrSlot) ? this.bar[Number(idOrSlot) - 1] : idOrSlot as SkillId;
    if (!id) return null;
    if (this.paused) return 'cooldown';
    const why = this.mobs.useAbility(id);
    // It went off: the Keeper speaks its words, a pixel line over the head in the tree's tone (effects-spec palettes).
    const sk = SKILLS[id];
    if (!why && sk?.words) this.cant = { text: sk.words, color: CANT_TONE[sk.tree], age: 0 };
    return why;
  }
  /** A Spellstone (shared/spellstones; the host spends the charge): the spell at the stone's rank with ITS marks, no mana. */
  castStone(id: string, rank: number, marks = 0): ReturnType<MobSystem['useAbility']> {
    if (this.paused || !(id in SKILLS)) return 'cooldown';
    const why = this.mobs.useStone(id as SkillId, rank, marks);
    const sk = SKILLS[id as SkillId];
    if (!why && sk.words) this.cant = { text: sk.words, color: CANT_TONE[sk.tree], age: 0 };
    return why;
  }
  /** The bar for the HUD: each slot's skill, cooldown left (0–1), and whether there is mana for it. */
  get abilities(): readonly { id: string; key: string; left: number; mana: number; ready: boolean }[] {
    return this.bar.map((id, i) => ({ id, key: String(i + 1), left: SKILLS[id].cd ? Math.min(1, (this.mobs.cooldowns[id] ?? 0) * (1 + this.mobs.castSpeed) / this.mobs.cdOf(id)) : 0, mana: this.mobs.manaOf(id), ready: this.mobs.mana >= this.mobs.manaOf(id) }));
  }
  get mana(): number { return this.mobs.mana; }
  get maxMana(): number { return this.mobs.maxMana; }
  get maxHealth(): number { return this.maxHp; }
  /** The Keeper's pace now, art px a second: the base, the level's pace, Agility and worn Move Speed, Haste. */
  get walkSpeed(): number {
    // Rootwalk (the Thornstrider): the forest opens in front of him while it lasts.
    const root = this.mobs.rootwalkT > 0 ? 1 + this.mobs.rootwalkPct / 100 : 1;
    // Vigor (a worn aura) quickens the feet: "You move {{n}}% faster".
    const vigor = this.mobs.itemAura?.fx.moveSpeed ?? 1;
    // The Skill Book's marks (td-mobs markPace): Walking Whirl, Dark Step, Waymark.
    // S6: stunned, frozen or rooted by a creature's ability, he does not step at all.
    if (this.mobs.held) return 0;
    return SPEED * (this.mobs.haste > 0 ? 1.5 : 1) * (1 + this.agility) * (1 + this.levelPace) * (1 - this.mobs.chill) * root * vigor * (1 + this.mobs.markPace);
  }
  private buildKey = '';
  /**
   * The Keeper's level, spent points and worn gear totals (the HUD hands them in): life, mana, regeneration, spell
   * power, speed — and from the gear (§3 affixes) cast speed, crits, Defense, resists and life back each second.
   */
  setKeeperBuild(level: number, stats: KeeperStats, gear: Partial<ItemStats> = {}): void {
    const voc = this.mobs.vocation;
    const key = `${voc}|${level}|${stats.vit},${stats.ene},${stats.spi},${stats.agi}|${GEAR_KEYS.map(k => gear[k] ?? 0).join(',')}|${this.tier}`;
    if (key === this.buildKey) return;
    this.buildKey = key;
    // The difficulty's resist penalty (Nightmare −40, Hell −100) comes off before the cap (td-skills fightStats).
    const st = fightStats(level, stats, gear, voc, DIFFICULTIES[this.tier].resistPenalty);
    this.mobs.keeperMaxHp = st.maxHp;
    this.maxHp = st.maxHp; this.hp = Math.min(this.hp, this.maxHp);
    this.mobs.maxMana = st.maxMana; this.mobs.mana = Math.min(this.mobs.mana, st.maxMana);
    this.mobs.power = st.power; this.mobs.regen = st.regen; this.mobs.agility = st.haste;
    this.mobs.castSpeed = st.castSpeed; this.mobs.crit = st.crit;
    // §3.6: Life Steal, Pierce, Block, the beast's share of the damage %, a caster's +Spells.
    this.mobs.leech = st.leech; this.mobs.gearPierce = st.pierce; this.mobs.gearBlock = st.block;
    this.mobs.damagePct = st.damagePct; this.mobs.gearRanks = st.ranks;
    this.mobs.defense = st.defense; this.mobs.keeperLevel = Math.max(1, Math.floor(level));
    this.mobs.resists = st.resists;
    this.agility = st.moveHaste;
    this.levelPace = st.levelPace;
    this.mobs.pace = 1 + st.levelPace;
    this.lifeRegen = st.lifeRegen;
  }

  get aura(): SkillId | null { return this.mobs.aura; }
  /** How many raised skeletons walk with the Keeper (the HUD's Release button shows while any do). */
  get raisedCount(): number { return this.mobs.minions.length; }
  /** Let the raised go (they last until killed or released; owner 2026-10-20). */
  releaseRaised(): number { return this.mobs.releaseMinions(); }
  /** A level gained (the HUD calls it): a column of warm light rises on the Keeper; taller and longer for a big milestone. */
  levelPillar(big = false): void {
    this.mobs.effects.push({ kind: 'pillar', x: this.player.x, y: this.player.y, age: 0, life: big ? 1.8 : 1.3, dir: big ? 2 : 1 });
  }
  get ward(): number { return this.mobs.ward; }
  /** The Spellbook's choices: the bar (up to eight actives) and the running aura (a skill at rank 0 cannot sit there). */
  setSkillLoadout(bar: readonly string[], aura: string | null): void {
    this.bar = bar.filter((id): id is SkillId => id in SKILLS && SKILLS[id as SkillId].kind === 'active' && this.mobs.rank(id as SkillId) > 0).slice(0, 8);
    this.mobs.aura = aura && aura in SKILLS && SKILLS[aura as SkillId].kind === 'aura' && this.mobs.rank(aura as SkillId) > 0 ? aura as SkillId : null;
  }
  /** The trees' ranks (td-tree effectiveRanks): every skill's numbers follow its rank; the book's marks (effectiveMarks) ride along. */
  setSkillRanks(ranks: Readonly<Record<string, number>>, bought: Readonly<Record<string, number>> | null = null, marks: Readonly<Record<string, number>> | null = null): void {
    this.mobs.setRanks(ranks as Partial<Record<SkillId, number>>, bought as Partial<Record<SkillId, number>> | null, marks as Partial<Record<SkillId, number>> | null);
  }
  get hasted(): boolean { return this.mobs.haste > 0; }
  /**
   * A drink from the potion belt (the host consumed the potion; potions.model.ts potionEffect): life and mana pour in
   * over `secs` (a gentle fill), or at once when `secs` is 0. A green sparkle rises and the amount floats up.
   */
  drinkPotion(heal: number, mana: number, secs: number, id = ''): void {
    const p = this.player;
    // Protocol 10: the room keeps the life — the potion fills it at once here and is claimed (its id: the room checks it).
    if (this.life && heal > 0) {
      this.lifeAccount();
      const before = this.hp;
      this.hp = Math.min(this.roomMax || this.maxHp, this.hp + heal);
      this.lifeMark += this.hp - before;
      this.life.claim('potion', heal, id || undefined);
      heal = 0;
    }
    this.mobs.effects.push({ kind: 'heal', x: p.x, y: p.y, age: 0, life: .7, dir: 1 });
    if (heal > 0) this.mobs.floaters.push({ x: p.x - 6, y: p.y - 36, text: `+${Math.round(heal)}`, color: '#7fe08a', age: 0 });
    if (mana > 0) this.mobs.floaters.push({ x: p.x + 6, y: p.y - 30, text: `+${Math.round(mana)}`, color: '#7fb8ff', age: 0 });
    if (secs <= 0) { this.pour(heal, mana); return; }
    this.sip = { hp: this.sip.hp + heal, mana: this.sip.mana + mana, t: secs };
  }
  private pour(heal: number, mana: number): void {
    this.hp = Math.min(this.maxHp, this.hp + heal);
    this.mobs.mana = Math.min(this.mobs.maxMana, this.mobs.mana + mana);
  }

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
    // The host says whether (Woodcutting for this land's log, room in the satchel) and how many swings it takes.
    let swings: number | undefined;
    if (this.options.onGather) {
      const a = this.options.onGather({ kind: 'chop', phase: 'start', land: this.world.continent, mutationId: this.gatherId('chop') });
      if (!a.ok) { this.tell(a.text); return; }
      swings = a.swings;
    }
    this.gather.stopAll();
    this.chop = { c, r, x, y, hits: 0, t: 0, ...(swings ? { swings } : {}) };
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
    if (ch.hits < (ch.swings ?? 4)) return;
    // Felled: the land's log (shared/gathering LOGS) through the host; a full satchel leaves the tree standing.
    if (this.options.onGather) {
      const a = this.options.onGather({ kind: 'chop', phase: 'fell', land: this.world.continent, mutationId: `td-chop:${ch.c},${ch.r}:${Date.now().toString(36)}` });
      if (a.ok) { this.world.fell(ch.c, ch.r, 90_000); this.mobs.floaters.push({ x: this.player.x, y: this.player.y - 34, text: a.label ?? '', color: '#d8c8a0', age: 0 }); }
      else this.tell(a.text);
      this.chop = null;
      return;
    }
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
    // A town task giver's spot (one standing on their own, or beside a keeper's counter): the host opens the talk.
    if (id.startsWith('giver-') && s.keeper && this.options.onTalk?.(s.keeper.id)) return;
    // The Cold Hearth: a hearth is lit by hand (the wake point); a capital's shrine sells the blessings.
    if (id.startsWith('hearth:')) { this.lightHearth(id); return; }
    // The Sexton's Count: a chalk-marked stone, the ledger page, Barrow Door 1, the forty-first grave (the host decides).
    if (id.startsWith('sexton:')) { this.useSexton(id.slice(7)); return; }
    // The mystery layer: a shy chest (only opens in the dark), a Nightroad's note.
    if (id.startsWith('shade:')) { this.openShade(id.slice(6)); return; }
    if (id.startsWith('nightnote:')) { this.readNightNote(id.slice(10)); return; }
    if (id.startsWith('shrine:')) { const h = this.hearths.find(x => x.shrine?.id === id); this.options.onShrine?.({ id, town: h?.town ?? '' }); return; }
    // Down the mine shaft: the hand-drawn Ember Mine (never the old 2D Delve).
    if (id === 'delve' && this.level === this.world) { this.enter(this.handLevel('ember-mine-1'), 'mine-up'); return; }
    // A door into a building: its ground floor.
    if (this.level === this.world && DOORS[id]) { this.enter(this.handLevel(DOORS[id].to), DOORS[id].arrive); return; }
    // A way on from the continent: a cave mouth into its hand-drawn level, a ship to another continent.
    if (this.level === this.world) {
      const way = this.world.ways.get(id);
      if (way) { if (way.ship) this.sail(way.to, way.arrive); else this.enter(this.handLevel(way.to), way.arrive); return; }
    }
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
  /**
   * The Keeper's face for the HUD portrait (owner 2026-10-20: the Top Heroes frame, docs/design/ui-pass-top-heroes.md):
   * the head and shoulders of the front sprite, as a data URL, made once per look.
   */
  heroPortrait(): string {
    const painter = this.player.painter;
    if (!painter || typeof document === 'undefined') return '';
    let url = portraits.get(painter);
    if (url) return url;
    const sheet = frontSheet(painter, true), out = document.createElement('canvas');
    // A 22-px square round the hood and face (the HUD shows it at exactly ×2).
    out.width = out.height = 22;
    out.getContext('2d')!.drawImage(sheet, 3, 1, 22, 22, 0, 0, 22, 22);
    url = out.toDataURL();
    portraits.set(painter, url);
    return url;
  }
  delveAnchors(): readonly never[] { return []; }
  hasDelveCamp(): boolean { return false; }
  readRiftMap(): boolean { return false; }
  get places(): readonly StationDef[] { return this.level.stalls.filter(s => !isBerth(s.station.id)).map(s => s.station); }
  private readonly mapImages = new Map<string, { url: string; x0: number; y0: number; w: number; h: number }>();
  /**
   * The Map window (owner 2026-10-20: "take that Places UI out, create the map and pin point the stuff"): the level the
   * Keeper is on — a hand-drawn floor whole, or the continent's whole region map — painted once from its own ground,
   * with a pin per place to go and the Keeper's mark. Positions are 0..1 across and down the picture.
   */
  mapView(section?: string): TdMapView | null {
    if (typeof document === 'undefined') return null;
    // Another section of this continent (owner's player notes 2026-10-21: "show every floor"): its own picture and
    // pins, no "you are here". An unknown id (or one on another continent) shows where the Keeper is.
    const here = this.level === this.world ? 'surface' : this.level.id;
    const want = section && section !== here && (section === 'surface' || this.levelLinks().get(section)?.continent === this.world.continent) ? section : here;
    const lv: TdLevel = want === here ? this.level : want === 'surface' ? this.world : this.handLevel(want);
    const onWorld = lv === this.world;
    const key = onWorld ? `world:${this.world.continent}` : lv.id;
    let m = this.mapImages.get(key);
    if (!m) {
      const d = this.world.def, step = onWorld ? 2 : 1;
      const box = onWorld
        ? { x0: -d.ox * BLOCK, y0: -d.oy * BLOCK, w: d.map[0].length * BLOCK, h: d.map.length * BLOCK }
        : { x0: 0, y0: 0, w: (lv as HandLevel).cols, h: (lv as HandLevel).rows };
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(box.w / step); cv.height = Math.ceil(box.h / step);
      const c = cv.getContext('2d')!;
      for (let r = 0; r < cv.height; r++) for (let q = 0; q < cv.width; q++) {
        c.fillStyle = MAP_COL[lv.ground(box.x0 + q * step, box.y0 + r * step)] ?? PAL.grass[0];
        c.fillRect(q, r, 1, 1);
      }
      // The towns' roofs, so a settlement reads as one.
      if (onWorld) for (const o of this.world.settlementObjects) {
        if (o.kind !== 'building' || !o.block) continue;
        c.fillStyle = PAL.roofRed[2];
        c.fillRect(Math.round((o.x / TILE - box.x0 - o.block.w / 2) / step), Math.round((o.y / TILE - box.y0 - o.block.h) / step), Math.max(1, Math.round(o.block.w / step)), Math.max(1, Math.round(o.block.h / step)));
      }
      m = { url: cv.toDataURL(), ...box };
      this.mapImages.set(key, m);
    }
    const mm = m;
    const u = (x: number) => (x / TILE - mm.x0) / mm.w, v = (y: number) => (y / TILE - mm.y0) / mm.h;
    // A way down on the surface knows the level it leads to (the link's anchor stands at it), so the Map can open its floors.
    const anchors = onWorld ? [...this.levelLinks()].filter(([, l]) => l.continent === this.world.continent) : [];
    const seen = new Set<string>(), pins: TdMapPin[] = [];
    for (const st of lv.stalls) {
      if (seen.has(st.station.id)) continue;
      seen.add(st.station.id);
      const id = st.station.id;
      if (isBerth(id)) continue;
      const kind: TdMapPin['kind'] = id.startsWith('giver-harbourmaster-') && pierOfMaster(id.slice(6)) ? 'harbour' : id.startsWith('ship') ? 'ship' : id.startsWith('giver-') ? 'npc' : st.station.kind === 'passage' ? 'way' : 'stall';
      let pu = u(st.x);
      const pv = v(st.y);
      // Two ships at one harbour (ContinentWay.along) would share a pin's spot and the later one would eat every
      // click on the first: set a second ship's pin beside it.
      if (kind === 'ship') while (pins.some(q => q.kind === 'ship' && Math.abs(q.u - pu) < .03 && Math.abs(q.v - pv) < .03)) pu += .035;
      const hp = kind === 'harbour' ? pierOfMaster(id.slice(6)) : undefined;
      const pin: TdMapPin = { id, label: st.station.label, blurb: hp ? this.harbourBlurb(hp.id) : st.station.blurb ?? '', kind, u: pu, v: pv };
      const mark = id.startsWith('giver-') ? this.taskMarks[id.slice(6)] : undefined;
      if (mark) pin.mark = mark;
      if (kind === 'way' && onWorld) {
        let best = 3 * TILE;
        for (const [to, l] of anchors) { const dd = Math.hypot(l.ax - st.x, l.ay - st.y); if (dd < best) { best = dd; pin.to = to; } }
      }
      pins.push(pin);
    }
    const area = onWorld ? this.world.continent : lv.id;
    const party = this.peers.partyWhere().filter(p => p.area === area).map(p => ({ id: p.id, name: p.name, u: u(p.x), v: v(p.y) }));
    return { url: mm.url, aspect: mm.w / mm.h, pins, me: want === here ? { u: u(this.player.x), v: v(this.player.y) } : null, section: want, here, party,
      zones: onWorld ? zoneLabels(this.world.def, MOBS, { block: BLOCK }, this.zoneBands()) : [] };
  }
  /**
   * The Map's level bands from the zone table (td-zones.ts), by the names the Map shows: a region's name (the union of
   * every region drawn under it, e.g. Slagstone Hills' hills and rock), a graveyard's, a floor's (its map name). A safe
   * house or a name with no zone reads null (the Map shows no band); the creature-derived band is never used for a zone.
   */
  private zoneBands(): BandOverride {
    const d = this.world.def, byName = new Map<string, LevelBand>();
    const add = (name: string | undefined, band: readonly [number, number] | undefined) => {
      if (!name || !band) return;
      const b = byName.get(name);
      byName.set(name, b ? { min: Math.min(b.min, band[0]), max: Math.max(b.max, band[1]) } : { min: band[0], max: band[1] });
    };
    for (const [region, name] of Object.entries(d.names)) { const z = zoneOf(regionZone(d.id, region)); if (z && !z.safe && region !== '~') add(name, z.band); }
    for (const p of d.places) if (p.kind === 'graveyard') add(p.name, zoneOf(graveyardZone(d.id))?.band);
    for (const [id, def] of Object.entries(LEVELS)) { const z = zoneOf(id); if (z && !z.safe) add(def.name, z.band); }
    return name => byName.get(name) ?? null;
  }
  /** Every section of the continent the Keeper is on, for the Map's area picker (td-map.ts). */
  mapSections(surfaceName: string): TdMapSection[] {
    return mapSections(this.world.def, surfaceName, LEVELS, this.levelLinks(), MOBS, this.zoneBands());
  }
  /** Where the Keeper stands — continent, level (or 'surface'), position — so the HUD can save it and a reload resumes there. */
  get whereabouts(): { continent: string; level: string; x: number; y: number } {
    return { continent: this.world.continent, level: this.level === this.world ? 'surface' : this.level.id, x: Math.round(this.player.x), y: Math.round(this.player.y) };
  }
  /**
   * Put the Keeper back where they last stood (owner 2026-10-20: "not saving in my last location"). Anything unknown —
   * a continent or level that no longer exists — keeps the arrival square; a spot a map change walled in becomes the
   * nearest free one (standNear), never a wall.
   */
  restoreWhereabouts(w: { continent?: unknown; level?: unknown; x?: unknown; y?: unknown }): boolean {
    if (typeof w.continent !== 'string' || typeof w.level !== 'string' || typeof w.x !== 'number' || typeof w.y !== 'number' || !Number.isFinite(w.x) || !Number.isFinite(w.y)) return false;
    const def = CONTINENTS[w.continent];
    if (!def || (w.level !== 'surface' && !LEVELS[w.level])) return false;
    if (w.continent !== this.world.continent) {
      let next = this.continents.get(w.continent);
      if (!next) { next = new TdWorld(def); this.continents.set(w.continent, next); }
      this.world = next; this.map = next.town; this.populate();
    }
    const level = w.level === 'surface' ? this.world : this.handLevel(w.level);
    this.enter(level, '');
    const spot = standNear(level, w.x, w.y);
    if (!footFree(level, spot.x, spot.y)) { this.enter(this.world, ''); this.player.x = this.map.spawn.x; this.player.y = this.map.spawn.y; return false; }
    this.player.x = spot.x; this.player.y = spot.y;
    this.placeCompanions();
    this.report();
    return true;
  }
  get settlementKeepers(): readonly { id: string; x: number; y: number; upstairs: boolean; mark: '!' | '?' | null }[] {
    return this.world.stalls.filter(s => s.keeper).map(s => ({ id: s.keeper!.id, x: Math.round(s.keeper!.x), y: Math.round(s.keeper!.y), upstairs: false, mark: this.taskMarks[s.keeper!.id] ?? null }));
  }
  /** The town task givers' head marks (td-only; the side view's setKeeperMarks is another engine's). */
  setTaskMarks(marks: Readonly<Record<string, '!' | '?'>>): void { this.taskMarks = { ...marks };
  }
  get glimView(): { shown: boolean; x: number; targetX: number | null; arrived: boolean; dimmed: boolean; bright: boolean; mood: string; trail: number | null; lamp: number } {
    const f = this.glimFlight;
    return {
      shown: this.glim.shown, x: Math.round(this.glim.x), targetX: f ? Math.round(f.x) : null, arrived: !f || f.phase !== 'out', dimmed: false,
      bright: this.glimBright, mood: this.glimMoodNow(), trail: this.glimTrail ? Math.round(this.glimTrail.x) : null, lamp: this.glimLamp() ? 1 : 0,
    };
  }
  /** Where the pet is and what it is doing (the HUD chip and the canvas's data-pet-*). */
  get petView(): { id: string; x: number; y: number; state: string; fetching: boolean; glow: boolean; act: string; hits: number; gathers: number; finds: number; heals: number; command: string; level: number } | null {
    const b = this.pet;
    if (!b) return null;
    return {
      id: b.id, x: Math.round(b.x), y: Math.round(b.y), state: b.doing, fetching: !!(b.carried || b.goal), glow: tdPetJob(b.id, 'follow') === 'light' && (this.level.dark || this.darkness > .3),
      act: b.doing, hits: b.hits, gathers: b.gathers, finds: 0, heals: b.heals, command: b.command, level: b.level,
    };
  }
  /** The pet's face for the HUD chip (a data URL, made once per pet). */
  petFace(): string { return this.pet ? petFace(this.pet.id) : ''; }
  get realm(): null { return null; }
  get placeable(): null { return null; }
  /** Walk to a station and open it on arrival (`instant`: stand there now). */
  goToStation(id: string, instant = false): boolean {
    // The nearest of its kind (a floor has many seams of one ore).
    let s: TdStall | undefined, best = Infinity;
    for (const st of this.level.stalls) if (st.station.id === id) { const d = Math.hypot(st.x - this.player.x, st.y - this.player.y); if (d < best) { best = d; s = st; } }
    if (!s) return false;
    // Instant (reduced motion, a deep link): stand there and use it, as the side view's travel did.
    // In front of it, or the nearest free spot (a stair against the back wall has no "in front").
    const spot = standNear(this.level, s.x, s.y + 10);
    if (instant) { this.player.x = spot.x; this.player.y = spot.y; this.path = []; this.use(s); return true; }
    return this.walkTo(spot.x, spot.y, () => this.use(s));
  }
  moveTo(x: number, onArrive?: () => void): boolean { return this.walkTo(x, this.player.y, onArrive); }

  private handLevel(id: string): HandLevel {
    let lv = this.levels.get(id);
    if (!lv) { lv = new HandLevel(LEVELS[id] ?? EMBER_MINE_1); this.levels.set(id, lv); }
    return lv;
  }
  /** What a Harbourmaster's map pin says: where the board sails, and from what fare. */
  private harbourBlurb(pierId: string): string {
    const routes = routesFrom(pierId, CONTINENTS);
    const names = routes.map(r => pierById(r.destPier)?.name ?? r.destPier);
    const low = Math.min(...routes.map(r => fareFor(LANDS[pierById(r.destPier)!.continent]?.entry ?? 1)));
    return routes.length ? `Sailing board: ${names.join(', ')}. Fares from ${low} gold.` : 'The sailing board.';
  }
  /** Sail to another continent: its surface becomes the world, its town's people come out, the Keeper steps ashore. */
  sail(to: string, arrive: string): void {
    const def = CONTINENTS[to];
    if (!def) { this.say('play.td.soon.place'); return; }
    let next = this.continents.get(to);
    if (!next) { next = new TdWorld(def); this.continents.set(to, next); }
    this.world = next;
    this.map = next.town;
    this.populate();
    this.enter(next, arrive);
    this.say('play.td.sailed');
  }

  /** Change level: stand in front of `at` (a station on the new level), drop the old level's baked ground. */
  private enter(level: TdLevel, at: string): void {
    this.level = level;
    // The last area's shared creatures go with it, at once (td-coop left): a late snapshot of it is refused here.
    this.coop?.left(this.peerArea());
    this.chunks.clear();
    this.path = []; this.arrive = null; this.puffs = [];
    // A floor the room runs (protocol 7/9) raises nothing here: its creatures are the room's (no flash of our own).
    this.mobs.enterLevel(level === this.world || this.coop?.roomRuns(this.peerArea()) ? [] : level.spawnsIn(-1e6, -1e6, 1e6, 1e6));
    // The Row-Walker was swept away with the last level's creatures, not felled: it may rise again at once.
    this.walkerUp = false; this.walkerT = 0;
    // In front of the way in, or the nearest free spot to it: never inside a wall (standNear, td-level.ts).
    const s = level.stalls.find(st => st.station.id === at);
    if (s) { const spot = standNear(level, s.x, s.y + 10); this.player.x = spot.x; this.player.y = spot.y; }
    this.player.dir = 'down';
    this.placeCompanions();
    this.report();
  }

  /**
   * A creature's bite. At zero the Keeper falls (the Cold Hearth, design-bible §5.8): the host is told where (it takes
   * the fall's cost and hands back the purse), the world goes dark, and they wake at the last lit hearth, whole.
   */
  private hurt(n: number): void {
    if (this.waking) return;
    if (this.life && !this.roomDown) {
      // Protocol 10: shown at once, never the last point — the room decides the fall (lifeHeard → fallNow).
      if (this.inRoomBite) this.lifeBiteLocal += n; else this.lifeHurt += n;
      this.hp = Math.max(1, this.hp - n);
      this.lastHurt = this.time;
      return;
    }
    this.hp = Math.max(0, this.hp - n);
    this.lastHurt = this.time;
    if (this.hp > 0) return;
    this.fallNow();
  }
  /** The Keeper falls (life at zero; or, protocol 10, the room's word): the purse left, the dark, the hearth. */
  private fallNow(): void {
    if (this.waking) return;
    this.hp = 0;
    const w = this.whereabouts;
    this.mobs.target = null; this.path = []; this.arrive = null; this.keys.clear(); this.joy = null; this.chop = null;
    this.waking = { t: 0, moved: false };
    this.options.onFall?.({ area: `td:${w.continent}|${w.level}`, x: w.x, y: w.y });
    this.markHearth();
  }

  // ── The Cold Hearth (td-hearth.ts) ─────────────────────────────────────────

  /** The hearths of the continent the Keeper is on (placed once, with their stalls). */
  get hearths(): readonly TdHearth[] { return hearthsOf(this.world); }
  /** The host's word on the hearths: which are lit, the wake point, how many blessings are held (the shrine's pips). */
  // ── Other Keepers (the Hearth room; td-peers.ts) ──
  /** The room's list (the side engine's name and shape: the HUD calls it on whichever engine it holds). */
  setPeers(peers: RemoteKeeper[]): void { this.peers.set(peers as unknown as Parameters<TdPeers['set']>[0]); }
  /** The presence area: the continent on its surface, else the floor's own id. */
  peerArea(): string { return this.level === this.world ? this.world.continent : this.level.id; }
  /** What the room is told: the area, where, which way, walking or not. */
  peerPresence(): { area: string; x: number; y: number; face: 1 | -1; dir: 'side' | 'down' | 'up'; moving: boolean } {
    const p = this.player;
    return { area: this.peerArea(), x: Math.round(p.x), y: Math.round(p.y), face: p.face, dir: p.dir, moving: p.moving };
  }
  /** The Keeper's own town portal for presence (td-waygate encodeGate; '' when none stands). */
  gatePresence(): string { return this.gates.presence(this.time); }
  /** Read a Waygate Scroll (the HUD spends it on success): the same portal as the spell, no mana. Why not, or null. */
  openWaygate(): 'waytown' | 'wayboss' | 'wayseam' | null {
    if (this.paused || this.waking) return 'waytown';
    const why = this.gates.open(this.time);
    if (!why) this.cant = { text: SKILLS['waygate'].words ?? '', color: CANT_TONE['common'], age: 0 };
    return why;
  }
  /** The portal's state on the canvas for tests and tools (`data-waygate`: '' | 'open'; seconds left; trips taken). */
  private markWaygate(): void {
    const own = this.gates.own, left = own ? Math.ceil(waygateLeft(own, this.time)) : 0;
    const here = this.whereabouts, where = own ? (own.town.continent === here.continent && here.level === 'surface' && Math.hypot(own.town.x - here.x, own.town.y - here.y) < 120 ? 'town' : 'field') : '';
    const key = `${own ? 'open' : ''}|${Math.ceil(left / 10)}|${this.gates.trips}|${where}`;
    if (key === this.gateSeen) return;
    this.gateSeen = key;
    this.canvas.setAttribute('data-waygate', own ? 'open' : '');
    this.canvas.setAttribute('data-waygate-left', String(left));
    this.canvas.setAttribute('data-waygate-trips', String(this.gates.trips));
    this.canvas.setAttribute('data-waygate-at', where);
  }
  /** A Wave over a Keeper ('' or null: the local one). */
  peerWave(who: string | null): void { this.peers.wave(who ?? '', this.time); }
  /** Who is drawn, in CSS pixels on the page (the HUD's data-peers, the e2e's tap target). */
  peersOnScreen(): { id: string; name: string; x: number; y: number; waving: boolean }[] {
    const r = this.canvas.getBoundingClientRect(), k = Math.max(1, this.canvas.width) / Math.max(1, r.width);
    return this.peers.drawn.map(p => ({
      id: p.id, name: p.name, waving: this.peers.waving(p.id, this.time),
      x: Math.round(r.left + (p.x - this.cam.x) * this.scale / k), y: Math.round(r.top + (p.y - 16 - this.cam.y) * this.scale / k),
    }));
  }
  /** The party's other members (protocol 3; empty when none): gold plates, minimap marks, Seek by name. */
  setParty(ids: readonly string[]): void { this.peers.party = new Set(ids); }
  /** Protocol 4: the room's election (null against an older room), this Keeper's id, the whole party's ids. */
  setCoop(areas: CoopAreas | null, me: string, party: readonly string[], world = false, everywhere = false): void { this.coop.setAreas(areas, me, party, world, everywhere); }
  /** Protocol 4: a host's snapshot reached this member. */
  coopSnap(msg: CoopSnapMsg): void { this.coop.snap(msg); }
  /** Protocol 4: members' claims reached this host. */
  coopHits(msg: CoopHitsMsg): void { this.coop.hits(msg); }
  /** Protocol 5: a party member's own companions (pet, beasts, skeletons, wisps, beacon, Glim) reached this screen. */
  coopPals(msg: { from: string; area: string; pals: CoopPal[] }): void {
    if (msg.area === this.peerArea()) this.palBook.take(msg.from, msg.pals, performance.now(), this.still);
  }
  /** Presence's cosmetic companions (the pet and Glim as offsets: everyone sees them, party or not). */
  palsPresence(): string { return encodePresencePals(this.player, this.myPals()); }
  /** This Keeper's own companions as the party sees them: each owner is the authority for its own. */
  private myPals(): CoopPal[] {
    const out: CoopPal[] = [];
    const b = this.pet;
    if (b) out.push({ i: 'p', k: 'pet', t: b.id, x: b.x, y: b.y, f: b.face, a: b.doing === 'fight' });
    this.mobs.beasts.forEach((w, n) => { if (w.age >= 0) out.push({ i: `b${n}`, k: w.kind === 'stampede' ? 'stampede' : 'beast', x: w.x, y: w.y, f: w.face, a: !!w.target }); });
    for (const k of this.mobs.minions) out.push({ i: `k${k.id % 1e6}`, k: 'skel', x: k.x, y: k.y, f: k.face, h: k.hp, m: k.maxHp, a: !!k.target });
    this.mobs.wisps.forEach((w, n) => out.push({ i: `w${n}`, k: 'wisp', x: w.x, y: w.y, f: 1 }));
    this.mobs.beacons.forEach((w, n) => out.push({ i: `c${n}`, k: 'beacon', x: w.x, y: w.y, f: 1 }));
    if (this.glim.shown) out.push({ i: 'g', k: 'glim', x: this.glim.x, y: this.glim.y, f: 1 });
    return cleanPals(out);
  }
  /** Five times a second while others of the party share the area: this Keeper's companions, when they changed (a heartbeat a second). */
  private tickPals(dt: number): void {
    if (!this.coop.sharing) return;
    this.palAcc += dt * 1000;
    if (this.palAcc < PAL_MS) return;
    this.palAcc = 0;
    const pals = this.myPals(), key = JSON.stringify(pals), now = performance.now();
    if (key === this.palKey && now - this.palAt < PAL_HEARTBEAT_MS) return;
    this.palKey = key; this.palAt = now;
    void this.options.onCoopPals?.({ area: this.peerArea(), pals });
  }
  /** Another Keeper's companion, with the painter its own owner uses. */
  private drawPal(p: CoopPal, x: number, y: number, moving: boolean): void {
    const c = this.ctx, time = this.time + (p.i.charCodeAt(0) % 5) * .3;
    if (p.k === 'pet') {
      if (!p.t) return;
      const body = { id: p.t, x, y, face: p.f, t: time, doing: p.a ? 'fight' : 'follow', moving, carried: null, feel: null, feelT: 0, hopT: 0, hurtT: 0, cd: 0 } as unknown as PetBody;
      this.drawPet(body);
    } else if (p.k === 'beast' || p.k === 'stampede') drawBeast(c, { x, y, face: p.f, age: 1, kind: p.k === 'stampede' ? 'stampede' : 'called' }, time, this.still);
    else if (p.k === 'skel') this.drawRaised({ x, y, face: p.f, t: time + 1, life: Infinity, hit: 0, hp: p.h ?? 1, maxHp: p.m ?? 1 } as unknown as Minion);
    else if (p.k === 'wisp') drawLampState(c, { ward: 0, lastLight: 0, wisps: [{ x, y }], mobs: [] }, { x, y }, time, this.still);
    else if (p.k === 'beacon') drawBeacon(c, { x, y, t: 1 }, time, this.still);
    else if (p.k === 'glim') {
      const gx = Math.round(x), gy = Math.round(y);
      c.globalCompositeOperation = 'lighter';
      glowSquare(c, gx, gy, 7, { core: '#fff2c4', body: '#ffd98a', edge: '#c88a2a' }, .32);
      c.globalCompositeOperation = 'source-over';
      const sprite = glimFrame(this.still ? 'mid' : GLIM_FLAP[Math.floor(time * 8) % 4], 'calm');
      if (sprite) c.drawImage(sprite, gx - Math.floor((GLIM_W + 2) / 2), gy - Math.floor((GLIM_H + 2) / 2));
    }
  }
  /** The other Keepers' companions drawn now (the e2e reads it): the party's whole list, everyone else's pet and Glim. */
  palsShown(): { owner: string; k: string; t: string; x: number; y: number }[] {
    const now = performance.now(), drawn = new Set(this.peers.drawn.map(p => p.id)), out: { owner: string; k: string; t: string; x: number; y: number }[] = [];
    for (const s of this.palBook.shown(now)) if (drawn.has(s.owner)) out.push({ owner: s.owner, k: s.pal.k, t: s.pal.t ?? '', x: Math.round(s.x), y: Math.round(s.y) });
    for (const p of this.peers.drawn) {
      if (this.palBook.fresh(p.id, now)) continue;
      for (const q of decodePresencePals(this.peers.palsOf(p.id))) out.push({ owner: p.id, k: q.k, t: q.t, x: Math.round(p.x + q.dx), y: Math.round(p.y + q.dy) });
    }
    return out;
  }
  /** Protocol 4: this Keeper's part in its area ('solo', 'host' or 'member'). */
  get coopRoleNow(): CoopRole { return this.coop.role; }
  /** The role changed: a member's own creatures and its Seam Eater are gone (the host's stand in for them). */
  private coopRole(role: CoopRole, was: CoopRole = 'solo'): void {
    if (role === 'member') this.seam = null;
    // The room never took this floor after all (td-coop gave up waiting): its own creatures, as before the room.
    if (role === 'solo' && was === 'member' && this.level !== this.world && !this.mobs.mobs.length && !this.coop.roomRuns(this.peerArea())) {
      this.mobs.addSpawns(this.level.spawnsIn(-1e6, -1e6, 1e6, 1e6));
    }
    // The room's ground belongs to the area it was sent for: walking elsewhere leaves it behind.
    if (this.roomArea && this.roomArea !== this.peerArea()) this.clearRoomGround();
    if (role !== this.coopRoleSeen) { this.coopRoleSeen = role; this.canvas.setAttribute('data-coop-role', role); }
  }
  /** The local Keeper is waving. */
  get selfWaving(): boolean { return this.peers.waving('', this.time); }
  setHearths(s: { lit: readonly string[]; wake: string | null; blessings: number }): void {
    this.hearthLit = new Set(s.lit); this.hearthWake = s.wake; this.hearthBlessed = Math.max(0, Math.min(5, s.blessings));
    this.markHearth();
  }
  /** The corpse run's purse: it lies only where it fell (`td:<continent>|<level>`). */
  setFallenPurse(p: { area: string; x: number; y: number; gold: number } | null): void {
    this.purse = p ? { area: p.area, x: p.x, y: p.y, gold: p.gold } : null;
    this.markHearth();
  }
  /** The purse, when it lies on this continent and level. */
  private purseHere(): { x: number; y: number; gold: number } | null {
    const p = this.purse;
    if (!p) return null;
    return p.area === `td:${this.world.continent}|${this.level === this.world ? 'surface' : this.level.id}` ? p : null;
  }
  /** The Keeper's hand on a hearth: it takes the flame (a burst of embers) and becomes the wake point. */
  private lightHearth(id: string): void {
    const h = this.hearths.find(x => x.id === id);
    if (!h) return;
    const first = !this.hearthLit.has(id);
    this.hearthLit.add(id); this.hearthWake = id;
    this.glimBurst(h.x, h.y - 10, first ? 14 : 6);
    if (first) this.glimMood('happy', 3);
    this.options.onHearth?.({ id, town: h.town, capital: h.capital });
    this.markHearth();
  }
  /** The wake: dark, then (at the darkest) the Keeper is moved to the hearth, then warmth back. Nothing moves meanwhile. */
  private stepWaking(dt: number): void {
    const w = this.waking!;
    w.t += dt;
    const out = this.still ? .25 : .6, back = this.still ? .8 : 1.6;
    if (!w.moved && w.t >= out + .2) { w.moved = true; this.wakeAtHearth(); this.markHearth(); }
    if (w.t >= out + .2 + back) { this.waking = null; this.markHearth(); }
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) { this.stateTimer = .1; if (!this.catchingUp) this.report(); }
  }
  /** The veil's darkness and warmth now (0–1 each). */
  private wakeVeil(): { dark: number; warm: number } {
    const w = this.waking;
    if (!w) return { dark: 0, warm: 0 };
    const out = this.still ? .25 : .6, back = this.still ? .8 : 1.6;
    if (!w.moved) return { dark: Math.min(1, w.t / out), warm: 0 };
    const k = Math.max(0, Math.min(1, (w.t - out - .2) / back));
    return { dark: 1 - k, warm: (1 - k) * .9 };
  }
  /** Stand the Keeper at the wake hearth (any continent), or the square when none is lit. Life and mana come back whole. */
  private wakeAtHearth(): void {
    const id = this.hearthWake, cont = id ? hearthContinent(id) : null;
    let woke: TdHearth | null = null;
    if (id && cont && CONTINENTS[cont]) {
      let world = this.continents.get(cont);
      if (!world) { world = new TdWorld(CONTINENTS[cont]); this.continents.set(cont, world); }
      const h = hearthsOf(world).find(x => x.id === id);
      // Beside the fire, not in front of it: the Keeper wakes where the flame is in view.
      if (h && this.restoreWhereabouts({ continent: cont, level: 'surface', x: h.x + 18, y: h.y + 14 })) woke = h;
    }
    if (!woke) { this.enter(this.world, ''); this.player.x = this.map.spawn.x; this.player.y = this.map.spawn.y; }
    this.hp = this.maxHp; this.mobs.mana = this.mobs.maxMana; this.mobs.target = null;
    // Protocol 10: back on its feet at the hearth, whole — the room is told (it held the Keeper down until now).
    if (this.life) { this.wakeQ = this.life.claim('wake', this.maxHp); this.lifeMark = this.hp; this.lifeBiteLocal = 0; this.lifeHurt = 0; this.roomDown = false; }
    this.player.dir = 'down';
    this.placeCompanions();
    this.options.onWoke?.({ hearth: woke?.id ?? null, town: woke?.town ?? this.world.def.townName });
  }
  /** Each frame: the purse walked over comes home. */
  private updateHearth(): void {
    const pu = this.purseHere();
    if (pu && Math.hypot(pu.x - this.player.x, pu.y - this.player.y) < 14) {
      this.purse = null;
      this.glimBurst(pu.x, pu.y - 6, 8);
      this.options.onPurse?.();
    }
    this.markHearth();
  }
  /** The hearth's state on the canvas, for tests and tools (written only when it changes). */
  private markHearth(): void {
    const pu = this.purseHere(), near = this.nearby?.station.id ?? '';
    const waking = this.waking ? (this.waking.moved ? 'in' : 'out') : '';
    const key = `${this.hearthWake ?? ''}|${this.hearthLit.size}|${pu ? 'here' : this.purse ? 'away' : ''}|${waking}|${near.startsWith('hearth:') || near.startsWith('shrine:') ? near : ''}|${this.hearthBlessed}`;
    if (key === this.hearthSeen) return;
    this.hearthSeen = key;
    const [wake, lit, purse, wk, nearby, blessed] = key.split('|');
    this.canvas.setAttribute('data-hearth-wake', wake);
    this.canvas.setAttribute('data-hearths-lit', lit);
    this.canvas.setAttribute('data-fallen-purse', purse);
    this.canvas.setAttribute('data-waking', wk);
    this.canvas.setAttribute('data-hearth-near', nearby);
    this.canvas.setAttribute('data-blessings', blessed);
  }
  /** Test hook only (`__tdWaygate.field`): stand on open surface ground clear of every settlement, nearest first. */
  private fxField(tiles: number): { x: number; y: number } | null {
    if (this.level !== this.world) this.enter(this.world, '');
    const c0 = Math.floor(this.player.x / TILE), r0 = Math.floor(this.player.y / TILE);
    for (let ring = 1; ring < 120; ring++) for (let dr = -ring; dr <= ring; dr++) for (let dc = -ring; dc <= ring; dc++) {
      if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue;
      const c = c0 + dc, r = r0 + dr;
      let clear = this.world.walkable(c, r) && this.world.walkable(c, r + 1) && this.world.walkable(c, r + 2);
      for (let k = -tiles; clear && k <= tiles; k += 2) for (let j = -tiles; clear && j <= tiles; j += 2) if (this.world.inSettlement(c + k, r + j)) clear = false;
      if (!clear) continue;
      this.player.x = c * TILE + TILE / 2; this.player.y = r * TILE + TILE - 2; this.path = [];
      this.placeCompanions();
      return { x: this.player.x, y: this.player.y };
    }
    return null;
  }
  /** Test hook only (`?fxfall=1`): stand in front of the nearest hearth (or its shrine) on this continent. */
  private fxStandAt(what: 'hearth' | 'shrine'): string | null {
    if (this.level !== this.world) this.enter(this.world, '');
    let best: { id: string; x: number; y: number } | null = null, bd = Infinity;
    for (const h of this.hearths) {
      const spot = what === 'shrine' ? h.shrine : { id: h.id, x: h.x, y: h.y };
      if (!spot) continue;
      const d = Math.hypot(spot.x - this.player.x, spot.y - this.player.y);
      if (d < bd) { bd = d; best = spot; }
    }
    if (!best) return null;
    const at = standNear(this.level, best.x + 18, best.y + 14);
    this.player.x = at.x; this.player.y = at.y; this.player.dir = 'up'; this.path = [];
    this.placeCompanions();
    return best.id;
  }

  // ── The mystery layer (td-dark.ts, td-dark-layer.ts) ─────────────────────

  /** The player's cap on the Hush (Menu → Sound: "The Hush"). */
  setHushCap(cap: string): void { if ((HUSH_CAPS as readonly string[]).includes(cap)) this.darkLayer.setCap(cap as HushCap); }
  /** The whispers, in the player's language (the host's i18n): the lines and the one that names the Keeper. */
  setDarkWords(w: { whispers: readonly string[]; name: string }): void { this.darkLayer.setWords(w); }
  /** The Hush for the HUD: awake or not, its level (0–100, never shown as a number), band, and the last omen. */
  get hushView(): { on: boolean; level: number; band: number; omen: { kind: string; seq: number } | null } {
    const on = this.darkLayer.awake({ keeperLevel: this.mobs.keeperLevel, continent: this.world.continent });
    return { on, level: Math.round(this.darkLayer.hush), band: on ? this.darkLayer.band : 0, omen: this.darkLayer.omen };
  }
  /** Where the Lanternwright's lantern hangs (the head of the lamp-staff): right of him facing down, left facing up. */
  private lanternAt(): { x: number; y: number } {
    const p = this.player, dx = p.dir === 'down' ? 9 : p.dir === 'up' ? -9 : p.face * 6;
    return { x: p.x + dx, y: p.y - 32 };
  }
  private ownLight(): LightSpot {
    // S6: a pack's Lightless, the affix, the Gloam Witch's True Light cut it (never below a third of the lamp).
    const r = KEEPER_LIGHT + this.mobs.lightBonus * TILE;
    return { x: this.player.x, y: this.player.y - 18, r: Math.max(KEEPER_LIGHT * .35, r - this.mobs.lightCut * TILE) };
  }
  private glimLight(): LightSpot | null {
    if (!this.glim.shown) return null;
    return { x: this.glim.x, y: this.glim.y, r: (this.level.dark ? (this.glimLamp() ? GLIM_TD.lampLight : GLIM_TD.light) : GLIM_OPEN_LIGHT) + this.mobs.lightBonus * TILE };
  }
  /** The fixed lights the dark-born and the Hush read: lamp sprites in view and lit hearths. */
  private fixedLights(): LightSpot[] {
    const out: LightSpot[] = [];
    for (const o of this.visible) for (const l of o.sprite().lights ?? []) out.push({ x: o.x + l.x, y: o.y + l.y, r: l.r * 2 });
    if (this.level === this.world) for (const h of this.hearths) if (this.hearthLit.has(h.id)) out.push({ x: h.x, y: h.y - 8, r: 90 });
    // The Lanternwright's: a Beacon on its pole, a disc of Dawn at Noon.
    for (const b of this.mobs.beacons) out.push({ x: b.x, y: b.y - 30, r: BEACON_LIGHT });
    for (const d of this.mobs.dawns) out.push({ x: d.x, y: d.y, r: d.r * 1.4 });
    // Every campfire is a small hearth (canon §6.5): the dark-born keep back from its light.
    out.push(...this.gather.lights());
    return out;
  }
  private darkFrame(dt: number): DarkFrame {
    const surface = this.level === this.world, k = this.player, pb = this.pet;
    const tc = Math.floor(k.x / TILE), tr = Math.floor((k.y - 1) / TILE);
    return {
      dt, time: this.time, still: this.still, levelId: this.level.id, dark: this.level.dark, continent: this.world.continent, surface,
      phase: this.skyPhase, safe: surface ? this.world.safeAt(tc, tr) : !this.level.dark,
      // A lit hearth near, or the Lanternwright's own Hearth Circle round him: the Hush cannot rise there.
      hearth: (surface && this.hearths.some(h => this.hearthLit.has(h.id) && Math.hypot(h.x - k.x, h.y - k.y) < 90)) || this.mobs.inHearth || !!this.gather.fireNear(k.x, k.y, FIRE_WARM),
      keeper: { x: k.x, y: k.y, moving: k.moving }, keeperLevel: this.mobs.keeperLevel,
      own: this.ownLight(), glim: this.glimLight(),
      pet: pb && tdPetJob(pb.id, 'follow') === 'light' ? { x: pb.x, y: pb.y - 8, r: TD_PET.light } : null,
      fixed: this.fixedLights(), raised: this.mobs.lightBonus, trail: this.trail,
      walkable: (c, r) => this.level.walkable(c, r),
    };
  }
  /** Each frame: seed the level's shy chests and the continent's notes once, step the layer, open or close the roads. */
  private updateDark(dt: number): void {
    const lv = this.level;
    if (!this.darkSeeded.has(lv) && lv instanceof HandLevel) {
      this.darkSeeded.add(lv);
      for (const ch of this.darkLayer.chestsOn(lv.id)) lv.stalls.push({ station: { id: `shade:${ch.id}`, x: 0, label: 'SOMETHING SHY', kind: 'resource', blurb: 'A chest that is only there in the dark.' }, x: ch.c * TILE + TILE / 2, y: ch.r * TILE + TILE - 6 });
    }
    if (!this.darkSeeded.has(this.world)) {
      this.darkSeeded.add(this.world);
      for (const n of NIGHTROADS) if (n.continent === this.world.continent) this.world.addStall({ station: { id: `nightnote:${n.id}`, x: 0, label: 'A WET PAGE', kind: 'resource', blurb: 'Someone left a page out here, under a stone.' }, x: n.note[0] * TILE + TILE / 2, y: n.note[1] * TILE + TILE - 6 });
    }
    const f = this.darkFrame(dt);
    this.darkLayer.update(f);
    // Dawn at Noon unveils what stands in the dark inside it: the shapes caught in the daylight leave.
    for (const d of this.mobs.dawns) for (const sh of this.darkLayer.shapes) if (Math.hypot(sh.x - d.x, sh.y - d.y) <= d.r * 1.4) sh.state = 'gone';
    // A Nightroad is walkable while it is there (night, an eclipse, or the Keeper still on it).
    this.world.nightOpen = this.darkLayer.roadsOpen(this.world.continent, this.skyPhase, this.player.x, this.player.y);
    // The dark pays (the Hush's boon): read by the kill (XP) and the loot roll (Magic Find).
    this.mobs.darkBoon = this.darkLayer.awake(f) ? this.darkLayer.boon : { mf: 0, xp: 1 };
    this.markDark();
  }
  /** A shy chest: in the dark it gives what it holds (once a session); in light it is not there to open. */
  private openShade(id: string): void {
    const ch = SHADE_CHESTS.find(x => x.id === id);
    if (!ch || this.level.id !== ch.level || this.darkLayer.isOpened(id)) return;
    if (!this.darkLayer.chestShown(ch, this.darkFrame(0))) { this.say(this.mobs.lamp && !this.mobs.shuttered ? 'dark.chest.shutter' : 'dark.chest.lit'); return; }
    this.darkLayer.markOpened(id);
    const x = ch.c * TILE + TILE / 2, y = ch.r * TILE + TILE;
    // What the floor's own creatures carry: its first spawn names the drop table and the level.
    const first = this.level.spawnsIn(-1e6, -1e6, 1e6, 1e6)[0], type = first?.type ?? 'ash-wolf', def = MOBS[type] ?? MOBS['ash-wolf'];
    // …at the floor's own level (td-zones.ts), not the kind's.
    const lootLevel = first?.level ?? def.level;
    const key = `shade:${id}:${Date.now().toString(36)}`;
    const roll = (k: string) => { try { return this.options.rollLoot?.({ creature: def.id, level: lootLevel, rank: 'champion', killKey: k, mf: this.mobs.darkBoon.mf }) ?? []; } catch { return []; } };
    let n = 0;
    const rows: LootRow[] = guaranteeMagic(floorEliteRows(roll(key), 'champion'), () => roll(`${key}:x${n++}`)).slice(0, 2);
    // The Lamplighter's Things (set-items.ts): each shy chest holds a piece of the set, as well as what is above.
    const piece = chestSetPiece(id, (() => { let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0; return () => (h = (h * 1664525 + 1013904223) >>> 0) / 4294967296; })());
    if (piece) rows.push({ kind: 'item', definitionId: piece.id, rarity: piece.rarity, label: piece.name, unique: true, level: def.level });
    let gold = 0;
    for (let i = 0; i < CHEST_GOLD_PILES; i++) gold += goldDropFor(def);
    this.mobs.drops.push({ id: `${key}:c`, x: x - 10, y: y + 8, coins: gold, qty: 0, label: `${gold} Gold`, color: GOLD_RAMP[0], age: 0 });
    rows.forEach((row, i) => {
      const at = { x: x + 4 + i * 10, y: y + 10 };
      if (row.kind === 'item') this.mobs.drops.push({ id: `${key}:g${i}`, ...at, coins: 0, qty: 0, item: { definitionId: row.definitionId, rarity: row.rarity, unique: !!row.unique, level: row.level ?? def.level }, rarity: row.rarity, label: row.label, color: '#5aa8ff', age: 0 });
      else this.mobs.drops.push({ id: `${key}:r${i}`, ...at, coins: 0, qty: 0, rune: row.rune, rarity: row.rarity, label: row.label, color: '#5aa8ff', age: 0 });
    });
    this.glimBurst(x, y - 8, 10);
    this.say('dark.chest.open');
  }
  /** A Nightroad's note: its words on the message line; reading in the dark leans the Hush a little closer. */
  private readNightNote(id: string): void {
    if (!NIGHTROADS.some(n => n.id === id)) return;
    this.say(`dark.note.${id}`);
    this.messageAge = -6;
    this.darkLayer.hush = Math.min(100, this.darkLayer.hush + (this.darkLayer.awake({ keeperLevel: this.mobs.keeperLevel, continent: this.world.continent }) ? 3 : 0));
  }
  // ── The Sexton's Count (shared/sexton; td-sexton.ts) ────────────────────────────────────────────────────────

  /** The chain's step and facts, from the host (null: none yet). The vault's door opens from the facts. */
  setSextonCount(s: { step: string; facts: readonly string[] } | null): void {
    this.sexton = { step: s?.step ?? 'offer', facts: new Set(s?.facts ?? []) };
  }
  /** The sky's phase as the rules read it (a pinned `?hour=` stands for its own). */
  private get phaseNow(): SkyPhase { return this.pinned !== null ? phaseOfHour(this.pinned) : this.skyPhase; }
  /** Each frame: stand the stones and the page once on Ember Isle, open the vault's door, raise the Row-Walker. */
  private updateSexton(dt: number): void {
    const onIsle = this.world.continent === SEXTON_CONTINENT;
    if (onIsle && !this.sextonSeeded.has(this.world)) {
      this.sextonSeeded.add(this.world);
      for (const st of SEXTON_STONES) this.world.addStall({ station: { id: `sexton:stone:${st.n}`, x: 0, label: 'A CHALK-MARKED STONE', kind: 'resource', blurb: 'Sexton Wren marks the graves he counts in chalk.' }, ...stallSpot(st.c, st.r) });
      this.world.addStall({ station: { id: 'sexton:page', x: 0, label: 'A LEDGER PAGE', kind: 'resource', blurb: 'A torn page. It is only there in the dark.' }, x: SEXTON_PAGE.c * TILE + TILE / 2, y: SEXTON_PAGE.r * TILE + TILE - 6 });
    }
    const lv = this.level;
    if (lv instanceof HandLevel && lv.id === SEXTON_VAULT && this.sexton.facts.has('door')) lv.open(BARROW_DOOR_ID);
    // The one who walks the rows: a named Bone Walker rises at the plot while the key is to be taken (and the Keeper near).
    // It rests a while after it falls (or wanders off); a new level (enter) forgets that.
    const up = this.mobs.mobs.some(m => m.key === WALKER_KEY);
    if (this.walkerUp && !up) this.walkerT = WALKER.again;
    this.walkerUp = up;
    this.walkerT = Math.max(0, this.walkerT - dt);
    if (onIsle && lv === this.world && this.sexton.step === 'key' && this.walkerT <= 0 && !up && MOBS['bone-walker']) {
      const x = WALKER_AT.c * TILE + TILE / 2, y = WALKER_AT.r * TILE + TILE;
      if (Math.hypot(this.player.x - x, this.player.y - y) < WALKER.reach * TILE) {
        this.mobs.spawnPack(WALKER_KEY, MOBS['bone-walker'], x, y, makePack('unique', ['extra-strong'], WALKER.name, 1));
        this.walkerUp = true;
      }
    }
    // The chain's e2e: once walked anywhere by the hook, every creature stays calm and the Keeper whole (pictures hold).
    if (this.fxSextonCalm) {
      for (const m of this.mobs.mobs) if (m.def.sight > 0) { m.def = { ...m.def, sight: 0 }; m.wait = 1e9; }
      this.hp = this.maxHp;
    }
    this.markSexton();
  }
  /** A chain place used (E, a tap): the host records what the chain allows. */
  private useSexton(what: string): void {
    if (what.startsWith('stone:')) { const n = Number(what.slice(6)); if (n === 1 || n === 2 || n === 3) this.options.onSexton?.({ kind: 'stone', n }); }
    else if (what === 'page') { const ph = this.phaseNow; this.options.onSexton?.({ kind: 'page', dark: ph === 'night' || ph === 'eclipse' }); }
    else if (what === 'door' || what === 'grave') this.options.onSexton?.({ kind: what });
  }
  /** The chain on the canvas, for tests and tools: "step|level|door open|Row-Walker up|page shown". */
  private markSexton(): void {
    const lv = this.level, door = lv instanceof HandLevel && lv.id === SEXTON_VAULT && lv.opened.has(BARROW_DOOR_ID) ? 1 : 0;
    const key = `${this.sexton.step}|${lv.id}|${door}|${this.mobs.mobs.some(m => m.key === WALKER_KEY) ? 1 : 0}|${pageShown(this.sexton.step, this.phaseNow) ? 1 : 0}`;
    if (key === this.sextonSeen) return;
    this.sextonSeen = key;
    this.canvas.setAttribute('data-sexton', key);
  }
  /** Test hook only: stand the Keeper at a place of the chain, the creatures round it calm (they never notice him). */
  private fxToSexton(where: string): string | null {
    const isle = (c: number, r: number, dy = 2) => this.restoreWhereabouts({ continent: SEXTON_CONTINENT, level: 'surface', x: c * TILE + TILE / 2, y: (r + 1) * TILE + dy });
    let ok = false;
    const stone = /^stone-([123])$/.exec(where);
    if (stone) { const st = SEXTON_STONES[Number(stone[1]) - 1]; ok = isle(st.c, st.r + 1); this.player.dir = 'up'; }
    else if (where === 'barrow') ok = isle(WALKER_AT.c - 2, WALKER_AT.r + 2);
    else if (where === 'square') ok = this.restoreWhereabouts({ continent: SEXTON_CONTINENT, level: 'surface', x: this.continents.get(SEXTON_CONTINENT)?.spawn.x ?? this.map.spawn.x, y: this.continents.get(SEXTON_CONTINENT)?.spawn.y ?? this.map.spawn.y });
    // Beside the page (east of it, toward the road), so it shows in the picture.
    else if (where === 'page') { ok = isle(SEXTON_PAGE.c + 1, SEXTON_PAGE.r, -2); this.player.face = -1; this.player.dir = 'side'; }
    else if (where === 'door' || where === 'grave' || where === 'vault') {
      const t = where === 'door' ? VAULT_KEYHOLE : where === 'grave' ? { c: VAULT_GRAVE.c, r: VAULT_GRAVE.r + 1 } : { c: VAULT_KEYHOLE.c, r: VAULT_KEYHOLE.r + 3 };
      ok = this.restoreWhereabouts({ continent: SEXTON_CONTINENT, level: SEXTON_VAULT, x: t.c * TILE + TILE / 2, y: t.r * TILE + TILE - 2 });
      this.player.dir = where === 'door' ? 'down' : 'up';
    }
    if (!ok) return null;
    this.path = []; this.mobs.target = null; this.fxSextonCalm = true;
    for (const m of this.mobs.mobs) { m.def = { ...m.def, sight: 0 }; m.wait = 1e9; }
    this.placeCompanions();
    return where;
  }
  /** Test hook only: fell the Row-Walker or the Uncounted at once (the kill goes through the real path: onKill, loot). */
  private fxSmite(what: 'walker' | 'uncounted'): boolean {
    const m = this.mobs.mobs.find(x => what === 'walker' ? x.key === WALKER_KEY : x.def.id === 'the-uncounted');
    if (!m) return false;
    this.mobs.smite(m);
    return true;
  }

  /** The layer's state on the canvas, for tests and tools (written only when it changes). */
  private markDark(): void {
    const v = this.hushView, open = this.world.nightOpen ? 1 : 0;
    const chests = this.darkLayer.chestsOn(this.level.id).map(ch => `${ch.id}:${this.darkLayer.isOpened(ch.id) ? 'open' : this.darkLayer.chestShown(ch, this.darkFrame(0)) ? 'shown' : 'hid'}`).join(',');
    const key = `${v.on ? 1 : 0}|${hushBand(v.level)}|${this.darkLayer.shapes.length}|${this.darkLayer.prints.length > 0 ? 1 : 0}|${open}|${chests}`;
    if (key === this.darkSeen) return;
    this.darkSeen = key;
    const [on, band, shapes, prints, roads, ch] = key.split('|');
    this.canvas.setAttribute('data-hush-on', on);
    this.canvas.setAttribute('data-hush-band', band);
    this.canvas.setAttribute('data-shapes', shapes);
    this.canvas.setAttribute('data-prints', prints);
    this.canvas.setAttribute('data-nightroads', roads);
    this.canvas.setAttribute('data-shade-chests', ch);
  }
  private darkState(): Record<string, unknown> {
    const tc = Math.floor(this.player.x / TILE), tr = Math.floor((this.player.y - 1) / TILE);
    const row = (r: number) => Array.from({ length: 17 }, (_, i) => this.level.walkable(tc - 12 + i, r) ? (this.level.ground(tc - 12 + i, r) === 'water' ? '=' : '.') : this.level.ground(tc - 12 + i, r) === 'water' ? '~' : '#').join('');
    return { tile: [tc, tr], near: [row(tr - 1), row(tr), row(tr + 1)], hush: Math.round(this.darkLayer.hush), band: this.darkLayer.band, shapes: this.darkLayer.shapes.map(s => ({ x: Math.round(s.x), y: Math.round(s.y), state: s.state })), prints: this.darkLayer.prints.length, roadsOpen: this.world.nightOpen, level: this.level.id, x: Math.round(this.player.x), y: Math.round(this.player.y), boon: this.mobs.darkBoon };
  }
  /** Test hook only: two shapes at the edge of the light, east and west, held for a photograph, and a spell of prints. */
  private layDarkShowcase(): void {
    this.darkLayer.hold = true;
    this.darkLayer.shapes = []; this.darkLayer.prints = [];
    const f = this.darkFrame(0), lights: LightSpot[] = [f.own, ...f.fixed, ...(f.glim ? [f.glim] : [])];
    for (const a of [0, Math.PI]) { const s = this.darkLayer.placeShape(f, lights, false, a); if (s) { s.alpha = .78; s.life = 1e9; this.darkLayer.shapes.push(s); } }
    // A trail of prints on open floor, just past the light, leading away (the first way that is all floor).
    const reach = Math.max(f.own.r, f.glim?.r ?? 0) * .72 + 24;
    let best: { x: number; y: number }[] = [];
    for (let k = 0; k < 16; k++) {
      const ang = k * Math.PI / 8;
      const pts = Array.from({ length: 6 }, (_, i) => ({ x: this.player.x + Math.cos(ang) * (reach + i * 10), y: this.player.y + Math.sin(ang) * (reach + i * 10) }))
        .filter(p => this.level.walkable(Math.floor(p.x / TILE), Math.floor((p.y - 1) / TILE)));
      if (pts.length > best.length) best = pts;
    }
    best.forEach((p, i) => this.darkLayer.prints.push({ x: p.x, y: p.y, age: i * .4, left: i % 2 === 0 }));
  }
  /** Test hook only: into a shy chest's level, standing beside it. */
  private fxToChest(id?: string): string | null {
    const ch = SHADE_CHESTS.find(x => x.id === (id ?? 'galleries')) ?? SHADE_CHESTS[0];
    this.enter(this.handLevel(ch.level), '');
    // The floor's creatures stand calm for the photograph (they never notice the Keeper).
    for (const m of this.mobs.mobs) { m.def = { ...m.def, sight: 0 }; m.wait = 1e9; }
    this.mobs.target = null;
    const at = standNear(this.level, ch.c * TILE + TILE / 2 + 18, ch.r * TILE + TILE + 4);
    this.player.x = at.x; this.player.y = at.y; this.player.dir = 'up'; this.path = [];
    this.placeCompanions();
    return ch.id;
  }
  /** Test hook only: on the surface of the road's continent, at the shore end of a Nightroad. */
  private fxToRoad(id?: string, where: 'shore' | 'nook' = 'shore'): string | null {
    const n = NIGHTROADS.find(x => x.id === (id ?? 'ashwater')) ?? NIGHTROADS[0];
    const [c, r] = n.road[0], dc = Math.sign(n.road[0][0] - n.road[n.road.length - 1][0]);
    const at = where === 'nook' ? { x: (n.note[0] + (dc > 0 ? 1 : -1)) * TILE + TILE / 2, y: (n.note[1] + 1) * TILE + 2 } : { x: (c + dc * 2) * TILE + TILE / 2, y: (r + 1) * TILE + 2 };
    if (!this.restoreWhereabouts({ continent: n.continent, level: 'surface', ...at })) return null;
    this.player.dir = 'side'; this.player.face = dc > 0 ? -1 : 1; this.path = [];
    this.placeCompanions();
    return n.id;
  }

  // ── The companions: the pet and Glim (td-pets.ts; the side view's API, so the play view's wiring just works) ──

  /** The pet following the Keeper, or null (none, or it rests at home). */
  setPet(pet: { id: string; name: string; hat: boolean; ability: PetAbility; role?: PetRole; move?: PetMove; second?: PetSecond | null; level?: number; command?: PetCommand } | null): void {
    // No pet: none follows — but a Thornstrider's spirit beast stays (it is his, not the pet card's).
    if (!pet) { if (this.pet?.spirit) return; if (this.pet) this.dropCarried(this.pet); this.pet = null; return; }
    const roles = petRole(pet.id);
    let b = this.pet && this.pet.id === pet.id ? this.pet : null;
    if (!b) {
      if (this.pet) this.dropCarried(this.pet);
      b = this.newPetBody(pet.id);
      this.pet = b;
      this.petBeside(b);
    }
    b.role = pet.role ?? roles?.role ?? 'combat';
    b.move = pet.move ?? roles?.move ?? 'bite';
    b.level = Math.max(1, pet.level ?? 1);
    b.command = pet.command ?? 'follow';
  }
  private newPetBody(id: string): PetBody {
    return {
      id, role: 'combat', move: 'bite', level: 1, command: 'follow', x: this.player.x, y: this.player.y, face: this.player.face, t: Math.random() * 3,
      doing: 'follow', moving: false, carried: null, goal: null, goalT: 0, skip: new Set(), cd: 0, nips: 0, stamina: PET_ACT.stamina, restT: 0, mendCd: 0, mendT: 0,
      feel: null, feelT: 0, hopT: 0, stuckT: 0, hurtT: 0, idleT: 0, lookT: 2, way: null, wayT: 0, hits: 0, gathers: 0, heals: 0,
    };
  }
  /**
   * The Thornstrider's beast (td-thorn.ts): with no pet following, a spirit beast of the wild stands in at his side — it
   * fights, nothing of it is booked to the pet card — and it goes back to the green when a real pet comes (or the class
   * is not his). Its level grows with the Keeper's.
   */
  private spiritBeast(): void {
    const thorn = this.mobs.thorn;
    // A moment's grace first: the host hands in the pet that follows just after the world comes up.
    if (thorn && !this.pet && this.time > 1.5) {
      const b = this.newPetBody(SPIRIT_BEAST);
      b.spirit = true; b.command = 'fight';
      this.pet = b;
      this.petBeside(b);
      this.mobs.effects.push({ kind: 'wild-call', x: b.x, y: b.y, age: 0, life: .7, dir: 1 });
      if (!this.spiritSaid) { this.spiritSaid = true; this.say('thorn.spirit'); }
    } else if (!thorn && this.pet?.spirit) this.pet = null;
    if (this.pet?.spirit) this.pet.level = spiritLevel(this.mobs.keeperLevel);
  }
  private spiritSaid = false;
  /** The Command count last seen: a new Command rouses a tired beast. */
  private commandSeen = 0;
  /** A pet's deed for the pet card (its XP, its lines) — never the spirit beast's. */
  private bookPet(b: PetBody, ev: Parameters<NonNullable<EngineOptions['onPet']>>[0]): void { if (!b.spirit) this.options.onPet?.(ev); }
  /** A feeling for the pet: a meal or a pat (a hop), love (hearts), its trick (a spin), a start. */
  petFeel(kind: 'happy' | 'love' | 'trick' | 'alert'): void {
    const b = this.pet;
    if (!b) return;
    b.feel = kind; b.feelT = kind === 'trick' ? 1 : 1.2; b.hopT = .4; b.idleT = 0;
  }
  /**
   * The loot & combat rules (shared/loot): the filter (a pet fetches the gear it shows), the worn aura the Loot sheet
   * runs (td-mobs setItemAura: what its card says, in this fight) and the difficulty tier (shared/loot/difficulty.model):
   * creatures rise with the tier's life and blow (td-mobs setTier), and its resist penalty comes off the Keeper's worn
   * resists before the cap (setKeeperBuild → fightStats). The armour runes' resists reach the fight through the worn
   * totals (side-scroller gearCombat). See docs/design/loot-and-combat.md §8.
   */
  private tier: DifficultyTier = 'normal';
  setCombatRules(rules: { filter: LootFilter; aura?: { id: AuraId; level: number } | null; tier?: DifficultyTier } | null): void {
    this.lootFilter = rules?.filter ?? 'all';
    this.mobs.setItemAura(rules?.aura ?? null);
    const tier = rules?.tier && DIFFICULTIES[rules.tier] ? rules.tier : 'normal';
    if (tier !== this.tier) { this.tier = tier; this.mobs.setTier(DIFFICULTIES[tier]); this.buildKey = ''; }
  }

  /** Glim (shown once the Keeper has met it); `arrive` flies it in from above, once. */
  setGlim(shown: boolean, arrive = false): void {
    if (shown && arrive) { this.glim.x = this.player.x - 60; this.glim.y = this.player.y - 140; }
    this.glim.shown = shown;
  }
  /** Show me: Glim flies to a place (a station by id, or a spot on this row) and back. The x it flies to, or null. */
  glimShowMe(target: { station: string } | { x: number }): number | null {
    if (!this.glim.shown) return null;
    let x: number | undefined, y = this.player.y;
    if ('station' in target) {
      let best = Infinity;
      for (const s of this.level.stalls) if (s.station.id === target.station) { const d = Math.hypot(s.x - this.player.x, s.y - this.player.y); if (d < best) { best = d; x = s.x; y = s.y; } }
    } else x = target.x;
    if (x === undefined || !Number.isFinite(x)) return null;
    this.glimPoint(x, y - 16, 2.4, true);
    return x;
  }
  setGlimBright(bright: boolean): void { this.glimBright = bright; }
  setGlimPowers(powers: { lamp: boolean; missed: boolean }): void { this.glimPowerSet = { ...powers }; }
  /** Glim's face for a while (glim-art.ts GlimMood). */
  glimMood(mood: GlimMood, seconds = 2.5): void { this.glimFeel = { mood, t: seconds }; }
  /** A level up: Glim darts to the Keeper's raised hand with a burst of sparks; the pet hops. */
  glimHighFive(): void {
    if (this.pet) this.petFeel('happy');
    if (!this.glim.shown) return;
    const x = this.player.x + this.player.face * 10, y = this.player.y - up(44);
    this.glimPoint(x, y, .7, false);
    this.glimMood('happy', 3);
    this.glimBurst(x, y, 10);
  }
  /** "Show me something": the nearest thing worth finding; Glim flies to it and a trail runs there. Null when nothing is near. */
  glimFind(point = true): { kind: 'room' | 'cabinet' | 'ore' | 'node' | 'drop'; x: number; y: number; dir: number; cells: number } | null {
    if (!this.glim.shown) return null;
    const spot = glimPointer(this.player, this.glimSpots(GLIM_TD.pointReach * 2), new Set(), GLIM_TD.pointReach * 2);
    if (!spot) return null;
    if (point) this.glimPoint(spot.x, spot.y - 14, 2.4, true);
    const kind = spot.kind === 'way' ? 'room' : spot.kind;
    return { kind, x: Math.round(spot.x), y: Math.round(spot.y), dir: Math.sign(spot.x - this.player.x) || 1, cells: Math.max(1, Math.round(Math.hypot(spot.x - this.player.x, spot.y - this.player.y) / TILE)) };
  }
  /** Nothing floats over the world in the top-down view (the HUD's Glim button is the way in). */
  glimScreen(): null { return null; }
  /** A few sparks where the host asks (catch-the-light). */
  glimSparkle(x: number, y: number): void { this.glimBurst(x, y, 6); }

  private glimMoodNow(): GlimMood { return this.glimFeel.t > 0 ? this.glimFeel.mood : glimIdle(this.stillT) === 'doze' ? 'sleepy' : 'calm'; }
  /** The lamp (the bond's power): in the dark, while the Keeper rests a moment, Glim's light opens wide. */
  private glimLamp(): boolean { return this.glimPowerSet.lamp && this.level.dark && this.stillT > 1.5; }

  /** Set the companions down beside the Keeper (arrival, a level change, a reload, a fall). */
  private placeCompanions(): void {
    this.glim.x = this.player.x - this.player.face * 14; this.glim.y = this.player.y - up(46);
    this.glimFlight = null; this.glimTrail = null;
    this.trail.length = 0;
    const b = this.pet;
    if (b) { b.carried = null; b.goal = null; b.skip.clear(); this.petBeside(b); }
  }
  /** Set the pet down at the Keeper's side (the nearest free spot to its follow spot, never in a wall). */
  private petBeside(b: PetBody): void {
    const s = followSpot(this.player), spot = standNear(this.level, s.x, s.y);
    const ok = footFree(this.level, spot.x, spot.y) && Math.hypot(spot.x - this.player.x, spot.y - this.player.y) < 48;
    b.x = ok ? spot.x : this.player.x; b.y = ok ? spot.y : this.player.y;
    b.stuckT = 0; b.way = null; b.wayT = 0; b.face = this.player.face;
  }
  /** Whatever it carries is set down where it stands. */
  private dropCarried(b: PetBody): void {
    if (b.carried && this.mobs.drops.includes(b.carried)) { b.carried.x = b.x; b.carried.y = b.y; }
    b.carried = null; b.goal = null;
  }
  private petFree(x: number, y: number): boolean { return footFree(this.level, x, y); }
  /** A straight line its feet can walk. */
  private petSees(ax: number, ay: number, bx: number, by: number): boolean {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 4);
    for (let i = 1; i <= n; i++) if (!this.petFree(ax + (bx - ax) * i / n, ay + (by - ay) * i / n)) return false;
    return true;
  }
  /** One step toward (tx, ty); true when there. It may cross the Keeper's own feet (his never stop on it). */
  private petStep(b: PetBody, tx: number, ty: number, speed: number, dt: number): boolean {
    const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
    if (d < 2) return true;
    const step = Math.min(d, speed * dt), vx = dx / d * step, vy = dy / d * step;
    let moved = false;
    if (this.petFree(b.x + vx, b.y)) { b.x += vx; moved = true; }
    if (this.petFree(b.x, b.y + vy)) { b.y += vy; moved = true; }
    b.stuckT = moved ? Math.max(0, b.stuckT - dt) : b.stuckT + dt;
    b.moving = moved;
    if (Math.abs(dx) > 1.5) b.face = dx < 0 ? -1 : 1;
    return false;
  }
  /** Walk toward a goal; when a wall stands between, by the newest of the Keeper's breadcrumbs it can see. */
  private petGo(b: PetBody, tx: number, ty: number, speed: number, dt: number): boolean {
    b.wayT -= dt;
    if (b.wayT <= 0) {
      b.wayT = .25; b.way = null;
      if (!this.petSees(b.x, b.y, tx, ty)) {
        for (let i = this.trail.length - 1; i >= 0; i--) {
          const p = this.trail[i];
          if (Math.hypot(p.x - b.x, p.y - b.y) > 3 && this.petSees(b.x, b.y, p.x, p.y)) { b.way = p; break; }
        }
      }
    }
    if (b.way) { if (this.petStep(b, b.way.x, b.way.y, speed, dt)) b.wayT = 0; return false; }
    return this.petStep(b, tx, ty, speed, dt);
  }

  /** The pet's step: lost → at his side; then its job (fight, fetch, mend), else following and idling cute. */
  private updatePet(dt: number): void {
    this.spiritBeast();
    const b = this.pet;
    // Pack Bond reads where the beast stands.
    this.mobs.beast = b ? { x: b.x, y: b.y } : null;
    if (!b) return;
    const k = this.player;
    this.petStand.update(k, dt, !!k.moving);
    b.t += dt; b.cd -= dt; b.mendCd -= dt;
    b.feelT = Math.max(0, b.feelT - dt); b.hopT = Math.max(0, b.hopT - dt); b.hurtT = Math.max(0, b.hurtT - dt); b.mendT = Math.max(0, b.mendT - dt);
    if (!b.feelT) b.feel = null;
    b.moving = false;
    this.layPetFetchTest();
    // A Thornstrider's beast: the spirit beast fights; Command sends any pet in, even one told to Stay or Play, and
    // rouses a tired one; otherwise every pet keeps its own job and fights beside him as well.
    const thorn = this.mobs.thorn, sent = thorn ? this.mobs.commanded : null;
    if (thorn && this.mobs.commands !== this.commandSeen) { this.commandSeen = this.mobs.commands; b.restT = 0; b.stamina = PET_ACT.stamina; b.hopT = .3; }
    const own = b.spirit ? 'fight' : tdPetJob(b.id, b.command), job = sent && (own === 'stay' || own === 'play') ? 'fight' : own;
    // Lost (a wall between, a long run): it steps out at his side, as the raised do. Told to Stay, it stays.
    if (job !== 'stay' && (pastLeash(b, k) || (b.stuckT > 1.2 && Math.hypot(b.x - k.x, b.y - k.y) > 3 * TILE))) {
      this.dropCarried(b); this.petBeside(b);
      this.mobs.effects.push({ kind: 'dust', x: b.x, y: b.y, age: 0, life: .4, dir: 1 });
    }
    // What it carries rides in its mouth; gone from the ground means the Keeper's own pick-up took it.
    if (b.carried && !this.mobs.drops.includes(b.carried)) { b.carried = null; this.petBrought(b); }
    if (b.carried) { b.carried.x = b.x + b.face * 7; b.carried.y = b.y - 1; }
    if (b.goal && !this.mobs.drops.includes(b.goal)) b.goal = null;
    const far = Math.hypot(b.x - k.x, b.y - k.y);
    const run = TD_PET.speed * (this.mobs.haste > 0 ? 1.5 : 1) * (1 + this.agility) * (1 + this.levelPace) * (far > 40 ? TD_PET.catchUp : 1);
    // mend: a pulse of life in a fight (the Sunling); it keeps following while it shines.
    if (job === 'mend' && b.mendCd <= 0) {
      const heal = mendPulse(this.hp, this.maxHp, this.time - this.lastHurt < 4);
      if (heal) {
        this.hp = Math.min(this.maxHp, this.hp + heal);
        b.mendCd = PET_ACT.pulseRest; b.mendT = .9; b.heals++;
        this.mobs.effects.push({ kind: 'heal', x: k.x, y: k.y, age: 0, life: .7, dir: 1 });
        this.mobs.floaters.push({ x: k.x, y: k.y - 34, text: `+${heal}`, color: '#7fe08a', age: 0 });
        this.bookPet(b, { kind: 'heal' });
      }
    }
    // Tired: it rests behind him a moment, then comes back to it (a pet never dies).
    if (b.restT > 0) {
      b.restT -= dt; b.doing = 'rest';
      const s = followSpot(k);
      if (Math.hypot(s.x - k.face * 8 - b.x, s.y - b.y) > 4 && (k.moving || far > 30)) this.petGo(b, s.x - k.face * 8, s.y, run, dt);
      return;
    }
    if (job === 'stay') { b.idleT += dt; b.doing = b.idleT > TD_PET.sleepAfter ? 'sleep' : 'stay'; return; }
    const tell = bossTelling(k, this.mobs.mobs);
    if ((job === 'fight' || (thorn && job !== 'play')) && !tell && this.petFight(b, run, dt)) return;
    if (job === 'fetch' && !tell && this.petFetch(b, run, dt)) return;
    if (b.carried) { this.dropCarried(b); }
    // Following: at his side — behind him, away from a boss winding up — and idling cute when he stands still.
    // td-roam: while he stands still (and has not called it) it strolls 3-8 tiles round him, sniffs, and strolls on.
    // The pet itself does not stroll: with nothing to hunt near (petFight above takes a foe within the roam range), it
    // comes back, sits and naps, every time (owner's cute idle; the e2e's sit-then-nap). The Thornstrider's spirit
    // beast, a hunter, strolls a while, then settles at his side too.
    const rm = tell || job === 'play' || !thorn || this.petStand.still > PET_SETTLE ? null : stepRoam(this.petRoam, {
      me: b, keeper: k, stand: this.petStand, dt, foe: null, called: this.mobs.heeling,
      free: (x, y) => this.petFree(x, y), sees: (ax, ay, bx, by) => this.petSees(ax, ay, bx, by), rng: Math.random,
    });
    if (rm?.mode === 'roam' && rm.goal) {
      this.petGo(b, rm.goal.x, rm.goal.y, run * rm.pace / (far > 40 ? TD_PET.catchUp : 1), dt);
      // A stroll while he rests is still his rest: its nap clock keeps running (it naps once it has settled).
      b.doing = b.mendT > 0 ? 'mend' : 'follow'; b.idleT += dt;
      return;
    }
    let spot = followSpot(k);
    if (tell) {
      const d = Math.max(1, Math.hypot(k.x - tell.x, k.y - tell.y)), away = { x: k.x + (k.x - tell.x) / d * 20, y: k.y + (k.y - tell.y) / d * 10 + 2 };
      if (footFree(this.level, away.x, away.y)) spot = away;
    }
    if (job === 'play' && this.stillT > 1) {
      const a = b.t * 1.3;
      spot = { x: k.x + Math.cos(a) * 24, y: k.y + 6 + Math.sin(a) * 9 };
      if (!footFree(this.level, spot.x, spot.y)) spot = followSpot(k);
      if (b.hopT <= 0 && Math.random() < dt * .8) b.hopT = .4;
      this.petGo(b, spot.x, spot.y, run * .7, dt); b.doing = 'play'; b.idleT = 0;
      return;
    }
    const gap = Math.hypot(spot.x - b.x, spot.y - b.y);
    if (rm?.mode !== 'roam' && gap > 3 && (k.moving || gap > 12 || tell)) {
      this.petGo(b, spot.x, spot.y, run, dt);
      b.doing = b.mendT > 0 ? 'mend' : 'follow'; b.idleT = 0;
      return;
    }
    b.idleT += dt;
    const pose = idlePose(Math.min(this.stillT, b.idleT));
    b.doing = b.mendT > 0 ? 'mend' : job === 'play' ? 'play' : pose;
    // Looking round now and then, and once in a while a happy little hop.
    b.lookT -= dt;
    if (b.lookT <= 0 && pose !== 'sleep') {
      b.lookT = 2.4 + Math.random() * 3.2;
      b.face = Math.random() < .55 ? (k.x < b.x ? -1 : 1) : (k.x < b.x ? 1 : -1);
      if (Math.random() < .25) b.hopT = .4;
    }
  }
  /** The Keeper calls his companions back to heel for a while (the pet card's Follow / Fight): no roaming, back to the formation. */
  callCompanions(): void { this.mobs.callBack(); }
  /** fight: nip the foe at the Keeper's side; true while it is in a fight. */
  private petFight(b: PetBody, run: number, dt: number): boolean {
    // A Thornstrider's commanded foe first, wherever it is within the command's reach; else the nearest at his side.
    const sent = this.mobs.thorn ? this.mobs.commanded : null;
    // Calm (he stands still, no call): it hunts what it can see within the roam range of him (td-roam).
    const roamy = this.petStand.calm && !this.mobs.heeling;
    const foe = sent && Math.hypot(sent.x - this.player.x, sent.y - this.player.y) <= THORN_PET.commandReach ? sent
      : roamy ? pickNipTarget(this.player, this.mobs.target, this.mobs.mobs, ROAM.huntR, ROAM.huntR, m => this.petSees(b.x, b.y, m.x, m.y)) : pickNipTarget(this.player, this.mobs.target, this.mobs.mobs);
    if (!foe) return false;
    b.doing = 'fight'; b.idleT = 0;
    const side = b.x < foe.x ? -1 : 1, reach = TD_PET.reach + foe.def.w / 4;
    if (Math.hypot(foe.x - b.x, foe.y - b.y) > reach) { this.petGo(b, foe.x + side * (foe.def.w / 4 + 6), foe.y + 2, run * 1.1, dt); return true; }
    b.face = foe.x < b.x ? -1 : 1;
    if (b.cd > 0) return true;
    const blow = petBlow(b.move, b.role === 'combat', b.level);
    const hit = this.mobs.petBite(foe, blow.dmg, b.face, b);
    b.cd = this.mobs.thorn ? thornPetRest(blow.rest, foe === sent) : blow.rest;
    if (!hit.landed) return true;
    b.hits++; b.nips++; b.hopT = .25;
    this.bookPet(b, { kind: 'hit', move: b.role === 'combat' ? b.move : 'bite', killed: hit.killed });
    // Every few nips the foe snaps back: it costs the pet stamina, never life; tired, it rests behind the Keeper.
    if (!hit.killed && b.nips % PET_ACT.aggroEvery === 0) {
      // Pack Bond shares the blow: the beast tires less while it holds.
      b.stamina -= this.mobs.bonded ? bondShare(PET_ACT.blowCost, this.mobs.v('pack-bond')['guard']) : PET_ACT.blowCost; b.hurtT = .3;
      if (b.stamina < PET_ACT.tiredAt) { b.stamina = PET_ACT.stamina; b.restT = TD_PET.restFor; this.bookPet(b, { kind: 'tired' }); }
    }
    return true;
  }
  /** fetch: carry a drop lying near back to the Keeper's feet; true while it is fetching or carrying. */
  private petFetch(b: PetBody, run: number, dt: number): boolean {
    const k = this.player;
    if (b.carried) {
      b.doing = 'carry'; b.idleT = 0;
      if (this.petGo(b, k.x + k.face * 4, k.y + 1, run, dt) || Math.hypot(b.x - k.x, b.y - k.y) < 12) {
        // At his feet: set down where his own pick-up takes it (the Satchel's rules); if it stays (a full satchel), let it be.
        const g = b.carried;
        g.x = k.x; g.y = k.y; b.skip.add(g.id); b.carried = null;
        this.petBrought(b);
      }
      return true;
    }
    if (b.goal && b.goalT > TD_PET.fetchGiveUp) { b.skip.add(b.goal.id); b.goal = null; }
    // The nearest drop it can walk straight to (a drop behind a wall or across water is left for the Keeper).
    for (let tries = 0; !b.goal && tries < 4; tries++) {
      const own = tdPetJob(b.id, 'follow') === 'fetch';
      const g = pickFetchTarget(k, this.mobs.drops, own ? TD_PET.fetchReach : TD_PET.gatherReach, this.lootFilter, b.skip);
      if (!g) break;
      if (this.petSees(b.x, b.y, g.x, g.y) || this.petSees(k.x, k.y, g.x, g.y)) b.goal = g; else b.skip.add(g.id);
      b.goalT = 0;
    }
    const g = b.goal;
    if (!g) return false;
    b.doing = 'fetch'; b.idleT = 0; b.goalT += dt;
    if (this.petGo(b, g.x, g.y, run * 1.15, dt) || Math.hypot(g.x - b.x, g.y - b.y) < 6) { b.carried = g; b.goal = null; b.hopT = .25; }
    return true;
  }
  /** A fetch delivered: pet XP (as a gather), a happy hop. */
  private petBrought(b: PetBody): void {
    b.gathers++;
    this.bookPet(b, { kind: 'gather' });
    this.petFeel('happy');
  }
  /** E2E only: two real materials a few steps off the Keeper, once per level, for the pet to fetch. */
  private layPetFetchTest(): void {
    if (!this.petFetchTest || this.petFetchLaid === this.level || this.time < 1.5) return;
    this.petFetchLaid = this.level;
    const k = this.player;
    let laid = 0;
    // Two spots a few steps off that a pet can walk straight to from the Keeper.
    for (const [dx, dy] of [[0, 64], [0, -64], [64, 0], [-64, 0], [48, 48], [-48, 48], [48, -48], [-48, -48]]) {
      if (laid >= 2) break;
      const x = k.x + dx, y = k.y + dy;
      if (!footFree(this.level, x, y) || !this.petSees(k.x, k.y, x, y)) continue;
      this.mobs.layDrop(`pet-fetch-test:${laid}:${Math.round(this.time * 10)}`, x, y, laid ? 'cinder-ore' : 'ember-residue', 1, laid ? 'cinder ore' : 'ember residue');
      laid++;
    }
  }

  /** Glim's step: a boss's tell (a flash), pointing out a find, a curious dart, else its idle place by the Keeper. */
  private updateGlim(dt: number): void {
    const g = this.glim, k = this.player;
    this.glimFeel.t = Math.max(0, this.glimFeel.t - dt);
    this.glimFlashT = Math.max(0, this.glimFlashT - dt);
    for (const s of this.sparks) { s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 40 * dt; }
    this.sparks = this.sparks.filter(s => s.age < s.life);
    if (this.glimTrail && (this.glimTrail.t -= dt) <= 0) this.glimTrail = null;
    if (this.seekArrow && (this.seekArrow.t -= dt) <= 0) this.seekArrow = null;
    if (!g.shown) return;
    // A boss winding up: a quick flash and a gasp, once per tell (bosses' tells win over every flourish: no find now).
    const tell = bossTelling(k, this.mobs.mobs, GLIM_TD.pointReach * 1.3);
    const tk = tell ? tell.key : '';
    if (tell && tk !== this.glimTellKey) { this.glimFlashT = .45; this.glimMood('gasp', 1.4); this.glimFlight = null; }
    this.glimTellKey = tk;
    // Something worth finding nearby (never mid-fight): a hop toward it, a sparkle, maybe a word.
    this.glimPointT -= dt;
    if (this.glimPointT <= 0 && !this.glimFlight && !tell) {
      this.glimPointT = 1;
      if (!this.mobs.target && this.time - this.lastHurt > 5) {
        const spot = glimPointer(k, this.glimSpots(GLIM_TD.pointReach), this.glimTold);
        if (spot) {
          this.glimTold.add(spot.id);
          this.glimPointT = GLIM_TD.pointGap;
          this.glimPoint(spot.x, spot.y - 14, 1.6, true);
          this.glimMood('curious', 2.5);
          this.options.onGlimCue?.(spot.kind === 'drop' ? { kind: 'missed' } : { kind: 'spotted' });
        }
      }
    }
    const idle = glimIdle(this.stillT);
    // A summer night and the Keeper resting: now and then a curious dart toward the fireflies in a tree.
    this.glimDartT -= dt;
    if (this.glimDartT <= 0 && !this.glimFlight) {
      this.glimDartT = 9 + Math.random() * 8;
      if (idle !== 'shoulder' && this.level === this.world && Math.max(this.darkness, this.dusk * .6) > .35) {
        let tree: TdObject | null = null, bd = 110;
        for (const o of this.visible) if (o.kind === 'tree') { const d = Math.hypot(o.x - k.x, o.y - k.y); if (d < bd) { bd = d; tree = o; } }
        if (tree) this.glimPoint(tree.x + (Math.random() - .5) * 20, tree.y - 24 - Math.random() * 10, .9, false);
      }
    }
    // Where it goes: the flight's leg, else its idle place (the shoulder, an orbit, a doze).
    const home = idle === 'orbit'
      ? { x: k.x + Math.cos(this.time * 1.1) * 24, y: k.y - 30 + Math.sin(this.time * 1.1) * 9 }
      : idle === 'doze' ? { x: k.x - k.face * 9, y: k.y - 38 + Math.sin(this.time * 1.2) }
      : { x: k.x - k.face * 14, y: k.y - up(46) + Math.sin(this.time * 2.4) * 3 };
    let tx = home.x, ty = home.y, rate = 4;
    const f = this.glimFlight;
    if (f) {
      if (f.phase === 'out') {
        tx = f.x; ty = f.y; rate = 6;
        if (Math.hypot(g.x - f.x, g.y - f.y) < 4 || this.still) { f.phase = 'hold'; this.glimBurst(f.x, f.y, 6); }
      } else if (f.phase === 'hold') {
        // The little hop over what it found.
        tx = f.x; ty = f.y - (this.still ? 0 : Math.abs(Math.sin(this.time * 7)) * 4); rate = 10;
        if ((f.hold -= dt) <= 0) f.phase = 'back';
      } else if (Math.hypot(g.x - home.x, g.y - home.y) < 6) this.glimFlight = null;
    }
    // Reduced motion: no travel — it simply sits where it is going.
    if (this.still) { g.x = tx; g.y = ty; return; }
    g.x += (tx - g.x) * Math.min(1, dt * rate);
    g.y += (ty - g.y) * Math.min(1, dt * rate);
  }
  // ── Lumvesh, the Seek (design-bible §4.6, §5.5; td-seek.ts) ────────────────────────────────────────────────────

  /** The worn uniques and set tiers (the host hands in their ids): their signatures reach the fight (boss-uniques.ts, unique-items.ts). */
  private relicKey = '';
  setRelics(ids: readonly string[]): void {
    const key = [...ids].sort().join(',');
    if (key === this.relicKey) return;
    this.relicKey = key;
    this.mobs.setRelics(relicTotals(ids, relicSigOf));
  }
  /** The weapon in hand (strike + spell damage, or null for bare hands): the Ashguard's swing reads it (td-melee weaponSwing). */
  setWeapon(w: HeldWeapon | null): void { this.mobs.weaponSwing = weaponSwing(w); }
  /** The arrow Glim leaves after a Seek: which way, the floor, and the seconds it still holds. */
  private seekArrow: { dir: SeekReading['dir']; floor: SeekReading['floor']; t: number; life: number } | null = null;
  /** A typed "lum vesh <name>": the name the next Seek looks for (null: the nearest). */
  private seekName: string | null = null;
  private seekLinks: Map<string, LevelLink> | null = null;
  /** Seek a named one (a boss, a task giver, "purse"), or the nearest with null: the spell, its mana and cooldown. */
  seekFor(name: string | null): ReturnType<MobSystem['useAbility']> {
    this.seekName = name && name.trim() ? name.trim().toLowerCase() : null;
    try { return this.useAbility('seek'); } finally { this.seekName = null; }
  }
  /** Every hand-drawn level's way in and floor: every continent's caves, mine shaft and doors (td-seek.ts), once. */
  private levelLinks(): Map<string, LevelLink> {
    this.seekLinks ??= levelLinks([...wayEntries(CONTINENTS, LEVELS), ...townEntries(CONTINENTS, LEVELS, DOORS)], LEVELS);
    return this.seekLinks;
  }
  /** Where a point of a level (or the surface, `level` null) lies for the Seek. */
  private seekPlace(continent: string, level: string | null, x: number, y: number): SeekPlace {
    if (!level) return { continent, level: null, x, y, floor: 0, ax: x, ay: y };
    const l = this.levelLinks().get(level);
    return l ? { continent: l.continent, level, x, y, floor: l.floor, ax: l.ax, ay: l.ay } : { continent, level, x, y, floor: 0, ax: x, ay: y };
  }
  /** What the Seek can point at: the fallen purse, every boss in its hall, every task giver with a task to hand in. */
  private seekTargets(): { kind: 'boss' | 'quest' | 'purse' | 'story' | 'party' | 'harbour'; id: string; name: string; place: SeekPlace }[] {
    const out: { kind: 'boss' | 'quest' | 'purse' | 'story' | 'party' | 'harbour'; id: string; name: string; place: SeekPlace }[] = [];
    // The piers of this continent: sought by "harbour" or the Harbourmaster's name, never the nearest-of-anything default.
    for (const k of this.keepers) if (k.kid && pierOfMaster(k.kid)) out.push({ kind: 'harbour', id: 'harbour', name: k.name ?? k.kid, place: this.seekPlace(this.world.continent, null, k.x, k.y) });
    // Party members (protocol 3), sought by name ("lum vesh Mira"): their area is a continent's surface or a floor's id.
    for (const m of this.peers.partyWhere()) {
      const link = this.levelLinks().get(m.area);
      const place = link ? this.seekPlace(link.continent, m.area, m.x, m.y) : CONTINENTS[m.area] ? this.seekPlace(m.area, null, m.x, m.y) : null;
      if (place) out.push({ kind: 'party', id: m.id, name: m.name, place });
    }
    const pu = this.purse, m = pu ? /^td:([^|]+)\|(.+)$/.exec(pu.area) : null;
    if (pu && m) out.push({ kind: 'purse', id: 'purse', name: 'purse', place: this.seekPlace(m[1], m[2] === 'surface' ? null : m[2], pu.x, pu.y) });
    for (const b of levelSpawns(LEVELS, id => MOBS[id]?.rank === 'boss')) {
      if (!this.levelLinks().has(b.level)) continue;
      out.push({ kind: 'boss', id: b.mob, name: MOBS[b.mob].name, place: this.seekPlace(this.world.continent, b.level, b.x, b.y) });
    }
    for (const k of this.keepers) if (k.kid && this.taskMarks[k.kid] === '?') out.push({ kind: 'quest', id: k.kid, name: k.name ?? k.kid, place: this.seekPlace(this.world.continent, null, k.x, k.y) });
    // The Sexton's Count under way: where its next step is (the name is the chain's own words, an i18n key).
    const ss = seekSpot(this.sexton.step);
    if (ss?.spot) out.push({ kind: 'story', id: ss.target, name: `sexton.seek.${ss.target}`, place: this.seekPlace(SEXTON_CONTINENT, ss.spot.level, ss.spot.x, ss.spot.y) });
    else if (ss && this.world.continent === SEXTON_CONTINENT) {
      const wren = this.keepers.find(k => k.kid === 'sexton-wren');
      if (wren) out.push({ kind: 'story', id: ss.target, name: `sexton.seek.${ss.target}`, place: this.seekPlace(SEXTON_CONTINENT, null, wren.x, wren.y) });
    }
    return out;
  }
  /**
   * The Seek goes off: the purse first (a fall is the thing to set right), else the nearest boss or task, or the one
   * named. Glim flies a short leg that way and leaves pixel arrows; the host says the words. False: nothing to seek.
   */
  private seekNow(secs: number): boolean {
    const here = this.seekPlace(this.world.continent, this.level === this.world ? null : this.level.id, this.player.x, this.player.y);
    const all = this.seekTargets().map(t => ({ ...t, r: seekReading(here, t.place) }));
    const name = this.seekName;
    let pick: (typeof all)[number] | undefined;
    if (name) {
      const bare = (s: string) => s.toLowerCase().replace(/^the\s+/, '').replace(/['’]/g, '');
      const want = bare(name);
      const named = /^(purse|bolsa|monedero)$/.test(want) ? all.filter(t => t.kind === 'purse') : all.filter(t => t.kind !== 'purse' && t.kind !== 'story' && (bare(t.name).includes(want) || t.id === want));
      pick = named.sort((a, b) => seekCost(a.r) - seekCost(b.r))[0];
      if (!pick) { this.options.onSeek?.({ kind: 'unknown', id: '', name, dir: null, band: 'veryFar', floor: 'here', sea: false }); return false; }
    } else {
      // The purse first (a fall to set right), then the story's next place (the chain under way), then the nearest.
      pick = all.find(t => t.kind === 'purse') ?? all.find(t => t.kind === 'story') ?? all.filter(t => t.kind !== 'purse' && t.kind !== 'party' && t.kind !== 'harbour').sort((a, b) => seekCost(a.r) - seekCost(b.r))[0];
    }
    if (!pick) return false;
    const r = pick.r;
    this.seekArrow = { dir: r.dir, floor: r.floor, t: secs, life: secs };
    // Glim flies a short leg that way (design-bible §5.5), a hop over the spot, and back.
    const v = seekVector(r.dir), p = this.player;
    if (v) this.glimPoint(p.x + v.x * 46, p.y - 26 + v.y * 34, 1.2, true);
    else this.glimBurst(p.x, p.y - 30, 8);
    this.glimMood('curious', 2.5);
    this.options.onSeek?.({ kind: pick.kind, id: pick.id, name: pick.name, dir: r.dir, band: r.band, floor: r.floor, sea: r.sea });
    return true;
  }
  // ── The prologue's pointer (td-prologue.ts): Glim's chevrons toward what the step asks for ──────────────────────

  /** What the prologue points at ('hearth' | 'foe' | 'gold' | 'sexton'), and where that is now (null: nothing near). */
  private guideKind: string | null = null;
  private guideAt: { x: number; y: number; station?: string; foe?: Mob } | null = null;
  private guideScan = 0;
  /** The prologue's step wants Glim's chevrons on one kind of thing (null: none). */
  setGuide(kind: string | null): void {
    if (kind === this.guideKind) return;
    this.guideKind = kind; this.guideAt = null; this.guideScan = 0;
    this.canvas.setAttribute('data-guide', kind ?? '');
  }
  /**
   * Show me from far off: when the step's thing is more than GUIDE_FAR_TILES away, Glim only points (its
   * chevrons stay up) and the distance in tiles comes back; 0 means close enough to just walk there.
   */
  guideFar(): number {
    if (!this.guideKind || this.paused) return 0;
    const at = this.findGuide(this.guideKind);
    if (!at) return 0;
    const tiles = Math.hypot(at.x - this.player.x, at.y - this.player.y) / TILE;
    if (tiles <= GUIDE_FAR_TILES) return 0;
    this.guideAt = at;
    if (this.glim.shown) this.glimPoint(this.player.x + (at.x - this.player.x) / tiles * 5, this.player.y + (at.y - this.player.y) / tiles * 5 - 16, 1.8, true);
    return Math.round(tiles);
  }
  /** Show me (the prologue): walk to the thing and use it — light the hearth, talk to the Sexton, close in on the creature, step on the coins. */
  guideGo(): boolean {
    if (!this.guideKind || this.paused) return false;
    const at = this.findGuide(this.guideKind);
    if (!at) return false;
    if (this.glim.shown) this.glimPoint(at.x, at.y - 16, 1.8, true);
    if (at.station) return this.goToStation(at.station);
    if (at.foe) { this.mobs.target = at.foe; this.chaseTimer = 0; return true; }
    return this.walkTo(at.x, at.y);
  }
  private updateGuide(dt: number): void {
    if (!this.guideKind || (this.guideScan -= dt) > 0) return;
    this.guideScan = .4;
    this.guideAt = this.findGuide(this.guideKind);
    const where = this.guideAt ? `${Math.round(this.guideAt.x)},${Math.round(this.guideAt.y)}` : '';
    if (this.canvas.getAttribute('data-guide-at') !== where) this.canvas.setAttribute('data-guide-at', where);
  }
  /** The nearest thing of a kind on this level (a creature not yet loaded: the nearest spawn of the surface round). */
  private findGuide(kind: string): { x: number; y: number; station?: string; foe?: Mob } | null {
    const p = this.player;
    let best: { x: number; y: number; station?: string; foe?: Mob } | null = null, bd = Infinity;
    const near = (x: number, y: number, extra: { station?: string; foe?: Mob } = {}) => { const d = Math.hypot(x - p.x, y - p.y); if (d < bd) { bd = d; best = { x, y, ...extra }; } };
    if (kind === 'hearth' || kind === 'sexton') {
      for (const st of this.level.stalls) {
        const id = st.station.id;
        if (kind === 'sexton' ? id === 'giver-sexton-wren' : id.startsWith('hearth:') && !this.hearthLit.has(id)) near(st.x, st.y, { station: id });
      }
    } else if (kind === 'gold') {
      for (const d of this.mobs.drops) if (d.coins > 0) near(d.x, d.y);
      if (!best) return this.findGuide('foe');
    } else if (kind === 'foe') {
      for (const m of this.mobs.mobs) if (m.hp > 0 && m.def.rank !== 'boss') near(m.x, m.y, { foe: m });
      if (!best && this.level === this.world) for (const sp of this.world.spawnsIn(p.x - 1400, p.y - 1400, p.x + 1400, p.y + 1400)) near(sp.x, sp.y);
    }
    return best;
  }
  /** The prologue's chevrons, Seek-style, while the thing is more than a few tiles off (and no Seek is showing). */
  private guideArrow(): { dir: SeekReading['dir']; floor: SeekReading['floor']; t: number; life: number } | null {
    const at = this.guideAt;
    if (!at || this.paused) return null;
    const dx = at.x - this.player.x, dy = at.y - this.player.y;
    if (Math.hypot(dx, dy) < TILE * 4) return null;
    return { dir: compass(dx, dy), floor: 'here', t: .5, life: 10 };
  }

  /** The Seek's arrows (air layer, over the dark): a lamp-toned chevron walking out from the Keeper, a floor mark. */
  private drawSeek(): void {
    const a = this.seekArrow ?? this.guideArrow();
    if (!a || a.t <= 0) return;
    const c = this.ctx, p = this.player, cx = Math.round(p.x), cy = Math.round(p.y - 16);
    const fade = Math.min(1, a.t / .6, (a.life - a.t) / .2 + .2);
    const v = seekVector(a.dir);
    const dot = (x: number, y: number, col: string) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), 1, 1); };
    c.globalAlpha = fade;
    if (v) {
      // Three chevrons stepping outward along the way, each arm a line of 2-px blocks with a dark edge under it
      // (still under reduced motion: all three at rest).
      const k = this.still ? 0 : (this.time * 1.4) % 1, nx = -v.y, ny = v.x;
      const block = (x: number, y: number, col: string) => { c.fillStyle = col; c.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2); };
      for (let i = 0; i < 3; i++) {
        const d = 24 + i * 12 + k * 12, x = cx + v.x * d, y = cy + v.y * d, tone = i === 0 ? LEVEL_UP.core : i === 1 ? LEVEL_UP.body : LEVEL_UP.edge;
        c.globalAlpha = fade * (i === 2 ? 1 - k * .6 : 1);
        for (const pass of [0, 1]) for (let j = 0; j <= 5; j++) {
          const ox = pass ? 0 : 1, oy = pass ? 0 : 1, col = pass ? tone : HOSTILE_EDGE;
          block(x - v.x * j * 1.4 + nx * j * 1.4 + ox, y - v.y * j * 1.4 + ny * j * 1.4 + oy, col);
          block(x - v.x * j * 1.4 - nx * j * 1.4 + ox, y - v.y * j * 1.4 - ny * j * 1.4 + oy, col);
        }
      }
      c.globalAlpha = fade;
    } else {
      // Beside you (or across the sea): a ring of lamp pixels round the Keeper's feet.
      for (const q of circlePixels(14)) if ((q.x + q.y) % 3 === 0) dot(cx + q.x, p.y + q.y * .5, LEVEL_UP.body);
    }
    // The floor: a small stair mark over the head, pointing down (below) or up (above).
    if (a.floor !== 'here') {
      // A stepped triangle of 2-px blocks, a dark edge under it.
      // Beside the first chevron, off its side (above the head when there is no way to point).
      const up = a.floor === 'above', hx = Math.round(v ? cx + v.x * 28 + v.y * 15 : cx), hy = Math.round(v ? cy + v.y * 28 - v.x * 15 - 3 : cy - 38);
      for (const pass of [0, 1]) for (let row = 0; row < 3; row++) for (let col = -row; col <= row; col++) {
        const y = up ? hy + row * 2 : hy + (2 - row) * 2;
        c.fillStyle = pass ? (row === 0 ? LEVEL_UP.core : LEVEL_UP.body) : HOSTILE_EDGE;
        c.fillRect(hx + col * 2 - 1 + (pass ? 0 : 1), y + (pass ? 0 : 1), 2, 2);
      }
    }
    c.globalAlpha = 1;
  }
  /** Glim flies to (x, y), hovers `hold` seconds, and comes back; `trail` runs a short line of light there. */
  private glimPoint(x: number, y: number, hold: number, trail: boolean): void {
    this.glimFlight = { x, y, phase: 'out', hold };
    if (trail) this.glimTrail = { x, y: y + 14, t: 3.5 };
  }
  /** A small burst of Glim's sparks (spec: 6–10 pixels flying out then falling; the whole lot capped at 16). */
  private glimBurst(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * .4, v = this.still ? 0 : 22 + Math.random() * 18;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 14, age: 0, life: this.still ? .35 : .5 + Math.random() * .25, col: i % 3 ? '#ffd98a' : '#c9a6ff' });
    }
    if (this.sparks.length > 16) this.sparks.splice(0, this.sparks.length - 16);
  }
  /** What Glim may point out here: drops left lying, ore seams, ways down not yet taken (not a house's door). */
  private glimSpots(reach: number): GlimSpot[] {
    const k = this.player, lv = this.level, out: GlimSpot[] = [];
    const near = (x: number, y: number) => Math.abs(x - k.x) < reach && Math.abs(y - k.y) < reach;
    for (const g of this.mobs.drops) if (!g.coins && g.age > 2.5 && near(g.x, g.y) && this.pet?.carried !== g && this.pet?.goal !== g) out.push({ id: `drop:${g.id}`, kind: 'drop', x: g.x, y: g.y });
    for (const s of lv.stalls) {
      if (!near(s.x, s.y)) continue;
      const id = s.station.id;
      if (id === 'ore') { out.push({ id: `ore:${lv.id}:${Math.round(s.x)},${Math.round(s.y)}`, kind: 'ore', x: s.x, y: s.y }); continue; }
      const to = this.wayTo(id);
      if (to && !this.levels.has(to)) out.push({ id: `way:${lv.id}:${id}`, kind: 'way', x: s.x, y: s.y });
    }
    return out;
  }
  /** The level a way leads to (a mine shaft, a cave mouth, a stair), or null (a house door, a ship, a stall). */
  private wayTo(id: string): string | null {
    if (this.level === this.world) {
      if (id === 'delve') return 'ember-mine-1';
      const w = this.world.ways.get(id);
      return w && !w.ship ? w.to : null;
    }
    if (this.level instanceof HandLevel) { const e = this.level.exits.get(id); return e && e.to !== 'surface' ? e.to : null; }
    return null;
  }

  /** The pet: its frame by what it is doing, a hover for a flier, what it carries, a nap's z, a feeling. */
  private drawPet(b: PetBody): void {
    const sheet = petSheet(b.id);
    if (!sheet) return;
    const c = this.ctx, x = Math.round(b.x), y = Math.round(b.y), calm = this.still;
    const resting = b.doing === 'sleep' || b.doing === 'rest';
    const fly = TD_PET_FLIES.has(b.id) && !resting;
    const frame: TdPetFrame = this.petFrame(b);
    const hop = !calm && (frame === 'happy' || b.hopT > 0) ? -Math.round(Math.abs(Math.sin(b.t * 11)) * 3) : 0;
    const hover = fly ? -Math.round(2 + (calm ? 0 : Math.sin(b.t * 3) * 1.5)) : 0;
    // A blow it took: it blinks (never a body flash over the floor).
    if (b.hurtT > 0 && Math.floor(b.hurtT * 20) % 2) return;
    c.save();
    c.translate(x, y - PET_H + 1 + hop + hover);
    if (b.face < 0) c.scale(-1, 1);
    // The art-direction prototype (td-artopt.ts B/C): the shade-kit in HD.
    if (optHdFigures() && b.id === HD_PET_ID && envDetail() !== 'low') { const P = HD_PET; c.drawImage(hdPetSheet(), hdPetFrameIndex(frame) * P.w, 0, P.w, P.h, -P.w / 4, PET_H - P.h / 2 + 1, P.w / 2, P.h / 2); }
    else c.drawImage(sheet, petFrameIndex(frame) * PET_W, 0, PET_W, PET_H, -PET_W / 2, 0, PET_W, PET_H);
    c.restore();
    // What it carries, in its mouth: a sack, a coin, or the gear's own colour.
    const g = b.carried;
    if (g) {
      const gx = Math.round(g.x) - 1, gy = y - 9 + hop + hover, rung = rungOf(g);
      c.fillStyle = PAL.outline; c.fillRect(gx - 1, gy - 1, 5, 5);
      c.fillStyle = g.coins ? '#ffd25a' : rung ? LOOT[rung].body : '#b07a44'; c.fillRect(gx, gy, 3, 3);
      c.fillStyle = '#fff4dc'; c.fillRect(gx, gy, 1, 1);
    }
    // A nap: a small pixel z drifting up. Love: a heart. Tired: a sweat drop.
    if (resting) {
      const t = calm ? .3 : (b.t % 1.6) / 1.6, zx = x + b.face * 4 + 3, zy = y - 15 - Math.round(t * 6);
      c.globalAlpha = 1 - t * .7; c.fillStyle = b.doing === 'rest' ? '#9fd8ff' : '#f3e7cf';
      c.fillRect(zx, zy, 3, 1); c.fillRect(zx + 1, zy + 1, 1, 1); c.fillRect(zx, zy + 2, 3, 1);
      c.globalAlpha = 1;
    }
    if (b.feel === 'love' || b.feel === 'happy') {
      const hy = y - 22 - Math.round((1.2 - b.feelT) * 5), hx = x - 2;
      c.globalAlpha = Math.min(1, b.feelT * 2); c.fillStyle = '#ff7aa8';
      c.fillRect(hx, hy, 2, 1); c.fillRect(hx + 3, hy, 2, 1); c.fillRect(hx, hy + 1, 5, 1); c.fillRect(hx + 1, hy + 2, 3, 1); c.fillRect(hx + 2, hy + 3, 1, 1);
      c.globalAlpha = 1;
    }
  }
  private petFrame(b: PetBody): TdPetFrame {
    if (b.doing === 'sleep' || b.doing === 'rest') return b.doing === 'rest' && b.moving ? (`walk${Math.floor(b.t * 6) % 4}` as TdPetFrame) : 'sleep';
    if (b.feel || b.hopT > 0) return b.feel === 'trick' ? (Math.floor(b.t * 8) % 2 ? 'happy' : 'sit1') : 'happy';
    if (b.moving) return `walk${Math.floor(b.t * (b.doing === 'fight' || b.doing === 'fetch' ? 11 : 8)) % 4}` as TdPetFrame;
    if (b.doing === 'fight') return b.cd > .8 ? 'walk1' : 'walk0';
    if (b.doing === 'sit' || b.doing === 'stay' || b.doing === 'mend' || b.doing === 'play') {
      // The wag: every few seconds the tail swings a moment; between, it sits and looks round.
      const w = b.t % 3.6;
      return w < 1 ? (Math.floor(b.t * 6) % 2 ? 'sit1' : 'sit0') : w > 2.6 ? 'sit1' : 'sit0';
    }
    return 'walk0';
  }
  /** Glim: its halo (stepped squares, never a blur), the moth with its mood, a tell's flash, its sparks, a pointing trail. */
  private drawGlim(): void {
    const g = this.glim, c = this.ctx;
    if (g.shown) {
      const x = Math.round(g.x), y = Math.round(g.y);
      const dozing = glimIdle(this.stillT) === 'doze' && !this.glimFlight;
      const flap = this.still ? 'mid' : GLIM_FLAP[Math.floor(this.time * (this.glimFlight ? 14 : dozing ? 3 : 8)) % 4];
      c.globalCompositeOperation = 'lighter';
      glowSquare(c, x, y, this.glimBright ? 9 : 7, { core: '#fff2c4', body: '#ffd98a', edge: '#c88a2a' }, this.glimBright ? .5 : .32);
      c.globalCompositeOperation = 'source-over';
      const sprite = glimFrame(flap, this.glimMoodNow());
      if (sprite) c.drawImage(sprite, x - Math.floor((GLIM_W + 2) / 2), y - Math.floor((GLIM_H + 2) / 2));
      if (this.glimFlashT > 0) {
        const t = 1 - this.glimFlashT / .45, r = 6 + t * 10;
        c.globalAlpha = .9 * (1 - t); c.fillStyle = '#fff4dc';
        for (const p of circlePixels(r)) if ((p.x + p.y) % 2 === 0) c.fillRect(x + p.x, y + p.y, 1, 1);
        c.fillStyle = '#ff8a5a'; c.fillRect(x - 1, y - 14, 2, 5); c.fillRect(x - 1, y - 8, 2, 2);
        c.globalAlpha = 1;
      }
    }
    // The trail: dashes of light from the Keeper to what Glim found, fading.
    const tr = this.glimTrail;
    if (tr) {
      const p = this.player, d = Math.hypot(tr.x - p.x, tr.y - p.y), n = Math.min(24, Math.floor(d / 7));
      c.globalAlpha = Math.min(.8, tr.t / 2); c.fillStyle = '#ffd98a';
      for (let i = 1; i < n; i++) { if ((i + Math.floor(this.time * 6)) % 3 === 0) continue; c.fillRect(Math.round(p.x + (tr.x - p.x) * i / n), Math.round(p.y - 2 + (tr.y - p.y) * i / n), 1, 1); }
      c.globalAlpha = 1;
    }
    for (const s of this.sparks) { c.globalAlpha = Math.max(0, 1 - s.age / s.life); c.fillStyle = s.col; c.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); }
    c.globalAlpha = 1;
  }

  // ── Simulation ─────────────────────────────────────────────────────────────

  private update(dt: number): void {
    this.time += dt;
    this.peers.step(dt, this.peerArea(), this.player, this.still);
    this.stepCorpse();
    if (this.cant && (this.cant.age += dt) >= CHANT_SECS) this.cant = null;
    // The continent's hearths stand from the first frame (placed once: their stalls join the town's).
    hearthsOf(this.world);
    if (this.waking) { this.stepWaking(dt); return; }
    let vx = 0, vy = 0;
    if (this.keys.has('left')) vx -= 1;
    if (this.keys.has('right')) vx += 1;
    if (this.keys.has('up')) vy -= 1;
    if (this.keys.has('down')) vy += 1;
    if (this.joy?.active) {
      const dx = this.joy.x - this.joy.sx, dy = this.joy.y - this.joy.sy, len = Math.hypot(dx, dy);
      if (len > 6) { const k = Math.min(1, len / 48); vx = dx / len * k; vy = dy / len * k; }
    }
    if (vx || vy) { this.path = []; this.chop = null; this.gather.stopAll(); }
    else if (this.path.length) {
      const p = this.path[0], dx = p.x - this.player.x, dy = p.y - this.player.y, d = Math.hypot(dx, dy);
      // No headway on this step for half a second (an edge the feet catch on): count it reached, never grind a wall.
      if (d < this.pathBest - .5) { this.pathBest = d; this.pathStall = 0; } else this.pathStall += dt;
      if (d < 3 || (this.pathStall > .5 && d < TILE * 1.5)) {
        this.path.shift(); this.pathBest = Infinity; this.pathStall = 0;
        if (!this.path.length) { const go = this.arrive; this.arrive = null; go?.(); }
      } else if (this.pathStall > 1.5) { this.path = []; this.arrive = null; this.pathBest = Infinity; this.pathStall = 0; }
      else { vx = dx / d; vy = dy / d; }
    }
    const len = Math.hypot(vx, vy);
    if (len > 1) { vx /= len; vy /= len; }
    this.player.moving = len > .05;
    if (this.player.moving) {
      if (Math.abs(vx) > .2) this.player.face = vx < 0 ? -1 : 1;
      // Mostly vertical: show the face (south) or the back (north); otherwise the side view.
      this.player.dir = Math.abs(vy) > Math.abs(vx) * 1.2 ? (vy > 0 ? 'down' : 'up') : 'side';
      const speed = this.walkSpeed;
      this.tryMove(vx * speed * dt, 0);
      this.tryMove(0, vy * speed * dt);
    }
    // The Keeper's stillness (the companions idle by it) and his breadcrumbs (the pet's way round a corner).
    this.stillT = this.player.moving || this.mobs.target || this.chop || this.gather.busy ? 0 : this.stillT + dt;
    const crumb = this.trail[this.trail.length - 1];
    if (!crumb || Math.hypot(crumb.x - this.player.x, crumb.y - this.player.y) > 6) { this.trail.push({ x: this.player.x, y: this.player.y }); if (this.trail.length > 48) this.trail.shift(); }
    this.updateFolk(dt);
    // Keepers breathe and turn toward the Keeper when near.
    for (const k of this.keepers) { k.t += dt; if (Math.abs(this.player.x - k.x) < 120) k.face = this.player.x < k.x ? -1 : 1; }
    // The nearest stall within reach (the HUD's prompt and E).
    let best: TdStall | null = null, bestD = REACH;
    for (const s of this.level.stalls) {
      // A ship's berth is only where the Keeper steps ashore: the Harbourmaster is who you talk to (td-harbour).
      if (isBerth(s.station.id)) continue;
      if (s.station.id.startsWith('shade:') && this.darkLayer.isOpened(s.station.id.slice(6))) continue;
      // The ledger page is only there in the dark, while the chain is at it.
      if (s.station.id === 'sexton:page' && !pageShown(this.sexton.step, this.phaseNow)) continue;
      const d = Math.hypot(this.player.x - s.x, this.player.y - (s.y + 10));
      if (d < bestD) { best = s; bestD = d; }
    }
    this.nearby = best;
    this.updateHearth();
    // Town portals: they fade on time, and an armed one underfoot takes the Keeper through (td-waygate.ts).
    this.gates.step(this.time);
    this.markWaygate();
    this.updateDark(dt);
    this.updateSexton(dt);
    this.updateSmoke(dt);
    this.updateFight(dt);
    this.tickPals(dt);
    this.updatePet(dt);
    this.updateGlim(dt);
    this.updateGuide(dt);
    this.updateFx(dt);
    this.updateLoot(dt);
    this.updateChop(dt);
    // Weather v1 (once a second: the window, the section underfoot) and the gathering loops.
    this.weatherT -= dt;
    if (this.weatherT <= 0) { this.weatherT = 1; this.stepWeather(); }
    this.weatherFx.update(dt, this.time, Math.random, this.still);
    // Wet (the weather's rule): rain on the Keeper keeps him Wet, and a few seconds after (td-mobs reads kst.wet).
    if (this.rainedOn) this.mobs.kst.wet = Math.max(this.mobs.kst.wet, WET_LINGER_SECS);
    this.mobs.weatherWet = this.rainedOn;
    this.updateGather(dt);
    this.actT = Math.max(0, this.actT - dt); this.shake = Math.max(0, this.shake - dt);
    // A line of the engine's own (a fall) fades from the HUD after a few seconds.
    if (this.message || this.messageKey) { this.messageAge += dt; if (this.messageAge > 4) { this.message = ''; this.messageKey = ''; this.messageAge = 0; } }
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) { this.stateTimer = .1; if (!this.catchingUp) this.report(); }
  }

  private tryMove(dx: number, dy: number): void {
    const p = this.player, nx = p.x + dx, ny = p.y + dy;
    if (this.free(nx, ny)) { p.x = nx; p.y = ny; return; }
    // Blocked: slide round the corner (owner 2026-10-20: "getting stuck in places"). If a small sidestep along the
    // other axis would clear the way, take a step of it now, so the Keeper glides past an edge instead of stopping.
    const step = Math.max(Math.abs(dx), Math.abs(dy));
    for (const off of [2, 4, 6, 8]) for (const side of [-1, 1]) {
      if (dx && !dy && this.free(nx, p.y + side * off)) { const move = side * Math.min(step, off); if (this.free(p.x, p.y + move)) { p.y += move; return; } }
      if (dy && !dx && this.free(p.x + side * off, ny)) { const move = side * Math.min(step, off); if (this.free(p.x + move, p.y)) { p.x += move; return; } }
    }
  }
  private free(x: number, y: number): boolean { return footFree(this.level, x, y); }

  /** The zone under the Keeper (td-zones.ts): its fixed band, whether it is safe ground; null where none is written. */
  private zoneHere(): { id: string; band: readonly [number, number]; safe: boolean } | null {
    const id = this.level.zoneAt(this.player.x, this.player.y), z = zoneOf(id);
    return z ? { id, band: z.band, safe: !!z.safe } : null;
  }
  private report(): void {
    const s = this.nearby;
    // Nothing to use: the gathering skills' own (a fire to cook at, a spot to fish, a tree to chop).
    const gx = s ? null : this.gather.busy ? null : this.gather.fireNear(this.player.x, this.player.y, 34) ? 'td-fire' : this.spotNear() ? 'td-spot' : this.treeNear() ? 'td-tree' : null;
    const state: EngineState = {
      hp: Math.round(this.hp), enemyHp: 0, nearby: s ? s.station.id : gx,
      nearbyLabel: s ? s.station.label : gx === 'td-fire' ? 'COOK' : gx === 'td-spot' ? 'FISH' : gx === 'td-tree' ? 'CHOP TREE' : undefined, nearbyKind: s?.station.kind ?? (gx ? 'resource' : undefined),
      x: Math.round(this.player.x), y: Math.round(this.player.y),
      area: this.level.placeName(this.player.x, this.player.y), areaId: 'infernal', facing: this.player.face, zone: this.zoneHere(),
      animation: this.player.moving ? 'run' : 'idle', delve: false, coins: 0, kills: 0,
      paused: this.paused, defeated: false, enemyDefeated: false, complete: false, message: this.message, ...(this.messageKey ? { messageKey: this.messageKey } : {}),
    };
    this.options.onState(state);
  }

  // ── Walking to a point (A* over the tile grid, 8-way, no corner cutting) ──

  private walkTo(x: number, y: number, onArrive?: () => void): boolean {
    const route = this.route(this.player.x, this.player.y, x, y);
    if (!route) return false;
    this.path = route; this.arrive = onArrive ?? null; this.pathBest = Infinity; this.pathStall = 0;
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
    // End on the exact spot asked for only when the feet fit there; else the last free tile's centre.
    if (pts.length && footFree(this.level, tx, ty)) pts[pts.length - 1] = { x: tx, y: ty };
    return pts;
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private bindInput(): void {
    // A field has the keyboard (chat, a whisper, a name, the Map's search): the world hears nothing typed into it
    // (owner's player notes 2026-10-21: "typing in chat moves the character"). Checked on the event's target AND on
    // document.activeElement, and while an IME is composing, so every field to come is covered without a list.
    const editable = (el: EventTarget | Element | null): boolean => el instanceof HTMLElement && (el.matches('input, textarea, select') || el.isContentEditable);
    const typing = (e: KeyboardEvent): boolean => e.isComposing || editable(e.target) || (typeof document !== 'undefined' && editable(document.activeElement));
    // Keys are read through the keymap (shared/keys): what a code means is the player's binding, held movement is kept
    // as the action ('up'…'right'), so a rebound key releases cleanly.
    const MOVES = ['up', 'down', 'left', 'right'];
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const act = e.ctrlKey || e.metaKey || e.altKey ? null : actionFor(this.binds, e.code);
      // A key let go is always let go (even into a field, even paused): nothing stays held down.
      if (!down) { if (act) this.keys.delete(act); if (act === 'attack') this.mobs.attacking = false; return; }
      if (typing(e) || this.paused || !act) return;
      // Space and E on a focused button or link press it (a banner, a menu), never the world's attack or use.
      if ((e.code === 'Space' || e.code === 'Enter' || act === 'interact') && (e.target as HTMLElement | null)?.closest?.('button, a, [role="button"], [contenteditable]')) return;
      // E opens the stall in reach (the side view handled E inside its own engine). Enter is the chat's (the HUD).
      if (down && !e.repeat && act === 'interact' && (this.nearby || this.mobs.corpseNear(this.player.x, this.player.y) || this.gatherNear())) { e.preventDefault(); this.interact(); return; }
      if (act === 'attack') { e.preventDefault(); this.mobs.attacking = down; return; }
      const slot = /^skill([1-8])$/.exec(act);
      if (slot) { if (down && !e.repeat) { const why = this.useAbility(slot[1]); if (why) this.say(`play.td.ability.${why}`); } return; }
      if (!MOVES.includes(act)) return;
      if (down) { this.keys.add(act); this.path = []; } else this.keys.delete(act);
    };
    const kd = onKey(true), ku = onKey(false);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    this.unbind.push(() => window.removeEventListener('keydown', kd), () => window.removeEventListener('keyup', ku));
    // Focus going into a field, or away from the window, lets go of every held key and the held attack.
    const release = () => { this.keys.clear(); this.mobs.attacking = false; };
    const focusIn = (e: FocusEvent) => { if (editable(e.target)) release(); };
    document.addEventListener('focusin', focusIn); window.addEventListener('blur', release);
    this.unbind.push(() => document.removeEventListener('focusin', focusIn), () => window.removeEventListener('blur', release));
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
  private stallAt(wx: number, wy: number): TdStall | undefined { return this.stallHit(wx, wy)?.s; }
  /** The stall under a point and how far the point is from its body (a giver's body, else the stall's foot): for comparing with a Keeper or a corpse under the same finger. */
  private stallHit(wx: number, wy: number): { s: TdStall; d: number } | undefined {
    // A tap on a task giver's body talks to them (a stall keeper's counter still opens the stall).
    const giver = this.level.stalls.find(s => s.keeper && s.station.id.startsWith('giver-') && Math.abs(wx - s.keeper.x) < up(10) && wy > s.keeper.y - up(34) && wy < s.keeper.y + 2);
    if (giver) return { s: giver, d: Math.hypot(wx - giver.keeper!.x, wy - (giver.keeper!.y - 17)) };
    // Of the stalls under the finger the one whose foot is nearest wins (a fire and its shrine must not shadow each other).
    let hit: TdStall | undefined, best = Infinity;
    for (const s of this.level.stalls) {
      if (isBerth(s.station.id)) continue;
      if (!(Math.abs(wx - s.x) < 34 && wy > s.y - (s.keeper ? up(46) : 46) && wy < s.y + 16)) continue;
      const d = Math.hypot(wx - s.x, wy - (s.y - 14));
      if (d < best) { best = d; hit = s; }
    }
    return hit ? { s: hit, d: best } : undefined;
  }
  private tap(clientX: number, clientY: number): void {
    const { x: wx, y: wy } = this.toWorld(clientX, clientY);
    // A creature under the finger is the target (Tibia's click-to-attack): the Keeper closes in and swings.
    // Only one the Keeper can see (td-sight): a creature behind a wall is no target — the tap walks toward it instead.
    const foe = this.mobs.mobAt(wx, wy);
    if (foe && this.mobs.sees(foe)) { this.mobs.target = foe; this.chaseTimer = 0; return; }
    this.mobs.target = null;
    // A shared ground item (protocol 6) under the finger — before the Keepers, it is the smaller target and often lies
    // at one's feet: walk to it, then the HUD reaches for it.
    const lying = this.shared.find(g => Math.abs(wx - g.x) < 9 && wy > g.y - 12 && wy < g.y + 5);
    if (lying && this.options.onGroundTap) {
      const id = lying.id.slice('shared:'.length), reach = () => this.options.onGroundTap?.(id);
      // No way to its side (a wall, a Keeper standing on it): reach from here when close, as a corpse opens.
      if (!this.walkTo(lying.x, lying.y + 2, reach) && Math.hypot(lying.x - this.player.x, lying.y - this.player.y) <= CORPSE_REACH * 2) reach();
      return;
    }
    // Another Keeper under the finger: their card (name, class, level, Wave), and the Keeper stays where they are.
    // Several things can lie under one finger (a Keeper standing at a giver's side, a corpse by a stall): the nearest to
    // the point wins, the way stallAt picks the nearest foot. A Keeper tapped on their own body always wins; one the
    // finger only just missed (they glide between packets, and a thumb is wide) wins when nearer than the stall.
    const stall = this.stallHit(wx, wy);
    const peer = this.peers.nearest(wx, wy, PEER_SLOP);
    // Keepers never block one another (owner 2026-10-26, Tibia-style): a tap on one while walking walks on through, and
    // a second tap on the Keeper whose card is up walks there; only a first tap from a standstill names them.
    const walking = this.path.length > 0 || this.player.moving;
    const again = !!peer && this.peerTapped?.id === peer.card.id && this.time - this.peerTapped.at < PEER_AGAIN_SECS;
    if (peer && this.options.onPeerTap && (peer.on || !stall || peer.d <= stall.d) && !walking && !again) {
      this.peerTapped = { id: peer.card.id, at: this.time };
      this.options.onPeerTap(peer.card); return;
    }
    if (peer && (walking || again)) { this.peerTapped = null; this.walkTo(wx, wy); return; }
    const cp = this.mobs.corpseAt(wx, wy);
    if (cp) {
      const { body } = corpseSize(cp);
      if (!stall || Math.hypot(wx - cp.x, wy - (cp.y - body / 2)) <= stall.d) {
        const open = () => { this.openCorpse(cp.id); };
        // No way to its side (a wall): open it from where the Keeper stands if that is close, else walk as near as can be.
        if (!this.walkTo(cp.x, cp.y + 6, open)) { if (Math.hypot(cp.x - this.player.x, cp.y - this.player.y) <= CORPSE_REACH * 2) open(); else this.walkTo(cp.x, cp.y); }
        return;
      }
    }
    // A campfire under the finger: cook at it. A fishing spot's float: walk to its shore and cast.
    const fire = this.gather.fireNear(wx, wy + 4, 10);
    if (fire) { const src = { fire, x: fire.x, y: fire.y, range: false }; if (!this.walkTo(fire.x + (this.player.x < fire.x ? -14 : 14), fire.y + 2, () => this.beginCook(src))) this.beginCook(src); return; }
    const spot = this.spotAt(wx, wy);
    if (spot) { const go = () => this.beginFish(spot); if (!this.walkTo(spot.shore.x, spot.shore.y, go)) go(); return; }
    if (this.level === this.world) {
      const tc = Math.floor(wx / TILE), tr = Math.floor((wy + 6) / TILE);
      for (const [c, r] of [[tc, tr], [tc, tr + 1], [tc, tr + 2]]) {
        const o = this.world.treeAt(c, r);
        if (o) { this.walkTo(o.x, o.y + 12, () => this.startChop(c, r, o.x, o.y)); return; }
      }
    }
    const hit = stall?.s;
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
    const col: Partial<Record<Ground, string>> = { grass: PAL.grass[0], flowers: PAL.grass[1], dirt: PAL.dirt[0], cobble: PAL.cobble[0], sand: PAL.sand[0], plank: PAL.plank[0], water: PAL.water[0], ember: PAL.ember[0], cave: '#6a564c', rock: '#1d1720', moss: PAL.moss[1], flagstone: PAL.temple[1], vinewall: '#2c3a2c', canopy: PAL.jungle[2], bark: PAL.bark[2], mire: PAL.mire[1], wetstone: PAL.wetstone[1], blackwater: '#202c38', drownwall: '#1f252b', boardwalk: PAL.boardwalk[3] };
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
    if (this.level === this.world) for (const kp of this.keepers) if (kp.kid && this.taskMarks[kp.kid]) dot(kp.x, kp.y, Math.max(2, k - 1), this.taskMarks[kp.kid] === '?' ? '#ffd27a' : '#f3e7cf');
    if (this.level === this.world) for (const f of this.folk) { c.fillStyle = 'rgba(42,26,36,.55)'; c.fillRect(toX(f.x), toY(f.y), Math.max(1, k >> 1), Math.max(1, k >> 1)); }
    this.miniMobs(dot, reach);
    // Party members (protocol 3): a gold mark where they stand, or a pip on the rim pointing their way.
    const area = this.peerArea();
    for (const m of this.peers.partyWhere()) {
      if (m.area !== area) continue;
      const dx = (m.x - this.player.x) / TILE * k, dy = (m.y - this.player.y) / TILE * k, lim = W / 2 - 4;
      const f = Math.max(Math.abs(dx), Math.abs(dy)) > lim ? lim / Math.max(Math.abs(dx), Math.abs(dy)) : 1;
      dot(this.player.x + dx * f / k * TILE, this.player.y + dy * f / k * TILE, Math.max(2, k - 1), PARTY_PLATE);
    }
    dot(this.player.x, this.player.y, Math.max(2, k - 1), '#ffffff');
  }

  /**
   * The creatures round the Keeper on the minimap (owner's player notes 2026-10-21): a red dot each, a champion blue and
   * a unique gold (their aura tones, td-elites ELITE_TONES) and a size bigger, a boss bigger still with a pale heart. In
   * the dark (a dungeon floor, or night past half) only what the Keeper's own light reaches shows. Capped at MINI_MOBS.
   */
  private miniMobs(dot: (x: number, y: number, r: number, fill: string) => void, reach: number): void {
    const p = this.player, dark = this.level.dark || this.darkness > .5;
    const sight = dark ? this.ownLight().r * 1.5 : reach;
    let n = 0;
    for (const m of this.mobs.mobs) {
      if (m.hp <= 0 || Math.abs(m.x - p.x) > sight || Math.abs(m.y - p.y) > sight) continue;
      if (dark && Math.hypot(m.x - p.x, m.y - p.y) > sight) continue;
      if (++n > MINI_MOBS) break;
      const boss = m.def.rank === 'boss', elite = m.elite?.rank;
      if (boss) { dot(m.x, m.y, 3, '#b0283a'); dot(m.x, m.y, 1, '#ffe7e0'); }
      else if (elite) dot(m.x, m.y, 2, ELITE_TONES[elite].body);
      else dot(m.x, m.y, 1, '#e0453a');
    }
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

  /** The town's people: its keepers behind their stalls, its townsfolk on its streets. */
  private populate(): void {
    this.keepers.length = 0; this.folk.length = 0; this.streets.length = 0;
    // Every keeper on the continent: the capital's stalls and the villages' own (Cinderport, Ashgrove…).
    const seen = new Set<string>();
    for (const s of this.world.stalls) {
      // One person per keeper (a stall keeper who gives tasks has a second spot to talk from, beside the counter).
      if (!s.keeper || seen.has(s.keeper.id)) continue;
      seen.add(s.keeper.id);
      const npc = NPC_LOOKS[s.keeper.id];
      // A giver with no portrait of their own gets a look seeded by their id (the same face every visit).
      let h = 0; for (const ch of s.keeper.id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
      const rand = () => { h = (h + 0x6D2B79F5) >>> 0; let t = Math.imul(h ^ (h >>> 15), h | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const painter = npc ? new KeeperPainter(npc.look, npc.gear, npc.garb) : new KeeperPainter(randomLook(rand));
      this.keepers.push({ painter, x: s.keeper.x, y: s.keeper.y, face: 1, dir: 'down', name: s.keeper.name, moving: false, t: Math.random() * 4, kid: s.keeper.id });
    }
    this.spawnFolk();
  }
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

  /**
   * The phase specs' showcase (`?phase=night|eclipse`): the Keeper steps onto open grass outside the square and a few
   * of that sky's creatures stand calm round him — real MobSystem creatures, night-hardened or Eclipse-touched.
   */
  private layPhaseShowcase(kind: 'night' | 'eclipse'): void {
    this.fxPhaseLaid = true;
    const p = this.player, pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
    const open = (c0: number, r0: number) => { for (let dr = -6; dr <= 4; dr++) for (let dc = -11; dc <= 11; dc++) if (!this.level.walkable(c0 + dc, r0 + dr)) return false; return true; };
    search: for (let rad = 6; rad <= 44; rad += 2) for (let k = 0; k < 24; k++) {
      const c = pc + Math.round(Math.cos(k / 24 * Math.PI * 2) * rad), r = pr + Math.round(Math.sin(k / 24 * Math.PI * 2) * rad);
      if (this.world.inTown(c, r)) continue;
      if (open(c, r)) { p.x = c * TILE + TILE / 2; p.y = r * TILE + TILE; break search; }
    }
    const wide = this.cam.w >= 320, calm = (m: Mob) => { m.def = { ...m.def, sight: 0 }; m.wait = 1e9; };
    const lay = (type: string, dx: number, dy: number, touched: 'lone' | 'unique' | null) => {
      const def = MOBS[type];
      if (!def) return;
      const night = hardened({ ...def, sight: 0 }, kind);
      if (!touched) { calm(this.mobs.place(`fx-phase:${type}:${dx}`, night, p.x + dx, p.y + dy)); return; }
      const pack = touched === 'lone' ? touchPack(null, touchedRandom(`fx|${type}`)) : touchPack(makePack('unique', ['cursed'], 'Duskclaw the Unlit', 2), touchedRandom(`fx|${type}`));
      this.mobs.spawnPack(`fx-phase:${type}:${dx}`, night, p.x + dx, p.y + dy, pack).forEach(calm);
    };
    if (kind === 'night') {
      // The night table's creatures: the dead walk the Emberwood, beside a night-hardened wolf.
      lay('bone-walker', wide ? 70 : 0, wide ? -4 : 80, null);
      lay('ash-wolf', wide ? -70 : -40, wide ? -4 : -70, null);
      lay('bone-walker', wide ? -30 : 40, wide ? 40 : -70, null);
      // One out past the light: a silhouette and two lit eyes (the darkness pass's fair-fight rule).
      lay('ash-wolf', wide ? 190 : -30, wide ? 70 : 190, null);
    } else {
      // Eclipse-touched: a lone champion with its dark corona, and a touched unique leading its minions.
      lay('ash-wolf', wide ? 84 : 0, wide ? -4 : 92, 'lone');
      lay('bone-walker', wide ? -84 : 0, wide ? -4 : -80, 'unique');
    }
  }

  /**
   * The Seam Eater (td-seam.ts): under an eclipse, on the surface, it rises at the continent's rift when the Keeper comes
   * near (unless it already fell this eclipse); it leaves when the eclipse ends; its fall is the kill path's (onKill:
   * the Bestiary, XP, the tier it opens, its unique). The canvas says where it stands (`data-seam`).
   */
  private updateSeam(phase: SkyPhase): void {
    const m = this.seam;
    if (m && !this.mobs.mobs.includes(m)) {
      // It fell (its life gone), or the Keeper left the ground it stood on (it rises again when he comes back).
      if (m.hp <= 0) { this.seamSlain = true; this.seamLast = 'slain'; this.say('play.seam.slain'); }
      else this.seamLast = '';
      this.seam = null;
    }
    if (this.seam && seamLeaves(phase)) {
      this.mobs.banish(this.seam);
      this.seam = null; this.seamLast = 'gone';
      this.say('play.seam.gone');
    }
    // A new eclipse, a new rising.
    if (phase !== 'eclipse') this.seamSlain = false;
    if (!this.fxSeam && !this.seam && this.level === this.world) {
      const rift = this.riftHere();
      const dist = rift ? Math.hypot(rift.x - this.player.x, rift.y - this.player.y) / TILE : Infinity;
      if (rift && seamRises({ phase, surface: true, slain: this.seamSlain, up: false, dist })) this.raiseSeam(rift.x, rift.y, false);
    }
    const now = this.seam ? (this.seam.halved ? 'half' : 'risen') : this.seamLast;
    if (now !== this.seamSeen) { this.seamSeen = now; this.canvas.setAttribute('data-seam', now); }
  }
  /** This continent's rift (its standing stones, td-seam riftTile), in world px; null when it has none. */
  private riftHere(): { x: number; y: number } | null {
    const id = this.world.continent;
    if (!this.rifts.has(id)) {
      const at = riftPlace(this.world.def), t = at ? riftTile(this.world, at) : null;
      this.rifts.set(id, t ? { x: t.c * TILE + TILE / 2, y: t.r * TILE + TILE } : null);
    }
    return this.rifts.get(id) ?? null;
  }
  /** The tear opens and the Eater climbs out at (x, y), at its continent's fixed level (td-zones SEAM_LEVELS); Glim warns, the strip says so. */
  private raiseSeam(x: number, y: number, calm: boolean): Mob {
    // Its rift's fixed level (td-zones SEAM_LEVELS), never the Keeper's: Ember Isle's is the one a starter runs from.
    const def = seamEaterAt(MOBS[SEAM_ID], seamLevelFor(this.world.continent));
    const m = this.mobs.place(`seam:${this.world.continent}:${Math.round(this.time)}`, calm ? { ...def, sight: 0 } : def, x, y);
    if (calm) m.wait = 1e9;
    this.seam = m;
    this.mobs.effects.push({ kind: 'wave', el: 'shadow', r: 64, x, y, age: 0, life: .8, dir: 1 });
    this.say('play.seam.rise');
    this.options.onGlimCue?.({ kind: 'seam' });
    return m;
  }
  /** The seam specs' showcase (`?fxseam=1`): the Keeper a few steps from this continent's rift, the Eater risen calm on it. */
  private laySeamShowcase(): void {
    this.fxSeamLaid = true;
    const p = this.player, rift = this.riftHere();
    if (!rift) return;
    // The nearest open, unsafe tile 5–9 tiles south of the tear (the Keeper's own ground), so both stand in one view.
    const rc = Math.floor(rift.x / TILE), rr = Math.floor(rift.y / TILE);
    // Close enough that the whole of it fits in the view over him (it stands six tiles tall), else further off.
    const near: [number, number][] = [[0, 3], [0, 4], [4, 3], [-4, 3], [5, 2], [-5, 2], [6, 3], [-6, 3], [0, 5]];
    for (let dr = 6; dr <= 10; dr++) for (const dc of [0, 1, -1, 2, -2, 3, -3]) near.push([dc, dr]);
    for (const [dc, dr] of near) {
      const c = rc + dc, r = rr + dr;
      if (this.level.walkable(c, r) && !this.world.safeAt(c, r)) { p.x = c * TILE + TILE / 2; p.y = r * TILE + TILE; break; }
    }
    this.path = []; this.arrive = null;
    this.mobs.mobs.length = 0; this.mobs.target = null;
    this.raiseSeam(rift.x, rift.y, true);
    const seam = (): Mob | null => (this.seam && this.mobs.mobs.includes(this.seam) ? this.seam : null);
    (window as unknown as Record<string, unknown>)['__tdSeam'] = {
      tell: (kind: 'breath' | 'rend') => { const m = seam(); if (m) this.mobs.provoke(m, kind); return !!m; },
      half: () => { const m = seam(); if (!m) return false; this.mobs.wound(m, Math.max(1, m.hp - Math.floor(m.def.hp * .5) + 1)); return !!m.halved; },
      kill: () => { const m = seam(); if (!m) return false; this.mobs.smite(m); return true; },
      hold: (on: boolean) => { this.fxFrozen = !!on; },
      // The Keeper steps aside (out of the cone, out of the rings), as a player would in the tell.
      step: (dx: number, dy: number) => { const p = this.player; if (this.level.walkable(Math.floor((p.x + dx) / TILE), Math.floor((p.y + dy) / TILE))) { p.x += dx; p.y += dy; } this.path = []; return { x: Math.round(p.x), y: Math.round(p.y) }; },
      hp: () => Math.round(this.hp),
      // Everything near stands calm (its summons too), so a photograph holds still.
      calm: () => { for (const o of this.mobs.mobs) { o.def = { ...o.def, sight: 0 }; o.wait = 1e9; o.wander = null; } return this.mobs.mobs.length; },
      state: () => { const m = seam(); return m ? { up: true, hp: m.hp, max: m.def.hp, level: m.def.level, halved: !!m.halved, x: Math.round(m.x), y: Math.round(m.y), calls: this.mobs.calls.length, touched: this.mobs.mobs.filter(o => o.key.startsWith(`${m.key}:call`) && o.elite?.affixes.includes('eclipse-touched')).length } : { up: false, slain: this.seamSlain }; },
    };
  }

  /** The shared creatures alone (a host with a menu open): they move, fight the others and stream; this Keeper is away. */
  private updateShared(dt: number): void {
    this.coop.before(dt, this.peerArea(), this.peers.drawn.filter(p => this.peers.party.has(p.id)).map(p => ({ id: p.id, x: p.x, y: p.y })));
    this.peers.step(dt, this.peerArea(), this.player, this.still);
    this.mobs.selfAway = true;
    try { this.mobs.update(dt); } finally { this.mobs.selfAway = false; }
    this.coop.after(dt);
    this.tickPals(dt);
    this.lifeFrame();
  }

  // ── Protocol 10: the life the room keeps (play/world/keeper-life.ts, life-mirror.ts) ──
  /** Protocol 10: the room lays this Keeper's statuses on its creatures (and tells it what it refused). */
  setRoomStatus(on: boolean): void { this.coop.setStatusOn(on); }
  /** The room keeps this Keeper's life (the HUD: connected to a protocol-10 room that said so), or no longer. */
  setRoomLife(on: boolean): void {
    if (on === !!this.life) return;
    if (on) { this.life = new LifeMirror(); this.lifeMark = this.hp; this.lifeBiteLocal = 0; this.lifeHurt = 0; this.lifeFrac = 0; this.lifeGuardSent = ''; this.roomMax = 0; }
    else { this.life = null; this.roomDown = false; this.roomMax = 0; }
    this.canvas.setAttribute('data-room-life', on ? 'on' : '');
  }
  /** A room's blow: the room cut `cut`; the screen lands it through its own wards and claims the difference. */
  private roomBite(cut: number, land: () => void): void {
    if (!this.life) { land(); return; }
    const before = this.lifeBiteLocal;
    this.inRoomBite = true;
    try { land(); } finally { this.inRoomBite = false; }
    const local = this.lifeBiteLocal - before, d = Math.round(cut - local);
    if (d > 0) this.life.claim('soak', d); else if (d < 0) this.life.claim('hurt', -d);
  }
  /** What moved the life since the last look that the room did not see: a heal (regen, leech, a skill) or harm. */
  private lifeAccount(): void {
    if (!this.life) return;
    const healed = this.hp - this.lifeMark + this.lifeBiteLocal + this.lifeHurt + this.lifeFrac;
    const whole = Math.trunc(healed);
    this.lifeFrac = healed - whole;
    if (whole > 0) this.life.claim('heal', whole); else if (whole < 0) this.life.claim('hurt', -whole);
    if (this.lifeHurt >= 1) this.life.claim('hurt', this.lifeHurt);
    this.lifeMark = this.hp; this.lifeBiteLocal = 0; this.lifeHurt = 0;
  }
  /** Each frame: account, and send what is due (the guard when it changed; claims at most every 150 ms). */
  private lifeFrame(): void {
    if (!this.life || !this.options.onLife) return;
    this.lifeAccount();
    const g = { m: Math.round(this.maxHp), d: Math.round(this.mobs.defense), r: ELEMENTS.map(el => Math.max(-200, Math.min(100, Math.round(this.mobs.resists[el] ?? 0)))) };
    const key = `${g.m}|${g.d}|${g.r.join(',')}`;
    const now = performance.now();
    // In a fight the room hears every 150 ms; out of it (regeneration) once a second; a potion or a wake at once.
    const gap = this.life.urgent ? 0 : this.time - this.lastHurt < 5 ? 150 : 1000;
    if (this.lifeBusy || (!this.life.queued && key === this.lifeGuardSent) || now - this.lifeSentAt < gap) return;
    const life = this.life, c = life.drain(now), send = key !== this.lifeGuardSent;
    this.lifeBusy = true; this.lifeSentAt = now;
    void this.options.onLife({ ...(send ? { g } : {}), c }).then(me => {
      if (this.life !== life) return;
      if (!me) { life.requeue(c); return; }
      if (send) this.lifeGuardSent = key;
      this.lifeHeard(me);
    }, () => { if (this.life === life) life.requeue(c); }).finally(() => { this.lifeBusy = false; });
  }
  /** The room's word on this Keeper's life (a snapshot's `me`, a claim's answer). */
  private lifeHeard(me: LifeView): void {
    if (!this.life) return;
    this.lifeAccount();
    const v = this.life.reconcile(me, performance.now());
    if (v === null) return;
    this.roomMax = me.m;
    this.canvas.setAttribute('data-room-hp', `${me.h}/${me.m}`);
    if (me.d) { if (!this.roomDown && !this.waking && me.q >= this.wakeQ) { this.roomDown = true; this.fallNow(); } return; }
    if (this.waking || this.roomDown) return;
    this.hp = Math.max(1, Math.min(this.maxHp, me.m, v));
    this.lifeMark = this.hp;
  }
  /** The room holds a Keeper down: this one falls (its own word follows in `me`); another near is shown fallen. */
  private coopDown(to: string, x: number, y: number, self: boolean): void {
    if (self) { if (this.life && !this.roomDown && !this.waking) { this.roomDown = true; this.fallNow(); } return; }
    this.options.onPeerDown?.(to, x, y);
  }
  /** The e2e's view of the life the room keeps: the room's word, claims in flight, round trips (ms). */
  lifeView(): { on: boolean; hp: number; room: LifeView | null; inFlight: number; rtt: number[]; down: boolean } {
    return { on: !!this.life, hp: Math.round(this.hp), room: this.life?.room ?? null, inFlight: this.life?.inFlight ?? 0, rtt: [...(this.life?.rtt ?? [])], down: this.roomDown };
  }

  private updateFight(dt: number): void {
    // The sky as a rule (td-phases.ts): a pinned `?hour=` stands for its own phase, so a picture never meets the real sky.
    const phase = this.pinned !== null ? phaseOfHour(this.pinned) : this.skyPhase;
    this.mobs.setPhase(phase, this.level === this.world);
    if (phase !== this.phaseSeen) { this.phaseSeen = phase; this.canvas.setAttribute('data-phase', phase); }
    if (this.fxPhase && !this.fxPhaseLaid && this.time > .5 && this.level === this.world) this.layPhaseShowcase(this.fxPhase);
    // After Glim's welcome line has had its say, so the warning is not lost under it.
    if (this.fxSeam && !this.fxSeamLaid && this.time > 6 && this.level === this.world) this.laySeamShowcase();
    // Shared creatures (td-coop.ts): this Keeper's part in its area now, the others of the party as prey on the host,
    // the host's creatures placed on a member. A member raises nothing of its own (no spawns, no Seam Eater).
    this.coop.before(dt, this.peerArea(), this.peers.drawn.filter(p => this.peers.party.has(p.id)).map(p => ({ id: p.id, x: p.x, y: p.y })));
    const member = this.coop.role === 'member';
    if (!member) this.updateSeam(phase);
    // The endless surface hands over the spawns round the Keeper as they come into reach, and forgets far ones.
    this.spawnTimer -= dt;
    // (The seam specs keep the stage to the Eater and its call, so every photograph and count is its own.)
    if (this.spawnTimer <= 0 && this.level === this.world && !this.fxSeam && !member && !this.fxCoopQuiet) {
      this.spawnTimer = .5;
      const r = 420;
      this.mobs.addSpawns(this.world.spawnsIn(this.player.x - r, this.player.y - r, this.player.x + r, this.player.y + r));
      // A host raises the ground round the others too (they hunt where they stand, not only where the host does).
      for (const o of this.mobs.others) this.mobs.addSpawns(this.world.spawnsIn(o.x - r, o.y - r, o.x + r, o.y + r));
      this.mobs.prune(900);
    }
    // Chasing a target (Tibia): walk into reach of it, re-aimed as it moves.
    const t = this.mobs.target;
    this.chaseTimer -= dt;
    if (t && this.chaseTimer <= 0 && !this.keys.size && !this.joy?.active) {
      this.chaseTimer = .4;
      // Close in only to the staff's range (a Warlock fights from a distance).
      // …or round the wall that hides it (td-sight): no sight, no blow, so he walks until he sees it.
      if (Math.hypot(t.x - this.player.x, t.y - this.player.y) > this.mobs.range - 12 || !this.mobs.sees(t)) { const route = this.route(this.player.x, this.player.y, t.x, t.y); if (route) { this.path = route; this.arrive = null; } }
      else this.path = [];
    }
    // S6: the land its packs' auras come from (td-pack-aura).
    this.mobs.land = this.world.continent;
    this.mobs.update(dt);
    this.coop.after(dt);
    // Whispering (an elite affix, S6): its blows feed the Hush.
    if (this.mobs.hushOwed > 0) {
      if (this.darkLayer.awake({ keeperLevel: this.mobs.keeperLevel, continent: this.world.continent })) this.darkLayer.hush = Math.min(100, this.darkLayer.hush + this.mobs.hushOwed);
      this.mobs.hushOwed = 0;
    }
    // A potion pouring in: its share of what is left this frame.
    if (this.sip.t > 0) {
      const f = Math.min(1, dt / this.sip.t), h = this.sip.hp * f, m = this.sip.mana * f;
      this.pour(h, m);
      this.sip = f >= 1 ? { hp: 0, mana: 0, t: 0 } : { hp: this.sip.hp - h, mana: this.sip.mana - m, t: this.sip.t - dt };
    }
    // Worn regeneration, with the boss uniques' (the Mossbound Heart: more, and twice it standing still).
    const regen = relicRegen(this.lifeRegen, this.mobs.relics, this.stillT > .5);
    // Out of the fight a while: the Keeper mends — unless a Grave-cold drain outweighs his regeneration (its card says
    // so): the mend (6 a second) would otherwise outrun the drain, and the curse's price would be paid only mid-fight.
    const mend = outOfFightMend(regen, this.time - this.lastHurt);
    if (mend > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + mend * dt);
    if (regen > 0 && this.hp > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + regen * dt);
    // A Grave-cold curse (shared/grave-goods) drains slowly: never the last point of life.
    else if (regen < 0 && this.hp > 1) this.hp = Math.max(1, this.hp + regen * dt);
    this.lifeFrame();
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
    if (optCamera()) { this.resizeOpt(); return; }
    // The canvas's backing resolution (docs/handoff/calm.md): a phone at DPR 3 rasterised 2.96 Mpx a frame, and that
    // flush — not the engine's own work — was most of its frame. Capped at 2 device px per CSS px on a phone (no visible
    // change at 1.5 css px per art px: still 3 device px per art px), 4/3 on Low (2 per art px on a phone), never more.
    const narrow = this.canvas.clientWidth < 700;
    const dpr = Math.min(window.devicePixelRatio || 1, envDetail() === 'low' ? 4 / 3 : narrow ? 2 : 3);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    // 1.5 CSS px per art px on phones (~16 tiles across), 2 on tablets, 3 on wide screens; whole device pixels so pixels stay crisp.
    // The art style upgrade (2026-10-26): a wide screen frames about 200–260 art px of height, so the Keeper and the trees
    // read big and detailed (the owner's references) — 4 css px per art px at 720–899 tall, 5 from 900, never under 3.
    const css = this.canvas.clientWidth >= 1100 ? Math.max(3, Math.min(4, Math.floor(this.canvas.clientHeight / 260))) : this.canvas.clientWidth >= 700 ? 2 : 1.5;
    this.scale = Math.max(1, Math.round(css * dpr));
    this.cam.w = w / this.scale; this.cam.h = h / this.scale;
    // No edge to clamp to: the world runs on in every direction.
    this.cam.x = Math.round(this.player.x - this.cam.w / 2);
    this.cam.y = Math.round(this.player.y - up(20) - this.cam.h / 2);
  }

  /**
   * The prototype's camera (td-artopt.ts): the paused look branch, ~/er/wt-look's — the art style camera ÷ 1.15, about a third more
   * world — always a whole number of backing px per art px; with HD figures an even number, so each HD pixel (half an
   * art px) is a whole number of backing px too.
   */
  private resizeOpt(): void {
    const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight, narrow = cw < 700, dpr = window.devicePixelRatio || 1;
    const cap = envDetail() === 'low' ? 4 / 3 : narrow ? 2 : 3;
    const z = baseZoom(cw, ch) * zoomFactor();
    let fit = backing(z, dpr, cap);
    if (optHdFigures() && fit.scale % 2) {
      const sc = (fit.scale + 1) / z <= cap + 1e-6 ? fit.scale + 1 : Math.max(2, fit.scale - 1), ratio = sc / z, q = dpr / ratio;
      fit = { scale: sc, ratio, crisp: Math.abs(q - Math.round(q)) < 1e-3 };
    }
    const w = Math.max(1, Math.round(cw * fit.ratio)), h = Math.max(1, Math.round(ch * fit.ratio));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    const fitStyle = fit.crisp ? 'pixelated' : 'auto';
    if (this.canvas.style.imageRendering !== fitStyle) this.canvas.style.imageRendering = fitStyle;
    this.scale = fit.scale;
    this.chunkCap = Math.max(CHUNK_CAP, (Math.ceil(w / this.scale / (CHUNK * TILE)) + 3) * (Math.ceil(h / this.scale / (CHUNK * TILE)) + 3) + 6);
    this.cam.w = w / this.scale; this.cam.h = h / this.scale;
    this.cam.x = Math.round(this.player.x - this.cam.w / 2);
    this.cam.y = Math.round(this.player.y - up(20) - this.cam.h / 2);
  }
  /** The ground cache's size for this view (the prototype's camera frames more chunks). */
  private chunkCap = CHUNK_CAP;

  /**
   * The ground's chunk cache (docs/handoff/calm.md). A chunk is CHUNK×CHUNK tiles baked into one canvas (four for a
   * liquid chunk's frames), painted a row of tiles at a time so the work spreads across frames: after each draw the
   * engine spends a small budget (`BAKE_MS`) finishing the frames in view and baking the ring of chunks just outside it,
   * nearest first, so walking reaches ground that is already painted. A chunk in view that is somehow not ready yet is
   * finished at once (never drawn half-painted). The cache is least-recently-drawn first out, capped at CHUNK_CAP.
   */
  private chunkAt(cx: number, cy: number): GroundChunk {
    const key = `${cx},${cy}`;
    let e = this.chunks.get(key);
    if (e) { this.chunks.delete(key); this.chunks.set(key, e); return e; }
    let liquid = false;
    for (let r = cy * CHUNK; r < (cy + 1) * CHUNK && !liquid; r++) for (let c = cx * CHUNK; c < (cx + 1) * CHUNK; c++) {
      const k = this.level.ground(c, r);
      if (k === 'water' || k === 'ember' || k === 'blackwater') { liquid = true; break; }
    }
    // A liquid chunk has four frames (Low: the old water's frames are just as many — the painters choose).
    e = { cx, cy, frames: [], rows: liquid ? [0, 0, 0, 0] : [0] };
    this.chunks.set(key, e);
    while (this.chunks.size > this.chunkCap) this.chunks.delete(this.chunks.keys().next().value!);
    return e;
  }
  /** Bake chunk `e`'s frame `f` a row of tiles at a time until done or past `deadline` (performance.now ms). */
  private bakeRows(e: GroundChunk, f: number, deadline: number): boolean {
    if (e.rows[f] >= CHUNK) return true;
    const b0 = this.perf ? performance.now() : 0;
    let el = e.frames[f];
    const fresh = !el;
    const hd = optHdWorld() ? 2 : 1;
    if (!el) { el = document.createElement('canvas'); el.width = CHUNK * TILE * hd; el.height = CHUNK * TILE * hd; e.frames[f] = el; }
    const g = el.getContext('2d')!;
    // The world's backdrop under the tiles, so a chunk is always opaque and the frame needs no full-canvas clear.
    if (fresh) { g.fillStyle = '#2a1a24'; g.fillRect(0, 0, el.width, el.height); }
    const kind = (c: number, r: number): Ground => this.level.ground(c, r);
    const { cx, cy } = e;
    while (e.rows[f] < CHUNK) {
      const r = cy * CHUNK + e.rows[f];
      for (let c = cx * CHUNK; c < (cx + 1) * CHUNK; c++) {
        const ox = (c - cx * CHUNK) * TILE, oy = (r - cy * CHUNK) * TILE, k = kind(c, r);
        if (hd > 1) { this.bakeTileHd(g, k, c, r, ox * hd, oy * hd, kind, f); continue; }
        if (!paintRichGround(g, k, c, r, ox, oy, (dx, dy) => kind(c + dx, r + dy), f)) paintGround(g, k, c, r, ox, oy, f);
        const edge = (n: Ground, side: 'n' | 's' | 'w' | 'e') => { if (!richEdge(k, n)) paintEdge(g, k, n, side, c, r, ox, oy); };
        edge(kind(c, r - 1), 'n'); edge(kind(c, r + 1), 's'); edge(kind(c - 1, r), 'w'); edge(kind(c + 1, r), 'e');
      }
      e.rows[f]++;
      if (performance.now() > deadline) break;
    }
    if (this.perf) this.bakeMs += performance.now() - b0;
    return e.rows[f] >= CHUNK;
  }
  private tileScratch: HTMLCanvasElement | null = null;
  /**
   * Option B's finer ground (td-artopt.ts): grass, flower beds and roads painted at two pixels a world pixel
   * (td-ground paintRichGroundHd); anything else painted at the art grid on a scratch tile and scaled up whole, its
   * edges likewise laid over.
   */
  private bakeTileHd(g: CanvasRenderingContext2D, k: Ground, c: number, r: number, hx: number, hy: number, kind: (c: number, r: number) => Ground, f: number): void {
    const t = this.tileScratch ??= Object.assign(document.createElement('canvas'), { width: TILE, height: TILE });
    const tg = t.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    const nb = (dx: number, dy: number) => kind(c + dx, r + dy);
    const rich = paintRichGroundHd(g, k, c, r, hx, hy, nb);
    tg.clearRect(0, 0, TILE, TILE);
    if (!rich && !paintRichGround(tg, k, c, r, 0, 0, nb, f)) paintGround(tg, k, c, r, 0, 0, f);
    let edges = !rich;
    const edge = (n: Ground, side: 'n' | 's' | 'w' | 'e') => { if (!richEdge(k, n) && !(rich && GRASSY_HD.has(n) && GRASSY_HD.has(k))) { paintEdge(tg, k, n, side, c, r, 0, 0); edges = true; } };
    edge(kind(c, r - 1), 'n'); edge(kind(c, r + 1), 's'); edge(kind(c - 1, r), 'w'); edge(kind(c + 1, r), 'e');
    if (edges) g.drawImage(t, hx, hy, TILE * 2, TILE * 2);
  }
  /** The canvas to draw for chunk (cx, cy) at water frame `frame`: frame 0 is finished at once; later frames when ready. */
  private chunk(cx: number, cy: number, frame: number): HTMLCanvasElement {
    const e = this.chunkAt(cx, cy);
    this.bakeRows(e, 0, Infinity);
    const f = ((frame % e.rows.length) + e.rows.length) % e.rows.length;
    return e.rows[f] >= CHUNK ? e.frames[f]! : e.frames[0]!;
  }
  /** After a draw: spend up to BAKE_MS on the view's water frames, then the ring of chunks round the view, nearest first. */
  private prefetchGround(x0: number, y0: number, x1: number, y1: number): void {
    const deadline = performance.now() + BAKE_MS;
    const todo: { e: GroundChunk; d: number }[] = [];
    const pcx = this.player.x / (CHUNK * TILE), pcy = this.player.y / (CHUNK * TILE);
    for (let cy = y0 - 1; cy <= y1 + 1; cy++) for (let cx = x0 - 1; cx <= x1 + 1; cx++) {
      const key = `${cx},${cy}`, have = this.chunks.get(key);
      if (have && have.rows.every(r => r >= CHUNK)) continue;
      const inView = cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
      todo.push({ e: have ?? this.chunkAt(cx, cy), d: (inView ? 0 : 100) + Math.hypot(cx + .5 - pcx, cy + .5 - pcy) });
    }
    todo.sort((a, b) => a.d - b.d);
    for (const { e } of todo) {
      for (let f = 0; f < e.rows.length; f++) if (!this.bakeRows(e, f, deadline)) return;
      if (performance.now() > deadline) return;
    }
  }

  private draw(): void {
    this.resize();
    const c = this.ctx, s = this.scale, cam = this.cam;
    c.imageSmoothingEnabled = false;
    c.setTransform(1, 0, 0, 1, 0, 0);
    // No full-canvas clear: the ground's chunks are opaque (bakeRows) and cover the view, and on a phone that clear was a
    // whole extra pass over every pixel a frame (docs/handoff/calm.md). Only the rim past the last whole pixel is filled.
    c.fillStyle = '#2a1a24';
    { const rw = this.canvas.width % s, rh = this.canvas.height % s; if (rw) c.fillRect(this.canvas.width - rw, 0, rw, this.canvas.height); if (rh) c.fillRect(0, this.canvas.height - rh, this.canvas.width, rh); }
    c.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
    // Ground.
    const frame = Math.floor(this.time * 3) % 4;
    const span = CHUNK * TILE;
    const gx0 = Math.floor(cam.x / span), gx1 = Math.floor((cam.x + cam.w) / span), gy0 = Math.floor(cam.y / span), gy1 = Math.floor((cam.y + cam.h) / span);
    for (let cy = gy0; cy <= gy1; cy++) for (let cx = gx0; cx <= gx1; cx++) c.drawImage(this.chunk(cx, cy, frame), cx * span, cy * span, span, span);
    this.groundView = [gx0, gy0, gx1, gy1];
    // A Nightroad's planks over the water while it is open (td-dark-layer).
    if (this.level === this.world) this.darkLayer.drawGround(c, this.world.continent, (x, y) => x > cam.x - 32 && x < cam.x + cam.w + 32 && y > cam.y - 32 && y < cam.y + cam.h + 32);
    const inView = (x: number, y: number, pad = 80) => x > cam.x - pad && x < cam.x + cam.w + pad && y > cam.y - pad && y < cam.y + cam.h + pad * 2;
    const visible = this.level.objectsIn(cam.x - 120, cam.y - 80, cam.x + cam.w + 120, cam.y + cam.h + 240);
    this.visible = visible;
    // Shadows on the ground (td-shade.ts): under every tree and everything standing, never over a neighbour's feet.
    this.drawShadows(visible, inView);
    // Ground effects (aura rings, nova waves, sigils): under every creature and the Keeper.
    this.drawGroundFx();
    // The weather's puddles (Normal) and the fishing spots: their floats and the fish under the water (td-gather).
    const lowDetail = envDetail() === 'low';
    if (this.level === this.world) {
      if (!lowDetail) this.weatherFx.drawPuddles(c, cam, (q, r) => this.level.ground(q, r), { left: 1 });
      this.spotsInView = this.world.spotsIn(cam.x - 40, cam.y - 40, cam.x + cam.w + 40, cam.y + cam.h + 40);
      const sky = { dark: this.skyPhase === 'night' || this.skyPhase === 'eclipse', eclipse: this.skyPhase === 'eclipse' };
      this.gather.drawWater(c, this.spotsInView, this.time, this.player, sky, lowDetail || this.phone ? SHADOW_CAP_LOW : SHADOW_CAP, this.still, this.weatherFx.rain > 0);
    } else { this.spotsInView = []; this.gather.shadowsDrawn = 0; }
    // Y-sorted world: objects, keepers, the Keeper, Glim.
    type Item = { y: number; draw: () => void };
    const items: Item[] = [];
    const roofs: { o: TdObject; sp: Sprite }[] = [];
    for (const o of visible) {
      const sp = o.sprite();
      const jig = this.chop && this.shake > 0 && o.kind === 'tree' && o.x === this.chop.x && o.y === this.chop.y ? Math.round(Math.sin(this.time * 70) * 1.5) : 0;
      const k = sp.k ?? 1;
      if (k !== 1) items.push({ y: o.y, draw: () => c.drawImage(sp.img, Math.round(o.x) - sp.ax / k + jig, Math.round(o.y) - sp.ay / k, sp.img.width / k, sp.img.height / k) });
      else items.push({ y: o.y, draw: () => c.drawImage(sp.img, Math.round(o.x - sp.ax) + jig, Math.round(o.y - sp.ay)) });
      if (sp.roof) roofs.push({ o, sp });
    }
    const surface = this.level === this.world;
    for (const k of this.keepers) if (surface && inView(k.x, k.y)) items.push({ y: k.y, draw: () => this.drawPerson(k, 'idle') });
    for (const f of this.folk) if (surface && inView(f.x, f.y)) items.push({ y: f.y, draw: () => this.drawPerson(f, f.moving ? 'walk' : 'idle') });
    for (const cp of this.mobs.remains) if (inView(cp.x, cp.y)) items.push({ y: cp.y - 9, draw: () => this.drawCorpse(cp) });
    for (const g of this.groundLoot()) if (inView(g.x, g.y)) items.push({ y: g.y - 6, draw: () => this.drawDrop(g) });
    // The Cold Hearth: each settlement's hearth (cold until lit), a capital's shrine, the fallen purse.
    if (surface) for (const h of this.hearths) {
      if (inView(h.x, h.y)) items.push({ y: h.y, draw: () => drawHearth(c, h.x, h.y, this.hearthLit.has(h.id), this.time, this.still) });
      const sh = h.shrine;
      if (sh && inView(sh.x, sh.y)) items.push({ y: sh.y, draw: () => drawShrine(c, sh.x, sh.y, this.hearthBlessed, this.time, this.still) });
    }
    // The Sexton's Count: Wren's chalk on the three marked stones (once the chain is taken).
    if (surface && this.world.continent === SEXTON_CONTINENT && this.sexton.step !== 'offer') for (const st of SEXTON_STONES) {
      const x = st.c * TILE + TILE / 2, y = st.r * TILE + TILE;
      if (inView(x, y)) items.push({ y: y + .5, draw: () => chalkMark(c, x, y, this.sexton.facts.has(`stone-${st.n}`), this.time, this.still || this.sexton.step !== 'stones') });
    }
    const fallen = this.purseHere();
    if (fallen && inView(fallen.x, fallen.y)) items.push({ y: fallen.y, draw: () => drawPurse(c, fallen.x, fallen.y, this.time, this.still) });
    // Town portals on this level: the Keeper's own and the party's (td-waygate.ts).
    for (const g of this.gates.ends(this.time)) if (inView(g.x, g.y)) items.push({ y: g.y - .5, draw: () => drawWaygate(c, g.x, g.y, this.time, this.still, g.fade, g.party) });
    for (const m of this.mobs.mobs) if (inView(m.x, m.y)) items.push({ y: m.y, draw: () => this.drawMob(m) });
    for (const k of this.mobs.minions) if (inView(k.x, k.y)) items.push({ y: k.y, draw: () => this.drawRaised(k) });
    for (const b of this.mobs.beacons) if (inView(b.x, b.y)) items.push({ y: b.y, draw: () => drawBeacon(c, b, this.time, this.still) });
    for (const b of this.mobs.beasts) if (inView(b.x, b.y)) items.push({ y: b.y, draw: () => drawBeast(c, b, this.time, this.still) });
    const pet = this.pet;
    if (pet && inView(pet.x, pet.y)) items.push({ y: pet.y, draw: () => this.drawPet(pet) });
    // Other Keepers' companions (coop-pals.ts), each with its owner's painter.
    {
      const now = performance.now(), drawn = new Set(this.peers.drawn.map(p => p.id));
      for (const sp of this.palBook.shown(now)) if (drawn.has(sp.owner) && inView(sp.x, sp.y)) items.push({ y: sp.y, draw: () => this.drawPal(sp.pal, sp.x, sp.y, sp.moving) });
      for (const peer of this.peers.drawn) {
        if (this.palBook.fresh(peer.id, now)) continue;
        for (const q of decodePresencePals(this.peers.palsOf(peer.id))) {
          const x = peer.x + q.dx, y = peer.y + q.dy;
          if (inView(x, y)) items.push({ y, draw: () => this.drawPal({ i: q.k, k: q.k, ...(q.t ? { t: q.t } : {}), x, y, f: q.dx > 0 ? -1 : 1 }, x, y, peer.moving) });
        }
      }
    }
    // Other Keepers (the Hearth room): y-sorted with the world, but always under the local Keeper where they overlap.
    const view = { scale: s, camX: cam.x, camY: cam.y, time: this.time, still: this.still };
    for (const p of this.peers.drawn) {
      if (!inView(p.x, p.y)) continue;
      const under = Math.abs(p.x - this.player.x) < 18 && Math.abs(p.y - this.player.y) < 36;
      items.push({ y: under ? Math.min(p.y, this.player.y - .01) : p.y, draw: () => this.peers.draw(c, p, view) });
    }
    items.push({ y: this.player.y, draw: () => this.drawPerson(this.player, this.player.moving ? 'run' : 'idle') });
    // Campfires (Firemaking) stand among everything else, sorted by their feet.
    for (const f of this.gather.fires) if (f.lv === this.level.id && inView(f.x, f.y)) items.push({ y: f.y, draw: () => this.gather.drawFire(c, f, this.time, this.still) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();
    // The spots' floats, the line to the one being fished, the sparks of a light being struck.
    if (this.level === this.world) this.gather.drawFloats(c, this.spotsInView, this.time, this.still);
    this.gather.drawLine(c, this.player, this.time);
    this.gather.drawStrike(c, this.time, this.still);
    { const look = this.auraLook(); if (look) {
      if (!optCamera()) this.auraFx.air(c, this.player.x, this.player.y - 1, look);
      else if (optHdFigures()) { c.save(); c.scale(.5, .5); this.lookAura.air(c, Math.round(this.player.x) * 2, (Math.round(this.player.y) - 1) * 2, look); c.restore(); }
      else this.lookAura.air(c, this.player.x, this.player.y - 1, look);
    } }
    // S6: the pack auras' motes and their linked lines; what falls from above onto its ring.
    { const cam = this.cam, near = (x: number, y: number) => x > cam.x - 60 && x < cam.x + cam.w + 60 && y > cam.y - 40 && y < cam.y + cam.h + 80; const low = envDetail() === 'low'; drawPackAir(c, this.mobs.mobs, this.time, this.still, near, low); if (!low) for (const b of this.mobs.bursts) if (b.tone && near(b.x, b.y)) drawFalling(c, b, this.time, this.still); }
    // Roofs and crowns, faded when the Keeper is behind or under them.
    for (const { o, sp } of roofs) {
      const r = sp.roof!, rk = sp.k ?? 1;
      const x0 = o.x + r.x, y0 = o.y + r.y, x1 = x0 + r.img.width / rk, y1 = y0 + r.img.height / rk;
      const under = this.player.x > x0 + 2 && this.player.x < x1 - 2 && this.player.y - 20 > y0 && this.player.y - 20 < y1 + 4 && this.player.y < o.y;
      c.globalAlpha = under ? .32 : 1;
      if (rk !== 1) c.drawImage(r.img, Math.round(o.x) + r.x, Math.round(o.y) + r.y, r.img.width / rk, r.img.height / rk);
      else c.drawImage(r.img, Math.round(x0), Math.round(y0));
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
    // Glim: the lamplight moth, its sparks, its pointing trail (in the air, over everything on the ground).
    this.drawGlim();
    // Mist (the Umbral Marches), then night over it.
    this.drawFog();
    this.drawLight();
    this.drawNightEyes(inView);
    // What only the dark shows: the shapes at the light's edge, the prints behind, a shy chest, a road's pale nails.
    // The ledger page on the barrow's jetty: only the dark shows it (over the night pass, faintly lit).
    if (this.level === this.world && this.world.continent === SEXTON_CONTINENT && pageShown(this.sexton.step, this.phaseNow)) {
      const px = SEXTON_PAGE.c * TILE + TILE / 2, py = SEXTON_PAGE.r * TILE + TILE - 3;
      if (inView(px, py, 40)) ledgerPage(c, px, py, 1, this.time, this.still);
    }
    this.darkLayer.drawOver(c, { levelId: this.level.id, continent: this.world.continent, surface: this.level === this.world, time: this.time, still: this.still, night: this.level.dark ? 1 : this.darkness }, (x, y) => inView(x, y, 40));
    this.drawFireflies();
    // The weather over the world, under the HUD (td-weather-fx): the dimmed day, the rain, a storm's flash.
    if (this.level === this.world) this.weatherFx.drawScreen(c, this.canvas.width, this.canvas.height, this.scale, this.time, this.frameDt, { still: this.still, low: lowDetail, phone: this.phone, night: this.darkness });
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
    for (const k of this.keepers) if (this.platesOn && this.level === this.world && k.name && inView(k.x, k.y) && Math.hypot(this.player.x - k.x, this.player.y - k.y) < 90) this.plate(k.name, k.x, k.y - up(42), '#f3e7cf');
    // Other Keepers' name plates (name · level) and Waves (over them and over the Keeper).
    for (const p of this.peers.drawn) {
      if (!inView(p.x, p.y)) continue;
      if (this.platesOn) this.plate(p.level ? `${p.name} · ${p.level}` : p.name, p.x, p.y - up(42), this.peers.party.has(p.id) ? PARTY_PLATE : PEER_PLATE);
      if (this.peers.waving(p.id, this.time)) this.peers.drawWave(c, p.x, p.y - up(52), this.time, this.still);
    }
    if (this.peers.waving('', this.time)) this.peers.drawWave(c, this.player.x, this.player.y - up(46), this.time, this.still);
    // Shared ground items (protocol 6): where they are on the page, for the HUD's tests and tools (only while any lie here).
    if (this.shared.length || this.groundSeen) {
      const at = this.groundOnScreen().map(g => `${g.id}@${g.x},${g.y}`).join(';');
      if (at !== this.groundSeen) { this.groundSeen = at; this.canvas.setAttribute('data-ground-at', at); }
    }
    // A task giver's head mark: '!' a task on offer, '?' one to hand in (MapleStory), seen from across the square.
    for (const k of this.keepers) { const m = k.kid ? this.taskMarks[k.kid] : undefined; if (m && this.level === this.world && inView(k.x, k.y)) this.headMark(m, k.x, k.y - (Math.hypot(this.player.x - k.x, this.player.y - k.y) < 90 ? up(54) : up(44))); }
    this.drawEffects();
    this.drawSeek();
    this.drawFightUi(inView);
    // A giver standing on their own already wears their name: no second plate.
    if (this.nearby && !this.nearby.station.id.startsWith('giver-')) this.plate(this.nearby.station.label, this.nearby.x, this.nearby.y - (this.nearby.keeper ? up(62) : up(36)), '#ffd27a');
    // The fallen purse names itself when the Keeper is near.
    if (fallen && Math.hypot(fallen.x - this.player.x, fallen.y - this.player.y) < 110) this.plate(`${fallen.gold} Gold`, fallen.x, fallen.y - 14, '#ffd27a');
    // The Hush at its deepest: the edge of the world thins (screen space, two art pixels).
    if (this.darkLayer.band >= 3 && this.darkLayer.awake({ keeperLevel: this.mobs.keeperLevel, continent: this.world.continent })) { c.setTransform(1, 0, 0, 1, 0, 0); this.darkLayer.drawEdge(c, this.canvas.width, this.canvas.height, this.scale, this.time, this.still); }
    // The wake veil over everything (screen space).
    const veil = this.wakeVeil();
    if (veil.dark > 0 || veil.warm > 0) { c.setTransform(1, 0, 0, 1, 0, 0); drawWakeVeil(c, this.canvas.width, this.canvas.height, veil.dark, veil.warm); }
  }
  /** The ground pass's shadows: each object's own (a tree's), then a soft one under every Keeper, creature and pet. */
  private drawShadows(visible: readonly TdObject[], inView: (x: number, y: number, pad?: number) => boolean): void {
    const c = this.ctx;
    for (const o of visible) { const sp = o.sprite(), fl = sp.floor, sh = sp.shadow; if (fl) c.drawImage(fl.img, Math.round(o.x + fl.x), Math.round(o.y + fl.y)); if (sh) c.drawImage(sh.img, Math.round(o.x + sh.x), Math.round(o.y + sh.y)); }
    const surface = this.level === this.world;
    if (surface) {
      for (const k of this.keepers) if (inView(k.x, k.y) && k.painter) castShadow(c, k.x, k.y, 18);
      for (const f of this.folk) if (inView(f.x, f.y) && f.painter) castShadow(c, f.x, f.y, 18);
    }
    for (const m of this.mobs.mobs) if (inView(m.x, m.y)) castShadow(c, m.x, m.y, Math.max(10, m.def.w * .72), m.def.floats || m.def.ghost ? .55 : 1);
    for (const k of this.mobs.minions) if (inView(k.x, k.y)) castShadow(c, k.x, k.y, 16);
    const pet = this.pet;
    if (pet && inView(pet.x, pet.y)) castShadow(c, pet.x, pet.y, 14, TD_PET_FLIES.has(pet.id) ? .5 : 1);
    if (this.player.painter) castShadow(c, this.player.x, this.player.y, 20);
  }
  /** A pixel speech mark over a head: a brass bubble with '!' or '?', bobbing a little (still under reduced motion). */
  private headMark(mark: '!' | '?', x: number, y: number): void {
    const c = this.ctx, bob = this.still ? 0 : Math.round(Math.sin(this.time * 3) * 1.5);
    const bx = Math.round(x) - 5, by = Math.round(y) - 12 + bob;
    c.fillStyle = PAL.outline; c.fillRect(bx - 1, by - 1, 12, 13); c.fillRect(bx + 4, by + 12, 3, 2);
    c.fillStyle = mark === '?' ? '#ffd27a' : '#f3e7cf'; c.fillRect(bx, by, 10, 11);
    c.fillStyle = mark === '?' ? '#c98a2a' : '#d9c7a4'; c.fillRect(bx, by + 9, 10, 2);
    c.fillStyle = PAL.outline;
    c.font = 'bold 9px "Pixelify Sans", monospace';
    c.fillText(mark, bx + 5, by + 10);
  }

  /** A creature's picture box (its sheet's cell: mobCell), keyed by its definition. */
  private readonly visDefs = new WeakMap<object, Mob['def']>();
  private vis(def: Mob['def']): Mob['def'] {
    let v = this.visDefs.get(def);
    if (!v) { v = { ...def, ...mobCell(def) }; this.visDefs.set(def, v); }
    return v;
  }
  private tintScratch: HTMLCanvasElement | null = null;
  /** Lay `color` at `alpha` over a sheet frame's own pixels only, at the current transform's origin (drawMob's). */
  private tintFrame(sheet: HTMLCanvasElement, sx: number, w: number, h: number, color: string, alpha: number): void {
    const t = this.tintScratch ??= document.createElement('canvas');
    if (t.width < w || t.height < h) { t.width = Math.max(t.width, w); t.height = Math.max(t.height, h); }
    const g = t.getContext('2d')!;
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, t.width, t.height);
    g.drawImage(sheet, sx, 0, w, h, 0, 0, w, h);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = color; g.fillRect(0, 0, w, h);
    const c = this.ctx, was = c.globalAlpha;
    c.globalAlpha = was * alpha; c.drawImage(t, 0, 0, w, h, -Math.floor(w / 2), 0, w, h); c.globalAlpha = was;
  }
  private drawMob(m: Mob): void {
    // Underground (a burrow, S6): only the stir on the ground shows where it will rise.
    if ((m.hidden ?? 0) > 0) return;
    const c = this.ctx, d = this.vis(m.def), sheet = mobSheet(m.def), f = Math.floor(m.t * 6) % Math.max(1, Math.round(sheet.width / d.w));
    // The target stands in a red pixel square (Tibia).
    if (m === this.mobs.target) { c.strokeStyle = '#ff4a3a'; c.lineWidth = 1; c.strokeRect(Math.round(m.x - d.w / 2) - 2.5, Math.round(m.y - d.h) - 2.5, d.w + 5, d.h + 5); }
    c.save();
    // A floater drifts a little above the floor; a ghost is half there, flickering.
    const lift = d.floats ? Math.round(2 + Math.sin(m.t * 2.4) * 2) : 0;
    c.translate(Math.round(m.x), Math.round(m.y - d.h - lift));
    if (m.face < 0) c.scale(-1, 1);
    if (d.ghost) c.globalAlpha = .62 + Math.sin(m.t * 7 + m.hx) * .14 + (Math.random() < .04 ? -.25 : 0);
    // A Mirrored copy (S6): a little see-through, a breath grey (Glim dims beside it).
    if (m.mirror) c.globalAlpha *= .62;
    // Teleport's wind-up: it thins out where it stands before it is gone.
    if ((m.blinkT ?? 0) > 0) c.globalAlpha *= .35 + .65 * Math.max(0, (m.blinkT ?? 0) / .45);
    // The art-direction prototype (td-artopt.ts B/C): the Bone Walker in HD, half a world px a sheet px, feet where its cell's are.
    if (optHdFigures() && m.def.id === 'bone-walker' && envDetail() !== 'low') {
      const hs = hdSkeletonSheet(), S = HD_SKEL, hf = Math.floor(m.t * 6) % 4;
      c.drawImage(hs, hf * S.w, 0, S.w, S.h, -S.w / 4, d.h - S.h / 2 + 1, S.w / 2, S.h / 2);
      c.restore();
      if (m.elite) drawAffixTells(c, m, this.time, this.still);
      return;
    }
    c.drawImage(sheet, f * d.w, 0, d.w, d.h, -Math.floor(d.w / 2), 0, d.w, d.h);
    // An elite's body tone: a champion blue, a unique leader a breath of gold (never over 25 %).
    // The tints lie on the figure only (a scratch copy of its frame, tinted, laid over it): on the opaque world canvas a
    // source-atop fill coloured the whole cell, grass and all (S6 fix: the box round every champion).
    const tint = eliteTint(m);
    if (tint) this.tintFrame(sheet, f * d.w, d.w, d.h, tint.color, tint.alpha * (d.ghost ? .7 : 1));
    if (m.hit > 0) this.tintFrame(sheet, f * d.w, d.w, d.h, '#ffffff', .7);
    c.restore();
    if (m.elite) drawAffixTells(c, m, this.time, this.still);
    // S6: a body tell's glow, a Bone Ward's shards.
    drawBodyTell(c, m, this.time, this.still);
    drawMobS6Air(c, m, this.time, this.still);
  }
  /** A skeleton the Keeper raised: violet-eyed bones, a faint violet glow at its feet, its life in a small violet bar. */
  private drawRaised(k: Minion): void {
    const c = this.ctx, d = this.vis(RAISED_SKELETON), sheet = mobSheet(RAISED_SKELETON), f = Math.floor(k.t * 6) % Math.max(1, Math.round(sheet.width / d.w));
    c.globalAlpha = .35; c.fillStyle = '#b06bff'; c.fillRect(Math.round(k.x - 7), Math.round(k.y - 2), 14, 3); c.globalAlpha = 1;
    c.save();
    // Rising out of the ground for its first half second; fading as its time runs out.
    const rise = Math.max(0, 1 - k.t / .5);
    c.translate(Math.round(k.x), Math.round(k.y - d.h + rise * d.h * .6));
    if (k.face < 0) c.scale(-1, 1);
    if (k.life < 3) c.globalAlpha = .4 + .6 * (k.life / 3);
    c.drawImage(sheet, f * d.w, 0, d.w, Math.round(d.h * (1 - rise * .6)), -Math.floor(d.w / 2), 0, d.w, Math.round(d.h * (1 - rise * .6)));
    if (k.hit > 0) { c.globalCompositeOperation = 'source-atop'; c.globalAlpha = .6; c.fillStyle = '#ffffff'; c.fillRect(-d.w / 2, 0, d.w, d.h); }
    c.restore();
    const w = 14, frac = Math.max(0, k.hp / k.maxHp);
    c.fillStyle = '#1a1014'; c.fillRect(Math.round(k.x - w / 2) - 1, Math.round(k.y - d.h - 5), w + 2, 3);
    c.fillStyle = '#b06bff'; c.fillRect(Math.round(k.x - w / 2), Math.round(k.y - d.h - 4), Math.round(w * frac), 1);
  }
  // ── Corpses (td-corpse.ts): the fallen lie where they fell and rot; E or a tap opens one ──
  private corpseOpen: string | null = null;
  private corpseSig = '';
  /** The corpse window's view (what is still in it), or null when it is shut. */
  corpseView(): CorpseView | null {
    const cp = this.corpseOpen ? this.mobs.remains.find(c => c.id === this.corpseOpen) : undefined;
    if (!cp) return null;
    const stage = corpseStage(this.mobs.age - cp.born, cp.boss);
    return {
      id: cp.id, name: cp.kind.name, stage: stage === 'gone' ? 'bones' : stage,
      rows: this.mobs.corpseLoot(cp.id).map(g => ({ id: g.id, label: g.label, color: g.color, coins: g.coins, qty: g.qty })),
    };
  }
  openCorpse(id: string): boolean {
    if (!this.mobs.remains.some(c => c.id === id)) return false;
    this.corpseOpen = id; this.corpseSig = '';
    this.stepCorpse();
    return true;
  }
  closeCorpse(): void { if (!this.corpseOpen) return; this.corpseOpen = null; this.corpseSig = ''; this.options.onCorpse?.(null); }
  get corpseIsOpen(): boolean { return !!this.corpseOpen; }
  /** Take one piece (a drop id) or everything ('all') from the open corpse. Returns how many went into the satchel. */
  takeFromCorpse(what: string): number {
    const v = this.corpseView();
    if (!v) return 0;
    let n = 0;
    for (const row of v.rows) {
      if (what !== 'all' && row.id !== what) continue;
      if (this.mobs.takeDrop(row.id)) n++; else { this.say('corpse.full'); break; }
    }
    this.stepCorpse();
    return n;
  }
  /** Keep the window honest: shut when the Keeper walks off or the corpse is gone; tell the HUD when its contents change. */
  private stepCorpse(): void {
    if (!this.corpseOpen) return;
    const cp = this.mobs.remains.find(c => c.id === this.corpseOpen);
    if (!cp || Math.hypot(cp.x - this.player.x, cp.y - this.player.y) > CORPSE_REACH * 2.4) { this.closeCorpse(); return; }
    const v = this.corpseView();
    const sig = v ? `${v.stage}|${v.rows.map(r => r.id).join(',')}` : '';
    if (sig !== this.corpseSig) { this.corpseSig = sig; this.options.onCorpse?.(v); }
  }
  /** A corpse: its stage's sprite (flipped to the way it fell), the flies over a rotting one, a bag pip when there is loot in reach. */
  private drawCorpse(cp: Corpse): void {
    const age = this.mobs.age - cp.born, stage = corpseStage(age, cp.boss);
    if (stage === 'gone') return;
    const c = this.ctx, sprite = corpseSprite(cp, stage), x = Math.round(cp.x), y = Math.round(cp.y);
    c.globalAlpha = corpseAlpha(age, cp.boss);
    c.save();
    c.translate(x, y + 2 - sprite.height);
    if (cp.face < 0) c.scale(-1, 1);
    c.drawImage(sprite, -Math.floor(sprite.width / 2), 0);
    c.restore();
    c.globalAlpha = 1;
    // Flies over the rotting (a few dark pixels with a flicker of wing); none under reduced motion.
    if (stage === 'rotting' && !this.still) for (const f of flyDots(cp, this.time)) {
      c.fillStyle = '#1a1218'; c.fillRect(f.x, f.y, 1, 1);
      if (f.wing) { c.globalAlpha = .55; c.fillStyle = '#c8c8d8'; c.fillRect(f.x - 1, f.y - 1, 1, 1); c.globalAlpha = 1; }
    }
    // Loot in it and the Keeper close: a small bag over it ("E, or tap, to open").
    if (this.mobs.corpseNear(this.player.x, this.player.y)?.id === cp.id && this.corpseOpen !== cp.id) {
      const bob = this.still ? 0 : Math.round(Math.sin(this.time * 3.2));
      const bx = x - 3, by = y - corpseSize(cp).body - 11 + bob;
      c.fillStyle = '#2a1a24'; c.fillRect(bx - 1, by - 1, 8, 8);
      c.fillStyle = '#a8743f'; c.fillRect(bx, by + 1, 6, 5); c.fillStyle = '#c99657'; c.fillRect(bx + 1, by, 4, 2);
      c.fillStyle = '#ffd25a'; c.fillRect(bx + 2, by + 3, 2, 1);
    }
  }
  /** The loot on the ground: the fight's drops, and the screenshot showcase when it is on. */
  private groundLoot(): readonly Drop[] {
    if (!this.showcase.length && !this.shared.length) return this.mobs.drops;
    return [...this.mobs.drops, ...this.shared, ...this.showcase];
  }
  /**
   * Protocol 6: the items on the ground in this area that the room told of — drawn like loot (the rung's light column,
   * a plate in its rarity colour), but never taken by walking over them: a tap walks there and the HUD asks the trade
   * Function, which gives it to whoever reaches it first.
   */
  setSharedGround(items: readonly { id: string; x: number; y: number; name: string; rarity: string; def: string }[]): void {
    const rung = (r: string): LootRung => (r in LOOT ? r as LootRung : 'common');
    this.shared = items.map(g => ({ id: `shared:${g.id}`, x: g.x, y: g.y, coins: 0, qty: 1, item: { definitionId: g.def, rarity: rung(g.rarity), unique: false }, rarity: rung(g.rarity), label: g.name, color: LOOT[rung(g.rarity)].body, age: 99 }));
    this.canvas.setAttribute('data-ground', items.map(g => g.id).join(','));
  }
  /**
   * Protocol 7 (play/social/world-protocol.ts): the room's ground in this area. Each piece lies among the fight's own
   * drops (drawn, magnetised and picked the same way), marked `room`: a pick asks the room (onRoomTake) instead of
   * granting. `items` replaces every room piece here; `add` and `gone` change it. A piece of another Keeper's kill
   * waits (`hold`) until it is anyone's. Gone ids are remembered a while, so an answer racing an update cannot revive one.
   */
  setRoomGround(msg: { area: string; items?: readonly WorldDrop[]; add?: readonly WorldDrop[]; gone?: readonly string[] }, me: string): void {
    const drops = this.mobs.drops;
    if (msg.area !== this.peerArea()) { this.clearRoomGround(); return; }
    this.roomArea = msg.area;
    const lay = (g: WorldDrop): void => {
      if (this.roomGone.has(g.id) || this.roomTaking.has(g.id)) return;
      const i = drops.findIndex(d => d.id === g.id);
      if (i >= 0) drops.splice(i, 1);
      const hold = g.own.length && !g.own.includes(me) ? Math.max(0, g.free) / 1000 : 0;
      drops.push({
        id: g.id, x: g.x, y: g.y, coins: g.coins, qty: g.qty, ...(g.material ? { material: g.material } : {}),
        ...(g.item ? { item: { definitionId: g.item.definitionId, rarity: g.item.rarity as LootRarity, unique: g.item.unique, ...(g.item.level ? { level: g.item.level } : {}) } } : {}),
        ...(g.rune ? { rune: g.rune } : {}), ...(g.rarity ? { rarity: g.rarity as LootRarity } : {}), label: g.label, color: g.color, age: 1,
        ...(this.coop.corpseOf(g.m) ? { corpse: this.coop.corpseOf(g.m) } : {}), room: { hold, wait: 0 },
      });
    };
    if (msg.items) {
      const keep = new Set(msg.items.map(g => g.id));
      for (let i = drops.length - 1; i >= 0; i--) if (drops[i].room && !keep.has(drops[i].id)) drops.splice(i, 1);
      for (const g of msg.items) lay(g);
    }
    for (const g of msg.add ?? []) lay(g);
    for (const id of msg.gone ?? []) {
      this.roomGone.add(id);
      const i = drops.findIndex(d => d.id === id);
      if (i >= 0) drops.splice(i, 1);
    }
    if (this.roomGone.size > 400) for (const id of [...this.roomGone].slice(0, 200)) this.roomGone.delete(id);
    this.markRoomGround();
  }
  /** The room said no (someone else was first, not yet this Keeper's) or the satchel was full: the piece lies again. */
  restoreRoomDrop(g: Drop, wait = 1.5): void {
    this.roomTaking.delete(g.id);
    if (this.roomGone.has(g.id) || this.mobs.drops.some(d => d.id === g.id)) return;
    this.mobs.drops.push({ ...g, room: { hold: g.room?.hold ?? 0, wait } });
    this.markRoomGround();
  }
  /** The room said yes: the piece is this Keeper's (it never comes back on a late update). */
  tookRoomDrop(id: string): void { this.roomTaking.delete(id); this.roomGone.add(id); this.markRoomGround(); }
  /** A piece is on its way to the room (picked, not yet answered). */
  takingRoomDrop(id: string): void { this.roomTaking.add(id); }
  private clearRoomGround(): void {
    this.roomArea = '';
    const drops = this.mobs.drops;
    for (let i = drops.length - 1; i >= 0; i--) if (drops[i].room) drops.splice(i, 1);
    this.markRoomGround();
  }
  private markRoomGround(): void {
    const ids = this.mobs.drops.filter(d => d.room).map(d => d.id);
    this.canvas.setAttribute('data-room-ground', String(ids.length));
  }
  /** Where shared ground items are drawn, in CSS pixels on the page (the e2e's tap target). */
  groundOnScreen(): { id: string; x: number; y: number }[] {
    const r = this.canvas.getBoundingClientRect(), k = Math.max(1, this.canvas.width) / Math.max(1, r.width);
    return this.shared.map(g => ({ id: g.id.slice('shared:'.length), x: Math.round(r.left + (g.x - this.cam.x) * this.scale / k), y: Math.round(r.top + (g.y - 4 - this.cam.y) * this.scale / k) }));
  }
  /**
   * A drop on the ground: a coin pile, a sack, or gear standing in a pixel light column of its rung (spec §Loot) —
   * the rarer the taller, stepped bands (never a gradient), at most 55% over whatever stands behind it; legendary and
   * up carry motes climbing the column. Common gear only glints. The ground ring is drawn under creatures (drawGroundFx).
   */
  private drawDrop(g: Drop): void {
    const c = this.ctx, X = Math.round(g.x), Y = Math.round(g.y), rung = rungOf(g);
    if (rung) {
      const tn = LOOT[rung], beam = lootBeam(rung), seed = this.dropSeed(g);
      const pulse = this.still ? 1 : .85 + .15 * Math.sin(this.time * 2.6 + seed % 7);
      const glow = dropGlow(rung), icon = this.dropSprite(g);
      for (const b of beamSteps(beam.h)) {
        // Five pixels wide: an edge-tone halo, a body column, a one-pixel core — each band a step dimmer than the one under it.
        const top = Y - 3 + b.y1, h = b.y0 - b.y1, a = b.a * pulse * glow.beam;
        c.globalAlpha = a * .45; c.fillStyle = tn.edge; c.fillRect(X - 2, top, 5, h);
        c.globalAlpha = a; c.fillStyle = tn.body; c.fillRect(X - 1, top, 3, h);
        c.fillStyle = tn.core; c.fillRect(X, top, 1, h);
      }
      const motes = Math.max(beam.motes, glow.motes);
      if (motes && beam.h) {
        c.globalAlpha = .55;
        for (const [i, m] of beamMotes(beam.h, motes, this.still ? 1.3 : this.time, seed).entries()) {
          c.fillStyle = i % 2 ? tn.core : tn.body; c.fillRect(X + m.x, Y - 3 + m.y, 1, 1);
        }
      }
      // A halo round the piece (epic and up): dithered rings of its light, a step dimmer outward.
      for (let r = 0; r < glow.halo; r++) {
        c.globalAlpha = (r ? .22 : .38) * pulse; c.fillStyle = r ? tn.edge : tn.body;
        circlePixels(7 + r * 3).forEach((q, i) => { if ((i + r) % 2 === 0) c.fillRect(X + q.x, Y - 5 + Math.round(q.y / 2), 1, 1); });
      }
      c.globalAlpha = 1;
      if (icon) {
        // Its own shape, lying on the ground: a one-pixel dark shadow under it, mirrored by the drop's seed.
        const S = icon.width, x0 = X - (S >> 1), y0 = Y - S + 1;
        c.fillStyle = '#2a1a24'; c.globalAlpha = .55; c.fillRect(x0 + 1, Y - 1, S - 2, 2); c.globalAlpha = 1;
        if (seed & 1) { c.save(); c.translate(X, 0); c.scale(-1, 1); c.drawImage(icon, -(S >> 1), y0); c.restore(); }
        else c.drawImage(icon, x0, y0);
      } else {
        // Until the icon loads: a dark-outlined tile of its colour with a shine.
        c.fillStyle = '#2a1a24'; c.fillRect(X - 4, Y - 6, 9, 5);
        c.fillStyle = tn.edge; c.fillRect(X - 3, Y - 5, 7, 3);
        c.fillStyle = tn.body; c.fillRect(X - 3, Y - 5, 6, 2);
        c.fillStyle = tn.core; c.fillRect(X - 2, Y - 5, 2, 1);
      }
      // A glint: a four-point twinkle that crosses the piece now and then (every drop on its own beat).
      const beat = this.still ? .05 : ((this.time + (seed % 97) / 31) % 2.2) / 2.2;
      if (beat < .12) {
        const gy = icon ? Y - 11 : Y - 6, big = beat > .03 && beat < .09;
        c.fillStyle = '#ffffff'; c.fillRect(X + 2, gy, 1, 1);
        c.globalAlpha = .8; c.fillStyle = tn.core;
        c.fillRect(X + 1, gy, 1, 1); c.fillRect(X + 3, gy, 1, 1); c.fillRect(X + 2, gy - 1, 1, 1); c.fillRect(X + 2, gy + 1, 1, 1);
        if (big) { c.fillRect(X, gy, 1, 1); c.fillRect(X + 4, gy, 1, 1); c.fillRect(X + 2, gy - 2, 1, 1); }
        c.globalAlpha = 1;
      }
    } else if (g.coins > 0) {
      const beat = this.still ? .05 : ((this.time + (this.dropSeed(g) % 97) / 31) % 2.4) / 2.4;
      drawGoldPile(c, X, Y, goldPileSize(g.coins), beat < .12);
    } else if (this.dropSprite(g)) {
      const icon = this.dropSprite(g)!, S = icon.width;
      c.fillStyle = '#2a1a24'; c.globalAlpha = .55; c.fillRect(X - (S >> 1) + 1, Y - 1, S - 2, 2); c.globalAlpha = 1;
      c.drawImage(icon, X - (S >> 1), Y - S + 1);
    } else {
      c.fillStyle = '#2a1a24'; c.fillRect(X - 4, Y - 8, 8, 8); c.fillStyle = '#a8743f'; c.fillRect(X - 3, Y - 7, 6, 6); c.fillStyle = '#c99657'; c.fillRect(X - 3, Y - 7, 6, 2);
    }
  }
  /** Ground sprites: each icon baked once at 14 px (nearest) when its image has loaded; null until then. */
  private readonly dropSprites = new Map<string, HTMLCanvasElement | null>();
  private dropSprite(g: Drop): HTMLCanvasElement | null {
    const src = dropIconSrc(g);
    if (!src || typeof Image === 'undefined') return null;
    const hit = this.dropSprites.get(src);
    if (hit !== undefined) return hit;
    this.dropSprites.set(src, null);
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width = 14; cv.height = 14;
      const x = cv.getContext('2d');
      if (x) { x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, 14, 14); this.dropSprites.set(src, cv); }
    };
    img.src = src;
    return null;
  }
  private dropSeed(g: Drop): number { let h = 0; for (let i = 0; i < g.id.length; i++) h = (h * 31 + g.id.charCodeAt(i)) | 0; return Math.abs(h); }
  /** The top of a drop's column (its label sits just over it). */
  private dropTop(g: Drop): number { const r = rungOf(g); return g.y - 8 - (r ? lootBeam(r).h : 0); }

  /** The S6 scenes (fxS6): the Keeper steps onto open grass, then the scene is laid and kept going for the camera. */
  private layS6(dt: number): void {
    const p = this.player;
    const calm = (m: Mob) => { m.def = { ...m.def, sight: 0 }; m.wait = 1e9; m.wander = null; };
    if (!this.fxS6Laid) {
      if (this.time < .5) return;
      this.fxS6Laid = true;
      const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
      const open = (c0: number, r0: number) => { for (let dr = -7; dr <= 5; dr++) for (let dc = -12; dc <= 12; dc++) if (!this.level.walkable(c0 + dc, r0 + dr)) return false; return true; };
      search: for (let rad = 6; rad <= 50; rad += 2) for (let k = 0; k < 24; k++) {
        const c = pc + Math.round(Math.cos(k / 24 * Math.PI * 2) * rad), r = pr + Math.round(Math.sin(k / 24 * Math.PI * 2) * rad);
        if (this.level === this.world && this.world.inTown(c, r)) continue;
        if (open(c, r)) { p.x = c * TILE + TILE / 2; p.y = r * TILE + TILE; break search; }
      }
      const at = (type: string, dx: number, dy: number, level?: number): Mob => { const m = this.mobs.place(`fx-s6:${type}:${dx},${dy}`, level ? atZoneLevel(MOBS[type], level) : MOBS[type], p.x + dx, p.y + dy); calm(m); return m; };
      const pack = (type: string, dx: number, dy: number, affixes: string[], name: string | null, n: number) => { for (const m of this.mobs.spawnPack(`fx-s6:${type}`, MOBS[type], p.x + dx, p.y + dy, makePack(name ? 'unique' : 'champion', affixes as never, name, n))) calm(m); };
      if (this.fxS6 === 'aura') {
        pack('bone-walker', -110, -30, ['aura-might', 'extra-strong'], 'Grimfang the Hollow', 2);
        pack('cinder-orc', 96, -6, ['aura-holy-freeze'], null, 2);
        at('orc-warlord', 0, -76, 16); at('cinder-orc', -30, -66, 16); at('cinder-orc', 30, -66, 16);
      } else if (this.fxS6 === 'raise') {
        at('ashsinger', 84, -44, 14);
        // His own aura would burn the singer down before the camera arrives.
        this.mobs.aura = null;
      } else if (this.fxS6 === 'meteor') {
        at('ember-drake', -80, -40, 18); at('orc-warlord', 80, -40, 16);
      } else if (this.fxS6 === 'pets') {
        this.mobs.useStone('raise-skeleton', 3);
      }
    }
    // Keep the scene going: the singer sings the next corpses up, the meteors keep falling beside the Keeper.
    if (this.fxS6 === 'raise') for (const m of this.mobs.mobs) if (m.raised && m.def.sight) calm(m);
    this.fxS6T -= dt;
    if (this.fxS6T > 0) return;
    this.fxS6T = 2.6;
    if (this.fxS6 === 'raise') {
      // The last verse's orcs lie down again (laid to rest), and three fresh dead wait for the next one.
      for (const m of [...this.mobs.mobs]) if (m.raised) this.mobs.fxLayDead(m);
      for (const [dx, dy] of [[-30, -34], [0, -50], [30, -30]]) { const o = this.mobs.place(`fx-s6:dead:${Math.round(this.time * 10)}:${dx}`, atZoneLevel(MOBS['cinder-orc'], 14), p.x + dx, p.y + dy); calm(o); this.mobs.fxLayDead(o); }
      const s = this.mobs.mobs.find(m => m.def.id === 'ashsinger');
      if (s) this.mobs.fxCast(s, 0, p.x, p.y);
      this.fxS6T = 3.2;
    }
    if (this.fxS6 === 'meteor') {
      const d = this.mobs.mobs.find(m => m.def.id === 'ember-drake'), w = this.mobs.mobs.find(m => m.def.id === 'orc-warlord');
      if (d) this.mobs.fxCast(d, 0, p.x - 44, p.y + 6);
      if (w) this.mobs.fxCast(w, 0, p.x + 48, p.y - 4);
    }
  }
  /** Loot pops: a burst in its colour as gear lands, a smaller one rising as it is taken; the showcase, when on. */
  private updateLoot(dt: number): void {
    if (this.fxElite && !this.fxEliteLaid && this.time > .5) {
      // Calm by default (no sight), so the pictures hold; `fight` keeps their sight.
      this.fxEliteLaid = true;
      // Open grass just outside the square (no wild spawns this close to town): the Keeper steps there, the packs
      // stand either side of him with room for their plates, on a desktop and on a phone alike.
      const p = this.player, calm = this.fxElite !== 'fight', pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
      const open = (c0: number, r0: number) => { for (let dr = -6; dr <= 4; dr++) for (let dc = -11; dc <= 11; dc++) if (!this.level.walkable(c0 + dc, r0 + dr)) return false; return true; };
      search: for (let rad = 6; rad <= 44; rad += 2) for (let k = 0; k < 24; k++) {
        const c = pc + Math.round(Math.cos(k / 24 * Math.PI * 2) * rad), r = pr + Math.round(Math.sin(k / 24 * Math.PI * 2) * rad);
        if (this.level === this.world && this.world.inTown(c, r)) continue;
        if (open(c, r)) { p.x = c * TILE + TILE / 2; p.y = r * TILE + TILE; break search; }
      }
      const lay = (type: string, dx: number, dy: number, pack: ReturnType<typeof makePack>) => {
        const def = MOBS[type];
        if (!def) return;
        for (const m of this.mobs.spawnPack(`fx-elite:${type}`, calm ? { ...def, sight: 0 } : def, p.x + dx, p.y + dy, pack)) if (calm) { m.def = { ...m.def, sight: 0 }; m.wait = 1e9; }
      };
      // Side by side on a wide view; on a narrow one (a phone), the unique ahead and the champions behind.
      const wide = this.cam.w >= 320;
      lay('cinder-bailiff', wide ? 84 : 0, wide ? -4 : 92, makePack('champion', ['extra-fast'], null, 2));
      lay('bone-walker', wide ? -84 : 0, wide ? -4 : -80, makePack('unique', ['cold-aura', 'extra-strong', 'mana-burn'], 'Grimfang the Hollow', 3));
    }
    if (this.fxS6) this.layS6(dt);
    // For the elite specs: what packs walk round the Keeper ("champion:3,unique:1,minion:3").
    let ch = 0, un = 0, mi = 0;
    for (const m of this.mobs.mobs) if (m.elite) { if (m.elite.role === 'minion') mi++; else if (m.elite.rank === 'champion') ch++; else un++; }
    const seen = `champion:${ch},unique:${un},minion:${mi}`;
    if (seen !== this.eliteSeen) { this.eliteSeen = seen; this.canvas.setAttribute('data-elites', seen); }
    if (this.fxGold && !this.fxGoldLaid) {
      // Just past the Keeper's pull (8 tiles), so they lie still until he walks over: a few coins, a pile, a heap.
      this.fxGoldLaid = true;
      const p = this.player;
      for (const [i, coins, dx, dy] of [[0, 12, 134, -2], [1, 64, 152, 4], [2, 640, 202, -4]] as const) {
        this.mobs.drops.push({ id: `fx-gold:${i}`, x: p.x + dx, y: p.y + dy, coins, qty: 0, label: `${coins} Gold`, color: GOLD_RAMP[0], age: 1 });
      }
    }
    // For the screenshot spec: how many Gold piles lie on the ground.
    const piles = this.mobs.drops.reduce((n, g) => n + (g.coins > 0 ? 1 : 0), 0);
    if (piles !== this.goldSeen) { this.goldSeen = piles; this.canvas.setAttribute('data-gold-piles', String(piles)); }
    for (const q of this.pops) q.age += dt;
    this.pops = this.pops.filter(q => q.age < q.life);
    // The showcase lies down a second after each arrival, round wherever the Keeper stands.
    if (this.fxLoot && this.showcaseLevel !== this.level) {
      this.showcase = [];
      if ((this.showcaseT += dt) > 1) { this.showcase = this.makeShowcase(); this.showcaseLevel = this.level; this.showcaseT = 0; }
    }
    const p = this.player;
    if (this.seenLevel !== this.level) { this.seenLevel = this.level; this.seenDrops.clear(); for (const g of this.groundLoot()) { const r = rungOf(g); if (r) this.seenDrops.set(g.id, { x: g.x, y: g.y, rung: r }); } return; }
    const now = new Set<string>();
    for (const g of this.groundLoot()) {
      const r = rungOf(g);
      if (!r) continue;
      now.add(g.id);
      if (!this.seenDrops.has(g.id)) {
        this.pops.push({ x: g.x, y: g.y - 3, rung: r, age: 0, life: .4, kind: 'drop', seed: this.dropSeed(g) });
        // A rare drop: Glim gasps and hops to it, the host gives it its word (glim-react.ts).
        if (!this.showcase.includes(g) && (r === 'epic' || r === 'legendary' || r === 'mythic' || r === 'singular')) {
          this.options.onGlimCue?.({ kind: 'rare', rarity: r });
          if (this.glim.shown) { this.glimPoint(g.x, g.y - 18, 1.2, false); this.glimBurst(g.x, g.y - 18, 8); }
          if (this.pet) this.petFeel('alert');
        }
      }
      this.seenDrops.set(g.id, { x: g.x, y: g.y, rung: r });
    }
    for (const [id, g] of this.seenDrops) {
      if (now.has(id)) continue;
      this.seenDrops.delete(id);
      // Taken: it vanished at the Keeper's feet (a drop that lay out its time just goes).
      if (Math.hypot(g.x - p.x, g.y - p.y) < 30) this.pops.push({ x: g.x, y: g.y - 3, rung: g.rung, age: 0, life: .45, kind: 'pick', seed: id.length * 13 });
    }
    if (this.pops.length > 12) this.pops.splice(0, this.pops.length - 12);
    // For the screenshot spec: the canvas says when a pop is in the air.
    const popping = this.pops.length ? 'pop' : '';
    if (popping !== this.popSeen) { this.popSeen = popping; this.canvas.setAttribute('data-loot-pop', popping); }
  }
  private makeShowcase(): Drop[] {
    const p = this.player, rows: [LootRung, string, number, number, string][] = [
      ['common', 'Worn Cap', -84, 44, 'starter-axe'], ['uncommon', 'Ashwood Staff', -28, 44, 'nullthorn-staff'], ['rare', 'Ember Ring', 28, 44, 'anchor-ring'], ['epic', 'Hexed Mantle', 84, 44, 'keepers-mantle'],
      ['legendary', 'Pyrelord Crown', -60, 104, 'crown-of-the-first-dawn'], ['mythic', 'Eclipse Shard', 0, 104, 'eclipse-longblade'], ['singular', 'Void Rune', 60, 104, ''],
    ];
    return rows.map(([rung, label, dx, dy, def], i) => ({
      id: `fx-showcase:${i}`, x: p.x + dx, y: p.y + dy, coins: 0, qty: 0, rarity: rung, label, color: LOOT[rung].body, age: 0,
      ...(def ? { item: { definitionId: def, rarity: rung, unique: false } } : { rune: 'void' }),
    }));
  }

  /** The effects pass's own pixels: an aura's motes (≤ 10 alive), the shards a Dark Ward sheds as it drinks a blow. */
  private updateFx(dt: number): void {
    for (const m of this.motes) m.age += dt;
    this.motes = this.motes.filter(m => m.age < m.life);
    const p = this.player, ward = this.mobs.ward;
    if (ward < this.wardSeen - .5 && !this.still) {
      const shards = this.motes.filter(m => m.kind === 'shard').length;
      for (let i = 0; i < Math.min(SHARDS - shards, 3); i++) {
        const a = Math.random() * Math.PI * 2, x = p.x + Math.cos(a) * 13, y = p.y - 18 + Math.sin(a) * 18;
        this.motes.push({ x, y, sx: x, sy: y, age: 0, life: .6, kind: 'shard', seed: Math.random() });
      }
    }
    this.wardSeen = ward;
    const aura = this.mobs.aura;
    const kind = aura === 'aura-siphon' ? 'life' : aura === 'aura-embers' ? 'ember' : null;
    this.motes = this.motes.filter(m => m.kind === 'shard' || m.kind === kind);
    if (!kind || this.still) return;
    this.moteT -= dt;
    const alive = this.motes.filter(m => m.kind === kind).length;
    if (this.moteT > 0 || alive >= MOTES) return;
    if (kind === 'ember') {
      // Embers rise from the ground anywhere inside the ring.
      this.moteT = .11;
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (this.mobs.auraRadius - 4), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      this.motes.push({ x, y, sx: x, sy: y, age: 0, life: .9 + Math.random() * .4, kind, seed: Math.random() });
    } else {
      // Siphoning flows inward: from the foes in the ring to the Keeper's chest (from the ring's edge, slower, with none near).
      const foes = this.mobs.mobs.filter(m => Math.hypot(m.x - p.x, m.y - p.y) <= this.mobs.auraRadius);
      let sx: number, sy: number;
      if (foes.length) { const f = foes[Math.floor(Math.random() * foes.length)]; this.moteT = .12; sx = f.x; sy = f.y - f.def.h / 2; }
      else { if (alive >= 5) return; this.moteT = .32; const a = Math.random() * Math.PI * 2; sx = p.x + Math.cos(a) * this.mobs.auraRadius; sy = p.y + Math.sin(a) * this.mobs.auraRadius; }
      this.motes.push({ x: sx, y: sy, sx, sy, age: 0, life: .8 + Math.random() * .3, kind, seed: Math.random() });
    }
  }

  /** Ground effects (spec §Rules 3): the aura's floor tint and rings, its pulses, the nova's ring and scorch, the raise sigil. */
  private drawGroundFx(): void {
    const c = this.ctx, p = this.player, X = Math.round(p.x), Y = Math.round(p.y), aura = this.mobs.aura;
    // The aura the Keeper wears (td-aura.ts): its layered ring round the feet; its motes rise in the air pass.
    const look = this.auraLook();
    if (look && optCamera()) {
      // The prototype (the paused look branch, ~/er/wt-look): nothing constant on the ground — a light ring runs out to the aura's reach
      // when it starts, on a tick that reaches a foe, and as a slow heartbeat. With HD effects it is drawn at the HD pixel.
      const reach = this.artAura ? 3 * TILE : this.mobs.auraRadius, low = envDetail() === 'low', hd = optHdFigures();
      const hit = this.mobs.effects.some(e => e.kind === 'pulse' && e.age < .05 && (e.el === 'ember' || e.el === 'life'));
      if (!this.auraWas) { this.lookAura.pulse(1.3); this.auraBeat = 0; }
      else if (hit && this.time - this.auraBeat > .9) { this.lookAura.pulse(.85); this.auraBeat = this.time; }
      else if (this.time - this.auraBeat > 3.2) { this.lookAura.pulse(.7); this.auraBeat = this.time; }
      this.lookAura.step(this.time, look, this.still, low, up(31) * (hd ? 2 : 1));
      if (hd) { c.save(); c.scale(.5, .5); this.lookAura.waves(c, X * 2, (Y - 1) * 2, look, reach * 2); c.restore(); }
      else this.lookAura.waves(c, X, Y - 1, look, reach);
    } else if (look) { this.auraFx.step(this.time, look, this.still || envDetail() === 'low'); this.auraFx.ground(c, X, Y - 1, look, this.time, this.still); }
    this.auraWas = !!look;
    if (aura === 'aura-embers' || aura === 'aura-siphon' || aura === 'aura-watchfire' || aura === 'lantern-aura' || aura === 'pack-bond') {
      const tn = aura === 'aura-embers' ? FX.ember : aura === 'aura-watchfire' ? ASH_FX.brass : aura === 'lantern-aura' ? LAMP_FX.lamp : aura === 'pack-bond' ? THORN_FX.wild : FX.life, turn = this.still ? 0 : this.time / 12;
      c.drawImage(discSprite(this.mobs.auraRadius, tn.edge, [.05, .045, .04]), X - this.mobs.auraRadius, Y - this.mobs.auraRadius);
      drawRing(c, X, Y, this.mobs.auraRadius, turn, tn.core, tn.body, 8, 6, tn.edge);
      c.globalAlpha = .6; drawRing(c, X, Y, Math.round(this.mobs.auraRadius * .6), -turn * 1.4, tn.body, tn.edge, 8, 4);
      c.globalAlpha = 1;
    }
    this.drawLootRings();
    this.drawTells();
    // Elite packs: the aura ring under each member, a Cold Aura's reach, a Fire Enchanted's burst on its way.
    const cam = this.cam, near = (x: number, y: number) => x > cam.x - 60 && x < cam.x + cam.w + 60 && y > cam.y - 40 && y < cam.y + cam.h + 80;
    for (const m of this.mobs.mobs) if (m.elite && near(m.x, m.y)) drawEliteGround(c, m, this.time, this.still);
    // S6: the hostile ground, the pack auras' sigil discs, the ability tells (td-ability-fx.ts).
    for (const h of this.mobs.hazards) if (near(h.x, h.y)) drawHazard(c, h, this.time, this.still);
    drawPackGround(c, this.mobs.mobs, this.time, this.still, near, envDetail() === 'low');
    for (const m of this.mobs.mobs) if (m.tell > 0 && m.abCast !== undefined && near(m.x, m.y)) drawCastTell(c, m, this.time, this.still);
    for (const b of this.mobs.bursts) if (near(b.x, b.y)) { if (b.tone) drawAbilityRing(c, b, this.time, this.still); else drawBurstTell(c, b, FIRE_BURST.delay, this.time, this.still); }
    // The Lanternwright's circles on the floor: the Hearth Circle, the disc of Dawn at Noon.
    if (this.mobs.zones.length) drawLampZones(c, this.mobs.zones, this.time, this.still);
    // The Thornstrider's on the floor: the snare's thorns, a hidden trap.
    if (this.mobs.zones.length) drawThornZones(c, this.mobs.zones, this.time, this.still);
    for (const e of this.mobs.effects) {
      if (e.age < 0) continue;
      if (drawAshGround(c, e, this.still)) continue;
      if (drawLampGround(c, e, this.still)) continue;
      if (drawThornGround(c, e, this.still)) continue;
      const t = e.age / e.life, ex = Math.round(e.x), ey = Math.round(e.y);
      if (e.kind === 'pulse') {
        // A short bright arc of the ring flashes at the foe's side.
        const tn = e.el === 'life' ? FX.life : FX.ember, a = Math.atan2(e.y - p.y, e.x - p.x);
        c.globalAlpha = Math.max(0, 1 - t * .8);
        c.fillStyle = tn.body; for (const q of ringArc(this.mobs.auraRadius + 1, a, .2)) c.fillRect(X + q.x, Y + q.y, 1, 1);
        c.fillStyle = tn.core; for (const q of ringArc(this.mobs.auraRadius, a, .3)) c.fillRect(X + q.x, Y + q.y, 1, 1);
        c.fillStyle = tn.body; for (const q of ringArc(this.mobs.auraRadius - 1, a, .22)) c.fillRect(X + q.x, Y + q.y, 1, 1);
      } else if (e.kind === 'wave') {
        // Hellfire Nova: a two-tone pixel ring runs out to its 3 tiles in half a second; the ground it crossed stays scorched.
        // The trees' bursts (a Meteor, a Corpse Burst, Weaken, Doom) ride the same ring in their own element; only fire scorches.
        const R = e.r ?? NOVA_R, tn = FX[e.el && e.el !== 'life' && e.el !== 'brass' && e.el !== 'lamp' ? e.el : 'ember'];
        if (t > .2 && !e.el) {
          const f = Math.min(1, (t - .2) / .2) * (t > .5 ? 1 - (t - .5) / .5 : 1);
          c.globalAlpha = .75 * f; c.drawImage(scorchSprite(R), ex - R, ey - R);
        }
        if (t < .5) {
          const k = this.still ? 1 : t / .5, r = Math.round(6 + (R - 6) * (1 - (1 - k) * (1 - k)));
          c.globalAlpha = 1 - k * .3;
          // A two-pixel front (core over body) with a dithered edge tone trailing just inside.
          drawRing(c, ex, ey, r, 0, tn.core, tn.body, 4, 4, tn.body);
          drawRing(c, ex, ey, Math.max(1, r - 3), .5, tn.edge, tn.body, 6, 4);
        }
      } else if (e.kind === 'raise' && t < .55) {
        // Raise Skeleton: a violet sigil on the ground for its first 0.4 s, a ring and a five-point star.
        c.globalAlpha = t < .08 ? t / .08 : t > .4 ? Math.max(0, 1 - (t - .4) / .15) : 1;
        c.fillStyle = FX.shadow.edge; for (const q of circlePixels(9)) c.fillRect(ex + q.x, ey + q.y, 1, 1);
        c.fillStyle = FX.shadow.body; for (const q of circlePixels(8)) if ((q.x + q.y) % 2 === 0) c.fillRect(ex + q.x, ey + q.y, 1, 1);
        const pts = polyPoints(5, 7, 7, -Math.PI / 2 + (this.still ? 0 : t * 2));
        for (let i = 0; i < 5; i++) {
          const a = pts[i], b = pts[(i + 2) % 5];
          linePixels(a.x, a.y, b.x, b.y).forEach((q, j) => { c.fillStyle = j % 2 ? FX.shadow.edge : FX.shadow.body; c.fillRect(ex + q.x, ey + q.y, 1, 1); });
        }
        c.fillStyle = FX.shadow.core; for (const q of pts) c.fillRect(ex + q.x, ey + q.y, 1, 1);
      }
    }
    c.globalAlpha = 1;
  }

  /** The ground ring under each piece of gear above common: two tones, dithered, breathing with its column. */
  private drawLootRings(): void {
    const c = this.ctx, cam = this.cam;
    for (const g of this.groundLoot()) {
      const r = rungOf(g), beam = r ? lootBeam(r) : null;
      if (!r || !beam?.ring || g.x < cam.x - 20 || g.x > cam.x + cam.w + 20 || g.y < cam.y - 20 || g.y > cam.y + cam.h + 60) continue;
      const tn = LOOT[r], X = Math.round(g.x), Y = Math.round(g.y) - 2, seed = this.dropSeed(g);
      const rr = beam.ring + (this.still ? 0 : Math.round(Math.sin(this.time * 2.6 + seed % 7)));
      c.globalAlpha = .3; c.fillStyle = tn.edge;
      for (const q of groundRing(rr + 1)) c.fillRect(X + q.x, Y + q.y, 1, 1);
      c.globalAlpha = .75;
      groundRing(rr).forEach((q, i) => { if (i % 2) return; c.fillStyle = i % 4 ? tn.body : tn.core; c.fillRect(X + q.x, Y + q.y, 1, 1); });
    }
    c.globalAlpha = 1;
  }

  /**
   * Bosses' tells (spec §Order 4): while a boss winds up (BOSS_TELL), the ground where its breath will go shows as a
   * pixel cone in the ember edge tone, outlined dark (a foe's effect), pulsing, with a bright front running out to
   * its far edge as the tell runs down — when the front reaches the edge, the breath leaves. A summons' sigil shows
   * where each called creature will stand (CALL_TELL). Ground layer: under every creature.
   */
  private drawTells(): void {
    const c = this.ctx;
    // For the screenshot spec (e2e/td-fx2-shots.spec.ts): the canvas says when a tell is on the ground.
    const telling = this.mobs.mobs.some(m => m.tell > 0 && m.charging) ? 'charge' : this.mobs.mobs.some(m => m.tell > 0) ? 'breath' : this.mobs.bursts.some(b => b.el === 'shadow') ? 'rend' : this.mobs.calls.length ? 'call' : '';
    if (telling !== this.tellSeen) { this.tellSeen = telling; this.canvas.setAttribute('data-boss-tell', telling); }
    for (const m of this.mobs.mobs) {
      // A gap-closer winding up (MobDef.charge): a lane on the floor from its feet to where the prey stood, filling as
      // the tell runs down, and the ring it will come down in — step out of the lane's end and it lands on nothing.
      if (m.tell > 0 && m.charging && m.aim) {
        const k = this.still ? .7 : 1 - m.tell / BOSS_TELL, tn = FX.ember, beat = this.still ? 1 : Math.floor(this.time * 8) % 2 ? 1 : .7;
        const ox = Math.round(m.x), oy = Math.round(m.y), ax = Math.round(m.aim.x), ay = Math.round(m.aim.y + 12);
        const lane = linePixels(ox, oy, ax, ay), front = Math.max(1, Math.round(k * lane.length));
        lane.forEach((q, i) => {
          for (const o of [-1, 0, 1]) {
            if (o && i % 2) continue;
            c.globalAlpha = (i < front ? .6 : .3) * beat; c.fillStyle = i < front ? tn.body : tn.edge;
            c.fillRect(q.x + (Math.abs(ay - oy) > Math.abs(ax - ox) ? o : 0), q.y + (Math.abs(ay - oy) > Math.abs(ax - ox) ? 0 : o), 1, 1);
          }
        });
        c.globalAlpha = .9 * beat;
        c.fillStyle = HOSTILE_EDGE; for (const q of groundRing(CHARGE_HIT)) c.fillRect(ax + q.x, ay + q.y + 1, 1, 1);
        groundRing(CHARGE_HIT).forEach((q, i) => { c.fillStyle = i % 3 ? tn.edge : tn.body; c.fillRect(ax + q.x, ay + q.y, 1, 1); });
        continue;
      }
      const shoot = m.def.ranged;
      if (!(m.tell > 0) || !m.aim || !shoot || !windsUp(m.def)) continue;
      const k = 1 - m.tell / BOSS_TELL, ox = Math.round(m.x + m.face * m.def.w * .3), oy = Math.round(m.y - 2);
      // The cone lies on the floor: from the boss's feet toward where the prey stood (its feet, 12 px under the aim).
      const ax = m.aim.x, ay = m.aim.y + 12, a = Math.atan2(ay - oy, ax - ox);
      const len = Math.min(shoot.range, Math.hypot(ax - ox, ay - oy) + 28), half = ((shoot.spread ?? 1) - 1) / 2 * .22 + .14;
      // In the breath's own element: ink for the Abbess, rootglass green for the Rootwyrm's splinters, fire otherwise.
      const cone = conePixels(len, half, a), tn = shoot.kind === 'ink' ? FX.shadow : shoot.kind === 'shard' ? FX.life : FX.ember;
      const beat = this.still ? 1 : Math.floor(this.time * 8) % 2 ? 1 : .7;
      // The front: how far the wind-up has filled the cone; behind it the dither burns brighter (body), ahead of it dim.
      const fr = Math.max(4, Math.round((this.still ? .7 : k) * len));
      for (const q of cone.fill) {
        const near = q.x * q.x + q.y * q.y < fr * fr;
        c.globalAlpha = (near ? .6 : .35) * beat; c.fillStyle = near ? tn.body : tn.edge;
        c.fillRect(ox + q.x, oy + q.y, 1, 1);
      }
      c.globalAlpha = .9 * beat;
      for (const q of cone.edge) { c.fillStyle = HOSTILE_EDGE; c.fillRect(ox + q.x, oy + q.y + 1, 1, 1); }
      cone.edge.forEach((q, i) => { c.fillStyle = i % 3 ? tn.edge : tn.body; c.fillRect(ox + q.x, oy + q.y, 1, 1); });
      c.globalAlpha = .85;
      c.fillStyle = tn.body; for (const q of ringArc(fr, a, half)) c.fillRect(ox + q.x, oy + q.y, 1, 1);
      c.fillStyle = tn.core; for (const q of ringArc(fr - 1, a, half * .7)) c.fillRect(ox + q.x, oy + q.y, 1, 1);
    }
    for (const k of this.mobs.calls) {
      const t = 1 - k.t / CALL_TELL, X = Math.round(k.x), Y = Math.round(k.y), tn = FX.ember;
      c.globalAlpha = this.still ? 1 : Math.min(1, t * 5) * (Math.floor(this.time * 8) % 2 ? 1 : .75);
      c.fillStyle = HOSTILE_EDGE; for (const q of groundRing(11)) c.fillRect(X + q.x, Y + q.y + 1, 1, 1);
      c.fillStyle = tn.edge; for (const q of groundRing(11)) c.fillRect(X + q.x, Y + q.y, 1, 1);
      groundRing(8).forEach((q, i) => { if (i % 2) return; c.fillStyle = tn.body; c.fillRect(X + q.x, Y + q.y, 1, 1); });
      // A turning three-point mark inside, closing in as the creature comes.
      const pts = polyPoints(3, 7 - t * 3, 3.5 - t * 1.5, this.still ? 0 : this.time * 3);
      for (let i = 0; i < 3; i++) linePixels(pts[i].x, pts[i].y, pts[(i + 1) % 3].x, pts[(i + 1) % 3].y).forEach((q, j) => { c.fillStyle = j % 2 ? tn.edge : tn.core; c.fillRect(X + q.x, Y + q.y, 1, 1); });
    }
    c.globalAlpha = 1;
  }

  /** The Dark Ward's hex: six violet points round the Keeper, turning; `keep` (0..1) is how much of it still holds. */
  private drawHex(cx: number, cy: number, scale: number, keep: number, turn: number): void {
    const c = this.ctx, X = Math.round(cx), Y = Math.round(cy), pts = polyPoints(6, 13 * scale, 18 * scale, turn);
    for (let i = 0; i < 6; i++) {
      const a = pts[i], b = pts[(i + 1) % 6];
      linePixels(a.x, a.y, b.x, b.y).forEach((q, j) => {
        if (fxNoise(i, j, 3) > keep) return;
        // Dithered by tone, not by gaps: body and edge pixels alternate along each side.
        c.fillStyle = (j + i) % 2 ? FX.shadow.edge : FX.shadow.body; c.fillRect(X + q.x, Y + q.y, 1, 1);
      });
    }
    for (const q of pts) { c.fillStyle = FX.shadow.body; c.fillRect(X + q.x - 1, Y + q.y, 3, 1); c.fillRect(X + q.x, Y + q.y - 1, 1, 3); c.fillStyle = FX.shadow.core; c.fillRect(X + q.x, Y + q.y, 1, 1); }
  }

  /** Air effects (over creatures): hits, bursts, bolts, motes, the ward. Pixel pictures that live a moment. */
  private drawEffects(): void {
    const c = this.ctx, p = this.player;
    for (const e of this.mobs.effects) {
      if (e.age < 0 || e.kind === 'pulse' || e.kind === 'wave') continue;
      if (drawAshAir(c, e, this.still, this.overFoe)) continue;
      if (drawLampAir(c, e, this.still, this.overFoe)) continue;
      if (drawThornAir(c, e, this.still, this.overFoe)) continue;
      // Reduced motion: a burst is one still frame, never no burst.
      const t = e.age / e.life, X = Math.round(e.x), Y = Math.round(e.y), bt = this.still ? .5 : t, seed = (X * 7 + Y * 13) | 0;
      c.globalAlpha = Math.max(0, 1 - t);
      if (e.kind === 'slash') {
        // Three bright strokes sweeping down across the foe.
        c.fillStyle = '#ffffff';
        for (let i = 0; i < 6; i++) { const k = Math.min(i, Math.floor(t * 9)); c.fillRect(X + e.dir * (-6 + k * 2), Y - 6 + k * 2, 2, 2); }
        c.fillStyle = '#ffe9a8'; for (let i = 0; i < 5; i++) c.fillRect(X + e.dir * (-4 + i * 2), Y - 8 + i * 2, 1, 1);
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
        // The red thread of life pulled from the foe; green beads run it to the Keeper and burst on arrival.
        const tx = e.tx ?? X, ty = e.ty ?? Y, wav = (k: number) => Math.sin(k * 6 + (this.still ? 0 : t * 12)) * 3;
        c.globalAlpha = Math.max(0, 1 - t) * .9;
        for (let i = 0; i <= 10; i++) {
          const k = i / 10;
          c.fillStyle = i % 2 ? '#e2452a' : '#9e2e1c'; c.fillRect(Math.round(X + (tx - X) * k), Math.round(Y + (ty - Y) * k + wav(k)), 2, 2);
        }
        c.globalAlpha = 1;
        for (let j = 0; j < 3 && t < .7; j++) {
          const k = this.still ? (j + 1) / 4 : Math.min(1, t * 1.6 + j * .12), bx = Math.round(X + (tx - X) * k), by = Math.round(Y + (ty - Y) * k + wav(k));
          c.fillStyle = FX.life.body; c.fillRect(bx - 1, by - 1, 3, 3); c.fillStyle = FX.life.core; c.fillRect(bx, by, 1, 1);
        }
        if (t > .55 || this.still) { c.globalAlpha = this.still ? 1 : 1 - (t - .55) / .45; drawBurst(c, tx, ty, burst(7, this.still ? .5 : (t - .55) / .45, seed, 9, 4), FX.life); }
      } else if (e.kind === 'curse') {
        c.fillStyle = '#b06bff';
        c.fillRect(X - 4, Y - 4, 8, 1); c.fillRect(X - 4, Y + 3, 8, 1); c.fillRect(X - 4, Y - 4, 1, 8); c.fillRect(X + 3, Y - 4, 1, 8);
        c.fillStyle = '#ff6a2a'; c.fillRect(X - 1, Y - 1, 2, 2);
      } else if (e.kind === 'ward') {
        // The ward going up: the hex springs out from the Keeper, a bright frame.
        const k = this.still ? 1 : 1 - (1 - t) * (1 - t);
        this.drawHex(p.x, p.y - up(18), .55 + .45 * k, 1, this.still ? 0 : this.time * .8);
      } else if (e.kind === 'raise') {
        // Bones knitting up out of the sigil (from 0.25 s), violet motes climbing with them.
        if (t > .25) {
          const k = this.still ? .6 : (t - .25) / .75;
          for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? FX.bone.body : FX.bone.edge; c.fillRect(Math.round(X - 6 + i * 2.4), Math.round(Y - 1 - k * (6 + (i % 3) * 5)), 2, 1); }
        }
        c.fillStyle = FX.shadow.body;
        for (let i = 0; i < 7; i++) c.fillRect(Math.round(X - 8 + i * 2.6), Math.round(Y - 2 - bt * (10 + (i % 3) * 8)), 1, 1);
      } else if (e.kind === 'pillar') {
        // The level-up: a stepped column of warm light stands on the Keeper (it follows him), motes climb it, sparks
        // ring his feet. Thin and see-through over the body (spec rule 4); reduced motion draws the full column still.
        const big = e.dir > 1, X0 = Math.round(p.x), Y0 = Math.round(p.y), n = big ? 10 : 6;
        const fade = this.still || t < .6 ? 1 : 1 - (t - .6) / .4, h = Math.round((big ? 96 : 72) * (this.still ? 1 : Math.min(1, t / .25)));
        c.globalAlpha = .3 * fade; c.fillStyle = LEVEL_UP.edge; c.fillRect(X0 - (big ? 7 : 5), Y0 - h, big ? 14 : 10, h);
        c.globalAlpha = .5 * fade; c.fillStyle = LEVEL_UP.body; c.fillRect(X0 - 3, Y0 - h, 6, h);
        c.globalAlpha = .6 * fade; c.fillStyle = LEVEL_UP.core; c.fillRect(X0 - 1, Y0 - h, 2, h);
        c.globalAlpha = fade;
        for (let i = 0; i < n; i++) {
          const k = this.still ? (i + 1) / (n + 1) : (t * 1.4 + i / n) % 1;
          c.fillStyle = i % 2 ? LEVEL_UP.core : LEVEL_UP.body;
          c.fillRect(X0 + (i % 2 ? -1 : 1) * (3 + (i * 5) % 6), Math.round(Y0 - 4 - k * h), 1, 2);
        }
        if (t < .4 || this.still) { c.globalAlpha = 1; drawBurst(c, X0, Y0 - 2, burst(big ? 10 : 8, bt, seed, 12, 4), LEVEL_UP); }
      } else if (e.kind === 'spark') {
        // A foe's shot breaking: its own fire, edged dark.
        drawBurst(c, X, Y, burst(6, bt, seed, 7, 5), FX.ember, true);
      } else if (e.kind === 'puff') {
        // A shot breaking on a wall (td-sight): a few sparks of its own colour and grey grit falling off the stone.
        const tone = e.el === 'bone' || e.el === 'brass' ? FX.bone : e.el === 'life' ? FX.life : e.el === 'shadow' ? FX.shadow : e.el === 'lamp' ? LEVEL_UP : FX.ember;
        drawBurst(c, X, Y, burst(5, bt, seed, 6, 3), tone);
        c.fillStyle = FX.bone.edge;
        for (let i = 0; i < 4; i++) c.fillRect(X - 4 + i * 3, Math.round(Y + 1 + bt * (4 + (i % 2) * 5)), 1, 1);
      } else if (e.kind === 'bolt-hit') {
        // The Ember Bolt landing: a quick core flash, then 8 embers flying out and falling.
        if (t < .3 || this.still) glowSquare(c, X, Y, 3, FX.ember, .6);
        drawBurst(c, X, Y, burst(8, bt, seed, 10, 7), FX.ember);
      } else if (e.kind === 'bone-chips') {
        drawBurst(c, X, Y, burst(6, bt, seed, 8, 10), FX.bone);
      } else if (e.kind === 'flash') {
        glowSquare(c, X, Y, 4, FX.bone);
      } else if (e.kind === 'cinder') {
        // Cinder Rain: an ember dropping out of the dark, its short tail above it (it bursts as a bolt-hit when it lands).
        const fy = Math.round(Y - 34 * (1 - bt));
        c.globalAlpha = 1;
        c.fillStyle = FX.ember.edge; c.fillRect(X + 1, fy - 6, 1, 3);
        c.fillStyle = FX.ember.body; c.fillRect(X, fy - 3, 2, 3);
        c.fillStyle = FX.ember.core; c.fillRect(X, fy, 2, 2);
      } else if (e.kind === 'flame') {
        // Flame Wall: one tongue of fire licking up and thinning out (core low, edge at the tip).
        const h = 4 + Math.round(6 * Math.sin(Math.min(1, bt) * Math.PI)), fl = fxNoise(seed, Math.floor(bt * 8)) > .5 ? 1 : 0;
        c.globalAlpha = Math.max(0, 1 - t * .7);
        c.fillStyle = FX.ember.edge; c.fillRect(X - 2 + fl, Y - h - 2, 2, 2);
        c.fillStyle = FX.ember.body; c.fillRect(X - 2, Y - h, 4, h - 1);
        c.fillStyle = FX.ember.core; c.fillRect(X - 1, Y - Math.ceil(h / 2), 2, Math.ceil(h / 2) - 1);
      } else if (e.kind === 'meteor') {
        // Meteor: a stone falling from the upper left (the light's side) with a stepped fire tail; a ring marks where it lands.
        c.globalAlpha = .7;
        c.fillStyle = FX.ember.edge; for (const q of circlePixels(10)) if ((q.x + q.y) % 2 === 0) c.fillRect(X + q.x, Y + Math.round(q.y / 2), 1, 1);
        const k = this.still ? .6 : t, mx = Math.round(X - 60 * (1 - k)), my = Math.round(Y - 8 - 90 * (1 - k));
        c.globalAlpha = 1;
        for (let i = 1; i <= 5; i++) { c.fillStyle = i < 3 ? FX.ember.core : i < 5 ? FX.ember.body : FX.ember.edge; c.fillRect(mx - i * 4, my - i * 6, 4 - Math.floor(i / 2), 4 - Math.floor(i / 2)); }
        c.fillStyle = '#5a3a2a'; c.fillRect(mx - 3, my - 3, 7, 7);
        c.fillStyle = '#8a5a3a'; c.fillRect(mx - 2, my - 2, 4, 4);
        c.fillStyle = FX.ember.core; c.fillRect(mx - 1, my - 1, 2, 2);
      } else if (e.kind === 'crit') {
        // A crit's white-hot core (over a creature: never above 60%).
        c.globalAlpha = .6 * Math.max(0, 1 - t);
        glowSquare(c, X, Y, 4, { core: '#ffffff', body: FX.ember.core, edge: FX.ember.body });
        c.fillStyle = '#ffffff'; c.fillRect(X - 6, Y, 13, 1); c.fillRect(X, Y - 6, 1, 13);
      } else {
        c.fillStyle = '#e9dcc0'; c.fillRect(X - 2, Math.round(Y - 2 - t * 4), Math.round(4 - t * 2), 2);
      }
    }
    c.globalAlpha = 1;
    this.drawMotes();
    if (this.mobs.melee) drawAshState(c, { brandT: this.mobs.brandT, blockT: this.mobs.blockT, vowT: this.mobs.vowT, mobs: this.mobs.mobs }, this.player, this.time, this.still);
    if (this.mobs.lamp) drawLampState(c, { ward: this.mobs.lampWard, lastLight: this.mobs.lastLightT, wisps: this.mobs.wisps, mobs: this.mobs.mobs }, this.player, this.time, this.still);
    if (this.mobs.thorn || this.mobs.mobs.some(m => (m.rootT ?? 0) > 0 || (m.bleedT ?? 0) > 0)) {
      const pb = this.pet;
      drawThornState(c, { mobs: this.mobs.mobs, commanded: this.mobs.commanded, bond: this.mobs.bonded && pb ? { x: pb.x, y: pb.y } : null, keeper: this.player }, this.time, this.still);
    }
    // The Thornstrider's arrows in flight.
    for (const a of this.mobs.arrows) drawArrow(c, a.x, a.y, a.vx, a.vy);
    // A boss winding up: a stepped glow gathering at its jaws (over its own body: never above 60%).
    for (const m of this.mobs.mobs) if (m.tell > 0 && windsUp(m.def)) {
      const k = this.still ? .7 : 1 - m.tell / BOSS_TELL;
      glowSquare(c, m.x + m.face * m.def.w * .3, m.y - m.def.h * .55, 2 + Math.round(k * 5), m.def.ranged?.kind === 'ink' ? FX.shadow : FX.ember, .35 + .25 * k);
    }
    // Loot pops: out and falling as gear lands; up and in as the Keeper takes it.
    for (const q of this.pops) {
      const t = q.age / q.life, bt = this.still ? .5 : t;
      c.globalAlpha = Math.max(0, 1 - t * .8);
      const tn = LOOT[q.rung], X = Math.round(q.x), Y = Math.round(q.y);
      if (q.kind === 'drop') {
        // Landing: a flash, a flat ring running out along the ground, and a dozen pixels thrown up and falling.
        if (t < .3 || this.still) glowSquare(c, X, Y - 2, 4, tn, .6);
        const rr = 2 + Math.round((this.still ? .5 : 1 - (1 - t) * (1 - t)) * 12);
        groundRing(rr).forEach((g, i) => { if (i % 2) return; c.fillStyle = i % 4 ? tn.body : tn.core; c.fillRect(X + g.x, Y + 3 + g.y, 1, 1); });
        drawBurst(c, X, Y - 2, burst(12, bt, q.seed, 14, 7), tn);
      } else {
        // Taken: the pixels gather up and in toward the satchel, a last flash where it lay.
        if (t < .25 || this.still) glowSquare(c, X, Y, 3, tn, .6);
        drawBurst(c, X, Y - Math.round(bt * 14), burst(9, 1 - bt * .7, q.seed, 9, 0), tn);
      }
    }
    c.globalAlpha = 1;
    // Ember Bolts in flight: a stepped violet halo, an ember core, a three-pixel trail fading in steps.
    for (const b of this.mobs.bolts) {
      const X = Math.round(b.x), Y = Math.round(b.y), dx = b.to.x - b.x, dy = b.to.y - b.to.def.h / 2 - b.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      // The Lanternwright's flares (Kindle, a wisp's or a beacon's mote): cream with a brass tail.
      if (b.lamp) { drawKindle(c, X, Y, ux, uy); continue; }
      const trail: [string, number][] = [[FX.ember.body, .8], [FX.ember.edge, .5], [FX.shadow.body, .25]];
      trail.forEach(([col, a], i) => { c.globalAlpha = a; c.fillStyle = col; c.fillRect(Math.round(X - ux * (i + 1) * 3) - 1, Math.round(Y - uy * (i + 1) * 3) - 1, 2, 2); });
      c.globalAlpha = 1;
      glowSquare(c, X, Y, 4, FX.shadow, .7);
      c.fillStyle = FX.ember.edge; c.fillRect(X - 2, Y - 2, 4, 4); c.fillStyle = FX.ember.body; c.fillRect(X - 1, Y - 2, 3, 3); c.fillStyle = FX.ember.core; c.fillRect(X, Y - 1, 1, 1);
    }
    // Creatures' shots: a bone arrow, a fire bolt, a gout of breath, a rootglass splinter, a puff of spores.
    for (const s of this.mobs.shots) {
      const X = Math.round(s.x), Y = Math.round(s.y), sp = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / sp, uy = s.vy / sp;
      if (s.kind === 'shard') {
        c.fillStyle = '#17604e'; for (let i = 0; i < 7; i++) c.fillRect(Math.round(X - ux * i), Math.round(Y - uy * i) + 1, 1, 1);
        c.fillStyle = '#7affd0'; for (let i = 0; i < 6; i++) c.fillRect(Math.round(X - ux * i), Math.round(Y - uy * i), 2, 1);
        c.fillStyle = '#eafff6'; c.fillRect(X, Y, 2, 2);
      } else if (s.kind === 'spore') {
        const puff = Math.floor(s.age * 10) % 2;
        c.globalAlpha = .5; c.fillStyle = '#8ab84a'; c.fillRect(Math.round(X - ux * 4) - 2, Math.round(Y - uy * 4) - 2, 4, 4);
        c.globalAlpha = 1; c.fillStyle = '#d4f08a'; c.fillRect(X - 2, Y - 1 - puff, 2, 2); c.fillRect(X + 1, Y + puff, 2, 2); c.fillStyle = '#f6ffe0'; c.fillRect(X, Y, 1, 1);
      } else if (s.kind === 'arrow') {
        c.fillStyle = '#e8e1cf'; for (let i = 0; i < 6; i++) c.fillRect(Math.round(X - ux * i), Math.round(Y - uy * i), 1, 1);
        c.fillStyle = '#c9c2cc'; c.fillRect(X, Y, 2, 2); c.fillStyle = '#ff8a2e'; c.fillRect(Math.round(X - ux * 6), Math.round(Y - uy * 6), 2, 1);
      } else if (s.kind === 'ink') {
        // Ink (the Gloam Witches, the Ink Abbess): a violet gob with a dark trailing smear, a pale core.
        const r = 3;
        c.globalAlpha = .5; c.fillStyle = '#2c2258'; c.fillRect(Math.round(X - ux * 5) - r, Math.round(Y - uy * 5) - r, r * 2, r * 2);
        c.globalAlpha = 1; c.fillStyle = HOSTILE_EDGE; c.fillRect(X - r - 1, Y - r, r * 2 + 2, r * 2);
        c.fillStyle = '#6e54c8'; c.fillRect(X - r, Y - r, r * 2, r * 2); c.fillStyle = '#b49cff'; c.fillRect(X - 1, Y - 2, 2, 2); c.fillStyle = '#f0e8ff'; c.fillRect(X - 1, Y - 2, 1, 1);
      } else {
        const r = s.kind === 'breath' ? 4 : 3;
        c.globalAlpha = .45; c.fillStyle = '#9e2e1c'; c.fillRect(Math.round(X - ux * 5) - r, Math.round(Y - uy * 5) - r, r * 2, r * 2);
        c.globalAlpha = 1; c.fillStyle = '#ff6a2a'; c.fillRect(X - r, Y - r, r * 2, r * 2); c.fillStyle = '#ffd25a'; c.fillRect(X - 1, Y - 1, 2, 2);
      }
    }
    // Bone Spears: a white shaft with a violet tail.
    for (const s of this.mobs.spears) {
      const X = Math.round(s.x), Y = Math.round(s.y), sp = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / sp, uy = s.vy / sp;
      c.fillStyle = '#b06bff'; for (let i = 8; i < 13; i++) c.fillRect(Math.round(X - ux * i), Math.round(Y - uy * i), 1, 1);
      c.fillStyle = '#e8e1cf'; for (let i = 0; i < 9; i++) c.fillRect(Math.round(X - ux * i), Math.round(Y - uy * i), 2, 2);
      c.fillStyle = '#ffffff'; c.fillRect(X, Y, 2, 2);
    }
    // The Dark Ward while it holds: the hex turns, and it is missing the pixels the blows it drank have cracked off.
    if (this.mobs.ward > 0) {
      c.globalAlpha = .8;
      this.drawHex(p.x, p.y - up(18), 1, Math.max(.15, Math.min(1, this.mobs.ward / this.mobs.v('dark-ward')['absorb'])), this.still ? 0 : this.time * .8);
      c.globalAlpha = 1;
    }
    // Bone Armor while it holds: four bone shards circling the Keeper's chest.
    if (this.mobs.bone > 0) {
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2 + (this.still ? 0 : this.time * 2.2), bx = Math.round(p.x + Math.cos(a) * 11), by = Math.round(p.y - 16 + Math.sin(a) * 5);
        c.fillStyle = FX.bone.edge; c.fillRect(bx - 1, by, 4, 2);
        c.fillStyle = FX.bone.body; c.fillRect(bx, by, 2, 1);
      }
    }
    // Doom: a pale skull-mark ticking over the doomed.
    for (const m of this.mobs.mobs) if ((m.doom ?? 0) > 0) {
      const X = Math.round(m.x), Y = Math.round(m.y - this.vis(m.def).h - 10);
      c.fillStyle = Math.floor(this.time * 4) % 2 ? FX.shadow.body : FX.shadow.edge; c.fillRect(X - 3, Y - 3, 6, 5);
      c.fillStyle = FX.shadow.core; c.fillRect(X - 2, Y - 2, 1, 1); c.fillRect(X + 1, Y - 2, 1, 1);
    }
    for (const m of this.mobs.mobs) if (m.cursed > 0) {
      c.fillStyle = Math.floor(this.time * 6) % 2 ? '#b06bff' : '#ff6a2a';
      c.fillRect(Math.round(m.x - 1 + Math.sin(this.time * 3) * 5), Math.round(m.y - this.vis(m.def).h - 8 - (this.time * 8) % 6), 2, 2);
    }
  }

  /** An aura's motes and the ward's falling shards; with reduced motion, the aura's motes stand still where they are seeded. */
  private drawMotes(): void {
    const c = this.ctx, p = this.player, aura = this.mobs.aura;
    // Over a creature an effect stays under 60% (spec §Budget).
    const overFoe = (x: number, y: number) => this.mobs.mobs.some(m => Math.abs(x - m.x) < m.def.w / 2 && y < m.y && y > m.y - m.def.h);
    const dot = (x: number, y: number, col: string, a: number, size = 1) => { const X = Math.round(x), Y = Math.round(y); c.globalAlpha = overFoe(X, Y) ? Math.min(a, .6) : a; c.fillStyle = col; c.fillRect(X, Y, size, size); };
    if (this.still && (aura === 'aura-embers' || aura === 'aura-siphon')) {
      const tn: Tones = aura === 'aura-embers' ? FX.ember : FX.life;
      for (let i = 0; i < 8; i++) {
        const a = fxNoise(i, 1) * Math.PI * 2, d = (aura === 'aura-embers' ? Math.sqrt(fxNoise(i, 2)) : .55 + fxNoise(i, 2) * .3) * (this.mobs.auraRadius - 4);
        dot(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d - (aura === 'aura-embers' ? 6 : 10), i % 2 ? tn.core : tn.body, .9);
      }
    }
    for (const m of this.motes) {
      const k = m.age / m.life;
      if (m.kind === 'ember') {
        // Rising ~18 px, flickering through the three tones, a pixel off now and then.
        if (fxNoise(Math.floor(m.age * 14), Math.floor(m.seed * 1e4)) < .15) continue;
        const tone = [FX.ember.core, FX.ember.body, FX.ember.edge][Math.min(2, Math.floor(k * 3))];
        const x = m.sx + Math.round(Math.sin(m.age * 5 + m.seed * 9)), y = m.sy - 18 * k;
        dot(x, y, tone, k > .8 ? (1 - k) * 5 * .9 : .9, k < .3 ? 2 : 1);
      } else if (m.kind === 'life') {
        // Drawn in to the Keeper's chest, wavering less as it nears.
        const e = k * k * (3 - 2 * k), tx = p.x, ty = p.y - 18;
        const x = m.sx + (tx - m.sx) * e + Math.sin(m.age * 7 + m.seed * 9) * 2 * (1 - e), y = m.sy + (ty - m.sy) * e;
        const bx = m.sx + (tx - m.sx) * Math.max(0, e - .08), by = m.sy + (ty - m.sy) * Math.max(0, e - .08);
        dot(bx, by, FX.life.edge, .55);
        dot(x, y, k > .75 ? FX.life.core : FX.life.body, k > .85 ? (1 - k) * 6 * .9 : .9, 2);
      } else {
        // A shard of the ward cracking off and falling.
        const x = m.sx + (m.seed - .5) * 10 * k, y = m.sy + 22 * k * k;
        dot(x, y, k < .4 ? FX.shadow.core : FX.shadow.body, 1 - k);
      }
    }
    c.globalAlpha = 1;
  }

  /** Names and health over creatures, labels over gear on the ground, the numbers that float up. */
  private drawFightUi(inView: (x: number, y: number, pad?: number) => boolean): void {
    const c = this.ctx;
    c.textAlign = 'center'; c.textBaseline = 'bottom';
    for (const m of this.mobs.mobs) {
      // An elite's name, affixes and framed bar read from further off (a pack is worth seeing coming).
      if (m.elite && m.elite.role !== 'minion') {
        if (inView(m.x, m.y) && Math.hypot(m.x - this.player.x, m.y - this.player.y) <= 240) { drawElitePlate(c, m, m === this.mobs.target); if (m.aura || m.bless) drawAuraPip(c, m, Math.round(m.x) + 17, Math.round(m.y - this.vis(m.def).h - 5)); }
        continue;
      }
      if (!inView(m.x, m.y) || Math.hypot(m.x - this.player.x, m.y - this.player.y) > 150) continue;
      const top = m.y - this.vis(m.def).h - 3, w = 18, frac = Math.max(0, m.hp / m.def.hp);
      c.fillStyle = '#1a1014'; c.fillRect(Math.round(m.x - w / 2) - 1, Math.round(top) - 1, w + 2, 4);
      c.fillStyle = frac > .6 ? '#5fd35a' : frac > .3 ? '#e8c23a' : '#e2452a'; c.fillRect(Math.round(m.x - w / 2), Math.round(top), Math.round(w * frac), 2);
      // S6: a pack aura's pip beside the bar (the bearer's and each one it blesses).
      if (m.aura || m.bless) drawAuraPip(c, m, Math.round(m.x + w / 2) + 3, Math.round(top) - 1);
      // A unique's minions follow its name: a bar each, no name of their own.
      if (m.elite?.role === 'minion') continue;
      // Its name in the colour of its level against the Keeper's (td-zones gapTone, Tibia): grey trivial, cream even,
      // yellow +3, orange +6, red with a skull from +10 — the one-shot range.
      // A fixed aura-bearer names its aura on its plate (Orc Warlord · Might).
      const tone = gapTone(this.mobs.keeperLevel, m.def.level), label = m.aura ? `${m.def.name} ${m.def.level} · ${AURA_NAMES_EN[m.aura]}` : `${m.def.name} ${m.def.level}`;
      c.font = '6px "Pixelify Sans", monospace'; c.fillStyle = '#1a1014'; c.fillText(label, Math.round(m.x) + 1, Math.round(top) - 1);
      c.fillStyle = m === this.mobs.target && tone === 'even' ? '#ff8a7a' : GAP_TONES[tone]; c.fillText(label, Math.round(m.x), Math.round(top) - 2);
      if (tone === 'deadly') {
        // A skull, 5×5 pixels, left of the name.
        const sx = Math.round(m.x - c.measureText(label).width / 2) - 8, sy = Math.round(top) - 8;
        c.fillStyle = '#1a1014'; c.fillRect(sx, sy, 6, 6);
        c.fillStyle = GAP_TONES.deadly; c.fillRect(sx + 1, sy, 4, 3); c.fillRect(sx, sy + 1, 6, 2); c.fillRect(sx + 1, sy + 3, 4, 1); c.fillRect(sx + 1, sy + 4, 1, 1); c.fillRect(sx + 3, sy + 4, 1, 1);
        c.fillStyle = '#1a1014'; c.fillRect(sx + 1, sy + 1, 1, 1); c.fillRect(sx + 4, sy + 1, 1, 1);
      }
    }
    for (const g of this.groundLoot()) { const r = rungOf(g); if (r && inView(g.x, g.y) && (Math.hypot(g.x - this.player.x, g.y - this.player.y) < 110 || this.showcase.includes(g))) this.plate(g.label, g.x, this.dropTop(g), LOOT[r].body); }
    // A Gold pile names its sum while it lies there (Diablo II's "38 Gold"), in the pile's own gold.
    for (const g of this.mobs.drops) if (g.coins > 0 && inView(g.x, g.y) && Math.hypot(g.x - this.player.x, g.y - this.player.y) < 160) this.plate(g.label, g.x, g.y - 12, GOLD_RAMP[0]);
    c.font = 'bold 8px "Pixelify Sans", monospace';
    for (const f of this.mobs.floaters) {
      c.globalAlpha = Math.max(0, 1 - f.age);
      c.fillStyle = '#1a1014'; c.fillText(f.text, Math.round(f.x) + 1, Math.round(f.y) + 1);
      c.fillStyle = f.color; c.fillText(f.text, Math.round(f.x), Math.round(f.y));
    }
    c.globalAlpha = 1;
    // Spoken lines: a boss's chant over its head while it winds up, and the Keeper's spell words over his.
    for (const m of this.mobs.mobs) {
      const words = m.chantText ?? m.def.chant;
      // The Seam Eater speaks in the eclipse's pale violet; the rest of the bosses in ember.
      if (m.chantT && words && inView(m.x, m.y)) this.speech(words, m.x, Math.max(this.cam.y + 28, m.y - this.vis(m.def).h - 12), CHANT_SECS - m.chantT, m.def.id === SEAM_ID || creatureProfile(m.def.id).family === 'shade' || m.def.ghost ? '#d8c0ff' : '#ff8a7a');
    }
    const k = this.cant;
    if (k) this.speech(k.text, this.player.x, this.player.y - up(44), k.age, k.color);
    // S6: what creatures' abilities laid on him, over his head.
    drawKeeperStatus(c, this.mobs, this.player.x, this.player.y - up(52), this.time, this.still);
    // For the specs and the shots (S6): which abilities are telling now, and which auras stand here.
    { const tell = this.mobs.mobs.filter(m => m.tell > 0 && m.abCast !== undefined).map(m => m.abCast === -1 ? 'brutal' : castable(m.def.id)[m.abCast!]?.id ?? '').filter(Boolean).sort().join(',');
      const auras = [...new Set(this.mobs.mobs.map(m => m.aura).filter(Boolean))].sort().join(',');
      if (tell !== this.abilitySeen) { this.abilitySeen = tell; this.canvas.setAttribute('data-ability-tell', tell); }
      if (auras !== this.auraSeen) { this.auraSeen = auras; this.canvas.setAttribute('data-pack-auras', auras); } }
    // For the screenshot spec (e2e/td-cant-shots.spec.ts): the canvas says what the Keeper is saying.
    const said = k?.text ?? '';
    if (said !== this.cantSeen) { this.cantSeen = said; this.canvas.setAttribute('data-cant', said); }
  }
  /**
   * A spoken line (the Seam-Cant): pixel text in a tone, outlined one pixel in the night ink, that eases in, drifts up
   * a few pixels and fades over CHANT_SECS; with reduced motion it stands still at full strength, then is gone.
   */
  private abilitySeen = '';
  private auraSeen = '';
  private speech(text: string, x: number, y: number, age: number, color: string): void {
    const c = this.ctx, k = Math.min(1, Math.max(0, age / CHANT_SECS));
    text = text.replace(/ /g, '  ');   // the pixel face's space is a sliver: the words need air between them
    const alpha = this.still ? 1 : Math.min(1, age / .12, (1 - k) / .35);
    const tx = Math.round(x), ty = Math.round(y - (this.still ? 0 : 6 * k));
    c.save();
    c.font = 'bold 8px "Pixelify Sans", monospace'; c.textAlign = 'center'; c.textBaseline = 'bottom';
    c.globalAlpha = Math.max(0, alpha);
    c.fillStyle = '#140c1c';
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.fillText(text, tx + dx, ty + dy);
    c.fillStyle = color; c.fillText(text, tx, ty);
    c.restore();
  }

  private drawPerson(p: Person, action: 'idle' | 'run' | 'walk'): void {
    // Its shadow is cast in the ground pass (drawShadows).
    if (!p.painter) return;
    // The Keeper's aura (td-aura.ts): the figure drawn once on a scratch canvas, its silhouette laid round it as a rim-glow.
    const look = p === this.player ? this.auraLook() : null;
    // The art-direction prototype (td-artopt.ts B/C): the Ashguard Keeper in HD, its rim at the HD pixel.
    if (p === this.player && this.hdKeeper()) {
      if (look) {
        const sc = this.hdScratch ??= document.createElement('canvas');
        if (sc.width !== 160) { sc.width = 160; sc.height = 150; }
        const g = sc.getContext('2d')!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, sc.width, sc.height); g.imageSmoothingEnabled = false;
        this.paintHdKeeper(g, p, 80, 140, 1);
        const c = this.ctx; c.save(); c.scale(.5, .5);
        lookRimGlow(c, sc, 80, 140, Math.round(p.x) * 2, Math.round(p.y) * 2, look, this.time, this.still, envDetail() === 'low');
        c.restore();
      }
      this.paintHdKeeper(this.ctx, p, Math.round(p.x), Math.round(p.y), .5);
      return;
    }
    if (look) {
      const sc = this.figureScratch ??= document.createElement('canvas');
      if (sc.width !== 72) { sc.width = 72; sc.height = 80; }
      const g = sc.getContext('2d')!;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, sc.width, sc.height); g.imageSmoothingEnabled = false;
      this.paintPerson(g, p, action, { x: 36, y: 70 });
      if (optCamera()) lookRimGlow(this.ctx, sc, 36, 70, Math.round(p.x), Math.round(p.y), look, this.time, this.still, envDetail() === 'low');
      else rimGlow(this.ctx, sc, 36, 70, Math.round(p.x), Math.round(p.y), look, this.time, this.still);
    }
    this.paintPerson(this.ctx, p, action, null);
  }
  /** One person's figure: on the world (`at` null) or on a scratch canvas with the feet at `at`. */
  private paintPerson(c: CanvasRenderingContext2D, p: Person, action: 'idle' | 'run' | 'walk', at: { x: number; y: number } | null): void {
    const s = this.scale, cam = this.cam;
    if (!p.painter) return;
    const fx = at ? at.x : Math.round(p.x), fy = at ? at.y : Math.round(p.y);
    const acting = p === this.player && this.actT > 0;
    // The Thornstrider draws his bow from the side too (the painter's own draw pose), like the Ashguard's swing.
    const staff = carriesStaff(this.mobs.vocation), faces = this.mobs.vocation !== 'ashguard' && this.mobs.vocation !== 'thornstrider';
    // The Ashguard swings from the side (the painter's own blade arc); the Warlock and the Lanternwright cast facing the
    // camera, staff raised (the Lanternwright's lamp-staff is a worn piece the front sheet paints, not the Warlock's).
    if (p === this.player && (p.dir !== 'side' || (acting && faces))) {
      // The Warlock: front/back views with the staff in hand; every cast faces the camera, staff raised.
      const sheet = frontSheet(p.painter, staff), row = acting ? 0 : p.dir === 'down' ? 0 : 1;
      const f = acting ? CAST_FRAME : this.phone && row === 0 && !p.moving ? PHONE_FRAME : frontFrame(this.time + p.t, p.moving);
      c.drawImage(sheet, f * FRONT_W, row * FRONT_H, FRONT_W, FRONT_H, fx - FRONT_AX, fy - FRONT_AY, FRONT_W, FRONT_H);
      drawWornFront(c, p.painter, row === 0 ? 'down' : 'up', f, fx - FRONT_AX, fy - FRONT_AY, this.time, this.still);
      return;
    }
    if (p.dir !== 'side') {
      const sheet = frontSheet(p.painter), row = p.dir === 'down' ? 0 : 1;
      const f = p === this.player && this.phone && row === 0 && !p.moving ? PHONE_FRAME : frontFrame(this.time + p.t, p.moving);
      c.drawImage(sheet, f * FRONT_W, row * FRONT_H, FRONT_W, FRONT_H, fx - FRONT_AX, fy - FRONT_AY, FRONT_W, FRONT_H);
      drawWornFront(c, p.painter, row === 0 ? 'down' : 'up', f, fx - FRONT_AX, fy - FRONT_AY, this.time, this.still);
      return;
    }
    c.save();
    if (at) c.setTransform(p.face, 0, 0, 1, fx, fy);
    else c.setTransform(s * p.face, 0, 0, s, (fx - cam.x) * s, (fy - cam.y) * s);
    p.painter.draw(c, FIGURE_K, acting ? { action: 'attack', time: this.time, attackT: 1 - this.actT / .3, weapon: true, fxStill: this.still } : { action, time: this.time + p.t, attackT: 0, weapon: p === this.player, fxStill: this.still });
    c.restore();
  }

  // ── The art-direction prototype's HD figures (td-artopt.ts, td-hd-art.ts) ──
  private hdScratch: HTMLCanvasElement | null = null;
  /** The HD Keeper is drawn (B/C, an Ashguard: the one vocation the prototype repainted). */
  private hdKeeper(): boolean { return optHdFigures() && this.mobs.vocation === 'ashguard' && envDetail() !== 'low'; }
  /** The HD Keeper with its feet at (x, y), at `k` (½ on the world: one sheet px is half a world px; 1 on a scratch). */
  private paintHdKeeper(c: CanvasRenderingContext2D, p: Person, x: number, y: number, k: number): void {
    const sheet = hdKeeperSheet(), K = HD_KEEPER, row = p.dir === 'up' ? 1 : 0, f = hdKeeperFrame(this.time + p.t, p.moving);
    if (p.dir === 'side' && p.face < 0) {
      c.save(); c.translate(x, y); c.scale(-1, 1);
      c.drawImage(sheet, f * K.w, row * K.h, K.w, K.h, -K.ax * k, -K.ay * k, K.w * k, K.h * k);
      c.restore();
      return;
    }
    c.drawImage(sheet, f * K.w, row * K.h, K.w, K.h, x - K.ax * k, y - K.ay * k, K.w * k, K.h * k);
  }

  // ── The aura look (td-aura.ts) ──
  private figureScratch: HTMLCanvasElement | null = null;
  private readonly auraFx = new AuraFx();
  /** The prototype's ringless aura (the paused look branch, ~/er/wt-look): motes, flickers, the rim, a pulse when it fires. */
  private readonly lookAura = new LookAuraFx();
  private auraWas = false;
  private auraBeat = 0;
  /** `window.__tdArt.aura(true)` (automated browsers): the arcane aura on the Keeper, for the art pass's photographs. */
  private artAura: AuraLookId | null = null;
  /** The look of the aura the Keeper wears now: a running aura skill in its element, or the art pass's showcase. */
  private auraLook(): AuraLook | null {
    if (this.artAura) return AURA_LOOKS[this.artAura];
    const a = this.mobs.aura;
    return a === 'aura-embers' ? AURA_LOOKS.ember : a === 'aura-siphon' ? AURA_LOOKS.life : a === 'aura-watchfire' ? AURA_LOOKS.brass : a === 'lantern-aura' ? AURA_LOOKS.lamp : a === 'pack-bond' ? AURA_LOOKS.wild : null;
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

  /**
   * Fog (a level's `fog`: the Umbral Marches, the Drowned Crypts): two banks of soft mist drifting slowly across each
   * other, thinning to nothing round the Keeper so the ground at their feet and whatever comes at them stays readable.
   * One 128-px tileable sprite made once, laid into a half-resolution layer; still under reduced motion.
   */
  private drawFog(): void {
    // Weather v1's Fog thickens the land's own mist (+0.35 where it has none, +0.1 in the Marches); Low draws a flat wash
    // instead (td-weather-fx), so the noise layer is never added there.
    const own = this.level.fog ?? 0, wf = this.level === this.world ? this.weatherFx.now : null;
    const f = own + (wf && envDetail() !== 'low' ? fogExtra(wf.state, own) * wf.level : 0);
    if (f <= 0 || typeof document === 'undefined') return;
    const cam = this.cam, s = this.scale, N = 128;
    if (!this.fogTile) {
      // Periodic value noise, two octaves, so the tile wraps without a seam; soft lilac-grey, alpha from the noise.
      const t = document.createElement('canvas'); t.width = t.height = N;
      const g = t.getContext('2d')!, img = g.createImageData(N, N);
      const val = (x: number, y: number, p: number, salt: number) => {
        const fx = x / N * p, fy = y / N * p, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const h = (a: number, b: number) => hash(((a % p) + p) % p, ((b % p) + p) % p, salt);
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1);
        return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
      };
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const v = val(x, y, 4, 901) * .65 + val(x, y, 8, 907) * .35, a = Math.max(0, Math.min(1, (v - .32) * 1.9));
        const i = (y * N + x) * 4;
        img.data[i] = 206; img.data[i + 1] = 204; img.data[i + 2] = 224; img.data[i + 3] = Math.round(a * 255);
      }
      g.putImageData(img, 0, 0);
      this.fogTile = t;
      const hcv = document.createElement('canvas'); hcv.width = hcv.height = 64;
      const hg = hcv.getContext('2d')!, grad = hg.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(.5, 'rgba(0,0,0,.75)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      hg.fillStyle = grad; hg.fillRect(0, 0, 64, 64);
      this.fogHole = hcv;
    }
    const hw = Math.max(1, Math.ceil(cam.w / 2)), hh = Math.max(1, Math.ceil(cam.h / 2));
    if (!this.fogLayer || this.fogLayer.width !== hw || this.fogLayer.height !== hh) { this.fogLayer = document.createElement('canvas'); this.fogLayer.width = hw; this.fogLayer.height = hh; }
    const d = this.fogLayer.getContext('2d')!;
    d.globalCompositeOperation = 'source-over'; d.globalAlpha = 1;
    d.clearRect(0, 0, hw, hh);
    // Two banks: a broad slow one drifting east, a finer one drifting the other way; each pinned to the world, not the screen.
    for (const [k, vx, vy, a] of [[1, 3, .8, .9], [.6, -2, 1.4, .55]] as const) {
      const size = N * k, t = this.still ? 0 : this.time;
      const ox = ((-(cam.x / 2) - t * vx / 2) % size + size) % size - size, oy = ((-(cam.y / 2) - t * vy / 2) % size + size) % size - size;
      d.globalAlpha = a;
      for (let y = oy; y < hh; y += size) for (let x = ox; x < hw; x += size) d.drawImage(this.fogTile, x, y, size, size);
    }
    // Clear round the Keeper (wide), and a little round every lantern: lit air holds no mist.
    d.globalCompositeOperation = 'destination-out'; d.globalAlpha = 1;
    const hole = (x: number, y: number, r: number) => d.drawImage(this.fogHole!, (x - cam.x - r) / 2, (y - cam.y - r) / 2, r, r);
    // Weather v1's Fog: sight −40%, so the clear patch round the Keeper shrinks with it.
    hole(this.player.x, this.player.y - 14, 150 * (1 - (wf?.state === 'fog' ? .4 * wf.level : 0)));
    d.globalAlpha = .5;
    for (const o of this.visible) for (const l of o.sprite().lights ?? []) if (l.warm) hole(o.x + l.x, o.y + l.y, l.r * 2);
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = true;
    c.globalAlpha = Math.min(1, f);
    c.drawImage(this.fogLayer, 0, 0, hw * 2 * s, hh * 2 * s);
    c.globalAlpha = 1;
    c.imageSmoothingEnabled = false;
    c.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
  }

  /**
   * The darkness pass (td-night.ts; effects-spec "The night"): a deep blue-violet night (violet under an eclipse, near
   * black on a dark floor) laid in a low-resolution buffer — one buffer pixel is 2×2 art pixels, pinned to the world
   * grid so it never crawls as the camera moves — and scaled up with pixelated sampling. Every light is a hole with a
   * stepped falloff (a clear core, two steps, a dithered rim), and lamps, hearths and windows lay a warm wash inside
   * theirs. Drawn under the fight's bars and names; the HUD is DOM over the canvas and is never darkened.
   */
  private drawLight(): void {
    const dungeon = !!this.level.dark;
    this.night = nightPass({ darkness: this.darkness, eclipse: dungeon ? 0 : this.eclipseDepth, dungeon, setting: this.nightSetting });
    const tag = `${this.nightSetting}:${this.night.alpha.toFixed(2)}`;
    if (tag !== this.nightSeen) { this.nightSeen = tag; this.canvas.setAttribute('data-night', tag); }
    this.nightLights = [];
    if (!dungeon && this.dusk > .05 && this.night.amount < .5) {
      // Dawn and dusk: a warm wash before the dark.
      const c0 = this.ctx; c0.setTransform(1, 0, 0, 1, 0, 0); c0.globalAlpha = .16 * this.dusk; c0.fillStyle = '#ff9a4a';
      c0.fillRect(0, 0, this.canvas.width, this.canvas.height); c0.globalAlpha = 1;
    }
    if (this.night.alpha <= .02) return;
    const cam = this.cam, s = this.scale;
    // The buffer's origin sits on an even art pixel, so its 2×2 cells (and the rim's dither) stay put on the ground.
    const ox = Math.floor(cam.x / 2) * 2, oy = Math.floor(cam.y / 2) * 2;
    const bw = Math.max(1, Math.ceil(cam.w / 2) + 2), bh = Math.max(1, Math.ceil(cam.h / 2) + 2);
    if (!this.dark || this.dark.width !== bw || this.dark.height !== bh) { this.dark = document.createElement('canvas'); this.dark.width = bw; this.dark.height = bh; }
    const d = this.dark.getContext('2d')!;
    d.imageSmoothingEnabled = false;
    d.globalCompositeOperation = 'source-over'; d.globalAlpha = 1;
    d.clearRect(0, 0, bw, bh);
    const [r0, g0, b0] = this.night.rgb;
    d.fillStyle = `rgba(${r0},${g0},${b0},${this.night.alpha.toFixed(3)})`;
    d.fillRect(0, 0, bw, bh);
    d.globalCompositeOperation = 'destination-out';
    const bx = (x: number) => Math.round((x - ox) / 2), by = (y: number) => Math.round((y - oy) / 2);
    const onBuf = (x: number, y: number, r: number) => x + r > ox && x - r < ox + bw * 2 && y + r > oy && y - r < oy + bh * 2;
    // A hole of radius r (art px): the stepped sprite at its own size, never scaled (no blur, no resampling).
    const hole = (x: number, y: number, r: number, w = 1) => {
      if (r < 2) return;
      this.nightLights.push({ x, y, r, w });
      if (!onBuf(x, y, r)) return;
      const R = Math.max(1, Math.round(r / 2)), cx = bx(x), cy = by(y);
      d.globalAlpha = w;
      d.drawImage(this.holeSprite(R, (cx + cy) & 1), cx - R, cy - R);
    };
    const glows: { x: number; y: number; r: number }[] = [];
    for (const o of this.visible) {
      const sp = o.sprite();
      for (const l of sp.lights ?? []) { hole(o.x + l.x, o.y + l.y, l.r * 2); if (l.warm) glows.push({ x: o.x + l.x, y: o.y + l.y, r: l.r }); }
    }
    // The Keeper's own light: a modest circle, wider while the Light spell burns and with a boss unique's (the Warden's
    // Last Ember). An omen's flicker shrinks every light a moment; under reduced motion it dims once and holds still.
    const lit = this.mobs.lightBonus * TILE;
    const fl = this.still ? (this.darkLayer.flicker < 1 ? .9 : 1) : this.darkLayer.flicker;
    hole(this.player.x, this.player.y - 18, (KEEPER_LIGHT + lit) * fl);
    if (lit > 0) glows.push({ x: this.player.x, y: this.player.y - 18, r: 14 + lit / 6 });
    // The Lanternwright's lantern on its pole glows where it hangs (unless shuttered); the kin and the dawn are lights too.
    if (this.mobs.lamp) {
      const at = this.lanternAt();
      if (!this.mobs.shuttered) { hole(at.x, at.y, 46 * fl); glows.push({ x: at.x, y: at.y, r: 16 }); }
      for (const w of this.mobs.wisps) { hole(w.x, w.y, 40); glows.push({ x: w.x, y: w.y, r: 9 }); }
    }
    for (const b of this.mobs.beacons) { hole(b.x, b.y - 30, BEACON_LIGHT * 2); glows.push({ x: b.x, y: b.y - 30, r: 18 }); }
    // Dawn at Noon: the night opens over the disc (a little past its rim, twice for a clear core).
    for (const z of this.mobs.dawns) { hole(z.x, z.y, z.r * 1.7); hole(z.x, z.y, z.r * 1.25); glows.push({ x: z.x, y: z.y, r: z.r * .8 }); }
    // A campfire is a small hearth (canon §6.5): a light of its own, warm at its heart.
    for (const f of this.gather.lights()) { hole(f.x, f.y, f.r * 2); glows.push({ x: f.x, y: f.y, r: f.r * .35 }); }
    // A lit hearth is a light of its own; the fallen purse's beam a faint one.
    if (this.level === this.world) for (const h of this.hearths) if (this.hearthLit.has(h.id)) { hole(h.x, h.y - 8, 90); glows.push({ x: h.x, y: h.y - 8, r: 30 }); }
    const pl = this.purseHere();
    if (pl) hole(pl.x, pl.y - 10, 30);
    // The Seam Eater's corona is a light of its own under the eclipse (a fair fight: the whole of it shows, never a silhouette).
    for (const m of this.mobs.mobs) if (m.def.id === SEAM_ID) hole(m.x, m.y - m.def.h / 2, m.def.w * .9);
    // A running aura claims the ground round the Keeper: its ring glows through the dark (a soft light, not a stroke on screen).
    if (this.mobs.aura) {
      d.globalAlpha = .8; d.strokeStyle = '#000'; d.lineWidth = 3;
      d.beginPath(); d.arc(bx(this.player.x), by(this.player.y), this.mobs.auraRadius / 2, 0, Math.PI * 2); d.stroke();
      hole(this.player.x, this.player.y, this.mobs.auraRadius * 2 + 16, .2);
    }
    // Spells are their own light: the nova's running ring, a bolt's ember, a burst as it breaks.
    for (const e of this.mobs.effects) {
      const t = e.age / e.life;
      if (e.kind === 'wave' && t < .5) {
        const k = t / .5, r = 6 + ((e.r ?? NOVA_R) - 6) * (1 - (1 - k) * (1 - k));
        d.globalAlpha = .9 * (1 - k * .5); d.strokeStyle = '#000'; d.lineWidth = 3;
        d.beginPath(); d.arc(bx(e.x), by(e.y), r / 2, 0, Math.PI * 2); d.stroke();
      } else if (e.kind === 'bolt-hit' || e.kind === 'raise' || e.kind === 'flash' || e.kind === 'flame' || e.kind === 'kindle-hit' || e.kind === 'banish') hole(e.x, e.y, 28);
      else if ((e.kind === 'lamp-flash' || e.kind === 'lward-break') && t < .6) hole(e.x, e.y, (e.r ?? 48) * 2 * (1 - t));
      else if (e.kind === 'pillar' && t < .8) hole(this.player.x, this.player.y - 30, 56);
    }
    for (const b of this.mobs.bolts) hole(b.x, b.y, 24);
    // Gear on the ground is its own light, the rarer the further; a boss's tell lights its jaws and its cone.
    for (const g of this.groundLoot()) { const r = rungOf(g); if (r) { const b = lootBeam(r); hole(g.x, g.y - 3 - b.h / 2, b.light + b.h / 2); } }
    for (const m of this.mobs.mobs) if (m.tell > 0 && m.aim && windsUp(m.def)) { hole(m.x + m.face * m.def.w * .3, m.y - m.def.h * .55, 40); hole((m.x + m.aim.x) / 2, (m.y + m.aim.y + 12) / 2, 70); }
    for (const k of this.mobs.calls) hole(k.x, k.y, 30);
    // Glim lights the dark a little wider than the Keeper's own (much wider below ground, wider still with its lamp
    // while he rests); a light pet its own.
    if (this.glim.shown) {
      const r = (dungeon ? (this.glimLamp() ? GLIM_TD.lampLight : GLIM_TD.light) : GLIM_OPEN_LIGHT) + lit;
      hole(this.glim.x, this.glim.y, r * fl);
      glows.push({ x: this.glim.x, y: this.glim.y, r: dungeon ? 22 : 12 });
    }
    const pb = this.pet;
    if (pb && tdPetJob(pb.id, 'follow') === 'light') { hole(pb.x, pb.y - 8, TD_PET.light); glows.push({ x: pb.x, y: pb.y - 8, r: 12 }); }
    // The warm wash: lamplight, hearths and windows tint the ground they open (stepped, the Hearth palette).
    d.globalCompositeOperation = 'source-over';
    d.globalAlpha = Math.min(1, this.night.warm);
    for (const g of glows) {
      const r = g.r * 1.8;
      if (!onBuf(g.x, g.y, r)) continue;
      const R = Math.max(1, Math.round(r / 2));
      d.drawImage(this.warmSprite(R), bx(g.x) - R, by(g.y) - R);
    }
    d.globalAlpha = 1;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(this.dark, Math.round((ox - cam.x) * s), Math.round((oy - cam.y) * s), bw * 2 * s, bh * 2 * s);
    c.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
  }

  /** A light's hole at buffer radius R: the stepped falloff (td-night lightOpen), the rim dithered on the world checker. */
  private holeSprite(R: number, parity: number): HTMLCanvasElement {
    const key = R * 2 + parity;
    let sp = this.holeSprites.get(key);
    if (sp) return sp;
    if (this.holeSprites.size > 160) this.holeSprites.clear();
    sp = this.stepSprite(R, (f, x, y) => [0, 0, 0, lightOpen(f, ((x + y + parity) & 1) === 1)]);
    this.holeSprites.set(key, sp);
    return sp;
  }
  /** A warm wash at buffer radius R: stepped bands of the Hearth palette, a brass-cream heart (td-night warmAt). */
  private warmSprite(R: number): HTMLCanvasElement {
    let sp = this.warmSprites.get(R);
    if (sp) return sp;
    if (this.warmSprites.size > 80) this.warmSprites.clear();
    sp = this.stepSprite(R, f => f <= .35 ? [255, 210, 122, warmAt(f)] : [255, 179, 71, warmAt(f)]);
    this.warmSprites.set(R, sp);
    return sp;
  }
  private stepSprite(R: number, px: (f: number, x: number, y: number) => readonly [number, number, number, number]): HTMLCanvasElement {
    const n = R * 2 + 1, el = document.createElement('canvas');
    el.width = el.height = n;
    const g = el.getContext('2d')!, img = g.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const f = Math.hypot(x - R, y - R) / (R + .5);
      if (f > 1) continue;
      const [r, gg, b, a] = px(f, x, y), i = (y * n + x) * 4;
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = Math.round(a * 255);
    }
    g.putImageData(img, 0, 0);
    return el;
  }

  /**
   * The fight stays fair in the dark: a creature past the light shows as a faint night-blue silhouette with its own
   * eyes lit (one pixel each, the colour it was painted with), fading as a light reaches it. Drawn over the pass and
   * under the bars and names, which stay readable. Still under reduced motion (nothing here moves on its own).
   */
  private drawNightEyes(inView: (x: number, y: number, pad?: number) => boolean): void {
    if (this.night.alpha <= .3) return;
    const c = this.ctx;
    for (const m of this.mobs.mobs) {
      if (!inView(m.x, m.y, 20)) continue;
      const k = eyeGlow(this.night.alpha, litAt(this.nightLights, m.x, m.y - m.def.h / 2));
      if (k <= .02) continue;
      const d = this.vis(m.def), sheet = mobSheet(m.def), frames = Math.max(1, Math.round(sheet.width / d.w)), f = Math.floor(m.t * 6) % frames;
      const lift = d.floats ? Math.round(2 + Math.sin(m.t * 2.4) * 2) : 0;
      const X = Math.round(m.x), Y = Math.round(m.y - d.h - lift), left = -Math.floor(d.w / 2);
      // The silhouette: the body's shape in a pale night tone, a little lighter than the dark round it.
      c.save();
      c.translate(X, Y);
      if (m.face < 0) c.scale(-1, 1);
      c.globalAlpha = .28 * k * (d.ghost ? .6 : 1);
      c.drawImage(this.mobShade(d, sheet), f * d.w, 0, d.w, d.h, left, 0, d.w, d.h);
      c.restore();
      // The eyes: whole pixels, mirrored with the body.
      c.globalAlpha = Math.min(1, .35 + k);
      for (const e of this.eyesOf(d, sheet)[f] ?? []) {
        const ex = m.face < 0 ? X - (left + e.x) - 1 : X + left + e.x;
        c.fillStyle = `rgb(${Math.min(255, e.rgb[0] + 40)},${Math.min(255, e.rgb[1] + 40)},${Math.min(255, e.rgb[2] + 40)})`;
        c.fillRect(ex, Y + e.y, 1, 1);
      }
      c.globalAlpha = 1;
    }
  }
  private eyesOf(def: Mob['def'], sheet: HTMLCanvasElement): EyeSpot[][] {
    let eyes = this.mobEyes.get(def.id);
    if (eyes) return eyes;
    const frames = Math.max(1, Math.round(sheet.width / def.w)), g = sheet.getContext('2d')!;
    eyes = [];
    for (let f = 0; f < frames; f++) eyes.push(findEyes(g.getImageData(f * def.w, 0, def.w, def.h).data, def.w, def.h));
    this.mobEyes.set(def.id, eyes);
    return eyes;
  }
  private mobShade(def: Mob['def'], sheet: HTMLCanvasElement): HTMLCanvasElement {
    let sh = this.mobShades.get(def.id);
    if (sh) return sh;
    sh = document.createElement('canvas'); sh.width = sheet.width; sh.height = sheet.height;
    const g = sh.getContext('2d')!;
    g.drawImage(sheet, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#4a4480'; g.fillRect(0, 0, sh.width, sh.height);
    this.mobShades.set(def.id, sh);
    return sh;
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

/** The gold ramp (light → shadow) and its outline: the creatures' own gold (td-mobs R.gold), lit from the upper left. */
export const GOLD_RAMP = ['#fff0a0', '#e8b040', '#a87420', '#6a4414'] as const;
const GOLD_OUTLINE = '#2a1a24';

/** 0 a few coins, 1 a pile, 2 a heap: how much the pile holds, by the sum (whole art pixels whatever the size). */
export function goldPileSize(coins: number): 0 | 1 | 2 {
  return coins >= 250 ? 2 : coins >= 25 ? 1 : 0;
}

/**
 * A Gold pile on the ground, pixel art (docs/design/effects-spec.md rule 1): coins stacked in a mound, each coin a
 * lit face over its dark rim, one outline round the whole, a contact shadow under it, and a four-point glint now and
 * then. (X, Y) is the pile's foot.
 */
export function drawGoldPile(c: CanvasRenderingContext2D, X: number, Y: number, size: 0 | 1 | 2, glint: boolean): void {
  const [hi, body, rim, deep] = GOLD_RAMP;
  // Rows of the mound, bottom up: [left offset, width]. Each row a step narrower, so the silhouette is stepped.
  const rows: readonly (readonly [number, number])[] = size === 2
    ? [[-7, 15], [-6, 13], [-5, 11], [-4, 9], [-3, 7], [-2, 5]]
    : size === 1 ? [[-5, 11], [-4, 9], [-3, 7], [-2, 5]] : [[-3, 7], [-2, 5]];
  const h = rows.length;
  // Contact shadow: a flat dark band, a pixel wider than the base each side.
  c.globalAlpha = .35; c.fillStyle = '#140c1c'; c.fillRect(X + rows[0][0] - 1, Y, rows[0][1] + 2, 1); c.globalAlpha = 1;
  // Outline: every row grown a pixel each side, plus a cap over the top row.
  c.fillStyle = GOLD_OUTLINE;
  rows.forEach(([x0, w], i) => c.fillRect(X + x0 - 1, Y - 1 - i, w + 2, 1));
  c.fillRect(X + rows[h - 1][0], Y - 1 - h, rows[h - 1][1], 1);
  // The mound: dark rims at the foot and the right, the body, the lit upper-left faces.
  rows.forEach(([x0, w], i) => {
    const y = Y - 1 - i;
    c.fillStyle = i === 0 ? deep : rim; c.fillRect(X + x0, y, w, 1);
    if (i > 0) { c.fillStyle = body; c.fillRect(X + x0, y, w - 1, 1); }
    if (i > 0 && w > 3) { c.fillStyle = hi; c.fillRect(X + x0 + 1, y, Math.max(1, Math.floor(w / 3)), 1); }
  });
  // Coin edges: a dark seam every third pixel across the middle rows, so it reads as coins, not a lump.
  c.fillStyle = rim;
  for (let i = 1; i < h - 1; i++) { const [x0, w] = rows[i]; for (let x = x0 + 2 + (i % 2); x < x0 + w - 1; x += 3) c.fillRect(X + x, Y - 1 - i, 1, 1); }
  // A few loose coins at the foot of a bigger pile: a lit pixel over a rim pixel each.
  if (size > 0) {
    const loose = size === 2 ? [[-9, 0], [8, -1], [-8, -2]] : [[-7, 0], [6, 0]];
    for (const [dx, dy] of loose) {
      c.fillStyle = GOLD_OUTLINE; c.fillRect(X + dx - 1, Y + dy - 1, 3, 2);
      c.fillStyle = rim; c.fillRect(X + dx, Y + dy, 1, 1); c.fillStyle = hi; c.fillRect(X + dx, Y + dy - 1, 1, 1);
    }
  }
  // The glint: a white pixel and its four arms over the top coin.
  if (glint) {
    const gx = X + rows[h - 1][0] + 1, gy = Y - 1 - h;
    c.fillStyle = '#ffffff'; c.fillRect(gx, gy, 1, 1);
    c.globalAlpha = .8; c.fillStyle = hi;
    c.fillRect(gx - 1, gy, 1, 1); c.fillRect(gx + 1, gy, 1, 1); c.fillRect(gx, gy - 1, 1, 1); c.fillRect(gx, gy + 1, 1, 1);
    c.globalAlpha = 1;
  }
}
