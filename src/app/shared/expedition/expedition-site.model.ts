/**
 * expedition-site.model.ts — *where in the realm* an explorer is sent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A THIRD AXIS, WHEN THERE WERE ALREADY TWO
 * ─────────────────────────────────────────────────────────────────────────────
 * Dispatch already asked two questions: which realm (a bias on Gold, XP and
 * rune rate — see `REALM_EXPEDITION_PROFILES`) and how long (the six-rung
 * ladder in `MISSIONS`). Both are good questions and neither is a *place*. A
 * player who has run forty expeditions has been to Umbral forty times and can
 * name nothing that is in it, because there is nothing in it: the realm is a
 * colour and three multipliers.
 *
 * A site is the place. Three per realm, easy → hard, each with its own name,
 * its own line of what it is, and its own cut of the payout. It is the axis
 * that makes an expedition a story you can retell — "the Hollow Depths ate two
 * hours and paid for the week" — rather than a colour you clicked.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE BALANCE RULE, RESTATED FOR THIS AXIS
 * ─────────────────────────────────────────────────────────────────────────────
 * `explorer.model.spec.ts` pins one property over the mission ladder: Gold per
 * millisecond never falls as the run gets longer, so grinding the short rung
 * can at best match — never beat — checking in twice a day. Sites multiply
 * *inside* a mission, so they cannot break that ladder. What they can break is
 * the same property along their own axis, and they must not: a hard site that
 * cost 60% more time for 35% more Gold would be a trap, and a player who worked
 * the arithmetic out would correctly never click it again.
 *
 * So the three tiers pay a strictly rising rate — 0.90, 1.08, 1.375 Gold per
 * unit time — and `expedition-site.spec.ts` asserts it. What makes the hard
 * site a *decision* rather than a strict upgrade is everything that is not
 * Gold: the Keeper-rank wall, the explorer-level wall, the fee multiplier, and
 * the fact that it locks a slot for two thirds again as long.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE HARD SITES GATE ON THE EXPLORER, NOT ON THE MISSION
 * ─────────────────────────────────────────────────────────────────────────────
 * The obvious place to hang "you are not ready for this" is the mission ladder,
 * and it is the wrong place: every existing save has explorers who can already
 * reach every rung, so a new gate there would retroactively take something away
 * from a player who did nothing. Sites are new content, and a gate on new
 * content takes nothing from anybody. That is the whole reason the level walls
 * live here.
 *
 * Pure data and pure functions — no browser APIs, no `Math.random` outside the
 * explicitly-seeded helpers — so this is safe to import from a server-rendered
 * path.
 */
import { RealmId } from '../realms/realm.model';

/** Easy / medium / hard, as a number so the card can render N of 5 stars. */
export type SiteDifficulty = 1 | 2 | 3 | 4 | 5;

/** Which of the three rungs a site sits on, for grouping and for the gates. */
export type SiteTier = 'outer' | 'inner' | 'deep';

export interface ExpeditionSite {
  id: string;
  realm: RealmId;
  tier: SiteTier;
  name: string;
  /** One line of what the place *is*. Printed under the name on the card. */
  flavour: string;
  /** 1–5, rendered as stars. Rises across the three tiers of every realm. */
  difficulty: SiteDifficulty;

  // ── The cut ────────────────────────────────────────────────────────────────
  // Every one of these multiplies what the mission and the realm already
  // decided. None of them introduces a number the player cannot trace back to a
  // rung they picked.

  /** Multiplies the mission's Gold band. */
  goldMultiplier: number;
  /** Multiplies the mission's XP. */
  xpMultiplier: number;
  /** Multiplies the mission's rune drop gate. */
  runeChanceMultiplier: number;
  /** Multiplies the mission's material band, rounded up at the floor. */
  materialMultiplier: number;
  /**
   * Multiplies the mission's span.
   *
   * Above 1 for the deeper sites: the *place* costs time, which is what makes
   * "the same four hours, somewhere worse" a real trade rather than a free
   * upgrade. Frozen onto the record at dispatch alongside the explorer's speed.
   */
  durationMultiplier: number;
  /**
   * Multiplies the mission's dispatch fee.
   *
   * A site with no fee of its own on a free mission is still free — this
   * multiplies zero — which is deliberate: the first three rungs stay free at
   * every site so a new visitor can walk all fifteen of them before the ladder
   * starts charging.
   */
  costMultiplier: number;

