/**
 * surface-render.ts — the high ground drawn as pixel art (world/heights.ts).
 *
 * Every piece (a rock shelf, a ruin block or slab, a rope bridge, a trunk and
 * its canopy, a snag, a cache, a carving, the look-out cairn, the summit
 * cairn) is baked once per area entry into a small canvas at one canvas px per
 * art px, from the realm's palettes (style guide §5.2 and the shared Godforge
 * obsidian/violet of §5.1), and laid nearest-neighbour at 4 world px per art px
 * (the town scale, §2). A frame does one drawImage per visible piece, builds no
 * gradient and allocates nothing.
 */
import { GROUND_PALETTES, TOWN_ART } from './ground-strip';
import { seededRandom } from './terrain';
import type { AreaHeights, HeightFind, HeightLook } from '../world/heights';

const A = TOWN_ART;
/** Bark (outline, dark, base, light) and leaves (dark, base, light, bloom) per realm. */
const BARK: Readonly<Record<string, readonly string[]>> = {
  infernal: ['#171116', '#2a2027', '#443540', '#6b5148'],
  luminous: ['#2a2218', '#4a4030', '#7a6a48', '#b8a57c'],
  umbral: ['#0e0912', '#1a1220', '#33263a', '#4a3260'],
  celestial: ['#0a1428', '#3a2a14', '#5a4020', '#8a6a3a'],
  verdant: ['#24190f', '#3a2a1c', '#7a5a36', '#b08a55'],
};
const LEAVES: Readonly<Record<string, readonly string[]>> = {
  infernal: ['#3a1410', '#7a2a12', '#c4501e', '#ff9b4f'],
  luminous: ['#7a5a14', '#b8901e', '#E8D44D', '#fff1b0'],
  umbral: ['#1a1220', '#3a1f63', '#5a2f8a', '#c9a0ff'],
  celestial: ['#14284a', '#1e5a9a', '#5fb6ff', '#d8ecff'],
  verdant: ['#1e2a14', '#3a5a2a', '#4a7a3a', '#7fb85a'],
};
/** Sky above the painting, top → horizon (§5.2 W8 skies). */
const SKY: Readonly<Record<string, readonly [string, string]>> = {
  infernal: ['#120a0c', '#4a1c14'],
  luminous: ['#3a2a3a', '#a8607a'],
  umbral: ['#05040a', '#160f22'],
  celestial: ['#03060f', '#14284a'],
  verdant: ['#0a1a14', '#2a5a40'],
};
/** The Godforge's own stone (§5.1 obsidian) and its violet seam. */
const RUIN = ['#140a1f', '#1e1428', '#2e2238', '#463650', '#6a5878', '#a855f7', '#d9b8ff'];
const ROPE = ['#2a1810', '#7a5a36', '#c9a46a'];
const BRASS = ['#2a1810', '#5a3c1a', '#a5793a', '#e8c898', '#f8e8c8'];

interface Baked { canvas: HTMLCanvasElement; x: number; y: number }

/** Paint a W×H art-px picture with fill(x, y) → colour or ''. Null without a canvas (tests, SSR). */
function bake(w: number, h: number, fill: (x: number, y: number) => string): HTMLCanvasElement | null {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const canvas = document.createElement('canvas');
  const d = canvas.getContext?.('2d');
  if (!d) return null;
  canvas.width = Math.max(1, w); canvas.height = Math.max(1, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const colour = fill(x, y);
    if (colour) { d.fillStyle = colour; d.fillRect(x, y, 1, 1); }
  }
  return canvas;
}

