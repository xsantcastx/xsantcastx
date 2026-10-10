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
  assert.equal((await post('/update', { x: 9999, y: 610, facing: 1, animation: 'idle', zone: 'Basalt Seamworks' }, token)).status, 400);
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
