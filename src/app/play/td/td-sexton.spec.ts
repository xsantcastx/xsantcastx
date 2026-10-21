/**
 * td-sexton.spec.ts — the Sexton's Count in the top-down world: Barrow Door 1 is rock to everyone until it is opened,
 * the vault holds the Uncounted behind it, the page only shows in the dark, and every step's place is where the Seek
 * points.
 */
import { HandLevel } from './td-level';
import { BARROW_DOOR_ID, HUSHED_BARROW_1 } from './maps/hushed-barrow';
import { BARROW_AT, SEXTON_PAGE, SEXTON_STONES, VAULT_GRAVE, VAULT_KEYHOLE, VAULT_UNCOUNTED, pageShown, seekSpot } from './td-sexton';
import { NIGHTROADS, onNook } from './td-dark';
import { MOBS } from './td-mobs';
import { SEXTON_STEPS } from '../../shared/sexton/sexton-count.model';

describe('td-sexton: the Hushed Barrow and its vault', () => {
  it('Barrow Door 1 is shut to everyone until opened, then floor; the Uncounted waits behind it', () => {
    const lv = new HandLevel(HUSHED_BARROW_1);
    expect(lv.doors).toEqual([BARROW_DOOR_ID]);
    const doorRow = HUSHED_BARROW_1.rows.findIndex(r => r.includes('|'));
    const cols = [...HUSHED_BARROW_1.rows[doorRow]].map((ch, c) => ch === '|' ? c : -1).filter(c => c >= 0);
    expect(cols.length).toBe(3);
    for (const c of cols) expect(lv.walkable(c, doorRow)).withContext(`shut ${c}`).toBeFalse();
    // The keyhole stands on the near side, the grave and the Uncounted on the far side.
    expect(VAULT_KEYHOLE.r).toBeLessThan(doorRow);
    expect(VAULT_GRAVE.r).toBeGreaterThan(doorRow);
    expect(VAULT_UNCOUNTED.r).toBeGreaterThan(doorRow);
    expect(MOBS['the-uncounted']?.rank).toBe('boss');
    expect(lv.open(BARROW_DOOR_ID)).toBeTrue();
    expect(lv.open(BARROW_DOOR_ID)).toBeFalse();
    for (const c of cols) expect(lv.walkable(c, doorRow)).withContext(`open ${c}`).toBeTrue();
    expect(lv.open('no-such-door')).toBeFalse();
  });

  it('the three stones are graves of the plot; the page lies on the barrow\'s jetty-nook, shown only in the dark', () => {
    for (const s of SEXTON_STONES) expect(Math.max(Math.abs(s.c - BARROW_AT.c), Math.abs(s.r - BARROW_AT.r))).toBeLessThanOrEqual(5);
    const barrowRoad = NIGHTROADS.find(n => n.id === 'barrow')!;
    expect(onNook(barrowRoad.continent, SEXTON_PAGE.c, SEXTON_PAGE.r)).toBeTrue();
    expect([SEXTON_PAGE.c, SEXTON_PAGE.r]).not.toEqual([barrowRoad.note[0], barrowRoad.note[1]]);
    expect(pageShown('page', 'night')).toBeTrue();
    expect(pageShown('page', 'eclipse')).toBeTrue();
    expect(pageShown('page', 'day')).toBeFalse();
    expect(pageShown('page', 'dusk')).toBeFalse();
    expect(pageShown('key', 'night')).toBeFalse();
  });

  it('every step under way has a place for the Seek (Wren is found among the keepers); none before or after', () => {
    for (const step of SEXTON_STEPS) {
      const s = seekSpot(step);
      if (step === 'offer' || step === 'done') expect(s).withContext(step).toBeNull();
      else if (step === 'return') expect(s).withContext(step).toEqual({ target: 'wren', spot: null });
      else expect(s?.spot).withContext(step).toBeTruthy();
    }
    expect(seekSpot('door')?.spot?.level).toBe('hushed-barrow-1');
    expect(seekSpot('stones')?.spot?.level).toBeNull();
  });
});
