import type { CoopAreas, CoopHit, CoopHitsMsg, CoopSnapBody, CoopSnapMsg } from './coop-protocol';
import type { CoopPal } from './coop-pals';
import type { OfferItem } from '../trade/trade-items';
import type { WorldGroundMsg, WorldTakeResult } from './world-protocol';

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
  /** What it wears, as worn-look ids (shared/keeper-look/worn-looks.ts packWorn): drawn on its sprite. An older room drops it. */
  worn?: string;
}
export interface RoomMessage { id: string; playerId: string; name: string; text: string; at: number }
/** A Wave (protocol 2): from one Keeper, at another (or nobody in particular). */
export interface RoomEmote { id: string; from: string; name: string; to: string | null; kind: 'wave'; at: number }
/**
 * Protocol 3: a party (ids of Keepers in the room; the leader first among them). Protocol 8: `offline` — members
 * logged out who stay in the party (greyed; back in when they log in), by a roster id the leader can kick.
 */
export interface RoomParty { id: string; leader: string; members: string[]; offline?: { id: string; name: string }[] }
/** An invite waiting on this Keeper's answer (it lapses at `until`, the server's clock). */
export interface RoomInvite { id: string; from: string; name: string; to: string; until: number }
/** A creature a party member felled, as the room relays it: where the killer last stood is the room's own record. */
export interface RoomPartyKill { id: string; from: string; name: string; creature: string; level: number; hp: number; xp?: number; area: string; x: number; y: number; at: number }
/** Something that happened to the party: a member joined, left or was sent away; an invite was declined. */
export interface RoomPartyNote { kind: 'joined' | 'left' | 'kicked' | 'declined' | 'offline' | 'back'; name: string; id: string }
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
  /** Protocol 6: trade requests waiting on this Keeper's answer, the open trade window, what lies on the ground here. */
  tradeAsks?: RoomTradeAsk[]; trade?: RoomTrade | null; ground?: { area: string; items: RoomGround[] };
  /** Protocol 7: the room runs the world here (this Keeper said `world: true` and the room has the world on). */
  world?: boolean;
  /** Protocol 8: the room settles this Keeper's trades and lays its drops itself (it has the trade core). */
  settles?: boolean;
}
/** The room's trading and shared ground (protocol 6; the trade Function moves things: functions-game/src/trade-core.ts). */
export const TRADE_PROTOCOL = 6;
export interface RoomTradeAsk { id: string; from: string; name: string; to: string; until: number }
/** One side's offer in the window. */
export interface RoomOffer { items: OfferItem[]; gold: number }
/** The open trade as the room relays it: `me` is this Keeper's side; any offer change clears both Accepts (rev). */
export interface RoomTrade {
  id: string; me: 'a' | 'b'; a: { id: string; name: string }; b: { id: string; name: string };
  offers: { a: RoomOffer; b: RoomOffer }; accepted: { a: boolean; b: boolean }; confirmed: { a: boolean; b: boolean };
  rev: number; stage: 'offer' | 'confirm' | 'settling'; until: number;
  /** Protocol 8: the room settles this trade itself (both Keepers' clients speak protocol 8). */
  room?: boolean;
}
/**
 * How a trade window closed. Protocol 8: `settled` — the room settled it in memory; `received` is what this Keeper
 * gets; the commit's word follows as a RoomTradeCommit.
 */
export interface RoomTradeEnd { id: string; outcome: 'done' | 'cancelled' | 'void'; by: string; why: string; settled?: boolean; received?: { items: string[]; gold: number } }
/** Protocol 8: the room's one Firestore commit of a settled trade landed (ok) or did not (why). */
export interface RoomTradeCommit { id: string; ok: boolean; received?: { items: string[]; gold: number }; why?: string }
/** Protocol 8: how a trade the room settled ended, asked again (the commit's word was lost). */
export type RoomTradeStatus = { status: 'done'; received: { items: string[]; gold: number } } | { status: 'void' | 'unknown' | 'offline'; why?: string };
/**
 * An item on the ground, as the room was told by the one who dropped it (checked against the escrow). Protocol 8:
 * `pending` — laid by the room and still being escrowed (nobody can have it yet); `room` — the room's to clear.
 */
