/**
 * td-mobs.ts — monsters, fighting and ground loot in the top-down world (owner, 2026-10-19: "dungeons and mysterious
 * places, items drops monsters like if it was tibia style").
 *
 * Tibia's rules, cozy-sized: creatures roam near where they spawned and chase the Keeper on sight; the Keeper fights by
 * targeting one (a tap on it, or the attack key for the nearest) and swings while in reach; damage floats up in numbers;
 * a kill leaves its loot ON THE GROUND (coins, materials, rolled gear glowing in its rarity colour) to walk over and
 * pick up. A spawn comes back a while after its creature falls. Falling in a fight wakes the Keeper in the square.
 *
 * The host does the bookkeeping exactly as the side view did: onKill (Hunting XP, quests), rollLoot (gear) and onLoot
 * (into the satchel). Nothing here touches a save.
 */
import type { EngineOptions, LootRow } from '../engine/engine.model';
import type { LootRarity } from '../world/world.model';
import { TILE } from './td-art';
import { CRIT_MULT, MANA_REGEN, MAX_MANA, SKILLS, defenseReduction, type SkillId } from './td-skills';

export interface MobDef {
  id: string;
  name: string;
  hp: number;
  /** Art px per second. */
  speed: number;
  dmg: [number, number];
  /** Seconds between its bites. */
  rate: number;
  sight: number;
  level: number;
  /** One line of the world's voice for the Bestiary (td-bestiary.ts). */
  lore?: string;
  coins: [number, number];
  drops: readonly { material: string; qty: number; chance: number }[];
  paint: (c: CanvasRenderingContext2D, frame: number) => void;
  w: number;
  h: number;
  /** Loot rank (shared/loot): a boss rolls more and better gear. Default 'normal'. */
  rank?: 'normal' | 'champion' | 'unique' | 'boss';
  /**
   * It shoots (a bone arrow, a fire bolt, a breath): within `range` art px it looses a shot every `rate` s that flies
   * straight at where its prey stood, so stepping aside dodges it; it backs off to stay `keep` px away (0: it closes in
   * and shoots as it comes). `spread` shots fan out (a breath).
   */
  ranged?: { range: number; keep: number; rate: number; dmg: [number, number]; speed: number; kind: MobShot['kind']; spread?: number };
  /** It drifts over lava and embers as if they were floor (a wraith). */
  floats?: boolean;
  /** Half there: drawn see-through, flickering. */
  ghost?: boolean;
  /** Once, when its life falls to `at` of its whole, it calls `count` of `type` to its side. */
  summon?: { type: string; count: number; at: number };
}

function px(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string): void { c.fillStyle = col; c.fillRect(x, y, w, h); }

/** The Rivet Maw: a rust-iron jaw on stubby legs, rivets for teeth. */
function paintMaw(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 1 : 0;
  px(c, 3, 13 - b, 3, 3, '#3a2a24'); px(c, 14, 13 + b - 1, 3, 3, '#3a2a24');
  px(c, 2, 4 + b, 16, 10, '#8a5a3c'); px(c, 2, 4 + b, 16, 3, '#b07a4e'); px(c, 2, 12 + b, 16, 2, '#5e3a28');
  px(c, 4, 9 + b, 12, 3, '#2a1a1c');
  for (let i = 0; i < 4; i++) { px(c, 5 + i * 3, 9 + b, 1, 1, '#e9e4d8'); px(c, 6 + i * 3, 11 + b, 1, 1, '#e9e4d8'); }
  px(c, 5, 6 + b, 2, 2, '#ffd25a'); px(c, 13, 6 + b, 2, 2, '#ffd25a');
  px(c, 1, 5 + b, 1, 2, '#c99a6a'); px(c, 18, 5 + b, 1, 2, '#c99a6a');
}
/** The Cinder Bailiff: a hooded ember-golem with a lantern belly. */
function paintBailiff(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 1 : 0;
  px(c, 5, 20, 4, 4, '#2a2028'); px(c, 13, 20, 4, 4, '#2a2028');
  px(c, 3, 7 + b, 16, 14, '#4a3a44'); px(c, 3, 7 + b, 16, 2, '#6a5562');
  px(c, 7, 12 + b, 8, 6, '#2a1a1c'); px(c, 8, 13 + b, 6, 4, '#ff8a2e'); px(c, 9, 14 + b, 4, 2, '#ffd25a');
  px(c, 5, 1 + b, 12, 7, '#3a2c36'); px(c, 7, 4 + b, 2, 2, '#ff6a2a'); px(c, 13, 4 + b, 2, 2, '#ff6a2a');
  px(c, 1, 9 + b, 2, 8, '#4a3a44'); px(c, 19, 9 - b + 1, 2, 8, '#4a3a44');
}

/** The Ash Wolf: a lean grey-ember wolf of the Emberwood. */
function paintWolf(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 1 : 0;
  px(c, 3, 13, 2, 4 - b, '#3a3236'); px(c, 15, 13, 2, 3 + b, '#3a3236'); px(c, 6, 14, 2, 3, '#3a3236'); px(c, 12, 14, 2, 3, '#3a3236');
  px(c, 3, 7, 15, 7, '#6a5f66'); px(c, 3, 7, 15, 2, '#8a7f86'); px(c, 3, 12, 15, 2, '#4a4248');
  px(c, 15, 3 + b, 6, 6, '#6a5f66'); px(c, 15, 2 + b, 2, 2, '#4a4248'); px(c, 19, 2 + b, 2, 2, '#4a4248'); px(c, 20, 6 + b, 2, 2, '#2a2226');
  px(c, 17, 5 + b, 1, 1, '#ff8a2e'); px(c, 0, 6 - b, 4, 2, '#8a7f86'); px(c, 1, 5 - b, 2, 1, '#ff8a2e');
}
/** The Cinder Imp: a small horned ember-imp with bat wings. */
function paintImp(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 2 : 0;
  px(c, 0, 4 + b, 5, 6, '#7a2a1c'); px(c, 15, 4 + b, 5, 6, '#7a2a1c'); px(c, 1, 5 + b, 3, 4, '#a83a24');
  px(c, 5, 5, 10, 11, '#c8432a'); px(c, 5, 5, 10, 2, '#e8633a'); px(c, 6, 15, 3, 3, '#7a2a1c'); px(c, 11, 15, 3, 3, '#7a2a1c');
  px(c, 6, 2, 2, 3, '#2a1a1c'); px(c, 12, 2, 2, 3, '#2a1a1c'); px(c, 7, 8, 2, 2, '#ffd25a'); px(c, 11, 8, 2, 2, '#ffd25a'); px(c, 8, 12, 4, 1, '#2a1a1c');
}

/** The Ember Warden, the Ember Mine's keeper: a towering Bailiff crowned in slag, its lantern a furnace. */
function paintWarden(c: CanvasRenderingContext2D, f: number): void {
  c.save(); c.scale(1.7, 1.7); paintBailiff(c, f); c.restore();
  px(c, 10, 0, 18, 4, '#2a1a1c'); px(c, 12, 0, 3, 2, '#ff8a2e'); px(c, 18, 0, 3, 2, '#ffd25a'); px(c, 24, 0, 3, 2, '#ff8a2e');
}

/** The Lava Hound: a cracked-obsidian hound with magma showing through. */
function paintHound(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 1 : 0;
  px(c, 3, 13, 2, 4 - b, '#1c1418'); px(c, 16, 13, 2, 3 + b, '#1c1418'); px(c, 6, 14, 2, 3, '#1c1418'); px(c, 13, 14, 2, 3, '#1c1418');
  px(c, 3, 7, 16, 7, '#2e2228'); px(c, 3, 7, 16, 2, '#4a3a42'); px(c, 5, 10, 3, 1, '#ff8a2e'); px(c, 10, 9, 4, 1, '#ffd25a'); px(c, 14, 11, 3, 1, '#ff8a2e');
  px(c, 16, 3 + b, 6, 6, '#2e2228'); px(c, 16, 2 + b, 2, 2, '#1c1418'); px(c, 20, 2 + b, 2, 2, '#1c1418'); px(c, 19, 5 + b, 2, 1, '#ffd25a');
  px(c, 21, 7 + b, 2, 1, '#ff6a2a'); px(c, 0, 5 - b, 4, 2, '#ff8a2e'); px(c, 0, 4 - b, 2, 1, '#ffd25a');
}
/** The Obsidian Golem: a slab of black glass with a magma heart. */
function paintGolem(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 1 : 0;
  px(c, 4, 22, 6, 4, '#1c1620'); px(c, 16, 22, 6, 4, '#1c1620');
  px(c, 3, 6 + b, 20, 17, '#262030'); px(c, 3, 6 + b, 20, 3, '#3e3650'); px(c, 5, 9 + b, 2, 10, '#4a4262');
  px(c, 0, 9 + b, 4, 11, '#262030'); px(c, 22, 9 - b + 1, 4, 11, '#262030');
  px(c, 10, 12 + b, 6, 6, '#120a0e'); px(c, 11, 13 + b, 4, 4, '#ff6a2a'); px(c, 12, 14 + b, 2, 2, '#ffd25a');
  px(c, 8, 1 + b, 10, 6, '#2e2638'); px(c, 10, 3 + b, 2, 2, '#ff8a2e'); px(c, 14, 3 + b, 2, 2, '#ff8a2e');
}

/** The Magma Tyrant, the Molten Deep's master: a Golem grown huge on the caldera's heat, crowned in fire. */
function paintTyrant(c: CanvasRenderingContext2D, f: number): void {
  c.save(); c.scale(1.8, 1.8); paintGolem(c, f); c.restore();
  px(c, 12, 18, 3, 12, '#ff6a2a'); px(c, 33, 20, 3, 10, '#ff6a2a'); px(c, 22, 30, 4, 8, '#ffd25a');
  px(c, 14, 0, 20, 3, '#9e2e1c'); px(c, 15, 0, 3, 2, '#ffd25a'); px(c, 22, 0, 4, 2, '#ffd25a'); px(c, 30, 0, 3, 2, '#ffd25a');
}


