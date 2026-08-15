import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { CharacterHubService, HUB_TAB_KEY } from '../character/character-hub.service';
import { KeeperPanelService } from './keeper-panel.service';

describe('KeeperPanelService', () => {
  let keeper: KeeperPanelService;

  beforeEach(() => {
    localStorage.removeItem(HUB_TAB_KEY);
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });
    keeper = TestBed.inject(KeeperPanelService);
  });

  it('opens loadout and bank from a closed state', () => {
    expect(keeper.isOpen).toBe(false);
    keeper.show('character');
    expect(keeper.isOpen).toBe(true);
    expect(keeper.tab).toBe('loadout');
    keeper.show('bank');
    expect(keeper.isOpen).toBe(true);
    expect(keeper.tab).toBe('bank');
  });

  it('toggles the same tab closed and switches tabs when already open', () => {
    keeper.toggle('loadout');
    expect(keeper.isOpen).toBe(true);
    keeper.toggle('bank');
    expect(keeper.isOpen).toBe(true);
    expect(keeper.tab).toBe('bank');
    keeper.toggle('bank');
    expect(keeper.isOpen).toBe(false);
  });

  it('reopens Character on the last used tab', () => {
    const hub = TestBed.inject(CharacterHubService);
    hub.setTab('skills');
    keeper.show('character');
    expect(keeper.tab).toBe('skills');
  });
});
