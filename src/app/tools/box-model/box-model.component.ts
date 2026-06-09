import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';

type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'double' | 'groove' | 'ridge' | 'inset' | 'outset' | 'none';

interface SideValues {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface BorderSide {
  width: number;
  style: BorderStyle;
  color: string;
}

interface BorderValues {
  top: BorderSide;
  right: BorderSide;
  bottom: BorderSide;
  left: BorderSide;
}

interface SpacingPreset {
  name: string;
  margin: SideValues;
  padding: SideValues;
  border: BorderValues;
  width: number;
  height: number;
  boxSizing: 'content-box' | 'border-box';
}

@Component({
    selector: 'app-box-model',
    templateUrl: './box-model.component.html',
    styleUrls: ['./box-model.component.css'],
    imports: [ToolsSharedModule, FormsModule, TitleCasePipe]
})
export class BoxModelComponent {
  private readonly eggs = inject(EasterEggService);

  margin: SideValues = { top: 16, right: 16, bottom: 16, left: 16 };
  padding: SideValues = { top: 16, right: 16, bottom: 16, left: 16 };

  border: BorderValues = {
    top:    { width: 2, style: 'solid', color: '#00ffcc' },
    right:  { width: 2, style: 'solid', color: '#00ffcc' },
    bottom: { width: 2, style: 'solid', color: '#00ffcc' },
    left:   { width: 2, style: 'solid', color: '#00ffcc' }
  };

  contentWidth = 200;
  contentHeight = 150;
  boxSizing: 'content-box' | 'border-box' = 'content-box';

  shorthand = true;
  codeCopied = false;

