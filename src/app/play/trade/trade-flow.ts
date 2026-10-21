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
 */
import type { RoomGround, RoomTrade, RoomTradeEnd } from '../social/social-room';
import { canonical, type OfferItem, type Terms } from './trade-items';

/** Where the trade Function lives and how this save reaches the cloud (real: trade-backend.ts; specs: a fake). */
export interface TradeBackend {
  /** Why this device cannot trade right now, or null: 'signin' (a guest) or 'lease' (another device holds the save). */
  blocked(): 'signin' | 'lease' | null;
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
}

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
  constructor(private readonly backend: TradeBackend, private readonly room: TradeRoom, private readonly changed: () => void = () => {}) {}

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
    if (this.status.stage === 'waiting' && t.confirmed[other] && !this.asking) {
      this.asking = true;
      void this.execute(t, false).finally(() => { this.asking = false; });
    }
  }

  /** Confirm: push the save, then ask the Function to execute exactly these terms. */
  async confirm(t: RoomTrade): Promise<void> {
    if (t.stage !== 'confirm' || (this.status.stage !== 'confirm' && this.status.stage !== 'open')) return;
    const blocked = this.backend.blocked();
    if (blocked) { this.set(this.status.stage, blocked === 'signin' ? 'signin' : 'lease'); return; }
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

  /** This Keeper's Cancel (the window's ×, Esc). */
  async cancel(t: RoomTrade | null, why = ''): Promise<void> {
    if (!t) return;
    if (this.confirmedKey) await this.backend.call('cancel', { trade: t.id }).catch(() => null);
    await this.room.tradeCancel(t.id, why);
    this.set('idle');
  }

  /** The window is put away after done/failed. */
  reset(): void { this.tradeId = ''; this.confirmedKey = ''; this.settled = false; this.set('idle', '', null); }
}

// ── Ground drops ────────────────────────────────────────────────────────────────────────────────────────────────
export type GroundResult = { ok: true; id: string } | { ok: false; why: string };

/** Drop and pick up: escrow through the Function, presence through the room. One request at a time. */
export class GroundFlow {
  busy = false;
  constructor(private readonly backend: TradeBackend, private readonly room: TradeRoom) {}

  /** Put a satchel item on the ground at the Keeper's feet. */
  async drop(item: OfferItem, at: { area: string; x: number; y: number }): Promise<GroundResult> {
    const blocked = this.backend.blocked();
    if (blocked) return { ok: false, why: blocked };
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

  /** Reach for a ground item: one picker wins; the loser's screen just loses it. */
  async pickup(g: RoomGround): Promise<GroundResult> {
    const blocked = this.backend.blocked();
    if (blocked) return { ok: false, why: blocked };
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
