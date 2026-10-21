import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { clean, nameIsRude } from './social-words.mjs';
import { fakeVerifier, firebaseVerifier, firestoreStore, memoryStore } from './social-identity.mjs';

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
//
// Protocol 4 (2026-10-21, the social graph; docs/design/online.md Phase 3): a signed-in Keeper sends its Firebase ID
// token on /join (`Authorization: Firebase <token>`); the room verifies it (social-identity.mjs), binds the session to
// the uid, refuses a banned account, and shows everyone else as a guest (`guest: true` on the player). Signed-in
// Keepers keep friends (users/{uid}/social/friends, written by the room only) and blocks; anyone may whisper, block,
// mute (client-side) and report; privacy (appear offline, friends-only invites) travels on join and /privacy; every
// relayed line passes a profanity mask (social-words.mjs). Older clients send no token and are guests; nothing else
// they do changes.
export const PROTOCOL = 4;
export const FRIENDS_MAX = 200;
export const BLOCKS_MAX = 100;
/** How long a friend request stands (ms). */
export const REQUEST_MS = 5 * 60000;
/** How often a signed-in session's ban is looked up again (ms): a GM ban reaches the room within this. */
export const BAN_RECHECK_MS = 10 * 60000;
export const REPORT_REASONS = new Set(['spam', 'abuse', 'cheating', 'name', 'other']);
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

/**
 * `verify`: (idToken) => Promise<{uid, anonymous}> (null: nobody is signed in, every Keeper is a guest — the room
 * before its project is configured). `store`: bans, friends, blocks and reports (social-identity.mjs).
 */
