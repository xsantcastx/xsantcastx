/**
 * character-scope.ts — which saved state belongs to one character, and where it lives.
 *
 * Owner, 2026-10-21: "we also need a login and select character screen" (Tibia: log in, see your characters, pick
 * one or make a new one). The save used to be one Keeper; now an account holds up to {@link MAX_CHARACTERS}.
 *
 * THE SMALLEST CORRECT CHANGE. Every service keeps reading and writing its logical key ("godforge-inventory") through
 * `GameStateGateway`; the gateway maps that key onto the active character's storage once, at boot:
 *
 *   - Character #1 ({@link PRIMARY_CHARACTER}) keeps the old, unprefixed keys and the old Firestore paths
 *     (`users/{uid}/progress/*`, `users/{uid}/economy/*`). An existing single save therefore IS character #1 with no
 *     data moved at all — the migration is the roster entry the roster service writes for it.
 *   - Any other character stores `<key>@<id>` locally and `users/{uid}/characters/{id}/{collection}/{doc}` in the
 *     cloud (a rule for that path ships in firestore.rules).
 *   - {@link ACCOUNT_WIDE_KEYS} are the same for every character (see the list for why each one).
 *
 * The active character is chosen at page boot and never changes inside a page: picking another one reloads. That is
 * what keeps the two known traps shut — a `pagehide` flush always writes a service's in-memory copy into the
 * namespace it was read from (pagehide-flush-clobbers-fresh-writes), and no live service is ever asked to re-read
 * a whole other character mid-flight.
 */

/** Device-local: which character this browser boots into. Never synced (each device picks its own). */
export const ACTIVE_CHARACTER_KEY = 'eclipse-active-character';
/** The account's character list (synced, account-wide): see characters/character-roster.model.ts. */
export const CHARACTER_ROSTER_KEY = 'eclipse-characters';
/** Character #1: the save that existed before characters did. Unprefixed keys, root Firestore paths. */
export const PRIMARY_CHARACTER = 'c1';
/** Slot cap (Tibia gives a handful per world; five keeps the list one screen on a phone). */
export const MAX_CHARACTERS = 5;
/** The Firestore subcollection holding characters #2…#5. */
export const CHARACTERS_COLLECTION = 'characters';

/**
 * Saved state every character shares — a deliberate, short list:
 *  - `godforge-sound`: a device/player preference, like the language (which is not a save key at all).
 *  - `easter-eggs-found` / `easter-eggs-dates`: the site's secrets are the *player's* discoveries, not a Keeper's.
 *  - the roster itself.
 * Everything else (look, levels and XP, skill tree, bag, worn gear, the bank, Gold, position, quests, tasks, pets,
 * Glim, the world) is per character: Tibia keeps depot and gold per character too, so there is no shared stash yet.
 */
export const ACCOUNT_WIDE_KEYS: ReadonlySet<string> = new Set([
  'godforge-sound',
  'easter-eggs-found',
  'easter-eggs-dates',
  CHARACTER_ROSTER_KEY,
]);

/**
 * Device-local keys (never synced) that still belong to one character: where the Keeper stands, the far regions of
 * their world, and the gateway's own per-save bookkeeping (pending deletes, the wipe stamp, the realm era, the
 * sign-in backup).
 */
export const LOCAL_CHARACTER_KEYS: ReadonlySet<string> = new Set([
  'eclipse-play-world-v1',
  'eclipse-seamworks-world-v1',
  'godforge-delve-far',
  'godforge-world-far',
  'godforge-pending-deletes',
  'godforge-reset-at',
  'godforge-realm-era',
  'godforge-save-backup',
  // Set by the gateway when this character holds writes the cloud may not have seen (written signed out, behind
  // another device's lease, or not yet flushed when the page left). Any signed-in page pushes such a character.
  'godforge-cloud-pending',
  // Read and written by their own services through activeCharacterKey (not the gateway), listed so deleting a
  // character takes them too: the "while you were away" stamp, the worn title, the tracked map pin.
  'godforge-away',
  'godforge-worn-title',
  'eclipse-delve-track',
]);

/** Device-local, per character: "this character may hold writes the cloud has not seen" (see the gateway). */
export const CLOUD_PENDING_KEY = 'godforge-cloud-pending';

/** A character id: short, lowercase, safe in a localStorage key and a Firestore path segment. */
export function isCharacterId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9]{2,16}$/.test(id);
}

/** Is `key` stored once per character? (`stateKeys` = every key the gateway syncs.) */
export function isCharacterScoped(key: string, stateKeys: ReadonlySet<string>): boolean {
  if (ACCOUNT_WIDE_KEYS.has(key)) return false;
  return stateKeys.has(key) || LOCAL_CHARACTER_KEYS.has(key);
}

/** The localStorage key holding `key` for character `id` (character #1 keeps the old key). */
export function characterStorageKey(key: string, id: string): string {
  return id === PRIMARY_CHARACTER ? key : `${key}@${id}`;
}

/** An IndexedDB name for character `id` (the world's far regions): character #1 keeps the old name. */
export function characterDbName(name: string, id: string): string {
  return id === PRIMARY_CHARACTER ? name : `${name}@${id}`;
}

/** The Firestore path segments of a per-character document, after `users/{uid}`. */
export function characterDocPath(id: string, collection: string, doc: string): string[] {
  return id === PRIMARY_CHARACTER ? [collection, doc] : [CHARACTERS_COLLECTION, id, collection, doc];
}

/** The character this browser boots into: the stored choice, else character #1. */
export function readActiveCharacter(storage: Pick<Storage, 'getItem'> | null): string {
  try {
    const id = storage?.getItem(ACTIVE_CHARACTER_KEY);
    return isCharacterId(id) ? id : PRIMARY_CHARACTER;
  } catch {
    return PRIMARY_CHARACTER;
  }
}

/**
 * The localStorage key for a per-character DEVICE value that lives outside the gateway (a service that reads
 * localStorage itself: the "while you were away" stamp, the worn title, the tracked map pin). Read at page boot like
 * the gateway's own namespace, so it never changes inside a page. Character #1 keeps the old key.
 */
export function activeCharacterKey(key: string, storage: Pick<Storage, 'getItem'> | null): string {
  return characterStorageKey(key, readActiveCharacter(storage));
}

/** A fresh id for a new character (never `c1`, which is reserved for the save that predates characters). */
export function newCharacterId(rand: () => number = Math.random, taken: ReadonlySet<string> = new Set()): string {
  for (let i = 0; i < 50; i++) {
    let id = 'k';
    for (let n = 0; n < 7; n++) id += 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(rand() * 32) % 32];
    if (!taken.has(id)) return id;
  }
  return `k${Date.now().toString(36)}`;
}
