/**
 * fishing.model.ts: Fishing v1, the Delve's calm loop. Pure data and pure
 * functions; no Angular, and no import but its own save shape (fishing-save.ts),
 * so the economy sim and the meaning check load it as is. Design: docs/world/delve-and-beyond.md §5; the lines
 * are the lore addendum's ("The Delve and beyond").
 *
 * A cast lands in a body of liquid; which one (its *water*) comes from the
 * biome and the liquid: water in the Root Hollows and Basalt Caverns is a
 * seep, water in the Glowcap Grotto (and lower) is the Grotto Mere, and lava
 * is the Magma Halls' lava, and lava in the Underhearth is the Underhearth's
 * own (Phase 8: the deepest water, below the Magma Halls). Each water has a catch table on the spec's rarity
 * ladder. XP rises with the water's tier, never with the angler's level
 * (the progression rule). Once hooked a fish is always landed: the Line
 * Tension grade (fishing-reel.ts) only adds XP and a crate step.
 */

export type WaterId = 'seep' | 'mere' | 'magma' | 'hearth';
export type CatchRarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'junk' | 'crate' | 'quest';
export type ReelGrade = 'perfect' | 'good' | 'off';

export interface WaterDef {
  id: WaterId;
  /** Shown in Found-in lines and the Catalogue ("the Grotto Mere"). */
  name: string;
  liquid: 'water' | 'lava';
  tier: number;
  /** XP for a common and for a legendary catch here (spec §5.3). */
  xp: readonly [number, number];
  /** The crate this water's crate roll gives (a Perfect reel steps it up once). */
  crate: string;
  /** Where it is, in plain words. */
  where: string;
}

export const WATERS: Readonly<Record<WaterId, WaterDef>> = {
  seep: { id: 'seep', name: 'Root seeps and flooded seams', liquid: 'water', tier: 1, xp: [6, 60], crate: 'root-crate',
    where: 'the seep in the Root Hollows alcove, or Kael\'s flooded seam in the Basalt Caverns' },
  mere: { id: 'mere', name: 'the Grotto Mere', liquid: 'water', tier: 1, xp: [8, 80], crate: 'root-crate',
    where: 'the Grotto Mere, the lake in the glowcap cavern of the Glowcap Grotto' },
  magma: { id: 'magma', name: 'Magma Halls lava', liquid: 'lava', tier: 2, xp: [18, 180], crate: 'seam-crate',
    where: 'the lava pools on the Magma Halls floor (a Seam Rod or better)' },
  // Phase 8. The engine gates a cast by liquid kind (water / lava), not by biome, so the Seam Rod
  // works this lava as well as the Glowline Rod does; the gate is the way down (Delving 15, the
  // Breach seal), and the Glowline Rod's quarter-faster bite is its edge here.
  hearth: { id: 'hearth', name: 'the Underhearth\'s lava', liquid: 'lava', tier: 3, xp: [28, 280], crate: 'hearth-crate',
    where: 'the lava of the Underhearth, below the Magma Halls (any lava rod; the Glowline Rod bites fastest)' },
};

/** Which water a cast landed in. Pure. */
export function waterFor(biome: string, liquid: 'water' | 'lava'): WaterId {
  if (liquid === 'lava') return biome === 'underhearth' ? 'hearth' : 'magma';
  return biome === 'root-hollows' || biome === 'basalt-caverns' ? 'seep' : 'mere';
}

export interface CatchDef {
  id: string;
  name: string;
  rarity: CatchRarity;
  /** Waters it can be caught in (a quest fish: any, but only on its day). */
  waters: readonly WaterId[];
  /** The Codex line (lore addendum): a contradiction or consequence, not only an effect. */
  lore: string;
  /** What it is for, in plain words (the Catalogue's "Used for"). */
  use: string;
  /** v2 price anchor: the Buyback floor pays 8% of anchor × 0.06 (rebalance rule R). */
  anchor: number;
}

