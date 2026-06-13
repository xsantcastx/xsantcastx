import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

type SeparatorType = 'hyphen' | 'underscore' | 'dot';

interface SlugVariant {
  label: string;
  separator: string;
  value: string;
  copied: boolean;
}

interface BulkLine {
  original: string;
  slug: string;
  copied: boolean;
}

/** Transliteration map for accented / special characters */
const TRANSLITERATE_MAP: Record<string, string> = {
  'a': 'aàáâãäåāăą',
  'ae': 'æ',
  'c': 'cçćĉċč',
  'd': 'dďđ',
  'e': 'eèéêëēĕėęě',
  'g': 'gĝğġģ',
  'h': 'hĥħ',
  'i': 'iìíîïĩīĭįı',
  'j': 'jĵ',
  'k': 'kķĸ',
  'l': 'lĺļľŀł',
  'n': 'nñńņňŉŋ',
  'o': 'oòóôõöōŏő',
  'oe': 'œ',
  'p': 'pþ',
  'r': 'rŕŗř',
  's': 'sśŝşš',
  'ss': 'ß',
  't': 'tţťŧ',
  'u': 'uùúûüũūŭůűų',
  'w': 'wŵ',
  'y': 'yýÿŷ',
  'z': 'zźżž',
};

@Component({
    selector: 'app-slug-generator',
    templateUrl: './slug-generator.component.html',
    styleUrls: ['./slug-generator.component.css'],
    imports: [FormsModule, ToolsSharedModule, DecimalPipe]
})
export class SlugGeneratorComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Character lookup built from TRANSLITERATE_MAP */
  private readonly charMap: Map<string, string>;

  // ── Options ─────────────────────────────────────────────────────
  separator: SeparatorType = 'hyphen';
  lowercase = true;
  removeSpecial = true;
  transliterate = true;
  maxLength = 0; // 0 = unlimited
  trimTrailing = true;
  bulkMode = false;

  // ── I/O state ───────────────────────────────────────────────────
  textInput = '';
  variants: SlugVariant[] = [];
  bulkLines: BulkLine[] = [];
  allCopied = false;

  constructor(private router: Router) {
    // Build reverse lookup: character -> replacement
    this.charMap = new Map<string, string>();
    for (const [replacement, chars] of Object.entries(TRANSLITERATE_MAP)) {
      for (const ch of chars) {
        this.charMap.set(ch, replacement);
      }
    }
  }

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Separator helpers ─────────────────────────────────────────
  get separatorChar(): string {
    switch (this.separator) {
      case 'underscore': return '_';
      case 'dot':        return '.';
      default:           return '-';
    }
  }

  separatorLabel(type: SeparatorType): string {
    switch (type) {
      case 'hyphen':     return 'Hyphen (-)';
      case 'underscore': return 'Underscore (_)';
      case 'dot':        return 'Dot (.)';
    }
  }

  // ── Live processing (debounced 250ms) ──────────────────────────
  onInput() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.process(), 250);
  }

  onOptionChange() {
    this.process();
  }

  private process() {
    if (!this.textInput.trim()) {
      this.variants = [];
      this.bulkLines = [];
      return;
    }

    // Easter egg check
    if (this.textInput.trim().toLowerCase() === 'hello world') {
      this.eggs.trigger('slug-classic');
    }

    if (this.bulkMode) {
      this.processBulk();
    } else {
      this.processSingle();
    }
  }

  private processSingle() {
    const text = this.textInput.trim();
    this.variants = [
      { label: 'kebab-case',  separator: '-', value: this.generateSlug(text, '-'), copied: false },
      { label: 'snake_case',  separator: '_', value: this.generateSlug(text, '_'), copied: false },
      { label: 'dot.case',    separator: '.', value: this.generateSlug(text, '.'), copied: false },
    ];
  }

  private processBulk() {
    const lines = this.textInput.split('\n').filter(l => l.trim());
    this.bulkLines = lines.map(line => ({
      original: line.trim(),
      slug: this.generateSlug(line.trim(), this.separatorChar),
      copied: false,
    }));
  }

  // ── Core slug generation ──────────────────────────────────────
  generateSlug(input: string, sep: string): string {
    let s = input;

    // Transliterate accented characters
    if (this.transliterate) {
      s = this.transliterateStr(s);
    }

    // Lowercase
    if (this.lowercase) {
      s = s.toLowerCase();
    }

    // Remove special characters (keep alphanumeric and spaces)
    if (this.removeSpecial) {
      s = s.replace(/[^\w\s-]/g, '');
    }

    // Replace whitespace and hyphens/underscores/dots with the chosen separator
    s = s.replace(/[\s_\-.]+/g, sep);

    // Trim trailing separators
    if (this.trimTrailing) {
      const escaped = sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      s = s.replace(new RegExp(`^${escaped}+|${escaped}+$`, 'g'), '');
    }

    // Max length
    if (this.maxLength > 0 && s.length > this.maxLength) {
      s = s.substring(0, this.maxLength);
      // Trim trailing separator after truncation
      if (this.trimTrailing) {
        const escaped = sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        s = s.replace(new RegExp(`${escaped}+$`, 'g'), '');
      }
    }

    return s;
  }

  private transliterateStr(input: string): string {
    let result = '';
    for (const ch of input) {
      const lower = ch.toLowerCase();
      const mapped = this.charMap.get(lower);
      if (mapped !== undefined) {
        // Preserve case for single-char replacements
        const replacement = mapped.length === 1 && ch !== lower
          ? mapped.toUpperCase()
          : mapped;
        result += replacement;
      } else {
        result += ch;
      }
    }
    return result;
  }

  // ── Actions ───────────────────────────────────────────────────
  clearAll() {
    this.textInput = '';
    this.variants = [];
    this.bulkLines = [];
    this.allCopied = false;
  }

  loadSample() {
    this.textInput = this.bulkMode
      ? 'My First Blog Post!\nLes Fran\u00e7ais adorent le caf\u00e9\n\u00dcber Cool Feature 2024\nHello World --- Special!!!'
      : 'My Awesome Blog Post \u2014 A Dev\u2019s Journey (2024)';
    this.onInput();
  }

  toggleBulkMode() {
    this.bulkMode = !this.bulkMode;
    this.variants = [];
    this.bulkLines = [];
    if (this.textInput.trim()) this.process();
  }

  // ── Copy logic ────────────────────────────────────────────────
  async copyVariant(variant: SlugVariant) {
    if (!this.isBrowser) return;
    await this.copyText(variant.value);
    variant.copied = true;
    setTimeout(() => (variant.copied = false), 2000);
  }

  async copyBulkLine(line: BulkLine) {
    if (!this.isBrowser) return;
    await this.copyText(line.slug);
    line.copied = true;
    setTimeout(() => (line.copied = false), 2000);
  }

  async copyAllVariants() {
    if (!this.isBrowser) return;
    const text = this.variants.map(v => `${v.label}: ${v.value}`).join('\n');
    await this.copyText(text);
    this.allCopied = true;
    setTimeout(() => (this.allCopied = false), 2000);
  }

  async copyAllBulk() {
    if (!this.isBrowser) return;
    const text = this.bulkLines.map(l => l.slug).join('\n');
    await this.copyText(text);
    this.allCopied = true;
    setTimeout(() => (this.allCopied = false), 2000);
  }

  private async copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      this.fallbackCopy(text);
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
  }
}
