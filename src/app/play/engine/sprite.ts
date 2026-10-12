/**
 * sprite.ts: draws a world-layer sprite sheet (`spriteFor(id)`, written by
 * scripts/import-assets.py from Assets/Sprites/** and its sidecar JSON).
 *
 * A sheet is a uniform grid: action N is row `row`, frames run left to right,
 * every number in the entry is in logical (1x) px, and the art faces RIGHT.
 * The renderer picks the current frame of an action, draws it with its pivot
 * (the ground contact) on the caller's origin, mirrors it on request, and
 * reports the per-frame hand anchors so held gear rides the painted hand.
 *
 * The frame/anchor math is pure (no DOM) so it is unit-tested directly
 * (scripts/seamworks-engine.test.cjs). The only allocation after warm-up is
 * the hit-flash copy: one white-tinted canvas per (image, row, frame), built
 * the first time that frame flashes and reused forever after.
 *
 * Visual only: nothing here reads or writes combat, loot or economy state.
 */
import type { SpriteAction, SpriteEntry } from '../../shared/art/sprite-manifest.generated';

/**
 * A manifest entry, plus the optional sidecar flag `pixelArt`. The importer
 * does not emit it today (the style guide asks for smooth, anti-aliased
 * sprites); when a sheet carries `pixelArt: true`, image smoothing is turned
 * off and the draw position is snapped to whole pixels.
 */
export type SpriteSheet = SpriteEntry & { pixelArt?: boolean };

const NO_FALLBACKS: readonly string[] = [];

/** A resolved anchor in the caller's frame: pivot-relative 1x px, plus the held item's canvas rotation. */
export interface SpriteAnchor {
  x: number; y: number;
  /** Canvas rotation (radians, clockwise) that turns an item drawn pointing straight up into the authored angle. */
  rotation: number;
  /** False when the frame had no angle (a `[x, y]` point): `rotation` is then 0. */
  angled: boolean;
}
export function createSpriteAnchor(): SpriteAnchor { return { x: 0, y: 0, rotation: 0, angled: false }; }

/**
 * The first action of `wanted`, then each of `fallbacks`, then `idle`, then the
 * sheet's first row that the sheet actually has. null only for a sheet with no
 * actions at all. A test sheet that lists only idle/run/attack still plays every
 * Keeper state: jump falls back to idle, and so on.
 */
export function resolveAction(entry: SpriteEntry, wanted: string | undefined, fallbacks: readonly string[] = NO_FALLBACKS): string | null {
  const actions = entry.actions;
  if (wanted && actions[wanted]) return wanted;
  for (const name of fallbacks) if (actions[name]) return name;
  if (actions['idle']) return 'idle';
  let first: string | null = null, row = Infinity;
  for (const name in actions) if (actions[name].row < row) { row = actions[name].row; first = name; }
  return first;
}

/**
 * The frame shown `seconds` after the action started. Looping actions wrap;
 * one-shots hold their last frame. A still (fps 0) or a single frame is frame 0.
 */
export function frameAt(action: SpriteAction, seconds: number): number {
  const frames = Math.max(1, action.frames | 0);
  if (frames === 1 || !(action.fps > 0) || !(seconds > 0)) return 0;
  const n = Math.floor(seconds * action.fps + 1e-6);
  return action.loop ? n % frames : Math.min(n, frames - 1);
}

/**
 * The frame at `progress` (0..1) through a window whose length the GAME owns,
 * not the sheet's fps: the attack plays its frames across the attack window,
 * the dodge across the dodge. 1 and beyond is the last frame.
 */
export function frameAtProgress(action: SpriteAction, progress: number): number {
  const frames = Math.max(1, action.frames | 0);
  if (!(progress > 0)) return 0;
  return Math.min(frames - 1, Math.floor(progress * frames));
}

/** Seconds one pass of an action takes at its fps (0 for a still). */
export function actionDuration(action: SpriteAction): number {
  return action.fps > 0 ? Math.max(1, action.frames) / action.fps : 0;
}

/**
 * Where an anchor (`hand_front`, `hand_back`, ...) sits on a frame, relative to
 * the pivot, in 1x px, mirrored when the sprite is. The authored angle is
 * degrees clockwise from straight up, which IS a canvas rotation for an item
 * drawn pointing up; a mirror reflects it (θ → -θ). Writes `out`; returns false
 * when the action has no such anchor or the frame is out of range.
 */
