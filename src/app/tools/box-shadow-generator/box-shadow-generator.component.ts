import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';

interface ShadowLayer {
  id: number;
  horizontalOffset: number;
  verticalOffset: number;
  blurRadius: number;
  spreadRadius: number;
  color: string;
  opacity: number;
  inset: boolean;
}

interface ShadowPreset {
  name: string;
  layers: Omit<ShadowLayer, 'id'>[];
}

interface HistoryState {
  layers: ShadowLayer[];
  activeLayerIndex: number;
}

@Component({
  selector: 'app-box-shadow-generator',
  templateUrl: './box-shadow-generator.component.html',
  styleUrls: ['./box-shadow-generator.component.css'],
  standalone: false
})
export class BoxShadowGeneratorComponent {
  layers: ShadowLayer[] = [];
  activeLayerIndex = 0;
  nextId = 1;

  previewBgColor = '#ffffff';
  previewBoxColor = '#ffffff';
  previewBorderRadius = 12;
  previewBoxWidth = 200;
  previewBoxHeight = 200;

  codeCopied = false;
  tailwindCopied = false;
  codeFormat: 'css' | 'tailwind' = 'css';

  private undoStack: HistoryState[] = [];
  private redoStack: HistoryState[] = [];
  private maxHistory = 50;

  readonly presets: ShadowPreset[] = [
    {
      name: 'Subtle',
      layers: [
        { horizontalOffset: 0, verticalOffset: 1, blurRadius: 3, spreadRadius: 0, color: '#000000', opacity: 0.12, inset: false },
        { horizontalOffset: 0, verticalOffset: 1, blurRadius: 2, spreadRadius: 0, color: '#000000', opacity: 0.24, inset: false }
      ]
    },
    {
      name: 'Elevated',
      layers: [
        { horizontalOffset: 0, verticalOffset: 10, blurRadius: 30, spreadRadius: -5, color: '#000000', opacity: 0.15, inset: false },
        { horizontalOffset: 0, verticalOffset: 4, blurRadius: 6, spreadRadius: -2, color: '#000000', opacity: 0.1, inset: false }
      ]
    },
    {
      name: 'Neon Glow',
      layers: [
        { horizontalOffset: 0, verticalOffset: 0, blurRadius: 15, spreadRadius: 3, color: '#00ffcc', opacity: 0.6, inset: false },
        { horizontalOffset: 0, verticalOffset: 0, blurRadius: 40, spreadRadius: 10, color: '#00ffcc', opacity: 0.3, inset: false }
      ]
    },
    {
      name: 'Neumorphism',
      layers: [
        { horizontalOffset: 8, verticalOffset: 8, blurRadius: 16, spreadRadius: 0, color: '#000000', opacity: 0.15, inset: false },
        { horizontalOffset: -8, verticalOffset: -8, blurRadius: 16, spreadRadius: 0, color: '#ffffff', opacity: 0.7, inset: false }
      ]
    },
    {
      name: 'Inset Pressed',
      layers: [
        { horizontalOffset: 4, verticalOffset: 4, blurRadius: 8, spreadRadius: 0, color: '#000000', opacity: 0.2, inset: true },
        { horizontalOffset: -4, verticalOffset: -4, blurRadius: 8, spreadRadius: 0, color: '#ffffff', opacity: 0.5, inset: true }
      ]
    },
    {
      name: 'Sharp Drop',
      layers: [
        { horizontalOffset: 6, verticalOffset: 6, blurRadius: 0, spreadRadius: 0, color: '#000000', opacity: 0.25, inset: false }
      ]
    },
    {
      name: 'Layered Depth',
      layers: [
        { horizontalOffset: 0, verticalOffset: 1, blurRadius: 1, spreadRadius: 0, color: '#000000', opacity: 0.08, inset: false },
        { horizontalOffset: 0, verticalOffset: 2, blurRadius: 2, spreadRadius: 0, color: '#000000', opacity: 0.08, inset: false },
        { horizontalOffset: 0, verticalOffset: 4, blurRadius: 4, spreadRadius: 0, color: '#000000', opacity: 0.08, inset: false },
        { horizontalOffset: 0, verticalOffset: 8, blurRadius: 8, spreadRadius: 0, color: '#000000', opacity: 0.08, inset: false },
        { horizontalOffset: 0, verticalOffset: 16, blurRadius: 16, spreadRadius: 0, color: '#000000', opacity: 0.08, inset: false }
      ]
    },
    {
      name: 'Dreamy',
      layers: [
        { horizontalOffset: 0, verticalOffset: 4, blurRadius: 20, spreadRadius: 0, color: '#8b5cf6', opacity: 0.4, inset: false },
        { horizontalOffset: 0, verticalOffset: 8, blurRadius: 40, spreadRadius: 0, color: '#ec4899', opacity: 0.2, inset: false }
      ]
    }
  ];

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free CSS Box Shadow Generator — design beautiful layered shadows with live preview and one-click code copy 🎨')}&url=${encodeURIComponent(SITE_URL + '/tools/box-shadow-generator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/box-shadow-generator')}`;

