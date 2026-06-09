import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { SITE_URL } from '../../seo.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

type ToolMode = 'encode' | 'decode';

interface HtmlEntity {
  char: string;
  named: string;
  numeric: string;
  description: string;
}

@Component({
    selector: 'app-html-entities',
    templateUrl: './html-entities.component.html',
    styleUrls: ['./html-entities.component.css'],
    imports: [ToolsSharedModule, FormsModule, DecimalPipe]
})
export class HtmlEntitiesComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free HTML Entity Encoder & Decoder — encode special characters, decode entities instantly. No sign-up required!')}&url=${encodeURIComponent(SITE_URL + '/tools/html-entities')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/html-entities')}`;

  // Mode
  mode: ToolMode = 'encode';

  // Text I/O
  textInput = '';
  output = '';

  // UI state
  errorMessage = '';
  copied = false;
  inputCharCount = 0;
  outputCharCount = 0;
  entitiesConverted = 0;

  // Reference table
  referenceSearch = '';

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Named entity maps ─────────────────────────────────────────────────────

  private readonly encodeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
    '\u00A0': '&nbsp;',
    '\u00A9': '&copy;',
    '\u00AE': '&reg;',
    '\u2122': '&trade;',
    '\u00B0': '&deg;',
    '\u00B1': '&plusmn;',
    '\u00D7': '&times;',
    '\u00F7': '&divide;',
    '\u2260': '&ne;',
    '\u2264': '&le;',
    '\u2265': '&ge;',
    '\u2190': '&larr;',
    '\u2191': '&uarr;',
    '\u2192': '&rarr;',
    '\u2193': '&darr;',
    '\u2194': '&harr;',
    '\u2026': '&hellip;',
    '\u2013': '&ndash;',
    '\u2014': '&mdash;',
    '\u2018': '&lsquo;',
    '\u2019': '&rsquo;',
    '\u201C': '&ldquo;',
    '\u201D': '&rdquo;',
    '\u2022': '&bull;',
    '\u20AC': '&euro;',
    '\u00A3': '&pound;',
    '\u00A5': '&yen;',
    '\u00A2': '&cent;',
    '\u00BC': '&frac14;',
    '\u00BD': '&frac12;',
    '\u00BE': '&frac34;',
    '\u00B2': '&sup2;',
    '\u00B3': '&sup3;',
    '\u00B9': '&sup1;',
    '\u00B5': '&micro;',
    '\u00B6': '&para;',
    '\u00A7': '&sect;',
    '\u2020': '&dagger;',
    '\u2021': '&Dagger;',
    '\u2030': '&permil;',
    '\u221E': '&infin;',
    '\u221A': '&radic;',
    '\u2211': '&sum;',
    '\u220F': '&prod;',
    '\u222B': '&int;',
    '\u2248': '&asymp;',
    '\u2261': '&equiv;',
    '\u2205': '&empty;',
    '\u2229': '&cap;',
    '\u222A': '&cup;',
    '\u2282': '&sub;',
    '\u2283': '&sup;',
    '\u00AC': '&not;',
    '\u2227': '&and;',
    '\u2228': '&or;',
    '\u2203': '&exist;',
    '\u2200': '&forall;',
    '\u03B1': '&alpha;',
    '\u03B2': '&beta;',
    '\u03B3': '&gamma;',
    '\u03B4': '&delta;',
    '\u03C0': '&pi;',
    '\u03A9': '&Omega;',
    '\u2660': '&spades;',
    '\u2663': '&clubs;',
    '\u2665': '&hearts;',
    '\u2666': '&diams;',
  };

  private readonly decodeMap: Record<string, string> = (() => {
    const map: Record<string, string> = {};
    for (const [char, entity] of Object.entries(this.encodeMap)) {
      map[entity] = char;
    }
    return map;
  })();

  readonly referenceEntities: HtmlEntity[] = [
    { char: '&', named: '&amp;', numeric: '&#38;', description: 'Ampersand' },
    { char: '<', named: '&lt;', numeric: '&#60;', description: 'Less than' },
    { char: '>', named: '&gt;', numeric: '&#62;', description: 'Greater than' },
    { char: '"', named: '&quot;', numeric: '&#34;', description: 'Double quote' },
    { char: "'", named: '&apos;', numeric: '&#39;', description: 'Apostrophe / single quote' },
    { char: '\u00A0', named: '&nbsp;', numeric: '&#160;', description: 'Non-breaking space' },
    { char: '\u00A9', named: '&copy;', numeric: '&#169;', description: 'Copyright' },
    { char: '\u00AE', named: '&reg;', numeric: '&#174;', description: 'Registered trademark' },
    { char: '\u2122', named: '&trade;', numeric: '&#8482;', description: 'Trademark' },
    { char: '\u00B0', named: '&deg;', numeric: '&#176;', description: 'Degree' },
    { char: '\u00B1', named: '&plusmn;', numeric: '&#177;', description: 'Plus-minus' },
    { char: '\u00D7', named: '&times;', numeric: '&#215;', description: 'Multiplication' },
    { char: '\u00F7', named: '&divide;', numeric: '&#247;', description: 'Division' },
    { char: '\u2260', named: '&ne;', numeric: '&#8800;', description: 'Not equal' },
    { char: '\u2264', named: '&le;', numeric: '&#8804;', description: 'Less than or equal' },
    { char: '\u2265', named: '&ge;', numeric: '&#8805;', description: 'Greater than or equal' },
    { char: '\u2190', named: '&larr;', numeric: '&#8592;', description: 'Left arrow' },
    { char: '\u2191', named: '&uarr;', numeric: '&#8593;', description: 'Up arrow' },
    { char: '\u2192', named: '&rarr;', numeric: '&#8594;', description: 'Right arrow' },
    { char: '\u2193', named: '&darr;', numeric: '&#8595;', description: 'Down arrow' },
    { char: '\u2194', named: '&harr;', numeric: '&#8596;', description: 'Left-right arrow' },
    { char: '\u2026', named: '&hellip;', numeric: '&#8230;', description: 'Horizontal ellipsis' },
    { char: '\u2013', named: '&ndash;', numeric: '&#8211;', description: 'En dash' },
    { char: '\u2014', named: '&mdash;', numeric: '&#8212;', description: 'Em dash' },
    { char: '\u2018', named: '&lsquo;', numeric: '&#8216;', description: 'Left single quote' },
    { char: '\u2019', named: '&rsquo;', numeric: '&#8217;', description: 'Right single quote' },
    { char: '\u201C', named: '&ldquo;', numeric: '&#8220;', description: 'Left double quote' },
    { char: '\u201D', named: '&rdquo;', numeric: '&#8221;', description: 'Right double quote' },
    { char: '\u2022', named: '&bull;', numeric: '&#8226;', description: 'Bullet' },
    { char: '\u20AC', named: '&euro;', numeric: '&#8364;', description: 'Euro sign' },
    { char: '\u00A3', named: '&pound;', numeric: '&#163;', description: 'Pound sign' },
    { char: '\u00A5', named: '&yen;', numeric: '&#165;', description: 'Yen sign' },
    { char: '\u00A2', named: '&cent;', numeric: '&#162;', description: 'Cent sign' },
    { char: '\u00BC', named: '&frac14;', numeric: '&#188;', description: 'One quarter' },
    { char: '\u00BD', named: '&frac12;', numeric: '&#189;', description: 'One half' },
    { char: '\u00BE', named: '&frac34;', numeric: '&#190;', description: 'Three quarters' },
    { char: '\u00B2', named: '&sup2;', numeric: '&#178;', description: 'Superscript two' },
    { char: '\u00B3', named: '&sup3;', numeric: '&#179;', description: 'Superscript three' },
    { char: '\u00B9', named: '&sup1;', numeric: '&#185;', description: 'Superscript one' },
    { char: '\u00B5', named: '&micro;', numeric: '&#181;', description: 'Micro sign' },
    { char: '\u00B6', named: '&para;', numeric: '&#182;', description: 'Paragraph / pilcrow' },
    { char: '\u00A7', named: '&sect;', numeric: '&#167;', description: 'Section sign' },
    { char: '\u2020', named: '&dagger;', numeric: '&#8224;', description: 'Dagger' },
    { char: '\u2021', named: '&Dagger;', numeric: '&#8225;', description: 'Double dagger' },
    { char: '\u2030', named: '&permil;', numeric: '&#8240;', description: 'Per mille' },
    { char: '\u221E', named: '&infin;', numeric: '&#8734;', description: 'Infinity' },
    { char: '\u221A', named: '&radic;', numeric: '&#8730;', description: 'Square root' },
    { char: '\u2211', named: '&sum;', numeric: '&#8721;', description: 'Summation' },
    { char: '\u220F', named: '&prod;', numeric: '&#8719;', description: 'Product' },
    { char: '\u222B', named: '&int;', numeric: '&#8747;', description: 'Integral' },
    { char: '\u2248', named: '&asymp;', numeric: '&#8776;', description: 'Almost equal' },
    { char: '\u2261', named: '&equiv;', numeric: '&#8801;', description: 'Identical / equivalent' },
    { char: '\u2205', named: '&empty;', numeric: '&#8709;', description: 'Empty set' },
    { char: '\u2229', named: '&cap;', numeric: '&#8745;', description: 'Intersection' },
    { char: '\u222A', named: '&cup;', numeric: '&#8746;', description: 'Union' },
    { char: '\u2282', named: '&sub;', numeric: '&#8834;', description: 'Subset of' },
    { char: '\u2283', named: '&sup;', numeric: '&#8835;', description: 'Superset of' },
    { char: '\u00AC', named: '&not;', numeric: '&#172;', description: 'Not sign' },
    { char: '\u2227', named: '&and;', numeric: '&#8743;', description: 'Logical AND' },
    { char: '\u2228', named: '&or;', numeric: '&#8744;', description: 'Logical OR' },
    { char: '\u2203', named: '&exist;', numeric: '&#8707;', description: 'There exists' },
    { char: '\u2200', named: '&forall;', numeric: '&#8704;', description: 'For all' },
    { char: '\u03B1', named: '&alpha;', numeric: '&#945;', description: 'Greek alpha' },
    { char: '\u03B2', named: '&beta;', numeric: '&#946;', description: 'Greek beta' },
    { char: '\u03B3', named: '&gamma;', numeric: '&#947;', description: 'Greek gamma' },
    { char: '\u03B4', named: '&delta;', numeric: '&#948;', description: 'Greek delta' },
    { char: '\u03C0', named: '&pi;', numeric: '&#960;', description: 'Greek pi' },
    { char: '\u03A9', named: '&Omega;', numeric: '&#937;', description: 'Greek Omega' },
    { char: '\u2660', named: '&spades;', numeric: '&#9824;', description: 'Spade suit' },
    { char: '\u2663', named: '&clubs;', numeric: '&#9827;', description: 'Club suit' },
    { char: '\u2665', named: '&hearts;', numeric: '&#9829;', description: 'Heart suit' },
    { char: '\u2666', named: '&diams;', numeric: '&#9830;', description: 'Diamond suit' },
  ];

  // ── Mode changes ──────────────────────────────────────────────────────────

  setMode(m: ToolMode) {
    this.mode = m;
    this.clearAll();
  }

  // ── Live processing (debounced 300ms) ─────────────────────────────────────

  onInput() {
    this.inputCharCount = this.textInput.length;
    this.errorMessage = '';

    if (!this.textInput.trim()) {
      this.output = '';
      this.outputCharCount = 0;
      this.entitiesConverted = 0;
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.processText(), 300);
  }

  private processText() {
    // Easter egg: XSS detection
    if (this.textInput.toLowerCase().includes('<script>')) {
      this.eggs.trigger('html-xss');
    }

    if (this.mode === 'encode') {
      this.encodeText(this.textInput);
    } else {
      this.decodeText(this.textInput);
    }
  }

  // ── Encode ────────────────────────────────────────────────────────────────

  private encodeText(input: string) {
    try {
      let count = 0;
      const result = Array.from(input).map(char => {
        if (this.encodeMap[char]) {
          count++;
          return this.encodeMap[char];
        }
        // Encode non-ASCII characters as numeric entities
        const code = char.codePointAt(0)!;
        if (code > 127) {
          count++;
          return `&#${code};`;
        }
        return char;
      }).join('');

      this.output = result;
      this.outputCharCount = result.length;
      this.entitiesConverted = count;
      this.errorMessage = '';
    } catch {
      this.output = '';
      this.outputCharCount = 0;
      this.entitiesConverted = 0;
      this.errorMessage = 'Encoding failed — unexpected error.';
    }
  }

  // ── Decode ────────────────────────────────────────────────────────────────

  private decodeText(input: string) {
    try {
      let count = 0;

      // Decode named entities
      let result = input.replace(/&[a-zA-Z]+;/g, (match) => {
        if (this.decodeMap[match]) {
          count++;
          return this.decodeMap[match];
        }
        // Use a temporary element for other named entities
        if (this.isBrowser) {
          const el = document.createElement('span');
          el.innerHTML = match;
          if (el.textContent !== match) {
            count++;
            return el.textContent || match;
          }
        }
        return match;
      });

      // Decode decimal numeric entities (&#123;)
      result = result.replace(/&#(\d+);/g, (_match, num) => {
        count++;
        return String.fromCodePoint(parseInt(num, 10));
      });

      // Decode hex numeric entities (&#x1F;)
      result = result.replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => {
        count++;
        return String.fromCodePoint(parseInt(hex, 16));
      });

      this.output = result;
      this.outputCharCount = result.length;
      this.entitiesConverted = count;
      this.errorMessage = '';
    } catch {
      this.output = '';
      this.outputCharCount = 0;
      this.entitiesConverted = 0;
      this.errorMessage = 'Decoding failed — input contains invalid entities.';
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  clearAll() {
    this.textInput = '';
    this.output = '';
    this.errorMessage = '';
    this.inputCharCount = 0;
    this.outputCharCount = 0;
    this.entitiesConverted = 0;
  }

  async copyOutput() {
    if (!this.output || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.output);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(this.output);
    }
  }

  private fallbackCopy(text: string) {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    this.copied = true;
    setTimeout(() => (this.copied = false), 2000);
  }

  loadSample() {
    if (this.mode === 'encode') {
      this.textInput = '<div class="hero">\n  <h1>Hello & welcome!</h1>\n  <p>Price: $19.99 — "Best value" for <em>everyone</em></p>\n  <p>Copyright \u00A9 2026 \u2022 All rights reserved\u2122</p>\n</div>';
    } else {
      this.textInput = '&lt;div class=&quot;hero&quot;&gt;\n  &lt;h1&gt;Hello &amp; welcome!&lt;/h1&gt;\n  &lt;p&gt;Price: $19.99 &mdash; &ldquo;Best value&rdquo; for &lt;em&gt;everyone&lt;/em&gt;&lt;/p&gt;\n  &lt;p&gt;Copyright &copy; 2026 &bull; All rights reserved&trade;&lt;/p&gt;\n&lt;/div&gt;';
    }
    this.onInput();
  }

  // ── Reference table filtering ─────────────────────────────────────────────

  get filteredEntities(): HtmlEntity[] {
    if (!this.referenceSearch.trim()) return this.referenceEntities;
    const term = this.referenceSearch.toLowerCase();
    return this.referenceEntities.filter(e =>
      e.char.toLowerCase().includes(term) ||
      e.named.toLowerCase().includes(term) ||
      e.numeric.toLowerCase().includes(term) ||
      e.description.toLowerCase().includes(term)
    );
  }
}
