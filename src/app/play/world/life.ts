/**
 * life.ts: who stands in the towns, as data. Phase 4 "Life".
 *
 *  - Keepers: one shopkeeper beside each panel station (plus Aureth and Verrin
 *    in their own realms). Canon cast members stand where the cast already
 *    claims the page (`npc.model.ts` paths). The Bible's people stand at the
 *    stations world-and-cast §3 gives them (S3, the NPC depth pass): their name
 *    tag is the person (Mara Voss) and the approved role title rides under it
 *    as a subtitle (Bench Smith). Every role keeper now has a name (the last six
 *    named 2026-10-14: Orla Stave, Idris Calder, Lune Coyne, Pim Larkin, Corran
 *    Holt, Hesta Cairn; docs/world/lore-addendum.md).
 *  - Townsfolk: two to four wandering figures per town, on floor segments that
 *    never cover a station or a keeper. Each says one line naming where a
 *    material of this town's hunting grounds is found, read off the hunts'
 *    gathering nodes and drop tables (`townsfolkLines`): no new names.
 *  - Atmosphere: one ambient particle layer per realm (engine/atmosphere.ts).
 *
 * Visual only. Nothing here reads or writes combat, loot or economy state.
 * Pure: no DOM, no Angular, no art resolution, so the node harness
 * (`scripts/seamworks-engine.test.cjs`) loads it directly. Art is named by
 * `artFor()` key and resolved by the host; every key here is unpainted today
 * and the engine draws a robed placeholder in the realm palette instead.
 *
 * Chatter: every line is an i18n key in `life.i18n.ts` (EN + ES); which ones a
 * keeper says, and when, is keeper-lines.ts (story beats and station deeds). A
 * canon keeper's English lines are taken word for word from the cast's dialogue
 * table (`DIALOGUE` in npc.model.ts); the harness asserts it, so a keeper can
 * never say something its character does not say elsewhere.
 */
import type { NpcId } from '../../shared/npc/npc.model';
import { allKeeperLines } from './keeper-lines';
import type { RealmTownId, StationDef, TownDef } from './world.model';

/** A figure's colours. Every set is drawn from its realm's sprite palette (docs/art-commissions/world-sprites). */
export interface LifePalette {
  /** Main robe / coat. */
  robe: string;
  /** The shadowed side of the robe. */
  shade: string;
  /** Collar, hem and sash. */
  trim: string;
  /** Face and hands. */
  skin: string;
  /** Soft rim light and the name tag accent. */
  glow: string;
}

/** Realm palettes. Index 0 dresses that realm's role keepers; the rest dress townsfolk. */
export const REALM_PALETTES: Readonly<Record<RealmTownId, readonly LifePalette[]>> = {
  // Iron black, basalt grey, ember orange seams.
  infernal: [
    { robe: '#3a2b2d', shade: '#241a1c', trim: '#e8752a', skin: '#d9a07a', glow: '#ff9b4f' },
    { robe: '#4b3a36', shade: '#2c2220', trim: '#b6683a', skin: '#c99272', glow: '#f2a066' },
    { robe: '#5a4440', shade: '#33262a', trim: '#8d4f58', skin: '#e0b08a', glow: '#ffb46a' },
  ],
  // Warm gold, ivory, pale crystal, sunlit stone.
  luminous: [
    { robe: '#e9dfc8', shade: '#b9ab8c', trim: '#e8d44d', skin: '#f0cfa8', glow: '#fff1b0' },
    { robe: '#d8c49a', shade: '#a8946c', trim: '#f4ead2', skin: '#e8c29a', glow: '#ffe7a0' },
    { robe: '#c9b8e0', shade: '#998aae', trim: '#e8d44d', skin: '#f2d2b0', glow: '#fff4c8' },
  ],
  // Black-violet, amethyst, obsidian, moonlight grey.
  umbral: [
    { robe: '#2a1d3a', shade: '#160f22', trim: '#a855f7', skin: '#b9b0c8', glow: '#c9a0ff' },
    { robe: '#3b3048', shade: '#211a2b', trim: '#8e8a9e', skin: '#c6bed2', glow: '#b48cff' },
  ],
  // Midnight blue, star silver, brass, cyan glints.
  celestial: [
    { robe: '#1f2f5a', shade: '#121c38', trim: '#b8913f', skin: '#d8c2a6', glow: '#7fd8ff' },
    { robe: '#2c3c6a', shade: '#18223f', trim: '#c8d2e6', skin: '#e0c8aa', glow: '#9fdcff' },
    { robe: '#3a3a5e', shade: '#20203a', trim: '#5fb6ff', skin: '#d4b896', glow: '#b8e6ff' },
  ],
  // Moss green, rootwood brown, amber, soft green glow.
  verdant: [
    { robe: '#3e5a32', shade: '#24361d', trim: '#c08a3e', skin: '#d6a982', glow: '#b6f28a' },
    { robe: '#5a4630', shade: '#35281b', trim: '#7fb85a', skin: '#c99a76', glow: '#d8f2a0' },
    { robe: '#4a6a4a', shade: '#2a3e2a', trim: '#e0b060', skin: '#e2b896', glow: '#c6f0a0' },
  ],
};

