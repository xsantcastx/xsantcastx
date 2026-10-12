import { TestBed } from '@angular/core/testing';

import { ActivityProgressionGateway } from '../activity/activity-progression.gateway';
import { emptyActivityLedger } from '../activity/activity.model';
import { LevelUpEvent, LevelUpService } from '../activity/level-up.service';
import { CraftingService } from '../crafting/crafting.service';
import { SkillActionService } from './skill-actions.service';

describe('SkillActionService.announceBenchCraft', () => {
  let service: SkillActionService;
  let crafting: CraftingService;
  let events: LevelUpEvent[];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    // A ledger with no `forge` XP, so the bench XP alone decides the crossing.
    const activity = TestBed.inject(ActivityProgressionGateway);
    spyOn(activity, 'init');
    spyOnProperty(activity, 'snapshot', 'get').and.returnValue(emptyActivityLedger());
    service = TestBed.inject(SkillActionService);
    crafting = TestBed.inject(CraftingService);
    events = [];
    TestBed.inject(LevelUpService).events$.subscribe(event => events.push(event));
  });

  it('fires the Smithing banner when a bench craft carries Smithing over a level', () => {
    // Bench XP after the craft is 150, 120 of it from this craft. Smithing 2 opens at 100.
    spyOn(crafting, 'xp').and.returnValue(150);
    service.announceBenchCraft({ xpGained: 120 });
    expect(events.length).toBe(1);
    expect(events[0].skillLabelKey).toBe('skills.name.smithing');
    expect(events[0].level).toBe(2);
  });

  it('stays quiet when the craft crossed no level, or added nothing', () => {
    spyOn(crafting, 'xp').and.returnValue(60);
    service.announceBenchCraft({ xpGained: 20 });
    service.announceBenchCraft({ xpGained: 0 });
    service.announceBenchCraft(null);
    expect(events).toEqual([]);
  });
});
