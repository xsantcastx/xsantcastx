/**
 * td-abilities.ts — what every creature family can DO besides bite (docs/design/monsters-abilities.md §1–§2; campaign
 * S6). The data a builder reads once: each creature's abilities, their words (Seam-Cant, canon §6.1), their tell, their
 * cooldown, their numbers in multiples of B (the creature's own blow at its zone level and tier, the roll its bite
 * uses), and the counter the Bestiary card names.
 *
 * The rules every ability obeys (§1):
 *  - anything over 25% of a Keeper's life at the creature's level has a GROUND tell of at least BOSS_TELL (0.6 s), never
 *    shorter on a phone; smaller ones a BODY tell (a 0.4 s glow and its words over its head);
 *  - every ability has a counter (move, interrupt, prepare); a Stun, Freeze or Hush during a cast's tell cancels it and
 *    starts its cooldown at half;
 *  - radii, cooldowns and counts never scale with level; Nightmare's cooldowns are ×0.85, Hell's ×0.7 (`tierCd`);
 *  - no CC roots a Keeper longer than 2 s, and a Freeze or a Stun leaves 4 s of immunity to the next (`KEEPER_CC_IMMUNE`).
 *
 * The runtime lives in td-mobs.ts (MobSystem: `castAbility`, `releaseAbility`, the hazards, the Keeper's statuses), the
 * pictures in td-ability-fx.ts, the words in td-abilities.i18n.ts. Pure: data and small functions.
 */
import type { DamageType } from '../../shared/loot/damage.model';

/** Tiles to art px (td-art TILE; kept local so this module stays importable anywhere). */
export const T = 16;

/** A Keeper status a creature's ability can lay (skills-100.md §0, the one table). */
export type KeeperStatus = 'stun' | 'root' | 'chill' | 'freeze' | 'blind' | 'wet' | 'weak' | 'dark' | 'burn' | 'bleed'
  /** Gloam Blizzard's pulse: a chill, or a Freeze on a Wet Keeper; a pull toward (or push from) the caster, in tiles. */
  | 'frost' | 'pull' | 'push';
/** A status as an ability lays it: seconds, and for a burn or a bleed its damage a second in B. */
export interface StatusLay { s: KeeperStatus; t: number; b?: number }

/** The tones a tell is drawn in (td-ability-fx TELL_TONES). */
export type TellTone = 'ember' | 'frost' | 'glass' | 'water' | 'bone' | 'life' | 'ink' | 'dust' | 'parchment' | 'gold' | 'moss' | 'shadow';

export type AbilityKind =
  /** A body-cast shot along a line (a rivet). */
  | 'spit'
  /** A ground line from the caster to where its prey stood; who stands on it when the tell ends is struck (a writ, a lash, a lantern beam). */
  | 'line'
  /** A ring round the caster after its wind-up (Glass Quake, War Stomp, Tide Smash). */
  | 'smash'
  /** Rings fall from above after their tell (a meteor, tempers, a blizzard's pulses). */
  | 'drop'
  /** A cone of an element that travels (a breath). */
  | 'wave'
  /** A fan of shots after lines on the ground (Volley of Three, Molten Fan). */
  | 'fan'
  /** Cracks open in a line toward the prey and burst one after another, then glow (Lava Up). */
  | 'cracks'
  /** A lasting area on the ground (a web, a spore cloud). */
  | 'field'
  /** It leaves its trail as it walks (crust, ink): passive. */
  | 'trail'
  /** It sinks and rises under its prey after a stir on the ground. */
  | 'burrow'
  /** It brings back fallen kin from their corpses. */
  | 'raise'
  /** It wards one kin with an absorb. */
  | 'ward'
  /** It heals kin over a few seconds. */
  | 'mend'
  /** Its kin near it run faster a while (a howl). */
  | 'howl'
  /** A ring of sound or light round it (Shriek): a status in reach. */
  | 'shriek'
  /** It blinks toward its prey; its next bite carries a status. */
  | 'blink'
  /** It runs from a Keeper who comes too close. */
  | 'flee'
  /** It needs no cast: a passive (Keep Walking, Scrape). */
  | 'passive';

