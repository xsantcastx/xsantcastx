/**
 * explorer-archetypes.ts — the eighteen people who will walk for you.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS REPLACES, AND WHY
 * ─────────────────────────────────────────────────────────────────────────────
 * `rollExplorerName` generated a name out of 24 × 24 stems, which is 576
 * combinations and reads, correctly, as 576 combinations. Two explorers of the
 * same tier were the same explorer with a different label: identical speed,
 * identical slots, identical everything. A roster is a collection or it is a
 * quantity, and a generated name makes it a quantity.
 *
 * So the roster is now a *cast*. Eighteen written people, each minted at most
 * once per save, each with a realm they are better in, a trait that bends their
 * missions, and one passive nobody else has. Finding Whisper of Nox is finding
 * Whisper of Nox — not "a legendary", of which there could be four.
 *
 * The generator stays, and is not dead code: it is the fallback for a roster
 * that has already claimed every archetype of a rolled tier. Eighteen is a
 * ceiling on *distinct* people, not on hires, and a player who has them all and
 * rolls another Rare should get somebody rather than nothing. See
 * `pickArchetype`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THERE IS NO SINGULAR TIER, DESPITE THE CAST HAVING A CAPSTONE
 * ─────────────────────────────────────────────────────────────────────────────
 * `explorer-roster.model.ts` argues, and is right, that Singular belongs to the
 * Void — one rune, the thing the realms were carved out of — and that a person
 * cannot be that. Adding a seventh explorer tier to give the capstone somewhere
 * to live would mean a speed below Mythic's 0.1, which is a mission that
 * resolves in under a minute: not a prize, just the mechanic switched off.
 *
 * So the Nameless Scout is a Mythic, and what makes them singular is their
 * *source*: `capstone`, reachable only by finishing the Collection Log. Every
 * archetype here is already one-of-one within a save. The capstone is one-of-one
 * and cannot be rolled for at any odds, which is a stronger claim than a tier
 * label would have been.
 *
 * Pure data. No browser APIs.
 */
import { RealmId } from '../realms/realm.model';
import { ExplorerRarity } from './explorer-roster.model';

// ─────────────────────────────────────────────────────────────────────────────
// Traits
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How this person works, as one of six dispositions.
 *
 * A trait is a *bend*, not a bonus: every one of them gives something and four
 * of the six quietly cost something, so "Brave" is a real choice against
 * "Cautious" rather than a strictly better word. The numbers are small — none
 * moves a payout by more than a quarter — because the tier ladder is still the
 * decision that matters most and a trait that doubled anything would collapse
 * the roster back into "field whoever is Lucky".
 */
export type ExplorerTraitId =
  | 'brave' | 'cautious' | 'lucky' | 'tireless' | 'keen' | 'scholar';

export interface ExplorerTrait {
  id: ExplorerTraitId;
  label: string;
  /** One line, printed on the card under their name. */
  blurb: string;
  /** Multiplies mission duration. Below 1 is faster. */
  speed: number;
  /** Multiplies Gold. */
  gold: number;
  /** Multiplies XP. */
  xp: number;
  /** Multiplies the rune drop gate. */
  rune: number;
  /** Added to their Magic Find, in percentage points. */
  loot: number;
  /** Multiplies the material band. */
  materials: number;
}

export const EXPLORER_TRAITS: Record<ExplorerTraitId, ExplorerTrait> = {
  brave: {
    id: 'brave', label: 'Brave',
    blurb: 'Goes in fast and does not stop to check the walls.',
    speed: 0.85, gold: 1.0, xp: 1.0, rune: 0.9, loot: 0, materials: 1.0,
  },
  cautious: {
    id: 'cautious', label: 'Cautious',
    blurb: 'Slower, and comes back with the thing that was actually worth taking.',
    speed: 1.1, gold: 1.0, xp: 1.0, rune: 1.15, loot: 20, materials: 1.0,
  },
  lucky: {
    id: 'lucky', label: 'Lucky',
    blurb: 'Nobody has worked out how. Nobody is asking too loudly.',
    speed: 1.0, gold: 1.05, xp: 1.0, rune: 1.3, loot: 10, materials: 1.0,
  },
  tireless: {
    id: 'tireless', label: 'Tireless',
    blurb: 'Carries more than is reasonable and complains about none of it.',
    speed: 1.0, gold: 1.25, xp: 0.9, rune: 1.0, loot: 0, materials: 1.15,
  },
  keen: {
    id: 'keen', label: 'Keen',
    blurb: 'Reads a seam the way other people read a signpost.',
    speed: 1.05, gold: 0.95, xp: 1.0, rune: 1.0, loot: 5, materials: 1.5,
  },
  scholar: {
    id: 'scholar', label: 'Scholar',
    blurb: 'Half the expedition is written up before they are home.',
    speed: 1.05, gold: 0.9, xp: 1.5, rune: 1.05, loot: 5, materials: 1.0,
  },
};

