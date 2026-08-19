/**
 * paper-doll.manifest.spec.ts — the eight loadout wells.
 *
 * (Was `equipment-panel.component.spec.ts`, which tested this file rather than
 * the component its name claimed; `EquipmentPanelComponent` still has no test.)
 */
import { PAPER_DOLL_SLOTS, PAPER_DOLL_SRC, liveSlotFor } from './paper-doll.manifest';

describe('paper doll manifest', () => {
  it('exposes eight slots and maps only live inventory slots', () => {
    expect(PAPER_DOLL_SLOTS.map(slot => slot.slotId).sort()).toEqual([
      'chest', 'feet', 'hands', 'head', 'legs', 'off-hand', 'trinket', 'weapon',
    ]);
    expect(liveSlotFor('off-hand')).toBe('off-hand');
    expect(liveSlotFor('hands')).toBe('hands');
    expect(liveSlotFor('legs')).toBe('legs');
    expect(liveSlotFor('trinket')).toBe('trinket');
    expect(liveSlotFor('feet')).toBeNull();
  });

  /*
   * The four overlays this used to assert on were full-canvas *item* renders,
   * not body-aligned layers — the Keeper occupies 23-80% of the frame and the
   * chest render spanned 8-95%, so compositing one at frame size buried the
   * character. They were removed rather than repositioned, because the fix is
   * new art, not new numbers. Restoring any overlay means authoring a cut-out
   * against PAPER_DOLL_SRC and giving it real x/y/width/height.
   */
  it('carries no overlay until body-aligned art exists', () => {
    expect(PAPER_DOLL_SLOTS.filter(slot => slot.overlay)).toEqual([]);
  });

  /*
   * The old paper-doll master had an opaque near-white card painted behind the
   * figure and rendered as a bright rectangle on a dark page. `sips -g hasAlpha`
   * called it transparent because the channel existed; it was simply filled.
   */
  it('stands on the cut-out Keeper, not the carded one', () => {
    expect(PAPER_DOLL_SRC).toContain('keeper-base');
    expect(PAPER_DOLL_SRC).not.toContain('paper-doll/');
  });

  it('keeps every control inside the frame', () => {
    for (const slot of PAPER_DOLL_SLOTS) {
      expect(slot.control.x).toBeGreaterThanOrEqual(0);
      expect(slot.control.x).toBeLessThanOrEqual(100);
      expect(slot.control.y).toBeGreaterThanOrEqual(0);
      expect(slot.control.y).toBeLessThanOrEqual(100);
    }
  });

  /* Two flanking columns; nothing sits over the Keeper's centre line. */
  it('keeps the centre clear except for head and feet', () => {
    const overCentre = PAPER_DOLL_SLOTS
      .filter(slot => slot.control.x > 30 && slot.control.x < 70)
      .map(slot => slot.slotId);
    expect(overCentre.sort()).toEqual(['feet', 'head']);
  });
});