const FISH: readonly CatchDef[] = [
  { id: 'blindfin', name: 'Blindfin', rarity: 'common', waters: ['seep', 'mere'], anchor: 900,
    lore: 'Born in the dark and not interested in the alternative.', use: 'Live bait, and the Gill Draught at the Enchanting Table.' },
  { id: 'rootling-eel', name: 'Rootling Eel', rarity: 'uncommon', waters: ['seep'], anchor: 1_600,
    lore: 'Swims along the roots, toward the crack, like everything else down here.', use: 'Verrin wants five of them.' },
  { id: 'glowcap-minnow', name: 'Glowcap Minnow', rarity: 'common', waters: ['mere'], anchor: 1_100,
    lore: 'Eats the glowcaps, so it carries their light. Small, bright, borrowed.', use: 'Lampfish Oil at the Crafting Bench; the Archivist asks for three.' },
  { id: 'mere-perch', name: 'Mere Perch', rarity: 'rare', waters: ['mere'], anchor: 2_800,
    lore: 'Ordinary. In the Delve that is the rarest thing you can be.', use: 'The Merchant\'s standing fish order.' },
  { id: 'emberling', name: 'Emberling', rarity: 'common', waters: ['magma'], anchor: 2_400,
    lore: 'Lives in lava. Not brave: it has never been anywhere else.', use: 'A second Ember Elixir recipe, with Ember Residue.' },
  { id: 'slagjaw-eel', name: 'Slagjaw Eel', rarity: 'uncommon', waters: ['magma'], anchor: 4_000,
    lore: 'Bites through slag. Do not offer it your hand to compare.', use: 'The Merchant\'s standing fish order.' },
  // The Underhearth (Phase 8; lore addendum, Item lines: Fish).
  { id: 'cold-coalfish', name: 'Cold Coalfish', rarity: 'common', waters: ['hearth'], anchor: 3_600,
    lore: 'Cold until you strike the bucket. Then it remembers.', use: 'Verrin\'s "Endings Kept Warm" asks for one; coal torches at the Crafting Bench.' },
  { id: 'pressure-pike', name: 'Pressure Pike', rarity: 'uncommon', waters: ['hearth'], anchor: 6_000,
    lore: 'Swims as if the whole Underhearth were sitting on it, because it is.', use: 'Two Ember Elixirs, with Ember Residue.' },
  { id: 'the-kept-morning', name: 'The Kept Morning', rarity: 'legendary', waters: ['mere'], anchor: 60_000,
    lore: 'A lampfish that has been carrying the same morning since before the Eclipse. It would like to put it down.', use: 'Rendered, it fills five flasks of Lampfish Oil.' },
  { id: 'the-unpaid-debt', name: 'The Unpaid Debt', rarity: 'legendary', waters: ['magma'], anchor: 90_000,
    lore: 'Stamped on the flank with a heat seal. Somebody, somewhere, still owes for this fish.', use: 'The Merchant settles the debt, once.' },
  { id: 'the-fifth-ember', name: 'The Fifth Ember', rarity: 'legendary', waters: ['hearth'], anchor: 140_000,
    lore: 'It swims with four others that are not there.', use: 'Banked into three Embervials at the Crafting Bench.' },
];

const JUNK: readonly CatchDef[] = [
  { id: 'rusted-rivet', name: 'Rusted Rivet', rarity: 'junk', waters: ['seep', 'mere', 'magma', 'hearth'], anchor: 120,
    lore: 'A Maw put this somewhere safe. You have undone a great deal of careful work.', use: 'Three smelt into a Slag Fragment at the Crafting Bench.' },
  { id: 'waterlogged-ledger-page', name: 'Waterlogged Ledger Page', rarity: 'junk', waters: ['seep', 'mere'], anchor: 300,
    lore: 'Kael\'s handwriting, mostly. A column of figures that stops at the waterline.', use: 'The Archivist takes every page (Delving XP and a line of Kael\'s ledger).' },
];

const CRATES: readonly CatchDef[] = [
  { id: 'root-crate', name: 'Root Crate', rarity: 'crate', waters: ['seep', 'mere'], anchor: 2_000,
    lore: 'Bark-bound and swollen. Something down here packs for journeys.', use: 'Open it in your satchel: bark, thornroot, bait, ore, sometimes torches.' },
  { id: 'seam-crate', name: 'Seam Crate', rarity: 'crate', waters: ['magma'], anchor: 5_000,
    lore: 'Kael\'s stencil on the lid, upside down.', use: 'Open it in your satchel: slag, ore, ember residue, bait, sometimes torches.' },
  { id: 'hearth-crate', name: 'Hearth Crate', rarity: 'crate', waters: ['hearth'], anchor: 8_000,
    lore: 'Warm. Do not ask whose.', use: 'Open it in your satchel: ember residue, pyrite dust, ironwood, rarely emberheart ore.' },
];

