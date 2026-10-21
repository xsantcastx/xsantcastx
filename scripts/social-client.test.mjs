import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/app/play/social/social-room.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { SocialRoom } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(t) {
  const requests = [], streams = [], timers = [];
  let state;
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => { const timer = { callback, delay }; timers.push(timer); return timer; });
  t.mock.method(globalThis, 'clearTimeout', timer => { if (timer) timer.cancelled = true; });
  const previousLocation = globalThis.location;
  globalThis.location = { hostname: 'localhost', protocol: 'http:' };
  t.after(() => { if (previousLocation) globalThis.location = previousLocation; else delete globalThis.location; });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/join')) return Response.json({ token: 'secret', id: 'keeper', players: [], messages: [] });
    if (url.endsWith('/events')) {
      const body = new ReadableStream({ start(controller) { streams.push(controller); options.signal.addEventListener('abort', () => { try { controller.close(); } catch {} }); } });
      return new Response(body);
    }
    return Response.json({ ok: true });
  });
  const room = new SocialRoom(value => { state = value; });
  t.after(() => room.leave());
  return { room, requests, streams, timers, state: () => state };
}

test('stream reconnect preserves identity/token and update heartbeat', async t => {
  const x = setup(t);
  await x.room.join('Arin'); await flush();
  x.streams[0].close(); await flush();
  assert.equal(x.state().id, 'keeper');
  assert.equal(x.state().connected, false);
  assert.equal(x.timers[0].delay, 1000);
  t.mock.method(performance, 'now', () => 5000);
  x.room.update(160, 610, 'Basalt Seamworks'); await flush();
  assert.equal(x.requests.filter(r => r.url.endsWith('/update')).length, 1);
  assert.deepEqual(JSON.parse(x.requests.find(r => r.url.endsWith('/update')).options.body), { x: 160, y: 610, zone: 'Basalt Seamworks', facing: 1, animation: 'idle' });
  x.timers[0].callback(); await flush();
  assert.equal(x.state().connected, true);
  assert.equal(x.requests.filter(r => r.url.endsWith('/join')).length, 1);
  assert.equal(x.requests.filter(r => r.url.endsWith('/leave')).length, 0);
  const events = x.requests.filter(r => r.url.endsWith('/events'));
  assert.equal(events[1].options.headers.Authorization, 'Bearer secret');
});

test('leave cancels reconnect and stale callbacks cannot reopen a room', async t => {
  const x = setup(t);
  await x.room.join('Arin'); await flush();
  x.streams[0].close(); await flush();
  x.room.leave();
  assert.equal(x.timers[0].cancelled, true);
  x.timers[0].callback(); await flush();
  assert.equal(x.requests.filter(r => r.url.endsWith('/events')).length, 1);
  assert.equal(x.state().id, '');
});

test('five bounded retries then leaves without a ghost session', async t => {
  const x = setup(t);
  await x.room.join('Arin'); await flush();
  for (let attempt = 0; attempt < 6; attempt++) {
    x.streams[attempt].close(); await flush();
    if (attempt < 5) { x.timers[attempt].callback(); await flush(); }
  }
  assert.deepEqual(x.timers.map(timer => timer.delay), [1000, 2000, 4000, 8000, 8000]);
  assert.equal(x.state().id, '');
  assert.match(x.state().status, /Join again/);
  assert.equal(x.requests.filter(r => r.url.endsWith('/leave')).length, 1);
});

test('routine long-lived stream timeouts reset retry backoff', async t => {
  const x = setup(t);
  let clock = 0;
  t.mock.method(performance, 'now', () => clock);
  await x.room.join('Arin'); await flush();
  for (let attempt = 0; attempt < 7; attempt++) {
    clock += 60000;
    x.streams[attempt].close(); await flush();
    assert.equal(x.timers[attempt].delay, 1000);
    x.timers[attempt].callback(); await flush();
  }
  assert.equal(x.state().id, 'keeper');
  assert.equal(x.state().connected, true);
  assert.equal(x.requests.filter(r => r.url.endsWith('/join')).length, 1);
});

test('position updates carry facing and animation, and unknown poses stay idle', async t => {
  const x = setup(t);
  let clock = 0;
  t.mock.method(performance, 'now', () => clock);
  await x.room.join('Arin'); await flush();
  clock = 1000;
  x.room.update(240, 500, 'Ember Quarry', -1, 'jump'); await flush();
  clock = 1300;
  x.room.update(260, 610, 'Ember Quarry', 1, 'dance'); await flush();
  const bodies = x.requests.filter(r => r.url.endsWith('/update')).map(r => JSON.parse(r.options.body));
  assert.deepEqual(bodies, [
    { x: 240, y: 500, zone: 'Ember Quarry', facing: -1, animation: 'jump' },
    { x: 260, y: 610, zone: 'Ember Quarry', facing: 1, animation: 'idle' },
  ]);
});

test('expired session ends immediately without stream retries', async t => {
  const x = setup(t);
  const previousFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', (url, options) => url.endsWith('/events')
    ? Promise.resolve(new Response(null, { status: 401 })) : previousFetch(url, options));
  await x.room.join('Arin'); await flush();
  assert.equal(x.state().id, '');
  assert.match(x.state().status, /expired/);
  assert.equal(x.timers.length, 0);
  assert.equal(x.requests.filter(r => r.url.endsWith('/leave')).length, 1);
});

