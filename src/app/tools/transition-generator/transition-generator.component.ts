import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

@Component({
    selector: 'app-transition-generator',
    templateUrl: './transition-generator.component.html',
    styleUrls: ['./transition-generator.component.css'],
    imports: [FormsModule, ToolsSharedModule]
})
export class TransitionGeneratorComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free CSS Transition Generator — build transitions with cubic-bezier!')}&url=${encodeURIComponent(SITE_URL + '/tools/transition-generator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/transition-generator')}`;

  property = 'all';
  duration = 0.3;
  delay = 0;
  timingFunction = 'ease';
  cubicP1 = 0.25;
  cubicP2 = 0.1;
  cubicP3 = 0.25;
  cubicP4 = 1;
  previewActive = false;
  copied = false;

  readonly properties = ['all', 'opacity', 'transform', 'background-color', 'color', 'border', 'box-shadow', 'width', 'height', 'margin', 'padding'];
  readonly timingFunctions = ['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-bezier'];
  readonly presets: Record<string, [number, number, number, number]> = {
    'Ease': [0.25, 0.1, 0.25, 1],
    'Ease In': [0.42, 0, 1, 1],
    'Ease Out': [0, 0, 0.58, 1],
    'Ease In Out': [0.42, 0, 0.58, 1],
    'Bounce': [0.68, -0.55, 0.265, 1.55],
    'Smooth': [0.4, 0, 0.2, 1],
    'Snappy': [0.7, 0, 0.3, 1],
  };

  constructor(private router: Router) {}

  goBack() { this.router.navigate(['/tools']); }

  onDurationChange() {
    if (this.duration === 0) {
      this.eggs.trigger('transition-instant');
    }
  }

  loadPreset(name: string) {
    const p = this.presets[name];
    this.cubicP1 = p[0];
    this.cubicP2 = p[1];
    this.cubicP3 = p[2];
    this.cubicP4 = p[3];
    this.timingFunction = 'cubic-bezier';
  }

  get timingValue(): string {
    if (this.timingFunction === 'cubic-bezier') {
      return `cubic-bezier(${this.cubicP1}, ${this.cubicP2}, ${this.cubicP3}, ${this.cubicP4})`;
    }
    return this.timingFunction;
  }

  get cssTransition(): string {
    return `transition: ${this.property} ${this.duration}s ${this.timingValue}${this.delay ? ' ' + this.delay + 's' : ''};`;
  }

  get previewStyle(): string {
    return `${this.property === 'all' || this.property === 'transform' ? 'transform' : this.property}: ${this.previewActive ? this.getActiveValue() : this.getBaseValue()};transition: ${this.property} ${this.duration}s ${this.timingValue}${this.delay ? ' ' + this.delay + 's' : ''};`;
  }

  private getBaseValue(): string {
    switch (this.property) {
      case 'opacity': return '1';
      case 'transform': case 'all': return 'translateX(0)';
      case 'background-color': return '#00ffcc';
      case 'color': return '#00ffcc';
      case 'width': return '60px';
      case 'height': return '60px';
      default: return 'initial';
    }
  }

  private getActiveValue(): string {
    switch (this.property) {
      case 'opacity': return '0.2';
      case 'transform': case 'all': return 'translateX(120px)';
      case 'background-color': return '#7b61ff';
      case 'color': return '#7b61ff';
      case 'width': return '200px';
      case 'height': return '120px';
      default: return 'initial';
    }
  }

  togglePreview() {
    this.previewActive = !this.previewActive;
  }

  async copyCss() {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.cssTransition);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {}
  }
}