/** The art-px picture of each piece kind. Pure (exported for the tests): palette index per pixel, −1 = clear. */
export function rockPixels(w: number, h: number, seed: number): Int8Array {
  const r = seededRandom(seed), px = new Int8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // A ragged underside: the shelf thins to a jag.
    const jag = h - 1 - Math.floor(((x * 7 + seed) % 5) / 2);
    let v: number;
    if (y > jag) v = -1;
    else if (y === 0) v = r() < .7 ? 5 : 4;
    else if (y === 1) v = 4;
    else if (y === 2 || y === jag || x === 0 || x === w - 1) v = 0;
    else {
      const yy = y - 3, course = Math.floor(yy / 5), by = yy % 5, bx = (x + (course & 1) * 6) % 12;
      v = by === 4 || bx === 11 ? 0 : by === 0 || bx === 0 ? 3 : by === 3 || bx === 10 ? 1 : r() < .12 ? 1 : 2;
    }
    px[y * w + x] = v;
  }
  return px;
}

export class SurfaceRender {
  private pieces: Baked[] = [];
  private finds: { def: HeightFind; open: HTMLCanvasElement | null; shut: HTMLCanvasElement | null }[] = [];
  private realm = 'infernal';
  /** World px per art px of the finds (One World: 2). */
  private fa = A;
  private lookout = '';
  private readonly skies = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasGradient>>();
  /** Pieces baked for the current area (tests read it). */
  get count(): number { return this.pieces.length; }

  enter(h: AreaHeights | null): void {
    this.pieces = []; this.finds = [];
    // One World: a world's finds stand at its scale (2 world px per art px); a flat area's at the town's.
    this.fa = h?.artPx ?? A;
    if (!h) return;
    this.realm = h.realm;
    this.lookout = h.finds.find(f => f.kind === 'lookout')?.id ?? '';
    const ground = GROUND_PALETTES[h.realm] ?? GROUND_PALETTES['infernal'];
    const bark = BARK[h.realm] ?? BARK['infernal'], leaves = LEAVES[h.realm] ?? LEAVES['infernal'];
    const add = (canvas: HTMLCanvasElement | null, x: number, y: number) => { if (canvas) this.pieces.push({ canvas, x, y }); };
    // Trunks first (behind the canopy and the shelves).
    for (const t of h.trees) {
      const w = 6, tall = Math.round((t.bottom - t.top) / A) + (t.canopy ? 0 : 2);
      add(bake(w, tall, (x, y) => {
        if (!t.canopy && y < 2 && (x === 0 || x > 3)) return '';                  // the snag's broken crown
        if (x === 0 || x === w - 1) return bark[0];
        if ((y * 3 + x * 5) % 11 === 0) return bark[1];                            // knots
        return x === 1 ? bark[3] : x === 4 ? bark[1] : bark[2];
      }), t.x - w * A / 2, t.bottom - tall * A);
      if (!t.canopy) {
        // Stubs of old branches: footholds to read, not to stand on.
        add(bake(4, 2, (x, y) => (y === 0 ? (x < 3 ? bark[2] : '') : bark[0])), t.x + 8, t.top + 90);
        add(bake(4, 2, (x, y) => (y === 0 ? (x > 0 ? bark[2] : '') : bark[0])), t.x - 24, t.top + 190);
      }
    }
    for (const t of h.trees) {
      if (!t.canopy) continue;
      const w = Math.round(t.canopy / A) + 6, ht = 16, cx = w / 2;
      const r = seededRandom(Math.round(t.x));
      const bumps = Array.from({ length: 5 }, () => r());
      add(bake(w, ht, (x, y) => {
        const dx = (x - cx) / (w / 2), top = 3 + Math.round(bumps[Math.min(4, Math.floor((x / w) * 5))] * 3);
        const bottom = ht - 1 - Math.round(Math.abs(dx) * 7);
        if (y < top || y > bottom) return '';
        if (y === top || y === bottom || x === 0 || x === w - 1) return leaves[0];
        if (y === top + 1) return leaves[3];
        if (y === bottom - 1) return leaves[1];
        return ((x * 13 + y * 7) % 9) === 0 ? leaves[3] : ((x + y) % 4 === 0 ? leaves[1] : leaves[2]);
      }), t.x - (w * A) / 2, t.top - 5 * A);
    }
    for (const s of h.solids) {
      const w = Math.round(s.w / A), ht = Math.round(s.h / A);
      if (s.look === 'rock') {
        const px = rockPixels(w, ht, Math.round(s.x));
        add(bake(w, ht, (x, y) => { const v = px[y * w + x]; return v < 0 ? '' : ground[v]; }), s.x, s.y);
      } else add(this.ruin(w, ht, Math.round(s.x)), s.x, s.y);
    }
    for (const l of h.ledges) {
      if (l.look === 'canopy') continue; // drawn by its tree
      const w = Math.round(l.width / A);
      add(this.ledge(l.look, w, Math.round(l.x)), l.x, l.y);
    }
    for (const def of h.finds) this.finds.push({ def, shut: this.find(def, false), open: this.find(def, true) });
  }

