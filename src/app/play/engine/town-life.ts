/**
 * town-life.ts: draws the people of a town (world/life.ts) and keeps them moving.
 *
 *  - Keepers stand beside their stations, breathe, turn to face the Keeper
 *    when near, and say one line on approach (a speech bubble, i18n'd).
 *  - Townsfolk wander their own open-floor segments with pauses.
 *
 * A painted figure (an `artFor()` key that resolves) is bent by a small
 * humanoid rig (rig.ts). Until then a placeholder is drawn in code: a robed,
 * hooded, aproned or coated figure in the realm palette with a dark outline,
 * driven by the SAME pose array, so when the art lands the motion is already
 * tuned. Off-camera figures are culled; nothing allocates per frame after the
 * town is entered (bubble text is wrapped once, when a line starts).
 *
 * Visual only: reads the Keeper's x, never writes combat, loot or economy state.
 */
import { createPose, POSE_STRIDE, resetPose, RigSpec, RigSprite } from './rig';
import { figureSpriteId, frameAt, NPC_SPRITE_FALLBACKS, SpriteRenderer } from './sprite';
import { FLOOR } from './engine.model';
import {
  CHATTER_SHOW, FACE_RANGE, KeeperChatter, keeperAt, KeeperPlacement, LifePalette, LifeSilhouette, onScreen, placeKeepers, TownsfolkCrowd, townsfolkArt,
} from '../world/life';
import { EMPTY_KEEPER_CONTEXT, KeeperContext, keeperLines } from '../world/keeper-lines';
import { materialDisplay } from '../../shared/rpg/material-catalog';
import type { AreaDef, StationDef, TownDef } from '../world/world.model';
import { KeeperPainter } from '../../shared/keeper-look/keeper-paint';
import { NPC_LOOKS, townsfolkLook } from '../../shared/keeper-look/npc-looks';
import type { KeeperAction } from '../../shared/keeper-look/keeper-gear';

/** Humanoid bones for a standing NPC painting that faces right (the commission's three-quarter view). */
export const NPC = { ROOT: 0, HIPS: 1, CHEST: 2, HEAD: 3, ARM_F: 4, ARM_B: 5 } as const;
export const NPC_RIG: RigSpec = {
  cols: [0, .25, .4, .5, .6, .75, 1],
  rows: [0, .14, .26, .38, .5, .64, .8, 1],
  bones: [
    { name: 'root', parent: -1, px: .5, py: .97, ax: 0, ay: 0, bx: 0, by: 0, r: 0 },
    { name: 'hips', parent: 0, px: .5, py: .62, ax: .4, ay: .6, bx: .6, by: .95, r: .16 },
    { name: 'chest', parent: 1, px: .5, py: .5, ax: .42, ay: .28, bx: .58, by: .5, r: .13 },
    { name: 'head', parent: 2, px: .5, py: .24, ax: .45, ay: .04, bx: .55, by: .2, r: .1 },
    { name: 'armFront', parent: 2, px: .6, py: .3, ax: .63, ay: .32, bx: .68, by: .56, r: .07 },
    { name: 'armBack', parent: 2, px: .4, py: .3, ax: .37, ay: .32, bx: .33, by: .56, r: .07 },
  ],
};

function add(pose: Float32Array, bone: number, rot = 0, tx = 0, ty = 0, sx = 1, sy = 1): void {
  const o = bone * POSE_STRIDE;
  pose[o] += rot; pose[o + 1] += tx; pose[o + 2] += ty; pose[o + 3] *= sx; pose[o + 4] *= sy;
}

/**
 * Idle breath, a slow weight shift and a glance; walking adds a step bob and
 * an arm swing. `look` (-1..1) tips the head toward whoever it is facing.
 * Reduced motion: the rest pose (a still figure, not an absent one).
 */
