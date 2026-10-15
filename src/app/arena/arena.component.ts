import { Component, ElementRef, HostListener, Injector, OnInit, Type, ViewChild, inject, PLATFORM_ID } from '@angular/core';
import { NgComponentOutlet, isPlatformBrowser } from '@angular/common';
import { EasterEggService, PUBLIC_CODEX_EGGS } from '../shared/easter-eggs/easter-egg.service';
import { QuestService } from '../shared/quests/quest.service';
import {
  EclipseRarity,
  RarityDefinition,
  rarityOf,
  tierForEgg,
} from '../shared/rarity/rarity.model';
import { ARENA_PLAYABLE, formatScore, isPlayableGateOpen, playableById } from './games/arena-game.model';
import { ArenaScoresService } from './games/arena-scores.service';
import { Router, RouterModule } from '@angular/router';
import { ArtSceneComponent } from '../shared/art-scene/art-scene.component';
import { injectInWorldPanel } from '../shared/in-world-panel';
import { ARENA_GAME_EXIT } from './games/arena-game.base';
import { ARENA_GAME_ROUTES } from './games/arena-game.routes';

import { TranslationService } from '../translation.service';
import { STATION_UI, STATION_UI_I18N, type JournalRow, type StationTab } from '../shared/station-ui';
import { TRIALS_I18N } from './trials.i18n';
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
   * Where "Enter" leads, or null for a gate that is still flavour text. The
   * distinction is drawn on the card: an unplayable gate says so rather than
   * offering a button that does nothing.
   */
  route: string | null;
  /** Formatted personal best, empty when the gate has never been finished. */
  bestLabel: string;
  /** True for a playable gate the visitor has never finished — the NEW badge. */
  isNew: boolean;
  /**
   * Derived, never authored: a game inherits the tier of the egg that unlocks
   * it. That way the ladder means one thing across the whole site — a red
   * border on an arena card and a red drop toast are the same claim.
   */
  tier: EclipseRarity;
  rarity: RarityDefinition;
}

/** The registry, before tiers and progress are resolved. */
type GameSeed = Omit<ArenaGame, 'locked' | 'tier' | 'rarity' | 'route' | 'bestLabel' | 'isNew'>;

@Component({
  selector: 'app-arena',
  templateUrl: './arena.component.html',
  styleUrls: ['./arena.component.css'],
  standalone: true,
  imports: [RouterModule, ArtSceneComponent, NgComponentOutlet, ...STATION_UI]
})
export class ArenaComponent implements OnInit {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private readonly quests = inject(QuestService);
  private readonly i18n = inject(TranslationService);
  private readonly router = inject(Router);

  totalEggs = PUBLIC_CODEX_EGGS.length;
  foundCount = 0;

  // ── Station frame (shared/station-ui) ──────────────────────────────────────
  detailsOpen = false;
  /** Null until the visitor picks: Open when anything is open, else All. */
  private chosenTab: 'open' | 'all' | null = null;
  tab: 'open' | 'all' = 'all';
  stationTabs: StationTab[] = [];
  rows: JournalRow[] = [];
  pickedId: string | null = null;

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  setTab(id: string): void {
    this.chosenTab = id === 'open' ? 'open' : 'all';
    this.pickedId = null;
    this.buildStation();
  }

  /** The gate the detail pane shows: the pick, else the first in the list. */
  get gate(): ArenaGame | null {
    const visible = this.rows.map(r => this.games.find(g => g.id === r.id)).filter((g): g is ArenaGame => !!g);
    return visible.find(g => g.id === this.pickedId) ?? visible[0] ?? null;
  }

  /** The Play button's "why not", or null when the gate leads somewhere. */
  get playBlocked(): string | null {
    const g = this.gate;
    if (!g) return null;
    if (g.locked) return this.t('trials.blockedChain');
    if (!g.route) return this.t('trials.blockedForge');
    return null;
  }

  /** The pitch's first sentence for the detail line; the whole pitch is in Details. */
  firstSentence(text: string): string {
    const m = /^.*?[.!?](\s|$)/.exec(text);
    return m ? m[0].trim() : text;
  }

  /** The ONE action: walk through the gate. In the world it opens over the panel. */
  play(): void {
    const g = this.gate;
    if (!g || g.locked || !g.route) return;
    if (this.inWorld) {
      const focused = typeof document !== 'undefined' ? document.activeElement : null;
      this.openGame(g, focused instanceof HTMLElement ? focused : undefined);
    } else {
      void this.router.navigateByUrl(g.route);
    }
  }

  /** Rows and tabs, rebuilt when the ledger lands or a tab is picked — never in the template. */
  private buildStation(): void {
    const open = this.games.filter(g => !g.locked);
    this.tab = this.chosenTab ?? (open.length ? 'open' : 'all');
    this.stationTabs = [
      { id: 'open', label: this.t('trials.tab.open'), badge: open.length || null },
      { id: 'all', label: this.t('trials.tab.all') },
    ];
    const list = this.tab === 'open' ? open : this.games;
    this.rows = list.map(g => ({
      id: g.id,
      name: g.locked ? '???' : g.title,
      sub: g.locked ? this.t('trials.chained')
        : g.bestLabel ? this.t('trials.best', { s: g.bestLabel })
        : g.isNew ? this.t('trials.new')
        : g.rarity.label,
      locked: g.locked,
      ready: !g.locked && g.isNew,
    }));
  }

