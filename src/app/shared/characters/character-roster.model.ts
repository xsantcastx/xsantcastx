/**
 * character-roster.model.ts — the account's list of characters (pure: no Angular, no services).
 *
 * Stored under `eclipse-characters` (account-wide, synced as `users/{uid}/progress/characters`). Each row carries a
 * small summary — name, vocation, level, last place and the painting fields of the look — so the character list can
 * show a Keeper this device has never played (its save is fetched from the cloud when it is entered).
 *
 * Deleting a character leaves a tombstone (`deletedAt`) so another device's stale copy cannot bring it back; a row's
 * newest stamp wins a merge, which is what makes a tombstone outrank an older summary and a newer summary outrank
 * an older one. See shared/save/character-scope.ts for where each character's save lives.
 */
import { coerceLook, type KeeperLook } from '../keeper-look/keeper-look.model';
import { MAX_CHARACTERS, PRIMARY_CHARACTER, isCharacterId } from '../save/character-scope';

/** The look fields that change the portrait (kept on the row so another device can paint it). */
export const PORTRAIT_FIELDS = ['body', 'skin', 'hair', 'hairColor', 'eyes', 'eyeColor', 'face', 'outfit', 'trim', 'vocation'] as const;
export type PortraitLook = Pick<KeeperLook, typeof PORTRAIT_FIELDS[number]>;

export interface CharacterRow {
  id: string;
  name: string;
  vocation: string;
  level: number;
  /** Where the Keeper last stood ("Ember Isle", "The Ashen Crypt"); '' before the first step. */
  area: string;
  look: PortraitLook | null;
  createdAt: number;
  /** Newest edit (summary refresh, rename, delete): the later row wins a merge. */
  updatedAt: number;
  /** Set when deleted: a tombstone that outranks every older copy of the row. */
  deletedAt?: number;
}

export interface CharacterRoster {
  v: 1;
  chars: Record<string, CharacterRow>;
}

export function emptyRoster(): CharacterRoster {
  return { v: 1, chars: {} };
}

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback);
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');

export function portraitOf(look: KeeperLook): PortraitLook {
  const out = {} as Record<string, unknown>;
  for (const f of PORTRAIT_FIELDS) out[f] = look[f];
  return out as PortraitLook;
}

function coerceRow(id: string, raw: unknown): CharacterRow | null {
  if (!isCharacterId(id) || !raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const row: CharacterRow = {
    id,
    name: str(r['name'], 40),
    vocation: str(r['vocation'], 24) || 'warlock',
    level: Math.max(1, Math.floor(num(r['level'], 1))),
    area: str(r['area'], 80),
    look: r['look'] && typeof r['look'] === 'object' ? portraitOf(coerceLook(r['look'])) : null,
    createdAt: num(r['createdAt']),
    updatedAt: num(r['updatedAt']),
  };
  const deletedAt = num(r['deletedAt']);
  if (deletedAt > 0) row.deletedAt = deletedAt;
  return row;
}

/** Any stored value → a valid roster (junk rows dropped). */
export function coerceRoster(raw: unknown): CharacterRoster {
  const out = emptyRoster();
  if (!raw || typeof raw !== 'object') return out;
  const chars = (raw as Record<string, unknown>)['chars'];
  if (!chars || typeof chars !== 'object' || Array.isArray(chars)) return out;
  for (const [id, value] of Object.entries(chars as Record<string, unknown>)) {
    const row = coerceRow(id, value);
    if (row) out.chars[id] = row;
  }
  return out;
}

/** A row's newest stamp: its last edit or its deletion. */
function stamp(row: CharacterRow): number {
  return Math.max(row.updatedAt, row.deletedAt ?? 0);
}

/**
 * Two devices' rosters into one: every id either side knows; per id the row with the newer stamp wins whole (a
 * tombstone written after the last summary therefore stays deleted). Never drops a character.
 */
export function mergeCharacterRoster(remote: unknown, local: unknown): unknown {
  if (remote == null) return local;
  if (local == null) return remote;
  const r = coerceRoster(remote), l = coerceRoster(local);
  const out = emptyRoster();
  for (const id of new Set([...Object.keys(r.chars), ...Object.keys(l.chars)])) {
    const a = r.chars[id], b = l.chars[id];
    out.chars[id] = !a ? b : !b ? a : stamp(a) > stamp(b) ? a : b;
  }
  return out;
}

/** The characters still playable, oldest first (Tibia lists them in a stable order). */
export function liveCharacters(roster: CharacterRoster): CharacterRow[] {
  return Object.values(roster.chars)
    .filter(row => !row.deletedAt)
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

/** Is there room for another character? */
export function hasFreeSlot(roster: CharacterRoster): boolean {
  return liveCharacters(roster).length < MAX_CHARACTERS;
}

/**
 * The id a new character gets: character #1's (the legacy, unprefixed save) when it has never been used on this
 * account — so a first Keeper keeps the root paths — otherwise `fresh`.
 */
export function idForNewCharacter(roster: CharacterRoster, primaryHasSave: boolean, fresh: string): string {
  return !roster.chars[PRIMARY_CHARACTER] && !primaryHasSave ? PRIMARY_CHARACTER : fresh;
}

/** Does `typed` confirm deleting `row`? Its name, case and outer spaces aside ("Delete" for an unnamed Keeper). */
export function confirmsDelete(row: Pick<CharacterRow, 'name'>, typed: string, fallback: string): boolean {
  const want = (row.name || fallback).trim().toLocaleLowerCase();
  return want.length > 0 && typed.trim().toLocaleLowerCase() === want;
}