/**
 * The Lodge Warden's Ledger Catch family: quest-only species, one a day,
 * each swimming only while it is the day's quest (Terraria's Angler model).
 * Named for the seam ledgers and tally marks the Delve's walls keep.
 */
const LEDGER_FISH: readonly (readonly [string, string, string])[] = [
  ['tallyfish', 'Tallyfish', 'Five scratches on its flank. Four are crossed through.'],
  ['ledgerfin', 'Ledgerfin', 'Its fins fold like a ledger\'s pages. It always closes on the last entry.'],
  ['carry-one-carp', 'Carry-One Carp', 'Counts to nine on its scales, then starts a new column.'],
  ['overdue-dace', 'Overdue Dace', 'It was expected yesterday. It is in no hurry.'],
  ['margin-loach', 'Margin Loach', 'Lives in the edges of things, where the notes are written.'],
  ['inkblot-gudgeon', 'Inkblot Gudgeon', 'Leaves a small dark stain wherever it rests, like a dropped pen.'],
  ['struck-through-shiner', 'Struck-Through Shiner', 'One line runs the length of it, neat as a correction.'],
  ['balance-bream', 'Balance Bream', 'Holds perfectly still in moving water. The ledger approves.'],
  ['receipt-eel', 'Receipt Eel', 'Thin, pale and curled at both ends. Nobody keeps them, and everybody should.'],
  ['countback-chub', 'Countback Chub', 'Swims its route backwards, to check it was right.'],
  ['unsigned-sprat', 'Unsigned Sprat', 'Every scale is blank where a mark should be.'],
  ['column-pike', 'Column Pike', 'Long, straight, and lined up with its neighbours to the scale.'],
  ['duplicate-darter', 'Duplicate Darter', 'There is always a second one. It is never quite the same.'],
  ['tally-perch', 'Tally Perch', 'Four bars and a slash on the gill, in a hand you have seen in the Root Hollows.'],
  ['seal-wax-snapper', 'Seal-Wax Snapper', 'Red at the mouth, as if it bit a seal and kept a little.'],
  ['quill-minnow', 'Quill Minnow', 'Its spine is a nib. It writes small things on the mud and swims away.'],
  ['errata-ray', 'Errata Ray', 'Flat as a page, and folded over at one corner.'],
  ['rivet-ruffe', 'Rivet Ruffe', 'Spiked in neat rows, like a seam somebody meant to finish.'],
  ['waterline-loach', 'Waterline Loach', 'Swims exactly at the waterline someone marked, a hand lower every year.'],
  ['closing-entry-carp', 'Closing-Entry Carp', 'The last fish on the page. The Warden underlines it twice.'],
];
const QUEST: readonly CatchDef[] = LEDGER_FISH.map(([id, name, lore]) => ({
  id, name, lore, rarity: 'quest' as const, waters: ['seep', 'mere', 'magma', 'hearth'] as const, anchor: 500,
  use: 'The Lodge Warden\'s Ledger Catch, on the one day it swims.',
}));

/** Every catch: fish, legendaries, junk, crates and the Ledger Catch family. */
export const CATCHES: readonly CatchDef[] = [...FISH, ...JUNK, ...CRATES, ...QUEST];
const CATCH_BY_ID = new Map(CATCHES.map(c => [c.id, c]));
export function catchById(id: string): CatchDef | undefined { return CATCH_BY_ID.get(id); }
export const LEDGER_CATCH_IDS: readonly string[] = QUEST.map(q => q.id);
export const CRATE_IDS: readonly string[] = CRATES.map(c => c.id);

// ── Bait, rods and the Lodge's charms ────────────────────────────────────────

