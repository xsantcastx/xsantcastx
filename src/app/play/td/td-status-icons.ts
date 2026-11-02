/**
 * td-status-icons.ts — Diablo II's status icons over heads (owner 2026-11-02): small pixel badges above the Keeper,
 * party members, other Keepers and creatures for what lies on them now — poisoned, burning, chilled or slowed,
 * stunned, bleeding, cursed, shielded, the healer's mending and haste, a taunt and whose threat holds a creature.
 *
 * Where the facts come from (nothing new is simulated here):
 *  - the Keeper: the MobSystem's own clocks (`kst`, the wards, Hearthlight's mending, the meal) — `keeperStatuses`;
 *  - a creature: its Mob fields, which a room or a party host already mirrors from the room's status bitmask (M4,
 *    td-coop `watchStatuses` / `CoopMobState.st`) — `mobStatuses`;
 *  - another Keeper: its presence's `sts` word (cosmetic, `encodeStatuses` / `decodeStatuses`), which that Keeper's
 *    own screen writes from `keeperStatuses`.
 *
 * At most MAX_SHOWN badges, the rest as "+N". Each badge has a duration ring (the lit share of its frame) and blinks
 * in its last second and a half. Reduced motion: no blink and no bob. Low detail: no ring, no blink. Never drawn on
 * the minimap (only the world's fight UI calls it). Cozy palette, one dark outline, crisp pixels.
 */
import type { Mob, MobSystem } from './td-mobs';

type Ctx = CanvasRenderingContext2D;

export type StatusKind =
  | 'stun' | 'freeze' | 'root' | 'fear' | 'taunt' | 'threat'
  | 'burn' | 'poison' | 'bleed' | 'curse'
  | 'chill' | 'slow' | 'blind' | 'hush' | 'dark' | 'wet' | 'strip' | 'sunder'
  | 'shield' | 'mend' | 'haste';
/** Most telling first: what holds you, what hurts you, what slows you, then what helps you. */
export const STATUS_KINDS: readonly StatusKind[] = [
  'stun', 'freeze', 'root', 'fear', 'taunt', 'threat',
  'burn', 'poison', 'bleed', 'curse',
  'chill', 'slow', 'blind', 'hush', 'dark', 'wet', 'strip', 'sunder',
  'shield', 'mend', 'haste',
];
const RANK = new Map(STATUS_KINDS.map((k, i) => [k, i]));
/** The badges one head shows before "+N". */
export const MAX_SHOWN = 4;
/** The last seconds a badge blinks in. */
export const BLINK_SECS = 1.5;

/** One status on a head: its kind, seconds left, and the most it held (the ring's whole; 0 = no ring). */
export interface StatusShown { k: StatusKind; left: number; max: number }

/** A list in its shown order (the most telling first), one of each kind. */
export function sortStatuses(list: readonly StatusShown[]): StatusShown[] {
  const best = new Map<StatusKind, StatusShown>();
  for (const s of list) { const o = best.get(s.k); if (!o || s.left > o.left) best.set(s.k, s); }
  return [...best.values()].sort((a, b) => (RANK.get(a.k) ?? 99) - (RANK.get(b.k) ?? 99));
}

/**
 * The ring's whole for a timer: the most it has read since it last started. A timer that rises again (re-applied)
 * starts a new whole. Kept per thing and kind in a WeakMap so a creature that dies takes its memory with it.
 */
export class StatusPeaks {
  private readonly peaks = new WeakMap<object, Partial<Record<StatusKind, number>>>();
  of(who: object, k: StatusKind, left: number): number {
    let p = this.peaks.get(who);
    if (!p) { p = {}; this.peaks.set(who, p); }
    const was = p[k] ?? 0;
    // Re-applied (it rose by more than a frame's drift) or new: this is the new whole.
    const whole = left > was + .05 || was <= 0 ? left : was;
    p[k] = left > 0 ? whole : 0;
    return whole;
  }
}

const on = (v: number | undefined | null): v is number => typeof v === 'number' && v > 0;

