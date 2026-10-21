import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSocialServer } from './social-server.mjs';

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
  assert.equal(health.protocol, 2);
  const a = await (await post('/join', { name: 'Arin', vocation: 'warlock', look: '1.0.2.1.2.0.0.0.0.4', level: 7 })).json();
  assert.equal(a.protocol, 2);
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
