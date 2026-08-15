import { TestBed } from '@angular/core/testing';
import { KeeperPanelService } from './keeper-panel.service';

describe('KeeperPanelService', () => {
  let keeper: KeeperPanelService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    keeper = TestBed.inject(KeeperPanelService);
  });

  it('opens character and bank from a closed state', () => {
    expect(keeper.isOpen).toBe(false);
    keeper.show('character');
    expect(keeper.isOpen).toBe(true);
    expect(keeper.tab).toBe('character');
    keeper.show('bank');
    expect(keeper.isOpen).toBe(true);
    expect(keeper.tab).toBe('bank');
  });

  it('toggles the same tab closed and switches tabs when already open', () => {
    keeper.toggle('character');
    expect(keeper.isOpen).toBe(true);
    keeper.toggle('bank');
    expect(keeper.isOpen).toBe(true);
    expect(keeper.tab).toBe('bank');
    keeper.toggle('bank');
    expect(keeper.isOpen).toBe(false);
  });
});
