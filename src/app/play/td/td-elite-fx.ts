/**
 * td-elite-fx.ts — how an elite pack looks (docs/design/effects-spec.md; design-bible §5.7).
 *
 * Pixel only, whole art pixels, every foe effect with the hostile dark edge (#140c1c):
 *  - ground (under creatures): the pack's aura — a flattened dithered ring under each member, blue for a champion,
 *    gold for a unique leader; the Cold Aura's reach as a turning frost ring; Fire Enchanted's death-burst ring;
 *  - body: a champion is tinted blue (≤ 25 %), a unique leader a breath of gold;
 *  - air (over it): one small tell per affix, 2–4 pixels each, never more than a handful round one creature;
 *  - the plate: the leader's name (blue / gold), its affixes under it in small pixel text, and a framed life bar
 *    (a champion's blue frame, a unique's gold frame with corner studs) — ordinary creatures keep the plain bar.
 * Reduced motion: the same shapes, still.
 */
import { AFFIX_DEFS, COLD_AURA_R, ELITE_TONES, TELEPORT, TOUCHED_TONES, affixLine, isTouched, type EliteAffix } from './td-elites';
import { mobCell, type DeathBurst, type Mob } from './td-mobs';
import { FX, HOSTILE_EDGE, circlePixels, groundRing, ringDash } from './td-fx';

type Ctx = CanvasRenderingContext2D;

/** The ring under a pack member: as wide as its stance, rank-toned, a dark pixel under each lit one. */
export function drawEliteGround(c: Ctx, m: Mob, time: number, still: boolean): void {
  const tag = m.elite;
  if (!tag) return;
  const X = Math.round(m.x), Y = Math.round(m.y) - 1;
  if (tag.role !== 'minion') {
    const tn = ELITE_TONES[tag.rank], r = Math.max(6, Math.min(16, Math.round(mobCell(m.def).w / 3)));
    const pts = groundRing(r), shift = still ? 0 : Math.floor(time * 6);
    c.globalAlpha = .55; c.fillStyle = HOSTILE_EDGE;
    for (const q of groundRing(r + 1)) c.fillRect(X + q.x, Y + q.y, 1, 1);
    c.globalAlpha = .8;
    pts.forEach((q, i) => { if ((i + shift) % 3 === 2) return; c.fillStyle = (i + shift) % 6 < 3 ? tn.body : tn.core; c.fillRect(X + q.x, Y + q.y, 1, 1); });
  }
  if (tag.affixes.includes('cold-aura')) {
    // Its reach on the ground: a frost ring turning slowly, dark-edged (the Keeper's step slows inside it).
    const turn = still ? 0 : time / 14, ry = .55;
    for (const q of ringDash(COLD_AURA_R, turn, 8, 4)) {
      const x = X + q.x, y = Y + Math.round(q.y * ry);
      c.globalAlpha = .5; c.fillStyle = HOSTILE_EDGE; c.fillRect(x, y + 1, 1, 1);
      c.globalAlpha = .7; c.fillStyle = q.tone ? FX.cold.body : FX.cold.core; c.fillRect(x, y, 1, 1);
    }
  }
  c.globalAlpha = 1;
}

/** Fire Enchanted's burst on its way: a hostile ember ring at its reach, tightening as the burst nears. */
export function drawBurstTell(c: Ctx, b: DeathBurst, delay: number, time: number, still: boolean): void {
  // A boss's ground warning (the Seam Eater's Rend) carries its own tell and tone; a Fire Enchanted burst is ember.
  const X = Math.round(b.x), Y = Math.round(b.y) - 1, k = Math.max(0, Math.min(1, 1 - b.t / (b.delay ?? delay)));
  const tn = b.el === 'shadow' ? FX.shadow : FX.ember;
  const pulse = still ? 1 : .7 + .3 * Math.sin(time * 18);
  // A boss's ring is a patch of ground to leave: its inside dithered in the edge tone, so it reads on lit grass too.
  if (b.el === 'shadow') {
    c.globalAlpha = .45; c.fillStyle = tn.edge;
    for (let y = -b.r; y <= b.r; y++) for (let x = -b.r; x <= b.r; x++) if (((x + y) & 1) === 0 && x * x + y * y <= b.r * b.r) c.fillRect(X + x, Y + Math.round(y * .55), 1, 1);
  }
  c.globalAlpha = .6; c.fillStyle = HOSTILE_EDGE;
  for (const q of circlePixels(b.r + 1)) c.fillRect(X + q.x, Y + Math.round(q.y * .55), 1, 1);
  c.globalAlpha = .85 * pulse;
  circlePixels(b.r).forEach((q, i) => { if (i % 2) return; c.fillStyle = i % 4 ? tn.body : tn.edge; c.fillRect(X + q.x, Y + Math.round(q.y * .55), 1, 1); });
  // The front closing in: when it reaches the middle, the fire (or the void) goes off.
  const inner = Math.max(2, Math.round(b.r * (1 - k)));
  c.fillStyle = tn.core;
  circlePixels(inner).forEach((q, i) => { if (i % 3 === 0) c.fillRect(X + q.x, Y + Math.round(q.y * .55), 1, 1); });
  c.globalAlpha = 1;
}

