/**
 * trade-hud.component.ts — the trade window (Tibia / Diablo II: two sides, Accept, then Confirm), the "wants to
 * trade" toast, and ground drops (Drop on a card, or drag a satchel item onto the world; tap an item on the ground to
 * pick it up). docs/design/online.md §3.8 and §4c.
 *
 * Kept out of the HUD component on purpose: the HUD hands in the room, its snapshot, the engine and a card builder
 * (its own item cards, so an offered item looks exactly like it does in the satchel), and gets lines back to log.
 * Everything that moves an item goes through trade-flow.ts → the trade Function; the room only relays.
 */
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject } from '@angular/core';
import { EconomyService } from '../../shared/economy/economy.service';
import { InventoryService } from '../../shared/rpg/inventory.service';
import type { GameItem } from '../../shared/rpg/item.model';
import { itemArt } from '../../shared/rpg/material-catalog';
import { TranslationService } from '../../translation.service';
import type { RoomGround, RoomGroundNote, RoomSnapshot, RoomTrade, RoomTradeAsk, RoomTradeCommit, RoomTradeEnd, SocialRoom } from '../social/social-room';
import { TradeBackendService } from './trade-backend.service';
import { GroundFlow, TradeFlow } from './trade-flow';
import { TRADE_MAX_GOLD, TRADE_MAX_ITEMS, groupOffers, satchelGroups, itemFromOffer, offerItemOf, stackOfferOf, tradeBlock, type OfferItem } from './trade-items';
import { TRADE_I18N } from './trade.i18n';
import { DropTargetDirective } from '../../shared/inventory-grid/drop-target.directive';
import { ItemDragService, type DragHeld, type DropTarget } from '../../shared/inventory-grid/item-drag.service';
import { footprintOf } from '../../shared/rpg/item-footprint';
import { pieceLookOf } from '../../shared/inventory-grid/piece-look';
import { slotClassOf } from '../../shared/rpg/inventory-layout';
import type { GridView, Piece } from '../../shared/rpg/inventory-grid';

/** An item's card as the HUD draws it in the satchel (name, what it is, its lines, how it compares). */
export interface TradeCard { name: string; kicker: string; tone?: string | null; note: string; stats: string[]; compare?: { label?: string; text?: string }[]; compareLabel?: string }
/** The engine's part (td-engine): where the Keeper stands, and the shared ground to draw. */
interface GroundEngine {
  peerPresence?: () => { area: string; x: number; y: number };
  /** The tile centre at the Keeper's feet where the next drop lands (td-ground-pile.ts: a pile grows there). */
  dropSpot?: () => { x: number; y: number };
  setSharedGround?: (items: readonly RoomGround[]) => void;
}
/**
 * One entry in a window: a single item, a pile of identical ones, or a stack (`sk`), with how many (`qty`) — the satchel's
 * own grouping, so a stack of 5 potions is one entry ×5, never five, and never missing (owner 2026-10-27).
 */
interface Cell { id: string; name: string; art: string; mark: string; tone: string; item: GameItem | null; block?: string | null; qty: number; ids: string[]; sk?: string }

const tone = (rarity: string) => `var(--cozy-loot-${rarity}, var(--cozy-loot-common))`;
const mark = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '·';

