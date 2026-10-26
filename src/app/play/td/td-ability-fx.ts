/**
 * td-ability-fx.ts — how the creatures' abilities and pack auras look (docs/design/monsters-abilities.md §1–§3;
 * the art style upgrade's AuraFx, docs/handoff/art-style.md).
 *
 * Ground layer (under every creature): an ability's tell in its element's tones, with a dark hostile edge and a
 * two-tone front closing in as the shipped breath cone does — a cone (a breath), lines (a writ, a lash, a volley, a
 * beam), rings that fall (a meteor, a blizzard's pulses, tempers, the lava cracks), a ring round the caster (a smash),
 * a stir under the prey (a burrow), a sigil on each corpse (a raise); the hostile ground that lasts (fire ground,
 * crust, ink, a web, a cloud); and each pack aura's bearer standing on its sigil disc (AuraFx's claimed floor and
 * turning rings, a pixel sigil, a dashed reach ring at 4 tiles).
 * Air layer (over them): the mote lines from a bearer to each one it blesses, a Bone Ward's circling shards, a body
 * tell's glow, and the Keeper's own statuses as small glyphs over his head.
 * Reduced motion: still rings, solid lines, no motes. All whole pixels; nothing is created per frame.
 */
import { HOSTILE_EDGE, circlePixels, conePixels, groundRing, linePixels, ringArc, type Tones } from './td-fx';
import { AuraFx, auraFrom, type AuraLook } from './td-aura';
import { castable, T, type TellTone } from './td-abilities';
import { PACK_AURA_LOOKS, PACK_AURA_REACH, type PackAuraId, type PackSigil } from './td-pack-aura';
import { mobCell, type DeathBurst, type Hazard, type Mob, type MobSystem } from './td-mobs';

type Ctx = CanvasRenderingContext2D;

/** Each tell tone's three tones (core, body, edge), from the art-bible ramps. */
export const TELL_TONES: Readonly<Record<TellTone, Tones>> = {
  ember: { core: '#fff2a8', body: '#ffb347', edge: '#e2552a' },
  frost: { core: '#ffffff', body: '#bfe6ff', edge: '#5f9ed8' },
  glass: { core: '#ffffff', body: '#8a7a9a', edge: '#2e2238' },
  water: { core: '#e8fbff', body: '#7fc8e8', edge: '#2e6a8a' },
  bone: { core: '#ffffff', body: '#e8e1cf', edge: '#a89f8a' },
  life: { core: '#e6ffe9', body: '#7fe08a', edge: '#3f8f4a' },
  ink: { core: '#d8c0ff', body: '#6e54c8', edge: '#2a1a48' },
  dust: { core: '#f4e8d0', body: '#c9b088', edge: '#7a6448' },
  parchment: { core: '#fffbe8', body: '#f3e7cf', edge: '#b89a6a' },
  gold: { core: '#fff6c8', body: '#ffd25a', edge: '#b0812a' },
  moss: { core: '#e8f8d0', body: '#9ac870', edge: '#4a7a3a' },
  shadow: { core: '#f0e0ff', body: '#b06bff', edge: '#6b3aa0' },
};
const toneOf = (t: string | undefined): Tones => TELL_TONES[(t ?? 'ember') as TellTone] ?? TELL_TONES.ember;

/** A dithered flattened disc of radius R in one or two colours, baked once (a tell's patch, a hazard's stain). */
const PATCHES = new Map<string, HTMLCanvasElement | null>();
function patch(R: number, a: string, b: string | null): HTMLCanvasElement | null {
  const key = `${R}|${a}|${b}`;
  if (PATCHES.has(key)) return PATCHES.get(key)!;
  if (typeof document === 'undefined') { PATCHES.set(key, null); return null; }
  const cv = document.createElement('canvas'); cv.width = R * 2 + 1; cv.height = R + 1;
  const g = cv.getContext('2d')!;
  for (let y = -Math.floor(R / 2); y <= Math.floor(R / 2); y++) for (let x = -R; x <= R; x++) {
    if (x * x + y * y * 4 > R * R) continue;
    if (b === null) { if (((x + y) & 1) === 0) { g.fillStyle = a; g.fillRect(x + R, y + Math.floor(R / 2), 1, 1); } continue; }
    const n = (x * 7 + y * 13) & 3;
    if (n === 3) continue;
    g.fillStyle = n === 0 ? a : b; g.fillRect(x + R, y + Math.floor(R / 2), 1, 1);
  }
  if (PATCHES.size > 96) PATCHES.clear();
  PATCHES.set(key, cv);
  return cv;
}

