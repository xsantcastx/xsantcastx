/**
 * works-map.component.ts — the Sanctum's Works: every automation, drawn.
 *
 * Explorers walk their road to the realm they were sent to and back, Thralls
 * tick round the anvil towards their next pull, the Forge pulses on every
 * idle-Gold settlement and the haul visibly flows into the Treasury.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTHING HERE IS A CLOCK
 * ─────────────────────────────────────────────────────────────────────────────
 * The map owns no game state and advances none. Positions are pure functions
 * of the services' own timestamps (`startedAt` + `duration`, `lastRollAt` +
 * `rollInterval`, the newest activity operation + its recovery) evaluated at
 * `Date.now()` when they are drawn — see `works-map.model.ts`. The frame loop
 * only *writes positions to the DOM*; if the browser stops delivering frames
 * (background tab, sleeping laptop) nothing is lost, because the next frame
 * recomputes everything from the wall clock.
 *
 * The pulses and flows are reactions to real events — `EconomyService.gain$`
 * (an idle settlement), `ThrallService.find$` (a landed pull),
 * `ExplorerService.returned$` (a settled expedition) and a new activity
 * operation. They are decoration only; the numbers they show are the numbers
 * the services already banked.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BUDGET
 * ─────────────────────────────────────────────────────────────────────────────
 *   • transform/opacity only. Tokens move by `--x`/`--y` custom properties that
 *     feed a cqw-based translate; orbits are `rotate`.
 *   • The frame loop runs only while the map is on screen (IntersectionObserver)
 *     and the document is visible, and never under reduced motion — that gets a
 *     static map with tokens parked at their destination and the progress bars.
 *   • Change detection: once a second, outside the zone, while running.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { ExplorerService } from '../explorer/explorer.service';
import {
  Expedition,
  ExplorerReturn,
  ExplorerState,
  EXPLORER_REALMS,
  formatCountdown,
  missionById,
  remainingMs,
} from '../explorer/explorer.model';
import { ExplorerRosterService } from '../rpg/explorer-roster.service';
import { explorerTier } from '../rpg/explorer-roster.model';
import { archetypeById } from '../rpg/explorer-archetypes';
import { artFor } from '../art/art';
import { siteById } from './expedition-site.model';
import { ThrallService, ThrallSnapshot } from '../thralls/thrall.service';
import { RUNE_TIER_COLOURS, Thrall, ThrallLogEntry, thrallTier } from '../thralls/thrall.model';
import { CurrencyGain, EconomyService, EconomySnapshot } from '../economy/economy.service';
import { formatCompact } from '../economy/economy.model';
import { ActivityProgressionGateway } from '../activity/activity-progression.gateway';
import { ActivityLedger } from '../activity/activity.model';
import { ROOTGLASS_CANOPY_HREF } from '../activity/foraging.model';
import { MERIDIAN_ORRERY_HREF } from '../activity/prospecting.model';
import { BASALT_SEAMWORKS_HREF } from '../narrative/chapter.model';
import { TranslationService } from '../../translation.service';
import {
  ANVIL,
  FORGE,
  HUB,
  JourneyPhase,
  MapPoint,
  WORKSITE,
  anvilSlot,
  bezierAt,
  cycleAt,
  journeyAt,
  monogram,
  progressAt,
  realmAnchor,
  routeControl,
  routePath,
} from './works-map.model';

interface RealmNode {
  id: string;
  name: string;
  color: string;
  at: MapPoint;
  /** Explorers out to this realm right now. */
  busy: number;
}

interface RouteLine {
  key: string;
  d: string;
  color: string;
}

interface MissionToken {
  id: string;
  name: string;
  mono: string;
  art: { src: string; srcset: string } | null;
  tone: string;
  realmColor: string;
  destination: string;
  realmName: string;
  missionName: string;
  /** Frozen at dispatch — the only inputs the position is computed from. */
  startedAt: number;
  duration: number;
  site: MapPoint;
  control: MapPoint;
}

interface ThrallToken {
  id: string;
  name: string;
  mono: string;
  tone: string;
  at: MapPoint;
  status: Thrall['status'];
  lastRollAt: number;
  rollInterval: number;
  stamina: number;
  maxStamina: number;
}

interface Flow {
  id: number;
  from: MapPoint;
  to: MapPoint;
  color: string;
  label: string;
}