/** The body's tint, drawn inside drawMob's transform over the sprite (source-atop). */
export function eliteTint(m: Mob): { color: string; alpha: number } | null {
  const tag = m.elite;
  if (!tag || tag.role === 'minion') return null;
  // Eclipse-touched: the body goes dusk-violet, as if the eclipse stood in front of it too.
  if (isTouched(tag)) return { color: TOUCHED_TONES.edge, alpha: .3 };
  return tag.rank === 'champion' ? { color: ELITE_TONES.champion.body, alpha: .22 } : { color: ELITE_TONES.unique.body, alpha: .12 };
}

/** A pixel with its dark edge pixel just under-right (a foe's effect). */
function hpx(c: Ctx, x: number, y: number, col: string): void {
  c.fillStyle = HOSTILE_EDGE; c.fillRect(x + 1, y + 1, 1, 1);
  c.fillStyle = col; c.fillRect(x, y, 1, 1);
}

/** Each affix's small tell, in the air round the creature (world coordinates). */
export function drawAffixTells(c: Ctx, m: Mob, time: number, still: boolean): void {
  const tag = m.elite;
  if (!tag || !tag.affixes.length) return;
  const X = Math.round(m.x), top = Math.round(m.y - mobCell(m.def).h), mid = Math.round(m.y - mobCell(m.def).h / 2), w = mobCell(m.def).w, t = still ? .3 : time;
  const seed = (m.hx * 7 + m.hy * 13) % 11;
  c.globalAlpha = .9;
  for (const a of tag.affixes) {
    const col = AFFIX_DEFS[a].color;
    switch (a as EliteAffix) {
      case 'extra-strong': {
        // Two red embers of strength at the shoulders, breathing.
        if (still || Math.sin(t * 5 + seed) > -.4) { hpx(c, X - Math.round(w * .3), mid - 4, col); hpx(c, X + Math.round(w * .3), mid - 4, col); }
        break;
      }
      case 'extra-fast': {
        // Pale streaks trailing behind it.
        const back = -m.face, n = still ? 1 : Math.floor(t * 10) % 3;
        for (let i = 0; i < 3; i++) hpx(c, X + back * (Math.round(w / 2) + 2 + i * 2 + n), mid + i * 3 - 3, col);
        break;
      }
      case 'stone-skin': {
        // Grey stone flecks set in its outline.
        for (const [fx, fy] of [[-.4, .3], [.35, .55], [-.2, .8], [.42, .15]] as const) hpx(c, X + Math.round(fx * w), top + Math.round(fy * mobCell(m.def).h), col);
        break;
      }
      case 'cursed': {
        // Violet motes rising off its head.
        for (let i = 0; i < 3; i++) { const k = ((t * .8 + i / 3 + seed / 11) % 1); hpx(c, X - 4 + i * 4, top - 2 - Math.round(k * 8), k > .66 ? FX.shadow.edge : col); }
        break;
      }
      case 'fire-enchanted': {
        // Ember flickers licking at its feet.
        for (let i = 0; i < 3; i++) { const k = ((t * 1.6 + i * .37 + seed) % 1); hpx(c, X - Math.round(w * .3) + i * Math.round(w * .3), Math.round(m.y) - 2 - Math.round(k * 5), k < .4 ? FX.ember.core : k < .75 ? col : FX.ember.edge); }
        break;
      }
      case 'cold-aura': {
        // Frost flakes drifting round it (its reach is the ring on the ground).
        for (let i = 0; i < 3; i++) { const a2 = t * .9 + i * 2.1; hpx(c, X + Math.round(Math.cos(a2) * (w / 2 + 3)), mid + Math.round(Math.sin(a2) * 5), i % 2 ? FX.cold.core : col); }
        break;
      }
      case 'spectral-hit': {
        // A pip over its head that never keeps one colour.
        const tones = [FX.ember.body, FX.cold.body, '#ffe36d', '#b49cff'], k = Math.floor(t * 2.5) % tones.length;
        hpx(c, X - 1, top - 4, tones[k]); hpx(c, X, top - 4, tones[k]); hpx(c, X, top - 5, col);
        break;
      }
      case 'mana-burn': {
        // Cyan motes drawn in toward it (it drinks mana).
        for (let i = 0; i < 3; i++) { const k = 1 - ((t * .9 + i / 3) % 1), a2 = i * 2.1 + seed; hpx(c, X + Math.round(Math.cos(a2) * (4 + k * 10)), mid + Math.round(Math.sin(a2) * (3 + k * 6)), col); }
        break;
      }
      case 'teleport': {
        // A violet flicker at its edges; while it winds up a blink, a column of violet pixels takes it.
        const blink = (m.blinkT ?? 0) > 0;
        if (blink) {
          const k = 1 - (m.blinkT ?? 0) / TELEPORT.tell;
          for (let y = 0; y < mobCell(m.def).h; y += 2) if ((y + Math.floor(t * 20)) % 4 < 2 || still) hpx(c, X + ((y >> 1) % 2 ? -1 : 1) * Math.round(w * .3 * (1 - k)), top + y, y % 4 ? col : FX.shadow.core);
          if (m.blinkTo) { const bx = Math.round(m.blinkTo.x), by = Math.round(m.blinkTo.y); for (const q of groundRing(5)) if ((q.x + q.y) % 2 === 0) hpx(c, bx + q.x, by + q.y, col); }
        } else if (still || Math.sin(t * 7 + seed) > .5) hpx(c, X + (Math.floor(t * 3) % 2 ? -1 : 1) * Math.round(w / 2), mid - 2, col);
        break;
      }
      case 'eclipse-touched': {
        // The dark corona (design-bible §5.7): a ring of eclipse-dark pixels round its body, a pale 1-pixel corona just
        // outside it, a few violet flares turning slowly round the rim. Reduced motion: the same ring, still.
        const cy = mid, r = Math.max(8, Math.round(Math.max(w, mobCell(m.def).h) * .5) + 2), turn = still ? 0 : t * .5;
        c.globalAlpha = .55; c.fillStyle = TOUCHED_TONES.dark;
        for (const q of circlePixels(r)) c.fillRect(X + q.x, cy + q.y, 1, 1);
        c.globalAlpha = .85;
        circlePixels(r + 1).forEach((q, i) => { if (i % 2) return; c.fillStyle = col; c.fillRect(X + q.x, cy + q.y, 1, 1); });
        for (let i = 0; i < 4; i++) {
          const a2 = turn + i * Math.PI / 2, fx = X + Math.round(Math.cos(a2) * (r + 2)), fy = cy + Math.round(Math.sin(a2) * (r + 2));
          hpx(c, fx, fy, TOUCHED_TONES.glow);
        }
        c.globalAlpha = .9;
        break;
      }
      case 'lightning-enchanted': {
        // A spark jumping round it.
        const k = Math.floor(t * 8 + seed) % 4, sx = X + [-1, 1, 1, -1][k] * Math.round(w * .35), sy = mid + [-6, -2, 4, 1][k];
        hpx(c, sx, sy, col); hpx(c, sx + 1, sy - 1, '#ffffff'); hpx(c, sx - 1, sy + 1, col);
        break;
      }
    }
  }
  c.globalAlpha = 1;
}

