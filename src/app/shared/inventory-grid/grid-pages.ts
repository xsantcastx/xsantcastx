/**
 * grid-pages.ts — a 10-wide grid drawn as two 5-column pages on a portrait phone (docs/design/ui-pass-3.md §A.3).
 *
 * The data model never changes: a piece's stored cell is `row * w + col` of the one 10-wide grid
 * (docs/design/inventory-grid.md). A phone only draws columns 0–4 (page 0, "Pocket 1") or 5–9 (page 1, "Pocket 2"),
 * so a piece put at cell 7 on a desktop sits on page 1, column 2, row 0 on a phone, and a drop at page 0, column 2,
 * row 0 is stored as cell 2. Pure: specced in grid-pages.spec.ts.
 */

/** Columns on one phone page. */
export const PAGE_COLS = 5;

/** Where a stored cell lands on the phone's pages. */
export interface PageCell { page: number; col: number; row: number }

/** The page, the column on that page and the row of a stored cell in a grid `w` wide. */
export function pageOfCell(cell: number, w = 10, cols = PAGE_COLS): PageCell {
  const row = Math.floor(cell / w), x = cell % w;
  return { page: Math.floor(x / cols), col: x % cols, row };
}

/** The stored cell for a column and row on a page (the inverse of pageOfCell). */
export function cellOfPage(page: number, col: number, row: number, w = 10, cols = PAGE_COLS): number {
  return row * w + page * cols + col;
}

/** How many pages a grid `w` wide has on a phone (1 when it is no wider than a page). */
export function pageCount(w: number, cols = PAGE_COLS): number { return Math.max(1, Math.ceil(w / cols)); }

/** Does a piece at `cell` that is `pw` wide show on `page` (any of its columns on it)? */
export function onPage(cell: number, pw: number, page: number, w = 10, cols = PAGE_COLS): boolean {
  const x = cell % w, lo = page * cols, hi = lo + cols;
  return x < hi && x + pw > lo;
}

/** The phone's cell size: 64 px at most, five across the window's inner width (W − 16 − 24), whole pixels. */
export function phoneCell(viewportW: number): number { return Math.max(44, Math.min(64, Math.floor((viewportW - 16 - 24) / PAGE_COLS))); }
