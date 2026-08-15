import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';

import { CharacterHubService, HUB_TAB_KEY } from './character-hub.service';

describe('CharacterHubService', () => {
  beforeEach(() => {
    localStorage.removeItem(HUB_TAB_KEY);
    TestBed.configureTestingModule({
      providers: [
        CharacterHubService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
  });

  it('defaults to loadout and remembers the last tab', () => {
    const hub = TestBed.inject(CharacterHubService);
    expect(hub.tab).toBe('loadout');
    hub.setTab('bank');
    expect(hub.tab).toBe('bank');
    expect(localStorage.getItem(HUB_TAB_KEY)).toBe('bank');
  });

  it('opens the drawer on Bank without closing a different tab', () => {
    const hub = TestBed.inject(CharacterHubService);
    hub.openDrawer('loadout');
    expect(hub.drawerOpen).toBe(true);
    hub.toggleDrawer('bank');
    expect(hub.drawerOpen).toBe(true);
    expect(hub.tab).toBe('bank');
    hub.toggleDrawer('bank');
    expect(hub.drawerOpen).toBe(false);
  });
});
