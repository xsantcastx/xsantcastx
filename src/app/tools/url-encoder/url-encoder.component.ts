import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

type ToolMode = 'encode' | 'decode';
type EncodingScope = 'component' | 'full-url';

interface QueryParam {
  key: string;
  value: string;
}

interface ParsedUrl {
  protocol: string;
  host: string;
  path: string;
  queryParams: QueryParam[];
  fragment: string;
}

@Component({
  selector: 'app-url-encoder',
  templateUrl: './url-encoder.component.html',
  styleUrls: ['./url-encoder.component.css'],
  standalone: false
})
export class UrlEncoderComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free URL Encoder & Decoder — encode/decode URLs, parse components, build query strings. No sign-up')}&url=${encodeURIComponent(SITE_URL + '/tools/url-encoder')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/url-encoder')}`;

  // Mode & options
  mode: ToolMode = 'encode';
  encodingScope: EncodingScope = 'component';

  // Text I/O
  textInput = '';
  output = '';

  // URL parser
  urlToParse = '';
  parsedUrl: ParsedUrl | null = null;
  parseError = '';

  // Query string builder
  queryParams: QueryParam[] = [{ key: '', value: '' }];
  generatedQueryString = '';

  // UI state
  errorMessage = '';
  copied = false;
  copiedParsed = false;
  copiedQuery = false;
  inputCharCount = 0;
  outputCharCount = 0;

  // Active tab
  activeTab: 'encoder' | 'parser' | 'builder' = 'encoder';

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Mode / option changes ──────────────────────────────────────────────────

  setMode(m: ToolMode) {
    this.mode = m;
    this.clearAll();
  }

  setEncodingScope(scope: EncodingScope) {
    this.encodingScope = scope;
    if (this.textInput) this.processText();
  }

  setActiveTab(tab: 'encoder' | 'parser' | 'builder') {
    this.activeTab = tab;
  }

  // ── Live processing (debounced 300ms) ──────────────────────────────────────

  onInput() {
    this.inputCharCount = this.textInput.length;
    this.errorMessage = '';

    if (!this.textInput.trim()) {
      this.output = '';
      this.outputCharCount = 0;
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
    this.checkRickRoll(this.textInput);
  }

  // ── Easter egg ─────────────────────────────────────────────────────────────

  private checkRickRoll(input: string) {
    const lower = input.toLowerCase();
    if (lower.includes('rick') && lower.includes('roll')) {
      this.eggs.trigger('url-rickroll');
    }
  }

  // ── Encode ─────────────────────────────────────────────────────────────────

  private encodeText(input: string) {
    try {
      const result = this.encodingScope === 'component'
        ? encodeURIComponent(input)
        : encodeURI(input);
      this.output = result;
      this.outputCharCount = result.length;
      this.errorMessage = '';
    } catch {
      this.output = '';
      this.outputCharCount = 0;
      this.errorMessage = 'Encoding failed — the input contains invalid characters.';
    }
  }

  // ── Decode ─────────────────────────────────────────────────────────────────

  private decodeText(input: string) {
    try {
      const result = this.encodingScope === 'component'
        ? decodeURIComponent(input)
        : decodeURI(input);
      this.output = result;
      this.outputCharCount = result.length;
      this.errorMessage = '';
      this.checkRickRoll(result);
    } catch {
      this.output = '';
      this.outputCharCount = 0;
      this.errorMessage = 'Invalid encoded string — contains malformed percent-encoding sequences.';
    }
  }

  // ── URL Parser ─────────────────────────────────────────────────────────────

  onParseInput() {
    this.parseError = '';
    this.parsedUrl = null;
    if (!this.urlToParse.trim()) return;

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.parseUrl(), 300);
  }

  private parseUrl() {
    try {
      let urlStr = this.urlToParse.trim();
      // Add protocol if missing for URL constructor
      if (!/^[a-zA-Z]+:\/\//.test(urlStr)) {
        urlStr = 'https://' + urlStr;
      }
      const url = new URL(urlStr);

      const queryParams: QueryParam[] = [];
      url.searchParams.forEach((value, key) => {
        queryParams.push({ key, value });
      });

      this.parsedUrl = {
        protocol: url.protocol.replace(':', ''),
        host: url.host,
        path: url.pathname,
        queryParams,
        fragment: url.hash.replace('#', '')
      };

      this.checkRickRoll(this.urlToParse);
    } catch {
      this.parseError = 'Could not parse URL — ensure it is a valid URL format.';
      this.parsedUrl = null;
    }
  }

  // ── Query String Builder ───────────────────────────────────────────────────

  addParam() {
    this.queryParams.push({ key: '', value: '' });
  }

  removeParam(index: number) {
    if (this.queryParams.length > 1) {
      this.queryParams.splice(index, 1);
      this.buildQueryString();
    }
  }

  buildQueryString() {
    const validParams = this.queryParams.filter(p => p.key.trim());
    if (validParams.length === 0) {
      this.generatedQueryString = '';
      return;
    }

    const parts = validParams.map(p =>
      `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`
    );
    this.generatedQueryString = '?' + parts.join('&');
  }

  onParamChange() {
    this.buildQueryString();
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  clearAll() {
    this.textInput = '';
    this.output = '';
    this.errorMessage = '';
    this.inputCharCount = 0;
    this.outputCharCount = 0;
  }

  clearParser() {
    this.urlToParse = '';
    this.parsedUrl = null;
    this.parseError = '';
  }

  clearBuilder() {
    this.queryParams = [{ key: '', value: '' }];
    this.generatedQueryString = '';
  }

  async copyOutput() {
    if (!this.output || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.output);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(this.output, 'copied');
    }
  }

  async copyParsedUrl() {
    if (!this.parsedUrl || !this.isBrowser) return;
    const text = JSON.stringify(this.parsedUrl, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      this.copiedParsed = true;
      setTimeout(() => (this.copiedParsed = false), 2000);
    } catch {
      this.fallbackCopy(text, 'copiedParsed');
    }
  }

  async copyQueryString() {
    if (!this.generatedQueryString || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.generatedQueryString);
      this.copiedQuery = true;
      setTimeout(() => (this.copiedQuery = false), 2000);
    } catch {
      this.fallbackCopy(this.generatedQueryString, 'copiedQuery');
    }
  }

  private fallbackCopy(text: string, flag: 'copied' | 'copiedParsed' | 'copiedQuery') {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    (this as any)[flag] = true;
    setTimeout(() => ((this as any)[flag] = false), 2000);
  }

  loadSample() {
    if (this.activeTab === 'encoder') {
      if (this.mode === 'encode') {
        this.textInput = this.encodingScope === 'component'
          ? 'Hello World! @#$%^&*() foo=bar&baz=qux'
          : 'https://example.com/path?name=John Doe&city=New York&emoji=@#$';
      } else {
        this.textInput = this.encodingScope === 'component'
          ? 'Hello%20World!%20%40%23%24%25%5E%26*()%20foo%3Dbar%26baz%3Dqux'
          : 'https://example.com/path?name=John%20Doe&city=New%20York&emoji=@%23$';
      }
      this.onInput();
    } else if (this.activeTab === 'parser') {
      this.urlToParse = 'https://www.example.com:8080/api/search?q=hello+world&lang=en&page=1#results';
      this.onParseInput();
    } else {
      this.queryParams = [
        { key: 'q', value: 'hello world' },
        { key: 'lang', value: 'en' },
        { key: 'page', value: '1' },
        { key: 'filter', value: 'name=test&value=foo' }
      ];
      this.buildQueryString();
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  get encodedSizeChange(): number {
    if (!this.inputCharCount || !this.outputCharCount) return 0;
    return Math.round(((this.outputCharCount - this.inputCharCount) / this.inputCharCount) * 100);
  }

  trackByIndex(index: number): number {
    return index;
  }
}
