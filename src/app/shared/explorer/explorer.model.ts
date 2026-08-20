/**
 * explorer.model.ts — expeditions into the five realms.
 *
 * An explorer is dispatched to a realm for a fixed span, and comes back with
 * Gold, XP, and — if the realm was generous — a rune or a scroll. It is the
 * first mechanic on the site that pays out for time the visitor is *not* here,
 * which is the whole point: the Forge View should be worth opening in the
 * morning.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE REWARD IS ROLLED ON RETURN AND NOT ON DISPATCH
 * ─────────────────────────────────────────────────────────────────────────────
 * The obvious build rolls the loot when the explorer leaves and stores it on the
 * record, so the return is just a read. It is also the build that lets anyone
 * with devtools open the blob, read the pending rune, and re-dispatch until a
 * mythic falls out — the roll is sitting in localStorage in plain text for the
 * entire duration of the mission.
 *
 * Rolling on return costs nothing and closes that: until the timer is up there
 * is no loot to read, and the only thing stored is which realm and for how long.
 * It also means a mission is settled purely from `startedAt + duration` against
 * the wall clock, so a tab closed for six hours and reopened settles correctly
 * on the next load with no background timer having survived anything.
 *
 * Pure data and pure functions — no browser APIs — so this is safe to import
 * from a server-rendered path. `Math.random` is only reached through
 * `rollReward`, which the service never calls during SSR.
 */
import { RealmId, REALMS } from '../realms/realm.model';
import { RUNES, RUNE_TIER_ORDER, Rune, rollRuneWithMagicFind } from '../rune-forge/rune.model';
import { siteProfile } from '../expedition/expedition-site.model';
import { ExplorerBonus, neutralBonus } from '../rpg/explorer-progression';

/** localStorage key. One blob, owned solely by ExplorerService. */
export const EXPLORER_KEY = 'godforge-explorers';

/** Every visitor gets one explorer. The rest are bought in the Market. */
export const BASE_EXPLORER_SLOTS = 1;

/**
 * The ceiling on hired explorers, and therefore on the expedition ladder.
 *
 * Five is the number of realms, which is the only non-arbitrary answer: at five
 * slots a visitor can hold one mission in every realm at once, and a sixth
 * explorer could only ever duplicate a realm already covered.
 */
export const MAX_EXPLORER_SLOTS = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Missions
// ─────────────────────────────────────────────────────────────────────────────

export type MissionId = 'scout' | 'delve' | 'expedition' | 'deep-dive' | 'grand' | 'abyss';

export interface MissionDefinition {
  id: MissionId;
  name: string;
  /** How it reads on the button. */
  label: string;
  /** One line of Eclipse Realms flavour, shown under the label. */
  flavour: string;
  /** Milliseconds until the explorer is home. */
  duration: number;
  goldMin: number;
  goldMax: number;
  xp: number;
  /** 0–1 chance of a rune. */
  runeChance: number;

  // ── The deep ladder ──────────────────────────────────────────────────────
  // Everything below is optional so that the three original missions keep
  // type-checking as written, and so that a save or a spec holding a mission
  // literal from before this ladder existed still resolves.

  /**
   * Gold taken at dispatch. Absent means free.
   *
   * The first three lengths stay free on purpose: dispatch used to cost
   * nothing at all, and the note this replaces was right that charging for the
   * two-minute Scout puts the mechanic out of reach of exactly the new visitor
   * it is meant to hook. What changed is that the ladder now runs past the
   * hour, and a 24-hour run that costs nothing is a run you fire and forget
   * rather than one you choose. The fee is what makes the length a decision.
   */
  cost?: number;

  /**
   * Keeper rank required to dispatch. Absent means anyone may.
   *
   * Only the Abyss has one. A gate on the middle of the ladder would be a wall
   * across the part of the game a new player is still learning; a gate at the
   * end is the end being the end.
   */
  minLevel?: number;

  /**
   * Only one of these may be out at a time, across every explorer and every
   * realm.
   *
   * The Abyss is the only mission with this, and it is what stops five slots
   * turning the endgame into "run five Abysses and read the results on
   * Thursday". One at a time makes the 72 hours a commitment rather than a
   * throughput problem.
   */
  exclusive?: boolean;

  /**
   * Counts toward "complete a Deep Dive or longer" on the Contract Board.
   *
   * A flag rather than a duration comparison at the call site, so retuning a
   * length can never quietly change which challenges it satisfies.
   */
  deep?: boolean;

  /**
   * The floor every rune this mission finds is rolled at or above, as a
   * `RUNE_TIER_ORDER` index.
   *
   * This is what "better loot tables per tier" actually means here. The rune
   * table is shared with the anvil — see the Runes note below, which is still
   * true and is the reason there is no second registry — so a deep mission
   * cannot have *different* runes. What it can have is a different slice of the
   * same table: the Grand Expedition never returns a Common, because the roll
   * that would have produced one is re-rolled inside the rare-and-better band.
   */
  runeFloor?: number;