export function poseNpc(pose: Float32Array, time: number, seed: number, walk: number, walking: boolean, look: number, reduced: boolean): void {
  resetPose(pose);
  if (reduced) return;
  const t = time + seed;
  const breath = Math.sin(t * 2.1);
  add(pose, NPC.CHEST, 0, 0, -breath * .004, 1 + breath * .01, 1 + breath * .016);
  add(pose, NPC.HIPS, Math.sin(t * .55) * .025);
  add(pose, NPC.HEAD, Math.sin(t * .8 + 1.3) * .05 + look * .08);
  add(pose, NPC.ARM_F, Math.sin(t * 1.05) * .05);
  add(pose, NPC.ARM_B, -Math.sin(t * 1.05) * .04);
  if (walking) {
    const s = Math.sin(walk);
    add(pose, NPC.ROOT, 0, 0, -Math.abs(s) * .025);
    add(pose, NPC.HIPS, s * .05);
    add(pose, NPC.ARM_F, s * .35); add(pose, NPC.ARM_B, -s * .35);
  }
}

/** What the renderer needs from the engine each frame. Mutated in place, never reallocated. */
export interface LifeFrame {
  camera: number;
  viewport: number;
  time: number;
  reduced: boolean;
  playerX: number;
  pixelScale: number;
  /** A loaded image for an `artFor()` key, or undefined while absent. */
  image: (key: string) => HTMLImageElement | undefined;
  /** i18n lookup; the key's English fallback lives in world/life.ts. */
  translate: (key: string) => string;
  /**
   * A world-layer sprite sheet by sprite id when it exists and has loaded, else
   * null; `spriteImage()` is then the image it chose. Absent (tests) or null:
   * the painted rig or the placeholder draws, exactly as before sprites.
   */
  sprite?: (id: string) => SpriteRenderer | null;
  spriteImage?: () => HTMLImageElement | undefined;
}

/** Draw box of a keeper's painting, feet at the origin. Townsfolk use the same box scaled down. */
const BOX = { x: -64, y: -172, w: 128, h: 172 };
/** World px per art pixel for a town figure: the Keeper's own (keeper-paint.ts, docs/art/style-guide.md §2). */
export const FIGURE_PIXEL = 4;
const OUTLINE = '#1a1020';
const TAG_FONT = '600 14px "Cormorant Garamond", Georgia, serif';
/** The subtitle under a person's name: their role title (or a canon epithet). */
const TITLE_FONT = 'italic 600 11px "Cormorant Garamond", Georgia, serif';
/** Clear canvas left between a name tag's plate and the viewport edge, world px. */
const TAG_EDGE = 4;
const BUBBLE_FONT = '600 15px "Cormorant Garamond", Georgia, serif';
const BUBBLE_MAX = 250;

/** Silhouette proportions: hem and shoulder half-widths, shoulder height. */
const SHAPE: Readonly<Record<LifeSilhouette, { hem: number; shoulder: number; top: number }>> = {
  robe: { hem: 30, shoulder: 18, top: 108 },
  hood: { hem: 28, shoulder: 17, top: 110 },
  smith: { hem: 26, shoulder: 25, top: 102 },
  coat: { hem: 24, shoulder: 19, top: 106 },
};

export class TownLife {
  private placements: KeeperPlacement[] = [];
  private crowd: TownsfolkCrowd | null = null;
  private chatter: KeeperChatter | null = null;
  /**
   * What each keeper says to this Keeper: `keeperLines()` for the story beats
   * and station deeds in `context` (keeper-lines.ts). Index-aligned with the
   * placements; the chatter reads `def.lines` off these.
   */
  private voices: { x: number; def: { lines: readonly string[] } }[] = [];
  private context: KeeperContext = EMPTY_KEEPER_CONTEXT;
  /** Townsfolk speak too, one line each; a keeper's line wins when both start. */
  private folkChatter: KeeperChatter | null = null;
  /** Smoothed facing per keeper, -1..1 (passes through 0 as it turns). */
  private facing = new Float32Array(0);
  private tagText: string[] = [];
  private tagTitle: string[] = [];
  private tagWidth = new Float32Array(0);
  /** The bubble's wrapped lines and width, set when a line starts. */
  private bubble: string[] = [];
  private bubbleWidth = 0;
  private bubbleFor = -1;
  private bubbleKey = '';
  private readonly scratch = createPose(NPC_RIG.bones.length);
  private readonly rigs = new Map<string, RigSprite>();
  private realmArt = '';
  /**
   * The pixel figures (one art style, npc-looks.ts): index-aligned with the
   * placements and the crowd. Built on entry; their frames are painted on first
   * draw and cached. Empty without a DOM (SSR, the node harness), where the
   * sheet / rig / placeholder paths below still draw.
   */
  private keeperPainters: (KeeperPainter | null)[] = [];
  private folkPainters: (KeeperPainter | null)[] = [];
  private readonly heightPainters = new Map<string, KeeperPainter | null>();

