/**
 * gm.model.ts — the shapes the GM console and the game client both have to agree on.
 *
 * Four documents live here, and they are deliberately in one file because they
 * are one contract: the client writes three of them and reads the fourth, the
 * console at /admin reads all four and writes two, and `firestore.rules`
 * validates the two the client is allowed to write. A shape that drifts between
 * those three places fails as a permission-denied with no message, so they are
 * spelled out once and coerced on every read.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THERE IS A DIRECTORY AT ALL
 * ─────────────────────────────────────────────────────────────────────────────
 * A Firestore client cannot enumerate subcollections, and the Godforge save has
 * no parent document — `users/{uid}` is a path prefix with nothing at it, and
 * every blob hangs off `users/{uid}/progress/*` and `users/{uid}/economy/*`.
 * That is fine for the game (a player only ever reads their own uid) and fatal
 * for an admin panel, which has to answer "who plays this" before it can answer
 * anything else. There is no query that produces that list.
 *
 * So the directory is a denormalised index: one small document per player at
 * `player-directory/{uid}`, written by the player's own browser at sign-in, read
 * as a single collection scan by the console. It is a *cache of facts the client
 * already told the server*, not a second source of truth — every number in it is
 * re-read from the real save documents when the console opens a player's
 * profile. Treating it as authoritative would be wrong twice over: it is written
 * by the client, and it is only as fresh as that client's last sign-in.
 *
 * The cost shape is what makes this the right trade. The alternative — a Cloud
 * Function fanning out over Firebase Auth's user list on every dashboard open —
 * is a server-side deploy and a per-open cost proportional to the player count.
 * A directory document is one ~200-byte write per session and one collection
 * scan per dashboard open, and the dashboard is opened by exactly one person.
 */

/** Firestore collection holding one summary document per known player. */
export const DIRECTORY_COLLECTION = 'player-directory';

/** Subcollection under `users/{uid}` where the ban tombstone lives. */
export const BAN_COLLECTION = 'meta';

/** Document id under `users/{uid}/meta` holding the ban record. */
export const BAN_DOC = 'ban';

/** Collection holding the admin audit trail. */
export const AUDIT_COLLECTION = 'admin-logs';

/** Collection holding site-wide announcements and the maintenance flag. */
export const SITE_CONFIG_COLLECTION = 'site-config';

/** Document id under `site-config` holding the broadcast + maintenance state. */
export const NOTICE_DOC = 'notice';

/**
 * A player's row in the console's user table.
 *
 * Every field is denormalised from somewhere else, and the comment on each says
 * where — because when a number here disagrees with the profile view, the
 * profile view is right and this row is stale, and knowing which document to
 * blame is the difference between a five-minute fix and an afternoon.
 */
export interface PlayerDirectoryEntry {
  /** Firebase Auth uid. Also the document id — stored again so a scan result is self-describing. */
  uid: string;
  /** From the Google credential. Absent if the provider withheld it. */
  email: string;
  /** From the Google credential. Falls back to the email's local part. */
  displayName: string;
  /** `ProgressState.levelTitle` — the rank name, denormalised at sign-in. */
  rank: string;
  /** `ProgressState.level`. */
  level: number;
  /** `EconomyLedger.gold` — a spendable balance, so this goes down as well as up. */
  gold: number;
  /** `ProgressState.xp`. Lifetime, monotonic. */
  totalXp: number;
  /** Epoch ms of the sign-in that wrote this row. */
  lastActive: number;
  /** Epoch ms parsed from `ProgressState.createdAt` — when this save was first struck. */
  createdAt: number;
}

/**
 * The ban tombstone at `users/{uid}/meta/ban`.
 *
 * Written only by the owner; read by the banned player's own client so it can
 * render the notice. It sits under the player's own document tree rather than in
 * an admin-only collection for one reason: `firestore.rules` can only reach a
 * document by a path it can build from the request, and the write it has to
 * block is a write to `users/{uid}/...`. A ban record in a collection keyed some
 * other way could not be found from inside that rule.
 */
export interface BanRecord {
  banned: boolean;
  reason: string;
  /** Epoch ms. */
  bannedAt: number;
  /** The admin uid that issued it. Always the owner today; recorded anyway. */
  bannedBy: string;
}

/** One entry in the admin audit trail at `admin-logs/{autoId}`. */
export interface AuditEntry {
  /** Document id. Present on reads, absent when writing. */
  id?: string;
  /** Machine-readable verb: 'grant-gold', 'ban', 'full-reset', … */
  action: string;
  /** The uid acted upon, or '—' for site-wide actions. */
  targetUid: string;
  /** Denormalised so the log stays readable after a directory row is gone. */
  targetName: string;
  /** The admin uid that performed it. */
  actorUid: string;
  /** The admin's email, denormalised for the same reason as targetName. */
  actorEmail: string;
  /** Free-text detail: the amount granted, the ban reason, what was wiped. */
  detail: string;
  /** Epoch ms. */
  at: number;
}

