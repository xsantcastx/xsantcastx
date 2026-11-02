/**
 * QuickBeltService — the belt's item hotkeys (quick-belt-slots.ts holds what is saved, quick-belt.model.ts what each
 * kind does). The slots ride in the settings blob (SoundService, through the gateway), beside the key bindings.
 *
 * The service only says what is where and how many are held; the play view does the use itself (the same path as the
 * item card's one action), so a hotkey and a card can never disagree.
 */
import { Injectable, inject } from '@angular/core';
import { SoundService } from '../sound/sound.service';
import { InventoryService } from '../rpg/inventory.service';
import { KeymapService } from '../keys/keymap.service';
import { QUICK_ACTIONS, QUICK_SLOTS, assignBelt, cleanBelt, slotFor } from './quick-belt-slots';
import { beltUseOf, type QuickSlot } from './quick-belt.model';

@Injectable({ providedIn: 'root' })
export class QuickBeltService {
  private readonly sound = inject(SoundService);
  private readonly inventory = inject(InventoryService);
  private readonly keymap = inject(KeymapService);

  /** The saved slots (a kind or null each). */
  get belt(): (string | null)[] { return cleanBelt(this.sound.settings.belt); }
  /** Can this kind go on the belt (it has a use from there)? */
  fits(stackKey: string | null | undefined): boolean { return !!beltUseOf(stackKey); }
  /** Put a kind on slot `i` (moving it from any other slot). False: it has no use from the belt. */
  assign(i: number, stackKey: string): boolean {
    if (!this.fits(stackKey) || i < 0 || i >= QUICK_SLOTS) return false;
    this.sound.setBelt(assignBelt(this.belt, i, stackKey));
    return true;
  }
  /** The card's "Put on hotkey": where it already is, else the first empty slot, else the last. Returns the slot. */
  put(stackKey: string): number {
    if (!this.fits(stackKey)) return -1;
    const i = slotFor(this.belt, stackKey);
    this.assign(i, stackKey);
    return i;
  }
  /** Take a slot off the belt. */
  clear(i: number): void { this.sound.setBelt(assignBelt(this.belt, i, null)); }
  /** The slot a kind sits on, or -1. */
  slotOf(stackKey: string): number { return this.belt.indexOf(stackKey); }
  /** The slots as the HUD draws them (`art` and `name` from the caller's catalogue). */
  slots(look: (stackKey: string) => { art: string; name: string }): QuickSlot[] {
    return this.belt.map((stackKey, i) => {
      const action = QUICK_ACTIONS[i];
      const l = stackKey ? look(stackKey) : { art: '', name: '' };
      return { i, action, key: this.keymap.cap(action), stackKey, use: beltUseOf(stackKey), count: stackKey ? this.inventory.stackOf(stackKey) : 0, art: l.art, name: l.name };
    });
  }
}