export function anchorAt(entry: SpriteEntry, action: string, name: string, frame: number, mirror: boolean, out: SpriteAnchor): boolean {
  const points = entry.actions[action]?.anchors?.[name];
  const point = points?.[frame];
  if (!point) return false;
  const sign = mirror ? -1 : 1;
  out.x = (point[0] - entry.pivotX) * sign;
  out.y = point[1] - entry.pivotY;
  out.angled = point.length > 2;
  out.rotation = out.angled ? (point as readonly [number, number, number])[2] * Math.PI / 180 * sign : 0;
  return true;
}

/** Source rectangle of a frame inside an image whose cells are `imageScale` × the 1x size. */
export interface FrameRect { sx: number; sy: number; sw: number; sh: number }
export function frameRect(entry: SpriteEntry, action: SpriteAction, frame: number, imageScale: number, out: FrameRect): FrameRect {
  const f = Math.max(0, Math.min(Math.max(1, action.frames) - 1, frame | 0));
  out.sw = entry.frameW * imageScale; out.sh = entry.frameH * imageScale;
  out.sx = f * out.sw; out.sy = action.row * out.sh;
  return out;
}

/** Rows in the sheet (one per action). */
export function sheetRows(entry: SpriteEntry): number {
  let rows = 0;
  for (const name in entry.actions) rows = Math.max(rows, entry.actions[name].row + 1);
  return rows;
}

/**
 * The scale of a loaded sheet image relative to the 1x entry (1 for `src`, the
 * authored scale for `src2x`), measured from its height so the renderer never
 * has to be told which file it was given.
 */
export function imageScaleOf(entry: SpriteEntry, imageHeight: number): number {
  const rows = sheetRows(entry);
  if (!rows || !entry.frameH || !(imageHeight > 0)) return 1;
  return imageHeight / (rows * entry.frameH);
}

/** Options for one draw. Read only; callers keep one object and mutate it. */
export interface SpriteDraw {
  /** Uniform draw scale on top of the context's own transform. Default 1. */
  scale?: number;
  /** Mirror around the pivot (the art faces right). */
  mirror?: boolean;
  /** Draw the white hit-flash copy instead of the frame. */
  flash?: boolean;
  /** Extra offset in world px after placement (smear trails, rim light). */
  offsetX?: number; offsetY?: number;
}

/**
 * One sheet bound to its entry. Shared by every figure that uses the sheet
 * (the player and every peer Keeper; every Maw of a kind). Holds no per-figure
 * state: the caller picks the action and frame, the renderer only draws.
 */
export class SpriteRenderer {
  private readonly rect: FrameRect = { sx: 0, sy: 0, sw: 0, sh: 0 };
  /** White silhouettes per image, keyed row * 1024 + frame. Built once per frame on first flash. */
  private readonly flashes = new WeakMap<HTMLImageElement, Map<number, HTMLCanvasElement | null>>();

  constructor(readonly entry: SpriteSheet) {}

  /** Same as resolveAction on this sheet. */
  action(wanted: string | undefined, fallbacks?: readonly string[]): string | null { return resolveAction(this.entry, wanted, fallbacks); }

  /**
   * Draw `frame` of `action` with its pivot on the context's origin. Returns
   * false (and draws nothing) when the image is not loaded or the action is
   * unknown, so the caller can keep its fallback.
   */
  draw(c: CanvasRenderingContext2D, image: HTMLImageElement | undefined, action: string, frame: number, options: SpriteDraw = {}): boolean {
    const entry = this.entry;
    const act = entry.actions[action];
    if (!act || !image?.complete || !image.naturalWidth) return false;
    const imageScale = imageScaleOf(entry, image.naturalHeight);
    const r = frameRect(entry, act, frame, imageScale, this.rect);
    const scale = options.scale ?? 1;
    let dx = -entry.pivotX * scale + (options.offsetX ?? 0);
    let dy = -entry.pivotY * scale + (options.offsetY ?? 0);
    const dw = entry.frameW * scale, dh = entry.frameH * scale;
    const pixel = entry.pixelArt === true;
    if (pixel) { dx = Math.round(dx); dy = Math.round(dy); }
    const smoothing = c.imageSmoothingEnabled;
    if (pixel) c.imageSmoothingEnabled = false;
    if (options.mirror) { c.save(); c.scale(-1, 1); if (options.offsetX) dx -= 2 * options.offsetX; }
    const flash = options.flash ? this.flashFrame(image, act, frame, r) : null;
    if (flash) c.drawImage(flash, 0, 0, flash.width, flash.height, dx, dy, dw, dh);
    else c.drawImage(image, r.sx, r.sy, r.sw, r.sh, dx, dy, dw, dh);
    if (options.mirror) c.restore();
    if (pixel) c.imageSmoothingEnabled = smoothing;
    return true;
  }

