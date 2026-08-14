/**
 * quest.model.ts — the mission board's data layer.
 *
 * Three ladders, each on its own clock:
 *
 *   daily   three of thirty, rerolled at local midnight
 *   weekly  two of eight, rerolled Monday
 *   epic    five, permanent, cleared once and never again
 *
 * The daily and weekly draws are deterministic: the pool index is chosen from a
 * hash of the date key, not from Math.random(). Two consequences that are both
 * deliberate — every visitor on 2026-08-12 is handed the same three quests, so
 * the board is something people can talk about; and the roll survives a reload,
 * a second tab and a cleared localStorage without ever handing out a fresh set
 * of unclaimed rewards.
 *
 * Pure data and pure functions only. No browser APIs, so this file is safe to
 * import from a server-rendered path.
 */
import { EclipseRarity } from '../rarity/rarity.model';
import { EnergyType } from '../gamification/gamification.model';
import { RealmId } from '../realms/realm.model';

export type QuestType = 'daily' | 'weekly' | 'epic' | 'realm';

export type QuestStatus = 'available' | 'active' | 'completed' | 'expired';

/**
 * How a quest knows it is done.
 *
 * The brief specified seven of these. The four extra — `page-variety`,
 * `speed-run`, `level` and `energy-balance` — exist because the epic and Verge
 * quests it also specified ("reach Level 5", "visit 10 different pages",
 * "complete 3 tools in under 5 minutes", "have Aether and Nox within 5% of each
 * other") cannot be expressed with the original seven.
 *
 * Conditions split into two families, and QuestService resolves them
 * differently:
 *
 *   counted   tool-use, tool-variety, page-variety, copy-count, arena-game,
 *             time-on-site, speed-run — read from the activity buckets that
 *             QuestWiringService fills. `progressKey()` below is the single
 *             place that decides which bucket, so the writer and the reader can
 *             never disagree about a key.
 *
 *   derived   streak, level, achievement, energy-balance — read live off the
 *             XP ledger. Nothing to record; the answer is already in state.
 */
export type QuestConditionType =
  | 'tool-use'
  | 'tool-variety'
  | 'realm-spread'
  | 'page-variety'
  | 'page-visit'
  | 'copy-count'
  | 'arena-game'
  | 'time-on-site'
  | 'speed-run'
  | 'streak'
  | 'level'
  | 'achievement'
  | 'energy-balance';

export interface QuestCondition {
  type: QuestConditionType;
  /** Restrict to one tool. */
  toolSlug?: string;
  /** Or to any tool in a registry category. */
  category?: string;
  /** Or to any tool in a realm — broader than a category, since a realm spans several. */
  realm?: RealmId;
  /**
   * For `page-visit`: the exact routes that must be stood on. `count` must
   * equal this length, so a quest can never ask for more places than it names.
   */
  paths?: string[];
  /**
   * Only count work done inside a slice of the day. `night` is 22:00–04:00 and
   * `dawn` is 04:00–07:00, both in the visitor's local time, because a quest
   * about working late is about *their* late.
   */
  window?: 'night' | 'dawn';
  /** For `speed-run`: the number of distinct tools must land inside this many minutes. */
  withinMinutes?: number;
  /** The target. Progress is `min(observed, count) / count`. */
  count: number;
}

export interface QuestReward {
  xp: number;
  /**
   * Which energy the XP feeds. Omitted means the award is split by whatever the
   * quest's realm feeds, falling back to Aether — see `rewardEnergy()`.
   */
  energy?: EnergyType;
  /** Banks an achievement id on completion, so the epics leave a permanent mark. */
  achievement?: string;
  /** A line of codex text revealed in the claim toast. */
  loreFragment?: string;
}

/** The authored shape. Everything here is a constant; nothing is per-visitor. */
export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  /** Flavour, shown in italics under the title. This is the reason to read the card. */
  loreText: string;
  type: QuestType;
  realm?: RealmId;
  condition: QuestCondition;
  rewards: QuestReward;
  rarity: EclipseRarity;
}

