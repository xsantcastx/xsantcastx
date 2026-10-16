/**
 * slate.model.ts — the Mirror Slate's rules, pure (docs/handoff/mirror-slate.md).
 *
 *  - Tier: which pane the Keeper holds (slate-items.model.ts). The tier II pane
 *    wins; holding none is tier 0 and the HUD shows no Slate.
 *  - Acquisition: Lune Coyne hands it over once `MIRROR_SLATE.awardPlays` plays
 *    are on the games ledger across her four tables (the same `totals` the
 *    tables keep, so a play made on the Slate counts exactly like one at the
 *    stall), or sells it for `MIRROR_SLATE.price`.
 *  - The busy rule: the Slate never opens on a fallen Keeper, with a creature in
 *    reach (the enemy bar is up), or during a mini-game (a fishing line out, the
 *    Line Tension reel, a story card). The world pauses while it is open, so a
 *    fight cannot start under it.
 *  - The badge: something on the Homestead worth a look (an explorer home, a
 *    rune found, or ten minutes of income piled up since the last look).
 *
 * No Angular. Karma covers it (slate.model.spec.ts).
 */
import { MIRROR_SLATE } from '../economy/economy-curve';
import { MIRROR_SLATE_ID, MIRROR_SLATE_II_ID, SLATE_UPGRADE_INPUTS } from './slate-items.model';

export type SlateTier = 0 | 1 | 2;

/** The four tables, in the order they stand east of Lune Coyne. `panel` is the PanelId the Slate embeds. */
export const SLATE_TABLES = [
  { game: 'reels', panel: 'reels', titleKey: 'slate.table.reels' },
  { game: 'rune-drop', panel: 'rune-drop', titleKey: 'slate.table.runeDrop' },
  { game: 'seam-sweeper', panel: 'seam-sweeper', titleKey: 'slate.table.seamSweeper' },
  { game: 'eclipse-ascent', panel: 'eclipse-ascent', titleKey: 'slate.table.ascent' },
] as const;
/**
 * The machines that live in the glass (docs/handoff/eclipse-cascade.md): the
 * Eclipse Cascade (every Slate, beside the Reels) and the realm machines a
 * Keeper has found in the world (`found`: only once the games ledger says so).
 * Not Lune's four tables: they do not count toward her gift.
 */
export const SLATE_MACHINES = [
  { game: 'eclipse-cascade', titleKey: 'slate.table.cascade', found: false },
  { game: 'orrery-tumbler', titleKey: 'slate.table.tumbler', found: true },
] as const;
export type SlateMachineGame = (typeof SLATE_MACHINES)[number]['game'];
/** The machines on the glass for a Keeper who has found `found(id)`. */
export function slateMachines(found: (id: string) => boolean): (typeof SLATE_MACHINES)[number][] {
  return SLATE_MACHINES.filter(m => !m.found || found(m.game));
}
export type SlateTableGame = (typeof SLATE_TABLES)[number]['game'] | SlateMachineGame;
export const SLATE_TABLE_GAMES: readonly string[] = SLATE_TABLES.map(t => t.game);

/** The stations whose panel shows Lune's offer (her own counter and her four tables). */
export const CROUPIER_STATIONS: readonly string[] = ['gambler', ...SLATE_TABLE_GAMES];
/** Kael's station: the Rune Forge in the Basalt Seamworks. */
export const KAEL_STATION = 'runes';

/**
 * The Slate's tabs at a tier. Tier II adds the map and the bounties. The Scan
 * (the Lost Cabinets, shared/cabinets) is on the FIRST face: it is the Archive's
 * moon-mirror glass that knows the cabinets' latches, not Kael's brass, so every
 * Slate can hold it up.
 */
export type SlateTab = 'tables' | 'factory' | 'map' | 'scan';
export function slateTabs(tier: SlateTier): SlateTab[] {
  if (tier <= 0) return [];
  return tier >= 2 ? ['tables', 'factory', 'map', 'scan'] : ['tables', 'factory', 'scan'];
}

/** Which pane the Keeper holds. `qty` reads a stack total (satchel or Vault: the Keeper owns it either way). */
export function slateTier(qty: (stackKey: string) => number): SlateTier {
  if (qty(MIRROR_SLATE_II_ID) > 0) return 2;
  if (qty(MIRROR_SLATE_ID) > 0) return 1;
  return 0;
}

/** Plays at Lune's four tables, from the games ledger's per-game totals. */
export function tablesPlayed(plays: (game: string) => number): number {
  let n = 0;
  for (const game of SLATE_TABLE_GAMES) n += Math.max(0, Math.floor(plays(game) || 0));
  return n;
}

/** Lune hands the Slate over: the Keeper holds none and has played enough. */
export function slateAwardDue(tier: SlateTier, played: number): boolean {
  return tier === 0 && played >= MIRROR_SLATE.awardPlays;
}

/** What Lune's counter shows. */
export interface SlateOffer {
  tier: SlateTier;
  played: number;
  /** Plays still to go before she hands it over (0 once due or owned). */
  toGo: number;
  price: number;
  affordable: boolean;
}
export function slateOffer(tier: SlateTier, played: number, gold: number): SlateOffer {
  return {
    tier, played,
    toGo: tier > 0 ? 0 : Math.max(0, MIRROR_SLATE.awardPlays - played),
    price: MIRROR_SLATE.price,
    affordable: gold >= MIRROR_SLATE.price,
  };
}

/** What Kael's binding still needs, per input (the tier I pane first). */
export interface SlateNeed { id: string; need: number; have: number }
export function slateUpgradeNeeds(qty: (stackKey: string) => number): SlateNeed[] {
  return SLATE_UPGRADE_INPUTS.map(input => ({ id: input.id, need: input.count, have: Math.max(0, qty(input.id)) }));
}
export function slateUpgradeReady(qty: (stackKey: string) => number): boolean {
  return slateTier(qty) === 1 && slateUpgradeNeeds(qty).every(row => row.have >= row.need);
}

/** Why the Slate will not open right now, or null when it may. */
export type SlateRefusal = 'unowned' | 'fallen' | 'fight' | 'game';
export interface SlateMoment {
  tier: SlateTier;
  /** The Keeper is down. */
  defeated: boolean;
  /** The enemy bar's reading: above 0 while a creature is in reach. */
  enemyHp: number;
  /** A fishing line is in the water (waiting, a bite, hooked). */
  fishing: boolean;
  /** The Line Tension reel is up. */
  reeling: boolean;
  /** A story card is on screen. */
  storyCard: boolean;
}
export function slateRefusal(m: SlateMoment): SlateRefusal | null {
  if (m.tier <= 0) return 'unowned';
  if (m.defeated) return 'fallen';
  if (m.enemyHp > 0) return 'fight';
  if (m.fishing || m.reeling || m.storyCard) return 'game';
  return null;
}

/** Seconds of income piled up on the Homestead receipt that light the badge. */
export const SLATE_BADGE_INCOME_S = 600;
/** The Homestead has something worth a look: an explorer home, a rune found, or ten minutes of income waiting. */
export function slateBadge(pending: { gold: number; runes: number; returns: number }, perSecond: number): boolean {
  if (pending.returns > 0 || pending.runes > 0) return true;
  return perSecond > 0 && pending.gold >= perSecond * SLATE_BADGE_INCOME_S;
}

/** The world's own stations the Slate points at instead of opening (places stay places). */
export const SLATE_WORLD_POINTERS: readonly { key: string }[] = [
  { key: 'slate.walk.crafting' },
  { key: 'slate.walk.market' },
  { key: 'slate.walk.vendor' },
  { key: 'slate.walk.sanctum' },
];
