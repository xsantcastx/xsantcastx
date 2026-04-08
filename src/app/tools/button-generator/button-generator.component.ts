import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

interface ButtonPreset {
  name: string;
  bgColor: string; textColor: string; borderRadius: number;
  paddingX: number; paddingY: number; fontSize: number;
  borderWidth: number; borderColor: string;
  hoverBg: string; hoverText: string;
  shadow: string; fontWeight: number;
}

@Component({
  selector: 'app-button-generator',
  templateUrl: './button-generator.component.html',
  styleUrls: ['./button-generator.component.css'],
  standalone: false
})
export class ButtonGeneratorComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free CSS Button Generator — 10 presets, hover states, live preview')}&url=${encodeURIComponent(SITE_URL + '/tools/button-generator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/button-generator')}`;

  buttonText = 'Click Me';
  bgColor = '#00ffcc'; textColor = '#0a0e1a'; borderRadius = 8;
  paddingX = 24; paddingY = 12; fontSize = 16;
  borderWidth = 0; borderColor = '#00ffcc';
  hoverBg = '#00e6b8'; hoverText = '#0a0e1a';
  shadow = '0 4px 14px rgba(0, 255, 204, 0.3)'; fontWeight = 600;
  copied = false;

  readonly presets: ButtonPreset[] = [
    { name: 'Primary', bgColor: '#00ffcc', textColor: '#0a0e1a', borderRadius: 8, paddingX: 24, paddingY: 12, fontSize: 16, borderWidth: 0, borderColor: '#00ffcc', hoverBg: '#00e6b8', hoverText: '#0a0e1a', shadow: '0 4px 14px rgba(0,255,204,0.3)', fontWeight: 600 },
    { name: 'Outline', bgColor: 'transparent', textColor: '#00ffcc', borderRadius: 8, paddingX: 24, paddingY: 12, fontSize: 16, borderWidth: 2, borderColor: '#00ffcc', hoverBg: '#00ffcc', hoverText: '#0a0e1a', shadow: 'none', fontWeight: 600 },
    { name: 'Ghost', bgColor: 'transparent', textColor: '#d6ddeb', borderRadius: 8, paddingX: 24, paddingY: 12, fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', hoverBg: 'rgba(255,255,255,0.05)', hoverText: '#ffffff', shadow: 'none', fontWeight: 500 },
    { name: 'Pill', bgColor: '#7b61ff', textColor: '#ffffff', borderRadius: 999, paddingX: 28, paddingY: 12, fontSize: 16, borderWidth: 0, borderColor: '#7b61ff', hoverBg: '#6a4fff', hoverText: '#ffffff', shadow: '0 4px 14px rgba(123,97,255,0.3)', fontWeight: 600 },
    { name: 'Danger', bgColor: '#ff4d6a', textColor: '#ffffff', borderRadius: 8, paddingX: 24, paddingY: 12, fontSize: 16, borderWidth: 0, borderColor: '#ff4d6a', hoverBg: '#e6435f', hoverText: '#ffffff', shadow: '0 4px 14px rgba(255,77,106,0.3)', fontWeight: 600 },
    { name: 'Neon', bgColor: 'transparent', textColor: '#00ffcc', borderRadius: 4, paddingX: 24, paddingY: 12, fontSize: 16, borderWidth: 2, borderColor: '#00ffcc', hoverBg: 'rgba(0,255,204,0.1)', hoverText: '#00ffcc', shadow: '0 0 20px rgba(0,255,204,0.4)', fontWeight: 700 },
    { name: 'Gradient', bgColor: 'linear-gradient(135deg, #00ffcc, #7b61ff)', textColor: '#ffffff', borderRadius: 8, paddingX: 24, paddingY: 12, fontSize: 16, borderWidth: 0, borderColor: 'transparent', hoverBg: 'linear-gradient(135deg, #00e6b8, #6a4fff)', hoverText: '#ffffff', shadow: '0 4px 20px rgba(0,255,204,0.2)', fontWeight: 600 },
    { name: 'Flat', bgColor: '#1a1a2e', textColor: '#d6ddeb', borderRadius: 4, paddingX: 20, paddingY: 10, fontSize: 14, borderWidth: 0, borderColor: 'transparent', hoverBg: '#252542', hoverText: '#ffffff', shadow: 'none', fontWeight: 500 },
    { name: 'Glass', bgColor: 'rgba(255,255,255,0.08)', textColor: '#d6ddeb', borderRadius: 12, paddingX: 24, paddingY: 12, fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', hoverBg: 'rgba(255,255,255,0.12)', hoverText: '#ffffff', shadow: '0 8px 32px rgba(0,0,0,0.2)', fontWeight: 500 },
    { name: 'Brutal', bgColor: '#00ffcc', textColor: '#000000', borderRadius: 0, paddingX: 24, paddingY: 12, fontSize: 16, borderWidth: 3, borderColor: '#000000', hoverBg: '#ffffff', hoverText: '#000000', shadow: '4px 4px 0 #000000', fontWeight: 800 },
  ];

  constructor(private router: Router) {}

  goBack(): void { this.router.navigate(['/tools']); }

  applyPreset(preset: ButtonPreset): void {
    Object.assign(this, {
      bgColor: preset.bgColor, textColor: preset.textColor, borderRadius: preset.borderRadius,
      paddingX: preset.paddingX, paddingY: preset.paddingY, fontSize: preset.fontSize,
      borderWidth: preset.borderWidth, borderColor: preset.borderColor,
      hoverBg: preset.hoverBg, hoverText: preset.hoverText,
      shadow: preset.shadow, fontWeight: preset.fontWeight
    });
  }

  onTextChange(): void {
    if (this.buttonText === 'Do Not Press') {
      this.eggs.trigger('button-forbidden');
    }
  }

  get cssCode(): string {
    let css = `.btn {\n`;
    css += `  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n`;
    css += `  padding: ${this.paddingY}px ${this.paddingX}px;\n`;
    css += `  font-size: ${this.fontSize}px;\n  font-weight: ${this.fontWeight};\n`;
    css += `  color: ${this.textColor};\n  background: ${this.bgColor};\n`;
    css += `  border-radius: ${this.borderRadius}px;\n`;
    css += `  border: ${this.borderWidth}px solid ${this.borderColor};\n`;
    if (this.shadow !== 'none') css += `  box-shadow: ${this.shadow};\n`;
    css += `  cursor: pointer;\n  transition: all 0.2s ease;\n`;
    css += `}\n\n.btn:hover {\n  background: ${this.hoverBg};\n  color: ${this.hoverText};\n}\n`;
    return css;
  }

  get htmlCode(): string {
    return `<button class="btn">${this.buttonText}</button>`;
  }

  async copyCSS(): Promise<void> {
    if (!this.isBrowser) return;
    try { await navigator.clipboard.writeText(this.cssCode); this.copied = true; setTimeout(() => (this.copied = false), 2000); } catch {}
  }
}
