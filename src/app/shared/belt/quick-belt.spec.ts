import { TestBed } from '@angular/core/testing';
import { InventoryService } from '../rpg/inventory.service';
import { SoundService } from '../sound/sound.service';
import { defaultSound, coerceSound, mergeSound } from '../sound/sound-settings.model';
import { resolveBindings } from '../keys/keymap.model';
import { materialDisplay } from '../rpg/material-catalog';
import { QUICK_ACTIONS, QUICK_SLOTS, assignBelt, cleanBelt, slotFor } from './quick-belt-slots';
import { BELT_MATRIX, beltUseOf } from './quick-belt.model';
import { QuickBeltService } from './quick-belt.service';

/**
 * The verb matrix's "Belt / hotkey" column (docs/design/verb-matrix.md), walked cell by cell: every kind that should
 * work goes on a slot by its id, shows how many are held, greys at none, and fills again when more arrive; a kind with
 * no use there is refused. The owner's report (2026-11-02): cooked fish would not go on a hotkey.
 */
describe('quick belt: every usable stack on a hotkey (verb matrix "Belt / hotkey")', () => {
  let held: Map<string, number>;
  let saved: ReturnType<typeof defaultSound>;
  beforeEach(() => {
    held = new Map();
    saved = defaultSound();
    TestBed.configureTestingModule({
      providers: [
        { provide: InventoryService, useValue: { stackOf: (id: string) => held.get(id) ?? 0, init: () => undefined } },
        { provide: SoundService, useValue: { get settings() { return saved; }, setBelt: (b: (string | null)[]) => { saved = { ...saved, belt: cleanBelt(b), updatedAt: saved.updatedAt + 1 }; } } },
      ],
    });
  });

  for (const row of BELT_MATRIX) {
    for (const id of row.ids) {
      if (row.use) {
        it(`${row.kind}: ${id} goes on a hotkey, ${row.use}s from it, shows its count, greys at none and fills again`, () => {
          const belt = TestBed.inject(QuickBeltService);
          expect(beltUseOf(id)).withContext(id).toBe(row.use);
          // A real thing with a name and a picture (what the slot draws).
          expect(materialDisplay(id)?.name ?? '').withContext(`${id} has a name`).not.toBe('');
          held.set(id, 4);
          const i = belt.put(id);
          expect(i).toBe(0);
          let slot = belt.slots(k => ({ art: k, name: k }))[i];
          expect(slot.stackKey).toBe(id);
          expect(slot.use).toBe(row.use);
          expect(slot.count).toBe(4);
          expect(slot.key).toBe('9');
          // All used up: the slot keeps its kind and reads 0 (greyed), and fills again on a pickup.
          held.set(id, 0);
          slot = belt.slots(k => ({ art: k, name: k }))[i];
          expect(slot.stackKey).toBe(id);
          expect(slot.count).toBe(0);
          held.set(id, 7);
          expect(belt.slots(k => ({ art: k, name: k }))[i].count).toBe(7);
          // Dragged onto another slot: it moves there (one slot per kind).
          expect(belt.assign(2, id)).toBeTrue();
          expect(belt.belt).toEqual([null, null, id]);
        });
      } else {
        it(`${row.kind}: ${id} has no use from the belt, so no slot takes it`, () => {
          const belt = TestBed.inject(QuickBeltService);
          expect(beltUseOf(id)).withContext(id).toBeNull();
          expect(belt.fits(id)).toBeFalse();
          expect(belt.put(id)).toBe(-1);
          expect(belt.assign(0, id)).toBeFalse();
          expect(belt.belt).toEqual([null, null, null]);
        });
      }
    }
  }

  it('the owner\'s case: a cooked fish (Ash Perch, cooked) eats from its key', () => {
    const meal = BELT_MATRIX.find(r => r.use === 'eat')!.ids[0];
    expect(beltUseOf(meal)).toBe('eat');
    held.set(meal, 3);
    const belt = TestBed.inject(QuickBeltService);
    belt.assign(1, meal);
    const slot = belt.slots(k => ({ art: k, name: k }))[1];
    expect([slot.stackKey, slot.count, slot.key]).toEqual([meal, 3, '0']);
  });

  it('three slots on their own rebindable keys (9, 0, -), clear of every other default', () => {
    const b = resolveBindings({});
    expect(QUICK_ACTIONS.length).toBe(QUICK_SLOTS);
    expect(QUICK_ACTIONS.map(a => b[a])).toEqual([['Digit9'], ['Digit0'], ['Minus']]);
  });

  it('what is saved is cleaned: three slots, plain keys only, never a kind twice; a slot clears', () => {
    expect(cleanBelt(['cooked-ash-perch', 'cooked-ash-perch', 'v:main:x', 'extra'])).toEqual(['cooked-ash-perch', null, null]);
    expect(cleanBelt('nope')).toEqual([null, null, null]);
    expect(assignBelt(['a', 'b', null], 2, 'a')).toEqual([null, 'b', 'a']);
    expect(assignBelt(['a', 'b', 'c'], 1, null)).toEqual(['a', null, 'c']);
    expect(slotFor(['a', null, null], 'a')).toBe(0);
    expect(slotFor(['a', null, null], 'b')).toBe(1);
    expect(slotFor(['a', 'b', 'c'], 'd')).toBe(2);
  });

  it('the slots follow the Keeper: they ride the settings blob, and the later choice wins whole', () => {
    expect(coerceSound({ belt: ['minor-health-potion', null, 'waygate-scroll'] }).belt).toEqual(['minor-health-potion', null, 'waygate-scroll']);
    expect(coerceSound({}).belt).toEqual([null, null, null]);
    const older = { ...defaultSound(), belt: ['a', null, null], updatedAt: 5 }, newer = { ...defaultSound(), belt: [null, 'b', null], updatedAt: 9 };
    expect((mergeSound(older, newer) as ReturnType<typeof defaultSound>).belt).toEqual([null, 'b', null]);
  });
});
