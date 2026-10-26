/**
 * keymap.model.ts — every key the game answers to, in one table.
 *
 * Each action has default key codes (KeyboardEvent.code, so a key keeps its place on any layout) and up to two keys
 * at a time. The player's changes are stored as sparse overrides (`{ action: [codes] }`) inside the sound/settings
 * blob (sound-settings.model.ts, saved through the gateway), so the bindings follow the Keeper to every device.
 * Overrides are validated on load: an unknown action, a malformed code or a clash between two actions falls back to
 * the defaults for that part, never to a broken keyboard.
 *
 * Escape is not an action: it always closes the topmost window, or opens the Menu when nothing is open.
 * No imports: sound-settings.model.ts (eager) imports this.
 */
export type KeyGroup = 'move' | 'combat' | 'world' | 'windows';
export const KEY_GROUPS: readonly KeyGroup[] = ['move', 'combat', 'world', 'windows'];

export interface KeyActionDef { readonly id: string; readonly group: KeyGroup; readonly codes: readonly string[] }

/** The most keys one action may hold. */
export const MAX_KEYS = 2;

export const KEY_ACTIONS: readonly KeyActionDef[] = [
  { id: 'up', group: 'move', codes: ['KeyW', 'ArrowUp'] },
  { id: 'down', group: 'move', codes: ['KeyS', 'ArrowDown'] },
  { id: 'left', group: 'move', codes: ['KeyA', 'ArrowLeft'] },
  { id: 'right', group: 'move', codes: ['KeyD', 'ArrowRight'] },
  { id: 'attack', group: 'combat', codes: ['KeyJ', 'Space'] },
  { id: 'skill1', group: 'combat', codes: ['Digit1'] },
  { id: 'skill2', group: 'combat', codes: ['Digit2'] },
  { id: 'skill3', group: 'combat', codes: ['Digit3'] },
  { id: 'skill4', group: 'combat', codes: ['Digit4'] },
  { id: 'skill5', group: 'combat', codes: ['Digit5'] },
  { id: 'skill6', group: 'combat', codes: ['Digit6'] },
  { id: 'skill7', group: 'combat', codes: ['Digit7'] },
  { id: 'skill8', group: 'combat', codes: ['Digit8'] },
  { id: 'target', group: 'combat', codes: ['Tab'] },
  { id: 'potionHealth', group: 'combat', codes: ['KeyQ'] },
  { id: 'potionMana', group: 'combat', codes: ['KeyR'] },
  { id: 'stone', group: 'combat', codes: ['KeyF'] },
  { id: 'waygate', group: 'combat', codes: ['KeyV'] },
  { id: 'seek', group: 'combat', codes: ['KeyX'] },
  { id: 'interact', group: 'world', codes: ['KeyE'] },
  // D2-style looting (owner 2026-10-26): only Gold is taken by walking over it; this takes the nearest piece in reach.
  { id: 'pickup', group: 'world', codes: ['KeyN'] },
  { id: 'chat', group: 'world', codes: ['Enter'] },
  { id: 'map', group: 'world', codes: ['KeyM'] },
  { id: 'hearth', group: 'world', codes: ['KeyH'] },
  { id: 'plates', group: 'world', codes: ['KeyZ'] },
  { id: 'bag', group: 'windows', codes: ['KeyI'] },
  { id: 'sheet', group: 'windows', codes: ['KeyC'] },
  { id: 'spellbook', group: 'windows', codes: ['KeyK'] },
  { id: 'bestiary', group: 'windows', codes: ['KeyB'] },
  { id: 'lore', group: 'windows', codes: ['KeyL'] },
  { id: 'friends', group: 'windows', codes: ['KeyG'] },
  { id: 'party', group: 'windows', codes: ['KeyY'] },
  { id: 'trade', group: 'windows', codes: ['KeyT'] },
  { id: 'options', group: 'windows', codes: ['KeyO', 'F2'] },
  { id: 'slate', group: 'windows', codes: ['KeyP'] },
];

export type Bindings = Record<string, string[]>;
/** What is saved: only the actions the player changed. */
export type KeyOverrides = Record<string, string[]>;

