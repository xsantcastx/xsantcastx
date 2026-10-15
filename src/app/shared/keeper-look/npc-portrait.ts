/**
 * npc-portrait.ts — a person's portrait is their pixel Keeper (one art style).
 *
 * Every speaking face (the dialogue orb, the story line in /play, the welcome
 * screen, the Codex's People of the Realms) used to be a two-letter monogram
 * because nothing had been painted. The towns already draw every named person
 * with the Keeper painter from a fixed look (`NPC_LOOKS`); the portrait is that
 * same figure, idle, cropped to head and shoulders at the Keeper's own 4 world
 * px per art px — so the face in the orb is the face in the street.
 *
 * Glim is not a Keeper: its portrait is its own 12×10 moth (`glim-art.ts`) as
 * crisp SVG. The Nameless has no look on purpose (no face, no name) and keeps
 * its "??" orb, as does anyone without a look.
 *
 * Browser only for Keepers (canvas → PNG data URL, built once per id and cached
 * for the session); null under SSR, where callers keep the monogram. Callers in
 * the eager shell import this module lazily so the painter never joins the
 * initial bundle.
 */
import { KeeperPainter } from './keeper-paint';
import { NPC_LOOKS } from './npc-looks';
import { GLIM_H, GLIM_PALETTE, GLIM_W, glimRows } from '../glim/glim-art';

/**
 * Head and shoulders, in art px of the 48×48 Keeper cell, for the chibi Keeper
 * (keeper-paint.ts: head rows 19–32, shoulders 33–38; hats reach row 11 and
 * Aureth's shards row 9).
 */
export const PORTRAIT_CROP = { x: 9, y: 9, size: 30 } as const;
/** World px per art px: the Keeper's town scale, so a portrait shares the street's pixel. */
export const PORTRAIT_SCALE = 4;

const cache = new Map<string, string | null>();

/** True when `id` has a pixel portrait (a Keeper look, or Glim). Pure. */
export function hasPortrait(id: string | null | undefined): boolean {
  return !!id && (id === 'glim' || !!NPC_LOOKS[id]);
}

/** The portrait of a town person or speaking NPC as an image URL, or null (SSR, no look). */
export function npcPortrait(id: string | null | undefined): string | null {
  if (!id) return null;
  const hit = cache.get(id);
  if (hit !== undefined) return hit;
  let url: string | null = null;
  if (id === 'glim') url = glimPortrait();
  else if (NPC_LOOKS[id] && typeof document !== 'undefined') url = keeperPortrait(id);
  else if (NPC_LOOKS[id]) return null; // SSR: do not cache, the browser will paint it
  cache.set(id, url);
  return url;
}

function keeperPortrait(id: string): string | null {
  const npc = NPC_LOOKS[id];
  try {
    const el = document.createElement('canvas');
    el.width = el.height = PORTRAIT_CROP.size * PORTRAIT_SCALE;
    new KeeperPainter(npc.look, npc.gear, npc.garb).still(el, PORTRAIT_CROP);
    return el.toDataURL('image/png');
  } catch {
    return null;
  }
}

/** Glim's moth, centred in a 16-art-px square, as crisp SVG (pure; renders under SSR too). */
function glimPortrait(): string {
  const rows = glimRows('mid');
  const ox = (16 - GLIM_W) / 2, oy = (16 - GLIM_H) / 2 + 1;
  const rects: string[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const fill = GLIM_PALETTE[row[x]];
      if (fill) rects.push(`<rect x="${x + ox}" y="${y + oy}" width="1" height="1" fill="${fill}"/>`);
    }
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="64" height="64" shape-rendering="crispEdges">${rects.join('')}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
