import { AfterViewInit, Directive, ElementRef, Input, NgZone, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * hud-drag.directive.ts — HUD pieces a computer player can drag where they like (owner's player notes 2026-10-21):
 * the party frames, the goal / prologue card, the chat box, the minimap and the Keeper's plate.
 *
 * Each piece gets a small pixel grip in its top-left corner (shown on hover); dragging the grip moves the piece with the
 * CSS `translate` property (never `transform` or `left`/`top`, so the piece's own layout rules and its phone placement
 * stay untouched). Where each piece was put is remembered on this device only — a layout preference, not progress — so
 * it is plain localStorage behind try/catch, never the save gateway (the same rule as the Hearth pill's open state).
 *
 * Phones and tablets (no fine pointer, or narrower than 901px) keep the fixed layout: no grip, no offset applied.
 * The settings sheet's "Reset HUD layout" calls {@link resetHudLayout}: every piece goes home at once.
 */
export const HUD_LAYOUT_KEY = 'eclipse-hud-layout';
const DESKTOP = '(hover: hover) and (pointer: fine) and (min-width: 901px)';
/** How much of a piece must stay on screen (px), so a grip can never be dragged out of reach. */
const KEEP = 40;

type Layout = Record<string, { x: number; y: number }>;

/** The saved layout, every entry checked (a hand-edited or corrupted value is dropped, never thrown). */
export function readHudLayout(): Layout {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(HUD_LAYOUT_KEY);
    const data = raw ? JSON.parse(raw) as unknown : null;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const out: Layout = {};
    for (const [id, v] of Object.entries(data as Record<string, unknown>)) {
      const p = v as { x?: unknown; y?: unknown } | null;
      if (p && typeof p.x === 'number' && typeof p.y === 'number' && Number.isFinite(p.x) && Number.isFinite(p.y)
        && Math.abs(p.x) < 10000 && Math.abs(p.y) < 10000) out[id] = { x: Math.round(p.x), y: Math.round(p.y) };
    }
    return out;
  } catch { return {}; }
}
function writeHudLayout(layout: Layout): void {
  try {
    if (Object.keys(layout).length) localStorage.setItem(HUD_LAYOUT_KEY, JSON.stringify(layout));
    else localStorage.removeItem(HUD_LAYOUT_KEY);
  } catch { /* private mode: the layout holds for this page only */ }
}

const live = new Set<HudDragDirective>();
/** Put every HUD piece back where it started and forget the saved layout. */
export function resetHudLayout(): void {
  writeHudLayout({});
  for (const d of live) d.home();
}

@Directive({ selector: '[appHudDrag]', standalone: true })
export class HudDragDirective implements AfterViewInit, OnDestroy {
  /** The piece's id in the saved layout ('party', 'guide', 'chat', 'minimap', 'plate'). */
  @Input('appHudDrag') id = '';
  /** The grip's label (translated by the host). */
  @Input() hudDragLabel = 'Drag to move';

  private readonly el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  private readonly zone = inject(NgZone);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private grip: HTMLButtonElement | null = null;
  private mq: MediaQueryList | null = null;
  private offset = { x: 0, y: 0 };
  private drag: { id: number; sx: number; sy: number; ox: number; oy: number } | null = null;
  private readonly onMq = () => this.apply();
  private readonly onResize = () => this.apply();

  ngAfterViewInit(): void {
    if (!this.browser || typeof window === 'undefined' || typeof matchMedia !== 'function') return;
    live.add(this);
    this.mq = matchMedia(DESKTOP);
    this.offset = readHudLayout()[this.id] ?? { x: 0, y: 0 };
    this.zone.runOutsideAngular(() => {
      const grip = document.createElement('button');
      grip.type = 'button';
      grip.className = 'hud-grip';
      grip.setAttribute('aria-label', this.hudDragLabel);
      grip.title = this.hudDragLabel;
      grip.tabIndex = -1;
      grip.setAttribute('data-hud-grip', this.id);
      grip.setAttribute('data-engine-ignore', '');
      grip.addEventListener('pointerdown', this.down);
      grip.addEventListener('pointermove', this.move);
      grip.addEventListener('pointerup', this.up);
      grip.addEventListener('pointercancel', this.up);
      grip.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); });
      this.el.appendChild(grip);
      this.grip = grip;
      this.el.setAttribute('data-hud-drag', this.id);
      this.mq?.addEventListener?.('change', this.onMq);
      window.addEventListener('resize', this.onResize);
    });
    this.apply();
  }

  ngOnDestroy(): void {
    live.delete(this);
    this.grip?.remove();
    this.mq?.removeEventListener?.('change', this.onMq);
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.onResize);
  }

  /** Back to the piece's own place (Reset HUD layout). */
  home(): void { this.offset = { x: 0, y: 0 }; this.apply(); }

  /** Apply the offset on a computer (clamped so the piece stays reachable); nothing on a phone. */
  private apply(): void {
    if (!this.mq?.matches) { this.el.style.removeProperty('translate'); return; }
    const { x, y } = this.clamped(this.offset.x, this.offset.y);
    if (x || y) this.el.style.setProperty('translate', `${x}px ${y}px`); else this.el.style.removeProperty('translate');
  }

  /** Keep at least KEEP px of the piece inside the window. */
  private clamped(x: number, y: number): { x: number; y: number } {
    const cur = this.el.style.getPropertyValue('translate');
    this.el.style.removeProperty('translate');
    const r = this.el.getBoundingClientRect();
    if (cur) this.el.style.setProperty('translate', cur);
    if (!r.width && !r.height) return { x, y };
    const vw = window.innerWidth, vh = window.innerHeight;
    const minX = KEEP - r.right, maxX = vw - KEEP - r.left, minY = -r.top, maxY = vh - KEEP - r.top;
    return { x: Math.round(Math.max(minX, Math.min(maxX, x))), y: Math.round(Math.max(minY, Math.min(maxY, y))) };
  }

  private readonly down = (e: PointerEvent): void => {
    if (!this.mq?.matches || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    this.grip?.setPointerCapture?.(e.pointerId);
    this.drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: this.offset.x, oy: this.offset.y };
    this.el.classList.add('is-dragging');
  };
  private readonly move = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    e.preventDefault();
    this.offset = this.clamped(d.ox + e.clientX - d.sx, d.oy + e.clientY - d.sy);
    this.el.style.setProperty('translate', `${this.offset.x}px ${this.offset.y}px`);
  };
  private readonly up = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    this.el.classList.remove('is-dragging');
    const layout = readHudLayout();
    if (this.offset.x || this.offset.y) layout[this.id] = { ...this.offset }; else delete layout[this.id];
    writeHudLayout(layout);
  };
}