/** The Slag Crawler, of the Molten Deep's slag rivers: a long beetle of cooled slag plates, fire showing at every seam. */
function paintCrawler(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 1 : 0;
  for (let i = 0; i < 4; i++) px(c, 3 + i * 5, 12, 2, 3 + ((i + f) % 2), '#1c1418');
  for (let i = 0; i < 4; i++) {
    const y = 5 + (i % 2 ? b : 0);
    px(c, 1 + i * 5, y, 6, 8, '#3a2e2a'); px(c, 1 + i * 5, y, 6, 2, '#5a4a40'); px(c, 2 + i * 5, y + 5, 4, 1, i % 2 ? '#ffd25a' : '#ff8a2e');
    px(c, 6 + i * 5, y + 1, 1, 6, '#ff6a2a');
  }
  px(c, 20, 4, 6, 9, '#2e2228'); px(c, 20, 4, 6, 2, '#4a3a42'); px(c, 22, 6, 2, 2, '#ffd25a');
  px(c, 25, 10 + b, 1, 4, '#e9e4d8'); px(c, 23, 11 - b, 1, 3, '#e9e4d8');
}
/** The Glass Sentinel, the Glass Foundry's guard: a statue of black glass the Four cast and never broke, a melt for a heart. */
function paintSentinel(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 1 : 0;
  px(c, 4, 24, 12, 4, '#1c1620'); px(c, 4, 24, 12, 1, '#3e3650');
  px(c, 5, 8, 10, 16, '#262030'); px(c, 5, 8, 3, 16, '#4a4262'); px(c, 12, 10, 2, 12, '#3e3650');
  px(c, 8, 13, 4, 5, '#120a0e'); px(c, 9, 14, 2, 3, '#ff6a2a'); px(c, 9, 15, 2, 1, '#ffd25a');
  px(c, 6, 1 + b, 8, 7, '#2e2638'); px(c, 6, 1 + b, 8, 1, '#4a4262'); px(c, 7, 0 + b, 2, 2, '#a8b8e0'); px(c, 11, 0 + b, 2, 2, '#a8b8e0');
  px(c, 8, 4 + b, 1, 1, '#ffd25a'); px(c, 11, 4 + b, 1, 1, '#ffd25a');
  px(c, 1, 10 - b, 3, 9, '#3e3650'); px(c, 0, 8 - b, 2, 3, '#a8b8e0'); px(c, 16, 10 + b, 3, 9, '#3e3650'); px(c, 18, 8 + b, 2, 3, '#a8b8e0');
}
/** The Anvil-Warden, set by the First Smith to keep the Forge of the Four: a Bailiff grown huge, an anvil for a crown. */
function paintAnvilWarden(c: CanvasRenderingContext2D, f: number): void {
  c.save(); c.translate(4, 6); c.scale(1.6, 1.6); paintBailiff(c, f); c.restore();
  px(c, 11, 1, 22, 4, '#4a4552'); px(c, 11, 1, 22, 1, '#7a7584'); px(c, 7, 2, 6, 2, '#4a4552');
  px(c, 18, 5, 8, 3, '#3a3642'); px(c, 15, 7, 14, 2, '#3a3642');
  if (f) { px(c, 13, 0, 2, 1, '#ffd25a'); px(c, 29, 0, 2, 1, '#ff8a2e'); }
}
/** The Cinder Sovereign, the heart of the Molten Deep: a robed king of slag and fire, a burning crown, flame in both hands. */
function paintSovereign(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 1 : 0;
  for (let y = 20; y < 58; y++) { const half = 10 + Math.floor((y - 20) * .45); px(c, 30 - half, y, half * 2, 1, y % 7 === 0 ? '#3a2a30' : '#2a1c24'); }
  px(c, 22, 30, 2, 26, '#ff6a2a'); px(c, 36, 28, 2, 28, '#ff6a2a'); px(c, 29, 34, 2, 22, '#ffd25a');
  px(c, 18, 44, 6, 2, '#ff8a2e'); px(c, 36, 48, 8, 2, '#ff8a2e'); px(c, 13, 56, 34, 2, '#ff6a2a');
  px(c, 14, 18, 32, 6, '#3a2a30'); px(c, 14, 18, 32, 2, '#5a4450');
  px(c, 6, 8 - b, 8, 14, '#2a1c24'); px(c, 46, 7 + b, 8, 14, '#2a1c24'); px(c, 6, 8 - b, 2, 14, '#3a2a30'); px(c, 52, 7 + b, 2, 14, '#3a2a30');
  px(c, 5, 2 - b, 10, 7, '#ff6a2a'); px(c, 7, 1 - b, 6, 4, '#ffd25a'); px(c, 45, 1 + b, 10, 7, '#ff6a2a'); px(c, 47, b, 6, 4, '#ffd25a');
  px(c, 22, 6, 16, 13, '#1c1218'); px(c, 22, 6, 16, 2, '#2e2228');
  px(c, 24, 10, 4, 3, '#ffd25a'); px(c, 32, 10, 4, 3, '#ffd25a'); px(c, 27, 15, 6, 1, f ? '#ffd25a' : '#ff6a2a');
  px(c, 21, 3, 18, 4, '#9e2e1c'); for (let i = 0; i < 4; i++) px(c, 21 + i * 5, 0, 3, 3, i % 2 ? '#ffd25a' : '#ff8a2e');
}

const BONE = '#e8e1cf', BONE_SH = '#b8ac92', SOOT = '#2a1a24';

