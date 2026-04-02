import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

interface KeyframePoint {
  percent: number;
  translateX: number;
  translateY: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  backgroundColor: string;
}

interface AnimationPreset {
  name: string;
  keyframes: KeyframePoint[];
  duration: number;
  timingFunction: string;
  delay: number;
  iterationCount: string;
  direction: string;
}

@Component({
  selector: 'app-animation-generator',
  templateUrl: './animation-generator.component.html',
  styleUrls: ['./animation-generator.component.css'],
  standalone: false
})
export class AnimationGeneratorComponent {

  // ── Keyframes ──────────────────────────────────────────
  keyframes: KeyframePoint[] = [];
  activeKeyframeIndex = 0;

  // ── Animation Controls ─────────────────────────────────
  animationName = 'my-animation';
  duration = 1;
  timingFunction = 'ease';
  customCubicBezier = '0.25, 0.1, 0.25, 1.0';
  delay = 0;
  iterationCount = '1';
  direction = 'normal';

  // ── Preview ────────────────────────────────────────────
  previewBgColor = '#0a0a0f';
  previewBoxColor = '#00ffcc';
  previewBorderRadius = 12;
  isPlaying = true;

  // ── Code ───────────────────────────────────────────────
  codeCopied = false;

  readonly timingFunctions = ['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-bezier'];
  readonly directions = ['normal', 'reverse', 'alternate', 'alternate-reverse'];
  readonly availablePercents = [0, 25, 50, 75, 100];

  // ── Presets ────────────────────────────────────────────
  readonly presets: AnimationPreset[] = [
    {
      name: 'Fade In',
      keyframes: [
        { percent: 0, translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1, opacity: 0, backgroundColor: '#00ffcc' },
        { percent: 100, translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1, opacity: 1, backgroundColor: '#00ffcc' }
      ],
      duration: 0.6, timingFunction: 'ease', delay: 0, iterationCount: '1', direction: 'normal'
    },
    {
      name: 'Slide Up',
      keyframes: [
        { percent: 0, translateX: 0, translateY: 80, rotate: 0, scaleX: 1, scaleY: 1, opacity: 0, backgroundColor: '#00ffcc' },
        { percent: 100, translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1, opacity: 1, backgroundColor: '#00ffcc' }
      ],
      duration: 0.5, timingFunction: 'ease-out', delay: 0, iterationCount: '1', direction: 'normal'
    },
    {
      name: 'Bounce',
      keyframes: [
        { percent: 0, translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1, opacity: 1, backgroundColor: '#00ffcc' },
        { percent: 25, translateX: 0, translateY: -40, rotate: 0, scaleX: 1, scaleY: 1, opacity: 1, backgroundColor: '#00ffcc' },
        { percent: 50, translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1, opacity: 1, backgroundColor: '#00ffcc' },
        { percent: 75, translateX: 0, translateY: -20, rotate: 0, scaleX: 1, scaleY: 1, opacity: 1, backgroundColor: '#00ffcc' },
        { percent: 100, translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1, opacity: 1, backgroundColor: '#00ffcc' }
      ],
      duration: 0.8, timingFunction: 'ease', delay: 0, iterationCount: 'infinite', direction: 'normal'
    },
    {
      name: 'Spin',
      keyframes: [
        { percent: 0, translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1, opacity: 1, backgroundColor: '#00ffcc' },
        { percent: 100, translateX: 0, translateY: 0, rotate: 360, scaleX: 1, scaleY: 1, opacity: 1, backgroundColor: '#00ffcc' }
      ],
      duration: 1, timingFunction: 'linear', delay: 0, iterationCount: 'infinite', direction: 'normal'
    },
    {
      name: 'Pulse',
      keyframes: [
        { percent: 0, translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1, opacity: 1, backgroundColor: '#00ffcc' },
        { percent: 50, translateX: 0, translateY: 0, rotate: 0, scaleX: 1.15, scaleY: 1.15, opacity: 0.8, backgroundColor: '#00ffcc' },
        { percent: 100, translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1, opacity: 1, backgroundColor: '#00ffcc' }
      ],
      duration: 1.2, timingFunction: 'ease-in-out', delay: 0, iterationCount: 'infinite', direction: 'normal'
    },
    {
      name: 'Shake',
      keyframes: [
        { percent: 0, translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1, opacity: 1, backgroundColor: '#00ffcc' },
        { percent: 25, translateX: -10, translateY: 0, rotate: -3, scaleX: 1, scaleY: 1, opacity: 1, backgroundColor: '#00ffcc' },
        { percent: 50, translateX: 10, translateY: 0, rotate: 3, scaleX: 1, scaleY: 1, opacity: 1, backgroundColor: '#00ffcc' },
        { percent: 75, translateX: -10, translateY: 0, rotate: -3, scaleX: 1, scaleY: 1, opacity: 1, backgroundColor: '#00ffcc' },
        { percent: 100, translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1, opacity: 1, backgroundColor: '#00ffcc' }
      ],
      duration: 0.5, timingFunction: 'ease-in-out', delay: 0, iterationCount: 'infinite', direction: 'normal'
    },
    {
      name: 'Flip',
      keyframes: [
        { percent: 0, translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1, opacity: 1, backgroundColor: '#00ffcc' },
        { percent: 50, translateX: 0, translateY: 0, rotate: 0, scaleX: -1, scaleY: 1, opacity: 0.6, backgroundColor: '#ff6bcb' },
        { percent: 100, translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1, opacity: 1, backgroundColor: '#00ffcc' }
      ],
      duration: 0.8, timingFunction: 'ease-in-out', delay: 0, iterationCount: '1', direction: 'normal'
    },
    {
      name: 'Zoom',
      keyframes: [
        { percent: 0, translateX: 0, translateY: 0, rotate: 0, scaleX: 0, scaleY: 0, opacity: 0, backgroundColor: '#00ffcc' },
        { percent: 50, translateX: 0, translateY: 0, rotate: 0, scaleX: 1.2, scaleY: 1.2, opacity: 0.8, backgroundColor: '#00ffcc' },
        { percent: 100, translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1, opacity: 1, backgroundColor: '#00ffcc' }
      ],
      duration: 0.6, timingFunction: 'ease-out', delay: 0, iterationCount: '1', direction: 'normal'
    }
  ];

