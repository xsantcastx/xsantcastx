import { PAPER_DOLL_SLOTS, liveSlotFor } from './paper-doll.manifest';

describe('C4 paper doll manifest', () => {
  it('exposes eight slots and maps only live inventory slots', () => {
    expect(PAPER_DOLL_SLOTS.map(slot => slot.slotId)).toEqual([
      'head', 'chest', 'hands', 'weapon', 'off-hand', 'legs', 'feet', 'trinket',
    ]);
    expect(liveSlotFor('off-hand')).toBe('off-hand');
    expect(liveSlotFor('hands')).toBe('hands');
    expect(liveSlotFor('legs')).toBe('legs');
    expect(liveSlotFor('trinket')).toBe('trinket');
    expect(liveSlotFor('feet')).toBeNull();
    expect(PAPER_DOLL_SLOTS.find(slot => slot.slotId === 'weapon')?.overlay?.asset).toContain('weapon-overlay');
    expect(PAPER_DOLL_SLOTS.find(slot => slot.slotId === 'hands')?.overlay).toBeUndefined();
  });
});