  /** The anchor on a frame, pivot-relative, scaled. See anchorAt. */
  anchor(action: string, name: string, frame: number, mirror: boolean, out: SpriteAnchor, scale = 1): boolean {
    if (!anchorAt(this.entry, action, name, frame, mirror, out)) return false;
    out.x *= scale; out.y *= scale;
    return true;
  }

  /**
   * A white-tinted copy of one frame for the hit flash: drawn once with
   * `source-atop` and cached, so a flash costs one drawImage like any frame
   * (no per-frame canvas, no `filter`). null when no canvas can be made (SSR,
   * tests): the caller then draws the plain frame.
   */
  private flashFrame(image: HTMLImageElement, act: SpriteAction, frame: number, r: FrameRect): HTMLCanvasElement | null {
    let byFrame = this.flashes.get(image);
    if (!byFrame) { byFrame = new Map(); this.flashes.set(image, byFrame); }
    const key = act.row * 1024 + frame;
    let canvas = byFrame.get(key);
    if (canvas !== undefined) return canvas;
    canvas = null;
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const made = document.createElement('canvas');
      made.width = Math.max(1, Math.round(r.sw)); made.height = Math.max(1, Math.round(r.sh));
      const fc = made.getContext('2d');
      if (fc) {
        if (this.entry.pixelArt) fc.imageSmoothingEnabled = false;
        fc.drawImage(image, r.sx, r.sy, r.sw, r.sh, 0, 0, made.width, made.height);
        fc.globalCompositeOperation = 'source-atop';
        fc.fillStyle = '#fff4ea';
        fc.fillRect(0, 0, made.width, made.height);
        canvas = made;
      }
    }
    byFrame.set(key, canvas);
    return canvas;
  }
}

/**
 * Per-figure action clock: which action is showing and since when. One-shot
 * actions (jump, hurt, death) need to know when they started; the renderer is
 * shared, so the clock lives with the figure.
 */
export interface SpriteClock { action: string; since: number }
export function createSpriteClock(): SpriteClock { return { action: '', since: 0 }; }
/** Switch the clock to `action` at `now` (no-op while it is unchanged); returns seconds into the action. */
export function tickClock(clock: SpriteClock, action: string, now: number): number {
  if (clock.action !== action) { clock.action = action; clock.since = now; }
  return Math.max(0, now - clock.since);
}

/** Keeper states → the sheet's actions, best first (the brief's action list: idle/run/jump/fall/attack/dodge/hurt/death). */
export const KEEPER_SPRITE_FALLBACKS: Readonly<Record<string, readonly string[]>> = {
  run: ['walk'], jump: ['fall'], fall: ['jump'], dodge: ['run'], hurt: [], death: ['hurt'], rest: ['idle'], attack: [],
};
/** Creature phases → actions (W2: idle/walk/windup/strike/hurt/death). `recover` reads as idle. */
export const CREATURE_SPRITE_FALLBACKS: Readonly<Record<string, readonly string[]>> = {
  walk: [], windup: [], strike: ['attack'], recover: ['idle'], hurt: [], death: ['hurt'],
};
/** NPC states → actions (W3: idle/talk, optional walk). */
export const NPC_SPRITE_FALLBACKS: Readonly<Record<string, readonly string[]>> = { walk: [], talk: [] };

/**
 * The sprite id for an `artFor()` figure key. NPC and townsfolk figures are
 * keyed `npc-kael-figure` / `townsfolk-infernal-figure` in world data (the bare
 * `npc-kael` art key is the menu portrait); their sheets are `NN-npc-kael.png`,
 * so the `-figure` suffix is dropped. The sprite manifest is its own namespace,
 * so `npc-kael` there never collides with the portrait.
 */
export function figureSpriteId(artKey: string): string {
  let id = FIGURE_IDS.get(artKey);
  if (id === undefined) {
    id = artKey.endsWith('-figure') ? artKey.slice(0, -'-figure'.length) : artKey;
    FIGURE_IDS.set(artKey, id);
  }
  return id;
}
/** Memo for figureSpriteId: it runs per figure per frame, and a slice allocates. */
const FIGURE_IDS = new Map<string, string>();