  /**
   * Raises the floor every rune found here is rolled at or above, as a
   * `RUNE_TIER_ORDER` index, when it is higher than the mission's own.
   *
   * Only the deep sites carry one, and it is the single most valuable thing a
   * site gives: the rare-and-better band is 0.015% of the drop table, and a
   * floor is the only way into it that is not a twenty-billion-Gold walk at the
   * anvil. See `rollRuneAtOrAbove`.
   */
  runeFloor?: number;

  // ── The walls ──────────────────────────────────────────────────────────────

  /** Keeper rank required. Absent means anyone may walk in. */
  minKeeperLevel?: number;
  /**
   * Explorer level required, 1–20.
   *
   * This is the wall that makes an explorer's own ladder mean something: a
   * level-1 hire cannot be thrown at the World-Tree Heart no matter how rich
   * their Keeper is.
   */
  minExplorerLevel?: number;

  // ── The pitch ──────────────────────────────────────────────────────────────

  /**
   * What the card promises, in the player's words rather than in multipliers.
   *
   * Three or four named things. Written by hand rather than derived from the
   * numbers because "Umbral Ink, and something older" is a reason to go and
   * "×1.35 Gold, ×1.6 rune rate" is a spreadsheet.
   */
  finds: readonly string[];
  /**
   * The one thing only this site turns up, when there is one.
   *
   * Deep sites only. Rendered as the headline promise on the card — it is the
   * reason to clear the walls.
   */
  exclusive?: string;
}

/**
 * Fifteen places, three in each of the five realms.
 *
 * The names are the realm's own vocabulary, not a generic dungeon list: Verge
 * is the realm where nothing crosses without being understood, so its three
 * sites are all about translation and threshold; Archivum writes everything
 * down twice, so its three are shelves, ledgers and the thing at the end of the
 * catalogue. A site named "Ice Cavern" would be a room from another game.
 */
