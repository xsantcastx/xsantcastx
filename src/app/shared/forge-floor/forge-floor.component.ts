/**
 * forge-floor.component.ts — the factory floor above each Forge bench.
 *
 * Stockpile → belt → three stations (anvil, enchanting table, rune forge) → bag.
 * When a bench settles a craft, a socket, a brew or a strike, it passes a
 * `ForgeFloorEvent` in and the floor plays it: the inputs ride from the
 * stockpile into the station, the station works, and the output pops out on a
 * crafting burst and flies to the bag.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 * It is not a source of truth. Every event is something the ledger already
 * wrote, so the animation always plays *after* the result — nothing on the
 * floor can run ahead of, or disagree with, what was saved. It reads no
 * service. Each station is a link to its bench, which makes the strip a small
 * hub for the three rooms as well.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COST
 * ─────────────────────────────────────────────────────────────────────────────
 * At rest the floor is static: there is no idle loop at all. Motion exists only
 * while an event is playing (about two seconds) or while a bench reports a
 * timed craft running. An IntersectionObserver pauses the working loop and
 * skips the flight entirely when the strip is off screen — the bag still
 * updates, so scrolling back shows the right thing. Events that arrive while
 * one is playing are collapsed to the latest, so the rune forge's auto-strike
 * (one strike every 260ms) plays at most one sequence at a time rather than
 * stacking a hundred.
 *
 * Everything animates transform, opacity or filter. Keyframes live at the top
 * level of the stylesheet, never inside a media query — see the stylesheet
 * header. Reduced motion gets no flight: the station that did the work lights
 * up for a moment and the output appears in the bag.
 */
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';

import { artFor, type ArtEntry } from '../art/art';
import { TranslationService } from '../../translation.service';
import {
  FLOOR_MAX_INPUTS,
  floorGold,
  floorThing,
  type ForgeFloorEvent,
  type ForgeFloorThing,
  type ForgeStation,
} from './forge-floor.model';

interface StationView {
  id: ForgeStation;
  route: string;
  labelKey: string;
  art: ArtEntry | null;
  /** The effect layered over the station while it works. */
  fx: ArtEntry | null;
}

/** One icon in flight. Coordinates are px, relative to the stage. */
interface Sprite {
  key: number;
  /** feed: stockpile → station. out: station → bag. in: a delivery → stockpile. */
  kind: 'feed' | 'out' | 'in';
  thing: ForgeFloorThing;
  x0: number; y0: number;
  x1: number; y1: number;
  delay: number;
}

interface Burst { key: number; x: number; y: number; glow: string | null; }

type Phase = 'idle' | 'feed' | 'work' | 'pop';

/** Phase lengths, ms. Kept in step with the keyframe durations in the stylesheet. */
const FEED_MS = 900;
const FEED_STAGGER_MS = 110;
const WORK_MS = 650;
const POP_MS = 1150;
/** Reduced motion: how long the station stays lit. */
const FLASH_MS = 1200;

const STATIONS: readonly StationView[] = [
  { id: 'anvil', route: '/forge/crafting',   labelKey: 'forgeFloor.station.anvil', art: artFor('iron-hammer'),        fx: artFor('forge-heat-shimmer') },
  { id: 'table', route: '/forge/enchanting', labelKey: 'forgeFloor.station.table', art: artFor('enchantment-active'), fx: artFor('enhancement-aura') },
  { id: 'runes', route: '/forge/runes',      labelKey: 'forgeFloor.station.runes', art: artFor('godforge-heart'),     fx: artFor('violet-forge-flame') },
];

/** What the stockpile shows before anything has been made this visit. */
const DEFAULT_STOCK: readonly ForgeFloorThing[] = [
  floorThing('ember-residue'),
  floorThing('moonpetal-herb'),
  floorThing('void-shard'),
  floorGold(),
];

