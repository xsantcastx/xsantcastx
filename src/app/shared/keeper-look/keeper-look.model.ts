/**
 * keeper-look.model.ts — what a Keeper looks like, chosen at the Glass of Becoming.
 *
 * Owner, 2026-10-14: "everybody is playing the same character and can't be
 * modified". This is the choice: body, skin, hair (style + colour), eyes, a face
 * mark, the two outfit colours and a name. The painter (keeper-paint.ts) turns it
 * into the pixel Keeper drawn in the world, on the paper doll and in the creator.
 *
 * Saved through the gateway as `godforge-keeper-look` (synced: progress/keeper-look).
 * A look is one choice, not a ledger: the later edit wins WHOLE (two devices never
 * half-merge into a face nobody chose). `made` and `prompted` only grow.
 *
 * Every field is an index or id from the tables below, so a save can never paint a
 * colour the game does not own; unknown values fall back to the default.
 *
 * No imports: cloud-save.model.ts is eager and imports this merge.
 */
export const KEEPER_LOOK_KEY = 'godforge-keeper-look';

export const BODY_TYPES = ['slight', 'sturdy', 'broad'] as const;
export type BodyType = typeof BODY_TYPES[number];

export const HAIR_STYLES = ['cropped', 'swept', 'long', 'braid', 'topknot', 'curls', 'mohawk', 'shaved'] as const;
export type HairStyle = typeof HAIR_STYLES[number];

export const EYE_STYLES = ['round', 'narrow', 'bright'] as const;
export type EyeStyle = typeof EYE_STYLES[number];

export const FACE_MARKS = ['none', 'freckles', 'scar', 'beard', 'warpaint', 'rosy'] as const;
export type FaceMark = typeof FACE_MARKS[number];

/** Skin: eight human tones, then the two the realms leave on long-time Keepers (Umbral lilac, Verdant sap). */
export const SKIN_TONES: readonly string[] = [
  '#ffe0c7', '#f6c9a4', '#e8b08a', '#cf9468', '#b07a4f', '#8d5a3a', '#6b4129', '#4a2b1c', '#b9a8d8', '#a8c8a4',
];
export const HAIR_COLORS: readonly string[] = [
  '#1d1a1f', '#3b2619', '#6b4226', '#8f3b1f', '#c4612b', '#e0c070', '#eae4d4', '#9aa0ad', '#d23a3a', '#7b4fd0', '#3fbfb0',
];
export const EYE_COLORS: readonly string[] = ['#3b2a1e', '#2f6fb0', '#3f8f4a', '#8a5a2b', '#7b4fd0', '#d0a020'];
/** Outfit cloth: the tunic (primary) and the trousers + trim (secondary). */
export const OUTFIT_COLORS: readonly string[] = [
  '#3a5f8f', '#8f3a3a', '#3f7a4a', '#6a4a8f', '#a0743a', '#2f6f6f', '#5a5a66', '#c8b48a', '#2a2a36', '#b05a8a', '#d08a3a', '#e8e0d0',
];

export const NAME_MAX = 18;

/**
 * The Keeper's calling (owner, 2026-10-20: "we need to create our 1st class, let it be a warlock … get this correct
 * first with one class"). One today; the list grows class by class. Chosen when the Keeper is made.
 */
export const VOCATIONS = ['warlock'] as const;
/** The four attributes a level's points go into (owner 2026-10-20: "rework our stats … think of tibia or diablo 2"). */
export const ATTRIBUTES = ['vit', 'ene', 'spi', 'agi'] as const;
export type Attribute = typeof ATTRIBUTES[number];
export type KeeperStats = Record<Attribute, number>;
/** Points a level gives (D2: five a level). */
export const POINTS_PER_LEVEL = 5;
export type Vocation = typeof VOCATIONS[number];

/**
 * The Spellbook's trees (D2's skill pages, owner 2026-10-21): points spent per skill, the ranks given free (a save
 * from before the trees keeps what sat on its bar), and when the tree last changed. Rules and clamping live with the
 * skills (play/td/td-tree); here only the shape. Merged on its own clock: the newer tree wins WHOLE, so two devices
 * never add up to points nobody earned.
 */
export interface KeeperSkillTree {
  spent: Record<string, number>;
  free: string[];
  at: number;
}
/** The most ranks a skill takes (td-skills MAX_RANK; no imports here). */
const TREE_MAX_RANK = 20;
const SKILL_ID = /^[a-z-]{1,24}$/;