export const EXPEDITION_SITES: readonly ExpeditionSite[] = [
  // ── Luminous — the halls are still full of Gold ────────────────────────────
  {
    id: 'crystal-caverns',
    realm: 'luminous', tier: 'outer',
    name: 'Crystal Caverns',
    flavour: 'The light gets in and then cannot find its way back out.',
    difficulty: 1,
    goldMultiplier: 0.9, xpMultiplier: 0.9, runeChanceMultiplier: 0.85,
    materialMultiplier: 0.8, durationMultiplier: 1.0, costMultiplier: 1.0,
    finds: ['Cinder Ore', 'Sunbloom', 'a Common rune, sometimes'],
  },
  {
    id: 'solari-temple',
    realm: 'luminous', tier: 'inner',
    name: 'Solari Temple',
    flavour: 'Still consecrated. Nobody has established to what.',
    difficulty: 3,
    goldMultiplier: 1.35, xpMultiplier: 1.25, runeChanceMultiplier: 1.2,
    materialMultiplier: 1.3, durationMultiplier: 1.25, costMultiplier: 2.0,
    minExplorerLevel: 3,
    finds: ['Luminous Prism', 'Sunbloom in quantity', 'temple Gold'],
  },
  {
    id: 'dawns-edge',
    realm: 'luminous', tier: 'deep',
    name: "Dawn's Edge",
    flavour: 'Where the light is made. It is not a comfortable place to stand.',
    difficulty: 5,
    goldMultiplier: 2.2, xpMultiplier: 1.8, runeChanceMultiplier: 1.6,
    materialMultiplier: 1.9, durationMultiplier: 1.6, costMultiplier: 4.0,
    runeFloor: 2,
    minKeeperLevel: 4, minExplorerLevel: 8,
    finds: ['Luminous Prism by the crate', 'Rare runes or better'],
    exclusive: 'The first light, cooled enough to carry',
  },

  // ── Umbral — the vault keeps what the light threw out ──────────────────────
  {
    id: 'shadow-crypt',
    realm: 'umbral', tier: 'outer',
    name: 'Shadow Crypt',
    flavour: 'Shallow, well-mapped, and quietly one grave longer every year.',
    difficulty: 1,
    goldMultiplier: 0.9, xpMultiplier: 0.9, runeChanceMultiplier: 0.9,
    materialMultiplier: 0.8, durationMultiplier: 1.0, costMultiplier: 1.0,
    finds: ['Slag Fragment', 'Nightbloom', 'runes the light discarded'],
  },
  {
    id: 'hollow-depths',
    realm: 'umbral', tier: 'inner',
    name: 'Hollow Depths',
    flavour: 'The maps stop. The stairs do not.',
    difficulty: 3,
    goldMultiplier: 1.35, xpMultiplier: 1.25, runeChanceMultiplier: 1.35,
    materialMultiplier: 1.3, durationMultiplier: 1.25, costMultiplier: 2.0,
    minExplorerLevel: 3,
    finds: ['Umbral Ink', 'Nightbloom', 'an unusual rune rate'],
  },
  {
    id: 'void-threshold',
    realm: 'umbral', tier: 'deep',
    name: 'Void Threshold',
    flavour: 'The last door the vault has. It opens outward.',
    difficulty: 5,
    goldMultiplier: 2.2, xpMultiplier: 1.8, runeChanceMultiplier: 2.0,
    materialMultiplier: 1.9, durationMultiplier: 1.6, costMultiplier: 4.0,
    runeFloor: 3,
    minKeeperLevel: 5, minExplorerLevel: 10,
    finds: ['Umbral Ink in bulk', 'Epic runes or better'],
    exclusive: 'Whatever the light was thrown out to make room for',
  },

  // ── Verge — nothing crosses without being understood ───────────────────────
  {
    id: 'crossing-stones',
    realm: 'verge', tier: 'outer',
    name: 'The Crossing Stones',
    flavour: 'Twelve steps. Each one asks the same question in a different language.',
    difficulty: 1,
    goldMultiplier: 0.9, xpMultiplier: 1.0, runeChanceMultiplier: 0.9,
    materialMultiplier: 0.8, durationMultiplier: 1.0, costMultiplier: 1.0,
    finds: ['Ember Residue', 'Thornroot', 'unusually good XP'],
  },
  {
    id: 'translators-span',
    realm: 'verge', tier: 'inner',
    name: "The Translator's Span",
    flavour: 'A bridge that only holds while you can still say what it is.',
    difficulty: 3,
    goldMultiplier: 1.35, xpMultiplier: 1.45, runeChanceMultiplier: 1.2,
    materialMultiplier: 1.3, durationMultiplier: 1.25, costMultiplier: 2.0,
    minExplorerLevel: 3,
    finds: ['Void Shard', 'Thornroot', 'a great deal of XP'],
  },
  {
    id: 'unspoken-gate',
    realm: 'verge', tier: 'deep',
    name: 'The Unspoken Gate',
    flavour: 'It has no name because nobody who read it came back able to give one.',
    difficulty: 5,
    goldMultiplier: 2.2, xpMultiplier: 2.2, runeChanceMultiplier: 1.6,
    materialMultiplier: 1.9, durationMultiplier: 1.6, costMultiplier: 4.0,
    runeFloor: 2,
    minKeeperLevel: 4, minExplorerLevel: 8,
    finds: ['Void Shard by the crate', 'Rare runes or better', 'XP nothing else pays'],
    exclusive: 'The word the gate is waiting for',
  },

  // ── Archivum — everything found is written down twice ──────────────────────
  {
    id: 'lower-stacks',
    realm: 'archivum', tier: 'outer',
    name: 'The Lower Stacks',
    flavour: 'Catalogued, shelved, and lit by something that is not a lamp.',
    difficulty: 1,
    goldMultiplier: 0.9, xpMultiplier: 1.0, runeChanceMultiplier: 0.95,
    materialMultiplier: 0.8, durationMultiplier: 1.0, costMultiplier: 1.0,
    finds: ['Cinder Ore', 'Starlight Herb', 'Codex fragments'],
  },
  {
    id: 'ledger-vault',
    realm: 'archivum', tier: 'inner',
    name: 'The Ledger Vault',
    flavour: 'Where the second copy is kept, in case the first one lies.',
    difficulty: 3,
    goldMultiplier: 1.35, xpMultiplier: 1.35, runeChanceMultiplier: 1.3,
    materialMultiplier: 1.3, durationMultiplier: 1.25, costMultiplier: 2.0,
    minExplorerLevel: 3,
    finds: ['Celestial Alloy', 'Starlight Herb', 'fragments, reliably'],
  },
  {
    id: 'last-entry',
    realm: 'archivum', tier: 'deep',
    name: 'The Last Entry',
    flavour: 'The end of the catalogue. Something is still writing in it.',
    difficulty: 5,
    goldMultiplier: 2.2, xpMultiplier: 2.0, runeChanceMultiplier: 1.7,
    materialMultiplier: 1.9, durationMultiplier: 1.6, costMultiplier: 4.0,
    runeFloor: 2,
    minKeeperLevel: 4, minExplorerLevel: 8,
    finds: ['Celestial Alloy in bulk', 'Rare runes or better'],
    exclusive: 'The entry that has not been made yet',
  },

  // ── Nexus — whatever the threads were carrying ─────────────────────────────
  {
    id: 'thread-yards',
    realm: 'nexus', tier: 'outer',
    name: 'The Thread Yards',
    flavour: 'Freight comes in. Freight goes out. Some of it is never claimed.',
    difficulty: 1,
    goldMultiplier: 0.95, xpMultiplier: 0.85, runeChanceMultiplier: 0.85,
    materialMultiplier: 0.9, durationMultiplier: 1.0, costMultiplier: 1.0,
    finds: ['Cinder Ore', 'Verdant Sap', 'unclaimed Gold'],
  },
  {
    id: 'severed-line',
    realm: 'nexus', tier: 'inner',
    name: 'The Severed Line',
    flavour: 'A route that still delivers, to somewhere that stopped receiving.',
    difficulty: 3,
    goldMultiplier: 1.45, xpMultiplier: 1.15, runeChanceMultiplier: 1.2,
    materialMultiplier: 1.4, durationMultiplier: 1.25, costMultiplier: 2.0,
    minExplorerLevel: 3,
    finds: ['Infernal Heartstone', 'Verdant Sap', 'the richest Gold on the board'],
  },
  {
    id: 'core-of-the-forge',
    realm: 'nexus', tier: 'deep',
    name: 'Core of the Forge',
    flavour: 'Every thread starts here. It is the only place that knows why.',
    difficulty: 5,
    goldMultiplier: 2.4, xpMultiplier: 1.7, runeChanceMultiplier: 1.6,
    materialMultiplier: 2.1, durationMultiplier: 1.6, costMultiplier: 4.0,
    runeFloor: 3,
    minKeeperLevel: 5, minExplorerLevel: 10,
    finds: ['Infernal Heartstone by the crate', 'Epic runes or better'],
    exclusive: 'The heat the Godforge was lit from',
  },
];

