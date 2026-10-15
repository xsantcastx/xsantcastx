import { HubPixel, lanternSprite } from './hub-pixel';

/** The five realms, each with its own ambient layer (structurally the same union as world.model's RealmTownId). */
export type AmbientRealm = 'infernal' | 'luminous' | 'umbral' | 'celestial' | 'verdant';
/** A canvas can be made (a browser; not SSR or the node harness, whose document is a stub). */
const canPaint = typeof document !== 'undefined' && typeof document.createElement === 'function';
/** World px per art px: the figures' grid in towns and hunts (docs/art/style-guide.md §2). */
const GRID = 4;
/** Particle cap per layer. Every particle is computed from its index and the clock: nothing is stored or allocated. */
export const AMBIENT_CAP = 40;

/** Wraps `value` into [0, span). */
function wrapInto(value: number, span: number): number { return ((value % span) + span) % span; }
/** A stable 0..1 per index. */
function hash01(i: number, salt: number): number {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * One ambient layer per realm, in world space but anchored to the camera so
 * the screen is always populated (each particle wraps across the view):
 *
 *  infernal   embers rising, ash drifting down
 *  luminous   slanted light shafts with dust motes turning in them
 *  umbral     ink motes drifting sideways, an amethyst core in each
 *  celestial  star glints twinkling high in the sky
 *  verdant    leaves falling with a sway, spores rising
 *
 * Off-view particles are never drawn: each x is folded into the view first.
 * Draw calls only; no gradients, no arrays, no per-frame allocation.
 */
export function ambientLayer(c: CanvasRenderingContext2D, realm: AmbientRealm, time: number, camera: number, width: number): void {
  const span = width + 120;
  const left = camera - 60;
  // One art style: every mote is a square of whole art pixels on the figures' 4 px grid.
  const q = (v: number) => Math.round(v / GRID) * GRID;
  c.save();
  switch (realm) {
    case 'infernal':
      for (let i = 0; i < 26; i++) {
        const x = left + wrapInto(hash01(i, 1) * span + Math.sin(time * .9 + i) * 14 - camera * .1, span);
        const y = 600 - wrapInto(hash01(i, 2) * 520 + time * (22 + (i % 5) * 7), 520);
        c.globalAlpha = .35 + .4 * hash01(i, 3) * (.6 + .4 * Math.sin(time * 6 + i));
        c.fillStyle = i % 3 ? '#ff9b4f' : '#ffd08a';
        c.fillRect(q(x), q(y), GRID, GRID);
      }
      c.fillStyle = '#8a7468';
      for (let i = 0; i < 14; i++) {
        const x = left + wrapInto(hash01(i, 4) * span + time * 9 - camera * .05, span);
        const y = 60 + wrapInto(hash01(i, 5) * 540 + time * (10 + i % 4 * 3), 540);
        c.globalAlpha = .28;
        // Ash flakes: two pixels, turning between flat and edge-on.
        const flat = Math.sin(time * .7 + i) > 0;
        c.fillRect(q(x), q(y), flat ? GRID * 2 : GRID, flat ? GRID : GRID * 2);
      }
      break;
    case 'luminous':
      // The shafts are light, not sprites: soft and slanted, as the engine's other light.
      c.fillStyle = '#fff1b0';
      for (let i = 0; i < 4; i++) {
        // Shafts slide a little with the camera so they read as far away.
        const x = left + wrapInto(i * 430 + 120 - camera * .25, Math.max(span, 1720));
        if (x > camera + width + 260) continue;
        c.globalAlpha = .06 + .02 * Math.sin(time * .4 + i * 2);
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 90, 0); c.lineTo(x - 70, 610); c.lineTo(x - 210, 610); c.closePath(); c.fill();
        c.globalAlpha *= .8;
        c.beginPath(); c.moveTo(x + 20, 0); c.lineTo(x + 50, 0); c.lineTo(x - 120, 610); c.lineTo(x - 160, 610); c.closePath(); c.fill();
      }
      c.fillStyle = '#ffe7a0';
      for (let i = 0; i < 30; i++) {
        const x = left + wrapInto(hash01(i, 6) * span + Math.sin(time * .3 + i * 1.7) * 30, span);
        const y = 80 + wrapInto(hash01(i, 7) * 500 + Math.cos(time * .25 + i) * 24 - time * 3, 500);
        c.globalAlpha = .25 + .35 * (.5 + .5 * Math.sin(time * 1.2 + i * 2.3));
        c.fillRect(q(x), q(y), GRID, GRID);
      }
      break;
    case 'umbral':
      for (let i = 0; i < 22; i++) {
        const x = left + wrapInto(hash01(i, 8) * span + time * (6 + i % 4 * 3) * (i % 2 ? 1 : -1), span);
        const y = 120 + hash01(i, 9) * 440 + Math.sin(time * .5 + i) * 18;
        const n = 1 + (hash01(i, 10) > .5 ? 1 : 0);
        c.globalAlpha = .32; c.fillStyle = '#160f22';
        c.fillRect(q(x) - GRID, q(y) - GRID, (n + 1) * GRID, (n + 1) * GRID);
        // The amethyst core sits on the lit (upper-left) pixel.
        c.globalAlpha = .18 + .14 * Math.sin(time * .9 + i); c.fillStyle = '#a855f7';
        c.fillRect(q(x) - GRID, q(y) - GRID, GRID, GRID);
      }
      break;
    case 'celestial':
      c.fillStyle = '#d8ecff';
      for (let i = 0; i < 34; i++) {
        const x = q(left + wrapInto(hash01(i, 11) * span - camera * .08, span));
        const y = q(30 + hash01(i, 12) * 330);
        const tw = .5 + .5 * Math.sin(time * (1.4 + hash01(i, 13) * 2) + i * 3.1);
        // A pixel plus: arms of 0–2 art px as the star twinkles.
        const arm = Math.round(tw * (i % 4 === 0 ? 2 : 1)) * GRID;
        c.globalAlpha = .25 + .6 * tw;
        c.fillRect(x - arm, y, GRID + arm * 2, GRID);
        c.fillRect(x, y - arm, GRID, GRID + arm * 2);
      }
      break;
    case 'verdant':
      for (let i = 0; i < 16; i++) {
        const x = left + wrapInto(hash01(i, 14) * span + Math.sin(time * .8 + i * 1.3) * 26 + time * 6, span);
        const y = wrapInto(hash01(i, 15) * 620 + time * (18 + i % 4 * 5), 620);
        c.globalAlpha = .55; c.fillStyle = i % 3 === 0 ? '#c08a3e' : i % 3 === 1 ? '#7fb85a' : '#4a7a3a';
        // A leaf: two pixels, tumbling between lying flat and on edge.
        const flat = Math.sin(time * 1.6 + i) > -.2;
        c.fillRect(q(x), q(y), flat ? GRID * 2 : GRID, flat ? GRID : GRID * 2);
      }
      c.fillStyle = '#d8f2a0';
      for (let i = 0; i < 14; i++) {
        const x = left + wrapInto(hash01(i, 16) * span + Math.sin(time * .4 + i) * 20, span);
        const y = 600 - wrapInto(hash01(i, 17) * 480 + time * (6 + i % 3 * 2), 480);
        c.globalAlpha = .2 + .25 * (.5 + .5 * Math.sin(time * 1.1 + i));
        c.fillRect(q(x), q(y), GRID, GRID);
      }
      break;
  }
  c.restore();
}