/** An ability ring on its way: a patch to leave (dithered inside), a dark edge, and the front closing in. */
export function drawAbilityRing(c: Ctx, b: DeathBurst, time: number, still: boolean): void {
  const tn = toneOf(b.tone), X = Math.round(b.x), Y = Math.round(b.y) - 1, R = Math.round(b.r);
  const k = Math.max(0, Math.min(1, 1 - b.t / (b.delay ?? .6))), pulse = still ? 1 : .75 + .25 * Math.sin(time * 16);
  if (b.fx) {
    // A raise's sigil (CALL_TELL): a ring and a turning five-point star over the corpse; a mend's ring, soft green.
    c.globalAlpha = .9 * pulse;
    c.fillStyle = HOSTILE_EDGE; for (const q of groundRing(R + 1)) c.fillRect(X + q.x, Y + q.y + 1, 1, 1);
    groundRing(R).forEach((q, i) => { c.fillStyle = i % 2 ? tn.edge : tn.body; c.fillRect(X + q.x, Y + q.y, 1, 1); });
    const a0 = still ? 0 : time * 2;
    for (let i = 0; i < 5; i++) {
      const a = a0 + i * Math.PI * 4 / 5, b2 = a0 + (i + 1) * Math.PI * 4 / 5;
      linePixels(Math.cos(a) * (R - 2), Math.sin(a) * (R - 2) * .5, Math.cos(b2) * (R - 2), Math.sin(b2) * (R - 2) * .5).forEach((q, j) => { c.fillStyle = j % 2 ? tn.body : tn.core; c.fillRect(X + q.x, Y + q.y, 1, 1); });
    }
    c.globalAlpha = 1;
    return;
  }
  const pt = patch(R, tn.edge, null);
  c.globalAlpha = .4;
  if (pt) c.drawImage(pt, X - R, Y - Math.floor(R / 2));
  c.globalAlpha = .65; c.fillStyle = HOSTILE_EDGE;
  for (const q of groundRing(R + 1)) c.fillRect(X + q.x, Y + q.y + 1, 1, 1);
  c.globalAlpha = .9 * pulse;
  groundRing(R).forEach((q, i) => { c.fillStyle = i % 3 ? tn.body : tn.core; c.fillRect(X + q.x, Y + q.y, 1, 1); });
  // The front: from the rim toward the middle; when it reaches it, it lands.
  const inner = Math.max(1, Math.round(R * (1 - (still ? .6 : k))));
  c.fillStyle = tn.core; c.globalAlpha = .95;
  groundRing(inner).forEach((q, i) => { if (i % 2 === 0) c.fillRect(X + q.x, Y + q.y, 1, 1); });
  // A falling thing's shadow growing in the middle (a meteor, a temper, a hail): a dark spot that swells.
  if (b.tone === 'ember' || b.tone === 'frost' || b.tone === 'ink') {
    const s = Math.max(1, Math.round(R * .35 * (still ? .6 : k)));
    c.globalAlpha = .5; c.fillStyle = HOSTILE_EDGE;
    for (let y = -s; y <= s; y++) { const w = Math.round(s * Math.sqrt(Math.max(0, 1 - (y / s) * (y / s)))); c.fillRect(X - w, Y + Math.round(y / 2), w * 2 + 1, 1); }
  }
  c.globalAlpha = 1;
}

