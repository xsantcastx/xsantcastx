/**
 * gm-sync.ts — the two GM-related Firestore calls a *player's* browser makes.
 *
 * Both are called once, from the end of `CloudSaveService.bind()`, and both are
 * in their own module rather than inline in that service for one reason: the
 * module is the unit of chunking. `gm.model.ts` carries the shapes the /admin
 * console needs, and an eager `import` of even one of its exports pulls the
 * whole file into the initial bundle for every visitor — esbuild cannot drop
 * the exports a lazy chunk still uses. Reached through a dynamic `import()`
 * here, it stays in the chunks that actually want it.
 *
 * The cost of that indirection is nothing: `bind()` has already awaited the
 * lazy Firestore SDK by the time it calls either of these, so the chunk lands
 * inside a wait that was happening regardless.
 */
import { FirestoreHandle } from '../lazy-firestore.service';
import {
  BAN_COLLECTION, BAN_DOC, BanRecord, DIRECTORY_COLLECTION,
  buildDirectoryEntry, coerceBan,
} from './gm.model';

/** The slice of a Firebase user the directory row needs. */
export interface DirectoryIdentity {
  uid: string;
  email: string | null;
  displayName: string | null;
}

/**
 * Write this account's row in the player directory.
 *
 * Must be called *after* the gateway has reconciled the save, not before: the
 * whole value of the row is that its numbers are the account's, and before the
 * merge they are only whatever this device happened to be holding — which on a
 * phone that has not been opened in a week is not the account's Gold.
 *
 * `progress` and `ledger` are passed in rather than read here so this module
 * never touches localStorage; the caller already has both in hand.
 */
export async function publishDirectoryRow(
  fs: FirestoreHandle,
  identity: DirectoryIdentity,
  progress: unknown,
  ledger: unknown,
): Promise<void> {
  const entry = buildDirectoryEntry(
    identity.uid,
    { email: identity.email, displayName: identity.displayName },
    progress,
    ledger,
    Date.now(),
  );
  await fs.api.setDoc(
    fs.api.doc(fs.db, DIRECTORY_COLLECTION, identity.uid),
    entry,
  );
}

/**
 * Read the ban tombstone for an account.
 *
 * Returns null for "not banned", including for a lifted ban — the document is
 * kept with `banned: false` so the console can still see the account was once
 * actioned, and to every caller here that is the same as never having been.
 *
 * This enforces nothing. `firestore.rules` refuses a banned account's writes
 * whether or not this runs; what it buys is the difference between a player
 * seeing a reason and a player seeing a game that silently stops saving.
 */
export async function readBanRecord(
  fs: FirestoreHandle,
  uid: string,
): Promise<BanRecord | null> {
  const snap = await fs.api.getDoc(
    fs.api.doc(fs.db, 'users', uid, BAN_COLLECTION, BAN_DOC),
  );
  if (!snap.exists()) return null;
  const record = coerceBan(snap.data());
  return record?.banned ? record : null;
}
