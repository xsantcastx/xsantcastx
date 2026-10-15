/**
 * pet-roles.ts — what each pet DOES while it follows (docs/handoff/pets-and-glim-alive.md).
 *
 * Owner, 2026-10-15: "the pets should do something, like help you in combat or
 * some pets in skilling or doing random stuff, not just follow."
 *
 * Every pet keeps its passive helper (pets.model.ts PetAbility) and gains:
 *   a ROLE     combat (it fights beside you) or skilling (it works beside you);
 *   a MOVE     its own visible action, from level 1 (a bite, a dash, a chomp, a
 *              healing pulse; a forage, a scouted dig, a warmed vein, a guided cast);
 *   a SECOND   a second move that opens at pet level SECOND_AT;
 *   a LEVEL    1..5, grown only by using it (a bite that lands, a node gathered,
 *              a find dug up). Never bought, never lost, no decay.
 *
 * And the Keeper's COMMAND from the pet card: Follow (its role, as it sees
 * fit), Stay (it sits where it is), Fight (every pet joins a fight, combat pets
 * reach further), Gather (every pet works, combat pets keep out of fights),
 * Play (no work at all: tricks, chasing motes, napping).
 *
 * Pets never die: a combat pet that takes too many blows gets TIRED, trots back
 * behind the Keeper and rests a while, then comes back to the fight.
 *
 * Pure: no Angular, no DOM. The engine (pet-sprite.ts / engine.ts), the pet
 * card, the economy sim (`--pets`) and check-meaning read these tables.
 */
import type { PetId } from './pets.model';

export type PetRole = 'combat' | 'skilling';
export type PetCommand = 'follow' | 'stay' | 'fight' | 'gather' | 'play';
export const PET_COMMANDS: readonly PetCommand[] = ['follow', 'stay', 'fight', 'gather', 'play'];
export const isPetCommand = (v: unknown): v is PetCommand => typeof v === 'string' && (PET_COMMANDS as readonly string[]).includes(v);

/**
 * The moves. Combat: bite (+ a short stun), dash (through every foe on its
 * line), chomp (cracks armour: the foe takes more from every blow a while),
 * pulse (a healing light on the Keeper, even mid-fight). Skilling: forage (it
 * works a ready gathering node beside you), scout (it finds a buried spot and
 * digs it up when you come), kindle (it warms an ore vein so it breaks at
 * once), guide (it hovers over your bob: fish bite sooner).
 */
export type PetMove = 'bite' | 'dash' | 'chomp' | 'pulse' | 'forage' | 'scout' | 'kindle' | 'guide';
/**
 * Second moves (pet level SECOND_AT): howl (every foe near is stunned),
 * pounce (its dash stuns too), guard (it takes a blow meant for you), flare
 * (a burst of light that stuns), sniff (a second forage nearby, and its digs
 * turn up a little more often), farsight (its scouted spots pay a little more),
 * forgeheat (warms two veins at a time), shimmer (it also lights the dark
 * around it, like a small lantern).
 */
export type PetSecond = 'howl' | 'pounce' | 'guard' | 'flare' | 'sniff' | 'farsight' | 'forgeheat' | 'shimmer';

export interface PetRoleDef { role: PetRole; move: PetMove; second: PetSecond }

export const PET_ROLES: Readonly<Record<PetId, PetRoleDef>> = {
  'ink-pup': { role: 'combat', move: 'bite', second: 'howl' },
  'shade-kit': { role: 'combat', move: 'dash', second: 'pounce' },
  'rivet-hatchling': { role: 'combat', move: 'chomp', second: 'guard' },
  'sunling': { role: 'combat', move: 'pulse', second: 'flare' },
  'moss-hedgehog': { role: 'skilling', move: 'forage', second: 'sniff' },
  'star-owlet': { role: 'skilling', move: 'scout', second: 'farsight' },
  'ember-newt': { role: 'skilling', move: 'kindle', second: 'forgeheat' },
  'prism-mothkit': { role: 'skilling', move: 'guide', second: 'shimmer' },
};
export const petRole = (id: string): PetRoleDef | undefined => (PET_ROLES as Record<string, PetRoleDef>)[id];

// ── Levels ──────────────────────────────────────────────────────────────────

/** Pet XP needed for levels 1..5. Grown by use only (PET_XP). */
export const PET_LEVELS: readonly number[] = [0, 12, 40, 90, 170];
export const PET_LEVEL_MAX = PET_LEVELS.length;
/** The level its second move opens at. */
export const SECOND_AT = 3;
/** Pet XP per kind of use (the host books them, a little at a time). */
export const PET_XP = { hit: 1, heal: 1, gather: 2, find: 3, warm: 1, guide: 1 } as const;
export type PetXpKind = keyof typeof PET_XP;

export function petLevel(xp: number): number {
  let n = 1;
  for (let i = 1; i < PET_LEVELS.length; i++) if (xp >= PET_LEVELS[i]!) n = i + 1;
  return n;
}
/** XP into this level and the level's span (for the card's bar); span 0 at the top. */
export function levelProgress(xp: number): { level: number; into: number; span: number } {
  const level = petLevel(xp);
  const lo = PET_LEVELS[level - 1]!, hi = PET_LEVELS[level];
  return { level, into: xp - lo, span: hi === undefined ? 0 : hi - lo };
}
export const hasSecond = (xp: number): boolean => petLevel(xp) >= SECOND_AT;

// ── Tuning (one place; the sim and specs read it) ───────────────────────────

/**
 * Every number a pet's behaviour uses. Combat is small next to the Keeper's own
 * blow (a swing is 20 every .52 s, ~38 a second): a pet adds a few a second.
 */