/** A skeleton's body (skull, ribs, pelvis, legs) at x offset `o`: the walker's and the archer's, and the Warlock's raised. */
function skeleton(c: CanvasRenderingContext2D, o: number, b: number, bone: string, sh: string, eye: string): void {
  px(c, o + 6, 17, 2, 6 - b, sh); px(c, o + 10, 17, 2, 5 + b, sh); px(c, o + 5, 23 - b, 3, 1, bone); px(c, o + 10, 22 + b, 3, 1, bone);
  px(c, o + 5, 15, 8, 2, bone); px(c, o + 8, 9, 2, 6, sh);
  for (let i = 0; i < 3; i++) px(c, o + 5, 9 + i * 2, 8, 1, bone);
  px(c, o + 4, 8, 10, 1, bone); px(c, o + 3, 9, 1, 6 + b, sh);
  px(c, o + 5, 1 + b, 8, 6, bone); px(c, o + 5, 6 + b, 8, 1, sh); px(c, o + 6, 7 + b, 6, 1, bone);
  px(c, o + 6, 3 + b, 2, 2, SOOT); px(c, o + 10, 3 + b, 2, 2, SOOT); px(c, o + 6, 3 + b, 1, 1, eye); px(c, o + 11, 3 + b, 1, 1, eye);
  px(c, o + 8, 5 + b, 2, 1, SOOT);
}
/** The Bone Walker: a skeleton of the old Bastion's garrison, still marching with a slag-iron blade. */
function paintBoneWalker(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 1 : 0;
  skeleton(c, 0, b, BONE, BONE_SH, '#ff8a2e');
  px(c, 14, 9 - b, 1, 5, BONE_SH);
  px(c, 15, 1 - b + 1, 2, 12, '#8a7f86'); px(c, 15, 1 - b + 1, 1, 12, '#c9c2cc'); px(c, 13, 13 - b, 5, 1, '#5e3a28');
}
/** A skeleton the Warlock raised: the same bones, blanched violet, the eyes burning his colour; a shield instead of a blade. */
function paintRaised(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 1 : 0;
  skeleton(c, 0, b, '#ddd2ea', '#a99bc0', '#c88bff');
  px(c, 14, 9 - b, 1, 5, '#a99bc0');
  px(c, 15, 1 - b + 1, 2, 12, '#6b5a86'); px(c, 15, 1 - b + 1, 1, 12, '#b06bff'); px(c, 13, 13 - b, 5, 1, '#3b2140');
  px(c, 0, 9, 4, 6, '#3b2140'); px(c, 1, 10, 2, 4, '#b06bff');
}
/** The Bone Archer: a hooded skeleton with a bow of blackened charwood. */
function paintBoneArcher(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 1 : 0;
  skeleton(c, 2, b, BONE, BONE_SH, '#ffd25a');
  px(c, 6, 0 + b, 10, 3, '#6a2a24'); px(c, 6, 0 + b, 2, 6, '#6a2a24'); px(c, 14, 0 + b, 2, 6, '#6a2a24');
  px(c, 16, 9, 1, 5, BONE_SH);
  px(c, 18, 4, 1, 14, '#5e3a28'); px(c, 17, 3, 1, 2, '#5e3a28'); px(c, 17, 17, 1, 2, '#5e3a28');
  px(c, 19, 5, 1, 12, '#e9e4d8');
  if (!f) { px(c, 12, 10, 7, 1, '#c9c2cc'); px(c, 11, 9, 2, 3, '#ff8a2e'); }
}
/** The Ash Ghoul: a hunched grey eater of the dead, quick on all fours, red-eyed. */
function paintGhoul(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 1 : 0;
  px(c, 4, 13, 3, 5 - b, '#4a4248'); px(c, 12, 13, 3, 4 + b, '#4a4248'); px(c, 4, 10, 2, 5 + b, '#5e565c');
  px(c, 3, 6 + b, 13, 8, '#7a7078'); px(c, 3, 6 + b, 13, 2, '#948a92'); px(c, 3, 12 + b, 13, 2, '#5e565c');
  px(c, 5, 5 + b, 2, 1, '#5e565c'); px(c, 9, 5 + b, 2, 1, '#5e565c'); px(c, 13, 5 + b, 2, 1, '#5e565c');
  px(c, 14, 4 + b, 6, 6, '#8a8088'); px(c, 14, 4 + b, 6, 1, '#a49aa2');
  px(c, 16, 6 + b, 1, 1, '#ff4a3a'); px(c, 18, 6 + b, 1, 1, '#ff4a3a'); px(c, 15, 9 + b, 5, 1, SOOT); px(c, 16, 9 + b, 1, 1, BONE); px(c, 18, 9 + b, 1, 1, BONE);
  px(c, 15, 10, 2, 5 - b, '#5e565c'); px(c, 16, 15 - b, 3, 1, BONE);
  px(c, 6, 9 + b, 1, 1, '#ff8a2e'); px(c, 10, 11 + b, 1, 1, '#ff8a2e');
}
/** The Cinder Wraith: a hooded shade of ash with an ember for a heart; no feet, it drifts. */
function paintWraith(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 1 : 0;
  px(c, 4, 6, 12, 14, '#3a2c44'); px(c, 4, 6, 2, 14, '#4e3c5c');
  for (let i = 0; i < 4; i++) { const h = 3 + ((i + f) % 2) * 2; px(c, 4 + i * 3, 20, 2, h, '#3a2c44'); px(c, 4 + i * 3, 19 + h, 2, 1, '#ff6a2a'); }
  px(c, 5, 1, 10, 7, '#2a2034'); px(c, 6, 0, 8, 2, '#3a2c44'); px(c, 7, 3, 6, 4, '#120a0e');
  px(c, 8, 4, 1, 1, '#ffd25a'); px(c, 11, 4, 1, 1, '#ffd25a');
  px(c, 1, 8 + b, 3, 7, '#3a2c44'); px(c, 16, 9 - b, 3, 7, '#3a2c44'); px(c, 1, 15 + b, 2, 2, BONE_SH); px(c, 17, 16 - b, 2, 2, BONE_SH);
  px(c, 9, 10, 2, 3, '#ff8a2e'); px(c, 9, 11, 2, 1, '#ffd25a');
}
const ORC = '#6f7a5a', ORC_SH = '#4f5a40';
/** A Cinder-clan Orc: ash-green, tusked, in basalt plates, with a slag-iron axe. */
function paintOrc(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 1 : 0;
  px(c, 6, 18, 4, 6 - b, '#3a3238'); px(c, 12, 18, 4, 5 + b, '#3a3238');
  px(c, 4, 9 + b, 14, 10, '#5a4034'); px(c, 4, 16 + b, 14, 2, '#2a1a1c'); px(c, 10, 16 + b, 2, 2, '#ffd25a');
  px(c, 2, 8 + b, 5, 4, '#3a3238'); px(c, 15, 8 + b, 5, 4, '#3a3238'); px(c, 3, 7 + b, 1, 1, BONE_SH); px(c, 18, 7 + b, 1, 1, BONE_SH);
  px(c, 2, 12 + b, 3, 6, ORC); px(c, 17, 12 + b, 3, 6, ORC);
  px(c, 6, 1 + b, 10, 8, ORC); px(c, 6, 3 + b, 10, 1, ORC_SH); px(c, 8, 4 + b, 2, 1, '#ff6a2a'); px(c, 12, 4 + b, 2, 1, '#ff6a2a');
  px(c, 7, 7 + b, 8, 2, ORC_SH); px(c, 8, 6 + b, 1, 2, BONE); px(c, 13, 6 + b, 1, 2, BONE); px(c, 10, 0 + b, 2, 2, SOOT); px(c, 7, 5 + b, 1, 1, '#ff8a2e');
  px(c, 20, 6 - b, 1, 14, '#5e3a28'); px(c, 18, 5 - b, 4, 5, '#8a7f86'); px(c, 18, 5 - b, 1, 5, '#c9c2cc');
}
/** An Orc Firecaller: the clan's shaman, hooded in ember-red, a flame caught on a skull-topped staff. */
function paintFirecaller(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 1 : 0;
  px(c, 6, 24, 3, 2, SOOT); px(c, 13, 24, 3, 2, SOOT);
  px(c, 5, 10, 12, 14, '#6a2418'); px(c, 5, 22, 12, 2, '#ff8a2e'); px(c, 10, 10, 2, 12, '#3a2034');
  px(c, 3, 11 + b, 2, 6, ORC); px(c, 17, 11 + b, 2, 6, ORC);
  px(c, 6, 3 + b, 10, 7, ORC); px(c, 5, 1 + b, 12, 3, '#4a1a14'); px(c, 5, 1 + b, 2, 8, '#4a1a14'); px(c, 15, 1 + b, 2, 8, '#4a1a14');
  px(c, 8, 6 + b, 2, 1, '#ffd25a'); px(c, 12, 6 + b, 2, 1, '#ffd25a'); px(c, 8, 8 + b, 1, 2, BONE); px(c, 13, 8 + b, 1, 2, BONE);
  px(c, 1, 5, 1, 20, '#5e3a28'); px(c, 0, 4, 3, 2, BONE);
  px(c, 0, 0 + f, 3, 4 - f, '#ff8a2e'); px(c, 1, 1 + f, 1, 2, '#ffd25a');
}
/** The Orc Warlord: a Cinder-clan chief grown huge, horned helm, a cape the colour of old embers. */
function paintWarlord(c: CanvasRenderingContext2D, f: number): void {
  px(c, 8, 12, 15, 18, '#5a1a14'); px(c, 8, 28, 15, 2, '#ff6a2a');
  c.save(); c.scale(1.35, 1.35); paintOrc(c, f); c.restore();
  const b = f ? 1 : 0;
  px(c, 7, 1 + b, 16, 3, '#3a3238'); px(c, 4, 0 + b, 3, 4, BONE); px(c, 3, 0 + b, 2, 2, BONE); px(c, 23, 0 + b, 3, 4, BONE); px(c, 25, 0 + b, 2, 2, BONE);
  px(c, 14, 1 + b, 2, 2, '#ffd25a');
}
/** The Ember Drake: a winged lizard of the Molten Fields, scales like cooling lava. */
function paintDrake(c: CanvasRenderingContext2D, f: number): void {
  const w = f ? 5 : 1;
  px(c, 0, 13, 6, 2, '#9e2e1c'); px(c, 0, 12, 2, 1, '#ff6a2a');
  px(c, 8, w, 3, 9 - Math.min(w, 4), '#7a2a1c'); px(c, 10, w + 1, 8, 7, '#e2552a'); px(c, 10, w + 1, 8, 1, '#7a2a1c'); px(c, 13, w + 1, 1, 7, '#9e2e1c');
  px(c, 5, 10, 13, 7, '#c8432a'); px(c, 6, 15, 11, 2, '#ffb35a'); px(c, 6, 9, 2, 1, '#7a2a1c'); px(c, 10, 9, 2, 1, '#7a2a1c'); px(c, 14, 9, 2, 1, '#7a2a1c');
  px(c, 7, 17, 2, 4 - (f ? 1 : 0), '#7a2a1c'); px(c, 14, 17, 2, 3 + (f ? 1 : 0), '#7a2a1c'); px(c, 6, 21, 3, 1, SOOT); px(c, 13, 21, 3, 1, SOOT);
  px(c, 17, 7, 4, 6, '#c8432a');
  px(c, 19, 4, 6, 5, '#c8432a'); px(c, 24, 6, 4, 3, '#c8432a'); px(c, 22, 8, 5, 1, '#7a2a1c'); px(c, 21, 5, 2, 1, '#ffd25a'); px(c, 19, 2, 2, 2, SOOT); px(c, 27, 6, 1, 1, '#ffd25a');
}
type P2 = readonly [number, number];
/** A filled triangle, scanline by scanline in whole pixels (a wing's membrane stays crisp under the outline). */
function tri(c: CanvasRenderingContext2D, a: P2, b: P2, d: P2, col: string): void {
  const ys = [a[1], b[1], d[1]], y0 = Math.min(...ys), y1 = Math.max(...ys), edges: [P2, P2][] = [[a, b], [b, d], [d, a]];
  for (let y = y0; y < y1; y++) {
    const yc = y + .5, xs: number[] = [];
    for (const [p, q] of edges) if ((p[1] <= yc) !== (q[1] <= yc)) xs.push(p[0] + (yc - p[1]) / (q[1] - p[1]) * (q[0] - p[0]));
    if (xs.length < 2) continue;
    const l = Math.round(Math.min(...xs)), r = Math.round(Math.max(...xs));
    if (r > l) px(c, l, y, r - l, 1, col);
  }
}
/** A bone from p to q, `t` pixels thick. */
function bone(c: CanvasRenderingContext2D, p: P2, q: P2, t: number, col: string): void {
  const n = Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1]));
  for (let i = 0; i <= n; i++) px(c, Math.round(p[0] + (q[0] - p[0]) * i / n), Math.round(p[1] + (q[1] - p[1]) * i / n), t, t, col);
}
/** The Ashbone Dragon: the Bastion's last lord, a dragon of bare bone round a heart of burning slag. */
function paintBoneDragon(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 1 : 0, w = f ? 3 : 0, M = '#3a2c44';
  // The far wing, a bat's: an arm of bone up to the wrist, three fingers fanning out, tattered ash between.
  const S: P2 = [31, 27], W: P2 = [25, 5 + w], T1: P2 = [3, 11 + w], T2: P2 = [10, 2 + w], T3: P2 = [19, 0 + w];
  tri(c, W, T1, T2, M); tri(c, W, T2, T3, M); tri(c, S, W, T1, M); tri(c, T1, S, [16, 31], M);
  for (let i = 0; i < 3; i++) px(c, 6 + i * 4, 14 + w + i, 2, 2, '#2a2034');
  bone(c, S, W, 3, BONE); bone(c, W, T1, 2, BONE_SH); bone(c, W, T2, 2, BONE_SH); bone(c, W, T3, 2, BONE_SH);
  // Tail and back.
  for (let i = 0; i < 8; i++) px(c, i * 3, 44 - Math.floor(i * 1.3), 3, 3, i % 2 ? BONE_SH : BONE);
  px(c, 20, 30, 24, 3, BONE); for (let i = 0; i < 6; i++) px(c, 21 + i * 4, 28, 2, 2, BONE_SH);
  // The ribs round the slag heart.
  px(c, 24, 33, 18, 9, '#5a1a14'); px(c, 27, 35, 12, 5, '#ff6a2a'); px(c, 30, 36, 5, 3, '#ffd25a');
  for (let i = 0; i < 5; i++) px(c, 23 + i * 4, 33, 2, 10 - Math.abs(i - 2) * 2, BONE);
  px(c, 22, 43, 22, 2, BONE_SH);
  // Legs.
  px(c, 22, 44, 4, 7 + b, BONE); px(c, 21, 51 + b, 3, 3 - b, BONE_SH); px(c, 19, 54, 7, 2, BONE);
  px(c, 38, 44, 4, 7 - b + 1, BONE); px(c, 39, 51, 3, 3, BONE_SH); px(c, 37, 54, 7, 2, BONE);
  // The near wing, folded.
  px(c, 30, 14 + w, 3, 14 - w, BONE); px(c, 33, 16 + w, 9, 11 - w, M); px(c, 33, 16 + w, 9, 1, BONE_SH);
  // Neck and skull.
  for (let i = 0; i < 5; i++) px(c, 42 + i * 2, 27 - i * 3, 4, 4, i % 2 ? BONE_SH : BONE);
  px(c, 47, 6 + b, 14, 10, BONE); px(c, 47, 14 + b, 14, 2, BONE_SH); px(c, 56, 11 + b, 8, 5, BONE);
  px(c, 51, 9 + b, 3, 3, SOOT); px(c, 52, 10 + b, 1, 1, '#ffd25a'); px(c, 62, 12 + b, 1, 1, SOOT);
  px(c, 45, 3 + b, 4, 3, BONE_SH); px(c, 43, 1 + b, 3, 3, BONE_SH); px(c, 49, 4 + b, 3, 2, BONE_SH);
  px(c, 52, 17 + b + (f ? 2 : 0), 11, 3, BONE_SH);
  for (let i = 0; i < 4; i++) { px(c, 55 + i * 2, 16 + b, 1, 1, BONE); px(c, 55 + i * 2, 17 + b + (f ? 2 : 0), 1, 1, BONE); }
  if (f) { px(c, 56, 17 + b, 8, 2, '#ff6a2a'); px(c, 58, 17 + b, 4, 1, '#ffd25a'); }
}

