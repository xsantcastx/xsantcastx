/**
 * play-ledger — the record of every play of every game of chance.
 *
 * One blob (`godforge-games`) through the save gateway:
 *
 *   secret  random, minted on the first play; with `nonce` it seeds each play
 *   nonce   plays so far; the next play's seed is `secret:nonce`
 *   plays   recent plays by mutation id, outcome stored with them
 *   totals  per game: plays, Gold wagered, Gold paid (lifetime, for Details)
 *
 * A play is idempotent on its mutation id: the outcome is drawn once, stored
 * with the id, and paid once. Asking again with the same id returns the stored
 * play and pays nothing. Pure helpers here; the service does the I/O.
 */

export const GAMES_KEY = 'godforge-games';
export const GAMES_VERSION = 1;
/** Plays kept for replay protection and the history strip. */
export const PLAYS_KEPT = 60;

export interface PlayRecord<O = unknown> {
  game: string;
  bet: number;
  /** The seed the outcome was drawn from (`secret:nonce`). */
  seed: string;
  /** Order of the play in this save (the nonce it used). */
  seq: number;
  at: string;
  /** Gold the play pays. */
  win: number;
  outcome: O;
  /** True once the Gold and prizes have been handed over. */
  paid: boolean;
}

export interface GameTotals { plays: number; wagered: number; paid: number }

export interface GamesLedger {
  version: number;
  secret: string;
  nonce: number;
  plays: Record<string, PlayRecord>;
  totals: Record<string, GameTotals>;
}

export function emptyGamesLedger(): GamesLedger {
  return { version: GAMES_VERSION, secret: '', nonce: 0, plays: {}, totals: {} };
}

const whole = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);

/** Read a stored blob defensively. Anything malformed becomes empty. */
export function parseGamesLedger(raw: unknown): GamesLedger {
  if (!raw || typeof raw !== 'object') return emptyGamesLedger();
  const r = raw as Partial<GamesLedger>;
  const plays: Record<string, PlayRecord> = {};
  for (const [id, p] of Object.entries(r.plays ?? {})) {
    if (!p || typeof p !== 'object' || typeof (p as PlayRecord).game !== 'string') continue;
    const rec = p as PlayRecord;
    plays[id] = { ...rec, bet: whole(rec.bet), win: whole(rec.win), seq: whole(rec.seq), paid: rec.paid === true };
  }
  const totals: Record<string, GameTotals> = {};
  for (const [id, t] of Object.entries(r.totals ?? {})) {
    if (!t || typeof t !== 'object') continue;
    totals[id] = { plays: whole(t.plays), wagered: whole(t.wagered), paid: whole(t.paid) };
  }
  return {
    version: GAMES_VERSION,
    secret: typeof r.secret === 'string' ? r.secret : '',
    nonce: whole(r.nonce),
    plays,
    totals,
  };
}

/** Keep the newest `PLAYS_KEPT` plays (by seq). Unpaid plays are never dropped. */
export function prunePlays(plays: Record<string, PlayRecord>, keep = PLAYS_KEPT): Record<string, PlayRecord> {
  const entries = Object.entries(plays).sort((a, b) => b[1].seq - a[1].seq);
  const out: Record<string, PlayRecord> = {};
  entries.forEach(([id, p], i) => { if (i < keep || !p.paid) out[id] = p; });
  return out;
}

/**
 * Cloud merge. Hand-written because the structural merge would union the
 * arrays inside a stored outcome (`['ash','ash','cinder']` → `['ash','cinder']`)
 * and corrupt the record of what was paid.
 *
 *   plays   union by id; the same id on both sides is the same play (one seed),
 *           and the copy marked paid wins so a merge can never re-pay it
 *   nonce   the higher, so neither device reuses a seed it already played
 *   secret  the local one when set (seeds already drawn stay derivable either way:
 *           every play stores its own seed)
 *   totals  the higher of each counter
 */
export function mergeGamesLedgers(remote: unknown, local: unknown): GamesLedger {
  const r = parseGamesLedger(remote);
  const l = parseGamesLedger(local);
  const plays: Record<string, PlayRecord> = { ...r.plays };
  for (const [id, p] of Object.entries(l.plays)) {
    const other = plays[id];
    plays[id] = other && other.paid && !p.paid ? other : p;
  }
  const totals: Record<string, GameTotals> = { ...r.totals };
  for (const [id, t] of Object.entries(l.totals)) {
    const o = totals[id];
    totals[id] = o ? { plays: Math.max(o.plays, t.plays), wagered: Math.max(o.wagered, t.wagered), paid: Math.max(o.paid, t.paid) } : t;
  }
  return {
    version: GAMES_VERSION,
    secret: l.secret || r.secret,
    nonce: Math.max(r.nonce, l.nonce),
    plays: prunePlays(plays),
    totals,
  };
}

/** The newest plays of one game, newest first. */
export function recentPlays<O>(ledger: GamesLedger, game: string, n: number): (PlayRecord<O> & { id: string })[] {
  return Object.entries(ledger.plays)
    .filter(([, p]) => p.game === game)
    .sort((a, b) => b[1].seq - a[1].seq)
    .slice(0, n)
    .map(([id, p]) => ({ ...(p as PlayRecord<O>), id }));
}

/** A fresh id for one press of a play button. */
export function newPlayId(game: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${game}:${Date.now().toString(36)}:${rand}`;
}