/** The Keeper's own statuses: what creatures laid on him and what his kit and his allies laid for him. */
export function keeperStatuses(sys: MobSystem, peaks: StatusPeaks, extra: { meal?: number } = {}): StatusShown[] {
  const k = sys.kst, out: StatusShown[] = [];
  const add = (kind: StatusKind, left: number) => { if (left > 0) out.push({ k: kind, left, max: peaks.of(sys, kind, left) }); };
  add('stun', k.stun); add('freeze', k.freeze); add('root', k.root);
  add('burn', k.burn.t); add('bleed', k.bleed.t); add('poison', k.weak);
  add('curse', Math.max(sys.curseT, 0));
  add('chill', k.chill); add('blind', k.blind); add('dark', Math.max(k.dark, sys.lightCut > 0 ? .5 : 0)); add('wet', k.wet);
  add('shield', Math.max(sys.ward > 0 ? sys.wardT : 0, sys.bone > 0 ? sys.boneT : 0, sys.lampWard > 0 ? sys.lampWardT : 0, sys.lastLightT));
  add('mend', Math.max(sys.mending, extra.meal ?? 0));
  add('haste', Math.max(sys.haste, sys.rootwalkT));
  return sortStatuses(out);
}

/** A creature's statuses (its own clocks; on a member's screen, the room's word mirrored onto them). */
export function mobStatuses(m: Mob, peaks: StatusPeaks): StatusShown[] {
  const out: StatusShown[] = [];
  const add = (kind: StatusKind, left: number | undefined) => { if (on(left)) out.push({ k: kind, left, max: peaks.of(m, kind, left) }); };
  add('stun', m.stun); add('root', m.rootT); add('fear', m.fearT); add('taunt', m.taunt);
  add('burn', m.scorchT); add('bleed', m.bleedT); add('curse', m.cursed);
  add('poison', m.weak); add('chill', m.chillT); add('slow', m.slowT); add('blind', m.blindT); add('hush', m.hushT);
  add('sunder', m.sunderT);
  if (m.stripped && m.stripped.t > 0) add('strip', m.stripped.t);
  if (on(m.ward) && on(m.wardT)) add('shield', m.wardT);
  // Whose threat holds it: shown when this Keeper holds it against another (a party), so the tank sees his.
  if (m.threatOn === '' && (m.threat?.size ?? 0) > 1) out.push({ k: 'threat', left: 9, max: 0 });
  return sortStatuses(out);
}

const CODES: Readonly<Record<StatusKind, string>> = {
  stun: 'st', freeze: 'fz', root: 'ro', fear: 'fe', taunt: 'ta', threat: 'th', burn: 'bu', poison: 'po', bleed: 'bl',
  curse: 'cu', chill: 'ch', slow: 'sl', blind: 'bd', hush: 'hu', dark: 'dk', wet: 'we', strip: 'sp', sunder: 'su',
  shield: 'sh', mend: 'me', haste: 'ha',
};
const BY_CODE = new Map(Object.entries(CODES).map(([k, c]) => [c, k as StatusKind]));
/** The presence word's shape (social-server.mjs STS): two-letter codes and whole seconds. */
export const STS_PATTERN = /^(?:[a-z]{2}[0-9]{1,2})(?:,[a-z]{2}[0-9]{1,2}){0,7}$|^$/;

/**
 * A Keeper's statuses for its presence (`sts`), so the others draw them over it: "bu4,ch2" (at most 8, whole seconds,
 * capped at 99). Only kinds others need to see; the threat mark is a creature's.
 */
export function encodeStatuses(list: readonly StatusShown[]): string {
  return sortStatuses(list).filter(s => s.k !== 'threat').slice(0, 8).map(s => `${CODES[s.k]}${Math.max(1, Math.min(99, Math.ceil(s.left)))}`).join(',');
}
/** Another Keeper's presence word, read: anything malformed reads as nothing. `at` is when it was heard (s). */
export function decodeStatuses(raw: unknown): StatusShown[] {
  if (typeof raw !== 'string' || !raw || raw.length > 48 || !STS_PATTERN.test(raw)) return [];
  const out: StatusShown[] = [];
  for (const part of raw.split(',')) {
    const k = BY_CODE.get(part.slice(0, 2));
    const n = Number(part.slice(2));
    if (k && n > 0) out.push({ k, left: n, max: 0 });
  }
  return sortStatuses(out);
}

