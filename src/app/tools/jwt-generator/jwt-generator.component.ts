import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

interface CustomClaim {
  key: string;
  value: string;
}

type Algorithm = 'HS256' | 'HS384' | 'HS512' | 'none';

@Component({
    selector: 'app-jwt-generator',
    templateUrl: './jwt-generator.component.html',
    styleUrls: ['./jwt-generator.component.css'],
    imports: [FormsModule, ToolsSharedModule]
})
export class JwtGeneratorComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  // Header
  algorithm: Algorithm = 'HS256';
  readonly algorithms: Algorithm[] = ['HS256', 'HS384', 'HS512', 'none'];

  // Standard claims
  issuer = '';
  subject = '';
  audience = '';
  expirationDate = '';
  expirationTime = '';
  issuedAtNow = true;
  notBeforeNow = true;

  // Custom claims
  customClaims: CustomClaim[] = [];
  newClaimKey = '';
  newClaimValue = '';

  // Secret
  secret = '';

  // Output
  generatedToken = '';
  previewHeaderJson = '';
  previewPayloadJson = '';
  previewHeaderHtml: SafeHtml = '';
  previewPayloadHtml: SafeHtml = '';
  generateError = '';
  isGenerating = false;

  // Copy state
  copiedToken = false;

  constructor(private router: Router, private sanitizer: DomSanitizer) {}

  goBack() {
    this.router.navigate(['/tools']);
  }

  onAlgorithmChange() {
    if (this.algorithm === 'none') {
      this.eggs.trigger('jwt-insecure');
    }
    this.updatePreview();
  }

  // -- Custom claims management --

  addCustomClaim() {
    const key = this.newClaimKey.trim();
    const value = this.newClaimValue.trim();
    if (!key) return;

    this.customClaims = [...this.customClaims, { key, value }];
    this.newClaimKey = '';
    this.newClaimValue = '';
    this.updatePreview();
  }

  removeCustomClaim(index: number) {
    this.customClaims = this.customClaims.filter((_, i) => i !== index);
    this.updatePreview();
  }

  // -- Preview --

  updatePreview() {
    const header = this.buildHeader();
    const payload = this.buildPayload();

    this.previewHeaderJson = JSON.stringify(header, null, 2);
    this.previewPayloadJson = JSON.stringify(payload, null, 2);
    this.previewHeaderHtml = this.sanitizer.bypassSecurityTrustHtml(this.highlight(this.previewHeaderJson));
    this.previewPayloadHtml = this.sanitizer.bypassSecurityTrustHtml(this.highlight(this.previewPayloadJson));
  }

  // -- Build header & payload objects --

  private buildHeader(): Record<string, unknown> {
    return {
      alg: this.algorithm,
      typ: 'JWT'
    };
  }

  private buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    const now = Math.floor(Date.now() / 1000);

    if (this.issuer.trim()) payload['iss'] = this.issuer.trim();
    if (this.subject.trim()) payload['sub'] = this.subject.trim();
    if (this.audience.trim()) payload['aud'] = this.audience.trim();

    if (this.expirationDate) {
      const dateStr = this.expirationTime
        ? `${this.expirationDate}T${this.expirationTime}`
        : `${this.expirationDate}T23:59:59`;
      const expTimestamp = Math.floor(new Date(dateStr).getTime() / 1000);
      if (!isNaN(expTimestamp)) payload['exp'] = expTimestamp;
    }

    if (this.issuedAtNow) payload['iat'] = now;
    if (this.notBeforeNow) payload['nbf'] = now;

    for (const claim of this.customClaims) {
      if (claim.key.trim()) {
        payload[claim.key.trim()] = this.parseClaimValue(claim.value);
      }
    }

    return payload;
  }

  private parseClaimValue(value: string): unknown {
    // Try parsing as JSON (number, boolean, array, object)
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  // -- Token generation --

  async generateToken() {
    this.generateError = '';
    this.generatedToken = '';

    const header = this.buildHeader();
    const payload = this.buildPayload();

    const headerB64 = this.base64UrlEncode(JSON.stringify(header));
    const payloadB64 = this.base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${headerB64}.${payloadB64}`;

    if (this.algorithm === 'none') {
      this.generatedToken = `${signingInput}.`;
      this.updatePreview();
      return;
    }

    // HMAC signing requires a secret
    if (!this.secret.trim()) {
      this.generateError = 'A secret key is required for HMAC signing.';
      return;
    }

    if (!this.isBrowser) {
      this.generateError = 'Token signing is only available in the browser.';
      return;
    }

    this.isGenerating = true;

    try {
      const signature = await this.signHmac(signingInput, this.secret, this.algorithm);
      this.generatedToken = `${signingInput}.${signature}`;
      this.updatePreview();
    } catch (err) {
      this.generateError = `Signing failed: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      this.isGenerating = false;
    }
  }

  // -- Web Crypto HMAC signing --

  private async signHmac(input: string, secret: string, alg: 'HS256' | 'HS384' | 'HS512'): Promise<string> {
    const hashMap: Record<string, string> = {
      HS256: 'SHA-256',
      HS384: 'SHA-384',
      HS512: 'SHA-512'
    };

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const data = encoder.encode(input);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: hashMap[alg] },
      false,
      ['sign']
    );

    const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, data);
    return this.arrayBufferToBase64Url(sigBuffer);
  }

  private arrayBufferToBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // -- Base64URL encoding --

  private base64UrlEncode(str: string): string {
    const encoded = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < encoded.length; i++) {
      binary += String.fromCharCode(encoded[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // -- Syntax highlighting --

  private highlight(json: string): string {
    const escaped = json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped.replace(
      /("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b)/g,
      (match) => {
        if (match.endsWith(':')) {
          return `<span class="jg-key">${match}</span>`;
        }
        if (/^"/.test(match)) {
          return `<span class="jg-str">${match}</span>`;
        }
        if (/^-?\d/.test(match)) {
          return `<span class="jg-num">${match}</span>`;
        }
        if (match === 'true' || match === 'false') {
          return `<span class="jg-bool">${match}</span>`;
        }
        if (match === 'null') {
          return `<span class="jg-null">${match}</span>`;
        }
        return match;
      }
    );
  }

  // -- Clipboard --

  async copyToken() {
    if (!this.isBrowser || !this.generatedToken) return;

    try {
      await navigator.clipboard.writeText(this.generatedToken);
    } catch {
      this.fallbackCopy(this.generatedToken);
    }

    this.copiedToken = true;
    setTimeout(() => (this.copiedToken = false), 2000);
  }

  private fallbackCopy(text: string) {
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
    this.algorithm = 'HS256';
    this.issuer = '';
    this.subject = '';
    this.audience = '';
    this.expirationDate = '';
    this.expirationTime = '';
    this.issuedAtNow = true;
    this.notBeforeNow = true;
    this.customClaims = [];
    this.newClaimKey = '';
    this.newClaimValue = '';
    this.secret = '';
    this.generatedToken = '';
    this.previewHeaderJson = '';
    this.previewPayloadJson = '';
    this.previewHeaderHtml = '';
    this.previewPayloadHtml = '';
    this.generateError = '';
  }
}