export interface BaitDef { id: string; name: string; power: number; source: string; note: string }
/** Strongest first: a cast uses the strongest bait held, one per landed catch. */
export const BAITS: readonly BaitDef[] = [
  { id: 'shadow-root-cutting', name: 'Shadow-Root Cutting', power: .35, source: 'Root Hollows', note: 'Eels and the Ledger Catch favour it.' },
  { id: 'blindfin', name: 'Blindfin', power: .25, source: 'seeps', note: 'Live bait.' },
  { id: 'glowcap', name: 'Glowcap', power: .20, source: 'Glowcap Grotto', note: 'At night it draws the rare ones.' },
  { id: 'ember-grub', name: 'Ember Grub', power: .10, source: 'digging dirt and root-loam', note: 'Gives dirt a second meaning.' },
];
/** The bait a cast uses from what is held (stack id → count), or null. */
export function bestBait(stackOf: (id: string) => number): BaitDef | null {
  return BAITS.find(b => stackOf(b.id) > 0) ?? null;
}

export interface RodDef {
  id: string; name: string; tier: number;
  /** The Fishing level it works at its own tier from (TOOL_TIER_LEVEL ladder). */
  level: number;
  liquids: readonly ('water' | 'lava')[];
  /** Bite speed it adds (×). */
  bite: number;
  lore: string;
}
export const RODS: readonly RodDef[] = [
  { id: 'worn-rod', name: 'Worn Rod', tier: 1, level: 1, liquids: ['water'], bite: 1,
    lore: 'Someone\'s first rod. The line has been re-knotted more times than it has caught anything.' },
  { id: 'root-rod', name: 'Root Rod', tier: 1, level: 1, liquids: ['water'], bite: 1.1,
    lore: 'World-Root bark bent into a curve it agreed to. It still leans, very slightly, toward the crack.' },
  { id: 'seam-rod', name: 'Seam Rod', tier: 2, level: 10, liquids: ['water', 'lava'], bite: 1.15,
    lore: 'Slag will take heat without taking shape. That is what you want in a line you mean to drop into lava.' },
  { id: 'glowline-rod', name: 'Glowline Rod', tier: 3, level: 25, liquids: ['water', 'lava'], bite: 1.25,
    lore: 'Glowcap fibre in the line. The fish see it coming and come anyway, because it looks like morning.' },
];
/** The Worn Rod is given once, soulbound, like the Worn Pickaxe; its grant id never changes. */
export const WORN_ROD_GRANT = 'starter-rod:v1';

/**
 * The best rod held, working as the tier the Fishing level allows ("works as
 * tier N until Fishing L", like the other tools). Null when none is held.
 */
export function rodFor(stackOf: (id: string) => number, level: number): (RodDef & { works: RodDef }) | null {
  const held = [...RODS].reverse().find(r => stackOf(r.id) > 0);
  if (!held) return null;
  // The best profile the level allows at or under the held rod's tier (the held one itself when it can).
  const works = held.level <= level ? held : [...RODS].reverse().find(r => r.level <= level && r.tier <= held.tier) ?? RODS[0];
  return { ...held, works };
}

export interface CharmDef { id: string; name: string; turnIns: number; effect: string; lore: string }
/** The Ledger Catch ladder: the Warden's gifts on the 5th, 10th and 25th turn-in. Held in the satchel, they work. */
export const LODGE_CHARMS: readonly CharmDef[] = [
  { id: 'tackle-box', name: 'Tackle Box', turnIns: 5, effect: 'One bait in four is not used up.',
    lore: 'Every compartment labelled in the Warden\'s hand. One is labelled "patience" and is empty.' },
  { id: 'anglers-patience', name: 'Angler\'s Patience', turnIns: 10, effect: '+10% bite speed.',
    lore: 'A knot of root that never quite tightens. Holding it, you stop counting the seconds.' },
  { id: 'lodge-reel', name: 'Lodge Reel', turnIns: 25, effect: 'The Line Tension catch window is a tenth wider.',
    lore: 'A rod part from the Lodge\'s own rack. The Warden says it was always going to be yours.' },
];

// ── Skill: perks by level ────────────────────────────────────────────────────

export interface FishingPerks { bite: number; crate: number; double: number; window: number }
/** Every ~10 levels, like the other skills (spec §5.6). */
export function fishingPerks(level: number): FishingPerks {
  const L = Math.max(1, Math.min(99, Math.floor(level || 1)));
  return {
    bite: 1 + .05 * Math.floor(L / 10),
    crate: .002 * Math.floor(L / 20),
    double: .03 * Math.floor(L / 25),
    window: .04 * [30, 60, 90].filter(at => L >= at).length,
  };
}

// ── The catch ────────────────────────────────────────────────────────────────