/** The placeholder shape until a figure is painted. */
export type LifeSilhouette = 'robe' | 'hood' | 'smith' | 'coat';

export interface KeeperDef {
  /** Unique within its town. Keys its chatter lines and name. */
  id: string;
  /** The station it stands beside (a station id in the same town). */
  station: string;
  /** Other panel stations in the same town this keeper also runs (it stands between them). */
  serves?: readonly string[];
  /** Set for the canon cast: their lines come from npc.model.ts DIALOGUE. */
  npc?: NpcId;
  /** English name tag, the fallback when no translation is wired (tests, SSR). */
  name: string;
  /** i18n key of the name tag. */
  nameKey: string;
  /**
   * The subtitle under the name: the approved role title for a named person
   * ("Bench Smith" under "Mara Voss"), the epithet for the canon cast. Absent
   * for a keeper still called by its title. English fallback; i18n `titleKey`.
   */
  title?: string;
  titleKey?: string;
  /** `artFor()` key of the standing figure. Unpainted today: the placeholder draws. */
  art: string;
  palette: LifePalette;
  silhouette: LifeSilhouette;
  /** Which side of the station to try first (+1 east, -1 west). */
  side: 1 | -1;
  /**
   * Every line this keeper can say (i18n keys). Which of them it says to this
   * Keeper, and in what order, is `keeperLines()` (keeper-lines.ts).
   */
  lines: readonly string[];
}

const P = REALM_PALETTES;
/** Canon accents (npc.model.ts colours) over their realm robes. */
const KAEL: LifePalette = { robe: '#2b2224', shade: '#171113', trim: '#e8752a', skin: '#c99272', glow: '#ff9b4f' };
const MERCHANT: LifePalette = { robe: '#7a5236', shade: '#4d3322', trim: '#c89868', skin: '#e8c29a', glow: '#ffe7a0' };
const AURETH: LifePalette = { robe: '#f4ead2', shade: '#c9b98f', trim: '#e8d44d', skin: '#f2d6b4', glow: '#fff1b0' };
const VERRIN: LifePalette = { robe: '#1d1428', shade: '#0d0914', trim: '#a855f7', skin: '#2a2236', glow: '#c9a0ff' };
const ARCHIVIST: LifePalette = { robe: '#1d3360', shade: '#10203f', trim: '#b8913f', skin: '#c9b29a', glow: '#5fb6ff' };

function keeper(id: string, station: string, name: string, palette: LifePalette, silhouette: LifeSilhouette, side: 1 | -1, art: string, npc?: NpcId, title?: string): KeeperDef {
  return {
    id, station, npc, name, nameKey: `play.life.name.${id}`, art, palette, silhouette, side,
    ...(title ? { title, titleKey: `play.life.title.${id}` } : {}),
    lines: allKeeperLines(id),
  };
}

