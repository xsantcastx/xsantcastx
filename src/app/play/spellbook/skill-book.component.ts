/**
 * skill-book.component.ts — the Skill Book (K): one page per tree, one skill a row, six marks beneath each row in two
 * branches of three (docs/design/skill-book.md; owner 2026-10-26, refs/skill-book-ref.jpg). Ranks and marks are staged
 * until Accept; Cancel returns to the saved book. Lazy: the HUD loads it with `@defer` the first time the book opens.
 *
 * It owns only the staged copy. The rules are td-tree's (buyRank, buyMark, swapStar…), the words book-model's; the HUD
 * hands in the saved tree and the fight's context, and takes back the tree to save (`accept`), the keys and the aura,
 * and the per-row Spellstone button (`cut` / `belt`: a satchel stone recording the row's rank and marks, S2).
 */
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { TranslationService } from '../../translation.service';
import { KeymapService } from '../../shared/keys/keymap.service';
import type { KeeperSkillTree, Vocation } from '../../shared/keeper-look/keeper-look.model';
import { MAX_RANK, SKILLS, bookTrees, NO_GEAR_SIG, type GearSig, type SkillId, type TreeId } from '../td/td-skills';
import { MARK_SLOTS, type MarkSlot } from '../td/td-marks';
import { bookRows, buyMark, buyRank, dropMark, dropRank, rankOf, resetTree, swapStar } from '../td/td-tree';
import { BOOK_I18N } from './book.i18n';
import { bookPage, pageSpent, pendingCount, unusedPoints, type BookMark, type BookPage, type BookRow, type SpellbookStone } from './book-model';

/** What the hover card shows: a row's icon, or one of its marks. */
type Card = { kind: 'row'; row: BookRow } | { kind: 'mark'; row: BookRow; mark: BookMark };

@Component({
  selector: 'app-skill-book',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  templateUrl: './skill-book.component.html',
  styleUrl: './skill-book.component.css',
})
export class SkillBookComponent implements OnChanges {
  private readonly i18n = inject(TranslationService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly keymap = inject(KeymapService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly icons = new Map<string, SafeHtml>();

  /** The saved tree (the Keeper's look), the level, the class. */
  @Input({ required: true }) tree!: KeeperSkillTree;
  @Input({ required: true }) level = 1;
  @Input({ required: true }) vocation: Vocation = 'warlock';
  /** The fight's context, so every card's numbers are the fight's (td-skills castVars). */
  @Input() sig: GearSig = NO_GEAR_SIG;
  @Input() gearRanks = 0;
  @Input() castSpeed = 0;
  @Input() extra: ((id: SkillId) => string[]) | null = null;
  /** Keys 1–4 and the running aura (the Keys tab). */
  @Input() bar: readonly string[] = [];
  @Input() aura: string | null = null;
  /** The per-row Spellstone card: the recipe, the Soul and Blanks held, the charges of this recipe in the satchel. */
  @Input() stoneFor: ((id: string) => SpellbookStone | null) | null = null;
  @Input() stoneArt: ((id: string) => string) | null = null;
  /** The HUD asks to close (K, Escape, the X): with changes pending the book asks first. */
  @Input() closeAsk = 0;

  /** The tree to save (Accept, Reset, the rebound note read): the HUD writes it through the save gateway. */
  @Output() readonly accept = new EventEmitter<KeeperSkillTree>();
  @Output() readonly assign = new EventEmitter<{ id: string; slot: number }>();
  @Output() readonly toggleAura = new EventEmitter<string>();
  /** "Create Spellstone" (skill-book.md §4.2): the host cuts a satchel stone recording the row's rank and marks. */
  @Output() readonly cut = new EventEmitter<string>();
  @Output() readonly belt = new EventEmitter<string>();
  /** The book may close now (nothing pending, or the player dropped it). */
  @Output() readonly closed = new EventEmitter<void>();
  /** Whether changes are pending (the HUD routes its own close through `closeAsk` while they are). */
  @Output() readonly dirty = new EventEmitter<boolean>();

  /** The staged copy: every [+] and mark lands here until Accept. */
  staged!: KeeperSkillTree;
  tab: TreeId | 'keys' = 'ember';
  /** The phone's spread: one page; the desktop's: rows split over two pages (page 0 left, 1 right). */
  card: Card | null = null;
  /** A star swap waiting for its yes ("Swap Cinder Ward for Twin Nova? The point moves."). */
  swap: { id: SkillId; slot: MarkSlot; from: string; to: string } | null = null;
  /** The Reset's one confirm, the close-with-changes confirm, the stone card open on a row. */
  resetAsk = false;
  discardAsk = false;
  stoneRow: SkillId | null = null;
  /** A phone tap selects a mark first; the second tap takes it (fat fingers never spend a point). */
  picked: { id: SkillId; slot: MarkSlot } | null = null;
  help = false;
  private lastPointer: 'mouse' | 'touch' | 'pen' = 'mouse';
  private wasDirty = false;

  readonly maxRank = MAX_RANK;
  readonly slots = MARK_SLOTS;
  /** Keys 1–8: the bottom bar's eight slots, the same order (rebindable; the cap shows the bound key). */
  readonly keys = [1, 2, 3, 4, 5, 6, 7, 8];
  /** The belt's three keys (potions and the Spellstone): shown so the tab lists every key the bar has. */
  readonly beltKeys = [
    { action: 'potionHealth', kind: 'health' },
    { action: 'potionMana', kind: 'mana' },
    { action: 'stone', kind: 'stone' },
  ] as const;
  /** The keycap a key action is bound to ('1' unless rebound). */
  cap(action: string): string { return this.keymap.cap(action) || '–'; }

  constructor() { this.i18n.register(BOOK_I18N); }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['tree']) {
      // A tree that changed outside (a merge, a respec elsewhere) replaces the staged copy only when nothing is pending.
      if (!this.staged || !this.pending) this.staged = this.tree;
    }
    if (ch['vocation'] || !this.tabs.some(t => t.id === this.tab)) {
      if (this.tab !== 'keys' && !this.tabs.some(t => t.id === this.tab)) this.tab = this.tabs[0]?.id ?? 'ember';
    }
    if (ch['closeAsk'] && !ch['closeAsk'].firstChange) this.requestClose();
  }

