/**
 * item-grid.component.ts — one D2 / PoE2 grid: the satchel, or a Vault tab (docs/design/inventory-grid.md §3).
 *
 * Draws a GridView (inventory-grid.ts): the empty cells, each piece at its cell covering its footprint, a pile's count.
 * Every piece is a drag source (item-drag.service.ts) and the grid is a drop target: while something is over it, the
 * cells it would cover light up (brass when it fits, berry when it does not). A drop of a grid piece or a worn piece
 * is handled here (InventoryService.moveTo / unequipTo); anything else (a shop's offer, later) goes to `extraDrop`.
 *
 * Hover (a mouse) shows the item card; a click or a tap SELECTS the piece (tap-to-move, owner 2026-10-26: highlighted,
 * then a tap on a cell, the Vault, a well or the belt moves it; a tap on it again lets go) and opens its options card;
 * a right-click opens the card only; a mouse drag still drags; a long-press still picks it up.
 */
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { InventoryService, type GridMoveResult } from '../rpg/inventory.service';
import { dropCell, dropFits, type ContainerId, type GridView, type Piece } from '../rpg/inventory-grid';
import { DropTargetDirective } from './drop-target.directive';
import { ItemDragService, type DragHeld, type DropTarget } from './item-drag.service';
import { SocketingService, type SocketDrop } from '../enchanting/socketing.service';
import { isRuneStack } from '../rune-forge/rune-stack';

/** How a piece looks (the host knows the art and names). */
export interface PieceLook { name: string; art: string; mark: string; tone: string | null; item?: import('../rpg/item.model').GameItem }

export interface GridPick { piece: Piece; el: HTMLElement; ev: Event }

