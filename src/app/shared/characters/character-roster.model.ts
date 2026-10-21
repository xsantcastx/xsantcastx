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
  /**
   * Set when a wipe of this character lowered `level` (character-summary.ts): the one case a merge may take the lower
   * level. Otherwise level merges as the higher of the two rows, because Hunting XP only grows.
   */
  levelResetAt?: number;
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
  const levelResetAt = num(r['levelResetAt']);
  if (levelResetAt > 0) row.levelResetAt = levelResetAt;
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
 * Two rows of one character: the newer wins (a rename, a new place, a tombstone), except `level`, which is the higher
 * of the two. Owner, 2026-10-21: a device whose copy was behind summarised level 1 with a newer stamp and that row
 * won on every device. Hunting XP only grows, so the lower level is only taken from a newer row that records a wipe
 * after the older row was written.
 */
export function mergeRow(a: CharacterRow, b: CharacterRow): CharacterRow {
  const [newer, older] = stamp(a) > stamp(b) ? [a, b] : [b, a];
  if (newer.deletedAt) return newer;
  const wiped = (newer.levelResetAt ?? 0) > stamp(older);
  const level = wiped ? newer.level : Math.max(newer.level, older.level);
  return level === newer.level ? newer : { ...newer, level };
}

/**
 * Two devices' rosters into one: every id either side knows; per id {@link mergeRow} (a tombstone written after the
 * last summary therefore stays deleted, and a level never goes down). Never drops a character.
 */
export function mergeCharacterRoster(remote: unknown, local: unknown): unknown {
  if (remote == null) return local;
  if (local == null) return remote;
  const r = coerceRoster(remote), l = coerceRoster(local);
  const out = emptyRoster();
  for (const id of new Set([...Object.keys(r.chars), ...Object.keys(l.chars)])) {
    const a = r.chars[id], b = l.chars[id];
    out.chars[id] = !a ? b : !b ? a : mergeRow(a, b);
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

/** Does deleting `row` ask for its name to be typed? Only a named Keeper's: a nameless one has nothing to type. */
export function needsTypedName(row: Pick<CharacterRow, 'name'>): boolean {
  return row.name.trim().length > 0;
}

/**
 * Does `typed` confirm deleting `row`? Its name, case and outer spaces aside. A nameless Keeper is confirmed by the
 * dialog's own button (owner, 2026-10-21: junk rows with an empty name could not be deleted at all).
 */
export function confirmsDelete(row: Pick<CharacterRow, 'name'>, typed: string): boolean {
  if (!needsTypedName(row)) return true;
  const want = row.name.trim().toLocaleLowerCase();
  return want.length > 0 && typed.trim().toLocaleLowerCase() === want;
}

/**
 * Junk rows (owner, 2026-10-21): the old "leaving New Keeper still creates a Keeper" bug (fixed in 143fbe72) wrote a
 * row the moment New Keeper was pressed — no name, a level-1 Warlock, nowhere — and the account roster kept four of
 * them. Their names are empty, so the typed-name delete could not reach them. Only rows created before this date are
 * candidates: a nameless Keeper made today with Become is real, whatever it looks like.
 */
export const JUNK_ROWS_BEFORE = Date.UTC(2026, 9, 23);

/**
 * Is `row` one of those junk rows, safe to drop? Every condition must hold: no name, level 1 or less, no place, not
 * character #1's slot, not the Keeper this page plays, created before {@link JUNK_ROWS_BEFORE}, and no meaningful save
 * for it on this device (`hasSave`: a made look, any skill or lifetime XP).
 */
export function isJunkRow(row: CharacterRow, ctx: { active: string; hasSave: (id: string) => boolean }): boolean {
  return !row.deletedAt
    && !row.name.trim()
    && row.level <= 1
    && !row.area.trim()
    && row.id !== PRIMARY_CHARACTER
    && row.id !== ctx.active
    && row.createdAt < JUNK_ROWS_BEFORE
    && !ctx.hasSave(row.id);
}

/**
 * The ids of {@link isJunkRow} rows to prune — none at all until the cloud has settled (`settled`: not syncing, and a
 * bound account's pull has landed), so a list still being merged is never judged.
 */
export function junkRowIds(roster: CharacterRoster, ctx: { settled: boolean; active: string; hasSave: (id: string) => boolean }): string[] {
  if (!ctx.settled) return [];
  return liveCharacters(roster).filter(row => isJunkRow(row, ctx)).map(row => row.id);
}