  /** Keepers in the current area (empty outside towns). Read by tests and the host. */
  get keepers(): readonly KeeperPlacement[] { return this.placements; }
  get townsfolk(): TownsfolkCrowd | null { return this.crowd; }
  /** The line being spoken (an i18n key), or '' when nobody is talking. */
  get speaking(): { keeper: string; line: string } | null {
    const c = this.chatter;
    return c && c.speaker >= 0 ? { keeper: this.placements[c.speaker].def.id, line: c.line } : null;
  }
  /** The townsperson speaking (index into `townsfolk.folk`), or -1. */
  get townsfolkSpeaking(): number { return this.folkChatter?.speaker ?? -1; }

  /** Populate a town, or clear the stage in a hunt, delve or homestead. Allocates; called on area entry only. */
  enter(area: AreaDef, town: TownDef): void {
    if (area !== town) {
      this.placements = []; this.crowd = null; this.chatter = null; this.folkChatter = null; this.facing = new Float32Array(0);
      this.voices = []; this.tagText = []; this.tagTitle = []; this.tagWidth = new Float32Array(0); this.bubbleFor = -1;
      return;
    }
    this.placements = placeKeepers(town);
    this.crowd = new TownsfolkCrowd(town, this.placements);
    this.voices = this.placements.map(p => ({ x: p.x, def: { lines: keeperLines(p.def.id, this.context) } }));
    this.chatter = new KeeperChatter(this.voices);
    this.folkChatter = new KeeperChatter(this.crowd.folk);
    this.facing = new Float32Array(this.placements.length);
    this.placements.forEach((p, i) => { this.facing[i] = Math.sign(p.station.x - p.x) || 1; });
    this.tagText = this.placements.map(() => '');
    this.tagTitle = this.placements.map(() => '');
    this.tagWidth = new Float32Array(this.placements.length);
    this.bubbleFor = -1;
    this.realmArt = townsfolkArt(town.realm);
    this.keeperPainters = this.placements.map(p => painterFor(p.def.id));
    this.folkPainters = this.crowd.folk.map((p, i) => canPaint()
      ? (({ look, gear, garb }) => new KeeperPainter(look, gear, garb))(townsfolkLook(`${town.id}:${i}`, p.palette, p.silhouette))
      : null);
  }

  /**
   * The Keeper's story beats and station deeds changed: re-read each keeper's
   * pool. A keeper whose pool changed starts again from the top, so the line
   * about what just happened is the next thing it says. Allocates only when
   * something changed (the host calls this when its signature changes).
   */
  setContext(context: KeeperContext): void {
    this.context = context;
    for (let i = 0; i < this.voices.length; i++) {
      const lines = keeperLines(this.placements[i].def.id, context);
      const before = this.voices[i].def.lines;
      if (lines.length === before.length && lines.every((key, n) => key === before[n])) continue;
      this.voices[i].def.lines = lines;
      this.chatter?.restart(i);
    }
  }

  /** The station a click on a keeper should open, or null. */
  stationAt(x: number, y: number): StationDef | null {
    return keeperAt(this.placements, x, y, FLOOR)?.station ?? null;
  }

  /** One fixed step. */
  update(dt: number, playerX: number, time: number): void {
    this.clock = time;
    this.crowd?.update(dt, playerX);
    this.chatter?.update(playerX, time);
    this.folkChatter?.update(playerX, time);
    const blend = Math.min(1, dt * 7);
    for (let i = 0; i < this.placements.length; i++) {
      const p = this.placements[i];
      const dx = playerX - p.x;
      const want = Math.abs(dx) < FACE_RANGE ? (Math.sign(dx) || 1) : (Math.sign(p.station.x - p.x) || 1);
      this.facing[i] += (want - this.facing[i]) * blend;
    }
  }

