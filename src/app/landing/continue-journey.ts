import { CANONICAL } from '../shared/canonical-routes';

export type JourneyReason = 'claim' | 'quests' | 'discover' | 'forge' | 'character';

export interface JourneyInput {
  unclaimed: number;
  openCount: number;
  toolsUsed: number;
  runesFound: number;
  gold: number;
}

export interface JourneyTarget {
  route: string;
  reason: JourneyReason;
}

/**
 * One deterministic next step for a returning player.
 *
 * First match wins. A new profile (`toolsUsed === 0`) is sent to discover even
 * when the daily board already has open slots — those slots exist for everyone
 * and are not a reason to land on quests before the player has used a tool.
 */
export function continueJourney(input: JourneyInput): JourneyTarget {
  if (input.unclaimed > 0) return { route: CANONICAL.quests, reason: 'claim' };
  if (input.toolsUsed === 0) return { route: '/tools', reason: 'discover' };
  if (input.openCount > 0) return { route: CANONICAL.quests, reason: 'quests' };
  if (input.runesFound === 0) return { route: CANONICAL.forge, reason: 'forge' };
  return { route: CANONICAL.character, reason: 'character' };
}
