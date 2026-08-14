import { PAPER_DOLL_SLOTS, liveSlotFor } from './paper-doll.manifest';

describe('C4 paper doll manifest', () => {
  it('exposes eight slots and maps only live inventory slots', () => {
    expect(PAPER_DOLL_SLOTS.map(slot => slot.slotId)).toEqual([
      'head', 'chest', 'hands', 'weapon', 'off-hand', 'legs', 'feet', 'trinket',
    ]);
    expect(liveSlotFor('off-hand')).toBe('offhand');
    expect(liveSlotFor('hands')).toBeNull();
    expect(liveSlotFor('trinket')).toBeNull();
    expect(PAPER_DOLL_SLOTS.every(slot => !('overlay' in slot))).toBe(true);
  });
});
