// Protocol 5: shared creatures for parties (docs/design/online.md §3.4). The room elects one host per party per area,
// validates and relays the host's snapshots to the others there, and the members' damage claims to the host; it never
// simulates or stores a creature. A v3 client (no `coop: true`) is never elected, sent or asked anything new.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COOP, PROTOCOL, coopEvent, coopHit, coopMob, createSocialServer } from './social-server.mjs';

const origin = 'http://127.0.0.1:4317';

async function room(t, options = {}) {
  let time = 1000;
  const r = createSocialServer({ publishMs: 5, now: () => time, ...options });
  await new Promise(resolve => r.server.listen(0, '127.0.0.1', resolve));
  t.after(() => r.dispose());
  const base = `http://127.0.0.1:${r.server.address().port}`;
  const raw = (path, body, token) => fetch(base + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  const post = async (path, body, token) => { const res = await raw(path, body, token); return { status: res.status, body: await res.json().catch(() => null) }; };
  const join = async (name, extra = { party: true, coop: true }) => (await post('/join', { name, ...extra })).body;
  const move = (k, area, x = 100, y = 100) => post('/update', { x, y, facing: 1, animation: 'idle', zone: area, area, level: 7 }, k.token);
  /** A party of `ks` (the first leads and invites the rest, in order: the join order the election reads). */
  const form = async ks => {
    for (const k of ks.slice(1)) {
      const inv = await post('/party/invite', { to: k.id }, ks[0].token);
      assert.equal(inv.status, 201);
      assert.equal((await post('/party/accept', { invite: inv.body.invite.id }, k.token)).status, 200);
    }
  };
  const stream = async k => {
    const abort = new AbortController();
    t.after(() => abort.abort());
    const res = await fetch(`${base}/events`, { headers: { Origin: origin, Authorization: `Bearer ${k.token}` }, signal: abort.signal });
    const reader = res.body.getReader();
    let buffer = '';
    const seen = [];
    const pump = (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) return;
          buffer += new TextDecoder().decode(value);
          let split;
          while ((split = buffer.indexOf('\n\n')) !== -1) {
            const chunk = buffer.slice(0, split); buffer = buffer.slice(split + 2);
            if (chunk.startsWith('data: ')) seen.push(JSON.parse(chunk.slice(6)));
          }
        }
      } catch { /* aborted */ }
    })();
    void pump;
    /** The next event of `type` after those already taken (waits up to a second). */
    let taken = 0;
    const next = async (type, ms = 1500) => {
      const until = Date.now() + ms;
      for (;;) {
        for (let i = taken; i < seen.length; i++) if (!type || seen[i].type === type) { taken = i + 1; return seen[i]; }
        if (Date.now() > until) return null;
        await new Promise(r => setTimeout(r, 10));
      }
    };
    /** The latest `coop` election this stream has heard. */
    const coop = async () => { await new Promise(r => setTimeout(r, 40)); return [...seen].reverse().find(e => e.type === 'coop') ?? null; };
    return { next, coop, seen };
  };
  return { r, base, post, raw, join, move, form, stream, tick: ms => { time += ms; } };
}

const snap = (area, mobs = [], extra = {}) => ({ area, seq: 1, kf: true, mobs, ...extra });
const wolf = (i = 'a1', more = {}) => ({ i, t: 'ash-wolf', k: 'w:3,4', x: 120, y: 140, f: 1, h: 30, m: 40, l: 6, ...more });

test('protocol 5 and up: the health check and the join reply say the room\'s protocol (7 since the room-run world)', async t => {
  const { base, join } = await room(t);
  assert.ok(PROTOCOL >= 5);
  assert.ok(PROTOCOL >= 7);
  assert.equal((await (await fetch(`${base}/health`)).json()).protocol, PROTOCOL);
  assert.equal((await join('Arin')).protocol, PROTOCOL);
});

