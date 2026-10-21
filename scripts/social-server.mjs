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
//
// Protocol 5 (2026-10-21, shared creatures): within a party, for each area, one member (the host) simulates the wild
// creatures and streams compact snapshots to the others in that area; members send damage claims back; the host sends
// bites and kills. The room only elects the host, validates and relays (never simulates, never stores a creature). A
// client says `coop: true` on join; an older client never does, so it is never elected, sent or asked anything new.
// See the "Protocol 5" block below and docs/design/online.md §3.4.
//
// Protocol 6 (2026-10-21, trading and shared ground drops; docs/design/online.md §3.8 and §4c): two signed-in Keepers
// in the same area negotiate a trade here (ask, accept, offers, Accept, Confirm). The room only RELAYS: it binds the
// two accounts by writing `trades/{id}` (the parties, from the verified ID tokens) and never moves an item or a coin —
// the trade Function does, in one Firestore transaction, when both Keepers confirm the same terms. Ground drops are
// escrowed by the same Function; the room only tells everyone in the area what lies there (checked against the
// escrow document when the store can read it). A client says `trade: true` on join; an older one never does.
export const PROTOCOL = 6;
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
/** Protocol 5: the cosmetic companions in presence (a pet and Glim as offsets from the Keeper: play/social/coop-pals.ts). */
const PALS = /^[a-z0-9:,-]{0,96}$/;
/** Protocol 5: a town portal in presence (play/td/td-waygate.ts encodeGate: continent:level:x:y:townX:townY:secondsLeft). */
const GATE = /^[a-z0-9:-]{0,96}$/;
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
  // Protocol 5: the pet and Glim beside the Keeper, for everyone's screen (cosmetic; '' when none).
  if (data.pals !== undefined) { if (typeof data.pals !== 'string' || !PALS.test(data.pals)) bad(); out.pals = data.pals; }
  // Protocol 5: the Keeper's town portal, for the party to step through (travel only; '' when none stands).
  if (data.gate !== undefined) { if (typeof data.gate !== 'string' || !GATE.test(data.gate)) bad(); out.gate = data.gate; }
  return out;
}

