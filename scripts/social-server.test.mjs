import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL, createSocialServer } from './social-server.mjs';

const origin = 'http://127.0.0.1:4317';
async function setup(t, options = {}) {
  const room = createSocialServer(options);
  await new Promise(resolve => room.server.listen(0, '127.0.0.1', resolve));
  t.after(() => room.dispose());
  const base = `http://127.0.0.1:${room.server.address().port}`;
  const post = (path, data, token, headers = {}) => fetch(base + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: JSON.stringify(data) });
  const join = async name => (await post('/join', { name })).json();
  return { base, post, join };
}

test('two sessions see movement and chat over SSE; tokens stay private', async t => {
  const { base, post, join } = await setup(t);
  const first = await join('Arin');
  const second = await join('Mira');
  assert.equal(second.players.length, 2);
  assert.equal(second.players[0].token, undefined);
  const abort = new AbortController();
  t.after(() => abort.abort());
  const stream = await fetch(`${base}/events`, { headers: { Origin: origin, Authorization: `Bearer ${first.token}` }, signal: abort.signal });
  const reader = stream.body.getReader();
  let buffer = '';
  const event = async () => {
    while (!buffer.includes('\n\n')) buffer += new TextDecoder().decode((await reader.read()).value);
    const split = buffer.indexOf('\n\n');
    const result = JSON.parse(buffer.slice(6, split));
    buffer = buffer.slice(split + 2);
    return result;
  };
  assert.equal((await event()).type, 'snapshot');
  assert.equal((await post('/update', { x: 420, y: 610, facing: -1, animation: 'run', zone: 'Basalt Seamworks' }, second.token)).status, 200);
  const movement = await event();
  assert.equal(movement.players.find(p => p.id === second.id).x, 420);
  await post('/chat', { text: 'Hello by the forge!' }, second.token);
  const chat = await event();
  assert.equal(chat.type, 'chat');
  assert.equal(chat.message.name, 'Mira');
  assert.equal(chat.message.text, 'Hello by the forge!');
  await post('/leave', {}, second.token);
  assert.equal((await event()).players.length, 1);
  assert.equal((await post('/chat', { text: 'Nope' }, second.token)).status, 401);
  abort.abort();
});