export const MOBS: Readonly<Record<string, MobDef>> = {
  'lava-hound': {
    id: 'lava-hound', name: 'Lava Hound', hp: 120, speed: 50, dmg: [7, 12], rate: 1.1, sight: 130, level: 10,
    lore: 'Born in a kiln that was never lit by hand, it tracks a warm boot-print for miles and sleeps in the cracks that still glow.',
    coins: [10, 30], drops: [{ material: 'ember-residue', qty: 1, chance: .35 }], paint: paintHound, w: 23, h: 17,
  },
  'obsidian-golem': {
    id: 'obsidian-golem', name: 'Obsidian Golem', hp: 260, speed: 22, dmg: [12, 20], rate: 1.7, sight: 110, level: 14,
    lore: 'The glass-cutters walked away mid-shift. Their last statue did not, and it still guards the seam it was told to hold.',
    coins: [24, 60], drops: [{ material: 'cinder-ore', qty: 2, chance: 1 }, { material: 'infernal-heartstone', qty: 1, chance: .08 }], paint: paintGolem, w: 26, h: 26,
  },
  'ember-warden': {
    id: 'ember-warden', name: 'The Ember Warden', hp: 420, speed: 24, dmg: [10, 16], rate: 1.6, sight: 140, level: 8,
    lore: 'Keeper of the flooded galleries, it banks the old forge-fire each night and bites anyone who comes to stoke it.',
    coins: [120, 220], drops: [{ material: 'infernal-heartstone', qty: 1, chance: .5 }, { material: 'ember-residue', qty: 2, chance: 1 }], paint: paintWarden, w: 38, h: 44, rank: 'boss',
  },
  'magma-tyrant': {
    id: 'magma-tyrant', name: 'The Magma Tyrant', hp: 1400, speed: 20, dmg: [18, 30], rate: 1.8, sight: 160, level: 20,
    lore: 'It was a crown once, poured too hot. Now the caldera wears it, and the caldera does not take kindly to visitors.',
    coins: [400, 700], drops: [{ material: 'infernal-heartstone', qty: 2, chance: 1 }, { material: 'cinder-ore', qty: 4, chance: 1 }], paint: paintTyrant, w: 48, h: 48, rank: 'boss',
  },
  'ash-wolf': {
    id: 'ash-wolf', name: 'Ash Wolf', hp: 45, speed: 46, dmg: [3, 7], rate: 1.1, sight: 110, level: 1,
    lore: 'Grey as a cold hearth and just as quiet, it hunts the Emberwood in the hour after the last ember fades.',
    coins: [2, 9], drops: [{ material: 'world-root-bark', qty: 1, chance: .2 }], paint: paintWolf, w: 22, h: 17,
  },
  'cinder-imp': {
    id: 'cinder-imp', name: 'Cinder Imp', hp: 80, speed: 38, dmg: [5, 9], rate: 1.2, sight: 120, level: 2,
    lore: 'A spark that grew a grudge. It throws small tempers and smaller fires, and giggles when the soot finds your collar.',
    coins: [6, 18], drops: [{ material: 'ember-residue', qty: 1, chance: .3 }], paint: paintImp, w: 20, h: 18,
  },
  'rivet-maw': {
    id: 'rivet-maw', name: 'Rivet Maw', hp: 60, speed: 34, dmg: [3, 6], rate: 1.3, sight: 96, level: 1,
    lore: 'Scrap-iron with a hunger. Somebody forgot to take the teeth out of the rivet barrel, and now they chew.',
    coins: [3, 13], drops: [{ material: 'cinder-ore', qty: 1, chance: .7 }], paint: paintMaw, w: 20, h: 17,
  },
  'cinder-bailiff': {
    id: 'cinder-bailiff', name: 'Cinder Bailiff', hp: 110, speed: 28, dmg: [6, 10], rate: 1.5, sight: 110, level: 3,
    lore: 'It still serves writs to the dead mine, and swings its ledger-hook at anyone found behind on their dues.',
    coins: [8, 24], drops: [{ material: 'cinder-ore', qty: 1, chance: 1 }, { material: 'ember-residue', qty: 1, chance: .35 }], paint: paintBailiff, w: 22, h: 25,
  },
  // The undead and the Cinder clans (owner 2026-10-20: "lots of scary monsters … skeletons, dragons, orcs, undead").
  'bone-walker': {
    id: 'bone-walker', name: 'Bone Walker', hp: 80, speed: 30, dmg: [4, 8], rate: 1.4, sight: 96, level: 6,
    lore: 'It remembers walking to work, so it walks. Nobody has told it which way the work went.',
    coins: [5, 16], drops: [{ material: 'ember-residue', qty: 1, chance: .25 }], paint: paintBoneWalker, w: 18, h: 24,
  },
  'bone-archer': {
    id: 'bone-archer', name: 'Bone Archer', hp: 85, speed: 30, dmg: [3, 6], rate: 1.5, sight: 140, level: 8,
    lore: 'A bow strung with something that is not quite sinew. It only ever aims at the lantern you carry.',
    coins: [8, 20], drops: [{ material: 'world-root-bark', qty: 1, chance: .3 }], paint: paintBoneArcher, w: 20, h: 24,
    ranged: { range: 92, keep: 76, rate: 1.9, dmg: [6, 10], speed: 120, kind: 'arrow' },
  },
  'ash-ghoul': {
    id: 'ash-ghoul', name: 'Ash Ghoul', hp: 70, speed: 60, dmg: [5, 9], rate: .8, sight: 130, level: 9,
    lore: 'Quick and starved, it scrapes the ash from old pyres and wears it like a shawl against the cold it can no longer feel.',
    coins: [6, 18], drops: [{ material: 'ember-residue', qty: 1, chance: .35 }], paint: paintGhoul, w: 20, h: 18,
  },
  'cinder-wraith': {
    id: 'cinder-wraith', name: 'Cinder Wraith', hp: 150, speed: 32, dmg: [8, 13], rate: 1.4, sight: 130, level: 12,
    lore: 'A flicker of someone who stood too near the furnace door. It drifts over the slag, humming a shift-bell song.',
    coins: [14, 36], drops: [{ material: 'ember-residue', qty: 2, chance: .5 }, { material: 'infernal-heartstone', qty: 1, chance: .04 }], paint: paintWraith, w: 20, h: 26,
    floats: true, ghost: true,
  },
  'cinder-orc': {
    id: 'cinder-orc', name: 'Cinder-clan Orc', hp: 170, speed: 36, dmg: [9, 15], rate: 1.3, sight: 120, level: 10,
    lore: 'The Cinder clans trade in iron and grudges. This one has plenty of both, and would like to see yours.',
    coins: [12, 32], drops: [{ material: 'cinder-ore', qty: 1, chance: .5 }, { material: 'world-root-bark', qty: 1, chance: .2 }], paint: paintOrc, w: 22, h: 24,
  },
  'orc-firecaller': {
    id: 'orc-firecaller', name: 'Orc Firecaller', hp: 130, speed: 30, dmg: [6, 10], rate: 1.5, sight: 150, level: 13,
    lore: 'It talks to the coals in a low voice, and the coals, against their better judgement, answer.',
    coins: [16, 40], drops: [{ material: 'ember-residue', qty: 2, chance: .6 }], paint: paintFirecaller, w: 22, h: 26,
    ranged: { range: 100, keep: 74, rate: 2.1, dmg: [10, 16], speed: 110, kind: 'fire' },
  },
  'orc-warlord': {
    id: 'orc-warlord', name: 'Orc Warlord', hp: 440, speed: 32, dmg: [15, 24], rate: 1.5, sight: 140, level: 16,
    lore: 'Scarred, crowned in a smithing helm, and followed by every drum in the Badlands. It has never once asked for directions.',
    coins: [60, 130], drops: [{ material: 'cinder-ore', qty: 3, chance: 1 }, { material: 'infernal-heartstone', qty: 1, chance: .15 }], paint: paintWarlord, w: 30, h: 33, rank: 'champion',
  },
  'ember-drake': {
    id: 'ember-drake', name: 'Ember Drake', hp: 320, speed: 40, dmg: [12, 18], rate: 1.4, sight: 150, level: 18,
    lore: 'It nests where the ground sighs smoke, and treats every traveller as a spark that wandered too near its kindling.',
    coins: [40, 90], drops: [{ material: 'ember-residue', qty: 2, chance: .8 }, { material: 'infernal-heartstone', qty: 1, chance: .1 }], paint: paintDrake, w: 28, h: 22,
    ranged: { range: 84, keep: 0, rate: 3, dmg: [12, 20], speed: 130, kind: 'fire' },
  },
  'bone-dragon': {
    id: 'bone-dragon', name: 'The Ashbone Dragon', hp: 2200, speed: 22, dmg: [22, 34], rate: 1.8, sight: 190, level: 25,
    lore: 'The oldest thing under the Bastion. It was a dragon once; it is now a promise the ash made, and the ash keeps its promises.',
    coins: [600, 1000], drops: [{ material: 'infernal-heartstone', qty: 2, chance: 1 }, { material: 'ember-residue', qty: 3, chance: 1 }], paint: paintBoneDragon, w: 64, h: 56, rank: 'boss',
    ranged: { range: 130, keep: 0, rate: 3.4, dmg: [16, 26], speed: 120, kind: 'breath', spread: 3 },
    summon: { type: 'bone-walker', count: 2, at: .5 },
  },
  // The Molten Deep's lower floors (−4…−6) and the Forge of the Four.
  'slag-crawler': {
    id: 'slag-crawler', name: 'Slag Crawler', hp: 300, speed: 30, dmg: [14, 22], rate: 1.4, sight: 120, level: 21,
    coins: [30, 70], drops: [{ material: 'cinder-ore', qty: 2, chance: 1 }, { material: 'ember-residue', qty: 1, chance: .4 }], paint: paintCrawler, w: 27, h: 16,
  },
  'glass-sentinel': {
    id: 'glass-sentinel', name: 'Glass Sentinel', hp: 340, speed: 20, dmg: [12, 18], rate: 1.8, sight: 150, level: 24,
    coins: [40, 90], drops: [{ material: 'cinder-ore', qty: 1, chance: 1 }, { material: 'infernal-heartstone', qty: 1, chance: .12 }], paint: paintSentinel, w: 20, h: 28,
    ranged: { range: 110, keep: 80, rate: 2.2, dmg: [12, 18], speed: 140, kind: 'fire' },
  },
  'anvil-warden': {
    id: 'anvil-warden', name: 'The Anvil-Warden', hp: 1100, speed: 22, dmg: [16, 26], rate: 1.7, sight: 150, level: 18,
    coins: [300, 550], drops: [{ material: 'infernal-heartstone', qty: 1, chance: 1 }, { material: 'cinder-ore', qty: 4, chance: 1 }], paint: paintAnvilWarden, w: 44, h: 46, rank: 'boss',
    summon: { type: 'cinder-bailiff', count: 2, at: .5 },
  },
  'cinder-sovereign': {
    id: 'cinder-sovereign', name: 'The Cinder Sovereign', hp: 3200, speed: 22, dmg: [26, 40], rate: 1.7, sight: 170, level: 30,
    coins: [900, 1500], drops: [{ material: 'infernal-heartstone', qty: 3, chance: 1 }, { material: 'ember-residue', qty: 4, chance: 1 }], paint: paintSovereign, w: 60, h: 60, rank: 'boss',
    ranged: { range: 130, keep: 0, rate: 3.2, dmg: [20, 32], speed: 120, kind: 'breath', spread: 5 },
    // At half its life it calls the hounds of the deep to its side.
    summon: { type: 'lava-hound', count: 2, at: .5 },
  },
};