// Always-on (owner 2026-10-21): the room keeps itself joined; protocol 2 presence and the Wave.
function setupOn(t, { join = () => Response.json({ token: 'secret', id: 'keeper', players: [], messages: [], protocol: 2 }), events } = {}) {
  const requests = [], streams = [], timers = [];
  let state, clock = 0;
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => { const timer = { callback, delay }; timers.push(timer); return timer; });
  t.mock.method(globalThis, 'clearTimeout', timer => { if (timer) timer.cancelled = true; });
  const transport = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/join')) return join();
    if (url.endsWith('/events')) {
      if (events) { const r = events(); if (r) return r; }
      const body = new ReadableStream({ start(controller) { streams.push(controller); options.signal.addEventListener('abort', () => { try { controller.close(); } catch {} }); } });
      return new Response(body);
    }
    return Response.json({ ok: true });
  };
  const room = new SocialRoom(value => { state = value; }, { keepAlive: true, endpoint: 'http://room', fetch: transport, now: () => clock });
  t.after(() => room.leave());
  return { room, requests, streams, timers, state: () => state, tick: ms => { clock += ms; }, count: path => requests.filter(r => r.url.endsWith(path)).length };
}

test('always-on: join carries the profile; a failed join retries with growing backoff', async t => {
  let fail = 2;
  const x = setupOn(t, { join: () => (fail-- > 0 ? new Response('{}', { status: 503 }) : Response.json({ token: 'secret', id: 'keeper', players: [], messages: [], protocol: 2 })) });
  await x.room.join('Arin', { vocation: 'warlock', look: '1.0.2', level: 7 }); await flush();
  // Protocol 3: the client says it knows parties; protocol 4: its privacy (an older room ignores both).
  assert.deepEqual(JSON.parse(x.requests[0].options.body), { name: 'Arin', vocation: 'warlock', look: '1.0.2', level: 7, party: true, privacy: { offline: false, invites: 'everyone' } });
  assert.equal(x.timers.at(-1).delay, 2000);
  x.timers.at(-1).callback(); await flush();
  assert.equal(x.timers.at(-1).delay, 4000);
  x.timers.at(-1).callback(); await flush();
  assert.equal(x.state().connected, true);
  assert.equal(x.count('/join'), 3);
});

test('always-on: an expired session (401) joins afresh instead of giving up', async t => {
  let expired = true;
  const x = setupOn(t, { events: () => (expired ? (expired = false, new Response(null, { status: 401 })) : null) });
  await x.room.join('Arin'); await flush();
  assert.equal(x.state().connected, false);
  assert.equal(x.timers.at(-1).delay, 2000);
  x.timers.at(-1).callback(); await flush();
  assert.equal(x.count('/join'), 2);
  assert.equal(x.state().connected, true);
});

test('always-on: after five stream retries the room is joined again, not left', async t => {
  const x = setupOn(t);
  await x.room.join('Arin'); await flush();
  for (let attempt = 0; attempt < 6; attempt++) {
    x.streams[attempt].close(); await flush();
    if (attempt < 5) { x.timers.at(-1).callback(); await flush(); }
  }
  assert.equal(x.room.wants, true);
  assert.equal(x.timers.at(-1).delay, 2000);
  x.timers.at(-1).callback(); await flush();
  assert.equal(x.count('/join'), 2);
  assert.equal(x.state().connected, true);
});

test('pause closes the stream and sends nothing; resume reopens the same session', async t => {
  const x = setupOn(t);
  await x.room.join('Arin'); await flush();
  x.room.pause(); await flush();
  assert.equal(x.state().connected, false);
  x.tick(20000);
  x.room.update(1, 2, 'ember-isle'); await flush();
  assert.equal(x.count('/update'), 0);
  assert.equal(x.count('/leave'), 0);
  x.room.resume(); await flush();
  assert.equal(x.state().connected, true);
  assert.equal(x.count('/join'), 1);
  assert.equal(x.requests.filter(r => r.url.endsWith('/events')).at(-1).options.headers.Authorization, 'Bearer secret');
});

test('presence throttle: ≤1 update per 250ms moving, a heartbeat every 10s standing still', async t => {
  const x = setupOn(t);
  await x.room.join('Arin', { vocation: 'ashguard', level: 3 }); await flush();
  const at = (px) => { x.room.update(px, 5, 'ember-isle', 1, 'run', { area: 'ember-isle', dir: 'side', moving: true }); return flush(); };
  await at(10); x.tick(100); await at(11); x.tick(100); await at(12);
  assert.equal(x.count('/update'), 1);
  x.tick(60); await at(13);
  assert.equal(x.count('/update'), 2);
  const body = JSON.parse(x.requests.filter(r => r.url.endsWith('/update')).at(-1).options.body);
  assert.deepEqual(body, { x: 13, y: 5, zone: 'ember-isle', facing: 1, animation: 'run', area: 'ember-isle', dir: 'side', moving: true, vocation: 'ashguard', level: 3 });
  // Standing still: the same body is not resent until the heartbeat is due.
  for (let i = 0; i < 30; i++) { x.tick(300); await at(13); }
  assert.equal(x.count('/update'), 2);
  x.tick(1000); await at(13);
  assert.equal(x.count('/update'), 3);
});

test('a Wave travels only on a protocol-2 room; leave stops the always-on room for good', async t => {
  const x = setupOn(t, { join: () => Response.json({ token: 'secret', id: 'keeper', players: [], messages: [] }) });
  await x.room.join('Arin'); await flush();
  assert.equal(await x.room.wave('mira'), false);
  assert.equal(x.count('/emote'), 0);
  x.room.leave();
  const timers = x.timers.length;
  await flush();
  assert.equal(x.timers.length, timers);
  assert.equal(x.room.wants, false);
});
