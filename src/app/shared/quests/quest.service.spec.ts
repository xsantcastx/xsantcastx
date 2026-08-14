import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { QuestService, QUEST_KEY } from './quest.service';
import { XpService } from '../gamification/xp.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { CANONICAL } from '../canonical-routes';

describe('QuestService page identity', () => {
  let store: Map<string, string>;
  let quests: QuestService;

  function seedPages(pages: string[]): void {
    store.set(QUEST_KEY, JSON.stringify({
      version: 1,
      dayKey: '',
      weekKey: '',
      day: { n: {}, s: { pages: [...pages] } },
      week: { n: {}, s: { pages: [...pages] } },
      life: { n: {}, s: { pages: [...pages] } },
      claimed: [],
      log: [],
      totalCompleted: 0,
    }));
  }

  function lifePages(): string[] {
    const raw = store.get(QUEST_KEY);
    if (!raw) return [];
    return JSON.parse(raw).life.s.pages ?? [];
  }

  beforeEach(() => {
    store = new Map();
    TestBed.configureTestingModule({
      providers: [
        QuestService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: XpService,
          useValue: {
            snapshot: { streak: 0, level: { level: 1 }, toolsUsed: 0, aether: 0, nox: 0 },
            snapshot$: new BehaviorSubject({ streak: 0, level: { level: 1 }, toolsUsed: 0, aether: 0, nox: 0 }),
            init: () => undefined,
          },
        },
        {
          provide: GameStateGateway,
          useValue: {
            readRaw: (key: string) => store.get(key) ?? null,
            write: (key: string, value: unknown) => store.set(key, JSON.stringify(value)),
          },
        },
        { provide: LocalSaveRegistry, useValue: { register: () => undefined } },
      ],
    });
    quests = TestBed.inject(QuestService);
  });

  it('rewrites /home to /world on load so a visit to /world does not grow the set', () => {
    seedPages(['/home', '/codex']);
    quests.init();
    expect(lifePages()).toEqual([CANONICAL.world, '/codex']);
    quests.addToSet('pages', CANONICAL.world);
    expect(lifePages()).toEqual([CANONICAL.world, '/codex']);
  });

  it('does not collapse /arena/color-memory onto /world/trials', () => {
    seedPages(['/arena/color-memory', '/arena']);
    quests.init();
    expect(lifePages()).toEqual(['/arena/color-memory', CANONICAL.trials]);
  });
});