// ── The art: 7×7 glyphs, one colour and a highlight each, inside a 9×9 dark frame ──
const EDGE = '#140c1c';
const BACK = '#2a1a24';
const TONES: Readonly<Record<StatusKind, readonly [string, string]>> = {
  stun: ['#ffe36d', '#fff6c2'], freeze: ['#bfe6ff', '#ffffff'], root: ['#7fe08a', '#c8f5b8'], fear: ['#d8c0ff', '#f3eaff'],
  taunt: ['#ff6a4a', '#ffc0a8'], threat: ['#ffb347', '#ffe0a8'], burn: ['#ff8a3d', '#fff2a8'], poison: ['#8fd04a', '#d8f5a0'],
  bleed: ['#d8433a', '#ff9a8a'], curse: ['#a46be0', '#e0c4ff'], chill: ['#9fd8ff', '#e8f6ff'], slow: ['#c8a86a', '#f0dca8'],
  blind: ['#f3e7cf', '#ffffff'], hush: ['#8a94b0', '#d0d6e8'], dark: ['#6e54c8', '#b8a8f0'], wet: ['#7fc8e8', '#d8f0ff'],
  strip: ['#c8c0b0', '#f3ece0'], sunder: ['#c88a5a', '#f0c8a0'], shield: ['#e6c35a', '#fff0b0'], mend: ['#7fe08a', '#e8ffe0'],
  haste: ['#7fd8e8', '#e0faff'],
};
/** `#` the tone, `+` its highlight, anything else empty. */
const GLYPHS: Readonly<Record<StatusKind, readonly string[]>> = {
  stun:   ['...#...', '.#.#.#.', '..###..', '###+###', '..###..', '.#.#.#.', '...#...'],
  freeze: ['.#####.', '#+#####', '##+####', '###+###', '####+##', '#####+#', '.#####.'],
  root:   ['...#...', '.#.#...', '.##.#..', '..###.#', '...###.', '..#+#..', '.##.##.'],
  fear:   ['..###..', '.#####.', '##+#+##', '#######', '#######', '#.#.#.#', '.......'],
  taunt:  ['#.....#', '##...##', '.##.##.', '...#...', '..###..', '.#+++#.', '.#####.'],
  threat: ['...#...', '..#+#..', '.#...#.', '##.#.##', '.#...#.', '..#+#..', '...#...'],
  burn:   ['...#...', '..##...', '..###..', '.##+##.', '.#+++#.', '.##+##.', '..###..'],
  poison: ['...#...', '...#...', '..###..', '.##+##.', '.#+###.', '.#####.', '..###..'],
  bleed:  ['...#...', '..###..', '..###..', '.##+##.', '.#+###.', '.#####.', '..###..'],
  curse:  ['..###..', '.#####.', '#+#.#+#', '#######', '.#####.', '.#.#.#.', '.......'],
  chill:  ['...#...', '.#.#.#.', '..#+#..', '###+###', '..#+#..', '.#.#.#.', '...#...'],
  slow:   ['#######', '.#+++#.', '..#+#..', '...#...', '..#.#..', '.#+++#.', '#######'],
  blind:  ['.......', '.......', '#.....#', '.#####.', '..+.+..', '.......', '.......'],
  hush:   ['.......', '.#####.', '#.....#', '#+###+#', '#.....#', '.#####.', '.......'],
  dark:   ['..###..', '.##....', '##.....', '##..+..', '##.....', '.##....', '..###..'],
  wet:    ['...#...', '..#+#..', '.#+##..', '.#####.', '.#####.', '..###..', '.......'],
  strip:  ['.##..#.', '.#+.##.', '.#..#..', '..#..#.', '.#..+#.', '.##..#.', '.......'],
  sunder: ['.#####.', '#+#.###', '###.###', '##.#.##', '###.###', '.##.##.', '..#.#..'],
  shield: ['#######', '#+++###', '#+#####', '#######', '.#####.', '..###..', '...#...'],
  mend:   ['..###..', '..#+#..', '###+###', '#+++++#', '###+###', '..#+#..', '..###..'],
  haste:  ['#..#...', '.#..#..', '..#..#.', '...#..#', '..#..#.', '.#..#..', '#..#...'],
};

/** The 32 pixels round a 9×9 frame, clockwise from the top middle: the duration ring lights a share of them. */
const RING: readonly [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let x = 4; x <= 8; x++) out.push([x, 0]);
  for (let y = 1; y <= 8; y++) out.push([8, y]);
  for (let x = 7; x >= 0; x--) out.push([x, 8]);
  for (let y = 7; y >= 0; y--) out.push([0, y]);
  for (let x = 1; x <= 3; x++) out.push([x, 0]);
  return out;
})();

