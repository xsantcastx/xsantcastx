/**
 * pets.model.ts — the Keeper's pets: who they are, where each is found, what
 * each one helps with, what it eats, and the bond's small rules
 * (docs/handoff/pets.md; lore: docs/world/lore-addendum.md, "Pets").
 *
 * Owner rule: everything has meaning. Each pet has
 *   a SOURCE   a real place in play (a crate, a cleared corridor, a harvested
 *              thicket, the Board Herald, a guardian's fall) — never a gift;
 *   a USE      one small, distinct helper while it follows you;
 *   LORE       its Codex entry and Glim's first word on meeting it;
 *   VISIBILITY it follows the Keeper in towns, hunts and the Delve, lives in
 *              the Satchel's pet well, and has a Codex row with "Found in".
 *
 * Pure: no Angular, no DOM. The economy sim and scripts/check-meaning.js read
 * PETS and PET_TUNING directly.
 */
import { PET_LOVE_CEILING, type PetRecord, type PetsState } from './pets-save.model';

export type PetId = 'ember-newt' | 'prism-mothkit' | 'ink-pup' | 'star-owlet' | 'moss-hedgehog' | 'rivet-hatchling' | 'shade-kit' | 'sunling';
export type PetRealm = 'infernal' | 'luminous' | 'umbral' | 'celestial' | 'verdant';
/**
 * The helpers, one per pet:
 *   glow    a warm light of its own in the Delve
 *   xp      a little more skill XP in its own realm
 *   warn    barks when a creature winds up behind you, or a shade is near
 *   scent   ore within a few cells shows on the Delve map
 *   gather  a hunting-ground harvest in its realm sometimes yields one more
 *   fetch   carries loose drops back to you
 *   fish    a bite comes sooner
 *   mend    the Keeper's wounds close slowly after a few quiet seconds
 */
export type PetAbility = 'glow' | 'xp' | 'warn' | 'scent' | 'gather' | 'fetch' | 'fish' | 'mend';
/** How it is found: an egg to hatch, or a pet you rescue (it comes to you awake). */
export type PetArrival = 'egg' | 'rescue';
/** Where its source sits in play (the e2e and the Codex read it). */
export type PetSourceKind = 'crate' | 'hunt' | 'gather' | 'bounty' | 'guardian';

export interface PetSource {
  kind: PetSourceKind;
  /** A tally key (pets-save.model.ts) and how many it takes, or a once-flag / bounty days. */
  tally?: string;
  flag?: string;
  claimDays?: number;
  need: number;
}

export interface PetDef {
  id: PetId;
  realm: PetRealm;
  arrival: PetArrival;
  /** Rarer pets come from the deep places. */
  rare: boolean;
  ability: PetAbility;
  source: PetSource;
  /** Its favourite food (+2 affection) and what else it eats (+1). Real satchel stacks. */
  favourite: string;
  likes: readonly string[];
  /** English names for the meaning check and the specs (players read the i18n table). */
  name: string;
  /** Found in… (English, for check-meaning; the Codex reads the i18n table). */
  foundIn: string;
  usedFor: string;
  lore: string;
}

/** The guardians' once-flags (towns/infernal.ts, towns/umbral-delve.ts, towns/luminous-delve.ts), copied so this file stays a leaf; the spec pins them. */
export const PET_FURNACE_FLAG = 'banked-furnace-defeated';
export const PET_WARDEN_FLAG = 'gloam-warden-defeated';
export const PET_HOLLOW_SUN_FLAG = 'hollow-sun-defeated';