test('rejects unauthorized origins, bad tokens, malformed names/positions and oversized chat', async t => {
  const { post, join } = await setup(t);
  assert.equal((await post('/join', { name: 'Arin' }, null, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post('/join', { name: '<script>' })).status, 400);
  assert.equal((await post('/update', {}, 'wrong')).status, 401);
  const { token } = await join('Arin');
  // The top-down world: far positions and any area name are fine; past the bound, a bad zone or markup is not.
  assert.equal((await post('/update', { x: -1400, y: 2300, facing: 1, animation: 'run', zone: 'The Cinder Steppe' }, token)).status, 200);
  assert.equal((await post('/update', { x: 2e6, y: 610, facing: 1, animation: 'idle', zone: 'Basalt Seamworks' }, token)).status, 400);
  assert.equal((await post('/update', { x: 10, y: 10, facing: 1, animation: 'idle', zone: '<b>x</b>' }, token)).status, 400);
  assert.equal((await post('/update', { x: 10, y: 10, facing: 1, animation: 'idle', zone: '' }, token)).status, 400);
  assert.equal((await post('/chat', { text: 'x'.repeat(241) }, token)).status, 400);
  assert.equal((await post('/chat', { text: 'x'.repeat(3000) }, token)).status, 413);
});

test('caps rooms, chat rate and removes stale sessions', async t => {
  let time = 0;
  const { post, join } = await setup(t, { maxClients: 1, idleMs: 20, now: () => time });
  const { token } = await join('Arin');
  assert.equal((await post('/join', { name: 'Mira' })).status, 503);
  for (let i = 0; i < 5; i++) assert.equal((await post('/chat', { text: 'hello' }, token)).status, 201);
  assert.equal((await post('/chat', { text: 'too fast' }, token)).status, 429);
  time = 100;
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal((await post('/chat', { text: 'expired' }, token)).status, 401);
  assert.equal((await post('/join', { name: 'Mira' })).status, 201);
});


test('same-origin stream works without Origin; query credentials and foreign origins fail', async t => {
  const { base, join } = await setup(t);
  const { token } = await join('Arin');
  assert.equal((await fetch(`${base}/social/events?token=${token}`)).status, 401);
  assert.equal((await fetch(`${base}/social/events`, { headers: { Origin: 'https://evil.example', Authorization: `Bearer ${token}` } })).status, 403);
  const abort = new AbortController();
  t.after(() => abort.abort());
  const response = await fetch(`${base}/social/events`, { headers: { Authorization: `Bearer ${token}` }, signal: abort.signal });
  assert.equal(response.status, 200);
  const first = await response.body.getReader().read();
  assert.match(new TextDecoder().decode(first.value), /"type":"snapshot"/);
  abort.abort();
});

// Protocol 2 (the top-down world): presence carries area, way faced, walking, class, compact look and level; a Wave
// is relayed as an emote. v1 clients keep working unchanged.
async function events(t, base, token) {
  const abort = new AbortController();
  t.after(() => abort.abort());
  const stream = await fetch(`${base}/events`, { headers: { Origin: origin, Authorization: `Bearer ${token}` }, signal: abort.signal });
  const reader = stream.body.getReader();
  let buffer = '';
  return async (type) => {
    for (;;) {
      while (!buffer.includes('\n\n')) buffer += new TextDecoder().decode((await reader.read()).value);
      const split = buffer.indexOf('\n\n');
      const chunk = buffer.slice(0, split); buffer = buffer.slice(split + 2);
      if (!chunk.startsWith('data: ')) continue;
      const value = JSON.parse(chunk.slice(6));
      if (!type || value.type === type) return value;
    }
  };
}

test('protocol 2: presence fields travel on join and update; v1 bodies still work', async t => {
  const { base, post } = await setup(t, { publishMs: 5 });
  const health = await (await fetch(`${base}/health`)).json();
  assert.equal(health.protocol, PROTOCOL);
  const a = await (await post('/join', { name: 'Arin', vocation: 'warlock', look: '1.0.2.1.2.0.0.0.0.4', level: 7 })).json();
  assert.equal(a.protocol, PROTOCOL);
  assert.equal(a.players[0].vocation, 'warlock');
  assert.equal(a.players[0].level, 7);
  const b = await (await post('/join', { name: 'Mira' })).json();
  const next = await events(t, base, b.token);
  await next('snapshot');
  const ok = await post('/update', { x: 300.04, y: 410, facing: -1, animation: 'run', zone: 'ember-isle', area: 'ember-isle', dir: 'down', moving: true, level: 8 }, a.token);
  assert.equal(ok.status, 200);
  const moved = (await next('players')).players.find(p => p.id === a.id);
  assert.deepEqual({ x: moved.x, area: moved.area, dir: moved.dir, moving: moved.moving, level: moved.level, vocation: moved.vocation }, { x: 300, area: 'ember-isle', dir: 'down', moving: true, level: 8, vocation: 'warlock' });
  // A v1 body (no protocol-2 fields) is accepted exactly as before and keeps what was sent earlier.
  assert.equal((await post('/update', { x: 10, y: 20, facing: 1, animation: 'idle', zone: 'Basalt Seamworks' }, b.token)).status, 200);
  const v1 = (await next('players')).players.find(p => p.id === b.id);
  assert.equal(v1.x, 10); assert.equal(v1.area, undefined);
});

test('protocol 2: every new field is validated; markup and junk are refused', async t => {
  // A fresh second per request (a refused update still counts against the update limit).
  let time = 0;
  const { post: send, join } = await setup(t, { now: () => time });
  const post = (...args) => { time += 1000; return send(...args); };
  assert.equal((await post('/join', { name: 'Arin', look: '<img>' })).status, 400);
  assert.equal((await post('/join', { name: 'Arin', level: 0 })).status, 400);
  assert.equal((await post('/join', { name: 'Arin', vocation: 'Warlock!' })).status, 400);
  const { token } = await join('Arin');
  const base = { x: 1, y: 1, facing: 1, animation: 'idle', zone: 'ember-isle' };
  for (const bad of [
    { area: '<b>x</b>' }, { area: 'A'.repeat(41) }, { area: '' }, { area: 5 }, { dir: 'left' }, { moving: 'yes' },
    { vocation: 'x'.repeat(17) }, { vocation: '<s>' }, { look: 'a"b' }, { look: '1'.repeat(49) }, { level: 1000 }, { level: 2.5 }, { level: '9' },
  ]) assert.equal((await post('/update', { ...base, ...bad }, token)).status, 400, JSON.stringify(bad));
  assert.equal((await post('/update', { ...base, area: 'ember-mine-1', dir: 'up', moving: false, vocation: 'ashguard', look: '0.1.3', level: 999 }, token)).status, 200);
});

test('protocol 2: a Wave is relayed to the room; unknown kinds, absent targets and floods are refused', async t => {
  const { base, post, join } = await setup(t);
  const a = await join('Arin');
  const b = await join('Mira');
  const next = await events(t, base, b.token);
  await next('snapshot');
  assert.equal((await post('/emote', { kind: 'wave', to: b.id }, a.token)).status, 201);
  const { emote } = await next('emote');
  assert.deepEqual({ from: emote.from, to: emote.to, kind: emote.kind, name: emote.name }, { from: a.id, to: b.id, kind: 'wave', name: 'Arin' });
  assert.equal((await post('/emote', { kind: 'dance' }, a.token)).status, 400);
  assert.equal((await post('/emote', { kind: 'wave', to: 'nobody' }, a.token)).status, 400);
  // Four a five seconds, refused ones included.
  assert.equal((await post('/emote', { kind: 'wave' }, a.token)).status, 201);
  assert.equal((await post('/emote', { kind: 'wave' }, a.token)).status, 429);
});

test('position updates are rate limited and coalesced into one players list', async t => {
  const { base, post, join } = await setup(t, { publishMs: 60 });
  const a = await join('Arin');
  const b = await join('Mira');
  const seen = [];
  const next = await events(t, base, b.token);
  await next('snapshot');
  const body = x => ({ x, y: 1, facing: 1, animation: 'run', zone: 'ember-isle' });
  const codes = [];
  for (let i = 0; i < 10; i++) codes.push((await post('/update', body(i), a.token)).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 200, 200, 200, 429, 429]);
  seen.push(await next('players'));
  // One list for the burst, carrying the last accepted spot.
  assert.equal(seen[0].players.find(p => p.id === a.id).x, 7);
});

// ── Protocol 3: parties (docs/design/online.md Phase 2) ──
async function party(t, options = {}) {
  let time = 1000;
  const ctx = await setup(t, { publishMs: 5, now: () => time, ...options });
  const joinP = async (name, extra = { party: true }) => (await ctx.post('/join', { name, ...extra })).json();
  const call = async (verb, token, data = {}) => { const r = await ctx.post(`/party/${verb}`, data, token); return { status: r.status, body: await r.json() }; };
  return { ...ctx, joinP, call, tick: ms => { time += ms; } };
}