interface Pop {
  id: number;
  tone: string;
  lines: string[];
}

interface WorkSite {
  label: string;
  location: string;
  href: string;
  /** Epoch ms the last action resolved. */
  last: number;
  recoveryMs: number;
  beat: string;
}

/** Attribute-selector-safe id. */
const esc = (id: string): string =>
  typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/["\\]/g, '\\$&');

const FLOW_MS = 1_300;
const POP_MS = 3_200;
const MAX_FLOWS = 14;
const MAX_THRALL_TOKENS = 12;

const WORK_COPY: Record<string, { label: string; location: string; href: string }> = {
  mining: { label: 'work.discipline.mining', location: 'work.location.seamworks', href: BASALT_SEAMWORKS_HREF },
  foraging: { label: 'work.discipline.foraging', location: 'work.location.canopy', href: ROOTGLASS_CANOPY_HREF },
  prospecting: { label: 'work.discipline.prospecting', location: 'work.location.orrery', href: MERIDIAN_ORRERY_HREF },
};

const PHASE_COPY: Record<JourneyPhase, string> = {
  out: 'Outbound',
  site: 'At the site',
  back: 'Heading home',
  home: 'Arriving',
};

@Component({
  selector: 'app-works-map',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './works-map.component.html',
  styleUrls: ['./works-map.component.css'],
})
export class WorksMapComponent implements OnInit, OnDestroy {
  private readonly explorers = inject(ExplorerService);
  private readonly roster = inject(ExplorerRosterService);
  private readonly thrallService = inject(ThrallService);
  private readonly economy = inject(EconomyService);
  private readonly activity = inject(ActivityProgressionGateway);
  private readonly i18n = inject(TranslationService);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Named `…At` so the template's `hubAt.x` never reads as an i18n key to
  // check-i18n-keys.js, which treats any quoted dotted path in a known
  // namespace (`hub.`, `forge.`) as a translation lookup.
  readonly hubAt = HUB;
  readonly anvilAt = ANVIL;
  readonly forgeAt = FORGE;
  readonly workAt = WORKSITE;

  readonly realms: RealmNode[] = EXPLORER_REALMS.map((r, i, all) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    at: realmAnchor(i, all.length),
    busy: 0,
  }));
  routes: RouteLine[] = this.realms.map(r => ({ key: r.id, d: routePath(r.at), color: r.color }));

  missions: MissionToken[] = [];
  thralls: ThrallToken[] = [];
  thrallsWorking = 0;
  thrallsResting = 0;
  flows: Flow[] = [];
  pops: Pop[] = [];
  work: WorkSite | null = null;

  gold = 0;
  perSecond = 0;
  autoPerSecond = 0;
  /** Bumped on every idle settlement; the pulse ring is keyed on it. */
  forgeBeat = 0;
  hubBeat = 0;

  now = Date.now();
  reducedMotion = false;

  private onscreen = true;
  private pageVisible = true;
  private frame = 0;
  private clock: ReturnType<typeof setInterval> | null = null;
  private io: IntersectionObserver | null = null;
  private motionQuery: MediaQueryList | null = null;
  private readonly subs = new Subscription();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private seq = 0;
  private lastWorkOps = -1;
  private explorerState: ExplorerState = this.explorers.snapshot;

  private readonly onVisibility = () => {
    this.pageVisible = document.visibilityState !== 'hidden';
    this.sync();
  };
  private readonly onMotion = () => {
    this.reducedMotion = !!this.motionQuery?.matches;
    this.sync();
    this.zone.run(() => this.cdr.markForCheck());
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ───────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    if (!this.isBrowser) return;

    // All idempotent. On /sanctum the page and the Thrall panel have already
    // called these; calling them here keeps the map honest wherever it mounts.
    this.explorers.init();
    this.thrallService.init();
    this.activity.init();

    this.motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
    this.reducedMotion = !!this.motionQuery?.matches;
    this.motionQuery?.addEventListener?.('change', this.onMotion);
    this.pageVisible = document.visibilityState !== 'hidden';

    this.subs.add(this.explorers.state$.subscribe(s => {
      this.explorerState = s;
      this.rebuildMissions();
      this.cdr.markForCheck();
    }));
    // The roster renames and re-tiers people; the tokens read from it.
    this.subs.add(this.roster.snapshot$.subscribe(() => {
      this.rebuildMissions();
      this.cdr.markForCheck();
    }));
    this.subs.add(this.thrallService.snapshot$.subscribe(s => {
      this.rebuildThralls(s);
      this.cdr.markForCheck();
    }));
    this.subs.add(this.economy.snapshot$.subscribe(s => this.readEconomy(s)));
    this.subs.add(this.economy.gain$.subscribe(g => this.onGain(g)));
    this.subs.add(this.thrallService.find$.subscribe(f => this.onThrallFind(f)));
    this.subs.add(this.explorers.returned$.subscribe(r => this.onReturn(r)));
    this.subs.add(this.activity.snapshot$.subscribe(l => {
      this.readWork(l);
      this.cdr.markForCheck();
    }));

    this.zone.runOutsideAngular(() => {
      document.addEventListener('visibilitychange', this.onVisibility, { passive: true });
      if (typeof IntersectionObserver !== 'undefined') {
        this.io = new IntersectionObserver(entries => {
          this.onscreen = entries.some(e => e.isIntersecting);
          this.sync();
        }, { rootMargin: '80px' });
        this.io.observe(this.host.nativeElement);
      }
    });
    this.sync();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.stopClock();
    this.stopFrames();
    this.io?.disconnect();
    this.motionQuery?.removeEventListener?.('change', this.onMotion);
    if (this.isBrowser) document.removeEventListener('visibilitychange', this.onVisibility);
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();
  }

  private get running(): boolean {
    return this.pageVisible && this.onscreen;
  }

  /** Start or stop the two loops to match visibility, screen and motion. */
  private sync(): void {
    if (this.running) {
      this.startClock();
      if (this.reducedMotion) this.stopFrames(); else this.startFrames();
      // Coming back from a hidden tab: snap to the wall clock at once rather
      // than drawing one stale second first.
      this.now = Date.now();
      this.paint(this.now);
    } else {
      this.stopClock();
      this.stopFrames();
    }
  }

  private startClock(): void {
    if (this.clock !== null) return;
    this.zone.runOutsideAngular(() => {
      this.clock = setInterval(() => {
        this.now = Date.now();
        this.cdr.detectChanges();
      }, 1_000);
    });
  }

  private stopClock(): void {
    if (this.clock === null) return;
    clearInterval(this.clock);
    this.clock = null;
  }

  private startFrames(): void {
    if (this.frame) return;
    this.zone.runOutsideAngular(() => {
      const loop = () => {
        this.paint(Date.now());
        this.frame = requestAnimationFrame(loop);
      };
      this.frame = requestAnimationFrame(loop);
    });
  }

  private stopFrames(): void {
    if (!this.frame) return;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Drawing — DOM writes only, every value recomputed from timestamps
  // ───────────────────────────────────────────────────────────────────────────

  /** Position every moving part for `now`. Writes style, changes no state. */
  private paint(now: number): void {
    const root = this.host.nativeElement;
    for (const m of this.missions) {
      const el = root.querySelector<HTMLElement>(`[data-wm-mission="${esc(m.id)}"]`);
      const p = this.tokenPoint(m, now);
      if (el) {
        el.style.setProperty('--x', p.x.toFixed(1));
        el.style.setProperty('--y', p.y.toFixed(1));
      }
      const bar = root.querySelector<HTMLElement>(`[data-wm-bar="${esc(m.id)}"]`);
      if (bar) bar.style.transform = `scaleX(${progressAt(m.startedAt, m.duration, now).toFixed(4)})`;
    }
    for (const t of this.thralls) {
      const arm = root.querySelector<HTMLElement>(`[data-wm-thrall="${esc(t.id)}"]`);
      if (arm) arm.style.transform = `rotate(${(this.thrallCycle(t, now) * 360).toFixed(1)}deg)`;
    }
    if (this.work) {
      const arm = root.querySelector<HTMLElement>('[data-wm-work]');
      if (arm) arm.style.transform = `rotate(${(this.workCycle(now) * 360).toFixed(1)}deg)`;
    }
  }

  /** Where a token stands at `now`. Reduced motion parks it at the site. */
  tokenPoint(m: MissionToken, now: number): MapPoint {
    const progress = progressAt(m.startedAt, m.duration, now);
    if (this.reducedMotion) return progress >= 1 ? HUB : m.site;
    const j = journeyAt(progress);
    return bezierAt(HUB, m.control, m.site, j.along);
  }

  phaseOf(m: MissionToken): JourneyPhase {
    return journeyAt(progressAt(m.startedAt, m.duration, this.now)).phase;
  }

  phaseLabel(m: MissionToken): string {
    return PHASE_COPY[this.phaseOf(m)];
  }

  percent(m: MissionToken): number {
    return Math.round(progressAt(m.startedAt, m.duration, this.now) * 100);
  }

  countdown(m: MissionToken): string {
    return formatCountdown(remainingMs({ startedAt: m.startedAt, duration: m.duration } as Expedition, this.now));
  }

  thrallCycle(t: ThrallToken, now: number): number {
    return t.status === 'working' ? cycleAt(t.lastRollAt, t.rollInterval, now) : 0;
  }

  workCycle(now: number): number {
    return this.work ? cycleAt(this.work.last, this.work.recoveryMs, now) : 0;
  }

  get workReady(): boolean {
    return !!this.work && this.workCycle(this.now) >= 1;
  }

  get workCountdown(): string {
    if (!this.work) return '';
    return formatCountdown(Math.max(0, this.work.last + this.work.recoveryMs - this.now));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Reading the services
  // ───────────────────────────────────────────────────────────────────────────

  private rebuildMissions(): void {
    const lanes = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const e of this.explorerState.active) counts.set(e.realm, (counts.get(e.realm) ?? 0) + 1);

    this.missions = this.explorerState.active.map(e => {
      const realm = this.realms.find(r => r.id === e.realm);
      const site = realm?.at ?? { x: 860, y: HUB.y };
      const n = counts.get(e.realm) ?? 1;
      const i = lanes.get(e.realm) ?? 0;
      lanes.set(e.realm, i + 1);
      const lane = i - (n - 1) / 2;

      const who = this.roster.byId(e.explorerId);
      const archetype = archetypeById(who?.archetypeId);
      const painted = artFor(archetype?.artId);
      const tier = explorerTier(who?.rarity ?? 'common');
      const place = siteById(e.siteId);
      return {
        id: e.id,
        name: who?.name ?? 'Explorer',
        mono: monogram(who?.name),
        art: painted ? { src: painted.src, srcset: painted.srcset } : null,
        tone: tier.color,
        realmColor: realm?.color ?? tier.color,
        destination: place?.name ?? realm?.name ?? 'the realms',
        realmName: realm?.name ?? '',
        missionName: missionById(e.mission)?.name ?? 'Expedition',
        startedAt: e.startedAt,
        duration: e.duration,
        site,
        control: routeControl(site, lane),
      };
    });

    for (const r of this.realms) r.busy = counts.get(r.id) ?? 0;
    // A lane only exists while someone walks it; draw the fanned roads too.
    this.routes = [
      ...this.realms.map(r => ({ key: r.id, d: routePath(r.at), color: r.color })),
      ...this.missions
        .filter(m => m.control.y !== routeControl(m.site).y)
        .map(m => ({
          key: `lane-${m.id}`,
          d: `M ${HUB.x} ${HUB.y} Q ${m.control.x} ${m.control.y} ${m.site.x} ${m.site.y}`,
          color: m.realmColor,
        })),
    ];
  }

  private rebuildThralls(s: ThrallSnapshot): void {
    const shown = s.thralls.slice(0, MAX_THRALL_TOKENS);
    this.thralls = shown.map((t, i) => {
      const tier = thrallTier(t.rarity);
      return {
        id: t.id,
        name: t.name,
        mono: monogram(t.name),
        tone: tier.color,
        at: anvilSlot(i, shown.length),
        status: t.status,
        lastRollAt: t.lastRollAt,
        rollInterval: t.rollInterval,
        stamina: t.stamina,
        maxStamina: t.maxStamina,
      };
    });
    this.thrallsWorking = s.thralls.filter(t => t.status === 'working').length;
    this.thrallsResting = s.thralls.filter(t => t.status === 'resting').length;
  }

  private readEconomy(s: EconomySnapshot): void {
    this.gold = s.gold;
    this.perSecond = s.perSecond;
    this.autoPerSecond = s.autoPerSecond;
    this.cdr.markForCheck();
  }

  private readWork(l: ActivityLedger): void {
    const current = l.currentWork;
    const copy = current ? WORK_COPY[current.disciplineId] : undefined;
    if (!current || !copy) {
      this.work = null;
      this.lastWorkOps = -1;
      return;
    }
    const end = this.activity.recoveryEndsAt();
    const recoveryMs = this.activity.currentRecoveryMs();
    const opCount = l.operations.length;
    // A new operation is the worker's beat. The first read is a baseline, not a
    // beat — the map mounting is not the Keeper swinging a pick.
    const beat = this.lastWorkOps >= 0 && opCount > this.lastWorkOps;
    this.lastWorkOps = opCount;
    this.work = {
      label: this.i18n.translate(copy.label),
      location: this.i18n.translate(copy.location),
      href: copy.href,
      last: end != null ? end - recoveryMs : 0,
      recoveryMs,
      beat: beat ? `op-${opCount}` : (this.work?.beat ?? 'op-0'),
    };
    if (beat) this.flow(WORKSITE, HUB, 'var(--status-good)', '');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Events — pulses, flows and the loot pop
  // ───────────────────────────────────────────────────────────────────────────

  private onGain(g: CurrencyGain): void {
    if (g.currency !== 'gold' || g.source !== 'idle' || !(g.amount > 0)) return;
    this.forgeBeat++;
    this.hubBeat++;
    this.flow(FORGE, HUB, 'var(--gold)', `+${formatCompact(g.amount)}`);
  }

  private onThrallFind(f: ThrallLogEntry): void {
    const t = this.thralls.find(x => x.id === f.thrallId);
    this.flow(t?.at ?? ANVIL, HUB, RUNE_TIER_COLOURS[f.tier] ?? 'var(--violet-bright)', '');
  }

  private onReturn(r: ExplorerReturn): void {
    const lines: string[] = [];
    const who = r.explorerName || 'An explorer';
    lines.push(`${who} is home`);
    if (r.reward.gold > 0) lines.push(`+${formatCompact(r.reward.gold)} Gold`);
    const runes = r.reward.runes?.length ?? (r.reward.rune ? 1 : 0);
    if (runes) lines.push(`${runes} ${runes === 1 ? 'rune' : 'runes'}`);
    const items = r.reward.items?.length ?? 0;
    if (items) lines.push(`${items} ${items === 1 ? 'item' : 'items'}`);
    const mats = Object.values(r.reward.materials ?? {}).reduce((a, b) => a + b, 0);
    if (mats) lines.push(`${mats} ${mats === 1 ? 'material' : 'materials'}`);
    if (r.reward.scroll) lines.push('a lore fragment');
    if (r.found) lines.push(`found ${r.found.name}`);

    const realm = this.realms.find(x => x.id === r.explorer.realm);
    const tone = realm?.color ?? 'var(--gold)';
    this.hubBeat++;
    // The flow skips itself when nobody can see it; the pop is always shown,
    // because it is how the map reports a landing (it is static text under
    // reduced motion).
    this.flow(realm?.at ?? HUB, HUB, tone, '');
    this.addPop({ id: ++this.seq, tone, lines });
  }

  private flow(from: MapPoint, to: MapPoint, color: string, label: string): void {
    if (!this.isBrowser || !this.running || this.reducedMotion) return;
    if (this.flows.length >= MAX_FLOWS) this.flows = this.flows.slice(1);
    const f: Flow = { id: ++this.seq, from, to, color, label };
    this.flows = [...this.flows, f];
    this.cdr.markForCheck();
    this.later(FLOW_MS, () => {
      this.flows = this.flows.filter(x => x.id !== f.id);
      this.cdr.markForCheck();
    });
  }

  private addPop(p: Pop): void {
    this.pops = [...this.pops.slice(-2), p];
    this.cdr.markForCheck();
    this.later(POP_MS, () => {
      this.pops = this.pops.filter(x => x.id !== p.id);
      this.cdr.markForCheck();
    });
  }

  private later(ms: number, fn: () => void): void {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Template helpers
  // ───────────────────────────────────────────────────────────────────────────

  get goldLabel(): string { return formatCompact(Math.floor(this.gold)); }
  get rateLabel(): string { return formatCompact(this.perSecond); }

  mid(f: Flow): MapPoint {
    return { x: (f.from.x + f.to.x) / 2, y: Math.min(f.from.y, f.to.y) - 34 };
  }
}
