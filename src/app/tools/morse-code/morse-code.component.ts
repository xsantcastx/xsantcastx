import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

type ToolMode = 'encode' | 'decode';

/** Morse code lookup: A-Z, 0-9, common punctuation */
const CHAR_TO_MORSE: Record<string, string> = {
  'A': '.-',     'B': '-...',   'C': '-.-.',   'D': '-..',
  'E': '.',      'F': '..-.',   'G': '--.',    'H': '....',
  'I': '..',     'J': '.---',   'K': '-.-',    'L': '.-..',
  'M': '--',     'N': '-.',     'O': '---',    'P': '.--.',
  'Q': '--.-',   'R': '.-.',    'S': '...',    'T': '-',
  'U': '..-',    'V': '...-',   'W': '.--',    'X': '-..-',
  'Y': '-.--',   'Z': '--..',
  '0': '-----',  '1': '.----',  '2': '..---',  '3': '...--',
  '4': '....-',  '5': '.....',  '6': '-....',  '7': '--...',
  '8': '---..',  '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.',
  '!': '-.-.--', '/': '-..-.',  '(': '-.--.',  ')': '-.--.-',
  '&': '.-...',  ':': '---...', ';': '-.-.-.', '=': '-...-',
  '+': '.-.-.',  '-': '-....-', '_': '..--.-', '"': '.-..-.',
  '$': '...-..-','@': '.--.-.',
};

/** Reverse lookup: morse -> char */
const MORSE_TO_CHAR: Record<string, string> = {};
for (const [char, morse] of Object.entries(CHAR_TO_MORSE)) {
  MORSE_TO_CHAR[morse] = char;
}

/** Reference table rows */
interface MorseRef {
  char: string;
  morse: string;
}

