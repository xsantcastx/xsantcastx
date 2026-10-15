import type { SpriteEntry } from '../../shared/art/sprite-manifest.generated';
import type { StationDef, StationKind, TownDef } from '../world/world.model';
import type { DisciplineId } from '../../shared/activity/activity.model';
import type { LiquidKind, PlaceableId, WorldActionKind } from './terrain';
import type { HeldToolKind } from '../../shared/skills/held-tool';
/** `down` aims a delve swing (or blast) below the Keeper; `blast` channels the staff. */
export type EngineInput = 'left' | 'right' | 'jump' | 'attack' | 'dodge' | 'down' | 'blast';
export type InteractionTarget = 'ore' | 'forge' | 'beacon' | 'passage';
export type KeeperAnimation = 'idle' | 'run' | 'jump' | 'fall' | 'attack' | 'dodge' | 'hurt';
export interface EngineState {
  /** `nearby`: id of the station within reach (`ore`/`forge`/`beacon`/`passage` or a town station id). */
  hp: number; enemyHp: number; nearby: string | null; x: number; y: number;
  /** Label and kind of the station within reach, for the HUD prompt. */
  nearbyLabel?: string; nearbyKind?: StationKind;
  /** Id of the town or hunt the Keeper stands in. */
  areaId?: string;
  coins?: number; kills?: number; area?: string;
  facing?: number; animation?: KeeperAnimation;
  /** True in an area with diggable terrain. `depth`: terrain rows below the surface the Keeper stands at. */
  delve?: boolean; depth?: number;
  /** In a delve with biomes: the name of the biome the Keeper stands in ("Glowcap Grotto"). */
  biome?: string;
  /**
   * Name of the creature the enemy bar measures: the nearest living one the
   * Keeper could meet (in a delve, on roughly the Keeper's level). Absent, with
   * `enemyHp` 0, when there is none — the bar hides.
   */
  enemyName?: string;
  /**
   * The same creature's stable id (its MonsterDef `creature` key, e.g.
   * 'rivet-maw'). The HUD translates it (`play.creature.<id>`), so a mixed
   * hunt names exactly the creature measured, in the player's language.
   */
  enemyId?: string;
  /**
   * The i18n key (`play.delve.*`, `play.hud.*`) of `message`, when it is a
   * line the HUD can translate. `messageVars.item` is a placeable id (the HUD
   * turns it into `name` / `lname`); `messageVars.items` is an English " and "
   * list the HUD re-joins. Absent otherwise (town arrivals, refusals written
   * in world data): show `message`.
   */
  messageKey?: string;
  messageVars?: Record<string, string | number>;
  /**
   * The gathering node within reach (a herb patch, a tree, an outcrop) when
   * no station is: `nearby` is then 'gather'. `need` is what still stops the
   * Keeper ("Sickle II", "Foraging 6"); `seconds` is the regrowth left.
   */
  gather?: { id: string; label: string; ready: boolean; seconds: number; need?: string; materialId: string; shut?: boolean };
  /**
   * The world clock's nodes and creatures out in this area now (ids, comma-joined:
   * "moonwake,eclipse-glass,ink-lantern"); '' when none is. A shut Moonwake
   * Bloom (day) is not in it. The canvas carries it as data-timed.
   */
  timed?: string;
  /**
   * In a liquid (delves): what the body is in, and the breath left 0..1 while
   * the head is under water (absent above it). `burning`: lava's after-burn.
   */
  liquid?: { in: LiquidKind | null; breath?: number; burning?: boolean; ward?: number };
  /**
   * Fishing (delves): the line's phase. `bite` is the 0.6 s window to hook
   * (E, or a tap); `hooked` hands the reel to the host. `canFish`: a rod is
   * held and fishable liquid is within a cast (the HUD shows "Fish").
   */
  fishing?: { phase: FishingPhase; liquid: LiquidKind } | null;
  canFish?: LiquidKind | null;
  /** The Underhearth (Phase 8): riding Kael's rails in the Seam Cart; the grapple's line ('grow' | 'pull' | 'hang'). */
  riding?: boolean;
  grappling?: 'grow' | 'pull' | 'hang' | null;
  /** The Banked Furnace's fight while it is up: banked or open, vents doused (of 4), seconds open, breathing in. */
  furnace?: { phase: 'banked' | 'open'; doused: number; open: number; breathing: boolean; vents: string };
  /** The high-ground find within reach (nearby is then 'height'), and whether this player has used it. */
  height?: { id: string; kind: 'cache' | 'carving' | 'lookout' | 'summit'; found: boolean };
  /** The Lost Cabinet within reach (nearby is then 'cabinet'), and whether it is open. */
  cabinet?: { id: string; open: boolean };
  /** On a surface with height: free, climb, hang or mantle. */
  climbing?: 'free' | 'climb' | 'hang' | 'mantle';
  /**
   * A realm Delve behind a Rift Gate (rift-gates.model.ts, umbral.ts): which realm; in the Ink Deeps the ink tide (its phase,
   * rows over the pools, seconds to its next change), whether the head is under ink, a mirrored ceiling
   * overhead, and the drift pockets' last shift epoch.
   */
  realm?: {
    id: string;
    tide?: 'low' | 'rising' | 'high' | 'falling'; tideRows?: number; nextTide?: number; inkBlind?: boolean; mirror?: boolean; shift?: number;
    /** The Root Deeps (verdant.ts): holes waiting to grow back, holes grown back this session, heart-roots standing in the Graftmother's hall. */
    regrowing?: number; regrown?: number; heartRoots?: number;
    /** The Prism Mines (luminous.ts): sun-prism beams in reach, and cells of solid light they lay. */
    beams?: number; bridges?: number;
    /** The Orrery Wells (celestial.ts): the Keeper's down (1 down, -1 up), times it turned this visit, the Fallen Ephemeris's state. */
    down?: 1 | -1; flips?: number; ephemeris?: 'orbit' | 'falling' | 'fallen' | 'gather' | 'rising';
  };
  /**
   * Which way the Keeper falls: 1 down (everywhere but the Orrery Wells), -1 up (standing on a ceiling in
   * an orrery field, or rising in a star-well; engine/celestial.ts). The Keeper's box is unchanged (feet at
   * `y`); only its contact flips, so a follower that hangs from the Keeper flips with this.
   */
  gravity?: 1 | -1;
  /** A guardian (a `once` creature) is the nearest foe: the score turns tense (shared/sound). */
  boss?: boolean;
  /** Liquids within a few cells of the Keeper (delves): the ambience beds near water, lava and ink. */
  near?: { water: boolean; lava: boolean; ink: boolean };
  /** Fish shadows drawn last frame (fish-shadows.ts), for tests and tools. */
  fishShadows?: number;
  paused: boolean; defeated: boolean; enemyDefeated: boolean; complete: boolean; message: string;
}
export type FishingPhase = 'wait' | 'bite' | 'hooked';
/** A world sound (EngineOptions.onSfx). */
export interface EngineSfx { kind: 'step' | 'land' | 'dig' | 'break' | 'clang' | 'splash' | 'cast' | 'bite' | 'catch' | 'bark' | 'chirp'; node?: string }
/** The fishing line hooked something: the host rolls the catch and runs the reel (or settles it at once when `auto`). */
export interface FishEvent {
  areaId: string;
  /** Biome id of the water ('glowcap-grotto', …) and the liquid. */
  biome: string;
  liquid: LiquidKind;
  /** Unique per hook this engine session: the catch's grant is keyed by it. */
  castId: string;
  /** Use was held through the bite (auto-fish): no mini-game, the Off grade. */
  auto: boolean;
  /** Where the bob sat, as a cell. */
  col: number; row: number;
}
/** A bucket swap: one `from` stack becomes one `to` stack (scoop or pour). */
export interface BucketEvent {
  from: BucketId; to: BucketId;
  areaId: string; cellKey: string; index: number; mutationId: string;
  liquid: LiquidKind;
}
export type BucketId = 'seam-bucket' | 'seam-bucket-water' | 'seam-bucket-lava';
export interface EngineOptions {
  /**
   * Force the render budget (engine/render-budget.ts): true = phone tier, false
   * = desktop tier. Omitted, it follows the device (a touch-first pointer is lite).
   */
  lite?: boolean;
  /** Pre-resolved legacy images. `creature`/`ore` are fallbacks when `art` cannot resolve a data key. */
  assets: { background?: string; keeper?: string; creature?: string; ore?: string; blade?: string };
  /** Resolves an `artFor()` key from world data to a URL. */
  art?: (key: string) => string;
  /** Resolves an area's scene basename (AreaDef.background) to a URL. Falls back to `assets.background`. */
  scene?: (name: string) => string;
  /**
   * World-layer sprite sheets by id (`spriteFor`, sprite-manifest.generated.ts).
   * Defaults to the generated manifest; tests inject fixtures. An id with no
   * entry (today: every id) keeps the mesh rig / placeholder exactly as before.
   */
  sprite?: (id: string) => SpriteEntry | null;
  /**
   * i18n lookup for in-canvas copy (keeper name tags and chatter, world/life.i18n.ts).
   * Absent (tests): name tags fall back to their English, chatter stays silent.
   */
  translate?: (key: string) => string;
  /** The town to stand in. Defaults to the Infernal town. */
  town?: TownDef;
  /** `ore` is the material quantity (legacy name); `material` is its stack id. */
  onLoot?: (loot: { id: string; coins: number; ore: number; material?: string }) => boolean | void;
  onInteract: (target: InteractionTarget) => void;
  /** A panel or waystone station was interacted with. The host opens its panel. */
  onStation?: (station: StationDef) => void;
  onState: (state: EngineState) => void;
  /**
   * Where picked-up loot flies: the satchel HUD's centre in CLIENT (viewport) px,
   * e.g. from its getBoundingClientRect(). Called once per pickup. Omitted, or
   * returning null → the canvas's top-right corner. Also settable later with
   * `engine.setSatchelTarget()`.
   */
  satchelTarget?: () => { x: number; y: number } | null | undefined;
  /**
   * A tool is about to break a terrain cell that pays XP or a material (see
   * engine/terrain.ts). Grant it through the progression gateway, keyed by
   * `mutationId` (stable per cell per engine session, so a retry is the same
   * grant). Return false to refuse: the cell stays standing, fully cracked,
   * and the next hit asks again. Cells that pay nothing (dirt, basalt) break
   * without asking. Return `'unpaid'` (WORLD_ACTION_UNPAID) when the cell
   * should break but pay nothing (a Delve rock cell during the seam's
   * recovery, play/delve-reward.ts): it breaks with no "gathered" line.
   */
  onWorldAction?: (event: WorldActionEvent) => boolean | void | typeof WORLD_ACTION_UNPAID;
  /**
   * The Keeper read something in the world (E or a tap beside it). Fires on
   * every read; the host decides whether it is new (DelveLoreService).
   */
  onDiscover?: (event: DiscoverEvent) => void;
  /**
   * The Keeper is about to place one `item` from the satchel. Take it (one
   * idempotent consume keyed by `mutationId`, unique per placement) and return
   * true; return false to refuse (none left, a failed save) and say why. The
   * cell is only filled after a yes. Absent: every placement is free (tests).
   */
  onPlace?: (event: PlaceEvent) => boolean | number | void;
  /**
   * The Keeper takes a placed thing back (X, or a long-press on it): grant one
   * `item` back to the satchel (idempotent on `mutationId`) and return true,
   * or false to refuse (a chest with things in it) and say why. Absent: free.
   */
  onTakeBack?: (event: PlaceEvent) => boolean | void;
  /** A placed chest or camp was used (E beside it, or a tap on it). The host opens it. */
  onUse?: (event: UseEvent) => void;
  /**
   * A Seam Bucket scoops or pours: swap one `from` for one `to` in the
   * satchel (idempotent on `mutationId`) and return true; false refuses and
   * nothing moves in the world. Absent: free (tests).
   */
  onBucket?: (event: BucketEvent) => boolean | void;
  /** The fishing line hooked a fish (see FishEvent). The host answers with `engine.landFish()`. */
  onFish?: (event: FishEvent) => void;
  /**
   * A creature fell to the Keeper. Fires once per kill (`id` is unique per
   * kill per engine session, the same prefix its drops are keyed by): the
   * host pays Hunting XP through SkillActionService, keyed by it.
   */
  onKill?: (event: KillEvent) => void;
  /**
   * A find on the high ground (world/heights.ts) was used: a courier cache, a
   * carving, the look-out or a summit cairn. The host books it once per player
   * (the claim is keyed by `find.id`) and answers with what to show; the engine
   * marks it found when the host says so (`setHeightsFound`).
   */
  onHeightFind?: (event: HeightFindEvent) => void;
  /**
   * A Lost Cabinet (shared/cabinets) shown by the Mirror Slate's Scan was
   * opened (E within reach). The host books it once per player and answers by
   * re-sending the marks (`setCabinets`) with it open.
   */
  onCabinet?: (event: CabinetEvent) => void;
  /**
   * A sound the world made (shared/sound): a footstep, a dig, a splash, the
   * cast and the bite. `node` is the terrain node id it came from (the host
   * turns it into a material); absent on a town street. Visual code never waits on it.
   */
  onSfx?: (cue: EngineSfx) => void;
  /**
   * The tool in hand changed (shared/skills/held-tool.ts): the rod for a cast,
   * the pickaxe for a dig, the axe or sickle at a node; null when the weapon
   * comes back (a foe near, a blow on one, or the work stopped). Visual only.
   */
  onHeldTool?: (tool: HeldToolKind | null) => void;
  /**
   * Per-player delves: where a delve area's seed comes from and where its dug
   * and placed cells go. Absent (SSR, tests): the spec's fixed seed, and dug
   * state lives for the engine session. Settable later with `setDelve()`.
   */
  delve?: DelvePersistence | null;
  /**
   * Where hunting-ground gathering nodes' harvest times come from and go.
   * Absent (SSR, tests): regrowth is kept for the engine session only.
   * Settable later with `setGathering()`.
   */
  gathering?: GatherPersistence | null;
  /** Wall clock in epoch ms (regrowth is measured against it). Defaults to `Date.now`; tests pass a fake. */
  now?: () => number;
}
/**
 * The engine's whole view of saved gathering regrowth: only harvest times are
 * stored, and readiness is derived from them and the node's `respawn` against
 * the wall clock, so a reload shows each node exactly as far along as it is.
 */
