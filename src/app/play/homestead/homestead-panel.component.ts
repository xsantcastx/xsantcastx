/**
 * homestead-panel.component.ts — the tiny in-world panel for one Homestead building.
 *
 * "For dummies" simple: the building's name, one plain sentence with its real
 * number, ONE big button naming what it does and what it costs, a plain reason
 * when it cannot be pressed, and Details for the rest. The building is read
 * from the `?at=` the side-scroller writes when it opens a place (`hs-<id>`),
 * so the panel host needs no new plumbing.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { HomesteadService, purchaseMessage, FURNACE_RUNGS, AUTOMATON_RUNGS, TREASURY_RUNGS, CAMP_RUNGS, WORKSHOP_RUNGS } from './homestead.service';
import { BuildingAction, RungDef, pendingLine } from './homestead.model';
import { HomesteadBuildingId, buildingOfStation } from '../world/homestead';
import { EconomyService } from '../../shared/economy/economy.service';
import { TranslationService } from '../../translation.service';

const RUNGS: Record<HomesteadBuildingId, readonly RungDef[]> = {
  forge: [], treasury: TREASURY_RUNGS, furnace: FURNACE_RUNGS, automatons: AUTOMATON_RUNGS, camp: CAMP_RUNGS, workshop: WORKSHOP_RUNGS,
};

interface DetailRow { name: string; owned: number }

@Component({
  selector: 'app-homestead-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './homestead-panel.component.html',
  styleUrls: ['./homestead-panel.component.css'],
})
export class HomesteadPanelComponent implements OnInit, OnDestroy {
  private readonly homestead = inject(HomesteadService);
  private readonly economy = inject(EconomyService);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly i18n = inject(TranslationService);
  private readonly subs = new Subscription();

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  building: HomesteadBuildingId | null = null;
  name = '';
  sentence = '';
  action: BuildingAction | null = null;
  waiting = '';
  details: DetailRow[] = [];
  notice = '';
  noticeTone: 'ok' | 'denied' = 'ok';
  /** Bumped on every success, so the celebration replays. */
  celebrate = 0;

  ngOnInit(): void {
    this.subs.add(this.route.queryParamMap.subscribe(params => {
      this.building = buildingOfStation(params.get('at'));
      this.read();
    }));
    this.subs.add(this.economy.snapshot$.subscribe(() => this.read()));
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  private read(): void {
    const id = this.building;
    if (!id) { this.action = null; this.cdr.markForCheck(); return; }
    this.name = this.t('homestead.name.' + id);
    this.sentence = this.homestead.sentence(id);
    this.action = this.homestead.action(id);
    this.waiting = pendingLine(this.homestead.pending(id));
    this.details = RUNGS[id].map(r => ({ name: r.name, owned: this.economy.levelOf(r.id) }));
    this.cdr.markForCheck();
  }

  press(): void {
    const id = this.building, action = this.action;
    if (!id || !action) return;
    if (id === 'forge') { this.homestead.strike(); this.read(); return; }
    if (!action.upgradeId || !action.affordable) return;
    const code = this.homestead.buy(action.upgradeId);
    const ok = code === 'ok' || code === 'queued';
    this.notice = ok ? `${purchaseMessage(code)} ${this.t('homestead.panel.grow', { name: this.name })}` : purchaseMessage(code);
    this.noticeTone = ok ? 'ok' : 'denied';
    if (ok) this.celebrate++;
    this.read();
  }

  get disabled(): boolean {
    return !this.action || (this.building !== 'forge' && (!this.action.upgradeId || !this.action.affordable));
  }
}
