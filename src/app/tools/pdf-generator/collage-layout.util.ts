/**
 * Pattern-based editorial collage layout.
 * Shared between the PDF service (mm coordinates) and the preview renderer (CSS grid).
 */

export const COLLAGE_VCOLS = 6;
export const COLLAGE_PER_PAGE = 8;

export interface CollageCell {
  colStart: number; // 0-indexed
  rowStart: number; // 0-indexed
  colSpan: number;
  rowSpan: number;
}

export interface CollagePage {
  cells: CollageCell[];
  totalRows: number;
}

/**
 * Returns [colSpan, rowSpan] for each item in a page of `count` items.
 * Mirrors the Pandora reference generator's collagePattern().
 */
export function collagePattern(count: number): [number, number][] {
  const patterns: Record<number, [number, number][]> = {
    1: [[6, 4]],
    2: [[3, 4], [3, 4]],
    3: [[4, 4], [2, 2], [2, 2]],
    4: [[3, 3], [3, 3], [3, 3], [3, 3]],
    5: [[4, 3], [2, 2], [2, 2], [3, 2], [3, 2]],
    6: [[2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2]],
  };
  if (count <= 6) return patterns[count] ?? patterns[6];

  const p: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    if (i % 7 === 0) p.push([4, 3]);
    else if (i % 7 === 1) p.push([2, 3]);
    else if (i % 7 === 2 || i % 7 === 3) p.push([3, 2]);
    else p.push([2, 2]);
  }
  return p;
}

/** Tracks cell occupancy on a COLLAGE_VCOLS-wide virtual grid. */
class GridTracker {
  private readonly occupied = new Set<string>();
  private _maxRows = 0;

  place(colSpan: number, rowSpan: number): { col: number; row: number } {
    for (let row = 0; ; row++) {
      for (let col = 0; col <= COLLAGE_VCOLS - colSpan; col++) {
        if (this.fits(col, row, colSpan, rowSpan)) {
          this.mark(col, row, colSpan, rowSpan);
          this._maxRows = Math.max(this._maxRows, row + rowSpan);
          return { col, row };
        }
      }
    }
  }

  get totalRows(): number { return this._maxRows; }

  private fits(col: number, row: number, cs: number, rs: number): boolean {
    for (let r = row; r < row + rs; r++) {
      for (let c = col; c < col + cs; c++) {
        if (this.occupied.has(`${c},${r}`)) return false;
      }
    }
    return true;
  }

  private mark(col: number, row: number, cs: number, rs: number): void {
    for (let r = row; r < row + rs; r++) {
      for (let c = col; c < col + cs; c++) {
        this.occupied.add(`${c},${r}`);
      }
    }
  }
}

/** Builds the grid layout for a single page of `count` items. */
export function buildCollagePage(count: number): CollagePage {
  const spans = collagePattern(count);
  const tracker = new GridTracker();
  const cells: CollageCell[] = [];
  for (const [colSpan, rowSpan] of spans) {
    const { col, row } = tracker.place(colSpan, rowSpan);
    cells.push({ colStart: col, rowStart: row, colSpan, rowSpan });
  }
  return { cells, totalRows: tracker.totalRows };
}

/** Splits items into pages of COLLAGE_PER_PAGE and builds the layout for each. */
export function buildCollagePages<T>(items: T[]): { items: T[]; layout: CollagePage }[] {
  const pages: { items: T[]; layout: CollagePage }[] = [];
  let i = 0;
  while (i < items.length) {
    const pageItems = items.slice(i, i + COLLAGE_PER_PAGE);
    pages.push({ items: pageItems, layout: buildCollagePage(pageItems.length) });
    i += COLLAGE_PER_PAGE;
  }
  return pages;
}
