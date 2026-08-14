import {
  PLAYABLE_DAILY_QUESTS,
  PLAYABLE_EPIC_QUESTS,
  PLAYABLE_WEEKLY_QUESTS,
  isPlayableQuest,
} from './quest.model';

describe('playable quests after the tool-product cutover', () => {
  const playable = [
    ...PLAYABLE_DAILY_QUESTS,
    ...PLAYABLE_WEEKLY_QUESTS,
    ...PLAYABLE_EPIC_QUESTS,
  ];

  it('keeps enough dailies and weeklies to fill the board', () => {
    expect(PLAYABLE_DAILY_QUESTS.length).toBeGreaterThanOrEqual(3);
    expect(PLAYABLE_WEEKLY_QUESTS.length).toBeGreaterThanOrEqual(2);
    expect(PLAYABLE_EPIC_QUESTS.length).toBeGreaterThan(0);
  });

  it('does not put tool-route quests on the public board', () => {
    for (const quest of playable) {
      expect(isPlayableQuest(quest)).withContext(quest.id).toBe(true);
      expect(['tool-use', 'tool-variety', 'realm-spread', 'speed-run'])
        .withContext(quest.id)
        .not.toContain(quest.condition.type);
      for (const path of quest.condition.paths ?? []) {
        expect(path.startsWith('/tools')).withContext(`${quest.id} ${path}`).toBe(false);
        expect(path).withContext(quest.id).not.toBe('/blueprint');
      }
    }
  });
});
