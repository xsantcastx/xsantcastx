import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output,
  SimpleChanges, ViewChild, inject,
} from '@angular/core';
import { TranslationService } from '../translation.service';
import type { TdMapPin, TdMapView } from './td/td-engine';
import type { TdMapSection } from './td/td-map';

/** What a pin is, for its colour and the key (owner's player notes 2026-10-21: towns, hearths, dungeons, tasks, party). */
export type PinCat = 'stall' | 'npc' | 'quest' | 'hearth' | 'dungeon' | 'way' | 'ship';
export function pinCat(pin: TdMapPin): PinCat {
  if (pin.mark) return 'quest';
  if (/hearth|shrine/.test(pin.id)) return 'hearth';
  if (pin.kind === 'way') return pin.to ? 'dungeon' : 'way';
  return pin.kind;
}
/** "ship to pyrehold" → "Ship To Pyrehold" (the HUD's own titleCase). */
function titleCase(label: string): string { return label.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }

const MAX_ZOOM = 8;
const LEGEND: readonly PinCat[] = ['stall', 'npc', 'quest', 'hearth', 'dungeon', 'way', 'ship'];

/**
 * The Map window's body (M), redrawn in the cozy style (owner's player notes 2026-10-21): the section picker (the
 * surface, every cave, dungeon and floor), a small search, then the map itself on parchment in a wood frame —
 * region names with their level bands, pins for stalls, townsfolk, tasks, hearths, dungeons, ways and ships, the party,
 * and "You are here". Wheel zoom about the cursor, drag to pan, pinch on a phone, + / − / centre-on-me buttons; pins
 * keep their size at every zoom and never move under the pointer (no hover lift). A collapsible key. The host's menu
 * buttons are projected underneath.
 *
 * Zoom and pan never run change detection: they write four CSS variables on the view (--mx, --my, --mw, --mh) and
 * every pin, label and the picture is placed from them in CSS.
 */