/**
 * An elite's plate over its head, from the bar up: the framed life bar, then (leaders only) the affixes in small
 * pixel text, then the name. Returns nothing; draws in world coordinates (textAlign center, baseline bottom).
 */
export function drawElitePlate(c: Ctx, m: Mob, targeted: boolean): void {
  const tag = m.elite!;
  const tn = ELITE_TONES[tag.rank], X = Math.round(m.x), top = Math.round(m.y - mobCell(m.def).h - 4);
  const w = tag.role === 'leader' ? 26 : 22, frac = Math.max(0, m.hp / m.def.hp), x0 = X - Math.round(w / 2);
  // The frame: dark outline, a rank-toned frame, dark inside, the life itself; a unique's corners carry studs.
  c.fillStyle = HOSTILE_EDGE; c.fillRect(x0 - 2, top - 2, w + 4, 6);
  c.fillStyle = tn.edge; c.fillRect(x0 - 1, top - 1, w + 2, 4);
  c.fillStyle = tn.body; c.fillRect(x0 - 1, top - 1, w + 2, 1);
  c.fillStyle = '#1a1014'; c.fillRect(x0, top, w, 2);
  c.fillStyle = frac > .6 ? '#5fd35a' : frac > .3 ? '#e8c23a' : '#e2452a'; c.fillRect(x0, top, Math.round(w * frac), 2);
  if (tag.rank === 'unique' && tag.role === 'leader') {
    c.fillStyle = tn.core;
    for (const sx of [x0 - 2, x0 + w + 1]) { c.fillRect(sx, top - 2, 1, 1); c.fillRect(sx, top + 3, 1, 1); }
    c.fillStyle = tn.body; c.fillRect(X - 1, top - 3, 3, 1); c.fillRect(X, top - 4, 1, 1);
  }
  let y = top - 4;
  if (tag.role === 'leader' && tag.affixes.length) {
    c.font = '6px "Pixelify Sans", monospace';
    const line = affixLine(tag.affixes);
    c.fillStyle = HOSTILE_EDGE; c.fillText(line, X + 1, y + 1);
    c.fillStyle = '#d9cfe6'; c.fillText(line, X, y);
    y -= 7;
  }
  // Only the leader carries the name line (the pack's other members read by their frame and aura).
  if (tag.role !== 'leader') return;
  const name = tag.name ?? m.def.name;
  c.font = 'bold 8px "Pixelify Sans", monospace';
  c.fillStyle = HOSTILE_EDGE;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [1, 1]]) c.fillText(name, X + dx, y + dy);
  c.fillStyle = targeted ? '#ff8a7a' : tn.body; c.fillText(name, X, y);
}