test('protocol 3: invite, accept, party chat, the frames\' life in presence, and a kill relayed to the others only', async t => {
  const { base, post, joinP, call } = await party(t);
  const a = await joinP('Arin'), b = await joinP('Mira'), c = await joinP('Oskar');
  const nextA = await events(t, base, a.token), nextB = await events(t, base, b.token), nextC = await events(t, base, c.token);
  await nextA('snapshot'); await nextB('snapshot'); await nextC('snapshot');
  const sent = await call('invite', a.token, { to: b.id });
  assert.equal(sent.status, 201);
  const { invite } = await nextB('invite');
  assert.deepEqual({ from: invite.from, name: invite.name, to: invite.to }, { from: a.id, name: 'Arin', to: b.id });
  assert.equal(invite.id, sent.body.invite.id);
  const ok = await call('accept', b.token, { invite: invite.id });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.party.members, [a.id, b.id]);
  assert.equal(ok.body.party.leader, a.id);
  assert.deepEqual((await nextA('party')).party.members, [a.id, b.id]);
  assert.equal((await nextA('party-note')).note.kind, 'joined');
  // The party channel reaches members only.
  assert.equal((await call('chat', b.token, { text: 'Stay close <3' })).status, 201);
  const line = await nextA('party-chat');
  assert.equal(line.message.text, 'Stay close <3');
  assert.equal(line.message.name, 'Mira');
  // Life travels in presence, both or neither, never above the most.
  assert.equal((await post('/update', { x: 5, y: 5, facing: 1, animation: 'idle', zone: 'ember-isle', area: 'ember-isle', hp: 40, maxHp: 120 }, b.token)).status, 200);
  const life = (await nextA('players')).players.find(p => p.id === b.id);
  assert.deepEqual([life.hp, life.maxHp], [40, 120]);
  for (const bad of [{ hp: 10 }, { hp: 130, maxHp: 120 }, { hp: -1, maxHp: 5 }, { hp: 1.5, maxHp: 5 }, { hp: 1, maxHp: 0 }]) {
    assert.equal((await post('/update', { x: 5, y: 5, facing: 1, animation: 'idle', zone: 'ember-isle', ...bad }, a.token)).status, 400, JSON.stringify(bad));
  }
  // A kill: relayed to Mira with Arin's own last spot, never to Oskar outside the party.
  const killed = await call('kill', a.token, { creature: 'rivet-maw', level: 4, hp: 60, xp: 1.2, area: 'ember-isle' });
  assert.equal(killed.status, 201);
  const { kill } = await nextB('party-kill');
  assert.deepEqual({ from: kill.from, creature: kill.creature, level: kill.level, hp: kill.hp, xp: kill.xp, area: kill.area, x: kill.x }, { from: a.id, creature: 'rivet-maw', level: 4, hp: 60, xp: 1.2, area: 'ember-isle', x: 160 });
  await post('/chat', { text: 'public line' }, c.token);
  const first = await nextC();
  assert.notEqual(first.type, 'party-kill');
  assert.notEqual(first.type, 'party-chat');
});

test('protocol 3: four at most; leave hands the lead on; kick is the leader\'s; under two the party disbands', async t => {
  const { base, joinP, call, tick } = await party(t);
  const ks = [];
  for (const name of ['Arin', 'Mira', 'Oskar', 'Wren', 'Tamsin']) ks.push(await joinP(name));
  const [a, b, c, d, e] = ks;
  for (const k of [b, c, d]) {
    const { body } = await call('invite', a.token, { to: k.id });
    assert.equal((await call('accept', k.token, { invite: body.invite.id })).status, 200);
  }
  // The fifth: refused at the invite (full), and an invite made before it filled is refused at the accept.
  assert.equal((await call('invite', a.token, { to: e.id })).status, 409);
  // Only the leader invites; nobody invites a member twice.
  assert.equal((await call('invite', b.token, { to: e.id })).status, 403);
  assert.equal((await call('invite', a.token, { to: b.id })).status, 409);
  // Kick: the leader only, never itself, only a member.
  assert.equal((await call('kick', b.token, { member: c.id })).status, 403);
  assert.equal((await call('kick', a.token, { member: a.id })).status, 400);
  assert.equal((await call('kick', a.token, { member: e.id })).status, 400);
  const nextD = await events(t, base, d.token);
  await nextD('snapshot');
  const partyAtD = await nextD('party');
  assert.equal(partyAtD.party.members.length, 4);
  assert.equal((await call('kick', a.token, { member: d.id })).status, 200);
  assert.equal((await nextD('party')).party, null);
  assert.equal((await nextD('party-note')).note.kind, 'kicked');
  // The leader leaves: the next member leads.
  const nextB = await events(t, base, b.token);
  await nextB('snapshot'); await nextB('party');
  assert.equal((await call('leave', a.token)).status, 200);
  const handed = await nextB('party');
  assert.deepEqual(handed.party.members, [b.id, c.id]);
  assert.equal(handed.party.leader, b.id);
  // Down to one: disbanded for the one left too.
  assert.equal((await call('leave', c.token)).status, 200);
  assert.equal((await nextB('party')).party, null);
  assert.equal((await call('leave', b.token)).status, 409);
  assert.equal((await call('chat', b.token, { text: 'hello?' })).status, 409);
  // A full party refuses an invite accepted after it filled (a fresh half-minute for the invite limit).
  tick(31000);
  const ask = async k => (await call('invite', a.token, { to: k.id })).body.invite.id;
  const [ib, ic, late] = [await ask(b), await ask(c), { body: { invite: { id: await ask(e) } } }];
  assert.equal((await call('accept', b.token, { invite: ib })).status, 200);
  assert.equal((await call('accept', c.token, { invite: ic })).status, 200);
  assert.equal((await call('accept', d.token, { invite: await ask(d) })).status, 200);
  assert.equal((await call('accept', e.token, { invite: late.body.invite.id })).status, 409);
});