@Component({
  selector: 'app-td-map-window',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mw__bar">
      <label class="mw__area">
        <span class="mw__sr">{{ t('ux.map.section') }}</span>
        <select data-map-section [attr.aria-label]="t('ux.map.section')" (change)="pickSection($any($event.target).value)">
          @for (g of groups; track g.name) {
            @if (g.rows.length === 1 && g.rows[0].id === 'surface') {
              <option [value]="g.rows[0].id" [selected]="view.section === g.rows[0].id">{{ g.rows[0].name }} · {{ t('ux.map.surface') }}{{ g.rows[0].id === view.here ? ' · ' + t('ux.map.here') : '' }}</option>
            } @else {
              <optgroup [label]="g.name">
                @for (r of g.rows; track r.id) {
                  <option [value]="r.id" [selected]="view.section === r.id">{{ floorName(r) }}{{ r.band ? ' · ' + bandText(r.band) : '' }}{{ r.id === view.here ? ' · ' + t('ux.map.here') : '' }}</option>
                }
              </optgroup>
            }
          }
        </select>
      </label>
      <div class="mw__find">
        <input type="search" data-map-find [value]="query" [placeholder]="t('ux.map.find')" [attr.aria-label]="t('ux.map.find')"
               (input)="query = $any($event.target).value" (keydown.enter)="goFirst()" autocomplete="off" />
        @if (query.trim()) {
          <ul class="td-map__key mw__results" data-map-results>
            @for (p of matches; track p.id) {
              <li><button type="button" [attr.data-kind]="p.kind" [attr.data-cat]="cat(p)" (click)="go(p)"><i aria-hidden="true"></i><span>{{ name(p) }}</span></button></li>
            } @empty {
              <li class="mw__none">{{ t('ux.map.noMatch') }}</li>
            }
          </ul>
        }
      </div>
    </div>
    <div class="mw__frame">
      <div #viewEl class="mw__view td-map__view" data-map-view [attr.data-zoom]="zoomShown" [attr.data-section]="view.section">
        <img class="mw__img" [src]="view.url" alt="" draggable="false" />
        @for (z of view.zones; track z.name) {
          <span class="mw__zone" [class.mw__zone--town]="z.town" [style.--u]="z.u" [style.--v]="z.v" aria-hidden="true">{{ z.name }}@if (z.band) {<small>{{ bandText(z.band) }}</small>}</span>
        }
        @for (pin of view.pins; track pin.id) {
          <button type="button" class="td-map__pin mw__pin" [attr.data-kind]="pin.kind" [attr.data-cat]="cat(pin)" [attr.data-name]="name(pin)" [attr.data-pin]="pin.id"
                  [class.mw__pin--low]="pin.v < .14" [style.--u]="pin.u" [style.--v]="pin.v" [attr.aria-label]="name(pin)" (click)="pinClick(pin, $event)">
            <i aria-hidden="true">@if (pin.mark) {<b>{{ pin.mark }}</b>}</i>
            <span class="mw__tip" role="tooltip"><b>{{ name(pin) }}</b>@if (pin.blurb) {<small>{{ pin.blurb }}</small>}</span>
          </button>
        }
        @for (m of view.party; track m.id) {
          <span class="mw__party" [style.--u]="m.u" [style.--v]="m.v" [attr.data-party-pin]="m.name"><i aria-hidden="true"></i><small>{{ m.name }}</small></span>
        }
        @if (view.me; as me) {
          <span class="td-map__me mw__me" data-map-me [style.--u]="me.u" [style.--v]="me.v"><i aria-hidden="true"></i><small>{{ t('ux.map.here') }}</small></span>
        }
        <div class="mw__zoom" role="group" [attr.aria-label]="t('ux.map.title')">
          <button type="button" data-map-zoom-in (click)="zoomBy(1.6)" [disabled]="zoomShown >= max" [attr.aria-label]="t('ux.map.zoomIn')" [title]="t('ux.map.zoomIn')">+</button>
          <button type="button" data-map-zoom-out (click)="zoomBy(1 / 1.6)" [disabled]="zoomShown <= 1" [attr.aria-label]="t('ux.map.zoomOut')" [title]="t('ux.map.zoomOut')">&minus;</button>
          @if (view.me) { <button type="button" class="mw__me-btn" data-map-centre (click)="centreOnMe()" [attr.aria-label]="t('ux.map.centre')" [title]="t('ux.map.centre')"><i aria-hidden="true"></i></button> }
        </div>
        <details class="mw__legend" data-map-legend>
          <summary>{{ t('ux.map.legend') }}</summary>
          <ul>
            @for (c of legend; track c) { <li><i class="mw__swatch" [attr.data-cat]="c" aria-hidden="true"></i>{{ t('ux.map.legend.' + c) }}</li> }
            <li><i class="mw__swatch mw__swatch--party" aria-hidden="true"></i>{{ t('ux.map.legend.party') }}</li>
            <li><i class="mw__swatch mw__swatch--you" aria-hidden="true"></i>{{ t('ux.map.legend.you') }}</li>
            <li><i class="mw__dot" aria-hidden="true"></i>{{ t('ux.map.legend.mob') }}</li>
            <li><i class="mw__dot mw__dot--champion" aria-hidden="true"></i>{{ t('ux.map.legend.champion') }}</li>
            <li><i class="mw__dot mw__dot--unique" aria-hidden="true"></i>{{ t('ux.map.legend.unique') }}</li>
            <li><i class="mw__dot mw__dot--boss" aria-hidden="true"></i>{{ t('ux.map.legend.boss') }}</li>
          </ul>
        </details>
      </div>
    </div>
    <p class="mw__hint" data-map-hint>{{ view.me ? t(touch ? 'ux.map.goTouch' : 'ux.map.go') : t('ux.map.away') }}</p>
  `,
  styleUrl: './td-map-window.component.css',
})
export class TdMapWindowComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) view!: TdMapView;
  @Input() sections: readonly TdMapSection[] = [];
  @Input() touch = false;
  /** A pin on the floor the Keeper stands on was chosen: walk there. */
  @Output() readonly goPin = new EventEmitter<TdMapPin>();
  /** Show another section. */
  @Output() readonly section = new EventEmitter<string>();
  @ViewChild('viewEl', { static: true }) private viewRef!: ElementRef<HTMLElement>;

  private readonly i18n = inject(TranslationService);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly max = MAX_ZOOM;
  readonly legend = LEGEND;
  query = '';
  /** The zoom as the buttons last saw it (the live value is `z`, written outside Angular). */
  zoomShown = 1;
  private z = 1;
  private mx = 0;
  private my = 0;
  private vw = 0;
  private vh = 0;
  private observer: ResizeObserver | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private gesture: { sx: number; sy: number; mx: number; my: number; dist: number; z: number; cx: number; cy: number; moved: boolean } | null = null;
  /** A drag just ended: the click it ends with is not a pin's. */
  private swallowClick = false;
  private readonly off: (() => void)[] = [];

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
  name(pin: TdMapPin): string { return titleCase(pin.label); }
  cat(pin: TdMapPin): PinCat { return pinCat(pin); }
  bandText(b: { min: number; max: number }): string { return b.min === b.max ? this.t('ux.map.band1', { n: b.min }) : this.t('ux.map.band', { min: b.min, max: b.max }); }
  floorName(r: TdMapSection): string { return r.name.split(' · ').slice(1).join(' · ') || r.name; }

  get groups(): { name: string; rows: TdMapSection[] }[] {
    const out: { name: string; rows: TdMapSection[] }[] = [];
    for (const r of this.sections) {
      const g = r.id === 'surface' ? null : out.find(o => o.name === r.group && o.rows[0]?.id !== 'surface');
      if (g) g.rows.push(r); else out.push({ name: r.group, rows: [r] });
    }
    return out;
  }
  get matches(): TdMapPin[] {
    const q = this.query.trim().toLowerCase();
    return q ? this.view.pins.filter(p => p.label.toLowerCase().includes(q) || p.blurb.toLowerCase().includes(q)).slice(0, 12) : [];
  }

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    const el = this.viewRef.nativeElement;
    this.zone.runOutsideAngular(() => {
      const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
        el.addEventListener(type, fn as EventListener, opts);
        this.off.push(() => el.removeEventListener(type, fn as EventListener, opts));
      };
      on('wheel', e => this.wheel(e), { passive: false });
      on('pointerdown', e => this.down(e));
      on('pointermove', e => this.move(e));
      on('pointerup', e => this.up(e));
      on('pointercancel', e => this.up(e));
      on('click', e => { if (this.swallowClick) { this.swallowClick = false; e.stopPropagation(); e.preventDefault(); } }, { capture: true });
      if (typeof ResizeObserver === 'function') {
        this.observer = new ResizeObserver(() => this.measure());
        this.observer.observe(el);
      }
    });
    this.measure();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const prev = changes['view']?.previousValue as TdMapView | undefined;
    // A new section, or the same one drawn at another aspect: back to the whole picture.
    if (prev && (prev.section !== this.view.section || prev.aspect !== this.view.aspect)) { this.z = 1; this.zoomShown = 1; this.measure(); }
  }

  ngOnDestroy(): void { for (const f of this.off) f(); this.observer?.disconnect(); }

  pickSection(id: string): void { this.query = ''; this.section.emit(id); }
  go(pin: TdMapPin): void { this.query = ''; this.goPin.emit(pin); }
  goFirst(): void { const p = this.matches[0]; if (p) this.go(p); }
  pinClick(pin: TdMapPin, ev: MouseEvent): void { ev.stopPropagation(); this.go(pin); }

  zoomBy(f: number): void { this.zoomAt(this.vw / 2, this.vh / 2, this.z * f); }
  /** Centre on the Keeper (closer in first when the whole map is showing). */
  centreOnMe(): void {
    const me = this.view.me;
    if (!me) return;
    if (this.z < 2.5) this.z = 2.5;
    const { w, h } = this.size();
    this.mx = this.vw / 2 - me.u * w; this.my = this.vh / 2 - me.v * h;
    this.apply();
  }

  /** The picture's size at this zoom: the whole map fits the view at 1×. */
  private size(): { w: number; h: number } {
    const a = this.view.aspect || 1;
    const w = Math.max(1, Math.min(this.vw, this.vh * a)) * this.z;
    return { w, h: w / a };
  }
  private measure(): void {
    const el = this.viewRef?.nativeElement;
    if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    const first = !this.vw;
    // Keep the point at the view's middle where it was.
    const { w: ow, h: oh } = this.size();
    const cu = ow > 1 ? (this.vw / 2 - this.mx) / ow : .5, cv = oh > 1 ? (this.vh / 2 - this.my) / oh : .5;
    this.vw = w; this.vh = h;
    const { w: nw, h: nh } = this.size();
    this.mx = first ? (w - nw) / 2 : w / 2 - cu * nw;
    this.my = first ? (h - nh) / 2 : h / 2 - cv * nh;
    this.apply();
  }
  private zoomAt(cx: number, cy: number, next: number): void {
    const z = Math.max(1, Math.min(MAX_ZOOM, next));
    const { w, h } = this.size();
    const u = (cx - this.mx) / w, v = (cy - this.my) / h;
    this.z = z;
    const s = this.size();
    this.mx = cx - u * s.w; this.my = cy - v * s.h;
    this.apply();
  }
  /** Clamp the pan (the picture always covers the view once it is bigger than it; centred while smaller) and draw. */
  private apply(): void {
    const el = this.viewRef?.nativeElement;
    if (!el) return;
    const { w, h } = this.size();
    this.mx = w <= this.vw ? (this.vw - w) / 2 : Math.max(this.vw - w, Math.min(0, this.mx));
    this.my = h <= this.vh ? (this.vh - h) / 2 : Math.max(this.vh - h, Math.min(0, this.my));
    el.style.setProperty('--mx', `${Math.round(this.mx)}px`);
    el.style.setProperty('--my', `${Math.round(this.my)}px`);
    el.style.setProperty('--mw', `${Math.round(w)}px`);
    el.style.setProperty('--mh', `${Math.round(h)}px`);
    el.style.setProperty('--z', String(this.z));
    // Far out, the stalls and townsfolk fold into their town's name (tasks, hearths, dungeons, ways and ships stay).
    el.toggleAttribute('data-far', this.z < 2);
    const shown = Math.round(this.z * 100) / 100;
    if (shown !== this.zoomShown) { this.zone.run(() => { this.zoomShown = shown; this.cdr.markForCheck(); }); }
  }

  private local(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.viewRef.nativeElement.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  private wheel(e: WheelEvent): void {
    e.preventDefault();
    const p = this.local(e);
    this.zoomAt(p.x, p.y, this.z * Math.exp(-e.deltaY * (e.deltaMode === 1 ? .05 : .0018)));
  }
  private down(e: PointerEvent): void {
    if ((e.target as HTMLElement).closest('.mw__zoom, .mw__legend')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.pointers.set(e.pointerId, this.local(e));
    this.startGesture();
  }
  private startGesture(): void {
    const pts = [...this.pointers.values()];
    if (!pts.length) { this.gesture = null; return; }
    const cx = pts.reduce((n, p) => n + p.x, 0) / pts.length, cy = pts.reduce((n, p) => n + p.y, 0) / pts.length;
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    this.gesture = { sx: cx, sy: cy, mx: this.mx, my: this.my, dist, z: this.z, cx, cy, moved: this.gesture?.moved ?? false };
  }
  private move(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId) || !this.gesture) return;
    this.pointers.set(e.pointerId, this.local(e));
    const g = this.gesture, pts = [...this.pointers.values()];
    const cx = pts.reduce((n, p) => n + p.x, 0) / pts.length, cy = pts.reduce((n, p) => n + p.y, 0) / pts.length;
    if (!g.moved && Math.hypot(cx - g.sx, cy - g.sy) < 5 && pts.length < 2) return;
    if (!g.moved) {
      g.moved = true;
      // A drag from a pin pans the map: the pointer is the view's from here on (and the click that ends it is not a go).
      try { this.viewRef.nativeElement.setPointerCapture(e.pointerId); } catch { /* already released */ }
    }
    e.preventDefault();
    if (pts.length >= 2 && g.dist > 0) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      // Zoom about the pinch's first middle, then follow the middle's drift.
      this.z = g.z; this.mx = g.mx; this.my = g.my;
      this.zoomAt(g.cx, g.cy, g.z * d / g.dist);
      this.mx += cx - g.cx; this.my += cy - g.cy;
      this.apply();
    } else {
      this.mx = g.mx + cx - g.sx; this.my = g.my + cy - g.sy;
      this.apply();
    }
  }
  private up(e: PointerEvent): void {
    if (!this.pointers.delete(e.pointerId)) return;
    const moved = this.gesture?.moved ?? false;
    if (this.pointers.size) { this.startGesture(); if (this.gesture) this.gesture.moved = moved; return; }
    this.gesture = null;
    if (moved) { this.swallowClick = true; setTimeout(() => { this.swallowClick = false; }, 0); }
  }
}
