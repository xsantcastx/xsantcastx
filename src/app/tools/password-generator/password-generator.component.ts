import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

type StrengthLevel = 'weak' | 'fair' | 'strong' | 'very strong';
type GeneratorMode = 'random' | 'passphrase';

// Word list for passphrase generation (common, easy-to-type words)
const PASSPHRASE_WORDS: string[] = [
  'alpha', 'blaze', 'cedar', 'delta', 'ember', 'frost', 'glyph', 'haven',
  'ivory', 'jewel', 'karma', 'lunar', 'maple', 'nexus', 'omega', 'prism',
  'quartz', 'raven', 'solar', 'topaz', 'ultra', 'vivid', 'warp', 'xenon',
  'yield', 'zephyr', 'anvil', 'brisk', 'crypt', 'drift', 'epoch', 'flint',
  'grain', 'helix', 'index', 'joust', 'knack', 'logic', 'marsh', 'noble',
  'orbit', 'plume', 'quest', 'ridge', 'storm', 'torch', 'umbra', 'vault',
  'whisk', 'axiom', 'badge', 'clash', 'dusk', 'fable', 'glint', 'haste',
  'irony', 'jinx', 'kite', 'latch', 'mirth', 'notch', 'oasis', 'pixel',
  'quirk', 'rustic', 'slate', 'thorn', 'unity', 'vigor', 'wield', 'yacht',
  'zinc', 'acorn', 'birch', 'crisp', 'dune', 'forge', 'grail', 'heron',
  'ingot', 'jolt', 'kelp', 'lyric', 'mocha', 'niche', 'onyx', 'pyre',
  'quill', 'rowan', 'sigil', 'trove', 'usher', 'verge', 'wraith', 'zenith',
  'amber', 'basil', 'coral', 'dawn', 'echo', 'fern', 'gleam', 'husk',
  'jade', 'knot', 'lumen', 'moss', 'nova', 'oak', 'peak', 'realm',
  'silk', 'tide', 'vine', 'weave', 'axis', 'bolt', 'cove', 'dew',
  'flux', 'grit', 'helm', 'isle', 'jest', 'keen', 'lore', 'mist'
];