test('protocol 3: decline, lapse, leaving the room, and validation of every party verb', async t => {
  const { base, joinP, call, tick, post } = await party(t);
  const a = await joinP('Arin'), b = await joinP('Mira'), old = await joinP('Oldtimer', {});
  const nextA = await events(t, base, a.token);
  await nextA('snapshot');
  // A v2 client (no `party: true`) can neither be invited nor invite.
  assert.equal((await call('invite', a.token, { to: old.id })).status, 409);
  assert.equal((await call('invite', old.token, { to: a.id })).status, 409);
  assert.equal((await call('invite', a.token, { to: a.id })).status, 400);
  assert.equal((await call('invite', a.token, { to: 'nobody' })).status, 400);
  assert.equal((await call('invite', a.token, { to: 5 })).status, 400);
  // Decline: the inviter hears it; the invite is spent (a fresh half-minute for the invite limit).
  tick(31000);
  let inv = (await call('invite', a.token, { to: b.id })).body.invite;
  assert.equal((await call('invite', a.token, { to: b.id })).status, 409);
  assert.equal((await call('decline', b.token, { invite: inv.id })).status, 200);
  assert.equal((await nextA('party-note')).note.kind, 'declined');
  assert.equal((await call('accept', b.token, { invite: inv.id })).status, 404);
  // Lapse: a minute later it is gone.
  inv = (await call('invite', a.token, { to: b.id })).body.invite;
  tick(61000);
  assert.equal((await call('accept', b.token, { invite: inv.id })).status, 410);
  // Someone else's invite is not yours to answer.
  tick(31000);
  inv = (await call('invite', a.token, { to: b.id })).body.invite;
  assert.equal((await call('accept', a.token, { invite: inv.id })).status, 404);
  assert.equal((await call('accept', b.token, { invite: inv.id })).status, 200);
  // Bad kills and bad lines change nothing.
  for (const bad of [{}, { creature: '<b>', level: 1, hp: 1, area: 'x' }, { creature: 'maw', level: 0, hp: 1, area: 'x' }, { creature: 'maw', level: 1, hp: 0, area: 'x' },
    { creature: 'maw', level: 1, hp: 1, area: 'X Y' }, { creature: 'maw', level: 1, hp: 1, area: 'x', xp: 9 }, { creature: 'maw', level: 1, hp: 2e5, area: 'x' }]) {
    tick(400);
    assert.equal((await call('kill', a.token, bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await call('chat', a.token, { text: '' })).status, 400);
  assert.equal((await call('chat', a.token, { text: 'x'.repeat(241) })).status, 400);
  assert.equal((await call('dance', a.token)).status, 404);
  // Leaving the room leaves the party: a party of one is no party.
  const nextB = await events(t, base, b.token);
  await nextB('snapshot'); await nextB('party');
  await post('/leave', {}, a.token);
  assert.equal((await nextB('party')).party, null);
});

test('protocol 3: invites, answers, party lines and kill announcements are rate limited', async t => {
  const { joinP, call } = await party(t);
  const a = await joinP('Arin');
  const others = [];
  for (const n of ['Mira', 'Oskar', 'Wren', 'Tamsin', 'Ivo', 'Nell']) others.push(await joinP(n));
  // Three open invites at most (a party of four), then 429; five invites in thirty seconds, then 429 whatever.
  const codes = [];
  for (const k of others) codes.push((await call('invite', a.token, { to: k.id })).status);
  assert.deepEqual(codes, [201, 201, 201, 429, 429, 429]);
  const b = others[0];
  const inv = (await call('invite', a.token, { to: b.id }));
  assert.equal(inv.status, 429);
  // Into a party by an earlier invite, then flood the channel and the kill relay.
  const c = others[1];
  const c2 = await joinP('Pell');
  const firstInv = (await call('invite', c.token, { to: c2.id })).body.invite;
  assert.equal((await call('accept', c2.token, { invite: firstInv.id })).status, 200);
  const chat = [];
  for (let i = 0; i < 6; i++) chat.push((await call('chat', c.token, { text: 'hi ' + i })).status);
  assert.deepEqual(chat, [201, 201, 201, 201, 201, 429]);
  const kills = [];
  for (let i = 0; i < 21; i++) kills.push((await call('kill', c.token, { creature: 'maw', level: 2, hp: 30, area: 'ember-isle' })).status);
  assert.equal(kills.filter(s => s === 201).length, 20);
  assert.equal(kills[20], 429);
});

// ── Protocol 4: identity, friends, whispers, block, report, privacy, the profanity mask (online.md Phase 3) ──
import { clean, nameIsRude } from './social-words.mjs';
import { firebaseVerifier, firestoreStore, memoryStore } from './social-identity.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as pathJoin } from 'node:path';
import { createSign } from 'node:crypto';

/** A room whose tokens are `tok-<uid>` (anything else is refused) over an in-memory store. */
async function social(t, options = {}) {
  let time = 1000;
  const store = memoryStore();
  const verify = async token => { const m = /^tok-(\w+)-padding$/.exec(token); if (!m) throw Object.assign(new Error('bad'), { status: 401 }); return { uid: m[1], anonymous: m[1].startsWith('anon') }; };
  const ctx = await setup(t, { publishMs: 5, now: () => time, verify, store, ...options });
  const joinAs = async (name, uid = null, extra = {}) => {
    const r = await ctx.post('/join', { name, party: true, ...extra }, null, uid ? { Authorization: `Firebase tok-${uid}-padding` } : {});
    return { status: r.status, ...(await r.json()) };
  };
  const call = async (path, token, data = {}) => { const r = await ctx.post(path, data, token); return { status: r.status, body: await r.json() }; };
  return { ...ctx, store, joinAs, call, tick: ms => { time += ms; } };
}

test('protocol 4: a token binds the uid; no token is a guest; a bad token is refused; a banned account is barred', async t => {
  const { joinAs, store, post, base } = await social(t);
  const a = await joinAs('Arin', 'u1');
  assert.equal(a.status, 201); assert.equal(a.guest, false); assert.equal(a.protocol, PROTOCOL);
  const g = await joinAs('Mira');
  assert.equal(g.guest, true);
  assert.equal(g.players.find(p => p.id === a.id).guest, false);
  assert.equal(g.players.find(p => p.id === g.id).guest, true);
  // The uid never leaves the server.
  assert.equal(JSON.stringify(g).includes('u1'), false);
  assert.equal((await post('/join', { name: 'Oskar' }, null, { Authorization: 'Firebase not-a-good-token' })).status, 401);
  // An anonymous Firebase user is a guest.
  assert.equal((await joinAs('Anon', 'anon7')).guest, true);
  store.bans.add('u9');
  const barred = await joinAs('Wren', 'u9');
  assert.equal(barred.status, 403);
  assert.match(barred.error, /barred/);
  // One account, one Keeper: the second join replaces the first.
  const again = await joinAs('Arin', 'u1');
  assert.equal(again.status, 201);
  assert.equal((await post('/chat', { text: 'old session' }, a.token)).status, 401);
  assert.equal((await (await fetch(`${base}/health`)).json()).players, 3);
});

test('protocol 4: without a verifier (no project configured) every token is ignored and every Keeper a guest', async t => {
  const { post } = await setup(t);
  const r = await (await post('/join', { name: 'Arin' }, null, { Authorization: 'Firebase tok-u1-padding' })).json();
  assert.equal(r.guest, true);
});

test('protocol 4: friends — request, accept (both lists, persisted), online status with area, remove; guests cannot', async t => {
  const { base, joinAs, call, store, post, tick } = await social(t);
  const a = await joinAs('Arin', 'u1'), b = await joinAs('Mira', 'u2'), g = await joinAs('Guest');
  const nextA = await events(t, base, a.token), nextB = await events(t, base, b.token);
  await nextA('snapshot'); await nextB('snapshot');
  assert.deepEqual((await nextA('friends')).friends, []);
  assert.equal((await call('/friend/request', g.token, { to: a.id })).status, 403);
  assert.equal((await call('/friend/request', a.token, { to: g.id })).status, 409);
  assert.equal((await call('/friend/request', a.token, { to: a.id })).status, 400);
  assert.equal((await call('/friend/request', a.token, { to: b.id })).status, 201);
  assert.equal((await call('/friend/request', a.token, { to: b.id })).status, 409);
  const { request } = await nextB('friend-request');
  assert.deepEqual({ name: request.name, from: request.from }, { name: 'Arin', from: a.id });
  assert.equal((await call('/friend/accept', a.token, { request: request.id })).status, 404);
  assert.equal((await call('/friend/accept', b.token, { request: request.id })).status, 200);
  assert.deepEqual((await store.friends('u1')).ids, ['u2']);
  assert.deepEqual((await store.friends('u2')).names, { u1: 'Arin' });
  const fa = (await nextA('friends')).friends;
  assert.deepEqual(fa.map(f => [f.uid, f.name, f.online, f.player]), [['u2', 'Mira', true, b.id]]);
  // Moving to another area tells friends.
  await post('/update', { x: 1, y: 1, facing: 1, animation: 'idle', zone: 'ember-mine-1', area: 'ember-mine-1' }, b.token);
  assert.equal((await nextA('friends')).friends[0].area, 'ember-mine-1');
  // Mira leaves: offline. Back again: online.
  await post('/leave', {}, b.token);
  assert.equal((await nextA('friends')).friends[0].online, false);
  const b2 = await joinAs('Mira', 'u2');
  assert.equal((await nextA('friends')).friends[0].online, true);
  // Remove: both lists, persisted (a fresh half-minute for the friend verbs' limit).
  tick(30001);
  assert.equal((await call('/friend/remove', a.token, { uid: 'nobody' })).status, 400);
  assert.equal((await call('/friend/remove', a.token, { uid: 'u2' })).status, 200);
  assert.deepEqual((await store.friends('u2')).ids, []);
  assert.deepEqual((await nextA('friends')).friends, []);
  assert.ok(b2.token);
});

test('protocol 4: privacy — appear offline hides from friends; friends-only invites refuse strangers', async t => {
  const { base, joinAs, call, store } = await social(t);
  await store.addFriends('u1', 'Arin', 'u2', 'Mira');
  const a = await joinAs('Arin', 'u1'), b = await joinAs('Mira', 'u2', { privacy: { offline: true, invites: 'friends' } }), c = await joinAs('Oskar', 'u3');
  const nextA = await events(t, base, a.token);
  await nextA('snapshot');
  assert.equal((await nextA('friends')).friends[0].online, false);
  assert.equal((await call('/party/invite', c.token, { to: b.id })).status, 403);
  assert.equal((await call('/party/invite', a.token, { to: b.id })).status, 201);
  assert.equal((await call('/privacy', b.token, { offline: false, invites: 'everyone' })).status, 200);
  assert.equal((await nextA('friends')).friends[0].online, true);
  assert.equal((await call('/party/invite', c.token, { to: b.id })).status, 201);
});

test('protocol 4: whispers reach one Keeper (and echo back), masked; flooding is refused', async t => {
  const { base, joinAs, call, tick } = await social(t);
  const a = await joinAs('Arin'), b = await joinAs('Mira'), c = await joinAs('Oskar');
  const nextA = await events(t, base, a.token), nextB = await events(t, base, b.token), nextC = await events(t, base, c.token);
  await nextA('snapshot'); await nextB('snapshot'); await nextC('snapshot');
  assert.equal((await call('/whisper', a.token, { to: b.id, text: 'meet me by the shit forge' })).status, 201);
  const got = (await nextB('whisper')).whisper;
  assert.deepEqual({ from: got.from, name: got.name, to: got.to, toName: got.toName, text: got.text }, { from: a.id, name: 'Arin', to: b.id, toName: 'Mira', text: 'meet me by the s*** forge' });
  assert.equal((await nextA('whisper')).whisper.id, got.id);
  await call('/chat', c.token, { text: 'public' });
  assert.equal((await nextC()).type !== 'whisper', true);
  assert.equal((await call('/whisper', a.token, { to: 'nobody', text: 'x' })).status, 400);
  assert.equal((await call('/whisper', a.token, { to: b.id, text: '' })).status, 400);
  // Five in ten seconds (refused ones count too).
  tick(10001);
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await call('/whisper', a.token, { to: b.id, text: 'hi' })).status);
  assert.deepEqual(codes, [201, 201, 201, 201, 201, 429]);
});

