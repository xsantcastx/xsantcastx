/**
 * sailing-board.component.ts — the Sailing Board (docs/design/realms-endgame.md §1.3): every ship out of a pier as a big
 * row, its fare in Gold, its level band and its state with the reason always shown. The window around it (title, close)
 * is the play view's; this is the body, so it stays one self-contained piece with its own stylesheet.
 *
 * Station rule (memory: stations must be dummy-simple): one plain action, the fare on it. Paying goes through
 * EconomyService.spendGold; the voyage itself is the host's (it owns the engine).
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslationService } from '../../translation.service';
import { EconomyService } from '../../shared/economy/economy.service';
import { CONTINENTS } from '../td/td-engine';
import { buildBoard, pierById, type BoardRow } from '../td/td-harbour';
import { HARBOUR_I18N } from './harbour.i18n';

@Component({
  selector: 'app-sailing-board',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sailing-board.component.html',
  styleUrl: './sailing-board.component.css',
})
export class SailingBoardComponent implements OnChanges, OnDestroy {
  private readonly economy = inject(EconomyService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();
  /** The pier (td-harbour PIERS id) whose board this is. */
  @Input() pier = '';
  /** The Keeper's level (the soft warning). */
  @Input() level = 1;
  /** The Keeper chose a ship and paid: the host runs the crossing. */
  @Output() readonly sail = new EventEmitter<{ row: BoardRow; fare: number }>();

  rows: BoardRow[] = [];
  pick = '';
  gold = this.economy.snapshot.gold;
  said = '';

  constructor() {
    this.i18n.register(HARBOUR_I18N);
    this.subs.add(this.economy.snapshot$.subscribe(e => { this.gold = e.gold; this.rebuild(); this.cdr.markForCheck(); }));
  }

  ngOnChanges(): void { this.rebuild(); this.said = ''; }

  private rebuild(): void {
    this.rows = this.pier ? buildBoard(this.pier, { continents: CONTINENTS, level: this.level, gold: this.gold }) : [];
    if (!this.rows.some(r => r.id === this.pick)) this.pick = (this.rows.find(r => r.state === 'ok') ?? this.rows[0])?.id ?? '';
  }

  get master(): { id: string; name: string } { return pierById(this.pier)?.master ?? { id: '', name: '' }; }
  get picked(): BoardRow | undefined { return this.rows.find(r => r.id === this.pick); }
  get canBoard(): boolean { return this.picked?.state === 'ok'; }

  choose(r: BoardRow): void { this.pick = r.id; this.said = ''; }

  board(): void {
    const r = this.picked;
    if (!r || r.state !== 'ok') return;
    if (!this.economy.spendGold(r.fare, 'fare')) { this.said = this.t('harbour.noGold'); this.cdr.markForCheck(); return; }
    this.said = this.t('harbour.paid', { n: r.fare });
    this.sail.emit({ row: r, fare: r.fare });
  }

  /** The reason line under the picked row: story lock, then short of gold; otherwise nothing. */
  reason(r: BoardRow): string {
    if (r.state === 'locked' && r.gate) return this.t('harbour.lock.' + r.gate);
    if (r.state === 'broke') return this.t('harbour.short', { have: this.gold, fare: r.fare });
    return '';
  }
  t(key: string, params?: Record<string, string | number>): string { return this.i18n.translate(key, params); }
  ngOnDestroy(): void { this.subs.unsubscribe(); }
}