/**
 * Keepers per town. Art keys follow the world-sprite commission ids
 * (`docs/art-commissions/world-sprites/03-npcs.md`) with a `-figure` suffix:
 * the bare `npc-<id>` key is the menu PORTRAIT, and a portrait stood on the
 * floor would be a bust at full height.
 */
export const TOWN_KEEPERS: Readonly<Record<RealmTownId, readonly KeeperDef[]>> = {
  infernal: [
    // Orla Stave, Edrin Kade's cousin: a stave is a notched tally stick, and she has her grandmother's.
    keeper('vault-clerk', 'vault', 'Orla Stave', P.infernal[2], 'coat', -1, 'npc-vault-clerk-figure', undefined, 'Vault Clerk'),
    keeper('buyback-clerk', 'vendor', 'Edrin Kade', P.infernal[1], 'coat', 1, 'npc-material-vendor-figure', undefined, 'Buyback Clerk'),
    keeper('bench-smith', 'crafting', 'Mara Voss', P.infernal[2], 'smith', 1, 'npc-bench-smith-figure', undefined, 'Bench Smith'),
    // Kael's sprite brief stands him at the Rune Forge.
    keeper('kael', 'runes', 'Kael', KAEL, 'smith', 1, 'npc-kael-figure', 'kael', 'the Broken Flame'),
    // Idris Calder trained in the Archive before the Seamworks; sockets are promises.
    keeper('enchanter', 'enchanting', 'Idris Calder', P.infernal[0], 'robe', -1, 'npc-enchanter-figure', undefined, 'Enchanter'),
  ],
  luminous: [
    keeper('merchant', 'market', 'The Merchant', MERCHANT, 'coat', 1, 'npc-merchant-figure', 'merchant', 'of the long till'),
    // The Heliograph Court is hers: she stands by the court's waystone.
    keeper('aureth', 'waystone', 'Aureth', AURETH, 'robe', -1, 'npc-aureth-figure', 'aureth', 'the Radiant'),
    // Tomas tends the Court's lanterns, the ones that light the Waystone road.
    keeper('tomas', 'waystone', 'Tomas Rill', P.luminous[1], 'coat', 1, 'npc-tomas-rill-figure', undefined, 'Lantern Keeper'),
    // Ilyra listens at the East Stair, where the dawn-glass of the Reflection Channels begins.
    keeper('ilyra', 'passage', 'Ilyra Venn', P.luminous[2], 'robe', -1, 'npc-ilyra-venn-figure', undefined, 'Archive Listener'),
  ],
  umbral: [
    // Lune Coyne, the Croupier, also runs the games of chance in a row just east of where she waits.
    { ...keeper('croupier', 'gambler', 'Lune Coyne', P.umbral[0], 'hood', 1, 'npc-croupier-figure', undefined, 'Croupier'), serves: ['reels', 'rune-drop', 'seam-sweeper', 'eclipse-ascent'] },
    // The Exchange hall closed with the game-only shell (docs/handoff/page-audit.md); Amina keeps her ledgers
    // beside Lune's tables until a world-native trade hall is built.
    keeper('broker', 'gambler', 'Amina Thorne', P.umbral[1], 'coat', 1, 'npc-exchange-broker-figure', undefined, 'Exchange Broker'),
    // Where two reflections disagree, a corridor opens. Verrin watches it.
    keeper('verrin', 'passage', 'Verrin', VERRIN, 'hood', -1, 'npc-verrin-figure', 'verrin', 'the Hollow'),
    // Rook maps the corridor's reflections from its other side: Verrin west of the mouth, Rook east.
    keeper('rook', 'passage', 'Rook Sable', P.umbral[0], 'hood', 1, 'npc-rook-sable-figure', undefined, 'Veil Cartographer'),
  ],
  celestial: [
    keeper('archivist', 'codex', 'The Archivist', ARCHIVIST, 'robe', -1, 'npc-archivist-figure', 'archivist', 'keeper of fragments'),
    // The Leaderboards station closed with the game-only shell; Nox charts renown beside the Archivist until
    // the ladders are rebuilt in the world.
    keeper('chart-clerk', 'codex', 'Nox Aster', P.celestial[1], 'coat', 1, 'npc-chart-clerk-figure', undefined, 'Chart Clerk'),
    // The Waystones are the Meridian Compact's transit apertures; Sera runs the network.
    keeper('sera', 'waystone', 'Sera Quill', P.celestial[2], 'robe', 1, 'npc-sera-quill-figure', undefined, 'Chief Meridian'),
  ],
  verdant: [
    keeper('steward', 'sanctum', 'Siv Moss', P.verdant[0], 'coat', 1, 'npc-expedition-steward-figure', undefined, 'Expedition Steward'),
    // Pim Larkin reads the board aloud, as Larkins have for four generations; Corran Holt walked the roads
    // with Siv before his knee went; Hesta Cairn keeps the door of the trials for Verrin.
    keeper('herald', 'quests', 'Pim Larkin', P.verdant[1], 'robe', 1, 'npc-board-herald-figure', undefined, 'Board Herald'),
    keeper('gatekeeper', 'arena', 'Corran Holt', P.verdant[2], 'smith', 1, 'npc-arena-gatekeeper-figure', undefined, 'Arena Gatekeeper'),
    keeper('trials-warden', 'trials', 'Hesta Cairn', P.verdant[0], 'hood', -1, 'npc-trials-warden-figure', undefined, 'Trials Warden'),
    keeper('lodge-warden', 'skills', 'Kesh Arbo', P.verdant[1], 'robe', 1, 'npc-lodge-warden-figure', undefined, 'Lodge Warden'),
  ],
};

