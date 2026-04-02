import { Component, OnDestroy, inject, PLATFORM_ID, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

type ContentType = 'text' | 'url' | 'email' | 'wifi' | 'vcard';

interface WiFiConfig {
  ssid: string;
  password: string;
  encryption: 'WPA' | 'WEP' | 'nopass';
  hidden: boolean;
}

interface VCardConfig {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  organization: string;
  url: string;
}

@Component({
  selector: 'app-qr-generator',
  templateUrl: './qr-generator.component.html',
  styleUrls: ['./qr-generator.component.css'],
  standalone: false
})
export class QrGeneratorComponent implements OnDestroy, AfterViewInit {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  @ViewChild('qrCanvas') qrCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('downloadLink') downloadLinkRef!: ElementRef<HTMLAnchorElement>;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free QR Code Generator — create QR codes for URLs, text, email, WiFi, vCard. No sign-up required.')}&url=${encodeURIComponent(SITE_URL + '/tools/qr-generator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/qr-generator')}`;

  // Content type & input
  contentType: ContentType = 'text';
  textInput = '';

  // Email fields
  emailTo = '';
  emailSubject = '';
  emailBody = '';

  // WiFi fields
  wifi: WiFiConfig = { ssid: '', password: '', encryption: 'WPA', hidden: false };

  // vCard fields
  vcard: VCardConfig = { firstName: '', lastName: '', phone: '', email: '', organization: '', url: '' };

  // Customization
  qrSize = 256;
  fgColor = '#000000';
  bgColor = '#ffffff';

  // State
  qrGenerated = false;
  errorMessage = '';
  copied = false;

  // Internal QR data
  private qrModules: boolean[][] = [];

  constructor(private router: Router) {}

  ngAfterViewInit() {
    // Initial render not needed until input is provided
  }

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Content type ──────────────────────────────────────────────────

  setContentType(type: ContentType) {
    this.contentType = type;
    this.clearAll();
  }

  // ── Input handling (debounced 300ms) ──────────────────────────────

  onInput() {
    this.errorMessage = '';

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.generateQR(), 300);
  }

  onSettingsChange() {
    if (this.qrGenerated) {
      this.renderCanvas();
    }
  }

  // ── Build payload based on content type ───────────────────────────

  private buildPayload(): string {
    switch (this.contentType) {
      case 'text':
        return this.textInput;
      case 'url':
        return this.textInput.startsWith('http') ? this.textInput : `https://${this.textInput}`;
      case 'email':
        return `mailto:${this.emailTo}?subject=${encodeURIComponent(this.emailSubject)}&body=${encodeURIComponent(this.emailBody)}`;
      case 'wifi':
        return `WIFI:T:${this.wifi.encryption};S:${this.wifi.ssid};P:${this.wifi.password};H:${this.wifi.hidden ? 'true' : 'false'};;`;
      case 'vcard':
        return [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `N:${this.vcard.lastName};${this.vcard.firstName}`,
          `FN:${this.vcard.firstName} ${this.vcard.lastName}`,
          this.vcard.phone ? `TEL:${this.vcard.phone}` : '',
          this.vcard.email ? `EMAIL:${this.vcard.email}` : '',
          this.vcard.organization ? `ORG:${this.vcard.organization}` : '',
          this.vcard.url ? `URL:${this.vcard.url}` : '',
          'END:VCARD'
        ].filter(Boolean).join('\n');
    }
  }

  private hasInput(): boolean {
    switch (this.contentType) {
      case 'text':
      case 'url':
        return !!this.textInput.trim();
      case 'email':
        return !!this.emailTo.trim();
      case 'wifi':
        return !!this.wifi.ssid.trim();
      case 'vcard':
        return !!(this.vcard.firstName.trim() || this.vcard.lastName.trim());
    }
  }

  // ── QR generation ─────────────────────────────────────────────────

  private generateQR() {
    if (!this.hasInput()) {
      this.qrGenerated = false;
      this.qrModules = [];
      this.clearCanvas();
      return;
    }

    const payload = this.buildPayload();

    // Easter egg check
    if (this.contentType === 'text' && this.textInput === 'xsantcastx') {
      this.eggs.trigger('qr-self');
    }

    try {
      this.qrModules = this.encodeToQR(payload);
      this.qrGenerated = true;
      this.errorMessage = '';
      this.renderCanvas();
    } catch {
      this.errorMessage = 'Failed to generate QR code. Input may be too long.';
      this.qrGenerated = false;
    }
  }

  // ── QR Encoding (simplified version 2 QR with byte mode) ─────────

  private encodeToQR(data: string): boolean[][] {
    const bytes = new TextEncoder().encode(data);

    // Use a fixed size based on data length
    // Version 1 = 21x21, version 2 = 25x25, etc.
    // Each version adds 4 modules per side
    let version = 1;
    // Max data bytes per version (approximate, error correction level L)
    const capacities = [0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271, 321, 370, 428, 461, 523, 589, 614, 664, 718, 779, 857, 929, 1003, 1091, 1171, 1273, 1367, 1465, 1528, 1628, 1732, 1840, 1952, 2068, 2188, 2303, 2431, 2563, 2699, 2809];

    for (let v = 1; v <= 40; v++) {
      if (bytes.length <= capacities[v]) {
        version = v;
        break;
      }
    }

    const size = 17 + version * 4;
    const modules: (boolean | null)[][] = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => null)
    );
    const reserved: boolean[][] = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => false)
    );

    // Place finder patterns
    this.placeFinderPattern(modules, reserved, 0, 0);
    this.placeFinderPattern(modules, reserved, size - 7, 0);
    this.placeFinderPattern(modules, reserved, 0, size - 7);

    // Place timing patterns
    for (let i = 8; i < size - 8; i++) {
      const val = i % 2 === 0;
      if (modules[6][i] === null) { modules[6][i] = val; reserved[6][i] = true; }
      if (modules[i][6] === null) { modules[i][6] = val; reserved[i][6] = true; }
    }

    // Place alignment patterns (version 2+)
    if (version >= 2) {
      const positions = this.getAlignmentPositions(version, size);
      for (const row of positions) {
        for (const col of positions) {
          if (reserved[row]?.[col]) continue;
          this.placeAlignmentPattern(modules, reserved, row, col);
        }
      }
    }

    // Reserve format info areas
    for (let i = 0; i < 8; i++) {
      if (!reserved[8]?.[i]) { reserved[8][i] = true; modules[8][i] = false; }
      if (!reserved[i]?.[8]) { reserved[i][8] = true; modules[i][8] = false; }
      if (!reserved[8]?.[size - 1 - i]) { reserved[8][size - 1 - i] = true; modules[8][size - 1 - i] = false; }
      if (!reserved[size - 1 - i]?.[8]) { reserved[size - 1 - i][8] = true; modules[size - 1 - i][8] = false; }
    }
    // Dark module
    modules[size - 8][8] = true;
    reserved[size - 8][8] = true;

    // Encode data bits
    const dataBits = this.encodeDataBits(bytes, version);

    // Place data bits in zigzag pattern
    let bitIndex = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; // Skip timing column
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const col = right - j;
          const isUpward = ((right + 1) / 2 | 0) % 2 === (right >= 7 ? 1 : 0);
          const adjustedRight = right >= 7 ? right + 1 : right;
          const colPairIdx = Math.floor((size - 1 - adjustedRight) / 2);
          const goingUp = colPairIdx % 2 === 0;
          const row = goingUp ? (size - 1 - vert) : vert;

          if (row < 0 || row >= size || col < 0 || col >= size) continue;
          if (reserved[row][col]) continue;

          const bit = bitIndex < dataBits.length ? dataBits[bitIndex] : false;
          // Apply mask pattern 0: (row + col) % 2 === 0
          modules[row][col] = ((row + col) % 2 === 0) ? !bit : bit;
          bitIndex++;
        }
      }
    }

    // Write format info (mask pattern 0, error correction L)
    // Format string for EC level L, mask 0 = 111011111000100
    const formatBits = [true, true, true, false, true, true, true, true, true, false, false, false, true, false, false];
    this.placeFormatInfo(modules, formatBits, size);

    return modules.map(row => row.map(cell => cell === true));
  }

  private placeFinderPattern(modules: (boolean | null)[][], reserved: boolean[][], startRow: number, startCol: number) {
    const pattern = [
      [1,1,1,1,1,1,1],
      [1,0,0,0,0,0,1],
      [1,0,1,1,1,0,1],
      [1,0,1,1,1,0,1],
      [1,0,1,1,1,0,1],
      [1,0,0,0,0,0,1],
      [1,1,1,1,1,1,1],
    ];
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = startRow + r;
        const col = startCol + c;
        if (row < 0 || row >= modules.length || col < 0 || col >= modules.length) continue;
        if (r >= 0 && r < 7 && c >= 0 && c < 7) {
          modules[row][col] = pattern[r][c] === 1;
        } else {
          modules[row][col] = false; // Separator
        }
        reserved[row][col] = true;
      }
    }
  }

  private placeAlignmentPattern(modules: (boolean | null)[][], reserved: boolean[][], centerRow: number, centerCol: number) {
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const row = centerRow + r;
        const col = centerCol + c;
        if (row < 0 || row >= modules.length || col < 0 || col >= modules.length) continue;
        if (reserved[row][col]) return; // Overlaps finder pattern
      }
    }
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const row = centerRow + r;
        const col = centerCol + c;
        const isEdge = Math.abs(r) === 2 || Math.abs(c) === 2;
        const isCenter = r === 0 && c === 0;
        modules[row][col] = isEdge || isCenter;
        reserved[row][col] = true;
      }
    }
  }

  private getAlignmentPositions(version: number, size: number): number[] {
    if (version === 1) return [];
    const positions = [6];
    const last = size - 7;
    const count = Math.floor(version / 7) + 2;
    const step = Math.ceil((last - 6) / (count - 1));
    for (let i = 1; i < count; i++) {
      positions.push(6 + i * step > last ? last : 6 + i * step);
    }
    // Ensure last position
    if (positions[positions.length - 1] !== last) {
      positions[positions.length - 1] = last;
    }
    return positions;
  }

  private encodeDataBits(bytes: Uint8Array, version: number): boolean[] {
    const bits: boolean[] = [];

    // Mode indicator: 0100 (byte mode)
    bits.push(false, true, false, false);

    // Character count (8 bits for version 1-9, 16 bits for 10+)
    const countBits = version <= 9 ? 8 : 16;
    for (let i = countBits - 1; i >= 0; i--) {
      bits.push(((bytes.length >> i) & 1) === 1);
    }

    // Data bytes
    for (const byte of bytes) {
      for (let i = 7; i >= 0; i--) {
        bits.push(((byte >> i) & 1) === 1);
      }
    }

    // Terminator (up to 4 zeros)
    for (let i = 0; i < 4; i++) bits.push(false);

    // Pad to byte boundary
    while (bits.length % 8 !== 0) bits.push(false);

    // Pad bytes (alternating 0xEC, 0x11)
    const capacities = [0, 19, 34, 55, 80, 108, 136, 156, 194, 232, 274, 324, 370, 428, 461, 523, 589, 614, 664, 718, 779, 857, 929, 1003, 1091, 1171, 1273, 1367, 1465, 1528, 1628, 1732, 1840, 1952, 2068, 2188, 2303, 2431, 2563, 2699, 2809];
    const totalDataBytes = capacities[version] || 19;
    let padToggle = false;
    while (bits.length < totalDataBytes * 8) {
      const padByte = padToggle ? 0x11 : 0xEC;
      for (let i = 7; i >= 0; i--) {
        bits.push(((padByte >> i) & 1) === 1);
      }
      padToggle = !padToggle;
    }

    return bits;
  }

  private placeFormatInfo(modules: (boolean | null)[][], formatBits: boolean[], size: number) {
    // Around top-left finder
    const positions1 = [
      [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[7,8],[8,8],
      [8,7],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0]
    ];
    // Bottom-left and top-right
    const positions2 = [
      [size-1,8],[size-2,8],[size-3,8],[size-4,8],[size-5,8],[size-6,8],[size-7,8],
      [8,size-8],[8,size-7],[8,size-6],[8,size-5],[8,size-4],[8,size-3],[8,size-2],[8,size-1]
    ];

    for (let i = 0; i < 15 && i < positions1.length; i++) {
      const [r, c] = positions1[i];
      if (r < size && c < size) modules[r][c] = formatBits[i];
    }
    for (let i = 0; i < 15 && i < positions2.length; i++) {
      const [r, c] = positions2[i];
      if (r < size && c < size) modules[r][c] = formatBits[i];
    }
  }

  // ── Canvas rendering ──────────────────────────────────────────────

  private renderCanvas() {
    if (!this.isBrowser || !this.qrCanvasRef) return;

    const canvas = this.qrCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx || !this.qrModules.length) return;

    const moduleCount = this.qrModules.length;
    const quietZone = 4;
    const totalModules = moduleCount + quietZone * 2;
    const moduleSize = this.qrSize / totalModules;

    canvas.width = this.qrSize;
    canvas.height = this.qrSize;

    // Background
    ctx.fillStyle = this.bgColor;
    ctx.fillRect(0, 0, this.qrSize, this.qrSize);

    // Draw modules
    ctx.fillStyle = this.fgColor;
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (this.qrModules[row][col]) {
          ctx.fillRect(
            (col + quietZone) * moduleSize,
            (row + quietZone) * moduleSize,
            moduleSize,
            moduleSize
          );
        }
      }
    }
  }

  private clearCanvas() {
    if (!this.isBrowser || !this.qrCanvasRef) return;
    const canvas = this.qrCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = this.qrSize;
      canvas.height = this.qrSize;
      ctx.clearRect(0, 0, this.qrSize, this.qrSize);
    }
  }

  // ── Actions ───────────────────────────────────────────────────────

  clearAll() {
    this.textInput = '';
    this.emailTo = '';
    this.emailSubject = '';
    this.emailBody = '';
    this.wifi = { ssid: '', password: '', encryption: 'WPA', hidden: false };
    this.vcard = { firstName: '', lastName: '', phone: '', email: '', organization: '', url: '' };
    this.qrGenerated = false;
    this.qrModules = [];
    this.errorMessage = '';
    this.clearCanvas();
  }

  loadSample() {
    this.contentType = 'url';
    this.textInput = 'https://xsantcastx.com';
    this.onInput();
  }

  downloadPNG() {
    if (!this.isBrowser || !this.qrCanvasRef) return;
    const canvas = this.qrCanvasRef.nativeElement;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-code-${Date.now()}.png`;
    a.click();
  }

  downloadSVG() {
    if (!this.isBrowser || !this.qrModules.length) return;

    const moduleCount = this.qrModules.length;
    const quietZone = 4;
    const totalModules = moduleCount + quietZone * 2;
    const moduleSize = this.qrSize / totalModules;

    let paths = '';
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (this.qrModules[row][col]) {
          const x = (col + quietZone) * moduleSize;
          const y = (row + quietZone) * moduleSize;
          paths += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="${this.fgColor}"/>`;
        }
      }
    }

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${this.qrSize}" height="${this.qrSize}" viewBox="0 0 ${this.qrSize} ${this.qrSize}">
  <rect width="100%" height="100%" fill="${this.bgColor}"/>
  ${paths}
</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-code-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async copyQR() {
    if (!this.isBrowser || !this.qrCanvasRef) return;
    try {
      const canvas = this.qrCanvasRef.nativeElement;
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        this.copied = true;
        setTimeout(() => (this.copied = false), 2000);
      }
    } catch {
      this.copied = false;
    }
  }
}
