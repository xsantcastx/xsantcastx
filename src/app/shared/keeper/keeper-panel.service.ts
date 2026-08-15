import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type KeeperTab = 'character' | 'bank';

/**
 * Opens the keeper side panel from anywhere — header, hall, or a bag click.
 * The panel itself is mounted next to the header, not inside it, for the same
 * stacking reason as the quest drawer.
 */
@Injectable({ providedIn: 'root' })
export class KeeperPanelService {
  private readonly open$$ = new BehaviorSubject(false);
  private readonly tab$$ = new BehaviorSubject<KeeperTab>('character');

  readonly open$: Observable<boolean> = this.open$$.asObservable();
  readonly tab$: Observable<KeeperTab> = this.tab$$.asObservable();

  get isOpen(): boolean { return this.open$$.value; }
  get tab(): KeeperTab { return this.tab$$.value; }

  show(tab: KeeperTab = this.tab$$.value): void {
    this.tab$$.next(tab);
    this.open$$.next(true);
  }

  close(): void {
    if (this.open$$.value) this.open$$.next(false);
  }

  toggle(tab: KeeperTab): void {
    if (this.open$$.value && this.tab$$.value === tab) {
      this.close();
      return;
    }
    this.show(tab);
  }

  setTab(tab: KeeperTab): void {
    this.tab$$.next(tab);
    if (!this.open$$.value) this.open$$.next(true);
  }
}