  // ── What the page shows ──
  private get ctx() {
    return { vocation: this.vocation, level: this.level, saved: this.tree, staged: this.staged, sig: this.sig, gearRanks: this.gearRanks, castSpeed: this.castSpeed, t: (k: string, v?: Record<string, string | number>) => this.t(k, v), extra: this.extra ?? undefined };
  }
  get tabs(): { id: TreeId; spent: number }[] {
    return bookTrees(this.vocation).map(id => ({ id, spent: this.staged ? pageSpent(this.staged, this.vocation, id) : 0 }));
  }
  /** The open page, built once per change (the template reads it many times a frame). */
  private memo: { key: unknown[]; page: BookPage } | null = null;
  get page(): BookPage | null {
    if (this.tab === 'keys') return null;
    const key = [this.staged, this.tree, this.tab, this.level, this.vocation, this.sig, this.gearRanks, this.castSpeed, this.t('book.title')];
    if (!this.memo || this.memo.key.some((k, i) => k !== key[i])) this.memo = { key, page: bookPage(this.ctx, this.tab) };
    return this.memo.page;
  }
  /** Which page a row sits on (0 left, 1 right): its card opens over the other one. */
  sideOf(id: SkillId): 0 | 1 { return this.halves[1].some(r => r.id === id) ? 1 : 0; }
  /** The page's rows split for the open book: the first half on the left page, the rest on the right. */
  get halves(): [BookRow[], BookRow[]] {
    const rows = this.page?.rows ?? [], cut = Math.ceil(rows.length / 2);
    return [rows.slice(0, cut), rows.slice(cut)];
  }
  get unused(): number { return unusedPoints({ level: this.level, staged: this.staged }); }
  get pending(): number { return this.staged && this.tree ? pendingCount(this.tree, this.staged) : 0; }
  /** The one-time note after the rebinding (skill-book.md §6.2). */
  get rebound(): number | null { return typeof this.tree?.rebound === 'number' ? this.tree.rebound : null; }