/** The Warlock's raised skeleton (Raise Skeleton): drawn like a Bone Walker blanched violet; never a spawn. */
export const RAISED_SKELETON: MobDef = {
  id: 'raised-skeleton', name: 'Raised Skeleton', hp: 1, speed: 52, dmg: [1, 1], rate: 1.1, sight: 0, level: 1,
  coins: [0, 0], drops: [], paint: paintRaised, w: 18, h: 24,
};

const sheets = new Map<string, HTMLCanvasElement>();
/** Two outlined frames side by side. */
export function mobSheet(def: MobDef): HTMLCanvasElement {
  let s = sheets.get(def.id);
  if (s) return s;
  const raw = document.createElement('canvas'); raw.width = def.w * 2; raw.height = def.h;
  const c = raw.getContext('2d')!;
  for (let f = 0; f < 2; f++) { c.save(); c.translate(f * def.w, 0); def.paint(c, f); c.restore(); }
  s = document.createElement('canvas'); s.width = raw.width; s.height = raw.height;
  const o = s.getContext('2d')!;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) o.drawImage(raw, dx, dy);
  o.globalCompositeOperation = 'source-in'; o.fillStyle = '#2a1a24'; o.fillRect(0, 0, s.width, s.height);
  o.globalCompositeOperation = 'source-over'; o.drawImage(raw, 0, 0);
  sheets.set(def.id, s);
  return s;
}

export interface MobSpawn { key: string; type: string; x: number; y: number }

export interface Mob {
  key: string;
  def: MobDef;
  x: number; y: number;
  hx: number; hy: number;
  hp: number;
  /** Ember Curse: seconds left, and the burn's tick timer. */
  cursed: number;
  burnT: number;
  face: 1 | -1;
  t: number;
  cd: number;
  hit: number;
  wander: { x: number; y: number } | null;
  wait: number;
  /** Seconds until its next shot (a ranged creature). */
  rcd: number;
  /** It has called its summons (once). */
  summoned: boolean;
}

/** A shot a creature looses (a bone arrow, a fire bolt, a breath): it flies straight; stepping aside dodges it. */
export interface MobShot { x: number; y: number; vx: number; vy: number; dmg: number; age: number; life: number; kind: 'arrow' | 'fire' | 'breath' }

/** Aim a shot from (x, y) at (tx, ty), turned `angle` radians off true (a breath fans): it flies `range` × 1.4 at most. */
export function aimShot(x: number, y: number, tx: number, ty: number, speed: number, range: number, dmg: number, kind: MobShot['kind'], angle = 0): MobShot {
  const a = Math.atan2(ty - y, tx - x) + angle;
  return { x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg, age: 0, life: range * 1.4 / speed, kind };
}
export function stepShot(s: MobShot, dt: number): void { s.x += s.vx * dt; s.y += s.vy * dt; s.age += dt; }
/** Does the shot strike a body whose middle is at (x, y)? */
export function shotHits(s: { x: number; y: number }, x: number, y: number, r = 8): boolean { return Math.hypot(s.x - x, s.y - y) <= r; }

/** A skeleton the Warlock raised (Raise Skeleton): it follows him, fights the nearest foe, and crumbles in time. */
export interface Minion {
  id: number;
  x: number; y: number;
  hp: number; maxHp: number;
  dmg: [number, number];
  cd: number;
  t: number;
  face: 1 | -1;
  /** Seconds before it crumbles. */
  life: number;
  hit: number;
  target: Mob | null;
}

/** A raised skeleton's life and blow: Raise Skeleton's numbers grown with the Keeper's level and spell power. */
export function raisedStats(level: number, power: number, v: Readonly<Record<string, number>>): { hp: number; dmg: [number, number] } {
  const lv = Math.max(1, Math.floor(level)), pw = Math.max(.1, power);
  const hp = Math.round(v['hp'] * (1 + .1 * (lv - 1)) * pw);
  const avg = v['dmg'] * (1 + .06 * (lv - 1)) * pw;
  return { hp, dmg: [Math.max(1, Math.round(avg * .8)), Math.max(1, Math.round(avg * 1.2))] };
}
/** Keep at most `cap` raised: the oldest crumble first. Returns the ones let go. */
export function capMinions(list: Minion[], cap: number): Minion[] {
  return list.length > cap ? list.splice(0, list.length - cap) : [];
}
/** The foe a raised skeleton goes for: the nearest within its sight that is also within the leash of the Keeper. */
export function pickMinionTarget(from: { x: number; y: number }, mobs: readonly Mob[], keeper: { x: number; y: number }, sight: number, leash: number): Mob | null {
  let best: Mob | null = null, bd = sight;
  for (const m of mobs) {
    if (m.hp <= 0 || Math.hypot(m.x - keeper.x, m.y - keeper.y) > leash) continue;
    const d = Math.hypot(m.x - from.x, m.y - from.y);
    if (d <= bd) { bd = d; best = m; }
  }
  return best;
}