  readonly borderStyles: BorderStyle[] = ['none', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset'];

  readonly sides: (keyof SideValues)[] = ['top', 'right', 'bottom', 'left'];

  readonly presets: SpacingPreset[] = [
    {
      name: 'Reset',
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      border: {
        top:    { width: 0, style: 'none', color: '#00ffcc' },
        right:  { width: 0, style: 'none', color: '#00ffcc' },
        bottom: { width: 0, style: 'none', color: '#00ffcc' },
        left:   { width: 0, style: 'none', color: '#00ffcc' }
      },
      width: 200, height: 150, boxSizing: 'content-box'
    },
    {
      name: 'Card',
      margin: { top: 16, right: 16, bottom: 16, left: 16 },
      padding: { top: 24, right: 24, bottom: 24, left: 24 },
      border: {
        top:    { width: 1, style: 'solid', color: '#333333' },
        right:  { width: 1, style: 'solid', color: '#333333' },
        bottom: { width: 1, style: 'solid', color: '#333333' },
        left:   { width: 1, style: 'solid', color: '#333333' }
      },
      width: 320, height: 200, boxSizing: 'border-box'
    },
    {
      name: 'Hero Section',
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 64, right: 32, bottom: 64, left: 32 },
      border: {
        top:    { width: 0, style: 'none', color: '#00ffcc' },
        right:  { width: 0, style: 'none', color: '#00ffcc' },
        bottom: { width: 4, style: 'solid', color: '#00ffcc' },
        left:   { width: 0, style: 'none', color: '#00ffcc' }
      },
      width: 400, height: 300, boxSizing: 'border-box'
    },
    {
      name: 'Button',
      margin: { top: 8, right: 8, bottom: 8, left: 8 },
      padding: { top: 12, right: 24, bottom: 12, left: 24 },
      border: {
        top:    { width: 2, style: 'solid', color: '#00ffcc' },
        right:  { width: 2, style: 'solid', color: '#00ffcc' },
        bottom: { width: 2, style: 'solid', color: '#00ffcc' },
        left:   { width: 2, style: 'solid', color: '#00ffcc' }
      },
      width: 120, height: 40, boxSizing: 'border-box'
    },
    {
      name: 'Left Accent',
      margin: { top: 16, right: 16, bottom: 16, left: 16 },
      padding: { top: 16, right: 16, bottom: 16, left: 20 },
      border: {
        top:    { width: 0, style: 'none', color: '#333333' },
        right:  { width: 0, style: 'none', color: '#333333' },
        bottom: { width: 0, style: 'none', color: '#333333' },
        left:   { width: 4, style: 'solid', color: '#ff6bcb' }
      },
      width: 280, height: 100, boxSizing: 'border-box'
    },
    {
      name: 'Inset Panel',
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 32, right: 32, bottom: 32, left: 32 },
      border: {
        top:    { width: 3, style: 'inset', color: '#555555' },
        right:  { width: 3, style: 'inset', color: '#555555' },
        bottom: { width: 3, style: 'inset', color: '#555555' },
        left:   { width: 3, style: 'inset', color: '#555555' }
      },
      width: 250, height: 180, boxSizing: 'content-box'
    },
    {
      name: 'Dashed Frame',
      margin: { top: 24, right: 24, bottom: 24, left: 24 },
      padding: { top: 20, right: 20, bottom: 20, left: 20 },
      border: {
        top:    { width: 2, style: 'dashed', color: '#ffd700' },
        right:  { width: 2, style: 'dashed', color: '#ffd700' },
        bottom: { width: 2, style: 'dashed', color: '#ffd700' },
        left:   { width: 2, style: 'dashed', color: '#ffd700' }
      },
      width: 200, height: 150, boxSizing: 'content-box'
    },
    {
      name: 'Asymmetric',
      margin: { top: 0, right: 32, bottom: 24, left: 0 },
      padding: { top: 8, right: 16, bottom: 24, left: 48 },
      border: {
        top:    { width: 1, style: 'solid', color: '#00ffcc' },
        right:  { width: 1, style: 'solid', color: '#00ffcc' },
        bottom: { width: 4, style: 'solid', color: '#ff6bcb' },
        left:   { width: 1, style: 'solid', color: '#00ffcc' }
      },
      width: 250, height: 120, boxSizing: 'content-box'
    }
  ];

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free CSS Box Model Visualizer — interactive diagram with live code generation')}&url=${encodeURIComponent(SITE_URL + '/tools/box-model')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/box-model')}`;

  constructor(private router: Router, private translationService: TranslationService) {}

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  // ── Value changes ──────────────────────────────────────

  onMarginChange(side: keyof SideValues, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value) || 0;
    if (this.shorthand) {
      this.sides.forEach(s => this.margin[s] = value);
    } else {
      this.margin[side] = value;
    }
    this.checkResetEasterEgg();
  }

  onPaddingChange(side: keyof SideValues, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value) || 0;
    if (this.shorthand) {
      this.sides.forEach(s => this.padding[s] = value);
    } else {
      this.padding[side] = value;
    }
    this.checkResetEasterEgg();
  }

  onBorderWidthChange(side: keyof SideValues, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value) || 0;
    if (this.shorthand) {
      this.sides.forEach(s => this.border[s].width = value);
    } else {
      this.border[side].width = value;
    }
  }

  onBorderStyleChange(side: keyof SideValues, event: Event): void {
    const value = (event.target as HTMLSelectElement).value as BorderStyle;
    if (this.shorthand) {
      this.sides.forEach(s => this.border[s].style = value);
    } else {
      this.border[side].style = value;
    }
  }

  onBorderColorChange(side: keyof SideValues, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (this.shorthand) {
      this.sides.forEach(s => this.border[s].color = value);
    } else {
      this.border[side].color = value;
    }
  }

  onDimensionChange(dim: 'width' | 'height', event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value) || 0;
    if (dim === 'width') { this.contentWidth = value; }
    else { this.contentHeight = value; }
  }

  toggleBoxSizing(): void {
    this.boxSizing = this.boxSizing === 'content-box' ? 'border-box' : 'content-box';
  }

  toggleShorthand(): void {
    this.shorthand = !this.shorthand;
    if (this.shorthand) {
      // Sync all sides to top value
      const mt = this.margin.top;
      const pt = this.padding.top;
      const bt = this.border.top;
      this.sides.forEach(s => {
        this.margin[s] = mt;
        this.padding[s] = pt;
        this.border[s] = { ...bt };
      });
    }
  }

  applyPreset(preset: SpacingPreset): void {
    this.margin = { ...preset.margin };
    this.padding = { ...preset.padding };
    this.border = {
      top:    { ...preset.border.top },
      right:  { ...preset.border.right },
      bottom: { ...preset.border.bottom },
      left:   { ...preset.border.left }
    };
    this.contentWidth = preset.width;
    this.contentHeight = preset.height;
    this.boxSizing = preset.boxSizing;
    this.checkResetEasterEgg();
  }

  resetAll(): void {
    this.margin = { top: 16, right: 16, bottom: 16, left: 16 };
    this.padding = { top: 16, right: 16, bottom: 16, left: 16 };
    this.border = {
      top:    { width: 2, style: 'solid', color: '#00ffcc' },
      right:  { width: 2, style: 'solid', color: '#00ffcc' },
      bottom: { width: 2, style: 'solid', color: '#00ffcc' },
      left:   { width: 2, style: 'solid', color: '#00ffcc' }
    };
    this.contentWidth = 200;
    this.contentHeight = 150;
    this.boxSizing = 'content-box';
    this.shorthand = true;
  }

  // ── Easter egg ─────────────────────────────────────────

  private checkResetEasterEgg(): void {
    const allMarginsZero = this.sides.every(s => this.margin[s] === 0);
    const allPaddingsZero = this.sides.every(s => this.padding[s] === 0);
    if (allMarginsZero && allPaddingsZero) {
      this.eggs.trigger('box-reset');
    }
  }

  // ── Computed sizes ─────────────────────────────────────

  get totalBorderH(): number {
    return this.border.left.width + this.border.right.width;
  }

  get totalBorderV(): number {
    return this.border.top.width + this.border.bottom.width;
  }

  get totalPaddingH(): number {
    return this.padding.left + this.padding.right;
  }

  get totalPaddingV(): number {
    return this.padding.top + this.padding.bottom;
  }

  get totalMarginH(): number {
    return this.margin.left + this.margin.right;
  }

  get totalMarginV(): number {
    return this.margin.top + this.margin.bottom;
  }

  /** Actual rendered content area */
  get renderedContentWidth(): number {
    if (this.boxSizing === 'border-box') {
      return Math.max(0, this.contentWidth - this.totalPaddingH - this.totalBorderH);
    }
    return this.contentWidth;
  }

  get renderedContentHeight(): number {
    if (this.boxSizing === 'border-box') {
      return Math.max(0, this.contentHeight - this.totalPaddingV - this.totalBorderV);
    }
    return this.contentHeight;
  }

  /** Total element size (border-box outer edge, excluding margin) */
  get computedWidth(): number {
    if (this.boxSizing === 'border-box') {
      return this.contentWidth;
    }
    return this.contentWidth + this.totalPaddingH + this.totalBorderH;
  }

  get computedHeight(): number {
    if (this.boxSizing === 'border-box') {
      return this.contentHeight;
    }
    return this.contentHeight + this.totalPaddingV + this.totalBorderV;
  }

  /** Total space including margin */
  get totalWidth(): number {
    return this.computedWidth + this.totalMarginH;
  }

  get totalHeight(): number {
    return this.computedHeight + this.totalMarginV;
  }

  // ── Diagram scaling ────────────────────────────────────

  get diagramScale(): number {
    const maxDiagramSize = 320;
    const totalW = this.totalWidth || 1;
    const totalH = this.totalHeight || 1;
    const maxDim = Math.max(totalW, totalH);
    if (maxDim <= maxDiagramSize) return 1;
    return maxDiagramSize / maxDim;
  }

  // ── CSS code generation ────────────────────────────────

  private formatSideValues(prop: string, values: SideValues): string {
    const { top, right, bottom, left } = values;
    if (top === right && right === bottom && bottom === left) {
      return `${prop}: ${top}px;`;
    }
    if (top === bottom && left === right) {
      return `${prop}: ${top}px ${right}px;`;
    }
    if (left === right) {
      return `${prop}: ${top}px ${right}px ${bottom}px;`;
    }
    return `${prop}: ${top}px ${right}px ${bottom}px ${left}px;`;
  }

  private formatBorderSide(side: string, b: BorderSide): string {
    if (b.style === 'none' || b.width === 0) {
      return `border-${side}: none;`;
    }
    return `border-${side}: ${b.width}px ${b.style} ${b.color};`;
  }

  get cssCode(): string {
    const lines: string[] = [];

    lines.push(this.formatSideValues('margin', this.margin));
    lines.push(this.formatSideValues('padding', this.padding));

    // Border
    const { top, right, bottom, left } = this.border;
    const allSame = top.width === right.width && right.width === bottom.width && bottom.width === left.width
      && top.style === right.style && right.style === bottom.style && bottom.style === left.style
      && top.color === right.color && right.color === bottom.color && bottom.color === left.color;

    if (allSame) {
      if (top.style === 'none' || top.width === 0) {
        lines.push('border: none;');
      } else {
        lines.push(`border: ${top.width}px ${top.style} ${top.color};`);
      }
    } else {
      lines.push(this.formatBorderSide('top', top));
      lines.push(this.formatBorderSide('right', right));
      lines.push(this.formatBorderSide('bottom', bottom));
      lines.push(this.formatBorderSide('left', left));
    }

    lines.push(`width: ${this.contentWidth}px;`);
    lines.push(`height: ${this.contentHeight}px;`);
    lines.push(`box-sizing: ${this.boxSizing};`);

    return lines.join('\n');
  }

  copyCode(): void {
    navigator.clipboard.writeText(this.cssCode).then(() => {
      this.codeCopied = true;
      setTimeout(() => { this.codeCopied = false; }, 1500);
    });
  }

  trackByPresetName(_index: number, preset: SpacingPreset): string {
    return preset.name;
  }
}