  // ── Choosing (staged) ──
  rankUp(row: BookRow): void {
    const next = buyRank(this.staged, this.vocation, row.id, this.level);
    if (next) this.stage(next);
  }
  rankDown(row: BookRow): void {
    if (!row.canDrop) return;
    const next = dropRank(this.staged, this.vocation, row.id, this.level);
    if (next) this.stage(next);
  }
  pointer(ev: PointerEvent): void { this.lastPointer = (ev.pointerType as 'mouse' | 'touch' | 'pen') || 'mouse'; }
  /**
   * A tap on a mark: an open one is taken (on a phone, the first tap only picks it and shows its card), a pending one
   * is given back, a star whose twin is held asks to swap.
   */
  markTap(row: BookRow, m: BookMark): void {
    if (this.lastPointer === 'touch' && !(this.picked?.id === row.id && this.picked.slot === m.slot)) {
      this.picked = { id: row.id, slot: m.slot };
      this.card = { kind: 'mark', row, mark: m }; this.pinned = true;
      return;
    }
    this.picked = null; this.pinned = false;
    this.act(row, m);
  }
  /** Take / give back / swap (the card's button, the second tap, a click). */
  act(row: BookRow, m: BookMark): void {
    if (m.state === 'pending') { const next = dropMark(this.staged, this.vocation, row.id, m.slot); if (next) this.stage(next); return; }
    if (m.state === 'open') { const next = buyMark(this.staged, this.vocation, row.id, m.slot, this.level); if (next) this.stage(next); return; }
    if (m.state === 'blocked' && m.other) {
      const other = row.marks?.find(x => x.slot === m.other);
      if (other) this.swap = { id: row.id, slot: m.slot, from: other.name, to: m.name };
    }
  }
  confirmSwap(): void {
    const s = this.swap;
    this.swap = null;
    if (!s) return;
    const next = swapStar(this.staged, this.vocation, s.id, s.slot, this.level);
    if (next) this.stage(next);
  }
  private stage(next: KeeperSkillTree): void {
    this.staged = next;
    // Keep the card in step with the tap (its state, its need).
    const c = this.card;
    if (c) {
      const row = this.page?.rows.find(r => r.id === c.row.id);
      if (row) this.card = c.kind === 'row' ? { kind: 'row', row } : { kind: 'mark', row, mark: row.marks!.find(x => x.slot === c.mark.slot)! };
    }
    this.emitDirty();
  }
  private emitDirty(): void { const d = this.pending > 0; if (d !== this.wasDirty) { this.wasDirty = d; this.dirty.emit(d); } }

  /** Accept: the staged tree goes to the save (one write, the HUD's). */
  doAccept(): void {
    if (!this.pending) return;
    const { rebound: _r, ...tree } = this.staged;
    void _r;
    this.accept.emit({ ...tree, book: 2 });
    this.staged = { ...tree, book: 2 };
    this.flash();
    this.emitDirty();
  }
  doCancel(): void { this.staged = this.tree; this.card = null; this.picked = null; this.emitDirty(); }
  confirmReset(): void {
    this.resetAsk = false;
    const next = resetTree(this.tree);
    this.accept.emit(next);
    this.staged = next;
    this.emitDirty();
  }
  /** The rebound note read: the tree is written once without it (the next save carries `book: 2`). */
  readNote(): void {
    const { rebound: _r, ...tree } = this.tree;
    void _r;
    this.accept.emit({ ...tree, book: 2 });
    if (!this.pending) this.staged = { ...tree, book: 2 };
  }
  /** Close: with changes pending, ask first. */
  requestClose(): void { if (this.pending) this.discardAsk = true; else this.closed.emit(); }
  dropAndClose(): void { this.discardAsk = false; this.doCancel(); this.closed.emit(); }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(ev: Event): void {
    // The book answers Escape first: a card, a confirm, or the pending changes; only then does the HUD close it.
    if (this.card || this.swap || this.resetAsk || this.discardAsk || this.stoneRow || this.help || this.pending) {
      ev.stopImmediatePropagation(); ev.preventDefault();
      if (this.swap) this.swap = null;
      else if (this.resetAsk) this.resetAsk = false;
      else if (this.discardAsk) this.discardAsk = false;
      else if (this.stoneRow) this.stoneRow = null;
      else if (this.help) this.help = false;
      else if (this.card) { this.card = null; this.picked = null; }
      else this.requestClose();
    }
  }