/** A falling thing in the air over its ring (a meteor's stone with a fire tail from the upper left, hail, ink snow). */
export function drawFalling(c: Ctx, b: DeathBurst, time: number, still: boolean): void {
  if (b.fx || !(b.tone === 'ember' || b.tone === 'frost' || b.tone === 'ink') || still) return;
  const k = Math.max(0, Math.min(1, 1 - b.t / (b.delay ?? .6)));
  if (k < .45) return;
  const tn = toneOf(b.tone), f = (k - .45) / .55, X = Math.round(b.x - 40 * (1 - f)), Y = Math.round(b.y - 70 * (1 - f));
  if (b.tone === 'ember') {
    for (let i = 1; i <= 6; i++) { c.globalAlpha = .7 - i * .1; c.fillStyle = i < 3 ? tn.core : i < 5 ? tn.body : tn.edge; c.fillRect(X - i * 3, Y - i * 5, 2, 2); }
    c.globalAlpha = 1; c.fillStyle = HOSTILE_EDGE; c.fillRect(X - 3, Y - 3, 6, 6);
    c.fillStyle = '#5a4440'; c.fillRect(X - 2, Y - 2, 4, 4); c.fillStyle = tn.body; c.fillRect(X - 2, Y - 2, 2, 1);
  } else {
    for (let i = 0; i < 5; i++) { const sx = X + ((i * 13 + Math.floor(time * 7)) % 22) - 11 + 40 * (1 - f), sy = Y + ((i * 7) % 12); c.globalAlpha = .8; c.fillStyle = i % 2 ? tn.core : tn.body; c.fillRect(sx, sy, 1, 2); }
  }
  c.globalAlpha = 1;
}

/** A patch of hostile ground: a dithered stain in its tone, its edge in the deeper one, fading at the end. */
export function drawHazard(c: Ctx, h: Hazard, time: number, still: boolean): void {
  const tn = toneOf(h.tone), X = Math.round(h.x), Y = Math.round(h.y) - 1, R = Math.max(2, Math.round(h.r));
  const fade = Math.min(1, h.t / .8, (h.life - h.t) / .2 + .2), flick = still ? 1 : .85 + .15 * Math.sin(time * 5 + h.x);
  const pt = patch(R, tn.body, tn.edge);
  c.globalAlpha = .38 * fade * flick;
  if (pt) c.drawImage(pt, X - R, Y - Math.floor(R / 2));
  c.globalAlpha = .6 * fade;
  groundRing(R).forEach((q, i) => { if (i % 3 === 0) { c.fillStyle = tn.core; c.fillRect(X + q.x, Y + q.y, 1, 1); } });
  c.globalAlpha = 1;
}

