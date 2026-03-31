import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SITE_URL } from '../../seo.service';

interface JwtClaim {
  key: string;
  label: string;
  value: string;
  isTimestamp: boolean;
  formattedTime?: string;
}

@Component({
  selector: 'app-jwt-decoder',
  templateUrl: './jwt-decoder.component.html',
  styleUrls: ['./jwt-decoder.component.css'],
  standalone: false
})
export class JwtDecoderComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free JWT Decoder & Debugger — decode, inspect and debug JSON Web Tokens instantly. No sign-up required.')}&url=${encodeURIComponent(SITE_URL + '/tools/jwt-decoder')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/jwt-decoder')}`;

  // Well-known claim labels
  private readonly claimLabels: Record<string, string> = {
    iss: 'Issuer',
    sub: 'Subject',
    aud: 'Audience',
    exp: 'Expiration',
    nbf: 'Not Before',
    iat: 'Issued At',
    jti: 'JWT ID',
    name: 'Name',
    given_name: 'Given Name',
    family_name: 'Family Name',
    email: 'Email',
    email_verified: 'Email Verified',
    picture: 'Picture',
    locale: 'Locale',
    azp: 'Authorized Party',
    at_hash: 'Access Token Hash',
    nonce: 'Nonce',
    auth_time: 'Authentication Time',
    acr: 'Auth Context Class Ref',
    amr: 'Auth Methods Ref',
    scope: 'Scope',
    roles: 'Roles',
    permissions: 'Permissions',
    typ: 'Type',
    alg: 'Algorithm',
    kid: 'Key ID',
    sid: 'Session ID',
    org_id: 'Organization ID',
    updated_at: 'Updated At',
  };

  // Timestamp claims
  private readonly timestampClaims = new Set(['exp', 'nbf', 'iat', 'auth_time', 'updated_at']);

  // Input
  jwtInput = '';

  // Decoded state
  decoded = false;
  decodeError = '';

  // Header
  headerJson = '';
  headerHtml: SafeHtml = '';
  headerClaims: JwtClaim[] = [];
  algorithm = '';

  // Payload
  payloadJson = '';
  payloadHtml: SafeHtml = '';
  payloadClaims: JwtClaim[] = [];

  // Signature
  signaturePart = '';

  // Expiration
  isExpired = false;
  expirationDate = '';
  countdownText = '';
  hasExpClaim = false;

  // Copy states
  copiedHeader = false;
  copiedPayload = false;
  copiedSignature = false;

  // Example JWT (expires far in the future)
  private readonly exampleJwt = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImFiYzEyMyJ9.eyJpc3MiOiJodHRwczovL2F1dGgueHNhbnRjYXN0eC5jb20iLCJzdWIiOiJ1c2VyXzEyMzQ1Njc4OSIsImF1ZCI6Imh0dHBzOi8vYXBpLnhzYW50Y2FzdHguY29tIiwiaWF0IjoxNzExOTI4MDAwLCJleHAiOjIwMjc1NDcyMDAsIm5iZiI6MTcxMTkyODAwMCwianRpIjoiYTFiMmMzZDQtZTVmNi03ODkwLWFiY2QtZWYxMjM0NTY3ODkwIiwibmFtZSI6IlhhdmllciBTYW50YW5hIiwiZW1haWwiOiJ4YXZpZXJAeHNhbnRjYXN0eC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicm9sZXMiOlsiYWRtaW4iLCJlZGl0b3IiXSwicGVybWlzc2lvbnMiOlsicmVhZDphbGwiLCJ3cml0ZTphbGwiLCJkZWxldGU6b3duIl0sIm9yZ19pZCI6Im9yZ194c2FudGNhc3R4Iiwic2NvcGUiOiJvcGVuaWQgcHJvZmlsZSBlbWFpbCJ9.fake-signature-for-demo-purposes-only';

  constructor(private router: Router, private sanitizer: DomSanitizer) {}

  ngOnDestroy() {
    this.stopCountdown();
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // -- Core decode logic --

  onInput() {
    const trimmed = this.jwtInput.trim();
    if (!trimmed) {
      this.resetState();
      return;
    }
    this.decode(trimmed);
  }

  private decode(token: string) {
    this.resetState();

    const parts = token.split('.');
    if (parts.length !== 3) {
      this.decodeError = 'Invalid JWT: expected 3 parts (header.payload.signature), found ' + parts.length;
      return;
    }

    // Decode header
    try {
      const headerStr = this.base64UrlDecode(parts[0]);
      const headerObj = JSON.parse(headerStr);
      this.headerJson = JSON.stringify(headerObj, null, 2);
      this.headerHtml = this.sanitizer.bypassSecurityTrustHtml(this.highlight(this.headerJson));
      this.headerClaims = this.extractClaims(headerObj);
      this.algorithm = headerObj.alg || 'Unknown';
    } catch {
      this.decodeError = 'Failed to decode JWT header. The header segment is not valid Base64URL-encoded JSON.';
      return;
    }

    // Decode payload
    try {
      const payloadStr = this.base64UrlDecode(parts[1]);
      const payloadObj = JSON.parse(payloadStr);
      this.payloadJson = JSON.stringify(payloadObj, null, 2);
      this.payloadHtml = this.sanitizer.bypassSecurityTrustHtml(this.highlight(this.payloadJson));
      this.payloadClaims = this.extractClaims(payloadObj);

      // Expiration check
      if (payloadObj.exp !== undefined) {
        this.hasExpClaim = true;
        const expMs = payloadObj.exp * 1000;
        const expDate = new Date(expMs);
        this.expirationDate = expDate.toLocaleString();
        this.isExpired = Date.now() > expMs;
        if (!this.isExpired) {
          this.startCountdown(expMs);
        }
      }
    } catch {
      this.decodeError = 'Failed to decode JWT payload. The payload segment is not valid Base64URL-encoded JSON.';
      return;
    }

    // Signature
    this.signaturePart = parts[2];
    this.decoded = true;
  }

  loadExample() {
    this.jwtInput = this.exampleJwt;
    this.onInput();
  }

  clearAll() {
    this.jwtInput = '';
    this.resetState();
  }

  private resetState() {
    this.decoded = false;
    this.decodeError = '';
    this.headerJson = '';
    this.headerHtml = '';
    this.headerClaims = [];
    this.algorithm = '';
    this.payloadJson = '';
    this.payloadHtml = '';
    this.payloadClaims = [];
    this.signaturePart = '';
    this.isExpired = false;
    this.expirationDate = '';
    this.countdownText = '';
    this.hasExpClaim = false;
    this.stopCountdown();
  }

  // -- Base64URL decoding --

  private base64UrlDecode(str: string): string {
    // Replace URL-safe chars and add padding
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) {
      base64 += '='.repeat(4 - pad);
    }
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  }

  // -- Claims extraction --

  private extractClaims(obj: Record<string, unknown>): JwtClaim[] {
    return Object.entries(obj).map(([key, value]) => {
      const isTimestamp = this.timestampClaims.has(key) && typeof value === 'number';
      let formattedTime: string | undefined;
      if (isTimestamp) {
        formattedTime = new Date((value as number) * 1000).toLocaleString();
      }

      let displayValue: string;
      if (typeof value === 'object' && value !== null) {
        displayValue = JSON.stringify(value);
      } else {
        displayValue = String(value);
      }

      return {
        key,
        label: this.claimLabels[key] || key,
        value: displayValue,
        isTimestamp,
        formattedTime,
      };
    });
  }

  // -- Countdown timer --

  private startCountdown(expMs: number) {
    this.stopCountdown();
    this.updateCountdown(expMs);
    if (this.isBrowser) {
      this.countdownTimer = setInterval(() => this.updateCountdown(expMs), 1000);
    }
  }

  private stopCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private updateCountdown(expMs: number) {
    const diff = expMs - Date.now();
    if (diff <= 0) {
      this.isExpired = true;
      this.countdownText = '';
      this.stopCountdown();
      return;
    }

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    this.countdownText = parts.join(' ');
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
          return `<span class="jd-key">${match}</span>`;
        }
        if (/^"/.test(match)) {
          return `<span class="jd-str">${match}</span>`;
        }
        if (/^-?\d/.test(match)) {
          return `<span class="jd-num">${match}</span>`;
        }
        if (match === 'true' || match === 'false') {
          return `<span class="jd-bool">${match}</span>`;
        }
        if (match === 'null') {
          return `<span class="jd-null">${match}</span>`;
        }
        return match;
      }
    );
  }

  // -- Clipboard --

  async copySection(section: 'header' | 'payload' | 'signature') {
    if (!this.isBrowser) return;
    let text = '';
    switch (section) {
      case 'header':
        text = this.headerJson;
        break;
      case 'payload':
        text = this.payloadJson;
        break;
      case 'signature':
        text = this.signaturePart;
        break;
    }
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      this.fallbackCopy(text);
    }

    switch (section) {
      case 'header':
        this.copiedHeader = true;
        setTimeout(() => (this.copiedHeader = false), 2000);
        break;
      case 'payload':
        this.copiedPayload = true;
        setTimeout(() => (this.copiedPayload = false), 2000);
        break;
      case 'signature':
        this.copiedSignature = true;
        setTimeout(() => (this.copiedSignature = false), 2000);
        break;
    }
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
}