  private ruin(w: number, h: number, seed: number): HTMLCanvasElement | null {
    const r = seededRandom(seed);
    const seam = 2 + Math.floor(r() * Math.max(1, w - 4));
    return bake(w, h, (x, y) => {
      if (y === 0) return RUIN[4];
      if (x === 0 || y === h - 1 || x === w - 1) return RUIN[0];
      if (x === seam && y > 1 && y < h - 2) return y % 3 === 0 ? RUIN[6] : RUIN[5];     // the violet seam
      return (x + y * 2) % 7 === 0 ? RUIN[1] : y === 1 ? RUIN[3] : RUIN[2];
    });
  }
  private ledge(look: HeightLook, w: number, seed: number): HTMLCanvasElement | null {
    if (look === 'bridge') {
      // Rope rails 6 art px above the planks, sagging a little at the middle.
      const h = 10;
      return bake(w, h, (x, y) => {
        const sag = Math.round(Math.sin((x / w) * Math.PI) * 2);
        if (y === sag || y === sag + 1) return y === sag ? ROPE[2] : ROPE[0];
        if ((x === 0 || x === w - 1) && y < 8) return ROPE[1];                           // end posts
        if (y >= 7) return y === 7 ? (x % 3 === 2 ? ROPE[0] : ROPE[2]) : y === 8 ? ROPE[1] : ROPE[0];
        if (x % 6 === 3 && y > sag + 1 && y < 7) return ROPE[1];                         // hangers
        return '';
      });
    }
    return this.ruin(w, 5, seed);
  }
  private find(def: HeightFind, open: boolean): HTMLCanvasElement | null {
    const leaves = LEAVES[this.realm] ?? LEAVES['infernal'];
    switch (def.kind) {
      case 'cache': return bake(10, 8, (x, y) => {
        // A courier's strongbox: brass bands on wood; open, the lid stands up and it is empty.
        if (open && y < 3) return x === 0 || x === 9 ? BRASS[0] : y === 0 ? BRASS[2] : '';
        if (x === 0 || x === 9 || y === 7) return BRASS[0];
        if (y === 3 || (!open && y === 0)) return BRASS[3];
        if (x === 4 || x === 5) return open ? BRASS[1] : y === 4 ? BRASS[4] : BRASS[2];
        return open && y === 4 ? BRASS[0] : ROPE[1];
      });
      case 'carving': return bake(8, 12, (x, y) => {
        if (y === 0 || x === 0 || x === 7 || y === 11) return RUIN[0];
        const glyph = (x === 2 && y > 2 && y < 9) || (y === 5 && x > 1 && x < 6) || (x === 5 && (y === 3 || y === 8));
        return glyph ? (open ? RUIN[4] : RUIN[5]) : y === 1 ? RUIN[4] : RUIN[2];
      });
      case 'lookout': return bake(10, 16, (x, y) => {
        // A cairn with a pennant: the realm's colour flies until the look-out is used, then it hangs folded.
        if (y >= 10) return x < 1 + (15 - y) % 2 || x > 8 - (15 - y) % 2 ? '' : (x + y) % 3 === 0 ? RUIN[1] : y === 10 ? RUIN[4] : RUIN[3];
        if (x === 5) return BRASS[2];
        if (!open && x > 5 && y < 4 && x - 5 <= 4 - y) return y === 0 ? leaves[0] : leaves[3];
        if (open && x === 6 && y > 1 && y < 6) return leaves[1];
        return '';
      });
      case 'summit': return bake(14, 26, (x, y) => {
        // The summit cairn: stacked stones, a brass star on its pole; a claimed cairn wears the Keeper's violet ribbon.
        if (y >= 12) { const half = 2 + Math.floor((y - 12) / 2); return Math.abs(x - 6.5) > half ? '' : (x + y) % 4 === 0 ? RUIN[1] : (y - 12) % 4 === 0 ? RUIN[4] : RUIN[3]; }
        if (x === 6 || x === 7) return y < 3 ? '' : BRASS[2];
        if (y < 4 && Math.abs(x - 6.5) + Math.abs(y - 1.5) < 3) return y === 1 ? BRASS[4] : BRASS[3];
        if (open && y > 4 && y < 9 && x > 7 && x < 12) return y % 2 ? RUIN[5] : RUIN[6];
        return '';
      });
    }
  }

