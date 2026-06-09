import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

type UuidType = 'v4' | 'v1' | 'ulid';
type CaseFormat = 'lower' | 'upper';

interface ValidationResult {
  valid: boolean;
  version: string | null;
  variant: string | null;
}

@Component({
    selector: 'app-uuid-generator',
    templateUrl: './uuid-generator.component.html',
    styleUrls: ['./uuid-generator.component.css'],
    imports: [ToolsSharedModule, FormsModule]
})
export class UuidGeneratorComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free UUID/GUID Generator — v1, v4, ULID, bulk generation, validator. No sign-up required!')}&url=${encodeURIComponent(SITE_URL + '/tools/uuid-generator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/uuid-generator')}`;

  // Generator options
  uuidType: UuidType = 'v4';
  caseFormat: CaseFormat = 'lower';
  includeHyphens = true;
  bulkCount = 1;

  // Generated output
  generatedUuids: string[] = [];
  copied = false;
  copiedIndex: number | null = null;

  // Validator
  validatorInput = '';
  validationResult: ValidationResult | null = null;

  // V1 state — monotonic clock sequence
  private v1ClockSeq = this.getRandomInt(0, 0x3fff);
  private v1LastTimestamp = 0;

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── UUID Type ───────────────────────────────────────────────────────────────

  setUuidType(type: UuidType) {
    this.uuidType = type;
  }

  setCaseFormat(fmt: CaseFormat) {
    this.caseFormat = fmt;
    // Re-format existing output
    this.generatedUuids = this.generatedUuids.map(u => this.applyFormat(u));
  }

  onHyphensChange() {
    this.generatedUuids = this.generatedUuids.map(u => this.applyFormat(u));
  }

  // ── Generation ──────────────────────────────────────────────────────────────

  generate() {
    if (!this.isBrowser) return;
    const count = Math.max(1, Math.min(100, this.bulkCount || 1));
    this.generatedUuids = [];
    for (let i = 0; i < count; i++) {
      let raw: string;
      switch (this.uuidType) {
        case 'v1':
          raw = this.generateV1();
          break;
        case 'ulid':
          raw = this.generateULID();
          break;
        case 'v4':
        default:
          raw = this.generateV4();
          break;
      }
      this.generatedUuids.push(this.applyFormat(raw));
    }
    this.copied = false;
    this.copiedIndex = null;

    // Easter egg: "Lucky Roll" — generated a UUID starting with "000"
    if (this.generatedUuids.some(u => u.replace(/-/g, '').toLowerCase().startsWith('000'))) {
      this.eggs.trigger('uuid-lucky');
    }
  }

  // ── UUID v4 (random) ────────────────────────────────────────────────────────

  private generateV4(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version 4: byte 6 = 0100xxxx
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Set variant 10: byte 8 = 10xxxxxx
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return this.bytesToUuid(bytes);
  }

  // ── UUID v1 (timestamp-based, manual) ───────────────────────────────────────

  private generateV1(): string {
    // UUID v1 timestamp: 100ns intervals since 1582-10-15
    const EPOCH_OFFSET = 122192928000000000n; // 100ns ticks from UUID epoch to Unix epoch
    const now = BigInt(Date.now()) * 10000n + EPOCH_OFFSET;
    const timestamp = now;

    // Monotonic: increment clock seq if same timestamp
    if (Number(timestamp) <= this.v1LastTimestamp) {
      this.v1ClockSeq = (this.v1ClockSeq + 1) & 0x3fff;
    }
    this.v1LastTimestamp = Number(timestamp);

    const timeLow = Number(timestamp & 0xffffffffn);
    const timeMid = Number((timestamp >> 32n) & 0xffffn);
    const timeHiAndVersion = Number((timestamp >> 48n) & 0x0fffn) | 0x1000; // version 1

    const clockSeqHiAndVariant = ((this.v1ClockSeq >> 8) & 0x3f) | 0x80; // variant 10
    const clockSeqLow = this.v1ClockSeq & 0xff;

    // Random node (6 bytes) with multicast bit set
    const node = new Uint8Array(6);
    crypto.getRandomValues(node);
    node[0] |= 0x01; // multicast bit

    const hex = (n: number, len: number) => n.toString(16).padStart(len, '0');

    return [
      hex(timeLow, 8),
      hex(timeMid, 4),
      hex(timeHiAndVersion, 4),
      hex(clockSeqHiAndVariant, 2) + hex(clockSeqLow, 2),
      Array.from(node).map(b => hex(b, 2)).join('')
    ].join('-');
  }

  // ── ULID ────────────────────────────────────────────────────────────────────

  private generateULID(): string {
    const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    const now = Date.now();

    // Encode timestamp (48 bits = 10 chars)
    let ts = now;
    const timeChars: string[] = new Array(10);
    for (let i = 9; i >= 0; i--) {
      timeChars[i] = ENCODING[ts % 32];
      ts = Math.floor(ts / 32);
    }

    // Encode randomness (80 bits = 16 chars)
    const randBytes = new Uint8Array(10);
    crypto.getRandomValues(randBytes);
    const randChars: string[] = new Array(16);
    // Convert 10 bytes (80 bits) to 16 base32 chars
    let bitBuffer = 0n;
    for (const b of randBytes) {
      bitBuffer = (bitBuffer << 8n) | BigInt(b);
    }
    for (let i = 15; i >= 0; i--) {
      randChars[i] = ENCODING[Number(bitBuffer & 31n)];
      bitBuffer >>= 5n;
    }

    return timeChars.join('') + randChars.join('');
  }

  // ── Formatting ──────────────────────────────────────────────────────────────

  private applyFormat(uuid: string): string {
    // For ULID, hyphens don't apply — just case
    if (this.uuidType === 'ulid') {
      return this.caseFormat === 'upper' ? uuid.toUpperCase() : uuid.toLowerCase();
    }

    // Normalize: remove hyphens, lowercase
    let clean = uuid.replace(/-/g, '').toLowerCase();

    if (this.includeHyphens) {
      clean = [
        clean.slice(0, 8),
        clean.slice(8, 12),
        clean.slice(12, 16),
        clean.slice(16, 20),
        clean.slice(20, 32)
      ].join('-');
    }

    return this.caseFormat === 'upper' ? clean.toUpperCase() : clean;
  }

  private bytesToUuid(bytes: Uint8Array): string {
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32)
    ].join('-');
  }

  // ── Validator ───────────────────────────────────────────────────────────────

  onValidatorInput() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.validateUuid(), 200);
  }

  private validateUuid() {
    const input = this.validatorInput.trim();

    if (!input) {
      this.validationResult = null;
      return;
    }

    // Standard UUID pattern (with or without hyphens)
    const uuidRegex = /^([0-9a-f]{8})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{12})$/i;
    const match = input.match(uuidRegex);

    if (!match) {
      // Check if it's a ULID
      const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
      if (ulidRegex.test(input)) {
        this.validationResult = {
          valid: true,
          version: 'ULID',
          variant: 'Crockford Base32'
        };
        return;
      }

      this.validationResult = { valid: false, version: null, variant: null };
      return;
    }

    // Extract version from the 13th hex digit (first nibble of 3rd group)
    const versionChar = match[3][0];
    const version = parseInt(versionChar, 16);
    let versionStr: string;
    switch (version) {
      case 1: versionStr = 'Version 1 (Timestamp)'; break;
      case 2: versionStr = 'Version 2 (DCE Security)'; break;
      case 3: versionStr = 'Version 3 (MD5 Name-based)'; break;
      case 4: versionStr = 'Version 4 (Random)'; break;
      case 5: versionStr = 'Version 5 (SHA-1 Name-based)'; break;
      case 6: versionStr = 'Version 6 (Sortable Timestamp)'; break;
      case 7: versionStr = 'Version 7 (Unix Epoch Time)'; break;
      case 8: versionStr = 'Version 8 (Custom)'; break;
      default: versionStr = `Unknown (${version})`;
    }

    // Extract variant from byte 8 (first 2 hex chars of 4th group)
    const variantByte = parseInt(match[4].slice(0, 2), 16);
    let variantStr: string;
    if ((variantByte & 0x80) === 0) {
      variantStr = 'NCS (reserved)';
    } else if ((variantByte & 0xc0) === 0x80) {
      variantStr = 'RFC 4122 / RFC 9562';
    } else if ((variantByte & 0xe0) === 0xc0) {
      variantStr = 'Microsoft (reserved)';
    } else {
      variantStr = 'Future (reserved)';
    }

    this.validationResult = {
      valid: true,
      version: versionStr,
      variant: variantStr
    };
  }

  clearValidator() {
    this.validatorInput = '';
    this.validationResult = null;
  }

  // ── Copy Actions ────────────────────────────────────────────────────────────

  async copySingle(index: number) {
    if (!this.isBrowser) return;
    const text = this.generatedUuids[index];
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
    if (!this.isBrowser || !this.generatedUuids.length) return;
    const text = this.generatedUuids.join('\n');
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
    this.generatedUuids = [];
    this.copied = false;
    this.copiedIndex = null;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private getRandomInt(min: number, max: number): number {
    const range = max - min + 1;
    const bytes = new Uint8Array(2);
    if (this.isBrowser) {
      crypto.getRandomValues(bytes);
    }
    return min + ((bytes[0] << 8 | bytes[1]) % range);
  }

  get typeLabel(): string {
    switch (this.uuidType) {
      case 'v1': return 'UUID v1';
      case 'v4': return 'UUID v4';
      case 'ulid': return 'ULID';
    }
  }

  get typeDescription(): string {
    switch (this.uuidType) {
      case 'v1': return 'Timestamp-based — encodes the current time and a random node ID';
      case 'v4': return 'Cryptographically random — 122 bits of randomness';
      case 'ulid': return 'Lexicographically sortable — 48-bit timestamp + 80-bit randomness';
    }
  }

  onBulkCountInput() {
    if (this.bulkCount < 1) this.bulkCount = 1;
    if (this.bulkCount > 100) this.bulkCount = 100;
  }
}
