/**
 * room-credit.ts — Hunting XP and hunt Gold credited by the room (Hearth protocol 10, M4 of the room-run world;
 * docs/design/online.md §4d "M4").
 *
 * Before M4 the room decided a kill and owned the ground, but the Keeper's screen paid itself: it wrote its own XP and
 * Gold into its save. Now, for a signed-in Keeper whose room runs the area, the room pays — through the Hearth's
 * service account and the trade core's pattern (functions-game/src/trade-core.ts `Db`: one Firestore transaction,
 * every read before any write):
 *
 *  - **what is owed**: a kill the room saw this Keeper fight (`k.<boot>.<nid>`), a kill a party mate fought near it (the
 *    share), a Gold pile it took from the room's ground (the drop's own id). The room computes the base itself (the
 *    creature's XP under the sky and the level gap; the pile); the screen may ask for its own full number (its worn
 *    XP and Gold Find, a Gold potion, the Hush's boon) and is given it, never past CAP × the base.
 *  - **once**: each owed id is credited at most once, ever — the transaction reads the Keeper's credit ring
 *    (`users/{uid}/social/credits-<character>`, the last RING ids, hashed) and skips any id already in it, in the same
 *    commit that pays. A batch sent twice, or retried after a commit whose answer was lost, pays nothing more.
 *  - **merge-safe**: XP lands as ONE activity operation per batch (a unique id, device `room`, the hunting total raised
 *    with it — activity-ops' union keeps it); Gold as ONE `credit-gold` op on the economy ledger (trade-core moveGold,
 *    device `trade`; the packed/plain format untouched); the Ember debt is paid from the XP first (hearth-rules
 *    payDebt) and the hearth document written with a later `ledgerAt`. Nothing grows without bound: the op window is
 *    the ledger's own (ACTIVITY_OPS_MAX), the ring is RING hashes.
 *
 * Pure (the trade core's Db only). The Hearth bundles it (scripts/world-sim-build.mjs).
 */
import { TradeError, economyPath, hashId, moveGold, readEconomy, savePath, type Db, type Doc } from '../../../../functions-game/src/trade-core';
import { payDebt } from '../../shared/hearth/hearth-rules';
import { huntingXpFor } from '../../shared/skills/hunting';
import { GOLD_FIND_CAP, goldFindPile } from '../../shared/economy/economy-curve';
import { zoneXp } from '../td/td-zones';

/** A screen may ask at most this many times the room's base for a kill (worn XP, a pet, the Hush's boon). */
export const XP_CAP = 2.5;
/** A kill's party share (side-scroller's party share pays this much of a fight one did not join). */
export const SHARE = 0.6;
/** A Gold potion multiplies a pile at most this much (shared/potions: the Gold infusion). */
export const GOLD_POTION_CAP = 3;
/** Ids the ring remembers (each a short hash): far past any batch's retries. */
export const RING = 600;
/** The activity ledger's op window (shared/activity ACTIVITY_OPS_MAX; room-credit.spec checks they agree). */
export const OPS_WINDOW = 256;
/** The device the room's activity operations carry. */
export const ROOM_DEVICE = 'room';

/** The Keeper's credit ring: which owed ids it has been paid for. */
export const creditPath = (uid: string, character: string): string => `users/${uid}/social/credits-${character}`;

/** The base Hunting XP of a kill for one Keeper: its life's XP (hunting.ts), the sky's lift and the level gap's. */
export function killXp(hp: number, xpK: number, gap: number): number {
  return Math.max(1, Math.round(huntingXpFor(hp) * (Number.isFinite(xpK) && xpK > 0 ? xpK : 1) * (Number.isFinite(gap) && gap > 0 ? gap : 1)));
}
/** A kill's base XP for a Keeper of `keeperLevel` (the zone's level gap, td-zones zoneXp: less far below it). */
export function fighterXp(hp: number, xpK: number, keeperLevel: number, creatureLevel: number): number {
  return killXp(hp, xpK, zoneXp(keeperLevel, creatureLevel));
}
/** The most a pile may pay: the cap's Gold Find, and a Gold potion's most. */
export function goldCap(pile: number, potion = GOLD_POTION_CAP): number {
  return Math.round(goldFindPile(pile, GOLD_FIND_CAP) * Math.max(1, Math.min(GOLD_POTION_CAP, potion)));
}
/** What the room pays for one owed id: the screen's ask when it gave one, never past the cap; else the base. */
export function owed(base: number, cap: number, ask: number | null | undefined): number {
  const b = Math.max(0, Math.round(base));
  if (typeof ask !== 'number' || !Number.isFinite(ask) || ask <= 0) return b;
  return Math.max(0, Math.min(Math.round(ask), Math.round(cap)));
}

export interface CreditItem { id: string; xp?: number; gold?: number }
export interface CreditBody { uid: string; character: string; batch: string; area: string; items: CreditItem[] }
/** `kept`: owed ids not paid now because their document is not written yet (the room keeps them and tries again). */
export interface CreditResult { status: 'done'; dup: string[]; paid: string[]; kept: string[]; xp: number; gold: number; debtPaid: number }

const isObj = (v: unknown): v is Doc => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const ID = /^[A-Za-z0-9:._~-]{1,96}$/;

/**
 * Pay one batch, once: XP to the activity ledger (the debt first), Gold to the economy ledger, the ids into the ring.
 * An id whose document the client has not written yet (no activity, no purse, an older build's purse) is `kept`, not
 * paid and not ringed: the room tries it again. Refusals (TradeError): `no-save` (nothing could be paid), `bad`.
 */
