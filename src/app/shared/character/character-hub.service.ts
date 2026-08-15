/**
 * character-hub.service.ts — shared Character hub tab + drawer state.
 *
 * The /character hall and the keeper drawer share one IA. Last tab is a
 * device preference, not a synced blob.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

export const HUB_TABS = ['loadout', 'bank', 'skills', 'stats', 'records'] as const;
export type HubTab = (typeof HUB_TABS)[number];

export const HUB_TAB_KEY = 'godforge-hub-tab';

@Injectable({ providedIn: 'root' })
export class CharacterHubService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly tab$$ = new BehaviorSubject<HubTab>(this.readLast());
  private readonly drawer$$ = new BehaviorSubject(false);

  readonly tab$ = this.tab$$.asObservable();
  readonly drawer$ = this.drawer$$.asObservable();

  get tab(): HubTab { return this.tab$$.value; }
  get drawerOpen(): boolean { return this.drawer$$.value; }

  setTab(tab: HubTab): void {
    if (!HUB_TABS.includes(tab)) return;
    this.tab$$.next(tab);
    this.writeLast(tab);
  }

  openDrawer(tab?: HubTab): void {
    if (tab) this.setTab(tab);
    this.drawer$$.next(true);
  }

  closeDrawer(): void {
    if (this.drawer$$.value) this.drawer$$.next(false);
  }

  toggleDrawer(tab: HubTab): void {
    if (this.drawer$$.value && this.tab === tab) {
      this.closeDrawer();
      return;
    }
    this.openDrawer(tab);
  }

  parseTab(value: string | null | undefined): HubTab | null {
    return value && (HUB_TABS as readonly string[]).includes(value) ? value as HubTab : null;
  }

  private readLast(): HubTab {
    if (!this.isBrowser) return 'loadout';
    try {
      return this.parseTab(localStorage.getItem(HUB_TAB_KEY)) ?? 'loadout';
    } catch {
      return 'loadout';
    }
  }

  private writeLast(tab: HubTab): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(HUB_TAB_KEY, tab);
    } catch { /* private mode */ }
  }
}
