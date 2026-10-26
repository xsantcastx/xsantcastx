/**
 * trade-flow.ts — the client's half of a trade and of a ground drop: what happens between the window's buttons, the
 * Hearth (which relays) and the trade Function (which commits: functions-game/src/trade-core.ts). Plain classes, no
 * Angular: the HUD owns one of each, the karma spec drives them with fakes.
 *
 * A trade, from this Keeper's side:
 *   open      the window is up; offers go to the room (any change clears both Accepts there)
 *   confirm   both accepted the same revision: Confirm is offered
 *   sending   this Keeper pressed Confirm: the save is pushed, then the Function is asked to execute these terms
 *   waiting   the Function recorded our confirmation; the other Keeper has not confirmed yet
 *   settling  the Function swapped everything: this save is re-read from the cloud (the server's write is adopted)
 *   done / failed
 * A trade window that closes with this Keeper's confirmation on record (cancel, walk away, the other one leaving)
 * tells the Function `cancel`, so that confirmation can never complete later.
 *
 * Protocol 8 (a trade the room settles, `RoomTrade.room`): Accept pushes the save first (the room reads both saves the
 * moment both accept); Confirm goes to the room only. When both have confirmed, the room settles from memory and closes
 * both windows at once with what each receives (`done`); its ONE Firestore commit follows, and only then is the save
 * re-read (the commit is the truth: if it does not land, the window says so and nothing moved). A commit's word that
 * never comes (a dropped stream, a restarted room) is asked for again after COMMIT_WAIT_MS.
 */
import type { RoomGround, RoomGroundNote, RoomPick, RoomTrade, RoomTradeCommit, RoomTradeEnd, RoomTradeStatus } from '../social/social-room';
import { canonical, type OfferItem, type Terms } from './trade-items';

/** Where the trade Function lives and how this save reaches the cloud (real: trade-backend.ts; specs: a fake). */
export interface TradeBackend {
  /** Why this device cannot trade right now, or null: 'signin' (a guest) or 'lease' (another device holds the save). */
  blocked(): 'signin' | 'lease' | 'connecting' | null;
  /** This device's character (character-scope.ts): which save the Function reads. */
  readonly character: string;
  /** Push everything this device holds to the cloud, awaited (the Function checks the cloud's copy). */
  prepare(): Promise<void>;
  /** One Function verb. */
  call(verb: 'execute' | 'cancel' | 'drop' | 'pickup', body: unknown): Promise<{ status: number; body: Record<string, unknown> }>;
  /** Re-read this save from the cloud and adopt it (the Function wrote it). */
  settle(): Promise<void>;
}
/** The room verbs a trade uses (SocialRoom's). */
export interface TradeRoom {
  tradeConfirm(trade: string, rev: number, done: boolean): Promise<string>;
  tradeCancel(trade: string, why?: string, outcome?: 'cancelled' | 'void'): Promise<string>;
  groundDrop(g: { id: string; area: string; x: number; y: number; name: string; rarity: string; def: string }): Promise<string>;
  groundTake(area: string, id: string): Promise<string>;
  /** Protocol 8: the room settles and lays (absent or false: protocol 6's Function path). */
  canSettle?(): boolean;
  tradeStatus?(trade: string): Promise<RoomTradeStatus>;
  groundLay?(g: { area: string; x: number; y: number; item: OfferItem }): Promise<{ why: string; ground?: RoomGround }>;
  groundSynced?(id: string): void;
  groundPick?(area: string, id: string): Promise<RoomPick>;
}
/** How long a settled trade waits for its commit's word before it asks the room again (ms). */
export const COMMIT_WAIT_MS = 8000;

export type TradeStage = 'idle' | 'open' | 'confirm' | 'sending' | 'waiting' | 'settling' | 'done' | 'failed';
export interface TradeStatus { stage: TradeStage; why: string; received: { items: string[]; gold: number } | null }

/** The terms both windows confirm: the two offers exactly as the room relays them (same order, same fields). */
export function termsOf(t: RoomTrade): Terms { return { a: t.offers.a, b: t.offers.b }; }

