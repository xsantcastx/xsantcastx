/**
 * npc.model.ts — the six who speak, and what they say where.
 *
 * Eclipse Realms had places, items and quests before it had anybody standing in
 * them. This file is the cast: six named characters, each anchored to the
 * surfaces they belong on, each with a pool of lines that is filtered by where
 * the visitor is, what they have done, and what time it is for them.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A TRIGGER TABLE RATHER THAN A METHOD PER NPC
 * ─────────────────────────────────────────────────────────────────────────────
 * The obvious shape is `aurethLineFor(state)` — a function per character that
 * branches. It does not survive contact with the second condition: every new
 * axis (time of day, an equipped item, a live quest) multiplies the branches in
 * six places at once, and the only way to know what Verrin says at night on the
 * Codex is to read a function and simulate it.
 *
 * A flat table of triggers inverts that. Each row states its own preconditions
 * and its own lines, rows are independent, and choosing what to say is one sort
 * by priority and one filter — which means adding a line is adding data, and the
 * spec can assert things about the whole cast at once (every NPC has enough
 * lines; every trigger names a real NPC; no trigger is unreachable).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PURE DATA
 * ─────────────────────────────────────────────────────────────────────────────
 * No browser APIs and no Angular, so this is safe to import from an SSR path and
 * the whole selection pipeline is testable without a DOM. `timeOfDayAt()` takes
 * its clock as an argument for the same reason.
 */
export type NpcId =
  | 'aureth'
  | 'verrin'
  | 'kael'
  | 'archivist'
  | 'merchant'
  | 'nameless';

/** Local slices of the day. Dawn is deliberately narrow; it should feel rare. */
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * Which slice of the day it is, in the visitor's own local time.
 *
 * Takes a Date rather than reading the clock so the spec can pin every boundary
 * and so an SSR render cannot bake one visitor's evening into everybody's HTML.
 */
export function timeOfDayAt(d: Date = new Date()): TimeOfDay {
  const h = d.getHours();
  if (h < 5) return 'night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 22) return 'evening';
  return 'night';
}

// ─────────────────────────────────────────────────────────────────────────────
// The cast
// ─────────────────────────────────────────────────────────────────────────────

export interface NpcDefinition {
  id: NpcId;
  /** The name on the speech bubble. */
  name: string;
  /** The half after the comma — "the Radiant". Shown under the name when expanded. */
  epithet: string;
  /** One line of who this is, for the expanded card and for assistive text. */
  role: string;
  /** Accent colour. Every one of these is an existing realm or forge colour. */
  color: string;
  /** The same colour at the alpha the cosmic star pattern expects. */
  glow: string;
  /** Two characters for the placeholder orb, until the portrait is painted. */
  monogram: string;
  /**
   * Catalogue id for the portrait, registered in `ART_PENDING`.
   *
   * Nothing is painted yet, so every one of these resolves to null through
   * `artFor()` and the component draws the placeholder orb. That is a supported
   * state rather than a hole: the orb carries the monogram and the accent, and
   * `art.spec.ts` fails the day a portrait lands and the pending entry is left
   * behind.
   */
  artId: string;
  /**
   * Route prefixes this NPC stands on. Matched with `startsWith` against the
   * path only — never the query string, which is how a `?tab=` on /character
   * would otherwise silently unstaff the page.
   */
  paths: readonly string[];
  /**
   * Hidden until something specific happens. The Nameless is the only one, and
   * `NpcDialogueService` is the thing that decides the gate has opened — the
   * flag here is what stops the ordinary route match from ever surfacing them.
   */
  hidden?: boolean;
  /**
   * Higher wins when two NPCs both claim a page. The Nameless outranks
   * everybody, which is the whole point of them.
   */
  priority: number;
}

