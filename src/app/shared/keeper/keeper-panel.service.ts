import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CharacterHubService, type HubTab } from '../character/character-hub.service';

export type KeeperTab = HubTab | 'character';

/**
 * Opens the keeper side panel from anywhere — header, hall, or a bag click.
 * Tab IA lives on CharacterHubService so /character and the drawer stay in step.
 * The panel itself is mounted next to the header, not inside it, for the same
 * stacking reason as the quest drawer.
 */
@Injectable({ providedIn: 'root' })
export class KeeperPanelService {
  private readonly hub = inject(CharacterHubService);
  private readonly open$$ = new BehaviorSubject(false);

  readonly open$: Observable<boolean> = this.open$$.asObservable();
  readonly tab$: Observable<HubTab> = this.hub.tab$;

  get isOpen(): boolean { return this.open$$.value; }
  get tab(): HubTab { return this.hub.tab; }

  show(tab: KeeperTab = this.hub.tab): void {
    this.hub.setTab(this.resolve(tab));
    this.open$$.next(true);
  }

  close(): void {
    if (this.open$$.value) this.open$$.next(false);
  }

  toggle(tab: KeeperTab): void {
    const next = this.resolve(tab);
    if (this.open$$.value && this.hub.tab === next) {
      this.close();
      return;
    }
    this.show(next);
  }

  setTab(tab: KeeperTab): void {
    this.hub.setTab(this.resolve(tab));
    if (!this.open$$.value) this.open$$.next(true);
  }

  private resolve(tab: KeeperTab): HubTab {
    return tab === 'character' ? this.hub.tab : tab;
  }
}