@Component({
  selector: 'app-item-grid',
  standalone: true,
  imports: [DropTargetDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ig" role="grid" [attr.aria-label]="label" [attr.data-grid]="container" [attr.data-cols]="view.w" [attr.data-rows]="view.h"
         [style.--cols]="view.w" [style.--rows]="view.h" [appDropTarget]="target">
      @for (c of cells; track c) { <span class="ig-cell" aria-hidden="true"></span> }
      @if (preview; as pv) {
        <i class="ig-preview" [class.is-ok]="pv.ok" [style.--x]="pv.x" [style.--y]="pv.y" [style.--w]="pv.w" [style.--h]="pv.h" aria-hidden="true"></i>
      }
      @for (p of view.pieces; track p.key) {
        @let look = lookOf(p);
        <button type="button" class="ig-piece pocket" role="gridcell" [attr.data-piece]="p.key" [attr.data-cell]="p.cell" [attr.data-ids]="p.ids.join(',') || null"
                [attr.data-stack]="p.stackKey ?? null" [attr.data-qty]="p.qty" [attr.data-w]="p.w" [attr.data-h]="p.h"
                [class.is-held]="heldKey === p.key && !selecting" [class.is-sel]="heldKey === p.key && selecting" [attr.aria-pressed]="heldKey === p.key && selecting ? true : null" [class.is-new]="newKeys.has(p.key)" [class.is-picked]="pickedKey === p.key"
                [style.--x]="p.cell % view.w" [style.--y]="row(p.cell)" [style.--w]="p.w" [style.--h]="p.h" [style.--rim]="look.tone"
                [attr.aria-label]="look.name + (p.qty > 1 ? ', ' + p.qty : '')"
                (pointerdown)="press($event, p, look)" (click)="tapPiece($event, p, look)"
                (contextmenu)="$event.preventDefault(); pick.emit({ piece: p, el: $any($event.currentTarget), ev: $event })"
                (pointerenter)="hover.emit({ piece: p, ev: $event })" (pointermove)="hoverMove.emit($event)" (pointerleave)="unhover.emit()">
          @if (look.art) { <img [src]="look.art" alt="" draggable="false"> } @else { <em>{{ look.mark }}</em> }
          @if (p.qty > 1) { <b class="ig-qty">{{ p.qty }}</b> }
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; --cell: clamp(24px, calc(100cqi / 10), 38px); }
    .ig {
      position: relative; display: grid; width: calc(var(--cols) * var(--cell)); height: calc(var(--rows) * var(--cell));
      grid-template-columns: repeat(var(--cols), var(--cell)); grid-auto-rows: var(--cell);
      background: var(--cozy-well); outline: 2px solid var(--cozy-wood-0); box-shadow: inset 0 0 0 1px var(--cozy-wood-1);
      touch-action: pan-y; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
    }
    .ig-cell { border-right: 1px solid var(--cozy-plate-seam); border-bottom: 1px solid var(--cozy-plate-seam); box-shadow: inset 1px 1px 0 color-mix(in srgb, var(--cozy-wood-1) 60%, transparent); }
    .ig-piece {
      position: absolute; left: calc(var(--x) * var(--cell)); top: calc(var(--y) * var(--cell));
      width: calc(var(--w) * var(--cell)); height: calc(var(--h) * var(--cell)); padding: 2px; margin: 0;
      display: grid; place-items: center; cursor: grab; font: inherit; color: var(--cozy-cream);
      background: color-mix(in srgb, var(--rim, var(--cozy-loot-common)) 14%, var(--cozy-plate));
      border: 0; outline: 1px solid color-mix(in srgb, var(--rim, var(--cozy-loot-common)) 55%, transparent); outline-offset: -2px;
      -webkit-touch-callout: none;
    }
    .ig-piece:hover, .ig-piece:focus-visible, .ig-piece.is-picked { outline: 2px solid var(--rim, var(--cozy-brass-hi)); background: color-mix(in srgb, var(--rim, var(--cozy-loot-common)) 26%, var(--cozy-plate)); }
    .ig-piece img { max-width: 100%; max-height: 100%; image-rendering: pixelated; pointer-events: none; }
    .ig-piece em { font: 700 11px var(--font-game); font-style: normal; }
    .ig-piece.is-held { opacity: 0.35; }
    .ig-piece.is-sel { z-index: 3; outline: 3px solid var(--cozy-brass-hi); outline-offset: -3px; background: color-mix(in srgb, var(--cozy-brass-hi) 32%, var(--cozy-plate)); }
    .ig-piece.is-new { animation: igNew 1.2s steps(4) 2; }
    .ig-qty { position: absolute; right: 2px; bottom: 1px; font: 700 10px var(--cozy-font-read); color: var(--cozy-cream); text-shadow: 1px 1px 0 var(--cozy-wood-0); pointer-events: none; }
    .ig-preview {
      position: absolute; left: calc(var(--x) * var(--cell)); top: calc(var(--y) * var(--cell)); z-index: 2; pointer-events: none;
      width: calc(var(--w) * var(--cell)); height: calc(var(--h) * var(--cell));
      background: color-mix(in srgb, var(--cozy-berry) 35%, transparent); outline: 2px solid var(--cozy-berry); outline-offset: -2px;
    }
    .ig-preview.is-ok { background: color-mix(in srgb, var(--cozy-brass-hi) 30%, transparent); outline-color: var(--cozy-brass-hi); }
    @keyframes igNew { 50% { background: color-mix(in srgb, var(--cozy-glow) 45%, var(--cozy-plate)); } }
    @media (prefers-reduced-motion: reduce) { .ig-piece.is-new { animation: none; outline: 2px solid var(--cozy-glow); } }
  `],
})
export class ItemGridComponent implements OnChanges {
  @Input({ required: true }) container!: ContainerId;
  @Input({ required: true }) view!: GridView;
  @Input({ required: true }) look!: (p: Piece) => PieceLook;
  @Input() label = '';
  /** Pieces just arrived (they glow twice). */
  @Input() newKeys: ReadonlySet<string> = new Set();
  @Input() pickedKey: string | null = null;
  /** May a grid drop here at all (a Vault tab only while standing at a Vault)? Defaults to yes. */
  @Input() accepts: ((held: DragHeld) => boolean) | null = null;
  /** A drop the grid does not handle itself (a shop's offer, later): the host's. */
  @Input() extraDrop: ((held: DragHeld, cell: number) => boolean) | null = null;
  @Output() readonly pick = new EventEmitter<GridPick>();
  @Output() readonly hover = new EventEmitter<{ piece: Piece; ev: PointerEvent }>();
  @Output() readonly hoverMove = new EventEmitter<PointerEvent>();
  @Output() readonly unhover = new EventEmitter<void>();
  /** Every drop's outcome, for the host's line ('ok', 'blocked', 'vault-closed', …). */
  @Output() readonly moved = new EventEmitter<{ result: GridMoveResult; held: DragHeld }>();
  /** A rune dropped onto a socketed item (set at an Enchanting Table, refused anywhere else): the host's line. */
  @Output() readonly socketed = new EventEmitter<SocketDrop>();

  private readonly inventory = inject(InventoryService);
  private readonly drag = inject(ItemDragService);
  private readonly socketing = inject(SocketingService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  cells: number[] = [];
  preview: { x: number; y: number; w: number; h: number; ok: boolean } | null = null;
  heldKey: string | null = null;
  selecting = false;

  readonly target: DropTarget = {
    accepts: held => (this.accepts ? this.accepts(held) : true) && (held.ref.kind !== 'shop' || !!this.extraDrop),
    over: (held, x, y) => { this.preview = this.socketPreview(held, x, y) ?? this.previewFor(held, x, y); this.cdr.markForCheck(); },
    leave: () => { this.preview = null; this.cdr.markForCheck(); },
    drop: (held, x, y) => {
      this.preview = null;
      // A rune onto an item under the pointer sets it into the item's next well (docs/design/runewords.md §3).
      const target = this.runeTarget(held, x, y);
      if (target) {
        const out = this.socketing.drop(target.ids[0], held.stackKey);
        this.socketed.emit(out);
        this.cdr.markForCheck();
        return out.code === 'ok';
      }
      const cell = this.cellFor(held, x, y);
      this.cdr.markForCheck();
      if (cell < 0) return false;
      const ref = held.ref;
      if (ref.kind === 'shop') return this.extraDrop?.(held, cell) ?? false;
      const result = ref.kind === 'slot' ? (this.container === 'b' ? this.inventory.unequipTo(ref.itemId, cell) : 'vault-closed') : this.inventory.moveTo(ref, { container: this.container, cell });
      this.moved.emit({ result, held });
      return result === 'ok';
    },
  };

  constructor() {
    this.drag.held$.pipe(takeUntilDestroyed()).subscribe(h => { this.heldKey = h?.pieceKey && h.from === this.container ? h.pieceKey : null; this.selecting = this.drag.selecting; this.cdr.markForCheck(); });
  }

  ngOnChanges(): void {
    const n = this.view.w * this.view.h;
    if (this.cells.length !== n) this.cells = Array.from({ length: n }, (_, i) => i);
  }

  row(cell: number): number { return Math.floor(cell / this.view.w); }
  lookOf(p: Piece): PieceLook { return this.look(p); }

  /** A tap or a click: select the piece for tap-to-move (a second tap lets go), and tell the host (its card). */
  tapPiece(ev: MouseEvent, p: Piece, look: PieceLook): void {
    const el = ev.currentTarget as HTMLElement;
    this.drag.select(this.heldOf(p, look, 0, 0));
    this.pick.emit({ piece: p, el, ev });
  }

  private heldOf(p: Piece, look: PieceLook, grabDx: number, grabDy: number): DragHeld {
    const ref = p.kind === 'instance'
      ? { kind: 'instance' as const, ids: p.ids }
      : { kind: 'stack' as const, storeKey: p.storeKey!, qty: p.qty, pile: p.pile };
    return {
      ref, from: this.container, w: p.w, h: p.h, grabDx, grabDy, name: look.name, art: look.art, mark: look.mark, tone: look.tone,
      qty: p.qty, item: look.item, stackKey: p.stackKey, pieceKey: p.key,
    };
  }

  press(ev: PointerEvent, p: Piece, look: PieceLook): void {
    const box = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const cw = box.width / p.w, ch = box.height / p.h;
    const grabDx = Math.max(0, Math.min(p.w - 1, Math.floor((ev.clientX - box.left) / cw)));
    const grabDy = Math.max(0, Math.min(p.h - 1, Math.floor((ev.clientY - box.top) / ch)));
    const ref = p.kind === 'instance'
      ? { kind: 'instance' as const, ids: p.ids }
      : { kind: 'stack' as const, storeKey: p.storeKey!, qty: p.qty, pile: p.pile };
    this.drag.press(ev, {
      ref, from: this.container, w: p.w, h: p.h, grabDx, grabDy, name: look.name, art: look.art, mark: look.mark, tone: look.tone,
      qty: p.qty, item: look.item, stackKey: p.stackKey, pieceKey: p.key,
    });
  }

  /** The pointer's cell, from the grid's own box. */
  private pointerCell(x: number, y: number): number {
    const grid = this.host.nativeElement.querySelector('.ig') as HTMLElement | null;
    if (!grid) return -1;
    const r = grid.getBoundingClientRect();
    const cw = r.width / this.view.w, ch = r.height / this.view.h;
    const col = Math.floor((x - r.left) / cw), row = Math.floor((y - r.top) / ch);
    if (col < 0 || row < 0 || col >= this.view.w || row >= this.view.h) return -1;
    return row * this.view.w + col;
  }

  private cellFor(held: DragHeld, x: number, y: number): number {
    const at = this.pointerCell(x, y);
    if (at < 0) return -1;
    // A finger's tap names the cell it hit: the piece's top-left goes there (no grab offset: it was lifted).
    const touchHold = (this.drag.mode ?? this.drag.dropMode) === 'hold';
    return dropCell(this.view, at, held.w, held.h, touchHold ? 0 : held.grabDx, touchHold ? 0 : held.grabDy);
  }

  /** The item piece a held rune is over (not a rune pile, not itself), or null. */
  private runeTarget(held: DragHeld, x: number, y: number): Piece | null {
    if (held.ref.kind !== 'stack' || !isRuneStack(held.stackKey)) return null;
    const at = this.pointerCell(x, y);
    if (at < 0) return null;
    const col = at % this.view.w, row = this.row(at);
    return this.view.pieces.find(p => p.kind === 'instance' && p.ids.length === 1
      && col >= p.cell % this.view.w && col < p.cell % this.view.w + p.w && row >= this.row(p.cell) && row < this.row(p.cell) + p.h) ?? null;
  }

  private socketPreview(held: DragHeld, x: number, y: number) {
    const p = this.runeTarget(held, x, y);
    if (!p) return null;
    return { x: p.cell % this.view.w, y: this.row(p.cell), w: p.w, h: p.h, ok: this.socketing.accepts(p.ids[0], held.stackKey) && this.socketing.tableOpen };
  }

  private previewFor(held: DragHeld, x: number, y: number) {
    const cell = this.cellFor(held, x, y);
    if (cell < 0) return null;
    const ref = held.ref;
    const fits = dropFits(this.view, {
      key: held.from === this.container ? held.pieceKey ?? 'drag' : 'drag', kind: ref.kind === 'stack' ? 'stack' : 'instance',
      w: held.w, h: held.h, pileKey: null, qty: held.qty, stackKey: held.stackKey,
    }, cell);
    return { x: cell % this.view.w, y: this.row(cell), w: held.w, h: held.h, ok: !!fits };
  }
}
