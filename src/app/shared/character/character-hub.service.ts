/**
 * character-hub.service.ts — shared Character hub tab + armed bag item.
 *
 * The /character hall and the keeper drawer share one IA. Last tab is a
 * device preference, not a synced blob. Drawer open/close stays on
 * KeeperPanelService so the right-dock, no-scrim panel is unchanged.
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
  private readonly armed$$ = new BehaviorSubject<string | null>(null);

  readonly tab$ = this.tab$$.asObservable();
  readonly armed$ = this.armed$$.asObservable();

  get tab(): HubTab { return this.tab$$.value; }
  get armedId(): string | null { return this.armed$$.value; }

  setTab(tab: HubTab): void {
    if (!HUB_TABS.includes(tab)) return;
    this.tab$$.next(tab);
    this.writeLast(tab);
  }

  arm(itemId: string | null): void {
    this.armed$$.next(itemId);
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