  /** Sky over the top of the painting while the camera looks up (`gap` world px of it). */
  sky(c: CanvasRenderingContext2D, viewport: number, gap: number): void {
    let byRealm = this.skies.get(c);
    if (!byRealm) { byRealm = new Map(); this.skies.set(c, byRealm); }
    let g = byRealm.get(this.realm);
    if (!g) {
      const [top, horizon] = SKY[this.realm] ?? SKY['infernal'];
      g = c.createLinearGradient(0, 0, 0, 720); g.addColorStop(0, top); g.addColorStop(1, horizon);
      byRealm.set(this.realm, g);
    }
    // The gradient is fixed to the frame (0..720): the band shows its top part.
    c.fillStyle = g; c.fillRect(0, 0, viewport, Math.ceil(gap) + 1);
  }

  /** The high ground: trees, shelves, ruins and bridges, then the finds. World space (camera applied). */
  draw(c: CanvasRenderingContext2D, camera: number, cameraY: number, viewport: number, found: ReadonlySet<string>, time: number): void {
    if (!this.pieces.length && !this.finds.length) return;
    const smooth = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    for (const p of this.pieces) {
      const w = p.canvas.width * A, h = p.canvas.height * A;
      if (p.x + w < camera || p.x > camera + viewport || p.y > cameraY + 720 || p.y + h < cameraY) continue;
      c.drawImage(p.canvas, p.x, p.y, w, h);
    }
    // After the look-out: every find still waiting on this high road stands under a pale beam, seen from anywhere.
    const lit = this.lookout !== '' && found.has(this.lookout);
    const F = this.fa;
    for (const f of this.finds) {
      const art = found.has(f.def.id) ? f.open : f.shut;
      if (!art || f.def.x < camera - 80 || f.def.x > camera + viewport + 80) continue;
      const w = art.width * F, h = art.height * F;
      c.drawImage(art, Math.round((f.def.x - w / 2) / F) * F, f.def.y - h, w, h);
      // An unclaimed find winks: one bright art pixel above it (still under reduced motion: time is 0 there).
      if (!found.has(f.def.id)) {
        if (lit) { c.globalAlpha = .16; c.fillStyle = '#fff1b0'; c.fillRect(Math.round(f.def.x / F) * F - F, f.def.y - h - 520, 2 * F, 520 - 4 * F); c.globalAlpha = 1; }
        const on = Math.sin(time * 3 + f.def.x) > -.2;
        c.fillStyle = on ? '#fff1b0' : '#e8c89880';
        c.fillRect(Math.round(f.def.x / F) * F - F / 2, f.def.y - h - 3 * F, F, F);
      }
    }
    c.imageSmoothingEnabled = smooth;
  }
}