export interface GatherPersistence {
  /** Epoch ms of a node's last harvest, or null when there is none on record. */
  harvestedAt(areaId: string, nodeId: string): number | null;
  /** A node was harvested (the host accepted the grant). Idempotent: the later stamp wins. */
  harvested(areaId: string, nodeId: string, at: number): void;
}
export interface KillEvent {
  id: string;
  areaId: string;
  creature: string;
  name: string;
  /** The creature's full HP: what Hunting XP scales with. */
  hp: number;
}
export interface DiscoverEvent {
  /**
   * 'inscription': a carved wall was read (a core inscription id, or a field
   * note carved as `field:<id>`, shared/delve/field-notes.model.ts).
   * 'shrine': a rift shrine was touched (id `rift:<col>,<row>`); the engine has
   * already shown the tunnels round it on the map.
   * 'mark': one of the Four's hammer-marks in the Underhearth (id `hammer-mark-<n>`): the Keeper took a rubbing.
   */
  kind: 'inscription' | 'shrine' | 'mark';
  /** A shrine first touched while an eclipse is on (it showed twice as far; the host pays the eclipse's share). */
  eclipse?: boolean;
  /** Inscription id from the terrain spec (shared/delve/delve-lore.model.ts lists them), a field note, or a shrine. */
  id: string;
  /** Biome id the inscription sits in ('root-hollows', …). */
  biome: string;
}
/**
 * The engine's whole view of a per-player delve save. `layout` is
 * `terrainLayout(spec, seed)`: a saved diff under another layout is stale.
 */
