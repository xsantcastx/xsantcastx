/**
 * travel-map.component.ts — the Travel map (One World §3.3, §3.5).
 *
 * Opens at a lit Waystone (E), on M in a world, and at the town stone through
 * `?at=waystone`. Lazy and standalone: the play view loads it into its place
 * panel. It IS the Mirror Slate's Map app to be: it codes against
 * WaystoneService's contract only (view$, travel, recall, canTravel), never the
 * engine.
 *
 * Phone-first: the world's map full-bleed with a ≥ 44 px pin per stone, the
 * list of stones under it (the same stones, for thumbs and screen readers), one
 * primary button pinned at the bottom ("Travel to the Quarry Head stone"), and
 * the Meridian Survey behind Details (the station kit's rule: details behind a
 * tap). Lit stones are gold pins, seen-but-dark ones grey (not travellable).
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, NgZone, OnDestroy, OnInit, Output, ViewChild, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslationService } from '../../translation.service';
import { WaystoneService, type TravelChannel, type WaystonePin, type WaystoneView } from '../../shared/waystones/waystones.service';
import { MERIDIAN_SURVEY, surveyCount, SURVEY_MARKS } from '../../shared/waystones/waystones.model';
import { drawDelveMap, type MapSource } from '../engine/delve-map';
import { TRAVEL_MAP_I18N } from './world-travel.i18n';

/** A pin as laid over the map: its stone and where it sits (CSS px in the map box). */
interface PinSpot { stone: WaystonePin; x: number; y: number }

