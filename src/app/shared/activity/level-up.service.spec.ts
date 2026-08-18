import { TestBed } from '@angular/core/testing';
import { LevelUpService, type LevelUpEvent } from './level-up.service';
import { xpForLevel } from './mining-level';

describe('LevelUpService', () => {
  let service: LevelUpService;
  let events: LevelUpEvent[];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LevelUpService);
    events = [];
    service.events$.subscribe(e => events.push(e));
  });

  it('fires exactly at the XP that crosses into the next level', () => {
    const at = xpForLevel(5);
    service.checkMining(at - 1, at);
    expect(events.length).toBe(1);
    expect(events[0].level).toBe(5);
  });

  it('does not fire when XP moves without crossing a level boundary', () => {
    const floor = xpForLevel(4);
    service.checkMining(floor, floor + 3);
    expect(events.length).toBe(0);
  });

  it('does not fire when XP goes down or stays flat', () => {
    const at = xpForLevel(6);
    service.checkMining(at, at);
    service.checkMining(at, at - 50);
    expect(events.length).toBe(0);
  });

  it('flags every tenth level as a milestone and nothing else', () => {
    const ten = xpForLevel(10);
    service.checkMining(ten - 1, ten);
    const eleven = xpForLevel(11);
    service.checkMining(eleven - 1, eleven);

    expect(events[0].level).toBe(10);
    expect(events[0].milestone).toBe(true);
    expect(events[1].level).toBe(11);
    expect(events[1].milestone).toBe(false);
  });

  it('names the skill and carries art for the banner to render', () => {
    const at = xpForLevel(2);
    service.checkMining(at - 1, at);
    expect(events[0].skillLabelKey).toBe('work.discipline.mining');
    expect(events[0].art?.src).toContain('cinder-ore');
  });

  /*
   * This is the guard against the real failure mode: a returning level-30
   * Keeper opening the site is not a 29-level-up moment. checkMining only
   * ever sees the XP immediately before and after one resolved mine action
   * (see the file header), so there is no "page load" input to this function
   * at all — but assert the boundary explicitly in case a future caller is
   * tempted to feed it a save's full XP history instead.
   */
  it('a large simultaneous jump still announces once, at the level actually reached', () => {
    const before = xpForLevel(3);
    const after = xpForLevel(8);
    service.checkMining(before, after);
    expect(events.length).toBe(1);
    expect(events[0].level).toBe(8);
  });
});
