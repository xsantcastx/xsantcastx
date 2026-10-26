/**
 * td-elites.ts — elite packs in the top-down world (design-bible §5.7 / roadmap §10 item 3; loot-and-combat.md §5).
 *
 * Diablo II's blue and gold names, brought from the side view (shared/loot/champions.ts) into the endless surface and
 * the dungeon floors. Now and then a wild spawn comes up as:
 *  - a CHAMPION PACK: 2–4 tougher copies of the creature, a blue pixel aura under each, one shared affix,
 *    rank `champion` (×3.25 life, ×1.3 blow; Gold ×4 through rollHuntGold, 2 item rolls at 45%, one ladder step);
 *  - a UNIQUE: a named leader ("Grimfang the Hollow") with 1–3 affixes and a gold aura, rank `unique` (×6 life,
 *    ×1.5 blow; Gold ×6, 3 item rolls at 60%, two ladder steps), followed by 2–4 ordinary minions.
 *
 * Rates are modest — about one pack per 16 eligible spawns (ELITE_CHANCE), a quarter of them uniques — and they only
 * come where they belong: never in a town or a safe square, never a boss or an authored champion, never a creature
 * under level 3 (the first hunt stays gentle). The zone decides, never the Keeper's level (td-zones.ts).
 *
 * The roll is deterministic per spawn (its key, the times it has fallen, a session salt): a chunk that scrolls away
 * and back brings back the same pack; the pack re-rolls only once it has been killed.
 *
 * Pure (numbers, names, rolls, loot floors). The fight's behaviour lives in td-mobs.ts, the pixels in td-engine.ts.
 */
import { MIN_PACK_LEVEL, RANK_DAMAGE, RANK_HP, hashSeed, seededRandom, type MonsterRank } from '../../shared/loot/champions';
import type { DamageType } from '../../shared/loot/damage.model';
import { PACK_AURA_IDS, PACK_AURA_LOOKS, type PackAuraId } from './td-pack-aura';

export type EliteAffix =
  | 'extra-strong' | 'extra-fast' | 'stone-skin' | 'cursed' | 'fire-enchanted'
  | 'cold-aura' | 'spectral-hit' | 'mana-burn' | 'teleport' | 'lightning-enchanted'
  // Eclipse only (td-phases.ts): never in the random pool below.
  | 'eclipse-touched'
  // S6 (monsters-abilities.md §4): the ten new ones. Aura Enchanted is carried as `aura-<id>` (the pack's aura), so the
  // wire and the plate already know which.
  | 'lightless' | 'whispering' | 'grave-called' | 'mirrored' | 'ember-hearted' | 'brutal' | 'multishot' | 'shielded-by-kin' | 'vampiric'
  | `aura-${PackAuraId}`;

/** The shipped pool (the shipped ten). */
export const ELITE_AFFIXES: readonly EliteAffix[] = [
  'extra-strong', 'extra-fast', 'stone-skin', 'cursed', 'fire-enchanted',
  'cold-aura', 'spectral-hit', 'mana-burn', 'teleport', 'lightning-enchanted',
];
/** The new pool (§4), drawn beside the shipped ten. Aura Enchanted takes a slot and names its aura from the zone's list. */
export const NEW_AFFIXES: readonly EliteAffix[] = ['lightless', 'whispering', 'grave-called', 'mirrored', 'ember-hearted', 'brutal', 'multishot', 'shielded-by-kin', 'vampiric'];
/** The pack's aura, if it is Aura Enchanted. */
export function auraAffix(affixes: readonly string[] | undefined): PackAuraId | null {
  const a = affixes?.find(x => x.startsWith('aura-'));
  const id = a?.slice(5);
  return id && (PACK_AURA_IDS as readonly string[]).includes(id) ? id as PackAuraId : null;
}

export interface EliteAffixDef {
  id: EliteAffix;
  /** The words under the leader's name. */
  name: string;
  /** Its tell's colour (art-bible ramps; the affix text and its pixels use it). */
  color: string;
  /** Multiplies the creature's blow. */
  damage?: number;
  /** Multiplies its walk speed. */
  speed?: number;
  /** Divides the time between its bites (a quicker creature bites sooner). */
  rate?: number;
  /** Its blows and shots carry this type. */
  hits?: DamageType;
  /** What it takes of every hit on it (Stone Skin). */
  take?: number;
  /** Only one per creature from the same group (one element on a blow, never two). */
  group?: 'element';
}