  private readonly scores = inject(ArenaScoresService);
  private readonly injector = inject(Injector);

  /**
   * Hosted as the Verdant Trials gate on /play. The page drops its hero copy,
   * its backdrop and every link that leaves the world, and "Enter" opens the
   * game in an overlay instead of routing to /arena/<game>.
   *
   * The overlay is `position: fixed; inset: 0`. Inside the in-world panel,
   * whose `contain: layout` makes it the containing block for fixed
   * descendants, that fills the PANEL — the game sits in the place, over the
   * gate list, with the panel's own heading and close still the frame. It is
   * never rendered on the standalone route, so routeFadeIn's transform (which
   * would pin a fixed layer to the page) never meets it.
   */
  protected readonly inWorld = injectInWorldPanel();
  /** The gate whose game is open in the in-panel overlay, if any. */
  playing: ArenaGame | null = null;
  /** The game's component once its lazy chunk (the same one its route uses) has loaded. */
  playingType: Type<unknown> | null = null;
  playingError = false;
  /** Games inside the overlay go back through this instead of routing to /world/trials. */
  readonly gameInjector = Injector.create({
    providers: [{ provide: ARENA_GAME_EXIT, useValue: () => this.closeGame() }],
    parent: this.injector,
  });
  private playSeq = 0;
  private returnFocus: HTMLElement | null = null;
  @ViewChild('playClose') private playClose?: ElementRef<HTMLButtonElement>;

  /**
   * The playable gates come first. Every entry in `ARENA_PLAYABLE` leads to a
   * real game; the ones after it are still flavour, and the card says so rather
   * than offering an "Enter" that goes nowhere.
   */
  constructor() {
    this.i18n.register(STATION_UI_I18N);
    this.i18n.register(TRIALS_I18N);
    // Field initialisers (the sealed `games` wall) have run by now, so the
    // server renders the full, all-chained list.
    this.buildStation();
  }

  private readonly seeds: GameSeed[] = ARENA_PLAYABLE.map(g => ({
    id: g.id,
    title: g.title,
    description: g.description,
    icon: g.icon,
    unlockEggId: g.unlockEggId,
    unlockHint: g.unlockHint,
  }));

  /**
   * Built once in the field initialiser so the template has real tiers to
   * render during prerender — a server-rendered card shows the right border
   * colour and the locked state, and hydration only flips what the visitor has
   * actually unlocked.
   */
  games: ArenaGame[] = this.seeds.map(seed => {
    const tier = tierForEgg(
      seed.unlockEggId,
      PUBLIC_CODEX_EGGS.find(e => e.id === seed.unlockEggId)?.rarity
    );
    return {
      ...seed,
      locked: true,
      tier,
      rarity: rarityOf(tier),
      route: playableById(seed.id)?.route ?? null,
      // Filled in on hydration. The server has no ledger to read, so a
      // prerendered card shows no score and no badge rather than a wrong one.
      bestLabel: '',
      isNew: false,
    };
  });

  async ngOnInit(): Promise<void> {
    if (!this.isBrowser) return;
    this.scores.init();
    await this.eggs.init();
    void this.eggs.trigger('trials-first');
    this.foundCount = this.eggs.foundCount;

    for (const game of this.games) {
      const playable = playableById(game.id);
      game.locked = playable
        ? !isPlayableGateOpen(playable, id => this.eggs.isFound(id))
        : !this.eggs.isFound(game.unlockEggId);

      if (!playable) continue;
      const best = this.scores.best(game.id);
      game.bestLabel = best > 0 ? formatScore(playable.scoreKind, best) : '';
      // NEW means never finished a run — and only worth saying on a gate the
      // visitor can actually walk through.
      game.isNew = !game.locked && this.scores.isNew(game.id);

      // The Arena Champion quest asks for three games *played*. Now that the
      // gates lead somewhere, a cleared run is a real signal and the quest no
      // longer has to settle for counting gates that were merely unlocked.
      if (this.scores.hasCleared(game.id)) this.quests.recordArenaGame(game.id);
    }
    this.buildStation();
  }

  /** In-world "Enter": open the gate's game in the panel overlay. Loads the route's own lazy chunk. */
  openGame(game: ArenaGame, trigger?: HTMLElement): void {
    if (!game.route || game.locked) return;
    const route = ARENA_GAME_ROUTES.find(r => `/${r.path}` === game.route);
    if (!route?.loadComponent) return;
    const seq = ++this.playSeq;
    this.returnFocus = trigger ?? null;
    this.playing = game;
    this.playingType = null;
    this.playingError = false;
    setTimeout(() => this.playClose?.nativeElement.focus());
    Promise.resolve(route.loadComponent() as Promise<Type<unknown>>).then(type => {
      if (seq === this.playSeq) this.playingType = type;
    }).catch(() => {
      if (seq === this.playSeq) this.playingError = true;
    });
  }

  closeGame(): void {
    if (!this.playing) return;
    this.playSeq++;
    this.playing = null;
    this.playingType = null;
    this.playingError = false;
    const back = this.returnFocus;
    this.returnFocus = null;
    setTimeout(() => back?.focus());
  }

  /**
   * Escape closes the game, not the whole place. Document runs before the
   * side-scroller's window listener, which leaves a defaultPrevented Escape alone.
   */
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.playing && event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      this.closeGame();
    }
  }

  /** Playable gates, for the count in the hero. */
  get playableCount(): number {
    return this.games.filter(g => g.route).length;
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
