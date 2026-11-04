/**
 * td-nearby.ts — what the satchel's Nearby tab lists (docs/design/ui-pass-3.md §A.4; Tibia's open containers,
 * Diablo Immortal's loot list): every corpse and ground pile within 8 tiles of the Keeper, nearest first.
 *
 * Pure (no canvas, no DOM): the engine hands in its corpses and drops, and this groups them. A corpse's own loot is
 * its container; loose drops (the Keeper's own, the room's, another Keeper's online pile) that lie within one tile of
 * each other merge into one pile, as Tibia stacks a tile. Specced in td-nearby.spec.ts.
 */
import { NEARBY_LIST, NEARBY_REACH } from './td-corpse';

export type NearbyKind = 'corpse' | 'ground' | 'room';

/** One piece in a container. */
export interface NearbyItem {
  id: string;
  label: string;
  qty: number;
  coins: number;
  rarity: string | null;
  color: string;
  art: string;
  /** A stack (a material): the card offers a partial take. */
  stack: boolean;
  /** Another Keeper's online pile (protocol 6): taken through the room. */
  shared: boolean;
}

/** A container: a corpse, or a pile on the ground. */
export interface NearbyContainer {
  id: string;
  kind: NearbyKind;
  /** A creature's name, or empty for a pile (the HUD names it: "Your drop", "Bryn's drop"). */
  name: string;
  /** Who laid an online pile. */
  by: string;
  /** The pile is the Keeper's own. */
  own: boolean;
  x: number; y: number;
  /** Art px from the Keeper's feet. */
  dist: number;
  /** Whole tiles away, rounded (the "Walk · 5 tiles" chip). */
  tiles: number;
  /** Within NEARBY_REACH: taken from at once. */
  inReach: boolean;
  /** A corpse's stage and how far its rot has gone (0..1); a pile is 'pile' and 0. */
  stage: string;
  rot: number;
  /** How long ago the corpse fell (seconds); Infinity for a pile. */
  age: number;
  items: NearbyItem[];
}

/** What the engine hands in for one loose drop. */
export interface LooseDrop {
  id: string; x: number; y: number; label: string; qty: number; coins: number; rarity: string | null; color: string; art: string;
  stack: boolean; shared: boolean; own: boolean; room: boolean; by: string;
}

/** What the engine hands in for one corpse. */
export interface CorpseIn { id: string; name: string; x: number; y: number; stage: string; rot: number; age: number; items: NearbyItem[] }

const TILE = 16;

/** Group loose drops into piles: a drop within one tile of a pile's first piece joins it (stable: drops in order). */
export function groupPiles(drops: readonly LooseDrop[]): { x: number; y: number; drops: LooseDrop[] }[] {
  const piles: { x: number; y: number; drops: LooseDrop[] }[] = [];
  for (const d of drops) {
    const pile = piles.find(p => Math.abs(p.x - d.x) <= TILE && Math.abs(p.y - d.y) <= TILE);
    if (pile) pile.drops.push(d); else piles.push({ x: d.x, y: d.y, drops: [d] });
  }
  return piles;
}

const item = (d: LooseDrop): NearbyItem => ({ id: d.id, label: d.label, qty: d.qty, coins: d.coins, rarity: d.rarity, color: d.color, art: d.art, stack: d.stack, shared: d.shared });

/** The Nearby list: every container within `radius` of (px, py), nearest first (ties keep their order). */
export function nearbyList(px: number, py: number, corpses: readonly CorpseIn[], loose: readonly LooseDrop[], radius = NEARBY_LIST): NearbyContainer[] {
  const out: NearbyContainer[] = [];
  const at = (x: number, y: number) => Math.hypot(x - px, y - py);
  for (const c of corpses) {
    if (!c.items.length || c.stage === 'gone') continue;
    const dist = at(c.x, c.y);
    if (dist > radius) continue;
    out.push({ id: `corpse:${c.id}`, kind: 'corpse', name: c.name, by: '', own: false, x: c.x, y: c.y, dist, tiles: Math.max(1, Math.round(dist / TILE)), inReach: dist <= NEARBY_REACH, stage: c.stage, rot: c.rot, age: c.age, items: c.items });
  }
  for (const p of groupPiles(loose)) {
    const dist = at(p.x, p.y);
    if (dist > radius) continue;
    const first = p.drops[0];
    const kind: NearbyKind = p.drops.every(d => d.room) ? 'room' : 'ground';
    const by = p.drops.find(d => d.shared && d.by)?.by ?? '';
    out.push({
      id: `pile:${first.id}`, kind, name: '', by, own: p.drops.every(d => d.own), x: p.x, y: p.y, dist,
      tiles: Math.max(1, Math.round(dist / TILE)), inReach: dist <= NEARBY_REACH, stage: 'pile', rot: 0, age: Infinity, items: p.drops.map(item),
    });
  }
  return out.map((c, i) => ({ c, i })).sort((a, b) => a.c.dist - b.c.dist || a.i - b.i).map(x => x.c);
}

/** A cheap signature: the HUD re-renders only when it changes (the corpseSig pattern). Distances count in tiles. */
export function nearbySig(list: readonly NearbyContainer[]): string {
  return list.map(c => `${c.id}~${c.tiles}~${c.inReach ? 1 : 0}~${c.stage}~${Math.round(c.rot * 10)}~${c.items.map(i => `${i.id}x${i.qty}`).join('.')}`).join('|');
}

/** Split a stack's label "Name ×N" into its name (the ×N is redrawn after a partial take). */
export function stackName(label: string): string { return label.replace(/\s×\d+$/, ''); }
