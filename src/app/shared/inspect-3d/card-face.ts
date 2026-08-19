/**
 * card-face.ts — the two faces of the 3D card, painted with Canvas 2D.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY NOT RENDER THE EXISTING CARD HTML
 * ─────────────────────────────────────────────────────────────────────────────
 * The obvious route is to screenshot the DOM node the item already has. There
 * is no browser API that does that: `html2canvas` is a 200KB dependency that
 * reimplements a layout engine and gets it wrong on anything with a shadow or a
 * blend mode (which is every card on this site), and the SVG `foreignObject`
 * trick cannot load a same-origin image without tainting the canvas on Safari,
 * which would make `texImage2D` throw on exactly the platform that already
 * needs the most care here.
 *
 * So the faces are drawn from the same `EntityPresentation` the 2D panel uses.
 * Identical source of truth, no dependency, no taint, and the layout can be cut
 * for a 512×725 texture rather than inherited from a responsive panel.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ART LOADS LATE, ON PURPOSE
 * ─────────────────────────────────────────────────────────────────────────────
 * `paintFront` draws everything except the artwork synchronously and returns a
 * promise for the redraw. The card is therefore on screen and spinning before
 * the PNG has decoded, and the art fades in over it. Waiting would mean an
 * empty overlay for as long as the network took.
 */
import { CARD } from './inspect-3d.model';
import { type EntityPresentation } from '../entity/entity.model';

/** The base every face is built on: deep void, faintly lit by the rarity. */
function ground(ctx: CanvasRenderingContext2D, rarity: string): void {
  const { texWidth: w, texHeight: h } = CARD;
  ctx.clearRect(0, 0, w, h);

  const bg = ctx.createLinearGradient(0, 0, w * 0.6, h);
  bg.addColorStop(0, '#120d1c');
  bg.addColorStop(0.55, '#0a0713');
  bg.addColorStop(1, '#050309');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const wash = ctx.createRadialGradient(w * 0.5, h * 0.38, 0, w * 0.5, h * 0.38, w * 0.95);
  // Low on purpose. A Mortal's colour is near-white, so a wash heavy enough to
  // read on a Mythic turns a Mortal's face into flat grey and loses the void
  // the whole card is supposed to be sitting in.
  wash.addColorStop(0, withAlpha(rarity, 0.08));
  wash.addColorStop(1, withAlpha(rarity, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);

  // Two inset frames. The outer one carries the rarity, the inner is a hairline
  // that stops the face from reading as a flat gradient at a glancing angle.
  ctx.strokeStyle = withAlpha(rarity, 0.75);
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 30, w - 60, h - 60);
}

/** `#rrggbb` plus an alpha, as an rgba() string. */
function withAlpha(hex: string, alpha: number): string {
  const h = (hex || '#ffffff').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(255, 255, 255, ${alpha})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Draw text, wrapped, and report where the next line would start. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 99,
): number {
  const words = text.split(/\s+/).filter(Boolean);
  let line = '';
  let lines = 0;
  let cursor = y;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) { line = next; continue; }
    ctx.fillText(line, x, cursor);
    cursor += lineHeight;
    line = word;
    if (++lines >= maxLines) return cursor;
  }
  if (line) { ctx.fillText(line, x, cursor); cursor += lineHeight; }
  return cursor;
}

function newFace(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = CARD.texWidth;
  canvas.height = CARD.texHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return { canvas, ctx };
}

/**
 * The front: rarity band, artwork, name.
 *
 * `onArt` fires once the artwork has decoded and been composited, so the caller
 * can flag the texture for re-upload. It never fires if there is no art or if
 * the image fails — the glyph fallback is already painted by then.
 */
