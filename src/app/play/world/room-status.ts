/**
 * room-status.ts — a Keeper's statuses on the room's creatures (Hearth protocol 10, M4 of the room-run world;
 * docs/design/online.md §4d "M4").
 *
 * Until M4 a stun, a root or a hush a Keeper laid on a creature the room runs landed on that Keeper's picture of it
 * only (docs/handoff/skill-book.md "Not yet on room creatures"). Now each one travels as a claim beside the blows
 * (`/coop/hits` `st`), and the room decides:
 *
 *  - **legal**: the status must be one the named skill (and the named mark, when one is named) can lay, by the game's
 *    own data — the Skill Book's marks (td-marks MARKS: riders and the flags that lay a status) and the few skills that
 *    lay one unmarked (BASE_STATUS, each checked against td-mobs by room-status.spec). Never trusted text.
 *  - **bounded**: its seconds at most STATUS_CAP of its kind (a boss a fifth, as everywhere: ccSecs), a burn's or a
 *    bleed's damage a second inside the Keeper's own claim budget (the room ticks it, charged to that budget);
 *  - **immune**: a creature that has just shaken off a stun, root or fear cannot be held again for CC_IMMUNE seconds.
 *
 * Pure: no Angular, no DOM. The Hearth bundles it (scripts/world-sim-build.mjs); the client sends the claims.
 */
import { MARKS, MARK_SLOTS, type MarkFlag, type MarkSlot } from '../td/td-marks';
import { SKILLS, type SkillId } from '../td/td-skills';

/** What a Keeper may lay on a room creature. */
export const ROOM_STATUS_KINDS = ['stun', 'root', 'chill', 'fear', 'blind', 'hush', 'taunt', 'slow', 'pull', 'burn', 'bleed', 'strip'] as const;
export type RoomStatusKind = typeof ROOM_STATUS_KINDS[number];
const KIND_SET: ReadonlySet<string> = new Set(ROOM_STATUS_KINDS);
export const isRoomStatusKind = (v: unknown): v is RoomStatusKind => typeof v === 'string' && KIND_SET.has(v);

/**
 * One status claim on the wire: the creature (its room id), the kind, the skill it came from (and the mark), its
 * seconds in tenths, a burn's or a bleed's damage a second, a pull's reach in tenths of a tile, a slow's share in %.
 */
export interface CoopStatus { i: string; k: RoomStatusKind; s: string; m?: MarkSlot; t: number; d?: number; n?: number }
/** At most this many status claims in one `/coop/hits` body. */
export const COOP_MAX_STATUS = 16;

/** The longest the room lets each kind hold (seconds; a boss a fifth of it). */
export const STATUS_CAP: Readonly<Record<RoomStatusKind, number>> = {
  stun: 3, root: 4, chill: 4, fear: 3, blind: 4, hush: 3, taunt: 4, slow: 6, pull: 0, burn: 6, bleed: 6, strip: 10,
};
/** After a stun, root or fear ends, the creature shakes off another of the same for this long (seconds). */
export const CC_IMMUNE = 2;
/** A pull drags at most this many tiles; a slow at most this share. */
export const PULL_MAX_TILES = 3;
export const SLOW_MAX_PCT = 50;
/** A burn's or a bleed's damage a second, at most this share of the Keeper's claim budget a second (each creature). */
export const DOT_SHARE = 0.5;
/** Status claims a Keeper may make a second (a crowd stunned at once is one cast, several claims). */
export const STATUS_PER_SEC = 24;

/** The flags (td-marks MarkFlag) that lay a status, and which. */
export const FLAG_STATUS: Readonly<Partial<Record<MarkFlag, RoomStatusKind>>> = {
  struck: 'burn', slowZone: 'slow', captain: 'taunt', concuss: 'hush', stampStun: 'stun', pull: 'pull', fearsome: 'fear',
  strip: 'strip', unmakeHush: 'hush', vowTaunt: 'taunt', wolfBearHart: 'chill', bleedSpread: 'bleed', regrasp: 'root',
};
/**
 * The statuses a skill lays with no mark taken (td-mobs: Shield Bash's stun, the Watch Cry's taunt, the Lantern
 * Ward's break and the Blinding Flash's stun, the snare's and the trap's root, the Barbed Shot's bleed, the Hearth
 * Circle's slowing ground). room-status.spec reads td-mobs to keep this list honest.
 */
