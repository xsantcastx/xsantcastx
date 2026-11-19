/**
 * decanter-games.component.ts — `/apps/decanter/games`: which Windows games work in Decanter.
 * Generated from Decanter's catalog (decanter-games.data.ts), so it says exactly what the app says.
 * Prerendered, in Decanter's skin.
 */
import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DECANTER_GAMES } from './decanter-games.data';
import { DecanterGame } from './decanter-games.types';
import { StoreFooterComponent, StoreTopbarComponent } from './store-parts';

@Component({
  selector: 'app-decanter-games',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, StoreTopbarComponent, StoreFooterComponent],
  templateUrl: './decanter-games.component.html',
  styleUrl: './store.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DecanterGamesComponent {
  readonly query = signal('');
  private readonly matches = computed(() => {
    const q = this.query().trim().toLowerCase();
    return DECANTER_GAMES.filter(g => !q || g.name.toLowerCase().includes(q) || g.store.toLowerCase().includes(q));
  });
  readonly works = computed(() => this.matches().filter(g => g.rating && g.rating !== 'borked'));
  readonly untested = computed(() => this.matches().filter(g => !g.rating));
  readonly broken = computed(() => this.matches().filter(g => g.rating === 'borked'));
  readonly total = DECANTER_GAMES.length;

  label(r: DecanterGame['rating']): string {
    return r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Not tested yet';
  }
}
