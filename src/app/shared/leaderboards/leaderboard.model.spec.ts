/**
 * leaderboard.model.spec.ts — the ladder that has to be the same ladder twice.
 *
 * The invariants worth a test are the ones that make a board obviously fake or
 * quietly unwinnable: a rival field that changes between two calls (which would
 * also break prerender), a summit the player cannot pass, a row count that
 * moves with the player's score, and a rank that disagrees with the ordering.
 */
import {
  LEADERBOARD_CATEGORIES,
  RIVAL_COUNT,
  RIVAL_NAMES,
  buildBoard,
  compact,
  formatScore,
  leaderboardCategory,
  rivalsFor,
} from './leaderboard.model';

const XP = leaderboardCategory('xp')!;

describe('LEADERBOARD_CATEGORIES', () => {
  it('has seven boards with unique ids', () => {
    expect(LEADERBOARD_CATEGORIES.length).toBe(7);
    expect(new Set(LEADERBOARD_CATEGORIES.map(c => c.id)).size).toBe(7);
  });

  it('gives every board a summit, a curve and a palette entry', () => {
    for (const category of LEADERBOARD_CATEGORIES) {
      expect(category.summit).toBeGreaterThan(0);
      expect(category.curve).toBeGreaterThan(1);
      expect(category.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(category.glow).toContain('rgba(');
    }
  });

  it('keeps the two percentage boards under 100', () => {
    for (const id of ['collection', 'quality'] as const) {
      expect(leaderboardCategory(id)!.summit).toBeLessThanOrEqual(100);
    }
  });

  it('has enough authored names to fill a board', () => {
    expect(RIVAL_NAMES.length).toBeGreaterThanOrEqual(RIVAL_COUNT);
    expect(new Set(RIVAL_NAMES).size).toBe(RIVAL_NAMES.length);
  });
});

describe('rivalsFor', () => {
  it('is the same field every time it is asked', () => {
    // The load-bearing one: a field that differs between two calls also differs
    // between the prerendered HTML and the hydrated DOM.
    for (const category of LEADERBOARD_CATEGORIES) {
      expect(rivalsFor(category)).toEqual(rivalsFor(category));
    }
  });

  it('fills the board with distinct names', () => {
    for (const category of LEADERBOARD_CATEGORIES) {
      const rows = rivalsFor(category);
      expect(rows.length).toBe(RIVAL_COUNT);
      expect(new Set(rows.map(r => r.name)).size).toBe(RIVAL_COUNT);
    }
  });

  it('sorts best first and never scores a rival at zero', () => {
    for (const category of LEADERBOARD_CATEGORIES) {
      const rows = rivalsFor(category);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].score).toBeLessThanOrEqual(rows[i - 1].score);
      }
      expect(rows[rows.length - 1].score).toBeGreaterThan(0);
    }
  });

  it('never renders a percentage rival as 0.0%', () => {
    // The bug this pins: `summit x weight^curve` puts the last name on a
    // percentage board at 0.02%, which rounds to "0.0%" on the page. The
    // authored floor is what lifts the tail.
    for (const category of LEADERBOARD_CATEGORIES) {
      if (category.format !== 'percent') continue;
      for (const row of rivalsFor(category)) {
        expect(Number(row.score.toFixed(1)))
          .withContext(`${category.id} / ${row.name}`)
          .toBeGreaterThan(0);
      }
    }
  });

  it('keeps the top rival at or under the authored summit', () => {
    for (const category of LEADERBOARD_CATEGORIES) {
      expect(rivalsFor(category)[0].score).toBeLessThanOrEqual(category.summit);
    }
  });

  it('gives different boards different orders', () => {
    // A shared seed would make all seven the same list with different numbers,
    // which reads as one ladder wearing seven hats.
    const xp = rivalsFor(leaderboardCategory('xp')!).map(r => r.name);
    const gold = rivalsFor(leaderboardCategory('gold')!).map(r => r.name);
    expect(xp).not.toEqual(gold);
  });
});

describe('buildBoard', () => {
  it('renders the same row count whatever the player scores', () => {
    // This is what makes the page prerenderable: the server builds the board
    // with a zero score and the browser rebuilds it with the real one.
    for (const score of [0, 1, 5_000, 480_000, 10_000_000]) {
      expect(buildBoard(XP, score, 'You', '').rows.length).toBe(RIVAL_COUNT + 1);
    }
  });

  it('marks exactly one row as the player', () => {
    const board = buildBoard(XP, 12_000, 'You', 'Keeper');
    expect(board.rows.filter(r => r.isPlayer).length).toBe(1);
    expect(board.player.isPlayer).toBeTrue();
    expect(board.rows).toContain(board.player);
  });

  it('numbers the ranks in order with no gaps', () => {
    const board = buildBoard(XP, 12_000, 'You', '');
    board.rows.forEach((row, index) => expect(row.rank).toBe(index + 1));
  });

  it('puts a zero-score player last and a summit-beating player first', () => {
    expect(buildBoard(XP, 0, 'You', '').player.rank).toBe(RIVAL_COUNT + 1);

    const champion = buildBoard(XP, XP.summit * 2, 'You', '');
    expect(champion.player.rank).toBe(1);
    expect(champion.toNext).toBeNull();
    expect(champion.nextName).toBeNull();
  });

  it('is reachable — passing the top rival is enough for #1', () => {
    const top = rivalsFor(XP)[0].score;
    expect(buildBoard(XP, top, 'You', '').player.rank).toBe(1);
  });

  it('climbs monotonically as the score climbs', () => {
    let last = Number.POSITIVE_INFINITY;
    for (const score of [0, 100, 1_000, 10_000, 100_000, 480_000]) {
      const rank = buildBoard(XP, score, 'You', '').player.rank;
      expect(rank).toBeLessThanOrEqual(last);
      last = rank;
    }
  });

  it('reports the gap to the name directly above', () => {
    const board = buildBoard(XP, 5_000, 'You', '');
    const index = board.rows.indexOf(board.player);
    expect(index).toBeGreaterThan(0);
    expect(board.nextName).toBe(board.rows[index - 1].name);
    expect(board.toNext).toBe(board.rows[index - 1].score - board.player.score);
  });

  it('ignores a nonsense score instead of ranking on NaN', () => {
    for (const junk of [NaN, -50, Infinity]) {
      const board = buildBoard(XP, junk as number, 'You', '');
      expect(Number.isFinite(board.player.score)).toBeTrue();
      expect(board.player.score).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('formatting', () => {
  it('compacts the way the currency rail already writes Gold', () => {
    expect(compact(0)).toBe('0');
    expect(compact(940)).toBe('940');
    expect(compact(12_400)).toBe('12.4K');
    expect(compact(1_240_000)).toBe('1.24M');
    expect(compact(3_500_000_000)).toBe('3.50B');
  });

  it('writes percentages with one decimal and integers with separators', () => {
    expect(formatScore(leaderboardCategory('collection')!, 42.44)).toBe('42.4%');
    expect(formatScore(leaderboardCategory('arena')!, 1234)).toBe('1,234');
  });
});