export const NPCS: readonly NpcDefinition[] = [
  {
    id: 'aureth',
    name: 'Aureth',
    epithet: 'the Radiant',
    role: 'Goddess of order, keeper of the Luminous crystals.',
    color: '#E8D44D',
    glow: 'rgba(232, 212, 77, 0.55)',
    monogram: 'AU',
    artId: 'npc-aureth',
    paths: ['/world/realms/luminous'],
    priority: 20,
  },
  {
    id: 'verrin',
    name: 'Verrin',
    epithet: 'the Hollow',
    role: 'God of endings. Speaks from the space light leaves behind.',
    color: '#A855F7',
    glow: 'rgba(168, 85, 247, 0.55)',
    monogram: 'VE',
    artId: 'npc-verrin',
    // The hall of trials is Verrin's too. A trial is a thing that ends.
    paths: ['/world/realms/umbral', '/world/trials'],
    priority: 20,
  },
  {
    id: 'kael',
    name: 'Kael',
    epithet: 'the Broken Flame',
    role: 'The Forge Keeper. Cracked armour, one eye still burning.',
    color: '#E8752A',
    glow: 'rgba(232, 117, 42, 0.55)',
    monogram: 'KA',
    artId: 'npc-kael',
    // The world door and both forge surfaces. `/character` is here because the
    // Keeper *is* the character sheet's subject — anywhere else it would read
    // as a stranger standing in somebody's own room.
    paths: ['/world', '/forge', '/character', '/sanctum', '/world/realms/infernal'],
    priority: 10,
  },
  {
    id: 'archivist',
    name: 'The Archivist',
    epithet: 'keeper of fragments',
    role: 'An ancient scholar. The runes on their skin are still being written.',
    color: '#5fb6ff',
    glow: 'rgba(95, 182, 255, 0.55)',
    monogram: 'AR',
    artId: 'npc-archivist',
    // The standing orders are a record, and a record is the Archivist's.
    paths: ['/codex', '/world/quests'],
    priority: 20,
  },
  {
    id: 'merchant',
    name: 'The Merchant',
    epithet: 'of the long till',
    role: 'Sells anything, counts everything, remembers what you nearly bought.',
    color: '#C9A84C',
    glow: 'rgba(201, 168, 76, 0.55)',
    monogram: 'ME',
    artId: 'npc-merchant',
    // The Grand Exchange too — it opened after this cast was written, and a
    // hall where Gold changes hands with nobody in it is the exact gap this
    // feature exists to fill.
    paths: ['/market', '/gambler', '/exchange'],
    priority: 20,
  },
  {
    id: 'nameless',
    name: 'The Nameless',
    epithet: '',
    role: 'It has no epithet. Nothing has ever needed to call it twice.',
    // Deliberately not a realm colour. Nothing else on the site is this.
    color: '#c9c4d6',
    glow: 'rgba(201, 196, 214, 0.35)',
    monogram: '??',
    artId: 'npc-nameless',
    // Every page. The gate is the condition, not the route.
    paths: ['/'],
    hidden: true,
    priority: 100,
  },
];

const NPC_BY_ID = new Map(NPCS.map(n => [n.id, n]));

