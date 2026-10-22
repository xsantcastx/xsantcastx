/**
 * worn-lineup.ts — a test sheet of worn looks: a Keeper wearing each item (or each set whole), seen from the front, from
 * behind and from the side, in a grid with the item's name under it. For the e2e screenshot spec only
 * (e2e/td-worn-shots.spec.ts → docs/handoff/cozy-ui/worn-*.jpg), reached through `window.__wornLineup` on `?fxworn=1`
 * in an automated browser. Paints with the game's own painters, so what it shows is what the world shows.
 */
import { definitionFor } from '../rpg/item-definition';
import { uniqueById } from '../rpg/unique-items';
import { type GearSlot, type KeeperGear } from './keeper-gear';
import { FRONT_AX, FRONT_AY, FRONT_H, FRONT_W, drawWornFront, frontSheet } from './keeper-front';
import { defaultLook, type KeeperLook } from './keeper-look.model';
import { KeeperPainter } from './keeper-paint';
import { pieceOfLook, wornLookOf } from './worn-looks';

/** The gear for a list of item ids worn together. */
export function gearOf(ids: readonly string[]): KeeperGear {
  const gear: KeeperGear = {};
  for (const id of ids) {
    const def = definitionFor({ definitionId: id, name: '', type: 'artifact' });
    const slot = (def?.slot ?? uniqueById(id)?.slot ?? (def?.type === 'charm' ? 'charm1' : undefined)) as GearSlot | undefined;
    if (!slot) continue;
    const look = wornLookOf({ definitionId: id, rarity: def ? undefined : 'legendary' }, slot);
    if (look) gear[slot] = pieceOfLook(look);
  }
  return gear;
}

export interface LineupOptions { scale?: number; cols?: number; views?: readonly ('down' | 'up' | 'side')[]; time?: number; look?: Partial<KeeperLook> }

/**
 * Paint `groups` (each a list of item ids worn together, with a label) into a new canvas: per group the Keeper from the
 * front, behind and the side. Returns the canvas (the caller places it).
 */
export function wornLineup(groups: readonly { label: string; ids: readonly string[] }[], opts: LineupOptions = {}): HTMLCanvasElement {
  const k = opts.scale ?? 3, cols = Math.max(1, opts.cols ?? 5), views = opts.views ?? ['down', 'up', 'side'];
  const viewW = FRONT_W * k, cellW = views.length * viewW + 16, cellH = FRONT_H * k + 26;
  const rows = Math.ceil(groups.length / cols);
  const el = document.createElement('canvas');
  el.width = cols * cellW; el.height = rows * cellH;
  const c = el.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#2a2230'; c.fillRect(0, 0, el.width, el.height);
  const look: KeeperLook = { ...defaultLook(), made: true, hair: 'cropped', hairColor: 2, ...(opts.look ?? {}) } as KeeperLook;
  groups.forEach((g, i) => {
    const gx = (i % cols) * cellW + 8, gy = Math.floor(i / cols) * cellH + 4;
    c.fillStyle = (i + Math.floor(i / cols)) % 2 ? '#3a3040' : '#352c3b';
    c.fillRect(gx - 6, gy - 2, cellW - 4, cellH - 4);
    const painter = new KeeperPainter(look, gearOf(g.ids), null);
    views.forEach((v, j) => {
      const x = gx + j * viewW;
      c.save(); c.translate(x, gy); c.scale(k, k);
      if (v === 'side') {
        c.translate(FRONT_AX, FRONT_AY);
        painter.draw(c, 1, { action: 'idle', time: opts.time ?? 0, attackT: 0, weapon: true, fxStill: true });
      } else {
        const row = v === 'down' ? 0 : 1;
        c.drawImage(frontSheet(painter), 0, row * FRONT_H, FRONT_W, FRONT_H, 0, 0, FRONT_W, FRONT_H);
        drawWornFront(c, painter, v, 0, 0, 0, opts.time ?? 0, true);
      }
      c.restore();
    });
    c.font = 'bold 11px monospace'; c.fillStyle = '#f0e6d2'; c.textBaseline = 'top';
    c.fillText(g.label.slice(0, Math.floor(cellW / 7)), gx, gy + FRONT_H * k + 4);
  });
  return el;
}
