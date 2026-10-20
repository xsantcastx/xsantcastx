import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Social presence only. Combat, inventory, and rewards remain local to each game.
export function createSocialServer({ origins = ['http://127.0.0.1:4317', 'http://localhost:4317', 'http://127.0.0.1:4183', 'http://localhost:4183'], maxClients = 32, idleMs = 45000, now = Date.now } = {}) {
  const sessions = new Map();
  const messages = [];
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
  const publishPlayers = () => broadcast({ type: 'players', players: players() });
  const remove = token => {
    const s = sessions.get(token);
    if (!s) return;
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
      if (req.method === 'GET' && url.pathname === '/health') { reply(200, { ok: true, players: sessions.size }); return; }
      if (req.method === 'POST' && url.pathname === '/join') {
        const ip = req.socket.remoteAddress;
        const limiter = joinAttempts.get(ip) ?? {};
        joinAttempts.set(ip, limiter);
        consume(limiter, 'join', 20, 60000);
        const data = await readBody(req);
        const name = typeof data.name === 'string' ? data.name.trim().replace(/\s+/g, ' ') : '';
        if (!/^[\p{L}\p{N} _'-]{2,20}$/u.test(name)) throw fail(400, 'Use a name of 2–20 letters, numbers, spaces, or simple punctuation.');
        if (sessions.size >= maxClients) throw fail(503, 'The hearth is full. Try again shortly.');
        const token = randomBytes(32).toString('hex');
        const player = { id: randomUUID(), name, x: 160, y: 610, facing: 1, animation: 'idle', zone: 'Basalt Seamworks' };
        sessions.set(token, { player, lastSeen: now(), stream: null });
        reply(201, { id: player.id, token, players: players(), messages });
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
        if (!Number.isFinite(data.x) || Math.abs(data.x) > 1e6 || !Number.isFinite(data.y) || Math.abs(data.y) > 1e6 || ![-1, 1].includes(data.facing) || !animations.has(data.animation) || !zoneOk) throw fail(400, 'Invalid position.');
        Object.assign(session.player, { x: data.x, y: data.y, facing: data.facing, animation: data.animation, zone: data.zone });
        publishPlayers(); reply(200, { ok: true }); return;
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
  }, Math.min(10000, idleMs));
  cleanup.unref();
  const dispose = () => { clearInterval(cleanup); for (const token of sessions.keys()) remove(token); server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); };
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
