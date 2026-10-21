/**
 * voyage.component.ts — the crossing (docs/design/realms-endgame.md §1.5): a fade to the sea, a short pixel deck scene
 * (the Keeper at the rail, gulls, Glim on the bowsprit, the destination's silhouette sliding in, the day, night or
 * eclipse sky it sails under), one line of sea-lore, then a fade into the arrival. Skippable by tap or Escape. With
 * reduced motion it is one still card with a one-second fade. It owns no game state: it tells the host when the Keeper
 * has left the old shore (`depart`, hidden behind the fade) and when the crossing is over (`done`).
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, AfterViewInit, Output, ViewChild, inject } from '@angular/core';
import { TranslationService } from '../../translation.service';
import type { SkyPhase } from '../../shared/world-clock/world-clock.model';
import { HARBOUR_I18N } from './harbour.i18n';

/** The timeline in seconds: fade in, the departure (behind the fade), the start of the fade out, the end. */
export const VOYAGE = { moving: { depart: 1.3, leave: 4.4, end: 5.2 }, still: { depart: .5, leave: .6, end: 1.6 } } as const;
const W = 192, H = 108, HORIZON = 54;

@Component({
  selector: 'app-voyage',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="vy" role="dialog" aria-modal="true" tabindex="-1" data-harbour-voyage [attr.data-still]="still" [class.vy--in]="shown" [class.vy--out]="leaving"
         [attr.aria-label]="t('harbour.voyage.aria', { pier: t('harbour.pier.' + dest) })" (click)="skip()" (keydown.escape)="skip()">
      <canvas #cv class="vy__scene" [width]="W" [height]="H" aria-hidden="true"></canvas>
      <p class="vy__to">{{ t('harbour.voyage.to', { pier: t('harbour.pier.' + dest) }) }}</p>
      <p class="vy__line" data-harbour-lore>{{ still ? t('harbour.voyage.still') : t('harbour.sea.' + lore) }}</p>
      <button type="button" class="vy__skip" data-harbour-skip (click)="skip(); $event.stopPropagation()">{{ t('harbour.voyage.skip') }}</button>
    </div>
  `,
  styleUrl: './voyage.component.css',
})
export class VoyageComponent implements AfterViewInit, OnDestroy {
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly W = W; readonly H = H;
  /** The destination pier (td-harbour) and its continent (for the silhouette). */
  @Input() dest = '';
  @Input() land = 'ember-isle';
  @Input() phase: SkyPhase = 'day';
  /** The Keeper's face at the rail (a data URL, engine.heroPortrait) and whether motion is off. */
  @Input() portrait = '';
  @Input() still = false;
  /** The Keeper has gone from the old shore: the host moves the engine now, behind the fade. */
  @Output() readonly depart = new EventEmitter<void>();
  @Output() readonly done = new EventEmitter<void>();
  @ViewChild('cv', { static: true }) cv!: ElementRef<HTMLCanvasElement>;

  shown = false;
  leaving = false;
  lore = Math.floor(Math.random() * 6);
  private departed = false;
  private finished = false;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private raf = 0;
  private t0 = 0;
  private face: HTMLImageElement | null = null;

  constructor() { this.i18n.register(HARBOUR_I18N); }

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    const tl = this.still ? VOYAGE.still : VOYAGE.moving;
    if (this.portrait) { this.face = new Image(); this.face.onload = () => { if (this.still) this.draw(2.2); }; this.face.src = this.portrait; }
    // The first frame must be in the DOM before the fade class lands, or the fade does not play.
    this.timers.push(setTimeout(() => { this.shown = true; this.cdr.markForCheck(); }, 20));
    this.timers.push(setTimeout(() => this.leave(), tl.depart * 1000));
    this.timers.push(setTimeout(() => { this.leaving = true; this.cdr.markForCheck(); }, tl.leave * 1000));
    this.timers.push(setTimeout(() => this.finish(), tl.end * 1000));
    this.t0 = performance.now();
    if (this.still) this.draw(2.2); else this.frame();
    this.cv.nativeElement.parentElement?.focus({ preventScroll: true });
  }

  private leave(): void { if (this.departed) return; this.departed = true; this.depart.emit(); }
  private finish(): void { if (this.finished) return; this.finished = true; this.leave(); this.done.emit(); }

  @HostListener('window:keydown.escape')
  onEscape(): void { this.skip(); }

  /** A tap, the Skip button or Escape: leave the old shore at once if not yet, fade out fast, and end. */
  skip(): void {
    if (this.finished) return;
    this.leave();
    this.leaving = true; this.cdr.markForCheck();
    for (const id of this.timers) clearTimeout(id);
    this.timers = [setTimeout(() => this.finish(), 220)];
  }

  private frame = (): void => {
    this.draw((performance.now() - this.t0) / 1000);
    this.raf = requestAnimationFrame(this.frame);
  };

  /** One frame of the deck scene at second `t`: sky, sun or eclipse, the far land, sea, the bow, the rail, the Keeper, gulls. */
  private draw(t: number): void {
    const c = this.cv.nativeElement.getContext('2d');
    if (!c) return;
    c.imageSmoothingEnabled = false;
    const night = this.phase === 'night', eclipse = this.phase === 'eclipse', dusk = this.phase === 'dusk' || this.phase === 'dawn';
    const sky = night ? ['#0d0f26', '#1b2149'] : eclipse ? ['#1a0f2e', '#4a2a6e'] : dusk ? ['#3a2a58', '#e0875a'] : ['#6aa6d8', '#cfe6f2'];
    const g = c.createLinearGradient(0, 0, 0, HORIZON);
    g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
    c.fillStyle = g; c.fillRect(0, 0, W, HORIZON);
    // Stars by night and under the eclipse; the sun by day; the black disc and its ring under the eclipse.
    if (night || eclipse) { c.fillStyle = '#e8eeff'; for (let i = 0; i < 26; i++) { const x = (i * 71) % W, y = (i * 37) % (HORIZON - 8); if ((i + Math.floor(t * 2)) % 5) c.fillRect(x, y, 1, 1); } }
    if (this.phase === 'day' || dusk) { c.fillStyle = dusk ? '#ffb070' : '#fff3b0'; c.beginPath(); c.arc(148, dusk ? 46 : 20, 7, 0, 7); c.fill(); }
    if (eclipse) {
      c.fillStyle = '#c9a0ff'; c.beginPath(); c.arc(140, 22, 11, 0, 7); c.fill();
      c.fillStyle = '#0a0612'; c.beginPath(); c.arc(140, 22, 9, 0, 7); c.fill();
      // A Wanewalker's lamp, far off the bow.
      c.fillStyle = '#ffe9a8'; c.fillRect(24, HORIZON - 3, 1, 2);
    }
    // The far land slides in from the right: its silhouette by continent.
    const slide = this.still ? 0 : Math.max(0, 1 - t / 4.2), lx = 96 + slide * 120;
    this.land_(c, lx, t);
    // The sea: banded, with a slow swell.
    for (let y = HORIZON; y < H; y++) {
      const k = (y - HORIZON) / (H - HORIZON), wave = Math.sin(y * .7 + t * 2.2) * 2;
      c.fillStyle = night || eclipse ? (k < .5 ? '#13264a' : '#0c1a38') : (k < .5 ? '#2f7fae' : '#245f86');
      c.fillRect(0, y, W, 1);
      c.fillStyle = night || eclipse ? '#2a4a80' : '#7cc1e0';
      for (let x = (y * 13) % 24; x < W; x += 24) c.fillRect(Math.round(x + wave + t * 3) % W, y, 5, 1);
    }
    // The bow: the deck planks at the foot, the rail, the bowsprit with Glim on it.
    const bob = this.still ? 0 : Math.sin(t * 1.6) * 1.2;
    c.fillStyle = '#5a3a24'; c.fillRect(0, 88 + bob, W, H);
    c.fillStyle = '#3b2415'; for (let x = 0; x < W; x += 16) c.fillRect(x, 92 + bob, 1, H);
    c.fillStyle = '#8a5a32'; c.fillRect(0, 84 + bob, W, 4);
    c.fillStyle = '#24150c'; c.fillRect(0, 88 + bob, W, 1);
    c.fillStyle = '#6e4526'; for (let x = 6; x < W; x += 32) c.fillRect(x, 74 + bob, 3, 10);
    c.fillStyle = '#a06a3b'; c.fillRect(0, 74 + bob, W, 2);
    c.fillStyle = '#6e4526'; c.beginPath(); c.moveTo(96, 80 + bob); c.lineTo(168, 62 + bob); c.lineTo(168, 64 + bob); c.lineTo(96, 84 + bob); c.fill();
    // Glim on the bowsprit: a small warm light that bobs and breathes.
    const gl = 1 + (this.still ? 0 : Math.sin(t * 3) * .4);
    c.fillStyle = 'rgba(255, 220, 140, .35)'; c.beginPath(); c.arc(160, 58 + bob, 5 * gl, 0, 7); c.fill();
    c.fillStyle = '#ffe9a8'; c.fillRect(159, 57 + bob, 3, 3);
    // The Keeper at the rail.
    if (this.face?.complete && this.face.naturalWidth) c.drawImage(this.face, 40, 52 + bob, 22, 22);
    // Gulls.
    c.fillStyle = night || eclipse ? '#8a90b0' : '#f4efe2';
    for (let i = 0; i < 3; i++) {
      const gx = ((i * 83 + t * (14 + i * 4)) % (W + 20)) - 10, gy = 12 + i * 11 + Math.sin(t * 2 + i) * 3, flap = this.still || Math.floor(t * 4 + i) % 2 ? 1 : 0;
      c.fillRect(gx, gy + flap, 2, 1); c.fillRect(gx + 2, gy, 1, 1); c.fillRect(gx + 3, gy + flap, 2, 1);
    }
  }

  /** The destination's silhouette on the horizon, centred on x: a mound, jagged peaks, round canopy or a low fen with a lantern. */
  private land_(c: CanvasRenderingContext2D, x: number, t: number): void {
    const dark = this.phase === 'night' || this.phase === 'eclipse';
    c.fillStyle = dark ? '#150f26' : '#4a5a6e';
    const base = HORIZON;
    if (this.land === 'infernal-reach') {
      const peaks = [-40, -26, -12, 4, 20, 36];
      peaks.forEach((p, i) => { const h = 10 + ((i * 7) % 9); c.beginPath(); c.moveTo(x + p - 9, base); c.lineTo(x + p, base - h); c.lineTo(x + p + 9, base); c.fill(); });
      c.fillStyle = '#e8752a'; c.fillRect(x - 12, base - 14, 1, 2); c.fillRect(x + 20, base - 17, 1, 2);
    } else if (this.land === 'verdant-wilds') {
      for (let i = -5; i <= 5; i++) { c.beginPath(); c.arc(x + i * 8, base - 2, 7 + ((i * i) % 3), Math.PI, 0); c.fill(); }
    } else if (this.land === 'umbral-marches') {
      c.fillRect(x - 46, base - 3, 92, 3);
      c.fillRect(x - 3, base - 14, 6, 11);
      c.fillStyle = Math.floor(t * 1.5) % 2 || this.still ? '#ffe9a8' : '#a48bff'; c.fillRect(x - 1, base - 17, 2, 3);
    } else {
      c.beginPath(); c.moveTo(x - 36, base); c.lineTo(x - 8, base - 12); c.lineTo(x + 8, base - 9); c.lineTo(x + 36, base); c.fill();
      c.fillStyle = '#c9a0ff'; c.fillRect(x - 2, base - 13, 2, 2);
    }
    // Sea haze at its foot.
    c.fillStyle = dark ? 'rgba(40, 60, 110, .45)' : 'rgba(207, 230, 242, .55)'; c.fillRect(x - 50, base - 2, 100, 2);
  }

  t(key: string, params?: Record<string, string | number>): string { return this.i18n.translate(key, params); }

  ngOnDestroy(): void { for (const id of this.timers) clearTimeout(id); if (this.raf) cancelAnimationFrame(this.raf); }
}
