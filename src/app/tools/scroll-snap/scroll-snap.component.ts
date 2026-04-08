import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

@Component({
  selector: 'app-scroll-snap',
  templateUrl: './scroll-snap.component.html',
  styleUrls: ['./scroll-snap.component.css'],
  standalone: false
})
export class ScrollSnapComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free CSS Scroll-Snap Builder — live preview!')}&url=${encodeURIComponent(SITE_URL + '/tools/scroll-snap')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/scroll-snap')}`;

  direction: 'x' | 'y' | 'both' = 'y';
  snapType: 'mandatory' | 'proximity' = 'mandatory';
  snapAlign: 'start' | 'center' | 'end' = 'start';
  itemCount = 5;
  gap = 0;
  padding = 0;
  copied = false;

  readonly colors = ['#00ffcc', '#7b61ff', '#ff4d6a', '#ff9f43', '#00b4d8', '#e879f9', '#34d399', '#f472b6'];

  constructor(private router: Router) {}

  goBack() { this.router.navigate(['/tools']); }

  onDirectionChange() {
    if (this.direction === 'both') {
      this.eggs.trigger('snap-2d');
    }
  }

  get containerCss(): string {
    const lines: string[] = [];
    if (this.direction === 'both') {
      lines.push(`scroll-snap-type: both ${this.snapType};`);
      lines.push('overflow: auto;');
    } else {
      lines.push(`scroll-snap-type: ${this.direction} ${this.snapType};`);
      lines.push(`overflow-${this.direction}: auto;`);
    }
    if (this.padding) lines.push(`scroll-padding: ${this.padding}px;`);
    if (this.direction === 'x') {
      lines.push('display: flex;');
      if (this.gap) lines.push(`gap: ${this.gap}px;`);
    } else if (this.direction === 'y') {
      if (this.gap) lines.push(`gap: ${this.gap}px;`);
    }
    lines.push('width: 300px;');
    lines.push('height: 300px;');
    return lines.map(l => '  ' + l).join('\n');
  }

  get itemCss(): string {
    const lines: string[] = [];
    lines.push(`scroll-snap-align: ${this.snapAlign};`);
    if (this.direction === 'x') {
      lines.push('min-width: 300px;');
      lines.push('height: 100%;');
    } else {
      lines.push('width: 100%;');
      lines.push('min-height: 300px;');
    }
    return lines.map(l => '  ' + l).join('\n');
  }

  get fullCss(): string {
    return `.scroll-container {\n${this.containerCss}\n}\n\n.scroll-item {\n${this.itemCss}\n}`;
  }

  get items(): number[] {
    return Array.from({ length: this.itemCount }, (_, i) => i);
  }

  getColor(i: number): string {
    return this.colors[i % this.colors.length];
  }

  async copyCss() {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.fullCss);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {}
  }
}
