/**
 * forge-strike.component.ts — "Forge Strike", the Arena's reflex game.
 *
 * Sixty seconds at the anvil. Bugs and features surface on a 2D canvas and you
 * strike them; live errors surface too and cost you if you do.
 *
 * Input is `pointerdown`, not `click`: a click fires on release, which on a
 * phone is 100-300ms after the finger lands and long enough to feel like the
 * game ate the tap. Hit testing walks the target list backwards so the target
 * drawn on top — the one the player can actually see — is the one that is hit.
 */
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ArenaShellComponent } from '../arena-shell.component';
import { ArenaGameBase } from '../arena-game.base';
import { RunResult } from '../arena-scores.service';

type TargetKind = 'bug' | 'feature' | 'error';

interface TargetSpec {
  glyph: string;
  points: number;
  color: string;
  /** Seconds on screen before it leaves on its own. */
  life: number;
  radius: number;
}

const SPECS: Record<TargetKind, TargetSpec> = {
  bug:     { glyph: '🐛', points:  10, color: '#7fd5a3', life: 1.5, radius: 30 },
  feature: { glyph: '⚡', points:   5, color: '#c89868', life: 1.9, radius: 28 },
  error:   { glyph: '💥', points: -20, color: '#ff2d4d', life: 1.7, radius: 30 },
};

interface Target {
  kind: TargetKind;
  x: number;
  y: number;
  age: number;
  life: number;
  radius: number;
  /**
   * Struck or expired. A dead target is never hit-testable again — the flag is
   * separate from `hit` because a struck target's fade passes through zero and
   * would otherwise read as alive again on the next frame.
   */
  dead: boolean;
  /** 1 → 0 while the strike animation plays out. */
  hit: number;
}

interface Floater {
  x: number; y: number; text: string; color: string; life: number;
}

interface Spark {
  x: number; y: number; vx: number; vy: number; life: number; color: string;
}

/** Round length. */
const ROUND_SECONDS = 60;
/** Score that counts as a clean shift and pays the first-clear XP. */
const CLEAR_SCORE = 400;
/** Every this many consecutive good strikes adds one to the multiplier. */
const COMBO_STEP = 5;
const MAX_MULTIPLIER = 5;