const AURA_NAME_LIST = ['Might', 'Blessed Aim', 'Conviction', 'Redemption', 'Holy Fire', 'Holy Freeze', 'Holy Shock', 'Fanaticism', 'Prayer', 'Vigor', 'Thorns', 'Lightless', 'Cant-Chorus'];
export const AFFIX_DEFS: Readonly<Record<EliteAffix, EliteAffixDef>> = {
  'extra-strong': { id: 'extra-strong', name: 'Extra Strong', color: '#ff6a3d', damage: 1.5 },
  'extra-fast': { id: 'extra-fast', name: 'Extra Fast', color: '#9db8a8', speed: 1.6, rate: 1.3 },
  'stone-skin': { id: 'stone-skin', name: 'Stone Skin', color: '#c9b79c', take: .6 },
  // Its blows mark the Keeper for CURSE_SECONDS: −CURSE_RESIST to every resist, and +CURSE_HURT more taken.
  cursed: { id: 'cursed', name: 'Cursed', color: '#b06bff' },
  // Its blows burn; it bursts in fire FIRE_BURST.delay seconds after it falls (a hostile ring shows where).
  'fire-enchanted': { id: 'fire-enchanted', name: 'Fire Enchanted', color: '#ffb347', damage: 1.25, hits: 'fire', group: 'element' },
  // Its blows freeze, and the cold round it (COLD_AURA_R) slows the Keeper's step by COLD_SLOW.
  'cold-aura': { id: 'cold-aura', name: 'Cold Aura', color: '#9fd8ff', hits: 'cold', group: 'element' },
  // Every blow lands as a different element (SPECTRAL), a little harder.
  'spectral-hit': { id: 'spectral-hit', name: 'Spectral Hit', color: '#e0c8ff', damage: 1.2, group: 'element' },
  // Its blows drain the Keeper's mana (MANA_BURN).
  'mana-burn': { id: 'mana-burn', name: 'Mana Burn', color: '#00d4ff' },
  // When its prey stands off (TELEPORT.min) it blinks to his side after a TELEPORT.tell wind-up, every TELEPORT.cd s.
  teleport: { id: 'teleport', name: 'Teleport', color: '#c78bff' },
  'lightning-enchanted': { id: 'lightning-enchanted', name: 'Lightning Enchanted', color: '#ffe36d', damage: 1.2, hits: 'lightning', group: 'element' },
  // Under an eclipse only (design-bible §5.7): the seam breathes through it. A dark corona round its body, a pale ring
  // at the edge; a little harder, and its drops climb one ladder step (lootRank).
  'eclipse-touched': { id: 'eclipse-touched', name: 'Eclipse-touched', color: '#f0e0ff', damage: 1.1 },
  // ── S6 (§4) ──
  lightless: { id: 'lightless', name: 'Lightless', color: '#140c1c' },
  whispering: { id: 'whispering', name: 'Whispering', color: '#d8c0ff' },
  'grave-called': { id: 'grave-called', name: 'Grave-called', color: '#e8e0cc' },
  mirrored: { id: 'mirrored', name: 'Mirrored', color: '#b06bff' },
  // It bursts 1 s after it falls (EMBER_HEART): bigger and later than Fire Enchanted, never both (one element).
  'ember-hearted': { id: 'ember-hearted', name: 'Ember-hearted', color: '#ff6a3d', group: 'element' },
  brutal: { id: 'brutal', name: 'Brutal', color: '#c2402a' },
  multishot: { id: 'multishot', name: 'Multishot', color: '#ffe36d' },
  'shielded-by-kin': { id: 'shielded-by-kin', name: 'Shielded by Kin', color: '#9db8a8' },
  vampiric: { id: 'vampiric', name: 'Vampiric', color: '#8a4b3a' },
  ...Object.fromEntries(PACK_AURA_IDS.map(id => [`aura-${id}`, { id: `aura-${id}`, name: AURA_NAME_LIST[PACK_AURA_IDS.indexOf(id)], color: PACK_AURA_LOOKS[id].tones.body }])),
} as Readonly<Record<EliteAffix, EliteAffixDef>>;
/** The pack auras' names (EN; the HUD's ES is td-abilities.i18n `aura.<id>`). */
export const AURA_NAMES_EN: Readonly<Record<PackAuraId, string>> = {
  might: 'Might', 'blessed-aim': 'Blessed Aim', conviction: 'Conviction', redemption: 'Redemption', 'holy-fire': 'Holy Fire',
  'holy-freeze': 'Holy Freeze', 'holy-shock': 'Holy Shock', fanaticism: 'Fanaticism', prayer: 'Prayer', vigor: 'Vigor',
  thorns: 'Thorns', lightless: 'Lightless', 'cant-chorus': 'Cant-Chorus',
};
/** Ember-hearted's burst (§4): 2B fire in 2 tiles, 1 s after it falls, its ring first. */
export const EMBER_HEART = { r: 32, delay: 1, share: 2 } as const;
/** Brutal: every third blow is a heavy one (2.2B) after a 0.6 s red arc. */
export const BRUTAL = { every: 3, share: 2.2, tell: .6 } as const;
/** Multishot: three shots 15° apart, each 0.6 of the shot. */
export const MULTISHOT = { n: 3, deg: 15, share: .6 } as const;
/** Shielded by Kin: 50% less taken while a follower stands within 3 tiles. */
export const KIN_SHIELD = { r: 48, take: .5 } as const;
/** Vampiric: heals 25% of what its blows deal. */
export const VAMPIRIC = .25;
/** Lightless (the affix): the light snuffed in 3 tiles round it. */
export const LIGHTLESS_R = 48;
/** Whispering: Hush per blow. */
export const WHISPER_HUSH = 3;
/** Grave-called: at half life, two Bone Walkers at its level − 2. */
export const GRAVE_CALL = { at: .5, count: 2, under: 2 } as const;
/** Mirrored: a copy that dies in one hit and deals half a blow. */
export const MIRROR_SHARE = .5;

