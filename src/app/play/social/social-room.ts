import type { CoopAreas, CoopHit, CoopHitsMsg, CoopSnapBody, CoopSnapMsg } from './coop-protocol';
import type { CoopPal } from './coop-pals';

const KEEPER_ANIMATIONS = new Set(['idle', 'run', 'jump', 'fall', 'attack', 'dodge', 'hurt']);
/**
 * A Keeper in the room. v1 servers send id/name/x/y/zone/facing/animation; protocol 2 (scripts/social-server.mjs)
 * adds the top-down presence: the area id, the way it faces, whether it walks, its class, compact look and level.
 */
export interface RoomPlayer {
  id: string; name: string; x: number; y: number; zone: string; facing?: number; animation?: string;
  area?: string; dir?: 'side' | 'down' | 'up'; moving?: boolean; vocation?: string; look?: string; level?: number;
  /** Protocol 3: life, for the party frames. */
  hp?: number; maxHp?: number;
  /** Protocol 4: not signed in (a guest name, no friends). Absent from an older room. */
  guest?: boolean;
  /** Protocol 5: the pet and Glim beside it, cosmetic (play/social/coop-pals.ts). */
  pals?: string;
  /** Protocol 5: its town portal, if one stands (play/td/td-waygate.ts encodeGate): party members may step through. */
  gate?: string;
}
export interface RoomMessage { id: string; playerId: string; name: string; text: string; at: number }
/** A Wave (protocol 2): from one Keeper, at another (or nobody in particular). */
export interface RoomEmote { id: string; from: string; name: string; to: string | null; kind: 'wave'; at: number }
/** Protocol 3: a party (ids of Keepers in the room; the leader first among them). */
export interface RoomParty { id: string; leader: string; members: string[] }
/** An invite waiting on this Keeper's answer (it lapses at `until`, the server's clock). */
export interface RoomInvite { id: string; from: string; name: string; to: string; until: number }
/** A creature a party member felled, as the room relays it: where the killer last stood is the room's own record. */
export interface RoomPartyKill { id: string; from: string; name: string; creature: string; level: number; hp: number; xp?: number; area: string; x: number; y: number; at: number }
/** Something that happened to the party: a member joined, left or was sent away; an invite was declined. */
export interface RoomPartyNote { kind: 'joined' | 'left' | 'kicked' | 'declined'; name: string; id: string }
export interface RoomSnapshot {
  status: string; connected: boolean; players: RoomPlayer[]; messages: RoomMessage[]; id: string; protocol?: number;
  /** Protocol 3 (absent or empty against an older room). */
  party?: RoomParty | null; invites?: RoomInvite[]; partyMessages?: RoomMessage[];
  /** Protocol 4: this Keeper joined as a guest (true against an older room: nobody is signed in there). */
  guest?: boolean; friends?: RoomFriend[]; friendRequests?: RoomFriendRequest[]; whispers?: RoomWhisper[]; blocks?: RoomBlock[];
  /** The room refused this account (a ban): the client stops trying. */
  barred?: boolean;
  /** Protocol 5: who hosts the party's creatures in each area (absent against an older room). */
  coop?: CoopAreas | null;
}
/** The room's party verbs (protocol 3). */
export const PARTY_PROTOCOL = 3;
/** The room's social graph (protocol 4): who is signed in, friends, whispers, block, report, privacy. */
export const SOCIAL_PROTOCOL = 4;
/** A friend (protocol 4): their account, the name they were added under, and — online — where and which Keeper. */
export interface RoomFriend { uid: string; name: string; online: boolean; area?: string; player?: string }
/** A friend request waiting on this Keeper's answer (lapses at `until`). */
export interface RoomFriendRequest { id: string; name: string; from: string; until: number }
/** A whisper, to or from this Keeper. */
export interface RoomWhisper { id: string; from: string; name: string; to: string; toName: string; text: string; at: number }
/** Someone this Keeper blocked: `key` is what /unblock takes. */
export interface RoomBlock { key: string; name: string }
/** Privacy (protocol 4): appear offline to friends; party invites from friends only. */
export interface RoomPrivacy { offline: boolean; invites: 'everyone' | 'friends' }
export type ReportReason = 'spam' | 'abuse' | 'cheating' | 'name' | 'other';
/** Who the Keeper is, sent on join and with every presence update (protocol 2; a v1 server ignores it). */
export interface RoomProfile { vocation?: string; look?: string; level?: number }
/** The top-down presence beyond x/y/zone/facing/animation. */
export interface RoomPresence extends RoomProfile { area?: string; dir?: 'side' | 'down' | 'up'; moving?: boolean; hp?: number; maxHp?: number; pals?: string; gate?: string }
export interface RoomOptions {
  /**
   * Always on (owner 2026-10-21: "the chat should always be connected"): a dropped stream, an expired session or a
   * failed join is retried with backoff for as long as the Keeper wants the room, instead of giving up.
   */
  keepAlive?: boolean;
  /** The room's base URL (default: hearthEndpoint()). */
  endpoint?: string;
  /** The transport (default: the global fetch); the specs hand in a fake. */
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  /** A clock in ms (default: performance.now). */
  now?: () => number;
  /** A Wave arrived over the stream. */
  onEmote?: (emote: RoomEmote) => void;
  /** Protocol 3: a party member felled a creature (the host decides whether to share its XP: party-share.ts). */
  onPartyKill?: (kill: RoomPartyKill) => void;
  /** Protocol 3: someone joined, left or was sent away; an invite was declined. */
  onPartyNote?: (note: RoomPartyNote) => void;
  /**
   * Protocol 4: the signed-in player's Firebase ID token (null: join as a guest). Asked on every join; a token the
   * room refuses (401) is dropped for that join and the Keeper comes in as a guest instead of not at all.
   */
  idToken?: () => Promise<string | null>;
  /** Protocol 4: a whisper arrived (or this Keeper's own came back). */
  onWhisper?: (whisper: RoomWhisper) => void;
  /** Protocol 4: a friend request was accepted by the other side. */
  onSocialNote?: (note: { kind: 'friend-added'; name: string }) => void;
  /** Protocol 5: a host's creature snapshot reached this member. */
  onCoopSnap?: (msg: CoopSnapMsg) => void;
  /** Protocol 5: members' damage claims reached this host. */
  onCoopHits?: (msg: CoopHitsMsg) => void;
  /** Protocol 5: a party member's companions (in this area) arrived. */
  onCoopPals?: (msg: { from: string; area: string; pals: CoopPal[] }) => void;
}
/** The room's shared creatures (protocol 4). */
export const COOP_ROOM_PROTOCOL = 5;