export interface RoomGround { id: string; area: string; x: number; y: number; name: string; rarity: string; def: string; until: number; by?: string; pending?: boolean; room?: boolean }
/** Protocol 8: the room's word on this Keeper's drop: escrowed (out of the save, safe on the ground) or handed back. */
export interface RoomGroundNote { kind: 'escrowed' | 'returned'; id: string; name: string; why?: string }
/** Protocol 8: a pick's answer — the new id the item took in this save, or why not. */
export type RoomPick = { ok: true; item: string; ms?: number } | { ok: false; why: string; code?: string };
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
export interface RoomProfile { vocation?: string; look?: string; level?: number; worn?: string }
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
  /** Protocol 6: a trade window closed (done, cancelled, void). */
  onTradeEnd?: (end: RoomTradeEnd) => void;
  /** Protocol 6: a trade request was declined. */
  onTradeNote?: (note: { kind: 'declined'; name: string }) => void;
  /** Protocol 7: the room's ground in this Keeper's area (the whole list, or what came and went). */
  onWorldGround?: (msg: WorldGroundMsg) => void;
  /** Protocol 8: which character this device plays (character-scope.ts): the room reads that save. */
  character?: () => string;
  /** Protocol 8: a trade the room settled was committed (or was not). */
  onTradeCommit?: (commit: RoomTradeCommit) => void;
  /** Protocol 8: this Keeper's drop was escrowed, or handed back. */
  onGroundNote?: (note: RoomGroundNote) => void;
  /** Protocol 9: a world boss's omen (it rose, fell or left). */
  onWorldOmen?: (omen: RoomWorldOmen) => void;
}
/** The room's shared creatures (protocol 4). */
export const COOP_ROOM_PROTOCOL = 5;
/**
 * The room-run world (protocol 7) and the ids of its ground: the same values as world-protocol.ts (room-world.spec
 * checks they agree). Kept here as values so this file imports nothing at run time.
 */
export const ROOM_WORLD_PROTOCOL = 7;
/** Protocol 8 (M2 of the room-run world): trades settled and drops laid by the room, a party that outlives a relog. */
export const ROOM_SETTLE_PROTOCOL = 8;
/**
 * Protocol 9 (M3): the room hosts this Keeper in every area — every continent and every floor — and tells it the world
 * bosses' omens. The protocol this client speaks (sent on /join).
 */
