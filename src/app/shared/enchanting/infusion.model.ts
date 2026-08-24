/**
 * infusion.model.ts — material enchantments: burn a stack, run a timer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THESE ARE CALLED INFUSIONS AND NOT ENCHANTMENTS
 * ─────────────────────────────────────────────────────────────────────────────
 * `economy.model.ts` already exports `Enchantment`, and it is a different
 * object: an Eclipse-Essence purchase from the Market that multiplies XP for a
 * day and deliberately does *not* stack with its siblings, because four
 * stacking 24-hour XP boosts makes the cheapest one the only one worth buying.
 *
 * These are the opposite in all three respects — paid for in materials the
 * gathering skills already produce, measured in hours rather than days, and
 * explicitly stackable up to three at once across different channels. Calling
 * both "enchantment" would mean every reader of the word has to ask which, and
 * the Market's copy would have to be rewritten to say which kind it sells. The
 * bench is still called the Enchanting Table; what it brews is an infusion.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THREE, AND WHY THEY DO NOT EXTEND
 * ─────────────────────────────────────────────────────────────────────────────
 * Three slots is the cap because the three channels — Gold, XP, Magic Find —
 * are the three things every other system in the game already multiplies, and a
 * fourth slot means running two infusions on the same channel, which turns the
 * decision "which do I want" into the non-decision "all of them".
 *
 * Re-brewing an infusion that is already running is refused rather than
 * extending its timer. Extending sounds friendlier and is worse: it makes the
 * optimal play "top up every ten minutes so nothing is ever wasted", which is
 * an alarm clock rather than a decision. Letting it lapse and re-brewing costs
 * exactly the materials it always cost.
 *
 * Pure data and pure functions — no browser APIs, safe on an SSR path.
 */

/** Which multiplier an infusion moves. One channel each — see the header. */
export type InfusionChannel = 'gold' | 'xp' | 'magicFind';

export interface InfusionInput {
  /** Stack key, as `InventoryService.stackOf` reads it. */
  materialId: string;
  count: number;
}

export interface Infusion {
  id: string;
  name: string;
  /** What the material is, in one line, for the card. */
  effect: string;
  flavour: string;
  icon: string;
  inputs: readonly InfusionInput[];
  /** Percentage points added to its channel. 10 is "+10%". */
  bonus: number;
  channel: InfusionChannel;
  /** How long it runs, in minutes. */
  minutes: number;
}

export const MAX_ACTIVE_INFUSIONS = 3;

const HOUR = 60;

/**
 * Five infusions across three channels.
 *
 * Every input is a material one of the three gathering skills already produces
 * or an expedition already brings home — nothing here needs a new drop source,
 * which is the point of paying for buffs in materials rather than in Gold. The
 * Heartstone is the exception that proves the rule: one Infernal Heartstone is
 * a rare enough find that a single unit buys the strongest Gold line in the
 * table for an hour.
 */
export const INFUSIONS: readonly Infusion[] = [
  {
    id: 'ember-infusion',
    name: 'Ember Infusion',
    effect: '+10% Gold/sec for 2 hours',
    flavour: 'Still warm. It has been still warm for four thousand years, and for the next two hours it is warm for you.',
    icon: '🔥',
    inputs: [{ materialId: 'ember-residue', count: 3 }],
    bonus: 10,
    channel: 'gold',
    minutes: 2 * HOUR,
  },
  {
    id: 'moonpetal-infusion',
    name: 'Moonpetal Infusion',
    effect: '+15% XP for 2 hours',
    flavour: 'It blooms only when the starlight is brightest, which the Archivum has never managed to schedule.',
    icon: '🌙',
    inputs: [{ materialId: 'moonpetal-herb', count: 3 }],
    bonus: 15,
    channel: 'xp',
    minutes: 2 * HOUR,
  },
  {
    id: 'void-infusion',
    name: 'Void Infusion',
    effect: '+25% Magic Find for 1 hour',
    flavour: 'Hold a piece of the thing the realms were carved out of and the realms start handing you their better objects. Nobody is sure this is gratitude.',
    icon: '🕳️',
    inputs: [{ materialId: 'void-shard', count: 2 }],
    bonus: 25,
    channel: 'magicFind',
    minutes: HOUR,
  },
  {
    id: 'heartstone-infusion',
    name: 'Heartstone Infusion',
    effect: '+20% Gold/sec for 1 hour',
    flavour: 'One Heartstone, one hour, and a furnace that behaves as though the Shattering had gone better.',
    icon: '❤️‍🔥',
    inputs: [{ materialId: 'infernal-heartstone', count: 1 }],
    bonus: 20,
    channel: 'gold',
    minutes: HOUR,
  },
  {
    id: 'prism-infusion',
    name: 'Prism Infusion',
    effect: '+12% XP for 90 minutes',
    flavour: 'The Luminous grind these for light. Ground finer, they turn out to sharpen attention as well, which the Luminous consider a waste of a prism.',
    icon: '💎',
    inputs: [{ materialId: 'luminous-prism', count: 3 }],
    bonus: 12,
    channel: 'xp',
    minutes: 90,
  },
];

