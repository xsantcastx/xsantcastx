/**
 * keeper-panel.component.ts — Character hub as a side drawer.
 *
 * Sibling of the header so Escape and stacking match the quest drawer.
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
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { OverlayStackService } from '../overlay/overlay-stack.service';
import { CharacterHubService } from './character-hub.service';
import { CharacterHubComponent } from './character-hub.component';

@Component({
  selector: 'app-keeper-panel',
  standalone: true,
  imports: [RouterLink, CharacterHubComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <div class="kp__scrim" (click)="close()" aria-hidden="true"></div>
      <aside class="kp" role="dialog" aria-modal="true" [attr.aria-label]="tLabel">
        <header class="kp__head">
          <p class="kp__title">{{ tLabel }}</p>
          <button type="button" class="kp__x" (click)="close()" [attr.aria-label]="closeLabel">✕</button>
        </header>
        <div class="kp__body">
          <app-character-hub variant="drawer" />
        </div>
        <a class="kp__hall" routerLink="/character" [queryParams]="{ tab: tab }" (click)="close()">
          {{ hallLabel }}
        </a>
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
      width: min(460px, 100vw);
      height: 100dvh;
      display: flex; flex-direction: column;
      border-right: 1px solid #6a5424;
      background: #120e08;
      box-shadow: 16px 0 40px rgba(0,0,0,.55);
    }
    .kp__head {
      display: flex; align-items: center; justify-content: space-between;
      gap: 8px; padding: 12px;
    }
    .kp__title { margin: 0; letter-spacing: .08em; text-transform: uppercase; font-size: .78rem; color: #c9a84c; }
    .kp__x, .kp__hall {
      min-height: 44px; min-width: 44px;
      padding: 0 12px;
      border: 1px solid #6a5424;
      background: #1a1208; color: #f4e7c3;
      cursor: pointer;
    }
    .kp__body { flex: 1; min-height: 0; overflow: auto; padding: 0 12px 12px; }
    .kp__hall {
      display: flex; align-items: center; justify-content: center;
      margin: 0 12px 16px; text-decoration: none;
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
  private readonly hub = inject(CharacterHubService);
  private readonly overlays = inject(OverlayStackService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private sub?: Subscription;
  private unreg?: () => void;

  open = false;
  tab = this.hub.tab;

  get tLabel(): string { return this.tab === 'bank' ? 'Bank' : 'Character'; }
  get closeLabel(): string { return 'Close'; }
  get hallLabel(): string { return 'Open the hall'; }

  ngOnInit(): void {
    this.sub = this.hub.drawer$.subscribe(open => {
      this.open = open;
      if (open) {
        this.unreg ??= this.overlays.push('keeper-panel', () => this.hub.closeDrawer());
        if (this.isBrowser) document.body.style.overflow = 'hidden';
      } else {
        this.unreg?.();
        this.unreg = undefined;
        if (this.isBrowser) document.body.style.overflow = '';
      }
      this.cdr.markForCheck();
    });
    this.sub.add(this.hub.tab$.subscribe(tab => {
      this.tab = tab;
      this.cdr.markForCheck();
    }));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.unreg?.();
    if (this.isBrowser) document.body.style.overflow = '';
  }

  close(): void {
    this.hub.closeDrawer();
  }
}