// ── Protocol 5: shared creatures (co-op) — validators. Pure; every field absent-or-valid, unknown keys refused. ──
/** The room's hard caps for co-op traffic (per message, per session, per party). */
export const COOP = Object.freeze({
  /** Creatures in one snapshot, events in one snapshot, ids in one `gone` list, claims in one batch. */
  maxMobs: 48, maxEvents: 24, maxGone: 64, maxHits: 24,
  /** Bytes in one co-op request body. */
  maxBytes: 8192,
  /** Snapshots a host may send a second; claim batches a member may send a second; all co-op requests of one party a second. */
  snapsPerSec: 12, hitsPerSec: 12, partyPerSec: 40,
  /** Companions (each owner's own, to the party in its area): lists a session may send a second, companions in one list. */
  palsPerSec: 6, maxPals: 16,
  /** A host silent this long while others share its area is replaced (a hidden tab stops simulating). */
  staleMs: 3000,
});
const COOP_ID = /^[a-z0-9]{1,10}$/;
const COOP_KEY = /^[a-z0-9:,~._-]{1,80}$/;
const COOP_AFFIX = /^[a-z-]{1,24}$/;
const COOP_SKILL = /^[a-z0-9-]{1,32}$/;
const COOP_FX = /^[a-z]{1,12}$/;
const COOP_NAME = /^[\p{L}\p{N} '-]{1,40}$/u;
const COOP_SHOTS = new Set(['arrow', 'fire', 'breath', 'ink', 'shard', 'spore']);
const COOP_TYPES = new Set(['physical', 'fire', 'cold', 'lightning', 'arcane']);
const coopBad = () => { throw Object.assign(new Error('Invalid co-op message.'), { status: 400 }); };
const coopKeys = (o, allowed) => { if (!o || typeof o !== 'object' || Array.isArray(o)) coopBad(); for (const k of Object.keys(o)) if (!allowed.includes(k)) coopBad(); };
const coopInt = (v, lo, hi) => { if (!Number.isInteger(v) || v < lo || v > hi) coopBad(); return v; };
const coopNum = (v, bound) => { if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > bound) coopBad(); return Math.round(v * 10) / 10; };
/** An elite's tag: rank, role, affixes, a unique leader's name. */
export function coopElite(raw) {
  coopKeys(raw, ['r', 'o', 'a', 'n']);
  if (raw.r !== 'champion' && raw.r !== 'unique') coopBad();
  if (!['leader', 'champion', 'minion'].includes(raw.o)) coopBad();
  if (!Array.isArray(raw.a) || raw.a.length > 6 || raw.a.some(a => typeof a !== 'string' || !COOP_AFFIX.test(a))) coopBad();
  const out = { r: raw.r, o: raw.o, a: [...raw.a] };
  if (raw.n !== undefined && raw.n !== null) { if (typeof raw.n !== 'string' || !COOP_NAME.test(raw.n)) coopBad(); out.n = raw.n; }
  return out;
}
/** One creature in a snapshot: the id is required; every other field is a change (or, in a keyframe, the whole). */
export function coopMob(raw) {
  coopKeys(raw, ['i', 't', 'k', 'x', 'y', 'f', 'h', 'm', 'l', 'e', 'tl', 'ax', 'ay', 'fl']);
  if (typeof raw.i !== 'string' || !COOP_ID.test(raw.i)) coopBad();
  const out = { i: raw.i };
  if (raw.t !== undefined) { if (typeof raw.t !== 'string' || !CREATURE.test(raw.t)) coopBad(); out.t = raw.t; }
  if (raw.k !== undefined) { if (typeof raw.k !== 'string' || !COOP_KEY.test(raw.k)) coopBad(); out.k = raw.k; }
  if (raw.x !== undefined) out.x = coopNum(raw.x, 1e6);
  if (raw.y !== undefined) out.y = coopNum(raw.y, 1e6);
  if (raw.f !== undefined) { if (raw.f !== 1 && raw.f !== -1) coopBad(); out.f = raw.f; }
  if (raw.h !== undefined) out.h = coopInt(raw.h, 0, 1e7);
  if (raw.m !== undefined) out.m = coopInt(raw.m, 1, 1e7);
  if (out.h !== undefined && out.m !== undefined && out.h > out.m) coopBad();
  if (raw.l !== undefined) out.l = coopInt(raw.l, 1, 999);
  if (raw.e !== undefined) out.e = raw.e === null ? null : coopElite(raw.e);
  if (raw.tl !== undefined) out.tl = coopInt(raw.tl, 0, 100);
  if (raw.ax !== undefined) out.ax = coopNum(raw.ax, 1e6);
  if (raw.ay !== undefined) out.ay = coopNum(raw.ay, 1e6);
  if (raw.fl !== undefined) out.fl = coopInt(raw.fl, 0, 255);
  return out;
}
/** One event in a snapshot: a kill, a bite on a member, a shot or a ground burst (the last two are pictures only). */
export function coopEvent(raw, members, host) {
  if (!raw || typeof raw !== 'object') coopBad();
  const member = id => typeof id === 'string' && members.includes(id);
  if (raw.k === 'kill') {
    coopKeys(raw, ['k', 'i', 't', 'l', 'h', 'xp', 'by', 'x', 'y', 'e', 'key']);
    if (typeof raw.i !== 'string' || !COOP_ID.test(raw.i) || typeof raw.t !== 'string' || !CREATURE.test(raw.t)) coopBad();
    const out = { k: 'kill', i: raw.i, t: raw.t, l: coopInt(raw.l, 1, 999), h: coopInt(raw.h, 1, 100000), x: coopNum(raw.x, 1e6), y: coopNum(raw.y, 1e6) };
    if (raw.xp !== undefined) { if (typeof raw.xp !== 'number' || !Number.isFinite(raw.xp) || raw.xp <= 0 || raw.xp > 5) coopBad(); out.xp = Math.round(raw.xp * 1000) / 1000; }
    if (!Array.isArray(raw.by) || raw.by.length > 4 || raw.by.some(id => !member(id) || id === host)) coopBad();
    out.by = [...new Set(raw.by)];
    if (raw.e !== undefined && raw.e !== null) out.e = coopElite(raw.e);
    if (raw.key !== undefined) { if (typeof raw.key !== 'string' || !COOP_KEY.test(raw.key)) coopBad(); out.key = raw.key; }
    return out;
  }
  if (raw.k === 'bite') {
    coopKeys(raw, ['k', 'to', 'i', 'd', 'ty', 'b', 'c']);
    if (!member(raw.to) || raw.to === host) coopBad();
    const out = { k: 'bite', to: raw.to, d: coopInt(raw.d, 1, 100000), ty: COOP_TYPES.has(raw.ty) ? raw.ty : coopBad() };
    if (raw.i !== undefined) { if (typeof raw.i !== 'string' || !COOP_ID.test(raw.i)) coopBad(); out.i = raw.i; }
    if (raw.b !== undefined) { if (typeof raw.b !== 'boolean') coopBad(); if (raw.b) out.b = true; }
    if (raw.c !== undefined) { if (typeof raw.c !== 'boolean') coopBad(); if (raw.c) out.c = true; }
    return out;
  }
  if (raw.k === 'shot') {
    coopKeys(raw, ['k', 'x', 'y', 'vx', 'vy', 's', 'l']);
    if (!COOP_SHOTS.has(raw.s)) coopBad();
    return { k: 'shot', x: coopNum(raw.x, 1e6), y: coopNum(raw.y, 1e6), vx: coopNum(raw.vx, 2000), vy: coopNum(raw.vy, 2000), s: raw.s, l: Math.max(0, coopNum(raw.l, 10)) };
  }
  if (raw.k === 'burst') {
    coopKeys(raw, ['k', 'x', 'y', 'r', 't', 'el']);
    const out = { k: 'burst', x: coopNum(raw.x, 1e6), y: coopNum(raw.y, 1e6), r: coopInt(raw.r, 1, 400), t: Math.max(0, coopNum(raw.t, 10)) };
    if (raw.el !== undefined) { if (typeof raw.el !== 'string' || !COOP_FX.test(raw.el)) coopBad(); out.el = raw.el; }
    return out;
  }
  coopBad();
}
const COOP_PAL_KINDS = new Set(['pet', 'beast', 'stampede', 'skel', 'wisp', 'beacon', 'glim']);
/** One companion: its owner-scoped id, kind, type (a pet's id), place, facing, life, and whether it fights. */
export function coopPal(raw) {
  coopKeys(raw, ['i', 'k', 't', 'x', 'y', 'f', 'h', 'm', 'a']);
  if (typeof raw.i !== 'string' || !COOP_ID.test(raw.i) || !COOP_PAL_KINDS.has(raw.k)) coopBad();
  const out = { i: raw.i, k: raw.k, x: coopNum(raw.x, 1e6), y: coopNum(raw.y, 1e6) };
  if (raw.t !== undefined) { if (typeof raw.t !== 'string' || !CREATURE.test(raw.t)) coopBad(); out.t = raw.t; }
  if (raw.f !== undefined) { if (raw.f !== 1 && raw.f !== -1) coopBad(); out.f = raw.f; }
  if (raw.h !== undefined || raw.m !== undefined) { out.m = coopInt(raw.m, 1, 1e6); out.h = coopInt(raw.h, 0, out.m); }
  if (raw.a !== undefined) { if (typeof raw.a !== 'boolean') coopBad(); if (raw.a) out.a = true; }
  return out;
}
/** One damage claim: the creature's id, how much, its element, a crit, the skill it came from. */
export function coopHit(raw) {
  coopKeys(raw, ['i', 'd', 'el', 'c', 's']);
  if (typeof raw.i !== 'string' || !COOP_ID.test(raw.i)) coopBad();
  const out = { i: raw.i, d: coopInt(raw.d, 1, 100000), el: COOP_TYPES.has(raw.el) ? raw.el : coopBad() };
  if (raw.c !== undefined) { if (typeof raw.c !== 'boolean') coopBad(); if (raw.c) out.c = true; }
  if (raw.s !== undefined) { if (typeof raw.s !== 'string' || !COOP_SKILL.test(raw.s)) coopBad(); out.s = raw.s; }
  return out;
}

