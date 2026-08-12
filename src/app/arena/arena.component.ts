import { Component, OnInit, OnDestroy, HostBinding, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { EasterEggService, EASTER_EGGS } from '../shared/easter-eggs/easter-egg.service';
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
   * Whether the gate leads anywhere yet. Opening a gate that has no game behind
   * it used to render an "Enter →" button wired to nothing at all, which read
   * as a broken site rather than as unfinished work.
   */
  playable: boolean;
  /**
   * Derived, never authored: a game inherits the tier of the egg that unlocks
   * it. That way the ladder means one thing across the whole site — a red
   * border on an arena card and a red drop toast are the same claim.
   */
  tier: EclipseRarity;
  rarity: RarityDefinition;
}

/** The registry, before tiers are resolved from the egg ladder. */
type GameSeed = Omit<ArenaGame, 'locked' | 'tier' | 'rarity' | 'playable'>;

/** Gate ids that have a game built behind them. Everything else is still forge work. */
const BUILT_GAMES = new Set<string>(['color-memory']);

@Component({
  selector: 'app-arena',
  templateUrl: './arena.component.html',
  styleUrls: ['./arena.component.css'],
  standalone: false
})
export class ArenaComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

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
      description: 'Match the Eclipse Fragments — pair every colour in the dark before the light fades.',
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
    return { ...seed, locked: true, playable: BUILT_GAMES.has(seed.id), tier, rarity: rarityOf(tier) };
  });

  async ngOnInit(): Promise<void> {
    if (!this.isBrowser) return;
    await this.eggs.init();
    this.foundCount = this.eggs.foundCount;
    for (const game of this.games) {
      game.locked = !this.eggs.isFound(game.unlockEggId);
    }
  }

  ngOnDestroy(): void {
    // never leave the page scroll-locked if the visitor navigates away mid-game
    this.lockScroll(false);
  }

  /**
   * The global `routeFadeIn` animation runs with `fill: forwards`, so every
   * routed host keeps a transform and is therefore its own stacking context.
   * A fixed overlay inside one cannot out-rank the z-index:1000 header on its
   * own — the host has to be lifted instead.
   */
  @HostBinding('class.ar-game-open')
  get gameOpen(): boolean {
    return this.activeGameId !== null;
  }

  /** id of the gate currently open in the overlay, or null */
  activeGameId: string | null = null;
  /** id of an opened gate whose game is not built yet */
  soonGameId: string | null = null;

  enter(game: ArenaGame): void {
    if (game.locked) return;
    if (!game.playable) {
      this.soonGameId = game.id;
      return;
    }
    this.soonGameId = null;
    this.activeGameId = game.id;
    this.lockScroll(true);
  }

  closeGame(): void {
    this.activeGameId = null;
    this.lockScroll(false);
  }

  private lockScroll(locked: boolean): void {
    if (!this.isBrowser) return;
    document.body.style.overflow = locked ? 'hidden' : '';
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
