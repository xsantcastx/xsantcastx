import { zoneDanger } from './td/td-zones';
import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostBinding, Input, NgZone, OnChanges, OnDestroy,
  Output, SimpleChanges, ViewChild, inject,
} from '@angular/core';
import { TranslationService } from '../translation.service';
import type { TdMapPin, TdMapView } from './td/td-engine';
import type { TdMapSection, TdZoneLabel } from './td/td-map';

/** What a pin is, for its icon, its filter chip and the key (owner's player notes 2026-10-21; ui-pass-3 §8). */
export type PinCat = 'shop' | 'stall' | 'npc' | 'quest' | 'hearth' | 'dungeon' | 'way' | 'ship' | 'harbour';
export function pinCat(pin: TdMapPin): PinCat {
  if (pin.mark) return 'quest';
  if (/hearth|shrine/.test(pin.id)) return 'hearth';
  if (pin.kind === 'way') return pin.to ? 'dungeon' : 'way';
  if (pin.kind === 'stall' && pin.id.startsWith('shop-')) return 'shop';
  return pin.kind;
}
/** "ship to pyrehold" → "Ship To Pyrehold" (the HUD's own titleCase). */
function titleCase(label: string): string { return label.toLowerCase().replace(/(^|[^\w'])(\w)/g, (_m, p: string, c: string) => p + c.toUpperCase()); }

/**
 * Whole-pixel map scales (ui-pass-3 §8: the map art is drawn 1×, 2×, 3× … or ½, ⅓ … of its pixels, never between).
 * `coverScale` is the smallest such scale at which the picture covers the whole view (no empty frame).
 */
export function wholeScale(s: number): number { return s >= 1 ? Math.max(1, Math.round(s)) : 1 / Math.max(1, Math.round(1 / s)); }
export function coverScale(viewW: number, viewH: number, artW: number, artH: number): number {
  const cov = Math.max(viewW / Math.max(1, artW), viewH / Math.max(1, artH));
  return cov <= 1 ? 1 / Math.max(1, Math.floor(1 / cov)) : Math.ceil(cov);
}
/** The next whole scale up (dir 1) or down (dir -1) from `s`. */
export function stepScale(s: number, dir: 1 | -1): number {
  if (s >= 1) return dir > 0 ? Math.round(s) + 1 : Math.round(s) > 1 ? Math.round(s) - 1 : .5;
  const n = Math.round(1 / s);
  return dir > 0 ? (n <= 2 ? 1 : 1 / (n - 1)) : 1 / (n + 1);
}
/** A label's box on screen, for collision culling. */
export interface LabelBox { x: number; y: number; w: number; h: number }
/**
 * Collision culling (ui-pass-3 §8): walk the labels in the order given (region labels first, then towns) and keep
 * each one whose box overlaps none already kept nor any of the `blocked` boxes (the map's own controls).
 * Returns the indexes kept.
 */
export function cullLabels(boxes: readonly LabelBox[], blocked: readonly LabelBox[] = [], pad = 2): Set<number> {
  const kept: LabelBox[] = [...blocked], out = new Set<number>();
  const hit = (a: LabelBox, b: LabelBox) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
  boxes.forEach((b, i) => { if (b.w > 0 && !kept.some(k => hit(b, k))) { kept.push(b); out.add(i); } });
  return out;
}

/** The most zoom over the fit, in whole steps. */
const MAX_OVER = 8;
const LEGEND: readonly PinCat[] = ['shop', 'stall', 'npc', 'quest', 'hearth', 'dungeon', 'way', 'ship', 'harbour'];
/** The filter rail's chips, in order; ships and harbours share one (Harbours). */
const FILTERS: readonly { id: string; cats: readonly PinCat[] }[] = [
  { id: 'town', cats: [] }, { id: 'shop', cats: ['shop'] }, { id: 'stall', cats: ['stall'] }, { id: 'quest', cats: ['quest'] },
  { id: 'npc', cats: ['npc'] }, { id: 'dungeon', cats: ['dungeon'] }, { id: 'harbour', cats: ['harbour', 'ship'] },
  { id: 'hearth', cats: ['hearth'] }, { id: 'way', cats: ['way'] },
];

/**
 * The Map window's body (M), cozy style (owner's player notes 2026-10-21; ui-pass-3 §8 Genshin / TotK / Tibia):
 * the map FILLS its frame at a whole-pixel zoom (cover, never letterboxed), pans by drag and zooms by wheel, pinch or
 * ± in whole steps. A filter rail on the left edge toggles each kind of pin (pixel icons by category); on a cave or
 * dungeon a floor rail on the right edge switches floors. Region and town labels are culled so no two overlap. A tap
 * on a pin opens its parchment card (name, area and level band, distance) with one brass **Walk here**. The search's
 * results push the map down, never cover it. Sideways and on a desktop the search and the card sit in a right panel.
 *
 * Zoom and pan never run change detection: they write CSS variables on the view (--mx, --my, --mw, --mh) and every
 * pin, label and the picture is placed from them in CSS.
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
                  <option [value]="r.id" [selected]="view.section === r.id" [class.mw__opt--danger]="danger(r.band)" [attr.data-danger]="danger(r.band) || null">{{ floorName(r) }}{{ r.band ? ' · ' + bandText(r.band) : '' }}{{ danger(r.band) ? ' · ' + t('play.zone.danger') : '' }}{{ r.id === view.here ? ' · ' + t('ux.map.here') : '' }}</option>
                }
              </optgroup>
            }
          }
        </select>
      </label>
    </div>
    <div class="mw__main">
      <aside class="mw__side">
        <div class="mw__find">
          <input type="search" data-map-find [value]="query" [placeholder]="t('ux.map.find')" [attr.aria-label]="t('ux.map.find')"
                 (input)="query = $any($event.target).value" (keydown.enter)="goFirst()" autocomplete="off" />
          @if (query.trim()) {
            <ul class="td-map__key mw__results" data-map-results>
              @for (p of matches; track p.id) {
                <li><button type="button" [attr.data-kind]="p.kind" [attr.data-cat]="cat(p)" (click)="go(p)"><i class="mw__ico mw__ico--sm" [attr.data-cat]="cat(p)" aria-hidden="true"></i><span class="mw__rname"><b>{{ name(p) }}</b><small>{{ whereLine(p) }}</small></span></button></li>
              } @empty {
                <li class="mw__none">{{ t('ux.map.noMatch') }}</li>
              }
            </ul>
          }
        </div>
        <!-- A pin's card (Genshin): the name, where it is and how dangerous, how far, and ONE brass Walk here. -->
        @if (picked; as p) {
          <div class="mw__card" role="dialog" [attr.aria-label]="name(p)" data-map-card [attr.data-cat]="cat(p)">
            <button type="button" class="px-x mw__cardx" (click)="unpick()" [attr.aria-label]="t('ux.map.cardClose')"><i aria-hidden="true">&times;</i></button>
            <div class="mw__cardhead"><i class="mw__ico" [attr.data-cat]="cat(p)" aria-hidden="true"></i><b class="mw__cardname">{{ name(p) }}</b></div>
            @if (areaOf(p); as a) {
              <span class="mw__cardmeta">{{ a.name }}@if (a.band) { · <span [class.mw__berry]="danger(a.band)" data-map-card-band>{{ bandText(a.band) }}{{ danger(a.band) ? ' · ' + t('play.zone.danger') : '' }}</span>}@if (distance(p); as d) { · {{ t('ux.map.dist', { n: d }) }}}</span>
            } @else if (distance(p); as d) { <span class="mw__cardmeta">{{ t('ux.map.dist', { n: d }) }}</span> }
            @if (p.blurb) { <p class="mw__cardblurb">{{ p.blurb }}</p> }
            <button type="button" class="mw__walk" data-map-walk (click)="go(p)">{{ t('ux.map.walk') }}</button>
          </div>
        }
      </aside>
      <div class="mw__frame">
        <div #viewEl class="mw__view td-map__view" data-map-view [attr.data-zoom]="zoomShown" [attr.data-scale]="scaleShown" [attr.data-section]="view.section">
          <img class="mw__img" [src]="view.url" alt="" draggable="false" (load)="artLoaded($event)" />
          @for (z of zones; track z.name; let i = $index) {
            <span class="mw__zone" [class.mw__zone--town]="z.town" [class.mw__zone--danger]="danger(z.band)" [class.mw__off]="z.town && off('town')" [attr.data-danger]="danger(z.band) || null" [attr.data-zone]="i" [style.--u]="z.u" [style.--v]="z.v" aria-hidden="true">{{ z.name }}@if (z.band) {<small>{{ bandText(z.band) }}</small>}</span>
          }
          @for (pin of view.pins; track pin.id) {
            <button type="button" class="td-map__pin mw__pin" [attr.data-kind]="pin.kind" [attr.data-cat]="cat(pin)" [attr.data-name]="name(pin)" [attr.data-pin]="pin.id"
                    [class.mw__pin--low]="pin.v < .14" [class.mw__off]="offPin(pin)" [class.is-on]="picked?.id === pin.id" [style.--u]="pin.u" [style.--v]="pin.v" [attr.aria-label]="name(pin)"
                    (click)="pinClick(pin, $event)" (dblclick)="pinGo(pin, $event)">
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
          <!-- The filter rail (left edge): one 44px chip per kind of pin on this map; a press hides or shows them. -->
          <div class="mw__rail mw__rail--filter" role="group" [attr.aria-label]="t('ux.map.filter')" data-map-filters>
            @for (f of filters; track f.id) {
              <button type="button" class="mw__chip" [attr.data-filter]="f.id" [attr.aria-pressed]="!off(f.id)" [attr.aria-label]="t('ux.map.legend.' + f.id)" [title]="t('ux.map.legend.' + f.id)" (click)="toggle(f.id)"><i class="mw__ico" [attr.data-cat]="f.id" aria-hidden="true"></i></button>
            }
          </div>
          <!-- The floor rail (right edge, Tibia / TotK): the floors of this cave or dungeon, the shown one brass-rimmed. -->
          @if (floors.length > 1) {
            <div class="mw__rail mw__rail--floor" role="group" [attr.aria-label]="t('ux.map.floors')" data-map-floors>
              @for (f of floors; track f.id) {
                <button type="button" class="mw__chip mw__floor" [attr.data-floor]="f.id" [attr.aria-pressed]="view.section === f.id" [attr.aria-label]="f.label" [title]="f.label" (click)="pickSection(f.id)">{{ f.short }}@if (f.id === view.here) {<i class="mw__floorme" aria-hidden="true"></i>}</button>
              }
            </div>
          }
          <div class="mw__zoom" role="group" [attr.aria-label]="t('ux.map.title')">
            <button type="button" data-map-zoom-in (click)="zoomBy(1)" [disabled]="scale >= maxScale" [attr.aria-label]="t('ux.map.zoomIn')" [title]="t('ux.map.zoomIn')">+</button>
            <button type="button" data-map-zoom-out (click)="zoomBy(-1)" [disabled]="scale <= minScale" [attr.aria-label]="t('ux.map.zoomOut')" [title]="t('ux.map.zoomOut')">&minus;</button>
            @if (view.me) { <button type="button" class="mw__me-btn" data-map-centre (click)="centreOnMe()" [attr.aria-label]="t('ux.map.centre')" [title]="t('ux.map.centre')"><i aria-hidden="true"></i></button> }
          </div>
          <details class="mw__legend" data-map-legend>
            <summary>{{ t('ux.map.legend') }}</summary>
            <ul>
              @for (c of legend; track c) { <li><i class="mw__ico mw__ico--sm" [attr.data-cat]="c" aria-hidden="true"></i>{{ t('ux.map.legend.' + c) }}</li> }
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
    </div>
    <p class="mw__hint" data-map-hint>{{ view.me ? t(touch ? 'ux.map.goTouch' : 'ux.map.go') : t('ux.map.away') }}</p>
  `,
  styleUrl: './td-map-window.component.css',
})
export class TdMapWindowComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) view!: TdMapView;
  @Input() sections: readonly TdMapSection[] = [];
  @Input() touch = false;
  /** The Keeper's level: a zone well above it reads berry (td-zones zoneDanger, "Dangerous for your level"). */
  @Input() keeperLevel = 1;
  /** A pin on the floor the Keeper stands on was chosen: walk there. */
  @Output() readonly goPin = new EventEmitter<TdMapPin>();
  /** Show another section. */
  @Output() readonly section = new EventEmitter<string>();
  @ViewChild('viewEl', { static: true }) private viewRef!: ElementRef<HTMLElement>;

  private readonly i18n = inject(TranslationService);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly legend = LEGEND;
  query = '';
  /** The pin whose card is open. */
  picked: TdMapPin | null = null;
  /** Filter chips switched off. */
  private readonly hidden = new Set<string>();
  /** Sideways or wide: the search and the card sit in a right panel (else under the bar / over the map's foot). */
  @HostBinding('class.mw--side') side = false;
  /** The zoom over the fit as the buttons last saw it (the live value is `s`, written outside Angular). */
  zoomShown = 1;
  scaleShown = 1;
  scale = 1;
  minScale = 1;
  maxScale = 8;
  /** The art's own size in pixels (a tile per pixel on a floor, two per pixel on the surface). */
  private artW = 0;
  private artH = 0;
  /** The continuous zoom a wheel is steering; what is drawn is its whole-pixel snap. */
  private want = 1;
  private s = 1;
  private mx = 0;
  private my = 0;
  private vw = 0;
  private vh = 0;
  private placed = false;
  private observer: ResizeObserver | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private gesture: { sx: number; sy: number; mx: number; my: number; dist: number; s: number; cx: number; cy: number; moved: boolean } | null = null;
  /** A drag just ended: the click it ends with is not a pin's. */
  private swallowClick = false;
  private readonly unlisten: (() => void)[] = [];
  /** Label sizes (they keep their screen size at every zoom), re-read when the set or the band lines change. */
  private labelSizes: { w: number; h: number }[] = [];
  private labelsNear: boolean | null = null;

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
  name(pin: TdMapPin): string { return titleCase(pin.label); }
  cat(pin: TdMapPin): PinCat { return pinCat(pin); }
  /** Is a band (td-zones.ts, fixed per zone) well above the Keeper? */
  danger(b: { min: number; max: number } | null | undefined): boolean { return !!b && zoneDanger([b.min, b.max], this.keeperLevel); }
  bandText(b: { min: number; max: number }): string { return b.min === b.max ? this.t('ux.map.band1', { n: b.min }) : this.t('ux.map.band', { min: b.min, max: b.max }); }
  floorName(r: TdMapSection): string { return r.name.split(' · ').slice(1).join(' · ') || r.name; }

  /** Region labels first, then towns (the cull keeps the first of two that would overlap). */
  get zones(): TdZoneLabel[] { return [...this.view.zones.filter(z => !z.town), ...this.view.zones.filter(z => z.town)]; }
  /** The filter chips for the kinds of pin on this map (Towns where the surface names them). */
  get filters(): { id: string }[] {
    const cats = new Set(this.view.pins.map(p => pinCat(p)));
    return FILTERS.filter(f => f.id === 'town' ? this.view.zones.some(z => z.town) : f.cats.some(c => cats.has(c)));
  }
  off(id: string): boolean { return this.hidden.has(id); }
  offPin(pin: TdMapPin): boolean { const c = pinCat(pin); return FILTERS.some(f => f.cats.includes(c) && this.hidden.has(f.id)); }
  toggle(id: string): void {
    if (this.hidden.has(id)) this.hidden.delete(id); else this.hidden.add(id);
    if (this.picked && this.offPin(this.picked)) this.picked = null;
    this.cdr.markForCheck();
    // Town labels in or out change what the cull must keep.
    if (id === 'town') setTimeout(() => this.cull());
  }

  /** The floors of the shown section's cave or dungeon, top to bottom, with the surface above them. */
  get floors(): { id: string; short: string; label: string }[] {
    const shown = this.sections.find(r => r.id === this.view.section);
    if (!shown || shown.id === 'surface') return [];
    const rows = this.sections.filter(r => r.group === shown.group && r.id !== 'surface').sort((a, b) => b.floor - a.floor);
    const surface = this.sections.find(r => r.id === 'surface');
    const out = rows.map(r => ({ id: r.id, short: r.floor > 0 ? `+${r.floor}` : r.floor < 0 ? `−${-r.floor}` : '0', label: r.name }));
    return surface ? [{ id: 'surface', short: '0', label: `${surface.name} · ${this.t('ux.map.surface')}` }, ...out] : out;
  }

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
  /** Where a pin stands: the nearest region or town label on the surface, the floor's own name and band below it. */
  areaOf(pin: TdMapPin): { name: string; band: { min: number; max: number } | null } | null {
    const zs = this.view.zones;
    if (zs.length) {
      const tw = this.view.tiles?.w ?? this.view.aspect, th = this.view.tiles?.h ?? 1;
      let best: TdZoneLabel | null = null, bd = Infinity;
      for (const z of zs) { const d = Math.hypot((z.u - pin.u) * tw, (z.v - pin.v) * th); if (d < bd) { bd = d; best = z; } }
      return best ? { name: best.name, band: best.band } : null;
    }
    const sec = this.sections.find(r => r.id === this.view.section);
    return sec && sec.id !== 'surface' ? { name: this.floorName(sec), band: sec.band } : null;
  }
  /** How far the pin is from the Keeper, in whole metres (a tile each), when the Keeper is on this map. */
  distance(pin: TdMapPin): number | null {
    const me = this.view.me, tl = this.view.tiles;
    if (!me || !tl) return null;
    return Math.max(1, Math.round(Math.hypot((pin.u - me.u) * tl.w, (pin.v - me.v) * tl.h)));
  }
  whereLine(pin: TdMapPin): string {
    const a = this.areaOf(pin), d = this.distance(pin);
    return [a?.name, d != null ? this.t('ux.map.dist', { n: d }) : ''].filter(Boolean).join(' · ');
  }

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    const el = this.viewRef.nativeElement;
    this.zone.runOutsideAngular(() => {
      const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
        el.addEventListener(type, fn as EventListener, opts);
        this.unlisten.push(() => el.removeEventListener(type, fn as EventListener, opts));
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
        this.observer.observe(this.host.nativeElement);
      }
    });
    const img = el.querySelector('img');
    if (img?.complete && img.naturalWidth) this.setArt(img.naturalWidth, img.naturalHeight);
    this.measure();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const prev = changes['view']?.previousValue as TdMapView | undefined;
    // A new section, or the same one drawn at another aspect: back to the fit, on the Keeper (or the middle).
    if (prev && (prev.section !== this.view.section || prev.aspect !== this.view.aspect || prev.url !== this.view.url)) {
      this.placed = false; this.picked = null; this.labelSizes = []; this.labelsNear = null;
      if (prev.url !== this.view.url) { this.artW = 0; this.artH = 0; }
      setTimeout(() => this.measure());
    } else if (prev && prev.zones.length !== this.view.zones.length) { this.labelSizes = []; }
  }

  ngOnDestroy(): void { for (const f of this.unlisten) f(); this.observer?.disconnect(); }

  artLoaded(ev: Event): void {
    const img = ev.target as HTMLImageElement;
    if (img.naturalWidth) this.setArt(img.naturalWidth, img.naturalHeight);
  }
  private setArt(w: number, h: number): void {
    if (w === this.artW && h === this.artH) return;
    this.artW = w; this.artH = h; this.placed = false;
    this.measure();
  }

  pickSection(id: string): void { this.query = ''; this.picked = null; this.section.emit(id); }
  go(pin: TdMapPin): void { this.query = ''; this.picked = null; this.goPin.emit(pin); }
  goFirst(): void { const p = this.matches[0]; if (p) this.go(p); }
  /** A tap on a pin opens its card (its Walk here goes); a double click goes at once on a desktop. */
  pinClick(pin: TdMapPin, ev: MouseEvent): void { ev.stopPropagation(); this.picked = this.picked?.id === pin.id ? null : pin; this.cdr.markForCheck(); }
  pinGo(pin: TdMapPin, ev: MouseEvent): void { ev.stopPropagation(); this.go(pin); }
  unpick(): void { this.picked = null; this.cdr.markForCheck(); }

  /** ± : about 1.6× a press, snapped to a whole scale, and always at least one whole step. */
  zoomBy(dir: 1 | -1): void {
    let next = wholeScale(this.s * (dir > 0 ? 1.6 : 1 / 1.6));
    if (next === this.s) next = stepScale(this.s, dir);
    this.zoomTo(this.vw / 2, this.vh / 2, next);
    this.want = this.s;
  }
  /** Centre on the Keeper (two whole steps closer first when the fit is showing). */
  centreOnMe(): void {
    const me = this.view.me;
    if (!me) return;
    if (this.s <= this.minScale) this.s = this.want = Math.min(this.maxScale, stepScale(stepScale(this.minScale, 1), 1));
    const { w, h } = this.size();
    this.mx = this.vw / 2 - me.u * w; this.my = this.vh / 2 - me.v * h;
    this.apply();
  }

  /** The art's pixels (the aspect stands in until the picture has loaded). */
  private art(): { w: number; h: number } {
    if (this.artW && this.artH) return { w: this.artW, h: this.artH };
    const a = this.view.aspect || 1;
    return { w: Math.round(200 * a), h: 200 };
  }
  private size(): { w: number; h: number } { const a = this.art(); return { w: a.w * this.s, h: a.h * this.s }; }
  private measure(): void {
    const el = this.viewRef?.nativeElement;
    if (!el) return;
    const host = this.host.nativeElement as HTMLElement;
    const side = host.clientWidth >= 620 && host.clientWidth > host.clientHeight * 1.25;
    if (side !== this.side) this.zone.run(() => { this.side = side; this.cdr.markForCheck(); });
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    const { w: ow, h: oh } = this.size();
    const cu = ow > 1 ? (this.vw / 2 - this.mx) / ow : .5, cv = oh > 1 ? (this.vh / 2 - this.my) / oh : .5;
    this.vw = w; this.vh = h;
    const a = this.art();
    this.minScale = coverScale(w, h, a.w, a.h);
    this.maxScale = wholeScale(Math.max(this.minScale * MAX_OVER, 4));
    if (!this.placed) {
      // Open at the fit: on the Keeper when they are on this map, else on the middle.
      this.s = this.want = this.minScale;
      const { w: nw, h: nh } = this.size(), me = this.view.me;
      this.mx = w / 2 - (me ? me.u : .5) * nw; this.my = h / 2 - (me ? me.v : .5) * nh;
      this.placed = !!(this.artW && this.artH);
    } else {
      this.s = this.want = Math.min(this.maxScale, Math.max(this.minScale, this.s));
      const { w: nw, h: nh } = this.size();
      this.mx = w / 2 - cu * nw; this.my = h / 2 - cv * nh;
    }
    this.apply();
  }
  private zoomTo(cx: number, cy: number, next: number): void {
    const s = Math.max(this.minScale, Math.min(this.maxScale, wholeScale(next)));
    const { w, h } = this.size();
    const u = (cx - this.mx) / w, v = (cy - this.my) / h;
    this.s = s;
    const n = this.size();
    this.mx = cx - u * n.w; this.my = cy - v * n.h;
    this.apply();
  }
  /** Clamp the pan (the picture always covers the view) and draw. */
  private apply(): void {
    const el = this.viewRef?.nativeElement;
    if (!el) return;
    const { w, h } = this.size();
    this.mx = w <= this.vw ? (this.vw - w) / 2 : Math.max(this.vw - w, Math.min(0, this.mx));
    this.my = h <= this.vh ? (this.vh - h) / 2 : Math.max(this.vh - h, Math.min(0, this.my));
    this.mx = Math.round(this.mx); this.my = Math.round(this.my);
    el.style.setProperty('--mx', `${this.mx}px`);
    el.style.setProperty('--my', `${this.my}px`);
    el.style.setProperty('--mw', `${Math.round(w)}px`);
    el.style.setProperty('--mh', `${Math.round(h)}px`);
    const z = this.s / this.minScale;
    el.style.setProperty('--z', String(z));
    // Far out, the stalls and townsfolk fold into their town's name (tasks, hearths, dungeons, ways and ships stay);
    // the level lines show from two steps in.
    el.toggleAttribute('data-far', z < 2);
    el.toggleAttribute('data-near', z >= 2);
    this.cull();
    const shown = Math.round(z * 100) / 100;
    if (shown !== this.zoomShown || this.s !== this.scale) {
      this.zone.run(() => { this.zoomShown = shown; this.scale = this.s; this.scaleShown = Math.round(this.s * 1000) / 1000; this.cdr.markForCheck(); });
    }
  }

  /** Hide every label that would overlap one kept before it, or the map's own controls (ui-pass-3 §8). */
  private cull(): void {
    const el = this.viewRef?.nativeElement;
    if (!el) return;
    const labels = Array.from(el.querySelectorAll<HTMLElement>('.mw__zone'));
    const near = el.hasAttribute('data-near');
    if (this.labelSizes.length !== labels.length || this.labelsNear !== near || this.labelSizes.some(z => !z.w)) {
      this.labelsNear = near;
      this.labelSizes = labels.map(l => ({ w: l.offsetWidth, h: l.offsetHeight }));
    }
    const { w, h } = this.size();
    const boxes = labels.map((l, i) => {
      if (l.classList.contains('mw__off')) return { x: 0, y: 0, w: 0, h: 0 };
      const u = Number(l.style.getPropertyValue('--u')), v = Number(l.style.getPropertyValue('--v')), sz = this.labelSizes[i];
      const cx = this.mx + u * w, cy = this.my + v * h;
      return { x: cx - sz.w / 2, y: cy - sz.h / 2, w: sz.w, h: sz.h };
    });
    const vr = el.getBoundingClientRect();
    const blocked = Array.from(el.querySelectorAll<HTMLElement>('.mw__rail, .mw__zoom, .mw__legend > summary')).map(c => {
      const r = c.getBoundingClientRect();
      return { x: r.left - vr.left, y: r.top - vr.top, w: r.width, h: r.height };
    });
    const keep = cullLabels(boxes, blocked);
    labels.forEach((l, i) => l.toggleAttribute('data-culled', !keep.has(i)));
  }

  private local(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.viewRef.nativeElement.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  private wheel(e: WheelEvent): void {
    e.preventDefault();
    const p = this.local(e);
    this.want = Math.max(this.minScale, Math.min(this.maxScale, this.want * Math.exp(-e.deltaY * (e.deltaMode === 1 ? .05 : .0018))));
    this.zoomTo(p.x, p.y, this.want);
  }
  private down(e: PointerEvent): void {
    if ((e.target as HTMLElement).closest('.mw__zoom, .mw__legend, .mw__rail')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.pointers.set(e.pointerId, this.local(e));
    this.startGesture();
  }
  private startGesture(): void {
    const pts = [...this.pointers.values()];
    if (!pts.length) { this.gesture = null; return; }
    const cx = pts.reduce((n, p) => n + p.x, 0) / pts.length, cy = pts.reduce((n, p) => n + p.y, 0) / pts.length;
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    this.gesture = { sx: cx, sy: cy, mx: this.mx, my: this.my, dist, s: this.s, cx, cy, moved: this.gesture?.moved ?? false };
  }
  private move(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId) || !this.gesture) return;
    this.pointers.set(e.pointerId, this.local(e));
    const g = this.gesture, pts = [...this.pointers.values()];
    const cx = pts.reduce((n, p) => n + p.x, 0) / pts.length, cy = pts.reduce((n, p) => n + p.y, 0) / pts.length;
    if (!g.moved && Math.hypot(cx - g.sx, cy - g.sy) < 5 && pts.length < 2) return;
    if (!g.moved) {
      g.moved = true;
      // A drag from a pin pans the map: the pointer is the view's from here on (and the click that ends it is not a tap).
      try { this.viewRef.nativeElement.setPointerCapture(e.pointerId); } catch { /* already released */ }
    }
    e.preventDefault();
    if (pts.length >= 2 && g.dist > 0) {
      // Zoom about the pinch's first middle (in whole steps), then follow the middle's drift.
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.mx = g.mx; this.my = g.my; this.s = g.s;
      this.zoomTo(g.cx, g.cy, g.s * d / g.dist);
      this.want = this.s;
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