const INFUSION_BY_ID = new Map(INFUSIONS.map(i => [i.id, i]));

export function infusionById(id: string): Infusion | undefined {
  return INFUSION_BY_ID.get(id);
}

/** One infusion the visitor is currently running. */
export interface ActiveInfusion {
  id: string;
  /** Epoch ms it was brewed. Drives the elapsed bar. */
  startedAt: number;
  /** Epoch ms it stops applying. */
  expiresAt: number;
}

export interface InfusionLedger {
  version: 1;
  active: ActiveInfusion[];
}

export function emptyInfusionLedger(): InfusionLedger {
  return { version: 1, active: [] };
}

/** Everything still running at `now`, soonest to expire first. */
export function liveInfusions(ledger: InfusionLedger, now: number): ActiveInfusion[] {
  return ledger.active
    .filter(row => infusionById(row.id) && row.expiresAt > now)
    .sort((a, b) => a.expiresAt - b.expiresAt);
}

/**
 * Percentage points running on one channel at `now`.
 *
 * Bonuses on the same channel add, which only happens between an Ember and a
 * Heartstone or a Moonpetal and a Prism. The sum becomes one multiplier at the
 * consumer, the same rule `totalBonus` uses for Runewords and for the same
 * reason: it is what the copy on the card promises.
 */
export function channelBonus(
  ledger: InfusionLedger,
  channel: InfusionChannel,
  now: number,
): number {
  let total = 0;
  for (const row of liveInfusions(ledger, now)) {
    const def = infusionById(row.id);
    if (def?.channel === channel) total += def.bonus;
  }
  return total;
}

/** The same figure as a multiplier. 1 when nothing is running on that channel. */
export function channelMultiplier(
  ledger: InfusionLedger,
  channel: InfusionChannel,
  now: number,
): number {
  return 1 + channelBonus(ledger, channel, now) / 100;
}

/** True when this exact infusion is already running. */
export function isRunning(ledger: InfusionLedger, id: string, now: number): boolean {
  return liveInfusions(ledger, now).some(row => row.id === id);
}

/** `1h 04m` / `48m` / `31s`. What the countdown prints. */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return '0s';
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

/**
 * Drop expired rows and anything the catalogue no longer has.
 *
 * Run on load and after every brew rather than left to accumulate: an `active`
 * array that only ever grows is a save blob that only ever grows, and a row for
 * an infusion that was retired from the table is a timer nobody can read.
 */
export function pruneInfusions(ledger: InfusionLedger, now: number): InfusionLedger {
  const active = ledger.active.filter(row => infusionById(row.id) && row.expiresAt > now);
  return active.length === ledger.active.length ? ledger : { ...ledger, active };
}

/** Parse a persisted blob. Anything malformed reads as an empty ledger. */
export function parseInfusionLedger(raw: unknown): InfusionLedger {
  if (!raw || typeof raw !== 'object') return emptyInfusionLedger();
  const rows = (raw as { active?: unknown }).active;
  if (!Array.isArray(rows)) return emptyInfusionLedger();
  const active: ActiveInfusion[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const { id, startedAt, expiresAt } = row as Record<string, unknown>;
    if (typeof id !== 'string' || !infusionById(id) || seen.has(id)) continue;
    if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) continue;
    seen.add(id);
    active.push({
      id,
      startedAt: typeof startedAt === 'number' && Number.isFinite(startedAt) ? startedAt : 0,
      expiresAt,
    });
  }
  return { version: 1, active };
}

/**
 * Merge two devices' infusion ledgers.
 *
 * Per id, the later expiry wins. A phone that brewed an Ember at noon and a
 * laptop that brewed one at one o'clock should leave the player with the one
 * that runs longest rather than with whichever device synced last — and the
 * union is capped at the same three, oldest-expiring dropped, so a merge cannot
 * hand back more slots than the bench will ever grant.
 */
export function mergeInfusionLedgers(remote: unknown, local: unknown): InfusionLedger {
  const a = parseInfusionLedger(remote);
  const b = parseInfusionLedger(local);
  const byId = new Map<string, ActiveInfusion>();
  for (const row of [...a.active, ...b.active]) {
    const held = byId.get(row.id);
    if (!held || row.expiresAt > held.expiresAt) byId.set(row.id, row);
  }
  const active = [...byId.values()]
    .sort((x, y) => y.expiresAt - x.expiresAt)
    .slice(0, MAX_ACTIVE_INFUSIONS);
  return { version: 1, active };
}
