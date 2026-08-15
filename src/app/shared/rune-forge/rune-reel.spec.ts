import { buildPickHand, buildReel, PICK_COUNT, reelLength, reelOffset, SLOT_FACE_PX, spinMs } from './rune-reel';
import { runeById } from './rune.model';

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

  it('lays out ten distinct backs for a pick', () => {
    const hand = buildPickHand();
    expect(hand.length).toBe(PICK_COUNT);
    expect(new Set(hand.map(slot => slot.mark)).size).toBeGreaterThan(1);
  });
});
