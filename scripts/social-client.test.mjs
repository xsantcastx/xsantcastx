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
