import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

interface HeaderEntry {
  key: string;
  value: string;
}

interface HistoryEntry {
  id: number;
  method: string;
  url: string;
  status: number;
  statusText: string;
  duration: number;
  timestamp: number;
  headers: HeaderEntry[];
  contentType: string;
  body: string;
  responseBody: string;
  responseHeaders: string;
}

@Component({
  selector: 'app-api-request-builder',
  templateUrl: './api-request-builder.component.html',
  styleUrls: ['./api-request-builder.component.css'],
  standalone: false
})
export class ApiRequestBuilderComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  // Request config
  httpMethod = 'GET';
  requestUrl = '';
  methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

  // Headers
  requestHeaders: HeaderEntry[] = [{ key: '', value: '' }];

  // Body
  contentType: 'json' | 'form-data' | 'raw' = 'json';
  requestBody = '';

  // Response
  loading = false;
  responseStatus = 0;
  responseStatusText = '';
  responseHeaders = '';
  responseBody = '';
  responseDuration = 0;
  hasResponse = false;
  responseError = '';

  // History
  history: HistoryEntry[] = [];
  private nextId = 1;
  showHistory = false;

  // Copy states
  copiedCurl = false;
  copiedResponse = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.loadHistory();
  }

  ngOnDestroy(): void {}

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  // ── Headers management ──────────────────────────────────────────

  addHeader(): void {
    this.requestHeaders.push({ key: '', value: '' });
  }

  removeHeader(index: number): void {
    this.requestHeaders.splice(index, 1);
    if (this.requestHeaders.length === 0) {
      this.requestHeaders.push({ key: '', value: '' });
    }
  }

  // ── Body helpers ────────────────────────────────────────────────

  get showBody(): boolean {
    return !['GET', 'HEAD', 'OPTIONS'].includes(this.httpMethod);
  }

  get bodyPlaceholder(): string {
    if (this.contentType === 'json') return '{\n  "key": "value"\n}';
    if (this.contentType === 'form-data') return 'key1=value1&key2=value2';
    return 'Raw text body...';
  }

  // ── Send request ────────────────────────────────────────────────

  async sendRequest(): Promise<void> {
    if (!this.isBrowser || !this.requestUrl.trim()) return;

    this.loading = true;
    this.hasResponse = false;
    this.responseError = '';
    const start = performance.now();

    // Check teapot easter egg in URL
    if (this.requestUrl.toLowerCase().includes('teapot')) {
      this.eggs.trigger('api-teapot');
    }

    try {
      const headers = new Headers();
      for (const h of this.requestHeaders) {
        if (h.key.trim()) {
          headers.set(h.key.trim(), h.value);
        }
      }

      // Set content type if body is present
      if (this.showBody && this.requestBody.trim()) {
        if (this.contentType === 'json') {
          headers.set('Content-Type', 'application/json');
        } else if (this.contentType === 'form-data') {
          headers.set('Content-Type', 'application/x-www-form-urlencoded');
        } else {
          headers.set('Content-Type', 'text/plain');
        }
      }

      const init: RequestInit = {
        method: this.httpMethod,
        headers,
        mode: 'cors',
      };

      if (this.showBody && this.requestBody.trim()) {
        init.body = this.requestBody;
      }

      const response = await fetch(this.requestUrl, init);
      const duration = Math.round(performance.now() - start);

      this.responseStatus = response.status;
      this.responseStatusText = response.statusText;
      this.responseDuration = duration;

      // Collect response headers
      const respHeaders: string[] = [];
      response.headers.forEach((value, key) => {
        respHeaders.push(`${key}: ${value}`);
      });
      this.responseHeaders = respHeaders.join('\n');

      // Read body
      const text = await response.text();
      this.responseBody = this.tryPrettyPrint(text);
      this.hasResponse = true;

      // Check teapot status easter egg
      if (response.status === 418) {
        this.eggs.trigger('api-teapot');
      }

      // Add to history
      this.addToHistory(duration);

    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      this.responseDuration = duration;
      this.responseError = err?.message || 'Request failed — check the URL and try again.';
      this.hasResponse = true;
      this.responseStatus = 0;
      this.responseStatusText = 'Error';
      this.responseBody = '';
      this.responseHeaders = '';
    } finally {
      this.loading = false;
    }
  }

  // ── History ─────────────────────────────────────────────────────

  private addToHistory(duration: number): void {
    const entry: HistoryEntry = {
      id: this.nextId++,
      method: this.httpMethod,
      url: this.requestUrl,
      status: this.responseStatus,
      statusText: this.responseStatusText,
      duration,
      timestamp: Date.now(),
      headers: [...this.requestHeaders],
      contentType: this.contentType,
      body: this.requestBody,
      responseBody: this.responseBody,
      responseHeaders: this.responseHeaders,
    };

    this.history.unshift(entry);
    if (this.history.length > 20) this.history.pop();
    this.saveHistory();
  }

  loadFromHistory(entry: HistoryEntry): void {
    this.httpMethod = entry.method;
    this.requestUrl = entry.url;
    this.requestHeaders = entry.headers.length ? [...entry.headers] : [{ key: '', value: '' }];
    this.contentType = entry.contentType as any;
    this.requestBody = entry.body;
    this.responseStatus = entry.status;
    this.responseStatusText = entry.statusText;
    this.responseDuration = entry.duration;
    this.responseBody = entry.responseBody;
    this.responseHeaders = entry.responseHeaders;
    this.hasResponse = true;
    this.responseError = '';
    this.showHistory = false;
  }

  clearHistory(): void {
    this.history = [];
    this.saveHistory();
  }

  private saveHistory(): void {
    if (!this.isBrowser) return;
    try {
      sessionStorage.setItem('arb-history', JSON.stringify(this.history));
    } catch { /* quota */ }
  }

  private loadHistory(): void {
    if (!this.isBrowser) return;
    try {
      const stored = sessionStorage.getItem('arb-history');
      if (stored) {
        this.history = JSON.parse(stored);
        this.nextId = this.history.length ? Math.max(...this.history.map(h => h.id)) + 1 : 1;
      }
    } catch { /* corrupt */ }
  }

  // ── Copy as cURL ────────────────────────────────────────────────

  get curlCommand(): string {
    const parts = [`curl -X ${this.httpMethod}`];

    for (const h of this.requestHeaders) {
      if (h.key.trim()) {
        parts.push(`-H '${h.key.trim()}: ${h.value}'`);
      }
    }

    if (this.showBody && this.requestBody.trim()) {
      if (this.contentType === 'json') {
        parts.push(`-H 'Content-Type: application/json'`);
      } else if (this.contentType === 'form-data') {
        parts.push(`-H 'Content-Type: application/x-www-form-urlencoded'`);
      } else {
        parts.push(`-H 'Content-Type: text/plain'`);
      }
      parts.push(`-d '${this.requestBody.replace(/'/g, "'\\''")}'`);
    }

    parts.push(`'${this.requestUrl}'`);
    return parts.join(' \\\n  ');
  }

  async copyCurl(): Promise<void> {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.curlCommand);
      this.copiedCurl = true;
      setTimeout(() => (this.copiedCurl = false), 2000);
    } catch { /* fallback */ }
  }

  async copyResponse(): Promise<void> {
    if (!this.isBrowser || !this.responseBody) return;
    try {
      await navigator.clipboard.writeText(this.responseBody);
      this.copiedResponse = true;
      setTimeout(() => (this.copiedResponse = false), 2000);
    } catch { /* fallback */ }
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private tryPrettyPrint(text: string): string {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }

  get statusClass(): string {
    if (this.responseStatus === 0) return 'arb-status--error';
    if (this.responseStatus < 300) return 'arb-status--success';
    if (this.responseStatus < 400) return 'arb-status--redirect';
    if (this.responseStatus < 500) return 'arb-status--client-error';
    return 'arb-status--server-error';
  }

  get methodColor(): string {
    const colors: Record<string, string> = {
      GET: '#00ffcc',
      POST: '#7b61ff',
      PUT: '#ffb86c',
      PATCH: '#ff79c6',
      DELETE: '#ff4d6a',
      HEAD: '#6272a4',
      OPTIONS: '#8be9fd',
    };
    return colors[this.httpMethod] || '#00ffcc';
  }

  formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