  /**
   * Runes this mission returns regardless of `runeChance`.
   *
   * `runeChance` still applies *on top* for the explorer's remaining inventory
   * slots, so a Mythic explorer on a Grand Expedition banks its guaranteed rune
   * and still rolls the other five.
   */
  guaranteedRunes?: number;

  /** Materials the realm hands over, as an inclusive band. */
  materialsMin?: number;
  materialsMax?: number;

  /**
   * How loudly the card presents itself, 1–6.
   *
   * Read by the dispatch UI as `--drama`, which scales the glow, the ring count
   * and the portal treatment. A number rather than a set of class names because
   * the six cards are one design at six intensities, and six hand-written
   * treatments would drift apart the first time the palette moved.
   */
  drama?: number;
}

/**
 * Six lengths, priced so that sitting on the short one is never the optimal
 * play: the hour pays roughly 20× the two-minute run for 30× the time. Rune
 * finds on return are a thousandth of the old rates. Someone who checks in
 * twice a day should still out-earn someone who refreshes all afternoon.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEEP LADDER
 * ─────────────────────────────────────────────────────────────────────────────
 * The three lengths above the hour are a different kind of decision, and the
 * numbers say so.
 *
 * The three lengths above the hour keep the ladder's existing balance rule —
 * Gold per millisecond never falls as the run gets longer, so a player who
 * refreshes all afternoon can at best match one who checks in twice a day. That
 * rule was already pinned by a spec before these rungs existed, and it was
 * right: the moment a shorter run pays a better rate, the optimal play becomes
 * "sit on the Scout and click", which is the behaviour the whole mechanic
 * exists to replace. A first pass at these numbers broke it and the spec caught
 * it, which is the reason the spec is worth keeping.
 *
 * So what makes a deep rung a *decision* rather than a strict upgrade is not
 * the rate. It is the fee, the rank gate, the slot locked up for three days,
 * and — the part that actually matters — the rune floor. Past the hour you are
 * no longer buying Gold with time, you are buying a slice of the drop table
 * that Gold cannot buy at any price, because reaching the anvil's own rare band
 * is a twenty-billion-Gold walk.
 *
 * Which is also why the fees are steep. 200,000 Gold on an Abyss is a real
 * decision at the rank that unlocks it, and the fee is what stops the last rung
 * being a free lottery ticket you fire every three days without thinking.
 */
export const MISSIONS: MissionDefinition[] = [
  {
    id: 'scout',
    name: 'Scout',
    label: '2 min',
    flavour: 'To the edge of the light and back before the coals cool.',
    duration: 2 * 60_000,
    goldMin: 5_000,
    goldMax: 10_000,
    xp: 5,
    runeChance: 0.00005,
    drama: 1,
  },
  {
    id: 'delve',
    name: 'Delve',
    label: '10 min',
    flavour: 'Far enough in that the way back has to be remembered.',
    duration: 10 * 60_000,
    goldMin: 20_000,
    goldMax: 50_000,
    xp: 25,
    runeChance: 0.00015,
    cost: 500,
    drama: 2,
  },
  {
    id: 'expedition',
    name: 'Expedition',
    label: '1 hour',
    flavour: 'They pack for a week and are gone for an afternoon. Nobody has explained it.',
    duration: 60 * 60_000,
    goldMin: 100_000,
    goldMax: 300_000,
    xp: 120,
    runeChance: 0.0003,
    cost: 2_000,
    materialsMin: 1,
    materialsMax: 2,
    drama: 3,
  },
  {
    id: 'deep-dive',
    name: 'Deep Dive',
    label: '4 hours',
    flavour: 'Far enough down that the realm stops being scenery and starts being weather.',
    duration: 4 * 60 * 60_000,
    goldMin: 500_000,
    goldMax: 1_400_000,
    xp: 600,
    // Three orders of magnitude above the hour's rate, because the floor below
    // has already taken Commons and Uncommons off the table: this is the chance
    // of a *Rare or better* turning up in a slot, not the chance of anything at
    // all. Comparing it to the shorter tiers' numbers is comparing two
    // different questions.
    runeChance: 0.6,
    runeFloor: 2,
    cost: 10_000,
    deep: true,
    materialsMin: 3,
    materialsMax: 6,
    drama: 4,
  },
  {
    id: 'grand',
    name: 'Grand Expedition',
    label: '24 hours',
    flavour: 'A day and a night. They come back carrying things the maps do not have names for.',
    duration: 24 * 60 * 60_000,
    goldMin: 3_000_000,
    goldMax: 9_000_000,
    xp: 3_600,
    runeChance: 0.75,
    runeFloor: 2,
    // The guarantee is what the 50,000 Gold actually buys. Everything else on
    // this row is a better version of a number the ladder already had; this is
    // the only line that changes what a return *is*.
    guaranteedRunes: 1,
    cost: 50_000,
    deep: true,
    materialsMin: 8,
    materialsMax: 14,
    drama: 5,
  },
  {
    id: 'abyss',
    name: 'The Abyss',
    label: '72 hours',
    flavour: 'Nobody sends an explorer into the Abyss twice by accident. The first time is enough to learn the difference.',
    duration: 72 * 60 * 60_000,
    goldMin: 20_000_000,
    goldMax: 60_000_000,
    xp: 15_000,
    runeChance: 0.9,
    // Epic. The Abyss is the only place in the game a Legendary or a Mythic is
    // reachable by *waiting* rather than by twenty billion Gold of strikes, and
    // that is deliberately the last rung's whole identity.
    runeFloor: 3,
    guaranteedRunes: 2,
    cost: 200_000,
    minLevel: 5,
    exclusive: true,
    deep: true,
    materialsMin: 20,
    materialsMax: 35,
    drama: 6,
  },
];