test('protocol 4: block hides their chat, presence, whispers and invites; persisted for an account; unblock restores', async t => {
  const { base, joinAs, call, store, post } = await social(t);
  const a = await joinAs('Arin', 'u1'), b = await joinAs('Mira', 'u2');
  const nextA = await events(t, base, a.token);
  await nextA('snapshot');
  assert.equal((await call('/block', a.token, { player: b.id })).status, 200);
  assert.deepEqual((await nextA('blocks')).blocks, [{ key: 'u2', name: 'Mira' }]);
  assert.equal((await nextA('players')).players.some(p => p.id === b.id), false);
  assert.deepEqual((await store.blocks('u1')).ids, ['u2']);
  // Mira's line, whisper and invite never reach Arin; Mira is not told.
  assert.equal((await call('/whisper', b.token, { to: a.id, text: 'hello?' })).status, 201);
  assert.equal((await call('/party/invite', b.token, { to: a.id })).status, 403);
  assert.equal((await call('/friend/request', b.token, { to: a.id })).status, 201);
  await post('/chat', { text: 'can you hear me' }, b.token);
  await post('/chat', { text: 'only mine' }, a.token);
  const seen = await nextA('chat');
  assert.equal(seen.message.text, 'only mine');
  // A fresh join of the same account keeps the block (from the store).
  const a2 = await joinAs('Arin', 'u1');
  assert.equal(a2.players.some(p => p.id === b.id), false);
  const nextA2 = await events(t, base, a2.token);
  await nextA2('snapshot');
  assert.deepEqual((await nextA2('blocks')).blocks, [{ key: 'u2', name: 'Mira' }]);
  assert.equal((await call('/unblock', a2.token, { key: 'u2' })).status, 200);
  assert.deepEqual((await nextA2('blocks')).blocks, []);
  assert.equal((await nextA2('players')).players.some(p => p.id === b.id), true);
  assert.deepEqual((await store.blocks('u1')).ids, []);
  // A guest's block lasts the session (keyed by the other's session).
  const g = await joinAs('Guesty');
  assert.equal((await call('/block', g.token, { player: b.id })).status, 200);
  assert.equal((await call('/unblock', g.token, { key: 'nope' })).status, 400);
});