export interface CatchContext {
  water: WaterId;
  /** Bait power of the bait used (0 without). */
  bait: number;
  /** Glowcap bait at night: rare fish come more often. */
  nightGlow?: boolean;
  /** Legendaries already caught: each is rarer after the first (0.1% → 0.02%). */
  caught?: (id: string) => number;
  /** The day's Ledger Catch, while it is still owed: it swims in this water. */
  quest?: { id: string; water: WaterId } | null;
  /** The skill's crate perk. */
  cratePerk?: number;
}

/** The spec's ladder: common 70, uncommon 22, rare 6, junk 1.5, crate 0.4–2, legendary 0.1 (0.02 once caught). */
export const LADDER = { uncommon: .22, rare: .06, junk: .015, crateBase: .004, crateMax: .02, legendary: .001, legendaryAgain: .0002, quest: .12 } as const;

/**
 * The full table for one cast: every catch with its chance, summing to 1.
 * A rarity with no species in this water gives its share to the next more
 * common one. Pure.
 */
export function catchTable(ctx: CatchContext): { id: string; rarity: CatchRarity; p: number }[] {
  const water = ctx.water;
  const inWater = (r: CatchRarity) => FISH.filter(f => f.rarity === r && f.waters.includes(water));
  const crate = Math.min(LADDER.crateMax, LADDER.crateBase + Math.max(0, ctx.bait) * .03 + (ctx.cratePerk ?? 0));
  const legendaries = inWater('legendary');
  const legendary = legendaries.reduce((p, f) => p + ((ctx.caught?.(f.id) ?? 0) > 0 ? LADDER.legendaryAgain : LADDER.legendary), 0);
  const quest = ctx.quest && ctx.quest.water === water ? LADDER.quest : 0;
  let rare: number = LADDER.rare + (ctx.nightGlow ? .03 : 0);
  let uncommon: number = LADDER.uncommon;
  const junk = LADDER.junk;
  if (!inWater('rare').length) { uncommon += rare; rare = 0; }
  if (!inWater('uncommon').length) uncommon = 0;
  const common = 1 - uncommon - rare - junk - crate - legendary - quest;
  const rows: { id: string; rarity: CatchRarity; p: number }[] = [];
  const spread = (list: readonly CatchDef[], p: number) => { for (const f of list) rows.push({ id: f.id, rarity: f.rarity, p: p / list.length }); };
  spread(inWater('common'), common);
  spread(inWater('uncommon'), uncommon);
  spread(inWater('rare'), rare);
  for (const f of legendaries) rows.push({ id: f.id, rarity: 'legendary', p: (ctx.caught?.(f.id) ?? 0) > 0 ? LADDER.legendaryAgain : LADDER.legendary });
  spread(JUNK.filter(j => j.waters.includes(water)), junk);
  rows.push({ id: WATERS[water].crate, rarity: 'crate', p: crate });
  if (quest) rows.push({ id: ctx.quest!.id, rarity: 'quest', p: quest });
  return rows;
}

/** One catch, rolled on `random` (0..1). Pure given the roll. */
export function rollCatch(ctx: CatchContext, random: () => number): { id: string; rarity: CatchRarity } {
  const table = catchTable(ctx);
  let u = random();
  for (const row of table) { if (u < row.p) return { id: row.id, rarity: row.rarity }; u -= row.p; }
  const last = table[0];
  return { id: last.id, rarity: last.rarity };
}

/** A Perfect reel steps a crate up one tier (Root → Seam; Seam is the deepest in v1). */
export function crateStep(id: string): string {
  return id === 'root-crate' ? 'seam-crate' : id;
}

/** Grade from the share of the reel the fish spent inside the window (spec §5.1). */
export function gradeFor(inside: number): ReelGrade {
  return inside >= .9 ? 'perfect' : inside >= .6 ? 'good' : 'off';
}
/** What a grade adds to the XP (it never takes anything away). */
export const GRADE_XP: Readonly<Record<ReelGrade, number>> = { perfect: 1.5, good: 1.2, off: 1 };

