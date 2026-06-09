import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

export interface TextShadowLayer {
  id: number;
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
}

export interface TextShadowPreset {
  name: string;
  layers: Omit<TextShadowLayer, 'id'>[];
  previewColor?: string;
  previewBg?: string;
}

@Component({
    selector: 'app-text-shadow',
    templateUrl: './text-shadow.component.html',
    styleUrls: ['./text-shadow.component.css'],
    imports: [ToolsSharedModule]
})
export class TextShadowComponent {
  private readonly eggs = inject(EasterEggService);

  private nextId = 1;

  layers: TextShadowLayer[] = [
    { id: this.nextId++, offsetX: 2, offsetY: 2, blur: 4, color: '#00ffcc' }
  ];

  previewText = 'Shadow Text';
  previewFontSize = 48;
  previewColor = '#ffffff';
  previewBgColor = '#0a0a0f';

  codeCopied = false;

  readonly presets: TextShadowPreset[] = [
    {
      name: 'Neon Glow',
      previewColor: '#ffffff',
      previewBg: '#0a0a0f',
      layers: [
        { offsetX: 0, offsetY: 0, blur: 7, color: '#00ffcc' },
        { offsetX: 0, offsetY: 0, blur: 10, color: '#00ffcc' },
        { offsetX: 0, offsetY: 0, blur: 21, color: '#00ffcc' },
        { offsetX: 0, offsetY: 0, blur: 42, color: '#00ffcc' }
      ]
    },
    {
      name: '3D',
      previewColor: '#ffffff',
      previewBg: '#1a1a2e',
      layers: [
        { offsetX: 1, offsetY: 1, blur: 0, color: '#5c5c8a' },
        { offsetX: 2, offsetY: 2, blur: 0, color: '#52527a' },
        { offsetX: 3, offsetY: 3, blur: 0, color: '#48486a' },
        { offsetX: 4, offsetY: 4, blur: 0, color: '#3e3e5a' },
        { offsetX: 5, offsetY: 5, blur: 0, color: '#34344a' }
      ]
    },
    {
      name: 'Retro',
      previewColor: '#ffd700',
      previewBg: '#2a1a3e',
      layers: [
        { offsetX: 3, offsetY: 3, blur: 0, color: '#ff6b35' },
        { offsetX: 6, offsetY: 6, blur: 0, color: '#c0392b' }
      ]
    },
    {
      name: 'Letterpress',
      previewColor: '#667788',
      previewBg: '#556677',
      layers: [
        { offsetX: 0, offsetY: 1, blur: 0, color: '#778899' },
        { offsetX: 0, offsetY: -1, blur: 0, color: '#445566' }
      ]
    },
    {
      name: 'Fire',
      previewColor: '#ffffff',
      previewBg: '#1a0a00',
      layers: [
        { offsetX: 0, offsetY: 0, blur: 4, color: '#ffd700' },
        { offsetX: 0, offsetY: -3, blur: 6, color: '#ff8c00' },
        { offsetX: 0, offsetY: -6, blur: 9, color: '#ff4500' },
        { offsetX: 0, offsetY: -9, blur: 12, color: '#ff0000' }
      ]
    },
    {
      name: 'Outline',
      previewColor: '#0a0a0f',
      previewBg: '#0a0a0f',
      layers: [
        { offsetX: -1, offsetY: -1, blur: 0, color: '#00ffcc' },
        { offsetX: 1, offsetY: -1, blur: 0, color: '#00ffcc' },
        { offsetX: -1, offsetY: 1, blur: 0, color: '#00ffcc' },
        { offsetX: 1, offsetY: 1, blur: 0, color: '#00ffcc' }
      ]
    },
    {
      name: 'Glitch',
      previewColor: '#ffffff',
      previewBg: '#0a0a0f',
      layers: [
        { offsetX: -2, offsetY: 0, blur: 0, color: '#ff0040' },
        { offsetX: 2, offsetY: 0, blur: 0, color: '#00ffcc' },
        { offsetX: 0, offsetY: 2, blur: 0, color: '#7b00ff' }
      ]
    },
    {
      name: 'Emboss',
      previewColor: '#888888',
      previewBg: '#888888',
      layers: [
        { offsetX: -1, offsetY: -1, blur: 1, color: '#ffffff' },
        { offsetX: 1, offsetY: 1, blur: 1, color: '#333333' }
      ]
    }
  ];

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free CSS Text Shadow Generator — design stunning text shadows with live preview and one-click code copy')}&url=${encodeURIComponent(SITE_URL + '/tools/text-shadow')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/text-shadow')}`;

  constructor(private router: Router, private translationService: TranslationService) {}

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  // ── Layer Management ────────────────────────────────────

  addLayer(): void {
    this.layers.push({
      id: this.nextId++,
      offsetX: 2,
      offsetY: 2,
      blur: 4,
      color: '#00ffcc'
    });
    this.checkDeepEasterEgg();
  }

  removeLayer(index: number): void {
    if (this.layers.length > 1) {
      this.layers.splice(index, 1);
    }
  }

  duplicateLayer(index: number): void {
    const source = this.layers[index];
    const copy: TextShadowLayer = { ...source, id: this.nextId++ };
    this.layers.splice(index + 1, 0, copy);
    this.checkDeepEasterEgg();
  }

  moveLayerUp(index: number): void {
    if (index > 0) {
      [this.layers[index - 1], this.layers[index]] = [this.layers[index], this.layers[index - 1]];
    }
  }

  moveLayerDown(index: number): void {
    if (index < this.layers.length - 1) {
      [this.layers[index], this.layers[index + 1]] = [this.layers[index + 1], this.layers[index]];
    }
  }

  // ── Slider Handlers ─────────────────────────────────────

  onOffsetXChange(index: number, event: Event): void {
    this.layers[index].offsetX = parseFloat((event.target as HTMLInputElement).value);
  }

  onOffsetYChange(index: number, event: Event): void {
    this.layers[index].offsetY = parseFloat((event.target as HTMLInputElement).value);
  }

  onBlurChange(index: number, event: Event): void {
    this.layers[index].blur = parseFloat((event.target as HTMLInputElement).value);
  }

  onColorChange(index: number, event: Event): void {
    this.layers[index].color = (event.target as HTMLInputElement).value;
  }

  onPreviewTextChange(event: Event): void {
    this.previewText = (event.target as HTMLInputElement).value || 'Shadow Text';
  }

  onPreviewFontSizeChange(event: Event): void {
    this.previewFontSize = parseFloat((event.target as HTMLInputElement).value);
  }

  onPreviewColorChange(event: Event): void {
    this.previewColor = (event.target as HTMLInputElement).value;
  }

  onPreviewBgChange(event: Event): void {
    this.previewBgColor = (event.target as HTMLInputElement).value;
  }

  // ── Presets ─────────────────────────────────────────────

  applyPreset(preset: TextShadowPreset): void {
    this.nextId = 1;
    this.layers = preset.layers.map(l => ({ ...l, id: this.nextId++ }));
    if (preset.previewColor) this.previewColor = preset.previewColor;
    if (preset.previewBg) this.previewBgColor = preset.previewBg;
    this.checkDeepEasterEgg();
  }

  // ── CSS Output ──────────────────────────────────────────

  get textShadowValue(): string {
    return this.layers
      .map(l => `${l.offsetX}px ${l.offsetY}px ${l.blur}px ${l.color}`)
      .join(',\n    ');
  }

  get textShadowInline(): string {
    return this.layers
      .map(l => `${l.offsetX}px ${l.offsetY}px ${l.blur}px ${l.color}`)
      .join(', ');
  }

  get cssCode(): string {
    if (this.layers.length === 1) {
      return `text-shadow: ${this.textShadowValue};`;
    }
    return `text-shadow:\n    ${this.textShadowValue};`;
  }

  copyCSS(): void {
    navigator.clipboard.writeText(this.cssCode).then(() => {
      this.codeCopied = true;
      setTimeout(() => { this.codeCopied = false; }, 1500);
    });
  }

  // ── Reset ───────────────────────────────────────────────

  resetAll(): void {
    this.nextId = 1;
    this.layers = [
      { id: this.nextId++, offsetX: 2, offsetY: 2, blur: 4, color: '#00ffcc' }
    ];
    this.previewText = 'Shadow Text';
    this.previewFontSize = 48;
    this.previewColor = '#ffffff';
    this.previewBgColor = '#0a0a0f';
  }

  // ── Easter Egg ──────────────────────────────────────────

  private checkDeepEasterEgg(): void {
    if (this.layers.length >= 5) {
      this.eggs.trigger('text-shadow-deep');
    }
  }

  // ── Preset preview helper ───────────────────────────────

  getPresetShadow(preset: TextShadowPreset): string {
    return preset.layers
      .map(l => `${l.offsetX}px ${l.offsetY}px ${l.blur}px ${l.color}`)
      .join(', ');
  }

  trackByLayerId(index: number, layer: TextShadowLayer): number {
    return layer.id;
  }

  trackByPresetName(index: number, preset: TextShadowPreset): string {
    return preset.name;
  }
}
