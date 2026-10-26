/**
 * td-corpse.ts — what a slain creature leaves behind (owner's backlog 2026-10-21: "corpses, Tibia-style").
 *
 * A fall leaves its corpse where it lay, and the corpse rots in stages: fresh → rotting → bones → gone, over about
 * three and a half minutes (a boss lies twice as long). The loot is the Keeper's own (personal in a party): the drops
 * land beside the corpse tagged with its id (Drop.corpse), and the corpse window lists exactly those. Walking over a
 * drop still picks it up, as before. At most CORPSE_CAP lie in a place; the oldest give way first.
 *
 * Pure: no canvas and no browser here (the painter is td-corpse-art.ts), so the decay timeline and the cap are specced.
 */

/** Live corpses in a place, at most (the oldest give way first). */
export const CORPSE_CAP = 40;
/** Where each stage ends, in seconds since the fall (a creature of the common sort). */
export const CORPSE_FRESH_SECS = 50;
export const CORPSE_ROT_SECS = 130;
export const CORPSE_BONES_SECS = 210;
/** A boss lies this many times longer. */
export const CORPSE_BOSS_STAY = 2;
/** The last seconds of the bones, when they sink into the ground. */
export const CORPSE_FADE_SECS = 8;

export type CorpseStage = 'fresh' | 'rotting' | 'bones' | 'gone';

/** What the corpse needs of its creature to be painted again: the painter's key and its cell. */
export interface CorpseKind { id: string; name: string; w: number; h: number; ghost?: boolean }

export interface Corpse {
  id: string;
  x: number; y: number;
  kind: CorpseKind;
  /** The creature's definition, for its painter (the corpse is derived from the creature's own sprite). */
  def: unknown;
  face: 1 | -1;
  /** The MobSystem clock when it fell. */
  born: number;
  boss: boolean;
  /** A stable number for the scatter of blood or ash. */
  seed: number;
  /** S6: burnt to ash (a fire blow felled it, or fire swept it): nothing can raise it. */
  ash?: boolean;
  /** S6: laid to rest (Redemption, a raised one's second fall): nothing can raise it. */
  rested?: boolean;
}

const k = (boss: boolean): number => (boss ? CORPSE_BOSS_STAY : 1);

/** How long it lies in all (seconds). */
export function corpseLife(boss: boolean): number { return CORPSE_BONES_SECS * k(boss); }

/** Its stage `age` seconds after the fall. */
export function corpseStage(age: number, boss: boolean): CorpseStage {
  const s = k(boss);
  if (age < CORPSE_FRESH_SECS * s) return 'fresh';
  if (age < CORPSE_ROT_SECS * s) return 'rotting';
  if (age < CORPSE_BONES_SECS * s) return 'bones';
  return 'gone';
}

/** Its opacity: whole until the last CORPSE_FADE_SECS of the bones, then sinking away. */
export function corpseAlpha(age: number, boss: boolean): number {
  const left = corpseLife(boss) - age;
  return left >= CORPSE_FADE_SECS ? 1 : Math.max(0, left / CORPSE_FADE_SECS);
}

/** Lay `c` down; past the cap the oldest corpses are taken (returned, so their loot link can be dropped). */
export function layCorpse(list: Corpse[], c: Corpse, cap = CORPSE_CAP): Corpse[] {
  list.push(c);
  return list.length > cap ? list.splice(0, list.length - cap) : [];
}

/** Take the corpses whose time is up out of `list` (returned). */
export function weatherCorpses(list: Corpse[], now: number): Corpse[] {
  const gone: Corpse[] = [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (corpseStage(now - list[i].born, list[i].boss) === 'gone') gone.push(...list.splice(i, 1));
  }
  return gone;
}

/** A stable scatter number from a text (the same blood on the same corpse in every frame). */
export function corpseSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Does the creature leave ash rather than blood? The undead, the ember-born, constructs and ghosts do: nothing in them
 * ever bled. (A name test on the creature's id, kept in one place so the painter and the window agree.)
 */
export function leavesAsh(id: string, ghost = false): boolean {
  if (ghost) return true;
  if (/orc|drake|wolf|hound|bat\b|stalker|hart|weaver|lurker|knight|witch|gnaw|wyrm|lasher|crawler|acolyte/.test(id)) return false;
  return /bone|uncounted|ghoul|wraith|ghost|shade|cinder|golem|imp\b|rivet|slag|glass|anvil|magma|seam|wisp|sporecap|warden|sentinel|colossus|abbess|dragon/.test(id);
}

/** The Keeper's reach to open a corpse (art px). */
export const CORPSE_REACH = 26;