/** The runtime shape: an authored quest plus this visitor's standing against it. */
export interface Quest extends QuestDefinition {
  status: QuestStatus;
  /** 0–100, for the bar. */
  progress: number;
  /** Raw observed count, for the "2/3 shadows forged" line. */
  observed: number;
  /** True once the reward has been banked. */
  claimed: boolean;
  /** ISO instant the daily/weekly board this quest sits on rolls over. */
  expiresAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bucket keys
// ─────────────────────────────────────────────────────────────────────────────

/** A tally counts events; a set counts distinct members. */
export type BucketKind = 'tally' | 'set';

export interface BucketAddress {
  kind: BucketKind;
  key: string;
}

/**
 * The bucket a counted condition reads from — and, called with the same shape
 * from the wiring service, the bucket an event writes to.
 *
 * Returns null for the derived conditions, which have no bucket at all.
 */
export function progressKey(c: QuestCondition): BucketAddress | null {
  const w = c.window ? `|${c.window}` : '';
  switch (c.type) {
    case 'tool-use':
      if (c.toolSlug) return { kind: 'tally', key: `use:${c.toolSlug}${w}` };
      if (c.category) return { kind: 'tally', key: `use:cat:${c.category}${w}` };
      if (c.realm) return { kind: 'tally', key: `use:realm:${c.realm}${w}` };
      return { kind: 'tally', key: `use:*${w}` };
    case 'tool-variety':
      if (c.category) return { kind: 'set', key: `var:cat:${c.category}` };
      if (c.realm) return { kind: 'set', key: `var:realm:${c.realm}` };
      return { kind: 'set', key: 'var:*' };
    case 'realm-spread':
      return { kind: 'set', key: 'realms' };
    case 'page-variety':
    case 'page-visit':
      // Both read the same set of visited paths. `page-variety` counts its
      // size; `page-visit` counts how many of its named paths are members.
      return { kind: 'set', key: 'pages' };
    case 'copy-count':
      return { kind: 'tally', key: 'copy' };
    case 'arena-game':
      return { kind: 'set', key: 'arena' };
    case 'time-on-site':
      return { kind: 'tally', key: 'minutes' };
    case 'speed-run':
      return { kind: 'tally', key: `speed:${c.count}x${c.withinMinutes ?? 5}` };
    default:
      return null;
  }
}

/** Which energy a quest's XP feeds, resolved from an explicit reward or its realm. */
export function rewardEnergy(quest: QuestDefinition): EnergyType {
  if (quest.rewards.energy) return quest.rewards.energy;
  return quest.realm === 'umbral' || quest.realm === 'verge' ? 'nox' : 'aether';
}

// ─────────────────────────────────────────────────────────────────────────────
// Date keys and the deterministic draw
// ─────────────────────────────────────────────────────────────────────────────

/** Local YYYY-MM-DD. Local, not UTC — midnight should be the visitor's midnight. */
export function dayKey(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Local ISO-ish week key, `YYYY-Www`, with weeks starting Monday.
 *
 * Computed by walking back to the Monday of the current week and keying on that
 * date rather than by counting weeks from January 1. Year boundaries are where
 * hand-rolled week numbering goes wrong, and "the Monday this week began" is
 * both unambiguous and exactly what the weekly board resets on.
 */
export function weekKey(d: Date = new Date()): string {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // getDay(): 0 = Sunday. Sunday belongs to the week that began six days ago.
  const back = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - back);
  return `W${dayKey(monday)}`;
}

/** Midnight tonight, local, as an ISO instant. The daily board's expiry. */
export function nextMidnight(d: Date = new Date()): string {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return next.toISOString();
}

/** 00:00 next Monday, local, as an ISO instant. The weekly board's expiry. */
export function nextMonday(d: Date = new Date()): string {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const ahead = (8 - next.getDay()) % 7 || 7;
  next.setDate(next.getDate() + ahead);
  return next.toISOString();
}

/** FNV-1a, 32-bit. Small, dependency-free, and well-spread over short strings. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Pick `n` distinct entries from `pool`, chosen only by `seed`.
 *
 * Walks the pool from a hashed starting offset in a hashed co-prime stride, so
 * the picks are spread across the pool rather than clustered, and the same seed
 * always yields the same set. A stride co-prime with the length guarantees the
 * walk visits every index before repeating, which is what makes "distinct"
 * true without a rejection loop.
 */
export function pickDeterministic<T>(pool: readonly T[], n: number, seed: string): T[] {
  if (pool.length === 0 || n <= 0) return [];
  if (n >= pool.length) return [...pool];

  const h = hash32(seed);
  const start = h % pool.length;
  // Force odd, then walk up until it shares no factor with the pool length.
  let stride = ((h >>> 8) % pool.length) | 1;
  while (gcd(stride, pool.length) !== 1) stride++;

  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(pool[(start + i * stride) % pool.length]);
  return out;
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────
// The daily pool — thirty quests, three drawn a day
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thirty is the number that matters here: at three a day, a visitor sees the
 * same quest roughly once every ten days, which is long enough that it reads as
 * a rotation rather than a loop.
 *
 * Targets are deliberately small. A daily quest that cannot be finished in one
 * sitting is not a daily quest, it is a chore with a countdown on it.
 */
export const DAILY_QUESTS: QuestDefinition[] = [
  // ── Luminous ── light, surface, the making of visible things.
  {
    id: 'forge-three-shadows',
    title: 'Forge Three Shadows',
    description: 'Shape three shadows in the Shadow Weaver\'s Loom.',
    loreText: 'The Luminous smiths need three anchors before a shadow will hold its shape. Two drift. Four fight.',
    type: 'daily',
    realm: 'luminous',
    condition: { type: 'tool-use', toolSlug: 'box-shadow-generator', count: 3 },
    rewards: { xp: 20, energy: 'aether' },
    rarity: 'mortal',
  },
  {
    id: 'paint-the-spectrum',
    title: 'Paint the Spectrum',
    description: 'Draw five palettes from the Prismatic Sanctum.',
    loreText: 'Colour is the oldest argument in the realms. Everyone thinks they have settled it; nobody has.',
    type: 'daily',
    realm: 'luminous',
    condition: { type: 'tool-use', toolSlug: 'color-palette', count: 5 },
    rewards: { xp: 15, energy: 'aether' },
    rarity: 'mortal',
  },
  {
    id: 'shape-the-light',
    title: 'Shape the Light',
    description: 'Work in three different Luminous tools.',
    loreText: 'A smith who knows one hammer knows one shape. The Loom is patient with beginners and merciless with the incurious.',
    type: 'daily',
    realm: 'luminous',
    condition: { type: 'tool-variety', realm: 'luminous', count: 3 },
    rewards: { xp: 25, energy: 'aether' },
    rarity: 'eclipsed',
  },
  {
    id: 'the-gradient-path',
    title: 'The Gradient Path',
    description: 'Lay three gradients across the Aurora Bridge.',
    loreText: 'Nothing in the Luminous realm changes all at once. The bridge is the proof: one colour becomes another and no one can say where.',
    type: 'daily',
    realm: 'luminous',
    condition: { type: 'tool-use', toolSlug: 'gradient-generator', count: 3 },
    rewards: { xp: 20, energy: 'aether' },
    rarity: 'mortal',
  },
  {
    id: 'typography-ritual',
    title: 'Typography Ritual',
    description: 'Pair three sets of letterforms.',
    loreText: 'Two voices in one sentence. Get it wrong and the reader hears an argument instead of a line.',
    type: 'daily',
    realm: 'luminous',
    condition: { type: 'tool-use', toolSlug: 'font-pairer', count: 3 },
    rewards: { xp: 15, energy: 'aether' },
    rarity: 'mortal',
  },
  {
    id: 'the-measured-eye',
    title: 'The Measured Eye',
    description: 'Test three colour pairs for contrast.',
    loreText: 'The Luminous keep one law above the rest: light that cannot be read by everyone is not light, it is decoration.',
    type: 'daily',
    realm: 'luminous',
    condition: { type: 'tool-use', toolSlug: 'contrast-checker', count: 3 },
    rewards: { xp: 20, energy: 'aether' },
    rarity: 'eclipsed',
  },
  {
    id: 'the-lattice-rite',
    title: 'The Lattice Rite',
    description: 'Raise three grids or flex frames.',
    loreText: 'Every hall in the Luminous vaults stands on an invisible lattice. Walk carelessly and you will still be walking its lines.',
    type: 'daily',
    realm: 'luminous',
    condition: { type: 'tool-variety', category: 'CSS Tools', count: 3 },
    rewards: { xp: 20, energy: 'aether' },
    rarity: 'mortal',
  },
  {
    id: 'the-motion-vow',
    title: 'The Motion Vow',
    description: 'Compose three animations or transitions.',
    loreText: 'Movement is a promise about where a thing came from. Break the promise and the eye stops trusting the room.',
    type: 'daily',
    realm: 'luminous',
    condition: { type: 'tool-use', toolSlug: 'animation-generator', count: 3 },
    rewards: { xp: 20, energy: 'aether' },
    rarity: 'eclipsed',
  },

  // ── Umbral ── secrets, keys, the things that must not be read.
  {
    id: 'decode-the-cipher',
    title: 'Decode the Cipher',
    description: 'Turn three strings through the Cipher Stone.',
    loreText: 'Base64 hides nothing. That is the joke the Nocturne never tire of: the most common lock in the realms has no key at all.',
    type: 'daily',
    realm: 'umbral',
    condition: { type: 'tool-use', toolSlug: 'base64-encoder', count: 3 },
    rewards: { xp: 20, energy: 'nox' },
    rarity: 'mortal',
  },
  {
    id: 'forge-a-shield',
    title: 'Forge a Shield',
    description: 'Inspect two certificates.',
    loreText: 'A ward is only as good as the day it expires. The Nocturne have lost more ground to forgotten dates than to any siege.',
    type: 'daily',
    realm: 'umbral',
    condition: { type: 'tool-use', toolSlug: 'ssl-certificate-inspector', count: 2 },
    rewards: { xp: 15, energy: 'nox' },
    rarity: 'mortal',
  },
  {
    id: 'hash-the-shadows',
    title: 'Hash the Shadows',
    description: 'Cast five digests in the Soul Furnace.',
    loreText: 'The furnace takes anything and returns the same length of nothing. Feed it a name and you cannot get the name back — only proof you once had it.',
    type: 'daily',
    realm: 'umbral',
    condition: { type: 'tool-use', toolSlug: 'hash-generator', count: 5 },
    rewards: { xp: 20, energy: 'nox' },
    rarity: 'mortal',
  },
  {
    id: 'the-regex-incantation',
    title: 'The Regex Incantation',
    description: 'Write three patterns.',
    loreText: 'Speak it wrong and it matches everything. Speak it right and it matches only what you meant. There is no third outcome.',
    type: 'daily',
    realm: 'umbral',
    condition: { type: 'tool-use', toolSlug: 'regex-builder', count: 3 },
    rewards: { xp: 25, energy: 'nox' },
    rarity: 'eclipsed',
  },
  {
    id: 'inspect-the-wards',
    title: 'Inspect the Wards',
    description: 'Audit a domain\'s mail defences.',
    loreText: 'SPF, DKIM, DMARC — three seals on one door. The Nexus couriers will tell you which is missing; they will not tell you twice.',
    type: 'daily',
    realm: 'nexus',
    condition: { type: 'tool-use', toolSlug: 'email-deliverability-auditor', count: 1 },
    rewards: { xp: 15, energy: 'nox' },
    rarity: 'mortal',
  },
  {
    id: 'the-vault-turning',
    title: 'The Vault Turning',
    description: 'Draw three keys from the Vault of Infinite Keys.',
    loreText: 'The vault has no lock and no door. It has never run out. Nobody has ever drawn the same key twice, and nobody has ever proved it.',
    type: 'daily',
    realm: 'umbral',
    condition: { type: 'tool-use', toolSlug: 'password-generator', count: 3 },
    rewards: { xp: 20, energy: 'nox' },
    rarity: 'mortal',
  },
  {
    id: 'read-the-sealed-token',
    title: 'Read the Sealed Token',
    description: 'Break open two tokens and read what they claim.',
    loreText: 'Every token carries its own account of who sent it. The Nocturne read them the way a border guard reads a passport: politely, and without believing a word.',
    type: 'daily',
    realm: 'umbral',
    condition: { type: 'tool-use', toolSlug: 'jwt-decoder', count: 2 },
    rewards: { xp: 20, energy: 'nox' },
    rarity: 'eclipsed',
  },
  {
    id: 'walk-the-shadow-roads',
    title: 'Walk the Shadow Roads',
    description: 'Work in three different Umbral tools.',
    loreText: 'No one is initiated in a single night. The Nocturne count arrivals, not intentions.',
    type: 'daily',
    realm: 'umbral',
    condition: { type: 'tool-variety', realm: 'umbral', count: 3 },
    rewards: { xp: 25, energy: 'nox' },
    rarity: 'eclipsed',
  },
  {
    id: 'the-name-lookup',
    title: 'The Name Lookup',
    description: 'Trace two names back to their addresses.',
    loreText: 'Names are a courtesy the realms extend to each other. Underneath, everything is a number, and the numbers do not lie about where they live.',
    type: 'daily',
    realm: 'umbral',
    condition: { type: 'tool-use', toolSlug: 'dns-lookup', count: 2 },
    rewards: { xp: 15, energy: 'nox' },
    rarity: 'mortal',
  },

  // ── Verge ── translation, the unstable border where forms change.
  {
    id: 'restore-the-crystals',
    title: 'Restore the Crystals',
    description: 'Repair three malformed structures.',
    loreText: 'The Shattering left the archives full of half-sentences. A missing brace is not a small thing to the Scribes; it is a door that will not close.',
    type: 'daily',
    realm: 'verge',
    condition: { type: 'tool-use', toolSlug: 'json-formatter', count: 3 },
    rewards: { xp: 20, energy: 'nox' },
    rarity: 'mortal',
  },
  {
    id: 'the-translators-toll',
    title: 'The Translator\'s Toll',
    description: 'Work in three different Verge tools.',
    loreText: 'Nothing crosses the Verge unchanged. The toll is always paid in precision, and it is always paid by whoever comes after you.',
    type: 'daily',
    realm: 'verge',
    condition: { type: 'tool-variety', realm: 'verge', count: 3 },
    rewards: { xp: 25, energy: 'nox' },
    rarity: 'eclipsed',
  },
  {
    id: 'the-shape-of-truth',
    title: 'The Shape of Truth',
    description: 'Convert two documents between forms.',
    loreText: 'YAML and JSON describe the same world. They disagree only about how much whitespace a truth is worth.',
    type: 'daily',
    realm: 'verge',
    condition: { type: 'tool-use', toolSlug: 'yaml-json', count: 2 },
    rewards: { xp: 20, energy: 'nox' },
    rarity: 'mortal',
  },
  {
    id: 'the-difference-engine',
    title: 'The Difference Engine',
    description: 'Set two texts against each other.',
    loreText: 'The Verge keeps no originals, only differences. Ask what a thing was and it will tell you what changed.',
    type: 'daily',
    realm: 'verge',
    condition: { type: 'tool-use', toolSlug: 'diff-checker', count: 2 },
    rewards: { xp: 20, energy: 'nox' },
    rarity: 'mortal',
  },

  // ── Archivum ── record, count, the keeping of things.
  {
    id: 'the-identity-draw',
    title: 'The Identity Draw',
    description: 'Draw five identifiers from the Well.',
    loreText: 'The Well has given a name to every thing that has ever needed one, and has never once repeated itself. The Archivum finds this reassuring. The Nocturne find it suspicious.',
    type: 'daily',
    realm: 'archivum',
    condition: { type: 'tool-use', toolSlug: 'uuid-generator', count: 5 },
    rewards: { xp: 15, energy: 'aether' },
    rarity: 'mortal',
  },
  {
    id: 'the-essence-toll',
    title: 'The Essence Toll',
    description: 'Distil three images.',
    loreText: 'Every image carries more than it needs. The Distillery takes the excess and asks, each time, whether you can still tell what you have lost.',
    type: 'daily',
    realm: 'archivum',
    condition: { type: 'tool-use', toolSlug: 'image-compressor', count: 3 },
    rewards: { xp: 20, energy: 'aether' },
    rarity: 'mortal',
  },
  {
    id: 'the-scribes-hour',
    title: 'The Scribe\'s Hour',
    description: 'Work in three different Archivum tools.',
    loreText: 'The archive does not reward brilliance. It rewards showing up, filing correctly, and being findable in a hundred years.',
    type: 'daily',
    realm: 'archivum',
    condition: { type: 'tool-variety', realm: 'archivum', count: 3 },
    rewards: { xp: 25, energy: 'aether' },
    rarity: 'eclipsed',
  },

  // ── Verge-agnostic wanderer quests — any realm, any road.
  {
    id: 'the-wanderers-path',
    title: 'The Wanderer\'s Path',
    description: 'Use five different tools.',
    loreText: 'A Wanderer belongs to no realm, which is the only rank that can walk into all five without being asked why.',
    type: 'daily',
    condition: { type: 'tool-variety', count: 5 },
    rewards: { xp: 30 },
    rarity: 'eclipsed',
  },
  {
    id: 'copy-merchant',
    title: 'Copy Merchant',
    description: 'Carry ten outputs out of the realms.',
    loreText: 'The merchants take nothing and leave nothing. They only move things, which the realms have never decided how to feel about.',
    type: 'daily',
    condition: { type: 'copy-count', count: 10 },
    rewards: { xp: 15 },
    rarity: 'mortal',
  },
  {
    id: 'speed-forging',
    title: 'Speed Forging',
    description: 'Work three tools within five minutes.',
    loreText: 'The old smiths worked cold and slow. The Convergents work hot, and lose more, and finish.',
    type: 'daily',
    condition: { type: 'speed-run', count: 3, withinMinutes: 5 },
    rewards: { xp: 25 },
    rarity: 'sacred',
  },
  {
    id: 'the-explorer',
    title: 'The Explorer',
    description: 'Stand in five different halls.',
    loreText: 'Maps are drawn by people who walked further than they were asked to.',
    type: 'daily',
    condition: { type: 'page-variety', count: 5 },
    rewards: { xp: 20 },
    rarity: 'eclipsed',
  },
  {
    id: 'night-shift',
    title: 'Night Shift',
    description: 'Work any tool after 22:00.',
    loreText: 'The Nocturne did not choose the night. They were simply the ones still working when the light went.',
    type: 'daily',
    realm: 'umbral',
    condition: { type: 'tool-use', window: 'night', count: 1 },
    rewards: { xp: 15, energy: 'nox' },
    rarity: 'eclipsed',
  },
  {
    id: 'dawn-patrol',
    title: 'Dawn Patrol',
    description: 'Work any tool before 07:00.',
    loreText: 'The first light of the broken Sun falls on whoever is already standing. It has no opinion about how they slept.',
    type: 'daily',
    realm: 'luminous',
    condition: { type: 'tool-use', window: 'dawn', count: 1 },
    rewards: { xp: 15, energy: 'aether' },
    rarity: 'eclipsed',
  },
  {
    id: 'the-long-vigil',
    title: 'The Long Vigil',
    description: 'Spend ten minutes in the realms.',
    loreText: 'Not every rank is earned by doing. Some are earned by staying.',
    type: 'daily',
    condition: { type: 'time-on-site', count: 10 },
    rewards: { xp: 20 },
    rarity: 'mortal',
  },

  // ── Game halls — the public product after the tool pages were retired. ──
  {
    id: 'walk-the-world',
    title: 'Walk the World',
    description: 'Stand on the World map.',
    loreText: 'Every road in the five realms starts at the same table. The map does not care which one you take first.',
    type: 'daily',
    condition: { type: 'page-visit', paths: ['/world'], count: 1 },
    rewards: { xp: 15 },
    rarity: 'mortal',
  },
  {
    id: 'face-the-keeper',
    title: 'Face the Keeper',
    description: 'Open your character sheet.',
    loreText: 'The chamber writes down whoever walks in. That is the whole of the rite.',
    type: 'daily',
    condition: { type: 'page-visit', paths: ['/character'], count: 1 },
    rewards: { xp: 15 },
    rarity: 'mortal',
  },
  {
    id: 'strike-the-anvil',
    title: 'Strike the Anvil',
    description: 'Enter the Forge.',
    loreText: 'The anvil does not ask what you came to make. It only asks that you stand close enough to hear it.',
    type: 'daily',
    condition: { type: 'page-visit', paths: ['/forge/runes'], count: 1 },
    rewards: { xp: 20 },
    rarity: 'eclipsed',
  },
  {
    id: 'enter-the-trials',
    title: 'Enter the Trials',
    description: 'Walk the Arena gates.',
    loreText: 'Thirteen doors, and none of them open from the outside. Standing in front of them is still a kind of answer.',
    type: 'daily',
    condition: { type: 'page-visit', paths: ['/world/trials'], count: 1 },
    rewards: { xp: 20 },
    rarity: 'eclipsed',
  },
  {
    id: 'read-the-orders',
    title: 'Read the Orders',
    description: 'Open the standing orders.',
    loreText: 'The board is posted whether anyone reads it or not. The Archivum counts the ones who do.',
    type: 'daily',
    condition: { type: 'page-visit', paths: ['/world/quests'], count: 1 },
    rewards: { xp: 15 },
    rarity: 'mortal',
  },
  {
    id: 'visit-the-market',
    title: 'Visit the Market',
    description: 'Walk the market aisle.',
    loreText: 'Nothing here is free, and nothing here is required. That is why the merchants stay.',
    type: 'daily',
    condition: { type: 'page-visit', paths: ['/market'], count: 1 },
    rewards: { xp: 15 },
    rarity: 'mortal',
  },
  {
    id: 'open-the-codex',
    title: 'Open the Codex',
    description: 'Open the ancient record.',
    loreText: 'The Codex does not care whether you came to remember or to look for what you have not found yet.',
    type: 'daily',
    condition: { type: 'page-visit', paths: ['/codex'], count: 1 },
    rewards: { xp: 15 },
    rarity: 'mortal',
  },
  {
    id: 'one-gate',
    title: 'One Gate',
    description: 'Enter any Arena gate.',
    loreText: 'The first chain is the only one that feels like a lock. The rest feel like doors you already know how to open.',
    type: 'daily',
    condition: { type: 'arena-game', count: 1 },
    rewards: { xp: 25 },
    rarity: 'eclipsed',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// The weekly pool — eight quests, two drawn a week
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Weeklies are the ones you cannot finish by accident. Every target here needs
 * more than one sitting, which is the whole point: the daily board is a habit,
 * the weekly board is a reason to keep the habit.
 */
export const WEEKLY_QUESTS: QuestDefinition[] = [
  {
    id: 'realm-mastery-luminous',
    title: 'Realm Mastery: Luminous',
    description: 'Work twelve Luminous tools this week.',
    loreText: 'To master a realm is not to have seen it. It is to have left fingerprints on enough of it that the realm knows your hands.',
    type: 'weekly',
    realm: 'luminous',
    condition: { type: 'tool-variety', realm: 'luminous', count: 12 },
    rewards: { xp: 100, energy: 'aether' },
    rarity: 'sacred',
  },
  {
    id: 'realm-mastery-umbral',
    title: 'Realm Mastery: Umbral',
    description: 'Work six Umbral tools this week.',
    loreText: 'The Umbral realm is small and does not apologise for it. Every door in it leads somewhere you were not supposed to go.',
    type: 'weekly',
    realm: 'umbral',
    condition: { type: 'tool-variety', realm: 'umbral', count: 6 },
    rewards: { xp: 100, energy: 'nox' },
    rarity: 'sacred',
  },
  {
    id: 'the-full-circuit',
    title: 'The Full Circuit',
    description: 'Use twenty-five different tools this week.',
    loreText: 'Twenty-five is the number the Archivum settled on after an argument that lasted a century. Nobody remembers why. Everybody honours it.',
    type: 'weekly',
    condition: { type: 'tool-variety', count: 25 },
    rewards: { xp: 150 },
    rarity: 'anomalous',
  },
  {
    id: 'arena-champion',
    title: 'Arena Champion',
    description: 'Clear three different Arena games.',
    loreText: 'Thirteen gates, each chained by a secret. The chain is not the test. What is behind it is the test.',
    type: 'weekly',
    condition: { type: 'arena-game', count: 3 },
    rewards: { xp: 75 },
    rarity: 'sacred',
  },
  {
    id: 'streak-keeper',
    title: 'Streak Keeper',
    description: 'Hold a seven-day streak.',
    loreText: 'The realms do not care how hard you worked on one day. They count the days you came back, and they count them out loud.',
    type: 'weekly',
    condition: { type: 'streak', count: 7 },
    rewards: { xp: 100 },
    rarity: 'anomalous',
  },
  {
    id: 'the-architects-eye',
    title: 'The Architect\'s Eye',
    description: 'Walk the World and open the Codex.',
    loreText: 'Two rooms nobody is required to enter. The Archivum has always held that the people who enter them anyway are the ones worth watching.',
    type: 'weekly',
    condition: { type: 'page-visit', paths: ['/world', '/codex'], count: 2 },
    rewards: { xp: 50, energy: 'aether' },
    rarity: 'sacred',
  },
  {
    id: 'the-copyists-week',
    title: 'The Copyist\'s Week',
    description: 'Carry fifty outputs out of the realms.',
    loreText: 'Somewhere there is a ledger of everything ever taken from the archive. It is longer than the archive.',
    type: 'weekly',
    condition: { type: 'copy-count', count: 50 },
    rewards: { xp: 75 },
    rarity: 'sacred',
  },
  {
    id: 'the-crossing',
    title: 'The Crossing',
    description: 'Work tools in four of the five realms.',
    loreText: 'The Convergents are not loved in any realm. They are, however, the only ones who can be sent to all of them.',
    type: 'weekly',
    condition: { type: 'realm-spread', count: 4 },
    rewards: { xp: 120 },
    rarity: 'anomalous',
  },
  {
    id: 'walk-the-five-stations',
    title: 'Walk the Five Stations',
    description: 'Visit World, Character, the Forge, Quests and the Trials.',
    loreText: 'Five rooms, one week. The Convergents call it a circuit. Everyone else calls it showing up.',
    type: 'weekly',
    condition: {
      type: 'page-visit',
      paths: ['/world', '/character', '/forge/runes', '/world/quests', '/world/trials'],
      count: 5,
    },
    rewards: { xp: 80 },
    rarity: 'sacred',
  },
  {
    id: 'the-long-week',
    title: 'The Long Week',
    description: 'Spend sixty minutes in the realms this week.',
    loreText: 'A week is long enough to stop pretending you were only passing through.',
    type: 'weekly',
    condition: { type: 'time-on-site', count: 60 },
    rewards: { xp: 75 },
    rarity: 'sacred',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// The epics — five, permanent, no clock
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The epics are the only quests with no expiry, which means they are the only
 * ones whose progress is read from lifetime state rather than a bucket that
 * gets wiped. Clearing one banks an achievement id on the XP ledger, so it
 * survives everything short of a reset.
 */
export const EPIC_QUESTS: QuestDefinition[] = [
  {
    id: 'the-convergents-trial',
    title: 'The Convergent\'s Trial',
    description: 'Reach Level 5 — Convergent.',
    loreText: 'There is no ceremony. One morning the guards at both borders stop asking which realm you serve, and you understand that the answer has stopped being useful to them.',
    type: 'epic',
    condition: { type: 'level', count: 5 },
    rewards: {
      xp: 500,
      achievement: 'quest-convergent-trial',
      loreFragment: 'The Convergents were never a faction. They were an accounting error that learned to walk.',
    },
    rarity: 'sacred',
  },
  {
    id: 'master-of-light',
    title: 'Master of Light',
    description: 'Work twenty-five Luminous tools.',
    loreText: 'The Loom keeps a list of every pair of hands that has touched it. It is not a short list. It is not a long one either.',
    type: 'epic',
    realm: 'luminous',
    condition: { type: 'tool-variety', realm: 'luminous', count: 25 },
    rewards: {
      xp: 300,
      energy: 'aether',
      achievement: 'quest-master-of-light',
      loreFragment: 'Light does not belong to the Luminous. They were only the first to write down how it behaves.',
    },
    rarity: 'sacred',
  },
  {
    id: 'shadow-adept',
    title: 'Shadow Adept',
    description: 'Work eight Umbral tools.',
    loreText: 'The Nocturne do not initiate. They notice, eventually, that you have stopped needing to be told where things are.',
    type: 'epic',
    realm: 'umbral',
    condition: { type: 'tool-variety', realm: 'umbral', count: 8 },
    rewards: {
      xp: 300,
      energy: 'nox',
      achievement: 'quest-shadow-adept',
      loreFragment: 'Every lock in the Umbral realm was built by someone who wanted, one day, to be let back in.',
    },
    rarity: 'sacred',
  },
  {
    id: 'the-balance',
    title: 'The Balance',
    description: 'Hold Aether and Nox within five percent of each other, past 1000 XP.',
    loreText: 'The Eclipse was not light defeating shadow, or shadow swallowing light. It was the one moment they were the same size, and it lasted four minutes.',
    type: 'epic',
    condition: { type: 'energy-balance', count: 5 },
    rewards: {
      xp: 200,
      achievement: 'quest-the-balance',
      loreFragment: 'Balance is not a resting state. It is a crossing, and you are only ever in it on the way to somewhere else.',
    },
    rarity: 'anomalous',
  },
  {
    id: 'godforge-keeper',
    title: 'Godforge Keeper',
    description: 'Reach Level 8 — Godforge Keeper.',
    loreText: 'The Godforge has had four keepers. Three of them left notes. The notes disagree about what the Godforge is.',
    type: 'epic',
    condition: { type: 'level', count: 8 },
    rewards: {
      xp: 1000,
      achievement: 'quest-godforge-keeper',
      loreFragment: 'The forge does not make things. It makes the conditions under which things can be made. This is a distinction the fourth keeper died insisting on.',
    },
    rarity: 'mythic',
  },
];

/** Every authored quest, for lookups by id. */
export const ALL_QUESTS: QuestDefinition[] = [
  ...DAILY_QUESTS,
  ...WEEKLY_QUESTS,
  ...EPIC_QUESTS,
];

export function questById(id: string): QuestDefinition | undefined {
  return ALL_QUESTS.find(q => q.id === id);
}

/**
 * True when a quest can be finished on a live game route.
 *
 * Tool-use, tool-variety, realm-spread and speed-run all required /tools/*
 * pages that no longer exist. Those authored quests stay in the pools for
 * save-history lookups, but they are not drawn onto the public board.
 */
export function isPlayableQuest(def: QuestDefinition): boolean {
  const retired: QuestConditionType[] = ['tool-use', 'tool-variety', 'realm-spread', 'speed-run'];
  if (retired.includes(def.condition.type)) return false;
  return !(def.condition.paths ?? []).some(path =>
    path === '/tools' || path.startsWith('/tools/') || path === '/blueprint' || path === '/embed');
}

export const PLAYABLE_DAILY_QUESTS = DAILY_QUESTS.filter(isPlayableQuest);
export const PLAYABLE_WEEKLY_QUESTS = WEEKLY_QUESTS.filter(isPlayableQuest);
export const PLAYABLE_EPIC_QUESTS = EPIC_QUESTS.filter(isPlayableQuest);

/** How many dailies and weeklies the board shows. */
export const DAILY_SLOTS = 3;
export const WEEKLY_SLOTS = 2;