export interface DelvePersistence {
  /** This player's seed for a delve area, or undefined for the spec's own. */
  seed(areaId: string): number | undefined;
  /** Saved cell overrides (cell index → node index) for that layout, or null. */
  cells(areaId: string, layout: string): ReadonlyMap<number, number> | null;
  /** A cell changed. `kind` null: it is back to what the seed generated. Debounce on the host side. */
  changed(areaId: string, layout: string, index: number, kind: number | null): void;
  /** Whether a once-per-player flag (a felled guardian, a paid find) is set. Optional: absent = never. */
  isClaimed?(id: string): boolean;
  /** Set a once-per-player flag, saved at once. Optional: absent = this session only. */
  claim?(id: string): boolean;
  /**
   * The map's explored cells for that layout: one bit per cell (`cells` of
   * them). The engine keeps the array it is handed and edits it in place.
   * Optional: absent = the map is explored for this session only.
   */
  seenCells?(areaId: string, layout: string, cells: number): Uint8Array | null;
  /** More of the map was explored (`bits` edited in place). Debounce on the host side. */
  explored?(areaId: string, layout: string, bits: Uint8Array): void;
  /**
   * Saved liquid that differs from the generated lakes (cell index → type × 16
   * + level), under `layout` = liquidLayout(spec, seed). Null: as generated.
   */
  liquids?(areaId: string, layout: string): ReadonlyMap<number, number> | null;
  /** The liquid settled (or a reaction or bucket changed it): the whole diff, replacing the last. Debounce on the host side. */
  liquidsChanged?(areaId: string, layout: string, cells: ReadonlyMap<number, number>): void;
  /**
   * The endless Delve (Phase 7, save v2): the sectors east and west of the
   * core. Absent: only the core is generated (tests, SSR, an old host).
   */
  sectors?: DelveSectorStore | null;
}
/**
 * One saved sector (32 × 32 cells; sy 1 holds rows 32..55): what the player
 * changed there, against what generator version `g` made. Local index =
 * (row − sy × 32) × 32 + (col − sx × 32).
 */
