/**
 * eclipse.model.ts — what the world clock puts in the world (docs/handoff/world-clock.md;
 * lore: docs/world/lore-addendum.md, "Day, night and the eclipse").
 *
 * Three new things, each with a source, a use, a lore line and a Found in:
 *  - Moonwake Bloom: a herb that only opens in the dark (night, or the night at
 *    noon an eclipse makes) in four hunting grounds. Bait that the Mirrorfin
 *    rises to, three of them press into Lampfish Oil, and the Star Owlet eats it.
 *  - Mirrorfin: a fish that only bites in the dark (in the seeps and the Grotto
 *    Mere), more often on Moonwake bait. Renders into two Lampfish Oil; the Ink
 *    Pup and the Shade-kit eat it.
 *  - Eclipse Glass: the moon mirror's flare caught in rock. Only while an
 *    eclipse is on: an outcrop in every hunting ground, the Afterimage Moths
 *    that rise in the Reflection Channels, and a rift shrine first touched under
 *    the eclipse. Burns in Eclipse torches; Sera Quill's ledger pays it too.
 *
 * Sera Quill's Eclipse Ledger (the reward track): every eclipse a Keeper is in
 * the world for is one observation, written down once. Each pays a little
 * income; the ledger's marks (1, 3, 5, 8 observations) pay more and some Eclipse
 * Glass. Nothing expires and nothing is lost for a missed eclipse: the next one
 * counts the same (owner: no FOMO grind). Gold on the curve: economy-sim
 * --eclipse (in --check).
 *
 * No imports: found-in, check-meaning and the economy sim load it as is.
 */

export const MOONWAKE_BLOOM_ID = 'moonwake-bloom';
export const MIRRORFIN_ID = 'mirrorfin';
export const ECLIPSE_GLASS_ID = 'eclipse-glass';

export interface ClockItem {
  id: string;
  name: string;
  /** Found in… lines (found-in.data.ts). */
  foundIn: readonly string[];
  /** Where the game grants it (check-meaning sources). */
  sources: readonly string[];
  /** What it is for (check-meaning uses; the Collection Log's "Used for"). */
  uses: readonly string[];
  /** The Codex line (EN; ES in world-clock.i18n.ts `clock.lore.<id>`). */
  lore: string;
}

export const CLOCK_ITEMS: readonly ClockItem[] = [
  {
    id: MOONWAKE_BLOOM_ID,
    name: 'Moonwake Bloom',
    foundIn: ['Ember Quarry, Unrecorded Corridors, Orrery Rings and Rootglass Thicket: a bud that opens only at night (or under an eclipse)'],
    sources: ['Moonwake nodes in four hunting grounds, open only in the dark (GatherNodeDef.when)'],
    uses: ['fishing bait: the Mirrorfin rises to it', 'pressed into Lampfish Oil at the Crafting Bench', 'pet food (Star Owlet)'],
    lore: 'It shuts the moment anyone looks straight at the sun. The Archive keeps one in a drawer, to prove the night happened.',
  },
  {
    id: MIRRORFIN_ID,
    name: 'Mirrorfin',
    foundIn: ['Ember Delve: fishing the seeps and the Grotto Mere at night (or under an eclipse)'],
    sources: ['fishing in the dark: the seeps and the Grotto Mere (catchTable, CatchDef.when)'],
    uses: ['rendered into two Lampfish Oil at the Crafting Bench', 'pet food (Ink Pup, Shade-kit)'],
    lore: 'Its scales are slivers of the moon mirror, and it swims up to see itself. By day it remembers it is a fish and goes back down.',
  },
  {
    id: ECLIPSE_GLASS_ID,
    name: 'Eclipse Glass',
    foundIn: [
      'Every hunting ground: an Eclipse Glass outcrop, only while an eclipse is on',
      'Reflection Channels: the Afterimage Moths that rise under an eclipse',
      'Ember Delve: a rift shrine first touched under an eclipse',
      'Sera Quill\'s Eclipse Ledger: its marks pay a little',
    ],
    sources: ['Eclipse Glass outcrops in every hunting ground, only during an eclipse', 'the Afterimage Moth\'s drop', 'a rift shrine first touched under an eclipse', 'Sera Quill\'s Eclipse Ledger marks (EclipseService.witness)'],
    uses: ['burned into Eclipse torches at the Crafting Bench'],
    lore: 'The moon mirror\'s flare, caught in the rock as it passed. It is warm on the side that faced the sun and cold on the side that faced the Archive.',
  },
];

/** What every witnessed eclipse pays (seconds of income, with a floor): rule I, economy-sim --eclipse. */
export const OBSERVATION = { gold: 40, goldSeconds: 100 } as const;

export interface LedgerMark {
  /** Observations it takes. */
  at: number;
  /** Its receipt (the save's `marks`). */
  id: string;
  gold: number;
  goldSeconds: number;
  /** Eclipse Glass it hands over. */
  glass: number;
}
/** Sera Quill's ledger marks. Each paid once, ever; a merge that crosses one pays it on the next witness or catch-up. */
export const LEDGER_MARKS: readonly LedgerMark[] = [
  { at: 1, id: 'eclipse:mark-1', gold: 150, goldSeconds: 600, glass: 2 },
  { at: 3, id: 'eclipse:mark-3', gold: 250, goldSeconds: 900, glass: 3 },
  { at: 5, id: 'eclipse:mark-5', gold: 400, goldSeconds: 1200, glass: 4 },
  { at: 8, id: 'eclipse:mark-8', gold: 400, goldSeconds: 1200, glass: 6 },
];

/** The marks reached at `count` observations that are not yet in `paid`. */
export function marksDue(count: number, paid: readonly string[]): LedgerMark[] {
  return LEDGER_MARKS.filter(m => count >= m.at && !paid.includes(m.id));
}

/** The next mark still ahead, or null once the ledger is full (each eclipse then pays its observation only). */
export function nextMark(count: number): LedgerMark | null {
  return LEDGER_MARKS.find(m => count < m.at) ?? null;
}

/**
 * What an eclipse does where the Keeper is (i18n `clock.effect.<id>`), in the
 * order the Slate lists them. Everywhere: the sky, the glass, the night things
 * waking, the shrines. The aligned realm (it turns, eclipse by eclipse) gets its
 * hunting ground's glass doubled.
 */
export const ECLIPSE_EFFECTS = ['sky', 'glass', 'moths', 'dark', 'touched', 'shrines', 'aligned'] as const;
export type EclipseEffect = (typeof ECLIPSE_EFFECTS)[number];

/** A rift shrine first touched under an eclipse: its Delving XP is multiplied, its reveal widened. */
export const ECLIPSE_SHRINE = { xp: 2, reveal: 2, glass: 1 } as const;
/** The aligned realm's hunting-ground outcrop yields this many Eclipse Glass a cut (1 elsewhere). */
export const ALIGNED_GLASS = 2;

/** The hunting ground of each realm (the aligned realm's glass is doubled there). */
export const REALM_HUNT: Readonly<Record<string, string>> = {
  infernal: 'ember-quarry',
  luminous: 'reflection-channels',
  umbral: 'unrecorded-corridors',
  celestial: 'orrery-rings',
  verdant: 'rootglass-thicket',
};
