/**
 * keeper-panel.component.ts — the Character hub as a side drawer.
 *
 * Mounted in AppComponent as a sibling of the header. Opening it from the
 * navbar must not put the drawer inside the header's z-index:1000 context.
 * Docks on the right with no scrim so Mine stays clickable.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { OverlayStackService } from '../overlay/overlay-stack.service';
import { InventoryService } from '../rpg/inventory.service';
import { QuestService } from '../quests/quest.service';
import { XpService } from '../gamification/xp.service';
import { CharacterHubComponent } from '../character/character-hub.component';
import { CharacterHubService, type HubTab } from '../character/character-hub.service';
import { KeeperPanelService } from './keeper-panel.service';

@Component({
  selector: 'app-keeper-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, CharacterHubComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <aside class="kp" role="complementary" [attr.aria-label]="label">
        <header class="kp__head">
          <p class="kp__who">{{ rankTitle }} · {{ rankLevel }}</p>
          @if (bagCount > 0) {
            <span class="kp__n">{{ bagCount }}</span>
          }
          <button type="button" class="kp__x" (click)="close()" aria-label="Close">✕</button>
        </header>

        <div class="kp__body">
          <app-character-hub variant="drawer" />
        </div>

        <a routerLink="/character" class="kp__hall" (click)="close()">Open the hall →</a>
      </aside>
    }
  `,
  styles: [`
    /* Re-skinned onto the shared --gf-* surface. This drawer carried the same
       private brown palette as the character hub and did not match the Market
       it sits beside. */
    .kp {
      position: fixed; z-index: var(--z-drawer);
      top: 0; right: 0; left: auto;
      width: min(400px, 46vw);
      height: 100dvh;
      display: flex; flex-direction: column;
      overflow: hidden;
      border-left: 1px solid var(--gf-edge-strong);
      box-shadow: -16px 0 48px rgba(0,0,0,.55);
      pointer-events: auto;
      background:
        radial-gradient(ellipse 80% 30% at 50% 0%, rgba(201,168,76,.08), transparent 60%),
        var(--gf-panel-solid);
      backdrop-filter: blur(12px);
    }
    .kp::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(201,168,76,.5) 50%, transparent);
    }
    .kp__head {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 12px 8px;
      flex: none;
    }
    .kp__who {
      margin: 0;
      flex: 1;
      color: var(--gf-dim); font-size: 13px;
    }
    .kp__n {
      padding: 1px 6px;
      border-radius: 4px;
      background: rgba(0,0,0,.4); color: var(--gf-accent);
      font-variant-numeric: tabular-nums;
    }
    .kp__x, .kp__hall {
      min-height: 44px; padding: 0 14px;
      border: 1px solid var(--gf-edge);
      border-radius: var(--gf-radius-sm);
      background: var(--gf-panel); color: var(--gf-dim);
      font: 700 12px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: .1em; text-transform: uppercase;
      cursor: pointer;
      transition: border-color .16s ease, color .16s ease;
    }
    .kp__x:hover, .kp__hall:hover {
      border-color: var(--gf-edge-strong); color: var(--gf-ink);
    }
    .kp__x:focus-visible, .kp__hall:focus-visible {
      outline: 2px solid var(--gf-accent-text); outline-offset: 2px;
    }
    .kp__x { flex: none; }
    .kp__body {
      flex: 1; min-height: 0;
      overflow: auto;
      padding: 0 10px 16px;
      -webkit-overflow-scrolling: touch;
    }
    .kp__hall {
      display: flex; align-items: center; justify-content: center;
      margin: 0 12px 16px;
      text-decoration: none;
    }
    @media (max-width: 960px) {
      .kp {
        left: auto;
        right: 0;
        top: auto;
        bottom: var(--gftabs-h, 0px);
        width: min(400px, 92vw);
        height: min(62dvh, 560px);
        border-left: 1px solid var(--gf-edge-strong);
        border-top: 1px solid var(--gf-edge-strong);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .kp__x, .kp__hall { transition: none; }
    }
  `],
})
export class KeeperPanelComponent implements OnInit, OnDestroy {
  private readonly keeper = inject(KeeperPanelService);
  private readonly hub = inject(CharacterHubService);
  private readonly overlays = inject(OverlayStackService);
  private readonly quests = inject(QuestService);
  private readonly xp = inject(XpService);
  private readonly inventory = inject(InventoryService);
  private readonly cdr = inject(ChangeDetectorRef);
  private subs = new Subscription();
  private unreg?: () => void;

  open = false;
  tab: HubTab = 'loadout';

  get rankTitle(): string { return this.xp.snapshot.level.title; }
  get rankLevel(): number { return this.xp.snapshot.level.level; }
  get bagCount(): number { return this.inventory.snapshot.usedRows; }
  get label(): string {
    return this.tab === 'bank' ? 'Bank' : 'Character';
  }

  ngOnInit(): void {
    this.inventory.init();
    this.subs.add(this.keeper.open$.subscribe(open => {
      this.open = open;
      if (open) {
        this.quests.closeDrawer();
        this.unreg ??= this.overlays.push('keeper-panel', () => this.keeper.close());
      } else {
        this.unreg?.();
        this.unreg = undefined;
      }
      this.cdr.markForCheck();
    }));
    this.subs.add(this.hub.tab$.subscribe(tab => {
      this.tab = tab;
      this.cdr.markForCheck();
    }));
    this.subs.add(this.inventory.snapshot$.subscribe(() => this.cdr.markForCheck()));
    this.subs.add(this.xp.snapshot$.subscribe(() => this.cdr.markForCheck()));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.unreg?.();
  }

  close(): void { this.keeper.close(); }
}