test('protocol 4: a report files a document with the reported Keeper\'s own last lines; reasons and floods refused', async t => {
  const { joinAs, call, store, post, tick } = await social(t);
  const a = await joinAs('Arin', 'u1'), b = await joinAs('Mira');
  await post('/chat', { text: 'buy gold at spam dot example' }, b.token);
  assert.equal((await call('/report', a.token, { player: b.id, reason: 'bad' })).status, 400);
  assert.equal((await call('/report', a.token, { player: a.id, reason: 'spam' })).status, 400);
  const ok = await call('/report', a.token, { player: b.id, reason: 'spam', note: 'gold seller' });
  assert.equal(ok.status, 201);
  const r = store.reports[0];
  assert.deepEqual({ reason: r.reason, note: r.note, status: r.status, from: r.from, about: r.about.name, guest: r.about.guest }, { reason: 'spam', note: 'gold seller', status: 'open', from: { uid: 'u1', name: 'Arin', guest: false }, about: 'Mira', guest: true });
  assert.deepEqual(r.lines.map(l => l.text), ['buy gold at spam dot example']);
  // Three in ten minutes (refused ones count too).
  tick(600001);
  for (const reason of ['abuse', 'name', 'other']) assert.equal((await call('/report', a.token, { player: b.id, reason })).status, 201);
  assert.equal((await call('/report', a.token, { player: b.id, reason: 'cheating' })).status, 429);
});

test('protocol 4: the profanity mask on chat and party lines; rude names shown as Keeper; innocent words untouched', async t => {
  const { joinAs, call, post } = await social(t);
  const a = await joinAs('Arin'), b = await joinAs('Big Shit');
  assert.equal(b.players.find(p => p.id === b.id).name, 'Keeper');
  const said = (await (await post('/chat', { text: 'what the FUCK, class assumes Scunthorpe' }, a.token)).json()).message.text;
  assert.equal(said, 'what the F***, class assumes Scunthorpe');
  const inv = (await call('/party/invite', a.token, { to: b.id })).body.invite;
  await call('/party/accept', b.token, { invite: inv.id });
  assert.equal((await call('/party/chat', a.token, { text: 'hijo de puta' })).body.message.text, 'hijo de p***');
  for (const [raw, out] of [['sh1t', 's***'], ['f u c k off', 'f*** off'], ['you ass', 'you a**'], ['as I said', 'as I said'], ['cockatoo, conocer, Dickens', 'cockatoo, conocer, Dickens']]) assert.equal(clean(raw), out, raw);
  assert.equal(nameIsRude('Aster'), false); assert.equal(nameIsRude('Fuuuck'), true);
});