export interface KeeperLook {
  version: 1;
  /** The Keeper chose (or kept) this look at the Glass. */
  made: boolean;
  /** The one gentle "make your Keeper" nudge was shown (existing saves). */
  prompted: boolean;
  body: BodyType;
  skin: number;
  hair: HairStyle;
  hairColor: number;
  eyes: EyeStyle;
  eyeColor: number;
  face: FaceMark;
  outfit: number;
  trim: number;
  name: string;
  /** The class: what the Keeper fights with and which abilities they have. */
  vocation: Vocation;
  /** The skills on keys 1–4 and the running aura, as chosen in the Spellbook (ids; empty = the class default). */
  bar: string[];
  aura: string;
  /** Points spent on the attributes (D2's character sheet): Vitality, Energy, Spirit, Agility. */
  stats: KeeperStats;
  /** The skill trees: ranks bought with the level's skill points. */
  tree: KeeperSkillTree;
  /** ms since epoch of the last edit; the later edit wins a merge. */
  updatedAt: number;
}

export function defaultLook(): KeeperLook {
  return {
    version: 1, made: false, prompted: false,
    body: 'sturdy', skin: 2, hair: 'swept', hairColor: 2, eyes: 'round', eyeColor: 0, face: 'none',
    outfit: 0, trim: 4, name: '', vocation: 'warlock', bar: [], aura: '', stats: { vit: 0, ene: 0, spi: 0, agi: 0 }, tree: { spent: {}, free: [], at: 0 }, updatedAt: 0,
  };
}

/** Letters (any script), digits, space, apostrophe, hyphen, dot; collapsed spaces; capped. */
export function cleanName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.normalize('NFC').replace(/[^\p{L}\p{N} '.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
}

function pick<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (list as readonly string[]).includes(value) ? value as T : fallback;
}
function index(list: readonly unknown[], value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < list.length ? value : fallback;
}

/** One attribute's ceiling: above every point a level-10,000 Keeper can earn (~2.5k), so no spent point is ever lost. */
const MAX_STAT = 99_999;
function coerceStats(raw: unknown): KeeperStats {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const n = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_STAT ? v : 0;
  return { vit: n(r['vit']), ene: n(r['ene']), spi: n(r['spi']), agi: n(r['agi']) };
}
/**
 * Any stored tree → a valid one. A save from before the trees (no `tree`) is migrated: whatever sat on its bar and
 * its aura is given rank 1 free, so an old bar keeps working.
 */
export function coerceTree(raw: unknown, bar: readonly string[], aura: string): KeeperSkillTree {
  if (!raw || typeof raw !== 'object') {
    const free = [...new Set([...bar, aura].filter(id => !!id && id !== 'none' && SKILL_ID.test(id)))];
    return { spent: {}, free, at: 0 };
  }
  const r = raw as Record<string, unknown>;
  const spent: Record<string, number> = {};
  const rs = (r['spent'] && typeof r['spent'] === 'object' ? r['spent'] : {}) as Record<string, unknown>;
  for (const [id, n] of Object.entries(rs)) {
    if (SKILL_ID.test(id) && typeof n === 'number' && Number.isInteger(n) && n > 0) spent[id] = Math.min(TREE_MAX_RANK, n);
  }
  const free = Array.isArray(r['free']) ? [...new Set((r['free'] as unknown[]).filter((x): x is string => typeof x === 'string' && SKILL_ID.test(x)))].slice(0, 40) : [];
  const at = typeof r['at'] === 'number' && Number.isFinite(r['at']) && r['at'] > 0 ? r['at'] : 0;
  return { spent, free, at };
}

/**
 * Points still to spend at a level. `earned` is every point the Keeper has (shared/skills/keeper-milestones
 * keeperAttributePoints: 5 a level to 100, tapering past it, plus the milestones' batches); without it, the plain
 * five a level. Passed in so this eager file stays import-free.
 */
export function pointsLeft(level: number, stats: KeeperStats, earned = (Math.max(1, Math.floor(level)) - 1) * POINTS_PER_LEVEL): number {
  return Math.max(0, earned - (stats.vit + stats.ene + stats.spi + stats.agi));
}

/** Any stored value → a valid look (junk and unknown ids fall back to the default). */
export function coerceLook(raw: unknown): KeeperLook {
  const d = defaultLook();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const bar = Array.isArray(r['bar']) ? (r['bar'] as unknown[]).filter((x): x is string => typeof x === 'string' && SKILL_ID.test(x)).slice(0, 4) : [];
  const aura = typeof r['aura'] === 'string' && /^[a-z-]{0,24}$/.test(r['aura']) ? r['aura'] : '';
  return {
    version: 1,
    made: r['made'] === true,
    prompted: r['prompted'] === true,
    body: pick(BODY_TYPES, r['body'], d.body),
    skin: index(SKIN_TONES, r['skin'], d.skin),
    hair: pick(HAIR_STYLES, r['hair'], d.hair),
    hairColor: index(HAIR_COLORS, r['hairColor'], d.hairColor),
    eyes: pick(EYE_STYLES, r['eyes'], d.eyes),
    eyeColor: index(EYE_COLORS, r['eyeColor'], d.eyeColor),
    face: pick(FACE_MARKS, r['face'], d.face),
    outfit: index(OUTFIT_COLORS, r['outfit'], d.outfit),
    trim: index(OUTFIT_COLORS, r['trim'], d.trim),
    name: cleanName(r['name']),
    vocation: pick(VOCATIONS, r['vocation'], d.vocation),
    bar,
    stats: coerceStats(r['stats']),
    aura,
    tree: coerceTree(r['tree'], bar, aura),
    updatedAt: typeof r['updatedAt'] === 'number' && Number.isFinite(r['updatedAt']) && r['updatedAt'] > 0 ? r['updatedAt'] : 0,
  };
}