export function createSocialServer({ origins = ['http://127.0.0.1:4317', 'http://localhost:4317', 'http://127.0.0.1:4183', 'http://localhost:4183'], maxClients = 32, idleMs = 45000, publishMs = 100, now = Date.now, verify = null, store = memoryStore(), log = () => {} } = {}) {
  const sessions = new Map();
  const messages = [];
  /** Friend requests by id (in memory; they lapse): from/to uids, the sender's name and player id. */
  const requests = new Map();
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
  /** `viewer` blocked `other` (by account when the other is signed in, else by this session). */
  const blocks = (viewer, other) => !!viewer.blocks && (other.uid ? viewer.blocks.ids.includes(other.uid) : viewer.blocks.ids.includes(`p:${other.player.id}`));
  /** Everyone, or (with `from`) everyone who has not blocked `from`. */
  const broadcast = (value, from = null) => { for (const s of sessions.values()) if (s.stream && !(from && blocks(s, from))) send(s.stream, value); };
  /** The room's list as `viewer` sees it: the Keepers it blocked are not in it. */
  const messagesFor = viewer => (viewer.blocks?.ids.length ? messages.filter(m => { const o = sessionOf(m.playerId); return !(o && blocks(viewer, o)); }) : messages);
  const playersFor = viewer => { const all = [...sessions.values()]; return all.filter(o => !blocks(viewer, o)).map(o => o.player); };
  const publishPlayers = () => {
    clearTimeout(publishTimer); publishTimer = undefined;
    const all = players();
    for (const s of sessions.values()) if (s.stream) send(s.stream, { type: 'players', players: s.blocks?.ids.length ? playersFor(s) : all });
  };
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
  const sessionOfUid = uid => { for (const s of sessions.values()) if (s.uid === uid) return s; return null; };
  /** A signed-in session's friends as it sees them: online (unless they appear offline), their area and player id. */
  const friendsView = s => (s.friends?.ids ?? []).map(uid => {
    const o = sessionOfUid(uid), on = !!o && !o.privacy.offline;
    return { uid, name: s.friends.names[uid] ?? 'Keeper', online: on, ...(on ? { area: String(o.player.area ?? o.player.zone ?? ''), player: o.player.id } : {}) };
  });
  const pushFriends = s => { if (s.uid && s.stream) send(s.stream, { type: 'friends', friends: friendsView(s) }); };
  /** Everyone who counts `uid` a friend hears its status again (joined, left, moved area, privacy). */
  const friendsHear = uid => { if (uid) for (const s of sessions.values()) if (s.friends?.ids.includes(uid)) pushFriends(s); };
  const blocksView = s => (s.blocks?.ids ?? []).map(key => ({ key, name: s.blocks.names[key] ?? 'Keeper' }));
  const remove = token => {
    const s = sessions.get(token);
    if (!s) return;
    if (s.party) dropMember(s, 'left');
    for (const [id, inv] of invites) if (inv.from === s.player.id || inv.to === s.player.id) invites.delete(id);
    for (const [id, r] of requests) if (r.fromPlayer === s.player.id) requests.delete(id);
    sessions.delete(token);
    s.stream?.end();
    publishPlayers();
    friendsHear(s.uid);
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
      // Protocol 4: a Keeper who blocked this one, or takes invites from friends only, is not asked (the same words
      // either way, so a block is never revealed).
      if (blocks(them, session) || (them.privacy.invites === 'friends' && !(session.uid && them.friends?.ids.includes(session.uid)))) throw fail(403, 'That Keeper is not taking invites.');
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
      const message = { id: randomUUID(), playerId: me, name: session.player.name, text: clean(line), at: now() };
      mine.messages.push(message);
      if (mine.messages.length > 30) mine.messages.shift();
      for (const id of mine.members) { const m = sessionOf(id); if (m?.stream && !blocks(m, session)) send(m.stream, { type: 'party-chat', message }); }
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
  const privacyOf = raw => ({
    offline: !!raw && typeof raw === 'object' && raw.offline === true,
    invites: !!raw && typeof raw === 'object' && raw.invites === 'friends' ? 'friends' : 'everyone',
  });
  const signedIn = session => { if (!session.uid) throw fail(403, 'Sign in to keep friends.'); };
  const requestView = r => ({ id: r.id, name: r.fromName, from: r.fromPlayer, until: r.until });
  /**
   * Protocol 4, the social verbs. Friends need both Keepers signed in; whispers, blocks and reports do not. Rate
   * limits per session: friend verbs 6 in 30 s, whispers 5 in 10 s, blocks 10 in 60 s, reports 3 in 10 minutes.
   */
  const socialRequest = async (path, session, data, reply) => {
    const me = session.player.id;
    if (path === '/friend/request') {
      signedIn(session);
      consume(session, 'friend', 6, 30000);
      const them = typeof data.to === 'string' ? sessionOf(data.to) : null;
      if (!them || them === session) throw fail(400, 'That Keeper is not here.');
      if (!them.uid) throw fail(409, 'That Keeper plays as a guest.');
      if (session.friends.ids.includes(them.uid)) throw fail(409, 'Already friends.');
      if (session.friends.ids.length >= FRIENDS_MAX) throw fail(409, 'Your friends list is full.');
      for (const [id, r] of requests) if (r.until <= now()) requests.delete(id);
      if ([...requests.values()].some(r => r.from === session.uid && r.to === them.uid)) throw fail(409, 'Already asked.');
      const r = { id: randomUUID(), from: session.uid, fromName: session.player.name, fromPlayer: me, to: them.uid, until: now() + REQUEST_MS };
      // A Keeper who blocked this one never hears the request; the sender is told it went (a block is never revealed).
      if (!blocks(them, session)) { requests.set(r.id, r); if (them.stream) send(them.stream, { type: 'friend-request', request: requestView(r) }); }
      reply(201, { ok: true }); return;
    }
    if (path === '/friend/accept' || path === '/friend/decline') {
      signedIn(session);
      consume(session, 'friend', 6, 30000);
      const r = typeof data.request === 'string' ? requests.get(data.request) : undefined;
      if (!r || r.to !== session.uid) throw fail(404, 'That request is gone.');
      requests.delete(r.id);
      if (r.until <= now()) throw fail(410, 'That request lapsed.');
      if (path === '/friend/decline') { reply(200, { ok: true }); return; }
      if (session.friends.ids.length >= FRIENDS_MAX) throw fail(409, 'Your friends list is full.');
      try { await store.addFriends(session.uid, session.player.name, r.from, r.fromName); } catch (e) { log('friends write failed', e); throw fail(503, 'Could not save that. Try again.'); }
      const add = (s, uid, name) => { if (s && !s.friends.ids.includes(uid)) s.friends.ids.push(uid); if (s) s.friends.names[uid] = name; };
      const them = sessionOfUid(r.from);
      add(session, r.from, r.fromName); add(them, session.uid, session.player.name);
      pushFriends(session); if (them) { pushFriends(them); if (them.stream) send(them.stream, { type: 'social-note', note: { kind: 'friend-added', name: session.player.name } }); }
      reply(200, { ok: true }); return;
    }
    if (path === '/friend/remove') {
      signedIn(session);
      consume(session, 'friend', 6, 30000);
      if (typeof data.uid !== 'string' || !session.friends.ids.includes(data.uid)) throw fail(400, 'Not on your list.');
      try { await store.removeFriends(session.uid, data.uid); } catch (e) { log('friends write failed', e); throw fail(503, 'Could not save that. Try again.'); }
      const drop = (s, uid) => { if (!s) return; s.friends.ids = s.friends.ids.filter(x => x !== uid); delete s.friends.names[uid]; };
      const them = sessionOfUid(data.uid);
      drop(session, data.uid); drop(them, session.uid);
      pushFriends(session); if (them) pushFriends(them);
      reply(200, { ok: true }); return;
    }
    if (path === '/whisper') {
      consume(session, 'whisper', 5, 10000);
      const them = typeof data.to === 'string' ? sessionOf(data.to) : null;
      if (!them || them === session) throw fail(400, 'That Keeper is not here.');
      const line = typeof data.text === 'string' ? data.text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
      if (!line || line.length > 240) throw fail(400, 'Messages must be 1–240 characters.');
      const whisper = { id: randomUUID(), from: me, name: session.player.name, to: them.player.id, toName: them.player.name, text: clean(line), at: now() };
      // Sent back to the whisperer always; to a Keeper who blocked them, never (and nothing says so).
      if (session.stream) send(session.stream, { type: 'whisper', whisper });
      if (them.stream && !blocks(them, session)) send(them.stream, { type: 'whisper', whisper });
      reply(201, { whisper }); return;
    }
    if (path === '/block' || path === '/unblock') {
      consume(session, 'block', 10, 60000);
      session.blocks ??= { ids: [], names: {} };
      if (path === '/block') {
        const them = typeof data.player === 'string' ? sessionOf(data.player) : null;
        if (!them || them === session) throw fail(400, 'That Keeper is not here.');
        const key = them.uid ?? `p:${them.player.id}`;
        if (!session.blocks.ids.includes(key)) {
          if (session.blocks.ids.length >= BLOCKS_MAX) throw fail(409, 'Your block list is full.');
          session.blocks.ids.push(key);
        }
        session.blocks.names[key] = them.player.name;
        // Whatever the blocked one had asked of this Keeper goes.
        for (const [id, inv] of invites) if (inv.from === them.player.id && inv.to === me) invites.delete(id);
        for (const [id, r] of requests) if (r.fromPlayer === them.player.id && r.to === session.uid) requests.delete(id);
      } else {
        if (typeof data.key !== 'string' || !session.blocks.ids.includes(data.key)) throw fail(400, 'Not on your list.');
        session.blocks.ids = session.blocks.ids.filter(k => k !== data.key); delete session.blocks.names[data.key];
      }
      // Kept for a signed-in Keeper (account blocks only; a guest's block lasts the session).
      if (session.uid) {
        const kept = session.blocks.ids.filter(k => !k.startsWith('p:'));
        try { await store.saveBlocks(session.uid, { ids: kept, names: Object.fromEntries(kept.map(k => [k, session.blocks.names[k]])) }); } catch (e) { log('blocks write failed', e); }
      }
      if (session.stream) { send(session.stream, { type: 'blocks', blocks: blocksView(session) }); send(session.stream, { type: 'players', players: playersFor(session) }); }
      reply(200, { ok: true }); return;
    }
    if (path === '/report') {
      consume(session, 'report', 3, 10 * 60000);
      const them = typeof data.player === 'string' ? sessionOf(data.player) : null;
      if (!them || them === session) throw fail(400, 'That Keeper is not here.');
      if (!REPORT_REASONS.has(data.reason)) throw fail(400, 'Pick a reason.');
      const note = typeof data.note === 'string' ? data.note.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200) : '';
      // The reported Keeper's own last public lines, as the room heard them (raw, unmasked: the owner judges).
      const lines = (them.said ?? []).slice(-10);
      const doc = {
        at: now(), status: 'open', reason: data.reason, note,
        from: { uid: session.uid ?? null, name: session.player.name, guest: !session.uid },
        about: { uid: them.uid ?? null, name: them.player.name, guest: !them.uid, area: String(them.player.area ?? them.player.zone ?? '') },
        lines,
      };
      let id;
      try { id = await store.report(doc); } catch (e) { log('report write failed', e); throw fail(503, 'Could not file the report. Try again.'); }
      reply(201, { ok: true, id }); return;
    }
    if (path === '/privacy') {
      consume(session, 'privacy', 6, 30000);
      session.privacy = privacyOf(data);
      friendsHear(session.uid);
      reply(200, { privacy: session.privacy }); return;
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
        const raw = typeof data.name === 'string' ? data.name.trim().replace(/\s+/g, ' ') : '';
        if (!/^[\p{L}\p{N} _'-]{2,20}$/u.test(raw)) throw fail(400, 'Use a name of 2–20 letters, numbers, spaces, or simple punctuation.');
        // A rude name is not refused (the always-on client would retry it for ever): it is simply not shown.
        const name = nameIsRude(raw) ? 'Keeper' : raw;
        const profile = presenceFields(data);
        // Protocol 4: who this is. No token, or a room with no project configured: a guest.
        const idToken = /^Firebase ([A-Za-z0-9._-]{10,4096})$/.exec(req.headers.authorization ?? '')?.[1];
        let uid = null;
        if (idToken && verify) {
          let who;
          try { who = await verify(idToken); } catch (e) { throw fail(401, e?.status === 401 ? 'Sign in again.' : 'Could not check your sign-in.'); }
          if (!who.anonymous) uid = who.uid;
        }
        if (uid) {
          let barred = false;
          try { barred = await store.banned(uid); } catch (e) { log('ban lookup failed', e); }
          if (barred) throw fail(403, 'This account is barred from the hearth.');
        }
        // One account, one Keeper in the room: a second join replaces the first.
        const twin = uid ? [...sessions.entries()].find(([, s]) => s.uid === uid) : null;
        if (twin) { if (twin[1].stream) send(twin[1].stream, { type: 'replaced' }); remove(twin[0]); }
        if (sessions.size >= maxClients) throw fail(503, 'The hearth is full. Try again shortly.');
        let friends = { ids: [], names: {} }, blocked = { ids: [], names: {} };
        if (uid) {
          try { [friends, blocked] = await Promise.all([store.friends(uid), store.blocks(uid)]); } catch (e) { log('social read failed', e); }
        }
        const token = randomBytes(32).toString('hex');
        const player = { id: randomUUID(), name, x: 160, y: 610, facing: 1, animation: 'idle', zone: 'Basalt Seamworks', ...profile, guest: !uid };
        // Protocol 3: only a client that says it knows parties can be invited to one (a v2 client never is).
        const session = { player, lastSeen: now(), stream: null, party: null, parties: data.party === true, uid, friends, blocks: blocked, privacy: privacyOf(data.privacy), checkedAt: now(), said: [] };
        sessions.set(token, session);
        reply(201, { id: player.id, token, players: playersFor(session), messages: messagesFor(session), protocol: PROTOCOL, guest: !uid });
        publishPlayers();
        friendsHear(uid); return;
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
        send(res, { type: 'snapshot', players: playersFor(session), messages: messagesFor(session) });
        // Protocol 4: the friends list, the block list, and requests still standing.
        if (session.uid) {
          pushFriends(session);
          for (const r of requests.values()) if (r.to === session.uid && r.until > now()) send(res, { type: 'friend-request', request: requestView(r) });
        }
        if (session.blocks.ids.length) send(res, { type: 'blocks', blocks: blocksView(session) });
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
        const wasArea = session.player.area ?? session.player.zone;
        Object.assign(session.player, { x: Math.round(data.x * 10) / 10, y: Math.round(data.y * 10) / 10, facing: data.facing, animation: data.animation, zone: data.zone }, extra);
        schedulePublish();
        if ((session.player.area ?? session.player.zone) !== wasArea) friendsHear(session.uid);
        reply(200, { ok: true }); return;
      }
      if (url.pathname === '/chat') {
        consume(session, 'chat', 5, 10000);
        const text = typeof data.text === 'string' ? data.text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
        if (!text || text.length > 240) throw fail(400, 'Messages must be 1–240 characters.');
        const message = { id: randomUUID(), playerId: session.player.id, name: session.player.name, text: clean(text), at: now() };
        messages.push(message);
        if (messages.length > 50) messages.shift();
        // What this Keeper said, raw, for a report about them (the last ten).
        session.said.push({ text, at: message.at }); if (session.said.length > 10) session.said.shift();
        broadcast({ type: 'chat', message }, session); reply(201, { message }); return;
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
        broadcast({ type: 'emote', emote }, session); reply(201, { emote }); return;
      }
      if (/^\/(friend\/(request|accept|decline|remove)|whisper|block|unblock|report|privacy)$/.test(url.pathname)) { await socialRequest(url.pathname, session, data, reply); return; }
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
    for (const [id, r] of requests) if (r.until <= now()) requests.delete(id);
    // A GM ban reaches a Keeper already in the room within BAN_RECHECK_MS.
    for (const [token, session] of sessions) {
      if (!session.uid || now() - session.checkedAt < BAN_RECHECK_MS) continue;
      session.checkedAt = now();
      store.banned(session.uid).then(barred => {
        if (!barred || sessions.get(token) !== session) return;
        if (session.stream) send(session.stream, { type: 'banned' });
        remove(token);
      }, e => log('ban recheck failed', e));
    }
  }, Math.min(10000, idleMs));
  cleanup.unref();
  const dispose = () => { clearInterval(cleanup); clearTimeout(publishTimer); for (const token of sessions.keys()) remove(token); server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); };
  return { server, dispose };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.SOCIAL_HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
  const port = Number(process.env.PORT || process.env.SOCIAL_PORT || 4320);
  const origins = process.env.SOCIAL_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean);
  // Identity (protocol 4): SOCIAL_FIREBASE_PROJECT turns on ID-token checks and Firestore (bans, friends, blocks,
  // reports) through the service account. Without it every Keeper is a guest. SOCIAL_FAKE_AUTH=1 is the local e2e's
  // stand-in (tokens `fake.<uid>`, an in-memory store; refused on Cloud Run).
  const project = process.env.SOCIAL_FIREBASE_PROJECT;
  const fake = process.env.SOCIAL_FAKE_AUTH === '1';
  const identity = fake ? { verify: fakeVerifier(), store: memoryStore() }
    : project ? { verify: firebaseVerifier({ projectId: project }), store: firestoreStore({ projectId: project }) }
    : { verify: null, store: memoryStore() };
  const log = (what, e) => console.error(`[hearth] ${what}: ${e?.message ?? e}`);
  const room = createSocialServer({ ...(origins ? { origins } : {}), ...identity, log });
  room.server.listen(port, host, () => console.log(`Eclipse Realms social room: http://${host}:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void room.dispose(); });
}
