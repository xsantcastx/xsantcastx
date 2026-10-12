/**
 * delve-missions-board.component.ts — the Delve missions on the Quest Board.
 *
 * One card per mission the Keeper can see: who asks, one sentence of what,
 * a bar, the one next step, the plain reward, and Claim when it is ready.
 * Locked missions show as a single line naming what to finish first, so the
 * Fracture is visible as a goal without being a wall of text.
 */
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { craftingRecipeById } from '../crafting/crafting.model';
import { runeById } from '../rune-forge/rune.model';
import { NPCS, type NpcId } from './npc.model';
import { missionRewardLine } from './delve-missions.model';
import { DelveMissionState, NpcQuestService } from './npc-quest.service';
import { DelveMissionChipComponent } from './delve-mission-chip.component';

@Component({
  selector: 'app-delve-missions-board',
  standalone: true,
  imports: [DelveMissionChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-delve-mission-chip class="dmb__chip"></app-delve-mission-chip>
    <ul class="dmb">
      @for (m of missions(); track m.mission.id) {
        <li class="dmb__card" [class.dmb__card--locked]="m.locked" [class.dmb__card--done]="m.claimed"
            [class.dmb__card--ready]="m.turnInReady">
          <p class="dmb__who">{{ giver(m) }}</p>
          <h3 class="dmb__title">
            {{ m.mission.title }}
            @if (m.mission.repeatable && m.timesDone > 0) {
              <span class="dmb__times">filled {{ m.timesDone }}×</span>
            }
          </h3>
          @if (m.locked) {
            <p class="dmb__step">{{ m.nextStep }}</p>
          } @else {
            <p class="dmb__brief">{{ m.mission.brief }}</p>
            @if (!m.claimed) {
              <div class="dmb__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"
                   [attr.aria-valuenow]="m.progress" [attr.aria-label]="m.mission.title + ' progress'">
                <span class="dmb__fill" [style.width.%]="m.progress"></span>
              </div>
              <p class="dmb__step"><span class="dmb__count">{{ m.observed }} / {{ m.target }}</span> {{ m.nextStep }}</p>
              <p class="dmb__reward">Reward: {{ reward(m) }}</p>
              @if (m.mission.unlocks) { <p class="dmb__unlocks">{{ m.mission.unlocks }}</p> }
              @if (m.turnInReady) {
                <button type="button" class="dmb__claim" (click)="claim(m.mission.id)">Claim — {{ reward(m) }}</button>
              }
            } @else {
              <p class="dmb__step">Done.</p>
              @if (m.mission.reward.loreFragment; as lore) { <p class="dmb__lore">{{ lore }}</p> }
            }
          }
        </li>
      }
    </ul>
  `,
  styles: [`
    :host { display: block; }
    .dmb__chip { margin-bottom: 14px; }
    .dmb { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .dmb__card {
      display: flex; flex-direction: column; gap: 6px;
      padding: 14px;
      border: 1px solid var(--gf-edge-strong, rgba(255,255,255,.12));
      border-radius: var(--gf-radius, 12px);
      background: var(--gf-panel, rgba(10, 6, 26, 0.55));
      color: var(--gf-ink, #ddd7ee);
    }
    .dmb__card--ready { border-color: var(--gf-accent, #6affe0); }
    .dmb__card--locked { opacity: .7; }
    .dmb__card--done { opacity: .85; }
    .dmb__who { margin: 0; font: 700 10px/1.2 'Orbitron', system-ui, sans-serif; letter-spacing: .12em;
      text-transform: uppercase; color: var(--gf-dim, #9d95b5); }
    .dmb__title { margin: 0; font: 700 14px/1.3 'Orbitron', system-ui, sans-serif; }
    .dmb__times { margin-left: 6px; font-size: 11px; font-weight: 500; color: var(--gf-dim, #9d95b5); }
    .dmb__brief { margin: 0; font-size: .9rem; }
    .dmb__bar { height: 6px; border-radius: 3px; background: rgba(255,255,255,.07); overflow: hidden; }
    .dmb__fill { display: block; height: 100%; background: var(--gf-accent, #6affe0); transition: width .4s ease; }
    .dmb__step { margin: 0; font-size: .85rem; }
    .dmb__count { font-variant-numeric: tabular-nums; color: var(--gf-dim, #9d95b5); margin-right: 4px; }
    .dmb__reward, .dmb__unlocks, .dmb__lore { margin: 0; font-size: .78rem; color: var(--gf-dim, #9d95b5); }
    .dmb__lore { font-style: italic; }
    .dmb__claim {
      margin-top: 4px; min-height: 44px;
      border: 1px solid var(--gf-accent, #6affe0); border-radius: 10px;
      background: transparent; color: var(--gf-accent-text, #6affe0); cursor: pointer;
      font: 700 12px/1 'Orbitron', system-ui, sans-serif; letter-spacing: .04em;
    }
    .dmb__claim:focus-visible { outline: 2px solid var(--gf-accent-text, #6affe0); outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) { .dmb__fill { transition: none; } }
  `],
})
export class DelveMissionsBoardComponent implements OnInit {
  private readonly npc = inject(NpcQuestService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly missions = signal<DelveMissionState[]>([]);

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.npc.init();
    this.npc.missions$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(all => this.missions.set(all));
  }

  giver(m: DelveMissionState): string {
    const name = (id: NpcId) => NPCS.find(n => n.id === id)?.name ?? id;
    return m.mission.alsoFrom ? `${name(m.mission.npcId)} & ${name(m.mission.alsoFrom)}` : name(m.mission.npcId);
  }

  reward(m: DelveMissionState): string {
    const r = m.mission.reward;
    return missionRewardLine(
      r, m.gold,
      r.recipe ? craftingRecipeById(r.recipe)?.name : undefined,
      r.rune ? runeById(r.rune)?.name : undefined,
    );
  }

  claim(id: string): void { this.npc.claimMission(id); }
}
