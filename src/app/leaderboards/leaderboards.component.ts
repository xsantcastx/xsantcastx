/**
 * leaderboards.component.ts — seven ladders, one tab strip, one highlighted row.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SSR, AND WHY EVERY BOARD IS IN THE PRERENDERED HTML
 * ─────────────────────────────────────────────────────────────────────────────
 * All seven boards are built at construction from pure data, so the prerendered
 * page contains seven complete ladders with names and scores already in them,
 * rather than an empty tab strip waiting on a bundle. The row count does not
 * change when the browser fills in the player's real score — see `buildBoard`
 * for why the player's row is present even at zero — so the table does not
 * resize under the reader on boot.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY EVERY BOARD IS IN THE DOM AND NOT JUST THE ACTIVE TAB
 * ─────────────────────────────────────────────────────────────────────────────
 * The inactive boards are rendered and hidden with `[hidden]` rather than
 * dropped with `*ngIf`. A panel gated on the active tab is simply absent from
 * the prerendered HTML, so six of the seven ladders would be invisible to a
 * crawler and to a `?board=gold` deep link on a cold cache. `[hidden]` costs
 * six extra windowed tables of markup and buys a page that is actually complete
 * when it arrives.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE HONESTY LINE
 * ─────────────────────────────────────────────────────────────────────────────
 * The page says, in the copy and not in a tooltip, that the rivals are a
 * generated ladder rather than other players. `leaderboard.model.ts` has the
 * full reasoning; the short version is that there is no cross-account table
 * behind this and implying one would be a lie the page cannot back up.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { TranslationService } from '../translation.service';
import { LeaderboardService } from '../shared/leaderboards/leaderboard.service';
import {
  LEADERBOARD_CATEGORIES,
  type BoardView,
  type LeaderboardCategory,
  type LeaderboardId,
  type LeaderboardRow,
  formatScore,
} from '../shared/leaderboards/leaderboard.model';

import { RelatedPagesComponent } from '../shared/seo/related-pages.component';
import { ART_REALMS, keeperAvatarArt, type ArtEntry } from '../shared/art/art';
import { injectInWorldPanel } from '../shared/in-world-panel';
import { STATION_UI, STATION_UI_I18N, type JournalRow, type StationTab } from '../shared/station-ui';
import { LEADERBOARDS_STATION_I18N } from './leaderboards-station.i18n';

/**
 * Where each ladder is climbed — the one button under the picked name. Plain
 * links to existing pages; nothing about scoring changes.
 */
const CLIMB_ROUTE: Readonly<Record<LeaderboardId, string>> = {
  xp: '/world',
  gold: '/sanctum',
  collection: '/codex',
  arena: '/world/arena',
  quality: '/forge/crafting',
  expeditions: '/sanctum',
  crafting: '/forge/crafting',
};

/** One rendered row, with the break flag the table draws before it. */
export interface WindowRow {
  row: LeaderboardRow;
  /** True where the window skips a stretch of ranks. */
  gapBefore: boolean;
  /** The masked Keeper beside the name. Null only if the art is missing. */
  avatar: ArtEntry | null;
}

/**
 * Which Keeper a row wears.
 *
 * The visitor is the neutral Keeper: nothing in the save records a realm
 * alignment, and the composition spec keeps realm variants for an opted-in
 * affiliation. Rivals are generated names on a ladder the page already says is
 * generated, so each wears one of the five realm variants, picked from its
 * name — deterministic, so the prerendered row and the booted row match.
 */
function avatarForRow(row: LeaderboardRow): ArtEntry | null {
  if (row.isPlayer) return keeperAvatarArt(null);
  let hash = 0;
  for (let i = 0; i < row.name.length; i++) hash = (hash * 31 + row.name.charCodeAt(i)) >>> 0;
  return keeperAvatarArt(ART_REALMS[hash % ART_REALMS.length]);
}

