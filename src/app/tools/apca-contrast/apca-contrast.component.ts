import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

interface WcagResult {
  level: 'AA' | 'AAA';
  context: string;
  required: number;
  passes: boolean;
}

interface ApcaResult {
  minFontSize: number;
  minWeight: number;
  use: string;
  passes: boolean;
}

interface ColorSuggestion {
  hex: string;
  wcagRatio: number;
  apcaLc: number;
}

@Component({
    selector: 'app-apca-contrast',
    templateUrl: './apca-contrast.component.html',
    styleUrls: ['./apca-contrast.component.css'],
    imports: [ToolsSharedModule]
})
export class ApcaContrastComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('APCA Contrast Calculator — WCAG 2 vs WCAG 3 side-by-side comparison. Check your color accessibility!')}&url=${encodeURIComponent(SITE_URL + '/tools/apca-contrast')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/apca-contrast')}`;

  // Color inputs
  textColor = '#e0e0e0';
  bgColor = '#0a0a1a';
  textColorInput = '#e0e0e0';
  bgColorInput = '#0a0a1a';
  textColorError = false;
  bgColorError = false;

  // Font settings for APCA
  fontSize = 16;
  fontWeight = 400;

  // Results
  wcagRatio = 0;
  apcaLc = 0;
  wcagResults: WcagResult[] = [];
  apcaResults: ApcaResult[] = [];
  suggestion: ColorSuggestion | null = null;

  // UI state
  copied = false;
  activeTab: 'side-by-side' | 'wcag2' | 'apca' = 'side-by-side';

  constructor(private router: Router) {
    this.calculate();
  }

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Color input handling ──────────────────────────────────────────

  onTextColorInput(value: string) {
    this.textColorInput = value;
    const parsed = this.parseColor(value);
    if (parsed) {
      this.textColor = parsed;
      this.textColorError = false;
      this.scheduleCalculation();
    } else {
      this.textColorError = true;
    }
  }

  onBgColorInput(value: string) {
    this.bgColorInput = value;
    const parsed = this.parseColor(value);
    if (parsed) {
      this.bgColor = parsed;
      this.bgColorError = false;
      this.scheduleCalculation();
    } else {
      this.bgColorError = true;
    }
  }

  onTextPickerChange(value: string) {
    this.textColor = value;
    this.textColorInput = value;
    this.textColorError = false;
    this.scheduleCalculation();
  }

  onBgPickerChange(value: string) {
    this.bgColor = value;
    this.bgColorInput = value;
    this.bgColorError = false;
    this.scheduleCalculation();
  }

  onFontSizeChange(value: number) {
    this.fontSize = Math.max(8, Math.min(120, value || 16));
    this.scheduleCalculation();
  }

  onFontWeightChange(value: number) {
    this.fontWeight = Math.max(100, Math.min(900, value || 400));
    this.scheduleCalculation();
  }

  swapColors() {
    const tmp = this.textColor;
    this.textColor = this.bgColor;
    this.bgColor = tmp;
    this.textColorInput = this.textColor;
    this.bgColorInput = this.bgColor;
    this.textColorError = false;
    this.bgColorError = false;
    this.calculate();
  }

  setTab(tab: 'side-by-side' | 'wcag2' | 'apca') {
    this.activeTab = tab;
  }

  // ── Core calculations ─────────────────────────────────────────────