/** How many townsfolk wander each town. Capped at four. */
export const TOWNSFOLK_COUNT: Readonly<Record<RealmTownId, number>> = {
  infernal: 3, luminous: 4, umbral: 2, celestial: 3, verdant: 3,
};
export const TOWNSFOLK_MAX = 4;
/** `artFor()` key of a realm's townsfolk figure. Unpainted today. */
export function townsfolkArt(realm: RealmTownId): string { return `townsfolk-${realm}-figure`; }

// ── Placement ───────────────────────────────────────────────────────────────

/** Half the width a keeper occupies on the floor, world px. */
export const KEEPER_HALF = 24;
/** Clear floor between a keeper and the footprint beside it. */
export const KEEPER_GAP = 10;

export interface KeeperPlacement {
  def: KeeperDef;
  /** World x of the keeper's feet. */
  x: number;
  /** The station it serves. */
  station: StationDef;
}

function footprint(station: StationDef): [number, number] {
  const half = (station.width ?? 120) / 2;
  return [station.x - half, station.x + half];
}
function overlaps(a0: number, a1: number, b0: number, b1: number): boolean { return a0 < b1 && b0 < a1; }

/**
 * Stand each keeper beside its station, never on any station's footprint and
 * never on another keeper. Tries its preferred side, then the other, then
 * steps further out (up to 80 px). A keeper with nowhere to stand is left out
 * rather than drawn over a stall. Pure.
 */
