/**
 * world-protocol.ts — the room-run world (Hearth protocol 7; docs/design/online.md "Phase 8: the room simulates").
 *
 * In a world area (the starting island first, WORLD_AREAS) the room itself is the host: it simulates the creatures
 * (play/world/room-world.ts, the game's own MobSystem run on the server), streams them as the same `coop-snap` a party
 * host sends (coop-protocol.ts) from the reserved host id ROOM_HOST, takes the Keepers' blows as the same `coop/hits`
 * claims, rolls the loot of every kill once, and owns what lies on the ground. Clients send intents only (move,
 * attack, take); the room validates each one. Pure: no Angular, no DOM, no engine.
 */

/** The protocol the room-run world arrives with (scripts/social-server.mjs PROTOCOL). */
export const WORLD_PROTOCOL = 7;
/** The host id the room uses for itself (never a player's: player ids are UUIDs). */
export const ROOM_HOST = '@room';
/** The areas the room runs for a protocol 7/8 client (M1: the Seamworks island's surface only). Protocol 9 (M3): every
 * continent and every floor (room-world.ts WORLD_AREAS_ALL, kept there: it reads the levels' tables). */
export const WORLD_AREAS: readonly string[] = ['ember-isle'];

/** How far from where the room last saw a Keeper a ground item may be taken (art px): the coin magnet's 8 tiles + slack. */
export const TAKE_REACH = 160;
/** How long the Keepers who fought a creature keep its loot to themselves (ms), Tibia's protection; then anyone may. */
export const OWN_MS = 20000;
/** How long loot lies before it crumbles (ms): the same five minutes as a drop of one's own (td-mobs DESPAWN). */
export const GROUND_MS = 300000;

/** One item on the room's ground, as the wire carries it (and as a ground take hands it over). */
export interface WorldDrop {
  /** `td:<level>:w.<area>.<boot>.<n>`: 'surface', or a floor's id (grave-goods dropLevel reads the level from it). */
  id: string;
  x: number; y: number;
  /** The creature (its wire id) whose loot it was; its corpse lists it. */
  m?: string;
  coins: number;
  material?: string;
  qty: number;
  item?: { definitionId: string; rarity: string; unique: boolean; level?: number };
  rune?: string;
  rarity?: string;
  label: string;
  color: string;
  /** Who may take it now (the Keepers who fought), and in how many ms anyone may (0: anyone now). */
  own: string[];
  free: number;
}
/** `world-ground`: the whole list when a stream opens or a Keeper enters the area, else what came and went. */
export interface WorldGroundMsg { area: string; items?: WorldDrop[]; add?: WorldDrop[]; gone?: string[] }
/** A take's answer: the loot to grant (the client mints it as any pickup), or why not. */
export type WorldTakeResult =
  | { ok: true; drop: WorldDrop; ms?: number; /** Protocol 10: the room pays its Gold (the screen asks, never credits it). */ pays?: true }
  | { ok: false; why: 'gone' | 'far' | 'owned' | 'area' | 'busy' | 'offline' };

/** Is this an id the room would hand out? (The client refuses anything else before asking.) */
export const WORLD_DROP_ID = /^td:[a-z0-9-]{1,40}:w\.[a-z0-9_-]{1,40}\.[a-z0-9]{1,12}\.[a-z0-9]{1,12}$/;

/**
 * Protocol 10 (M4 of the room-run world; docs/design/online.md §4d "M4"): the room lays a Keeper's statuses on its
 * creatures (play/world/room-status.ts), tells it which claims it refused, keeps its life (play/world/keeper-life.ts),
 * and — signed in — pays its Hunting XP and hunt Gold itself (play/world/room-credit.ts).
 */
export const LIFE_PROTOCOL = 10;
/** A credit the screen asks the room for: the owed id (a kill's `cr`, a ground piece's id) and its own number. */
export interface WorldCreditAsk { id: string; n: number; s?: 1 }
/** The room paid (or could not pay) a batch: what it paid, what the debt took, which ids. */
export interface WorldCreditMsg { ok: boolean; xp: number; gold: number; debt: number; ids: string[]; why?: string }
