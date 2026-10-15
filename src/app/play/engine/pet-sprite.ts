/**
 * pet-sprite.ts — the pet that follows the Keeper (docs/handoff/pets.md).
 *
 * The art is shared/pets/pet-art.ts (one cached sheet per pet type, one blit
 * per frame). This is the motion, MapleStory-pet style: it trots a little
 * behind the Keeper with a bouncy hop, turns when you turn, catches up when
 * you run, curls up asleep when you stand still a while (a few drifting z's),
 * lights up on a meal or a pickup, spins its trick, and pricks up on a bark.
 * Its name sits on a small plate under its feet.
 *
 * Reduced motion: no hop, no spin, no drifting z's; it simply sits at its
 * place behind the Keeper (still facing, still asleep when you rest).
 * Pure apart from the canvas calls; the engine owns one.
 */
import { PET_TOP, drawPet, type PetFrame } from '../../shared/pets/pet-art';
import type { PetId } from '../../shared/pets/pets.model';
import type { PetPose } from './pet-brain';

/** World px per art px at figure 1 (the Keeper's grid; 2 in the Delve at 0.5). */
const PET_PIXEL = 4;
/** Seconds of the Keeper standing still before the pet curls up. */
export const PET_SLEEP_AFTER = 14;

export interface PetFrameInput {
  dt: number;
  time: number;
  reduced: boolean;
  keeperX: number;
  keeperY: number;
  facing: number;
  figure: number;
  /** The Keeper moved this frame. */
  moving: boolean;
  /** Somewhere the pet is going instead of its place (a drop it fetches, a foe, a node), or null. */
  goalX: number | null;
  /** A height to hover at instead of the floor (the moth over the bob), or null. */
  goalY?: number | null;
  /** What it is doing (pet-brain.ts): the frame and the little extras follow it. */
  pose?: PetPose;
  /** The x of a lunge or a dash, decaying (presentation). */
  lunge?: number;
  /** Seconds still before it curls up (sooner at night). */
  sleepAfter?: number;
}

export class PetSprite {
  id: PetId | null = null;
  name = '';
  hat = false;
  x = NaN;
  y = NaN;
  /**
   * Hanging (the Orrery Wells, engine/celestial.ts): the Keeper's down is up, so `y` is the ceiling the pet
   * stands on and it is drawn upside down beneath it, like the Keeper. Set by the engine every step.
   */
  hang = false;
  face = 1;
  /** Seconds the Keeper (and pet) have been still. */
  still = 0;
  private hopT = 0;
  private hop = 0;
  private happy = 0;
  private trick = 0;
  private alert = 0;
  private walking = false;
  /** What the brain says it is doing (pet-brain.ts PetPose). */
  pose: PetPose = 'none';
  private lunge = 0;
  private sleepAfter = PET_SLEEP_AFTER;
  /** Hearts rising (a meal, a pat): seconds left. */
  private love = 0;

  set(id: PetId | null, name: string, hat: boolean): void {
    if (id !== this.id) { this.x = NaN; this.y = NaN; this.still = 0; }
    this.id = id; this.name = name; this.hat = hat;
  }

  /** A feeling: a meal or a pickup (happy), hearts (love), its trick (a spin), a bark (alert). */
  feel(kind: 'happy' | 'love' | 'trick' | 'alert', seconds = 1): void {
    if (kind === 'love') { this.love = Math.max(this.love, seconds + .6); this.happy = Math.max(this.happy, seconds); }
    else if (kind === 'happy') this.happy = Math.max(this.happy, seconds);
    else if (kind === 'trick') this.trick = 1.1;
    else this.alert = Math.max(this.alert, seconds);
    this.still = 0;
  }

  get asleep(): boolean {
    const busy = this.pose !== 'none' && this.pose !== 'sit' && this.pose !== 'tired';
    return (this.pose === 'tired' || this.still >= this.sleepAfter) && !busy && !this.happy && !this.trick && !this.alert;
  }
  get state(): 'follow' | 'sleep' | 'happy' | 'trick' | 'alert' | PetPose {
    if (this.trick > 0) return 'trick';
    if (this.alert > 0) return 'alert';
    if (this.pose !== 'none' && this.pose !== 'love') return this.pose;
    return this.happy > 0 ? 'happy' : this.asleep ? 'sleep' : 'follow';
  }

  /** Its place: a little behind the Keeper, on the same floor. */
  place(f: PetFrameInput): number {
    return f.keeperX - f.facing * 74 * f.figure;
  }