export const PET_ACT = {
  /** Combat: how near a foe must be to the Keeper (world px at figure 1) for a pet to join, and under Fight. */
  engage: 300, engageFight: 460,
  /** Reach of a pet's bite/chomp (world px at figure 1). */
  reach: 70,
  /** Base damage of each move, plus this much per level above 1. */
  biteDamage: 4, dashDamage: 5, chompDamage: 3, perLevel: 1,
  /** A skilling pet told to Fight nips: this much, plus one every two levels. */
  nipDamage: 2,
  /** Seconds between a pet's blows. */
  biteRest: 1.6, dashRest: 3.4, chompRest: 2,
  /** The bite's stun (s), the dash's line (px), the chomp's crack: a foe takes this much more from every blow, this long. */
  stun: .7, dashSpan: 260, crack: .2, crackFor: 5,
  /** The Sunling's pulse: once the Keeper is below this share of max HP, this share back, this often (s). */
  pulseBelow: .7, pulseShare: .04, pulseRest: 7,
  /** Second moves: howl / flare stun every foe within this (px) for this long (s), this often (s). */
  howlRange: 260, howlStun: .9, howlRest: 16, flareRange: 240, flareStun: 1.2, flareRest: 14,
  /** guard: the Rivet hatchling takes the next blow meant for the Keeper, at most this often (s). */
  guardRest: 12,
  /** A pet's own stamina: a blow on it costs this much; below `tiredAt` it rests `restFor` s, then comes back full. */
  stamina: 100, blowCost: 34, tiredAt: 25, restFor: 18,
  /** Sometimes a foe swings at the pet instead (every Nth blow the pet lands draws the foe's next wind-up). */
  aggroEvery: 3,
  /** Skilling: forage reach from the Keeper (px), its rest (s); sniff adds a second forage within the same rest. */
  forageReach: 300, forageRest: 24,
  /** Scout: a spot this far ahead (px, min..max), this often (s); the Keeper digs it within this (px). */
  scoutNear: 180, scoutFar: 420, scoutRest: 75, scoutDig: 80,
  /** Kindle: an ore vein within this many cells, warmed this often (s); a warm vein takes this many times the damage. */
  kindleCells: 4, kindleRest: 18, kindleBoost: 3,
  /** Guide: the bite speed while the moth hovers over the bob (stacks under the engine's cap of 4). */
  guideBoost: 1.15,
  /** shimmer: the moth's own small light in the dark (radius px, strength). */
  shimmerRadius: 110, shimmerLight: .55,
} as const;

/** Damage of a move at a level (bite, dash, chomp). */
export function moveDamage(move: PetMove, level: number): number {
  const base = move === 'bite' ? PET_ACT.biteDamage : move === 'dash' ? PET_ACT.dashDamage : move === 'chomp' ? PET_ACT.chompDamage : 0;
  return base ? base + PET_ACT.perLevel * Math.max(0, Math.min(PET_LEVEL_MAX, level) - 1) : 0;
}
/** A skilling pet's nip under Fight. */
export function nipDamage(level: number): number {
  return PET_ACT.nipDamage + Math.floor(Math.max(0, Math.min(PET_LEVEL_MAX, level) - 1) / 2);
}
/** Seconds between blows of a move. */
export function moveRest(move: PetMove): number {
  return move === 'bite' ? PET_ACT.biteRest : move === 'dash' ? PET_ACT.dashRest : move === 'chomp' ? PET_ACT.chompRest : move === 'pulse' ? PET_ACT.pulseRest : 0;
}
/** A pet's damage per second against one foe at a level (the sim caps it against the Keeper's own). */
export function moveDps(move: PetMove, level: number): number {
  const rest = moveRest(move);
  return rest ? moveDamage(move, level) / rest : 0;
}

/** Does the pet join a fight under this command? (role first; Fight brings everyone, Gather/Play/Stay keep out). */
export function fights(role: PetRole, command: PetCommand): boolean {
  if (command === 'fight') return true;
  if (command === 'follow') return role === 'combat';
  return false;
}
/** Does the pet work (forage, scout, kindle, guide) under this command? */
export function works(role: PetRole, command: PetCommand): boolean {
  if (command === 'gather') return true;
  if (command === 'follow') return role === 'skilling';
  return false;
}

// ── Finds: the little things a pet digs up (scout, and any pet now and then) ──

/** Finds a day, per pet: the Star Owlet's scouted spots, and the small trinkets any pet digs up. */
export const FINDS_PER_DAY = { scout: 4, trinket: 2 } as const;
/** Seconds of following before any pet may dig up a small trinket (each time). */
export const TRINKET_EVERY = 8 * 60;
/** A scouted spot pays coins: base + per level (farsight +50 %). */
export const SCOUT_COINS = { base: 6, perLevel: 2, farsight: 1.5 } as const;

export function scoutCoins(level: number, farsight: boolean): number {
  const c = SCOUT_COINS.base + SCOUT_COINS.perLevel * Math.max(0, level - 1);
  return Math.round(farsight ? c * SCOUT_COINS.farsight : c);
}

/** Finds left today for this kind (the record counts each kind per local day; a new day starts at zero). */
export function findsLeft(kind: keyof typeof FINDS_PER_DAY, day: string, rec: { findDay: string; scouts: number; trinkets: number }): number {
  const used = rec.findDay === day ? (kind === 'scout' ? rec.scouts : rec.trinkets) : 0;
  return Math.max(0, FINDS_PER_DAY[kind] - used);
}
