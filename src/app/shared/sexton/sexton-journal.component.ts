/**
 * sexton-journal.component.ts — the quest journal for the Sexton's Count (sexton-count.model.ts), in the place panel:
 * a lead line, then the chain's six entries in order — each one done (what was found), under way (what to do now), or
 * still to come (a blank line, never a spoiler). Reads SextonCountService; writes nothing.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import type { Subscription } from 'rxjs';
import { TranslationService } from '../../translation.service';
import { SextonCountService } from './sexton-count.service';
import { SEXTON_I18N } from './sexton-count.i18n';

interface Row { id: string; state: 'done' | 'now' | 'later'; title: string; line: string }

@Component({
  selector: 'app-sexton-journal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sexton-journal.component.html',
  styleUrl: './sexton-journal.component.css',
})
export class SextonJournalComponent implements OnInit, OnDestroy {
  private readonly i18n = inject(TranslationService);
  private readonly sexton = inject(SextonCountService);
  private readonly cdr = inject(ChangeDetectorRef);
  private sub: Subscription | null = null;
  rows: Row[] = [];
  step = 'offer';

  constructor() { this.i18n.register(SEXTON_I18N); }

  ngOnInit(): void {
    this.sub = this.sexton.changed$.subscribe(() => { this.read(); this.cdr.markForCheck(); });
    this.read();
  }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  private read(): void {
    const v = this.sexton.view();
    this.step = v.step;
    this.rows = v.journal.map(e => ({
      id: e.id,
      state: e.state,
      title: this.t(`sexton.journal.${e.id}.title`),
      line: e.state === 'later' ? this.t('sexton.journal.later')
        : e.state === 'now' ? this.t(`sexton.journal.${e.id}.line`, { n: v.stones })
        : e.id === 'return' && v.choice ? this.t(`sexton.journal.return.${v.choice}`)
        : this.t(`sexton.journal.${e.id}.done`),
    }));
  }
}
