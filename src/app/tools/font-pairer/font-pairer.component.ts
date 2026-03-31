import { Component, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';

type StyleCategory = 'all' | 'modern' | 'classic' | 'playful' | 'minimal' | 'bold';
type PreviewContext = 'hero' | 'article' | 'card';

interface FontPairing {
  id: number;
  name: string;
  category: StyleCategory;
  heading: string;
  body: string;
  headingWeight: number;
  bodyWeight: number;
}

@Component({
  selector: 'app-font-pairer',
  templateUrl: './font-pairer.component.html',
  styleUrls: ['./font-pairer.component.css'],
  standalone: false
})
export class FontPairerComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly pairings: FontPairing[] = [
    { id: 1, name: 'Tech Forward', category: 'modern', heading: 'Space Grotesk', body: 'Inter', headingWeight: 700, bodyWeight: 400 },
    { id: 2, name: 'Editorial Elegance', category: 'classic', heading: 'Playfair Display', body: 'Source Serif 4', headingWeight: 700, bodyWeight: 400 },
    { id: 3, name: 'Clean & Sharp', category: 'minimal', heading: 'Outfit', body: 'Work Sans', headingWeight: 600, bodyWeight: 400 },
    { id: 4, name: 'Friendly Voice', category: 'playful', heading: 'Fredoka', body: 'Nunito', headingWeight: 600, bodyWeight: 400 },
    { id: 5, name: 'Bold Statement', category: 'bold', heading: 'Archivo Black', body: 'Roboto', headingWeight: 400, bodyWeight: 400 },
    { id: 6, name: 'Swiss Precision', category: 'minimal', heading: 'DM Sans', body: 'IBM Plex Sans', headingWeight: 700, bodyWeight: 400 },
    { id: 7, name: 'Luxury Brand', category: 'classic', heading: 'Cormorant Garamond', body: 'Lato', headingWeight: 700, bodyWeight: 400 },
    { id: 8, name: 'Startup Vibes', category: 'modern', heading: 'Plus Jakarta Sans', body: 'Inter', headingWeight: 700, bodyWeight: 400 },
    { id: 9, name: 'Fun & Bubbly', category: 'playful', heading: 'Baloo 2', body: 'Quicksand', headingWeight: 700, bodyWeight: 500 },
    { id: 10, name: 'Impact Header', category: 'bold', heading: 'Bebas Neue', body: 'Open Sans', headingWeight: 400, bodyWeight: 400 },
    { id: 11, name: 'Geometric Duo', category: 'modern', heading: 'Poppins', body: 'Karla', headingWeight: 700, bodyWeight: 400 },
    { id: 12, name: 'Heritage Serif', category: 'classic', heading: 'Libre Baskerville', body: 'Merriweather', headingWeight: 700, bodyWeight: 300 },
    { id: 13, name: 'Whisper Soft', category: 'minimal', heading: 'Jost', body: 'Rubik', headingWeight: 500, bodyWeight: 400 },
    { id: 14, name: 'Rounded Joy', category: 'playful', heading: 'Comfortaa', body: 'Varela Round', headingWeight: 700, bodyWeight: 400 },
    { id: 15, name: 'Ultra Heavy', category: 'bold', heading: 'Oswald', body: 'Raleway', headingWeight: 700, bodyWeight: 400 },
    { id: 16, name: 'Neo Grotesque', category: 'modern', heading: 'Sora', body: 'Outfit', headingWeight: 700, bodyWeight: 400 },
    { id: 17, name: 'Old World', category: 'classic', heading: 'EB Garamond', body: 'Crimson Text', headingWeight: 700, bodyWeight: 400 },
    { id: 18, name: 'Airy Minimal', category: 'minimal', heading: 'Manrope', body: 'Figtree', headingWeight: 700, bodyWeight: 400 },
  ];

  readonly categories: { value: StyleCategory; label: string }[] = [
    { value: 'all', label: 'All Styles' },
    { value: 'modern', label: 'Modern' },
    { value: 'classic', label: 'Classic' },
    { value: 'playful', label: 'Playful' },
    { value: 'minimal', label: 'Minimal' },
    { value: 'bold', label: 'Bold' },
  ];

  activeCategory: StyleCategory = 'all';
  activePairing: FontPairing;
  previewContext: PreviewContext = 'hero';

  headingText = 'The quick brown fox jumps over the lazy dog';
  bodyText = 'Typography is the art and technique of arranging type to make written language legible, readable, and appealing when displayed. The arrangement of type involves selecting typefaces, point sizes, line lengths, line spacing, and letter spacing.';

  headingSize = 48;
  bodySize = 16;
  headingLineHeight = 1.2;
  bodyLineHeight = 1.7;
  headingLetterSpacing = 0;
  bodyLetterSpacing = 0;
  headingWeight = 700;
  bodyWeight = 400;

  cssCopied = false;
  linkCopied = false;

  private loadedFonts = new Set<string>();

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Font Pairer Tool — discover beautiful font combinations with live preview and one-click code copy')}&url=${encodeURIComponent(SITE_URL + '/tools/font-pairer')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/font-pairer')}`;

  constructor(private router: Router, private translationService: TranslationService) {
    this.activePairing = this.pairings[0];
    this.applyPairing(this.activePairing);
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    document.querySelectorAll('link[data-font-pairer]').forEach(el => el.remove());
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  get filteredPairings(): FontPairing[] {
    if (this.activeCategory === 'all') return this.pairings;
    return this.pairings.filter(p => p.category === this.activeCategory);
  }

  selectCategory(cat: StyleCategory): void {
    this.activeCategory = cat;
  }

  selectPairing(pairing: FontPairing): void {
    this.activePairing = pairing;
    this.applyPairing(pairing);
  }

  applyPairing(pairing: FontPairing): void {
    this.headingWeight = pairing.headingWeight;
    this.bodyWeight = pairing.bodyWeight;
    this.loadFont(pairing.heading, [pairing.headingWeight]);
    this.loadFont(pairing.body, [pairing.bodyWeight, 400, 700]);
  }

  shufflePairing(): void {
    const available = this.filteredPairings;
    if (available.length <= 1) return;
    let next: FontPairing;
    do {
      next = available[Math.floor(Math.random() * available.length)];
    } while (next.id === this.activePairing.id && available.length > 1);
    this.selectPairing(next);
  }

  private loadFont(family: string, weights: number[]): void {
    if (!this.isBrowser) return;
    const key = `${family}:${weights.sort().join(',')}`;
    if (this.loadedFonts.has(key)) return;
    this.loadedFonts.add(key);

    const weightsStr = weights.map(w => `wght@${w}`).join(';');
    const familyParam = family.replace(/ /g, '+');
    const url = `https://fonts.googleapis.com/css2?family=${familyParam}:${weightsStr}&display=swap`;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute('data-font-pairer', 'true');
    document.head.appendChild(link);
  }

  setPreviewContext(ctx: PreviewContext): void {
    this.previewContext = ctx;
  }

  updateHeadingSize(event: Event): void {
    this.headingSize = parseInt((event.target as HTMLInputElement).value, 10);
  }

  updateBodySize(event: Event): void {
    this.bodySize = parseInt((event.target as HTMLInputElement).value, 10);
  }

  updateHeadingLineHeight(event: Event): void {
    this.headingLineHeight = parseFloat((event.target as HTMLInputElement).value);
  }

  updateBodyLineHeight(event: Event): void {
    this.bodyLineHeight = parseFloat((event.target as HTMLInputElement).value);
  }

  updateHeadingLetterSpacing(event: Event): void {
    this.headingLetterSpacing = parseFloat((event.target as HTMLInputElement).value);
  }

  updateBodyLetterSpacing(event: Event): void {
    this.bodyLetterSpacing = parseFloat((event.target as HTMLInputElement).value);
  }

  updateHeadingWeight(event: Event): void {
    this.headingWeight = parseInt((event.target as HTMLInputElement).value, 10);
  }

  updateBodyWeight(event: Event): void {
    this.bodyWeight = parseInt((event.target as HTMLInputElement).value, 10);
  }

  get headingStyle(): { [key: string]: string } {
    return {
      'font-family': `'${this.activePairing.heading}', sans-serif`,
      'font-size': `${this.headingSize}px`,
      'font-weight': `${this.headingWeight}`,
      'line-height': `${this.headingLineHeight}`,
      'letter-spacing': `${this.headingLetterSpacing}em`,
    };
  }

  get bodyStyle(): { [key: string]: string } {
    return {
      'font-family': `'${this.activePairing.body}', sans-serif`,
      'font-size': `${this.bodySize}px`,
      'font-weight': `${this.bodyWeight}`,
      'line-height': `${this.bodyLineHeight}`,
      'letter-spacing': `${this.bodyLetterSpacing}em`,
    };
  }

  get cssCode(): string {
    return `/* Heading: ${this.activePairing.heading} */
h1, h2, h3 {
  font-family: '${this.activePairing.heading}', sans-serif;
  font-weight: ${this.headingWeight};
  font-size: ${this.headingSize}px;
  line-height: ${this.headingLineHeight};
  letter-spacing: ${this.headingLetterSpacing}em;
}

/* Body: ${this.activePairing.body} */
body, p {
  font-family: '${this.activePairing.body}', sans-serif;
  font-weight: ${this.bodyWeight};
  font-size: ${this.bodySize}px;
  line-height: ${this.bodyLineHeight};
  letter-spacing: ${this.bodyLetterSpacing}em;
}`;
  }

  get googleFontsLink(): string {
    const hFamily = this.activePairing.heading.replace(/ /g, '+');
    const bFamily = this.activePairing.body.replace(/ /g, '+');
    const hWeights = `wght@${this.headingWeight}`;
    const bWeights = `wght@${this.bodyWeight};wght@400;wght@700`;
    return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${hFamily}:${hWeights}&family=${bFamily}:${bWeights}&display=swap" rel="stylesheet">`;
  }

  copyCSS(): void {
    navigator.clipboard.writeText(this.cssCode).then(() => {
      this.cssCopied = true;
      setTimeout(() => { this.cssCopied = false; }, 1500);
    });
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.googleFontsLink).then(() => {
      this.linkCopied = true;
      setTimeout(() => { this.linkCopied = false; }, 1500);
    });
  }

  trackByPairingId(index: number, pairing: FontPairing): number {
    return pairing.id;
  }

  trackByCategoryValue(index: number, cat: { value: StyleCategory; label: string }): string {
    return cat.value;
  }
}
