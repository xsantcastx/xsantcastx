/**
 * quest-card.component.ts — one quest, rendered.
 *
 * Used unchanged by the drawer and by /quests, so a quest looks the same
 * wherever it is read. The card takes its border and glow from the quest's
 * rarity tier and its accent from the quest's realm, which means the two
 * systems the site already has — the drop ladder and the five realms — are the
 * only vocabulary a visitor has to learn.
 *
 * Presentational: it renders a Quest and emits a claim. It never reads or
 * writes QuestService, so the same card can be dropped anywhere.
 */
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { InspectButtonComponent } from '../entity/inspect-button.component';
import { Quest } from './quest.model';
import { RARITIES } from '../rarity/rarity.model';
import { REALMS } from '../realms/realm.model';
