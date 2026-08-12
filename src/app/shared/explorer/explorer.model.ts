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
import { rollRune } from '../rune-forge/rune.model';

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
 * play: the hour pays roughly 20× the two-minute run for 30× the time, and it
 * is the only mission where a scroll is genuinely likely. Someone who checks in
 * twice a day should out-earn someone who refreshes all afternoon.
 */
export const MISSIONS: MissionDefinition[] = [
  {
    id: 'scout',
    name: 'Scout',
    label: '2 min',
    flavour: 'To the edge of the light and back before the coals cool.',
    duration: 2 * 60_000,
    goldMin: 50,
    goldMax: 100,
    xp: 5,
    runeChance: 0.05,
  },
  {
    id: 'delve',
    name: 'Delve',
    label: '10 min',
    flavour: 'Far enough in that the way back has to be remembered.',
    duration: 10 * 60_000,
    goldMin: 200,
    goldMax: 500,
    xp: 25,
    runeChance: 0.15,
  },
  {
    id: 'expedition',
    name: 'Expedition',
    label: '1 hour',
    flavour: 'They pack for a week and are gone for an afternoon. Nobody has explained it.',
    duration: 60 * 60_000,
    goldMin: 1_000,
    goldMax: 3_000,
    xp: 120,
    runeChance: 0.30,
  },
];

const MISSION_BY_ID = new Map(MISSIONS.map(m => [m.id, m]));

export function missionById(id: MissionId | string): MissionDefinition | undefined {
  return MISSION_BY_ID.get(id as MissionId);
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

export interface Explorer {
  id: string;
  realm: RealmId;
  mission: MissionId;
  /** Milliseconds the mission runs for. Copied from the definition at dispatch
   *  so that retuning `MISSIONS` never shortens or extends a run already out. */
  duration: number;
  /** Epoch ms the explorer left. */
  startedAt: number;
}

export interface ExplorerReward {
  gold: number;
  xp: number;
  /** Rune id, when one was found. */
  rune?: string;
  /** Scroll id, when one was found. */
  scroll?: string;
}

/** A settled mission, held until the visitor has seen the loot reveal. */
export interface ExplorerReturn {
  explorer: Explorer;
  reward: ExplorerReward;
  /** Epoch ms the mission actually ended, which may be long before it settled. */
  returnedAt: number;
}

export interface ExplorerState {
  version: 1;
  /** Missions currently out. */
  active: Explorer[];
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
}

export function emptyExplorerState(): ExplorerState {
  return {
    version: 1,
    active: [],
    runesFound: 0,
    scrollsFound: 0,
    missionsCompleted: 0,
    goldRecovered: 0,
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
): ExplorerReward {
  const span = mission.goldMax - mission.goldMin;
  const reward: ExplorerReward = {
    gold: Math.round(mission.goldMin + rng() * span),
    xp: mission.xp,
  };

  // Runes come off the Rune Forge's own table, duplicates and all. Deduping
  // them would be actively wrong: a Runeword needs three Ber, so a second Ber
  // is the reward, not a consolation. `reward.scroll` is not set here — see the
  // Scrolls note above.
  if (rng() < mission.runeChance) {
    reward.rune = rollRune(rng).id;
  }

  return reward;
}

// ─────────────────────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Milliseconds left on a mission, floored at zero. */
export function remainingMs(explorer: Explorer, now: number): number {
  return Math.max(0, explorer.startedAt + explorer.duration - now);
}

/** 0–1 through the mission, for the progress ring. */
export function missionProgress(explorer: Explorer, now: number): number {
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