  constructor(
    private router: Router,
    private eggs: EasterEggService
  ) {
    this.applyPreset(this.presets[0]);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  // ── Keyframe Management ────────────────────────────────

  get activeKeyframe(): KeyframePoint | null {
    return this.keyframes[this.activeKeyframeIndex] || null;
  }

  addKeyframe(percent: number): void {
    if (this.keyframes.find(k => k.percent === percent)) return;
    const kf: KeyframePoint = {
      percent,
      translateX: 0,
      translateY: 0,
      rotate: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      backgroundColor: '#00ffcc'
    };
    this.keyframes.push(kf);
    this.keyframes.sort((a, b) => a.percent - b.percent);
    this.activeKeyframeIndex = this.keyframes.findIndex(k => k.percent === percent);
  }

  removeKeyframe(index: number): void {
    if (this.keyframes.length <= 2) return;
    this.keyframes.splice(index, 1);
    if (this.activeKeyframeIndex >= this.keyframes.length) {
      this.activeKeyframeIndex = this.keyframes.length - 1;
    }
  }

  selectKeyframe(index: number): void {
    this.activeKeyframeIndex = index;
  }

  get unusedPercents(): number[] {
    const used = new Set(this.keyframes.map(k => k.percent));
    return this.availablePercents.filter(p => !used.has(p));
  }

  // ── Animation Controls ─────────────────────────────────

  onDurationChange(event: Event): void {
    this.duration = parseFloat((event.target as HTMLInputElement).value);
    this.checkEasterEgg();
  }

  onDelayChange(event: Event): void {
    this.delay = parseFloat((event.target as HTMLInputElement).value);
  }

  onIterationCountChange(value: string): void {
    this.iterationCount = value;
    this.checkEasterEgg();
  }

  onDirectionChange(value: string): void {
    this.direction = value;
  }

  onTimingFunctionChange(value: string): void {
    this.timingFunction = value;
  }

  // ── Keyframe Property Updates ──────────────────────────

  updateKeyframeField(field: keyof KeyframePoint, event: Event): void {
    const kf = this.activeKeyframe;
    if (!kf) return;
    (kf as any)[field] = parseFloat((event.target as HTMLInputElement).value);
  }

  updateKeyframeColor(event: Event): void {
    const kf = this.activeKeyframe;
    if (!kf) return;
    kf.backgroundColor = (event.target as HTMLInputElement).value;
  }

  // ── Preview ────────────────────────────────────────────

  togglePlayback(): void {
    this.isPlaying = !this.isPlaying;
  }

  restartAnimation(): void {
    this.isPlaying = false;
    setTimeout(() => { this.isPlaying = true; }, 10);
  }

  get previewAnimationStyle(): string {
    if (!this.isPlaying) return 'none';
    const timing = this.timingFunction === 'cubic-bezier'
      ? `cubic-bezier(${this.customCubicBezier})`
      : this.timingFunction;
    return `ag-preview-anim ${this.duration}s ${timing} ${this.delay}s ${this.iterationCount} ${this.direction} both`;
  }

  get previewKeyframesCSS(): string {
    const lines = this.keyframes.map(kf => {
      const transform = `translate(${kf.translateX}px, ${kf.translateY}px) rotate(${kf.rotate}deg) scale(${kf.scaleX}, ${kf.scaleY})`;
      return `  ${kf.percent}% {\n    transform: ${transform};\n    opacity: ${kf.opacity};\n    background-color: ${kf.backgroundColor};\n  }`;
    });
    return `@keyframes ag-preview-anim {\n${lines.join('\n')}\n}`;
  }

  // ── Code Generation ────────────────────────────────────

  get generatedCSS(): string {
    const safeName = this.animationName.replace(/[^a-zA-Z0-9_-]/g, '-') || 'my-animation';
    const timing = this.timingFunction === 'cubic-bezier'
      ? `cubic-bezier(${this.customCubicBezier})`
      : this.timingFunction;

    const keyframeLines = this.keyframes.map(kf => {
      const transform = `translate(${kf.translateX}px, ${kf.translateY}px) rotate(${kf.rotate}deg) scale(${kf.scaleX}, ${kf.scaleY})`;
      return `  ${kf.percent}% {\n    transform: ${transform};\n    opacity: ${kf.opacity};\n    background-color: ${kf.backgroundColor};\n  }`;
    });

    const keyframesBlock = `@keyframes ${safeName} {\n${keyframeLines.join('\n')}\n}`;
    const animationLine = `.animated-element {\n  animation: ${safeName} ${this.duration}s ${timing} ${this.delay}s ${this.iterationCount} ${this.direction} both;\n}`;

    return `${keyframesBlock}\n\n${animationLine}`;
  }

  copyCode(): void {
    navigator.clipboard.writeText(this.generatedCSS).then(() => {
      this.codeCopied = true;
      setTimeout(() => { this.codeCopied = false; }, 1500);
    });
  }

  // ── Presets ────────────────────────────────────────────

  applyPreset(preset: AnimationPreset): void {
    this.keyframes = preset.keyframes.map(kf => ({ ...kf }));
    this.duration = preset.duration;
    this.timingFunction = preset.timingFunction;
    this.delay = preset.delay;
    this.iterationCount = preset.iterationCount;
    this.direction = preset.direction;
    this.activeKeyframeIndex = 0;
    this.restartAnimation();
  }

  // ── Easter Egg ─────────────────────────────────────────

  private checkEasterEgg(): void {
    if (this.iterationCount === 'infinite' && this.duration < 0.1) {
      this.eggs.trigger('anim-seizure');
    }
  }

  // ── Tracking ───────────────────────────────────────────

  trackByPercent(index: number, kf: KeyframePoint): number {
    return kf.percent;
  }

  trackByPresetName(index: number, preset: AnimationPreset): string {
    return preset.name;
  }
}
