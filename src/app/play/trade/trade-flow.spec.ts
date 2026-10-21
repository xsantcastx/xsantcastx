/**
 * trade-flow.spec.ts — the client trade and ground state machines (trade-flow.ts) against the REAL server core
 * (functions/src/trade-core.ts over its in-memory Db) and a fake room that relays like the Hearth.
 */
import * as core from '../../../../functions/src/trade-core';
import type { RoomTrade, RoomTradeEnd } from '../social/social-room';
import { GroundFlow, TradeFlow, type TradeBackend, type TradeRoom } from './trade-flow';

const T = Date.now();
function rec(id: string) {
  return {
    id, definitionId: `forge:${id}`, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'rare', soulbound: false,
    acquiredAt: new Date(T).toISOString(), revision: { hlc: T - 10, deviceId: 'd', sequence: 1 }, source: 'inventory',
    name: `Blade ${id}`, type: 'artifact', stats: { strikePower: 5 }, location: { kind: 'bag' }, sellValue: 1,
  };
}
const inv = (ids: string[]) => ({ v: { version: 2, records: ids.map(rec), tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: T - 5, legacyBackup: null, era: core.INVENTORY_ERA }, updatedAt: '' });
const eco = (gold: number) => ({ v: { version: core.ECONOMY_VERSION, goldEra: core.GOLD_ERA, gold, ops: [], origin: null, hlc: T - 5, applied: {} }, updatedAt: '' });

function backendFor(db: ReturnType<typeof core.memoryDb>, uid: string): TradeBackend & { calls: string[]; settles: number } {
  return {
    calls: [], settles: 0, character: 'c1',
    blocked: () => null,
    async prepare() { /* the save is already in the db */ },
    async call(verb, body) { this.calls.push(verb); const out = await core.handle(db, verb, uid, body, Date.now()); return { status: out.status, body: out.body as Record<string, unknown> }; },
    async settle() { this.settles++; },
  };
}
function setup() {
  const db = core.memoryDb();
  db.docs.set('users/A/progress/inventory', inv(['s1', 's2']));
  db.docs.set('users/B/progress/inventory', inv([]));
  db.docs.set('users/A/economy/state', eco(100));
  db.docs.set('users/B/economy/state', eco(0));
  db.docs.set('trades/t', { a: { uid: 'A', player: 'pa', name: 'Aster' }, b: { uid: 'B', player: 'pb', name: 'Bryn' }, status: 'open', openedAt: T, expiresAt: T + 600000 });
  const ends: { to: 'a' | 'b'; end: RoomTradeEnd }[] = [];
  const confirms: { side: 'a' | 'b'; done: boolean }[] = [];
  const roomFor = (side: 'a' | 'b'): TradeRoom & { cancels: string[] } => ({
    cancels: [],
    async tradeConfirm(trade, _rev, done) { confirms.push({ side, done }); if (done) for (const to of ['a', 'b'] as const) ends.push({ to, end: { id: trade, outcome: 'done', by: side, why: '' } }); return ''; },
    async tradeCancel(trade, why = '') { this.cancels.push(why); for (const to of ['a', 'b'] as const) ends.push({ to, end: { id: trade, outcome: 'cancelled', by: side, why } }); return ''; },
    async groundDrop() { return ''; },
    async groundTake() { return ''; },
  });
  const ba = backendFor(db, 'A'), bb = backendFor(db, 'B');
  const ra = roomFor('a'), rb = roomFor('b');
  const fa = new TradeFlow(ba, ra), fb = new TradeFlow(bb, rb);
  const offer = core.offerOf(rec('s1') as unknown as core.Doc);
  const view = (me: 'a' | 'b'): RoomTrade => ({
    id: 't', me, a: { id: 'pa', name: 'Aster' }, b: { id: 'pb', name: 'Bryn' },
    offers: { a: { items: [offer], gold: 40 }, b: { items: [], gold: 0 } }, accepted: { a: true, b: true }, confirmed: { a: false, b: false },
    rev: 3, stage: 'confirm', until: T + 600000,
  });
  return { db, ba, bb, ra, fa, fb, view, ends, confirms };
}

