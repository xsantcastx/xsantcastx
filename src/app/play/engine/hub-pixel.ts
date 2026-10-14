/**
 * hub-pixel.ts — the Keeper's Hearth camp dressing as pixel art (one art style, pass 2).
 *
 * The bunting, the supply stall and its jars, the benches, cups, rug, kettle,
 * hearth stones and logs, the Hearth sign and the trail sign were canvas vectors
 * (curves, ellipses, gradients, round-capped strokes) beside a pixel Keeper. Now
 * the still parts are painted ONCE into a quarter-size canvas — the figures' grid,
 * 4 world px per art px — snapped to whole pixels (`crisp`), outlined with the
 * figures' one outline, and laid down as one unsmoothed blit. Same layout, same
 * colours (the rug's gradient became two flat tones: no gradients in pixel art).
 *
 * What moves stays live but lands on the grid: the pennants sway a whole art
 * pixel (nine tiny cached flags), the kettle's steam and the hearth's embers are
 * 1–2 art px squares, the flames are stacked pixel rows. The hearth's glow is
 * light, not a sprite, and stays the engine's gradient (atmosphere.ts). The
 * words on the signs are real text over the boards (art bible §9: no pixel-font
 * copy).
 *
 * Browser only (canvas). The node harness keeps atmosphere.ts's vector path.
 */
import { canvas, outlined } from '../../shared/keeper-look/keeper-paint';
import { crisp } from './prop-pixel';

/** World px per art px. */
const P = 4;
const snap = (v: number) => Math.round(v / P) * P;
/** The still dressing's box in world px. */
const TOP = 184, WIDTH = 1128, BOTTOM = 640;
const FLAG_COLORS = ['#ad766b', '#c2a26a', '#789a91'] as const;

type Ctx = CanvasRenderingContext2D;

/**
 * Paint world-space vector code into an art-px canvas (`w`×`h` world px from
 * (`ox`, `oy`)), snap it to whole pixels and outline it. Blit the result at
 * (ox − 4, oy − 4), `el.width × 4` wide (the 1 art px margin holds the outline).
 */
export function paintWorld(w: number, h: number, ox: number, oy: number, draw: (c: Ctx) => void, outline = true): HTMLCanvasElement {
  const el = canvas(Math.ceil(w / P) + 2, Math.ceil(h / P) + 2);
  const c = el.getContext('2d')!;
  c.translate(1, 1); c.scale(1 / P, 1 / P); c.translate(-ox, -oy);
  draw(c);
  crisp(el);
  return outline ? outlined(el) : el;
}

function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, color: string): void {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}

