import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

@Component({
    selector: 'app-transform-playground',
    templateUrl: './transform-playground.component.html',
    styleUrls: ['./transform-playground.component.css'],
    imports: [FormsModule, ToolsSharedModule]
})
export class TransformPlaygroundComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free CSS Transform Playground — translate, rotate, scale, skew with live preview')}&url=${encodeURIComponent(SITE_URL + '/tools/transform-playground')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/transform-playground')}`;

  translateX = 0; translateY = 0;
  rotate = 0;
  scaleX = 1; scaleY = 1;
  skewX = 0; skewY = 0;
  perspective = 0;
  copied = false;

  constructor(private router: Router) {}

  goBack(): void { this.router.navigate(['/tools']); }

  onRotateChange(): void {
    if (this.rotate === 360 || this.rotate === -360) {
      this.eggs.trigger('transform-full-spin');
    }
  }

  get transformValue(): string {
    const parts: string[] = [];
    if (this.perspective > 0) parts.push(`perspective(${this.perspective}px)`);
    if (this.translateX !== 0 || this.translateY !== 0) parts.push(`translate(${this.translateX}px, ${this.translateY}px)`);
    if (this.rotate !== 0) parts.push(`rotate(${this.rotate}deg)`);
    if (this.scaleX !== 1 || this.scaleY !== 1) parts.push(`scale(${this.scaleX}, ${this.scaleY})`);
    if (this.skewX !== 0 || this.skewY !== 0) parts.push(`skew(${this.skewX}deg, ${this.skewY}deg)`);
    return parts.length > 0 ? parts.join(' ') : 'none';
  }

  get cssCode(): string {
    return `transform: ${this.transformValue};`;
  }

  resetAll(): void {
    this.translateX = 0; this.translateY = 0;
    this.rotate = 0; this.scaleX = 1; this.scaleY = 1;
    this.skewX = 0; this.skewY = 0; this.perspective = 0;
  }

  async copyCode(): Promise<void> {
    if (!this.isBrowser) return;
    try { await navigator.clipboard.writeText(this.cssCode); this.copied = true; setTimeout(() => (this.copied = false), 2000); } catch {}
  }
}