/** How a Keeper answers it (the Bestiary's line). */
export type Counter = 'move' | 'interrupt' | 'prepare';

export interface AbilityDef {
  /** The i18n key's tail (`ab.name.<id>`, `ab.counter.<id>`). */
  id: string;
  kind: AbilityKind;
  /** The Seam-Cant over its head as the tell starts; none for a beast's. */
  words?: string;
  /** Seconds of tell (ground or body); 0 for a passive. */
  tell: number;
  /** Whether the tell is on the ground (≥ BOSS_TELL) or on its body (0.4 s). */
  ground: boolean;
  /** Seconds between casts (Normal). */
  cd: number;
  /** Starts only when its prey is within this many tiles (and in sight). */
  reach: number;
  /** Its ring's or area's radius (tiles), a line's half-width (tiles), a cone's length (tiles). */
  r?: number;
  /** Damage in B. */
  b?: number;
  el?: DamageType;
  tone: TellTone;
  /** Rings, pulses, shots or cracks. */
  n?: number;
  /** Seconds over which `n` pulses fall (a blizzard), or between cracks. */
  over?: number;
  /** A cone's half-angle or a fan's step (degrees). */
  spread?: number;
  /** What it lays on a Keeper it strikes. */
  st?: readonly StatusLay[];
  /** It pulls (+) or knocks back (−) the Keeper this many tiles. */
  pull?: number;
  /** The ground it leaves burning (fire ground): radius (tiles), seconds, damage a second in B, and a status inside. */
  after?: { r: number; t: number; b: number; st?: KeeperStatus };
  /** A raise: which creatures it brings back, how many at most, at what share of their life, from how far (tiles). */
  raise?: { keys: readonly string[]; most: number; pct: number; from: number };
  /** A ward: absorb in B, seconds, reach (tiles). A mend: share of life a second, seconds, reach. A howl: speed share, seconds, reach. */
  amt?: number;
  secs?: number;
  counter: Counter;
  /** Only in these places (a level id prefix) — the Drowned Acolyte calls the Watch in the Umbral crypts only. */
  only?: readonly string[];
  /** Needs another of its kind near (a wolf alone does not howl). */
  kin?: boolean;
}

const A = (o: AbilityDef): AbilityDef => o;
/** The shipped tell floor (td-mobs BOSS_TELL); kept here so the table reads alone. */
export const GROUND_TELL = .6;
export const BODY_TELL = .4;

/**
 * Every creature's abilities (§2.1–§2.9). A creature casts at most one at a time; the first ready one whose reach its
 * prey stands in goes.
 */