export const PETS: readonly PetDef[] = [
  {
    id: 'ember-newt', realm: 'infernal', arrival: 'egg', rare: false, ability: 'glow',
    source: { kind: 'crate', tally: 'crate:seam-crate', need: 1 },
    favourite: 'ember-grub', likes: ['emberling', 'cinder-ore'],
    name: 'Ember Newt',
    foundIn: 'Ember Delve: a Seam Crate fished from its waters, the first one you open',
    usedFor: 'its tail is a little lamp: a warm light of its own in the Delve',
    lore: 'Seam newts lay their eggs where the Delve keeps its heat. A crate left long enough in warm water is the warmest place they know.',
  },
  {
    id: 'prism-mothkit', realm: 'luminous', arrival: 'rescue', rare: false, ability: 'xp',
    source: { kind: 'hunt', tally: 'kill:reflection-channels', need: 6 },
    favourite: 'sunbloom', likes: ['solar-resin', 'starlight-herb'],
    name: 'Prism Moth-kit',
    foundIn: 'Reflection Channels: caught in a Prism Forager\'s crystal ribs, freed after six Foragers',
    usedFor: 'it hums while you work: a little more skill XP in the Luminous',
    lore: 'Foragers swallow light, and sometimes the small things that follow it. A moth-kit freed from the ribs keeps humming the note it was caught on.',
  },
  {
    id: 'ink-pup', realm: 'umbral', arrival: 'rescue', rare: false, ability: 'warn',
    source: { kind: 'hunt', tally: 'kill:unrecorded-corridors', need: 6 },
    favourite: 'blindfin', likes: ['mere-perch', 'glowcap-minnow', 'mirrorfin'],
    name: 'Ink Pup',
    foundIn: 'Unrecorded Corridors: herded by the Mirror Substitutes, free once six of them fall',
    usedFor: 'it barks when something winds up behind you, or a shade is near',
    lore: 'The Substitutes keep an Ink Pup the way they keep everything: as proof. It has never once agreed with its reflection.',
  },
  {
    id: 'star-owlet', realm: 'celestial', arrival: 'egg', rare: false, ability: 'scent',
    source: { kind: 'bounty', claimDays: 3, need: 3 },
    favourite: 'starlight-herb', likes: ['moonpetal-herb', 'glowcap-minnow', 'moonwake-bloom'],
    name: 'Star Owlet',
    foundIn: 'Rootglass Canopy: the Board Herald hands you the egg on your third day of bounties',
    usedFor: 'it hoots at ore: veins within a few cells show on the Delve map',
    lore: 'Orrery owls nest where the old star charts were kept. The Herald found this egg wrapped in a chart, and keeps saying it was "filed under eggs".',
  },
  {
    id: 'moss-hedgehog', realm: 'verdant', arrival: 'rescue', rare: false, ability: 'gather',
    source: { kind: 'gather', tally: 'gather:rootglass-thicket', need: 8 },
    favourite: 'verdant-sap', likes: ['ember-grub', 'world-root-bark'],
    name: 'Moss Hedgehog',
    foundIn: 'Rootglass Thicket: asleep under a patch you have harvested eight times',
    usedFor: 'it noses through what you cut: a Verdant harvest sometimes yields one more',
    lore: 'Its quills are moss that decided to stay. It sleeps under whatever regrows fastest, and wakes to whoever keeps it growing.',
  },
  {
    id: 'rivet-hatchling', realm: 'infernal', arrival: 'egg', rare: true, ability: 'fetch',
    source: { kind: 'guardian', flag: PET_FURNACE_FLAG, need: 1 },
    favourite: 'cinder-ore', likes: ['rusted-rivet', 'slag-fragment'],
    name: 'Rivet Maw hatchling',
    foundIn: 'The Underhearth: kept warm in the Banked Furnace, yours once it first falls',
    usedFor: 'it scavenges: loose drops are carried back to you',
    lore: 'Rivet Maws carry what falls. The Furnace kept one egg banked with its embers, as if it knew something would need carrying after it.',
  },
  {
    id: 'shade-kit', realm: 'umbral', arrival: 'egg', rare: true, ability: 'fish',
    source: { kind: 'guardian', flag: PET_WARDEN_FLAG, need: 1 },
    favourite: 'umbral-ink', likes: ['blindfin', 'inkstone', 'mirrorfin'],
    name: 'Shade-kit',
    foundIn: 'The Ink Deeps: the egg the Gloam Warden guarded, yours once it falls',
    usedFor: 'it watches the water: a bite comes sooner when you fish',
    lore: 'Shades are what a light leaves behind. A shade-kit is what a shade leaves behind: small, curious, and very fond of fish.',
  },
  {
    id: 'sunling', realm: 'luminous', arrival: 'egg', rare: true, ability: 'mend',
    source: { kind: 'guardian', flag: PET_HOLLOW_SUN_FLAG, need: 1 },
    favourite: 'solar-resin', likes: ['luminous-prism', 'starlight-herb'],
    name: 'Sunling',
    foundIn: 'The Luminous Prism Mines: the warm egg at the Hollow Sun\'s heart, yours once it falls',
    usedFor: 'it shines on you: after a few quiet seconds your wounds close slowly',
    lore: 'The Hollow Sun was hollow because it was keeping something warm. What hatches is a very small sun that has decided you are its sky.',
  },
];

export const PET_IDS: readonly PetId[] = PETS.map(p => p.id);
export const petDef = (id: string): PetDef | undefined => PETS.find(p => p.id === id);

// ── The bond ────────────────────────────────────────────────────────────────

/** Affection ceiling, the trick and the hat. No decay, no streak: a meter that only fills. */
export const LOVE_MAX = PET_LOVE_CEILING;
export const TRICK_AT = 4;
export const HAT_AT = 10;
/** Meals that count per pet per day; after that it is simply full until tomorrow. */
export const FEEDS_PER_DAY = 3;

/** Every helper's size (the sim and the specs read these; one place to tune). */
export const PET_TUNING = {
  /** glow: the light's radius in world px and its strength (the lantern's is ~6 cells). */
  glowRadius: 150, glowLight: .75,
  /** xp: the share of skill XP added in the pet's realm (rounded up, at least 1). */
  xpShare: .1,
  /** warn: how far a winding-up creature or a shade is noticed (world px), and the bark's rest (s). */
  warnRange: 560, warnRest: 8,
  /** scent: ore within this many cells shows on the map. */
  scentCells: 16, scentMax: 12,
  /** gather: the chance a Verdant harvest yields one more. */
  gatherChance: .25,
  /** fetch: how far a drop is fetched from (world px) and how fast it is carried. */
  fetchReach: 520, fetchSpeed: 300,
  /** fish: the bite speed multiplier (stacks under the engine's cap of 4). */
  biteBoost: 1.25,
  /** mend: seconds unhurt before it starts, and the share of max HP restored per second (never in a fight). */
  mendAfter: 6, mendShare: .01,
} as const;