  update(f: PetFrameInput): void {
    if (!this.id) return;
    const k = f.figure;
    const tx = f.goalX ?? this.place(f);
    const far = !Number.isFinite(this.x) || Math.abs(tx - this.x) > 1600 || Math.abs(f.keeperY - this.y) > 520;
    this.happy = Math.max(0, this.happy - f.dt); this.trick = Math.max(0, this.trick - f.dt); this.alert = Math.max(0, this.alert - f.dt);
    this.love = Math.max(0, this.love - f.dt);
    this.pose = f.pose ?? 'none';
    this.lunge = f.reduced ? 0 : f.lunge ?? 0;
    this.sleepAfter = f.sleepAfter ?? PET_SLEEP_AFTER;
    const ty = f.goalY ?? f.keeperY;
    if (far || f.reduced) {
      // A long way off (a passage, a waystone, a fall): it is simply there. Reduced motion: always.
      this.x = tx; this.y = ty; this.hop = 0; this.walking = false;
      if (f.moving) this.still = 0; else this.still += f.dt;
      if (f.goalX === null) this.face = f.facing;
      return;
    }
    const dx = tx - this.x;
    const ease = 1 - Math.exp(-4.5 * Math.min(f.dt, .1));
    let step = dx * ease;
    // A tired pet trots slowly; a dash is a streak.
    const cap = (this.pose === 'tired' ? 260 : this.pose === 'attack' ? 1100 : 760) * k * f.dt;
    if (Math.abs(step) > cap) step = Math.sign(step) * cap;
    this.x += step;
    this.y += (ty - this.y) * (1 - Math.exp(-9 * Math.min(f.dt, .1)));
    this.walking = Math.abs(dx) > 8 * k;
    if (this.walking) { this.face = Math.sign(dx) || this.face; this.hopT += f.dt * 6.5; }
    else if (!this.trick) this.face = f.keeperX >= this.x ? 1 : -1;
    // The hop: a bouncy arc while it trots; settles when it stops.
    const arc = this.walking ? Math.abs(Math.sin(this.hopT * Math.PI)) : 0;
    this.hop += (arc - this.hop) * Math.min(1, f.dt * 18);
    if (this.trick > 0) this.hop = Math.sin((1.1 - this.trick) / 1.1 * Math.PI) * 1.6;
    // Digging: quick little bobs in place.
    if (this.pose === 'dig') this.hop = Math.abs(Math.sin(f.time * 18)) * .45;
    if (f.moving || this.walking || (this.pose !== 'none' && this.pose !== 'sit' && this.pose !== 'tired')) this.still = 0; else this.still += f.dt;
  }

  /** Which frame shows now. */
  frame(time: number, reduced: boolean): PetFrame {
    if (this.trick > 0 && !reduced) return 'happy';
    if (this.alert > 0) return 'alert';
    if (this.pose === 'attack') return reduced || Math.abs(this.lunge) > 4 ? 'alert' : this.walking ? (this.hop > .5 ? 'hop1' : 'hop0') : 'alert';
    if (this.pose === 'tired') return 'sleep';
    if (this.pose === 'dig') return reduced || Math.floor(time * 9) % 2 ? 'hop0' : 'idle0';
    if (this.pose === 'heal' || this.pose === 'love') return 'happy';
    if (this.happy > 0) return 'happy';
    if (this.asleep) return 'sleep';
    if (this.walking && !reduced) return this.hop > .5 ? 'hop1' : 'hop0';
    if (!reduced && (time + (this.id?.length ?? 0) * .7) % 3.4 < .13) return 'blink';
    return reduced || Math.floor(time * 1.6) % 2 === 0 ? 'idle0' : 'idle1';
  }

  /**
   * The little pixel extras: hearts rising (a meal, a pat), dirt flecks on a
   * dig, a sweat drop when tired, a ring of light on the Sunling's pulse, a
   * slash on a bite. Squares on the pet's own grid; no gradients, no blur.
   */
  private extras(c: CanvasRenderingContext2D, time: number, reduced: boolean, figure: number, head: number): void {
    const px = Math.max(2, Math.round(2 * figure));
    if (this.love > 0) {
      c.fillStyle = '#ff7aa8';
      for (let n = 0; n < 3; n++) {
        const u = reduced ? .4 : ((time * .9 + n / 3) % 1);
        c.globalAlpha = Math.min(1, this.love) * (1 - u);
        const hx = Math.round(this.x + (n - 1) * 12 * figure), hy = Math.round(head - 6 * figure - u * 30 * figure);
        // A 5×4 pixel heart.
        c.fillRect(hx - 2 * px, hy, px, px); c.fillRect(hx + px, hy, px, px);
        c.fillRect(hx - 2 * px, hy + px, 4 * px, px); c.fillRect(hx - px, hy + 2 * px, 2 * px, px);
      }
      c.globalAlpha = 1;
    }
    if (this.pose === 'dig' && !reduced) {
      c.fillStyle = '#8a6a42';
      for (let n = 0; n < 4; n++) {
        const u = (time * 3 + n / 4) % 1;
        c.globalAlpha = 1 - u;
        c.fillRect(Math.round(this.x + (n % 2 ? 1 : -1) * (6 + u * 18) * figure), Math.round(this.y - u * 22 * figure + u * u * 18 * figure), px, px);
      }
      c.globalAlpha = 1;
    }
    if (this.pose === 'tired') {
      c.fillStyle = '#9fd4ff';
      const bob = reduced ? 0 : Math.sin(time * 3) * 2;
      c.fillRect(Math.round(this.x + 14 * figure * this.face), Math.round(head + 4 + bob), px, px * 2);
    }
    if (this.pose === 'heal') {
      // A square ring of warm light, growing.
      const r = Math.round((18 + (reduced ? 10 : (time * 40) % 30)) * figure);
      c.globalAlpha = .55; c.fillStyle = '#ffe9a0';
      const cx = Math.round(this.x), cy = Math.round(this.y - 18 * figure);
      c.fillRect(cx - r, cy - r, 2 * r, px); c.fillRect(cx - r, cy + r, 2 * r, px);
      c.fillRect(cx - r, cy - r, px, 2 * r); c.fillRect(cx + r, cy - r, px, 2 * r);
      c.globalAlpha = 1;
    }
    if (this.pose === 'attack' && Math.abs(this.lunge) > 6) {
      // The bite's mark: three short white pixel slashes ahead of it.
      c.fillStyle = '#fff4e0';
      const dir = Math.sign(this.lunge), bx = Math.round(this.x + dir * 22 * figure), by = Math.round(this.y - 20 * figure);
      for (let n = 0; n < 3; n++) c.fillRect(bx + dir * n * px, by - n * px * 2, px, px * 2);
    }
  }