/** A Bone Spear in flight: it passes through every foe in its line, striking each once. */
export interface Spear { x: number; y: number; vx: number; vy: number; age: number; life: number; hit: Mob[] }

export interface Drop {
  id: string;
  x: number; y: number;
  coins: number;
  material?: string;
  qty: number;
  item?: { definitionId: string; rarity: LootRarity; unique: boolean; level?: number };
  rune?: string;
  label: string;
  color: string;
  age: number;
}

export interface Floater { x: number; y: number; text: string; color: string; age: number }

/** A short-lived picture in the world: a slash, a fire ring, a heal, wood chips, haste dust. */
export interface Effect { kind: 'slash' | 'wave' | 'heal' | 'chips' | 'dust' | 'drain' | 'curse' | 'ward' | 'bolt-hit' | 'raise' | 'spark'; x: number; y: number; age: number; life: number; dir: number; tx?: number; ty?: number }

/** A bolt in flight toward a creature. */
export interface Bolt { x: number; y: number; to: Mob; dmg: number; age: number }


export const RARITY_COLOR: Readonly<Record<LootRarity, string>> = {
  common: '#f3e7cf', uncommon: '#7fd56a', rare: '#5fb6ff', epic: '#c48bff', legendary: '#ffb347', mythic: '#ff6dd7', singular: '#4dffe0',
};

const REACH = 24;          // the Keeper's swing
const MOB_REACH = 18;      // a creature's bite
const RESPAWN = 75;        // seconds until a spawn comes back
const DESPAWN = 300;       // seconds a drop lies on the ground
const CORPSE_SECS = 20;    // a kill's corpse stays fresh for Raise Skeleton this long
const MINION_SIGHT = 6 * TILE;
const MINION_LEASH = 9 * TILE;
const MINION_SPEED = 52;
const SPEAR_SPEED = 280;

/** What the mob system needs from the engine. */
export interface MobHost {
  readonly options: EngineOptions;
  walkable(c: number, r: number): boolean;
  levelId(): string;
  player(): { x: number; y: number };
  hurtPlayer(n: number): void;
  healPlayer(n: number): void;
  /** Can a floating creature drift over this tile (floor, lava, embers)? Default: walkable. */
  hover?(c: number, r: number): boolean;
  /** Does a shot fly over this tile (not into a wall)? Default: walkable. */
  passable?(c: number, r: number): boolean;
  /** The Keeper swung (an attack or an ability): the host plays the swing toward `at`. */
  swung(at: { x: number; y: number } | null): void;
}

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

export class MobSystem {
  readonly mobs: Mob[] = [];
  readonly drops: Drop[] = [];
  readonly floaters: Floater[] = [];
  readonly effects: Effect[] = [];
  readonly bolts: Bolt[] = [];
  /** Creatures' shots in flight, the Keeper's Bone Spears, his raised skeletons, and the fresh dead they rise from. */
  readonly shots: MobShot[] = [];
  readonly spears: Spear[] = [];
  readonly minions: Minion[] = [];
  readonly corpses: { x: number; y: number; at: number }[] = [];
  private minionSeq = 0;
  /** Seconds each skill still cools. */
  readonly cooldowns: Partial<Record<SkillId, number>> = {};
  mana = MAX_MANA;
  /** The level's mana cap and spell power (td-skills levelStats). */
  maxMana = MAX_MANA;
  power = 1;
  /** Mana back per second, and Agility's quicker staff (td-skills levelStats). */
  regen = MANA_REGEN;
  agility = 0;
  /** Worn gear (td-skills fightStats): cast speed (fraction), crit chance (0..1), Defense, and the Keeper's level. */
  castSpeed = 0;
  crit = 0;
  defense = 0;
  keeperLevel = 1;
  /** The running aura (one at a time, D2), or none. */
  aura: SkillId | null = 'aura-embers';
  /** Dark Ward: damage it still absorbs, seconds left. */
  ward = 0;
  wardT = 0;
  /** Seconds of Haste left (kept for kits that have it). */
  haste = 0;
  /** The basic attack reaches this far (art px): the staff's bolt (7 tiles). */
  readonly range = SKILLS['ember-bolt'].vars['range'] * TILE;
  private auraT = 0;
  target: Mob | null = null;
  attacking = false;
  private swing = 0;
  private kills = 0;
  private readonly deadUntil = new Map<string, number>();
  private clock = 0;

  constructor(private readonly host: MobHost) {}

