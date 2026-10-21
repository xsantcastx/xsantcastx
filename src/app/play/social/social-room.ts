import type { CoopAreas, CoopHit, CoopHitsMsg, CoopSnapBody, CoopSnapMsg } from './coop-protocol';

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
  /** Protocol 4: who hosts the party's creatures in each area (absent against an older room). */
  coop?: CoopAreas | null;
}
/** The room's party verbs (protocol 3). */
export const PARTY_PROTOCOL = 3;
/** Who the Keeper is, sent on join and with every presence update (protocol 2; a v1 server ignores it). */
export interface RoomProfile { vocation?: string; look?: string; level?: number }
/** The top-down presence beyond x/y/zone/facing/animation. */
export interface RoomPresence extends RoomProfile { area?: string; dir?: 'side' | 'down' | 'up'; moving?: boolean; hp?: number; maxHp?: number }
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
  /** Protocol 4: a host's creature snapshot reached this member. */
  onCoopSnap?: (msg: CoopSnapMsg) => void;
  /** Protocol 4: members' damage claims reached this host. */
  onCoopHits?: (msg: CoopHitsMsg) => void;
}
/** The room's shared creatures (protocol 4). */
export const COOP_ROOM_PROTOCOL = 4;

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
  private snapshot: RoomSnapshot = { status: SOLO, connected: false, players: [], messages: [], id: '', protocol: 0, party: null, invites: [], partyMessages: [] };
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
      const response = await this.send(`${this.endpoint}/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: wanted.name, ...wanted.profile, party: true, coop: true }), signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('Join failed');
      const result = await response.json();
      if (generation !== this.generation || this.wanted !== wanted) {
        void this.post('leave', {}, result.token).catch(() => {}); return;
      }
      this.token = result.token;
      this.rejoinAttempts = 0;
      this.lastBody = ''; this.lastUpdate = -Infinity;
      this.publish({ id: result.id, players: result.players, messages: result.messages, protocol: Number(result.protocol) || 1 });
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
    this.publish({ connected: false, players: [], messages: [], id: '', party: null, invites: [], partyMessages: [], coop: null });
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
  // ── Protocol 4: shared creatures (play/td/td-coop.ts). Kept apart from the party verbs. ──
  /** The election, a host's snapshot, members' claims. A malformed event is dropped whole. */
  private coopEvent(data: Record<string, unknown>): void {
    if (data['type'] === 'coop') {
      const areas = data['areas'];
      this.publish({ coop: areas && typeof areas === 'object' && !Array.isArray(areas) ? areas as CoopAreas : {} });
    }
    if (data['type'] === 'coop-snap' && typeof data['from'] === 'string' && Array.isArray(data['mobs'])) this.options.onCoopSnap?.(data as unknown as CoopSnapMsg);
    if (data['type'] === 'coop-hits' && typeof data['from'] === 'string' && Array.isArray(data['hits'])) this.options.onCoopHits?.(data as unknown as CoopHitsMsg);
  }
  /** The room shares creatures (protocol 4) and the Keeper is in it. */
  get canCoop(): boolean { return this.snapshot.connected && (this.snapshot.protocol ?? 0) >= COOP_ROOM_PROTOCOL && !!this.snapshot.party; }
  /** Post this host's snapshot; false when it did not go (the caller sends a keyframe next). */
  coopSnap(body: CoopSnapBody): Promise<boolean> { return this.coopPost('snap', body); }
  /** Post this member's damage claims. */
  coopHits(body: { area: string; hits: CoopHit[] }): Promise<boolean> { return this.coopPost('hits', body); }
  private async coopPost(verb: 'snap' | 'hits', body: unknown): Promise<boolean> {
    if (!this.canCoop || !this.token || this.paused) return false;
    try {
      const response = await this.send(`${this.endpoint}/coop/${verb}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify(body), signal: AbortSignal.timeout(4000),
      });
      return response.ok;
    } catch { return false; }
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
    const key = JSON.stringify(body), t = this.now(), since = t - this.lastUpdate;
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