const MISSION_BY_ID = new Map(MISSIONS.map(m => [m.id, m]));

export function missionById(id: MissionId | string): MissionDefinition | undefined {
  return MISSION_BY_ID.get(id as MissionId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Realm profiles
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What a realm is *worth walking into*.
 *
 * Until this existed, the realm picker was five buttons that did the same thing
 * in five colours: the destination was recorded on the record, coloured the
 * card, and then had no effect whatsoever on what came back. A player who
 * noticed that — and they do, it takes about four dispatches — is a player who
 * stops reading the picker and clicks whichever button the cursor is nearest.
 *
 * So each realm now pays to its own domain. Umbral is the vault the light
 * discarded things into, so it turns up runes at half again the rate and pays
 * less Gold for it. Luminous is a hall still full of gold and short on secrets.
 * Verge and Archivum trade Gold for XP because they are, respectively, the place
 * things are translated and the place they are written down.
 *
 * The multipliers are deliberately narrow — nothing here is more than ±25%
 * except Umbral's rune rate — because the mission length is still the decision
 * that matters most, and a realm that paid double would collapse the picker back
 * into one button in the other direction.
 */
export interface RealmExpeditionProfile {
  realm: RealmId;
  /** One line under the realm button: what this realm is good for. */
  specialty: string;
  goldMultiplier: number;
  xpMultiplier: number;
  runeChanceMultiplier: number;
}

export const REALM_EXPEDITION_PROFILES: Record<RealmId, RealmExpeditionProfile> = {
  luminous: {
    realm: 'luminous',
    specialty: 'Gold — the halls are still full of it',
    goldMultiplier: 1.15,
    xpMultiplier: 0.95,
    runeChanceMultiplier: 0.9,
  },
  umbral: {
    realm: 'umbral',
    specialty: 'Runes — the vault keeps what the light threw out',
    goldMultiplier: 0.9,
    xpMultiplier: 1.0,
    runeChanceMultiplier: 1.5,
  },
  verge: {
    realm: 'verge',
    specialty: 'Knowledge — nothing crosses without being understood',
    goldMultiplier: 0.95,
    xpMultiplier: 1.25,
    runeChanceMultiplier: 1.05,
  },
  archivum: {
    realm: 'archivum',
    specialty: 'Records — everything found is written down twice',
    goldMultiplier: 0.95,
    xpMultiplier: 1.2,
    runeChanceMultiplier: 1.15,
  },
  nexus: {
    realm: 'nexus',
    specialty: 'Freight — whatever the threads were carrying',
    goldMultiplier: 1.1,
    xpMultiplier: 0.95,
    runeChanceMultiplier: 0.95,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Realm freight
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What each realm's seams and canopies actually hand over.
 *
 * Every id here is a material the game *already* mints, catalogues and has art
 * for — `material-catalog.ts` names thirteen and the art manifest resolves all
 * of them. That is not a coincidence, it is the constraint: an expedition that
 * invented five new materials would need five new names, five new PNGs through
 * the importer, and five new rows in every bag, refinery and crafting screen
 * that has to decide what they are for. A material with no recipe is a number
 * with a picture on it.
 *
 * So the deep tiers pay in the existing economy, and what makes a realm worth
 * choosing is *which* of it you get: Umbral is the only source of Umbral Ink on
 * an expedition, Verge the only source of Void Shard. The realm picker was
 * already a real decision for Gold and rune rate; this makes it one for the bag.
 *
 * The commons list is what any realm can turn up. The exclusives are the reason
 * to go to that one.
 */
export const REALM_COMMON_MATERIALS: readonly string[] = [
  'cinder-ore',
  'slag-fragment',
  'ember-residue',
];

/**
 * Materials only this realm returns, richest last.
 *
 * The last entry of each list is drawn least often — see `rollMaterials` — so a
 * realm's headline material is a thing you hope for rather than a thing you
 * count on.
 */
export const REALM_EXCLUSIVE_MATERIALS: Record<RealmId, readonly string[]> = {
  luminous: ['sunbloom', 'luminous-prism'],
  umbral: ['nightbloom', 'umbral-ink'],
  verge: ['thornroot', 'void-shard'],
  archivum: ['starlight-herb', 'celestial-alloy'],
  nexus: ['verdant-sap', 'infernal-heartstone'],
};

/** Everything a realm can hand over, commons first. For the picker's copy. */
export function realmMaterials(id: RealmId | string): readonly string[] {
  const exclusive = REALM_EXCLUSIVE_MATERIALS[id as RealmId]
    ?? REALM_EXCLUSIVE_MATERIALS.luminous;
  return [...REALM_COMMON_MATERIALS, ...exclusive];
}

export function realmProfile(id: RealmId | string): RealmExpeditionProfile {
  return REALM_EXPEDITION_PROFILES[id as RealmId] ?? REALM_EXPEDITION_PROFILES.luminous;
}

/** The Gold band a mission pays in a given realm, after the realm's cut. */
export function realmGoldBand(
  mission: MissionDefinition,
  realm: RealmId | string,
): { min: number; max: number } {
  const mult = realmProfile(realm).goldMultiplier;
  return {
    min: Math.round(mission.goldMin * mult),
    max: Math.round(mission.goldMax * mult),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Runes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * There is no rune registry in this file, deliberately.
 *
 * The Rune Forge already owns twenty-five runes, a weighted drop table, a
 * duplicate-counting ledger and six Runewords that those duplicates craft.
 * Giving expeditions their own runes would have produced two collections with
 * the same name, only one of which the crafting table can see — and the one it
 * cannot see would be a trophy with the mechanic cut off it.
 *
 * So an expedition rolls `rollRune` from the same table the anvil uses and
 * banks the result through `RuneForgeService.grant`. A rune found in Umbral is
 * the same object as a rune struck out of the anvil, counts toward the same
 * Runeword, and appears on the same Codex wall.
 *
 * `rollRune` is a pure function over pure data, so importing it here keeps this
 * file safe to load from a server-rendered path.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Scrolls
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Expeditions do not roll scrolls, and that is not an omission.
 *
 * The Lore Codex is gated behind *rune tier*: `RuneForgeService.grant` rolls a
 * scroll against the rune that just landed, so a Common turns up a page one
 * time in ten and the Void turns one up every time. An expedition banks its
 * rune through that same method, so it gets the same roll on the same terms —
 * a second, independent scroll chance here would pay the visitor twice for one
 * find and would need its own copy of the shelf rules to do it.
 *
 * Which is why `ExplorerReward.scroll` is filled in *after* the grant, from
 * what the grant returned, rather than rolled alongside the Gold.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Records
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A mission in flight.
 *
 * This record used to be called `Explorer`, back when a mission was the only
 * thing an explorer was. Now that explorers are people who persist between
 * missions — see `explorer-roster.model.ts` — the name belongs to them and this
 * is an `Expedition`: who went, where, for how long, starting when.
 */
export interface Expedition {
  id: string;
  /**
   * The roster explorer who is out.
   *
   * Empty string only on a mission migrated from a build that had no roster;
   * `ExplorerService.load` adopts those onto a real explorer on the next
   * hydrate, so nothing downstream has to handle the empty case for long.
   */
  explorerId: string;
  realm: RealmId;
  mission: MissionId;
  /**
   * Milliseconds the mission runs for, after the explorer's speed was applied.
   *
   * Copied at dispatch so that retuning `MISSIONS`, re-equipping the explorer,
   * or hiring a faster one never shortens or extends a run already out — the
   * deadline the player is watching has to be the deadline that fires.
   */
  duration: number;
  /** Epoch ms the explorer left. */
  startedAt: number;
  /**
   * The loot bonus this explorer carried at dispatch, as a percentage.
   *
   * Frozen at dispatch for the same reason `duration` is: the reward is rolled
   * on *return*, so reading the bonus live would let a player dispatch a Common,
   * move every charm onto them while the mission runs, and collect at the
   * boosted rate. Stored, and the roll reads what was true when they left.
   */
  lootBonus: number;
  /** The Endurance multiplier at dispatch, applied to the payout on return. */
  yieldMultiplier: number;

  /**
   * Which of the realm's three sites they walked into.
   *
   * Optional, and its absence has to be free: every expedition written by the
   * build before sites existed has no site, and settling one has to pay exactly
   * what it would have paid then. `siteProfile` returns `NEUTRAL_SITE` for an
   * absent id, whose every multiplier is 1 — that is the contract, and it is why
   * this field is not defaulted to the easy site on load.
   */
  siteId?: string;

  /**
   * The explorer's resolved trait, passive, affinity and level bonus, frozen at
   * dispatch.
   *
   * Frozen for the same reason `lootBonus` and `yieldMultiplier` are: the reward
   * is rolled on return, so reading this live would let a player dispatch a
   * level-1 Common, level somebody else, and collect at the boosted rate. Also
   * optional, and its absence resolves to `neutralBonus()`.
   */
  bonus?: ExplorerBonus;
}

export interface ExplorerReward {
  gold: number;
  xp: number;
  /**
   * The first rune found, when any were.
   *
   * Kept alongside `runes` so every reader written before explorers had
   * inventory slots keeps working — the toast, the reveal card and the settled
   * log all speak in one rune, and a multi-slot explorer's first find is the
   * right one for them to name.
   */
  rune?: string;
  /** Every rune found. One entry per inventory slot that hit. */
  runes: string[];
  /** Scroll id, when one was found. */
  scroll?: string;
  /** Item ids minted for this return, filled in after the grants. */
  items?: string[];
  /**
   * Materials carried home, as `stackKey → quantity`.
   *
   * Only the deep tiers fill this. Rolled here and banked by the service so the
   * roll stays pure and testable, in the same shape as the runes above.
   */
  materials?: Record<string, number>;
}

/** A settled mission, held until the visitor has seen the loot reveal. */
export interface ExplorerReturn {
  explorer: Expedition;
  /** The name of whoever went, resolved at settlement for the toast copy. */
  explorerName?: string;
  reward: ExplorerReward;
  /** Epoch ms the mission actually ended, which may be long before it settled. */
  returnedAt: number;
  /**
   * Somebody they brought back with them, when the return turned one up.
   *
   * The whole roster acquisition loop lands here. Deliberately *not* on
   * `ExplorerReward`: a reward is rolled by a pure function over pure data, and
   * a hire is a write to another service's ledger. Keeping it on the return
   * means the reveal card can announce it while `rollReward` stays testable
   * without a roster.
   *
   * Typed loosely as the fields the card reads, so `explorer.model.ts` does not
   * have to import the roster model and reintroduce the cycle the two services
   * were split to avoid.
   */
  found?: { id: string; name: string; rarity: string; archetypeId?: string };
}

/**
 * How many settled expeditions the log keeps.
 *
 * Twenty, because the log is a *memory of the season you were away for*, not a
 * ledger: the ledger is the Codex and the rune shelf, both of which already hold
 * every find permanently.
 *
 * It was ten, sized against five expedition slots — two full nights. The roster
 * collection now grants a sixth slot at ten discoveries and there are fifteen
 * sites rather than five realms, so ten rows is a single evening's dispatching
 * and the log stopped reaching back far enough to answer "have I ever actually
 * run the Unspoken Gate". Twenty is still a bounded blob on a save a player
 * might carry for a year, which is the constraint that set the cap in the first
 * place.
 */
export const EXPEDITION_HISTORY_CAP = 20;

/**
 * A settled expedition, kept so the panel can show what the last ones brought.
 *
 * Deliberately flattened to ids and numbers rather than holding the `Expedition`
 * and `ExplorerReward` objects: this is the one part of the explorer blob that
 * is written on *every* settlement and read on every load, and the fields the
 * log actually renders are these nine. Storing the reward whole would persist
 * the frozen `lootBonus` and `yieldMultiplier` of a mission that is over, which
 * nothing will ever read again.
 */
export interface ExpeditionRecord {
  id: string;
  realm: RealmId;
  mission: MissionId;
  /** Which of the realm's three sites. Absent on a record from before sites. */
  siteId?: string;
  /** Who went. Empty when they have since been dismissed. */
  explorerName: string;
  gold: number;
  xp: number;
  /** Rune ids found. Resolved against the Rune Forge registry for display. */
  runes: string[];
  /** Lore scroll id, when the runes turned one up. */
  scroll?: string;
  /** Item ids minted on this return. */
  items?: string[];
  /** Materials banked on this return, `stackKey → quantity`. */
  materials?: Record<string, number>;
  /** Epoch ms the mission ended. */
  returnedAt: number;
}

export interface ExplorerState {
  version: 1;
  /** Missions currently out. */
  active: Expedition[];
  /** Items expeditions have carried home, across every mission. */
  itemsFound: number;
  /**
   * How many runes expeditions have brought home.
   *
   * A count, not a collection: the runes themselves live in the Rune Forge's
   * ledger, which is the only place that can be right about them. This is here
   * purely so the panel can say what the expeditions have been worth.
   */
  runesFound: number;
  /**
   * How many Lore Codex fragments expeditions have brought home.
   *
   * A count for the same reason as `runesFound`: the scrolls themselves live in
   * `LoreScrollService`, which is what the Codex wall and the two completion
   * achievements read.
   */
  scrollsFound: number;
  /** Lifetime count, for the panel's footer line. */
  missionsCompleted: number;
  /** Lifetime Gold brought home, so the panel can justify itself. */
  goldRecovered: number;
  /**
   * Expeditions completed per realm, lifetime.
   *
   * Added for realm mastery — see `MASTERY_RUNS` — and kept here rather than
   * derived from `history`, which is capped at twenty and so can only ever
   * answer "the last twenty", not "have I run fifty in Nexus".
   *
   * Optional, because every save written before this existed has no counts and
   * back-filling one from a twenty-row log would invent a number. A returning
   * player starts their fifty from where they are, which is the honest reading:
   * the ledger did not exist, so it recorded nothing.
   */
  realmRuns?: Partial<Record<RealmId, number>>;

  /**
   * The last few settled expeditions, newest first, capped at
   * `EXPEDITION_HISTORY_CAP`.
   *
   * Persisted rather than session-local because the whole point of an
   * expedition is that it resolves while the tab is shut — a log that emptied on
   * reload would be blank at exactly the moment the player wants to read it.
   */
  history: ExpeditionRecord[];
}

export function emptyExplorerState(): ExplorerState {
  return {
    version: 1,
    active: [],
    itemsFound: 0,
    runesFound: 0,
    scrollsFound: 0,
    missionsCompleted: 0,
    goldRecovered: 0,
    realmRuns: {},
    history: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rolling
// ─────────────────────────────────────────────────────────────────────────────


/**
 * A rune at `floor` or better, off the same table the anvil uses.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT REJECTION SAMPLING
 * ─────────────────────────────────────────────────────────────────────────────
 * Re-rolling until the tier clears the floor is the one-line implementation and
 * it does not work, for a reason that is easy to talk yourself out of and
 * impossible to argue with once measured: the rare-and-better band is 0.015% of
 * the drop table. Four hundred attempts clear it about 6% of the time. A
 * "guaranteed Rare+" that delivers an Uncommon nineteen times out of twenty is
 * not a tuning problem, it is a promise the card is making and the code is not
 * keeping — and it was caught here by a spec asserting the promise rather than
 * asserting the implementation.
 *
 * So the band is built and normalised instead. It is 25 rows, filtered and
 * summed per call, which is nothing next to the settlement it happens inside,
 * and it is *exact*: relative odds inside the band are untouched, so a Mythic
 * is still six times a Legendary's chance at every floor.
 *
 * `magicFind` is deliberately ignored once a floor is set. Magic Find's whole
 * mechanic is boosting the share of the rare-and-better group against the
 * commons — see `rollRuneWithMagicFind` — and inside a band that is already
 * entirely rare-and-better there is no share left for it to move. Applying it
 * anyway would either do nothing or, worse, silently reweight the band's
 * internals in a way no card describes.
 */
/**
 * The highest floor any modifier may promise, as a `RUNE_TIER_ORDER` index.
 *
 * 4 is Legendary. See the note in `rollReward` for why this exists at all.
 */
export const MAX_RUNE_FLOOR = 4;

export function rollRuneAtOrAbove(
  floor: number,
  magicFind: number,
  rng: () => number = Math.random,
): Rune {
  if (floor <= 0) return rollRuneWithMagicFind(magicFind, rng);

  const pool = RUNES.filter(r => RUNE_TIER_ORDER.indexOf(r.tier) >= floor);
  // A floor past the top of the ladder is a retuning mistake, not a runtime
  // state — fall back to the unfloored roll rather than throwing inside a
  // settlement that has already banked Gold.
  if (!pool.length) return rollRuneWithMagicFind(magicFind, rng);

  const total = pool.reduce((sum, r) => sum + r.dropRate, 0);
  let roll = rng() * total;
  for (const rune of pool) {
    roll -= rune.dropRate;
    if (roll <= 0) return rune;
  }
  return pool[pool.length - 1];
}

/**
 * How many of what a realm hands over.
 *
 * Weighted so the commons carry the bulk and the realm's own two are the
 * reason to have gone: a draw lands on the exclusives about a third of the
 * time, and inside that third the headline material is the rarer of the two.
 * Returned as a map rather than a list because the bag stacks — twelve Cinder
 * Ore is one row with a twelve on it, and a caller that had to reduce a
 * thirty-entry array to get there would be doing the service's job.
 */
export function rollMaterials(
  realm: RealmId | string,
  min: number,
  max: number,
  rng: () => number = Math.random,
): Record<string, number> {
  const count = Math.round(min + rng() * Math.max(0, max - min));
  if (count <= 0) return {};

  const exclusive = REALM_EXCLUSIVE_MATERIALS[realm as RealmId]
    ?? REALM_EXCLUSIVE_MATERIALS.luminous;
  const out: Record<string, number> = {};

  for (let i = 0; i < count; i++) {
    const roll = rng();
    let id: string;
    if (roll < 0.66) {
      id = REALM_COMMON_MATERIALS[Math.floor(rng() * REALM_COMMON_MATERIALS.length)]
        ?? REALM_COMMON_MATERIALS[0];
    } else if (roll < 0.92) {
      id = exclusive[0];
    } else {
      id = exclusive[exclusive.length - 1];
    }
    out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}

/**
 * Roll what an explorer brings home.
 *
 * `held` is what the visitor already owns: a duplicate rune is rerolled out of
 * the pool rather than dropped, so the tenth expedition into Umbral is still
 * capable of completing the set. Once a realm is exhausted the slot simply pays
 * nothing extra, which is the honest outcome — there is no filler item to hand
 * out and inventing one would cheapen the fourteen that mean something.
 *
 * `rng` is injectable so the tests can pin it. Production passes nothing.
 */
export function rollReward(
  mission: MissionDefinition,
  rng: () => number = Math.random,
  opts: RewardOptions = {},
): ExplorerReward {
  const span = mission.goldMax - mission.goldMin;
  const yieldMult = Number.isFinite(opts.yieldMultiplier ?? 1)
    ? Math.max(1, opts.yieldMultiplier ?? 1)
    : 1;

  // Where they went now decides what they come back with. See the note on
  // `REALM_EXPEDITION_PROFILES` — the realm is a *bias*, not a second economy,
  // so it multiplies the same three numbers the mission already set.
  const profile = realmProfile(opts.realm ?? 'luminous');

  // The third axis. A site multiplies what the mission and the realm already
  // decided; an absent site resolves to NEUTRAL_SITE, whose every multiplier is
  // 1, so a record written before sites existed pays exactly what it did then.
  const site = siteProfile(opts.siteId);

  // What the person brings: their trait, their passive, their realm affinity and
  // their level, resolved once at dispatch and frozen onto the record. Absent
  // on a legacy record, and neutral when absent for the same reason the site is.
  const who = opts.bonus ?? neutralBonus();

  // What the collection is worth. One number, compounded from every roster
  // reward earned — see `rosterPayoutMultiplier`. Applied to Gold only: a
  // collection bonus that also moved the rune gate would stack with the site
  // floor and the passive floor into a table nobody could reason about.
  const collection = Number.isFinite(opts.rosterMultiplier ?? 1)
    ? Math.max(1, opts.rosterMultiplier ?? 1)
    : 1;

  const reward: ExplorerReward = {
    // Endurance pays out here rather than by lengthening the clock. The stat is
    // published as "+10% max mission duration", and the honest reading of that
    // is "your explorers stay out longer and bring proportionally more back" —
    // but a stat that only made the player *wait* longer would be a downgrade
    // dressed as an upgrade, and nobody would spend a point on it. So the
    // duration the player picked is the duration they get, and the extra
    // distance covered is paid as extra loot.
    gold: Math.round(
      (mission.goldMin + rng() * span)
      * yieldMult * profile.goldMultiplier
      * site.goldMultiplier * who.gold * collection,
    ),
    xp: Math.round(mission.xp * yieldMult * profile.xpMultiplier * site.xpMultiplier * who.xp),
    runes: [],
  };

  // Runes come off the Rune Forge's own table, duplicates and all. Deduping
  // them would be actively wrong: a Runeword needs three Ber, so a second Ber
  // is the reward, not a consolation. `reward.scroll` is not set here — see the
  // Scrolls note above.
  //
  // An explorer with inventory slots rolls once per slot, and each roll gets the
  // explorer's loot bonus applied as Magic Find. That is what an explorer tier
  // actually buys: a Mythic makes six attempts at the table with +200% on the
  // rare-and-better weights, where a Common makes one at the base rate.
  // The extra slots a passive or a level-5 milestone grants are *added* to the
  // tier's, not multiplied: an explorer who files one more find files exactly
  // one more, whether they are a Common with one slot or a Mythic with six.
  const slots = Math.max(1, (opts.inventorySlots ?? 1) + Math.max(0, who.extraSlots));
  const magicFind = Math.max(0, (opts.lootBonus ?? 0) + who.magicFind);

  const runeChance = mission.runeChance * profile.runeChanceMultiplier
    * site.runeChanceMultiplier * who.rune;

  // Three sources of floor. The mission's and the site's are two claims about
  // the same thing — "nothing below Rare comes out of here" — so the *higher*
  // of them wins rather than the sum; a Deep Dive at the Void Threshold is one
  // Epic floor, not a Rare floor and an Epic floor added together. What a
  // passive contributes is genuinely additive on top of that, because its card
  // says "rolled one tier higher" and one tier higher than the floor is what
  // that has to mean.
  //
  // Then clamped, and the clamp is the important line. `RUNE_TIER_ORDER` runs to
  // `singular`, which is the Void: one rune, the thing the realms were carved
  // out of. The Ashen Sovereign at level 10 raises the floor by three, and the
  // Core of the Forge already floors at Epic — without this clamp that pairing
  // would floor at `singular` and hand over the Void on every single return.
  // Legendary is the highest floor anything may promise; the Void stays
  // reachable only on the band's own odds, which is the entire reason it is
  // worth anything.
  const floor = Math.min(
    MAX_RUNE_FLOOR,
    Math.max(mission.runeFloor ?? 0, site.runeFloor ?? 0) + Math.max(0, who.runeFloor),
  );

  // The guaranteed runes come off the front of the slot budget rather than
  // being added to it, so a Grand Expedition on a Common explorer returns its
  // one promised rune and a Mythic's six slots are still six rolls — not seven.
  const guaranteed = Math.min(
    slots,
    Math.max(0, mission.guaranteedRunes ?? 0, who.guaranteeRune ? 1 : 0),
  );

  for (let i = 0; i < slots; i++) {
    if (i >= guaranteed && rng() >= runeChance) continue;
    reward.runes.push(rollRuneAtOrAbove(floor, magicFind, rng).id);
  }

  // Materials are a flat band per mission, unaffected by the realm's Gold and
  // rune multipliers: the realm already decides *what* comes back, and letting
  // it decide the quantity too would make Luminous the only correct answer for
  // the bag as well as for the Gold.
  const matScale = site.materialMultiplier * who.materials;
  const matMin = Math.round((mission.materialsMin ?? 0) * matScale);
  const matMax = Math.max(matMin, Math.round((mission.materialsMax ?? 0) * matScale));
  if (matMax > 0) {
    const materials = rollMaterials(opts.realm ?? 'luminous', matMin, matMax, rng);
    if (Object.keys(materials).length) reward.materials = materials;
  }

  // `rune` is the first of them, kept so every existing reader — the toast, the
  // reveal card, the settled-mission log — keeps working unchanged against a
  // single-rune reward.
  if (reward.runes.length) reward.rune = reward.runes[0];

  return reward;
}

/** What the roll needs to know about who went. */
export interface RewardOptions {
  /**
   * Where they were sent.
   *
   * Defaults to Luminous rather than to a neutral 1.0 profile so that a caller
   * which forgets to pass it produces a *realm's* payout rather than a fourth
   * set of numbers that exists nowhere in the picker.
   */
  realm?: RealmId;
  /** How many table rolls this explorer gets. Their tier's inventory slots. */
  inventorySlots?: number;
  /** Magic Find applied to each roll — tier bonus plus what they wear. */
  lootBonus?: number;
  /** Endurance's payout multiplier. See the note in `rollReward`. */
  yieldMultiplier?: number;
  /** Which of the realm's three sites. Absent is neutral — see `NEUTRAL_SITE`. */
  siteId?: string;
  /** The explorer's resolved bonus, frozen at dispatch. Absent is neutral. */
  bonus?: ExplorerBonus;
  /** The compounded roster-collection multiplier. Absent is 1. */
  rosterMultiplier?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Milliseconds left on a mission, floored at zero. */
export function remainingMs(explorer: Expedition, now: number): number {
  return Math.max(0, explorer.startedAt + explorer.duration - now);
}

/** Epoch ms this mission is due home. */
export function expeditionEta(explorer: Expedition): number {
  return explorer.startedAt + explorer.duration;
}

/**
 * "home 14:32" — the wall-clock time an expedition lands.
 *
 * Shown *alongside* the countdown rather than instead of it. A countdown answers
 * "how long do I wait", which is the question during a Scout; a clock time
 * answers "should I close the tab", which is the question during the hour-long
 * one, and it is the only one of the two that survives being read and then
 * forgotten about for ten minutes.
 *
 * Falls back to an empty string off the browser and on any locale that throws,
 * because this is decoration on a line that already carries the countdown.
 */
export function formatEta(at: number): string {
  try {
    return new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** 0–1 through the mission, for the progress ring. */
export function missionProgress(explorer: Expedition, now: number): number {
  if (explorer.duration <= 0) return 1;
  const done = (now - explorer.startedAt) / explorer.duration;
  return Math.min(1, Math.max(0, done));
}

/**
 * "4:32", or "1:04:32" once an hour is involved.
 *
 * Deliberately not `toLocaleTimeString` on a Date: that formats a *time of day*
 * and would render a 62-minute remainder as "01:02:00 AM" in some locales.
 */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/** The realms, in board order, for the dispatch picker. */
export const EXPLORER_REALMS = REALMS;
