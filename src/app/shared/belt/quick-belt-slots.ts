/**
 * quick-belt-slots.ts — the belt's item hotkeys as they are saved (no imports: sound-settings.model.ts is eager and
 * carries them in the settings blob beside the key bindings, so a Keeper's hotkeys follow it to every device).
 *
 * Each slot holds a satchel stack key or null. A slot keeps its kind when the last one is used: it greys out, and it
 * fills again by itself when more of that kind is picked up (the HUD reads the satchel's count each frame).
 */
/** How many item hotkeys the belt has (keys `quick1`…`quick3`, by default 9, 0 and -). */
export const QUICK_SLOTS = 3;
/** The keymap actions of the slots, in order. */
export const QUICK_ACTIONS: readonly string[] = ['quick1', 'quick2', 'quick3'];
/** A plain satchel stack key (no Vault `v:` keys, no packed `|`). */
const KEY = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Whatever was saved, as exactly QUICK_SLOTS slots: a well-formed stack key or null, never one kind twice. */
export function cleanBelt(raw: unknown): (string | null)[] {
  const out: (string | null)[] = Array.from({ length: QUICK_SLOTS }, () => null);
  if (!Array.isArray(raw)) return out;
  const seen = new Set<string>();
  for (let i = 0; i < QUICK_SLOTS; i++) {
    const v = raw[i];
    if (typeof v === 'string' && KEY.test(v) && !seen.has(v)) { out[i] = v; seen.add(v); }
  }
  return out;
}

/** Put a kind on slot `i` (null clears it). The same kind elsewhere on the belt moves here: one slot per kind. */
export function assignBelt(belt: readonly (string | null)[], i: number, key: string | null): (string | null)[] {
  const out = cleanBelt(belt);
  if (!Number.isInteger(i) || i < 0 || i >= QUICK_SLOTS) return out;
  if (key !== null && !KEY.test(key)) return out;
  for (let j = 0; j < QUICK_SLOTS; j++) if (key !== null && out[j] === key) out[j] = null;
  out[i] = key;
  return out;
}

/** The slot a card's "Put on hotkey" fills: where the kind already is, else the first empty one, else the last. */
export function slotFor(belt: readonly (string | null)[], key: string): number {
  const at = belt.indexOf(key);
  if (at >= 0) return at;
  const free = belt.indexOf(null);
  return free >= 0 ? free : QUICK_SLOTS - 1;
}