export function placeKeepers(town: TownDef, keepers: readonly KeeperDef[] = TOWN_KEEPERS[town.realm] ?? []): KeeperPlacement[] {
  const placed: KeeperPlacement[] = [];
  const free = (x: number): boolean => {
    if (x - KEEPER_HALF < 0 || x + KEEPER_HALF > town.width) return false;
    for (const station of town.stations) {
      const [s0, s1] = footprint(station);
      if (overlaps(x - KEEPER_HALF, x + KEEPER_HALF, s0 - KEEPER_GAP, s1 + KEEPER_GAP)) return false;
    }
    for (const other of placed) {
      if (overlaps(x - KEEPER_HALF, x + KEEPER_HALF, other.x - KEEPER_HALF - KEEPER_GAP, other.x + KEEPER_HALF + KEEPER_GAP)) return false;
    }
    return true;
  };
  for (const def of keepers) {
    const station = town.stations.find(row => row.id === def.station);
    if (!station) continue;
    const half = (station.width ?? 120) / 2;
    let spot: number | null = null;
    for (let out = 0; out <= 80 && spot === null; out += 8) {
      for (const side of [def.side, -def.side as 1 | -1]) {
        const x = station.x + side * (half + KEEPER_GAP + KEEPER_HALF + out);
        if (free(x)) { spot = x; break; }
      }
    }
    if (spot !== null) placed.push({ def, x: spot, station });
  }
  return placed;
}

/** The keeper under a world point (its body, feet to crown), or null. Used so a click on a keeper opens its station. */
export function keeperAt(placements: readonly KeeperPlacement[], x: number, y: number, floor: number): KeeperPlacement | null {
  if (y < floor - 175 || y > floor + 20) return null;
  for (const p of placements) if (Math.abs(p.x - x) <= KEEPER_HALF + 4) return p;
  return null;
}

/** Floor townsfolk stay clear of, beyond a station footprint or a keeper. */
export const WANDER_CLEARANCE = 18;
/** The shortest floor segment worth wandering. */
export const WANDER_MIN = 130;

/**
 * Open floor for townsfolk: the town's walkable width (west of `safeX` when
 * monsters roam beyond it) minus every station footprint and every keeper,
 * each padded by `WANDER_CLEARANCE`. Segments shorter than `WANDER_MIN` are
 * dropped. Sorted west to east. Pure.
 */
export function wanderSegments(town: TownDef, placements: readonly KeeperPlacement[]): [number, number][] {
  const lo = 70, hi = (town.safeX && town.safeX > 0 ? town.safeX : town.width) - 70;
  const blocked: [number, number][] = [];
  for (const station of town.stations) {
    const [s0, s1] = footprint(station);
    blocked.push([s0 - WANDER_CLEARANCE, s1 + WANDER_CLEARANCE]);
  }
  for (const p of placements) blocked.push([p.x - KEEPER_HALF - WANDER_CLEARANCE, p.x + KEEPER_HALF + WANDER_CLEARANCE]);
  blocked.sort((a, b) => a[0] - b[0]);
  const segments: [number, number][] = [];
  let cursor = lo;
  for (const [b0, b1] of blocked) {
    if (b1 <= cursor) continue;
    if (b0 >= hi) break;
    if (b0 - cursor >= WANDER_MIN) segments.push([cursor, b0]);
    cursor = Math.max(cursor, b1);
  }
  if (hi - cursor >= WANDER_MIN) segments.push([cursor, hi]);
  return segments;
}

/** True when a figure at world x is worth drawing for this camera. */
export function onScreen(x: number, camera: number, viewport: number, margin = 80): boolean {
  return x >= camera - margin && x <= camera + viewport + margin;
}

// ── Townsfolk ───────────────────────────────────────────────────────────────

export interface Townsperson {
  x: number;
  /** -1 west, +1 east. */
  facing: number;
  /** The segment it never leaves. */
  lo: number; hi: number;
  target: number;
  speed: number;
  /** Seconds left standing still; 0 while walking. */
  pause: number;
  /** Walk cycle phase, advanced only while walking. */
  step: number;
  /** Stepping past the Keeper to the far side (the near side had no room): no yielding until arrived. */
  passing?: boolean;
  /** Draw scale, 0.85..1. */
  build: number;
  /** Phase offset for the idle breath. */
  seed: number;
  palette: LifePalette;
  silhouette: LifeSilhouette;
  /** Its one line: `TOWNSFOLK_LINE` filled with `says` (empty when the town has nothing to name). */
  def: { lines: readonly string[] };
  says: FolkLine | null;
}

