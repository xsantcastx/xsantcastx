/**
 * trade-fake.mjs — the local e2e's stand-in for the trade Function and for Firestore (never on Cloud Run).
 *
 * Mounted on the Hearth room under /fake-trade/ when SOCIAL_FAKE_AUTH=1 and SOCIAL_FAKE_TRADE=1 (social-server.mjs):
 * the REAL functions-game/src/trade-core.ts (through Node's type stripping) over an in-memory store with Firestore's
 * optimistic transactions, sharing that store with the room's memoryStore — so the room's `trades/{id}` binding and
 * the ground escrow it checks are the very documents the "Function" reads and writes.
 *
 *   POST /fake-trade/api/{execute|cancel|drop|pickup}   Authorization: Bearer fake.<uid>   (the Function's verbs)
 *   POST /fake-trade/doc/get  {path}                    a save document of the caller's own (what getDoc reads)
 *   POST /fake-trade/doc/put  {path, data}              written as the gateway would, with firestore.rules' inventory
 *                                                       guard: a lower `v.serverSeq` than the stored one is refused 409
 *   POST /fake-trade/sweep    {now?}                    run the scheduled ground sweep (groundSweep) once
 *
 * What it cannot stand in for: the rules themselves (only the serverSeq guard is mirrored), Firestore's own
 * contention behaviour, ID-token verification and the ban check (trade.ts) — see docs/design/online.md §4c.
 */
import { handle, memoryDb, returnExpired } from '../functions-game/src/trade-core.ts';

export function fakeTrade() {
  if (process.env.K_SERVICE) throw new Error('the fake trade Function is refused on Cloud Run');
  const db = memoryDb();
  const reply = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  const body = async req => { let s = ''; for await (const c of req) { s += c; if (s.length > 1e6) throw new Error('too large'); } return s ? JSON.parse(s) : {}; };
  const own = (uid, path) => typeof path === 'string' && path.startsWith(`users/${uid}/`) && !path.includes('..');
  return {
    docs: db.docs,
    db,
    async handle(req, res, url) {
      if (req.method !== 'POST') { reply(res, 405, { error: 'POST only.' }); return; }
      const uid = /^Bearer fake\.([A-Za-z0-9_-]{1,64})/.exec(req.headers.authorization ?? '')?.[1];
      let data;
      try { data = await body(req); } catch { reply(res, 400, { error: 'Invalid JSON.' }); return; }
      const path = url.pathname.slice('/fake-trade'.length);
      if (path === '/sweep') { reply(res, 200, { returned: await returnExpired(db, Number(data.now) || Date.now()) }); return; }
      if (!uid) { reply(res, 401, { error: 'Sign in to trade.' }); return; }
      if (path.startsWith('/api/')) {
        try { const out = await handle(db, path.slice('/api/'.length), uid, data, Date.now()); reply(res, out.status, out.body); }
        catch (e) { reply(res, 503, { error: 'The trade could not be completed. Nothing moved; try again.', detail: String(e?.message ?? e) }); }
        return;
      }
      if (!own(uid, data.path)) { reply(res, 403, { error: 'Not yours.' }); return; }
      if (path === '/doc/get') { reply(res, 200, { data: db.docs.get(data.path) ?? null }); return; }
      if (path === '/doc/put') {
        const held = db.docs.get(data.path);
        const seq = d => Number(d?.v?.serverSeq) || 0;
        if (data.path.endsWith('/progress/inventory') && held && seq(data.data) < seq(held)) { reply(res, 409, { error: 'permission-denied: serverSeq' }); return; }
        await db.run(async tx => { await tx.get(data.path); tx.set(data.path, data.data); });
        reply(res, 200, { ok: true }); return;
      }
      reply(res, 404, { error: 'Not found.' });
    },
  };
}