  draw(c: CanvasRenderingContext2D, f: LifeFrame): void {
    const crowd = this.crowd;
    if (crowd) {
      for (let n = 0; n < crowd.folk.length; n++) {
        const p = crowd.folk[n];
        if (!onScreen(p.x, f.camera, f.viewport)) continue;
        const walking = p.pause <= 0;
        this.figure(c, f, this.realmArt, p.x, p.facing, p.build * .86, p.palette, p.silhouette, p.seed, p.step, walking, 0, .92, walking ? 'walk' : 'idle', this.folkPainters[n] ?? null);
      }
    }
    for (let i = 0; i < this.placements.length; i++) {
      const p = this.placements[i];
      if (!onScreen(p.x, f.camera, f.viewport)) continue;
      const face = this.facing[i];
      const look = Math.abs(f.playerX - p.x) < FACE_RANGE ? 1 : 0;
      // Turning reads as a narrowing through edge-on: scale x by the smoothed facing, never below a sliver.
      const sx = Math.sign(face || 1) * Math.max(.18, Math.abs(face));
      const talking = this.chatter?.speaker === i;
      this.figure(c, f, p.def.art, p.x, sx, 1, p.def.palette, p.def.silhouette, i * 1.7, 0, false, look, 1, talking ? 'talk' : 'idle', this.keeperPainters[i]);
      this.nameTag(c, f, i, p);
    }
    this.speech(c, f);
  }

