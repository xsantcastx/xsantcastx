import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

interface SpacingStep { label: string; value: number; px: string; rem: string; }

@Component({
    selector: 'app-spacing-scale',
    templateUrl: './spacing-scale.component.html',
    styleUrls: ['./spacing-scale.component.css'],
    imports: [FormsModule, ToolsSharedModule]
})
export class SpacingScaleComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Spacing Scale Generator — linear & geometric scales!')}&url=${encodeURIComponent(SITE_URL + '/tools/spacing-scale')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/spacing-scale')}`;

  base = 4;
  steps = 10;
  mode: 'linear' | 'geometric' = 'linear';
  ratio = 1.5;
  scale: SpacingStep[] = [];
  copied = false;

  constructor(private router: Router) {
    this.generate();
  }

  goBack() { this.router.navigate(['/tools']); }

  generate() {
    if (this.base === 0) {
      this.eggs.trigger('spacing-zero');
    }

    this.scale = [];
    for (let i = 0; i < this.steps; i++) {
      let value: number;
      if (this.mode === 'linear') {
        value = this.base * (i + 1);
      } else {
        value = Math.round(this.base * Math.pow(this.ratio, i));
      }
      this.scale.push({
        label: `step-${i + 1}`,
        value,
        px: `${value}px`,
        rem: `${(value / 16).toFixed(3)}rem`,
      });
    }
  }

  get cssVariables(): string {
    return this.scale.map(s => `  --spacing-${s.label}: ${s.px};`).join('\n');
  }

  get maxValue(): number {
    return this.scale.length ? this.scale[this.scale.length - 1].value : 1;
  }

  async copyCss() {
    if (!this.isBrowser) return;
    const css = `:root {\n${this.cssVariables}\n}`;
    try {
      await navigator.clipboard.writeText(css);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {}
  }
}