@Component({
  selector: 'app-morse-code',
  templateUrl: './morse-code.component.html',
  styleUrls: ['./morse-code.component.css'],
  standalone: false
})
export class MorseCodeComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private audioCtx: AudioContext | null = null;
  private isPlaying = false;
  private stopRequested = false;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Morse Code Translator — encode, decode, and play audio. No sign-up required.')}&url=${encodeURIComponent(SITE_URL + '/tools/morse-code')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/morse-code')}`;

  // Mode
  mode: ToolMode = 'encode';

  // I/O
  textInput = '';
  output = '';

  // UI state
  errorMessage = '';
  copied = false;
  inputCharCount = 0;
  outputCharCount = 0;

  // Audio
  wpm = 20;
  playing = false;

  // Visual
  visualSymbols: Array<{ type: 'dot' | 'dash' | 'space' | 'word-space'; active: boolean }> = [];
  activeSymbolIndex = -1;

  // Reference table
  showReference = false;
  referenceTable: MorseRef[] = Object.entries(CHAR_TO_MORSE).map(([char, morse]) => ({ char, morse }));
  refFilter = '';

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.stopAudio();
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Mode ──────────────────────────────────────────────────────

  setMode(m: ToolMode) {
    this.mode = m;
    this.clearAll();
  }

  // ── Live processing (debounced 300ms) ─────────────────────────

  onInput() {
    this.inputCharCount = this.textInput.length;
    this.errorMessage = '';

    if (!this.textInput.trim()) {
      this.output = '';
      this.outputCharCount = 0;
      this.visualSymbols = [];
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.processText(), 300);
  }

  private processText() {
    if (this.mode === 'encode') {
      this.encodeText(this.textInput);
    } else {
      this.decodeText(this.textInput);
    }
  }

  // ── Encode (text -> morse) ────────────────────────────────────

  private encodeText(input: string) {
    try {
      const upper = input.toUpperCase();
      const words = upper.split(/\s+/);
      const morseWords: string[] = [];
      let hasInvalid = false;

      for (const word of words) {
        const morseChars: string[] = [];
        for (const ch of word) {
          const m = CHAR_TO_MORSE[ch];
          if (m) {
            morseChars.push(m);
          } else {
            hasInvalid = true;
          }
        }
        if (morseChars.length) morseWords.push(morseChars.join(' '));
      }

      const result = morseWords.join(' / ');
      this.output = result;
      this.outputCharCount = result.length;
      this.buildVisualSymbols(result);
      this.errorMessage = hasInvalid ? 'Some characters were skipped (unsupported).' : '';

      // Easter egg: SOS
      if (input.trim().toUpperCase() === 'SOS') {
        this.eggs.trigger('morse-sos');
      }
    } catch {
      this.output = '';
      this.outputCharCount = 0;
      this.visualSymbols = [];
      this.errorMessage = 'Encoding failed.';
    }
  }

  // ── Decode (morse -> text) ────────────────────────────────────

  private decodeText(input: string) {
    try {
      const trimmed = input.trim();
      // Words separated by " / " or "/"
      const words = trimmed.split(/\s*\/\s*/);
      const textWords: string[] = [];
      let hasInvalid = false;

      for (const word of words) {
        const codes = word.trim().split(/\s+/);
        let decoded = '';
        for (const code of codes) {
          if (!code) continue;
          const ch = MORSE_TO_CHAR[code];
          if (ch) {
            decoded += ch;
          } else {
            hasInvalid = true;
            decoded += '\uFFFD';
          }
        }
        if (decoded) textWords.push(decoded);
      }

      const result = textWords.join(' ');
      this.output = result;
      this.outputCharCount = result.length;
      this.buildVisualSymbols(input);
      this.errorMessage = hasInvalid ? 'Some codes were not recognized.' : '';

      // Easter egg: decoded SOS
      if (result.trim().toUpperCase() === 'SOS') {
        this.eggs.trigger('morse-sos');
      }
    } catch {
      this.output = '';
      this.outputCharCount = 0;
      this.visualSymbols = [];
      this.errorMessage = 'Decoding failed.';
    }
  }

  // ── Visual symbols ────────────────────────────────────────────

  private buildVisualSymbols(morseStr: string) {
    this.visualSymbols = [];
    this.activeSymbolIndex = -1;

    for (const part of morseStr) {
      if (part === '.') {
        this.visualSymbols.push({ type: 'dot', active: false });
      } else if (part === '-') {
        this.visualSymbols.push({ type: 'dash', active: false });
      } else if (part === '/') {
        this.visualSymbols.push({ type: 'word-space', active: false });
      } else if (part === ' ') {
        this.visualSymbols.push({ type: 'space', active: false });
      }
    }
  }

  // ── Audio playback (Web Audio API) ────────────────────────────

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioCtx;
  }

  /** Timing based on WPM: "PARIS" = 50 units per word */
  private get dotDuration(): number {
    return 1.2 / this.wpm; // seconds
  }

  async playAudio() {
    if (!this.isBrowser || this.playing) return;

    const morseStr = this.mode === 'encode' ? this.output : this.getMorseForInput();
    if (!morseStr) return;

    this.playing = true;
    this.stopRequested = false;

    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const dot = this.dotDuration;
    const dash = dot * 3;
    const symbolGap = dot;
    const charGap = dot * 3;
    const wordGap = dot * 7;
    const freq = 600; // Hz

    let symbolIdx = 0;

    for (let i = 0; i < morseStr.length; i++) {
      if (this.stopRequested) break;

      const ch = morseStr[i];

      if (ch === '.') {
        this.highlightSymbol(symbolIdx++);
        await this.playTone(ctx, freq, dot);
        await this.silence(symbolGap);
      } else if (ch === '-') {
        this.highlightSymbol(symbolIdx++);
        await this.playTone(ctx, freq, dash);
        await this.silence(symbolGap);
      } else if (ch === '/') {
        symbolIdx++; // word-space symbol
        await this.silence(wordGap - charGap);
      } else if (ch === ' ') {
        symbolIdx++; // char space
        await this.silence(charGap - symbolGap);
      }
    }

    this.playing = false;
    this.activeSymbolIndex = -1;
    this.resetSymbolHighlights();
  }

  stopAudio() {
    this.stopRequested = true;
    this.playing = false;
    this.activeSymbolIndex = -1;
    this.resetSymbolHighlights();
  }

  private getMorseForInput(): string {
    // When in decode mode, the input IS morse
    const trimmed = this.textInput.trim();
    if (this.mode === 'decode') return trimmed;

    // When in encode mode, convert input to morse
    const upper = this.textInput.toUpperCase();
    const words = upper.split(/\s+/);
    const morseWords: string[] = [];
    for (const word of words) {
      const morseChars: string[] = [];
      for (const ch of word) {
        const m = CHAR_TO_MORSE[ch];
        if (m) morseChars.push(m);
      }
      if (morseChars.length) morseWords.push(morseChars.join(' '));
    }
    return morseWords.join(' / ');
  }

  private playTone(ctx: AudioContext, freq: number, duration: number): Promise<void> {
    return new Promise(resolve => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      // Smooth envelope to avoid clicks
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.005);
      gain.gain.setValueAtTime(0.5, ctx.currentTime + duration - 0.005);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
        resolve();
      };
    });
  }

  private silence(duration: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration * 1000));
  }

  private highlightSymbol(index: number) {
    this.resetSymbolHighlights();
    this.activeSymbolIndex = index;
    if (index >= 0 && index < this.visualSymbols.length) {
      this.visualSymbols[index].active = true;
    }
  }

  private resetSymbolHighlights() {
    for (const s of this.visualSymbols) {
      s.active = false;
    }
  }

  // ── Actions ───────────────────────────────────────────────────

  clearAll() {
    this.textInput = '';
    this.output = '';
    this.errorMessage = '';
    this.inputCharCount = 0;
    this.outputCharCount = 0;
    this.visualSymbols = [];
    this.activeSymbolIndex = -1;
    this.stopAudio();
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
      this.textInput = 'HELLO WORLD';
    } else {
      this.textInput = '.... . .-.. .-.. --- / .-- --- .-. .-.. -..';
    }
    this.onInput();
  }

  swapInputOutput() {
    if (!this.output) return;
    const newMode: ToolMode = this.mode === 'encode' ? 'decode' : 'encode';
    const newInput = this.output;
    this.mode = newMode;
    this.textInput = newInput;
    this.onInput();
  }

  toggleReference() {
    this.showReference = !this.showReference;
  }

  get filteredReference(): MorseRef[] {
    if (!this.refFilter.trim()) return this.referenceTable;
    const q = this.refFilter.toUpperCase().trim();
    return this.referenceTable.filter(r =>
      r.char.includes(q) || r.morse.includes(q)
    );
  }

  // ── Helpers ───────────────────────────────────────────────────

  formatWpm(): string {
    return `${this.wpm} WPM`;
  }
}