export function traitOf(id: ExplorerTraitId | undefined): ExplorerTrait | undefined {
  return id ? EXPLORER_TRAITS[id] : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Passives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The one thing this person does that nobody else does.
 *
 * A discriminated union rather than free text, because a passive written only
 * as a sentence is a passive that never gets wired: the card promises "doubles
 * Umbral materials" and the settlement has no idea. Every kind here is read by
 * `explorer-bonus.ts` and applied at dispatch or at settlement, so the sentence
 * on the card and the arithmetic in the payout cannot drift apart.
 *
 * `magnitude` is scaled by level — see `PASSIVE_UPGRADE_LEVEL` — which is what
 * makes levelling an explorer feel like it is levelling *them* rather than a
 * shared stat block.
 */
export type ExplorerPassiveKind =
  /** Multiplies Gold, but only in `realm`. */
  | 'realm-gold'
  /** Multiplies the rune gate, but only in `realm`. */
  | 'realm-rune'
  /** Multiplies the material band, but only in `realm`. */
  | 'realm-materials'
  /** Multiplies Gold everywhere. */
  | 'gold'
  /** Multiplies XP everywhere. */
  | 'xp'
  /** Multiplies mission duration everywhere. Below 1 is faster. */
  | 'speed'
  /** Adds flat Magic Find, in percentage points. */
  | 'magic-find'
  /** Guarantees at least one rune on every return. */
  | 'never-empty'
  /** Raises the rune floor by `magnitude` tiers, deep sites included. */
  | 'rune-floor'
  /** Adds `magnitude` extra table rolls on every return. */
  | 'extra-slot';

export interface ExplorerPassive {
  kind: ExplorerPassiveKind;
  /**
   * The size of the effect, read per kind: a multiplier for the scaling kinds,
   * percentage points for `magic-find`, a whole count for `rune-floor` and
   * `extra-slot`, and ignored entirely by `never-empty`.
   */
  magnitude: number;
  /** Only for the three `realm-*` kinds. */
  realm?: RealmId;
  /** How it reads on the card. Written to match the arithmetic exactly. */
  text: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// The cast
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How an archetype is reached.
 *
 * The player-facing half of rarity. Two Legendaries with the same odds are the
 * same find; a Legendary that only ever comes out of the Abyss is a *place you
 * went*, and that is the difference between a drop and a story.
 */
export type ExplorerSource =
  /** Handed over on the first visit. */
  | 'starter'
  /** Any expedition can turn them up. */
  | 'expedition'
  /** Deep Dive or longer only. */
  | 'deep'
  /** Grand Expedition or the Abyss only. */
  | 'grand'
  /** The Abyss only. */
  | 'abyss'
  /** Bought in the Market. */
  | 'market'
  /**
   * Earned by running fifty expeditions in one realm.
   *
   * The design brief for this asked for "that realm's quest chain *and* fifty
   * runs". The quest chain half is not here, and deliberately: lore chapters in
   * this codebase are keyed to *tools*, not realms — there is no such thing as
   * a realm chapter to have finished — so wiring it would have meant either
   * inventing a second chapter system or, far worse, printing a requirement on
   * the card that nothing in the settlement ever checks. Fifty runs is the half
   * that is real, so fifty runs is what the card says.
   */
  | 'realm-mastery'
  /** The Collection Log, at 100%. One person, one path, no odds. */
  | 'capstone';

export interface ExplorerArchetype {
  id: string;
  name: string;
  /** The one-line who-they-are, shown when their card is open. */
  bio: string;
  rarity: ExplorerRarity;
  /**
   * The realm they are better in: +25% loot quality and a better rune rate,
   * applied by `explorerRealmAffinityBonus`.
   *
   * Absent on the two Commons and on the capstone — the Commons because a
   * starter with a home realm biases the very first dispatch a player makes
   * before they know what a realm is, and the capstone because being equally at
   * home everywhere is the point of them.
   */
  affinity?: RealmId;
  trait: ExplorerTraitId;
  passive: ExplorerPassive;
  source: ExplorerSource;
  /** Where they are found, in the player's words. Printed on the locked card. */
  sourceNote: string;
  /**
   * Art id, registered in `ART_PENDING` until the portraits are painted.
   *
   * Named rather than derived from `id` so a portrait can be re-pointed at a
   * shared painting without renaming the person.
   */
  artId: string;
}

export const EXPLORER_ARCHETYPES: readonly ExplorerArchetype[] = [
  // ── Common ────────────────────────────────────────────────────────────────
  {
    id: 'tobin-ashfoot',
    name: 'Tobin Ashfoot',
    bio: 'Swept the forge floor for eleven years and asked, once, whether the door went anywhere.',
    rarity: 'common', trait: 'brave',
    passive: { kind: 'gold', magnitude: 1.1, text: 'Comes back with a tenth more Gold than the ledger expects.' },
    source: 'starter',
    sourceNote: 'Already here. Was always going to be.',
    artId: 'explorer-tobin-ashfoot',
  },
  {
    id: 'marda-quell',
    name: 'Marda Quell',
    bio: 'Kept the Sanctum ledgers. Discovered she preferred the columns she had to walk to fill.',
    rarity: 'common', trait: 'scholar',
    passive: { kind: 'xp', magnitude: 1.15, text: 'Writes the run up on the way home. Everyone learns more.' },
    source: 'starter',
    sourceNote: 'Already here, and already filing.',
    artId: 'explorer-marda-quell',
  },

  // ── Uncommon ──────────────────────────────────────────────────────────────
  {
    id: 'ren-sixgate',
    name: 'Ren Sixgate',
    bio: 'Named for the six gates she walked through in one night, five of which were shut.',
    rarity: 'uncommon', affinity: 'verge', trait: 'brave',
    passive: { kind: 'speed', magnitude: 0.85, text: 'Finds the short way. Every mission runs 15% faster.' },
    source: 'expedition',
    sourceNote: 'Turns up on any expedition, if the realm is willing.',
    artId: 'explorer-ren-sixgate',
  },
  {
    id: 'callum-drossvane',
    name: 'Callum Drossvane',
    bio: 'Sorts slag by ear. Claims the good stuff rings a half-tone lower and has never been wrong.',
    rarity: 'uncommon', affinity: 'nexus', trait: 'keen',
    passive: { kind: 'realm-materials', magnitude: 2.0, realm: 'nexus', text: 'Doubles every material carried out of Nexus.' },
    source: 'expedition',
    sourceNote: 'Turns up on any expedition, usually in the yards.',
    artId: 'explorer-callum-drossvane',
  },
  {
    id: 'ilse-thornwake',
    name: 'Ilse Thornwake',
    bio: 'Walked into Verge to settle an argument and came out able to finish it in four languages.',
    rarity: 'uncommon', affinity: 'archivum', trait: 'scholar',
    passive: { kind: 'xp', magnitude: 1.35, text: 'Every return is a lesson. 35% more XP, everywhere.' },
    source: 'expedition',
    sourceNote: 'Turns up on any expedition. Reads the whole way in.',
    artId: 'explorer-ilse-thornwake',
  },
  {
    id: 'bracken-hale',
    name: 'Bracken Hale',
    bio: 'Carries a pack nobody else can lift and refuses, politely, to explain the arrangement.',
    rarity: 'uncommon', affinity: 'luminous', trait: 'tireless',
    passive: { kind: 'realm-gold', magnitude: 1.4, realm: 'luminous', text: 'Strips the Luminous halls for 40% more Gold.' },
    source: 'expedition',
    sourceNote: 'Turns up on any expedition, already loaded.',
    artId: 'explorer-bracken-hale',
  },

  // ── Rare ──────────────────────────────────────────────────────────────────
  {
    id: 'lyra-starwalker',
    name: 'Lyra the Starwalker',
    bio: 'Navigates by a constellation that is not in the Archive, and is never lost.',
    rarity: 'rare', affinity: 'archivum', trait: 'lucky',
    passive: { kind: 'realm-rune', magnitude: 2.0, realm: 'archivum', text: 'Doubles the rune rate in Archivum. She knows which shelf.' },
    source: 'deep',
    sourceNote: 'Deep Dive or longer. She does not answer short calls.',
    artId: 'explorer-lyra-starwalker',
  },
  {
    id: 'grimjaw-unyielding',
    name: 'Grimjaw the Unyielding',
    bio: 'Has been declared lost four times. Has been lost zero times.',
    rarity: 'rare', affinity: 'nexus', trait: 'tireless',
    passive: { kind: 'never-empty', magnitude: 1, text: 'Never returns empty-handed. At least one rune, every time.' },
    source: 'deep',
    sourceNote: 'Deep Dive or longer. Turns up already walking back.',
    artId: 'explorer-grimjaw-unyielding',
  },
  {
    id: 'seris-lowlantern',
    name: 'Seris Lowlantern',
    bio: 'Keeps the flame low so the dark stays legible. It is not a mood; it is a method.',
    rarity: 'rare', affinity: 'umbral', trait: 'cautious',
    passive: { kind: 'realm-rune', magnitude: 2.0, realm: 'umbral', text: 'Doubles the rune rate in Umbral. The vault opens for her.' },
    source: 'deep',
    sourceNote: 'Deep Dive or longer, and only below the last lamp.',
    artId: 'explorer-seris-lowlantern',
  },
  {
    id: 'oda-fairweather',
    name: 'Oda Fairweather',
    bio: 'Has survived three collapses, two floods and one gate. Attributes all five to timing.',
    rarity: 'rare', affinity: 'luminous', trait: 'lucky',
    passive: { kind: 'magic-find', magnitude: 60, text: 'Carries +60% Magic Find on every roll she makes.' },
    source: 'deep',
    sourceNote: 'Deep Dive or longer. Arrives at the right moment, as usual.',
    artId: 'explorer-oda-fairweather',
  },

  // ── Epic ──────────────────────────────────────────────────────────────────
  {
    id: 'whisper-of-nox',
    name: 'Whisper of Nox',
    bio: 'Speaks once per expedition, on return, and only to say what is in the bag.',
    rarity: 'epic', affinity: 'umbral', trait: 'cautious',
    passive: { kind: 'rune-floor', magnitude: 1, text: 'Every rune she finds is rolled one tier higher.' },
    source: 'grand',
    sourceNote: 'Grand Expedition or the Abyss. She chooses the length.',
    artId: 'explorer-whisper-of-nox',
  },
  {
    id: 'archivist-hollow',
    name: 'The Archivist Hollow',
    bio: 'Was a shelf number before they were a person. Still answers to it.',
    rarity: 'epic', affinity: 'archivum', trait: 'scholar',
    passive: { kind: 'extra-slot', magnitude: 1, text: 'Files an extra find on every return. One more roll at the table.' },
    source: 'market',
    sourceNote: 'Recruit them from the roster for 500,000 Gold. They have a price and they know it.',
    artId: 'explorer-archivist-hollow',
  },
  {
    id: 'veyra-sunder',
    name: 'Veyra Sunder',
    bio: 'Cut a thread once to see what was on the other side. The other side has not forgotten.',
    rarity: 'epic', affinity: 'nexus', trait: 'brave',
    passive: { kind: 'speed', magnitude: 0.7, text: 'Takes the cut line. Every mission runs 30% faster.' },
    source: 'grand',
    sourceNote: 'Grand Expedition or the Abyss. She is already on the line.',
    artId: 'explorer-veyra-sunder',
  },

  // ── Legendary ─────────────────────────────────────────────────────────────
  {
    id: 'hadrian-lastlight',
    name: 'Hadrian Lastlight',
    bio: 'The final survey of the Luminous halls has his signature on it. It is dated forward.',
    rarity: 'legendary', affinity: 'luminous', trait: 'tireless',
    passive: { kind: 'gold', magnitude: 1.75, text: 'Every haul is worth three quarters again. Everywhere.' },
    source: 'abyss',
    sourceNote: 'The Abyss only. Nothing shorter has ever found him.',
    artId: 'explorer-hadrian-lastlight',
  },
  {
    id: 'the-unaccounted',
    name: 'The Unaccounted',
    bio: 'Appears on no roster, draws no wage, and has completed more expeditions than anyone living.',
    rarity: 'legendary', affinity: 'verge', trait: 'lucky',
    passive: { kind: 'extra-slot', magnitude: 2, text: 'Comes back with two more finds than anyone sent them for.' },
    source: 'abyss',
    sourceNote: 'The Abyss only. Was possibly already down there.',
    artId: 'explorer-the-unaccounted',
  },
  {
    id: 'meren-of-the-quiet-ledger',
    name: 'Meren of the Quiet Ledger',
    bio: 'Keeps the only accurate count of what the realms have taken. Will not show it to you.',
    rarity: 'legendary', affinity: 'archivum', trait: 'cautious',
    passive: { kind: 'magic-find', magnitude: 150, text: 'Carries +150% Magic Find. She knows what the table is holding.' },
    source: 'realm-mastery',
    sourceNote: 'Fifty expeditions into Archivum. She is counting them too.',
    artId: 'explorer-meren-quiet-ledger',
  },

  // ── Mythic ────────────────────────────────────────────────────────────────
  {
    id: 'ashen-sovereign',
    name: 'The Ashen Sovereign',
    bio: 'Ruled something, once, that the Nexus has since delivered elsewhere in pieces.',
    rarity: 'mythic', affinity: 'nexus', trait: 'brave',
    passive: { kind: 'rune-floor', magnitude: 2, text: 'Every rune found is rolled two tiers higher. Nothing common survives them.' },
    source: 'realm-mastery',
    sourceNote: 'Fifty expeditions into Nexus. Something there is keeping score.',
    artId: 'explorer-ashen-sovereign',
  },
  {
    id: 'nameless-scout',
    name: 'The Nameless Scout',
    bio: 'Walked out of the first expedition ever dispatched and has been walking since. There is one.',
    rarity: 'mythic', trait: 'lucky',
    passive: { kind: 'extra-slot', magnitude: 3, text: 'Three finds nobody sent them for, on every single return.' },
    source: 'capstone',
    sourceNote: 'Complete the Collection Log. There is no other way, and no odds.',
    artId: 'explorer-nameless-scout',
  },
];

const ARCHETYPE_BY_ID = new Map(EXPLORER_ARCHETYPES.map(a => [a.id, a]));

export function archetypeById(id: string | undefined): ExplorerArchetype | undefined {
  return id ? ARCHETYPE_BY_ID.get(id) : undefined;
}

/** How many distinct people exist. The denominator on the roster's counter. */
export const ARCHETYPE_COUNT = EXPLORER_ARCHETYPES.length;

/** The two handed over on the first visit, in order. */
export const STARTER_ARCHETYPES = EXPLORER_ARCHETYPES.filter(a => a.source === 'starter');

/**
 * Which sources a mission of this depth can turn up.
 *
 * `deep`, `grand` and `abyss` are the mission flags the ladder already carries,
 * so this is a read of existing state rather than a fourth thing to keep in
 * sync. `market`, `realm-mastery` and `capstone` are never in here — those are
 * not drops, and a Market hire that could also fall out of a Scout would make
 * the 500,000 Gold price a mistake rather than a choice.
 */
export function sourcesForMission(opts: { deep: boolean; grand: boolean; abyss: boolean }): ExplorerSource[] {
  const sources: ExplorerSource[] = ['expedition'];
  if (opts.deep) sources.push('deep');
  if (opts.grand) sources.push('grand');
  if (opts.abyss) sources.push('abyss');
  return sources;
}

/**
 * Pick an unclaimed archetype of a rolled rarity, or null when the cast is out.
 *
 * Filters on rarity *and* on which sources this mission can reach, so a Rare
 * that only comes out of a Deep Dive cannot be handed over by a two-minute
 * Scout that happened to roll Rare — the odds table decides *how good*, the
 * source decides *who*, and both have to agree before anybody is hired.
 *
 * Returns null rather than falling back to a lower rarity: the caller
 * (`ExplorerRosterService.hire`) turns a null into a generated hire of that same
 * tier, which keeps the tier the roll actually produced. Silently downgrading
 * here would mean a Legendary roll quietly paying out an Epic, which is the
 * worst possible way to spend the rarest event in the game.
 */
export function pickArchetype(
  rarity: ExplorerRarity,
  claimed: ReadonlySet<string>,
  sources: readonly ExplorerSource[],
  rng: () => number = Math.random,
): ExplorerArchetype | null {
  const pool = EXPLORER_ARCHETYPES.filter(a =>
    a.rarity === rarity && !claimed.has(a.id) && sources.includes(a.source));
  if (!pool.length) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

/** Every archetype of a rarity, for the roster's locked silhouettes. */
export function archetypesOfRarity(rarity: ExplorerRarity): readonly ExplorerArchetype[] {
  return EXPLORER_ARCHETYPES.filter(a => a.rarity === rarity);
}

/**
 * Expeditions into one realm that earn its Mythic or Legendary.
 *
 * One number rather than a per-archetype field, because "fifty runs in a realm"
 * is a rule about the ladder and not a property of the person — and two
 * archetypes with different thresholds would need two lines of copy explaining
 * why.
 */
export const MASTERY_RUNS = 50;

/** What one of the cast costs when they are for sale. */
export const MARKET_HIRE_COST = 500_000;

/** The archetype a realm's mastery hands over, when it has one. */
export function masteryArchetypeFor(realm: RealmId): ExplorerArchetype | undefined {
  return EXPLORER_ARCHETYPES.find(a => a.source === 'realm-mastery' && a.affinity === realm);
}

/** Everyone who can be bought rather than found. */
export const MARKET_ARCHETYPES = EXPLORER_ARCHETYPES.filter(a => a.source === 'market');

/** The one who is only ever earned by finishing the Collection Log. */
export const CAPSTONE_ARCHETYPE = EXPLORER_ARCHETYPES.find(a => a.source === 'capstone')!;
