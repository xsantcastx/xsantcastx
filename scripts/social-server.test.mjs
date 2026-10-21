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
