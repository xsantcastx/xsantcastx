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
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { artFor } from '../../shared/art/art';
import { HomesteadHud, HomesteadService, purchaseMessage } from './homestead.service';
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
  private sub?: Subscription;

  hud: HomesteadHud = { gold: 0, perSecond: 0, perClick: 1, rows: [] };
  /** Narrow screens start folded so the plot stays visible. */
  open = !this.browser || typeof window.matchMedia !== 'function' || !window.matchMedia('(max-width: 720px)').matches;
  notice = '';
  /** The row that just bought, for its flash. */
  bought: string | null = null;
  private noticeTimer?: ReturnType<typeof setTimeout>;

  readonly gold = formatGoldWhole;
  readonly perSecond = formatPerSecond;

  ngOnInit(): void {
    this.sub = this.homestead.hud$.subscribe(hud => { this.hud = hud; this.cdr.markForCheck(); });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
  }

  art(row: ColumnRow): string { return artFor(row.art)?.src ?? ''; }

  toggle(): void { this.open = !this.open; }

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

  trackRow(_: number, row: ColumnRow): string { return row.id; }
}