describe('TradeFlow (client) × trade-core (server)', () => {
  it('both confirm: the first waits, the second completes; the first learns it from the room and both adopt the move', async () => {
    const s = setup();
    s.fa.view(s.view('a')); s.fb.view(s.view('b'));
    expect(s.fa.status.stage).toBe('confirm');
    await s.fa.confirm(s.view('a'));
    expect(s.fa.status.stage).toBe('waiting');
    expect(s.confirms).toEqual([{ side: 'a', done: false }]);
    await s.fb.confirm(s.view('b'));
    expect(s.fb.status.stage).toBe('done');
    expect(s.fb.status.received?.items.length).toBe(1);
    expect(s.bb.settles).toBe(1);
    // The room closes both windows on Bryn's "done"; Aster's flow asks the Function, which says done, and adopts it.
    const toA = s.ends.find(e => e.to === 'a')!;
    await s.fa.ended(toA.end, s.view('a'));
    expect(s.fa.status.stage).toBe('done');
    expect(s.fa.status.received).toEqual({ items: [], gold: 0 });
    expect(s.ba.settles).toBe(1);
    expect((s.db.docs.get('users/B/economy/state') as { v: { gold: number } }).v.gold).toBe(40);
  });

  it('a changed item voids the trade: the window fails with the Function\'s words and nothing moves', async () => {
    const s = setup();
    s.fa.view(s.view('a')); s.fb.view(s.view('b'));
    await s.fa.confirm(s.view('a'));
    const d = s.db.docs.get('users/A/progress/inventory') as { v: { records: { stats: Record<string, number> }[] } };
    d.v.records[0].stats = { strikePower: 6 };
    await s.fb.confirm(s.view('b'));
    expect(s.fb.status.stage).toBe('failed');
    expect(s.fb.status.why).toMatch(/changed/);
    expect((s.db.docs.get('users/B/progress/inventory') as { v: { records: unknown[] } }).v.records.length).toBe(0);
  });

  it('a window closed after this Keeper confirmed withdraws the confirmation at the Function', async () => {
    const s = setup();
    s.fa.view(s.view('a'));
    await s.fa.confirm(s.view('a'));
    await s.fa.cancel(s.view('a'), 'changed my mind');
    expect(s.ba.calls).toEqual(['execute', 'cancel']);
    expect((s.db.docs.get('trades/t') as { status: string }).status).toBe('void');
    // Bryn's later confirmation cannot complete it.
    s.fb.view(s.view('b'));
    await s.fb.confirm(s.view('b'));
    expect(s.fb.status.stage).toBe('failed');
  });

  it('ground: a drop escrows; two Keepers reaching at once — one gets it, the other is told it is gone', async () => {
    const s = setup();
    s.db.docs.set('users/C/progress/inventory', inv([]));
    const room = { async tradeConfirm() { return ''; }, async tradeCancel() { return ''; }, drops: 0, takes: 0,
      async groundDrop() { this.drops++; return ''; }, async groundTake() { this.takes++; return ''; } };
    const dropped = await new GroundFlow(s.ba, room).drop(core.offerOf(rec('s2') as unknown as core.Doc), { area: 'isle', x: 3, y: 4 });
    expect(dropped.ok).toBeTrue();
    expect(room.drops).toBe(1);
    const id = (dropped as { id: string }).id;
    const g = { id, area: 'isle', x: 3, y: 4, name: 'Blade s2', rarity: 'rare', def: 'forge:s2', until: T + 600000 };
    const [b, c] = await Promise.all([new GroundFlow(s.bb, room).pickup(g), new GroundFlow(backendFor(s.db, 'C'), room).pickup(g)]);
    expect([b.ok, c.ok].filter(Boolean).length).toBe(1);
    expect(room.takes).toBe(2);
  });

  it('a guest is told to sign in and nothing is sent', async () => {
    const s = setup();
    const guest = { ...backendFor(s.db, 'A'), blocked: () => 'signin' as const };
    const f = new TradeFlow(guest, s.ra);
    f.view(s.view('a'));
    await f.confirm(s.view('a'));
    expect(f.status.why).toBe('signin');
    expect(guest.calls).toEqual([]);
    expect(await new GroundFlow(guest, s.ra).drop(core.offerOf(rec('s1') as unknown as core.Doc), { area: 'x', x: 0, y: 0 })).toEqual({ ok: false, why: 'signin' });
  });
});