test('protocol 5: the earliest-joined member present hosts each area; it stays host while it stays (sticky)', async t => {
  const { join, move, form, stream } = await room(t);
  const a = await join('Arin'), b = await join('Mira'), c = await join('Oskar');
  const sa = await stream(a), sb = await stream(b), sc = await stream(c);
  await move(c, 'ember-isle'); await move(b, 'ember-isle'); await move(a, 'cinder-steppe');
  await form([a, b, c]);
  // Arin leads but is elsewhere: Mira (joined the party before Oskar) hosts the isle; Arin hosts the steppe alone.
  let view = (await sb.coop()).areas;
  assert.equal(view['ember-isle'].host, b.id);
  assert.deepEqual(view['ember-isle'].members.sort(), [b.id, c.id].sort());
  assert.equal(view['cinder-steppe'].host, a.id);
  // Arin arrives: Mira stays host (sticky), the term does not move.
  const term = view['ember-isle'].term;
  await move(a, 'ember-isle');
  view = (await sc.coop()).areas;
  assert.equal(view['ember-isle'].host, b.id);
  assert.equal(view['ember-isle'].term, term);
  assert.equal(view['ember-isle'].members.length, 3);
  assert.equal(view['cinder-steppe'], undefined);
  // Everyone in the party hears the same election.
  assert.deepEqual((await sa.coop()).areas, view);
});

test('protocol 5: re-election when the host changes area, leaves the party, leaves the room or goes quiet', async t => {
  const { join, move, form, stream, post, tick, r } = await room(t);
  const a = await join('Arin'), b = await join('Mira'), c = await join('Oskar');
  for (const k of [a, b, c]) await move(k, 'ember-isle');
  await form([a, b, c]);
  const sc = await stream(c);
  assert.equal((await sc.coop()).areas['ember-isle'].host, a.id);
  // The host changes area: the next earliest-joined present (Mira) takes over, with a new term.
  const t1 = (await sc.coop()).areas['ember-isle'].term;
  await move(a, 'ember-mine-1');
  let view = (await sc.coop()).areas;
  assert.equal(view['ember-isle'].host, b.id);
  assert.ok(view['ember-isle'].term > t1);
  assert.equal(view['ember-mine-1'].host, a.id);
  // Back again: Mira keeps it.
  await move(a, 'ember-isle');
  assert.equal((await sc.coop()).areas['ember-isle'].host, b.id);
  // The host leaves the party: Arin (earliest-joined still present) hosts.
  assert.equal((await post('/party/leave', {}, b.token)).status, 200);
  assert.equal((await sc.coop()).areas['ember-isle'].host, a.id);
  // The host goes quiet (a hidden tab stops simulating) while Oskar shares the area: replaced after COOP.staleMs.
  tick(COOP.staleMs - 1); r.coopSweep();
  assert.equal((await sc.coop()).areas['ember-isle'].host, a.id, 'not before the grace runs out');
  tick(2); r.coopSweep();
  assert.equal((await sc.coop()).areas['ember-isle'].host, c.id);
  // A snapshot keeps a host fresh: Oskar streams, time passes, it stays.
  for (let i = 0; i < 5; i++) { tick(1000); assert.equal((await post('/coop/snap', snap('ember-isle'), c.token)).status, 200); r.coopSweep(); }
  assert.equal((await sc.coop()).areas['ember-isle'].host, c.id);
  // The host leaves the room: the last one standing hosts alone.
  await post('/leave', {}, c.token);
  // (A party of one is no party: Arin hears there is nothing to host.)
});