/** XP for one catch: the water's tier sets it, the rarity scales it, the grade adds to it. Whole XP, at least 1. */
export function catchXp(water: WaterId, rarity: CatchRarity, grade: ReelGrade): number {
  const [common, legendary] = WATERS[water].xp;
  const base = rarity === 'legendary' ? legendary
    : rarity === 'rare' ? common * 2.5
    : rarity === 'uncommon' || rarity === 'quest' ? common * 1.5
    : rarity === 'junk' ? common * .5
    : common;
  return Math.max(1, Math.round(base * GRADE_XP[grade]));
}

// ── Crates ───────────────────────────────────────────────────────────────────

/** What a crate can hold: stack id, quantity range, chance. Opened free in the satchel. */
export const CRATE_CONTENTS: Readonly<Record<string, readonly { id: string; min: number; max: number; chance: number }[]>> = {
  'root-crate': [
    { id: 'world-root-bark', min: 2, max: 4, chance: 1 },
    { id: 'thornroot', min: 1, max: 2, chance: .8 },
    { id: 'ember-grub', min: 2, max: 4, chance: .9 },
    { id: 'cinder-ore', min: 1, max: 3, chance: .7 },
    { id: 'torch', min: 3, max: 3, chance: .3 },
  ],
  'seam-crate': [
    { id: 'slag-fragment', min: 1, max: 3, chance: 1 },
    { id: 'cinder-ore', min: 2, max: 4, chance: .9 },
    { id: 'ember-residue', min: 1, max: 2, chance: .7 },
    { id: 'ember-grub', min: 3, max: 3, chance: .6 },
    { id: 'torch', min: 3, max: 3, chance: .35 },
  ],
  'hearth-crate': [
    { id: 'ember-residue', min: 2, max: 3, chance: 1 },
    { id: 'pyrite-dust', min: 1, max: 3, chance: .8 },
    { id: 'ironwood', min: 1, max: 2, chance: .6 },
    { id: 'emberheart-ore', min: 1, max: 1, chance: .1 },
  ],
};
/** Open a crate on `random`: the stacks it holds. Never empty. Pure given the rolls. */
export function openCrate(id: string, random: () => number): { id: string; qty: number }[] {
  const rows = CRATE_CONTENTS[id] ?? [];
  const out: { id: string; qty: number }[] = [];
  for (const row of rows) {
    if (row.chance < 1 && random() >= row.chance) continue;
    out.push({ id: row.id, qty: row.min + Math.floor(random() * (row.max - row.min + 1)) });
  }
  if (!out.length && rows.length) out.push({ id: rows[0].id, qty: rows[0].min });
  return out;
}
/** Expected vendor anchor value of a crate's contents (the economy sim's check 2). */
export function crateExpectedAnchor(id: string, anchorOf: (id: string) => number): number {
  return (CRATE_CONTENTS[id] ?? []).reduce((sum, row) => sum + row.chance * (row.min + row.max) / 2 * anchorOf(row.id), 0);
}

// ── The Lodge Warden's Ledger Catch ──────────────────────────────────────────

/** FNV-1a, 32-bit. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** The waters a Ledger Catch can swim in, weighted to the ones a Worn Rod reaches. */
const LEDGER_WATERS: readonly WaterId[] = ['mere', 'seep', 'mere', 'magma'];
/** Today's Ledger Catch: one species and its water, from the day and the player's seed. Pure. */
export function ledgerCatch(day: string, seed: number): { id: string; water: WaterId } {
  const h = hash32(`${day}:${seed >>> 0}`);
  return { id: LEDGER_CATCH_IDS[h % LEDGER_CATCH_IDS.length], water: LEDGER_WATERS[(h >>> 8) % LEDGER_WATERS.length] };
}
/** The Ledger Catch reward: 10 minutes of income (rule I), a floor, and Fishing XP by the water's tier. */
export const LEDGER_REWARD = { goldSeconds: 600, goldFloor: 120, xpCommons: 10 } as const;
export function ledgerXp(water: WaterId): number { return WATERS[water].xp[0] * LEDGER_REWARD.xpCommons; }
/** The charm the n-th turn-in (1-based) adds, if any. */
export function ledgerGift(turnIns: number): CharmDef | undefined {
  return LODGE_CHARMS.find(c => c.turnIns === turnIns);
}

// ── The fishing save (`godforge-fishing`): fishing-save.ts, light for the eager cloud-save table ──
export { emptyFishingSave, coerceFishingSave, mergeFishingSaves, FISHING_KEY } from './fishing-save';
export type { FishingSave } from './fishing-save';