/** i18n key of a townsperson's line; `{{material}}` and `{{place}}` are filled from `Townsperson.says`. */
export const TOWNSFOLK_LINE = 'play.life.townsfolk.found';

/** A material id and the hunting ground that yields it. */
export interface FolkLine { material: string; place: string }

/**
 * What this town's hunting grounds yield, one hunt at a time in turn so
 * neighbours name different places: each hunt's gathering nodes first, then
 * its drop table. The same data "Found in…" reads.
 */
export function townsfolkLines(town: TownDef): FolkLine[] {
  const pools = town.hunts.map(hunt => ({
    place: hunt.name,
    ids: [
      ...(hunt.nodes ?? []).map(node => node.yield.materialId),
      ...hunt.drops.entries.flatMap(entry => (entry.kind === 'material' ? [entry.material] : [])),
    ],
  }));
  const out: FolkLine[] = [];
  const seen = new Set<string>();
  for (let k = 0; pools.some(pool => k < pool.ids.length); k++) {
    for (const pool of pools) {
      const id = pool.ids[k];
      if (id && !seen.has(id)) { seen.add(id); out.push({ material: id, place: pool.place }); }
    }
  }
  return out;
}

/** Yield distance: a townsperson walking toward the player stops this close. */
export const TOWNSFOLK_YIELD = 56;
/**
 * Elbow room: a townsperson standing closer than this to the Keeper (the Keeper
 * arrived on top of them, or spawned there) walks off to the far side, so no
 * figure ever stands behind the Keeper and reads as a dark shape on the body.
 */
export const TOWNSFOLK_CLEAR = 50;

/**
 * Two to four wanderers. Each owns one open-floor segment and drifts between
 * random points in it with pauses. Deterministic for a given seed. All state
 * is allocated in the constructor; `update` only mutates numbers.
 */