export const ABILITIES: Readonly<Record<string, readonly AbilityDef[]>> = {
  // ── 2.1 Maw ──
  'rivet-maw': [A({ id: 'scrap-spit', kind: 'spit', tell: BODY_TELL, ground: false, cd: 6, reach: 4, b: .6, el: 'physical', tone: 'dust', counter: 'move' })],
  'cinder-bailiff': [A({ id: 'serve-writ', kind: 'line', words: 'brann sha', tell: .6, ground: true, cd: 10, reach: 5, r: .6, b: .4, el: 'physical', tone: 'parchment', pull: 2, st: [{ s: 'chill', t: 2 }], counter: 'move' })],
  'obsidian-golem': [A({ id: 'glass-quake', kind: 'smash', tell: .8, ground: true, cd: 9, reach: 2.5, r: 2.5, b: 1.6, el: 'physical', tone: 'glass', st: [{ s: 'stun', t: .8 }], counter: 'move' })],
  'slag-crawler': [A({ id: 'crust', kind: 'trail', tell: 0, ground: false, cd: .45, reach: 99, r: .6, b: 0, tone: 'ember', after: { r: .6, t: 6, b: 0, st: 'chill' }, counter: 'move' })],
  // ── 2.2 Beast ──
  'ash-wolf': [A({ id: 'pack-howl', kind: 'howl', tell: .5, ground: false, cd: 15, reach: 6, amt: .2, secs: 4, r: 6, tone: 'dust', kin: true, counter: 'interrupt' })],
  'lava-hound': [A({ id: 'ember-breath', kind: 'wave', words: 'vael sha', tell: .6, ground: true, cd: 7, reach: 3, r: 3, spread: 25, n: 3, b: 1.2, el: 'fire', tone: 'ember', st: [{ s: 'burn', t: 4, b: .15 }], counter: 'move' })],
  'canopy-bat': [A({ id: 'shriek', kind: 'shriek', tell: BODY_TELL, ground: false, cd: 12, reach: 2, r: 2, tone: 'bone', st: [{ s: 'blind', t: 1.5 }], counter: 'move' })],
  'moss-stalker': [A({ id: 'moss-ambush', kind: 'burrow', tell: .8, ground: true, cd: 14, reach: 6, r: 1, b: 1.5, el: 'physical', tone: 'moss', st: [{ s: 'root', t: 1 }], counter: 'move' })],
  // Lowered Antlers is the shipped gap-closer (MobDef.charge), given to the hart: here only for the Bestiary's line.
  'rootglass-hart': [A({ id: 'lowered-antlers', kind: 'passive', tell: .6, ground: true, cd: 8, reach: 0, tone: 'glass', counter: 'move' })],
  // ── 2.3 Ember ──
  'cinder-imp': [A({ id: 'little-tempers', kind: 'drop', words: 'vael dra', tell: .6, ground: true, cd: 8, reach: 5, r: .75, n: 2, b: .8, el: 'fire', tone: 'ember', counter: 'move' })],
  'ember-drake': [A({ id: 'drake-meteor', kind: 'drop', words: 'vael ul dra', tell: 1, ground: true, cd: 14, reach: 7, r: 2, n: 1, b: 2.2, el: 'fire', tone: 'ember', after: { r: 1.5, t: 3, b: .2 }, counter: 'move' })],
  'glass-sentinel': [A({ id: 'molten-fan', kind: 'fan', words: 'vael mur', tell: .6, ground: true, cd: 9, reach: 7, r: 7, n: 3, spread: 16, b: .9, el: 'fire', tone: 'ember', counter: 'move' })],
  'lantern-wisp': [A({ id: 'will-o-fen', kind: 'blink', words: 'lum vesh', tell: .5, ground: false, cd: 10, reach: 7, r: 3, el: 'fire', tone: 'ember', st: [{ s: 'burn', t: 3, b: .2 }], counter: 'prepare' })],
  // ── 2.4 Shade ──
  'cinder-wraith': [A({ id: 'ash-blizzard', kind: 'drop', words: 'rim vor dra', tell: .8, ground: true, cd: 12, reach: 6, r: 2, n: 4, over: 2, b: .5, el: 'cold', tone: 'frost', st: [{ s: 'chill', t: 2 }], counter: 'move' })],
  'ink-hound': [A({ id: 'ink-trail', kind: 'trail', words: 'nyr mur', tell: 0, ground: false, cd: .45, reach: 99, r: .6, b: 0, tone: 'ink', after: { r: .6, t: 5, b: 0, st: 'chill' }, counter: 'prepare' })],
  'mire-lurker': [A({ id: 'low-lantern', kind: 'burrow', tell: 1, ground: true, cd: 16, reach: 6, r: 1, b: 1.8, el: 'physical', tone: 'water', pull: 1, counter: 'move' })],
  // ── 2.6 Bone ──
  'bone-walker': [A({ id: 'keep-walking', kind: 'passive', tell: 0, ground: false, cd: 0, reach: 0, tone: 'bone', counter: 'prepare' })],
  'bone-archer': [A({ id: 'volley-of-three', kind: 'fan', tell: .6, ground: true, cd: 9, reach: 6, r: 6, n: 3, spread: 20, b: .7, el: 'physical', tone: 'bone', counter: 'move' })],
  'ash-ghoul': [A({ id: 'scrape', kind: 'passive', tell: 0, ground: false, cd: 0, reach: 0, tone: 'dust', st: [{ s: 'bleed', t: 3, b: .15 }], counter: 'prepare' })],
  'bone-priest': [
    A({ id: 'muster-dead', kind: 'raise', words: 'osk teth', tell: 1, ground: true, cd: 8, reach: 9, tone: 'bone', raise: { keys: ['bone-walker', 'bone-archer', 'ash-ghoul', 'bone-priest'], most: 2, pct: .6, from: 6 }, counter: 'interrupt' }),
    A({ id: 'bone-ward', kind: 'ward', words: 'osk ka', tell: BODY_TELL, ground: false, cd: 10, reach: 9, amt: 3, secs: 6, r: 5, tone: 'bone', counter: 'prepare' }),
  ],
  // ── 2.7 Orc ──
  'cinder-orc': [A({ id: 'war-stomp', kind: 'smash', tell: .6, ground: true, cd: 10, reach: 1.5, r: 1.5, b: 1.2, el: 'physical', tone: 'dust', st: [{ s: 'stun', t: .6 }], counter: 'move' })],
  'orc-firecaller': [A({ id: 'lava-up', kind: 'cracks', words: 'vael dra', tell: .8, ground: true, cd: 9, reach: 6, r: 1, n: 3, over: .2, b: 1, el: 'fire', tone: 'ember', after: { r: 1, t: 2, b: .2 }, counter: 'move' })],
  'ashsinger': [
    A({ id: 'sing-them-up', kind: 'raise', words: 'vael osk teth', tell: 1, ground: true, cd: 7, reach: 10, tone: 'ember', raise: { keys: ['cinder-orc', 'orc-firecaller'], most: 3, pct: .5, from: 6 }, counter: 'interrupt' }),
    A({ id: 'flee-to-song', kind: 'flee', tell: 0, ground: false, cd: 8, reach: 2, r: 6, tone: 'ember', counter: 'prepare' }),
  ],
  'orc-warlord': [A({ id: 'warlord-meteor', kind: 'drop', words: 'vael ul dra', tell: 1.2, ground: true, cd: 16, reach: 7, r: 2.5, n: 1, b: 2.5, el: 'fire', tone: 'ember', counter: 'move' })],
  // ── 2.8 Verdant ──
  'vine-lasher': [A({ id: 'lash-and-root', kind: 'line', words: 'thar mur', tell: .6, ground: true, cd: 9, reach: 4, r: .6, b: 1.2, el: 'physical', tone: 'life', st: [{ s: 'root', t: 1 }], counter: 'move' })],
  'thorn-weaver': [A({ id: 'thorn-web', kind: 'field', words: 'thar orum', tell: .8, ground: true, cd: 14, reach: 6, r: 2, tone: 'moss', after: { r: 2, t: 6, b: 0, st: 'chill' }, counter: 'prepare' })],
  'rootgnaw': [A({ id: 'tunnel', kind: 'burrow', tell: .8, ground: true, cd: 12, reach: 6, r: 1, b: 1.4, el: 'physical', tone: 'dust', st: [{ s: 'stun', t: .5 }], counter: 'move' })],
  'sporecap': [A({ id: 'spore-cloud', kind: 'field', tell: .6, ground: false, cd: 11, reach: 5, r: 2, tone: 'life', after: { r: 2, t: 6, b: 0, st: 'weak' }, counter: 'prepare' })],
  'drowned-acolyte': [
    A({ id: 'moss-mending', kind: 'mend', words: 'thar hesk ka', tell: .6, ground: true, cd: 12, reach: 9, amt: .06, secs: 3, r: 4, tone: 'life', counter: 'interrupt' }),
    A({ id: 'call-the-watch', kind: 'raise', words: 'osk brann teth', tell: 1, ground: true, cd: 10, reach: 10, tone: 'water', raise: { keys: ['drowned-knight'], most: 1, pct: .5, from: 6 }, counter: 'interrupt', only: ['drowned-crypts'] }),
  ],
  // ── 2.9 Umbral ──
  'drowned-knight': [A({ id: 'tide-smash', kind: 'smash', words: 'brann dra', tell: .8, ground: true, cd: 10, reach: 2, r: 2, b: 2, el: 'physical', tone: 'water', st: [{ s: 'wet', t: 5 }], pull: -1, counter: 'move' })],
  'gloam-witch': [
    A({ id: 'gloam-blizzard', kind: 'drop', words: 'rim vor dra', tell: 1, ground: true, cd: 14, reach: 7, r: 3, n: 6, over: 3, b: .6, el: 'cold', tone: 'ink', st: [{ s: 'chill', t: 2 }], counter: 'move' }),
    A({ id: 'true-light', kind: 'line', words: 'lum nyr vesh', tell: .6, ground: true, cd: 18, reach: 7, r: .5, b: 0, tone: 'ink', st: [{ s: 'dark', t: 4 }], counter: 'move' }),
  ],
};