@Component({
  selector: 'app-trade-hud',
  standalone: true,
  imports: [DropTargetDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trade-hud.component.html',
  styleUrl: './trade-hud.component.css',
})
export class TradeHudComponent implements OnChanges, OnDestroy {
  @Input() room?: SocialRoom;
  @Input() social: RoomSnapshot | null = null;
  @Input() engine: unknown;
  @Input() cardFor: ((item: GameItem) => TradeCard) | null = null;
  /** A satchel stack's card (its satchel card), or null for a kind this Keeper does not hold. */
  @Input() stackCardFor: ((stackKey: string) => TradeCard | null) | null = null;
  /** A line for the Game log (and the message strip). */
  @Output() readonly said = new EventEmitter<string>();

  private readonly i18n = inject(TranslationService);
  private readonly inventory = inject(InventoryService);
  private readonly economy = inject(EconomyService);
  private readonly backend = inject(TradeBackendService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly drag = inject(ItemDragService);
  private readonly roomVerbs = {
    tradeConfirm: (t: string, rev: number, done: boolean) => this.room?.tradeConfirm(t, rev, done) ?? Promise.resolve('offline'),
    tradeCancel: (t: string, why?: string, outcome?: 'cancelled' | 'void') => this.room?.tradeCancel(t, why, outcome) ?? Promise.resolve('offline'),
    groundDrop: (g: Parameters<SocialRoom['groundDrop']>[0]) => this.room?.groundDrop(g) ?? Promise.resolve('offline'),
    groundTake: (area: string, id: string) => this.room?.groundTake(area, id) ?? Promise.resolve('offline'),
    // Protocol 8: the room settles trades and lays drops itself.
    canSettle: () => !!this.room?.canSettle,
    tradeStatus: (t: string) => this.room?.tradeStatus(t) ?? Promise.resolve({ status: 'offline' as const }),
    groundLay: (g: Parameters<SocialRoom['groundLay']>[0]) => this.room?.groundLay(g) ?? Promise.resolve({ why: 'offline' }),
    groundSynced: (id: string) => this.room?.groundSynced(id),
    groundPick: (area: string, id: string) => this.room?.groundPick(area, id) ?? Promise.resolve({ ok: false as const, why: 'offline' }),
  };
  readonly flow = new TradeFlow(this.backend, this.roomVerbs, () => this.cdr.markForCheck());
  readonly groundFlow = new GroundFlow(this.backend, this.roomVerbs, id => { if (this.inventory.itemById(id)) this.inventory.drop(id); });
  readonly maxItems = TRADE_MAX_ITEMS;

  /** The last trade window the room showed (kept while a closed trade's outcome is on screen). */
  trade: RoomTrade | null = null;
  /** The card shown for the item under the pointer (or last tapped). */
  card: { card: TradeCard; left: number; top: number } | null = null;
  goldDraft = 0;
  busy = false;
  /** The "how many?" bar for a pile or a stack (Split): which entry, and the amount chosen (all of it to start). */
  amount: { cell: Cell; n: number } | null = null;
  private goldTimer?: ReturnType<typeof setTimeout>;
  private askTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    this.i18n.register(TRADE_I18N);
    // The satchel and the purse move under the window (a trade settling, a drop): redraw.
    this.inventory.snapshot$.pipe(takeUntilDestroyed()).subscribe(() => this.cdr.markForCheck());
    this.economy.snapshot$.pipe(takeUntilDestroyed()).subscribe(() => this.cdr.markForCheck());
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  ngOnChanges(): void {
    const s = this.social;
    const live = s?.trade ?? null;
    if (live) {
      if (live.id !== this.trade?.id) { this.flow.reset(); this.goldDraft = live.offers[live.me].gold; }
      this.trade = live;
      this.flow.view(live);
    }
    for (const a of s?.tradeAsks ?? []) {
      if (this.askTimers.has(a.id)) continue;
      this.askTimers.set(a.id, setTimeout(() => this.room?.forgetTradeAsk(a.id), Math.max(1000, Math.min(30000, a.until - Date.now()))));
    }
    // The ground here, for the engine to draw (only the current area's).
    const e = this.engine as GroundEngine | undefined;
    const here = e?.peerPresence?.();
    const g = s?.ground;
    e?.setSharedGround?.(g && here && g.area === here.area ? g.items : []);
  }
  ngOnDestroy(): void { clearTimeout(this.goldTimer); for (const t of this.askTimers.values()) clearTimeout(t); }

  // ── Asking ──
  get ask(): RoomTradeAsk | null { return this.trade ? null : this.social?.tradeAsks?.[0] ?? null; }
  /** "Trade" on a Keeper's card: what it should show — the button, a sign-in note, or nothing (an older room). */
  canAsk(peerId: string): 'yes' | 'guest' | 'later' | 'no' {
    const s = this.social;
    if (!s?.connected) return 'no';
    if ((s.protocol ?? 0) < 6) return 'later';
    if (s.guest || s.players.find(p => p.id === peerId)?.guest) return 'guest';
    return this.trade ? 'no' : 'yes';
  }
  async askTrade(peer: { id: string; name: string }): Promise<void> {
    const why = await this.room?.tradeAsk(peer.id) ?? 'offline';
    this.said.emit(why ? this.t('trade.askFailed', { why }) : this.t('trade.asked', { name: peer.name }));
  }
  async answer(ask: RoomTradeAsk, yes: boolean): Promise<void> {
    clearTimeout(this.askTimers.get(ask.id));
    const why = await this.room?.tradeAnswer(ask.id, yes) ?? 'offline';
    if (yes && why) this.said.emit(this.t('trade.askFailed', { why }));
  }
  /** The room told us a request was declined. */
  declined(name: string): void { this.said.emit(this.t('trade.declined', { name })); }

  // ── The window ──
  get open(): boolean { return !!this.trade; }
  get other(): 'a' | 'b' { return this.trade?.me === 'a' ? 'b' : 'a'; }
  get theirName(): string { return this.trade ? this.trade[this.other].name : ''; }
  get mine(): OfferItem[] { return this.trade ? this.trade.offers[this.trade.me].items : []; }
  get theirs(): OfferItem[] { return this.trade ? this.trade.offers[this.other].items : []; }
  get locked(): boolean { const t = this.trade; return !t || t.confirmed.a || t.confirmed.b || !['open', 'confirm'].includes(this.flow.status.stage); }
  get purse(): number { return Math.floor(this.economy.snapshot.gold); }
  /**
   * The WHOLE satchel as its grid holds it (inventory-grid.ts), in grid order: every instance pile and every stack, one
   * entry per kind with its count, what is already offered taken off. A pile of identical things is one entry, a stack
   * one entry with its total. What cannot be traded stays listed, greyed, saying why (worn, bound, kept tools, quest
   * finds). It used to read `snapshot.bag` — the gear instances alone, one cell each — so every stack was missing and
   * every pile came apart.
   */
  get satchel(): Cell[] {
    const snap = this.inventory.snapshot, grid = snap.grid.bag, mine = this.mine;
    const pending = grid.pieces.concat(grid.held).flatMap(p => p.ids).filter(id => this.groundFlow.isPending(id)).join(',');
    const memo = this.satchelMemo;
    if (memo && memo.grid === grid && memo.mine === mine && memo.pending === pending && memo.stacks === snap.stacks) return memo.cells;
    const cells = this.satchelCells(grid, mine);
    this.satchelMemo = { grid, mine, pending, stacks: snap.stacks, cells };
    return cells;
  }
  private satchelMemo: { grid: GridView; mine: OfferItem[]; pending: string; stacks: unknown; cells: Cell[] } | null = null;
  private satchelCells(grid: GridView, mine: OfferItem[]): Cell[] {
    const snap = this.inventory.snapshot;
    const quest = snap.stacks.filter(st => slotClassOf(st.stackKey) === 'quest');
    const out: Cell[] = [];
    for (const g of satchelGroups(grid, quest, mine, id => this.groundFlow.isPending(id))) {
      if (g.sk) { out.push({ ...this.stackCell(g.sk, g.qty), ...(g.quest ? { block: 'quest' } : {}) }); continue; }
      const item = snap.items.find(i => i.id === g.ids[0]);
      if (item) out.push({ ...this.cell(item), ids: g.ids, qty: g.qty, block: tradeBlock(item) });
    }
    return out;
  }
  /** A window's offers as entries: a stack once with its amount, identical instances once with every id. */
  cellsOf(items: OfferItem[]): Cell[] {
    return groupOffers(items).map(g => (g.first.sk
      ? this.stackCell(g.first.sk, g.qty, g.first.name)
      : { ...this.cell(itemFromOffer(g.first)), ids: g.ids, qty: g.qty }));
  }
  private cell(item: GameItem): Cell {
    return { id: item.id, name: (item.upgradeLevel ?? 0) > 0 ? `${item.name} +${item.upgradeLevel}` : item.name, art: itemArt(item)?.src ?? '', mark: mark(item.name), tone: tone(item.rarity), item, ids: [item.id], qty: 1 };
  }
  private stackCell(sk: string, qty: number, offeredName = ''): Cell {
    const piece: Piece = { key: `s:${sk}#0`, kind: 'stack', ids: [], storeKey: sk, stackKey: sk, pile: 0, qty, w: 1, h: 1, cell: -1, pileKey: null, rev: null };
    const look = pieceLookOf(this.inventory.snapshot, piece);
    const name = (look.name && look.name !== sk ? look.name : offeredName) || look.name || sk;
    return { id: `stack:${sk}`, name, art: look.art, mark: look.mark, tone: look.tone ?? tone('common'), item: null, qty, ids: [`stack:${sk}`], sk };
  }
  emptySlots(n: number): number[] { return Array.from({ length: Math.max(0, Math.min(TRADE_MAX_ITEMS, 4) - n) }, (_, i) => i); }

  /** The window is a drop target: a satchel item dragged onto it is offered (docs/design/inventory-grid.md §3). */
  readonly offerTarget: DropTarget = {
    accepts: (held: DragHeld) => !this.locked && held.ref.kind === 'instance' && !!held.item && (held.from === 'b' || held.from === 'held') && !tradeBlock(held.item),
    drop: (held: DragHeld) => {
      if (!held.item) return false;
      const id = held.item.id;
      void this.add(this.satchel.find(c => c.ids.includes(id)) ?? this.cell(held.item));
      return true;
    },
  };

  /** The window's own satchel cells are the satchel too: a drag from one onto "You offer" (or the window) offers it. */
  pressBag(ev: PointerEvent, c: Cell): void {
    if (c.block || this.locked || !c.item) return;
    const fp = footprintOf(c.item);
    this.drag.press(ev, {
      ref: { kind: 'instance', ids: [c.id] }, from: 'b', w: fp.w, h: fp.h, grabDx: 0, grabDy: 0,
      name: c.name, art: c.art, mark: c.mark, tone: c.tone, qty: 1, item: c.item,
    });
  }

  /** Offer an entry: one thing at once; a pile or a stack asks how many first (all of it to start). */
  async add(c: Cell): Promise<void> {
    const t = this.trade;
    if (!t || this.locked || c.block) return;
    if (c.qty > 1) { this.amount = { cell: c, n: c.qty }; this.cdr.markForCheck(); this.showAmount(); return; }
    await this.offer(c, 1);
  }
  /** Offer `n` of an entry: a stack as one offer of n (joining what is already offered), a pile as n of its pieces. */
  async offer(c: Cell, n: number): Promise<void> {
    if (!this.trade || this.locked || c.block) return;
    n = Math.max(1, Math.min(c.qty, Math.floor(n) || 1));
    let next: OfferItem[];
    if (c.sk) {
      const had = this.mine.find(o => o.sk === c.sk);
      const entry = stackOfferOf(c.sk, c.name, (had?.qty ?? 0) + n);
      next = had ? this.mine.map(o => (o === had ? entry : o)) : [...this.mine, entry];
    } else {
      const items = c.ids.slice(0, n).map(id => (c.item?.id === id ? c.item : this.inventory.itemById(id))).filter((i): i is GameItem => !!i);
      next = [...this.mine, ...items.map(offerItemOf)];
    }
    if (next.length > TRADE_MAX_ITEMS) { this.said.emit(this.t('trade.full', { n: TRADE_MAX_ITEMS })); return; }
    this.amount = null;
    await this.sendOffer(next, this.goldDraft);
  }
  setAmount(raw: string | number): void {
    const a = this.amount;
    if (!a) return;
    a.n = Math.max(1, Math.min(a.cell.qty, Math.floor(Number(raw) || 1)));
    this.cdr.markForCheck();
  }
  stepAmount(by: number): void { if (this.amount) this.setAmount(this.amount.n + by); }
  confirmAmount(): void { const a = this.amount; if (a) void this.offer(a.cell, a.n); }
  closeAmount(): void { this.amount = null; this.cdr.markForCheck(); }
  /** The bar opens under the entry's list; on a phone the list may be scrolled away from it. */
  private showAmount(): void {
    if (typeof document === 'undefined') return;
    setTimeout(() => document.querySelector('[data-trade-amount]')?.scrollIntoView?.({ block: 'nearest' }), 0);
  }
  /** Take an entry back: all of it (every piece of a pile, the whole amount of a stack). */
  async remove(c: Cell): Promise<void> {
    if (!this.trade || this.locked) return;
    const ids = new Set(c.ids);
    await this.sendOffer(this.mine.filter(i => !ids.has(i.id)), this.goldDraft);
  }
  setGold(raw: string | number): void {
    const n = Math.max(0, Math.min(this.purse, TRADE_MAX_GOLD, Math.floor(Number(raw) || 0)));
    this.goldDraft = n;
    clearTimeout(this.goldTimer);
    this.goldTimer = setTimeout(() => { if (this.trade && n !== this.trade.offers[this.trade.me].gold) void this.sendOffer(this.mine, n); }, 350);
  }
  private async sendOffer(items: OfferItem[], gold: number): Promise<void> {
    const t = this.trade;
    if (!t) return;
    const why = await this.room?.tradeOffer(t.id, items, gold) ?? 'offline';
    if (why) this.said.emit(this.t('trade.askFailed', { why }));
  }
  async accept(yes = true): Promise<void> {
    const t = this.trade;
    if (!t || this.locked) return;
    // Protocol 8: the room reads both saves when both accept — this one goes up first.
    if (yes && !(await this.flow.beforeAccept(t))) { this.cdr.markForCheck(); return; }
    const why = await this.room?.tradeAccept(t.id, t.rev, yes) ?? 'offline';
    if (why) this.said.emit(this.t('trade.askFailed', { why }));
  }
  async confirm(): Promise<void> { if (this.trade) await this.flow.confirm(this.trade); }
  async cancel(): Promise<void> {
    const t = this.trade;
    if (!t) return;
    if (this.flow.status.stage === 'done' || this.flow.status.stage === 'failed') { this.closeResult(); return; }
    this.ownCancel = t.id;
    await this.flow.cancel(t);
    this.trade = null; this.card = null; this.cdr.markForCheck();
  }
  /** The trade this Keeper cancelled itself (its own window is already shut; the room's word on it says nothing new). */
  private ownCancel = '';
  /** The room closed the window (done, cancelled, void). */
  async ended(end: RoomTradeEnd): Promise<void> {
    const last = this.trade && this.trade.id === end.id ? this.trade : null;
    await this.flow.ended(end, last);
    const st = this.flow.status;
    // The other Keeper cancelled (or walked off, or left): the window closes on both screens, with who did it
    // (owner 2026-10-26: "the other Keeper's trade window stays open"). A void (refused) keeps its result up.
    if (end.outcome === 'cancelled' && st.stage !== 'done') {
      const mine = this.ownCancel === end.id;
      this.ownCancel = '';
      if (!mine) this.said.emit(end.by ? this.t('trade.cancelledBy', { name: end.by }) : this.t('trade.cancelled'));
      if (last || !this.trade) { this.trade = null; this.card = null; this.flow.reset(); }
      this.cdr.markForCheck();
      return;
    }
    if (st.stage === 'done') this.said.emit(st.received ? this.t('trade.doneGot', { items: st.received.items.length, gold: st.received.gold }) : this.t('trade.done'));
    else if (end.outcome !== 'done') this.said.emit(this.t('trade.failed', { why: this.whyText(st.why || end.why || end.outcome) }));
    if (!last) return;
    // Keep the window up with its outcome until it is put away (a cancelled one simply closes).
    if (st.stage !== 'done' && st.stage !== 'failed') { this.trade = null; this.flow.reset(); }
    this.cdr.markForCheck();
  }
  closeResult(): void { this.trade = null; this.card = null; this.flow.reset(); this.cdr.markForCheck(); }
  /** Protocol 8: the room's commit of a settled trade (the save is re-read on a yes; a no is told). */
  async committed(c: RoomTradeCommit): Promise<void> {
    await this.flow.committed(c);
    // A yes was already told when the room settled it; only a commit that did not land is news.
    if (!c.ok) this.said.emit(this.t('trade.commitFailed', { why: this.whyText(c.why || 'failed') }));
    this.cdr.markForCheck();
  }
  /** Protocol 8: the stream came back: a settled trade still waiting on its commit asks how it ended. */
  resumed(): void { this.flow.resumed(); }
  /** Protocol 8: the room's word on this Keeper's drop (escrowed: the save is re-read; handed back: told why). */
  async groundNoted(note: RoomGroundNote): Promise<void> {
    await this.groundFlow.noted(note);
    if (note.kind === 'returned') this.said.emit(this.t('trade.dropReturned', { name: note.name, why: this.whyText(note.why || 'failed') }));
    this.cdr.markForCheck();
  }
  /** Protocol 8: an item on its way to the ground (laid, escrow not landed): the satchel keeps hands off it. */
  dropPending(itemId: string): boolean { return this.groundFlow.isPending(itemId); }
  get statusLine(): string {
    const st = this.flow.status, t = this.trade;
    if (!t) return '';
    if (st.stage === 'sending') return this.t(t.room ? 'trade.stage.sendingRoom' : 'trade.stage.sending');
    if (st.stage === 'waiting') return this.t('trade.stage.waiting', { name: this.theirName });
    if (st.stage === 'settling') return this.t('trade.stage.settling');
    if (st.stage === 'done') return st.received ? this.t('trade.doneGot', { items: st.received.items.length, gold: st.received.gold }) : this.t('trade.done');
    if (st.stage === 'failed') return this.t('trade.failed', { why: this.whyText(st.why) });
    if (st.why) return this.t('trade.failed', { why: this.whyText(st.why) });
    return t.stage === 'confirm' ? this.t('trade.hint.confirm') : this.t('trade.hint.offer');
  }
  whyText(why: string): string {
    const key = `trade.why.${why}`, said = this.t(key);
    return said !== key ? said : why;
  }
  /** Esc: the card, then the window (a Cancel), then the toast (Not now). True when something was put away. */
  escape(): boolean {
    if (this.card) { this.card = null; this.cdr.markForCheck(); return true; }
    if (this.amount) { this.closeAmount(); return true; }
    if (this.trade) { void this.cancel(); return true; }
    const a = this.ask;
    if (a) { void this.answer(a, false); return true; }
    return false;
  }

  // ── Cards ──
  showCard(c: Cell, ev: PointerEvent | FocusEvent): void {
    if (ev instanceof PointerEvent && ev.pointerType !== 'mouse') return;
    const card = this.cardOf(c);
    if (!card) return;
    const el = ev.currentTarget as HTMLElement | null;
    const r = el?.getBoundingClientRect?.();
    const w = typeof window === 'undefined' ? 800 : window.innerWidth, h = typeof window === 'undefined' ? 600 : window.innerHeight;
    const left = r ? Math.max(8, Math.min(w - 268, r.right + 8 > w - 268 ? r.left - 268 : r.right + 8)) : 16;
    const top = r ? Math.max(8, Math.min(h - 220, r.top)) : 16;
    this.card = { card, left, top };
  }
  hideCard(): void { this.card = null; }
  /** An entry's card: an item's satchel card, a stack's satchel card, or (a kind this Keeper does not hold) its name and count. */
  private cardOf(c: Cell): TradeCard | null {
    if (c.item) return this.cardFor?.(c.item) ?? null;
    const own = c.sk ? this.stackCardFor?.(c.sk) ?? null : null;
    const n = this.t('trade.count', { n: c.qty });
    return own ? { ...own, stats: [n, ...own.stats] } : { name: c.name, kicker: this.t('trade.stackKicker'), tone: c.tone, note: '', stats: [n] };
  }
  /** A tap on a phone: the card first; a second tap on the same cell acts (offer / take back). */
  private tapped = '';
  tap(c: Cell, act: 'add' | 'remove' | 'look', ev: Event): void {
    const touch = (ev as PointerEvent).pointerType && (ev as PointerEvent).pointerType !== 'mouse';
    if (touch && this.tapped !== c.id) {
      this.tapped = c.id;
      const card = this.cardOf(c);
      if (card) this.card = { card, left: 8, top: 8 };
      return;
    }
    this.tapped = ''; this.card = null;
    if (act === 'add') void this.add(c);
    if (act === 'remove') void this.remove(c);
  }

  // ── Ground drops ──
  /** Put a satchel item on the ground at the Keeper's feet (the card's Drop, or a drag onto the world). */
  async drop(item: GameItem): Promise<boolean> {
    if (tradeBlock(item) || this.groundFlow.isPending(item.id)) return false;
    const eng = this.engine as GroundEngine | undefined;
    const here = eng?.peerPresence?.();
    if (!here) return false;
    const spot = eng?.dropSpot?.() ?? { x: here.x, y: here.y + 6 };
    const out = await this.groundFlow.drop(offerItemOf(item), { area: here.area, x: spot.x, y: spot.y });
    this.said.emit(out.ok ? this.t('trade.dropped', { name: item.name }) : this.t('trade.dropFailed', { why: this.whyText(out.why) }));
    this.cdr.markForCheck();
    return out.ok;
  }
  /** The engine walked the Keeper to a ground item that was tapped: reach for it. */
  async pickup(id: string): Promise<void> {
    const g = this.social?.ground?.items.find(x => x.id === id);
    if (!g) return;
    // A full satchel refuses the pickup: it stays on the ground (docs/design/inventory-grid.md §2.4).
    const stub = { id: g.id, name: g.name, type: 'artifact', rarity: g.rarity, definitionId: g.def, stats: {}, sellValue: 0, equipped: false, foundAt: new Date(0).toISOString(), soulbound: false } as GameItem;
    if (!this.inventory.canPickUp(stub)) { this.said.emit(this.t('play.grid.full')); return; }
    const out = await this.groundFlow.pickup(g);
    this.said.emit(out.ok ? this.t('trade.picked', { name: g.name }) : this.t('trade.pickFailed', { why: this.whyText(out.why) }));
    this.cdr.markForCheck();
  }
  canDrop(item: GameItem | null | undefined): boolean {
    return !!item && !tradeBlock(item) && !this.groundFlow.isPending(item.id) && !!this.social?.connected && (this.social.protocol ?? 0) >= 6;
  }
}