const SITE_BY_ID = new Map(EXPEDITION_SITES.map(s => [s.id, s]));

export function siteById(id: string | undefined): ExpeditionSite | undefined {
  return id ? SITE_BY_ID.get(id) : undefined;
}

/** The three sites in a realm, easy first. */
export function sitesInRealm(realm: RealmId | string): readonly ExpeditionSite[] {
  return EXPEDITION_SITES.filter(s => s.realm === realm);
}

/**
 * The site a dispatch should default to in a realm the player has not chosen
 * in: the easy one, which has no walls and cannot refuse them.
 */
export function defaultSiteFor(realm: RealmId | string): ExpeditionSite {
  return sitesInRealm(realm)[0] ?? EXPEDITION_SITES[0];
}

/**
 * A neutral site, for every reader written before sites existed.
 *
 * Every multiplier is 1 and there are no walls, so a mission on a save from
 * before this file pays exactly what it paid then. That is the whole contract:
 * `siteId` is optional on the record, and its absence has to be free.
 */
export const NEUTRAL_SITE: ExpeditionSite = {
  id: '', realm: 'luminous', tier: 'outer',
  name: '', flavour: '', difficulty: 1,
  goldMultiplier: 1, xpMultiplier: 1, runeChanceMultiplier: 1,
  materialMultiplier: 1, durationMultiplier: 1, costMultiplier: 1,
  finds: [],
};

/** The site's cut, or a free one when the record predates sites. */
export function siteProfile(id: string | undefined): ExpeditionSite {
  return siteById(id) ?? NEUTRAL_SITE;
}

// ─────────────────────────────────────────────────────────────────────────────
// Walls
// ─────────────────────────────────────────────────────────────────────────────

export type SiteBlockCode = 'keeper-level' | 'explorer-level';

export interface SiteBlock {
  code: SiteBlockCode;
  need: number;
  have: number;
}

/**
 * Why this site refuses this explorer right now, or null when it does not.
 *
 * Returns the *reason* rather than a boolean for the same reason
 * `ExplorerService.blockedReason` does: a greyed-out card with no copy on it is
 * indistinguishable from a broken one, and "rank 5" and "level 10" send the
 * player to two completely different places.
 */
export function siteBlock(
  site: ExpeditionSite,
  keeperLevel: number,
  explorerLevel: number,
): SiteBlock | null {
  if (site.minKeeperLevel && keeperLevel < site.minKeeperLevel) {
    return { code: 'keeper-level', need: site.minKeeperLevel, have: keeperLevel };
  }
  if (site.minExplorerLevel && explorerLevel < site.minExplorerLevel) {
    return { code: 'explorer-level', need: site.minExplorerLevel, have: explorerLevel };
  }
  return null;
}

export function siteBlockLabel(block: SiteBlock): string {
  return block.code === 'keeper-level'
    ? `Keeper rank ${block.need}`
    : `Explorer level ${block.need}`;
}