const KNOWN = new Set(KEY_ACTIONS.map(a => a.id));
const CODE = /^[A-Za-z][A-Za-z0-9]{0,15}$/;
/** Keys that cannot be bound: Escape is the Menu's, modifiers are not keys, the rest belong to the browser or the OS. */
const NEVER = new Set(['Escape', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight', 'ContextMenu', 'CapsLock', 'NumLock', 'ScrollLock', 'Pause', 'PrintScreen', 'F1', 'F5', 'F11', 'F12', 'Unidentified', 'Dead', 'Power', 'Fn']);

export function isBindable(code: unknown): code is string { return typeof code === 'string' && CODE.test(code) && !NEVER.has(code); }

export function defaultBindings(): Bindings {
  const out: Bindings = {};
  for (const a of KEY_ACTIONS) out[a.id] = [...a.codes];
  return out;
}

/** A structural clean of whatever was saved (no knowledge of clashes): known actions only, 0..2 well-formed codes each. */
export function cleanOverrides(raw: unknown): KeyOverrides {
  const out: KeyOverrides = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!KNOWN.has(id) || !Array.isArray(v) || v.length > MAX_KEYS || !v.every(isBindable)) continue;
    out[id] = [...new Set(v as string[])];
  }
  return out;
}

/** Defaults overlaid with the saved overrides; when the result has one key on two actions the whole overlay is dropped. */
export function resolveBindings(raw: unknown): Bindings {
  const out = { ...defaultBindings(), ...cleanOverrides(raw) };
  const seen = new Set<string>();
  for (const codes of Object.values(out)) for (const c of codes) {
    if (seen.has(c)) return defaultBindings();
    seen.add(c);
  }
  return out;
}

/** The sparse form to save: only what differs from the defaults. */
export function toOverrides(b: Bindings): KeyOverrides {
  const out: KeyOverrides = {};
  for (const a of KEY_ACTIONS) {
    const cur = b[a.id] ?? [];
    if (cur.length !== a.codes.length || cur.some((c, i) => c !== a.codes[i])) out[a.id] = [...cur];
  }
  return out;
}

/** The action a code is bound to (the first), or null. */
export function actionFor(b: Bindings, code: string): string | null {
  for (const a of KEY_ACTIONS) if (b[a.id]?.includes(code)) return a.id;
  return null;
}

export type Resolution = 'swap' | 'clear';

export interface RebindResult { readonly bindings: Bindings; readonly conflict: string | null }

/**
 * Put `code` on `action` in `slot` (0 or 1; a slot past the end appends). A clash with another action is reported and
 * nothing changes, unless a resolution is given: 'swap' hands the other action the key this slot held, 'clear'
 * strips the key from the other action.
 */
export function rebind(b: Bindings, action: string, slot: number, code: string, how?: Resolution): RebindResult {
  if (!KNOWN.has(action) || !isBindable(code)) return { bindings: b, conflict: null };
  const other = actionFor({ ...b, [action]: [] }, code);
  const mine = [...(b[action] ?? [])];
  const old = mine[slot];
  if (other && !how) return { bindings: b, conflict: other };
  const next: Bindings = { ...b };
  if (other && how === 'swap') next[other] = old ? (b[other] ?? []).map(c => (c === code ? old : c)) : (b[other] ?? []).filter(c => c !== code);
  else if (other) next[other] = (b[other] ?? []).filter(c => c !== code);
  const keep = mine.filter((c, i) => i !== slot && c !== code);
  const at = Math.min(slot, keep.length);
  keep.splice(at, 0, code);
  next[action] = keep.slice(0, MAX_KEYS);
  return { bindings: next, conflict: null };
}

/** Take one key off an action. */
export function unbind(b: Bindings, action: string, slot: number): Bindings {
  if (!KNOWN.has(action)) return b;
  return { ...b, [action]: (b[action] ?? []).filter((_, i) => i !== slot) };
}

const NAMED: Readonly<Record<string, string>> = {
  Space: 'Space', Enter: 'Enter', Tab: 'Tab', Backspace: 'Bksp', Delete: 'Del', Insert: 'Ins', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Backquote: '`', Backslash: '\\', Comma: ',', Period: '.', Slash: '/',
  NumpadEnter: 'Num ⏎', NumpadAdd: 'Num +', NumpadSubtract: 'Num -', NumpadMultiply: 'Num *', NumpadDivide: 'Num /', NumpadDecimal: 'Num .',
};

/** The text on a keycap for a code: `KeyI` → I, `Digit1` → 1, `ArrowUp` → ↑. */
export function codeLabel(code: string): string {
  if (NAMED[code]) return NAMED[code];
  const key = /^Key([A-Z])$/.exec(code); if (key) return key[1];
  const digit = /^Digit([0-9])$/.exec(code); if (digit) return digit[1];
  const pad = /^Numpad([0-9])$/.exec(code); if (pad) return `Num ${pad[1]}`;
  return code;
}