  /** Bring the level's spawns to life (those not resting after a death) and drop everything of the last level. */
  enterLevel(spawns: readonly MobSpawn[]): void {
    this.mobs.length = 0; this.drops.length = 0; this.target = null;
    // The raised, the shots and the dead belong to the place they were in.
    this.minions.length = 0; this.shots.length = 0; this.spears.length = 0; this.corpses.length = 0;
    this.addSpawns(spawns);
  }
  /** Spawns that came into reach (the endless surface hands them over chunk by chunk). */
  addSpawns(spawns: readonly MobSpawn[]): void {
    for (const s of spawns) {
      if (this.mobs.some(m => m.key === s.key) || (this.deadUntil.get(s.key) ?? 0) > this.clock) continue;
      const def = MOBS[s.type];
      if (!def) continue;
      this.mobs.push(this.spawnMob(s.key, def, s.x, s.y));
    }
  }
  private spawnMob(key: string, def: MobDef, x: number, y: number): Mob {
    return { key, def, x, y, hx: x, hy: y, hp: def.hp, cursed: 0, burnT: 0, face: 1, t: Math.random() * 3, cd: 1, hit: 0, wander: null, wait: Math.random() * 3, rcd: (def.ranged?.rate ?? 1) * (.5 + Math.random() * .5), summoned: false };
  }
  /** Forget creatures far from the Keeper (the surface never ends; they come back when their chunk does). */
  prune(maxDist: number): void {
    const p = this.host.player();
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      if (Math.hypot(m.x - p.x, m.y - p.y) > maxDist && m !== this.target) this.mobs.splice(i, 1);
    }
  }

  /** The creature under a world point (a tap), if any. */
  mobAt(x: number, y: number): Mob | null {
    let best: Mob | null = null, bd = 18;
    for (const m of this.mobs) { const d = Math.hypot(m.x - x, m.y - m.def.h / 2 - y); if (d < bd) { bd = d; best = m; } }
    return best;
  }

  update(dt: number): void {
    this.clock += dt;
    const p = this.host.player();
    this.swing = Math.max(0, this.swing - dt);
    // The Keeper's attack: the target, or with the key held the nearest creature in reach.
    if (this.target && (this.target.hp <= 0 || !this.mobs.includes(this.target))) this.target = null;
    let foe = this.target;
    if (!foe && this.attacking) {
      let bd = this.range;
      for (const m of this.mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < bd) { bd = d; foe = m; } }
    }
    // The Warlock's staff: an ember bolt flies to the foe in range (Tibia's auto-attack, at a distance).
    const bolt = SKILLS['ember-bolt'];
    if (foe && this.swing <= 0 && Math.hypot(foe.x - p.x, foe.y - p.y) <= this.range) {
      this.swing = bolt.cd / (1 + this.agility) / (1 + this.castSpeed);
      this.bolts.push({ x: p.x, y: p.y - 22, to: foe, dmg: rnd(bolt.vars['min'], bolt.vars['max']), age: 0 });
      this.host.swung(foe);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i], tx = b.to.x, ty = b.to.y - b.to.def.h / 2;
      b.age += dt;
      const dx = tx - b.x, dy = ty - b.y, len = Math.hypot(dx, dy), step = 190 * dt;
      if (!this.mobs.includes(b.to) || b.age > 2) { this.bolts.splice(i, 1); continue; }
      if (len <= step + 2) {
        this.bolts.splice(i, 1);
        this.effects.push({ kind: 'bolt-hit', x: tx, y: ty, age: 0, life: .25, dir: 1 });
        this.hitFoe(b.to, b.dmg, '#ffd25a');
      } else { b.x += dx / len * step; b.y += dy / len * step; }
    }
    // The aura (D2): it works on everything near, every second, while it is chosen.
    this.auraT -= dt;
    const auraTick = this.auraT <= 0;
    if (auraTick) this.auraT = 1;
    for (const m of [...this.mobs]) {
      if (m.cursed > 0) {
        m.cursed -= dt; m.burnT -= dt;
        if (m.burnT <= 0) { m.burnT = 1; this.hitFoe(m, SKILLS['ember-curse'].vars['dps'], '#ff9a4a'); if (m.hp <= 0) continue; }
      }
      if (auraTick && this.aura === 'aura-embers' && Math.hypot(m.x - p.x, m.y - p.y) <= SKILLS['aura-embers'].vars['radius'] * TILE) this.hitFoe(m, SKILLS['aura-embers'].vars['dps'], '#ff8a2e');
    }
    for (const m of [...this.mobs]) {
      m.t += dt; m.cd -= dt; m.rcd -= dt; m.hit = Math.max(0, m.hit - dt);
      // Its prey: the Keeper, or one of his raised skeletons standing closer.
      let prey: Minion | null = null, d = Math.hypot(p.x - m.x, p.y - m.y);
      for (const k of this.minions) { const dk = Math.hypot(k.x - m.x, k.y - m.y); if (dk < d) { d = dk; prey = k; } }
      const px0 = prey ? prey.x : p.x, py0 = prey ? prey.y : p.y;
      const hunting = d < m.def.sight, shoot = m.def.ranged;
      let tx: number | null = null, ty: number | null = null, stop = 2;
      if (hunting) {
        m.wander = null;
        if (shoot && shoot.keep > 0 && d < shoot.keep - 8) { tx = m.x + (m.x - px0); ty = m.y + (m.y - py0); stop = 0; }   // back off
        else if (!(shoot && shoot.keep > 0 && d <= shoot.range)) { tx = px0; ty = py0; stop = MOB_REACH - 4; }
        if (Math.abs(px0 - m.x) > 2) m.face = px0 < m.x ? -1 : 1;
        // A shot at where the prey stands now: a step aside and it flies by.
        if (shoot && d <= shoot.range && m.rcd <= 0) {
          m.rcd = shoot.rate;
          const n = shoot.spread ?? 1;
          for (let i = 0; i < n; i++) {
            let dmg = rnd(shoot.dmg[0], shoot.dmg[1]);
            if (m.cursed > 0) dmg = Math.max(1, Math.round(dmg * (1 - SKILLS['ember-curse'].vars['weaken'] / 100)));
            this.shots.push(aimShot(m.x + m.face * m.def.w * .3, m.y - m.def.h * .55, px0, py0 - 12, shoot.speed, shoot.range, dmg, shoot.kind, (i - (n - 1) / 2) * .22));
          }
        }
      } else {
        // Roam near home: a short stroll, a pause, another.
        if (!m.wander) {
          m.wait -= dt;
          if (m.wait <= 0) { m.wander = { x: m.hx + rnd(-40, 40), y: m.hy + rnd(-30, 30) }; m.wait = 1.5 + Math.random() * 3; }
        }
        if (m.wander) { tx = m.wander.x; ty = m.wander.y; if (Math.hypot(tx - m.x, ty - m.y) < 3) m.wander = null; }
      }
      if (tx !== null && ty !== null) {
        const dx = tx - m.x, dy = ty - m.y, len = Math.hypot(dx, dy);
        if (len > stop) {
          const step = Math.min(len, m.def.speed * dt), vx = dx / len * step, vy = dy / len * step;
          if (this.free(m.x + vx, m.y, m.def.floats)) m.x += vx; else m.wander = null;
          if (this.free(m.x, m.y + vy, m.def.floats)) m.y += vy; else m.wander = null;
          if (!hunting && Math.abs(vx) > .05) m.face = vx < 0 ? -1 : 1;
        }
      }
      // A bite when its prey is in reach.
      if (d <= MOB_REACH && m.cd <= 0) {
        m.cd = m.def.rate;
        let n = rnd(m.def.dmg[0], m.def.dmg[1]);
        // A cursed foe bites weaker.
        if (m.cursed > 0) n = Math.max(1, Math.round(n * (1 - SKILLS['ember-curse'].vars['weaken'] / 100)));
        if (prey) this.hurtMinion(prey, n); else this.biteKeeper(n);
      }
    }
    this.updateShots(dt);
    this.updateMinions(dt);
    for (let i = this.corpses.length - 1; i >= 0; i--) if (this.clock - this.corpses[i].at > CORPSE_SECS) this.corpses.splice(i, 1);
    // Walk over loot to pick it up.
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const g = this.drops[i];
      g.age += dt;
      if (g.age > DESPAWN) { this.drops.splice(i, 1); continue; }
      // Coins come to the Keeper (a Warlock kills from afar); gear and materials wait to be walked to.
      if (g.coins > 0 && g.age > .6) {
        const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy);
        if (d < 8 * TILE && d > 1) { const v = Math.min(d, (90 + g.age * 60) * dt); g.x += dx / d * v; g.y += dy / d * v; }
      }
      if (Math.hypot(g.x - p.x, g.y - p.y) < 22 && g.age > .4) this.pick(g, i);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) { const f = this.floaters[i]; f.age += dt; f.y -= 14 * dt; if (f.age > 1) this.floaters.splice(i, 1); }
    for (let i = this.effects.length - 1; i >= 0; i--) { const e = this.effects[i]; e.age += dt; if (e.age > e.life) this.effects.splice(i, 1); }
    for (const k of Object.keys(this.cooldowns) as SkillId[]) this.cooldowns[k] = Math.max(0, (this.cooldowns[k] ?? 0) - dt);
    this.mana = Math.min(this.maxMana, this.mana + this.regen * dt);
    if (this.wardT > 0) { this.wardT -= dt; if (this.wardT <= 0) this.ward = 0; }
    if (this.haste > 0) {
      this.haste = Math.max(0, this.haste - dt);
      if (Math.random() < dt * 8) this.effects.push({ kind: 'dust', x: p.x + rnd(-4, 4), y: p.y, age: 0, life: .4, dir: 1 });
    }
  }

  private hitFoe(foe: Mob, raw: number, color: string): void {
    const crit = this.crit > 0 && Math.random() < this.crit;
    const dmg = Math.round(raw * this.power * (crit ? CRIT_MULT : 1));
    if (this.aura === 'aura-siphon') this.host.healPlayer(SKILLS['aura-siphon'].vars['heal']);
    this.hurtMob(foe, dmg, color, crit);
  }
  /** Damage dealt to a creature (by the Keeper's spells or his raised): the number floats, a boss may call help, it may fall. */
  private hurtMob(foe: Mob, dmg: number, color: string, crit = false): void {
    if (foe.hp <= 0) return;
    foe.hp -= dmg; foe.hit = .18;
    this.float(foe.x, foe.y - foe.def.h, crit ? `${dmg}!` : `${dmg}`, color);
    if (foe.hp <= 0) { this.kill(foe); return; }
    const call = foe.def.summon;
    if (call && !foe.summoned && foe.hp <= foe.def.hp * call.at && MOBS[call.type]) {
      foe.summoned = true;
      for (let i = 0; i < call.count; i++) {
        const side = i % 2 ? -1 : 1, x = foe.x + side * (foe.def.w / 2 + 10), y = foe.y + 6;
        const at = this.free(x, y) ? { x, y } : { x: foe.x, y: foe.y };
        this.mobs.push(this.spawnMob(`${foe.key}:call${i}:${Math.round(this.clock * 10)}`, MOBS[call.type], at.x, at.y));
        this.effects.push({ kind: 'raise', x: at.x, y: at.y, age: 0, life: .8, dir: 1 });
      }
    }
  }
  /** A blow or a shot landing on the Keeper: Worn Defense turns a share aside, the Dark Ward drinks what it can. */
  private biteKeeper(raw: number): void {
    const p = this.host.player();
    let n = raw;
    if (this.defense > 0) n = Math.max(1, Math.round(n * (1 - defenseReduction(this.defense, this.keeperLevel))));
    if (this.ward > 0) { const soak = Math.min(this.ward, n); this.ward -= soak; n -= soak; this.float(p.x + 8, p.y - 30, `-${soak}`, '#c8a8ff'); }
    if (n > 0) { this.host.hurtPlayer(n); this.float(p.x, p.y - 34, `${n}`, '#ff5a4a'); }
  }
  private hurtMinion(k: Minion, n: number): void {
    k.hp -= n; k.hit = .18;
    this.float(k.x, k.y - 26, `${n}`, '#c8a8ff');
  }

  /** Creatures' shots and the Keeper's spears in flight. */
  private updateShots(dt: number): void {
    const p = this.host.player();
    const flies = (x: number, y: number) => { const c = Math.floor(x / TILE), r = Math.floor((y + 12) / TILE); return this.host.passable ? this.host.passable(c, r) : this.host.walkable(c, r); };
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      stepShot(s, dt);
      if (s.age > s.life || !flies(s.x, s.y)) { this.shots.splice(i, 1); this.effects.push({ kind: 'spark', x: s.x, y: s.y, age: 0, life: .25, dir: 1 }); continue; }
      if (shotHits(s, p.x, p.y - 12, s.kind === 'breath' ? 10 : 7)) { this.shots.splice(i, 1); this.effects.push({ kind: 'spark', x: s.x, y: s.y, age: 0, life: .3, dir: 1 }); this.biteKeeper(s.dmg); continue; }
      const k = this.minions.find(mn => shotHits(s, mn.x, mn.y - 10, 7));
      if (k) { this.shots.splice(i, 1); this.effects.push({ kind: 'spark', x: s.x, y: s.y, age: 0, life: .25, dir: 1 }); this.hurtMinion(k, s.dmg); }
    }
    const v = SKILLS['bone-spear'].vars;
    for (let i = this.spears.length - 1; i >= 0; i--) {
      const s = this.spears[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.age += dt;
      for (const m of [...this.mobs]) {
        if (s.hit.includes(m) || !shotHits(s, m.x, m.y - m.def.h / 2, Math.max(9, m.def.w / 3))) continue;
        s.hit.push(m);
        this.effects.push({ kind: 'bolt-hit', x: s.x, y: s.y, age: 0, life: .25, dir: 1 });
        this.hitFoe(m, rnd(v['min'], v['max']), '#e9dcff');
      }
      if (s.age > s.life || !flies(s.x, s.y)) this.spears.splice(i, 1);
    }
  }

  /** The raised: crumble when their time is up, keep near the Keeper, fight the nearest foe. */
  private updateMinions(dt: number): void {
    const p = this.host.player();
    for (let i = this.minions.length - 1; i >= 0; i--) {
      const k = this.minions[i];
      k.life -= dt; k.t += dt; k.cd -= dt; k.hit = Math.max(0, k.hit - dt);
      if (k.life <= 0 || k.hp <= 0) {
        this.minions.splice(i, 1);
        for (let j = 0; j < 3; j++) this.effects.push({ kind: 'dust', x: k.x + rnd(-5, 5), y: k.y, age: 0, life: .5, dir: 1 });
        continue;
      }
      // Left far behind (a wall between, a long run): it steps out of the ground at the Keeper's side again.
      if (Math.hypot(k.x - p.x, k.y - p.y) > MINION_LEASH * 1.6) { k.x = p.x + (k.id % 2 ? -14 : 14); k.y = p.y + 2; if (!this.free(k.x, k.y)) { k.x = p.x; k.y = p.y; } k.target = null; }
      const t = k.target;
      if (!t || t.hp <= 0 || !this.mobs.includes(t) || Math.hypot(t.x - p.x, t.y - p.y) > MINION_LEASH) k.target = pickMinionTarget(k, this.mobs, p, MINION_SIGHT, MINION_LEASH);
      const foe = k.target;
      const tx = foe ? foe.x : p.x + (k.id % 2 ? -16 : 16), ty = foe ? foe.y : p.y + 4, stop = foe ? MOB_REACH - 4 : 6;
      const dx = tx - k.x, dy = ty - k.y, len = Math.hypot(dx, dy);
      if (len > stop) {
        const step = Math.min(len - stop, MINION_SPEED * dt), vx = dx / len * step, vy = dy / len * step;
        if (this.free(k.x + vx, k.y)) k.x += vx;
        if (this.free(k.x, k.y + vy)) k.y += vy;
      }
      if (Math.abs(dx) > 2) k.face = dx < 0 ? -1 : 1;
      // Its blow only ever lands on a creature: the Keeper is never its foe.
      if (foe && Math.hypot(foe.x - k.x, foe.y - k.y) <= MOB_REACH && k.cd <= 0) {
        k.cd = RAISED_SKELETON.rate;
        this.effects.push({ kind: 'slash', x: foe.x, y: foe.y - foe.def.h / 2, age: 0, life: .2, dir: k.face });
        this.hurtMob(foe, rnd(k.dmg[0], k.dmg[1]), '#c88bff');
      }
    }
  }

  /** Use a skill from the bar. Returns why not (for the host to say), or null when it went off. */
  useAbility(id: SkillId): 'cooldown' | 'nofoe' | 'mana' | null {
    const sk = SKILLS[id];
    if (!sk || sk.kind !== 'active') return null;
    if ((this.cooldowns[id] ?? 0) > 0) return 'cooldown';
    if (this.mana < sk.mana) return 'mana';
    const p = this.host.player();
    const foeInRange = (): Mob | null => {
      if (this.target && Math.hypot(this.target.x - p.x, this.target.y - p.y) <= this.range) return this.target;
      let best: Mob | null = null, bd = this.range;
      for (const m of this.mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d <= bd) { bd = d; best = m; } }
      return best;
    };
    const v = sk.vars;
    if (id === 'drain-life') {
      const foe = foeInRange();
      if (!foe) return 'nofoe';
      const dmg = rnd(v['min'], v['max']);
      this.effects.push({ kind: 'drain', x: foe.x, y: foe.y - foe.def.h / 2, tx: p.x, ty: p.y - 20, age: 0, life: .5, dir: 1 });
      this.hitFoe(foe, dmg, '#ff7a6a');
      const heal = Math.round(dmg * v['heal'] / 100);
      this.host.healPlayer(heal); this.float(p.x, p.y - 36, `+${heal}`, '#7fe08a');
      this.host.swung(foe);
    } else if (id === 'ember-curse') {
      const foe = foeInRange();
      if (!foe) return 'nofoe';
      foe.cursed = v['secs']; foe.burnT = 1;
      this.effects.push({ kind: 'curse', x: foe.x, y: foe.y - foe.def.h - 4, age: 0, life: .6, dir: 1 });
      this.host.swung(foe);
    } else if (id === 'hellfire-nova') {
      for (const m of [...this.mobs]) if (Math.hypot(m.x - p.x, m.y - p.y) <= v['radius'] * TILE) this.hitFoe(m, rnd(v['min'], v['max']), '#ff9a4a');
      this.effects.push({ kind: 'wave', x: p.x, y: p.y - 8, age: 0, life: .5, dir: 1 });
      this.host.swung(null);
    } else if (id === 'bone-spear') {
      const foe = foeInRange();
      if (!foe) return 'nofoe';
      const sx = p.x, sy = p.y - 16, a = Math.atan2(foe.y - foe.def.h / 2 - sy, foe.x - sx);
      this.spears.push({ x: sx, y: sy, vx: Math.cos(a) * SPEAR_SPEED, vy: Math.sin(a) * SPEAR_SPEED, age: 0, life: v['range'] * TILE / SPEAR_SPEED, hit: [] });
      this.host.swung(foe);
    } else if (id === 'raise-skeleton') {
      // From the fresh dead nearest the Keeper first; with none, out of the ground at his side.
      const fresh = this.corpses
        .filter(cp => this.clock - cp.at <= CORPSE_SECS && Math.hypot(cp.x - p.x, cp.y - p.y) <= v['reach'] * TILE)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
      const st = raisedStats(this.keeperLevel, this.power, v);
      for (let i = 0; i < v['count']; i++) {
        const cp = fresh[i];
        let at = cp ? { x: cp.x, y: cp.y } : { x: p.x + (i % 2 ? -16 : 16), y: p.y + 2 };
        if (cp) this.corpses.splice(this.corpses.indexOf(cp), 1);
        else if (!this.free(at.x, at.y)) at = { x: p.x, y: p.y };
        this.minions.push({ id: this.minionSeq++, x: at.x, y: at.y, hp: st.hp, maxHp: st.hp, dmg: st.dmg, cd: .6, t: 0, face: 1, life: v['secs'], hit: 0, target: null });
        this.effects.push({ kind: 'raise', x: at.x, y: at.y, age: 0, life: .8, dir: 1 });
      }
      capMinions(this.minions, v['max']);
      this.host.swung(null);
    } else if (id === 'dark-ward') {
      this.ward = v['absorb']; this.wardT = v['secs'];
      this.effects.push({ kind: 'ward', x: p.x, y: p.y - 14, age: 0, life: .6, dir: 1 });
      this.host.swung(null);
    }
    this.mana -= sk.mana;
    this.cooldowns[id] = sk.cd / (1 + this.castSpeed);
    return null;
  }

  /** Wood chips flying off a struck tree (the host's chopping). */
  chips(x: number, y: number): void { this.effects.push({ kind: 'chips', x, y, age: 0, life: .45, dir: Math.random() < .5 ? -1 : 1 }); }

  private free(x: number, y: number, floats = false): boolean {
    const ok = floats && this.host.hover ? (c: number, r: number) => this.host.hover!(c, r) : (c: number, r: number) => this.host.walkable(c, r);
    for (const [ox, oy] of [[-4, -3], [4, -3], [-4, -1], [4, -1]]) if (!ok(Math.floor((x + ox) / TILE), Math.floor((y + oy) / TILE))) return false;
    return true;
  }

  private float(x: number, y: number, text: string, color: string): void { this.floaters.push({ x, y, text, color, age: 0 }); }

  private kill(m: Mob): void {
    this.mobs.splice(this.mobs.indexOf(m), 1);
    // Soul Harvest (passive): every kill gives back mana.
    this.mana = Math.min(this.maxMana, this.mana + SKILLS['soul-harvest'].vars['mana']);
    if (this.target === m) this.target = null;
    this.deadUntil.set(m.key, this.clock + RESPAWN);
    // Fresh dead, for Raise Skeleton.
    this.corpses.push({ x: m.x, y: m.y, at: this.clock });
    if (this.corpses.length > 12) this.corpses.shift();
    const id = `td:${this.host.levelId()}:${m.key}:${Date.now().toString(36)}:${this.kills++}`;
    const areaId = this.host.levelId() === 'surface' ? 'ember-quarry' : 'ember-delve';
    this.host.options.onKill?.({ id, areaId, creature: m.def.id, name: m.def.name, hp: m.def.hp });
    // The ground loot: a coin pile with the creature's materials, and whatever gear the host rolls for the kill.
    const spot = (i: number) => ({ x: m.x + (i % 3 - 1) * 6, y: m.y + Math.floor(i / 3) * 5 });
    let n = 0;
    const coins = rnd(m.def.coins[0], m.def.coins[1]);
    for (const d of m.def.drops) {
      if (Math.random() >= d.chance) continue;
      this.drops.push({ id: `${id}:m${n}`, ...spot(n++), coins: 0, material: d.material, qty: d.qty, label: d.material.replace(/-/g, ' '), color: RARITY_COLOR.common, age: 0 });
    }
    this.drops.push({ id: `${id}:c`, ...spot(n++), coins, qty: 0, label: `${coins} Gold`, color: '#ffd25a', age: 0 });
    let rows: readonly LootRow[] = [];
    try { rows = this.host.options.rollLoot?.({ creature: m.def.id, level: m.def.level, rank: m.def.rank ?? 'normal', killKey: id }) ?? []; } catch { rows = []; }
    rows.forEach((row, i) => {
      const color = RARITY_COLOR[row.rarity] ?? RARITY_COLOR.common;
      if (row.kind === 'item') this.drops.push({ id: `${id}:g${i}`, ...spot(n++), coins: 0, qty: 0, item: { definitionId: row.definitionId, rarity: row.rarity, unique: !!row.unique, level: row.level ?? m.def.level }, label: row.label, color, age: 0 });
      else this.drops.push({ id: `${id}:r${i}`, ...spot(n++), coins: 0, qty: 0, rune: row.rune, label: row.label, color, age: 0 });
    });
  }

  private pick(g: Drop, i: number): void {
    const ok = this.host.options.onLoot?.({
      id: g.id, coins: g.coins, ore: g.material ? g.qty : 0, ...(g.material ? { material: g.material } : {}),
      ...(g.item ? { item: g.item } : {}), ...(g.rune ? { rune: g.rune } : {}),
    });
    if (ok === false) return;   // the satchel is full: it stays on the ground
    this.drops.splice(i, 1);
    this.float(g.x, g.y - 10, g.label, g.color);
  }
}