export class TradeFlow {
  status: TradeStatus = { stage: 'idle', why: '', received: null };
  /** The trade this flow is about, and whether our confirmation is on record at the Function. */
  private tradeId = '';
  private confirmedKey = '';
  private settled = false;
  private asking = false;
  /** Protocol 8: a settled trade waiting on its commit (and the timer that asks again). */
  private committing = '';
  private commitTimer?: ReturnType<typeof setTimeout>;
  constructor(private readonly backend: TradeBackend, private readonly room: TradeRoom, private readonly changed: () => void = () => {}, private readonly commitWaitMs = COMMIT_WAIT_MS) {}

  private set(stage: TradeStage, why = '', received: TradeStatus['received'] = this.status.received): void {
    this.status = { stage, why, received };
    this.changed();
  }

  /** The room's view of the window changed (or appeared). */
  view(t: RoomTrade | null): void {
    if (!t) return;
    if (t.id !== this.tradeId) { this.tradeId = t.id; this.confirmedKey = ''; this.settled = false; this.set('open', '', null); }
    if (this.status.stage === 'open' || this.status.stage === 'confirm') this.set(t.stage === 'confirm' ? 'confirm' : 'open', this.status.why);
    // Waiting, and the other Keeper confirmed too: ask the Function again (idempotent) — it is done, or it says why not.
    const other = t.me === 'a' ? 'b' : 'a';
    if (this.status.stage === 'waiting' && t.confirmed[other] && !this.asking && !t.room) {
      this.asking = true;
      void this.execute(t, false).finally(() => { this.asking = false; });
    }
  }

  /** Protocol 8: Accept on a trade the room settles pushes this save first (the room reads it once both accept). */
  async beforeAccept(t: RoomTrade): Promise<boolean> {
    if (!t.room) return true;
    const blocked = this.backend.blocked();
    if (blocked) { this.set(this.status.stage, blocked); return false; }
    try { await this.backend.prepare(); return true; } catch { this.set(this.status.stage, 'offline'); return false; }
  }

  /** Confirm: push the save, then ask the Function to execute exactly these terms (protocol 8: tell the room). */
  async confirm(t: RoomTrade): Promise<void> {
    if (t.stage !== 'confirm' || (this.status.stage !== 'confirm' && this.status.stage !== 'open')) return;
    const blocked = this.backend.blocked();
    if (blocked) { this.set(this.status.stage, blocked); return; }
    if (t.room) {
      // The room holds both offers and both consents: the save went up on Accept; one word settles it.
      this.set('sending');
      const why = await this.room.tradeConfirm(t.id, t.rev, false);
      if (why) { this.set('confirm', why); return; }
      if ((this.status.stage as TradeStage) === 'sending') this.set('waiting');
      return;
    }
    this.set('sending');
    try { await this.backend.prepare(); } catch { this.set('confirm', 'offline'); return; }
    await this.execute(t, true);
  }

  private async execute(t: RoomTrade, first: boolean): Promise<void> {
    const terms = termsOf(t);
    this.confirmedKey = canonical(terms);
    let res: { status: number; body: Record<string, unknown> };
    try { res = await this.backend.call('execute', { trade: t.id, character: this.backend.character, terms }); }
    catch { if (first) this.set('confirm', 'offline'); return; }
    const out = res.body;
    if (res.status !== 200) {
      // Refused outright (not ours, not open, malformed): the window closes with the Function's words.
      const why = typeof out['error'] === 'string' ? out['error'] : 'failed';
      this.set('failed', why); void this.room.tradeCancel(t.id, why, 'void'); return;
    }
    if (out['status'] === 'waiting') {
      this.set('waiting');
      if (first) void this.room.tradeConfirm(t.id, t.rev, false);
      return;
    }
    if (out['status'] === 'done') { await this.finish(out['received'] as TradeStatus['received'], t.id, t.rev, true); return; }
    const why = typeof out['why'] === 'string' ? out['why'] : 'failed';
    this.set('failed', why);
    void this.room.tradeCancel(t.id, why, 'void');
  }

  /** The swap happened: adopt the server's write, then tell the room (which closes both windows). */
  private async finish(received: TradeStatus['received'], tradeId: string, rev: number, tellRoom: boolean): Promise<void> {
    if (this.settled) return;
    this.settled = true;
    this.set('settling', '', received);
    try { await this.backend.settle(); } catch { /* the next pull adopts it: the move is already in the cloud */ }
    if (tellRoom) void this.room.tradeConfirm(tradeId, rev, true);
    this.set('done', '', received);
  }