/** The tell of a creature casting (its ability's `kind`): a cone, lines, a lane, a body glow. */
export function drawCastTell(c: Ctx, m: Mob, time: number, still: boolean): void {
  if (!(m.tell > 0) || m.abCast === undefined) return;
  const beat = still ? 1 : Math.floor(time * 8) % 2 ? 1 : .7;
  if (m.abCast === -1 && m.aim) {
    // Brutal: a red arc on the ground in front of it.
    const ax = Math.round(m.aim.x), ay = Math.round(m.aim.y + 12), a = Math.atan2(ay - m.y, ax - m.x);
    c.globalAlpha = .9 * beat;
    c.fillStyle = HOSTILE_EDGE; for (const q of ringArc(15, a, .9)) c.fillRect(Math.round(m.x) + q.x, Math.round(m.y) + Math.round(q.y * .6) + 1, 1, 1);
    c.fillStyle = '#c2402a'; for (const q of ringArc(14, a, .9)) c.fillRect(Math.round(m.x) + q.x, Math.round(m.y) + Math.round(q.y * .6), 1, 1);
    c.fillStyle = '#ff8a6a'; for (const q of ringArc(12, a, .6)) c.fillRect(Math.round(m.x) + q.x, Math.round(m.y) + Math.round(q.y * .6), 1, 1);
    c.globalAlpha = 1;
    return;
  }
  const a = castable(m.def.id)[m.abCast];
  if (!a || !m.aim) return;
  const tn = toneOf(a.tone), ox = Math.round(m.x), oy = Math.round(m.y - 2), ax = m.aim.x, ay = m.aim.y + 12;
  const k = still ? .7 : Math.max(0, Math.min(1, 1 - m.tell / Math.max(.3, a.tell))), dir = Math.atan2(ay - oy, ax - ox);
  if (a.kind === 'wave') {
    const len = (a.r ?? 3) * T, half = (a.spread ?? 25) * Math.PI / 180, cone = conePixels(len, half, dir), fr = Math.max(4, Math.round(k * len));
    for (const q of cone.fill) { const near = q.x * q.x + q.y * q.y < fr * fr; c.globalAlpha = (near ? .6 : .32) * beat; c.fillStyle = near ? tn.body : tn.edge; c.fillRect(ox + q.x, oy + q.y, 1, 1); }
    c.globalAlpha = .9 * beat;
    for (const q of cone.edge) { c.fillStyle = HOSTILE_EDGE; c.fillRect(ox + q.x, oy + q.y + 1, 1, 1); }
    cone.edge.forEach((q, i) => { c.fillStyle = i % 3 ? tn.edge : tn.body; c.fillRect(ox + q.x, oy + q.y, 1, 1); });
    c.fillStyle = tn.core; for (const q of ringArc(fr, dir, half * .8)) c.fillRect(ox + q.x, oy + q.y, 1, 1);
  } else if (a.kind === 'line' || a.kind === 'fan' || a.kind === 'spit') {
    const n = a.kind === 'fan' ? a.n ?? 3 : 1, step = (a.spread ?? 15) * Math.PI / 180, len = (a.kind === 'line' ? a.reach + .5 : a.r ?? a.reach) * T;
    for (let i = 0; i < n; i++) {
      const aa = dir + (i - (n - 1) / 2) * step, ex = ox + Math.cos(aa) * len, ey = oy + Math.sin(aa) * len;
      const pts = linePixels(ox, oy, ex, ey), front = Math.round(k * pts.length), wide = a.kind === 'line' ? Math.max(1, Math.round((a.r ?? .5) * T / 3)) : 0;
      pts.forEach((q, j) => {
        if (a.kind === 'spit' && j % 3) return;
        const lit = j < front;
        for (let o = -wide; o <= wide; o++) {
          if (o && (j + o) % 2) continue;
          const vx = Math.abs(ey - oy) > Math.abs(ex - ox) ? o : 0, vy = vx ? 0 : o;
          c.globalAlpha = (lit ? .75 : .35) * beat;
          c.fillStyle = HOSTILE_EDGE; c.fillRect(ox + q.x + vx, oy + q.y + vy + 1, 1, 1);
          c.fillStyle = lit ? (o ? tn.body : tn.core) : tn.edge; c.fillRect(ox + q.x + vx, oy + q.y + vy, 1, 1);
        }
      });
    }
  } else if (a.kind === 'burrow') {
    // The stir where it will rise (the ring is the burst's); here the ground breaks a little at its own feet.
    for (const q of groundRing(6)) if ((q.x + q.y + Math.floor(time * 6)) % 3 === 0) { c.globalAlpha = .7; c.fillStyle = tn.body; c.fillRect(ox + q.x, oy + q.y, 1, 1); }
  }
  c.globalAlpha = 1;
}

/** A body tell (a 0.4 s glow and its words): the caster's outline lit in its tone, and a ring at its feet. */
export function drawBodyTell(c: Ctx, m: Mob, time: number, still: boolean): void {
  if (!(m.tell > 0) || m.abCast === undefined || m.abCast < 0) return;
  const a = castable(m.def.id)[m.abCast];
  if (!a || (a.ground && a.kind !== 'raise' && a.kind !== 'smash' && a.kind !== 'mend')) return;
  const tn = toneOf(a.tone), cell = mobCell(m.def), X = Math.round(m.x), top = Math.round(m.y - cell.h), pulse = still ? 1 : .6 + .4 * Math.sin(time * 20);
  c.globalAlpha = .75 * pulse;
  for (const q of circlePixels(Math.round(Math.max(cell.w, cell.h) * .5) + 1)) if ((q.x + q.y) % 2 === 0) { c.fillStyle = (q.x & 2) ? tn.core : tn.body; c.fillRect(X + q.x, Math.round(top + cell.h / 2) + q.y, 1, 1); }
  c.globalAlpha = 1;
}