/** The Eclipse-touched tones: the corona's dark disc, its pale ring and the body's dusk (effects-spec Shadow ramp). */
export const TOUCHED_TONES = { dark: '#140c1c', ring: '#f0e0ff', glow: '#b06bff', edge: '#6b3aa0' } as const;

/**
 * Make a spawn Eclipse-touched (td-phases.ts rollTouched): a pack it already leads gains the affix; a lone creature
 * becomes a champion with the affix and one more (design-bible §5.7: "+1 affix"), and no followers.
 */
export function touchPack(pack: ElitePack | null, r: () => number): ElitePack {
  if (pack) return pack.affixes.includes('eclipse-touched') ? pack : { ...pack, affixes: ['eclipse-touched', ...pack.affixes] };
  return { rank: 'champion', affixes: ['eclipse-touched', ...rollAffixes(r, 1)], name: null, followers: 0 };
}

/** Is this creature Eclipse-touched? */
export function isTouched(tag: Pick<EliteTag, 'affixes'> | undefined): boolean { return !!tag?.affixes.includes('eclipse-touched'); }

/** About one pack per 16 eligible spawns (the brief: 1 in 12–20), a quarter of them uniques. */
export const ELITE_CHANCE = 1 / 16;
export const UNIQUE_SHARE = .25;
/** The Cursed mark on the Keeper. */
export const CURSE_SECONDS = 4;
export const CURSE_RESIST = 25;
export const CURSE_HURT = .15;
/** Mana a Mana Burn blow takes. */
export const MANA_BURN = 14;
/** The Cold Aura: its reach (art px, 3 tiles) and how much it slows the Keeper's step. */
export const COLD_AURA_R = 48;
export const COLD_SLOW = .3;
/** Fire Enchanted's death burst: its reach (art px), its delay (the ground tell), its blow as a share of the creature's. */
export const FIRE_BURST = { r: 26, delay: .6, share: 1.5 } as const;
/** Teleport: it blinks when its prey is farther than `min`, after a `tell`-second wind-up, every `cd` seconds. */
export const TELEPORT = { min: 64, tell: .45, cd: 5 } as const;
/** The elements a Spectral Hit cycles through. */
export const SPECTRAL: readonly DamageType[] = ['fire', 'cold', 'lightning', 'arcane'];
/** Rank tones: the champion's blue aura and name, the unique's gold. */
export const ELITE_TONES = {
  champion: { core: '#d6ecff', body: '#5aa8ff', edge: '#2f5f9e' },
  unique: { core: '#fff3c0', body: '#ffd25a', edge: '#b0812a' },
} as const;