/** The Hearth room's service (scripts/social-deployment.md). */
export const HEARTH_URL = 'https://eclipse-hearth-773269119730.us-central1.run.app';
/** On localhost only: which port the local room listens on (the e2e starts one on a free port). */
export const HEARTH_PORT_KEY = 'eclipse-hearth-port';
/**
 * Moving, at most one presence update per MOVE_MS; standing still, one heartbeat per HEARTBEAT_MS (the server drops
 * a session after 45s without a request).
 */
export const MOVE_MS = 250;
export const HEARTBEAT_MS = 10000;
/** In a party on a protocol-4 room: one presence update per COOP_MOVE_MS while moving (the room allows 8 a second). */
export const COOP_MOVE_MS = 150;
/** Stream retries before the session is dropped (and, always-on, joined afresh). */
const STREAM_RETRIES = 5;
/** Rejoin backoff (always-on): 2s, 4s, 8s … capped. */
export const REJOIN_MAX_MS = 60000;

/**
 * Straight to the room's Cloud Run service: Firebase Hosting's /social rewrite buffers the event stream (nothing ever
 * arrives through it), and the service already allows the site's origins (SOCIAL_ORIGINS; firebase.json CSP).
 * On localhost: the local room (`node scripts/social-server.mjs`), port 4320 unless HEARTH_PORT_KEY names another.
 */