/**
 * The site-wide notice at `site-config/notice`.
 *
 * One document rather than two because the two states are mutually exclusive in
 * practice and a client that reads one has already paid for the other. Publicly
 * readable — that is the whole point — and owner-write only.
 */
export interface SiteNotice {
  /** Announcement banner text. Empty string means no announcement. */
  message: string;
  /** When true the maintenance warning renders instead of the announcement. */
  maintenance: boolean;
  /** Shown under the maintenance heading. Empty falls back to a default. */
  maintenanceNote: string;
  /** Epoch ms of the last edit, for the console's "set 4m ago" line. */
  updatedAt: number;
}

// ── Coercion ────────────────────────────────────────────────────────────────
//
// Everything below turns an `unknown` off the wire into a value the templates
// can render without guarding. The house rule from ChangelogService applies:
// a malformed document degrades to a usable default, it never throws, because
// one bad row must not take out the table it is in.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Longest a field may be before it is cut.
 *
 * Mirrored by `firestore.rules`, which enforces the same ceilings server-side.
 * The client trims rather than rejects: a display name longer than this is a
 * real name from a real provider, and refusing the whole row over it would cost
 * the console a player it could otherwise manage.
 */
export const FIELD_LIMITS = {
  email: 254,
  displayName: 120,
  rank: 60,
  banReason: 500,
  noticeMessage: 400,
  auditDetail: 500,
} as const;

function clamp(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

export function coerceDirectoryEntry(uid: string, raw: unknown): PlayerDirectoryEntry {
  const r = isRecord(raw) ? raw : {};
  return {
    uid: str(r['uid'], uid) || uid,
    email: str(r['email']),
    displayName: str(r['displayName']),
    rank: str(r['rank'], 'Unranked'),
    level: num(r['level']),
    gold: num(r['gold']),
    totalXp: num(r['totalXp']),
    lastActive: num(r['lastActive']),
    createdAt: num(r['createdAt']),
  };
}

/**
 * Build the row this browser publishes at sign-in.
 *
 * Takes the already-merged progression and ledger rather than reading them
 * itself, because the only moment this is correct is *after* `attach()` has
 * reconciled both sides — a row built from the pre-merge local copy would report
 * a phone's stale Gold as the account's balance.
 */
export function buildDirectoryEntry(
  uid: string,
  identity: { email?: string | null; displayName?: string | null },
  progress: unknown,
  ledger: unknown,
  now: number,
): PlayerDirectoryEntry {
  const p = isRecord(progress) ? progress : {};
  const l = isRecord(ledger) ? ledger : {};
  const email = clamp(str(identity.email), FIELD_LIMITS.email);
  // A Google account can withhold the display name but never the address, so
  // the local part is the fallback that always produces something a human can
  // recognise in the table. '—' only survives if both are missing, which means
  // an anonymous or custom-token session rather than the Google flow.
  const fallbackName = email ? email.split('@')[0] : '';
  return {
    uid,
    email,
    displayName: clamp(str(identity.displayName) || fallbackName || '—', FIELD_LIMITS.displayName),
    rank: clamp(str(p['levelTitle'], 'Unranked'), FIELD_LIMITS.rank),
    level: num(p['level']),
    gold: num(l['gold']),
    totalXp: num(p['xp']),
    lastActive: now,
    createdAt: Date.parse(str(p['createdAt'])) || now,
  };
}

export function coerceBan(raw: unknown): BanRecord | null {
  if (!isRecord(raw)) return null;
  // A record with `banned: false` is a *lifted* ban, not an absent one. It is
  // returned rather than nulled so the console can show "unbanned 3d ago"
  // instead of silently forgetting that this account was ever actioned.
  return {
    banned: raw['banned'] === true,
    reason: clamp(str(raw['reason']), FIELD_LIMITS.banReason),
    bannedAt: num(raw['bannedAt']),
    bannedBy: str(raw['bannedBy']),
  };
}

export function coerceNotice(raw: unknown): SiteNotice {
  const r = isRecord(raw) ? raw : {};
  return {
    message: clamp(str(r['message']), FIELD_LIMITS.noticeMessage),
    maintenance: r['maintenance'] === true,
    maintenanceNote: clamp(str(r['maintenanceNote']), FIELD_LIMITS.noticeMessage),
    updatedAt: num(r['updatedAt']),
  };
}

export function coerceAuditEntry(id: string, raw: unknown): AuditEntry {
  const r = isRecord(raw) ? raw : {};
  return {
    id,
    action: str(r['action'], 'unknown'),
    targetUid: str(r['targetUid'], '—'),
    targetName: str(r['targetName'], '—'),
    actorUid: str(r['actorUid']),
    actorEmail: str(r['actorEmail']),
    detail: clamp(str(r['detail']), FIELD_LIMITS.auditDetail),
    at: num(r['at']),
  };
}

/** True when the notice document has something worth rendering to players. */
export function noticeIsLive(notice: SiteNotice | null): boolean {
  return !!notice && (notice.maintenance || notice.message.trim().length > 0);
}