export function paintFront(
  place: EntityPresentation,
  onArt: () => void,
): HTMLCanvasElement {
  const { canvas, ctx } = newFace();
  const { texWidth: w, texHeight: h } = CARD;
  const rarity = place.rarity?.color ?? '#e8ecf1';

  ground(ctx, rarity);

  ctx.textAlign = 'center';
  ctx.fillStyle = withAlpha(rarity, 0.92);
  ctx.font = '600 22px Orbitron, system-ui, sans-serif';
  ctx.fillText((place.rarity?.label ?? place.kindLabel).toUpperCase(), w / 2, 84);

  // The art plate: a lit recess the artwork sits inside, drawn whether or not
  // the artwork ever arrives so the composition does not shift when it does.
  const plate = { x: 62, y: 122, w: w - 124, h: w - 124 };
  const plateGlow = ctx.createRadialGradient(
    plate.x + plate.w / 2, plate.y + plate.h / 2, 0,
    plate.x + plate.w / 2, plate.y + plate.h / 2, plate.w * 0.62,
  );
  plateGlow.addColorStop(0, withAlpha(rarity, 0.22));
  plateGlow.addColorStop(1, withAlpha(rarity, 0));
  ctx.fillStyle = plateGlow;
  ctx.fillRect(plate.x - 20, plate.y - 20, plate.w + 40, plate.h + 40);

  // The plate as it stands, before the glyph goes on it. Restoring this is how
  // the artwork erases the glyph without a second full repaint of the face —
  // there is no way to un-draw one region of a gradient otherwise, and the
  // canvas is ours and untainted, so getImageData is free of the CORS trap.
  const plateRegion = ctx.getImageData(plate.x - 24, plate.y - 24, plate.w + 48, plate.h + 48);

  ctx.fillStyle = withAlpha(rarity, 0.45);
  ctx.font = '600 150px Orbitron, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(place.glyphFallback || '✦', w / 2, plate.y + plate.h / 2);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#f4f1ff';
  ctx.font = '700 40px Orbitron, system-ui, sans-serif';
  const after = wrap(ctx, place.name, w / 2, plate.y + plate.h + 96, w - 110, 46, 3);

  ctx.fillStyle = 'rgba(230, 226, 245, 0.62)';
  ctx.font = '400 24px Inter, system-ui, sans-serif';
  wrap(ctx, place.kindLabel, w / 2, after + 14, w - 120, 30, 1);

  if (place.summary) {
    ctx.fillStyle = 'rgba(214, 208, 235, 0.5)';
    ctx.font = '400 22px Inter, system-ui, sans-serif';
    wrap(ctx, place.summary, w / 2, after + 62, w - 120, 28, 3);
  }

  ctx.fillStyle = withAlpha(rarity, 0.5);
  ctx.fillRect(w / 2 - 60, h - 78, 120, 3);

  if (place.art?.src) {
    const img = new Image();
    // Same-origin assets, but stated explicitly: a tainted canvas makes the
    // WebGL upload throw rather than degrade, and that is a black card.
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        const scale = Math.min(plate.w / img.width, plate.h / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.putImageData(plateRegion, plate.x - 24, plate.y - 24);
        ctx.drawImage(img, plate.x + (plate.w - dw) / 2, plate.y + (plate.h - dh) / 2, dw, dh);
        onArt();
      } catch { /* a decode that fails leaves the glyph face standing */ }
    };
    img.src = place.art.src;
  }

  return canvas;
}

/** The back: the stat block, in the same order Quick Inspect lists it. */
export function paintBack(place: EntityPresentation, statsLabel: string): HTMLCanvasElement {
  const { canvas, ctx } = newFace();
  const { texWidth: w, texHeight: h } = CARD;
  const rarity = place.rarity?.color ?? '#e8ecf1';

  ground(ctx, rarity);

  ctx.textAlign = 'center';
  ctx.fillStyle = withAlpha(rarity, 0.9);
  ctx.font = '600 22px Orbitron, system-ui, sans-serif';
  ctx.fillText(statsLabel.toUpperCase(), w / 2, 84);

  ctx.fillStyle = '#efeaff';
  ctx.font = '700 30px Orbitron, system-ui, sans-serif';
  let y = wrap(ctx, place.name, w / 2, 138, w - 110, 36, 2) + 18;

  ctx.textAlign = 'left';
  const left = 62;
  const right = w - 62;

  const mods = place.facts.filter(f => f.kind === 'mod');
  const meta = place.facts.filter(f => f.kind !== 'mod');

  ctx.font = '500 24px Inter, system-ui, sans-serif';
  for (const mod of mods.slice(0, 8)) {
    ctx.fillStyle = withAlpha(rarity, 0.95);
    y = wrap(ctx, mod.value, left, y, right - left, 32, 2);
    y += 4;
  }

  if (mods.length && meta.length) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, y + 4);
    ctx.lineTo(right, y + 4);
    ctx.stroke();
    y += 34;
  }

  ctx.font = '400 22px Inter, system-ui, sans-serif';
  for (const fact of meta.slice(0, 9)) {
    if (y > h - 150) break;
    ctx.fillStyle = 'rgba(206, 200, 228, 0.62)';
    ctx.fillText(fact.label, left, y);
    ctx.fillStyle = '#e9e4ff';
    ctx.textAlign = 'right';
    ctx.fillText(fact.value, right, y);
    ctx.textAlign = 'left';
    y += 34;
  }

  if (place.lore && y < h - 130) {
    ctx.fillStyle = withAlpha(rarity, 0.55);
    ctx.font = 'italic 400 21px Inter, system-ui, sans-serif';
    wrap(ctx, place.lore, left, h - 116, right - left, 28, 3);
  }

  return canvas;
}