/**
 * Two devices: the later edit wins whole; "made" and "prompted" are kept if either side has them. The skill tree runs
 * on its own clock: the newer tree wins whole (never a sum), and the fight clamps it to the level's points.
 */
export function mergeKeeperLook(remote: unknown, local: unknown): unknown {
  if (remote == null) return local;
  if (local == null) return remote;
  const r = coerceLook(remote), l = coerceLook(local);
  const winner = r.updatedAt > l.updatedAt ? r : l;
  const tree = r.tree.at > l.tree.at ? r.tree : l.tree;
  return { ...winner, tree, made: r.made || l.made, prompted: r.prompted || l.prompted } satisfies KeeperLook;
}

/** The parts that change the painting (not the name or the flags), as a short stable key. */
export function lookKey(look: KeeperLook): string {
  return [look.body, look.skin, look.hair, look.hairColor, look.eyes, look.eyeColor, look.face, look.outfit, look.trim].join('.');
}

/** A small deterministic generator (mulberry32). */
export function lookRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random look (the creator's "Surprise me"). Name and flags come from `base`. */
export function randomLook(rand: () => number, base: KeeperLook = defaultLook()): KeeperLook {
  const of = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length) % list.length];
  const at = (list: readonly unknown[]): number => Math.floor(rand() * list.length) % list.length;
  const outfit = at(OUTFIT_COLORS);
  let trim = at(OUTFIT_COLORS);
  if (trim === outfit) trim = (trim + 3) % OUTFIT_COLORS.length;
  return {
    ...base,
    body: of(BODY_TYPES), skin: at(SKIN_TONES), hair: of(HAIR_STYLES), hairColor: at(HAIR_COLORS),
    eyes: of(EYE_STYLES), eyeColor: at(EYE_COLORS), face: of(FACE_MARKS), outfit, trim,
  };
}

/** A stable look for another Keeper seen in the world (by their id), so nobody looks the same. */
export function lookFromSeed(id: string): KeeperLook {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return randomLook(lookRng(hash), { ...defaultLook(), made: true });
}

/** One field of the creator stepped by ±1 (wrapping). */
export type LookField = 'body' | 'skin' | 'hair' | 'hairColor' | 'eyes' | 'eyeColor' | 'face' | 'outfit' | 'trim';
export const LOOK_FIELDS: readonly LookField[] = ['body', 'skin', 'hair', 'hairColor', 'eyes', 'eyeColor', 'face', 'outfit', 'trim'];

export function fieldOptions(field: LookField): readonly (string | number)[] {
  switch (field) {
    case 'body': return BODY_TYPES;
    case 'hair': return HAIR_STYLES;
    case 'eyes': return EYE_STYLES;
    case 'face': return FACE_MARKS;
    case 'skin': return SKIN_TONES.map((_, i) => i);
    case 'hairColor': return HAIR_COLORS.map((_, i) => i);
    case 'eyeColor': return EYE_COLORS.map((_, i) => i);
    case 'outfit': case 'trim': return OUTFIT_COLORS.map((_, i) => i);
  }
}

export function stepLook(look: KeeperLook, field: LookField, by: number): KeeperLook {
  const options = fieldOptions(field);
  const at = Math.max(0, options.indexOf(look[field] as never));
  const next = options[((at + by) % options.length + options.length) % options.length];
  return { ...look, [field]: next } as KeeperLook;
}

/** The swatch colour a colour field shows (null for the non-colour fields). */
export function fieldSwatch(field: LookField, value: string | number): string | null {
  if (typeof value !== 'number') return null;
  switch (field) {
    case 'skin': return SKIN_TONES[value] ?? null;
    case 'hairColor': return HAIR_COLORS[value] ?? null;
    case 'eyeColor': return EYE_COLORS[value] ?? null;
    case 'outfit': case 'trim': return OUTFIT_COLORS[value] ?? null;
    default: return null;
  }
}