@Component({
    selector: 'app-password-generator',
    templateUrl: './password-generator.component.html',
    styleUrls: ['./password-generator.component.css'],
    imports: [ToolsSharedModule, FormsModule, DecimalPipe]
})
export class PasswordGeneratorComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Secure String Generator — cryptographic randomness, strength meter, passphrase mode. No sign-up required!')}&url=${encodeURIComponent(SITE_URL + '/tools/password-generator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/password-generator')}`;

  // Generator mode
  mode: GeneratorMode = 'random';

  // Random string options
  length = 16;
  useUppercase = true;
  useLowercase = true;
  useNumbers = true;
  useSymbols = true;
  excludeAmbiguous = false;
  quantity = 1;

  // Passphrase options
  wordCount = 4;
  passphraseSeparator = '-';

  // Output
  generatedStrings: string[] = [];
  copied = false;
  copiedIndex: number | null = null;

  // Char sets
  private readonly UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  private readonly LOWER = 'abcdefghijklmnopqrstuvwxyz';
  private readonly NUMBERS = '0123456789';
  private readonly SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  private readonly AMBIGUOUS = '0O1lI';

  constructor(private router: Router) {}

  ngOnDestroy() {}

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Mode ────────────────────────────────────────────────────────────────

  setMode(m: GeneratorMode) {
    this.mode = m;
    this.generatedStrings = [];
    this.copied = false;
    this.copiedIndex = null;
  }

  // ── Length slider ───────────────────────────────────────────────────────

  onLengthChange() {
    if (this.length < 8) this.length = 8;
    if (this.length > 128) this.length = 128;

    // Easter egg: length exactly 1 (via direct input)
    if (this.length === 1) {
      this.eggs.trigger('pw-one-char');
      this.length = 1; // allow it for the egg
    }
  }

  onLengthInput(event: Event) {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) {
      this.length = val;
      if (this.length === 1) {
        this.eggs.trigger('pw-one-char');
      }
    }
  }

  onQuantityChange() {
    if (this.quantity < 1) this.quantity = 1;
    if (this.quantity > 10) this.quantity = 10;
  }

  onWordCountChange() {
    if (this.wordCount < 2) this.wordCount = 2;
    if (this.wordCount > 10) this.wordCount = 10;
  }

  // ── Generation ──────────────────────────────────────────────────────────

  generate() {
    if (!this.isBrowser) return;

    const count = Math.max(1, Math.min(10, this.quantity || 1));
    this.generatedStrings = [];

    for (let i = 0; i < count; i++) {
      if (this.mode === 'passphrase') {
        this.generatedStrings.push(this.generatePassphrase());
      } else {
        this.generatedStrings.push(this.generateRandomString());
      }
    }

    this.copied = false;
    this.copiedIndex = null;
  }

  private generateRandomString(): string {
    let charset = '';
    if (this.useUppercase) charset += this.UPPER;
    if (this.useLowercase) charset += this.LOWER;
    if (this.useNumbers) charset += this.NUMBERS;
    if (this.useSymbols) charset += this.SYMBOLS;

    // Fallback: if nothing selected, use lowercase
    if (!charset) charset = this.LOWER;

    if (this.excludeAmbiguous) {
      charset = charset.split('').filter(c => !this.AMBIGUOUS.includes(c)).join('');
    }

    const len = Math.max(1, Math.min(128, this.length || 16));
    const array = new Uint32Array(len);
    crypto.getRandomValues(array);

    let result = '';
    for (let i = 0; i < len; i++) {
      result += charset[array[i] % charset.length];
    }
    return result;
  }

  private generatePassphrase(): string {
    const count = Math.max(2, Math.min(10, this.wordCount || 4));
    const words: string[] = [];
    const array = new Uint32Array(count);
    crypto.getRandomValues(array);

    for (let i = 0; i < count; i++) {
      words.push(PASSPHRASE_WORDS[array[i] % PASSPHRASE_WORDS.length]);
    }
    return words.join(this.passphraseSeparator);
  }

  // ── Strength calculation ────────────────────────────────────────────────

  get entropy(): number {
    if (this.mode === 'passphrase') {
      // Entropy = wordCount * log2(poolSize)
      return this.wordCount * Math.log2(PASSPHRASE_WORDS.length);
    }

    let poolSize = 0;
    if (this.useUppercase) poolSize += this.excludeAmbiguous ? 25 : 26; // minus I
    if (this.useLowercase) poolSize += this.excludeAmbiguous ? 25 : 26; // minus l
    if (this.useNumbers) poolSize += this.excludeAmbiguous ? 8 : 10;    // minus 0,1
    if (this.useSymbols) poolSize += this.SYMBOLS.length;

    if (poolSize === 0) poolSize = 26; // fallback lowercase

    return this.length * Math.log2(poolSize);
  }

  get strengthLevel(): StrengthLevel {
    const e = this.entropy;
    if (e < 36) return 'weak';
    if (e < 60) return 'fair';
    if (e < 100) return 'strong';
    return 'very strong';
  }

  get strengthPercent(): number {
    // Map entropy to 0-100 visual range, capping at 128 bits
    return Math.min(100, (this.entropy / 128) * 100);
  }

  get strengthColor(): string {
    switch (this.strengthLevel) {
      case 'weak': return '#ff4d6a';
      case 'fair': return '#ffaa2a';
      case 'strong': return '#00cc88';
      case 'very strong': return '#00ffcc';
    }
  }

  // ── Copy Actions ────────────────────────────────────────────────────────

  async copySingle(index: number) {
    if (!this.isBrowser) return;
    const text = this.generatedStrings[index];
    try {
      await navigator.clipboard.writeText(text);
      this.copiedIndex = index;
      setTimeout(() => (this.copiedIndex = null), 2000);
    } catch {
      this.fallbackCopy(text);
      this.copiedIndex = index;
      setTimeout(() => (this.copiedIndex = null), 2000);
    }
  }

  async copyAll() {
    if (!this.isBrowser || !this.generatedStrings.length) return;
    const text = this.generatedStrings.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(text);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
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

  clearAll() {
    this.generatedStrings = [];
    this.copied = false;
    this.copiedIndex = null;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  get charsetSummary(): string {
    const parts: string[] = [];
    if (this.useUppercase) parts.push('A-Z');
    if (this.useLowercase) parts.push('a-z');
    if (this.useNumbers) parts.push('0-9');
    if (this.useSymbols) parts.push('!@#');
    return parts.join(' ') || 'none';
  }

  get poolSize(): number {
    if (this.mode === 'passphrase') return PASSPHRASE_WORDS.length;
    let size = 0;
    if (this.useUppercase) size += this.excludeAmbiguous ? 25 : 26;
    if (this.useLowercase) size += this.excludeAmbiguous ? 25 : 26;
    if (this.useNumbers) size += this.excludeAmbiguous ? 8 : 10;
    if (this.useSymbols) size += this.SYMBOLS.length;
    return size || 26;
  }
}
