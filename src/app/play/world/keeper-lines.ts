/**
 * keeper-lines.ts: what each town keeper says, and when. World & cast S3, the
 * NPC depth pass (docs/world/world-and-cast.md §3, docs/handoff/npc-depth.md).
 *
 * Every keeper has a pool of four to eight lines. Some are always there (who
 * they are, who they argue with); the rest open as the Keeper's story moves on
 * (a story beat in `godforge-story`, shared/story) or as the Keeper does the
 * thing that keeper's station is for (a first craft at Mara's bench, a first
 * sale across Edrin's scales). A line gated on a beat is only ever said once
 * that beat has been reached, so nobody spoils what the Keeper has not lived.
 *
 * Order matters: the newest thing a keeper has to say comes first. On each
 * approach a keeper says one line (life.ts KeeperChatter: greet once, rearm
 * after 300 px and 20 s), and when its pool changes it starts again from the
 * top, so the line about what you just did is the next thing it says.
 *
 * Words live in life.i18n.ts as `play.life.line.<keeper>.<n>` (EN + ES). Canon
 * keepers (Kael, the Merchant, Aureth, Verrin, the Archivist) still only say
 * lines from DIALOGUE in npc.model.ts; the engine harness checks every line
 * here, gated or not.
 *
 * Pure: no Angular, no DOM. The node harness loads it.
 */
import { STORY_BEAT_IDS, type StoryBeatId } from '../../shared/story/story-save.model';

/**
 * Things the Keeper has done at a station, read off the save by the play view
 * (side-scroller `keeperDeeds`). Each opens one line at the keeper who runs it.
 */
export const KEEPER_DEEDS = [
  /** Anything forged at the Crafting Bench. */
  'crafted',
  /** Anything sold back (the Buyback counter, the house). */
  'sold',
  /** Anything resting in the Vault. */
  'vaulted',
  /** The Rune Forge anvil struck. */
  'struck',
  /** A rune set in a socket. */
  'socketed',
  /** A Homestead building bought. */
  'bought',
  /** A creature felled on the roads. */
  'hunted',
  /** The Ember Delve dug. */
  'dug',
  /** Any skill at level 10. */
  'skilled',
  /** A fish landed. */
  'fished',
  /** A Delve order claimed off the Quest Board. */
  'mission',
  /** One of the Board Herald's daily bounties claimed (shared/bounties). */
  'bountied',
  /** The Mirror Slate carried (shared/slate): Lune handed it over or sold it. */
  'slated',
  /** Enough Gold earned to move on the renown chart (RENOWN_GOLD). */
  'renown',
] as const;
export type KeeperDeed = (typeof KEEPER_DEEDS)[number];

/** Lifetime Gold earned that counts as a first move on Nox Aster's chart. */
export const RENOWN_GOLD = 10_000;

/** What the save says, gathered by the play view; `keeperDeeds` turns it into deeds. */
export interface DeedFacts {
  /** Smithing XP, or the Basalt Edge forged. */
  forged: boolean;
  /** Items sold back, ever (InventorySnapshot.sold). */
  sold: number;
  /** Instances resting in the Vault. */
  inVault: number;
  /** Anvil strikes thrown by the Keeper (EconomySnapshot.totalClicks). */
  strikes: number;
  /** Any held item with a rune in a socket. */
  socketed: boolean;
  bought: boolean;
  hunted: boolean;
  dug: boolean;
  /** The highest level across the skills. */
  topSkill: number;
  /** Fishing XP. */
  fished: boolean;
  /** Any Delve mission claimed. */
  mission: boolean;
  /** Any Board Herald bounty claimed. Absent: none. */
  bountied?: boolean;
  /** The Mirror Slate held (either tier). Absent: none. */
  slated?: boolean;
  /** Gold earned, ever. */
  goldEarned: number;
}

/** Which station deeds the save shows, in KEEPER_DEEDS order. Pure. */
export function keeperDeeds(f: DeedFacts): KeeperDeed[] {
  const done: Record<KeeperDeed, boolean> = {
    crafted: f.forged, sold: f.sold > 0, vaulted: f.inVault > 0, struck: f.strikes > 0, socketed: f.socketed,
    bought: f.bought, hunted: f.hunted, dug: f.dug, skilled: f.topSkill >= 10, fished: f.fished, mission: f.mission, bountied: !!f.bountied, slated: !!f.slated,
    renown: f.goldEarned >= RENOWN_GOLD,
  };
  return KEEPER_DEEDS.filter(deed => done[deed]);
}

/** What a keeper's pool is filtered by. */
export interface KeeperContext {
  beats: ReadonlySet<string>;
  deeds: ReadonlySet<string>;
}
export const EMPTY_KEEPER_CONTEXT: KeeperContext = { beats: new Set(), deeds: new Set() };

/** One line: its number (`play.life.line.<keeper>.<n>`), and what opens it (nothing = always). */
export interface KeeperLine {
  n: number;
  beat?: StoryBeatId;
  deed?: KeeperDeed;
}

const L = (n: number, open: { beat?: StoryBeatId; deed?: KeeperDeed } = {}): KeeperLine => ({ n, ...open });

