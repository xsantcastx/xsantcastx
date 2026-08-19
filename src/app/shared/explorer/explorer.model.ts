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
import { rollRuneWithMagicFind } from '../rune-forge/rune.model';

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

export type MissionId = 'scout' | 'delve' | 'expedition';

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
}

/**
 * Three lengths, priced so that sitting on the short one is never the optimal
 * play: the hour pays roughly 20× the two-minute run for 30× the time. Rune
 * finds on return are a thousandth of the old rates. Someone who checks in
 * twice a day should still out-earn someone who refreshes all afternoon.
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
}

/** A settled mission, held until the visitor has seen the loot reveal. */
export interface ExplorerReturn {
  explorer: Expedition;
  /** The name of whoever went, resolved at settlement for the toast copy. */
  explorerName?: string;
  reward: ExplorerReward;
  /** Epoch ms the mission actually ended, which may be long before it settled. */
  returnedAt: number;
}

/**
 * How many settled expeditions the log keeps.
 *
 * Ten, because the log is a *memory of the session you were away for*, not a
 * ledger: the ledger is the Codex and the rune shelf, both of which already hold
 * every find permanently. Ten covers "what did I miss overnight" for anyone
 * running five explorers, and stops the blob growing without a ceiling on a save
 * that a player might carry for a year.
 */
export const EXPEDITION_HISTORY_CAP = 10;

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
    history: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rolling
// ─────────────────────────────────────────────────────────────────────────────


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

  const reward: ExplorerReward = {
    // Endurance pays out here rather than by lengthening the clock. The stat is
    // published as "+10% max mission duration", and the honest reading of that
    // is "your explorers stay out longer and bring proportionally more back" —
    // but a stat that only made the player *wait* longer would be a downgrade
    // dressed as an upgrade, and nobody would spend a point on it. So the
    // duration the player picked is the duration they get, and the extra
    // distance covered is paid as extra loot.
    gold: Math.round((mission.goldMin + rng() * span) * yieldMult * profile.goldMultiplier),
    xp: Math.round(mission.xp * yieldMult * profile.xpMultiplier),
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
  const slots = Math.max(1, opts.inventorySlots ?? 1);
  const magicFind = Math.max(0, opts.lootBonus ?? 0);

  const runeChance = mission.runeChance * profile.runeChanceMultiplier;

  for (let i = 0; i < slots; i++) {
    if (rng() >= runeChance) continue;
    reward.runes.push(rollRuneWithMagicFind(magicFind, rng).id);
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
