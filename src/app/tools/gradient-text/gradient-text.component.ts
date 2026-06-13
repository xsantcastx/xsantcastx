import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { NgStyle } from '@angular/common';

export interface ColorStop {
  id: number;
  color: string;
  position: number; // 0-100
}

export interface GradientPreset {
  name: string;
  type: 'linear' | 'radial';
  angle: number;
  stops: Omit<ColorStop, 'id'>[];
}

@Component({
    selector: 'app-gradient-text',
    templateUrl: './gradient-text.component.html',
    styleUrls: ['./gradient-text.component.css'],
    imports: [ToolsSharedModule, NgStyle]
})
export class GradientTextComponent {
  private readonly eggs = inject(EasterEggService);

  private nextId = 1;

  gradientType: 'linear' | 'radial' = 'linear';
  angle = 90;
  animated = false;

  colorStops: ColorStop[] = [
    { id: this.nextId++, color: '#ff00cc', position: 0 },
    { id: this.nextId++, color: '#3333ff', position: 100 }
  ];

  previewText = 'Gradient Text';
  fontSize = 64;
  fontWeight = 700;

  codeCopied = false;

  readonly presets: GradientPreset[] = [
    {
      name: 'Rainbow',
      type: 'linear',
      angle: 90,
      stops: [
        { color: '#ff0000', position: 0 },
        { color: '#ff8800', position: 17 },
        { color: '#ffff00', position: 33 },
        { color: '#00ff00', position: 50 },
        { color: '#0088ff', position: 67 },
        { color: '#8800ff', position: 83 },
        { color: '#ff00ff', position: 100 }
      ]
    },
    {
      name: 'Sunset',
      type: 'linear',
      angle: 135,
      stops: [
        { color: '#ff512f', position: 0 },
        { color: '#f09819', position: 50 },
        { color: '#ff7eb3', position: 100 }
      ]
    },
    {
      name: 'Ocean',
      type: 'linear',
      angle: 90,
      stops: [
        { color: '#2193b0', position: 0 },
        { color: '#6dd5ed', position: 50 },
        { color: '#00d2ff', position: 100 }
      ]
    },
    {
      name: 'Fire',
      type: 'linear',
      angle: 90,
      stops: [
        { color: '#ff0000', position: 0 },
        { color: '#ff6600', position: 40 },
        { color: '#ffcc00', position: 100 }
      ]
    },
    {
      name: 'Neon',
      type: 'linear',
      angle: 90,
      stops: [
        { color: '#00ffcc', position: 0 },
        { color: '#ff00ff', position: 50 },
        { color: '#00ffcc', position: 100 }
      ]
    },
    {
      name: 'Gold',
      type: 'linear',
      angle: 135,
      stops: [
        { color: '#bf953f', position: 0 },
        { color: '#fcf6ba', position: 40 },
        { color: '#b38728', position: 70 },
        { color: '#fbf5b7', position: 100 }
      ]
    },
    {
      name: 'Silver',
      type: 'linear',
      angle: 135,
      stops: [
        { color: '#bdc3c7', position: 0 },
        { color: '#ecf0f1', position: 40 },
        { color: '#95a5a6', position: 70 },
        { color: '#dfe6e9', position: 100 }
      ]
    },
    {
      name: 'Pastel',
      type: 'linear',
      angle: 90,
      stops: [
        { color: '#a8edea', position: 0 },
        { color: '#fed6e3', position: 50 },
        { color: '#d4a5ff', position: 100 }
      ]
    },
    {
      name: 'Cyberpunk',
      type: 'linear',
      angle: 90,
      stops: [
        { color: '#ff003c', position: 0 },
        { color: '#ff00ff', position: 50 },
        { color: '#00f0ff', position: 100 }
      ]
    },
    {
      name: 'Aurora',
      type: 'linear',
      angle: 135,
      stops: [
        { color: '#00c9ff', position: 0 },
        { color: '#92fe9d', position: 33 },
        { color: '#00c9ff', position: 66 },
        { color: '#f0e68c', position: 100 }
      ]
    }
  ];

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free CSS Gradient Text Generator — create stunning gradient text effects with live preview and one-click code copy')}&url=${encodeURIComponent(SITE_URL + '/tools/gradient-text')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/gradient-text')}`;

  constructor(private router: Router, private translationService: TranslationService) {}

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  // ── Color Stop Management ──────────────────────────────

  addColorStop(): void {
    const lastStop = this.colorStops[this.colorStops.length - 1];
    const secondLast = this.colorStops.length > 1
      ? this.colorStops[this.colorStops.length - 2]
      : null;
    const newPosition = secondLast
      ? Math.round((secondLast.position + lastStop.position) / 2)
      : Math.min(lastStop.position + 25, 100);
    this.colorStops.push({
      id: this.nextId++,
      color: '#ffffff',
      position: Math.min(newPosition, 100)
    });
    this.sortStops();
  }

  removeColorStop(index: number): void {
    if (this.colorStops.length > 2) {
      this.colorStops.splice(index, 1);
    }
  }

  onStopColorChange(index: number, event: Event): void {
    this.colorStops[index].color = (event.target as HTMLInputElement).value;
  }

  onStopPositionChange(index: number, event: Event): void {
    this.colorStops[index].position = parseInt((event.target as HTMLInputElement).value, 10);
    this.sortStops();
  }

  private sortStops(): void {
    this.colorStops.sort((a, b) => a.position - b.position);
  }

  // ── Gradient Controls ──────────────────────────────────

  onTypeChange(type: 'linear' | 'radial'): void {
    this.gradientType = type;
  }

  onAngleChange(event: Event): void {
    this.angle = parseInt((event.target as HTMLInputElement).value, 10);
  }

  toggleAnimation(): void {
    this.animated = !this.animated;
  }

  // ── Preview Controls ───────────────────────────────────

  onPreviewTextChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.previewText = value || 'Gradient Text';
    this.checkEasterEgg(value);
  }

  onFontSizeChange(event: Event): void {
    this.fontSize = parseInt((event.target as HTMLInputElement).value, 10);
  }

  onFontWeightChange(event: Event): void {
    this.fontWeight = parseInt((event.target as HTMLInputElement).value, 10);
  }

  // ── Presets ────────────────────────────────────────────

  applyPreset(preset: GradientPreset): void {
    this.gradientType = preset.type;
    this.angle = preset.angle;
    this.nextId = 1;
    this.colorStops = preset.stops.map(s => ({ ...s, id: this.nextId++ }));
  }

  getPresetGradient(preset: GradientPreset): string {
    const stops = preset.stops.map(s => `${s.color} ${s.position}%`).join(', ');
    if (preset.type === 'radial') {
      return `radial-gradient(circle, ${stops})`;
    }
    return `linear-gradient(${preset.angle}deg, ${stops})`;
  }

  // ── CSS Generation ─────────────────────────────────────

  get gradientValue(): string {
    const stops = this.colorStops.map(s => `${s.color} ${s.position}%`).join(', ');
    if (this.gradientType === 'radial') {
      return `radial-gradient(circle, ${stops})`;
    }
    return `linear-gradient(${this.angle}deg, ${stops})`;
  }

  get cssCode(): string {
    const lines: string[] = [];
    lines.push(`background: ${this.gradientValue};`);
    lines.push('-webkit-background-clip: text;');
    lines.push('background-clip: text;');
    lines.push('-webkit-text-fill-color: transparent;');

    if (this.animated) {
      lines.push('background-size: 200% 200%;');
      lines.push('animation: gt-gradient-shift 3s ease infinite;');
    }

    let code = `.gradient-text {\n  ${lines.join('\n  ')}\n}`;

    if (this.animated) {
      code += '\n\n@keyframes gt-gradient-shift {\n  0% { background-position: 0% 50%; }\n  50% { background-position: 100% 50%; }\n  100% { background-position: 0% 50%; }\n}';
    }

    return code;
  }

  get previewStyles(): { [key: string]: string } {
    const styles: { [key: string]: string } = {
      'background': this.gradientValue,
      '-webkit-background-clip': 'text',
      'background-clip': 'text',
      '-webkit-text-fill-color': 'transparent',
      'font-size': `${this.fontSize}px`,
      'font-weight': `${this.fontWeight}`
    };
    if (this.animated) {
      styles['background-size'] = '200% 200%';
      styles['animation'] = 'gt-gradient-shift 3s ease infinite';
    }
    return styles;
  }

  // ── Copy ───────────────────────────────────────────────

  copyCSS(): void {
    navigator.clipboard.writeText(this.cssCode).then(() => {
      this.codeCopied = true;
      setTimeout(() => { this.codeCopied = false; }, 1500);
    });
  }

  // ── Reset ──────────────────────────────────────────────

  resetAll(): void {
    this.nextId = 1;
    this.gradientType = 'linear';
    this.angle = 90;
    this.animated = false;
    this.colorStops = [
      { id: this.nextId++, color: '#ff00cc', position: 0 },
      { id: this.nextId++, color: '#3333ff', position: 100 }
    ];
    this.previewText = 'Gradient Text';
    this.fontSize = 64;
    this.fontWeight = 700;
  }

  // ── Easter Egg ─────────────────────────────────────────

  private checkEasterEgg(text: string): void {
    if (text.toLowerCase().trim() === 'xsantcastx') {
      this.eggs.trigger('gradient-brand');
    }
  }

  // ── Track ──────────────────────────────────────────────

  trackByStopId(index: number, stop: ColorStop): number {
    return stop.id;
  }

  trackByPresetName(index: number, preset: GradientPreset): string {
    return preset.name;
  }
}
