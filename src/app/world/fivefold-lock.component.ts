/**
 * fivefold-lock.component.ts — /world/fivefold-lock
 *
 * Locked summit premise. No resolution, no persistence.
 */
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FIVE_REALMS, FIVEFOLD_LOCK } from '../shared/narrative/five-realms.narrative';
import { continueFromWorld } from '../shared/narrative/continue-journey';

@Component({
  selector: 'app-fivefold-lock',
  standalone: true,
  imports: [RouterLink],
  template: `
    <article class="fl">
      <nav class="fl__crumb" aria-label="Breadcrumb">
        <a routerLink="/world">World</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{{ lock.name }}</span>
      </nav>

      <p class="fl__status">{{ lock.status }}</p>
      <h1>{{ lock.name }}</h1>
      <p>{{ lock.premise }}</p>
      <p>{{ lock.antagonist }}</p>
      <p>{{ lock.stakes }}</p>

      <section aria-labelledby="fl-answers">
        <h2 id="fl-answers">Five incomplete answers</h2>
        <ul>
          @for (realm of realms; track realm.id) {
            <li>
              <a [routerLink]="'/world/realms/' + realm.id">{{ realm.name }}</a>
              — {{ realm.faction }} wants a necessary but incomplete remedy.
            </li>
          }
        </ul>
      </section>

      <a class="fl__back" [routerLink]="start.route">
        <span>Continue Journey</span>
        <strong>{{ start.label }}</strong>
        <em>{{ start.note }}</em>
      </a>
    </article>
  `,
  styles: [`
    :host { display: block; }
    .fl {
      max-width: 42rem;
      margin: 0 auto;
      padding: clamp(1.4rem, 4vw, 2.6rem) clamp(1rem, 4vw, 1.6rem) 4rem;
      color: #e8ecf1;
    }
    .fl__crumb {
      display: flex; gap: .5rem; align-items: center;
      font-size: .85rem; color: rgba(232,236,241,.62); margin-bottom: 1.2rem;
    }
    .fl__crumb a, .fl a { color: #A78BFA; }
    .fl__crumb a { min-height: 44px; display: inline-flex; align-items: center; }
    .fl__status { letter-spacing: .08em; text-transform: uppercase; font-size: .75rem; color: #A78BFA; }
    h1 { font: 700 clamp(1.8rem, 5vw, 2.6rem)/1.1 'Orbitron', system-ui, sans-serif; }
    h2 { font: 600 .78rem/1.2 'Orbitron', system-ui, sans-serif; letter-spacing: .12em; text-transform: uppercase; }
    p, li { line-height: 1.55; }
    ul { padding-left: 1.1rem; display: grid; gap: .55rem; }
    .fl__back {
      display: grid; gap: .25rem; margin-top: 2rem; padding: 1rem 1.1rem;
      min-height: 44px; border-radius: 14px; border: 1px solid rgba(167,139,250,.45);
      text-decoration: none; color: inherit;
    }
    .fl__back:focus-visible { outline: 2px solid #A78BFA; outline-offset: 3px; }
    .fl__back span { font: 600 .68rem/1 'Orbitron', system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: #A78BFA; }
    .fl__back em { font-style: normal; color: rgba(232,236,241,.68); }
  `],
})
export class FivefoldLockComponent {
  readonly lock = FIVEFOLD_LOCK;
  readonly realms = FIVE_REALMS;
  readonly start = continueFromWorld();
}
