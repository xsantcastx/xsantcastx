/**
 * <app-slate> — the Mirror Slate, open in the play view's place panel
 * (docs/handoff/mirror-slate.md). Lazy: the play view imports it on the first
 * open, so none of it is in the initial bundle.
 *
 *  - Home: an in-game phone (docs/handoff/world-clock.md). A status bar, the
 *    world clock big (time, day, month, the sky's icon), two widgets (the next
 *    eclipse counting down; now playing: the realm's theme, skip and mute), the
 *    app grid (her four tables, the Homestead, the map, the Scan, the Pets, the
 *    Codex, the eclipse), page dots (page 2: the calendar and Sera's ledger) and
 *    a dock. One tap opens an app; Back returns home. Pets and the Codex are
 *    places of their own: the Slate asks the play view to open them.
 *  - Tables: Lune Coyne's four games, EMBEDDED, not copied: the same panel
 *    components her stalls host (PANEL_REGISTRY's own loaders), so the odds,
 *    the bet ladder and caps and the replay-safe play ledger are the same code.
 *    A play here and a play at the stall are the same kind of play.
 *  - Homestead: the factory at a glance through HomesteadService (no economy
 *    numbers of its own): purse, Gold/s, the receipt waiting and a Collect, ONE
 *    "Build the next building" button (the economy's receipted purchase), the
 *    crew's one-line standing, and where to walk for what stays in the world.
 *  - Map & bounties (tier II): the Delve map pins and Pim's three bounties,
 *    read only, each pointing at where it is acted on.
 */
import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, ComponentRef, ElementRef, OnDestroy, OnInit, PLATFORM_ID, Type,
  NgZone, ViewChild, ViewContainerRef, inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription, merge } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { ExplorerService } from '../explorer/explorer.service';
import { BountyService, type BountyView } from '../bounties/bounty.service';
import { BOUNTIES_I18N } from '../bounties/bounties.i18n';
import { bountyLine } from '../bounties/bounty.model';
import { DelveSaveService } from '../delve/delve-save.service';
import type { MapPin } from '../delve/map-pins.model';
import { artFor } from '../art/art';
import { ActionButtonComponent } from '../station-ui/action-button.component';
import type { StationCost } from '../station-ui/station-ui.model';
import { STATION_UI_I18N } from '../station-ui/station-ui.i18n';
import { PANEL_REGISTRY } from '../../play/world/panel-registry';
import { HomesteadService, purchaseMessage } from '../../play/homestead/homestead.service';
import { formatPerSecond, pendingLine, type ColumnRow } from '../../play/homestead/homestead.model';
import { SLATE_I18N } from './slate.i18n';
import { CabinetsService } from '../cabinets/cabinets.service';
import { CABINETS_I18N } from '../cabinets/cabinets.i18n';
import { CABINETS, SET_BONUSES, hasBonus, openClues, type SetBonusId, type Warmth } from '../cabinets/cabinets.model';
import { SlateService } from './slate.service';
import { PetSheetComponent } from '../pets/pet-sheet.component';
import { slateIcon } from './slate-app-icons';
import { WorldClockService } from '../world-clock/world-clock.service';
import { EclipseService } from '../world-clock/eclipse.service';
import { WORLD_CLOCK_I18N } from '../world-clock/world-clock.i18n';
import { ECLIPSE_EFFECTS, LEDGER_MARKS, nextMark } from '../world-clock/eclipse.model';
import {
  MONTHS, MONTH_DAYS, WEEK_DAYS, clockText, isEclipseDay, worldSpan, type SkyPhase,
} from '../world-clock/world-clock.model';
import { SoundService } from '../sound/sound.service';
import { sceneMode } from '../sound/sound-palette';
import { PlayLedgerService } from '../games/play-ledger.service';
import {
  SLATE_MACHINES, SLATE_TABLES, SLATE_WORLD_POINTERS, slateMachines, slateTabs,
  type SlateTab, type SlateTableGame, type SlateTier,
} from './slate.model';

