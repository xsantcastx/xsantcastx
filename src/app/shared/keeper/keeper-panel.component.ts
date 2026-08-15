/**
 * keeper-panel.component.ts — character + bank as a side drawer.
 *
 * Mounted in AppComponent as a sibling of the header. Opening it from the
 * navbar must not put the drawer inside the header's z-index:1000 context.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { OverlayStackService } from '../overlay/overlay-stack.service';
import { EquipmentPanelComponent } from '../rpg/equipment-panel.component';
import { InventoryService } from '../rpg/inventory.service';
import { QuestService } from '../quests/quest.service';
import { XpService } from '../gamification/xp.service';
import { KeeperPanelService, KeeperTab } from './keeper-panel.service';

@Component({
  selector: 'app-keeper-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, EquipmentPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <div class="kp__scrim" (click)="close()" aria-hidden="true"></div>
      <aside class="kp" role="dialog" aria-modal="true" [attr.aria-label]="tab === 'bank' ? 'Bank' : 'Character'">
        <header class="kp__head">
          <div class="kp__tabs" role="tablist">
            <button type="button" role="tab" class="kp__tab"
                    [class.is-on]="tab === 'character'"
                    [attr.aria-selected]="tab === 'character'"
                    (click)="setTab('character')">Character</button>
            <button type="button" role="tab" class="kp__tab"
                    [class.is-on]="tab === 'bank'"
                    [attr.aria-selected]="tab === 'bank'"
                    (click)="setTab('bank')">
              Bank
              @if (bagCount > 0) {
                <span class="kp__n">{{ bagCount }}</span>
              }
            </button>
          </div>
          <button type="button" class="kp__x" (click)="close()" aria-label="Close">✕</button>
        </header>

        <p class="kp__who">{{ rankTitle }} · {{ rankLevel }}</p>

        <div class="kp__body">
          <app-equipment-panel [variant]="tab === 'bank' ? 'bank' : 'select'" />
        </div>

        <a routerLink="/character" class="kp__hall" (click)="close()">Open the hall →</a>
      </aside>
    }
  `,
  styles: [`
    .kp__scrim {
      position: fixed; inset: 0; z-index: 92;
      background: rgba(4, 2, 8, .55);
    }
    .kp {
      position: fixed; z-index: 93;
      top: 0; left: var(--shell-sidebar-w, 0);
      width: min(440px, 100vw);
      height: 100dvh;
      display: flex; flex-direction: column;
      overflow: hidden;
      border-right: 3px solid #6a5424;
      box-shadow: inset -1px 0 0 #c9a84c, 16px 0 40px rgba(0,0,0,.55);
      background:
        radial-gradient(ellipse 80% 30% at 50% 0%, rgba(201,168,76,.08), transparent 60%),
        #120e08;
    }
    .kp__head {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 12px 8px;
      flex: none;
    }
    .kp__tabs { display: flex; gap: 6px; flex: 1; }
    .kp__tab, .kp__x, .kp__hall {
      min-height: 40px; padding: 0 12px;
      border: 2px solid #6a5424;
      background: #1a1208; color: #f4e7c3;
      font: 700 12px/1 Palatino, 'Palatino Linotype', 'Times New Roman', serif;
      letter-spacing: .06em; text-transform: uppercase;
      cursor: pointer;
    }
    .kp__tab.is-on { border-color: #c9a84c; background: #3d2a0e; }
    .kp__n {
      margin-left: 6px; padding: 1px 5px;
      background: #0c0a06; color: #c9a84c;
      font-variant-numeric: tabular-nums;
    }
    .kp__x { flex: none; }
    .kp__who {
      margin: 0 12px 8px;
      color: #cbb98a; font-size: 13px;
    }
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
        left: 0;
        top: var(--nav-h, 56px);
        height: calc(100dvh - var(--nav-h, 56px) - var(--gftabs-h, 0px));
      }
    }
  `],
})
export class KeeperPanelComponent implements OnInit, OnDestroy {
  private readonly keeper = inject(KeeperPanelService);
  private readonly overlays = inject(OverlayStackService);
  private readonly quests = inject(QuestService);
  private readonly xp = inject(XpService);
  private readonly inventory = inject(InventoryService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private subs = new Subscription();
  private unreg?: () => void;

  open = false;
  tab: KeeperTab = 'character';

  get rankTitle(): string { return this.xp.snapshot.level.title; }
  get rankLevel(): number { return this.xp.snapshot.level.level; }
  get bagCount(): number { return this.inventory.snapshot.bag.length; }

  ngOnInit(): void {
    this.inventory.init();
    this.subs.add(this.keeper.open$.subscribe(open => {
      this.open = open;
      if (open) {
        this.quests.closeDrawer();
        this.unreg ??= this.overlays.push('keeper-panel', () => this.keeper.close());
        if (this.isBrowser) document.body.style.overflow = 'hidden';
      } else {
        this.unreg?.();
        this.unreg = undefined;
        if (this.isBrowser) document.body.style.overflow = '';
      }
      this.cdr.markForCheck();
    }));
    this.subs.add(this.keeper.tab$.subscribe(tab => {
      this.tab = tab;
      this.cdr.markForCheck();
    }));
    this.subs.add(this.inventory.snapshot$.subscribe(() => this.cdr.markForCheck()));
    this.subs.add(this.xp.snapshot$.subscribe(() => this.cdr.markForCheck()));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.unreg?.();
    if (this.isBrowser) document.body.style.overflow = '';
  }

  close(): void { this.keeper.close(); }
  setTab(tab: KeeperTab): void { this.keeper.setTab(tab); }
}