export class TownsfolkCrowd {
  readonly folk: Townsperson[] = [];
  private rng: number;
  constructor(town: TownDef, placements: readonly KeeperPlacement[], seed = 0x7a11) {
    this.rng = (seed ^ hashString(town.id)) >>> 0 || 1;
    const segments = wanderSegments(town, placements);
    const count = Math.min(TOWNSFOLK_MAX, TOWNSFOLK_COUNT[town.realm] ?? 0);
    if (!segments.length) return;
    // Spread the crowd: longest segments first, wrapping if there are fewer segments than people.
    const order = segments.slice().sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
    const palettes = REALM_PALETTES[town.realm];
    const shapes: LifeSilhouette[] = ['robe', 'coat', 'hood', 'robe'];
    const lines = townsfolkLines(town);
    for (let i = 0; i < count; i++) {
      const [lo, hi] = order[i % order.length];
      const x = lo + this.random() * (hi - lo);
      this.folk.push({
        x, facing: this.random() < .5 ? -1 : 1, lo, hi, target: x, speed: 28 + this.random() * 18,
        pause: .5 + this.random() * 3, step: this.random() * 6, build: .85 + this.random() * .15, seed: this.random() * 10,
        palette: palettes[(i + 1) % palettes.length], silhouette: shapes[i % shapes.length],
        says: lines.length ? lines[i % lines.length] : null, def: { lines: lines.length ? [TOWNSFOLK_LINE] : [] },
      });
    }
  }
  /** One fixed step. `playerX` lets walkers yield to the Keeper rather than walk through them. */
  update(dt: number, playerX: number): void {
    for (const p of this.folk) {
      if (p.pause > 0) {
        if (Math.abs(playerX - p.x) < TOWNSFOLK_CLEAR && this.stepAside(p, playerX)) continue;
        p.pause -= dt;
        if (p.pause <= 0) {
          p.pause = 0;
          p.target = p.lo + this.random() * (p.hi - p.lo);
        }
        continue;
      }
      const dx = p.target - p.x;
      const dir = dx > 0 ? 1 : -1;
      const ahead = (playerX - p.x) * dir;
      if (!p.passing && ahead > 0 && ahead < TOWNSFOLK_YIELD) { p.facing = dir; p.pause = .8 + this.random() * 1.2; continue; }
      const move = p.speed * dt;
      if (Math.abs(dx) <= move) { p.x = p.target; p.pause = 1.5 + this.random() * 4.5; p.passing = false; }
      else { p.x += dir * move; p.facing = dir; p.step += dt * p.speed / 9; }
      // Hard bounds: whatever happens, never leave the segment.
      if (p.x < p.lo) p.x = p.lo; else if (p.x > p.hi) p.x = p.hi;
    }
  }
  /**
   * Walk off to the side away from the Keeper; when that side of the segment is
   * too short (a stall or a keeper is right there), pass behind the Keeper to the
   * other side instead.
   */
  private stepAside(p: Townsperson, playerX: number): boolean {
    const away = p.x >= playerX ? 1 : -1;
    const reach = TOWNSFOLK_CLEAR + 30 + this.random() * 40;
    for (const side of [away, -away]) {
      const target = Math.min(p.hi, Math.max(p.lo, playerX + side * reach));
      if (Math.abs(target - playerX) < TOWNSFOLK_CLEAR) continue;
      p.pause = 0; p.target = target; p.passing = side !== away;
      return true;
    }
    return false;
  }
  /** mulberry32 on a number field: no allocation. */
  private random(): number {
    let t = (this.rng = (this.rng + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// ── Chatter ─────────────────────────────────────────────────────────────────

/** Walk within this of a keeper and it speaks. */
export const CHATTER_NEAR = 170;
/** Walk this far away before the same keeper can greet again. */
export const CHATTER_FAR = 300;
/** And never more often than this, seconds. */
export const CHATTER_COOLDOWN = 20;
/** How long a line stays up, seconds. */
export const CHATTER_SHOW = 5.5;
/** A keeper turns to face the Keeper within this distance. */
export const FACE_RANGE = 320;

/**
 * Which keeper greets the Keeper this step. One line per approach: a keeper
 * speaks on entering `CHATTER_NEAR`, then not again until the Keeper has left
 * `CHATTER_FAR` and `CHATTER_COOLDOWN` has passed. Lines rotate per keeper.
 * Allocation-free after construction.
 */
export class KeeperChatter {
  private readonly armed: Uint8Array;
  private readonly lastAt: Float64Array;
  private readonly said: Uint16Array;
  /** The keeper speaking now (-1 none), its line key and when it started. */
  speaker = -1;
  line = '';
  at = 0;
  /** Keepers, or townsfolk: anything with a live `x` and lines. */
  constructor(private readonly placements: readonly { x: number; def: { lines: readonly string[] } }[]) {
    this.armed = new Uint8Array(placements.length).fill(1);
    this.lastAt = new Float64Array(placements.length).fill(-Infinity);
    this.said = new Uint16Array(placements.length);
  }
  /** A keeper's pool changed: its next greeting starts from the top of the new pool. */
  restart(i: number): void { if (i >= 0 && i < this.said.length) this.said[i] = 0; }
  /** Returns the index of a keeper that just started speaking, or -1. */
  update(playerX: number, time: number): number {
    if (this.speaker >= 0 && time - this.at > CHATTER_SHOW) this.speaker = -1;
    let started = -1;
    for (let i = 0; i < this.placements.length; i++) {
      const distance = Math.abs(this.placements[i].x - playerX);
      if (distance > CHATTER_FAR) { this.armed[i] = 1; continue; }
      if (!this.armed[i] || distance > CHATTER_NEAR || time - this.lastAt[i] < CHATTER_COOLDOWN) continue;
      const lines = this.placements[i].def.lines;
      if (!lines.length) continue;
      this.armed[i] = 0; this.lastAt[i] = time;
      this.line = lines[this.said[i] % lines.length]; this.said[i]++;
      this.speaker = i; this.at = time; started = i;
    }
    return started;
  }
}