  constructor(private router: Router, private translationService: TranslationService) {
    this.addLayer();
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  get activeLayer(): ShadowLayer | null {
    return this.layers[this.activeLayerIndex] || null;
  }

  private saveHistory(): void {
    this.undoStack.push({
      layers: this.layers.map(l => ({ ...l })),
      activeLayerIndex: this.activeLayerIndex
    });
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(): void {
    if (this.undoStack.length === 0) return;
    this.redoStack.push({
      layers: this.layers.map(l => ({ ...l })),
      activeLayerIndex: this.activeLayerIndex
    });
    const state = this.undoStack.pop()!;
    this.layers = state.layers;
    this.activeLayerIndex = Math.min(state.activeLayerIndex, this.layers.length - 1);
  }

  redo(): void {
    if (this.redoStack.length === 0) return;
    this.undoStack.push({
      layers: this.layers.map(l => ({ ...l })),
      activeLayerIndex: this.activeLayerIndex
    });
    const state = this.redoStack.pop()!;
    this.layers = state.layers;
    this.activeLayerIndex = Math.min(state.activeLayerIndex, this.layers.length - 1);
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  addLayer(): void {
    this.saveHistory();
    const layer: ShadowLayer = {
      id: this.nextId++,
      horizontalOffset: 0,
      verticalOffset: 4,
      blurRadius: 10,
      spreadRadius: 0,
      color: '#000000',
      opacity: 0.2,
      inset: false
    };
    this.layers.push(layer);
    this.activeLayerIndex = this.layers.length - 1;
  }

  duplicateLayer(index: number): void {
    this.saveHistory();
    const source = this.layers[index];
    const copy: ShadowLayer = { ...source, id: this.nextId++ };
    this.layers.splice(index + 1, 0, copy);
    this.activeLayerIndex = index + 1;
  }

  removeLayer(index: number): void {
    if (this.layers.length <= 1) return;
    this.saveHistory();
    this.layers.splice(index, 1);
    if (this.activeLayerIndex >= this.layers.length) {
      this.activeLayerIndex = this.layers.length - 1;
    }
  }

  moveLayerUp(index: number): void {
    if (index <= 0) return;
    this.saveHistory();
    const temp = this.layers[index];
    this.layers[index] = this.layers[index - 1];
    this.layers[index - 1] = temp;
    this.activeLayerIndex = index - 1;
  }

  moveLayerDown(index: number): void {
    if (index >= this.layers.length - 1) return;
    this.saveHistory();
    const temp = this.layers[index];
    this.layers[index] = this.layers[index + 1];
    this.layers[index + 1] = temp;
    this.activeLayerIndex = index + 1;
  }

  selectLayer(index: number): void {
    this.activeLayerIndex = index;
  }

  onLayerChange(): void {
    this.saveHistory();
  }

  updateLayerField(field: keyof ShadowLayer, value: any): void {
    const layer = this.activeLayer;
    if (!layer) return;
    this.saveHistory();
    (layer as any)[field] = value;
  }

  updateSliderField(field: keyof ShadowLayer, event: Event): void {
    const target = event.target as HTMLInputElement;
    this.updateLayerField(field, parseFloat(target.value));
  }

  updateOpacity(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.updateLayerField('opacity', parseFloat(target.value));
  }

  updateColor(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.updateLayerField('color', target.value);
  }

  toggleInset(): void {
    const layer = this.activeLayer;
    if (!layer) return;
    this.updateLayerField('inset', !layer.inset);
  }

  applyPreset(preset: ShadowPreset): void {
    this.saveHistory();
    this.layers = preset.layers.map(l => ({
      ...l,
      id: this.nextId++
    }));
    this.activeLayerIndex = 0;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      };
    }
    return { r: 0, g: 0, b: 0 };
  }

  private layerToCssValue(layer: ShadowLayer): string {
    const rgb = this.hexToRgb(layer.color);
    const colorStr = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${layer.opacity})`;
    const insetStr = layer.inset ? 'inset ' : '';
    return `${insetStr}${layer.horizontalOffset}px ${layer.verticalOffset}px ${layer.blurRadius}px ${layer.spreadRadius}px ${colorStr}`;
  }

  get boxShadowValue(): string {
    if (this.layers.length === 0) return 'none';
    return this.layers.map(l => this.layerToCssValue(l)).join(',\n    ');
  }

  get boxShadowInline(): string {
    if (this.layers.length === 0) return 'none';
    return this.layers.map(l => this.layerToCssValue(l)).join(', ');
  }

  get cssCode(): string {
    if (this.layers.length === 0) return 'box-shadow: none;';
    const values = this.layers.map(l => this.layerToCssValue(l));
    if (values.length === 1) {
      return `box-shadow: ${values[0]};`;
    }
    return `box-shadow:\n    ${values.join(',\n    ')};`;
  }

  get tailwindCode(): string {
    if (this.layers.length === 0) return 'shadow-none';
    const inline = this.layers.map(l => this.layerToCssValue(l)).join(',_');
    return `shadow-[${inline.replace(/ /g, '_')}]`;
  }

  get displayedCode(): string {
    return this.codeFormat === 'css' ? this.cssCode : this.tailwindCode;
  }

  copyCSS(): void {
    navigator.clipboard.writeText(this.cssCode).then(() => {
      this.codeCopied = true;
      setTimeout(() => { this.codeCopied = false; }, 1500);
    });
  }

  copyTailwind(): void {
    navigator.clipboard.writeText(this.tailwindCode).then(() => {
      this.tailwindCopied = true;
      setTimeout(() => { this.tailwindCopied = false; }, 1500);
    });
  }

  copyDisplayedCode(): void {
    const text = this.codeFormat === 'css' ? this.cssCode : this.tailwindCode;
    navigator.clipboard.writeText(text).then(() => {
      this.codeCopied = true;
      setTimeout(() => { this.codeCopied = false; }, 1500);
    });
  }

  getLayerPreviewStyle(layer: ShadowLayer): { [key: string]: string } {
    return {
      'box-shadow': this.layerToCssValue(layer)
    };
  }

  getPresetPreviewStyle(preset: ShadowPreset): { [key: string]: string } {
    const values = preset.layers.map(l => {
      const rgb = this.hexToRgb(l.color);
      const colorStr = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${l.opacity})`;
      const insetStr = l.inset ? 'inset ' : '';
      return `${insetStr}${l.horizontalOffset}px ${l.verticalOffset}px ${l.blurRadius}px ${l.spreadRadius}px ${colorStr}`;
    }).join(', ');
    return {
      'box-shadow': values
    };
  }

  onPreviewBgChange(event: Event): void {
    this.previewBgColor = (event.target as HTMLInputElement).value;
  }

  onPreviewBoxColorChange(event: Event): void {
    this.previewBoxColor = (event.target as HTMLInputElement).value;
  }

  onBorderRadiusChange(event: Event): void {
    this.previewBorderRadius = parseInt((event.target as HTMLInputElement).value, 10);
  }

  resetAll(): void {
    this.saveHistory();
    this.layers = [];
    this.nextId = 1;
    this.activeLayerIndex = 0;
    this.addLayer();
  }

  trackByLayerId(index: number, layer: ShadowLayer): number {
    return layer.id;
  }

  trackByPresetName(index: number, preset: ShadowPreset): string {
    return preset.name;
  }

  getOpacityPercent(layer: ShadowLayer): number {
    return Math.round(layer.opacity * 100);
  }
}