export const BASE_STATUS: Readonly<Partial<Record<SkillId, readonly RoomStatusKind[]>>> = {
  'shield-bash': ['stun'],
  'watch-cry': ['taunt'],
  'lantern-ward': ['stun'],
  'blinding-flash': ['stun'],
  'thornroot-snare': ['root'],
  'bramble-trap': ['root'],
  'barbed-shot': ['bleed'],
  'hearth-circle': ['slow'],
};

/** The statuses one mark lays: its riders' and its flags'. */
export function markStatuses(skill: string, slot: MarkSlot): RoomStatusKind[] {
  const def = MARKS[skill as SkillId]?.[MARK_SLOTS.indexOf(slot)];
  if (!def) return [];
  const out = new Set<RoomStatusKind>();
  for (const fx of def.fx) {
    if (fx.k === 'rider' && isRoomStatusKind(fx.st)) out.add(fx.st);
    if (fx.k === 'flag') {
      const k = FLAG_STATUS[fx.f];
      if (k) out.add(k);
    }
  }
  return [...out];
}

/** Is `kind` a status `skill` can lay — unmarked, or through the named mark? The room's legality check. */
export function statusLegal(skill: string, slot: MarkSlot | undefined | null, kind: RoomStatusKind): boolean {
  if (!(skill in SKILLS) || !isRoomStatusKind(kind)) return false;
  if (slot) return MARK_SLOTS.includes(slot) && markStatuses(skill, slot).includes(kind);
  return (BASE_STATUS[skill as SkillId] ?? []).includes(kind);
}

/** Every (skill, mark) that can lay `kind` (the client picks its source from these: the ones it owns). */
export function statusSources(kind: RoomStatusKind): { s: SkillId; m?: MarkSlot }[] {
  const out: { s: SkillId; m?: MarkSlot }[] = [];
  for (const [s, ks] of Object.entries(BASE_STATUS)) if ((ks ?? []).includes(kind)) out.push({ s: s as SkillId });
  for (const s of Object.keys(MARKS) as SkillId[]) for (const m of MARK_SLOTS) if (markStatuses(s, m).includes(kind)) out.push({ s, m });
  return out;
}

const ID = /^[a-z0-9]{1,10}$/;
/** A status claim checked field by field (null: refused as malformed). Unknown keys refused. */
export function parseCoopStatus(raw: unknown): CoopStatus | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!['i', 'k', 's', 'm', 't', 'd', 'n'].includes(k)) return null;
  if (typeof o['i'] !== 'string' || !ID.test(o['i'])) return null;
  if (!isRoomStatusKind(o['k'])) return null;
  if (typeof o['s'] !== 'string' || !/^[a-z0-9-]{1,32}$/.test(o['s'])) return null;
  if (o['m'] !== undefined && (typeof o['m'] !== 'string' || !MARK_SLOTS.includes(o['m'] as MarkSlot))) return null;
  const int = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
  if (!int(o['t'], 0, 600)) return null;
  if (o['d'] !== undefined && !int(o['d'], 0, 1e6)) return null;
  if (o['n'] !== undefined && !int(o['n'], 0, 1000)) return null;
  return {
    i: o['i'], k: o['k'], s: o['s'], ...(o['m'] ? { m: o['m'] as MarkSlot } : {}), t: o['t'] as number,
    ...(o['d'] !== undefined ? { d: o['d'] as number } : {}), ...(o['n'] !== undefined ? { n: o['n'] as number } : {}),
  };
}

/** The statuses a creature carries, as one number on the wire (CoopMobState.st): what every screen draws. */
export const ST_BIT: Readonly<Record<Exclude<RoomStatusKind, 'pull'>, number>> = {
  stun: 1, root: 2, chill: 4, fear: 8, blind: 16, hush: 32, taunt: 64, slow: 128, burn: 256, bleed: 512, strip: 1024,
};
export const ST_MAX = 2047;
