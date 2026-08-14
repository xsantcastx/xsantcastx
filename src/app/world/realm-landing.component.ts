/**
 * realm-landing.component.ts — /world/realms/:realmId
 *
 * Inspectable static dossier for one of the five places. No saved choices.
 */
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import {
  type NarrativeCharacter,
  type NarrativeRealm,
  narrativeRealmById,
} from '../shared/narrative/five-realms.narrative';
import {
  type ContinueJourney,
  continueFromRealm,
} from '../shared/narrative/continue-journey';

@Component({
  selector: 'app-realm-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './realm-landing.component.html',
  styleUrls: ['./realm-landing.component.css'],
})
export class RealmLandingComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private sub?: Subscription;

  realm: NarrativeRealm | null = null;
  journey: ContinueJourney | null = null;
  openCharacterId: string | null = null;
  requestedId = '';

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe(params => {
      this.requestedId = params.get('realmId') ?? '';
      this.realm = narrativeRealmById(this.requestedId);
      this.journey = this.realm ? continueFromRealm(this.realm) : null;
      this.openCharacterId = this.realm?.characters[0].id ?? null;
      this.title.setTitle(
        this.realm ? `${this.realm.name} — Eclipse Realms` : 'Unknown place — Eclipse Realms',
      );
    });
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