  /** The room closed the window. */
  async ended(end: RoomTradeEnd, last: RoomTrade | null): Promise<void> {
    if (end.id !== this.tradeId) return;
    if (end.settled && end.outcome === 'done') {
      // Protocol 8: settled in memory — the result shows now; the save is re-read when the commit lands.
      this.committing = end.id;
      this.set('done', '', end.received ?? null);
      clearTimeout(this.commitTimer);
      this.commitTimer = setTimeout(() => { void this.askStatus(end.id); }, this.commitWaitMs);
      return;
    }
    const mine = this.status.stage === 'waiting' || this.status.stage === 'sending';
    if (end.outcome === 'done' && mine && last) {
      // The other Keeper's confirmation completed it: learn what arrived and adopt it.
      try {
        const res = await this.backend.call('execute', { trade: end.id, character: this.backend.character, terms: termsOf(last) });
        if (res.body['status'] === 'done') { await this.finish(res.body['received'] as TradeStatus['received'], end.id, last.rev, false); return; }
      } catch { /* fall through: settle anyway */ }
      await this.finish(null, end.id, last.rev, false);
      return;
    }
    if (end.outcome === 'done') return;
    // Our confirmation is on record at the Function: withdraw it so it can never complete later.
    if (this.confirmedKey && this.status.stage !== 'done') await this.backend.call('cancel', { trade: end.id }).catch(() => null);
    if (this.status.stage !== 'done' && this.status.stage !== 'failed') this.set('failed', end.why || end.outcome);
  }

  /** Protocol 8: the room's commit of the settled trade: adopt the save on a yes; on a no, nothing moved — say so. */
  async committed(c: RoomTradeCommit): Promise<void> {
    if (c.id !== this.committing) return;
    this.committing = '';
    clearTimeout(this.commitTimer);
    if (c.ok) { this.set('done', '', c.received ?? this.status.received); try { await this.backend.settle(); } catch { /* the next pull adopts it */ } return; }
    this.set('failed', c.why || 'failed', null);
  }
  /** Protocol 8: the commit's word never came: ask the room (it reads the trade's own record) how it ended. */
  private async askStatus(id: string): Promise<void> {
    if (id !== this.committing || !this.room.tradeStatus) return;
    const out = await this.room.tradeStatus(id);
    if (id !== this.committing) return;
    if (out.status === 'done') { await this.committed({ id, ok: true, received: out.received }); return; }
    if (out.status === 'void') { await this.committed({ id, ok: false, why: out.why ?? 'failed' }); return; }
    // The room cannot say yet (offline, restarting): ask again a little later.
    this.commitTimer = setTimeout(() => { void this.askStatus(id); }, this.commitWaitMs);
  }
  /** Protocol 8: the room came back (a new stream): a settled trade still waiting on its commit asks at once. */
  resumed(): void { if (this.committing) { clearTimeout(this.commitTimer); void this.askStatus(this.committing); } }

  /** This Keeper's Cancel (the window's ×, Esc). */
  async cancel(t: RoomTrade | null, why = ''): Promise<void> {
    if (!t) return;
    if (this.confirmedKey) await this.backend.call('cancel', { trade: t.id }).catch(() => null);
    await this.room.tradeCancel(t.id, why);
    this.set('idle');
  }

  /** The window is put away after done/failed. */
  reset(): void {
    // A settled trade still waiting on its commit keeps waiting (the window is only put away): its answer re-reads the save.
    this.tradeId = ''; this.confirmedKey = ''; this.settled = false; this.set('idle', '', null);
  }
}

// ── Ground drops ────────────────────────────────────────────────────────────────────────────────────────────────
export type GroundResult = { ok: true; id: string } | { ok: false; why: string };

/**
 * Drop and pick up: escrow through the Function, presence through the room. One request at a time.
 *
 * Protocol 8 (the room lays and picks): a drop is on the ground the moment the room hears it — the save is pushed
 * behind it and the room told (`groundSynced`), and the room's ground note says when it is escrowed (the save is
 * re-read: the item has left it) or handed back. A pick is off the screen at once; the room's answer comes after its
 * one pickup transaction, and the save is re-read for what arrived.
 */
