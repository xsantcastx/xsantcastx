import { Directive, ElementRef, EventEmitter, OnDestroy, Output, inject } from '@angular/core';

/**
 * sheet-drag.directive.ts — pull a bottom sheet down to put it away
 * (docs/handoff/menus-orientation.md).
 *
 * On a portrait phone every in-world menu is a bottom sheet. Put this on the
 * sheet's frame: a press that starts on its title bar (any `header` inside it,
 * not on a button) drags the whole frame down with the finger; let go more than
 * DISMISS_PX down and `sheetDismiss` fires, otherwise it springs back. Anywhere
 * else (a desktop window, a landscape side panel) it does nothing, so a mouse
 * drag over a header never moves a window.
 */
const DISMISS_PX = 80;
/** The phone menu system's portrait case (the phone HUD query, held upright). */
const SHEET_QUERY = '((max-width: 900px), (hover: none) and (pointer: coarse) and (max-height: 500px)) and (orientation: portrait)';

@Directive({ selector: '[appSheetDrag]', standalone: true })
export class SheetDragDirective implements OnDestroy {
  @Output() readonly sheetDismiss = new EventEmitter<void>();
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  private start: { id: number; y: number } | null = null;
  private dy = 0;

  private readonly down = (event: PointerEvent): void => {
    if (event.button !== 0 || typeof matchMedia === 'undefined' || !matchMedia(SHEET_QUERY).matches) return;
    const target = event.target as Element | null;
    const head = target?.closest('header');
    if (!head || !this.host.contains(head) || target?.closest('button, a, input, select, textarea, label, [role="tab"]')) return;
    this.start = { id: event.pointerId, y: event.clientY };
    this.dy = 0;
    head.setPointerCapture?.(event.pointerId);
    this.host.style.transition = 'none';
  };
  private readonly move = (event: PointerEvent): void => {
    if (!this.start || event.pointerId !== this.start.id) return;
    this.dy = Math.max(0, event.clientY - this.start.y);
    this.host.style.translate = `0 ${this.dy}px`;
  };
  private readonly up = (event: PointerEvent): void => {
    if (!this.start || event.pointerId !== this.start.id) return;
    this.start = null;
    this.host.style.transition = '';
    this.host.style.translate = '';
    if (this.dy > DISMISS_PX) this.sheetDismiss.emit();
    this.dy = 0;
  };

  constructor() {
    this.host.addEventListener('pointerdown', this.down);
    this.host.addEventListener('pointermove', this.move);
    this.host.addEventListener('pointerup', this.up);
    this.host.addEventListener('pointercancel', this.up);
  }

  ngOnDestroy(): void {
    this.host.removeEventListener('pointerdown', this.down);
    this.host.removeEventListener('pointermove', this.move);
    this.host.removeEventListener('pointerup', this.up);
    this.host.removeEventListener('pointercancel', this.up);
  }
}