export interface SectorSave {
  g: number;
  /** Last change, epoch ms (the regrowth clock). */
  t: number;
  /** Changed cells: local index → node index. */
  cells: ReadonlyMap<number, number>;
  /** Settled liquid unlike the generated: local index → type × 16 + level. */
  liquids: ReadonlyMap<number, number>;
  /** Explored 4 × 4 blocks (bit b of byte b >> 3: block b, 8 blocks a row), or null. */
  fog: Uint8Array | null;
  /** Dug finds kept for good (local indices): regrowth never refills them. */
  receipts: ReadonlySet<number>;
  /** When the sector regrew (its far, unheld tunnels healed), epoch ms. */
  healed?: number;
}
/** The engine's view of the sector diffs (shared/delve/delve-save.service.ts implements it). */
export interface DelveSectorStore {
  sector(areaId: string, sx: number, sy: number): SectorSave | null;
  /** A cell changed (`kind` null: back to generated). `receipt`: a dug find, kept through regrowth. Debounce on the host side. */
  sectorChanged(areaId: string, sx: number, sy: number, g: number, local: number, kind: number | null, receipt?: boolean): void;
  /** The sector's whole liquid diff, replacing the last. */
  sectorLiquids(areaId: string, sx: number, sy: number, g: number, cells: ReadonlyMap<number, number>): void;
  /** The sector's explored blocks (8 bytes), OR'd into what is saved. */
  sectorExplored(areaId: string, sx: number, sy: number, g: number, fog: Uint8Array): void;
  /** Every saved sector of the area (the map and the camp search read them). */
  sectorKeys(areaId: string): readonly { sx: number; sy: number }[];
}
export interface PlaceEvent {
  item: PlaceableId;
  areaId: string;
  /** `col,row` of the cell it goes into (or comes out of). */
  cellKey: string;
  /** The same cell as an index into the area's terrain (what chests are filed by). */
  index: number;
  mutationId: string;
  /**
   * How many of `item` this one action takes or gives (a Bark Rope spools one
   * coil a cell; its whole strand comes back at once). Absent: one. `onPlace`
   * may answer with a number: how many it took (fewer, when fewer are left).
   */
  count?: number;
}
export interface UseEvent {
  /** A chest or camp opens; a Rift Anchor offers travel; the Banked Furnace's hearth is where it is summoned. */
  kind: 'chest' | 'camp' | 'anchor' | 'furnace' | 'gate' | 'brazier';
  areaId: string;
  cellKey: string;
  index: number;
  /** The cell, as world column and row. */
  col?: number; row?: number;
  /** A Rift Gate's node (`rift-gate-<realm>`): which realm it opens on. */
  node?: string;
}
export interface WorldActionEvent {
  kind: WorldActionKind;
  areaId: string;
  /** `col,row` of the cell in its area's terrain. */
  cellKey: string;
  /** Rolled yield; absent when the node pays only XP or its chance missed. */
  materialId?: string;
  qty?: number;
  discipline: DisciplineId;
  xp: number;
  mutationId: string;
  /**
   * The placeable stack the break drops (dirt → 'dirt-block'), to grant after
   * the break is accepted, keyed `${mutationId}:block`. A full satchel just
   * loses the block; it never stops the dig.
   */
  block?: PlaceableId;
  /** A delve cell: the terrain node that broke ('cinder-vein'…), for the Board Herald's dig bounties. */
  node?: string;
  /**
   * Set when a hunting-ground gathering node (GatherNodeDef) broke rather
   * than a delve cell: the node's id. The host books it as a skill action at
   * that area, never through the Seamworks seam.
   */
  site?: string;
}
/** A Lost Cabinet the engine draws: shown by the Scan, or already open. World point = its feet. */
export interface CabinetMark { id: string; area: string; x: number; y: number; open: boolean; delve: boolean }
/** A Lost Cabinet was used (EngineOptions.onCabinet). */
export interface CabinetEvent { areaId: string; id: string; open: boolean }
/** A high-ground find was used (EngineOptions.onHeightFind). */
export interface HeightFindEvent { areaId: string; id: string; kind: 'cache' | 'carving' | 'lookout' | 'summit'; found: boolean }
export interface Body { x: number; y: number; vy: number; grounded: boolean }
export interface Platform { x: number; y: number; width: number }
/** onWorldAction's "break it, pay nothing" answer (see EngineOptions.onWorldAction). */
export const WORLD_ACTION_UNPAID = 'unpaid' as const;
export const WORLD_WIDTH = 2700;
export const FLOOR = 610;
/**
 * Where the canvas draws its one-line cues ("CLICK TO WALK HERE" over a
 * hovered station; "[ J / E ] GATHER" / "NEEDS …" / "GROWING BACK …" over a
 * gathering node): above the thing, never on the floor band below FLOOR,
 * which the HUD's action bar covers at 1280×800 and on a 390×844 phone.
 * Station cue: just over the stall hit box (FLOOR − 240). Node cue: this far
 * above the node's material icon.
 */