/** Which face of the glass is up: the home screen, one of the Slate's screens, or the eclipse (every Slate). */
export type SlateFace = 'home' | SlateTab | 'eclipse' | 'pets' | 'codex' | 'about';

/** One app on the phone's grid: a Slate face, one of Lune's tables, or a place the play view opens. */
export interface SlateApp {
  id: string;
  /** The label key. */
  key: string;
  icon: string;
  face?: SlateFace;
  game?: SlateTableGame;
}

/** A day on the calendar page: its number, today, an eclipse on it, already gone. */
interface CalendarDay { n: number; today: boolean; eclipse: boolean; past: boolean }

interface PinRow { id: string; name: string; at: string }
interface BountyRow { id: string; line: string; progress: string; state: 'open' | 'ready' | 'claimed' }

/** The one building the Homestead tab offers: the best Gold/s per Gold you can afford, else the nearest. */
export function nextBuilding(rows: readonly ColumnRow[]): ColumnRow | null {
  const open = rows.filter(r => r.state === 'shown' && !r.maxed);
  const affordable = open.filter(r => r.affordable);
  if (affordable.length) return affordable.reduce((a, b) => (b.gain / Math.max(1, b.cost) > a.gain / Math.max(1, a.cost) ? b : a));
  if (!open.length) return null;
  return open.reduce((a, b) => (b.shortfall < a.shortfall ? b : a));
}