export type EliteRank = 'champion' | 'unique';
export interface ElitePack {
  rank: EliteRank;
  affixes: EliteAffix[];
  /** A unique leader's name ("Grimfang the Hollow"); null for a champion pack. */
  name: string | null;
  /** How many others come with the leader: champion copies, or a unique's minions. */
  followers: number;
}

/** What a creature in a pack is: the leader (named or first champion), a champion copy, or a unique's minion. */
export interface EliteTag {
  rank: EliteRank;
  role: 'leader' | 'champion' | 'minion';
  affixes: EliteAffix[];
  name: string | null;
}

// Unique names: a first name and a title in the realms' voice — the Seamworks tally-books, the eclipse, the lamps.
export const NAME_FIRST: readonly string[] = [
  'Grimfang', 'Sootjaw', 'Ashmantle', 'Gloamtooth', 'Cinderwake', 'Hollowhymn', 'Rivetgrin', 'Rootgnaw',
  'Glasshowl', 'Inkfang', 'Embermourn', 'Starbiter', 'Marrowgrin', 'Duskclaw', 'Wickmaw', 'Tallowbane',
];
export const NAME_TITLE: readonly string[] = [
  'the Hollow', 'the Unlit', 'the Seam-Eater', 'the Last Ember', 'the Ink-Drinker', 'the Gloamborn',
  'the Tally-Breaker', 'the Cold Wick', 'the Ashen', 'the Lampless', 'the Rivet Maw', 'the Mourning Bell',
];

/** A unique's name from a random source. */
export function eliteName(r: () => number): string {
  return `${NAME_FIRST[Math.floor(r() * NAME_FIRST.length)]} ${NAME_TITLE[Math.floor(r() * NAME_TITLE.length)]}`;
}

/** What the spawn is, for the combining rules (§4): its level, whether it shoots, whether it is bone, where, which auras it may carry. */
export interface AffixContext {
  level?: number;
  ranged?: boolean;
  bone?: boolean;
  levelId?: string;
  /** The zone's aura list (td-pack-aura packAuraPool); empty: no Aura Enchanted. */
  auras?: readonly PackAuraId[];
  /** The difficulty tier ('normal' | 'nightmare' | 'hell'): one more affix on each harder tier. */
  tier?: string;
  /** The new affixes may roll (false keeps the shipped ten only: the specs that pin them). */
  fresh?: boolean;
}

/** May this affix sit on this spawn beside these (§4 "Combining")? */
export function affixAllowed(a: EliteAffix, have: readonly EliteAffix[], o: AffixContext): boolean {
  const g = AFFIX_DEFS[a].group;
  if (g && have.some(x => AFFIX_DEFS[x].group === g)) return false;
  if (a === 'multishot' && !o.ranged) return false;
  if (a === 'grave-called' && !o.bone && !/^(ashen-crypt|hushed-barrow)/.test(o.levelId ?? '')) return false;
  const lightless = (x: string) => x === 'lightless' || x === 'aura-lightless';
  if (lightless(a) && have.some(lightless)) return false;
  if (a.startsWith('aura-') && have.some(x => x.startsWith('aura-'))) return false;
  if ((o.level ?? 99) < 15 && (a === 'teleport' || a === 'extra-fast') && have.some(x => x === 'teleport' || x === 'extra-fast')) return false;
  return true;
}