test('protocol 4: firebaseVerifier checks signature, project, issuer, expiry; firestoreStore speaks the REST shapes', async t => {
  let dir;
  try {
    dir = mkdtempSync(pathJoin(tmpdir(), 'hearth-'));
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', pathJoin(dir, 'k.pem'), '-out', pathJoin(dir, 'c.pem'), '-subj', '/CN=test', '-days', '1'], { stdio: 'ignore' });
  } catch { t.skip('openssl is not available'); return; }
  const key = readFileSync(pathJoin(dir, 'k.pem'), 'utf8'), cert = readFileSync(pathJoin(dir, 'c.pem'), 'utf8');
  const nowS = 1_800_000_000;
  const sign = (claims, kid = 'k1') => {
    const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');
    const head = enc({ alg: 'RS256', kid, typ: 'JWT' }), body = enc(claims);
    const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(key).toString('base64url');
    return `${head}.${body}.${sig}`;
  };
  const good = { aud: 'proj', iss: 'https://securetoken.google.com/proj', sub: 'uidA', iat: nowS - 10, exp: nowS + 3000, auth_time: nowS - 100, firebase: { sign_in_provider: 'google.com' } };
  let fetched = 0;
  const v = firebaseVerifier({ projectId: 'proj', now: () => nowS * 1000, fetch: async () => { fetched++; return new Response(JSON.stringify({ k1: cert }), { headers: { 'cache-control': 'public, max-age=3600' } }); } });
  assert.deepEqual(await v(sign(good)), { uid: 'uidA', anonymous: false });
  assert.deepEqual(await v(sign({ ...good, firebase: { sign_in_provider: 'anonymous' } })), { uid: 'uidA', anonymous: true });
  for (const bad of [{ aud: 'other' }, { iss: 'https://evil' }, { exp: nowS - 1 }, { sub: '' }, { iat: nowS + 600 }]) await assert.rejects(v(sign({ ...good, ...bad })), JSON.stringify(bad));
  await assert.rejects(v(sign(good, 'k2')));
  const forged = sign(good).split('.'); forged[1] = Buffer.from(JSON.stringify({ ...good, sub: 'someoneElse' })).toString('base64url');
  await assert.rejects(v(forged.join('.')));
  await assert.rejects(v('garbage'));
  assert.equal(fetched, 1, 'the certificates are cached');

  const calls = [];
  const fs = firestoreStore({ projectId: 'proj', now: () => 0, token: async () => 'sa-token', fetch: async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : null, auth: init.headers?.Authorization });
    if (url.endsWith('/users/u1/meta/ban')) return Response.json({ fields: { banned: { booleanValue: true } } });
    if (url.endsWith('/users/u2/meta/ban')) return new Response('', { status: 404 });
    if (url.endsWith('/users/u1/social/friends')) return Response.json({ fields: { ids: { arrayValue: { values: [{ stringValue: 'u2' }] } }, names: { mapValue: { fields: { u2: { stringValue: 'Mira' } } } } } });
    if (url.endsWith('/player-reports')) return Response.json({ name: 'projects/proj/databases/(default)/documents/player-reports/abc' });
    return Response.json({});
  } });
  assert.equal(await fs.banned('u1'), true);
  assert.equal(await fs.banned('u2'), false);
  assert.deepEqual(await fs.friends('u1'), { ids: ['u2'], names: { u2: 'Mira' } });
  await fs.addFriends('u1', 'Arin', 'u2', 'Mira');
  const commit = calls.at(-1);
  assert.match(commit.url, /documents:commit$/);
  assert.equal(commit.auth, 'Bearer sa-token');
  assert.deepEqual(commit.body.writes.map(w => [w.update.name.split('/documents/')[1], w.updateMask.fieldPaths[0], w.updateTransforms[0].appendMissingElements.values[0].stringValue]),
    [['users/u1/social/friends', 'names.`u2`', 'u2'], ['users/u2/social/friends', 'names.`u1`', 'u1']]);
  await fs.removeFriends('u1', 'u2');
  assert.equal(calls.at(-1).body.writes[0].updateTransforms[0].removeAllFromArray.values[0].stringValue, 'u2');
  assert.equal(calls.at(-1).body.writes[0].update.fields.names, undefined);
  assert.equal(await fs.report({ at: 0, reason: 'spam', status: 'open', from: { uid: null, name: 'A', guest: true }, about: { uid: 'u2', name: 'M', guest: false }, lines: [] }), 'abc');
  assert.equal(calls.at(-1).body.fields.reason.stringValue, 'spam');
  assert.ok(calls.at(-1).body.fields.at.timestampValue);
});

test('protocol 5: a town portal travels in presence (td-waygate encodeGate); anything else in it is refused', async () => {
  const { presenceFields } = await import('./social-server.mjs');
  assert.equal(presenceFields({ gate: 'ember:surface:1200:-40:900:300:290' }).gate, 'ember:surface:1200:-40:900:300:290');
  assert.equal(presenceFields({ gate: '' }).gate, '');
  assert.throws(() => presenceFields({ gate: '<b>' }), /Invalid presence/);
  assert.throws(() => presenceFields({ gate: 7 }), /Invalid presence/);
  assert.equal(presenceFields({}).gate, undefined);
  // Worn looks (shared/keeper-look/worn-looks.ts packWorn): plain ids, '' to take everything off, nothing else.
  assert.equal(presenceFields({ worn: 'hu.sextons-lost-cowl,ceclipse-longblade.4' }).worn, 'hu.sextons-lost-cowl,ceclipse-longblade.4');
  assert.equal(presenceFields({ worn: '' }).worn, '');
  assert.throws(() => presenceFields({ worn: '<img>' }), /Invalid presence/);
  assert.throws(() => presenceFields({ worn: 'h'.repeat(241) }), /Invalid presence/);
  assert.equal(presenceFields({}).worn, undefined);
});

// ── Protocol 6: trading and ground drops (relay only; the trade Function moves things) ──
async function trading(t) {
  const ctx = await social(t);
  const area = { area: 'ember-isle' };
  const a = await ctx.joinAs('Aster', 'u1', { trade: true, ...area });
  const b = await ctx.joinAs('Bryn', 'u2', { trade: true, ...area });
  return { ...ctx, a, b };
}
const sword = { id: 's1', def: 'forge:s1', name: 'Ash Blade', type: 'artifact', rarity: 'rare', stats: { strikePower: 12 }, roll: { strikePower: 0.6 }, ilvl: 9 };