/** A Bone Ward on it: four bone shards circling at its middle. A mirror's copy: a faint grey frame. */
export function drawMobS6Air(c: Ctx, m: Mob, time: number, still: boolean): void {
  const cell = mobCell(m.def), X = Math.round(m.x), mid = Math.round(m.y - cell.h / 2);
  if ((m.ward ?? 0) > 0) {
    const r = Math.round(cell.w * .55) + 3, a0 = still ? 0 : time * 2.4;
    for (let i = 0; i < 4; i++) {
      const a = a0 + i * Math.PI / 2, x = X + Math.round(Math.cos(a) * r), y = mid + Math.round(Math.sin(a) * r * .5);
      c.fillStyle = HOSTILE_EDGE; c.fillRect(x - 1, y, 4, 2);
      c.fillStyle = '#e8e1cf'; c.fillRect(x - 1, y, 3, 1); c.fillStyle = '#ffffff'; c.fillRect(x, y, 1, 1);
    }
  }
}

/** One bearer's look (AuraFx's, from the aura's tones), cached per aura. */
const LOOKS = new Map<PackAuraId, AuraLook>();
export function packLook(id: PackAuraId): AuraLook {
  let l = LOOKS.get(id);
  if (!l) { const p = PACK_AURA_LOOKS[id]; l = auraFrom(p.tones, p.dark, id === 'lightless' ? .7 : 1.05, 18, id !== 'lightless'); LOOKS.set(id, l); }
  return l;
}

/** A 7×7 pixel sigil per aura (drawn ×2 on the disc): a fist, an eye, a broken shield, a wing… */
const SIGILS: Readonly<Record<PackSigil, readonly string[]>> = {
  fist: ['.###...', '#####..', '######.', '######.', '.#####.', '..###..', '..###..'],
  eye: ['.......', '..###..', '.#...#.', '#..#..#', '.#...#.', '..###..', '...#...'],
  shield: ['#######', '#..#..#', '#..#..#', '.#.#.#.', '.#..#..', '..#.#..', '...#...'],
  wing: ['#......', '##.....', '###....', '####...', '.#####.', '..#####', '....###'],
  flame: ['...#...', '..##...', '..###..', '.#####.', '.##.##.', '###.###', '.#####.'],
  flake: ['...#...', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '...#...'],
  bolt: ['....##.', '...##..', '..##...', '.#####.', '...##..', '..##...', '.##....'],
  spin: ['..###..', '.#...#.', '#..#...', '#.###.#', '...#..#', '.#...#.', '..###..'],
  hand: ['.#.#.#.', '.#.#.#.', '.#####.', '#######', '.#####.', '..###..', '..###..'],
  gust: ['####...', '....#..', '######.', '.......', '#####..', '.....#.', '###.#..'],
  thorn: ['#..#..#', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '#..#..#'],
  void: ['..###..', '.#...#.', '#.....#', '#..#..#', '#.....#', '.#...#.', '..###..'],
  cant: ['#.#.##.', '##..#.#', '#.#.##.', '.......', '.##.#.#', '#...###', '.##.#.#'],
};

/** Every bearer's AuraFx (motes), kept while it lives. */
const FX = new WeakMap<Mob, AuraFx>();

/**
 * The pack auras on the ground (§3): each bearer on its sigil disc (AuraFx's floor and rings, smaller than a
 * Keeper's), its sigil turning a step every 0.5 s, the dashed reach ring at 4 tiles. Lightless: a black disc.
 */
