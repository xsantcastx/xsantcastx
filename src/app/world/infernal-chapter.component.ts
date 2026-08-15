/**
 * infernal-chapter.component.ts — playable Infernal opening.
 *
 * enter → meet → inspect → choose → inspectable consequence.
 * Next action is Basalt Seamworks. No travel reward.
 */
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { TranslationService } from '../translation.service';
import { ChapterGateway } from '../shared/narrative/chapter.gateway';
import {
  BASALT_SEAMWORKS_HREF,
  type InfernalSeamChoice,
} from '../shared/narrative/chapter.model';
import {
  INFERNAL_CHOICES,
  INFERNAL_EVIDENCE,
  INFERNAL_WITNESS_RUNE,
  type InfernalChapterStep,
  infernalChoiceById,
} from '../shared/narrative/infernal-chapter';
import { narrativeRealmById } from '../shared/narrative/five-realms.narrative';

@Component({
  selector: 'app-infernal-chapter',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './infernal-chapter.component.html',
  styleUrls: ['./infernal-chapter.component.css'],
})
export class InfernalChapterComponent implements OnInit, OnDestroy {
  private readonly chapters = inject(ChapterGateway);
  private readonly i18n = inject(TranslationService);
  private sub?: Subscription;

  readonly evidence = INFERNAL_EVIDENCE;
  readonly choices = INFERNAL_CHOICES;
  readonly seamworksHref = BASALT_SEAMWORKS_HREF;
  readonly witness = INFERNAL_WITNESS_RUNE;
  readonly place = narrativeRealmById('infernal');

  step: InfernalChapterStep = 'enter';
  persistError = false;
  openEvidence: string | null = INFERNAL_EVIDENCE[0]?.id ?? null;

  ngOnInit(): void {
    this.chapters.init();
    this.sub = this.chapters.snapshot$.subscribe(() => this.syncStep());
    this.syncStep();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  go(step: InfernalChapterStep): void {
    if (this.chapters.infernal() && step !== 'consequence') return;
    this.step = step;
    this.persistError = false;
  }

  choose(choiceId: InfernalSeamChoice): void {
    const result = this.chapters.resolveInfernal(choiceId);
    if (!result.ok) {
      this.persistError = true;
      return;
    }
    this.persistError = false;
    this.step = 'consequence';
  }

  retry(): void {
    this.persistError = false;
  }

  chosen() {
    return infernalChoiceById(this.chapters.infernal()?.choiceId ?? null);
  }

  isOpen(id: string): boolean {
    return this.openEvidence === id;
  }

  toggleEvidence(id: string): void {
    this.openEvidence = this.openEvidence === id ? null : id;
  }

  private syncStep(): void {
    if (this.chapters.infernal()) this.step = 'consequence';
  }
}