  /** A person standing on high ground (world/heights.ts): the same figure, feet at (x, y). */
  drawAt(c: CanvasRenderingContext2D, f: LifeFrame, art: string, x: number, y: number, facing: number, palette: LifePalette, shape: LifeSilhouette, seed: number, talking: boolean): void {
    c.save(); c.translate(0, y - FLOOR);
    const id = art.replace(/^npc-/, '').replace(/-figure$/, '');
    if (!this.heightPainters.has(id)) this.heightPainters.set(id, painterFor(id));
    this.figure(c, f, art, x, facing, 1, palette, shape, seed, 0, false, 1, 1, talking ? 'talk' : 'idle', this.heightPainters.get(id) ?? null);
    c.restore();
  }
  /** One figure, feet on the floor at x. Painted through the rig when its art resolves; the placeholder otherwise. */
  private figure(c: CanvasRenderingContext2D, f: LifeFrame, art: string, x: number, facing: number, scale: number, palette: LifePalette,
    shape: LifeSilhouette, seed: number, step: number, walking: boolean, look: number, alpha: number, state: 'idle' | 'walk' | 'talk' = 'idle',
    painter: KeeperPainter | null = null): void {
    c.save();
    c.globalAlpha = .28 * alpha; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(x, FLOOR + 2, 30 * scale, 7 * scale, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = alpha;
    if (painter) {
      // The pixel figure: the Keeper's own scale and outline, whole pixels, flipped (never squeezed) to turn.
      c.translate(Math.round(x), FLOOR); c.scale(facing < 0 ? -1 : 1, 1);
      const action: KeeperAction = state === 'walk' && !f.reduced ? 'walk' : state === 'talk' && !f.reduced ? 'talk' : 'idle';
      painter.draw(c, FIGURE_PIXEL, { action, time: action === 'walk' ? step * 1.6 : f.time + seed, attackT: 0, reduced: f.reduced, weapon: true });
      c.restore();
      return;
    }
    c.translate(x, FLOOR); c.scale(facing * scale, scale);
    // A sprite sheet (W3: idle/talk, optional walk) faces right like the painting; frames replace the rig.
    const sheet = f.sprite?.(figureSpriteId(art)) ?? null;
    const sheetImage = sheet ? f.spriteImage?.() : undefined;
    if (sheet && sheetImage) {
      const action = sheet.action(state, NPC_SPRITE_FALLBACKS[state]);
      const act = action ? sheet.entry.actions[action] : undefined;
      if (action && act && sheet.draw(c, sheetImage, action, f.reduced ? 0 : frameAt(act, f.time + seed))) { c.restore(); return; }
    }
    const image = f.image(art);
    if (image?.complete && image.naturalWidth) {
      let rig = this.rigs.get(art);
      if (!rig) { rig = new RigSprite(NPC_RIG); this.rigs.set(art, rig); }
      poseNpc(rig.pose, f.time, seed, step, walking, look, f.reduced);
      if (rig.render(image, BOX.x, BOX.y, BOX.w, BOX.h, f.pixelScale * scale)) { rig.blit(c); c.restore(); return; }
    }
    poseNpc(this.scratch, f.time, seed, step, walking, look, f.reduced);
    placeholder(c, this.scratch, palette, shape);
    c.restore();
  }

  private nameTag(c: CanvasRenderingContext2D, f: LifeFrame, i: number, p: KeeperPlacement): void {
    const text = f.translate(p.def.nameKey);
    const name = text === p.def.nameKey ? p.def.name : text;
    // A person's role title (or a canon epithet) rides under the name, smaller.
    const titled = p.def.titleKey ? f.translate(p.def.titleKey) : '';
    const title = !p.def.titleKey ? '' : titled === p.def.titleKey ? p.def.title ?? '' : titled;
    c.save();
    c.textAlign = 'center';
    if (this.tagText[i] !== name || this.tagTitle[i] !== title) {
      this.tagText[i] = name; this.tagTitle[i] = title;
      c.font = TAG_FONT;
      let w = c.measureText(name).width;
      if (title) { c.font = TITLE_FONT; w = Math.max(w, c.measureText(title).width); }
      this.tagWidth[i] = Math.min(200, w + 20);
    }
    // The plate sits just over the chibi head (its own top: hat, hood, shards), else over the painting.
    const h = title ? 35 : 22, w = this.tagWidth[i], y = tagBottom(this.keeperPainters[i]) - h;
    // Keep the plate inside the visible canvas: a keeper near the edge (or
    // walking off it) keeps a readable tag pinned to that edge instead of a
    // half-cut one. Once the keeper is no longer under its pinned plate at all,
    // the tag goes with it.
    const lo = f.camera + w / 2 + TAG_EDGE, hi = f.camera + f.viewport - w / 2 - TAG_EDGE;
    const x = lo > hi ? p.x : Math.min(hi, Math.max(lo, p.x));
    if (Math.abs(x - p.x) > w / 2) { c.restore(); return; }
    c.fillStyle = '#1a120fe6'; c.fillRect(x - w / 2, y, w, h);
    c.fillStyle = p.def.palette.glow; c.fillRect(x - w / 2, y + h - 2, w, 2);
    c.font = TAG_FONT; c.fillStyle = '#ffe1b0'; c.fillText(name, x, y + 16, 190);
    if (title) { c.font = TITLE_FONT; c.fillStyle = '#d9bf98'; c.fillText(title, x, y + 30, 190); }
    c.restore();
  }

  /** The current speaker's line, wrapped once when it starts, fading in and out. */
  private speech(c: CanvasRenderingContext2D, f: LifeFrame): void {
    // A keeper's line first; otherwise a townsperson's (indexed past the keepers).
    const keeper = this.chatter && this.chatter.speaker >= 0;
    const chatter = keeper ? this.chatter : this.folkChatter;
    if (!chatter || chatter.speaker < 0) return;
    const folk = keeper ? undefined : this.crowd?.folk[chatter.speaker];
    const p = keeper ? this.placements[chatter.speaker] : folk;
    if (!p || !onScreen(p.x, f.camera, f.viewport, 200)) return;
    const who = keeper ? chatter.speaker : this.placements.length + chatter.speaker;
    c.save();
    c.font = BUBBLE_FONT; c.textAlign = 'center';
    if (this.bubbleFor !== who || this.bubbleKey !== chatter.line + chatter.at) {
      this.bubbleFor = who; this.bubbleKey = chatter.line + chatter.at;
      let text = f.translate(chatter.line);
      if (folk?.says && text !== chatter.line) {
        text = text.replace('{{material}}', materialDisplay(folk.says.material)?.name ?? folk.says.material).replace('{{place}}', folk.says.place);
      }
      this.bubble = wrap(c, text === chatter.line ? '' : text, BUBBLE_MAX);
      this.bubbleWidth = this.bubble.reduce((w, line) => Math.max(w, c.measureText(line).width), 0) + 24;
    }
    if (!this.bubble.length) { c.restore(); return; }
    const age = this.clock - chatter.at;
    const fade = f.reduced ? 1 : Math.min(1, age * 4, (CHATTER_SHOW - age) * 3);
    c.globalAlpha = Math.max(0, fade);
    const h = this.bubble.length * 19 + 10, w = this.bubbleWidth;
    const x = Math.max(f.camera + w / 2 + 8, Math.min(f.camera + f.viewport - w / 2 - 8, p.x));
    // Over the name plate for a keeper; just over the head for a townsperson (who wears no plate).
    const y = keeper ? tagBottom(this.keeperPainters[chatter.speaker]) - 35 - 10 - h
      : tagBottom(this.folkPainters[chatter.speaker]) - 10 - h;
    c.fillStyle = '#fff6ea'; c.beginPath();
    if (typeof c.roundRect === 'function') c.roundRect(x - w / 2, y, w, h, 8); else c.rect(x - w / 2, y, w, h);
    c.fill();
    c.beginPath(); c.moveTo(p.x - 7, y + h - 1); c.lineTo(p.x + 7, y + h - 1); c.lineTo(p.x, y + h + 8); c.closePath(); c.fill();
    c.fillStyle = '#2a1c16';
    for (let n = 0; n < this.bubble.length; n++) c.fillText(this.bubble[n], x, y + 19 + n * 19);
    c.restore();
  }
  /** The chatter clock: engine elapsed seconds, kept here because the frame's time is 0 under reduced motion. */
  private clock = 0;
}

/** Greedy word wrap into at most three lines. Runs once per spoken line. */
function wrap(c: CanvasRenderingContext2D, text: string, max: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && c.measureText(next).width > max) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

/**
 * The placeholder figure, facing right, feet at the origin: a body in the
 * realm palette, shaded on its far side, with trim, a sleeve, a head (or a
 * hood with a glint of eyes) and a dark violet-black outline. The pose array
 * drives breath (chest scale), the head's tilt, the sleeve and a step bob.
 */
function placeholder(c: CanvasRenderingContext2D, pose: Float32Array, palette: LifePalette, shape: LifeSilhouette): void {
  const s = SHAPE[shape];
  const U = BOX.w;
  const bob = pose[NPC.ROOT * POSE_STRIDE + 2] * U;
  const breathY = pose[NPC.CHEST * POSE_STRIDE + 4] * pose[NPC.HIPS * POSE_STRIDE + 4];
  const breathX = pose[NPC.CHEST * POSE_STRIDE + 3];
  const lean = pose[NPC.HIPS * POSE_STRIDE];
  const head = pose[NPC.HEAD * POSE_STRIDE];
  const arm = pose[NPC.ARM_F * POSE_STRIDE];
  const top = s.top * breathY;
  const sh = s.shoulder * breathX;
  const tipX = Math.sin(lean) * top;
  c.translate(0, bob);
  c.lineJoin = 'round';
  // Body.
  c.beginPath();
  c.moveTo(-s.hem, 0);
  c.quadraticCurveTo(-s.hem - 4, -top * .5, -sh + tipX, -top);
  c.lineTo(sh + tipX, -top);
  c.quadraticCurveTo(s.hem + 4, -top * .5, s.hem, 0);
  c.quadraticCurveTo(0, 5, -s.hem, 0);
  c.closePath();
  c.fillStyle = palette.robe; c.fill();
  c.strokeStyle = OUTLINE; c.lineWidth = 2.5; c.stroke();
  // Far-side shade (the light comes from the upper left of the canvas).
  c.save(); c.clip();
  c.fillStyle = palette.shade; c.globalAlpha *= .75;
  c.beginPath(); c.moveTo(4 + tipX * .5, -top); c.lineTo(s.hem + 8, -top); c.lineTo(s.hem + 8, 4); c.lineTo(8, 4); c.closePath(); c.fill();
  c.restore();
  // Trim: hem band, and per shape a sash, an apron or a coat front.
  c.strokeStyle = palette.trim; c.lineWidth = 3;
  c.beginPath(); c.moveTo(-s.hem + 3, -5); c.quadraticCurveTo(0, 0, s.hem - 3, -5); c.stroke();
  if (shape === 'smith') {
    c.fillStyle = palette.trim; c.globalAlpha *= .85;
    c.fillRect(-12 + tipX * .4, -top * .62, 24, top * .56);
    c.globalAlpha /= .85;
  } else if (shape === 'coat') {
    c.beginPath(); c.moveTo(tipX * .9 + 2, -top + 4); c.lineTo(3, -4); c.stroke();
    c.fillStyle = palette.trim; c.fillRect(-s.hem * .7 + tipX * .45, -top * .48, s.hem * 1.4, 4);
  } else {
    c.beginPath(); c.moveTo(-sh + tipX + 3, -top + 6); c.lineTo(sh * .6 + tipX * .6, -top * .45); c.stroke();
  }
  // Front sleeve, swinging from the shoulder.
  c.save();
  c.translate(sh * .7 + tipX, -top + 6); c.rotate(-arm * 1.4);
  c.beginPath(); c.moveTo(-6, 0); c.lineTo(7, 0); c.lineTo(9, top * .44); c.lineTo(-4, top * .44); c.closePath();
  c.fillStyle = palette.robe; c.fill(); c.strokeStyle = OUTLINE; c.lineWidth = 2; c.stroke();
  c.fillStyle = palette.skin; c.beginPath(); c.arc(3, top * .44 + 4, 5, 0, Math.PI * 2); c.fill(); c.stroke();
  c.restore();
  // Head on the neck, tilted by the pose.
  c.save();
  c.translate(tipX + 2, -top); c.rotate(head);
  if (shape === 'hood') {
    c.beginPath(); c.moveTo(-17, 4); c.quadraticCurveTo(-18, -26, 2, -38); c.quadraticCurveTo(20, -24, 17, 4); c.closePath();
    c.fillStyle = palette.robe; c.fill(); c.strokeStyle = OUTLINE; c.lineWidth = 2.5; c.stroke();
    c.fillStyle = palette.shade; c.beginPath(); c.ellipse(5, -12, 9, 11, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = palette.glow; c.fillRect(4, -14, 3, 2); c.fillRect(10, -14, 3, 2);
  } else {
    c.fillStyle = palette.skin; c.beginPath(); c.arc(3, -15, 14, 0, Math.PI * 2); c.fill();
    c.strokeStyle = OUTLINE; c.lineWidth = 2.5; c.stroke();
    c.fillStyle = OUTLINE; c.fillRect(9, -18, 3, 3);
    // Collar in the trim colour.
    c.strokeStyle = palette.trim; c.lineWidth = 3; c.beginPath(); c.moveTo(-10, 2); c.quadraticCurveTo(3, 7, 14, 2); c.stroke();
  }
  c.restore();
}

/**
 * The bottom of a person's name plate (world y): a few px over the pixel
 * figure's own top (keeper-paint.ts `top`), or where it sat over the 172 px
 * painting when there is no pixel figure.
 */
function tagBottom(painter: KeeperPainter | null | undefined): number {
  return painter ? FLOOR - painter.top * FIGURE_PIXEL - 8 : FLOOR - 161;
}

function canPaint(): boolean {
  return typeof document !== 'undefined' && typeof document.createElement === 'function';
}
/** A named person's pixel figure (npc-looks.ts), or null (no look written, or no DOM). */
function painterFor(id: string): KeeperPainter | null {
  const npc = NPC_LOOKS[id];
  return npc && canPaint() ? new KeeperPainter(npc.look, npc.gear, npc.garb) : null;
}