/** Most feedback motes alive at once; a burst past it retires the oldest. */
export const FEEDBACK_CAP = 100;
interface FeedbackMote { x: number; y: number; vx: number; vy: number; age: number; text?: string }

/**
 * Warm scenery and short-lived feedback. Visuals never affect combat state.
 *
 * Feedback motes are pooled: a burst fires every 0.2 s while the Keeper walks,
 * and each used to push seven fresh objects and then copy the whole list in
 * `slice`, with `update` copying it again through `filter` sixty times a
 * second. Now `motes` is one array, compacted in place, and retired motes go
 * back to `spare` to be reused.
 */
export class Atmosphere {
  /**
   * The scenery's gradients, built once per context. They used to be created
   * every frame: one per hanging lantern in view, plus the hearth glow and the
   * rug in the Seamworks. The lantern and hearth are unit radials scaled into
   * place (inner radius as a fraction of the outer), the rug is fixed.
   */
  private cache: { c: CanvasRenderingContext2D; rug: CanvasGradient; hearth: CanvasGradient; lantern: CanvasGradient } | null = null;
  private gradients(c: CanvasRenderingContext2D): { rug: CanvasGradient; hearth: CanvasGradient; lantern: CanvasGradient } {
    if (this.cache?.c === c) return this.cache;
    const rug = c.createLinearGradient(120, 590, 370, 620);
    rug.addColorStop(0, '#6e3a3a'); rug.addColorStop(.5, '#8d4e42'); rug.addColorStop(1, '#6e3a3a');
    const hearth = c.createRadialGradient(0, 0, 5 / 168, 0, 0, 1);
    hearth.addColorStop(0, '#ffc27a66'); hearth.addColorStop(1, '#ffbc6d00');
    const lantern = c.createRadialGradient(0, 0, 4 / 150, 0, 0, 1);
    lantern.addColorStop(0, '#ffd69055'); lantern.addColorStop(1, '#ffbd7300');
    this.cache = { c, rug, hearth, lantern };
    return this.cache;
  }
  private readonly motes: FeedbackMote[] = [];
  private readonly spare: FeedbackMote[] = [];
  /** Live feedback motes (read by tests). */
  get count(): number { return this.motes.length; }
  private add(x: number, y: number, vx: number, vy: number, age: number, text?: string): void {
    if (this.motes.length >= FEEDBACK_CAP) this.spare.push(this.motes.shift()!);
    const p = this.spare.pop() ?? { x: 0, y: 0, vx: 0, vy: 0, age: 0, text: undefined };
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.age = age;
    p.text = text;
    this.motes.push(p);
  }
  burst(x: number, y: number, text?: string): void {
    if (text) this.add(x, y, 0, -48, 1, text);
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7;
      this.add(x, y, Math.cos(angle) * 65, Math.sin(angle) * 50 - 35, .55);
    }
  }
  update(dt: number): void {
    const motes = this.motes;
    let kept = 0;
    for (let i = 0; i < motes.length; i++) {
      const p = motes[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.age -= dt;
      if (p.age > 0) motes[kept++] = p; else this.spare.push(p);
    }
    motes.length = kept;
  }
  /** The Hearth's dressing in pixels (hub-pixel.ts), built on first sight in a browser. */
  private hubPixel: HubPixel | null = null;
  private lantern: HTMLCanvasElement | null = null;
  /** Hand-painted camp furnishings sit behind Keepers and never obstruct movement. */
  hub(c: CanvasRenderingContext2D, time: number, boardsTo = 1120): void {
    if (canPaint) {
      this.hubPixel ??= new HubPixel();
      this.hearthGlow(c, time);
      this.hubPixel.draw(c, time, boardsTo);
      return;
    }
    // Without a DOM (the node harness) the vector dressing stands in.
    c.save();
    // Overhead festival bunting, with a restrained sway between timber posts.
    c.strokeStyle = '#bd9971'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(35, 315); c.quadraticCurveTo(440, 400, 1010, 315); c.stroke();
    for (let i = 0; i < 15; i++) {
      const x = 60 + i * 63; const y = 319 + Math.sin(i / 14 * Math.PI) * 42;
      c.fillStyle = i % 3 === 0 ? '#ad766b' : i % 3 === 1 ? '#c2a26a' : '#789a91';
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 30, y + 2); c.lineTo(x + 15 + Math.sin(time * 1.2 + i) * 2, y + 34); c.closePath(); c.fill();
    }
    // A little supply stall and a shelf of jars suggest the wider item economy.
    c.fillStyle = '#493337'; c.fillRect(620, 482, 152, 115);
    c.fillStyle = '#89604d'; c.fillRect(610, 540, 172, 15);
    c.fillStyle = '#b79a70'; c.fillRect(623, 465, 7, 145); c.fillRect(762, 465, 7, 145);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = i % 2 ? '#8d7464' : '#c39369'; c.fillRect(606 + i * 30, 455, 30, 24);
      c.beginPath(); c.arc(621 + i * 30, 480, 15, 0, Math.PI); c.fill();
    }
    for (let i = 0; i < 5; i++) {
      c.fillStyle = ['#c39b66', '#91b4a5', '#bd8b8b'][i % 3];
      c.fillRect(634 + i * 26, 519 - i % 2 * 7, 14, 21 + i % 2 * 7);
      c.fillStyle = '#e1c29a'; c.fillRect(636 + i * 26, 515 - i % 2 * 7, 10, 5);
    }
    c.fillStyle = '#f1d8ad'; c.font = '600 11px system-ui'; c.textAlign = 'center'; c.fillText('KEEPER SUPPLIES', 695, 577);
    // Worn boards only cover the safe camp. The hunting trail stays bare stone.
    c.save();
    for (let x = 0; x < boardsTo; x += 34) {
      c.fillStyle = (x / 34) % 2 ? '#7a5342' : '#624433';
      c.globalAlpha = .72; c.fillRect(x, 610, 32, 28);
    }
    c.restore();
    // Benches face the shared hearth. This is scenery, not an invented player or NPC.
    for (const [index, x] of [60, 330].entries()) {
      c.fillStyle = '#513a32'; c.fillRect(x + 8, 568, 8, 42); c.fillRect(x + 82, 568, 8, 42);
      c.fillStyle = '#9f7150'; c.fillRect(x, 559, 100, 12); c.fillRect(x + 4, 530, 92, 12);
      c.fillStyle = '#c19765'; c.fillRect(x + 4, 559, 92, 3);
      c.fillStyle = index === 0 ? '#8d4f58' : '#6e7d72';
      c.beginPath(); c.ellipse(x + 50, 554, 30, 8, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e6c39a'; c.fillRect(x + 38, 548, 24, 5);
    }
    // Cups stay on the right bench, left of the ore deposit.
    for (const x of [348, 386]) {
      c.fillStyle = '#efe0c8'; c.fillRect(x, 540, 13, 16);
      c.fillStyle = '#8a5a40'; c.fillRect(x - 1, 536, 15, 5);
      c.fillStyle = '#6b332c'; c.fillRect(x + 2, 545, 9, 7);
    }
    c.strokeStyle = '#6b4634'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(14, 602); c.lineTo(46, 588); c.moveTo(12, 596); c.lineTo(48, 600); c.moveTo(16, 608); c.lineTo(44, 592); c.stroke();
    c.fillStyle = '#7a5344'; c.beginPath();
    c.moveTo(78, 528); c.quadraticCurveTo(108, 500, 142, 534); c.lineTo(128, 546); c.quadraticCurveTo(100, 528, 86, 548); c.closePath(); c.fill();
    c.fillStyle = this.gradients(c).rug; c.beginPath(); c.ellipse(245, 604, 128, 16, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#e2c091'; c.lineWidth = 2; c.beginPath(); c.ellipse(245, 604, 108, 10, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#d7b07a';
    for (let i = 0; i < 5; i++) { c.fillRect(168 + i * 32, 600, 8, 8); }
    // A copper kettle hangs beside the flames, clear of the ore deposit.
    c.strokeStyle = '#8d7764'; c.lineWidth = 2; c.beginPath(); c.moveTo(308, 430); c.lineTo(308, 486); c.stroke();
    c.fillStyle = '#c47a45'; c.beginPath(); c.ellipse(308, 512, 18, 15, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e0a15f'; c.beginPath(); c.ellipse(302, 506, 7, 4, -.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#8d4e2e'; c.fillRect(294, 494, 28, 5);
    c.fillStyle = '#f0c48a'; c.beginPath(); c.arc(308, 492, 3, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#a8643a'; c.lineWidth = 3; c.beginPath(); c.arc(286, 510, 8, -1.4, 1.2); c.stroke();
    c.fillStyle = '#c47a45'; c.beginPath(); c.moveTo(324, 508); c.lineTo(340, 502); c.lineTo(326, 518); c.closePath(); c.fill();
    if (time > 0) {
      for (let i = 0; i < 3; i++) {
        const life = (time * .25 + i * .33) % 1;
        c.globalAlpha = (1 - life) * .5; c.fillStyle = '#efe4d4';
        c.beginPath(); c.arc(308 + Math.sin(time + i) * 3, 484 - life * 28, 2.5 + life * 4, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    }
    const pulse = 168 + Math.sin(time * 3) * 16;
    // The hearth's glow: one unit gradient scaled to this frame's pulse, clipped
    // to the same 350×225 box (in unit space) the per-frame gradient filled.
    c.save(); c.fillStyle = this.gradients(c).hearth;
    c.translate(245, 560); c.scale(pulse, pulse); c.fillRect(-175 / pulse, -175 / pulse, 350 / pulse, 225 / pulse);
    c.restore();
    c.fillStyle = '#65504a'; c.beginPath(); c.ellipse(245, 600, 53, 13, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#a17d61'; c.lineWidth = 10; c.beginPath(); c.moveTo(219, 593); c.lineTo(272, 577); c.moveTo(220, 577); c.lineTo(268, 594); c.stroke();
    for (let i = 0; i < 3; i++) {
      const x = 230 + i * 15; const flicker = Math.sin(time * 4 + i * 2) * 4;
      c.fillStyle = i === 1 ? '#ffe6a1' : '#efaa62';
      c.beginPath(); c.moveTo(x - 12, 588); c.quadraticCurveTo(x - 20, 566, x + flicker, 538 - i % 2 * 12); c.quadraticCurveTo(x + 18, 573, x + 12, 588); c.closePath(); c.fill();
    }
    if (time > 0) {
      for (let i = 0; i < 8; i++) {
        const life = (time * .45 + i * .13) % 1;
        c.globalAlpha = (1 - life) * .75; c.fillStyle = i % 2 ? '#ffe7b4' : '#ff9d55';
        c.beginPath(); c.arc(236 + Math.sin(i * 2.2 + time * 2) * 16, 578 - life * 78, 1.5, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    }
    // Hung above the bunting so Keeper nameplates never cover the words.
    c.fillStyle = '#6b4a38'; c.fillRect(280, 214, 210, 38);
    c.fillStyle = '#c9a06a'; c.fillRect(280, 214, 210, 4); c.fillRect(280, 248, 210, 4);
    c.fillStyle = '#352933e0'; c.fillRect(288, 220, 194, 24);
    c.fillStyle = '#ffe1b0'; c.font = '600 15px Georgia'; c.textAlign = 'center'; c.fillText('The Keeper’s Hearth', 385, 237);
    c.strokeStyle = '#8d7764'; c.lineWidth = 2; c.beginPath(); c.moveTo(318, 214); c.lineTo(318, 188); c.moveTo(452, 214); c.lineTo(452, 188); c.stroke();
    // The sign clearly marks where camp safety ends.
    c.fillStyle = '#80604d'; c.fillRect(1055, 535, 7, 75);
    c.fillStyle = '#463539'; c.fillRect(1005, 512, 110, 34);
    c.fillStyle = '#f0d0a0'; c.font = '600 11px system-ui'; c.fillText('HUNTING TRAIL →', 1060, 533);
    c.restore();
  }
  /** The hearth's glow: light, not a sprite — the cached unit gradient scaled to this frame's pulse. */
  private hearthGlow(c: CanvasRenderingContext2D, time: number): void {
    const pulse = 168 + Math.sin(time * 3) * 16;
    c.save(); c.fillStyle = this.gradients(c).hearth;
    c.translate(245, 560); c.scale(pulse, pulse); c.fillRect(-175 / pulse, -175 / pulse, 350 / pulse, 225 / pulse);
    c.restore();
  }
  /**
   * Hanging lanterns, then the area's ambient layer: the realm's own particles
   * when `realm` is given (towns and their hunting grounds), else the warm
   * motes. `time` is 0 under reduced motion, which freezes every particle in
   * place: a still scene, not an empty one.
   */
  scenery(c: CanvasRenderingContext2D, time: number, camera: number, width: number, realm?: AmbientRealm): void {
    c.save();
    // Hanging lights repeat in world space; the warm pools remain when motion is reduced.
    for (let x = 180; x < 2700; x += 360) {
      if (x < camera - 150 || x > camera + width + 150) continue;
      const y = 270 + Math.sin(x) * 45;
      c.fillStyle = '#776454'; c.fillRect(Math.round(x / GRID) * GRID - GRID / 2, 0, GRID, Math.round(y / GRID) * GRID - 8);
      // Its warm pool: the cached unit gradient at the lantern, 150 px out (the box is y-140..y+160).
      c.save(); c.fillStyle = this.gradients(c).lantern;
      c.translate(x, y + 14); c.scale(150, 150); c.fillRect(-1, -154 / 150, 2, 2);
      c.restore();
      if (canPaint) {
        // The pixel lantern (hub-pixel.ts), on the grid, its cord one art pixel wide.
        this.lantern ??= lanternSprite();
        const lx = Math.round(x / GRID) * GRID, ly = Math.round(y / GRID) * GRID;
        const smoothing = c.imageSmoothingEnabled;
        c.imageSmoothingEnabled = false;
        c.drawImage(this.lantern, lx - 16 - GRID, ly - 8 - GRID, this.lantern.width * GRID, this.lantern.height * GRID);
        c.imageSmoothingEnabled = smoothing;
        continue;
      }
      c.fillStyle = '#564333'; c.fillRect(x - 13, y - 5, 26, 36);
      c.fillStyle = '#ffdca0'; c.fillRect(x - 8, y, 16, 23);
      c.fillStyle = '#fff0c4'; c.fillRect(x - 3, y + 4, 6, 15);
    }
    if (realm) { ambientLayer(c, realm, time, camera, width); c.restore(); return; }
    for (let i = 0; i < 42; i++) {
      const x = (i * 79 + time * (5 + i % 3)) % 2700;
      const y = 570 - (i * 43 + time * (12 + i % 5)) % 480;
      c.globalAlpha = .25 + .25 * Math.sin(time * 1.4 + i);
      c.fillStyle = '#ffe0a5'; c.fillRect(Math.round(x / GRID) * GRID, Math.round(y / GRID) * GRID, GRID, GRID);
    }
    c.restore();
  }
  feedback(c: CanvasRenderingContext2D, reduced: boolean): void {
    c.save(); c.textAlign = 'center'; c.font = 'bold 25px Georgia';
    for (const p of this.motes) {
      if (reduced && !p.text) continue;
      c.globalAlpha = Math.min(1, p.age * 3); c.fillStyle = '#ffe9b8';
      if (p.text) {
        c.strokeStyle = '#30232b'; c.lineWidth = 4; c.strokeText(p.text, p.x, p.y); c.fillText(p.text, p.x, p.y);
      } else { c.beginPath(); c.arc(p.x, p.y, 3 * p.age, 0, Math.PI * 2); c.fill(); }
    }
    c.restore();
  }
}