/** Every keeper's pool, in the order it is said when nothing new has happened. */
export const KEEPER_LINES: Readonly<Record<string, readonly KeeperLine[]>> = {
  // ── Infernal: Basalt Seamworks ──
  'vault-clerk': [L(1), L(2), L(3), L(4, { deed: 'vaulted' }), L(5), L(6, { beat: 'a1.tally' }), L(7), L(8, { beat: 'a2.furnace' })],
  'buyback-clerk': [L(1), L(2), L(3), L(4, { deed: 'sold' }), L(5), L(6, { deed: 'hunted' }), L(7, { beat: 'a1.eater' }), L(8, { beat: 'a1.break' })],
  'bench-smith': [L(1), L(2), L(3), L(4, { deed: 'crafted' }), L(5), L(6, { beat: 'p.edge' }), L(7, { beat: 'a1.hammer' }), L(8, { beat: 'a1.break' })],
  kael: [L(1), L(2), L(3, { deed: 'slated' }), L(4, { deed: 'struck' }), L(5, { beat: 'p.words' }), L(6, { beat: 'a1.hammer' }), L(7, { beat: 'a1.break' }), L(8)],
  enchanter: [L(1), L(2), L(3), L(4, { deed: 'socketed' }), L(5), L(6), L(7, { beat: 'p.words' })],
  // ── Luminous: Heliograph Court ──
  merchant: [L(1), L(2), L(3), L(4, { deed: 'bought' }), L(5), L(6, { beat: 'a1.prices' }), L(7, { beat: 'a1.break' }), L(8)],
  aureth: [L(1), L(2), L(3), L(4, { deed: 'bought' }), L(5), L(6), L(7, { beat: 'a1.break' }), L(8, { beat: 'a2.prism' })],
  tomas: [L(1), L(2), L(3), L(4), L(5, { beat: 'a1.fresh' }), L(6, { beat: 'a1.break' }), L(7, { beat: 'a2.lamp' })],
  ilyra: [L(1), L(2), L(3), L(4), L(5, { beat: 'p.words' }), L(6, { beat: 'a1.dated' }), L(7), L(8, { beat: 'a2.prism' })],
  // ── Umbral: Nocturne Archive ──
  croupier: [L(1), L(2), L(3), L(4, { deed: 'sold' }), L(5), L(6), L(7), L(8, { deed: 'slated' })],
  broker: [L(1), L(2), L(3), L(4), L(5), L(6, { deed: 'sold' }), L(7, { beat: 'a1.prices' }), L(8, { beat: 'a1.break' })],
  verrin: [L(1), L(2), L(3), L(4, { beat: 'a1.tally' }), L(5), L(6, { beat: 'a1.eater' }), L(7), L(8, { beat: 'a2.ink' })],
  rook: [L(1), L(2), L(3), L(4, { deed: 'dug' }), L(5, { beat: 'a1.tally' }), L(6), L(7, { beat: 'a2.ink' })],
  // ── Celestial: Meridian Orrery ──
  archivist: [L(1), L(2), L(3), L(4, { beat: 'p.words' }), L(5), L(6, { beat: 'a1.dated' }), L(7), L(8, { beat: 'a2.cabinets' })],
  'chart-clerk': [L(1), L(2), L(3), L(4), L(5, { deed: 'renown' }), L(6), L(7, { beat: 'a1.break' }), L(8, { beat: 'a2.orrery' })],
  sera: [L(1), L(2), L(3), L(4), L(5, { beat: 'a1.break' }), L(6, { beat: 'a2.orrery' }), L(7, { beat: 'a2.lamp' })],
  // ── Verdant: Rootglass Canopy ──
  steward: [L(1), L(2), L(3), L(4), L(5, { deed: 'hunted' }), L(6), L(7, { beat: 'a1.eater' }), L(8, { beat: 'a2.root' })],
  herald: [L(1), L(2), L(3), L(4, { deed: 'mission' }), L(5, { beat: 'a1.break' }), L(6), L(7, { beat: 'a1.eater' }), L(8, { deed: 'bountied' })],
  gatekeeper: [L(1), L(2), L(3), L(4, { deed: 'hunted' }), L(5), L(6)],
  'trials-warden': [L(1), L(2), L(3), L(4), L(5, { beat: 'a1.eater' }), L(6), L(7)],
  'lodge-warden': [L(1), L(2), L(3), L(4), L(5, { deed: 'skilled' }), L(6, { deed: 'fished' }), L(7), L(8, { beat: 'a2.root' })],
};

export function lineKey(keeper: string, n: number): string { return `play.life.line.${keeper}.${n}`; }

/** Every line a keeper can ever say (i18n keys), for the gates and the harness. */
export function allKeeperLines(keeper: string): string[] {
  return (KEEPER_LINES[keeper] ?? []).map(line => lineKey(keeper, line.n));
}

export function lineOpen(line: KeeperLine, ctx: KeeperContext): boolean {
  return (!line.beat || ctx.beats.has(line.beat)) && (!line.deed || ctx.deeds.has(line.deed));
}

/** How recent a line's trigger is: a later story beat beats an earlier one, any beat beats a deed, a deed beats nothing. */
function recency(line: KeeperLine): number {
  if (line.beat) return 100 + STORY_BEAT_IDS.indexOf(line.beat);
  return line.deed ? 1 : 0;
}

/**
 * The keeper's pool for this Keeper, as i18n keys: the open lines, the most
 * recently opened first, then the always-there lines in their own order. Never
 * a line whose beat or deed has not happened. Pure.
 */
export function keeperLines(keeper: string, ctx: KeeperContext = EMPTY_KEEPER_CONTEXT): string[] {
  return (KEEPER_LINES[keeper] ?? [])
    .filter(line => lineOpen(line, ctx))
    .map((line, i) => ({ line, i }))
    .sort((a, b) => recency(b.line) - recency(a.line) || a.i - b.i)
    .map(({ line }) => lineKey(keeper, line.n));
}
