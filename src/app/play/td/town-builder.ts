/**
 * town-builder.ts — a hand-drawn town (docs/design/world-map.md): its ground drawn as rows of characters, its houses,
 * stalls and props placed by hand. Builds the same TdMap the Seamworks square is (seamworks-square.ts), so the engine,
 * the stalls' panels, the keepers and the townsfolk work the same in every town.
 */
import type { StationDef } from '../world/world.model';
import { INFERNAL_TOWN } from '../world/towns/infernal';
import { barrel, bench, brazierFountain, crate, fence, flowerbed, forgeHearth, hearthFire, house, lamp, ship, signpost, stall, tower, tree, waystone, TILE, type Ground, type RoofStyle, type Sprite, type WallStyle } from './td-art';
import type { TdMap, TdObject, TdStall } from './seamworks-square';

export type PropKind = 'lamp' | 'bench' | 'barrel' | 'crate' | 'flowerbed' | 'fountain' | 'hearth' | 'forge' | 'signpost' | 'fence' | 'oak' | 'pine' | 'waystone' | 'ship';

export interface TownSpec {
  id: string;
  rows: readonly string[];
  legend: Readonly<Record<string, Ground>>;
  /** Houses; one with a door opens onto its hand-drawn ground floor (td-engine DOORS). */
  houses: readonly { c: number; r: number; w: number; d: number; roof: RoofStyle; wall: WallStyle; door?: StationDef }[];
  /** Stalls: the station (a town StationDef id, or one of its own), its counter's place and look. */
  stalls: readonly { station: string | StationDef; c: number; r: number; w: number; palette: number; goods: 'pots' | 'bread' | 'gems' | 'tools' | 'books' | 'fish' }[];
  props: readonly { kind: PropKind; c: number; r: number }[];
  /** Towers of three floors; one with a door opens onto its hand-drawn ground floor (td-engine DOORS). */
  towers?: readonly { c: number; r: number; door?: StationDef }[];
  spawn: { c: number; r: number };
}

const PROP: Record<PropKind, { sprite: () => Sprite; block?: { w: number; h: number }; kind?: TdObject['kind'] }> = {
  lamp: { sprite: lamp, block: { w: 1, h: 1 } }, bench: { sprite: bench }, barrel: { sprite: barrel, block: { w: 1, h: 1 } },
  crate: { sprite: crate, block: { w: 1, h: 1 } }, flowerbed: { sprite: () => flowerbed(2, 3) }, fountain: { sprite: brazierFountain, block: { w: 3, h: 2 } },
  hearth: { sprite: hearthFire }, forge: { sprite: forgeHearth, block: { w: 2, h: 1 } }, signpost: { sprite: signpost }, fence: { sprite: () => fence(3) },
  oak: { sprite: () => tree('oak', 2), block: { w: 1, h: 1 }, kind: 'tree' }, pine: { sprite: () => tree('pine', 3), block: { w: 1, h: 1 }, kind: 'tree' },
  waystone: { sprite: () => waystone(), block: { w: 1, h: 1 } },
  // A ship moored at a pier: it sits on the sea, so it blocks nothing the water does not.
  ship: { sprite: ship },
};

export function buildTown(spec: TownSpec): TdMap {
  const rows = spec.rows.length, cols = Math.max(...spec.rows.map(r => r.length));
  const ground: Ground[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) ground.push(spec.legend[spec.rows[r][c] ?? ' '] ?? 'grass');
  const objects: TdObject[] = [], stalls: TdStall[] = [];
  const tx = (c: number) => c * TILE + TILE / 2, ty = (r: number) => r * TILE + TILE;
  spec.houses.forEach((h, i) => {
    objects.push({ sprite: () => house(h.w, h.d, h.roof, h.wall, true, i + 40), x: tx(h.c), y: ty(h.r), block: { w: h.w, h: h.d + 1 }, kind: 'building' });
    if (h.door) stalls.push({ station: h.door, x: tx(h.c), y: ty(h.r) + 6 });
  });
  for (const s of spec.stalls) {
    const st = typeof s.station === 'string' ? INFERNAL_TOWN.stations.find(d => d.id === s.station) : s.station;
    if (!st) continue;
    const x = tx(s.c), y = ty(s.r), seed = s.c * 7 + s.r;
    objects.push({ sprite: () => stall(s.w, s.palette, s.goods, seed), x, y, block: { w: s.w, h: 1 }, kind: 'stall' });
    stalls.push({ station: st, x, y: y + 6 });
  }
  for (const t of spec.towers ?? []) {
    objects.push({ sprite: tower, x: tx(t.c), y: ty(t.r), block: { w: 3, h: 2 }, kind: 'building' });
    if (t.door) stalls.push({ station: t.door, x: tx(t.c), y: ty(t.r) + 6 });
  }
  for (const p of spec.props) { const d = PROP[p.kind]; objects.push({ sprite: d.sprite, x: tx(p.c), y: ty(p.r), ...(d.block ? { block: d.block } : {}), kind: d.kind ?? 'prop' }); }
  const walkable = new Uint8Array(cols * rows).fill(1);
  for (let i = 0; i < ground.length; i++) if (ground[i] === 'water' || ground[i] === 'ember' || ground[i] === 'rock') walkable[i] = 0;
  for (const o of objects) {
    if (!o.block) continue;
    const fc = Math.floor(o.x / TILE), fr = Math.floor((o.y - 1) / TILE), c0 = fc - Math.floor((o.block.w - 1) / 2);
    for (let r = fr - o.block.h + 1; r <= fr; r++) for (let c = c0; c < c0 + o.block.w; c++) if (c >= 0 && r >= 0 && c < cols && r < rows) walkable[r * cols + c] = 0;
  }
  return { id: spec.id, cols, rows, ground, objects, stalls, spawn: { x: tx(spec.spawn.c), y: ty(spec.spawn.r) }, walkable };
}