/** `count` distinct affixes, never two that may not combine. Aura Enchanted rolls as `aura-<id>` from the zone's list. */
export function rollAffixes(r: () => number, count: number, o: AffixContext = {}): EliteAffix[] {
  const out: EliteAffix[] = [];
  const pool: string[] = [...ELITE_AFFIXES, ...(o.fresh ? NEW_AFFIXES : [])];
  if (o.fresh && o.auras?.length) pool.push('aura-enchanted');
  let guard = 0;
  while (out.length < count && pool.length && guard++ < 64) {
    let a = pool.splice(Math.floor(r() * pool.length), 1)[0];
    if (a === 'aura-enchanted') a = `aura-${o.auras![Math.floor(r() * o.auras!.length)]}`;
    if (!affixAllowed(a as EliteAffix, out, o)) continue;
    out.push(a as EliteAffix);
  }
  return out;
}

/**
 * How many affixes a pack carries (§4 "Affixes by zone band"): a champion pack 1 below 15, 2 from 15, 3 from 35; a
 * unique leader 1–2 below 15, 2–3 from 15, 3–4 from 35; Nightmare +1, Hell +1 more, at most 5. With no level given,
 * the shipped counts (a champion 1, a unique 1–3).
 */
export function affixCount(rank: EliteRank, r: () => number, o: AffixContext = {}): number {
  if (o.level === undefined) { if (rank === 'champion') return 1; const k = r(); return k < .3 ? 1 : k < .75 ? 2 : 3; }
  const band = o.level >= 35 ? 2 : o.level >= 15 ? 1 : 0;
  const base = rank === 'champion' ? 1 + band : 1 + band + (r() < .5 ? 1 : 0);
  const tier = o.tier === 'hell' ? 2 : o.tier === 'nightmare' ? 1 : 0;
  return Math.min(5, base + tier);
}

/** May this spawn lead a pack at all? */
export function eliteEligible(o: { level: number; rank?: MonsterRank; safe: boolean }): boolean {
  if (o.safe) return false;
  if ((o.rank ?? 'normal') !== 'normal') return false;     // a boss is itself; an authored champion already is one
  // The zone decides, never the Keeper (td-zones.ts): a spawn's level is its zone's, and from MIN_PACK_LEVEL on any
  // wild zone can raise a pack — a level-40 Keeper in a level-12 zone meets that zone's packs, not his own.
  return o.level >= MIN_PACK_LEVEL;                         // the first hunt stays gentle
}

/**
 * Roll a spawn: null (an ordinary creature, the usual case) or a pack. `seed` is the spawn's own (its key, the times
 * it has fallen, the session salt): the same seed gives the same pack. `o` (S6): the zone's band, the creature, the
 * zone's auras — more affixes in higher zones, the new ones in the pool.
 */
export function rollElite(seed: string, chance = ELITE_CHANCE, o: AffixContext = {}): ElitePack | null {
  const r = seededRandom(hashSeed(`elite|${seed}`));
  const roll = r();
  if (roll >= chance) return null;
  if (roll < chance * UNIQUE_SHARE) {
    const count = affixCount('unique', r, o), affixes = rollAffixes(r, count, o);
    return { rank: 'unique', affixes, name: eliteName(r), followers: o.level === undefined ? 2 + Math.floor(r() * 3) : packFollowers('unique', 2 + Math.floor(r() * 3), affixes.length) };
  }
  const affixes = rollAffixes(r, affixCount('champion', r, o), o);
  return { rank: 'champion', affixes, name: null, followers: 1 + Math.floor(r() * 3) };
}

/**
 * A pack's followers (S6, tuned on combat-sim's Aura Enchanted cell): a unique leader with more than two affixes
 * brings one fewer minion for each affix past two (an affix-heavy leader is the threat, not the crowd; never under
 * one). A champion pack keeps its copies.
 */
export function packFollowers(rank: EliteRank, base: number, affixes: number): number {
  return rank === 'unique' ? Math.max(1, base - Math.max(0, affixes - 2)) : base;
}

/** A pack built on purpose (the screenshot hook, the specs). */
export function makePack(rank: EliteRank, affixes: readonly EliteAffix[], name: string | null, followers: number): ElitePack {
  return { rank, affixes: [...affixes], name: rank === 'unique' ? name : null, followers };
}

/**
 * A pack member's life × this by its rank in the top-down fight (the side view keeps champions.ts RANK_HP, ×2.5 and
 * ×3.5). The combat sim (loot-and-combat.md §13, `node scripts/combat-sim.mjs`) found, at the Keeper's level, champion
 * packs falling in 10–30 s and unique packs in 15–30 s, under their 15–40 s and 30–75 s bands: a champion copy is ×3.25
 * here and a unique leader ×9.
 */
