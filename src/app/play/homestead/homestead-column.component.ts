/**
 * homestead-column.component.ts — the always-visible buildings column over the
 * Homestead (Cookie-Clicker simple).
 *
 * One row per Gold/sec maker: its painting, name, how many you own, what the
 * next one adds, and a cost button that lights up when you can afford it and
 * says the shortfall when you cannot. One "??? — unlocks at …" row sits just
 * ahead of the player. Every number is the economy's own (HomesteadService
 * reads nextCost / goldPerSecond live); buying is the Market's receipted
 * purchase, and the plot building grows on the purchase event.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnDestroy, OnInit, Output, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { artFor } from '../../shared/art/art';
import { HomeForgeRow, HomesteadHud, HomesteadService, purchaseMessage } from './homestead.service';
import { TranslationService } from '../../translation.service';
import { HOME_FORGE_I18N } from '../../shared/minigames/home-forge.i18n';
import { tierNumeral } from '../../shared/minigames/home-forge.model';
import { ColumnRow, formatGoldWhole, formatPerSecond } from './homestead.model';

@Component({
  selector: 'app-homestead-column',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './homestead-column.component.html',
  styleUrls: ['./homestead-column.component.css'],
})
export class HomesteadColumnComponent implements OnInit, OnDestroy {
  private readonly homestead = inject(HomesteadService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly i18n = inject(TranslationService);
  private sub?: Subscription;

  hud: HomesteadHud = { gold: 0, perSecond: 0, perClick: 1, rows: [], forge: [] };
  /**
   * Narrow screens start folded so the plot stays visible, except for a Keeper
   * who owns no building yet: their first goal is a row in this list, so it
   * opens once for them (see ngOnInit).
   */
  open = !this.browser || typeof window.matchMedia !== 'function' || !window.matchMedia('(max-width: 720px)').matches;
  /** Folded or unfolded. The play view uses it to make room on a phone. */
  @Output() readonly openChange = new EventEmitter<boolean>();
  private firstHud = true;
  notice = '';
  /** The row that just bought, for its flash. */
  bought: string | null = null;
  private noticeTimer?: ReturnType<typeof setTimeout>;

  readonly gold = formatGoldWhole;
  readonly perSecond = formatPerSecond;

  constructor() {
    this.i18n.register(HOME_FORGE_I18N);
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  ngOnInit(): void {
    this.sub = this.homestead.hud$.subscribe(hud => {
      this.hud = hud;
      if (this.firstHud && hud.rows.length) {
        this.firstHud = false;
        if (!this.open && !hud.rows.some(row => row.owned > 0)) { this.open = true; this.announce(); }
      }
      this.cdr.markForCheck();
    });
    this.announce();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
  }

  art(row: ColumnRow | HomeForgeRow): string { return artFor(row.art)?.src ?? ''; }

  toggle(): void { this.open = !this.open; this.announce(); }

  /** Tell the play view, after this check: it styles its own stage from the answer. */
  private announce(): void { queueMicrotask(() => this.openChange.emit(this.open)); }

  strike(): void { this.homestead.strike(); }

  buy(row: ColumnRow): void {
    if (row.state !== 'shown' || !row.affordable) return;
    const code = this.homestead.buy(row.id);
    const ok = code === 'ok' || code === 'queued';
    this.notice = ok ? `${row.name} built!` : purchaseMessage(code);
    this.bought = ok ? row.id : null;
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => { this.notice = ''; this.bought = null; this.cdr.markForCheck(); }, 2200);
    this.cdr.markForCheck();
  }

  /** "Upgrade Anvil II · 750K Gold": the station's one button. */
  upgradeHome(row: HomeForgeRow): void {
    if (row.next === null || !row.affordable) return;
    const result = this.homestead.upgradeHome(row.station, row.next);
    const ok = result.code === 'ok' || result.code === 'replayed';
    this.notice = ok ? this.t('homeForge.upgrade.done', { name: row.name, tier: tierNumeral(result.tier) })
      : result.code === 'insufficient-funds' ? this.t('homeForge.upgrade.funds') : this.t('homeForge.upgrade.failed');
    this.bought = ok ? `home:${row.station}` : null;
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => { this.notice = ''; this.bought = null; this.cdr.markForCheck(); }, 2200);
    this.cdr.markForCheck();
  }

  trackRow(_: number, row: ColumnRow): string { return row.id; }
}
