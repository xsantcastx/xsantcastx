import { AUTO_ROLLS, buildReel, reelLength, reelOffset, SLOT_FACE_PX, spinMs } from './rune-reel';
import { runeById, STRIKE_COST } from './rune.model';

describe('anvil reel', () => {
  it('ends on the winning rune and never repeats the winner mid-strip', () => {
    const ash = runeById('ash')!;
    const reel = buildReel(ash, 8, () => 0);
    expect(reel.length).toBe(8);
    expect(reel[reel.length - 1].id).toBe('ash');
    expect(reel.slice(0, -1).some(face => face.id === 'ash')).toBe(false);
  });

  it('spins longer and farther for the rare end of the ladder', () => {
    expect(reelLength('common')).toBeLessThan(reelLength('mythic'));
    expect(spinMs('common')).toBeLessThan(spinMs('singular'));
    expect(reelOffset(16)).toBe(-15 * SLOT_FACE_PX);
  });

  it('prices Auto ×10 as ten full strikes', () => {
    expect(AUTO_ROLLS).toBe(10);
    expect(AUTO_ROLLS * STRIKE_COST).toBe(100_000);
  });
});