export function drawPackGround(c: Ctx, mobs: readonly Mob[], time: number, still: boolean, near: (x: number, y: number) => boolean, low = false): void {
  for (const m of mobs) {
    if (!m.aura || (m.hidden ?? 0) > 0 || !near(m.x, m.y)) continue;
    const look = packLook(m.aura), p = PACK_AURA_LOOKS[m.aura], X = Math.round(m.x), Y = Math.round(m.y) - 1;
    let fx = FX.get(m);
    if (!fx) { fx = new AuraFx(); FX.set(m, fx); }
    // Environment detail Low (td-detail): no motes and no claimed floor, only the sigil and its reach.
    fx.step(time, look, still || low);
    if (m.aura === 'lightless') {
      // A black disc, its rim a ring of dark pixels; inside, the ground is simply gone.
      c.globalAlpha = .7; c.fillStyle = p.dark;
      for (let y = -7; y <= 7; y++) { const w = Math.round(15 * Math.sqrt(Math.max(0, 1 - (y / 7.5) * (y / 7.5)))); c.fillRect(X - w, Y + y, w * 2 + 1, 1); }
      c.globalAlpha = .9;
      groundRing(15).forEach((q, i) => { c.fillStyle = i % 2 ? HOSTILE_EDGE : p.tones.core; c.fillRect(X + q.x, Y + q.y, 1, 1); });
    } else if (!low) fx.ground(c, X, Y, look, time, still);
    // The sigil: 7×7 grown ×2, turning one step every half second (a mirror flip on odd steps).
    const rows = SIGILS[p.sigil], flip = !still && Math.floor(time * 2) % 2 === 1;
    c.globalAlpha = .9;
    for (let r = 0; r < 7; r++) for (let q = 0; q < 7; q++) {
      if (rows[r][flip ? 6 - q : q] !== '#') continue;
      const sx = X - 7 + q * 2, sy = Y - 3 + Math.round(r * 1.1);
      c.fillStyle = HOSTILE_EDGE; c.fillRect(sx + 1, sy + 1, 2, 1);
      c.fillStyle = r < 2 ? p.tones.core : p.tones.body; c.fillRect(sx, sy, 2, 1);
    }
    // The reach: a dashed ring at 4 tiles, flattened (3/4 view), turning slowly.
    const turn = still ? 0 : Math.floor(time * 4);
    c.globalAlpha = .55;
    groundRing(PACK_AURA_REACH).forEach((q, i) => { if ((i + turn) % 8 >= 4) return; c.fillStyle = HOSTILE_EDGE; c.fillRect(X + q.x, Y + q.y + 1, 1, 1); c.fillStyle = p.tones.edge; c.fillRect(X + q.x, Y + q.y, 1, 1); });
    c.globalAlpha = 1;
  }
}

/** Over the creatures: the bearers' motes, and the linked mote lines to each blessed one (three motes travelling). */
export function drawPackAir(c: Ctx, mobs: readonly Mob[], time: number, still: boolean, near: (x: number, y: number) => boolean, low = false): void {
  if (low) still = true;
  for (const m of mobs) {
    if (m.aura && near(m.x, m.y)) { const fx = FX.get(m); if (fx) fx.air(c, m.x, m.y - 1, packLook(m.aura)); }
    const b = m.bless;
    if (!b || b.by === m || !near(m.x, m.y)) continue;
    const tn = PACK_AURA_LOOKS[b.id].tones, x0 = b.by.x, y0 = b.by.y - mobCell(b.by.def).h * .4, x1 = m.x, y1 = m.y - mobCell(m.def).h * .4;
    const pts = linePixels(Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1));
    if (pts.length < 6) continue;
    // A thin line, dotted; reduced motion: solid, and no motes.
    // A thin line in the aura's tone, a dark pixel under each lit one so it reads on bright grass.
    const ox = Math.round(x0) - pts[0].x, oy = Math.round(y0) - pts[0].y;
    pts.forEach((q, i) => {
      if (!still && i % 2) return;
      c.globalAlpha = .45; c.fillStyle = HOSTILE_EDGE; c.fillRect(ox + q.x, oy + q.y + 1, 1, 1);
      c.globalAlpha = still ? .7 : .6; c.fillStyle = i % 4 ? tn.edge : tn.body; c.fillRect(ox + q.x, oy + q.y, 1, 1);
    });
    if (!still) {
      c.globalAlpha = .95;
      for (let j = 0; j < 3; j++) {
        const t = ((time * .8 + j / 3 + (m.hx % 7) / 7) % 1), q = pts[Math.min(pts.length - 1, Math.floor(t * pts.length))];
        const px = Math.round(x0) + q.x - pts[0].x, py = Math.round(y0) + q.y - pts[0].y;
        if (b.id === 'lightless') { c.fillStyle = HOSTILE_EDGE; c.fillRect(px - 1, py, 3, 1); c.fillRect(px, py - 1, 1, 3); continue; }
        c.fillStyle = tn.body; c.fillRect(px - 1, py, 3, 1); c.fillRect(px, py - 1, 1, 3); c.fillStyle = tn.core; c.fillRect(px, py, 1, 1);
      }
    }
    c.globalAlpha = 1;
  }
}

