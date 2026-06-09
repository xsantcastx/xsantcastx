import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

interface WcagResult {
  level: 'AA' | 'AAA';
  context: string;
  required: number;
  passes: boolean;
}

@Component({
    selector: 'app-contrast-checker',
    templateUrl: './contrast-checker.component.html',
    styleUrls: ['./contrast-checker.component.css'],
    imports: [ToolsSharedModule],
})
export class ContrastCheckerComponent {
  private readonly eggs = inject(EasterEggService);
  fg = '#ffffff';
  bg = '#1a237e';

  fgInput = '#ffffff';
  bgInput = '#1a237e';

  fgError = false;
  bgError = false;

  copied = false;

  readonly twitterShareUrl  = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free WCAG Contrast Checker — instantly test AA/AAA compliance for any color pair. Runs in the browser, no sign-up ♿')}&url=${encodeURIComponent(SITE_URL + '/tools/contrast-checker')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/contrast-checker')}`;

  get presets(): { label: string; fg: string; bg: string }[] {
    return [
      { label: this.translate('tools.contrast.preset.white.dark'),  fg: '#ffffff', bg: '#1a1a2e' },
      { label: this.translate('tools.contrast.preset.cyan.dark'),   fg: '#00ffcc', bg: '#07090f' },
      { label: this.translate('tools.contrast.preset.black.white'), fg: '#000000', bg: '#ffffff' },
      { label: this.translate('tools.contrast.preset.navy.white'),  fg: '#1a237e', bg: '#ffffff' },
      { label: this.translate('tools.contrast.preset.danger'),      fg: '#ffffff', bg: '#c0392b' },
      { label: this.translate('tools.contrast.preset.warning'),     fg: '#000000', bg: '#f39c12' },
    ];
  }

  constructor(private router: Router, private translationService: TranslationService) {}

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  // ─── WCAG luminance ───────────────────────────────────────────────────────

  private linearize(c: number): number {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }

  private luminance(hex: string): number {
    const r = this.linearize(parseInt(hex.slice(1, 3), 16));
    const g = this.linearize(parseInt(hex.slice(3, 5), 16));
    const b = this.linearize(parseInt(hex.slice(5, 7), 16));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  get hasInputError(): boolean {
    return this.fgError || this.bgError;
  }

  get ratio(): number {
    if (!this.isValidHex(this.fg) || !this.isValidHex(this.bg)) return 1;
    const l1 = this.luminance(this.fg);
    const l2 = this.luminance(this.bg);
    const lighter = Math.max(l1, l2);
    const darker  = Math.min(l1, l2);
    return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
  }

  get ratioLabel(): string {
    return `${this.ratio.toFixed(2)}:1`;
  }

  get results(): WcagResult[] {
    const r = this.ratio;
    const normal = this.translate('tools.contrast.normal');
    const large  = this.translate('tools.contrast.large');
    const ui     = this.translate('tools.contrast.ui');
    return [
      { level: 'AA',  context: normal, required: 4.5, passes: r >= 4.5 },
      { level: 'AAA', context: normal, required: 7,   passes: r >= 7   },
      { level: 'AA',  context: large,  required: 3,   passes: r >= 3   },
      { level: 'AAA', context: large,  required: 4.5, passes: r >= 4.5 },
      { level: 'AA',  context: ui,     required: 3,   passes: r >= 3   },
    ];
  }

  get overallGrade(): 'AAA' | 'AA' | 'Fail' {
    if (this.ratio >= 7)   return 'AAA';
    if (this.ratio >= 4.5) return 'AA';
    return 'Fail';
  }

  get scoreColor(): string {
    if (this.ratio >= 7)   return '#22c55e';
    if (this.ratio >= 4.5) return '#84cc16';
    if (this.ratio >= 3)   return '#f59e0b';
    return '#ef4444';
  }

  // ─── Input handling ───────────────────────────────────────────────────────

  private isValidHex(hex: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(hex);
  }

  onFgText(value: string): void {
    this.fgInput = value;
    const hex = value.startsWith('#') ? value : '#' + value;
    if (this.isValidHex(hex)) {
      this.fg = hex;
      this.fgError = false;
    } else {
      // Show error only when input is long enough to be a complete attempt
      this.fgError = value.replace('#', '').length > 0 && !this.isValidHex(hex);
    }
  }

  onBgText(value: string): void {
    this.bgInput = value;
    const hex = value.startsWith('#') ? value : '#' + value;
    if (this.isValidHex(hex)) {
      this.bg = hex;
      this.bgError = false;
      // Easter egg: identical foreground and background
      if (this.fg.toLowerCase() === this.bg.toLowerCase()) this.eggs.trigger('monochrome');
    } else {
      this.bgError = value.replace('#', '').length > 0 && !this.isValidHex(hex);
    }
  }

  onFgPicker(value: string): void {
    this.fg = value;
    this.fgInput = value;
    this.fgError = false;
  }

  onBgPicker(value: string): void {
    this.bg = value;
    this.bgInput = value;
    this.bgError = false;
  }

  swap(): void {
    [this.fg, this.bg]           = [this.bg, this.fg];
    [this.fgInput, this.bgInput] = [this.bgInput, this.fgInput];
    this.fgError = false;
    this.bgError = false;
  }

  applyPreset(p: { fg: string; bg: string }): void {
    this.fg = this.fgInput = p.fg;
    this.bg = this.bgInput = p.bg;
    this.fgError = false;
    this.bgError = false;
  }

  copyRatio(): void {
    navigator.clipboard.writeText(this.ratioLabel).then(() => {
      this.copied = true;
      setTimeout(() => { this.copied = false; }, 1800);
    });
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }
}