/** "4m 12s", "1h 5m", "40s". */
export function shortDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${s}s`;
}

@Component({
  selector: 'app-slate',
  standalone: true,
  imports: [ActionButtonComponent, PetSheetComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './slate.component.html',
  styleUrls: ['./slate.component.css'],
})
export class SlateComponent implements OnInit, OnDestroy {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly i18n = inject(TranslationService);
  private readonly slate = inject(SlateService);
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private readonly homestead = inject(HomesteadService);
  private readonly explorers = inject(ExplorerService);
  private readonly bounties = inject(BountyService);
  private readonly delve = inject(DelveSaveService);
  private readonly cabinets = inject(CabinetsService);
  private readonly clock = inject(WorldClockService);
  private readonly eclipses = inject(EclipseService);
  private readonly sound = inject(SoundService);
  private readonly ledger = inject(PlayLedgerService);
  private readonly zone = inject(NgZone);
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private clockSecond = -1;
  private fitTimer: ReturnType<typeof setInterval> | null = null;
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();

  /** Always in the DOM (hidden off the Tables face), so it resolves before any game is asked for. */
  @ViewChild('gameHost', { read: ViewContainerRef, static: true }) private gameHost!: ViewContainerRef;
  @ViewChild('codexHost', { read: ViewContainerRef, static: true }) private codexHost!: ViewContainerRef;
  @ViewChild('phone', { static: true }) private phone!: ElementRef<HTMLElement>;
  private codexRef: ComponentRef<unknown> | null = null;
  private codexSeq = 0;
  codexLoading = false;
  codexError = false;
  private gameRef: ComponentRef<unknown> | null = null;
  private gameSeq = 0;

  readonly tables = SLATE_TABLES;
  /** The machines in the glass: the Eclipse Cascade, and the realm machines this Keeper has found. */
  machines: { game: SlateTableGame; titleKey: string }[] = [];
  readonly pointers = SLATE_WORLD_POINTERS;
  tier: SlateTier = 0;
  tabs: SlateTab[] = [];
  face: SlateFace = 'home';
  game: SlateTableGame = 'reels';
  gameLoading = false;
  gameError = false;

  // Homestead
  gold = '0';
  rate = '';
  waiting = '';
  next: ColumnRow | null = null;
  nextCosts: StationCost[] = [];
  nextAdds = '';
  camp = '';
  workshop = '';
  nextHome = '';
  notice = '';

  // Map & bounties
  pins: PinRow[] = [];
  bountyRows: BountyRow[] = [];

  // Scan (the Lost Cabinets)
  readonly cabinetTotal = CABINETS.length;
  found = 0;
  scanning = false;
  warmth: Warmth = 'none';
  clues: string[] = [];
  bonuses: { id: SetBonusId; at: number; reached: boolean }[] = [];
  loupe = false;

  // The phone face (docs/handoff/world-clock.md)
  readonly icon = slateIcon;
  /** The app grid (built per tier) and the dock. */
  apps: SlateApp[] = [];
  readonly dock: readonly SlateApp[] = [
    { id: 'dock-factory', key: 'slate.tab.factory', icon: 'factory', face: 'factory' },
    { id: 'dock-scan', key: 'slate.app.scan', icon: 'scan', face: 'scan' },
    { id: 'dock-eclipse', key: 'slate.app.eclipse', icon: 'eclipse', face: 'eclipse' },
    { id: 'dock-codex', key: 'slate.app.codex', icon: 'codex', face: 'codex' },
  ];
  /** 0: home (clock, widgets, apps); 1: the calendar and Sera's ledger. */
  page = 0;
  readonly pages = [0, 1];
  time = '00:00';
  dateLine = '';
  yearLine = '';
  sky: SkyPhase = 'day';
  realmKey = 'clock.realm.infernal';
  underground = false;
  eclipseOn = false;
  /** "3h 12m" until the next eclipse, or left of this one. */
  eclipseLeft = '';
  eclipseWhen = '';
  alignedRealm = '';
  readonly effects = ECLIPSE_EFFECTS;
  // Now playing
  musicTitleKey = 'clock.music.infernal';
  musicModeKey = 'clock.music.mode.town';
  muted = false;
  skipped = false;
  // Calendar + ledger
  monthKey = 'clock.month.emberwane';
  weekKeys = WEEK_DAYS.map(d => `clock.day.${d}`);
  calendar: CalendarDay[] = [];
  ledgerCount = 0;
  ledgerNext: { at: number; glass: number } | null = null;
  readonly marks = LEDGER_MARKS;
  marksPaid: ReadonlySet<string> = new Set();
  thisOneSeen = false;
  private swipeX: number | null = null;

  constructor() {
    this.i18n.register(STATION_UI_I18N);
    this.i18n.register(SLATE_I18N);
    this.i18n.register(BOUNTIES_I18N);
    this.i18n.register(CABINETS_I18N);
    this.i18n.register(WORLD_CLOCK_I18N);
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  ngOnInit(): void {
    this.slate.init();
    this.ledger.init();
    this.machines = slateMachines(id => this.ledger.found(id)).map(m => ({ game: m.game, titleKey: m.titleKey }));
    this.tier = this.slate.tier();
    this.tabs = slateTabs(this.tier);
    this.apps = this.buildApps();
    // Opened while the glass is held up: straight onto the Scan face (its reading and Put away).
    if (this.cabinets.scanning && this.tabs.includes('scan')) this.face = 'scan';
    this.subs.add(merge(this.economy.snapshot$, this.inventory.snapshot$, this.homestead.hud$, this.explorers.state$).subscribe(() => this.read()));
    this.subs.add(merge(this.cabinets.opened$, this.cabinets.scanning$, this.cabinets.reading$).subscribe(() => this.readScan()));
    this.cabinets.refresh();
    this.subs.add(this.eclipses.count$.subscribe(() => this.readLedger()));
    this.read();
    this.readClock();
    if (this.browser) setTimeout(() => this.phone.nativeElement.focus({ preventScroll: true }));
    // The clock face ticks with the world (one in-game minute a real second), outside Angular; it redraws only when it moved.
    if (this.browser) this.zone.runOutsideAngular(() => {
      this.clockTimer = setInterval(() => this.tickClock(), 1000);
      this.fitTimer = setInterval(() => this.fit(), 300);
    });
  }

  ngOnDestroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.fitTimer) clearInterval(this.fitTimer);
    this.subs.unsubscribe();
    this.gameSeq++;
    this.gameRef?.destroy();
    this.dropCodex();
  }

  // ── Faces ──

  /** One tap on an app (grid or dock): its face, its table, or the place the play view opens. */
  openApp(app: SlateApp): void {
    if (app.game) { this.openGame(app.game); return; }
    if (app.face && app.face !== 'home') this.open(app.face);
  }

  /** Open one of the Slate's screens from the home face. */
  open(face: SlateTab | 'eclipse' | 'pets' | 'codex' | 'about'): void {
    if (face === 'pets' || face === 'about') { this.face = face; this.notice = ''; this.cdr.markForCheck(); return; }
    if (face === 'codex') { this.face = 'codex'; this.notice = ''; this.showCodex(); return; }
    if (face === 'eclipse') { this.face = 'eclipse'; this.notice = ''; this.readClock(); this.readLedger(); this.cdr.markForCheck(); return; }
    if (!this.tabs.includes(face)) return;
    this.face = face;
    this.notice = '';
    if (face === 'map') this.readMap();
    this.read();
  }

  /** One tap from the home face straight onto a table. */
  openGame(id: string): void {
    const table = this.allTables().find(t => t.game === id);
    if (!table) return;
    this.face = 'tables';
    this.notice = '';
    if (table.game === this.game && this.gameRef) { this.cdr.markForCheck(); return; }
    this.game = table.game;
    this.showGame(table.game);
  }

  /** Back to the home face. The table keeps its state while the Slate stays open. */
  back(): void {
    if (this.face === 'codex') this.dropCodex();
    this.face = 'home';
    this.notice = '';
    this.read();
  }

  get gameTitleKey(): string {
    return this.allTables().find(t => t.game === this.game)?.titleKey ?? 'slate.tab.tables';
  }

  /** Lune's four tables, then the machines in the glass. */
  private allTables(): { game: SlateTableGame; titleKey: string }[] {
    return [...this.tables, ...this.machines];
  }

  // ── The phone face: pages, the clock, the widgets (docs/handoff/world-clock.md) ──

  /** The grid: Lune's four tables, the Homestead, the map (tier II), the Scan, the Pets, the Codex, the eclipse. */
  private buildApps(): SlateApp[] {
    const games: SlateApp[] = this.allTables().map(t => ({ id: t.game, key: t.titleKey, icon: t.game, game: t.game }));
    const faces: SlateApp[] = [
      { id: 'factory', key: 'slate.tab.factory', icon: 'factory', face: 'factory' },
      ...(this.tabs.includes('map') ? [{ id: 'map', key: 'slate.tab.map', icon: 'map', face: 'map' as const }] : []),
      ...(this.tabs.includes('scan') ? [{ id: 'scan', key: 'slate.app.scan', icon: 'scan', face: 'scan' as const }] : []),
      { id: 'pets', key: 'slate.app.pets', icon: 'pets', face: 'pets' },
      { id: 'codex', key: 'slate.app.codex', icon: 'codex', face: 'codex' },
      { id: 'eclipse', key: 'slate.app.eclipse', icon: 'eclipse', face: 'eclipse' },
      { id: 'about', key: 'slate.app.about', icon: 'about', face: 'about' },
    ];
    return [...games, ...faces];
  }

  /** A notification dot: the Homestead's receipt, a bounty to claim, a warm glass, the eclipse on now. */
  dot(app: SlateApp): boolean {
    switch (app.face) {
      case 'factory': return !!this.waiting;
      case 'map': return this.bountyRows.some(b => b.state === 'ready');
      case 'scan': return this.scanning && this.warmth !== 'none' && this.warmth !== 'cold';
      case 'eclipse': return this.eclipseOn && !this.thisOneSeen;
      default: return false;
    }
  }

  setPage(n: number): void { this.page = Math.max(0, Math.min(this.pages.length - 1, n)); if (this.page === 1) this.readLedger(); this.cdr.markForCheck(); }
  swipeStart(event: PointerEvent): void { this.swipeX = event.clientX; }
  swipeCancel(): void { this.swipeX = null; }
  swipeEnd(event: PointerEvent): void {
    if (this.swipeX === null) return;
    const dx = event.clientX - this.swipeX;
    this.swipeX = null;
    if (Math.abs(dx) > 48) this.setPage(this.page + (dx < 0 ? 1 : -1));
  }

  /** Now playing: the next phrase now. */
  skip(): void { this.sound.skip(); this.skipped = true; this.cdr.markForCheck(); }
  toggleMute(): void { this.muted = this.sound.toggleMuted(); this.cdr.markForCheck(); }

  private tickClock(): void {
    const second = Math.floor(this.clock.now() / 1000);
    if (second === this.clockSecond) return;
    this.zone.run(() => this.readClock());
  }

  /** The lock-screen clock, the sky, the eclipse widget and now playing, from the world clock and the sound. */
  private readClock(): void {
    const ms = this.clock.now();
    this.clockSecond = Math.floor(ms / 1000);
    const t = this.clock.time(ms);
    const sky = this.clock.sky(ms);
    this.time = clockText(t.minute);
    const day = this.t(`clock.day.${WEEK_DAYS[t.weekday]}`);
    this.monthKey = `clock.month.${MONTHS[t.month].id}`;
    this.dateLine = this.t('clock.date', { day, n: t.dayOfMonth, month: this.t(this.monthKey) });
    this.yearLine = this.t('clock.year', { n: t.year });
    this.sky = sky.phase;
    const scene = this.sound.nowScene;
    const realm = scene?.realm ?? 'infernal';
    this.realmKey = `clock.realm.${realm}`;
    this.underground = !!scene?.delve;
    // The eclipse widget: counting down to the next, or what is left of this one.
    const w = this.clock.nextEclipse(ms);
    this.eclipseOn = sky.eclipseOn;
    const span = worldSpan(ms, this.eclipseOn ? w.endMs : w.startMs);
    // In in-game days past a day ("3d 14h 59m"): the eclipse comes every fifth day.
    this.eclipseLeft = span.h >= 24 ? this.t('clock.eclipse.days', { d: Math.floor(span.h / 24), h: span.h % 24, m: span.m }) : this.t('clock.eclipse.nextShort', span);
    const startDay = Math.floor(w.id);
    this.eclipseWhen = this.t('clock.eclipse.when', {
      day: this.t(`clock.day.${WEEK_DAYS[((startDay % 7) + 7) % 7]}`),
      time: clockText(10 * 60), realm: this.t(`clock.realm.${w.realm}`),
    });
    this.alignedRealm = this.t(`clock.realm.${w.realm}`);
    this.thisOneSeen = this.eclipseOn && this.eclipses.seen(w.id);
    // Now playing: the realm's theme, and how the score is hearing the world right now.
    this.musicTitleKey = `clock.music.${realm}`;
    const mode = scene ? sceneMode(scene) : 'town';
    this.musicModeKey = `clock.music.mode.${mode !== 'town' ? mode : scene?.eclipse ? 'eclipse' : sky.night ? 'night' : 'town'}`;
    this.muted = this.sound.settings.muted;
    // The calendar page: this month, two weeks of it, today and the eclipse days marked.
    const first = t.day - (t.dayOfMonth - 1);
    this.calendar = Array.from({ length: MONTH_DAYS }, (_, i) => ({ n: i + 1, today: i + 1 === t.dayOfMonth, eclipse: isEclipseDay(first + i), past: i + 1 < t.dayOfMonth }));
    this.cdr.markForCheck();
  }

  /** Sera Quill's ledger: observations, the next mark, the marks paid. */
  private readLedger(): void {
    this.ledgerCount = this.eclipses.count();
    const next = nextMark(this.ledgerCount);
    this.ledgerNext = next ? { at: next.at, glass: next.glass } : null;
    this.marksPaid = new Set(this.eclipses.state.marks);
    this.cdr.markForCheck();
  }

  /**
   * Scale to fit: a hosted app (one of Lune's tables, the Codex) lays itself out by the viewport's width, which on a desktop
   * is wider than the phone's screen. Measure its natural width and, if it is wider than the screen, zoom it down so it fits.
   * The phone never grows to suit it.
   */
  private fit(): void {
    if (this.face !== 'tables' && this.face !== 'codex') return;
    const root = this.phone.nativeElement;
    const pane = root.querySelector<HTMLElement>(this.face === 'tables' ? '.sl-tables' : '.sl-codex');
    const scroll = pane?.parentElement;
    if (!pane || !scroll) return;
    pane.style.zoom = '';
    const avail = scroll.clientWidth - 2;
    const natural = pane.scrollWidth;
    const k = natural > avail + 1 ? Math.max(0.55, avail / natural) : 1;
    pane.style.zoom = k < 1 ? String(Math.round(k * 1000) / 1000) : '';
  }

  // ── The home bar, and pulling the phone down ──

  /** The phone's one physical button: out of an app to the home screen, and from home it is put away. */
  homeButton(): void {
    if (this.dragged) { this.dragged = false; return; }
    if (this.face === 'home') this.slate.close(); else this.back();
  }
  private dragY: number | null = null;
  private dragged = false;
  dragStart(event: PointerEvent): void { this.dragY = event.clientY; this.dragged = false; }
  dragMove(event: PointerEvent): void { if (this.dragY !== null && event.clientY - this.dragY > 60) this.dragged = true; }
  /** A pull down on the bezel (the status bar or the home bar) puts the phone away. */
  dragEnd(event: PointerEvent): void {
    if (this.dragY === null) return;
    const dy = event.clientY - this.dragY;
    this.dragY = null;
    if (dy > 60) { this.dragged = true; this.slate.close(); }
  }
  dragCancel(): void { this.dragY = null; }
  petFelt(event: { id: string; kind: 'happy' | 'love' | 'trick' | 'hatch' }): void { this.slate.petFelt(event); }

  // ── The Codex, built into the screen ──

  private showCodex(): void {
    if (!this.browser) return;
    if (this.codexRef) { this.cdr.markForCheck(); return; }
    const seq = ++this.codexSeq;
    this.codexLoading = true;
    this.codexError = false;
    this.cdr.markForCheck();
    PANEL_REGISTRY.codex.load().then((type: Type<unknown>) => {
      if (seq !== this.codexSeq) return;
      this.codexRef = this.codexHost.createComponent(type);
      this.codexLoading = false;
      this.cdr.markForCheck();
    }).catch(() => {
      if (seq !== this.codexSeq) return;
      this.codexLoading = false;
      this.codexError = true;
      this.cdr.markForCheck();
    });
  }
  private dropCodex(): void {
    this.codexSeq++;
    this.codexRef?.destroy();
    this.codexRef = null;
    this.codexHost?.clear();
    this.codexLoading = false;
  }

  // ── Tables: the stalls' own components ──

  private showGame(id: SlateTableGame): void {
    if (!this.browser) return;
    const table = this.tables.find(t => t.game === id);
    const machine = SLATE_MACHINES.find(m => m.game === id);
    if (!table && !machine) return;
    const seq = ++this.gameSeq;
    this.gameRef?.destroy();
    this.gameRef = null;
    this.gameHost.clear();
    this.gameLoading = true;
    this.gameError = false;
    this.cdr.markForCheck();
    // A machine in the glass is the cascade engine's own component, told which machine it is.
    const load: () => Promise<Type<unknown>> = table
      ? PANEL_REGISTRY[table.panel].load
      : () => import('../cascade/cascade.component').then(m => m.CascadeComponent);
    load().then((type: Type<unknown>) => {
      if (seq !== this.gameSeq) return;
      this.gameRef = this.gameHost.createComponent(type);
      if (machine) this.gameRef.setInput('machine', machine.game);
      this.gameLoading = false;
      this.cdr.markForCheck();
    }).catch(() => {
      if (seq !== this.gameSeq) return;
      this.gameLoading = false;
      this.gameError = true;
      this.cdr.markForCheck();
    });
  }

  // ── Homestead ──

  collect(): void {
    const got = this.homestead.collectAll();
    const line = pendingLine(got);
    this.notice = line ? this.t('slate.factory.collected', { line }) : this.t('slate.factory.nothing');
    this.read();
  }

  build(): void {
    const row = this.next;
    if (!row || !row.affordable) return;
    const code = this.homestead.buy(row.id);
    const ok = code === 'ok' || code === 'queued';
    this.notice = ok ? this.t('homestead.built', { name: row.name }) : purchaseMessage(code);
    this.read();
  }

  private read(): void {
    const hud = this.homestead.snapshotHud();
    this.gold = Math.floor(hud.gold).toLocaleString('en-US');
    this.rate = formatPerSecond(hud.perSecond);
    this.waiting = pendingLine(this.homestead.pendingAll());
    this.next = nextBuilding(hud.rows);
    this.nextCosts = this.next ? [{ kind: 'gold', label: this.t('stationUi.gold'), need: Math.ceil(this.next.cost), have: Math.floor(hud.gold), art: artFor('gold') }] : [];
    this.nextAdds = this.next ? this.t('slate.factory.adds', { rate: formatPerSecond(this.next.gain) }) : '';
    this.camp = this.homestead.sentence('camp');
    this.workshop = this.homestead.sentence('workshop');
    const out = this.explorers.snapshot.active;
    const soonest = out.length ? Math.min(...out.map(e => e.startedAt + e.duration)) : 0;
    this.nextHome = soonest ? this.t('slate.factory.nextHome', { t: shortDuration(soonest - Date.now()) }) : '';
    this.cdr.markForCheck();
  }

  // ── Scan (the Lost Cabinets, shared/cabinets) ──

  /** Hold the glass up: the play view folds the Slate and pulses the glass while you walk. */
  holdUp(): void { this.cabinets.setScanning(true); }
  putAway(): void { this.cabinets.setScanning(false); this.readScan(); }

  private readScan(): void {
    const opened = this.cabinets.openedSet();
    this.found = this.cabinets.count();
    this.scanning = this.cabinets.scanning;
    this.warmth = this.cabinets.reading.warmth;
    this.clues = openClues(opened).map(def => this.t('cabinet.scan.clue', { place: this.t(`cabinet.place.${def.id}`) }));
    this.bonuses = SET_BONUSES.map(b => ({ ...b, reached: hasBonus(this.found, b.id) }));
    this.loupe = this.cabinets.loupe();
    this.cdr.markForCheck();
  }

  // ── Map & bounties (tier II) ──

  private readMap(): void {
    this.pins = this.delve.pins().map((pin: MapPin) => ({
      id: pin.id,
      name: pin.name || this.t(`play.map.pin.icon.${pin.icon}`),
      at: this.t('slate.map.pinAt', { col: pin.col, row: pin.row }),
    }));
    this.bountyRows = this.bounties.refresh().map((v: BountyView) => {
      const line = bountyLine(v.bounty);
      const vars = { ...line.vars, ...(typeof line.vars['stratum'] === 'string' ? { stratum: this.t(line.vars['stratum'] as string) } : {}) };
      return {
        id: v.bounty.id,
        line: this.t(line.key, vars),
        progress: this.t('slate.map.progress', { n: Math.min(v.observed, v.target), total: v.target }),
        state: v.claimed ? 'claimed' : v.ready ? 'ready' : 'open',
      };
    });
    this.cdr.markForCheck();
  }
}
