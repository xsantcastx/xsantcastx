import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';

export type GradientType = 'linear' | 'radial' | 'conic';
export type RadialShape = 'circle' | 'ellipse';

export interface ColorStop {
  id: number;
  color: string;
  position: number; // 0–100
}

export interface GradientPreset {
  name: string;
  type: GradientType;
  angle: number;
  stops: Omit<ColorStop, 'id'>[];
}

@Component({
  selector: 'app-gradient-generator',
  templateUrl: './gradient-generator.component.html',
  styleUrls: ['./gradient-generator.component.css'],
  standalone: false
})
export class GradientGeneratorComponent {
  gradientType: GradientType = 'linear';
  angle = 135;
  radialShape: RadialShape = 'circle';
  radialPosX = 50;
  radialPosY = 50;
  conicAngle = 0;

  stops: ColorStop[] = [];
  activeStopIndex = 0;
  nextId = 1;

  codeCopied = false;
  codeFormat: 'css' | 'tailwind' = 'css';

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free CSS Gradient Generator — create linear, radial & conic gradients with live preview and one-click code copy')}&url=${encodeURIComponent(SITE_URL + '/tools/gradient-generator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/gradient-generator')}`;

  readonly presets: GradientPreset[] = [
    {
      name: 'Cyberpunk',
      type: 'linear',
      angle: 135,
      stops: [
        { color: '#00ffcc', position: 0 },
        { color: '#7b61ff', position: 100 }
      ]
    },
    {
      name: 'Sunset',
      type: 'linear',
      angle: 135,
      stops: [
        { color: '#ff6b6b', position: 0 },
        { color: '#ffa502', position: 50 },
        { color: '#ffd93d', position: 100 }
      ]
    },
    {
      name: 'Ocean',
      type: 'linear',
      angle: 180,
      stops: [
        { color: '#0077b6', position: 0 },
        { color: '#00b4d8', position: 50 },
        { color: '#90e0ef', position: 100 }
      ]
    },
    {
      name: 'Northern Lights',
      type: 'linear',
      angle: 135,
      stops: [
        { color: '#00ffcc', position: 0 },
        { color: '#00b4d8', position: 33 },
        { color: '#7b61ff', position: 66 },
        { color: '#ff6b9d', position: 100 }
      ]
    },
    {
      name: 'Neon Glow',
      type: 'radial',
      angle: 0,
      stops: [
        { color: '#00ffcc', position: 0 },
        { color: '#0a0a1a', position: 100 }
      ]
    },
    {
      name: 'Warm Flame',
      type: 'linear',
      angle: 45,
      stops: [
        { color: '#ff9a9e', position: 0 },
        { color: '#fad0c4', position: 50 },
        { color: '#ffecd2', position: 100 }
      ]
    },
    {
      name: 'Deep Space',
      type: 'linear',
      angle: 180,
      stops: [
        { color: '#0a0a1a', position: 0 },
        { color: '#1a1a3e', position: 40 },
        { color: '#4a148c', position: 70 },
        { color: '#7b61ff', position: 100 }
      ]
    },
    {
      name: 'Conic Rainbow',
      type: 'conic',
      angle: 0,
      stops: [
        { color: '#ff0000', position: 0 },
        { color: '#ffff00', position: 17 },
        { color: '#00ff00', position: 33 },
        { color: '#00ffff', position: 50 },
        { color: '#0000ff', position: 67 },
        { color: '#ff00ff', position: 83 },
        { color: '#ff0000', position: 100 }
      ]
    }
  ];