export const STATION_CUE_Y = FLOOR - 250;
export const SITE_CUE_RISE = 14;
export const PLATFORMS: Platform[] = [
  { x: 0, y: FLOOR, width: WORLD_WIDTH }, { x: 370, y: 500, width: 210 },
  { x: 670, y: 410, width: 180 }, { x: 1000, y: 505, width: 250 },
  { x: 1350, y: 430, width: 180 }, { x: 2210, y: 505, width: 180 },
];
/** One-way platforms: land only while descending across the top surface. */
export function advanceBody(body: Body, velocityX: number, dt: number, platforms: readonly Platform[] = PLATFORMS, width = WORLD_WIDTH): void {
  const previousY = body.y;
  body.x = Math.max(30, Math.min(width - 30, body.x + velocityX * dt));
  body.vy += 1650 * dt;
  body.y += body.vy * dt;
  body.grounded = false;
  for (const platform of platforms) {
    if (body.vy >= 0 && previousY <= platform.y && body.y >= platform.y &&
        body.x + 16 > platform.x && body.x - 16 < platform.x + platform.width) {
      body.y = platform.y; body.vy = 0; body.grounded = true;
    }
  }
}
/** `floorY`: the ground the enemy stands on; `scale`: the area's figure scale (reach shrinks with the figures). */
export function meleeHits(player: Body, enemyX: number, facing: number, floorY = FLOOR, scale = 1): boolean {
  const distance = enemyX - player.x;
  return Math.abs(distance) < 145 * scale && distance * facing >= -20 * scale && Math.abs(player.y - floorY) < 105 * Math.max(scale, .6);
}
/** Arrival tolerance for click-to-move, in world px. One fixed step at walk speed is ~4.4px. */
export const ARRIVE_DISTANCE = 6;
/**
 * The walk direction toward a click-to-move target: -1, 0 (arrived) or 1.
 * Pure, so the fixed-step update and the tests agree on what "arrived" means.
 */
export function walkDirection(fromX: number, toX: number): -1 | 0 | 1 {
  const dx = toX - fromX;
  return Math.abs(dx) <= ARRIVE_DISTANCE ? 0 : dx > 0 ? 1 : -1;
}