test('protocol 5: snapshots reach only the party\'s others in that area; claims reach only that area\'s host', async t => {
  const { join, move, form, stream, post } = await room(t);
  const a = await join('Arin'), b = await join('Mira'), c = await join('Oskar');
  const old = await join('Oldtimer', { party: true });            // a v3 client: parties, no co-op
  const x = await join('Stranger'), y = await join('Wren');        // another party in the same place
  for (const k of [a, b, c, old, x, y]) await move(k, 'ember-isle');
  await move(c, 'ember-mine-1');
  await form([a, b, c, old]);
  await form([x, y]);
  const [sa, sb, sc, so, sx] = [await stream(a), await stream(b), await stream(c), await stream(old), await stream(x)];
  assert.equal((await sb.coop()).areas['ember-isle'].host, a.id);
  const sent = await post('/coop/snap', snap('ember-isle', [wolf()], { ev: [{ k: 'bite', to: b.id, i: 'a1', d: 7, ty: 'fire', b: true }] }), a.token);
  assert.equal(sent.status, 200);
  assert.equal(sent.body.to, 1, 'Mira only');
  const got = await sb.next('coop-snap');
  assert.equal(got.from, a.id);
  assert.deepEqual(got.mobs, [wolf()]);
  assert.deepEqual(got.ev, [{ k: 'bite', to: b.id, i: 'a1', d: 7, ty: 'fire', b: true }]);
  assert.equal(await sc.next('coop-snap', 200), null, 'Oskar is on another floor');
  assert.equal(await so.next('coop-snap', 200), null, 'a v3 member hears nothing new');
  assert.equal(await so.next('coop', 50), null, 'nor any election');
  assert.equal(await sx.next('coop-snap', 200), null, 'another party hears nothing');
  assert.equal(await sa.next('coop-snap', 200), null, 'the host is not echoed');
  // A claim: to the host only, with the room's own record of where the member stands and its level.
  const hit = await post('/coop/hits', { area: 'ember-isle', hits: [{ i: 'a1', d: 12, el: 'fire', c: true, s: 'ember-bolt' }] }, b.token);
  assert.equal(hit.status, 200);
  const claim = await sa.next('coop-hits');
  assert.deepEqual({ from: claim.from, x: claim.x, y: claim.y, level: claim.level, hits: claim.hits }, { from: b.id, x: 100, y: 100, level: 7, hits: [{ i: 'a1', d: 12, el: 'fire', c: true, s: 'ember-bolt' }] });
  assert.equal(await sx.next('coop-hits', 200), null);
  // Only the host streams; a member may not; the host may not claim; nobody claims where there is no host but itself.
  assert.equal((await post('/coop/snap', snap('ember-isle'), b.token)).status, 409);
  assert.equal((await post('/coop/hits', { area: 'ember-isle', hits: [{ i: 'a1', d: 1, el: 'physical' }] }, a.token)).status, 409);
  assert.equal((await post('/coop/hits', { area: 'ember-mine-1', hits: [{ i: 'a1', d: 1, el: 'physical' }] }, c.token)).status, 409);
  // Not where the room last saw you: refused.
  assert.equal((await post('/coop/snap', snap('ember-mine-1'), a.token)).status, 409);
  assert.equal((await post('/coop/hits', { area: 'ember-mine-1', hits: [{ i: 'a1', d: 1, el: 'physical' }] }, b.token)).status, 409);
});