/** The camp's still dressing (everything in atmosphere.ts `hub` that does not move). */
function stillDressing(c: Ctx): void {
  c.lineCap = 'butt';
  // Bunting cord.
  c.strokeStyle = '#bd9971'; c.lineWidth = P;
  c.beginPath(); c.moveTo(35, 315); c.quadraticCurveTo(440, 400, 1010, 315); c.stroke();
  // The supply stall, its awning and jars.
  c.fillStyle = '#493337'; c.fillRect(620, 482, 152, 115);
  c.fillStyle = '#89604d'; c.fillRect(610, 540, 172, 16);
  c.fillStyle = '#b79a70'; c.fillRect(624, 464, 8, 146); c.fillRect(760, 464, 8, 146);
  for (let i = 0; i < 6; i++) {
    c.fillStyle = i % 2 ? '#8d7464' : '#c39369'; c.fillRect(604 + i * 32, 456, 32, 24);
    c.beginPath(); c.arc(620 + i * 32, 480, 16, 0, Math.PI); c.fill();
  }
  for (let i = 0; i < 5; i++) {
    c.fillStyle = ['#c39b66', '#91b4a5', '#bd8b8b'][i % 3];
    c.fillRect(636 + i * 24, 520 - i % 2 * 8, 16, 20 + i % 2 * 8);
    c.fillStyle = '#e1c29a'; c.fillRect(636 + i * 24, 516 - i % 2 * 8, 16, 4);
  }
  // Benches facing the hearth, with a cushion and a folded cloth each.
  for (const [index, x] of [60, 330].entries()) {
    c.fillStyle = '#513a32'; c.fillRect(x + 8, 568, 8, 42); c.fillRect(x + 84, 568, 8, 42);
    c.fillStyle = '#9f7150'; c.fillRect(x, 560, 100, 12); c.fillRect(x + 4, 528, 92, 12);
    c.fillStyle = '#c19765'; c.fillRect(x + 4, 560, 92, 4);
    ellipse(c, x + 50, 554, 30, 8, index === 0 ? '#8d4f58' : '#6e7d72');
    c.fillStyle = '#e6c39a'; c.fillRect(x + 38, 548, 24, 4);
  }
  // Cups on the right bench.
  for (const x of [348, 384]) {
    c.fillStyle = '#efe0c8'; c.fillRect(x, 540, 12, 16);
    c.fillStyle = '#8a5a40'; c.fillRect(x - 2, 536, 16, 4);
    c.fillStyle = '#6b332c'; c.fillRect(x + 4, 544, 4, 8);
  }
  // Firewood, and a blanket over the left bench's end.
  c.strokeStyle = '#6b4634'; c.lineWidth = P;
  c.beginPath(); c.moveTo(14, 602); c.lineTo(46, 588); c.moveTo(12, 596); c.lineTo(48, 600); c.moveTo(16, 608); c.lineTo(44, 592); c.stroke();
  c.fillStyle = '#7a5344'; c.beginPath();
  c.moveTo(78, 528); c.quadraticCurveTo(108, 500, 142, 534); c.lineTo(128, 546); c.quadraticCurveTo(100, 528, 86, 548); c.closePath(); c.fill();
  // The rug: two flat tones and a woven border.
  ellipse(c, 245, 604, 128, 16, '#6e3a3a');
  ellipse(c, 245, 604, 112, 12, '#8d4e42');
  c.strokeStyle = '#e2c091'; c.lineWidth = P; c.beginPath(); c.ellipse(245, 604, 104, 9, 0, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#d7b07a';
  for (let i = 0; i < 5; i++) c.fillRect(168 + i * 32, 600, 8, 8);
  // The copper kettle on its chain.
  c.fillStyle = '#8d7764'; c.fillRect(306, 428, 4, 60);
  ellipse(c, 308, 512, 18, 15, '#c47a45');
  ellipse(c, 302, 506, 7, 4, '#e0a15f');
  c.fillStyle = '#8d4e2e'; c.fillRect(292, 492, 32, 6);
  c.fillStyle = '#f0c48a'; c.fillRect(304, 488, 8, 4);
  c.strokeStyle = '#a8643a'; c.lineWidth = P; c.beginPath(); c.arc(286, 510, 8, -1.4, 1.2); c.stroke();
  c.fillStyle = '#c47a45'; c.beginPath(); c.moveTo(324, 508); c.lineTo(340, 500); c.lineTo(326, 520); c.closePath(); c.fill();
  // Hearth stones and crossed logs.
  ellipse(c, 245, 600, 53, 13, '#65504a');
  c.strokeStyle = '#a17d61'; c.lineWidth = 12; c.beginPath(); c.moveTo(219, 593); c.lineTo(272, 577); c.moveTo(220, 577); c.lineTo(268, 594); c.stroke();
  // The Keeper's Hearth sign on its two cords, and the trail sign at the camp's edge.
  c.fillStyle = '#8d7764'; c.fillRect(316, 188, 4, 28); c.fillRect(452, 188, 4, 28);
  c.fillStyle = '#6b4a38'; c.fillRect(280, 212, 212, 40);
  c.fillStyle = '#c9a06a'; c.fillRect(280, 212, 212, 4); c.fillRect(280, 248, 212, 4);
  c.fillStyle = '#352933'; c.fillRect(288, 220, 196, 24);
  c.fillStyle = '#80604d'; c.fillRect(1056, 532, 8, 78);
  c.fillStyle = '#463539'; c.fillRect(1004, 512, 112, 36);
}

/**
 * The Hearth's pixel dressing. One per Atmosphere; sprites are built on first
 * sight and kept (they never change, except the boards when a camp's edge does).
 */
export class HubPixel {
  private still: HTMLCanvasElement | null = null;
  private boards: HTMLCanvasElement | null = null;
  private boardsTo = -1;
  private readonly flags = new Map<number, HTMLCanvasElement>();

  /** A pennant, 8 art px wide and 9 deep, its tip swayed by `sway` art px. */
  private flag(color: number, sway: number): HTMLCanvasElement {
    const key = color * 4 + sway + 1;
    let el = this.flags.get(key);
    if (!el) {
      el = paintWorld(32, 36, 0, 0, c => {
        c.fillStyle = FLAG_COLORS[color];
        c.beginPath(); c.moveTo(0, 0); c.lineTo(32, 0); c.lineTo(16 + sway * P, 36); c.closePath(); c.fill();
      });
      this.flags.set(key, el);
    }
    return el;
  }

  draw(c: Ctx, time: number, boardsTo: number): void {
    const smoothing = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    // Worn boards over the safe camp: no outline, a little of the ground through them.
    if (!this.boards || this.boardsTo !== boardsTo) {
      this.boardsTo = boardsTo;
      this.boards = paintWorld(boardsTo, 32, 0, 608, b => {
        for (let x = 0, i = 0; x < boardsTo; x += 36, i++) { b.fillStyle = i % 2 ? '#7a5342' : '#624433'; b.fillRect(x, 612, 32, 28); }
      }, false);
    }
    c.save(); c.globalAlpha = .72;
    c.drawImage(this.boards, -P, 608 - P, this.boards.width * P, this.boards.height * P);
    c.restore();
    this.still ??= paintWorld(WIDTH, BOTTOM - TOP, 0, TOP, stillDressing);
    c.drawImage(this.still, -P, TOP - P, this.still.width * P, this.still.height * P);
    // Pennants on the cord: each sways a whole art pixel, never a fraction.
    for (let i = 0; i < 15; i++) {
      const x = snap(60 + i * 63), y = snap(319 + Math.sin(i / 14 * Math.PI) * 42);
      const sway = time > 0 ? Math.round(Math.sin(time * 1.2 + i) * .9) : 0;
      const el = this.flag(i % 3, sway);
      c.drawImage(el, x - P, y - P, el.width * P, el.height * P);
    }
    // Kettle steam: square puffs that grow a pixel as they rise.
    if (time > 0) {
      c.fillStyle = '#efe4d4';
      for (let i = 0; i < 3; i++) {
        const life = (time * .25 + i * .33) % 1, n = life < .5 ? 1 : 2;
        c.globalAlpha = (1 - life) * .5;
        c.fillRect(snap(306 + Math.sin(time + i) * 3), snap(484 - life * 28), n * P, n * P);
      }
      c.globalAlpha = 1;
    }
    // Three flame tongues as stacked pixel rows; the middle one burns pale.
    for (let i = 0; i < 3; i++) {
      const x = 230 + i * 15, rise = 11 + (i % 2 ? -3 : 0) + Math.round(Math.sin(time * 4 + i * 2) * 1.2);
      for (let row = 0; row < rise; row++) {
        const half = Math.max(0, Math.round((1 - row / rise) * 3 - (row === 0 ? 0 : .3)));
        c.fillStyle = row < rise - 2 ? (i === 1 ? '#ffe6a1' : '#efaa62') : '#ffd08a';
        c.fillRect(snap(x) - half * P, 584 - row * P, (half * 2 + 1) * P, P);
      }
    }
    // Embers off the fire: single pixels.
    if (time > 0) {
      for (let i = 0; i < 8; i++) {
        const life = (time * .45 + i * .13) % 1;
        c.globalAlpha = (1 - life) * .75; c.fillStyle = i % 2 ? '#ffe7b4' : '#ff9d55';
        c.fillRect(snap(236 + Math.sin(i * 2.2 + time * 2) * 16), snap(578 - life * 78), P, P);
      }
      c.globalAlpha = 1;
    }
    c.imageSmoothingEnabled = smoothing;
    // The words: real text on the boards.
    c.textAlign = 'center';
    c.fillStyle = '#f1d8ad'; c.font = '600 11px system-ui'; c.fillText('KEEPER SUPPLIES', 695, 577);
    c.fillStyle = '#ffe1b0'; c.font = '600 15px Georgia'; c.fillText('The Keeper’s Hearth', 386, 237);
    c.fillStyle = '#f0d0a0'; c.font = '600 11px system-ui'; c.fillText('HUNTING TRAIL →', 1060, 534);
  }
}

/** A hanging lantern: a brass cap and frame, warm glass, a bright wick; 8 × 10 art px, outlined. */
export function lanternSprite(): HTMLCanvasElement {
  return paintWorld(32, 40, 0, 0, c => {
    c.fillStyle = '#564333'; c.fillRect(0, 4, 32, 36); c.fillRect(8, 0, 16, 4);
    c.fillStyle = '#8a6a3a'; c.fillRect(0, 4, 32, 4);
    c.fillStyle = '#ffdca0'; c.fillRect(4, 12, 24, 24);
    c.fillStyle = '#fff0c4'; c.fillRect(12, 16, 8, 16);
  });
}
