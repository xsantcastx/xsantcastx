import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Social presence only. Combat, inventory, and rewards remain local to each game.
//
// Protocol 2 (2026-10-21, the top-down world): a Keeper's presence also carries its area id, the way it faces
// (side/down/up), whether it walks, its class, a compact look and its level, all optional and validated below; a
// Wave travels as an `emote` event. Every v1 field and event is unchanged, so a client from before ignores the rest.
//
// Protocol 3 (2026-10-21, parties): presence also carries `hp`/`maxHp` (the party frames' bars), and a Keeper can
// invite another to a party of up to PARTY_MAX, accept or decline, leave, kick (the leader), speak on the party channel
// and announce a kill to the party (each member's own client decides whether to share its XP: docs/design/online.md).
// Parties live here, in memory, like the room. A v2 client never sees a party event and is never invited (it does not
// say `party: true` on join), so nothing it does changes.
export const PROTOCOL = 3;
export const PARTY_MAX = 4;
/** How long an invite stands before it lapses (ms). */
export const INVITE_MS = 60000;
const CREATURE = /^[a-z0-9-]{1,40}$/;
const AREA = /^[a-z0-9_-]{1,40}$/;
const LOOK = /^[a-z0-9.]{1,48}$/;
const VOCATION = /^[a-z]{1,16}$/;
const DIRS = new Set(['side', 'down', 'up']);
const EMOTES = new Set(['wave']);

/**
 * The optional v2 presence fields of a body: each one absent, or valid, or the request is refused (never stored
 * half-checked). Only plain lowercase ids and digits get through, so nothing a client renders can carry markup.
 */
export function presenceFields(data) {
  const out = {};
  const bad = () => { throw Object.assign(new Error('Invalid presence.'), { status: 400 }); };
  if (data.area !== undefined) { if (typeof data.area !== 'string' || !AREA.test(data.area)) bad(); out.area = data.area; }
  if (data.dir !== undefined) { if (!DIRS.has(data.dir)) bad(); out.dir = data.dir; }
  if (data.moving !== undefined) { if (typeof data.moving !== 'boolean') bad(); out.moving = data.moving; }
  if (data.vocation !== undefined) { if (typeof data.vocation !== 'string' || !VOCATION.test(data.vocation)) bad(); out.vocation = data.vocation; }
  if (data.look !== undefined) { if (typeof data.look !== 'string' || !LOOK.test(data.look)) bad(); out.look = data.look; }
  if (data.level !== undefined) { if (!Number.isInteger(data.level) || data.level < 1 || data.level > 999) bad(); out.level = data.level; }
  // Protocol 3: life for the party frames (both or neither; whole numbers; never more than the most).
  if (data.hp !== undefined || data.maxHp !== undefined) {
    if (!Number.isInteger(data.hp) || !Number.isInteger(data.maxHp) || data.maxHp < 1 || data.maxHp > 1e6 || data.hp < 0 || data.hp > data.maxHp) bad();
    out.hp = data.hp; out.maxHp = data.maxHp;
  }
  return out;
}