test('protocol 5: every field is validated; caps on creatures, events, ids and bytes', async t => {
  const { join, move, form, post, raw, tick } = await room(t);
  const a = await join('Arin'), b = await join('Mira');
  for (const k of [a, b]) await move(k, 'ember-isle');
  await form([a, b]);
  const ok = async (body, code = 200) => { tick(1000); const r = await post('/coop/snap', body, a.token); assert.equal(r.status, code, JSON.stringify(body).slice(0, 160)); };
  await ok(snap('ember-isle', Array.from({ length: COOP.maxMobs }, (_, i) => ({ i: i.toString(36), x: i, y: i }))));
  await ok(snap('ember-isle', Array.from({ length: COOP.maxMobs + 1 }, (_, i) => ({ i: i.toString(36) }))), 400);
  await ok(snap('ember-isle', [], { ev: Array.from({ length: COOP.maxEvents + 1 }, () => ({ k: 'shot', x: 1, y: 1, vx: 1, vy: 1, s: 'fire', l: 1 })) }), 400);
  await ok(snap('ember-isle', [], { gone: Array.from({ length: COOP.maxGone + 1 }, (_, i) => `g${i}`) }), 400);
  await ok(snap('ember-isle', [wolf('a1'), wolf('a1')]), 400);
  for (const bad of [
    { i: 'A1' }, { i: '' }, { i: 'x'.repeat(11) }, { i: 'a', t: '<b>' }, { i: 'a', x: 2e6 }, { i: 'a', x: 'NaN' }, { i: 'a', f: 0 },
    { i: 'a', h: 50, m: 40 }, { i: 'a', h: 1.5 }, { i: 'a', l: 1000 }, { i: 'a', k: 'bad key' }, { i: 'a', evil: 1 },
    { i: 'a', e: { r: 'king', o: 'leader', a: [] } }, { i: 'a', e: { r: 'unique', o: 'leader', a: ['<x>'] } }, { i: 'a', e: { r: 'unique', o: 'leader', a: [], n: '<img>' } },
    { i: 'a', tl: 101 }, { i: 'a', fl: 256 },
  ]) await ok(snap('ember-isle', [bad]), 400);
  for (const bad of [
    { k: 'kill', i: 'a', t: 'ash-wolf', l: 6, h: 40, x: 1, y: 1, by: ['nobody'] },
    { k: 'kill', i: 'a', t: 'ash-wolf', l: 6, h: 40, x: 1, y: 1, by: [a.id] },
    { k: 'kill', i: 'a', t: 'ash-wolf', l: 6, h: 2e5, x: 1, y: 1, by: [] },
    { k: 'kill', i: 'a', t: 'ash-wolf', l: 6, h: 40, x: 1, y: 1, by: [], xp: 9 },
    { k: 'bite', to: a.id, d: 5, ty: 'fire' }, { k: 'bite', to: b.id, d: 0, ty: 'fire' }, { k: 'bite', to: b.id, d: 5, ty: 'holy' },
    { k: 'shot', x: 1, y: 1, vx: 1, vy: 1, s: 'laser', l: 1 }, { k: 'burst', x: 1, y: 1, r: 0, t: 1 }, { k: 'dance' },
  ]) await ok(snap('ember-isle', [], { ev: [bad] }), 400);
  await ok(snap('ember-isle', [], { ev: [{ k: 'kill', i: 'a', t: 'ash-wolf', l: 6, h: 40, x: 1, y: 1, by: [b.id], xp: 1.25, e: { r: 'champion', o: 'leader', a: ['extra-fast'] }, key: 'w:3,4' }] }));
  await ok({ ...snap('ember-isle'), seq: -1 }, 400);
  await ok({ ...snap('ember-isle'), kf: 'yes' }, 400);
  await ok({ ...snap('ember-isle'), extra: 1 }, 400);
  // Past the byte cap: 413, before anything is parsed.
  tick(1000);
  const big = JSON.stringify(snap('ember-isle', [wolf('a1', { k: 'x'.repeat(COOP.maxBytes) })]));
  assert.equal((await raw('/coop/snap', big, a.token)).status, 413);
  // Claims: one to COOP.maxHits, whole damage, a known element.
  const claim = async (hits, code) => { tick(1000); assert.equal((await post('/coop/hits', { area: 'ember-isle', hits }, b.token)).status, code, JSON.stringify(hits).slice(0, 120)); };
  await claim([], 400);
  await claim(Array.from({ length: COOP.maxHits + 1 }, () => ({ i: 'a', d: 1, el: 'fire' })), 400);
  await claim([{ i: 'a', d: 0, el: 'fire' }], 400);
  await claim([{ i: 'a', d: 2.5, el: 'fire' }], 400);
  await claim([{ i: 'a', d: 2, el: 'holy' }], 400);
  await claim([{ i: 'a', d: 2, el: 'fire', s: '<b>' }], 400);
  await claim([{ i: 'a', d: 2, el: 'fire', extra: 1 }], 400);
  await claim([{ i: 'a', d: 2, el: 'cold', c: false, s: 'frost-nova' }], 200);
  // The pure validators agree.
  assert.deepEqual(coopMob({ i: 'z', x: 10.04 }), { i: 'z', x: 10 });
  assert.deepEqual(coopHit({ i: 'z', d: 3, el: 'arcane', c: false }), { i: 'z', d: 3, el: 'arcane' });
  assert.throws(() => coopEvent({ k: 'bite', to: 'x', d: 1, ty: 'fire' }, ['y'], 'y'));
});

