import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { EasterEggService, EASTER_EGGS } from '../shared/easter-eggs/easter-egg.service';
import { QuestService } from '../shared/quests/quest.service';
import {
  EclipseRarity,
  RarityDefinition,
  rarityOf,
  tierForEgg,
} from '../shared/rarity/rarity.model';

export interface ArenaGame {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** The egg that opens this gate. */
  unlockEggId: string;
  unlockHint: string;
  locked: boolean;
  /**
   * Derived, never authored: a game inherits the tier of the egg that unlocks
   * it. That way the ladder means one thing across the whole site — a red
   * border on an arena card and a red drop toast are the same claim.
   */
  tier: EclipseRarity;
  rarity: RarityDefinition;
}

/** The registry, before tiers are resolved from the egg ladder. */
type GameSeed = Omit<ArenaGame, 'locked' | 'tier' | 'rarity'>;

@Component({
  selector: 'app-arena',
  templateUrl: './arena.component.html',
  styleUrls: ['./arena.component.css'],
  standalone: false
})
export class ArenaComponent implements OnInit {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private readonly quests = inject(QuestService);

  totalEggs = EASTER_EGGS.length;
  foundCount = 0;

  private readonly seeds: GameSeed[] = [
    {
      id: 'shadow-puzzle',
      title: 'Shadow Puzzle',
      description: 'Stack and match shadow layers to recreate a target design. How few layers can you use?',
      icon: '👤',
      unlockEggId: 'shadow-lord',
      unlockHint: 'Create a box shadow with 5+ layers in the Box Shadow Generator',
    },
    {
      id: 'regex-race',
      title: 'Regex Race',
      description: 'Write the shortest regex that matches all green strings but none of the red ones. Race the clock.',
      icon: '🧙',
      unlockEggId: 'regex-master',
      unlockHint: 'Write a regex with both lookahead and lookbehind in the Regex Tester',
    },
    {
      id: 'json-tower',
      title: 'JSON Tower',
      description: 'How deep can you nest? Build the deepest valid JSON structure without breaking the formatter.',
      icon: '🌀',
      unlockEggId: 'json-inception',
      unlockHint: 'Format JSON nested 10+ levels deep in the JSON Formatter',
    },
    {
      id: 'uuid-lottery',
      title: 'UUID Lottery',
      description: 'Generate UUIDs until you hit a lucky pattern. Leaderboard tracks your streak.',
      icon: '🎰',
      unlockEggId: 'uuid-lucky',
      unlockHint: 'Generate a UUID starting with "000" in the UUID Generator',
    },
    {
      id: 'color-memory',
      title: 'Color Memory',
      description: 'Match hex colors to their names from memory. Progressively harder palettes.',
      icon: '🎨',
      unlockEggId: 'color-void',
      unlockHint: 'Convert pure black #000000 in the Color Converter',
    },
    {
      id: 'chmod-chess',
      title: 'Chmod Chess',
      description: 'Navigate a filesystem grid using only permission changes. Reach root without hitting 000.',
      icon: '👑',
      unlockEggId: 'chmod-god',
      unlockHint: 'Set file permissions to 777 in the Chmod Calculator',
    },
    {
      id: 'hash-hunt',
      title: 'Hash Hunt',
      description: 'Find inputs that produce hashes matching a given prefix. Proof-of-work for fun.',
      icon: '🌌',
      unlockEggId: 'hash-meaning',
      unlockHint: 'Hash the number "42" in the Hash Generator',
    },
    {
      id: 'css-golf',
      title: 'CSS Golf',
      description: 'Recreate a target UI with the fewest CSS characters. Par or better wins a badge.',
      icon: '⛳',
      unlockEggId: 'css-important',
      unlockHint: 'Minify CSS with 5+ !important declarations in the CSS Minifier',
    },
  ];

  /**
   * Built once in the field initialiser so the template has real tiers to
   * render during prerender — a server-rendered card shows the right border
   * colour and the locked state, and hydration only flips what the visitor has
   * actually unlocked.
   */
  games: ArenaGame[] = this.seeds.map(seed => {
    const tier = tierForEgg(
      seed.unlockEggId,
      EASTER_EGGS.find(e => e.id === seed.unlockEggId)?.rarity
    );
    return { ...seed, locked: true, tier, rarity: rarityOf(tier) };
  });

  async ngOnInit(): Promise<void> {
    if (!this.isBrowser) return;
    await this.eggs.init();
    this.foundCount = this.eggs.foundCount;
    for (const game of this.games) {
      game.locked = !this.eggs.isFound(game.unlockEggId);
      // The Arena Champion quest counts gates you have opened. The gates are
      // not yet playable, so "opened" is the honest signal available — and it
      // is the one the quest's own wording promises.
      if (!game.locked) this.quests.recordArenaGame(game.id);
    }
  }

  get unlockedCount(): number {
    return this.games.filter(g => !g.locked).length;
  }

  get progressPercent(): number {
    return this.totalEggs > 0 ? Math.round((this.foundCount / this.totalEggs) * 100) : 0;
  }

  /**
   * The rarest gate you have actually opened. Null until you open one — an
   * arena stat that reports your best locked card would be meaningless.
   */
  get rarestUnlocked(): ArenaGame | null {
    return this.games
      .filter(g => !g.locked)
      .reduce<ArenaGame | null>(
        (best, g) => (!best || g.rarity.weight > best.rarity.weight ? g : best),
        null
      );
  }
}