export class GroundFlow {
  busy = false;
  /** Protocol 8: this Keeper's drops the room has not escrowed yet: ground id → item id. */
  readonly pending = new Map<string, string>();
  constructor(private readonly backend: TradeBackend, private readonly room: TradeRoom) {}

  /** Put a satchel item on the ground at the Keeper's feet. */
  async drop(item: OfferItem, at: { area: string; x: number; y: number }): Promise<GroundResult> {
    const blocked = this.backend.blocked();
    if (blocked) return { ok: false, why: blocked };
    if (this.room.canSettle?.() && this.room.groundLay) {
      // The satchel lets go the instant the drop is asked for, not a round trip later; a refusal hands it back.
      const pre = `pre:${item.id}`;
      this.pending.set(pre, item.id);
      let laid: Awaited<ReturnType<NonNullable<TradeRoom['groundLay']>>>;
      try { laid = await this.room.groundLay({ area: at.area, x: at.x, y: at.y, item }); } finally { this.pending.delete(pre); }
      if (laid.why || !laid.ground) return { ok: false, why: laid.why || 'failed' };
      const id = laid.ground.id;
      this.pending.set(id, item.id);
      // Behind it: the save goes up (an item just picked up may not be in the cloud yet), and the room is told.
      void this.backend.prepare().then(() => this.room.groundSynced?.(id), () => this.room.groundSynced?.(id));
      return { ok: true, id };
    }
    if (this.busy) return { ok: false, why: 'busy' };
    this.busy = true;
    try {
      await this.backend.prepare();
      const res = await this.backend.call('drop', { character: this.backend.character, area: at.area, item, x: at.x, y: at.y });
      if (res.status !== 200 || res.body['status'] !== 'dropped') return { ok: false, why: typeof res.body['error'] === 'string' ? res.body['error'] : 'failed' };
      const g = res.body['ground'] as { id: string; x: number; y: number };
      await this.backend.settle().catch(() => {});
      await this.room.groundDrop({ id: g.id, area: at.area, x: g.x, y: g.y, name: item.name, rarity: item.rarity, def: item.def });
      return { ok: true, id: g.id };
    } catch { return { ok: false, why: 'offline' }; } finally { this.busy = false; }
  }

  /** Protocol 8: the room's word on a drop: escrowed → re-read the save (the item has left it); handed back → it stays. */
  async noted(note: RoomGroundNote): Promise<void> {
    this.pending.delete(note.id);
    if (note.kind === 'escrowed') await this.backend.settle().catch(() => {});
  }
  /** Is this satchel item on its way to the ground (laid, not yet escrowed)? */
  isPending(itemId: string): boolean { for (const v of this.pending.values()) if (v === itemId) return true; return false; }

  /** Reach for a ground item: one picker wins; the loser's screen just loses it. */
  async pickup(g: RoomGround): Promise<GroundResult> {
    const blocked = this.backend.blocked();
    if (blocked) return { ok: false, why: blocked };
    if (this.room.canSettle?.() && this.room.groundPick) {
      let out = await this.room.groundPick(g.area, g.id);
      // This save is not in the cloud yet (a first sign-in, a save from an older build): push it and reach again once.
      if (!out.ok && (out.code === 'no-save' || out.code === 'stale-save')) {
        try { await this.backend.prepare(); } catch { return { ok: false, why: out.why }; }
        out = await this.room.groundPick(g.area, g.id);
      }
      if (!out.ok) return { ok: false, why: out.why };
      await this.backend.settle().catch(() => {});
      return { ok: true, id: out.item };
    }
    if (this.busy) return { ok: false, why: 'busy' };
    this.busy = true;
    try {
      await this.backend.prepare();
      const res = await this.backend.call('pickup', { character: this.backend.character, ground: g.id });
      if (res.status !== 200) return { ok: false, why: typeof res.body['error'] === 'string' ? res.body['error'] : 'failed' };
      if (res.body['status'] === 'picked') {
        await this.backend.settle().catch(() => {});
        await this.room.groundTake(g.area, g.id);
        return { ok: true, id: String(res.body['item']) };
      }
      await this.room.groundTake(g.area, g.id);
      return { ok: false, why: typeof res.body['why'] === 'string' ? res.body['why'] : 'gone' };
    } catch { return { ok: false, why: 'offline' }; } finally { this.busy = false; }
  }
}