/** How many ring pixels a badge lights: its share of the whole, at least one while it holds. */
export function ringLit(s: StatusShown): number {
  if (!(s.max > 0)) return 0;
  return Math.max(1, Math.min(RING.length, Math.round(RING.length * Math.max(0, Math.min(1, s.left / s.max)))));
}
/** Is the badge in its blinking last moments (dark this frame)? */
export function blinkOff(s: StatusShown, time: number, still: boolean): boolean {
  return !still && s.max > 0 && s.left < BLINK_SECS && Math.floor(time * 6) % 2 === 1;
}

/** What one head shows: the first MAX_SHOWN, and how many more ("+N"). */
export function shownOf(list: readonly StatusShown[]): { show: StatusShown[]; more: number } {
  return { show: list.slice(0, MAX_SHOWN), more: Math.max(0, list.length - MAX_SHOWN) };
}

/**
 * Draw a row of badges centred on x with its foot at y (world px, after the caller's iso anchor). `low`: no ring and
 * no blink (Low detail); `still`: reduced motion (no blink).
 */
export function drawStatusIcons(c: Ctx, list: readonly StatusShown[], x: number, y: number, time: number, opts: { still: boolean; low: boolean; k?: number }): void {
  if (!list.length) return;
  const { show, more } = shownOf(list);
  const tag = more ? `+${more}` : '';
  const tagW = tag ? 4 * tag.length + 2 : 0;
  const w = show.length * 10 - 1 + tagW;
  // `k`: whole-pixel growth where the world is drawn small (a phone), so a badge stays readable; the foot stays at y.
  const k = Math.max(1, Math.round(opts.k ?? 1));
  if (k > 1) {
    c.save();
    c.translate(Math.round(x - (w * k) / 2), Math.round(y) - 9 * k);
    c.scale(k, k);
    drawStatusIcons(c, list, w / 2, 9, time, { ...opts, k: 1 });
    c.restore();
    return;
  }
  const X = Math.round(x - w / 2), Y = Math.round(y) - 9;
  show.forEach((s, i) => {
    const bx = X + i * 10;
    const [tone, hi] = TONES[s.k];
    c.fillStyle = EDGE; c.fillRect(bx, Y, 9, 9);
    c.fillStyle = BACK; c.fillRect(bx + 1, Y + 1, 7, 7);
    const dim = !opts.low && blinkOff(s, time, opts.still);
    c.globalAlpha = dim ? .35 : 1;
    const g = GLYPHS[s.k];
    for (let r = 0; r < 7; r++) for (let q = 0; q < 7; q++) {
      const ch = g[r][q];
      if (ch === '#' || ch === '+') { c.fillStyle = ch === '+' ? hi : tone; c.fillRect(bx + 1 + q, Y + 1 + r, 1, 1); }
    }
    c.globalAlpha = 1;
    if (!opts.low) {
      const lit = ringLit(s);
      if (lit) { c.fillStyle = tone; for (let j = 0; j < lit; j++) { const [rx, ry] = RING[j]; c.fillRect(bx + rx, Y + ry, 1, 1); } }
    }
  });
  if (tag) drawTag(c, tag, X + show.length * 10, Y + 2);
}

/** "+N" in a 3×5 pixel face (digits and the plus), outlined in the night ink. */
const DIGITS: Readonly<Record<string, readonly string[]>> = {
  '+': ['...', '.#.', '###', '.#.', '...'], '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'], '3': ['###', '..#', '.##', '..#', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'], '6': ['###', '#..', '###', '#.#', '###'], '7': ['###', '..#', '..#', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'], '9': ['###', '#.#', '###', '..#', '###'],
};
function drawTag(c: Ctx, text: string, x: number, y: number): void {
  c.fillStyle = EDGE; c.fillRect(x, y - 1, 4 * text.length + 1, 7);
  c.fillStyle = '#f3e7cf';
  [...text].forEach((ch, i) => {
    const g = DIGITS[ch];
    if (!g) return;
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r][q] === '#') c.fillRect(x + 1 + i * 4 + q, y + r, 1, 1);
  });
}