export async function creditRoom(db: Db, body: CreditBody, now: number): Promise<CreditResult> {
  const { uid, character } = body;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid) || !/^[a-z0-9]{2,16}$/.test(character) || !ID.test(body.batch)) throw new TradeError(400, 'bad', 'Invalid credit.');
  const items = body.items.filter(i => ID.test(i.id) && (num(i.xp) > 0 || num(i.gold) > 0)).slice(0, 64);
  return db.run(async tx => {
    const ringP = creditPath(uid, character), actP = savePath(uid, character, 'progress', 'activity');
    const hearthP = savePath(uid, character, 'progress', 'hearth'), econP = economyPath(uid, character);
    const wantXp = items.some(i => num(i.xp) > 0), wantGold = items.some(i => num(i.gold) > 0);
    const [ringDoc, actDoc, hearthDoc, econDoc] = await Promise.all([tx.get(ringP), wantXp ? tx.get(actP) : null, wantXp ? tx.get(hearthP) : null, wantGold ? tx.get(econP) : null]);
    const ring: string[] = isObj(ringDoc) && Array.isArray(ringDoc['done']) ? (ringDoc['done'] as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    const seen = new Set(ring);
    const dup: CreditItem[] = [], all: CreditItem[] = [];
    for (const i of items) (seen.has(hashId(i.id)) || all.some(f => f.id === i.id) ? dup : all).push(i);
    // What can be paid now: XP needs the activity ledger, Gold a current purse; the rest is kept for the next try.
    const act = isObj(actDoc) && isObj(actDoc['v']) && actDoc['v']['version'] === 1 ? JSON.parse(JSON.stringify(actDoc['v'])) as Doc : null;
    let purse: Doc | null = null;
    if (wantGold) { try { purse = readEconomy(econDoc, 'This Keeper'); } catch (e) { if (!(e instanceof TradeError)) throw e; } }
    const payable = (i: CreditItem) => (num(i.xp) > 0 ? !!act : true) && (num(i.gold) > 0 ? !!purse : true);
    const fresh = all.filter(payable), kept = all.filter(i => !payable(i));
    let xp = 0, gold = 0;
    for (const i of fresh) { xp += Math.max(0, Math.round(num(i.xp))); gold += Math.max(0, Math.round(num(i.gold))); }
    if (!fresh.length && kept.length) throw new TradeError(409, 'no-save', 'No save written yet.');
    if (!fresh.length || (xp <= 0 && gold <= 0)) return { status: 'done', dup: dup.map(i => i.id), paid: [], kept: [], xp: 0, gold: 0, debtPaid: 0 };
    let debtPaid = 0;
    if (xp > 0 && act) {
      // The Ember debt (the Cold Hearth): half of the XP pays it while one is owed.
      const hearth = isObj(hearthDoc) && isObj(hearthDoc['v']) ? JSON.parse(JSON.stringify(hearthDoc['v'])) as Doc : null;
      let earned = xp;
      if (hearth && num(hearth['debt']) > 0) {
        const r = payDebt(xp, num(hearth['debt']));
        earned = r.earned; debtPaid = r.paid;
        hearth['debt'] = r.debt;
        hearth['ledgerAt'] = Math.max(now, num(hearth['ledgerAt']) + 1);
        tx.set(hearthP, { v: hearth, updatedAt: new Date(now).toISOString() });
      }
      if (earned > 0) {
        const ops = Array.isArray(act['operations']) ? (act['operations'] as unknown[]).filter(isObj) : [];
        const seq = 1 + ops.reduce((m, o) => { const h = isObj(o['hlcRevision']) ? o['hlcRevision'] : null; return h && h['deviceId'] === ROOM_DEVICE ? Math.max(m, num(h['sequence'])) : m; }, 0);
        const wall = Math.max(now, ...ops.map(o => num(isObj(o['hlcRevision']) ? o['hlcRevision']['wallTimeMs'] : 0)));
        const id = `room:${body.batch}`;
        ops.push({
          id, hlcRevision: { wallTimeMs: wall, logicalCounter: 0, deviceId: ROOM_DEVICE, sequence: seq }, kind: 'active', disciplineId: 'hunting',
          locationId: `room/${/^[a-z0-9-]{1,40}$/.test(body.area) ? body.area : 'world'}`, resolvedAt: new Date(now).toISOString(),
          xpGrant: { id, amount: earned }, inventoryGrants: [], discovery: { rolled: false, result: 'none' },
        });
        // The newest OPS_WINDOW by their clocks (the ledger's own window; the totals below carry what falls out).
        const t = (o: Doc) => { const h = isObj(o['hlcRevision']) ? o['hlcRevision'] : {}; return num(h['wallTimeMs']) * 1e6 + num(h['logicalCounter']); };
        act['operations'] = ops.length > OPS_WINDOW ? [...ops].sort((a, b) => t(a) - t(b)).slice(-OPS_WINDOW) : ops;
        const progress = isObj(act['progress']) ? act['progress'] : { version: 1, xpByDiscipline: {} };
        const by = isObj(progress['xpByDiscipline']) ? { ...progress['xpByDiscipline'] } : {};
        by['hunting'] = num(by['hunting']) + earned;
        act['progress'] = { ...progress, version: 1, xpByDiscipline: by };
        tx.set(actP, { v: act, updatedAt: new Date(now).toISOString() });
      }
    }
    if (gold > 0 && purse) {
      moveGold(purse, 'credit-gold', gold, now, 'This Keeper');
      tx.set(econP, { v: purse, updatedAt: new Date(now).toISOString() });
    }
    const next = [...ring, ...fresh.map(i => hashId(i.id))].slice(-RING);
    tx.set(ringP, { done: next, at: now });
    return { status: 'done', dup: dup.map(i => i.id), paid: fresh.map(i => i.id), kept: kept.map(i => i.id), xp, gold, debtPaid };
  });
}