export const ROOM_EVERYWHERE_PROTOCOL = 9;
/** A world boss rose, fell or left unfound (protocol 9; play/world/world-bosses.ts): the omen line is the client's. */
export interface RoomWorldOmen { boss: string; name: string; area: string; at: 'rise' | 'fall' | 'gone'; level: number }
/** What the room accepts as a character id (character-scope.ts). */
const CHARACTER_ID = /^[a-z0-9]{2,16}$/;
export const ROOM_DROP_ID = /^td:[a-z0-9-]{1,40}:w\.[a-z0-9_-]{1,40}\.[a-z0-9]{1,12}\.[a-z0-9]{1,12}$/;

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
  // Worn looks (the room's `worn`: plain ids, '' when nothing is worn so the others take it off too).
  if (typeof p.worn === 'string' && /^[a-z0-9.,-]{0,240}$/.test(p.worn)) out.worn = p.worn;
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
  private snapshot: RoomSnapshot = { status: SOLO, connected: false, players: [], messages: [], id: '', protocol: 0, party: null, invites: [], partyMessages: [], guest: true, friends: [], friendRequests: [], whispers: [], blocks: [], barred: false, tradeAsks: [], trade: null, ground: { area: '', items: [] } };
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
        body: JSON.stringify({ name: wanted.name, ...wanted.profile, party: true, coop: true, trade: true, world: true, protocol: ROOM_EVERYWHERE_PROTOCOL, ...this.characterField(), privacy: this.privacy }), signal: AbortSignal.timeout(8000),
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
      this.publish({ id: result.id, players: result.players, messages: result.messages, protocol: Number(result.protocol) || 1, guest: result.guest !== false, barred: false, world: result.world === true, settles: result.settles === true });
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
    this.publish({ connected: false, players: [], messages: [], id: '', party: null, invites: [], partyMessages: [], friends: [], friendRequests: [], whispers: [], blocks: [], coop: null, tradeAsks: [], trade: null, ground: { area: '', items: [] } });
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
          this.tradeEvent(data as Record<string, unknown>);
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
      // Protocol 8: the members logged out who stay in it (absent from an older room).
      const offline = (Array.isArray(p?.offline) ? p.offline : []).filter(o => o && typeof o.id === 'string' && typeof o.name === 'string').slice(0, 3).map(o => ({ id: o.id, name: o.name.slice(0, 20) }));
      const party = p && typeof p.id === 'string' && typeof p.leader === 'string' && Array.isArray(p.members) ? { id: p.id, leader: p.leader, members: p.members.filter(m => typeof m === 'string').slice(0, 4), ...(Array.isArray(p.offline) ? { offline } : {}) } : null;
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
    // Protocol 7: the room's ground (play/social/world-protocol.ts). Ids the room would not hand out are dropped.
    if (data['type'] === 'world-ground' && typeof data['area'] === 'string') {
      const ok = (l: unknown) => (Array.isArray(l) ? l : []).filter(g => g && typeof g === 'object' && ROOM_DROP_ID.test(String((g as { id?: unknown }).id)) && Number.isFinite((g as { x?: unknown }).x) && Number.isFinite((g as { y?: unknown }).y));
      const msg: WorldGroundMsg = { area: data['area'] as string };
      if (Array.isArray(data['items'])) msg.items = ok(data['items']);
      if (Array.isArray(data['add'])) msg.add = ok(data['add']);
      if (Array.isArray(data['gone'])) msg.gone = (data['gone'] as unknown[]).filter((id): id is string => typeof id === 'string');
      this.options.onWorldGround?.(msg);
    }
    if (data['type'] === 'world-omen' && typeof data['boss'] === 'string' && /^[a-z0-9-]{1,40}$/.test(data['boss'] as string) && (data['at'] === 'rise' || data['at'] === 'fall' || data['at'] === 'gone')) {
      this.options.onWorldOmen?.({ boss: data['boss'] as string, name: String(data['name'] ?? '').slice(0, 40), area: String(data['area'] ?? '').slice(0, 40), at: data['at'] as RoomWorldOmen['at'], level: Number(data['level']) || 1 });
    }
  }
  /** The room runs the world (protocol 7) and this Keeper is in it. */
  get canWorld(): boolean { return this.snapshot.connected && (this.snapshot.protocol ?? 0) >= ROOM_WORLD_PROTOCOL && this.snapshot.world === true; }
  /**
   * Reach for a piece of the room's ground: the room answers from memory (the first allowed Keeper wins). The answer
   * carries the loot to grant; a refusal says why ('gone': someone else was first). 'offline' when the room is out of reach.
   */
  async worldTake(id: string): Promise<WorldTakeResult> {
    if (!this.canWorld || !this.token || this.paused || !ROOM_DROP_ID.test(id)) return { ok: false, why: 'offline' };
    try {
      const response = await this.send(`${this.endpoint}/world/take`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ id }), signal: AbortSignal.timeout(6000),
      });
      if (response.status === 429) return { ok: false, why: 'busy' };
      if (!response.ok) return { ok: false, why: 'offline' };
      const r = await response.json() as WorldTakeResult;
      return r && typeof r === 'object' && (r.ok === true ? !!r.drop && r.drop.id === id : typeof r.why === 'string') ? r : { ok: false, why: 'offline' };
    } catch { return { ok: false, why: 'offline' }; }
  }
  /** The satchel could not hold what the room handed over: it lies on the ground again. */
  async worldReturn(id: string): Promise<boolean> {
    if (!this.canWorld || !this.token || !ROOM_DROP_ID.test(id)) return false;
    try {
      const response = await this.send(`${this.endpoint}/world/return`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ id }), signal: AbortSignal.timeout(6000),
      });
      return response.ok && (await response.json() as { ok?: boolean }).ok === true;
    } catch { return false; }
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
    // Claims also go to the room itself where it runs the world (protocol 7), party or not.
    if (!(this.canCoop || (verb === 'hits' && this.canWorld)) || !this.token || this.paused) return false;
    try {
      const response = await this.send(`${this.endpoint}/coop/${verb}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify(body), signal: AbortSignal.timeout(4000),
      });
      return response.ok;
    } catch { return false; }
  }
  // ── Protocol 6: trading and ground drops. The room relays; the trade Function commits (play/trade/trade-flow.ts). ──
  private tradeEvent(data: Record<string, unknown>): void {
    const type = data['type'];
    const ask = data['ask'] as RoomTradeAsk | undefined;
    if (type === 'trade-ask' && ask && typeof ask.id === 'string' && !(this.snapshot.tradeAsks ?? []).some(a => a.id === ask.id)) {
      this.publish({ tradeAsks: [...(this.snapshot.tradeAsks ?? []), ask].slice(-3) });
    }
    const t = data['trade'] as RoomTrade | undefined;
    if (type === 'trade' && t && typeof t.id === 'string' && (t.me === 'a' || t.me === 'b') && t.offers && t.accepted) this.publish({ trade: t, tradeAsks: [] });
    const end = data['end'] as RoomTradeEnd | undefined;
    if (type === 'trade-end' && end && typeof end.id === 'string') {
      if (this.snapshot.trade?.id === end.id) this.publish({ trade: null });
      this.options.onTradeEnd?.(end);
    }
    if (type === 'trade-note' && data['note']) this.options.onTradeNote?.(data['note'] as { kind: 'declined'; name: string });
    // Protocol 8: the room's commit of a settled trade; the room's word on this Keeper's drop.
    const commit = data['commit'] as RoomTradeCommit | undefined;
    if (type === 'trade-commit' && commit && typeof commit.id === 'string' && typeof commit.ok === 'boolean') this.options.onTradeCommit?.(commit);
    const gnote = data['note'] as RoomGroundNote | undefined;
    if (type === 'ground-note' && gnote && typeof gnote.id === 'string' && (gnote.kind === 'escrowed' || gnote.kind === 'returned')) this.options.onGroundNote?.(gnote);
    if (type === 'ground' && typeof data['area'] === 'string') {
      const area = data['area'] as string;
      const valid = (g: RoomGround) => g && typeof g.id === 'string' && Number.isFinite(g.x) && Number.isFinite(g.y) && typeof g.name === 'string';
      const held = this.snapshot.ground?.area === area ? this.snapshot.ground.items : [];
      let items = Array.isArray(data['items']) ? (data['items'] as RoomGround[]).filter(valid) : held;
      if (Array.isArray(data['add'])) items = [...items.filter(g => !(data['add'] as RoomGround[]).some(x => x.id === g.id)), ...(data['add'] as RoomGround[]).filter(valid)];
      if (Array.isArray(data['gone'])) items = items.filter(g => !(data['gone'] as string[]).includes(g.id));
      this.publish({ ground: { area, items: items.slice(-80) } });
    }
  }
  /** The room trades (protocol 6) and the Keeper is in it. */
  get canTrade(): boolean { return this.snapshot.connected && (this.snapshot.protocol ?? 0) >= TRADE_PROTOCOL; }
  async tradeAsk(to: string): Promise<string> { return this.tradeCall('trade/ask', { to }); }
  async tradeAnswer(askId: string, yes: boolean): Promise<string> {
    this.publish({ tradeAsks: (this.snapshot.tradeAsks ?? []).filter(a => a.id !== askId) });
    return this.tradeCall('trade/answer', { ask: askId, accept: yes });
  }
  forgetTradeAsk(askId: string): void { this.publish({ tradeAsks: (this.snapshot.tradeAsks ?? []).filter(a => a.id !== askId) }); }
  async tradeOffer(trade: string, items: OfferItem[], gold: number): Promise<string> { return this.tradeCall('trade/offer', { trade, items, gold }); }
  async tradeAccept(trade: string, rev: number, yes = true): Promise<string> { return this.tradeCall('trade/accept', { trade, rev, accept: yes }); }
  async tradeConfirm(trade: string, rev: number, done: boolean): Promise<string> { return this.tradeCall('trade/confirm', { trade, rev, done, ...this.characterField() }); }
  async tradeCancel(trade: string, why = '', outcome: 'cancelled' | 'void' = 'cancelled'): Promise<string> {
    if (this.snapshot.trade?.id === trade) this.publish({ trade: null });
    return this.tradeCall('trade/cancel', { trade, why, outcome });
  }
  // ── Protocol 8: the room settles and lays (docs/design/online.md §4d M2) ──
  /** The room settles this Keeper's trades and lays its drops (protocol 8, the trade core aboard, signed in). */
  get canSettle(): boolean { return this.canTrade && (this.snapshot.protocol ?? 0) >= ROOM_SETTLE_PROTOCOL && this.snapshot.settles === true && !this.snapshot.guest; }
  private characterField(): { character?: string } {
    try { const c = this.options.character?.() ?? ''; return CHARACTER_ID.test(c) ? { character: c } : {}; } catch { return {}; }
  }
  /**
   * Lay an item at this Keeper's feet: on this screen at once (pending), on everyone's when the room hears it; the room
   * escrows it behind (out of the save) and says so with a ground note. '' when the room took it, else its words.
   */
  async groundLay(g: { area: string; x: number; y: number; item: OfferItem }): Promise<{ why: string; ground?: RoomGround }> {
    if (!this.canSettle || !this.token) return { why: 'offline' };
    try {
      const response = await this.send(`${this.endpoint}/ground/drop`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ area: g.area, x: g.x, y: g.y, item: g.item }), signal: AbortSignal.timeout(8000),
      });
      const out = await response.json().catch(() => null) as { ground?: RoomGround; error?: unknown } | null;
      if (!response.ok || !out?.ground) return { why: typeof out?.error === 'string' && out.error ? out.error.slice(0, 160) : 'failed' };
      const laid = out.ground;
      if (this.snapshot.ground?.area === g.area && !this.snapshot.ground.items.some(x => x.id === laid.id)) this.publish({ ground: { area: g.area, items: [...this.snapshot.ground.items, laid] } });
      return { why: '', ground: laid };
    } catch { return { why: 'failed' }; }
  }
  /** This Keeper's save reached the cloud: an escrow waiting on it may land now (fire and forget). */
  groundSynced(id: string): void { void this.tradeCall('ground/synced', { id }); }
  /** Reach for a ground item: off this screen at once; the first Keeper the room hears wins; its pickup is committed. */
  async groundPick(area: string, id: string): Promise<RoomPick> {
    if (!this.canSettle || !this.token) return { ok: false, why: 'offline' };
    const held = this.snapshot.ground?.area === area ? this.snapshot.ground.items : [];
    const was = held.find(g => g.id === id);
    if (was) this.publish({ ground: { area, items: held.filter(g => g.id !== id) } });
    try {
      const response = await this.send(`${this.endpoint}/ground/pick`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ id }), signal: AbortSignal.timeout(15000),
      });
      const out = await response.json().catch(() => null) as { ok?: boolean; item?: unknown; why?: unknown; error?: unknown; ms?: number } | null;
      if (response.ok && out?.ok === true && typeof out.item === 'string') return { ok: true, item: out.item, ...(typeof out.ms === 'number' ? { ms: out.ms } : {}) };
      const code = (out as { code?: unknown } | null)?.code;
      return { ok: false, why: typeof out?.why === 'string' ? out.why : typeof out?.error === 'string' ? out.error : 'failed', ...(typeof code === 'string' ? { code } : {}) };
    } catch { return { ok: false, why: 'offline' }; }
  }
  /** How a trade the room settled ended (its commit's word never came: a dropped stream, a restarted room). */
  async tradeStatus(trade: string): Promise<RoomTradeStatus> {
    if (!this.canSettle || !this.token) return { status: 'offline' };
    try {
      const response = await this.send(`${this.endpoint}/trade/status`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ trade }), signal: AbortSignal.timeout(15000),
      });
      const out = await response.json().catch(() => null) as { status?: unknown; received?: { items?: unknown; gold?: unknown }; why?: unknown } | null;
      if (!response.ok || !out) return { status: 'offline' };
      if (out.status === 'done' && out.received && Array.isArray(out.received.items)) return { status: 'done', received: { items: out.received.items.filter((x): x is string => typeof x === 'string'), gold: Number(out.received.gold) || 0 } };
      return { status: out.status === 'void' ? 'void' : 'unknown', ...(typeof out.why === 'string' ? { why: out.why } : {}) };
    } catch { return { status: 'offline' }; }
  }
  /** Tell the area what this Keeper's drop put on the ground (the room checks the escrow first). */
  async groundDrop(g: { id: string; area: string; x: number; y: number; name: string; rarity: string; def: string }): Promise<string> { return this.tradeCall('ground/drop', g); }
  /** An item is gone from the ground (picked up, or found gone): it leaves everyone's screen. */
  async groundTake(area: string, id: string): Promise<string> {
    if (this.snapshot.ground?.area === area) this.publish({ ground: { area, items: this.snapshot.ground.items.filter(g => g.id !== id) } });
    return this.tradeCall('ground/take', { area, id });
  }
  private async tradeCall(path: string, body: unknown): Promise<string> {
    if (!this.canTrade || !this.token) return 'offline';
    try {
      const response = await this.send(`${this.endpoint}/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
      });
      if (response.ok) return '';
      const said = await response.json().catch(() => null) as { error?: unknown } | null;
      return typeof said?.error === 'string' && said.error ? said.error.slice(0, 160) : 'failed';
    } catch { return 'failed'; }
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
    if (since < (this.canCoop || this.canWorld ? COOP_MOVE_MS : MOVE_MS)) return;
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