@Component({
  selector: 'app-forge-strike',
  standalone: true,
  imports: [CommonModule, RouterLink, ArenaShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './forge-strike.component.html',
  styleUrls: ['../arena-game.css', './forge-strike.component.css'],
})
export class ForgeStrikeComponent extends ArenaGameBase
  implements OnInit, AfterViewInit, OnDestroy {

  readonly gameId = 'forge-strike';
  readonly clearScore = CLEAR_SCORE;
  readonly roundSeconds = ROUND_SECONDS;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  @ViewChild('canvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  phase: 'intro' | 'playing' | 'over' = 'intro';
  score = 0;
  combo = 0;
  bestCombo = 0;
  remaining = ROUND_SECONDS;
  bugsSquashed = 0;
  featuresShipped = 0;
  errorsTouched = 0;
  result: RunResult | null = null;

  private ctx: CanvasRenderingContext2D | null = null;
  private targets: Target[] = [];
  private floaters: Floater[] = [];
  private sparks: Spark[] = [];
  private raf = 0;
  private last = 0;
  private spawnTimer = 0;
  private elapsed = 0;
  private reduced = false;
  private width = 0;
  private height = 0;
  private readonly onResize = () => this.sizeCanvas();

  async ngOnInit(): Promise<void> {
    await this.resolveGate();
    if (this.isBrowser) {
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    this.cdr.markForCheck();
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) window.addEventListener('resize', this.onResize, { passive: true });
  }

  ngOnDestroy(): void {
    this.stopLoop();
    if (this.isBrowser) window.removeEventListener('resize', this.onResize);
  }

  get multiplier(): number {
    return Math.min(MAX_MULTIPLIER, 1 + Math.floor(this.combo / COMBO_STEP));
  }

  // ── lifecycle ───────────────────────────────────────────────

  start(): void {
    this.phase = 'playing';
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.bugsSquashed = 0;
    this.featuresShipped = 0;
    this.errorsTouched = 0;
    this.remaining = ROUND_SECONDS;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.targets = [];
    this.floaters = [];
    this.sparks = [];
    this.result = null;
    this.cdr.detectChanges(); // the canvas only exists once `playing` renders

    this.sizeCanvas();
    this.last = performance.now();
    this.zone.runOutsideAngular(() => {
      this.raf = requestAnimationFrame(t => this.frame(t));
    });
  }

  private end(): void {
    this.stopLoop();
    this.phase = 'over';
    const won = this.score >= CLEAR_SCORE;
    this.result = this.finishRun(Math.max(0, this.score), won);
    this.cdr.markForCheck();
  }

  private stopLoop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  playAgain(): void {
    this.phase = 'intro';
    this.result = null;
    this.cdr.markForCheck();
  }

  // ── input ───────────────────────────────────────────────────

  onStrike(event: PointerEvent): void {
    if (this.phase !== 'playing') return;
    event.preventDefault();

    const el = this.canvasRef?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Backwards: the last target in the list is the one drawn on top.
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (t.dead) continue;
      const dx = x - t.x;
      const dy = y - t.y;
      if (dx * dx + dy * dy <= t.radius * t.radius) {
        this.resolveHit(t);
        return;
      }
    }
    // A swing at empty air costs nothing. Punishing it would make the game a
    // test of restraint on a small screen rather than of reflex.
  }

  private resolveHit(t: Target): void {
    const spec = SPECS[t.kind];
    t.dead = true;
    t.hit = 1;

    if (t.kind === 'error') {
      this.score += spec.points;           // negative, and never multiplied
      this.combo = 0;
      this.errorsTouched++;
      this.pop(t, `${spec.points}`, spec.color, 16);
    } else {
      const gained = spec.points * this.multiplier;
      this.score += gained;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      if (t.kind === 'bug') this.bugsSquashed++;
      else this.featuresShipped++;
      const label = this.multiplier > 1 ? `+${gained} ×${this.multiplier}` : `+${gained}`;
      this.pop(t, label, spec.color, 10);
    }

    this.zone.run(() => this.cdr.markForCheck());
  }

  private pop(t: Target, text: string, color: string, sparkCount: number): void {
    this.floaters.push({ x: t.x, y: t.y - 10, text, color, life: 1 });
    if (this.reduced) return;
    for (let i = 0; i < sparkCount; i++) {
      const a = (Math.PI * 2 * i) / sparkCount;
      this.sparks.push({
        x: t.x, y: t.y,
        vx: Math.cos(a) * (70 + Math.random() * 120),
        vy: Math.sin(a) * (70 + Math.random() * 120),
        life: 1, color,
      });
    }
  }

  // ── loop ────────────────────────────────────────────────────

  /**
   * Errors get commoner as the round runs on: 15% at the start, 35% by the
   * end. The forge heating up is the difficulty curve.
   */
  private pickKind(progress: number): TargetKind {
    const roll = Math.random();
    const errorChance = 0.15 + progress * 0.2;
    if (roll < errorChance) return 'error';
    return roll < errorChance + (1 - errorChance) * 0.6 ? 'bug' : 'feature';
  }

  private spawn(progress: number): void {
    const kind = this.pickKind(progress);
    const spec = SPECS[kind];
    const pad = spec.radius + 8;
    this.targets.push({
      kind,
      x: pad + Math.random() * Math.max(1, this.width - pad * 2),
      y: pad + Math.random() * Math.max(1, this.height - pad * 2),
      age: 0,
      // Targets get shorter-lived as the round runs on, down to 65% of base.
      life: spec.life * (1 - progress * 0.35),
      radius: spec.radius,
      dead: false,
      hit: 0,
    });
  }

  private frame(now: number): void {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.elapsed += dt;

    const left = Math.max(0, ROUND_SECONDS - this.elapsed);
    const shownLeft = Math.ceil(left);
    if (shownLeft !== this.remaining) {
      this.remaining = shownLeft;
      this.zone.run(() => this.cdr.markForCheck());
    }
    if (left <= 0) {
      this.zone.run(() => this.end());
      return;
    }

    const progress = this.elapsed / ROUND_SECONDS;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawn(progress);
      // 0.75s between surfacings at the start, 0.32s at the end.
      this.spawnTimer = 0.75 - progress * 0.43;
    }

    let comboBroken = false;
    for (const t of this.targets) {
      if (t.dead) { t.hit -= dt * 5; continue; }
      t.age += dt;
      if (t.age >= t.life) {
        // Expired rather than struck: dead with no strike animation to play.
        t.dead = true;
        t.hit = 0;
        // A bug that gets away breaks the chain; an unshipped feature is only
        // a missed opportunity.
        if (t.kind === 'bug' && this.combo > 0) comboBroken = true;
      }
    }
    this.targets = this.targets.filter(t => !t.dead || t.hit > 0);

    if (comboBroken) {
      this.combo = 0;
      this.zone.run(() => this.cdr.markForCheck());
    }

    for (const f of this.floaters) {
      f.y -= 34 * dt;
      f.life -= dt * 1.3;
    }
    this.floaters = this.floaters.filter(f => f.life > 0);

    for (const s of this.sparks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 180 * dt;
      s.life -= dt * 2;
    }
    this.sparks = this.sparks.filter(s => s.life > 0);

    this.draw();
    this.raf = requestAnimationFrame(t => this.frame(t));
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const t of this.targets) {
      const spec = SPECS[t.kind];
      // Scale in over the first 120ms, then out over the last 25% of its life.
      const inScale = Math.min(1, t.age / 0.12);
      const outScale = t.age > t.life * 0.75
        ? Math.max(0, 1 - (t.age - t.life * 0.75) / (t.life * 0.25))
        : 1;
      const strike = t.dead ? 1 + (1 - t.hit) * 0.6 : 1;
      // Reduced motion keeps targets at a steady size — they still appear and
      // disappear, which is the game, but nothing pops or swells.
      const scale = this.reduced ? 1 : inScale * outScale * strike;
      const alpha = t.dead ? Math.max(0, t.hit) : (this.reduced ? 1 : outScale);

      ctx.globalAlpha = alpha;

      // Halo, so a target reads as a target before the emoji resolves.
      const r = t.radius * scale;
      const grad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, r);
      grad.addColorStop(0, spec.color + '55');
      grad.addColorStop(1, spec.color + '00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = spec.color;
      ctx.lineWidth = t.kind === 'error' ? 2 : 1.2;
      ctx.globalAlpha = alpha * 0.7;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r * 0.78, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.font = `${Math.round(26 * scale)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.fillText(spec.glyph, t.x, t.y + 1);
    }

    ctx.font = '700 15px system-ui, sans-serif';
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }

    for (const s of this.sparks) {
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  private sizeCanvas(): void {
    const el = this.canvasRef?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    el.width = Math.round(rect.width * dpr);
    el.height = Math.round(rect.height * dpr);
    this.ctx = el.getContext('2d');
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}
