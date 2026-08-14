import { CANONICAL } from '../shared/canonical-routes';
import { continueJourney, JourneyInput } from './continue-journey';

function input(partial: Partial<JourneyInput> = {}): JourneyInput {
  return {
    unclaimed: 0,
    openCount: 0,
    toolsUsed: 1,
    runesFound: 1,
    gold: 0,
    ...partial,
  };
}

describe('continueJourney', () => {
  it('sends unclaimed rewards to the quest board first', () => {
    expect(continueJourney(input({ unclaimed: 2, openCount: 3, toolsUsed: 0, runesFound: 0 })))
      .toEqual({ route: CANONICAL.quests, reason: 'claim' });
  });

  it('sends a new profile to discover even when the board has open dailies', () => {
    expect(continueJourney(input({ unclaimed: 0, openCount: 3, toolsUsed: 0, runesFound: 0 })))
      .toEqual({ route: '/tools', reason: 'discover' });
  });

  it('sends a returning player with open quests to the board', () => {
    expect(continueJourney(input({ openCount: 2, toolsUsed: 4 })))
      .toEqual({ route: CANONICAL.quests, reason: 'quests' });
  });

  it('sends a returning player with no runes to the forge', () => {
    expect(continueJourney(input({ openCount: 0, toolsUsed: 2, runesFound: 0 })))
      .toEqual({ route: CANONICAL.forge, reason: 'forge' });
  });

  it('falls through to the character sheet', () => {
    expect(continueJourney(input({ openCount: 0, toolsUsed: 8, runesFound: 3, gold: 40 })))
      .toEqual({ route: CANONICAL.character, reason: 'character' });
  });
});