export const TD_RANK_HP: Readonly<Record<EliteRank, number>> = { champion: 3.25, unique: 9 };

export interface EliteStats { hp: number; dmg: [number, number]; speed: number; rate: number; hits: DamageType | undefined; take: number }

/**
 * The numbers of one pack member, from the creature's own. A champion copy and a leader take their rank's life and
 * blow (TD_RANK_HP, champions.ts RANK_DAMAGE) and every affix; a unique's minion keeps the creature's own numbers.
 */
export function eliteStats(base: { hp: number; dmg: readonly [number, number]; speed: number; rate: number; hits?: DamageType }, tag: Pick<EliteTag, 'rank' | 'role' | 'affixes'>): EliteStats {
  if (tag.role === 'minion') return { hp: base.hp, dmg: [base.dmg[0], base.dmg[1]], speed: base.speed, rate: base.rate, hits: base.hits, take: 1 };
  let damage = RANK_DAMAGE[tag.rank], speed = 1, rate = 1, take = 1, hits = base.hits;
  for (const a of tag.affixes) {
    const d = AFFIX_DEFS[a];
    damage *= d.damage ?? 1; speed *= d.speed ?? 1; rate *= d.rate ?? 1; take *= d.take ?? 1;
    if (d.hits) hits = d.hits;
  }
  const lo = Math.max(1, Math.round(base.dmg[0] * damage)), hi = Math.max(lo, Math.round(base.dmg[1] * damage));
  return { hp: Math.round(base.hp * TD_RANK_HP[tag.rank]), dmg: [lo, hi], speed: base.speed * speed, rate: base.rate / rate, hits, take };
}

/**
 * The rank a pack member drops as: its pack's for the leader and champion copies; a unique's minions are ordinary.
 * Eclipse-touched climbs one ladder step (a champion drops as a unique; a unique stays one — never a boss, whose rank
 * also changes how it fights).
 */
export function lootRank(tag: Pick<EliteTag, 'rank' | 'role'> & { affixes?: readonly EliteAffix[] } | undefined): MonsterRank {
  if (!tag || tag.role === 'minion') return 'normal';
  if (tag.affixes?.includes('eclipse-touched')) return 'unique';
  return tag.rank;
}

type Row = { kind: 'item'; rarity: string; unique?: boolean } | { kind: 'rune'; rarity: string };

/**
 * D2's floor on an elite's gear: an ordinary base that rolled common comes up magic (uncommon). A named unique keeps
 * its authored rarity (uniques-only-drop-at-authored-rarity), and runes keep their tier.
 */
export function floorEliteRows<T extends Row>(rows: readonly T[], rank: MonsterRank): T[] {
  if (rank !== 'champion' && rank !== 'unique') return [...rows];
  return rows.map(r => (r.kind === 'item' && !r.unique && r.rarity === 'common' ? { ...r, rarity: 'uncommon' } : r));
}

/** Does the kill already hold a magic-or-better piece of gear? */
export function hasMagicItem(rows: readonly Row[]): boolean {
  return rows.some(r => r.kind === 'item' && r.rarity !== 'common');
}

/**
 * A unique leader always drops at least one magic-or-better item: when its rolls held none, roll again (up to
 * `tries` more kills' worth from the host's own table, floored) and keep the first piece of gear that comes.
 */
export function guaranteeMagic<T extends Row>(rows: readonly T[], reroll: () => readonly T[], tries = 12): T[] {
  const out = [...rows];
  if (hasMagicItem(out)) return out;
  for (let i = 0; i < tries; i++) {
    const got = floorEliteRows(reroll(), 'unique').find(r => r.kind === 'item' && r.rarity !== 'common');
    if (got) { out.push(got); return out; }
  }
  return out;
}

/** A short line of a pack's affixes, for the name plate ("Extra Strong · Cold Aura"). */
export function affixLine(affixes: readonly EliteAffix[]): string {
  return affixes.map(a => AFFIX_DEFS[a].name).join(' · ');
}