test('protocol 5: snapshots, claims and the party\'s co-op traffic are rate limited', async t => {
  const { join, move, form, post, tick } = await room(t);
  const ks = [];
  for (const n of ['Arin', 'Mira', 'Oskar', 'Wren']) ks.push(await join(n));
  for (const k of ks) await move(k, 'ember-isle');
  await form(ks);
  const [a, b, c, d] = ks;
  tick(1000);
  const snaps = [];
  for (let i = 0; i < COOP.snapsPerSec + 2; i++) snaps.push((await post('/coop/snap', snap('ember-isle'), a.token)).status);
  assert.equal(snaps.filter(s => s === 200).length, COOP.snapsPerSec);
  assert.equal(snaps.at(-1), 429);
  tick(1000);
  const hits = [];
  for (let i = 0; i < COOP.hitsPerSec + 2; i++) hits.push((await post('/coop/hits', { area: 'ember-isle', hits: [{ i: 'a', d: 1, el: 'fire' }] }, b.token)).status);
  assert.equal(hits.filter(s => s === 200).length, COOP.hitsPerSec);
  // The party's whole co-op traffic: three members claiming as fast as each may still stop at COOP.partyPerSec.
  tick(1000);
  let okCount = 0;
  for (let i = 0; i < COOP.hitsPerSec; i++) for (const k of [b, c, d]) if ((await post('/coop/hits', { area: 'ember-isle', hits: [{ i: 'a', d: 1, el: 'fire' }] }, k.token)).status === 200) okCount++;
  for (let i = 0; i < COOP.snapsPerSec; i++) if ((await post('/coop/snap', snap('ember-isle'), a.token)).status === 200) okCount++;
  assert.equal(okCount, COOP.partyPerSec);
});

test('protocol 5: a v3 client is never elected, never relayed to, and the v3 verbs work exactly as before', async t => {
  const { join, move, form, stream, post } = await room(t);
  const old = await join('Oldtimer', { party: true }), a = await join('Arin');
  for (const k of [old, a]) await move(k, 'ember-isle');
  await form([old, a]);    // the v3 client leads and joined first
  const so = await stream(old), sa = await stream(a);
  // Arin (v4) hosts alone: the v3 leader is not part of any election.
  assert.deepEqual((await sa.coop()).areas['ember-isle'], { host: a.id, term: 1, members: [a.id] });
  assert.equal(await so.next('coop', 100), null);
  assert.equal((await post('/coop/snap', snap('ember-isle'), old.token)).status, 409);
  assert.equal((await post('/coop/hits', { area: 'ember-isle', hits: [{ i: 'a', d: 1, el: 'fire' }] }, old.token)).status, 409);
  // A bite naming the v3 member is refused only if it is not a party member; it is one, but it never receives it.
  assert.equal((await post('/coop/snap', snap('ember-isle', [wolf()]), a.token)).status, 200);
  assert.equal(await so.next('coop-snap', 200), null);
  // Party kills (protocol 3) still relay both ways.
  assert.equal((await post('/party/kill', { creature: 'ash-wolf', level: 6, hp: 40, area: 'ember-isle' }, a.token)).status, 201);
  assert.equal((await so.next('party-kill')).kill.from, a.id);
  // A session without parties at all cannot say coop on its own.
  const lone = await join('Lone', { coop: true });
  await move(lone, 'ember-isle');
  assert.equal((await post('/coop/hits', { area: 'ember-isle', hits: [{ i: 'a', d: 1, el: 'fire' }] }, lone.token)).status, 409);
});

test('protocol 5: a reopened stream learns the election; leaving the party tells the leaver there is no host', async t => {
  const { join, move, form, stream, post } = await room(t);
  const a = await join('Arin'), b = await join('Mira'), c = await join('Oskar');
  for (const k of [a, b, c]) await move(k, 'ember-isle');
  await form([a, b, c]);
  const sb = await stream(b);
  assert.equal((await sb.coop()).areas['ember-isle'].host, a.id);
  const again = await stream(b);
  assert.equal((await again.coop()).areas['ember-isle'].host, a.id);
  await post('/party/leave', {}, b.token);
  assert.deepEqual((await again.coop()).areas, {});
});