  /** The top of its head, world px above its feet (name plates, "!"). */
  top(figure: number): number { return (PET_TOP + 2) * PET_PIXEL * figure; }

  draw(c: CanvasRenderingContext2D, time: number, reduced: boolean, figure: number): void {
    if (!this.id || !Number.isFinite(this.x)) return;
    const s = PET_PIXEL * figure;
    const lift = reduced ? 0 : this.hop * 7 * figure * (this.trick > 0 ? 6 : 1);
    // A bite lunges a little toward the foe and springs back.
    const lx = this.pose === 'attack' ? Math.max(-30, Math.min(30, this.lunge)) * .6 : 0;
    const x0 = this.x;
    this.x += lx;
    // The spin: it turns round twice in the air.
    const face = this.trick > 0 && !reduced ? (Math.floor((1.1 - this.trick) / .14) % 2 ? -this.face : this.face) : this.face;
    const land = !reduced && !this.walking && this.hop > .05 && this.trick <= 0 ? .08 * this.hop : 0;
    // Hanging from a ceiling: everything but the name plate mirrored about the line it stands on.
    if (this.hang) { c.save(); c.translate(0, 2 * this.y); c.scale(1, -1); }
    // A soft shadow on the floor (smaller as it hops).
    c.fillStyle = 'rgba(10, 6, 16, 0.32)';
    const sw = (26 - Math.min(10, lift / s)) * figure * 2;
    c.fillRect(Math.round(this.x - sw / 2), Math.round(this.y - 2 * figure), Math.round(sw), Math.max(2, Math.round(4 * figure)));
    drawPet(c, this.id, this.frame(time, reduced), this.hat, this.x, this.y - lift, s, face, land);
    const head = this.y - lift - this.top(figure);
    if (this.alert > 0) {
      c.fillStyle = '#ffc589'; c.font = `bold ${Math.round(18 * Math.max(.7, figure))}px system-ui`; c.textAlign = 'center';
      c.fillText('!', this.x, head - 4);
    }
    if (this.asleep && !reduced) {
      // Three small z's drifting up and fading.
      c.fillStyle = '#d8dcf0'; c.textAlign = 'center';
      for (let n = 0; n < 3; n++) {
        const u = ((time * .45 + n / 3) % 1);
        c.globalAlpha = .8 * (1 - u);
        c.font = `600 ${Math.round((9 + n * 2) * Math.max(.8, figure))}px system-ui`;
        c.fillText('z', this.x + (10 + u * 16) * this.face * figure * 2, head + 10 * figure - u * 34 * figure);
      }
      c.globalAlpha = 1;
    }
    this.extras(c, time, reduced, figure, head);
    if (this.hang) c.restore();
    this.x = x0;
    if (this.name) {
      // The name plate under its feet, MapleStory style (over them, hanging: the plate stays readable).
      c.font = '600 12px "Cormorant Garamond", Georgia, serif'; c.textAlign = 'center';
      const w = Math.min(130, c.measureText(this.name).width + 12);
      const py = this.hang ? this.y - 20 : this.y + 4;
      c.fillStyle = '#1a120fd0';
      c.fillRect(Math.round(this.x - w / 2), Math.round(py), Math.round(w), 16);
      c.fillStyle = '#ffe1b0';
      c.fillText(this.name, this.x, py + 12, 120);
    }
  }
}
