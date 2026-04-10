import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { EasterEggService, EASTER_EGGS, EasterEgg } from '../shared/easter-eggs/easter-egg.service';

export interface GameCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockEggId: string;
  unlockHint: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  locked: boolean;
}

@Component({
  selector: 'app-games',
  templateUrl: './games.component.html',
  styleUrls: ['./games.component.css'],
  standalone: false
})
export class GamesComponent implements OnInit {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  totalEggs = EASTER_EGGS.length;
  foundCount = 0;

  readonly games: GameCard[] = [
    {
      id: 'shadow-puzzle',
      title: 'Shadow Puzzle',
      description: 'Stack and match shadow layers to recreate a target design. How few layers can you use?',
      icon: '👤',
      unlockEggId: 'shadow-lord',
      unlockHint: 'Unlock by creating a box shadow with 5+ layers in the Box Shadow Generator',
      rarity: 'rare',
      locked: true
    },
    {
      id: 'regex-race',
      title: 'Regex Race',
      description: 'Write the shortest regex that matches all green strings but none of the red ones. Race the clock.',
      icon: '🧙',
      unlockEggId: 'regex-master',
      unlockHint: 'Unlock by writing a regex with both lookahead and lookbehind in the Regex Tester',
      rarity: 'epic',
      locked: true
    },
    {
      id: 'json-tower',
      title: 'JSON Tower',
      description: 'How deep can you nest? Build the deepest valid JSON structure without breaking the formatter.',
      icon: '🌀',
      unlockEggId: 'json-inception',
      unlockHint: 'Unlock by formatting JSON nested 10+ levels deep in the JSON Formatter',
      rarity: 'rare',
      locked: true
    },
    {
      id: 'uuid-lottery',
      title: 'UUID Lottery',
      description: 'Generate UUIDs until you hit a lucky pattern. Leaderboard tracks your streak.',
      icon: '🎰',
      unlockEggId: 'uuid-lucky',
      unlockHint: 'Unlock by generating a UUID starting with "000" in the UUID Generator',
      rarity: 'epic',
      locked: true
    },
    {
      id: 'color-memory',
      title: 'Color Memory',
      description: 'Match hex colors to their names from memory. Progressively harder palettes.',
      icon: '🎨',
      unlockEggId: 'color-void',
      unlockHint: 'Unlock by converting pure black #000000 in the Color Converter',
      rarity: 'common',
      locked: true
    },
    {
      id: 'chmod-chess',
      title: 'Chmod Chess',
      description: 'Navigate a filesystem grid using only permission changes. Reach root without hitting 000.',
      icon: '👑',
      unlockEggId: 'chmod-god',
      unlockHint: 'Unlock by setting file permissions to 777 in the Chmod Calculator',
      rarity: 'rare',
      locked: true
    },
    {
      id: 'hash-hunt',
      title: 'Hash Hunt',
      description: 'Find inputs that produce hashes matching a given prefix. Proof-of-work for fun.',
      icon: '🌌',
      unlockEggId: 'hash-meaning',
      unlockHint: 'Unlock by hashing the number "42" in the Hash Generator',
      rarity: 'rare',
      locked: true
    },
    {
      id: 'css-golf',
      title: 'CSS Golf',
      description: 'Recreate a target UI with the fewest CSS characters. Par or better wins a badge.',
      icon: '⛳',
      unlockEggId: 'css-important',
      unlockHint: 'Unlock by minifying CSS with 5+ !important declarations in the CSS Minifier',
      rarity: 'rare',
      locked: true
    }
  ];

  async ngOnInit(): Promise<void> {
    if (!this.isBrowser) return;
    await this.eggs.init();
    this.foundCount = this.eggs.foundCount;
    // Resolve locked state based on discovered easter eggs
    for (const game of this.games) {
      game.locked = !this.eggs.isFound(game.unlockEggId);
    }
  }

  get unlockedCount(): number {
    return this.games.filter(g => !g.locked).length;
  }

  get progressPercent(): number {
    return Math.round((this.foundCount / this.totalEggs) * 100);
  }
}