@Component({
  selector: 'app-travel-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="travel" [attr.data-world]="view.world" data-engine-ignore>
      <p class="travel-lead">{{ t('travelmap.lead') }}</p>
      <div class="travel-map" #box>
        <canvas #map role="img" [attr.aria-label]="t('travelmap.mapLabel', { world: worldName(view.world) })"></canvas>
        @for (pin of pins; track pin.stone.id) {
          <button type="button" class="pin" [class.pin--lit]="pin.stone.lit" [class.pin--here]="pin.stone.id === view.here" [class.pin--picked]="pin.stone.id === picked"
                  [style.left.px]="pin.x" [style.top.px]="pin.y" [attr.data-stone]="pin.stone.id" [attr.aria-label]="name(pin.stone) + (pin.stone.lit ? '' : ' · ' + t('travelmap.unlit'))"
                  (click)="pick(pin.stone.id)"><i aria-hidden="true"></i></button>
        }
      </div>
      <h3 class="travel-head">{{ t('travelmap.thisWorld', { world: worldName(view.world) }) }}</h3>
      <ul class="travel-list">
        @for (stone of local; track stone.id) {
          <li><button type="button" class="row" [class.row--lit]="stone.lit" [class.row--picked]="stone.id === picked" [attr.data-row]="stone.id" (click)="pick(stone.id)">
            <i class="dot" aria-hidden="true"></i><span>{{ name(stone) }}</span>
            <small>{{ stone.id === view.here ? t('travelmap.here') : stone.lit ? '' : t('travelmap.unlit') }}</small>
          </button></li>
        }
        @if (recallTown) {
          <li><button type="button" class="row row--recall" data-row="recall" [class.row--picked]="picked === 'recall'" (click)="pick('recall')">
            <i class="dot" aria-hidden="true"></i><span>{{ t('travelmap.recall', { town: recallTown }) }}</span><small>{{ t('travelmap.recallSub') }}</small>
          </button></li>
        }
      </ul>
      @if (remote.length) {
        <h3 class="travel-head">{{ t('travelmap.otherRealms') }}</h3>
        <ul class="travel-list">
          @for (stone of remote; track stone.id) {
            <li><button type="button" class="row row--lit" [class.row--picked]="stone.id === picked" [attr.data-row]="stone.id" (click)="pick(stone.id)">
              <i class="dot" aria-hidden="true"></i><span>{{ name(stone) }}</span>
            </button></li>
          }
        </ul>
      }
      <details class="travel-details">
        <summary>{{ t('travelmap.details') }}</summary>
        <p>{{ t('travelmap.survey', { n: surveyN, total: surveyTotal }) }} {{ t('travelmap.wildTally', { n: wildLit }) }}</p>
        <ul>@for (mark of marks; track mark.id) {<li [class.got]="mark.got">{{ t('travelmap.mark.' + mark.id) }}</li>}</ul>
        <p class="lore">{{ t('travelmap.lore') }}</p>
      </details>
      <div class="travel-act">
        @if (channel; as ch) {
          <div class="bar" role="progressbar" [attr.aria-label]="channelLine(ch)"><i [style.animation-duration.s]="ch.seconds"></i></div>
          <p class="act-line" aria-live="polite">{{ channelLine(ch) }}</p>
          <button type="button" class="secondary" (click)="cancel()">{{ t('travelmap.cancel') }}</button>
        } @else {
          @if (refusal) { <p class="act-line act-line--no" aria-live="polite">{{ t(refusal) }}</p> }
          <button type="button" class="primary" data-act="travel" [disabled]="!actionable" (click)="go()">{{ actionLabel }}</button>
          <button type="button" class="secondary" (click)="fullMap.emit()">{{ t('travelmap.fullMap') }}</button>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .travel { display: grid; gap: 10px; padding-bottom: 6px; }
    .travel-lead { margin: 0; color: var(--ink-2); font: 500 0.92rem/1.35 var(--font-ui); }
    .travel-map { position: relative; height: clamp(180px, 34vh, 300px); border: var(--border-hairline); border-radius: var(--radius-md); overflow: hidden; background: var(--obsidian-1); }
    .travel-map canvas { width: 100%; height: 100%; display: block; image-rendering: pixelated; }
    .pin { position: absolute; width: 44px; height: 44px; margin: -40px 0 0 -22px; padding: 0; border: 0; background: none; cursor: pointer; display: grid; place-items: end center; }
    .pin i { width: 14px; height: 26px; border-radius: 3px 3px 1px 1px; background: var(--obsidian-4); box-shadow: 0 0 0 2px var(--obsidian-0); }
    .pin--lit i { background: var(--gold); box-shadow: 0 0 0 2px var(--obsidian-0), 0 0 12px var(--gold); }
    .pin--here i { outline: 2px solid var(--ink-0); outline-offset: 2px; }
    .pin--picked i { transform: translateY(-4px); }
    .pin:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .travel-head { margin: 4px 0 0; color: var(--gold); font: 600 0.78rem/1.2 var(--font-ui); letter-spacing: 0.08em; text-transform: uppercase; }
    .travel-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .row { width: 100%; min-height: 44px; display: grid; grid-template-columns: 18px 1fr auto; align-items: center; gap: 10px; padding: 8px 12px; text-align: left;
      border: var(--border-hairline); border-radius: var(--radius-md); background: var(--obsidian-2); color: var(--ink-1); font: 500 0.95rem/1.25 var(--font-ui); cursor: pointer; }
    .row small { color: var(--ink-3); font-size: 0.78rem; }
    .row .dot { width: 10px; height: 16px; border-radius: 2px; background: var(--obsidian-4); }
    .row--lit .dot { background: var(--gold); }
    .row--recall .dot { background: var(--ember); }
    .row--picked { border-color: var(--edge-gold); background: var(--obsidian-3); color: var(--ink-0); }
    .row:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .travel-details { color: var(--ink-2); font: 500 0.88rem/1.4 var(--font-ui); }
    .travel-details summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; color: var(--ink-1); }
    .travel-details ul { margin: 6px 0; padding-left: 18px; }
    .travel-details li.got { color: var(--gold); }
    .travel-details .lore { font-family: var(--font-lore); font-style: italic; }
    .travel-act { position: sticky; bottom: 0; display: grid; gap: 6px; padding-top: 8px; background: linear-gradient(transparent, var(--obsidian-1) 18%); }
    .act-line { margin: 0; color: var(--ink-1); font: 500 0.9rem/1.3 var(--font-ui); text-align: center; }
    .act-line--no { color: var(--feedback-warn); }
    .primary, .secondary { min-height: 48px; border-radius: var(--radius-md); font: 700 1rem/1 var(--font-ui); cursor: pointer; }
    .primary { border: var(--border-gold); background: var(--action-primary-bg); color: var(--action-primary-fg); }
    .primary:hover:not(:disabled) { background: var(--action-primary-bg-hover); }
    .primary:disabled { background: var(--action-disabled-bg); color: var(--action-disabled-fg); cursor: default; }
    .secondary { min-height: 44px; border: 1px solid var(--action-secondary-border); background: var(--action-secondary-bg); color: var(--action-secondary-fg); font-weight: 600; }
    .bar { height: 8px; border-radius: var(--radius-pill); background: var(--obsidian-3); overflow: hidden; }
    .bar i { display: block; height: 100%; width: 100%; background: var(--gold); transform-origin: left; animation: fill linear forwards; }
    @keyframes fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    @media (prefers-reduced-motion: reduce) { .bar i { animation: none; transform: none; } }
  `],
})
export class TravelMapComponent implements OnInit, OnDestroy {
  private readonly waystones = inject(WaystoneService);
  private readonly i18n = inject(TranslationService);
  private readonly cd = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  @ViewChild('map', { static: true }) private canvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('box', { static: true }) private box!: ElementRef<HTMLElement>;
  /** The world's map picture (the engine's MapSource), set by the host. */
  source: (() => MapSource | null) | null = null;
  /** Arrived (or recalled): the host closes the panel. */
  @Output() readonly closed = new EventEmitter<void>();
  /** "Full map": the host opens the Delve's full map (pins, the way to camp). */
  @Output() readonly fullMap = new EventEmitter<void>();

  view: WaystoneView = { world: null, stones: [], anchors: [], here: null };
  channel: TravelChannel | null = null;
  picked: string | null = null;
  pins: PinSpot[] = [];
  local: WaystonePin[] = [];
  remote: WaystonePin[] = [];
  marks: { id: string; got: boolean }[] = [];
  surveyN = 0;
  readonly surveyTotal = MERIDIAN_SURVEY.length;
  wildLit = 0;
  private subs: Subscription[] = [];
  private failed = false;

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  constructor() { this.i18n.register(TRAVEL_MAP_I18N); }

  ngOnInit(): void {
    this.subs.push(this.waystones.view$.subscribe(view => { this.view = view; this.rebuild(); this.cd.markForCheck(); }));
    this.subs.push(this.waystones.channel$.subscribe(ch => { this.channel = ch; this.cd.markForCheck(); }));
    this.waystones.refresh();
    // Laid out first, then drawn (the canvas has its size after the first render).
    setTimeout(() => this.zone.run(() => { this.draw(); this.cd.markForCheck(); }));
  }
  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); if (this.channel) this.waystones.cancel(); }

  /** A stone's name: an authored stone's working name, a wild one by how far it is from the town. */
  name(stone: Pick<WaystonePin, 'id' | 'col'>): string {
    const wild = /:ws:(-?\d+)$/.exec(stone.id);
    if (wild) { const n = Number(wild[1]); return this.t('travelmap.stone.wild', { n: Math.abs(n), dir: this.t(n < 0 ? 'travelmap.dir.west' : 'travelmap.dir.east') }); }
    const key = `travelmap.stone.${stone.id.replace(':', '-')}`, named = this.t(key);
    return named === key ? stone.id : named;
  }
  worldName(world: string | null): string { return world ? this.t(`travelmap.world.${world}`) : ''; }
  get recallTown(): string | null {
    const town = this.view.stones.find(s => s.kind === 'town' && s.world === this.view.world);
    return town && this.view.here !== town.id ? this.name(town) : null;
  }
  get refusal(): string | null { return this.waystones.canTravel(); }
  get pickedStone(): WaystonePin | null { return this.view.stones.find(s => s.id === this.picked) ?? null; }
  get actionable(): boolean {
    if (this.refusal) return false;
    if (this.picked === 'recall') return !!this.recallTown;
    const s = this.pickedStone;
    return !!s && s.lit && s.id !== this.view.here;
  }
  get actionLabel(): string {
    if (this.failed) return this.t('travelmap.failed');
    if (this.picked === 'recall' && this.recallTown) return this.t('travelmap.recall', { town: this.recallTown });
    const s = this.pickedStone;
    return s ? this.t('travelmap.travelTo', { name: this.name(s) }) : this.t('travelmap.pick');
  }
  channelLine(ch: TravelChannel): string {
    if (ch.kind === 'recall') return this.t('travelmap.channel.recall', { town: this.recallTown ?? '' });
    const s = this.view.stones.find(row => row.id === ch.id);
    return this.t('travelmap.channel.travel', { name: s ? this.name(s) : '' });
  }

  pick(id: string): void { this.picked = id; this.failed = false; this.draw(); this.cd.markForCheck(); }

  async go(): Promise<void> {
    if (!this.actionable || !this.picked) return;
    const ok = this.picked === 'recall' ? await this.waystones.recall() : await this.waystones.travel(this.picked);
    if (ok) this.closed.emit();
    else { this.failed = !this.waystones.canTravel(); this.cd.markForCheck(); }
  }
  cancel(): void { this.waystones.cancel(); }

  private rebuild(): void {
    this.local = this.view.stones.filter(s => s.world === this.view.world).sort((a, b) => a.col - b.col);
    this.remote = this.view.stones.filter(s => s.world !== this.view.world && s.lit);
    const lit = { lit: this.view.stones.filter(s => s.lit && s.kind !== 'town').map(s => s.id) };
    this.surveyN = surveyCount(lit);
    this.wildLit = this.view.stones.filter(s => s.kind === 'wild' && s.lit).length;
    this.marks = SURVEY_MARKS.map(m => ({ id: m.id, got: this.surveyN >= m.at }));
    if (!this.picked) this.picked = this.local.find(s => s.lit && s.id !== this.view.here)?.id ?? null;
    this.draw();
  }

  /** The world's map behind the pins, framed to hold every stone in this world (and the Keeper). */
  private draw(): void {
    const canvas = this.canvas?.nativeElement, box = this.box?.nativeElement;
    const source = this.source?.() ?? null;
    if (!canvas || !box) { this.pins = []; return; }
    const w = box.clientWidth, h = box.clientHeight;
    const cols = this.local.map(s => s.col);
    if (source) cols.push(source.keeper.col);
    if (!w || !h || !cols.length) { this.pins = []; return; }
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const lo = Math.min(...cols) - 12, hi = Math.max(...cols) + 12;
    const cell = Math.max(1, Math.floor(w / (hi - lo)));
    const s = Math.max(1, Math.round(cell * dpr));
    const centerCol = (lo + hi) / 2, centerRow = -6;
    const c = canvas.getContext('2d');
    if (c && source) drawDelveMap(c, source, { width: canvas.width, height: canvas.height, scale: s, centerCol, centerRow });
    const ox = Math.round(canvas.width / 2 - centerCol * s), oy = Math.round(canvas.height / 2 - centerRow * s);
    this.pins = this.local.map(stone => ({ stone, x: (ox + (stone.col + .5) * s) / dpr, y: (oy + stone.row * s) / dpr }))
      .filter(p => p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h + 20);
  }
}
