/**
 * <app-slate> — the Mirror Slate, open in the play view's place panel
 * (docs/handoff/mirror-slate.md). Lazy: the play view imports it on the first
 * open, so none of it is in the initial bundle.
 *
 *  - Home: it opens on a few big choices — her four tables, the Homestead, and
 *    (tier II) the map & bounties — never on a wall. Each is one tap, with a
 *    Back to the glass.
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
  ChangeDetectionStrategy, ChangeDetectorRef, Component, ComponentRef, OnDestroy, OnInit, PLATFORM_ID, Type,
  ViewChild, ViewContainerRef, inject,
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
import { SlateService } from './slate.service';
import { SLATE_TABLES, SLATE_WORLD_POINTERS, slateTabs, type SlateTab, type SlateTableGame, type SlateTier } from './slate.model';

/** Which face of the glass is up: the home choices, or one of the Slate's screens. */
export type SlateFace = 'home' | SlateTab;

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
  imports: [ActionButtonComponent],
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
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();

  /** Always in the DOM (hidden off the Tables face), so it resolves before any game is asked for. */
  @ViewChild('gameHost', { read: ViewContainerRef, static: true }) private gameHost!: ViewContainerRef;
  private gameRef: ComponentRef<unknown> | null = null;
  private gameSeq = 0;

  readonly tables = SLATE_TABLES;
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

  constructor() {
    this.i18n.register(STATION_UI_I18N);
    this.i18n.register(SLATE_I18N);
    this.i18n.register(BOUNTIES_I18N);
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  ngOnInit(): void {
    this.slate.init();
    this.tier = this.slate.tier();
    this.tabs = slateTabs(this.tier);
    this.subs.add(merge(this.economy.snapshot$, this.inventory.snapshot$, this.homestead.hud$, this.explorers.state$).subscribe(() => this.read()));
    this.read();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.gameSeq++;
    this.gameRef?.destroy();
  }

  // ── Faces ──

  /** Open one of the Slate's screens from the home face. */
  open(face: SlateTab): void {
    if (!this.tabs.includes(face)) return;
    this.face = face;
    this.notice = '';
    if (face === 'map') this.readMap();
    this.read();
  }

  /** One tap from the home face straight onto a table. */
  openGame(id: string): void {
    const table = this.tables.find(t => t.game === id);
    if (!table) return;
    this.face = 'tables';
    this.notice = '';
    if (table.game === this.game && this.gameRef) { this.cdr.markForCheck(); return; }
    this.game = table.game;
    this.showGame(table.game);
  }

  /** Back to the home face. The table keeps its state while the Slate stays open. */
  back(): void {
    this.face = 'home';
    this.notice = '';
    this.read();
  }

  get gameTitleKey(): string {
    return this.tables.find(t => t.game === this.game)?.titleKey ?? 'slate.tab.tables';
  }

  // ── Tables: the stalls' own components ──

  private showGame(id: SlateTableGame): void {
    if (!this.browser) return;
    const table = this.tables.find(t => t.game === id);
    if (!table) return;
    const seq = ++this.gameSeq;
    this.gameRef?.destroy();
    this.gameRef = null;
    this.gameHost.clear();
    this.gameLoading = true;
    this.gameError = false;
    this.cdr.markForCheck();
    PANEL_REGISTRY[table.panel].load().then((type: Type<unknown>) => {
      if (seq !== this.gameSeq) return;
      this.gameRef = this.gameHost.createComponent(type);
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