  private scheduleCalculation() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.calculate(), 150);
  }

  private calculate() {
    const txtRgb = this.hexToRgb(this.textColor);
    const bgRgb = this.hexToRgb(this.bgColor);
    if (!txtRgb || !bgRgb) return;

    // WCAG 2.x ratio
    this.wcagRatio = this.calcWcag2Ratio(txtRgb, bgRgb);
    this.wcagResults = this.evaluateWcag2(this.wcagRatio);

    // APCA Lc value
    this.apcaLc = this.calcApcaLc(txtRgb, bgRgb);
    this.apcaResults = this.evaluateApca(this.apcaLc, this.fontSize, this.fontWeight);

    // Easter egg: Lc exactly 0
    if (this.apcaLc === 0) {
      this.eggs.trigger('apca-invisible');
    }

    // Suggest nearest accessible color
    this.suggestion = this.suggestAccessibleColor(txtRgb, bgRgb);
  }

  // ── WCAG 2.x contrast ratio ───────────────────────────────────────

  private calcWcag2Ratio(fg: number[], bg: number[]): number {
    const lFg = this.relativeLuminance(fg);
    const lBg = this.relativeLuminance(bg);
    const lighter = Math.max(lFg, lBg);
    const darker = Math.min(lFg, lBg);
    return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
  }

  private relativeLuminance(rgb: number[]): number {
    const [r, g, b] = rgb.map(c => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  private evaluateWcag2(ratio: number): WcagResult[] {
    return [
      { level: 'AA', context: 'Normal Text (< 18pt)', required: 4.5, passes: ratio >= 4.5 },
      { level: 'AA', context: 'Large Text (>= 18pt bold / 24pt)', required: 3, passes: ratio >= 3 },
      { level: 'AA', context: 'UI Components', required: 3, passes: ratio >= 3 },
      { level: 'AAA', context: 'Normal Text (< 18pt)', required: 7, passes: ratio >= 7 },
      { level: 'AAA', context: 'Large Text (>= 18pt bold / 24pt)', required: 4.5, passes: ratio >= 4.5 },
    ];
  }

  // ── APCA (Accessible Perceptual Contrast Algorithm) ───────────────

  private calcApcaLc(txtRgb: number[], bgRgb: number[]): number {
    // APCA W3 method (simplified reference implementation)
    const coeffTxt = this.sRGBtoY(txtRgb);
    const coeffBg = this.sRGBtoY(bgRgb);

    // Soft clamp
    const txtY = coeffTxt < 0.022 ? coeffTxt + Math.pow(0.022 - coeffTxt, 1.414) : coeffTxt;
    const bgY = coeffBg < 0.022 ? coeffBg + Math.pow(0.022 - coeffBg, 1.414) : coeffBg;

    // SAPC/APCA contrast
    const normBgExp = 0.56;
    const normTxtExp = 0.57;
    const revBgExp = 0.65;
    const revTxtExp = 0.62;

    let contrast = 0;

    if (bgY > txtY) {
      // Normal polarity (dark text on light bg)
      contrast = (Math.pow(bgY, normBgExp) - Math.pow(txtY, normTxtExp)) * 1.14;
    } else {
      // Reverse polarity (light text on dark bg)
      contrast = (Math.pow(bgY, revBgExp) - Math.pow(txtY, revTxtExp)) * 1.14;
    }

    // Low contrast clamp
    if (Math.abs(contrast) < 0.1) {
      return 0;
    } else if (contrast > 0) {
      contrast -= 0.027;
    } else {
      contrast += 0.027;
    }

    // Scale to Lc (0-100 range)
    return Math.round(contrast * 100);
  }

  private sRGBtoY(rgb: number[]): number {
    // Linearize sRGB and apply APCA coefficients
    const [rL, gL, bL] = rgb.map(c => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    // APCA uses slightly different coefficients than WCAG 2
    return 0.2126729 * rL + 0.7151522 * gL + 0.0721750 * bL;
  }

  private evaluateApca(lc: number, fontSize: number, fontWeight: number): ApcaResult[] {
    const absLc = Math.abs(lc);

    // APCA lookup table (simplified) — minimum |Lc| for font size/weight combos
    const thresholds: { use: string; minLc: number; minSize: number; minWeight: number }[] = [
      { use: 'Body Text (content)', minLc: 75, minSize: 16, minWeight: 400 },
      { use: 'Large Text (headings)', minLc: 60, minSize: 24, minWeight: 700 },
      { use: 'Sub-headings', minLc: 60, minSize: 18, minWeight: 600 },
      { use: 'Placeholder / Disabled', minLc: 30, minSize: 14, minWeight: 400 },
      { use: 'Non-text UI (icons, borders)', minLc: 45, minSize: 0, minWeight: 0 },
      { use: 'Large Non-text (hero graphics)', minLc: 30, minSize: 0, minWeight: 0 },
      { use: 'Fluent / Columns of Body Text', minLc: 90, minSize: 14, minWeight: 400 },
      { use: 'Spot / Non-content Text', minLc: 45, minSize: 16, minWeight: 400 },
    ];

    return thresholds.map(t => ({
      minFontSize: t.minSize,
      minWeight: t.minWeight,
      use: t.use,
      passes: absLc >= t.minLc &&
        (t.minSize === 0 || fontSize >= t.minSize) &&
        (t.minWeight === 0 || fontWeight >= t.minWeight),
    }));
  }

  // ── Suggest nearest accessible color ──────────────────────────────

  private suggestAccessibleColor(txtRgb: number[], bgRgb: number[]): ColorSuggestion | null {
    const currentRatio = this.calcWcag2Ratio(txtRgb, bgRgb);
    if (currentRatio >= 4.5) return null; // Already accessible

    // Determine if we should lighten or darken the text
    const bgLum = this.relativeLuminance(bgRgb);
    const direction = bgLum > 0.5 ? -1 : 1; // darken text on light bg, lighten on dark

    let bestRgb = [...txtRgb];
    for (let step = 1; step <= 255; step++) {
      const candidate = txtRgb.map(c => Math.max(0, Math.min(255, c + direction * step)));
      const ratio = this.calcWcag2Ratio(candidate, bgRgb);
      if (ratio >= 4.5) {
        bestRgb = candidate;
        break;
      }
    }

    const hex = this.rgbToHex(bestRgb);
    return {
      hex,
      wcagRatio: this.calcWcag2Ratio(bestRgb, bgRgb),
      apcaLc: this.calcApcaLc(bestRgb, bgRgb),
    };
  }

  // ── Color utilities ───────────────────────────────────────────────

  private parseColor(input: string): string | null {
    if (!input) return null;
    let s = input.trim().toLowerCase();

    // Handle hex
    if (s.startsWith('#')) {
      s = s.slice(1);
    }
    if (/^[0-9a-f]{3}$/.test(s)) {
      s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    }
    if (/^[0-9a-f]{6}$/.test(s)) {
      return '#' + s;
    }
    return null;
  }

  private hexToRgb(hex: string): number[] | null {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return null;
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }

  private rgbToHex(rgb: number[]): string {
    return '#' + rgb.map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
  }

  // ── Display helpers ───────────────────────────────────────────────

  get absLc(): number {
    return Math.abs(this.apcaLc);
  }

  get wcagGrade(): string {
    if (this.wcagRatio >= 7) return 'AAA';
    if (this.wcagRatio >= 4.5) return 'AA';
    if (this.wcagRatio >= 3) return 'AA Large';
    return 'Fail';
  }

  get apcaGrade(): string {
    const abs = this.absLc;
    if (abs >= 90) return 'Preferred';
    if (abs >= 75) return 'Body Text OK';
    if (abs >= 60) return 'Large Text OK';
    if (abs >= 45) return 'Spot Text Only';
    if (abs >= 30) return 'Non-text Only';
    return 'Invisible';
  }

  get wcagGradeClass(): string {
    if (this.wcagRatio >= 7) return 'pass-high';
    if (this.wcagRatio >= 4.5) return 'pass';
    if (this.wcagRatio >= 3) return 'warn';
    return 'fail';
  }

  get apcaGradeClass(): string {
    const abs = this.absLc;
    if (abs >= 75) return 'pass-high';
    if (abs >= 60) return 'pass';
    if (abs >= 45) return 'warn';
    return 'fail';
  }

  get polarity(): string {
    return this.apcaLc >= 0 ? 'Normal (dark on light)' : 'Reverse (light on dark)';
  }

  applySuggestion() {
    if (!this.suggestion) return;
    this.textColor = this.suggestion.hex;
    this.textColorInput = this.suggestion.hex;
    this.textColorError = false;
    this.calculate();
  }

  async copyResults() {
    if (!this.isBrowser) return;
    const text = `APCA Contrast Results\nText: ${this.textColor} | Background: ${this.bgColor}\nWCAG 2.x Ratio: ${this.wcagRatio}:1 (${this.wcagGrade})\nAPCA Lc: ${this.apcaLc} (${this.apcaGrade})\nFont: ${this.fontSize}px / ${this.fontWeight}w\nPolarity: ${this.polarity}`;
    try {
      await navigator.clipboard.writeText(text);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch { /* silent */ }
  }

  loadSample(preset: 'accessible' | 'poor' | 'borderline') {
    switch (preset) {
      case 'accessible':
        this.textColor = '#ffffff';
        this.bgColor = '#1a1a2e';
        this.fontSize = 16;
        this.fontWeight = 400;
        break;
      case 'poor':
        this.textColor = '#888888';
        this.bgColor = '#999999';
        this.fontSize = 14;
        this.fontWeight = 300;
        break;
      case 'borderline':
        this.textColor = '#767676';
        this.bgColor = '#ffffff';
        this.fontSize = 18;
        this.fontWeight = 700;
        break;
    }
    this.textColorInput = this.textColor;
    this.bgColorInput = this.bgColor;
    this.textColorError = false;
    this.bgColorError = false;
    this.calculate();
  }
}