@Component({
  selector: 'app-leaderboards',
  standalone: true,
  imports: [RelatedPagesComponent, CommonModule, RouterModule, ...STATION_UI],
  templateUrl: './leaderboards.component.html',
  styleUrls: ['./leaderboards.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaderboardsComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly leaderboards = inject(LeaderboardService);
  private readonly i18n = inject(TranslationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  /**
   * Inside the /play panel (the Celestial town's Leaderboards board) the
   * ActivatedRoute is /play's, so the tab stays local: no `?board=` read from
   * /play's query string and no URL rewrite on select. The full-page header
   * copy, doorways and related links are dropped too — the panel names the place.
   */
  protected readonly inWorld = injectInWorldPanel();

  private readonly subs = new Subscription();

  readonly categories = LEADERBOARD_CATEGORIES;

  /**
   * Built at construction, on the server as well as in the browser.
   *
   * `LeaderboardService.board` returns an all-zero player row on the server, so
   * this is the complete ladder with the visitor last — exactly the structure
   * `ngOnInit` will re-rank in the browser.
   */
  boards: BoardView[] = LEADERBOARD_CATEGORIES.map(category => this.leaderboards.board(category, {
    xp: 0, gold: 0, collection: 0, arena: 0, quality: 0, expeditions: 0, crafting: 0,
  }));

  /**
   * The rows actually rendered, per board, with the break flags already worked
   * out. Precomputed on every rebuild rather than called from the template:
   * `window()` slices and searches, and a template method runs on every change
   * detection pass for every one of the seven boards.
   */
  windows: Record<string, WindowRow[]> = {};

  active: LeaderboardId = 'xp';

  // ── Station frame (shared/station-ui) ──────────────────────────────────────
  detailsOpen = false;
  stationTabs: StationTab[] = [];
  journal: Partial<Record<string, JournalRow[]>> = {};
  /** Picked row per board, by `rank:name`. Null → the player's own row. */
  picked: Record<string, string | null> = {};

  constructor() {
    this.i18n.register(STATION_UI_I18N);
    this.i18n.register(LEADERBOARDS_STATION_I18N);
    this.stationTabs = LEADERBOARD_CATEGORIES.map(c => ({ id: c.id, label: c.name }));
    this.rebuildWindows();
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  pickTab(id: string): void {
    this.select(id as LeaderboardId);
  }

  pickRow(id: string): void {
    this.picked = { ...this.picked, [this.active]: id };
    this.cdr.markForCheck();
  }

  /** The row the detail pane shows on the active board. */
  get pickedRow(): LeaderboardRow | null {
    const board = this.activeBoard;
    if (!board) return null;
    const id = this.picked[this.active];
    const hit = id ? (this.windows[this.active] ?? []).find(w => this.rowId(w.row) === id) : undefined;
    return hit?.row ?? board.player;
  }

  get pickedAvatar(): ArtEntry | null {
    const row = this.pickedRow;
    return row ? avatarForRow(row) : null;
  }

  get stripLabel(): string {
    const board = this.activeBoard;
    if (!board) return '';
    return this.t('lbSt.rankLabel', {
      rank: board.player.rank, total: board.rows.length,
      score: `${this.score(board.category, board.player.score)} ${board.category.unit}`,
    });
  }

  get stripHint(): string {
    const board = this.activeBoard;
    if (!board || board.toNext === null) return this.t('lbSt.first');
    return this.t('lbSt.toNext', { gap: this.score(board.category, board.toNext), name: board.nextName ?? '' });
  }

  /** 0..1 — how far up the ladder the player stands. */
  get stripProgress(): number {
    const board = this.activeBoard;
    if (!board || board.rows.length <= 1) return 1;
    return 1 - (board.player.rank - 1) / (board.rows.length - 1);
  }

  climb(): void {
    void this.router.navigateByUrl(CLIMB_ROUTE[this.active]);
  }

  private rowId(row: LeaderboardRow): string { return `${row.rank}:${row.name}`; }

  ngOnInit(): void {
    // The tab is read from the query string on the server too, so a shared
    // `?board=gold` link prerenders with that tab already selected.
    if (!this.inWorld) this.subs.add(this.route.queryParamMap.subscribe(params => {
      const requested = params.get('board') as LeaderboardId | null;
      if (requested && LEADERBOARD_CATEGORIES.some(c => c.id === requested)) {
        this.active = requested;
        this.cdr.markForCheck();
      }
    }));

    if (!this.isBrowser) return;
    this.leaderboards.init();
    this.boards = this.leaderboards.boards();
    this.rebuildWindows();
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  boardFor(id: LeaderboardId): BoardView | undefined {
    return this.boards.find(board => board.category.id === id);
  }

  get activeBoard(): BoardView | undefined { return this.boardFor(this.active); }

  score(category: LeaderboardCategory, value: number): string {
    return formatScore(category, value);
  }

  /**
   * The window of rows worth rendering around the player.
   *
   * The top ten always, then the player's own neighbourhood. Rendering all 81
   * for all 7 boards would be 567 rows in the DOM; this is 7 x ~21, which keeps
   * the prerendered HTML honest without making it enormous, and it is the same
   * shape every ladder in every game shows: the summit, a gap, and you.
   */
  private windowFor(board: BoardView): WindowRow[] {
    const rows = board.rows;
    const index = rows.indexOf(board.player);
    const picked = index < 10
      ? rows.slice(0, 10)
      : [...rows.slice(0, 10), ...rows.slice(Math.max(10, index - 5), Math.min(rows.length, index + 6))];

    return picked.map((row, i) => ({
      row,
      gapBefore: i > 0 && row.rank - picked[i - 1].rank > 1,
      avatar: avatarForRow(row),
    }));
  }

  private rebuildWindows(): void {
    const next: Record<string, WindowRow[]> = {};
    for (const board of this.boards) next[board.category.id] = this.windowFor(board);
    this.windows = next;
    const journal: Record<string, JournalRow[]> = {};
    for (const board of this.boards) {
      journal[board.category.id] = next[board.category.id].map(w => ({
        id: this.rowId(w.row),
        name: `#${w.row.rank} ${w.row.isPlayer ? this.t('lbSt.you.name') : w.row.name}`,
        art: w.avatar,
        sub: `${this.score(board.category, w.row.score)} ${board.category.unit}`,
        ready: w.row.isPlayer,
      }));
    }
    this.journal = journal;
  }

  select(id: LeaderboardId): void {
    this.active = id;
    this.cdr.markForCheck();
    if (!this.isBrowser || this.inWorld) return;
    // Replaced rather than pushed: seven tabs on one page should not fill the
    // back button with the visitor's own browsing of them.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { board: id },
      replaceUrl: true,
    });
  }

  trackCategory = (_: number, category: LeaderboardCategory) => category.id;
  trackBoard = (_: number, board: BoardView) => board.category.id;
  trackRow = (_: number, entry: WindowRow) => `${entry.row.rank}:${entry.row.name}`;
}