  constructor(private router: Router, private translationService: TranslationService) {
    this.addStop('#00ffcc', 0);
    this.addStop('#7b61ff', 100);
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  get activeStop(): ColorStop | null {
    return this.stops[this.activeStopIndex] || null;
  }

  // ── Stop management ──────────────────────────────────────

  addStop(color: string = '#ffffff', position?: number): void {
    const pos = position ?? this.getNextPosition();
    const stop: ColorStop = {
      id: this.nextId++,
      color,
      position: pos
    };
    this.stops.push(stop);
    this.stops.sort((a, b) => a.position - b.position);
    this.activeStopIndex = this.stops.findIndex(s => s.id === stop.id);
  }

  addNewStop(): void {
    this.addStop('#ffffff');
  }

  private getNextPosition(): number {
    if (this.stops.length === 0) return 0;
    if (this.stops.length === 1) return 100;
    // Place between the active stop and the next one, or at 50
    const current = this.stops[this.activeStopIndex];
    const next = this.stops[this.activeStopIndex + 1];
    if (current && next) {
      return Math.round((current.position + next.position) / 2);
    }
    return 50;
  }

  removeStop(index: number): void {
    if (this.stops.length <= 2) return;
    this.stops.splice(index, 1);
    if (this.activeStopIndex >= this.stops.length) {
      this.activeStopIndex = this.stops.length - 1;
    }
  }

  selectStop(index: number): void {
    this.activeStopIndex = index;
  }

  updateStopColor(event: Event): void {
    const stop = this.activeStop;
    if (!stop) return;
    stop.color = (event.target as HTMLInputElement).value;
  }

  updateStopPosition(event: Event): void {
    const stop = this.activeStop;
    if (!stop) return;
    stop.position = parseFloat((event.target as HTMLInputElement).value);
  }

  // ── Gradient type / angle / position ─────────────────────

  setGradientType(type: GradientType): void {
    this.gradientType = type;
  }

  updateAngle(event: Event): void {
    this.angle = parseFloat((event.target as HTMLInputElement).value);
  }

  updateRadialPosX(event: Event): void {
    this.radialPosX = parseFloat((event.target as HTMLInputElement).value);
  }

  updateRadialPosY(event: Event): void {
    this.radialPosY = parseFloat((event.target as HTMLInputElement).value);
  }

  updateConicAngle(event: Event): void {
    this.conicAngle = parseFloat((event.target as HTMLInputElement).value);
  }

  setRadialShape(shape: RadialShape): void {
    this.radialShape = shape;
  }

  // ── Preset ───────────────────────────────────────────────

  applyPreset(preset: GradientPreset): void {
    this.gradientType = preset.type;
    this.angle = preset.angle;
    if (preset.type === 'conic') {
      this.conicAngle = preset.angle;
    }
    this.stops = preset.stops.map(s => ({ ...s, id: this.nextId++ }));
    this.activeStopIndex = 0;
  }

  // ── CSS generation ───────────────────────────────────────

  private buildStopsString(): string {
    const sorted = [...this.stops].sort((a, b) => a.position - b.position);
    return sorted.map(s => `${s.color} ${s.position}%`).join(', ');
  }

  get gradientCssValue(): string {
    const stopsStr = this.buildStopsString();
    switch (this.gradientType) {
      case 'linear':
        return `linear-gradient(${this.angle}deg, ${stopsStr})`;
      case 'radial':
        return `radial-gradient(${this.radialShape} at ${this.radialPosX}% ${this.radialPosY}%, ${stopsStr})`;
      case 'conic':
        return `conic-gradient(from ${this.conicAngle}deg at ${this.radialPosX}% ${this.radialPosY}%, ${stopsStr})`;
    }
  }

  get cssCode(): string {
    return `background: ${this.gradientCssValue};`;
  }

  get tailwindCode(): string {
    // Tailwind doesn't natively support arbitrary gradients well; output arbitrary value
    return `bg-[${this.gradientCssValue.replace(/ /g, '_')}]`;
  }

  get displayedCode(): string {
    return this.codeFormat === 'css' ? this.cssCode : this.tailwindCode;
  }

  copyDisplayedCode(): void {
    const text = this.displayedCode;
    navigator.clipboard.writeText(text).then(() => {
      this.codeCopied = true;
      setTimeout(() => { this.codeCopied = false; }, 1500);
    });
  }

  // ── Preview style ────────────────────────────────────────

  get previewStyle(): { [key: string]: string } {
    return { background: this.gradientCssValue };
  }

  getPresetPreviewStyle(preset: GradientPreset): { [key: string]: string } {
    const stopsStr = preset.stops.map(s => `${s.color} ${s.position}%`).join(', ');
    let bg: string;
    switch (preset.type) {
      case 'linear':
        bg = `linear-gradient(${preset.angle}deg, ${stopsStr})`;
        break;
      case 'radial':
        bg = `radial-gradient(circle at 50% 50%, ${stopsStr})`;
        break;
      case 'conic':
        bg = `conic-gradient(from ${preset.angle}deg at 50% 50%, ${stopsStr})`;
        break;
    }
    return { background: bg };
  }

  /** The gradient bar shown in the stop editor */
  get stopBarGradient(): string {
    const sorted = [...this.stops].sort((a, b) => a.position - b.position);
    const stopsStr = sorted.map(s => `${s.color} ${s.position}%`).join(', ');
    return `linear-gradient(90deg, ${stopsStr})`;
  }

  resetAll(): void {
    this.gradientType = 'linear';
    this.angle = 135;
    this.radialShape = 'circle';
    this.radialPosX = 50;
    this.radialPosY = 50;
    this.conicAngle = 0;
    this.stops = [];
    this.nextId = 1;
    this.activeStopIndex = 0;
    this.addStop('#00ffcc', 0);
    this.addStop('#7b61ff', 100);
  }

  trackByStopId(index: number, stop: ColorStop): number {
    return stop.id;
  }

  trackByPresetName(index: number, preset: GradientPreset): string {
    return preset.name;
  }
}