export function createSocialServer({ origins = ['http://127.0.0.1:4317', 'http://localhost:4317', 'http://127.0.0.1:4183', 'http://localhost:4183'], maxClients = 32, idleMs = 45000, publishMs = 100, now = Date.now } = {}) {
  const sessions = new Map();
  const messages = [];
  /** Parties by id: the leader's player id, the members' (leader first), the last 30 party lines. */
  const parties = new Map();
  /** Open invites by id: from and to (player ids), when it lapses. */
  const invites = new Map();
  const joinAttempts = new Map();
  const allowedOrigins = new Set(origins);
  const animations = new Set(['idle', 'run', 'jump', 'fall', 'attack', 'dodge', 'hurt']);
  const players = () => [...sessions.values()].map(s => s.player);
  const send = (res, value) => {
    if (res.destroyed || res.writableEnded) return;
    if (res.writableLength > 65536) { res.destroy(); return; }
    res.write(`data: ${JSON.stringify(value)}\n\n`);
  };
  const broadcast = value => { for (const s of sessions.values()) if (s.stream) send(s.stream, value); };
  const publishPlayers = () => { clearTimeout(publishTimer); publishTimer = undefined; broadcast({ type: 'players', players: players() }); };
  // Movement is coalesced: at most one players list per `publishMs`, however many Keepers walk (a v1 client gets the
  // same 'players' event it always did, a little less often).
  let publishTimer;
  const schedulePublish = () => {
    if (publishTimer) return;
    publishTimer = setTimeout(publishPlayers, publishMs);
    publishTimer.unref?.();
  };
  const sessionOf = playerId => { for (const s of sessions.values()) if (s.player.id === playerId) return s; return null; };
  const sendTo = (playerId, value) => { const s = sessionOf(playerId); if (s?.stream) send(s.stream, value); };
  const partyView = p => p ? { id: p.id, leader: p.leader, members: [...p.members] } : null;
  /** Tell every member (and anyone just dropped, with `also`) where the party stands now. */
  const publishParty = (p, also = []) => {
    for (const id of p ? p.members : []) sendTo(id, { type: 'party', party: partyView(p) });
    for (const id of also) sendTo(id, { type: 'party', party: null });
  };
  /** A member goes (left, kicked, gone from the room): a new leader if it led; under two, the party is no more. */
  const dropMember = (s, why) => {
    const p = s.party && parties.get(s.party);
    s.party = null;
    if (!p) return;
    p.members = p.members.filter(id => id !== s.player.id);
    for (const [id, inv] of invites) if (inv.from === s.player.id) invites.delete(id);
    if (p.members.length < 2) {
      parties.delete(p.id);
      for (const id of p.members) { const m = sessionOf(id); if (m) m.party = null; }
      for (const [id, inv] of invites) if (inv.party === p.id) invites.delete(id);
      publishParty(null, [...p.members, s.player.id]);
    } else {
      if (p.leader === s.player.id) p.leader = p.members[0];
      publishParty(p, [s.player.id]);
    }
    const note = { kind: why, name: s.player.name, id: s.player.id };
    for (const id of p.members) sendTo(id, { type: 'party-note', note });
    if (why === 'kicked') sendTo(s.player.id, { type: 'party-note', note });
  };
  const remove = token => {
    const s = sessions.get(token);
    if (!s) return;
    if (s.party) dropMember(s, 'left');
    for (const [id, inv] of invites) if (inv.from === s.player.id || inv.to === s.player.id) invites.delete(id);
    sessions.delete(token);
    s.stream?.end();
    publishPlayers();
  };
  const fail = (status, message) => Object.assign(new Error(message), { status });
  const consume = (s, bucket, limit, windowMs) => {
    const t = now();
    if (!s[bucket] || t - s[bucket].start >= windowMs) s[bucket] = { start: t, count: 0 };
    if (++s[bucket].count > limit) throw fail(429, 'Please slow down.');
  };
  const readBody = async req => {
    if (!req.headers['content-type']?.startsWith('application/json')) throw fail(415, 'JSON required.');
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > 2048) throw fail(413, 'Request too large.');
    }
    try {
      const data = JSON.parse(body);
      if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error();
      return data;
    } catch { throw fail(400, 'Invalid JSON.'); }
  };
  const inviteView = inv => ({ id: inv.id, from: inv.from, name: inv.name, to: inv.to, until: inv.until });
  const text = raw => typeof raw === 'string' ? raw.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
  /**
   * Protocol 3, the party verbs. Every one is refused unless both ends said they know parties; every refusal is a 4xx
   * with a plain message and changes nothing. The same per-session buckets as the room (consume): invites 5 in 30 s,
   * answers 10 in 10 s, party lines 5 in 10 s, kill announcements 20 in 5 s.
   */
  const partyRequest = (verb, session, data, reply) => {
    if (!session.parties) throw fail(409, 'Update the game to join parties.');
    const me = session.player.id;
    const mine = session.party ? parties.get(session.party) : null;
    if (verb === 'invite') {
      consume(session, 'invite', 5, 30000);
      if (typeof data.to !== 'string' || data.to === me) throw fail(400, 'Invite another Keeper.');
      const them = sessionOf(data.to);
      if (!them) throw fail(400, 'That Keeper is not here.');
      if (!them.parties) throw fail(409, 'That Keeper cannot join parties yet.');
      if (mine && mine.leader !== me) throw fail(403, 'Only the party leader can invite.');
      if (them.party) throw fail(409, mine && them.party === mine.id ? 'Already in your party.' : 'That Keeper is already in a party.');
      if (mine && mine.members.length >= PARTY_MAX) throw fail(409, 'The party is full.');
      for (const [id, inv] of invites) if (inv.until <= now()) invites.delete(id);
      if ([...invites.values()].some(inv => inv.from === me && inv.to === them.player.id)) throw fail(409, 'Already invited.');
      if ([...invites.values()].filter(inv => inv.from === me).length >= PARTY_MAX - 1) throw fail(429, 'Too many open invites.');
      const inv = { id: randomUUID(), from: me, name: session.player.name, to: them.player.id, party: mine?.id ?? null, until: now() + INVITE_MS };
      invites.set(inv.id, inv);
      sendTo(them.player.id, { type: 'invite', invite: inviteView(inv) });
      reply(201, { invite: inviteView(inv) }); return;
    }
    if (verb === 'accept' || verb === 'decline') {
      consume(session, 'answer', 10, 10000);
      const inv = typeof data.invite === 'string' ? invites.get(data.invite) : undefined;
      if (!inv || inv.to !== me) throw fail(404, 'That invite is gone.');
      invites.delete(inv.id);
      if (inv.until <= now()) throw fail(410, 'That invite lapsed.');
      const host = sessionOf(inv.from);
      if (verb === 'decline') {
        if (host) sendTo(inv.from, { type: 'party-note', note: { kind: 'declined', name: session.player.name, id: me } });
        reply(200, { ok: true }); return;
      }
      if (session.party) throw fail(409, 'Leave your party first.');
      if (!host) throw fail(410, 'That Keeper has gone.');
      let p = host.party ? parties.get(host.party) : null;
      if (p && p.leader !== inv.from) throw fail(410, 'That invite lapsed.');
      if (!p && inv.party) throw fail(410, 'That party is gone.');
      if (p && p.members.length >= PARTY_MAX) throw fail(409, 'The party is full.');
      if (!p) {
        p = { id: randomUUID(), leader: inv.from, members: [inv.from], messages: [] };
        parties.set(p.id, p); host.party = p.id;
      }
      p.members.push(me); session.party = p.id;
      for (const [id, other] of invites) if (other.to === me) invites.delete(id);
      publishParty(p);
      for (const id of p.members) if (id !== me) sendTo(id, { type: 'party-note', note: { kind: 'joined', name: session.player.name, id: me } });
      reply(200, { party: partyView(p) }); return;
    }
    if (verb === 'leave') {
      consume(session, 'answer', 10, 10000);
      if (!mine) throw fail(409, 'You are not in a party.');
      dropMember(session, 'left');
      reply(200, { ok: true }); return;
    }
    if (verb === 'kick') {
      consume(session, 'answer', 10, 10000);
      if (!mine) throw fail(409, 'You are not in a party.');
      if (mine.leader !== me) throw fail(403, 'Only the party leader can do that.');
      if (typeof data.member !== 'string' || data.member === me || !mine.members.includes(data.member)) throw fail(400, 'That Keeper is not in your party.');
      const them = sessionOf(data.member);
      if (!them) throw fail(400, 'That Keeper is not here.');
      dropMember(them, 'kicked');
      reply(200, { ok: true }); return;
    }
    if (verb === 'chat') {
      consume(session, 'pchat', 5, 10000);
      if (!mine) throw fail(409, 'You are not in a party.');
      const line = text(data.text);
      if (!line || line.length > 240) throw fail(400, 'Messages must be 1–240 characters.');
      const message = { id: randomUUID(), playerId: me, name: session.player.name, text: line, at: now() };
      mine.messages.push(message);
      if (mine.messages.length > 30) mine.messages.shift();
      for (const id of mine.members) sendTo(id, { type: 'party-chat', message });
      reply(201, { message }); return;
    }
    if (verb === 'kill') {
      // A creature fell to this member: relayed to the others, never stored, never paid here. Each recipient's own
      // client checks it (same area, close, its level band, its per-minute cap) and pays itself (party-share.ts).
      consume(session, 'kill', 20, 5000);
      if (!mine) throw fail(409, 'You are not in a party.');
      if (typeof data.creature !== 'string' || !CREATURE.test(data.creature)) throw fail(400, 'Invalid kill.');
      if (!Number.isInteger(data.level) || data.level < 1 || data.level > 999) throw fail(400, 'Invalid kill.');
      if (!Number.isInteger(data.hp) || data.hp < 1 || data.hp > 100000) throw fail(400, 'Invalid kill.');
      if (data.xp !== undefined && (typeof data.xp !== 'number' || !Number.isFinite(data.xp) || data.xp <= 0 || data.xp > 5)) throw fail(400, 'Invalid kill.');
      if (typeof data.area !== 'string' || !AREA.test(data.area)) throw fail(400, 'Invalid kill.');
      // Where the killer stood is the room's own record of it (its last presence), not a field the announcement sets.
      const pl = session.player;
      const kill = { id: randomUUID(), from: me, name: pl.name, creature: data.creature, level: data.level, hp: data.hp, ...(data.xp !== undefined ? { xp: Math.round(data.xp * 1000) / 1000 } : {}), area: data.area, x: pl.x, y: pl.y, at: now() };
      for (const id of mine.members) if (id !== me) sendTo(id, { type: 'party-kill', kill });
      reply(201, { kill }); return;
    }
    throw fail(404, 'Not found.');
  };
  const server = createServer(async (req, res) => {
    const reply = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const origin = req.headers.origin;
      if (origin ? !allowedOrigins.has(origin) : req.method !== 'GET') throw fail(403, 'Origin not allowed.');
      if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' });
        res.end(); return;
      }
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/social/')) url.pathname = url.pathname.slice('/social'.length);
      if (req.method === 'GET' && url.pathname === '/health') { reply(200, { ok: true, players: sessions.size, protocol: PROTOCOL }); return; }
      if (req.method === 'POST' && url.pathname === '/join') {
        const ip = req.socket.remoteAddress;
        const limiter = joinAttempts.get(ip) ?? {};
        joinAttempts.set(ip, limiter);
        consume(limiter, 'join', 20, 60000);
        const data = await readBody(req);
        const name = typeof data.name === 'string' ? data.name.trim().replace(/\s+/g, ' ') : '';
        if (!/^[\p{L}\p{N} _'-]{2,20}$/u.test(name)) throw fail(400, 'Use a name of 2–20 letters, numbers, spaces, or simple punctuation.');
        const profile = presenceFields(data);
        if (sessions.size >= maxClients) throw fail(503, 'The hearth is full. Try again shortly.');
        const token = randomBytes(32).toString('hex');
        const player = { id: randomUUID(), name, x: 160, y: 610, facing: 1, animation: 'idle', zone: 'Basalt Seamworks', ...profile };
        // Protocol 3: only a client that says it knows parties can be invited to one (a v2 client never is).
        sessions.set(token, { player, lastSeen: now(), stream: null, party: null, parties: data.party === true });
        reply(201, { id: player.id, token, players: players(), messages, protocol: PROTOCOL });
        publishPlayers(); return;
      }
      const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? '')?.[1];
      const session = sessions.get(token);
      if (!session) throw fail(401, 'Join the hearth again.');
      if (req.method === 'GET' && url.pathname === '/events') {
        consume(session, 'events', 10, 10000);
        session.stream?.end();
        session.stream = res;
        session.lastSeen = now();
        res.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.flushHeaders();
        send(res, { type: 'snapshot', players: players(), messages });
        // A reopened stream learns its party (and its lines) and any invite still standing.
        if (session.parties) {
          const p = session.party && parties.get(session.party);
          if (p) send(res, { type: 'party', party: partyView(p), messages: p.messages });
          for (const inv of invites.values()) if (inv.to === session.player.id && inv.until > now()) send(res, { type: 'invite', invite: inviteView(inv) });
        }
        res.on('close', () => { if (session.stream === res) { session.stream = null; session.lastSeen = now(); } });
        return;
      }
      if (req.method !== 'POST') throw fail(404, 'Not found.');
      consume(session, 'requests', 40, 1000);
      const data = await readBody(req);
      session.lastSeen = now();
      if (url.pathname === '/update') {
        // The top-down world has no edge (owner 2026-10-20): any finite position within a generous bound, and any short
        // area name (a town, a region, a floor) — rendered as text by every client, never as HTML.
        const zoneOk = typeof data.zone === 'string' && data.zone.length >= 1 && data.zone.length <= 60 && !/[<>\u0000-\u001f]/.test(data.zone);
        consume(session, 'update', 8, 1000);
        if (!Number.isFinite(data.x) || Math.abs(data.x) > 1e6 || !Number.isFinite(data.y) || Math.abs(data.y) > 1e6 || ![-1, 1].includes(data.facing) || !animations.has(data.animation) || !zoneOk) throw fail(400, 'Invalid position.');
        const extra = presenceFields(data);
        Object.assign(session.player, { x: Math.round(data.x * 10) / 10, y: Math.round(data.y * 10) / 10, facing: data.facing, animation: data.animation, zone: data.zone }, extra);
        schedulePublish(); reply(200, { ok: true }); return;
      }
      if (url.pathname === '/chat') {
        consume(session, 'chat', 5, 10000);
        const text = typeof data.text === 'string' ? data.text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
        if (!text || text.length > 240) throw fail(400, 'Messages must be 1–240 characters.');
        const message = { id: randomUUID(), playerId: session.player.id, name: session.player.name, text, at: now() };
        messages.push(message);
        if (messages.length > 50) messages.shift();
        broadcast({ type: 'chat', message }); reply(201, { message }); return;
      }
      if (url.pathname === '/emote') {
        // A Wave (protocol 2): from this Keeper, optionally at another one still in the room. Relayed, never stored.
        consume(session, 'emote', 4, 5000);
        if (!EMOTES.has(data.kind)) throw fail(400, 'Unknown emote.');
        let to = null;
        if (data.to !== undefined && data.to !== null) {
          if (typeof data.to !== 'string' || ![...sessions.values()].some(s => s.player.id === data.to)) throw fail(400, 'That Keeper is not here.');
          to = data.to;
        }
        const emote = { id: randomUUID(), from: session.player.id, name: session.player.name, to, kind: data.kind, at: now() };
        broadcast({ type: 'emote', emote }); reply(201, { emote }); return;
      }
      if (url.pathname.startsWith('/party/')) { partyRequest(url.pathname.slice('/party/'.length), session, data, reply); return; }
      if (url.pathname === '/leave') { remove(token); reply(200, { ok: true }); return; }
      throw fail(404, 'Not found.');
    } catch (error) {
      if (!res.headersSent) reply(error.status ?? 500, { error: error.status ? error.message : 'Room unavailable.' });
      else res.end();
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  const cleanup = setInterval(() => {
    for (const [token, session] of sessions) {
      if (now() - session.lastSeen > idleMs) remove(token);
      else if (session.stream) session.stream.write(': heartbeat\n\n');
    }
    for (const [ip, limiter] of joinAttempts) if (now() - limiter.join?.start > 60000) joinAttempts.delete(ip);
    for (const [id, inv] of invites) if (inv.until <= now()) invites.delete(id);
  }, Math.min(10000, idleMs));
  cleanup.unref();
  const dispose = () => { clearInterval(cleanup); clearTimeout(publishTimer); for (const token of sessions.keys()) remove(token); server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); };
  return { server, dispose };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.SOCIAL_HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
  const port = Number(process.env.PORT || process.env.SOCIAL_PORT || 4320);
  const origins = process.env.SOCIAL_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean);
  const room = createSocialServer({ ...(origins ? { origins } : {}) });
  room.server.listen(port, host, () => console.log(`Eclipse Realms social room: http://${host}:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void room.dispose(); });
}
