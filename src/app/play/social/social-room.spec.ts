import { HEARTBEAT_MS, MOVE_MS, SOCIAL_PROTOCOL, SocialRoom, cleanPresence, hearthEndpoint, roomName, type RoomSnapshot } from './social-room';

/** A fake room server: records requests, hands out event streams the spec can end, answers join as told. */
function fakeRoom(join: () => Response = () => Response.json({ token: 'secret', id: 'keeper', players: [], messages: [], protocol: 2 })) {
  const requests: { url: string; body: unknown }[] = [];
  const streams: ReadableStreamDefaultController<Uint8Array>[] = [];
  const transport = async (url: string, init?: RequestInit): Promise<Response> => {
    requests.push({ url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
    if (url.endsWith('/join')) return join();
    if (url.endsWith('/events')) {
      const body = new ReadableStream<Uint8Array>({ start(c) { streams.push(c); init?.signal?.addEventListener('abort', () => { try { c.close(); } catch { /* closed */ } }); } });
      return new Response(body);
    }
    return Response.json({ ok: true });
  };
  return { requests, streams, transport, count: (path: string) => requests.filter(r => r.url.endsWith(path)).length };
}
/** Let fetches, stream reads and their promise chains settle (a few real tasks: jasmine's clock mocks only timers). */
const task = () => new Promise<void>(resolve => { const ch = new MessageChannel(); ch.port1.onmessage = () => resolve(); ch.port2.postMessage(0); });
async function settle(): Promise<void> { for (let i = 0; i < 6; i++) { await task(); for (let j = 0; j < 10; j++) await Promise.resolve(); } }

describe('SocialRoom (the Hearth room client)', () => {
  let clock = 0;
  let state: RoomSnapshot | undefined;
  beforeEach(() => { jasmine.clock().install(); clock = 0; state = undefined; });
  afterEach(() => jasmine.clock().uninstall());
  const room = (fake: ReturnType<typeof fakeRoom>, keepAlive = true) =>
    new SocialRoom(s => { state = s; }, { keepAlive, endpoint: 'http://room', fetch: fake.transport, now: () => clock });

  it('throttles presence: one update per 250ms while moving, one heartbeat per 10s standing still', async () => {
    const fake = fakeRoom(), r = room(fake);
    await r.join('Arin', { vocation: 'warlock', level: 4 }); await settle();
    const move = async (x: number) => { r.update(x, 10, 'ember-isle', 1, 'run', { area: 'ember-isle', dir: 'down', moving: true }); await settle(); };
    await move(1); clock += MOVE_MS / 2; await move(2); clock += MOVE_MS / 2 - 1; await move(3);
    expect(fake.count('/update')).toBe(1);
    clock += 1; await move(4);
    expect(fake.count('/update')).toBe(2);
    expect(fake.requests.filter(q => q.url.endsWith('/update')).pop()!.body).toEqual(
      { x: 4, y: 10, zone: 'ember-isle', facing: 1, animation: 'run', area: 'ember-isle', dir: 'down', moving: true, vocation: 'warlock', level: 4 });
    for (let i = 0; i < 20; i++) { clock += 400; await move(4); }
    expect(fake.count('/update')).toBe(2);
    clock += HEARTBEAT_MS; await move(4);
    expect(fake.count('/update')).toBe(3);
    r.leave();
  });

  it('reconnects a dropped stream with the same session and backoff 1s, 2s, 4s…', async () => {
    const fake = fakeRoom(), r = room(fake);
    await r.join('Arin'); await settle();
    expect(state!.connected).toBeTrue();
    fake.streams[0].close(); await settle();
    expect(state!.connected).toBeFalse();
    jasmine.clock().tick(999); await settle();
    expect(fake.count('/events')).toBe(1);
    jasmine.clock().tick(1); await settle();
    expect(fake.count('/events')).toBe(2);
    expect(state!.connected).toBeTrue();
    fake.streams[1].close(); await settle();
    jasmine.clock().tick(1999); await settle();
    expect(fake.count('/events')).toBe(2);
    jasmine.clock().tick(1); await settle();
    expect(fake.count('/events')).toBe(3);
    expect(fake.count('/join')).toBe(1);
    r.leave();
  });

  it('always on: a room that is down is tried again 2s, 4s, 8s later until it answers', async () => {
    let down = 3;
    const fake = fakeRoom(() => (down-- > 0 ? new Response('{}', { status: 503 }) : Response.json({ token: 't', id: 'k', players: [], messages: [], protocol: 2 })));
    const r = room(fake);
    await r.join('Arin'); await settle();
    for (const wait of [2000, 4000, 8000]) { jasmine.clock().tick(wait); await settle(); }
    expect(fake.count('/join')).toBe(4);
    expect(state!.connected).toBeTrue();
    r.leave();
  });

  it('pauses out of sight (nothing sent) and resumes the same session in sight', async () => {
    const fake = fakeRoom(), r = room(fake);
    await r.join('Arin'); await settle();
    r.pause(); await settle();
    clock += 60000;
    r.update(1, 1, 'ember-isle'); await settle();
    expect(fake.count('/update')).toBe(0);
    expect(fake.count('/leave')).toBe(0);
    r.resume(); await settle();
    expect(state!.connected).toBeTrue();
    expect(fake.count('/join')).toBe(1);
    r.leave(); await settle();
    expect(fake.count('/leave')).toBe(1);
    expect(r.wants).toBeFalse();
  });

  it('cleans what it sends: names, presence fields, the local endpoint', () => {
    expect(roomName('Ash.ley <b>')).toBe('Ashley b');
    expect(roomName('x')).toBe('Keeper');
    expect(cleanPresence({ area: 'Ember Isle!', dir: 'left' as 'side', vocation: 'Warlock', look: '1.2.3', level: 5000 }))
      .toEqual({ area: 'ember-isle', look: '1.2.3', level: 999 });
    expect(hearthEndpoint({ hostname: 'localhost', protocol: 'http:' }, '4777')).toBe('http://localhost:4777');
    expect(hearthEndpoint({ hostname: 'localhost', protocol: 'http:' }, 'evil.example')).toBe('http://localhost:4320');
    expect(hearthEndpoint({ hostname: 'xsantcastx.com', protocol: 'https:' }, '4777')).toMatch(/^https:\/\/eclipse-hearth/);
  });

  it('protocol 3: says it knows parties on join; party, invite, party lines, kills and notes arrive; verbs post', async () => {
    const fake = fakeRoom(() => Response.json({ token: 'secret', id: 'me', players: [], messages: [], protocol: 3 }));
    const kills: unknown[] = [], notes: unknown[] = [];
    const r = new SocialRoom(s => { state = s; }, { keepAlive: true, endpoint: 'http://room', fetch: fake.transport, now: () => clock, onPartyKill: k => kills.push(k), onPartyNote: n => notes.push(n) });
    await r.join('Arin'); await settle();
    expect(fake.requests[0].body).toEqual(jasmine.objectContaining({ name: 'Arin', party: true }));
    expect(r.canParty).toBeTrue();
    const push = async (value: unknown) => { fake.streams[0].enqueue(new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`)); await settle(); };
    await push({ type: 'invite', invite: { id: 'i1', from: 'ally', name: 'Mira', to: 'me', until: 99 } });
    expect(state!.invites!.map(i => i.id)).toEqual(['i1']);
    expect(await r.answer('i1', true)).toBe('');
    expect(fake.requests.pop()).toEqual({ url: 'http://room/party/accept', body: { invite: 'i1' } });
    expect(state!.invites).toEqual([]);
    await push({ type: 'party', party: { id: 'p', leader: 'ally', members: ['ally', 'me'] } });
    expect(state!.party).toEqual({ id: 'p', leader: 'ally', members: ['ally', 'me'] });
    await push({ type: 'party-chat', message: { id: 'm1', playerId: 'ally', name: 'Mira', text: 'hi', at: 1 } });
    expect(state!.partyMessages!.map(m => m.text)).toEqual(['hi']);
    await push({ type: 'party-kill', kill: { id: 'k', from: 'ally', creature: 'rivet-maw', level: 4, hp: 60, area: 'ember-isle', x: 1, y: 2, at: 3 } });
    await push({ type: 'party-note', note: { kind: 'joined', name: 'Oskar', id: 'o' } });
    expect(kills.length).toBe(1); expect(notes.length).toBe(1);
    r.partyKill({ creature: 'rivet-maw', level: 4, hp: 60, area: 'ember-isle' }); await settle();
    expect(fake.requests.pop()).toEqual({ url: 'http://room/party/kill', body: { creature: 'rivet-maw', level: 4, hp: 60, area: 'ember-isle' } });
    expect(await r.partyChat('on my way')).toBeTrue();
    expect(fake.requests.pop()!.url).toBe('http://room/party/chat');
    await push({ type: 'party', party: null });
    expect(state!.party).toBeNull();
    expect(state!.partyMessages).toEqual([]);
    r.leave();
  });

  it('protocol 3 against a v2 room: no party verbs leave the device', async () => {
    const fake = fakeRoom(), r = room(fake);
    await r.join('Arin'); await settle();
    expect(r.canParty).toBeFalse();
    expect(await r.invite('ally')).toBe('offline');
    r.partyKill({ creature: 'rivet-maw', level: 4, hp: 60, area: 'ember-isle' }); await settle();
    expect(fake.requests.some(q => q.url.includes('/party/'))).toBeFalse();
    // Life still travels in presence (a v2 room ignores it), cleaned: both or neither, whole, never above the most.
    expect(cleanPresence({ hp: 130.4, maxHp: 120 })).toEqual({ hp: 120, maxHp: 120 });
    expect(cleanPresence({ hp: 10 })).toEqual({});
    r.leave();
  });

  it('protocol 4: a signed-in join sends the ID token; a refused token joins as a guest; a ban stops the loop', async () => {
    const auths: (string | null)[] = [];
    let mode: 'ok' | 'refuse' | 'ban' = 'ok';
    const fake = fakeRoom(() => Response.json({ token: 'secret', id: 'me', players: [], messages: [], protocol: SOCIAL_PROTOCOL, guest: false }));
    const transport = async (url: string, init?: RequestInit) => {
      if (url.endsWith('/join')) {
        const auth = (init?.headers as Record<string, string> | undefined)?.['Authorization'] ?? null;
        auths.push(auth);
        if (mode === 'refuse' && auth) return Response.json({ error: 'Sign in again.' }, { status: 401 });
        if (mode === 'ban') return Response.json({ error: 'This account is barred from the hearth.' }, { status: 403 });
      }
      return fake.transport(url, init);
    };
    const mk = () => new SocialRoom(s => { state = s; }, { keepAlive: true, endpoint: 'http://room', fetch: transport, now: () => clock, idToken: async () => 'id-token-123' });
    let r = mk();
    await r.join('Arin'); await settle();
    expect(auths).toEqual(['Firebase id-token-123']);
    expect(state!.guest).toBeFalse();
    expect(r.canSocial).toBeTrue();
    r.leave();
    mode = 'refuse'; auths.length = 0; r = mk();
    await r.join('Arin'); await settle();
    expect(auths).toEqual(['Firebase id-token-123', null]);
    expect(state!.connected).toBeTrue();
    r.leave();
    mode = 'ban'; auths.length = 0; r = mk();
    await r.join('Arin'); await settle();
    expect(state!.barred).toBeTrue();
    expect(r.wants).toBeFalse();
    jasmine.clock().tick(120000); await settle();
    expect(auths.length).toBe(1);
  });

  it('protocol 4: friends, requests, whispers and blocks arrive; verbs post; "replaced" ends the session without a rejoin', async () => {
    const fake = fakeRoom(() => Response.json({ token: 'secret', id: 'me', players: [], messages: [], protocol: SOCIAL_PROTOCOL, guest: false }));
    const whispers: unknown[] = [];
    const r = new SocialRoom(s => { state = s; }, { keepAlive: true, endpoint: 'http://room', fetch: fake.transport, now: () => clock, onWhisper: w => whispers.push(w) });
    await r.join('Arin'); await settle();
    const push = async (value: unknown) => { fake.streams[0].enqueue(new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`)); await settle(); };
    await push({ type: 'friends', friends: [{ uid: 'u2', name: 'Mira', online: true, area: 'ember-isle', player: 'p2' }] });
    expect(state!.friends!.map(f => f.name)).toEqual(['Mira']);
    await push({ type: 'friend-request', request: { id: 'q1', name: 'Oskar', from: 'p3', until: 9 } });
    expect(state!.friendRequests!.map(q => q.id)).toEqual(['q1']);
    expect(await r.friendAnswer('q1', true)).toBe('');
    expect(fake.requests.pop()).toEqual({ url: 'http://room/friend/accept', body: { request: 'q1' } });
    expect(state!.friendRequests).toEqual([]);
    await push({ type: 'whisper', whisper: { id: 'w1', from: 'p2', name: 'Mira', to: 'me', toName: 'Arin', text: 'psst', at: 1 } });
    expect(whispers.length).toBe(1);
    expect(state!.whispers!.map(w => w.text)).toEqual(['psst']);
    await push({ type: 'blocks', blocks: [{ key: 'u9', name: 'Pest' }] });
    expect(state!.blocks).toEqual([{ key: 'u9', name: 'Pest' }]);
    expect(await r.whisper('p2', 'hello')).toBe('');
    expect(fake.requests.pop()).toEqual({ url: 'http://room/whisper', body: { to: 'p2', text: 'hello' } });
    expect(await r.report('p9', 'spam', 'gold seller')).toBe('');
    expect(fake.requests.pop()).toEqual({ url: 'http://room/report', body: { player: 'p9', reason: 'spam', note: 'gold seller' } });
    r.setPrivacy({ offline: true, invites: 'friends' }); await settle();
    expect(fake.requests.pop()).toEqual({ url: 'http://room/privacy', body: { offline: true, invites: 'friends' } });
    await push({ type: 'replaced' });
    expect(state!.connected).toBeFalse();
    expect(r.wants).toBeFalse();
    const joins = fake.count('/join');
    jasmine.clock().tick(120000); await settle();
    expect(fake.count('/join')).toBe(joins);
  });

  it('protocol 4 against a v3 room: no social verbs leave the device; the Keeper is a guest there', async () => {
    const fake = fakeRoom(() => Response.json({ token: 'secret', id: 'me', players: [], messages: [], protocol: 3 }));
    const r = new SocialRoom(s => { state = s; }, { keepAlive: true, endpoint: 'http://room', fetch: fake.transport, now: () => clock, idToken: async () => 'tok' });
    await r.join('Arin'); await settle();
    expect(r.canSocial).toBeFalse();
    expect(state!.guest).toBeTrue();
    expect(await r.whisper('p2', 'x')).toBe('offline');
    expect(fake.requests.some(q => /\/(whisper|friend|block|report|privacy)/.test(q.url))).toBeFalse();
    r.leave();
  });

  it('protocol 8: names its character on join; offline party members, commits and ground notes arrive; lay, pick, status post', async () => {
    const transport = async (url: string, init?: RequestInit): Promise<Response> => {
      if (url.endsWith('/ground/drop')) { const b = JSON.parse(String(init?.body)); return Response.json({ ground: { id: 'g1', area: b.area, x: b.x, y: b.y, name: b.item.name, rarity: 'rare', def: 'd', until: 9, pending: true } }, { status: 201 }); }
      if (url.endsWith('/ground/pick')) return Response.json({ ok: true, item: 'pg1', ms: 2 });
      if (url.endsWith('/trade/status')) return Response.json({ status: 'done', received: { items: ['t1'], gold: 5 } });
      return fake.transport(url, init);
    };
    const fake = fakeRoom(() => Response.json({ token: 'secret', id: 'me', players: [], messages: [], protocol: 8, guest: false, settles: true }));
    const commits: unknown[] = [], gnotes: unknown[] = [];
    const r = new SocialRoom(s => { state = s; }, { keepAlive: true, endpoint: 'http://room', fetch: transport, now: () => clock, idToken: async () => 'tok', character: () => 'c2', onTradeCommit: c => commits.push(c), onGroundNote: n => gnotes.push(n) });
    await r.join('Arin'); await settle();
    expect(fake.requests[0].body).toEqual(jasmine.objectContaining({ protocol: 8, character: 'c2' }));
    expect(r.canSettle).toBeTrue();
    const push = async (value: unknown) => { fake.streams[0].enqueue(new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`)); await settle(); };
    await push({ type: 'party', party: { id: 'p', leader: 'me', members: ['me'], offline: [{ id: 'r1', name: 'Mira' }, { id: 7, name: 'bad' }] } });
    expect(state!.party).toEqual({ id: 'p', leader: 'me', members: ['me'], offline: [{ id: 'r1', name: 'Mira' }] });
    await push({ type: 'trade-commit', commit: { id: 't', ok: true, received: { items: [], gold: 3 } } });
    await push({ type: 'ground-note', note: { kind: 'escrowed', id: 'g1', name: 'Ash Blade' } });
    await push({ type: 'ground-note', note: { kind: 'stolen', id: 'g1', name: 'x' } });
    expect(commits.length).toBe(1); expect(gnotes.length).toBe(1);
    await push({ type: 'ground', area: 'ember-isle', items: [] });
    const item = { id: 's1', def: 'd', name: 'Ash Blade', type: 'artifact', rarity: 'rare', stats: {} };
    const laid = await r.groundLay({ area: 'ember-isle', x: 4, y: 5, item });
    expect(laid.why).toBe('');
    expect(state!.ground!.items.map(g => [g.id, g.pending])).toEqual([['g1', true]]);
    expect(await r.groundPick('ember-isle', 'g1')).toEqual({ ok: true, item: 'pg1', ms: 2 });
    expect(state!.ground!.items).toEqual([]);
    expect(await r.tradeStatus('t')).toEqual({ status: 'done', received: { items: ['t1'], gold: 5 } });
    expect(await r.tradeConfirm('t', 2, false)).toBe('');
    expect(fake.requests.pop()).toEqual({ url: 'http://room/trade/confirm', body: { trade: 't', rev: 2, done: false, character: 'c2' } });
    r.leave();
  });
});