/**
 * `verify`: (idToken) => Promise<{uid, anonymous}> (null: nobody is signed in, every Keeper is a guest — the room
 * before its project is configured). `store`: bans, friends, blocks and reports (social-identity.mjs).
 */
export function createSocialServer({ origins = ['http://127.0.0.1:4317', 'http://localhost:4317', 'http://127.0.0.1:4183', 'http://localhost:4183'], maxClients = 32, idleMs = 45000, publishMs = 100, now = Date.now, verify = null, store = memoryStore(), log = () => {}, extraRoutes = null } = {}) {
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
    coopOnParty(p, also);
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
    tradeGone(s, 'left');
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
  // ── Protocol 5: shared creatures (co-op). Kept apart from the party and friends verbs above. ──
  /** Per party: per area, the host (sticky while it stays) and a term that grows with every change of host. */
  const coopHosts = new Map();
  /** What each party was last told (so an unchanged election sends nothing). */
  const coopTold = new Map();
  const coopSessions = p => p.members.map(sessionOf).filter(s => s && s.coop);
  const coopAreaOf = s => (typeof s.player.area === 'string' ? s.player.area : null);
  /** The election: per area, the host stays while present and not stale; else the earliest-joined present member. */
  const coopElect = p => {
    if (!p) return;
    const hosts = coopHosts.get(p.id) ?? new Map();
    coopHosts.set(p.id, hosts);
    const byArea = new Map();
    for (const s of coopSessions(p)) {
      const area = coopAreaOf(s);
      if (!area) continue;
      if (!byArea.has(area)) byArea.set(area, []);
      byArea.get(area).push(s);
    }
    for (const area of [...hosts.keys()]) if (!byArea.has(area)) hosts.delete(area);
    for (const [area, present] of byArea) {
      const fresh = present.filter(s => !s.coopStale);
      const pool = fresh.length ? fresh : present;
      const cur = hosts.get(area);
      if (cur && pool.some(s => s.player.id === cur.host)) {
        // Someone came or went: the host gets a fresh grace to start (or stop) streaming before it can go stale.
        if (cur.n !== present.length) { cur.n = present.length; cur.since = now(); }
        continue;
      }
      const next = pool[0];
      hosts.set(area, { host: next.player.id, term: (cur?.term ?? 0) + 1, since: now(), n: present.length });
      next.coopSnapAt = now();
    }
    coopPublish(p);
  };
  const coopView = p => {
    const hosts = coopHosts.get(p.id) ?? new Map();
    const areas = {};
    for (const [area, h] of hosts) {
      areas[area] = { host: h.host, term: h.term, members: coopSessions(p).filter(s => coopAreaOf(s) === area).map(s => s.player.id) };
    }
    return areas;
  };
  const coopPublish = (p, force = false) => {
    const areas = coopView(p), key = JSON.stringify(areas);
    if (!force && coopTold.get(p.id) === key) return;
    coopTold.set(p.id, key);
    for (const s of coopSessions(p)) if (s.stream) send(s.stream, { type: 'coop', areas });
  };
  /** The party changed (formed, joined, left, disbanded): elect again; anyone dropped hears there is no host. */
  function coopOnParty(p, also = []) {
    for (const id of also) { const s = sessionOf(id); if (s?.coop) sendTo(id, { type: 'coop', areas: {} }); }
    if (p) coopElect(p);
  }
  /** A Keeper moved (maybe to another area): elect again; a host heard from is not stale any more. */
  const coopMoved = s => {
    if (!s.coop || !s.party) return;
    s.coopStale = false;
    const p = parties.get(s.party);
    if (p) coopElect(p);
  };
  /** A reopened stream learns who hosts where. */
  const coopResend = s => {
    if (!s.coop || !s.party || !s.stream) return;
    const p = parties.get(s.party);
    if (p) send(s.stream, { type: 'coop', areas: coopView(p) });
  };
  /** Once a second: a host that has gone quiet while others share its area is replaced; forgotten parties are dropped. */
  const coopSweep = () => {
    for (const id of [...coopHosts.keys()]) if (!parties.has(id)) { coopHosts.delete(id); coopTold.delete(id); }
    for (const [id, hosts] of coopHosts) {
      const p = parties.get(id);
      let changed = false;
      for (const [area, h] of hosts) {
        const s = sessionOf(h.host);
        const others = coopSessions(p).filter(o => o !== s && coopAreaOf(o) === area && !o.coopStale).length;
        if (!s || !others || now() - Math.max(s.coopSnapAt ?? 0, h.since) <= COOP.staleMs) continue;
        s.coopStale = true; changed = true;
      }
      if (changed) coopElect(p);
    }
  };
  const readCoopBody = async req => {
    if (!req.headers['content-type']?.startsWith('application/json')) throw fail(415, 'JSON required.');
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > COOP.maxBytes) throw fail(413, 'Request too large.');
    }
    try {
      const data = JSON.parse(body);
      if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error();
      return data;
    } catch { throw fail(400, 'Invalid JSON.'); }
  };
  /**
   * The co-op verbs. `snap` (host → the others in its area): creatures, gone ids, events; `hits` (member → its area's
   * host): damage claims, with the room's own record of where the member stands and its level. Refused unless the
   * session said `coop: true`, is in a party, and (snap) hosts that area or (hits) has a host there that is not itself.
   */
  const coopRequest = async (verb, session, req, reply) => {
    if (verb !== 'snap' && verb !== 'hits' && verb !== 'pals') throw fail(404, 'Not found.');
    if (!session.coop) throw fail(409, 'Update the game to share creatures.');
    consume(session, `coop-${verb}`, verb === 'snap' ? COOP.snapsPerSec : verb === 'hits' ? COOP.hitsPerSec : COOP.palsPerSec, 1000);
    const data = await readCoopBody(req);
    session.lastSeen = now();
    const me = session.player.id;
    const p = session.party ? parties.get(session.party) : null;
    if (!p) throw fail(409, 'You are not in a party.');
    // Companions are each owner's own and light: they do not spend the party's creature budget.
    if (verb !== 'pals') consume(p, 'coop', COOP.partyPerSec, 1000);
    const area = coopAreaOf(session);
    if (typeof data.area !== 'string' || !AREA.test(data.area)) throw fail(400, 'Invalid co-op message.');
    if (data.area !== area) throw fail(409, 'Not in that place.');
    const host = coopHosts.get(p.id)?.get(area);
    // Blocks (protocol 4) are honoured both ways: a Keeper never receives a blocked Keeper's creatures or claims, nor
    // sends them to one who blocked it (a party should never hold such a pair, but the relay does not rely on that).
    const apart = o => blocks(o, session) || blocks(session, o);
    const others = coopSessions(p).filter(s => s.player.id !== me && coopAreaOf(s) === area && !apart(s));
    if (verb === 'pals') {
      // Each owner is the authority for its own companions: relayed to the party's others in its area, any role.
      coopKeys(data, ['area', 'pals']);
      if (!Array.isArray(data.pals) || data.pals.length > COOP.maxPals) coopBad();
      const pals = data.pals.map(coopPal);
      const msg = { type: 'coop-pals', from: me, area, pals };
      for (const s of others) if (s.stream) send(s.stream, msg);
      reply(200, { ok: true, to: others.length }); return;
    }
    if (verb === 'snap') {
      if (!host || host.host !== me) throw fail(409, 'Not the host here.');
      coopKeys(data, ['area', 'seq', 'kf', 'mobs', 'gone', 'ev', 'tier']);
      const seq = coopInt(data.seq, 0, 2 ** 31);
      if (typeof data.kf !== 'boolean') coopBad();
      if (!Array.isArray(data.mobs) || data.mobs.length > COOP.maxMobs) coopBad();
      const mobs = data.mobs.map(coopMob);
      if (new Set(mobs.map(m => m.i)).size !== mobs.length) coopBad();
      const gone = data.gone === undefined ? [] : data.gone;
      if (!Array.isArray(gone) || gone.length > COOP.maxGone || gone.some(id => typeof id !== 'string' || !COOP_ID.test(id))) coopBad();
      const evRaw = data.ev === undefined ? [] : data.ev;
      if (!Array.isArray(evRaw) || evRaw.length > COOP.maxEvents) coopBad();
      const ev = evRaw.map(e => coopEvent(e, p.members, me));
      let tier;
      if (data.tier !== undefined) { if (typeof data.tier !== 'string' || !COOP_FX.test(data.tier)) coopBad(); tier = data.tier; }
      session.coopSnapAt = now(); session.coopStale = false;
      const msg = { type: 'coop-snap', from: me, area, term: host.term, seq, kf: data.kf, mobs, gone, ev, ...(tier ? { tier } : {}) };
      for (const s of others) if (s.stream) send(s.stream, msg);
      reply(200, { ok: true, to: others.length }); return;
    }
    if (!host || host.host === me) throw fail(409, 'Nobody hosts here.');
    coopKeys(data, ['area', 'hits']);
    if (!Array.isArray(data.hits) || !data.hits.length || data.hits.length > COOP.maxHits) coopBad();
    const hits = data.hits.map(coopHit);
    const pl = session.player;
    const hostS = sessionOf(host.host);
    if (!hostS || apart(hostS)) throw fail(409, 'Nobody hosts here.');
    sendTo(host.host, { type: 'coop-hits', from: me, area, x: pl.x, y: pl.y, level: Number.isInteger(pl.level) ? pl.level : 1, hits });
    reply(200, { ok: true });
  };

  // ── Protocol 6: trading and ground drops (relay only; functions/src/trade-core.ts moves things). ──
  /** Open trades by id, and asks waiting on an answer. */
  const trades = new Map();
  const asks = new Map();
  /** Ground items the room has been told about, per area (presence and pictures only: the escrow is the truth). */
  const ground = new Map();
  const tradeBad = (why = 'Invalid trade message.') => { throw fail(400, why); };
  const OFFER_ID = /^[A-Za-z0-9:._~-]{1,96}$/;
  const OFFER_TEXT = s => typeof s === 'string' && s.length >= 1 && s.length <= 96 && !/[\u0000-\u001f<>]/.test(s);
  const offerNums = (raw, lo, hi) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length > 32) tradeBad();
    const out = {};
    for (const [k, v] of Object.entries(raw)) { if (!/^[A-Za-z]{1,32}$/.test(k) || typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) tradeBad(); out[k] = v; }
    return out;
  };
  /** One offered item: the fields the Function re-checks, and what draws its card. Unknown keys refused. */
  const offerItem = raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) tradeBad();
    for (const k of Object.keys(raw)) if (!['id', 'def', 'name', 'type', 'rarity', 'stats', 'roll', 'ilvl', 'up', 'sockets', 'reforged'].includes(k)) tradeBad();
    if (typeof raw.id !== 'string' || !OFFER_ID.test(raw.id) || ![raw.def, raw.name, raw.type, raw.rarity].every(OFFER_TEXT)) tradeBad();
    const out = { id: raw.id, def: raw.def, name: raw.name, type: raw.type, rarity: raw.rarity, stats: offerNums(raw.stats, -1e7, 1e7) };
    if (raw.roll !== undefined) out.roll = offerNums(raw.roll, 0, 1);
    for (const [k, lo, hi] of [['ilvl', 1, 99], ['up', 0, 100], ['reforged', 0, 10000]]) if (raw[k] !== undefined) { if (!Number.isInteger(raw[k]) || raw[k] < lo || raw[k] > hi) tradeBad(); out[k] = raw[k]; }
    if (raw.sockets !== undefined) {
      if (!Array.isArray(raw.sockets) || raw.sockets.length > 8 || raw.sockets.some(x => x !== null && (typeof x !== 'string' || !OFFER_ID.test(x)))) tradeBad();
      out.sockets = [...raw.sockets];
    }
    return out;
  };
  const sideOf = (t, s) => (t.a.id === s.player.id ? 'a' : t.b.id === s.player.id ? 'b' : null);
  const tradeView = (t, side) => ({
    id: t.id, me: side, a: { id: t.a.id, name: t.a.name }, b: { id: t.b.id, name: t.b.name },
    offers: t.offers, accepted: t.accepted, confirmed: t.confirmed, rev: t.rev, stage: t.stage, until: t.until,
  });
  const tradePublish = t => { for (const side of ['a', 'b']) sendTo(t[side].id, { type: 'trade', trade: tradeView(t, side) }); };
  /** A trade ends: both windows hear how (done, cancelled — and by whom — or void with the Function's words). */
  const tradeEnd = (t, outcome, by = '', why = '') => {
    trades.delete(t.id);
    for (const side of ['a', 'b']) { const s = sessionOf(t[side].id); if (s && s.trade === t.id) s.trade = null; sendTo(t[side].id, { type: 'trade-end', end: { id: t.id, outcome, by, why } }); }
  };
  /** A Keeper left the room or walked to another area: an open trade with them is off. */
  function tradeGone(s, why) {
    for (const [id, a] of asks) if (a.from === s.player.id || a.to === s.player.id) asks.delete(id);
    const t = s.trade && trades.get(s.trade);
    if (t) tradeEnd(t, 'cancelled', s.player.name, why);
    s.trade = null;
  }
  const groundIn = area => [...(ground.get(area)?.values() ?? [])].filter(g => g.until > now());
  const groundTell = (area, value) => { for (const o of sessions.values()) if (o.stream && o.trades && o.player.area === area) send(o.stream, { type: 'ground', area, ...value }); };
  const groundSnapshot = s => { if (s.trades && s.stream && typeof s.player.area === 'string') send(s.stream, { type: 'ground', area: s.player.area, items: groundIn(s.player.area) }); };
  const readTradeBody = async req => {
    if (!req.headers['content-type']?.startsWith('application/json')) throw fail(415, 'JSON required.');
    let body = '';
    for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 16384) throw fail(413, 'Request too large.'); }
    try { const data = JSON.parse(body); if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error(); return data; } catch { throw fail(400, 'Invalid JSON.'); }
  };
  /**
   * The trade and ground verbs. Refused unless this Keeper said `trade: true`. Trades need both Keepers signed in, in
   * the same area, neither blocking the other. Rate limits per session: asks 5 in 30 s, answers and window changes 30
   * in 10 s, drops 10 a minute, takes 20 in 10 s. An open trade lapses after ten minutes.
   */
  const tradeRequest = async (path, session, req, reply) => {
    if (!session.trades) throw fail(409, 'Update the game to trade.');
    const data = await readTradeBody(req);
    session.lastSeen = now();
    const me = session.player.id;
    const area = typeof session.player.area === 'string' ? session.player.area : null;
    if (path === '/trade/ask') {
      consume(session, 'trade-ask', 5, 30000);
      if (!session.uid) throw fail(403, 'Sign in to trade.');
      const them = typeof data.to === 'string' ? sessionOf(data.to) : null;
      if (!them || them === session) throw fail(400, 'That Keeper is not here.');
      if (!them.trades) throw fail(409, 'That Keeper cannot trade yet.');
      if (!them.uid) throw fail(409, 'That Keeper plays as a guest.');
      if (blocks(them, session) || blocks(session, them)) throw fail(403, 'That Keeper is not taking trades.');
      if (!area || them.player.area !== area) throw fail(409, 'Stand in the same place to trade.');
      if (session.trade || them.trade) throw fail(409, session.trade ? 'Finish your trade first.' : 'That Keeper is already trading.');
      for (const [id, a] of asks) if (a.until <= now()) asks.delete(id);
      if ([...asks.values()].some(a => a.from === me && a.to === them.player.id)) throw fail(409, 'Already asked.');
      const ask = { id: randomUUID(), from: me, name: session.player.name, to: them.player.id, until: now() + 30000 };
      asks.set(ask.id, ask);
      sendTo(them.player.id, { type: 'trade-ask', ask });
      reply(201, { ask }); return;
    }
    consume(session, 'trade-verb', 30, 10000);
    if (path === '/trade/answer') {
      const ask = typeof data.ask === 'string' ? asks.get(data.ask) : undefined;
      if (!ask || ask.to !== me) throw fail(404, 'That request is gone.');
      asks.delete(ask.id);
      if (ask.until <= now()) throw fail(410, 'That request lapsed.');
      const them = sessionOf(ask.from);
      if (data.accept !== true) { if (them) sendTo(ask.from, { type: 'trade-note', note: { kind: 'declined', name: session.player.name } }); reply(200, { ok: true }); return; }
      if (!them || !them.uid || !session.uid) throw fail(410, 'That Keeper has gone.');
      if (!area || them.player.area !== area) throw fail(409, 'Stand in the same place to trade.');
      if (session.trade || them.trade) throw fail(409, 'One of you is already trading.');
      const t = {
        id: randomUUID(), a: { id: them.player.id, name: them.player.name }, b: { id: me, name: session.player.name },
        offers: { a: { items: [], gold: 0 }, b: { items: [], gold: 0 } }, accepted: { a: false, b: false }, confirmed: { a: false, b: false },
        rev: 1, stage: 'offer', until: now() + 10 * 60000,
      };
      // The binding the Function trusts: which two accounts this trade is between (the uids never leave the server).
      try {
        await store.openTrade(t.id, { a: { uid: them.uid, player: them.player.id, name: them.player.name }, b: { uid: session.uid, player: me, name: session.player.name }, status: 'open', openedAt: now(), expiresAt: t.until });
      } catch (e) { log('trade open failed', e); throw fail(503, 'Could not open the trade. Try again.'); }
      trades.set(t.id, t); them.trade = t.id; session.trade = t.id;
      tradePublish(t);
      reply(200, { trade: tradeView(t, 'b') }); return;
    }
    if (path.startsWith('/trade/')) {
      const t = typeof data.trade === 'string' ? trades.get(data.trade) : undefined;
      const side = t ? sideOf(t, session) : null;
      if (!t || !side) throw fail(404, 'That trade is not open.');
      const verb = path.slice('/trade/'.length);
      if (verb === 'cancel') { tradeEnd(t, typeof data.outcome === 'string' && data.outcome === 'void' ? 'void' : 'cancelled', session.player.name, typeof data.why === 'string' ? data.why.replace(/[\u0000-\u001f<>]/g, ' ').slice(0, 160) : ''); reply(200, { ok: true }); return; }
      if (verb === 'offer') {
        if (t.confirmed.a || t.confirmed.b) throw fail(409, 'A Keeper already confirmed. Cancel to change the trade.');
        if (!Array.isArray(data.items) || data.items.length > 12) tradeBad('Up to 12 items.');
        const items = data.items.map(offerItem);
        if (new Set(items.map(i => i.id)).size !== items.length) tradeBad('An item is offered twice.');
        if (!Number.isInteger(data.gold) || data.gold < 0 || data.gold > 1e9) tradeBad('Invalid Gold.');
        t.offers[side] = { items, gold: data.gold };
        // Any change clears both Accepts.
        t.accepted = { a: false, b: false }; t.rev += 1; t.stage = 'offer';
        tradePublish(t); reply(200, { rev: t.rev }); return;
      }
      if (data.rev !== t.rev) throw fail(409, 'The trade changed. Look again.');
      if (verb === 'accept') {
        t.accepted[side] = data.accept !== false;
        t.stage = t.accepted.a && t.accepted.b ? 'confirm' : 'offer';
        tradePublish(t); reply(200, { ok: true }); return;
      }
      if (verb === 'confirm') {
        if (t.stage !== 'confirm') throw fail(409, 'Both Keepers accept first.');
        t.confirmed[side] = true;
        // The Function answered `done` to this Keeper: the swap happened. Both windows close on it.
        if (data.done === true) { tradeEnd(t, 'done', session.player.name); reply(200, { ok: true }); return; }
        tradePublish(t); reply(200, { ok: true }); return;
      }
      throw fail(404, 'Not found.');
    }
    if (path === '/ground/drop') {
      consume(session, 'ground-drop', 10, 60000);
      if (!session.uid) throw fail(403, 'Sign in to drop things.');
      if (typeof data.id !== 'string' || !OFFER_ID.test(data.id) || !area || data.area !== area) tradeBad('Invalid drop.');
      if (![data.name, data.rarity, data.def].every(OFFER_TEXT) || !Number.isFinite(data.x) || !Number.isFinite(data.y) || Math.abs(data.x) > 1e6 || Math.abs(data.y) > 1e6) tradeBad('Invalid drop.');
      // The escrow is the truth: told only what the Function really put on the ground, by this account, here.
      let held = null;
      try { held = await store.groundItem(data.id); } catch (e) { log('ground read failed', e); throw fail(503, 'Could not check that. Try again.'); }
      if (!held || held.area !== area || held.owner?.uid !== session.uid) throw fail(409, 'That is not on the ground.');
      const list = ground.get(area) ?? new Map();
      ground.set(area, list);
      for (const [id, g] of list) if (g.until <= now()) list.delete(id);
      if (list.size >= 60 && !list.has(data.id)) throw fail(429, 'The ground here is covered.');
      const g = { id: data.id, area, x: Math.round(held.x ?? data.x), y: Math.round(held.y ?? data.y), name: data.name, rarity: data.rarity, def: data.def, until: Number(held.expiresAt) || now() + 10 * 60000, by: session.player.name };
      list.set(g.id, g);
      groundTell(area, { add: [g] });
      reply(201, { ground: g }); return;
    }
    if (path === '/ground/take') {
      consume(session, 'ground-take', 20, 10000);
      if (typeof data.id !== 'string' || !OFFER_ID.test(data.id) || typeof data.area !== 'string' || !AREA.test(data.area)) tradeBad('Invalid take.');
      // Only an item the escrow no longer holds leaves everyone's ground (nobody can hide another's drop).
      let held = null;
      try { held = await store.groundItem(data.id); } catch (e) { log('ground read failed', e); throw fail(503, 'Could not check that. Try again.'); }
      if (held) throw fail(409, 'That is still on the ground.');
      ground.get(data.area)?.delete(data.id);
      groundTell(data.area, { gone: [data.id] });
      reply(200, { ok: true }); return;
    }
    throw fail(404, 'Not found.');
  };
  const coopTimer = setInterval(coopSweep, 1000);
  coopTimer.unref?.();
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
      // The local e2e's stand-in for the trade Function (scripts/trade-fake.mjs; SOCIAL_FAKE_TRADE=1, never on Cloud Run).
      if (extraRoutes && url.pathname.startsWith('/fake-trade/')) { await extraRoutes(req, res, url); return; }
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
        // Protocol 5: only a client that says it shares creatures (and knows parties) is ever elected or relayed to.
        session.coop = data.party === true && data.coop === true;
        // Protocol 6: only a client that says it trades is ever asked to (or told what lies on the ground).
        session.trades = data.trade === true; session.trade = null;
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
          coopResend(session);
        }
        // Protocol 6: what lies on the ground here, and the trade window if one is open.
        groundSnapshot(session);
        const open = session.trade && trades.get(session.trade);
        if (open) send(res, { type: 'trade', trade: tradeView(open, sideOf(open, session)) });
        res.on('close', () => { if (session.stream === res) { session.stream = null; session.lastSeen = now(); } });
        return;
      }
      if (req.method !== 'POST') throw fail(404, 'Not found.');
      consume(session, 'requests', 40, 1000);
      if (url.pathname.startsWith('/coop/')) { await coopRequest(url.pathname.slice('/coop/'.length), session, req, reply); return; }
      if (url.pathname.startsWith('/trade/') || url.pathname.startsWith('/ground/')) { await tradeRequest(url.pathname, session, req, reply); return; }
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
        coopMoved(session);
        schedulePublish();
        if ((session.player.area ?? session.player.zone) !== wasArea) {
          friendsHear(session.uid);
          // Protocol 6: a trade needs both Keepers in one place; the new place's ground is sent.
          if (session.trade) tradeGone(session, 'walked away');
          groundSnapshot(session);
        }
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
    // Protocol 6: lapsed asks and trades; ground items past their time leave everyone's screen.
    for (const [id, a] of asks) if (a.until <= now()) asks.delete(id);
    for (const t of [...trades.values()]) if (t.until <= now()) tradeEnd(t, 'cancelled', '', 'The trade ran out of time.');
    for (const [area, list] of ground) {
      const gone = [...list.values()].filter(g => g.until <= now()).map(g => g.id);
      for (const id of gone) list.delete(id);
      if (gone.length) groundTell(area, { gone });
      if (!list.size) ground.delete(area);
    }
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
  const dispose = () => { clearInterval(cleanup); clearInterval(coopTimer); clearTimeout(publishTimer); for (const token of sessions.keys()) remove(token); server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); };
  return { server, dispose, coopSweep };
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
  // The local e2e's stand-in for the trade Function: the real trade-core over an in-memory store the room shares.
  let extraRoutes = null;
  if (fake && process.env.SOCIAL_FAKE_TRADE === '1' && !process.env.K_SERVICE) {
    const { fakeTrade } = await import('./trade-fake.mjs');
    const ft = fakeTrade({ origins: origins ?? [] });
    identity.store = memoryStore(ft.docs);
    extraRoutes = ft.handle;
  }
  const room = createSocialServer({ ...(origins ? { origins } : {}), ...identity, log, extraRoutes });
  room.server.listen(port, host, () => console.log(`Eclipse Realms social room: http://${host}:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void room.dispose(); });
}