@Component({
  selector: 'app-forge-floor',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './forge-floor.component.html',
  styleUrls: ['./forge-floor.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgeFloorComponent implements OnChanges, AfterViewInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly i18n = inject(TranslationService);

  /** The bench this floor sits on top of. Null when it sits elsewhere (the Material Vendor). */
  @Input() active: ForgeStation | null = 'anvil';
  /** True while the bench is running a timed craft. */
  @Input() working = false;
  /** The latest settled event. A new `seq` plays it. */
  @Input() event: ForgeFloorEvent | null = null;
  /** Optional: what the stockpile should show at rest. */
  @Input() stock: readonly ForgeFloorThing[] | null = null;

  @ViewChild('stage', { static: true }) stageRef!: ElementRef<HTMLElement>;

  readonly stations = STATIONS;
  readonly burstArt = artFor('crafting-burst');
  readonly floorArt = artFor('ember-particle-field');

  readonly phase = signal<Phase>('idle');
  /** The station currently doing the work (may differ from `active`). */
  readonly busy = signal<ForgeStation | null>(null);
  readonly sprites = signal<Sprite[]>([]);
  readonly bursts = signal<Burst[]>([]);
  readonly lastInputs = signal<readonly ForgeFloorThing[]>([]);
  readonly lastOutput = signal<ForgeFloorThing | null>(null);
  /** Bumped when something lands in the bag, to replay its receive pulse. */
  readonly bagPulse = signal(0);
  /** Bumped when a delivery lands on the stockpile. */
  readonly stockPulse = signal(0);
  readonly inView = signal(true);

  private lastSeq = -1;
  private pending: ForgeFloorEvent | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private observer: IntersectionObserver | null = null;
  private keyCounter = 0;
  private readonly reduced = this.isBrowser
    && typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  t(key: string): string { return this.i18n.translate(key); }

  get stockView(): readonly ForgeFloorThing[] {
    const last = this.lastInputs();
    if (last.length) return last.slice(0, 4);
    return (this.stock?.length ? this.stock : DEFAULT_STOCK).slice(0, 4);
  }

  isWorking(id: ForgeStation): boolean {
    if (this.busy() === id && this.phase() !== 'idle') return true;
    return this.working && this.active === id;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['event'] || !this.isBrowser) return;
    const event = this.event;
    if (!event || event.seq === this.lastSeq) return;
    this.lastSeq = event.seq;
    if (this.phase() !== 'idle') {
      // Collapse a burst of events to the newest. Its inputs are merged in so a
      // feed-then-output pair (a timed craft) is not lost if they overlap.
      const prior = this.pending;
      const merged = prior && !event.inputs.length ? { ...event, inputs: prior.inputs } : event;
      // Deliveries are goods the ledger already holds: collapsing two purchases
      // keeps both crates in the one flight rather than dropping the first.
      const delivered = [...(prior?.delivered ?? []), ...(event.delivered ?? [])];
      this.pending = delivered.length ? { ...merged, delivered: delivered.slice(-FLOOR_MAX_INPUTS) } : merged;
      return;
    }
    this.play(event);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser || typeof IntersectionObserver === 'undefined') return;
    this.observer = new IntersectionObserver(entries => {
      for (const entry of entries) this.inView.set(entry.isIntersecting);
    }, { threshold: 0 });
    this.observer.observe(this.stageRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.clearTimers();
    this.observer?.disconnect();
    this.observer = null;
  }

  // ── Sequencing ─────────────────────────────────────────────────────────────

  private play(event: ForgeFloorEvent): void {
    const delivered = (event.delivered ?? []).slice(0, FLOOR_MAX_INPUTS);
    if (!delivered.length) { this.work(event); return; }
    const deliveryOnly = !event.inputs.length && !event.output;
    this.deliver(delivered, event.deliveredFrom, () => deliveryOnly ? this.finish() : this.work(event));
  }

  /**
   * Goods arriving from outside: they arc in from `from` (clamped into the
   * stage; default the top edge above the stockpile) and land on the pile,
   * which then shows them and pulses. No station lights up.
   */
  private deliver(things: readonly ForgeFloorThing[], from: { x: number; y: number } | undefined, then: () => void): void {
    const stage = this.stageRef.nativeElement;
    const to = this.reduced || !this.inView() ? null : this.centerOf(stage, '[data-node="stock"]');
    if (!to) {
      this.stockIn(things);
      then();
      return;
    }
    const box = stage.getBoundingClientRect();
    const origin = from
      ? { x: Math.min(Math.max(from.x - box.left, 16), box.width - 16), y: Math.min(Math.max(from.y - box.top, 12), box.height - 12) }
      : { x: Math.min(to.x + 120, box.width - 16), y: 12 };
    this.phase.set('feed');
    this.sprites.set(things.map((thing, i) => ({
      key: ++this.keyCounter,
      kind: 'in' as const,
      thing,
      x0: origin.x, y0: origin.y, x1: to.x, y1: to.y,
      delay: i * FEED_STAGGER_MS,
    })));
    this.after(FEED_MS + (things.length - 1) * FEED_STAGGER_MS, () => {
      this.sprites.set([]);
      this.stockIn(things);
      then();
    });
  }

  private stockIn(things: readonly ForgeFloorThing[]): void {
    this.lastInputs.set(things);
    this.stockPulse.update(n => n + 1);
  }

  private work(event: ForgeFloorEvent): void {
    const inputs = event.inputs.slice(0, FLOOR_MAX_INPUTS);
    if (inputs.length) this.lastInputs.set(inputs);
    this.busy.set(event.station);

    // Off screen, or the player asked for stillness: no flight. Light the
    // station briefly and put the output straight in the bag.
    if (this.reduced || !this.inView()) {
      this.phase.set('work');
      if (event.output) this.land(event.output);
      this.after(this.reduced ? FLASH_MS : 0, () => this.finish());
      return;
    }

    const stage = this.stageRef.nativeElement;
    const from = this.centerOf(stage, '[data-node="stock"]');
    const at = this.centerOf(stage, `[data-node="${event.station}"]`);
    const bag = this.centerOf(stage, '[data-node="bag"]');
    if (!from || !at || !bag) {
      if (event.output) this.land(event.output);
      this.finish();
      return;
    }

    let feedTime = 0;
    if (inputs.length) {
      this.phase.set('feed');
      this.sprites.set(inputs.map((thing, i) => ({
        key: ++this.keyCounter,
        kind: 'feed' as const,
        thing,
        x0: from.x, y0: from.y, x1: at.x, y1: at.y,
        delay: i * FEED_STAGGER_MS,
      })));
      feedTime = FEED_MS + (inputs.length - 1) * FEED_STAGGER_MS;
    }

    const output = event.output;
    this.after(feedTime, () => {
      this.sprites.set([]);
      this.phase.set('work');
      if (!output) {
        // Feed-only (a timed craft starting): the station keeps working on the
        // bench's own `working` flag until the output event arrives.
        this.finish();
        return;
      }
      this.after(WORK_MS, () => {
        this.phase.set('pop');
        this.bursts.set([{ key: ++this.keyCounter, x: at.x, y: at.y, glow: event.glow ?? null }]);
        this.sprites.set([{
          key: ++this.keyCounter,
          kind: 'out',
          thing: output,
          x0: at.x, y0: at.y, x1: bag.x, y1: bag.y,
          delay: 0,
        }]);
        this.after(POP_MS, () => {
          this.land(output);
          this.finish();
        });
      });
    });
  }

  private land(output: ForgeFloorThing): void {
    this.lastOutput.set(output);
    this.bagPulse.update(n => n + 1);
  }

  private finish(): void {
    this.sprites.set([]);
    this.bursts.set([]);
    this.phase.set('idle');
    this.busy.set(null);
    const next = this.pending;
    this.pending = null;
    if (next) this.play(next);
  }

  private after(ms: number, fn: () => void): void {
    const id = setTimeout(() => {
      this.timers = this.timers.filter(t => t !== id);
      fn();
    }, ms);
    this.timers.push(id);
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  private centerOf(stage: HTMLElement, selector: string): { x: number; y: number } | null {
    const el = stage.querySelector<HTMLElement>(selector);
    if (!el) return null;
    const box = stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
  }

  trackSprite = (_: number, s: Sprite) => s.key;
}
