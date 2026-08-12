/**
 * xp-bar.component.ts — the progression readout in the header.
 *
 * Collapsed it is a rank title over a thin split bar: Aether fills from the
 * left, Nox from the right, and where they meet tells you which realm has more
 * of your time. Clicking expands a panel with the numbers behind it.
 *
 * Standalone so it can be dropped into the (non-standalone) HeaderComponent via
 * AppModule's imports without pulling the module graph around.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { XpService, XpSnapshot } from './xp.service';
import { CloudSaveButtonComponent } from '../cloud-save/cloud-save-button.component';
import { CloudSaveService, SyncStatus } from '../cloud-save/cloud-save.service';

@Component({
  selector: 'app-xp-bar',
  standalone: true,
  imports: [CommonModule, CloudSaveButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="xpb" [class.xpb--open]="open">
      <button
        type="button"
        class="xpb__trigger"
        (click)="toggle()"
        [attr.aria-expanded]="open"
        [attr.aria-label]="triggerLabel">
        <span class="xpb__rank">{{ snap.level.level }}</span>
        <span class="xpb__meta">
          <span class="xpb__title">{{ snap.level.title }}</span>
          <span class="xpb__track" aria-hidden="true">
            <span class="xpb__fill" [style.width.%]="snap.progress * 100"></span>
            <span class="xpb__split" [style.left.%]="snap.aetherShare * 100"></span>
          </span>
        </span>
        @if (snap.streak > 1) {
          <span class="xpb__streak" [attr.title]="snap.streak + ' day streak'">{{ snap.streak }}<span aria-hidden="true">&#9788;</span></span>
        }
        <!-- Only once there is something to say. A cloud on the header of
             somebody who has never signed in is an advert, not a status. -->
        @if (sync.uid !== null) {
          <span
            class="xpb__sync"
            [attr.data-state]="sync.state"
            [attr.title]="syncTooltip"
            aria-hidden="true">{{ syncGlyph }}</span>
        }
      </button>

      @if (open) {
        <div class="xpb__panel" role="dialog" aria-label="Progression">
          <p class="xpb__panel-rank">
            <span class="xpb__panel-title">{{ snap.level.title }}</span>
            <span class="xpb__panel-xp">{{ snap.xp }} XP</span>
          </p>
          <p class="xpb__panel-next">
            @if (snap.next) {
              {{ snap.toNext }} XP to <strong>{{ snap.next.title }}</strong>
            } @else {
              The Eclipse is yours. Nothing left to climb.
            }
          </p>

          <div class="xpb__energy">
            <span class="xpb__energy-row xpb__energy-row--aether">
              <span class="xpb__energy-label">Aether</span>
              <span class="xpb__energy-val">{{ snap.aether }}</span>
            </span>
            <span class="xpb__energy-bar" aria-hidden="true">
              <span class="xpb__energy-aether" [style.width.%]="snap.aetherShare * 100"></span>
            </span>
            <span class="xpb__energy-row xpb__energy-row--nox">
              <span class="xpb__energy-label">Nox</span>
              <span class="xpb__energy-val">{{ snap.nox }}</span>
            </span>
          </div>

          <dl class="xpb__stats">
            <div><dt>Streak</dt><dd>{{ snap.streak }}d</dd></div>
            <div><dt>Best</dt><dd>{{ snap.bestStreak }}d</dd></div>
            <div><dt>Tools</dt><dd>{{ snap.toolsUsed }}</dd></div>
          </dl>

          <p class="xpb__whisper">between light and shadow, the soul remembers both</p>

          <app-cloud-save-button></app-cloud-save-button>
        </div>
      }
    </div>
  `,
  styles: [`
    .xpb { position: relative; display: inline-block; }

    .xpb__trigger {
      display: flex; align-items: center; gap: 8px;
      min-height: 44px; padding: 4px 10px;
      background: rgba(10, 6, 26, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      color: inherit; cursor: pointer;
      transition: border-color .25s ease, box-shadow .25s ease;
    }
    .xpb__trigger:hover, .xpb--open .xpb__trigger {
      border-color: rgba(139, 92, 246, 0.45);
      box-shadow: 0 0 24px -8px rgba(139, 92, 246, 0.6);
    }

    .xpb__rank {
      display: grid; place-items: center;
      width: 26px; height: 26px; flex: none;
      border-radius: 50%;
      font: 700 12px/1 'Orbitron', system-ui, sans-serif;
      color: #F2ECFF;
      background:
        radial-gradient(circle at 32% 28%, #F2ECFF 0%, rgba(255,255,255,.3) 18%, rgba(255,255,255,0) 42%),
        radial-gradient(circle at 50% 50%, #A78BFA 0%, rgba(8,3,24,.92) 88%);
      box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
    }

    .xpb__meta { display: flex; flex-direction: column; gap: 3px; min-width: 92px; }
    .xpb__title {
      font: 600 12px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: .04em; color: #cfe9e2; white-space: nowrap;
    }

    .xpb__track {
      position: relative; display: block; height: 4px;
      border-radius: 999px; overflow: hidden;
      background: rgba(255, 255, 255, 0.09);
    }
    .xpb__fill {
      position: absolute; inset: 0 auto 0 0;
      background: linear-gradient(90deg, #A78BFA, #7b61ff);
      transition: width .6s cubic-bezier(.22, 1, .36, 1);
    }
    /* The seam between the two energies, drawn over the rank fill. */
    .xpb__split {
      position: absolute; top: -1px; bottom: -1px; width: 1px;
      background: rgba(255, 109, 215, 0.9);
      transition: left .6s cubic-bezier(.22, 1, .36, 1);
    }

    .xpb__streak {
      font: 600 11px/1 'Orbitron', system-ui, sans-serif;
      color: #ffc669; white-space: nowrap;
    }
    .xpb__streak span { margin-left: 2px; }

    .xpb__sync { font-size: 11px; line-height: 1; color: #A78BFA; }
    .xpb__sync[data-state="syncing"] {
      color: #ffc669;
      display: inline-block;
      animation: xpbSyncSpin 1.1s linear infinite;
    }
    .xpb__sync[data-state="error"] { color: #ff6dd7; }
    @keyframes xpbSyncSpin { to { transform: rotate(360deg); } }

    .xpb__panel {
      position: absolute; top: calc(100% + 10px); right: 0; z-index: 60;
      width: min(260px, calc(100vw - 32px));
      padding: 14px;
      border-radius: 14px;
      border: 1px solid rgba(139, 92, 246, 0.22);
      background:
        radial-gradient(ellipse 70% 60% at 20% 0%, rgba(139, 92, 246, 0.09), transparent 65%),
        radial-gradient(ellipse 60% 55% at 90% 100%, rgba(123, 97, 255, 0.11), transparent 65%),
        rgba(6, 4, 18, 0.94);
      box-shadow: 0 18px 48px -18px rgba(0, 0, 0, 0.9);
      animation: xpbIn .28s cubic-bezier(.22, 1, .36, 1);
    }
    @keyframes xpbIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }

    .xpb__panel-rank { display: flex; justify-content: space-between; align-items: baseline; margin: 0 0 4px; }
    .xpb__panel-title { font: 700 14px/1.2 'Orbitron', system-ui, sans-serif; color: #A78BFA; }
    .xpb__panel-xp { font-size: 12px; color: #9fb4ae; }
    .xpb__panel-next { margin: 0 0 12px; font-size: 12px; color: #b9cdc7; }
    .xpb__panel-next strong { color: #c48bff; font-weight: 600; }

    .xpb__energy { display: grid; gap: 5px; margin-bottom: 12px; }
    .xpb__energy-row { display: flex; justify-content: space-between; font-size: 12px; }
    .xpb__energy-row--aether { color: #A78BFA; }
    .xpb__energy-row--nox { color: #c48bff; }
    .xpb__energy-bar {
      display: block; height: 5px; border-radius: 999px; overflow: hidden;
      background: #7b61ff;
    }
    .xpb__energy-aether { display: block; height: 100%; background: #A78BFA; transition: width .6s ease; }

    .xpb__stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 0 0 10px; }
    .xpb__stats div { text-align: center; }
    .xpb__stats dt { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: #7d918c; }
    .xpb__stats dd { margin: 2px 0 0; font: 600 14px/1 'Orbitron', system-ui, sans-serif; color: #F2ECFF; }

    .xpb__whisper { margin: 0; font-size: 10px; font-style: italic; color: #6d817c; text-align: center; }

    /* Mobile: the header row is already tight — drop the rank title, keep the
       orb, the bar and the streak. The full numbers live in the panel. */
    @media (max-width: 720px) {
      .xpb__meta { min-width: 54px; }
      .xpb__title { display: none; }
    }

    /* Below 960px the bar moves into the mobile drawer (see header.component.css,
       which switches .nav-xp for .nav-xp--drawer at exactly this width). In there
       it sits hard against the left edge, so a 260px panel anchored to its *right*
       edge hangs about 125px off the side of the viewport — clipped, not
       scrollable, and taking half of the cloud save button with it. Anchoring
       left instead puts the whole panel on screen at 375px with room to spare. */
    @media (max-width: 960px) {
      .xpb__panel { right: auto; left: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .xpb__fill, .xpb__split, .xpb__energy-aether { transition: none; }
      .xpb__panel { animation: none; }
      /* The glyph still changes to ↻, so the state is still legible standing
         still — this drops the spin, not the signal. */
      .xpb__sync[data-state="syncing"] { animation: none; }
    }
  `],
})
export class XpBarComponent implements OnInit, OnDestroy {
  private readonly xp = inject(XpService);
  private readonly cloud = inject(CloudSaveService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly subs = new Subscription();

  open = false;
  snap: XpSnapshot = this.xp.snapshot;
  sync = this.cloud.status;

  ngOnInit(): void {
    // Fire-and-forget: the subscription below repaints the bar when hydration
    // lands, so there is nothing to wait for here.
    void this.xp.init();
    this.subs.add(this.xp.snapshot$.subscribe(s => {
      this.snap = s;
      this.cdr.markForCheck();
    }));

    // The XP bar is on every page, which makes it the natural place to start
    // cloud save from. `init()` is idempotent and does nothing at all unless
    // this browser has already been bound, so an anonymous visitor pays for a
    // single localStorage read.
    this.cloud.init();
    this.subs.add(this.cloud.status$.subscribe(s => {
      this.sync = s;
      this.cdr.markForCheck();
    }));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  /** The whole trigger in one string, because the sync glyph is decorative. */
  get triggerLabel(): string {
    const base = `Level ${this.snap.level.level}, ${this.snap.level.title}. ${this.snap.xp} XP.`;
    const cloud = this.sync.uid === null
      ? ''
      : ` Cloud save ${this.sync.state === 'off' ? 'inactive' : this.sync.state}.`;
    return `${base}${cloud} Open progression panel.`;
  }

  get syncGlyph(): string {
    switch (this.sync.state) {
      case 'syncing': return '↻';
      case 'error':   return '⚠';
      default:        return '☁';
    }
  }

  get syncTooltip(): string {
    if (this.sync.state === 'error') return this.sync.error ?? 'Sync failed';
    if (this.sync.state === 'syncing') return 'Syncing…';
    if (this.sync.lastSyncedAt === null) return 'Cloud save on';
    const minutes = Math.round((Date.now() - this.sync.lastSyncedAt) / 60_000);
    if (minutes < 1) return 'Last synced: a moment ago';
    if (minutes < 60) return `Last synced: ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.round(minutes / 60);
    return `Last synced: ${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  toggle(): void {
    this.open = !this.open;
  }

  /** Click-away and Escape both close the panel — it is a popover, not a modal. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open || !this.isBrowser) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.open) return;
    this.open = false;
    this.cdr.markForCheck();
  }
}
