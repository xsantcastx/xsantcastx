import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

export interface ProgressBarPreset {
  name: string;
  width: number;
  height: number;
  borderRadius: number;
  bgColor: string;
  fillColor: string;
  fillPercentage: number;
  animatedStripes: boolean;
  gradientFill: boolean;
  gradientColor: string;
  labelPosition: 'inside' | 'outside' | 'none';
  animationSpeed: number;
}

@Component({
  selector: 'app-progress-bar',
  templateUrl: './progress-bar.component.html',
  styleUrls: ['./progress-bar.component.css'],
  standalone: false
})
export class ProgressBarComponent {
  private readonly eggs = inject(EasterEggService);

  // Controls
  width = 400;
  height = 24;
  borderRadius = 12;
  bgColor = '#1a1a2e';
  fillColor = '#00ffcc';
  fillPercentage = 65;
  animatedStripes = false;
  gradientFill = false;
  gradientColor = '#7b00ff';
  labelPosition: 'inside' | 'outside' | 'none' = 'inside';
  animationSpeed = 1;

  codeCopied = false;
  htmlCopied = false;

  readonly presets: ProgressBarPreset[] = [
    {
      name: 'Default',
      width: 400, height: 24, borderRadius: 12,
      bgColor: '#1a1a2e', fillColor: '#00ffcc',
      fillPercentage: 65, animatedStripes: false,
      gradientFill: false, gradientColor: '#7b00ff',
      labelPosition: 'inside', animationSpeed: 1
    },
    {
      name: 'Striped',
      width: 400, height: 28, borderRadius: 6,
      bgColor: '#16213e', fillColor: '#e94560',
      fillPercentage: 75, animatedStripes: true,
      gradientFill: false, gradientColor: '#ff6b6b',
      labelPosition: 'inside', animationSpeed: 1.5
    },
    {
      name: 'Gradient',
      width: 400, height: 20, borderRadius: 10,
      bgColor: '#0f0f1a', fillColor: '#00ffcc',
      fillPercentage: 80, animatedStripes: false,
      gradientFill: true, gradientColor: '#7b00ff',
      labelPosition: 'inside', animationSpeed: 1
    },
    {
      name: 'Glass',
      width: 400, height: 32, borderRadius: 16,
      bgColor: 'rgba(255,255,255,0.08)', fillColor: 'rgba(0,255,204,0.6)',
      fillPercentage: 55, animatedStripes: false,
      gradientFill: true, gradientColor: 'rgba(123,0,255,0.4)',
      labelPosition: 'inside', animationSpeed: 1
    },
    {
      name: 'Neon',
      width: 400, height: 18, borderRadius: 9,
      bgColor: '#0a0a0f', fillColor: '#ff0040',
      fillPercentage: 70, animatedStripes: true,
      gradientFill: true, gradientColor: '#ff8c00',
      labelPosition: 'outside', animationSpeed: 0.8
    },
    {
      name: 'Minimal',
      width: 400, height: 6, borderRadius: 3,
      bgColor: '#2a2a3e', fillColor: '#00ffcc',
      fillPercentage: 45, animatedStripes: false,
      gradientFill: false, gradientColor: '#00ffcc',
      labelPosition: 'outside', animationSpeed: 1
    }
  ];

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free CSS Progress Bar Generator — design custom progress bars with live preview and one-click code copy')}&url=${encodeURIComponent(SITE_URL + '/tools/progress-bar')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/progress-bar')}`;

  constructor(private router: Router, private translationService: TranslationService) {}

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  // ── Slider Handlers ─────────────────────────────────────

  onWidthChange(event: Event): void {
    this.width = parseFloat((event.target as HTMLInputElement).value);
  }

  onHeightChange(event: Event): void {
    this.height = parseFloat((event.target as HTMLInputElement).value);
  }

  onBorderRadiusChange(event: Event): void {
    this.borderRadius = parseFloat((event.target as HTMLInputElement).value);
  }

  onFillPercentageChange(event: Event): void {
    this.fillPercentage = parseFloat((event.target as HTMLInputElement).value);
    this.checkAlmostEasterEgg();
  }

  onAnimationSpeedChange(event: Event): void {
    this.animationSpeed = parseFloat((event.target as HTMLInputElement).value);
  }

  onBgColorChange(event: Event): void {
    this.bgColor = (event.target as HTMLInputElement).value;
  }

  onFillColorChange(event: Event): void {
    this.fillColor = (event.target as HTMLInputElement).value;
  }

  onGradientColorChange(event: Event): void {
    this.gradientColor = (event.target as HTMLInputElement).value;
  }

  toggleStripes(): void {
    this.animatedStripes = !this.animatedStripes;
  }

  toggleGradient(): void {
    this.gradientFill = !this.gradientFill;
  }

  setLabelPosition(pos: 'inside' | 'outside' | 'none'): void {
    this.labelPosition = pos;
  }

  // ── Presets ─────────────────────────────────────────────

  applyPreset(preset: ProgressBarPreset): void {
    this.width = preset.width;
    this.height = preset.height;
    this.borderRadius = preset.borderRadius;
    this.bgColor = preset.bgColor;
    this.fillColor = preset.fillColor;
    this.fillPercentage = preset.fillPercentage;
    this.animatedStripes = preset.animatedStripes;
    this.gradientFill = preset.gradientFill;
    this.gradientColor = preset.gradientColor;
    this.labelPosition = preset.labelPosition;
    this.animationSpeed = preset.animationSpeed;
    this.checkAlmostEasterEgg();
  }

  // ── Preview Styles ──────────────────────────────────────

  get previewContainerStyle(): { [key: string]: string } {
    return {
      width: this.width + 'px',
      height: this.height + 'px',
      borderRadius: this.borderRadius + 'px',
      background: this.bgColor,
      overflow: 'hidden',
      position: 'relative'
    };
  }

  get previewFillStyle(): { [key: string]: string } {
    const bg = this.gradientFill
      ? `linear-gradient(90deg, ${this.fillColor}, ${this.gradientColor})`
      : this.fillColor;

    const styles: { [key: string]: string } = {
      width: this.fillPercentage + '%',
      height: '100%',
      borderRadius: this.borderRadius + 'px',
      background: bg,
      transition: 'width 0.3s ease'
    };

    if (this.animatedStripes) {
      styles['backgroundImage'] = `linear-gradient(
        45deg,
        rgba(255,255,255,0.15) 25%,
        transparent 25%,
        transparent 50%,
        rgba(255,255,255,0.15) 50%,
        rgba(255,255,255,0.15) 75%,
        transparent 75%,
        transparent
      )`;
      styles['backgroundSize'] = `${this.height * 2}px ${this.height * 2}px`;
      styles['animation'] = `pb-stripe-slide ${this.animationSpeed}s linear infinite`;
    }

    return styles;
  }

  // ── CSS Output ──────────────────────────────────────────

  get cssCode(): string {
    let css = `.pb-container {\n`;
    css += `  width: ${this.width}px;\n`;
    css += `  height: ${this.height}px;\n`;
    css += `  border-radius: ${this.borderRadius}px;\n`;
    css += `  background: ${this.bgColor};\n`;
    css += `  overflow: hidden;\n`;
    css += `  position: relative;\n`;
    css += `}\n\n`;

    css += `.pb-fill {\n`;
    css += `  width: ${this.fillPercentage}%;\n`;
    css += `  height: 100%;\n`;
    css += `  border-radius: ${this.borderRadius}px;\n`;

    if (this.gradientFill) {
      css += `  background: linear-gradient(90deg, ${this.fillColor}, ${this.gradientColor});\n`;
    } else {
      css += `  background: ${this.fillColor};\n`;
    }

    css += `  transition: width 0.3s ease;\n`;

    if (this.animatedStripes) {
      css += `  background-image: linear-gradient(\n`;
      css += `    45deg,\n`;
      css += `    rgba(255, 255, 255, 0.15) 25%,\n`;
      css += `    transparent 25%,\n`;
      css += `    transparent 50%,\n`;
      css += `    rgba(255, 255, 255, 0.15) 50%,\n`;
      css += `    rgba(255, 255, 255, 0.15) 75%,\n`;
      css += `    transparent 75%,\n`;
      css += `    transparent\n`;
      css += `  );\n`;
      css += `  background-size: ${this.height * 2}px ${this.height * 2}px;\n`;
      css += `  animation: pb-stripe-slide ${this.animationSpeed}s linear infinite;\n`;
    }

    css += `}\n`;

    if (this.labelPosition !== 'none') {
      css += `\n.pb-label {\n`;
      css += `  font-size: ${Math.max(this.height * 0.55, 10)}px;\n`;
      css += `  font-weight: 700;\n`;
      css += `  font-family: 'SF Mono', 'Fira Code', monospace;\n`;
      if (this.labelPosition === 'inside') {
        css += `  position: absolute;\n`;
        css += `  right: 8px;\n`;
        css += `  top: 50%;\n`;
        css += `  transform: translateY(-50%);\n`;
        css += `  color: rgba(0, 0, 0, 0.7);\n`;
      } else {
        css += `  margin-top: 6px;\n`;
        css += `  color: inherit;\n`;
      }
      css += `}\n`;
    }

    if (this.animatedStripes) {
      css += `\n@keyframes pb-stripe-slide {\n`;
      css += `  from { background-position: 0 0; }\n`;
      css += `  to { background-position: ${this.height * 2}px 0; }\n`;
      css += `}\n`;
    }

    return css;
  }

  get htmlCode(): string {
    let html = `<div class="pb-container">\n`;
    html += `  <div class="pb-fill">`;
    if (this.labelPosition === 'inside') {
      html += `\n    <span class="pb-label">${this.fillPercentage}%</span>\n  `;
    }
    html += `</div>\n`;
    html += `</div>`;
    if (this.labelPosition === 'outside') {
      html += `\n<span class="pb-label">${this.fillPercentage}%</span>`;
    }
    return html;
  }

  copyCSS(): void {
    navigator.clipboard.writeText(this.cssCode).then(() => {
      this.codeCopied = true;
      setTimeout(() => { this.codeCopied = false; }, 1500);
    });
  }

  copyHTML(): void {
    navigator.clipboard.writeText(this.htmlCode).then(() => {
      this.htmlCopied = true;
      setTimeout(() => { this.htmlCopied = false; }, 1500);
    });
  }

  // ── Reset ───────────────────────────────────────────────

  resetAll(): void {
    this.width = 400;
    this.height = 24;
    this.borderRadius = 12;
    this.bgColor = '#1a1a2e';
    this.fillColor = '#00ffcc';
    this.fillPercentage = 65;
    this.animatedStripes = false;
    this.gradientFill = false;
    this.gradientColor = '#7b00ff';
    this.labelPosition = 'inside';
    this.animationSpeed = 1;
  }

  // ── Easter Egg ──────────────────────────────────────────

  private checkAlmostEasterEgg(): void {
    if (this.fillPercentage === 99) {
      this.eggs.trigger('progress-almost');
    }
  }

  // ── Preset preview helper ───────────────────────────────

  getPresetPreviewFillStyle(preset: ProgressBarPreset): { [key: string]: string } {
    const bg = preset.gradientFill
      ? `linear-gradient(90deg, ${preset.fillColor}, ${preset.gradientColor})`
      : preset.fillColor;
    return {
      width: preset.fillPercentage + '%',
      height: '100%',
      borderRadius: '3px',
      background: bg
    };
  }

  trackByPresetName(index: number, preset: ProgressBarPreset): string {
    return preset.name;
  }
}
