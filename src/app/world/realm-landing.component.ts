/**
 * realm-landing.component.ts — /world/realms/:realmId
 *
 * Inspectable static dossier for one of the five places. No saved choices.
 */
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';

import { TranslationService } from '../translation.service';
import {
  FIVEFOLD_LOCK,
  type NarrativeCharacter,
  type NarrativeRealm,
  narrativeRealmById,
} from '../shared/narrative/five-realms.narrative';
import {
  type ContinueJourney,
  continueFromRealm,
} from '../shared/narrative/continue-journey';
import { ROOTGLASS_CANOPY_HREF } from '../shared/activity/foraging.model';
import { InfernalChapterComponent } from './infernal-chapter.component';

@Component({
  selector: 'app-realm-landing',
  standalone: true,
  imports: [RouterLink, InfernalChapterComponent],
  templateUrl: './realm-landing.component.html',
  styleUrls: ['./realm-landing.component.css'],
})
export class RealmLandingComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly i18n = inject(TranslationService);
  private sub?: Subscription;

  /** A2: Verdant's foraging site. Linked from the landing with no chapter gate — Verdant has no chapter yet. */
  readonly canopyHref = ROOTGLASS_CANOPY_HREF;

  realm: NarrativeRealm | null = null;
  journey: ContinueJourney | null = null;
  openCharacterId: string | null = null;
  requestedId = '';

  ngOnInit(): void {
    // The id arrives one of two ways, and both have to work.
    //
    // Each of the five realms has its own literal route so it can carry its
    // own title, description and JSON-LD (see realm.routes.ts). A literal path
    // declares no `:realmId`, so on those routes `paramMap` is empty and the
    // id comes from the route's `data` instead. `world/realms/:realmId` is
    // still there as the fallback for an unrecognised id, and there the param
    // is the only source. Reading just one of the two renders every real realm
    // as "This place is not on the map".
    this.sub = combineLatest([this.route.paramMap, this.route.data]).subscribe(([params, data]) => {
      this.requestedId = params.get('realmId') ?? (data['realmId'] as string | undefined) ?? '';
      this.realm = narrativeRealmById(this.requestedId);
      this.journey = this.realm ? continueFromRealm(this.realm) : null;
      this.openCharacterId = this.realm?.characters[0].id ?? null;
      this.applyTitle();
    });
    this.sub.add(this.i18n.currentLanguage$.subscribe(() => this.applyTitle()));
  }

  private applyTitle(): void {
    this.title.setTitle(
      this.realm
        ? this.t('world.realm.titlePage', { name: this.realm.name })
        : this.t('world.realm.titleUnknown'),
    );
  }

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  continueName(): string {
    if (!this.journey) return '';
    if (this.journey.realmId === FIVEFOLD_LOCK.id) return FIVEFOLD_LOCK.name;
    const next = narrativeRealmById(this.journey.realmId);
    return next ? this.t('world.realm.continueTo', { name: next.name }) : this.journey.label;
  }

  continueNote(): string {
    if (!this.journey) return '';
    if (this.journey.realmId === FIVEFOLD_LOCK.id) return FIVEFOLD_LOCK.status;
    const next = narrativeRealmById(this.journey.realmId);
    return next
      ? this.t(
          next.id === 'infernal' ? 'world.realm.playableNext' : 'world.realm.notPlayableNext',
          { chapter: next.chapterTitle, landmark: next.landmark },
        )
      : this.journey.note;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggleCharacter(character: NarrativeCharacter): void {
    this.openCharacterId = this.openCharacterId === character.id ? null : character.id;
  }

  isCharacterOpen(character: NarrativeCharacter): boolean {
    return this.openCharacterId === character.id;
  }
}