  // ── Tabs ──
  openTab(id: TreeId | 'keys'): void { this.tab = id; this.card = null; this.picked = null; this.stoneRow = null; this.pinned = false; }
  tabKey(i: number, ev: KeyboardEvent): void {
    const step = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    ev.preventDefault();
    const all: (TreeId | 'keys')[] = [...this.tabs.map(t => t.id), 'keys'], to = all[(i + step + all.length) % all.length];
    this.openTab(to);
    queueMicrotask(() => setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(`[data-book-tab="${to}"]`)?.focus(), 0));
  }

  // ── Cards ──
  /** A clicked card stays (pinned) until closed or another is opened; a hovered one goes when the pointer leaves. */
  private pinned = false;
  showRow(row: BookRow, pin = false): void { this.card = { kind: 'row', row }; this.pinned = pin; }
  showMark(row: BookRow, m: BookMark): void { if (this.lastPointer !== 'touch' && !this.pinned) this.card = { kind: 'mark', row, mark: m }; }
  hover(row: BookRow): void { if (!this.pinned) this.showRow(row); }
  hide(): void { if (this.lastPointer !== 'touch' && !this.pinned) this.card = null; }
  closeCard(): void { this.card = null; this.picked = null; this.pinned = false; }
  isPicked(row: BookRow, m: BookMark): boolean { return this.picked?.id === row.id && this.picked.slot === m.slot; }

  // ── "Create Spellstone" (S2): the card confirms; Cut makes a satchel stone with this row's marks ──
  openStone(row: BookRow): void { this.stoneRow = this.stoneRow === row.id ? null : row.id; this.card = null; }
  get stone(): SpellbookStone | null { return this.stoneRow && this.stoneFor ? this.stoneFor(this.stoneRow) : null; }

  // ── The Keys tab ──
  get actives(): { id: SkillId; name: string; slot: number }[] {
    return bookTrees(this.vocation).flatMap(tr => bookRows(this.vocation, tr)).filter(id => SKILLS[id].kind === 'active' && this.rankSaved(id) > 0)
      .map(id => ({ id, name: this.t(SKILLS[id].nameKey), slot: this.bar.indexOf(id) + 1 }));
  }
  get auras(): { id: SkillId; name: string; on: boolean }[] {
    return bookTrees(this.vocation).flatMap(tr => bookRows(this.vocation, tr)).filter(id => SKILLS[id].kind === 'aura' && this.rankSaved(id) > 0)
      .map(id => ({ id, name: this.t(SKILLS[id].nameKey), on: this.aura === id }));
  }
  private rankSaved(id: SkillId): number { return rankOf(this.tree, this.vocation, id); }

  // ── Pictures ──
  icon(id: string): SafeHtml {
    let h = this.icons.get(id);
    if (!h) {
      h = this.sanitizer.bypassSecurityTrustHtml(`<svg viewBox="0 0 16 16" width="100%" height="100%" shape-rendering="crispEdges" aria-hidden="true">${SKILLS[id as SkillId]?.icon ?? ''}</svg>`);
      this.icons.set(id, h);
    }
    return h;
  }
  treeIcon(tree: TreeId): SafeHtml { const first = bookRows(this.vocation, tree)[0]; return first ? this.icon(first) : ''; }
  markLabel(m: BookMark): string { return this.t('book.mark.label', { name: m.name, state: this.t('book.mark.' + (m.state === 'closed' || m.state === 'blocked' ? 'locked' : m.state)) }); }
  rankLabel(row: BookRow): string { return this.t('book.rank', { n: row.rank, max: MAX_RANK }); }
  trackRow(_: number, r: BookRow): string { return r.id; }

  /** Accept's soft flash along the rows that changed (skipped under reduced motion by the CSS). */
  flashOn = false;
  private flash(): void { this.flashOn = true; setTimeout(() => { this.flashOn = false; }, 700); }
}