/** Local calendar day (the appetite resets at midnight, never a streak). */
export function dayKey(at: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}`;
}

export const isHatched = (r: PetRecord | undefined): boolean => !!r && r.hatched > 0;
export const knowsTrick = (r: PetRecord | undefined): boolean => !!r && r.love >= TRICK_AT;
/** Its hat: love unlocks it, or the Hatbox of Small Crowns (a Lost Cabinet's) lets any hatched pet wear it now. */
export const hasHat = (r: PetRecord | undefined, hatbox = false): boolean => !!r && (r.love >= HAT_AT || (hatbox && isHatched(r)));

/**
 * The Courier's Honeycomb (a Lost Cabinet's treat, shared/cabinets): every pet
 * eats it like its favourite. Copied so this file stays a leaf; cabinets.spec
 * pins it to cabinets.model PET_TREAT_ID.
 */
export const PET_TREAT = 'courier-honeycomb';

/** Meals left today (FEEDS_PER_DAY on a new day). */
export function mealsLeft(r: PetRecord, day: string, extra = 0): number {
  return Math.max(0, FEEDS_PER_DAY + Math.max(0, extra) - (r.feedDay === day ? r.feeds : 0));
}

export type FeedRefusal = 'unknown' | 'egg' | 'food' | 'full';
/** What one meal of `food` does to a pet today: the affection gained, or why it is refused. */
export function feedResult(def: PetDef, r: PetRecord | undefined, food: string, day: string, extraMeals = 0): { ok: true; gain: number; favourite: boolean } | { ok: false; code: FeedRefusal } {
  if (!r) return { ok: false, code: 'unknown' };
  if (!isHatched(r)) return { ok: false, code: 'egg' };
  const favourite = food === def.favourite || food === PET_TREAT;
  if (!favourite && !def.likes.includes(food)) return { ok: false, code: 'food' };
  if (mealsLeft(r, day, extraMeals) <= 0) return { ok: false, code: 'full' };
  return { ok: true, gain: favourite ? 2 : 1, favourite };
}

/** The ledgers a pet is found from (the play view reads them once a second). */
export interface PetLedger {
  tally: Readonly<Record<string, number>>;
  /** Days a bounty was claimed (bounty-save.model.ts). */
  claimDays: number;
  /** A guardian's once-flag is set (the delve save). */
  flag: (id: string) => boolean;
}

/** Whether a pet's source has been reached in play. */
export function sourceReached(def: PetDef, ledger: PetLedger): boolean {
  const s = def.source;
  if (s.tally) return (ledger.tally[s.tally] ?? 0) >= s.need;
  if (s.flag) return ledger.flag(s.flag);
  if (s.claimDays) return ledger.claimDays >= s.claimDays;
  return false;
}

/** Pets the ledgers have earned that the Keeper does not have yet (in table order). */
export function earnedPets(state: PetsState, ledger: PetLedger): PetDef[] {
  return PETS.filter(def => !state.pets[def.id] && sourceReached(def, ledger));
}

/** How far along a pet's source is, for the Codex ("3 of 6"). */
export function sourceProgress(def: PetDef, ledger: PetLedger): { have: number; need: number } {
  const s = def.source;
  if (s.tally) return { have: Math.min(s.need, ledger.tally[s.tally] ?? 0), need: s.need };
  if (s.claimDays) return { have: Math.min(s.claimDays, ledger.claimDays), need: s.claimDays };
  return { have: s.flag && ledger.flag(s.flag) ? 1 : 0, need: 1 };
}

/** The one pet following (hatched and chosen), or null. */
export function followingPet(state: PetsState): PetDef | null {
  const def = state.active ? petDef(state.active) : undefined;
  return def && isHatched(state.pets[def.id]) ? def : null;
}

/** The helper of the pet following, or null. */
export function activeAbility(state: PetsState): PetAbility | null {
  return followingPet(state)?.ability ?? null;
}

/** FNV-1a: a stable 0..1 from a mutation id, so a retried harvest rolls the same. */
export function petRoll(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h >>> 0) / 0x100000000;
}

/** gather: does this Verdant harvest (by its mutation id) yield one more? */
export function gatherBonus(mutationId: string): boolean {
  return petRoll(`pet-gather:${mutationId}`) < PET_TUNING.gatherChance;
}

/** xp: the XP added to a skill action of `xp` in the pet's realm. */
export function xpBonus(xp: number): number {
  return xp > 0 ? Math.max(1, Math.ceil(xp * PET_TUNING.xpShare)) : 0;
}