export function npcById(id: string): NpcDefinition | undefined {
  return NPC_BY_ID.get(id as NpcId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Triggers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The live facts a trigger can be filtered against.
 *
 * Assembled once per selection by `NpcDialogueService` and passed in whole,
 * rather than each condition reaching for its own service: that is what keeps
 * this file free of Angular, and it means a spec can hand the selector any
 * world-state it likes without standing up an injector.
 */
export interface DialogueContext {
  path: string;
  level: number;
  timeOfDay: TimeOfDay;
  /** The live combo, not the record. Zero when no run is going. */
  comboCount: number;
  /** Achievement/egg ids this visitor has banked. */
  achievements: ReadonlySet<string>;
  /** Definition ids of items currently equipped. */
  equipped: ReadonlySet<string>;
  /** Ids of NPC quest steps that are accepted and unclaimed. */
  activeQuests: ReadonlySet<string>;
}

export interface DialogueConditions {
  minLevel?: number;
  /** An item definition id that must be equipped — not merely owned. */
  hasItem?: string;
  hasAchievement?: string;
  timeOfDay?: TimeOfDay;
  /** The live combo must be at least this. */
  comboCount?: number;
  /** An NPC quest step id that must be accepted and unclaimed. */
  questActive?: string;
}

export interface DialogueTrigger {
  npcId: NpcId;
  /**
   * Route prefixes this row is eligible on, or `'*'` for "anywhere this NPC
   * already stands". `'*'` is the common case — most lines are about the
   * character rather than about the room.
   */
  page: string | readonly string[];
  conditions?: DialogueConditions;
  /** The pool. One is picked; see `pickLine`. */
  lines: readonly string[];
  /** Higher is considered first. Ties fall back to the order in this table. */
  priority: number;
}

/**
 * Everything the cast says.
 *
 * Read as: the highest-priority row whose page and conditions both hold wins,
 * and one of its lines is shown. Rows at priority 0 are the idle pools — they
 * have no conditions and are what plays when nothing more specific is true, so
 * every NPC must have one or they fall silent on their own page.
 */
export const DIALOGUE: readonly DialogueTrigger[] = [
  // ── Aureth ─────────────────────────────────────────────────────────────────
  {
    npcId: 'aureth',
    page: '*',
    priority: 0,
    lines: [
      'The crystals need your hand, Convergent.',
      'Light is not a thing you are given. It is a thing you keep lit.',
      'Every clean line you draw here holds a little of the first morning in it.',
      'I have watched a thousand builders. The patient ones make the brightest work.',
      'Order is not the absence of chaos. It is chaos that agreed to be useful.',
      'Do not rush the making. The Sun took an age and still called itself unfinished.',
      'You are further along than you believe. That is usually true of the ones who ask.',
      'Something in the lattice sang when you arrived. I have not decided what it meant.',
    ],
  },
  {
    npcId: 'aureth',
    page: '*',
    priority: 30,
    conditions: { timeOfDay: 'morning' },
    lines: [
      'Dawn already. The crystals kept their colour through the dark — good.',
      'Morning is the cheapest light there is. Spend it well.',
      'You came early. The Luminous notice that sort of thing.',
    ],
  },
  {
    npcId: 'aureth',
    page: '*',
    priority: 30,
    conditions: { timeOfDay: 'night' },
    lines: [
      'It is dark where you are. Work anyway — I will hold the lamp.',
      'Night is not Verrin\'s alone. The light simply gets quieter in it.',
      'Sleep is also an act of order, Convergent. Consider it.',
    ],
  },
  {
    npcId: 'aureth',
    page: '*',
    priority: 45,
    conditions: { minLevel: 15 },
    lines: [
      'You have grown into something the lattice can feel. Be careful what you point it at.',
      'There are crystals in the deep hall that only answer to a hand as practised as yours.',
      'I no longer explain things to you twice. That is the highest compliment I have.',
    ],
  },

  // ── Verrin ─────────────────────────────────────────────────────────────────
  {
    npcId: 'verrin',
    page: '*',
    priority: 0,
    lines: [
      'The shadows reveal what light conceals.',
      'Everything you have made will end. I say it kindly.',
      'You look for what is hidden. I look for what is finished. We pass often.',
      'A secret is only a thing that has not been given a shape yet.',
      'The Nocturne build with what the light discards. You are standing in their workshop.',
      'I am not the opposite of Aureth. I am what happens after her.',
      'You keep locking doors. I keep noticing which ones you check twice.',
      'Nothing here will hurt you. That is not the same as nothing here watching.',
    ],
  },
  {
    npcId: 'verrin',
    page: '*',
    priority: 30,
    conditions: { timeOfDay: 'night' },
    lines: [
      'Ah. You came at the correct hour, for once.',
      'The hollow is thinner tonight. You may hear things that are not addressed to you.',
      'Late. Good. The honest work happens after the witnesses leave.',
    ],
  },
  {
    npcId: 'verrin',
    page: '*',
    priority: 45,
    conditions: { minLevel: 15 },
    lines: [
      'You have taken enough from the dark that it has begun taking notes.',
      'I have stopped explaining endings to you. You have started arranging them yourself.',
      'There is a door in the Umbral that opens only for someone the shadows already know.',
    ],
  },

  // ── Kael ───────────────────────────────────────────────────────────────────
  {
    npcId: 'kael',
    page: '*',
    priority: 0,
    lines: [
      'Welcome to the Godforge. Strike the anvil — see what answers.',
      'Metal does not care how you feel. That is the mercy of it.',
      'Hold the rhythm. The forge pays the steady, not the fast.',
      'This eye burns because I looked at something I should have hammered instead.',
      'Every rune in here was somebody\'s bad week made useful.',
      'You want advice? Strike it again. Most problems are one more strike away.',
      'Armour cracks. Keep wearing it. That is what armour is for.',
      'I have rebuilt this forge four times. It gets easier and it never gets easy.',
    ],
  },
  {
    npcId: 'kael',
    page: '/forge',
    priority: 20,
    lines: [
      'Anvil is hot. Gold is yours. Nobody is stopping you.',
      'The Void comes out of this thing about once in two million strikes. I have seen it twice.',
      'Set the runes together and they stop being trinkets. That is the whole trick.',
    ],
  },
  {
    npcId: 'kael',
    page: '*',
    priority: 60,
    conditions: { comboCount: 50 },
    lines: [
      'That is a rhythm. Do not look at it — you will drop it.',
      'Keep going. The forge has not made that sound in a long while.',
      'Whatever you are doing, do not stop to be proud of it yet.',
    ],
  },
  {
    npcId: 'kael',
    page: '*',
    priority: 30,
    conditions: { timeOfDay: 'night' },
    lines: [
      'Late shift. The good ones always are.',
      'Fire looks better in the dark. So does work.',
    ],
  },

  // ── The Archivist ──────────────────────────────────────────────────────────
  {
    npcId: 'archivist',
    page: '*',
    priority: 0,
    lines: [
      'Each fragment tells a piece of the truth.',
      'I do not keep the record because it is complete. I keep it because it is not.',
      'You found something. Say nothing — let me write it down first.',
      'Every locked entry on this wall is a sentence somebody has not lived yet.',
      'The runes on my skin were a filing system. Then they started answering back.',
      'Knowledge is a shape, Convergent, and yours is getting interesting.',
      'A hint is a kindness. An answer is a theft. I deal only in kindnesses.',
      'Ask me what is missing. It is a better question than what is here.',
    ],
  },
  {
    npcId: 'archivist',
    page: '*',
    priority: 45,
    conditions: { minLevel: 10 },
    lines: [
      'Your entry in the record has grown past one page. Few do.',
      'I have begun cross-referencing you. Do not be alarmed. Everyone is, eventually.',
    ],
  },

  // ── The Merchant ───────────────────────────────────────────────────────────
  {
    npcId: 'merchant',
    page: '*',
    priority: 0,
    lines: [
      'Gold flows like light through the Forge, friend. Let some flow here.',
      'Everything on this shelf is fairly priced. Fairly. To me.',
      'You are browsing. Browsing is free. Everything after browsing is not.',
      'I once sold a god a hammer he already owned. He thanked me.',
      'Buy two and I will call you a regular. Regulars get a warmer greeting, nothing else.',
      'Coin is only frozen effort, friend. Thaw some.',
      'No refunds, no exchanges, no hard feelings, no exceptions, no.',
      'I like you. That is a business position, not a personal one.',
    ],
  },
  {
    npcId: 'merchant',
    page: '/gambler',
    priority: 20,
    lines: [
      'The odds are printed on the box. That is more honesty than most temples offer.',
      'Bad luck is tracked, friend. Ten poor openings and the house owes you better.',
      'Sell me what you do not want. I will price it by how well it rolled, and I will only weep a little.',
    ],
  },
  {
    npcId: 'merchant',
    page: '*',
    priority: 45,
    conditions: { minLevel: 20 },
    lines: [
      'Ah — a serious customer. I have things I do not put on the shelf.',
      'You have spent enough here to be, in the technical sense, family.',
    ],
  },

  // ── The Nameless ───────────────────────────────────────────────────────────
  // Every line short, every line about being observed. Nothing here explains
  // itself, and nothing here is friendly.
  {
    npcId: 'nameless',
    page: '*',
    priority: 0,
    lines: [
      'You counted. You shouldn\'t have.',
      'I was not here. I am now. You did that.',
      'Keep going. I want to see the number.',
      'Nobody named me. They tried.',
      'You have been very loud for someone alone.',
      'It is not watching you. It is remembering you.',
      'Put it down.',
      'There is one more. There is always one more.',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Selection
// ─────────────────────────────────────────────────────────────────────────────

/** Strip query and fragment, and collapse a trailing slash. `/` stays `/`. */
export function normalisePath(url: string): string {
  const path = (url || '/').split('?')[0].split('#')[0];
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path || '/';
}

/**
 * Whether `path` sits under `prefix`.
 *
 * Segment-aware rather than a bare `startsWith`, which is the difference between
 * `/forge` claiming `/forge/runes` (correct) and `/market` claiming
 * `/marketplace` (not). `/` matches everything, and is only used by the
 * Nameless.
 */
export function pathMatches(path: string, prefix: string): boolean {
  if (prefix === '/' || prefix === '*') return true;
  if (path === prefix) return true;
  return path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
}

/**
 * Which NPC, if any, stands on this page. Hidden NPCs are never returned here.
 *
 * Placement is by route alone. An earlier draft also matched on the realm
 * `RealmService` publishes, which is how the brief describes it — Aureth on the
 * CSS pages, Verrin on the security pages. That service resolves a realm by
 * looking the current path up in the *tool* registry, and every `/tools` route
 * now redirects to `/world`, so it answers null on every page that exists. The
 * hook was removed rather than left in place looking like it worked; the realm
 * halls each carry their own route, and a path prefix reaches them directly.
 */
export function npcForPage(path: string): NpcDefinition | null {
  const p = normalisePath(path);
  const claimants = NPCS.filter(npc =>
    !npc.hidden && npc.paths.some(prefix => pathMatches(p, prefix)));
  if (!claimants.length) return null;

  // The longest matching prefix wins, which is what stops Kael's `/world` from
  // speaking over Aureth on `/world/realms/luminous`.
  return claimants.slice().sort((a, b) => specificity(b, p) - specificity(a, p))[0];
}

function specificity(npc: NpcDefinition, path: string): number {
  const best = npc.paths
    .filter(prefix => pathMatches(path, prefix))
    .reduce((longest, prefix) => Math.max(longest, prefix.length), 0);
  return best * 10 + npc.priority;
}

/** Whether one trigger's preconditions all hold. */
export function triggerApplies(t: DialogueTrigger, ctx: DialogueContext): boolean {
  const pages = typeof t.page === 'string' ? [t.page] : t.page;
  if (!pages.some(p => p === '*' || pathMatches(normalisePath(ctx.path), p))) return false;

  const c = t.conditions;
  if (!c) return true;
  if (c.minLevel !== undefined && ctx.level < c.minLevel) return false;
  if (c.comboCount !== undefined && ctx.comboCount < c.comboCount) return false;
  if (c.timeOfDay !== undefined && ctx.timeOfDay !== c.timeOfDay) return false;
  if (c.hasAchievement !== undefined && !ctx.achievements.has(c.hasAchievement)) return false;
  if (c.hasItem !== undefined && !ctx.equipped.has(c.hasItem)) return false;
  if (c.questActive !== undefined && !ctx.activeQuests.has(c.questActive)) return false;
  return true;
}

/** Every applicable trigger for one NPC, most specific first. */
export function triggersFor(npcId: NpcId, ctx: DialogueContext): DialogueTrigger[] {
  return DIALOGUE
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.npcId === npcId && triggerApplies(t, ctx))
    .sort((a, b) => (b.t.priority - a.t.priority) || (a.i - b.i))
    .map(({ t }) => t);
}

/** A stable id for one authored line, for the "already heard this" ledger. */
export function lineKey(npcId: NpcId, line: string): string {
  return `${npcId}:${hash32(line).toString(36)}`;
}

/**
 * Choose a line from the winning trigger, preferring one this visitor has not
 * heard.
 *
 * Unheard lines are drawn from first, and only when the whole pool has been
 * heard does it fall back to the full pool — which is what stops an NPC going
 * silent once you have seen everything they have. The pick is seeded rather than
 * random so a re-render (hydration, a change-detection pass, a second
 * subscriber) shows the same line instead of flickering to a new one.
 */
export function pickLine(
  lines: readonly string[],
  seen: ReadonlySet<string>,
  npcId: NpcId,
  seed: string,
): string | null {
  if (!lines.length) return null;
  const fresh = lines.filter(l => !seen.has(lineKey(npcId, l)));
  const pool = fresh.length ? fresh : lines;
  return pool[hash32(`${seed}|${npcId}`) % pool.length];
}

/** FNV-1a, 32-bit. Same one the quest board draws with, for the same reasons. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
