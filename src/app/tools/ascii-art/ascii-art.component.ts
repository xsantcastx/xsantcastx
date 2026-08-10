import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { TranslationService } from '../../translation.service';

@Component({
    selector: 'app-ascii-art',
    templateUrl: './ascii-art.component.html',
    styleUrls: ['./ascii-art.component.css'],
    imports: [FormsModule, ToolsSharedModule]
})
export class AsciiArtComponent {
  private readonly translationService = inject(TranslationService);

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free ASCII Art Generator — type text, get block letters!')}&url=${encodeURIComponent(SITE_URL + '/tools/ascii-art')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/ascii-art')}`;

  input = '';
  output = '';
  copied = false;

  private readonly font: Record<string, string[]> = {
    'A': [' ███ ', '█   █', '█████', '█   █', '█   █'],
    'B': ['████ ', '█   █', '████ ', '█   █', '████ '],
    'C': [' ████', '█    ', '█    ', '█    ', ' ████'],
    'D': ['████ ', '█   █', '█   █', '█   █', '████ '],
    'E': ['█████', '█    ', '████ ', '█    ', '█████'],
    'F': ['█████', '█    ', '████ ', '█    ', '█    '],
    'G': [' ████', '█    ', '█  ██', '█   █', ' ████'],
    'H': ['█   █', '█   █', '█████', '█   █', '█   █'],
    'I': ['█████', '  █  ', '  █  ', '  █  ', '█████'],
    'J': ['█████', '   █ ', '   █ ', '█  █ ', ' ██  '],
    'K': ['█  █ ', '█ █  ', '██   ', '█ █  ', '█  █ '],
    'L': ['█    ', '█    ', '█    ', '█    ', '█████'],
    'M': ['█   █', '██ ██', '█ █ █', '█   █', '█   █'],
    'N': ['█   █', '██  █', '█ █ █', '█  ██', '█   █'],
    'O': [' ███ ', '█   █', '█   █', '█   █', ' ███ '],
    'P': ['████ ', '█   █', '████ ', '█    ', '█    '],
    'Q': [' ███ ', '█   █', '█ █ █', '█  █ ', ' ██ █'],
    'R': ['████ ', '█   █', '████ ', '█ █  ', '█  █ '],
    'S': [' ████', '█    ', ' ███ ', '    █', '████ '],
    'T': ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
    'U': ['█   █', '█   █', '█   █', '█   █', ' ███ '],
    'V': ['█   █', '█   █', '█   █', ' █ █ ', '  █  '],
    'W': ['█   █', '█   █', '█ █ █', '██ ██', '█   █'],
    'X': ['█   █', ' █ █ ', '  █  ', ' █ █ ', '█   █'],
    'Y': ['█   █', ' █ █ ', '  █  ', '  █  ', '  █  '],
    'Z': ['█████', '   █ ', '  █  ', ' █   ', '█████'],
    '0': [' ███ ', '█  ██', '█ █ █', '██  █', ' ███ '],
    '1': ['  █  ', ' ██  ', '  █  ', '  █  ', '█████'],
    '2': [' ███ ', '█   █', '  ██ ', ' █   ', '█████'],
    '3': ['████ ', '    █', ' ███ ', '    █', '████ '],
    '4': ['█  █ ', '█  █ ', '█████', '   █ ', '   █ '],
    '5': ['█████', '█    ', '████ ', '    █', '████ '],
    '6': [' ███ ', '█    ', '████ ', '█   █', ' ███ '],
    '7': ['█████', '   █ ', '  █  ', ' █   ', '█    '],
    '8': [' ███ ', '█   █', ' ███ ', '█   █', ' ███ '],
    '9': [' ███ ', '█   █', ' ████', '    █', ' ███ '],
    ' ': ['     ', '     ', '     ', '     ', '     '],
    '!': ['  █  ', '  █  ', '  █  ', '     ', '  █  '],
    '?': [' ███ ', '█   █', '  █  ', '     ', '  █  '],
    '.': ['     ', '     ', '     ', '     ', '  █  '],
    '-': ['     ', '     ', '█████', '     ', '     '],
    '_': ['     ', '     ', '     ', '     ', '█████'],
  };

  constructor(private router: Router) {}

  goBack() { this.router.navigate(['/tools']); }

  generate() {
    if (!this.input.trim()) {
      this.output = '';
      return;
    }

    if (this.input.toLowerCase() === 'hello') {
      this.eggs.trigger('ascii-hello');
    }

    const chars = this.input.toUpperCase().split('');
    const lines: string[] = ['', '', '', '', ''];

    for (const ch of chars) {
      const glyph = this.font[ch] || this.font['?'];
      for (let row = 0; row < 5; row++) {
        lines[row] += (glyph ? glyph[row] : '     ') + ' ';
      }
    }

    this.output = lines.join('\n');
  }

  clearAll() {
    this.input = '';
    this.output = '';
  }

  async copyOutput() {
    if (!this.output || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.output);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {}
  }
}