export function hearthEndpoint(loc: { hostname: string; protocol: string } = location, port: string | null = localPort()): string {
  if (!['localhost', '127.0.0.1'].includes(loc.hostname)) return HEARTH_URL;
  const p = port && /^\d{4,5}$/.test(port) && Number(port) >= 1024 && Number(port) <= 65535 ? port : '4320';
  return `${loc.protocol}//${loc.hostname}:${p}`;
}
function localPort(): string | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(HEARTH_PORT_KEY); } catch { return null; }
}
/** A Keeper's name as the room accepts it (2–20 letters, digits, spaces, _ ' -). */
export function roomName(raw: string): string {
  const name = raw.replace(/[^\p{L}\p{N} _'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20).trim();
  return name.length >= 2 ? name : 'Keeper';
}
/** The protocol-2 fields, cleaned to what the server accepts (anything else is left out, never sent half-valid). */
export function cleanPresence(p: RoomPresence): RoomPresence {
  const out: RoomPresence = {};
  if (typeof p.area === 'string') {
    const a = p.area.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    if (a) out.area = a;
  }
  if (p.dir === 'side' || p.dir === 'down' || p.dir === 'up') out.dir = p.dir;
  if (typeof p.moving === 'boolean') out.moving = p.moving;
  if (typeof p.vocation === 'string' && /^[a-z]{1,16}$/.test(p.vocation)) out.vocation = p.vocation;
  if (typeof p.look === 'string' && /^[a-z0-9.]{1,48}$/.test(p.look)) out.look = p.look;
  if (Number.isInteger(p.level)) out.level = Math.max(1, Math.min(999, p.level as number));
  // Life (protocol 3): both or neither, whole, never above the most (a v2 room ignores them).
  if (Number.isFinite(p.hp) && Number.isFinite(p.maxHp) && (p.maxHp as number) >= 1) {
    const max = Math.min(1e6, Math.round(p.maxHp as number));
    out.maxHp = max; out.hp = Math.max(0, Math.min(max, Math.round(p.hp as number)));
  }
  // Companions (protocol 5): the cosmetic offsets string, as the room accepts it (an older room ignores it).
  if (typeof p.pals === 'string' && /^[a-z0-9:,-]{0,96}$/.test(p.pals)) out.pals = p.pals;
  // A town portal (protocol 5, td-waygate encodeGate): the same plain characters ('' when none stands).
  if (typeof p.gate === 'string' && /^[a-z0-9:-]{0,96}$/.test(p.gate)) out.gate = p.gate;
  return out;
}

const SOLO = 'Solo — join the hearth to meet other Keepers.';

/** The room owns only presence and chat; inventory never leaves the save gateway. */
export class SocialRoom {
  private token = '';
  private stream?: AbortController;
  private generation = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private rejoinTimer?: ReturnType<typeof setTimeout>;
  private reconnectAttempts = 0;
  private rejoinAttempts = 0;
  private updating = false;
  private lastUpdate = -Infinity;
  private lastBody = '';
  /** What the Keeper asked for (always-on rejoins with it); cleared by an explicit leave(). */
  private wanted: { name: string; profile: RoomProfile } | null = null;
  /** The page is out of sight: no stream, no updates; the session is kept for the return. */
  private paused = false;
  private snapshot: RoomSnapshot = { status: SOLO, connected: false, players: [], messages: [], id: '', protocol: 0, party: null, invites: [], partyMessages: [], guest: true, friends: [], friendRequests: [], whispers: [], blocks: [], barred: false };
  /** Privacy as the Keeper set it (sent on join, and again when it changes). */
  private privacy: RoomPrivacy = { offline: false, invites: 'everyone' };
  private readonly endpoint: string;
  private readonly keepAlive: boolean;
  private readonly send: (url: string, init?: RequestInit) => Promise<Response>;
  private readonly now: () => number;
  constructor(private readonly changed: (state: RoomSnapshot) => void, private readonly options: RoomOptions = {}) {
    this.endpoint = options.endpoint ?? hearthEndpoint();
    this.keepAlive = !!options.keepAlive;
    this.send = options.fetch ?? ((url, init) => fetch(url, init));
    this.now = options.now ?? (() => performance.now());
  }
  get state(): RoomSnapshot { return this.snapshot; }
  /** In the room, or on the way in (a join or a rejoin pending). */
  get wants(): boolean { return !!this.wanted; }
  get isPaused(): boolean { return this.paused; }
  private publish(patch: Partial<RoomSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }; this.changed(this.snapshot);
  }
  async join(name: string, profile: RoomProfile = {}): Promise<void> {
    this.leave();
    this.wanted = { name, profile: cleanPresence(profile) };
    await this.connect();
  }
  /** Who the Keeper is changed (a level, a new look): the next update carries it. */
  setProfile(profile: RoomProfile): void {
    if (this.wanted) this.wanted.profile = cleanPresence(profile);
  }
  private async connect(): Promise<void> {
    const wanted = this.wanted;
    if (!wanted) return;
    const generation = ++this.generation;
    clearTimeout(this.rejoinTimer); this.rejoinTimer = undefined;
    this.publish({ status: 'Joining the hearth…' });
    try {
      // Protocol 4: signed in, the room is told who this is (an older room ignores the header).
      let idToken: string | null = null;
      try { idToken = (await this.options.idToken?.()) ?? null; } catch { idToken = null; }
      if (generation !== this.generation || this.wanted !== wanted) return;
      const join = (token: string | null) => this.send(`${this.endpoint}/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Firebase ${token}` } : {}) },
        body: JSON.stringify({ name: wanted.name, ...wanted.profile, party: true, coop: true, privacy: this.privacy }), signal: AbortSignal.timeout(8000),
      });
      let response = await join(idToken);
      // A token the room will not take: in as a guest rather than not at all.
      if (response.status === 401 && idToken) response = await join(null);
      if (response.status === 403 && /barred/i.test(String((await response.clone().json().catch(() => null) as { error?: unknown } | null)?.error ?? ''))) {
        // Barred (a ban): stop wanting the room; the always-on loop must not knock for ever.
        this.wanted = null;
        this.publish({ status: 'This account is barred from the hearth.', connected: false, barred: true });
        return;
      }
      if (!response.ok) throw new Error('Join failed');
      const result = await response.json();
      if (generation !== this.generation || this.wanted !== wanted) {
        void this.post('leave', {}, result.token).catch(() => {}); return;
      }
      this.token = result.token;
      this.rejoinAttempts = 0;
      this.lastBody = ''; this.lastUpdate = -Infinity;
      this.publish({ id: result.id, players: result.players, messages: result.messages, protocol: Number(result.protocol) || 1, guest: result.guest !== false, barred: false });
      if (this.paused) return;
      this.stream = new AbortController();
      void this.listen(generation, this.stream.signal);
    } catch {
      if (generation !== this.generation) return;
      this.publish({ status: 'The room server is unavailable. You can keep playing solo.', connected: false });
      this.scheduleRejoin();
    }
  }
  /** Always-on: try the room again after a growing pause (2s, 4s, 8s … a minute). */
  private scheduleRejoin(): void {
    if (!this.keepAlive || !this.wanted || this.paused || this.rejoinTimer) return;
    const delay = Math.min(2000 * 2 ** this.rejoinAttempts++, REJOIN_MAX_MS);
    this.rejoinTimer = setTimeout(() => { this.rejoinTimer = undefined; if (!this.paused) void this.connect(); }, delay);
  }
  /** Drop the session (stream, timers, token) but keep wanting the room. */
  private drop(): void {
    this.generation++; this.stream?.abort(); this.stream = undefined;
    clearTimeout(this.reconnectTimer); this.reconnectTimer = undefined;
    this.reconnectAttempts = 0; this.updating = false; this.lastUpdate = -Infinity; this.lastBody = '';
    const token = this.token; this.token = '';
    if (token) void this.post('leave', {}, token).catch(() => {});
    this.publish({ connected: false, players: [], messages: [], id: '', party: null, invites: [], partyMessages: [], friends: [], friendRequests: [], whispers: [], blocks: [], coop: null });
  }
  private async listen(generation: number, signal: AbortSignal): Promise<void> {
    let openedAt: number | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await this.send(`${this.endpoint}/events`, { headers: { Authorization: `Bearer ${this.token}` }, signal });
      if (generation !== this.generation || signal.aborted) { await response.body?.cancel(); return; }
      if (response.status === 401) {
        // The session lapsed (a phone asleep past the server's 45s): always-on joins afresh.
        if (this.keepAlive && this.wanted) { this.drop(); this.publish({ status: 'Rejoining the hearth…' }); this.scheduleRejoin(); return; }
        this.leave(); this.publish({ status: 'Your room session expired. Join again to reconnect.' }); return;
      }
      if (!response.ok || !response.body) throw new Error('Stream unavailable');
      if (generation !== this.generation) return;
      openedAt = this.now();
      this.publish({ status: 'Connected to the hearth', connected: true });
      reader = response.body.getReader();
      const decoder = new TextDecoder(); let pending = '';
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let end: number;
        while ((end = pending.indexOf('\n\n')) !== -1) {
          const packet = pending.slice(0, end); pending = pending.slice(end + 2);
          const line = packet.split('\n').find(line => line.startsWith('data:'));
          if (!line || generation !== this.generation) continue;
          let data: {
            type?: string; players?: RoomPlayer[]; messages?: RoomMessage[]; message?: RoomMessage; emote?: RoomEmote;
            party?: RoomParty | null; invite?: RoomInvite; kill?: RoomPartyKill; note?: RoomPartyNote;
            friends?: RoomFriend[]; request?: RoomFriendRequest; whisper?: RoomWhisper; blocks?: RoomBlock[];
          };
          try { data = JSON.parse(line.slice(5)); } catch { continue; }
          if (data.type === 'snapshot') this.publish({ players: data.players ?? [], messages: data.messages ?? [] });
          if (data.type === 'players') this.publish({ players: data.players ?? [] });
          const message = data.message;
          if (data.type === 'chat' && message && !this.snapshot.messages.some(m => m.id === message.id)) {
            this.publish({ messages: [...this.snapshot.messages, message].slice(-50) });
          }
          if (data.type === 'emote' && data.emote?.kind === 'wave') this.options.onEmote?.(data.emote);
          this.partyEvent(data);
          this.coopEvent(data as Record<string, unknown>);
          if (this.socialEvent(data)) return;
        }
      }
      if (!signal.aborted) throw new Error('Stream ended');
    } catch {
      if (generation !== this.generation || signal.aborted) return;
      if (openedAt !== undefined && this.now() - openedAt > 10000) this.reconnectAttempts = 0;
      if (this.reconnectAttempts >= STREAM_RETRIES) {
        if (this.keepAlive && this.wanted) { this.drop(); this.publish({ status: 'Reconnecting to the hearth…' }); this.scheduleRejoin(); return; }
        this.leave(); this.publish({ status: 'Connection lost. Join again to reconnect.' }); return;
      }
      const delay = Math.min(1000 * 2 ** this.reconnectAttempts++, 8000);
      this.publish({ connected: false, status: 'Reconnecting to the hearth…' });
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = undefined;
        if (generation !== this.generation || !this.token || this.paused) return;
        this.stream = new AbortController();
        void this.listen(generation, this.stream.signal);
      }, delay);
    } finally {
      await reader?.cancel().catch(() => {});
      reader?.releaseLock();
    }
  }
  /** Protocol 3's events: the party as it stands, an invite, a party line, a kill, a note. */
  private partyEvent(data: { type?: string; party?: RoomParty | null; messages?: RoomMessage[]; invite?: RoomInvite; message?: RoomMessage; kill?: RoomPartyKill; note?: RoomPartyNote }): void {
    if (data.type === 'party') {
      const p = data.party;
      const party = p && typeof p.id === 'string' && typeof p.leader === 'string' && Array.isArray(p.members) ? { id: p.id, leader: p.leader, members: p.members.filter(m => typeof m === 'string').slice(0, 4) } : null;
      const same = !!party && party.id === this.snapshot.party?.id;
      const lines = Array.isArray(data.messages) ? data.messages.slice(-30) : same ? this.snapshot.partyMessages ?? [] : [];
      // In a party, no invite stands any more (the room spends them on accept).
      this.publish({ party, partyMessages: party ? lines : [], invites: party ? [] : this.snapshot.invites ?? [] });
    }
    if (data.type === 'invite' && data.invite && typeof data.invite.id === 'string') {
      const inv = data.invite;
      if (!(this.snapshot.invites ?? []).some(i => i.id === inv.id)) this.publish({ invites: [...(this.snapshot.invites ?? []), inv].slice(-3) });
    }
    const m = data.message;
    if (data.type === 'party-chat' && m && !(this.snapshot.partyMessages ?? []).some(x => x.id === m.id)) {
      this.publish({ partyMessages: [...(this.snapshot.partyMessages ?? []), m].slice(-30) });
    }
    if (data.type === 'party-kill' && data.kill) this.options.onPartyKill?.(data.kill);
    if (data.type === 'party-note' && data.note) this.options.onPartyNote?.(data.note);
  }
  // ── Protocol 5: shared creatures (play/td/td-coop.ts). Kept apart from the party verbs. ──
  /** The election, a host's snapshot, members' claims. A malformed event is dropped whole. */
  private coopEvent(data: Record<string, unknown>): void {
    if (data['type'] === 'coop') {
      const areas = data['areas'];
      this.publish({ coop: areas && typeof areas === 'object' && !Array.isArray(areas) ? areas as CoopAreas : {} });
    }
    if (data['type'] === 'coop-snap' && typeof data['from'] === 'string' && Array.isArray(data['mobs'])) this.options.onCoopSnap?.(data as unknown as CoopSnapMsg);
    if (data['type'] === 'coop-hits' && typeof data['from'] === 'string' && Array.isArray(data['hits'])) this.options.onCoopHits?.(data as unknown as CoopHitsMsg);
    if (data['type'] === 'coop-pals' && typeof data['from'] === 'string' && typeof data['area'] === 'string' && Array.isArray(data['pals'])) this.options.onCoopPals?.(data as unknown as { from: string; area: string; pals: CoopPal[] });
  }
  /** The room shares creatures (protocol 5) and the Keeper is in it. */
  get canCoop(): boolean { return this.snapshot.connected && (this.snapshot.protocol ?? 0) >= COOP_ROOM_PROTOCOL && !!this.snapshot.party; }
  /** Post this host's snapshot; false when it did not go (the caller sends a keyframe next). */
  coopSnap(body: CoopSnapBody): Promise<boolean> { return this.coopPost('snap', body); }
  /** Post this member's damage claims. */
  coopHits(body: { area: string; hits: CoopHit[] }): Promise<boolean> { return this.coopPost('hits', body); }
  /** Post this Keeper's own companions to the party in its area. */
  coopPals(body: { area: string; pals: CoopPal[] }): Promise<boolean> { return this.coopPost('pals', body); }
  private async coopPost(verb: 'snap' | 'hits' | 'pals', body: unknown): Promise<boolean> {
    if (!this.canCoop || !this.token || this.paused) return false;
    try {
      const response = await this.send(`${this.endpoint}/coop/${verb}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify(body), signal: AbortSignal.timeout(4000),
      });
      return response.ok;
    } catch { return false; }
  }
  /**
   * Protocol 4's events. True when the session ended here (a ban, or this account joined from another window: the
   * always-on loop must not take the room back and push that window out in turn).
   */
  private socialEvent(data: { type?: string; friends?: RoomFriend[]; request?: RoomFriendRequest; whisper?: RoomWhisper; blocks?: RoomBlock[]; note?: unknown }): boolean {
    if (data.type === 'friends' && Array.isArray(data.friends)) {
      this.publish({ friends: data.friends.filter(f => f && typeof f.uid === 'string' && typeof f.name === 'string').slice(0, 200) });
    }
    const r = data.request;
    if (data.type === 'friend-request' && r && typeof r.id === 'string' && !(this.snapshot.friendRequests ?? []).some(x => x.id === r.id)) {
      this.publish({ friendRequests: [...(this.snapshot.friendRequests ?? []), r].slice(-5) });
    }
    const w = data.whisper;
    if (data.type === 'whisper' && w && typeof w.id === 'string' && !(this.snapshot.whispers ?? []).some(x => x.id === w.id)) {
      this.publish({ whispers: [...(this.snapshot.whispers ?? []), w].slice(-30) });
      this.options.onWhisper?.(w);
    }
    if (data.type === 'blocks' && Array.isArray(data.blocks)) this.publish({ blocks: data.blocks.filter(b => b && typeof b.key === 'string').slice(0, 100) });
    if (data.type === 'social-note' && data.note && typeof data.note === 'object') this.options.onSocialNote?.(data.note as { kind: 'friend-added'; name: string });
    if (data.type === 'banned' || data.type === 'replaced') {
      const barred = data.type === 'banned';
      this.wanted = null;
      clearTimeout(this.rejoinTimer); this.rejoinTimer = undefined;
      this.generation++; this.stream?.abort(); this.stream = undefined; this.token = '';
      this.publish({ connected: false, players: [], barred, status: barred ? 'This account is barred from the hearth.' : 'You joined the hearth from another window.' });
      return true;
    }
    return false;
  }
  /** The room knows the social graph (protocol 4) and the Keeper is in it. */
  get canSocial(): boolean { return this.snapshot.connected && (this.snapshot.protocol ?? 0) >= SOCIAL_PROTOCOL; }
  async friendRequest(player: string): Promise<string> { return this.socialCall('friend/request', { to: player }); }
  async friendAnswer(requestId: string, yes: boolean): Promise<string> {
    this.publish({ friendRequests: (this.snapshot.friendRequests ?? []).filter(r => r.id !== requestId) });
    return this.socialCall(yes ? 'friend/accept' : 'friend/decline', { request: requestId });
  }
  forgetFriendRequest(requestId: string): void { this.publish({ friendRequests: (this.snapshot.friendRequests ?? []).filter(r => r.id !== requestId) }); }
  async friendRemove(uid: string): Promise<string> { return this.socialCall('friend/remove', { uid }); }
  async whisper(player: string, text: string): Promise<string> { return this.socialCall('whisper', { to: player, text }); }
  async block(player: string): Promise<string> { return this.socialCall('block', { player }); }
  async unblock(key: string): Promise<string> { return this.socialCall('unblock', { key }); }
  async report(player: string, reason: ReportReason, note = ''): Promise<string> { return this.socialCall('report', { player, reason, ...(note ? { note } : {}) }); }
  /** Privacy: kept for the next join, and sent now when the room knows it. */
  setPrivacy(p: RoomPrivacy): void {
    const next: RoomPrivacy = { offline: !!p.offline, invites: p.invites === 'friends' ? 'friends' : 'everyone' };
    if (next.offline === this.privacy.offline && next.invites === this.privacy.invites) return;
    this.privacy = next;
    if (this.canSocial) void this.socialCall('privacy', next);
  }
  private async socialCall(path: string, body: unknown): Promise<string> {
    if (!this.canSocial || !this.token) return 'offline';
    try {
      const response = await this.send(`${this.endpoint}/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
      });
      if (response.ok) return '';
      const said = await response.json().catch(() => null) as { error?: unknown } | null;
      return typeof said?.error === 'string' && said.error ? said.error.slice(0, 120) : 'failed';
    } catch { return 'failed'; }
  }
  /** The room knows parties (protocol 3) and the Keeper is in it. */
  get canParty(): boolean { return this.snapshot.connected && (this.snapshot.protocol ?? 0) >= PARTY_PROTOCOL; }
  /** Ask a Keeper into the party (a new one on their yes, when there is none yet). The refusal's words, or ''. */
  async invite(to: string): Promise<string> { return this.partyCall('invite', { to }); }
  /** Answer an invite: yes or no. It leaves the list either way. */
  async answer(inviteId: string, yes: boolean): Promise<string> {
    this.publish({ invites: (this.snapshot.invites ?? []).filter(i => i.id !== inviteId) });
    return this.partyCall(yes ? 'accept' : 'decline', { invite: inviteId });
  }
  /** An invite left unanswered past its time (the toast's own timer): gone from the list, nothing sent. */
  forgetInvite(inviteId: string): void { this.publish({ invites: (this.snapshot.invites ?? []).filter(i => i.id !== inviteId) }); }
  async leaveParty(): Promise<string> { return this.partyCall('leave', {}); }
  async kick(member: string): Promise<string> { return this.partyCall('kick', { member }); }
  async partyChat(text: string): Promise<boolean> { return (await this.partyCall('chat', { text })) === ''; }
  /** Tell the party a creature fell to this Keeper (fire and forget; nothing waits on it). */
  partyKill(kill: { creature: string; level: number; hp: number; xp?: number; area: string }): void {
    if (!this.canParty || !this.snapshot.party || this.snapshot.party.members.length < 2) return;
    void this.partyCall('kill', kill);
  }
  /** One party verb: '' when it went through, else the room's words (or a plain fallback). */
  private async partyCall(verb: string, body: unknown): Promise<string> {
    if (!this.canParty || !this.token) return 'offline';
    try {
      const response = await this.send(`${this.endpoint}/party/${verb}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify(body), signal: AbortSignal.timeout(5000),
      });
      if (response.ok) return '';
      const said = await response.json().catch(() => null) as { error?: unknown } | null;
      return typeof said?.error === 'string' && said.error ? said.error.slice(0, 120) : 'failed';
    } catch { return 'failed'; }
  }
  /**
   * The page went out of sight (a tab switch, the phone asleep): close the stream and stop updates, keep the session.
   * Nothing is sent; if the server forgets the session meanwhile, resume() joins afresh.
   */
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.generation++;
    this.stream?.abort(); this.stream = undefined;
    clearTimeout(this.reconnectTimer); this.reconnectTimer = undefined;
    clearTimeout(this.rejoinTimer); this.rejoinTimer = undefined;
    this.reconnectAttempts = 0; this.updating = false;
    if (this.snapshot.connected) this.publish({ connected: false, status: 'Paused while the game is out of sight.' });
  }
  /** Back in sight: reopen the stream with the same session, or join again if there is none. */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.rejoinAttempts = 0;
    if (!this.wanted) return;
    if (!this.token) { void this.connect(); return; }
    this.lastBody = ''; this.lastUpdate = -Infinity;
    const generation = ++this.generation;
    this.stream = new AbortController();
    void this.listen(generation, this.stream.signal);
  }
  async chat(text: string): Promise<boolean> {
    if (!this.snapshot.connected) return false;
    try { await this.post('chat', { text }); return true; }
    catch { this.publish({ status: 'Message not sent. Wait a moment and try again.' }); return false; }
  }
  /**
   * Wave at a Keeper (or at nobody). False when it could not travel: not connected, or a v1 server without emotes —
   * the caller still shows it on this screen.
   */
  async wave(to: string | null): Promise<boolean> {
    if (!this.snapshot.connected || (this.snapshot.protocol ?? 0) < 2) return false;
    try { await this.post('emote', { kind: 'wave', ...(to ? { to } : {}) }); return true; } catch { return false; }
  }
  /**
   * Where the Keeper stands. Throttled: while anything changes, at most one per MOVE_MS; while nothing does, one
   * heartbeat per HEARTBEAT_MS (the session's keep-alive). One request in flight at a time.
   */
  update(x: number, y: number, zone: string, facing = 1, animation = 'idle', presence?: RoomPresence): void {
    if (!this.token || this.paused || this.updating) return;
    const extra = presence ? cleanPresence({ ...(this.wanted?.profile ?? {}), ...presence }) : {};
    const body = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, zone, facing: facing === -1 ? -1 : 1, animation: KEEPER_ANIMATIONS.has(animation) ? animation : 'idle', ...extra };
    // The cosmetic companions (protocol 5) ride along on updates that go anyway; they never cause one on their own.
    const { pals: _pals, ...moved } = body as typeof body & { pals?: string };
    const key = JSON.stringify(moved), t = this.now(), since = t - this.lastUpdate;
    // Sharing creatures (protocol 4), the host aims at where members stand: their presence goes a little oftener.
    if (since < (this.canCoop ? COOP_MOVE_MS : MOVE_MS)) return;
    if (key === this.lastBody && since < HEARTBEAT_MS) return;
    const generation = this.generation;
    this.updating = true; this.lastUpdate = t; this.lastBody = key;
    void this.post('update', body).catch(() => {
      if (generation === this.generation && this.snapshot.connected) this.publish({ status: 'Position update interrupted.' });
    }).finally(() => { if (generation === this.generation) this.updating = false; });
  }
  private async post(path: string, body: unknown, token = this.token): Promise<void> {
    const response = await this.send(`${this.endpoint}/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body), signal: AbortSignal.timeout(5000), keepalive: path === 'leave',
    });
    if (!response.ok) throw new Error('Room request failed');
  }
  /** Leave the room and stop wanting it (the Ignore setting, the page going away, the Leave button). */
  leave(): void {
    this.wanted = null;
    clearTimeout(this.rejoinTimer); this.rejoinTimer = undefined; this.rejoinAttempts = 0;
    this.drop();
    this.publish({ status: SOLO });
  }
}