test('protocol 6: ask, accept (the room binds both accounts in trades/{id}), offers clear Accepts, confirm, done', async t => {
  const { a, b, call, store, base } = await trading(t);
  const evA = await events(t, base, a.token), evB = await events(t, base, b.token);
  const ask = await call('/trade/ask', a.token, { to: b.id });
  assert.equal(ask.status, 201);
  assert.equal((await evB('trade-ask')).ask.name, 'Aster');
  const opened = await call('/trade/answer', b.token, { ask: ask.body.ask.id, accept: true });
  assert.equal(opened.status, 200);
  const id = opened.body.trade.id;
  // The binding the Function trusts: both uids, server-side only.
  const bound = store.docs.get(`trades/${id}`);
  assert.deepEqual([bound.a.uid, bound.b.uid, bound.status], ['u1', 'u2', 'open']);
  assert.equal(JSON.stringify((await evA('trade')).trade).includes('u1'), false);
  await evB('trade');
  // Bryn accepts the empty window, then Aster offers: Bryn's Accept is cleared.
  assert.equal((await call('/trade/accept', b.token, { trade: id, rev: 1 })).status, 200);
  await evA('trade');
  assert.equal((await call('/trade/offer', a.token, { trade: id, items: [sword], gold: 25 })).body.rev, 2);
  let view = (await evA('trade')).trade;
  while (view.rev !== 2) view = (await evA('trade')).trade;
  assert.deepEqual(view.accepted, { a: false, b: false });
  assert.deepEqual(view.offers.a, { items: [sword], gold: 25 });
  // A stale Accept is refused; the current one counts; both → the confirm stage.
  assert.equal((await call('/trade/accept', b.token, { trade: id, rev: 1 })).status, 409);
  assert.equal((await call('/trade/confirm', a.token, { trade: id, rev: 2 })).status, 409);
  await call('/trade/accept', a.token, { trade: id, rev: 2 });
  await call('/trade/accept', b.token, { trade: id, rev: 2 });
  for (;;) { view = (await evA('trade')).trade; if (view.stage === 'confirm') break; }
  // After a confirm the offers are frozen.
  await call('/trade/confirm', a.token, { trade: id, rev: 2 });
  assert.equal((await call('/trade/offer', b.token, { trade: id, items: [], gold: 5 })).status, 409);
  assert.equal((await call('/trade/confirm', b.token, { trade: id, rev: 2, done: true })).status, 200);
  assert.equal((await evA('trade-end')).end.outcome, 'done');
  assert.equal((await evB('trade-end')).end.outcome, 'done');
  assert.equal((await call('/trade/accept', a.token, { trade: id, rev: 2 })).status, 404);
});

test('protocol 6: guests, strangers in another place, blocks and malformed offers are refused; walking away cancels', async t => {
  const { a, b, call, joinAs, post, base } = await trading(t);
  const guest = await joinAs('Cora', null, { trade: true, area: 'ember-isle' });
  assert.equal((await call('/trade/ask', guest.token, { to: a.id })).status, 403);
  assert.equal((await call('/trade/ask', a.token, { to: guest.id })).status, 409);
  const far = await joinAs('Dov', 'u4', { trade: true, area: 'drowned-reach' });
  assert.match((await call('/trade/ask', a.token, { to: far.id })).body.error, /same place/);
  const old = await joinAs('Eld', 'u5', { area: 'ember-isle' });
  assert.match((await call('/trade/ask', a.token, { to: old.id })).body.error, /cannot trade/);
  await call('/block', b.token, { player: far.id });
  const ask = await call('/trade/ask', a.token, { to: b.id });
  const id = (await call('/trade/answer', b.token, { ask: ask.body.ask.id, accept: true })).body.trade.id;
  for (const bad of [{ items: [{ ...sword, id: '<script>' }], gold: 0 }, { items: [sword, sword], gold: 0 }, { items: [], gold: -1 }, { items: [{ ...sword, extra: 1 }], gold: 0 }]) {
    assert.equal((await call('/trade/offer', a.token, { trade: id, ...bad })).status, 400);
  }
  const evB = await events(t, base, b.token);
  await post('/update', { x: 1, y: 1, zone: 'Drowned Reach', facing: 1, animation: 'idle', area: 'drowned-reach' }, a.token);
  const end = (await evB('trade-end')).end;
  assert.equal(end.outcome, 'cancelled');
  assert.match(end.why, /walked away/);
});

test('protocol 6: ground items — only what the escrow holds is shown to the area; only a taken one leaves', async t => {
  const { a, b, call, store, base } = await trading(t);
  const evB = await events(t, base, b.token);
  const drop = { id: 'g1', area: 'ember-isle', x: 10, y: 20, name: 'Ash Blade', rarity: 'rare', def: 'forge:s1' };
  // Not in escrow: refused (a phantom cannot be announced).
  assert.equal((await call('/ground/drop', a.token, drop)).status, 409);
  store.docs.set('ground-items/g1', { id: 'g1', area: 'ember-isle', x: 11, y: 21, owner: { uid: 'u1', character: 'c1' }, expiresAt: Date.now() + 60000 });
  // Someone else's escrow: refused too.
  assert.equal((await call('/ground/drop', b.token, drop)).status, 409);
  assert.equal((await call('/ground/drop', a.token, drop)).status, 201);
  let ev = await evB('ground');
  while (!ev.add) ev = await evB('ground');
  assert.deepEqual([ev.add[0].id, ev.add[0].x, ev.add[0].y, ev.add[0].name], ['g1', 11, 21, 'Ash Blade']);
  // Still in escrow: nobody can clear it from everyone's ground.
  assert.equal((await call('/ground/take', b.token, { id: 'g1', area: 'ember-isle' })).status, 409);
  store.docs.delete('ground-items/g1');
  assert.equal((await call('/ground/take', b.token, { id: 'g1', area: 'ember-isle' })).status, 200);
  assert.deepEqual((await evB('ground')).gone, ['g1']);
});
