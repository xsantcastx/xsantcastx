import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { LandingComponent } from './landing.component';
import { continueJourney } from './continue-journey';
import { TranslationService } from '../translation.service';
import { XpService } from '../shared/gamification/xp.service';
import { EconomyService } from '../shared/economy/economy.service';
import { RuneForgeService } from '../shared/rune-forge/rune-forge.service';
import { LoreScrollService } from '../shared/rune-forge/lore-scroll.service';
import { QuestService } from '../shared/quests/quest.service';
import { CloudSaveService } from '../shared/cloud-save/cloud-save.service';
import { EasterEggService } from '../shared/easter-eggs/easter-egg.service';

const NEW_PROFILE_XP = {
  xp: 0,
  level: { level: 1, title: 'Wanderer', minXp: 0 },
  next: { level: 2, title: 'Spark', minXp: 50 },
  progress: 0,
  toNext: 50,
  aether: 0,
  nox: 0,
  aetherShare: 0.5,
  streak: 0,
  bestStreak: 0,
  toolsUsed: 0,
};

const NEW_PROFILE_BOARD = {
  daily: [
    { title: 'First spark', status: 'available' },
    { title: 'Second spark', status: 'available' },
    { title: 'Third spark', status: 'available' },
  ],
  weekly: [],
  epic: [],
  unclaimed: 0,
  openCount: 3,
  completedThisWeek: 0,
  totalCompleted: 0,
  log: [],
  dailyResetAt: '',
  weeklyResetAt: '',
};

const SIGNED_OUT = {
  state: 'off' as const,
  uid: null,
  email: null,
  displayName: null,
  photoURL: null,
  lastSyncedAt: null,
  error: null,
};

describe('LandingComponent', () => {
  let fixture: ComponentFixture<LandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        LandingComponent,
        RouterTestingModule.withRoutes([
          { path: 'tools', component: LandingComponent },
          { path: 'world/quests', component: LandingComponent },
          { path: 'character', component: LandingComponent },
        ]),
      ],
      providers: [
        {
          provide: TranslationService,
          useValue: {
            translate: (k: string) => k,
            currentLanguage$: of('en'),
            getCurrentLanguage: () => 'en',
          },
        },
        {
          provide: XpService,
          useValue: {
            snapshot: NEW_PROFILE_XP,
            snapshot$: of(NEW_PROFILE_XP),
            init: async () => {},
            hasUsedTool: () => false,
          },
        },
        {
          provide: EconomyService,
          useValue: {
            snapshot: { gold: 0, essence: 0 },
            snapshot$: of({ gold: 0, essence: 0 }),
            init: () => {},
          },
        },
        {
          provide: RuneForgeService,
          useValue: {
            snapshot: { unique: 0, crafted: [] },
            snapshot$: of({ unique: 0, crafted: [] }),
            init: () => {},
          },
        },
        {
          provide: LoreScrollService,
          useValue: {
            foundCount: 0,
            changed$: of(0),
            init: () => {},
          },
        },
        {
          provide: QuestService,
          useValue: {
            board: NEW_PROFILE_BOARD,
            board$: of(NEW_PROFILE_BOARD),
            init: () => {},
          },
        },
        {
          provide: CloudSaveService,
          useValue: {
            status: SIGNED_OUT,
            status$: of(SIGNED_OUT),
            init: () => {},
          },
        },
        {
          provide: EasterEggService,
          useValue: { foundCount: 0, init: async () => {} },
        },
      ],
    })
      .overrideComponent(LandingComponent, {
        set: { imports: [RouterTestingModule], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
  });

  it('points Continue Journey at continueJourney() for a stubbed new profile', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const expected = continueJourney({
      unclaimed: NEW_PROFILE_BOARD.unclaimed,
      openCount: NEW_PROFILE_BOARD.openCount,
      toolsUsed: NEW_PROFILE_XP.toolsUsed,
      runesFound: 0,
      gold: 0,
    });

    expect(expected.reason).toBe('discover');
    expect(fixture.componentInstance.journey).toEqual(expected);

    const cta = fixture.nativeElement.querySelector('.wd-journey__cta') as HTMLAnchorElement;
    expect(cta).toBeTruthy();
    expect(cta.getAttribute('href')).toBe(expected.route);
  });
});