/** A creature's abilities (none for one the table does not name). */
export function abilitiesOf(id: string): readonly AbilityDef[] { return ABILITIES[id] ?? []; }
/** The ones it casts (a passive is never cast). */
export function castable(id: string): readonly AbilityDef[] { return abilitiesOf(id).filter(a => a.kind !== 'passive'); }

/** The tier's cadence (§1.4): cooldowns ×0.85 on Nightmare, ×0.7 in Hell; tells never shorten. */
export function tierCd(cd: number, tier: string): number { return cd * (tier === 'hell' ? .7 : tier === 'nightmare' ? .85 : 1); }

/** The CC rules (§1.8): no root longer than this, and immunity after a Freeze or a Stun. */
export const KEEPER_ROOT_MAX = 2;
export const KEEPER_CC_IMMUNE = 4;

/** Bone Walker's Keep Walking (§2.6): the share that rise once more, after how long, at what life. */
export const KEEP_WALKING = { chance: .25, after: 2, pct: .3 } as const;
/** Ash Ghoul's Scrape: a bleed doubles while the Keeper moves (the engine tells the system he moves). */
export const BLEED_MOVING = 2;
/** The Gloam Witch's True Light: the Keeper's light this many tiles shorter while it holds. */
export const TRUE_LIGHT_CUT = 2;
/** A Spore Cloud's Weaken: the Keeper's blows this much weaker inside. */
export const SPORE_WEAKEN = .15;

