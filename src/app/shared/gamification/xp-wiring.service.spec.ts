import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { XpWiringService } from './xp-wiring.service';
import { XpService } from './xp.service';
import { ToolMasteryService } from './tool-mastery.service';
import { EasterEggService } from '../easter-eggs/easter-egg.service';
import { CANONICAL } from '../canonical-routes';

describe('XpWiringService path identity', () => {
  let events: Subject<NavigationEnd>;
  let awards: string[];

  beforeEach(() => {
    events = new Subject<NavigationEnd>();
    awards = [];
    TestBed.configureTestingModule({
      providers: [
        XpWiringService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: Router,
          useValue: { url: '/home', events: events.asObservable() },
        },
        {
          provide: XpService,
          useValue: {
            init: async () => undefined,
            toolsUsed: [],
            award: (type: string) => awards.push(type),
          },
        },
        { provide: ToolMasteryService, useValue: { backfill: () => undefined, record: () => undefined } },
        { provide: EasterEggService, useValue: { discovery$: new Subject() } },
      ],
    });
  });

  it('treats /home and /world as one page-visit in a session', async () => {
    const wiring = TestBed.inject(XpWiringService);
    wiring.init();
    await Promise.resolve();
    events.next(new NavigationEnd(1, CANONICAL.world, CANONICAL.world));
    expect(awards.filter(t => t === 'page-visit').length).toBe(1);
  });
});