/** A blessed creature's pip beside its life bar (the shipped mark pip's size): a 3×3 in the aura's body tone. */
export function drawAuraPip(c: Ctx, m: Mob, barX: number, barY: number): void {
  const id = m.aura ?? m.bless?.id;
  if (!id) return;
  const tn = PACK_AURA_LOOKS[id].tones;
  c.fillStyle = HOSTILE_EDGE; c.fillRect(barX - 1, barY - 1, 5, 5);
  c.fillStyle = tn.body; c.fillRect(barX, barY, 3, 3); c.fillStyle = tn.core; c.fillRect(barX, barY, 1, 1);
}

/** The Keeper's statuses as glyphs over his head: stars (stunned), ice (frozen), vines (rooted), frost, flame, drop… */
export function drawKeeperStatus(c: Ctx, sys: MobSystem, x: number, y: number, time: number, still: boolean): void {
  const k = sys.kst, list: [string, string][] = [];
  if (k.stun > 0) list.push(['stun', '#ffe36d']);
  if (k.freeze > 0) list.push(['freeze', '#bfe6ff']);
  if (k.root > 0) list.push(['root', '#7fe08a']);
  if (k.chill > 0) list.push(['chill', '#9fd8ff']);
  if (k.burn.t > 0) list.push(['burn', '#ff8a3d']);
  if (k.bleed.t > 0) list.push(['bleed', '#8a4b3a']);
  if (k.blind > 0) list.push(['blind', '#f3e7cf']);
  if (k.wet > 0) list.push(['wet', '#7fc8e8']);
  if (k.weak > 0) list.push(['weak', '#9ac870']);
  if (k.dark > 0 || sys.lightCut > 0) list.push(['dark', '#6e54c8']);
  if (!list.length) return;
  const X = Math.round(x) - list.length * 4 + 2, Y = Math.round(y);
  list.forEach(([s, col], i) => {
    const px = X + i * 8, bob = still ? 0 : Math.round(Math.sin(time * 4 + i));
    c.fillStyle = HOSTILE_EDGE; c.fillRect(px - 1, Y - 1 + bob, 7, 7);
    c.fillStyle = col;
    if (s === 'stun') { const a = still ? 0 : Math.floor(time * 8) % 2; c.fillRect(px + 2, Y + bob, 1, 5); c.fillRect(px, Y + 2 + bob, 5, 1); if (a) { c.fillRect(px + 1, Y + 1 + bob, 1, 1); c.fillRect(px + 3, Y + 3 + bob, 1, 1); } }
    else if (s === 'root') { c.fillRect(px, Y + 4 + bob, 5, 1); c.fillRect(px + 1, Y + 1 + bob, 1, 3); c.fillRect(px + 3, Y + bob, 1, 4); }
    else if (s === 'burn') { c.fillRect(px + 1, Y + 2 + bob, 3, 3); c.fillRect(px + 2, Y + bob, 1, 2); c.fillStyle = '#fff2a8'; c.fillRect(px + 2, Y + 3 + bob, 1, 1); }
    else if (s === 'bleed') { c.fillRect(px + 2, Y + bob, 1, 1); c.fillRect(px + 1, Y + 1 + bob, 3, 3); c.fillRect(px + 2, Y + 4 + bob, 1, 1); }
    else if (s === 'wet') { c.fillRect(px + 2, Y + bob, 1, 2); c.fillRect(px + 1, Y + 2 + bob, 3, 3); }
    else { c.fillRect(px, Y + bob, 5, 5); c.fillStyle = HOSTILE_EDGE; c.fillRect(px + 1, Y + 1 + bob, 3, 3); c.fillStyle = col; c.fillRect(px + 2, Y + 2 + bob, 1, 1); }
  });
}