/**
 * A status on the wire (a room's bite, protocol 9): "stun:8,burn:40/12" — tenths of a second, and for a burn or a
 * bleed the whole damage a second. Pure and bounded so the room can validate it.
 */
export function encodeStatus(list: readonly { s: KeeperStatus; t: number; dps?: number }[]): string {
  return list.map(x => `${x.s}:${Math.max(1, Math.min(200, Math.round(x.t * 10)))}${x.dps ? `/${Math.max(1, Math.min(9999, Math.round(x.dps)))}` : ''}`).join(',');
}
const STATUS_SET = new Set<KeeperStatus>(['stun', 'root', 'chill', 'freeze', 'blind', 'wet', 'weak', 'dark', 'burn', 'bleed', 'frost', 'pull', 'push']);
export const STATUS_WIRE = /^(?:[a-z]{3,6}:\d{1,3}(?:\/\d{1,4})?)(?:,[a-z]{3,6}:\d{1,3}(?:\/\d{1,4})?){0,3}$/;
export function decodeStatus(raw: string | undefined): { s: KeeperStatus; t: number; dps: number }[] {
  if (!raw || !STATUS_WIRE.test(raw)) return [];
  const out: { s: KeeperStatus; t: number; dps: number }[] = [];
  for (const part of raw.split(',')) {
    const m = /^([a-z]+):(\d+)(?:\/(\d+))?$/.exec(part);
    if (!m || !STATUS_SET.has(m[1] as KeeperStatus)) continue;
    out.push({ s: m[1] as KeeperStatus, t: Number(m[2]) / 10, dps: Number(m[3] ?? 0) });
  }
  return out;
}

/** Wire flags (CoopMobState.fl, above the shipped three): the tell running is its ability 0 or 1; it is underground; it is warded. */
export const FL_AB0 = 8, FL_AB1 = 16, FL_HIDDEN = 32, FL_WARDED = 64, FL_AURA_OFF = 128;