test('protocol 5: companions — each owner\'s list reaches the party\'s others in its area, any role; validated; rate limited', async t => {
  const { join, move, form, stream, post, tick } = await room(t);
  const a = await join('Arin'), b = await join('Mira'), c = await join('Oskar'), x = await join('Stranger');
  for (const k of [a, b, c, x]) await move(k, 'ember-isle');
  await move(c, 'ember-mine-1');
  await form([a, b, c]);
  const [sa, sb, sc, sx] = [await stream(a), await stream(b), await stream(c), await stream(x)];
  const pals = [{ i: 'p', k: 'pet', t: 'spirit-beast', x: 10, y: 12, f: -1, a: true }, { i: 'k1', k: 'skel', x: 4, y: 4, f: 1, h: 30, m: 40 }, { i: 'g', k: 'glim', x: 1, y: -40 }];
  // A member's companions reach the host (and a host's would reach members): the owner is the authority, any role.
  assert.equal((await post('/coop/pals', { area: 'ember-isle', pals }, b.token)).status, 200);
  const got = await sa.next('coop-pals');
  assert.equal(got.from, b.id);
  assert.deepEqual(got.pals, [{ i: 'p', k: 'pet', t: 'spirit-beast', x: 10, y: 12, f: -1, a: true }, { i: 'k1', k: 'skel', x: 4, y: 4, f: 1, m: 40, h: 30 }, { i: 'g', k: 'glim', x: 1, y: -40 }]);
  assert.equal(await sc.next('coop-pals', 200), null, 'another floor');
  assert.equal(await sx.next('coop-pals', 200), null, 'not in the party');
  assert.equal(await sb.next('coop-pals', 200), null, 'not echoed');
  for (const bad of [[{ i: 'p', k: 'dragon', x: 1, y: 1 }], [{ i: 'P', k: 'pet', x: 1, y: 1 }], [{ i: 'p', k: 'pet', x: 2e6, y: 1 }], [{ i: 'p', k: 'pet', t: '<b>', x: 1, y: 1 }],
    [{ i: 'k', k: 'skel', x: 1, y: 1, h: 50, m: 40 }], [{ i: 'p', k: 'pet', x: 1, y: 1, evil: 1 }], Array.from({ length: COOP.maxPals + 1 }, (_, n) => ({ i: `w${n}`, k: 'wisp', x: 1, y: 1 }))]) {
    tick(1000);
    assert.equal((await post('/coop/pals', { area: 'ember-isle', pals: bad }, a.token)).status, 400, JSON.stringify(bad).slice(0, 80));
  }
  tick(1000);
  const codes = [];
  for (let i = 0; i < COOP.palsPerSec + 1; i++) codes.push((await post('/coop/pals', { area: 'ember-isle', pals: [] }, a.token)).status);
  assert.equal(codes.filter(s => s === 200).length, COOP.palsPerSec);
  assert.equal(codes.at(-1), 429);
  // Not where the room last saw you: refused.
  tick(1000);
  assert.equal((await post('/coop/pals', { area: 'ember-mine-1', pals: [] }, a.token)).status, 409);
});

test('protocol 5: presence carries the cosmetic companions (pet and Glim) to everyone; junk is refused', async t => {
  const { join, post, stream, tick } = await room(t);
  const a = await join('Arin', {}), b = await join('Mira', {});
  const sb = await stream(b);
  const body = { x: 5, y: 5, facing: 1, animation: 'idle', zone: 'ember-isle', area: 'ember-isle' };
  assert.equal((await post('/update', { ...body, pals: 'pet:moss-hedgehog:-12:4,glim::-16:-44' }, a.token)).status, 200);
  for (;;) { const e = await sb.next('players'); const me = e?.players.find(p => p.id === a.id); if (!e || me?.pals) { assert.equal(me.pals, 'pet:moss-hedgehog:-12:4,glim::-16:-44'); break; } }
  for (const bad of ['<b>', 'x'.repeat(97), 5]) { tick(1000); assert.equal((await post('/update', { ...body, pals: bad }, a.token)).status, 400, String(bad)); }
});
