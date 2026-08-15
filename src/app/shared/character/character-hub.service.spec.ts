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

  it('arms a bag item for Loadout without inventing a second inventory', () => {
    const hub = TestBed.inject(CharacterHubService);
    hub.arm('crown');
    expect(hub.armedId).toBe('crown');
    hub.arm(null);
    expect(hub.armedId).toBeNull();
  });
});
