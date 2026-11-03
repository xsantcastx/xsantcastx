import { cellOfPage, onPage, pageCount, pageOfCell, phoneCell } from './grid-pages';

describe('grid-pages (the phone draws the 10-wide grid as two 5-column pages)', () => {
  it('a piece at cell 7 sits on page 2 (index 1), column 2, row 0', () => {
    expect(pageOfCell(7)).toEqual({ page: 1, col: 2, row: 0 });
  });

  it('page 1, column 2, row 0 is stored as cell 2', () => {
    expect(cellOfPage(0, 2, 0)).toBe(2);
  });

  it('every cell of a 10 × 11 grid maps to a page and back', () => {
    for (let cell = 0; cell < 110; cell++) {
      const p = pageOfCell(cell);
      expect(p.page).toBeLessThan(2);
      expect(p.col).toBeLessThan(5);
      expect(cellOfPage(p.page, p.col, p.row)).toBe(cell);
    }
  });

  it('row 3, column 9 is page 2, column 4', () => {
    expect(pageOfCell(39)).toEqual({ page: 1, col: 4, row: 3 });
    expect(cellOfPage(1, 4, 3)).toBe(39);
  });

  it('a 10-wide grid has two pages; a 5-wide one has one', () => {
    expect(pageCount(10)).toBe(2);
    expect(pageCount(5)).toBe(1);
  });

  it('a piece shows on the page its columns are on', () => {
    expect(onPage(4, 1, 0)).toBeTrue();
    expect(onPage(4, 1, 1)).toBeFalse();
    expect(onPage(5, 1, 1)).toBeTrue();
    expect(onPage(4, 2, 1)).toBeTrue(); // a two-wide piece straddling the seam shows on both
  });

  it('the phone cell is 64 px at 360, 390 and 412 wide, never under 44', () => {
    expect(phoneCell(360)).toBe(64);
    expect(phoneCell(390)).toBe(64);
    expect(phoneCell(412)).toBe(64);
    expect(phoneCell(300)).toBe(52);
    expect(phoneCell(200)).toBe(44);
  });
});
