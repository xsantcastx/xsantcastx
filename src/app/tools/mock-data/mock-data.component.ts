import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { SITE_URL } from '../../seo.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

type OutputFormat = 'json' | 'csv' | 'sql';

interface FieldOption {
  key: string;
  label: string;
  enabled: boolean;
}

interface MockRecord {
  [key: string]: string;
}

@Component({
    selector: 'app-mock-data',
    templateUrl: './mock-data.component.html',
    styleUrls: ['./mock-data.component.css'],
    imports: [ToolsSharedModule, FormsModule, UpperCasePipe]
})
export class MockDataComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Mock Data Generator — random names, emails, addresses & more. Export as JSON, CSV, or SQL. No sign-up.')}&url=${encodeURIComponent(SITE_URL + '/tools/mock-data')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/mock-data')}`;

  quantity = 10;
  outputFormat: OutputFormat = 'json';
  tableName = 'users';
  output = '';
  copied = false;
  generated = false;

  fields: FieldOption[] = [
    { key: 'name',    label: 'Full Name',     enabled: true },
    { key: 'email',   label: 'Email',         enabled: true },
    { key: 'address', label: 'Address',        enabled: true },
    { key: 'phone',   label: 'Phone Number',   enabled: true },
    { key: 'date',    label: 'Date',           enabled: true },
    { key: 'uuid',    label: 'UUID',           enabled: false },
    { key: 'color',   label: 'Hex Color',      enabled: false },
    { key: 'ip',      label: 'IP Address',     enabled: false },
    { key: 'url',     label: 'URL',            enabled: false },
    { key: 'sentence', label: 'Sentence',      enabled: false },
  ];

  // ── Random data pools ──────────────────────────────────────────

  private firstNames = [
    'Aria', 'Kai', 'Nova', 'Orion', 'Luna', 'Zane', 'Maya', 'Leo', 'Sage',
    'Jax', 'Ivy', 'Finn', 'Cleo', 'Ash', 'Wren', 'Ezra', 'Nyx', 'Cole',
    'Iris', 'Dax', 'Lila', 'Rhea', 'Thane', 'Vera', 'Cruz', 'Mira', 'Tate',
    'Elle', 'Rex', 'Ada', 'Hugo', 'Skye', 'Beau', 'Nia', 'Ryder', 'Jade',
    'Blake', 'Lux', 'Quinn', 'Zara', 'Felix', 'Suki', 'Knox', 'Freya', 'Arlo'
  ];

  private lastNames = [
    'Nakamura', 'Reeves', 'Volkov', 'Okafor', 'Lindqvist', 'Moreno', 'Chen',
    'Blackwood', 'Petrov', 'Singh', 'Duarte', 'Novak', 'Torres', 'Kim',
    'Ashford', 'Voss', 'Tanaka', 'Rivera', 'Frost', 'Ivanova', 'Park',
    'Steele', 'Larsson', 'Mendez', 'Zhao', 'Hartley', 'Cruz', 'Shah',
    'Brennan', 'Johansson', 'Kato', 'Wells', 'Hagen', 'Ortiz', 'Yun'
  ];

  private domains = [
    'nexus.io', 'dataflow.dev', 'synthwave.co', 'cybercore.net', 'gridpulse.com',
    'novatech.io', 'vortex.dev', 'phantom.co', 'axiom.net', 'echo.systems',
    'prism.cloud', 'matrix.digital', 'flux.app', 'helix.codes', 'arc.studio'
  ];

  private streets = [
    'Circuit Ave', 'Neon Blvd', 'Quantum St', 'Binary Lane', 'Pixel Dr',
    'Cyber Way', 'Data Ct', 'Vector Rd', 'Node Pkwy', 'Helix Terrace',
    'Signal Row', 'Chrome Pl', 'Byte St', 'Pulse Ave', 'Grid Loop'
  ];

  private cities = [
    'Neo Tokyo', 'San Arcadia', 'Port Lux', 'Haven Ridge', 'Prism City',
    'Volt Springs', 'Apex Bay', 'Iron Coast', 'Echo Falls', 'Drift Mesa',
    'Zenith Park', 'Cobalt Cove', 'Nova Harbor', 'Storm Point', 'Cipher Town'
  ];

  private states = [
    'CA', 'NY', 'TX', 'WA', 'OR', 'CO', 'IL', 'GA', 'FL', 'MA',
    'NC', 'AZ', 'OH', 'MI', 'PA'
  ];

  private adjectives = [
    'The encrypted', 'A quantum', 'The volatile', 'A synthetic', 'The recursive',
    'An asynchronous', 'The compiled', 'A decentralized', 'The modular', 'A cached',
    'The overclocked', 'A polymorphic', 'The distributed', 'A serialized', 'The hashed'
  ];

  private nouns = [
    'algorithm', 'protocol', 'firewall', 'database', 'kernel',
    'buffer', 'pipeline', 'framework', 'daemon', 'socket',
    'payload', 'endpoint', 'schema', 'cluster', 'runtime'
  ];

  private verbs = [
    'initializes', 'compiles', 'encrypts', 'deploys', 'parses',
    'renders', 'syncs', 'resolves', 'caches', 'streams',
    'validates', 'indexes', 'maps', 'iterates', 'invokes'
  ];

  private urlPaths = [
    '/api/v2/data', '/dashboard', '/auth/login', '/users/profile', '/metrics',
    '/config/settings', '/health', '/stream/live', '/search', '/export'
  ];

  constructor(private router: Router) {}

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Field management ───────────────────────────────────────────

  get enabledFields(): FieldOption[] {
    return this.fields.filter(f => f.enabled);
  }

  get hasEnabledFields(): boolean {
    return this.fields.some(f => f.enabled);
  }

  toggleAll(state: boolean) {
    this.fields.forEach(f => f.enabled = state);
  }

  // ── Generation ─────────────────────────────────────────────────

  generate() {
    if (!this.hasEnabledFields) return;

    const records: MockRecord[] = [];
    for (let i = 0; i < this.quantity; i++) {
      records.push(this.generateRecord());
    }

    switch (this.outputFormat) {
      case 'json':
        this.output = JSON.stringify(records, null, 2);
        break;
      case 'csv':
        this.output = this.toCSV(records);
        break;
      case 'sql':
        this.output = this.toSQL(records);
        break;
    }

    this.generated = true;

    // Easter egg: exactly 42 records
    if (this.quantity === 42) {
      this.eggs.trigger('mock-42');
    }
  }

  private generateRecord(): MockRecord {
    const record: MockRecord = {};
    const enabled = this.enabledFields;

    for (const field of enabled) {
      switch (field.key) {
        case 'name':    record['name']    = this.randomName(); break;
        case 'email':   record['email']   = this.randomEmail(); break;
        case 'address': record['address'] = this.randomAddress(); break;
        case 'phone':   record['phone']   = this.randomPhone(); break;
        case 'date':    record['date']    = this.randomDate(); break;
        case 'uuid':    record['uuid']    = this.randomUUID(); break;
        case 'color':   record['color']   = this.randomColor(); break;
        case 'ip':      record['ip']      = this.randomIP(); break;
        case 'url':     record['url']     = this.randomURL(); break;
        case 'sentence': record['sentence'] = this.randomSentence(); break;
      }
    }

    return record;
  }

  // ── Random generators ──────────────────────────────────────────

  private pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private rand(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private randomName(): string {
    return `${this.pick(this.firstNames)} ${this.pick(this.lastNames)}`;
  }

  private randomEmail(): string {
    const first = this.pick(this.firstNames).toLowerCase();
    const last = this.pick(this.lastNames).toLowerCase();
    const sep = this.pick(['.', '_', '']);
    const num = this.rand(0, 1) ? String(this.rand(1, 99)) : '';
    return `${first}${sep}${last}${num}@${this.pick(this.domains)}`;
  }

  private randomAddress(): string {
    const num = this.rand(100, 9999);
    return `${num} ${this.pick(this.streets)}, ${this.pick(this.cities)}, ${this.pick(this.states)} ${this.rand(10000, 99999)}`;
  }

  private randomPhone(): string {
    const a = this.rand(200, 999);
    const b = this.rand(200, 999);
    const c = this.rand(1000, 9999);
    return `(${a}) ${b}-${c}`;
  }

  private randomDate(): string {
    const y = this.rand(2000, 2026);
    const m = String(this.rand(1, 12)).padStart(2, '0');
    const d = String(this.rand(1, 28)).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private randomUUID(): string {
    const hex = () => Math.floor(Math.random() * 16).toString(16);
    const seg = (n: number) => Array.from({ length: n }, hex).join('');
    return `${seg(8)}-${seg(4)}-4${seg(3)}-${this.pick(['8','9','a','b'])}${seg(3)}-${seg(12)}`;
  }

  private randomColor(): string {
    return '#' + Array.from({ length: 6 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  private randomIP(): string {
    return `${this.rand(1, 254)}.${this.rand(0, 255)}.${this.rand(0, 255)}.${this.rand(1, 254)}`;
  }

  private randomURL(): string {
    const proto = this.pick(['https', 'https', 'http']);
    return `${proto}://${this.pick(this.domains)}${this.pick(this.urlPaths)}`;
  }

  private randomSentence(): string {
    return `${this.pick(this.adjectives)} ${this.pick(this.nouns)} ${this.pick(this.verbs)} the ${this.pick(this.nouns)}.`;
  }

  // ── Output formatters ─────────────────────────────────────────

  private toCSV(records: MockRecord[]): string {
    if (!records.length) return '';
    const keys = Object.keys(records[0]);
    const header = keys.map(k => `"${k}"`).join(',');
    const rows = records.map(r =>
      keys.map(k => `"${(r[k] || '').replace(/"/g, '""')}"`).join(',')
    );
    return [header, ...rows].join('\n');
  }

  private toSQL(records: MockRecord[]): string {
    if (!records.length) return '';
    const keys = Object.keys(records[0]);
    const cols = keys.join(', ');
    const rows = records.map(r => {
      const vals = keys.map(k => `'${(r[k] || '').replace(/'/g, "''")}'`).join(', ');
      return `INSERT INTO ${this.tableName} (${cols}) VALUES (${vals});`;
    });
    return rows.join('\n');
  }

  // ── Actions ────────────────────────────────────────────────────

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

  downloadOutput() {
    if (!this.output || !this.isBrowser) return;
    const ext = this.outputFormat === 'json' ? 'json' : this.outputFormat === 'csv' ? 'csv' : 'sql';
    const mime = this.outputFormat === 'json' ? 'application/json' : 'text/plain';
    const blob = new Blob([this.output], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mock-data.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  setFormat(f: OutputFormat) {
    this.outputFormat = f;
    if (this.generated) this.generate();
  }

  get recordCount(): number {
    if (!this.output) return 0;
    return this.quantity;
  }

  get outputLineCount(): number {
    if (!this.output) return 0;
    return this.output.split('\n').length;
  }
}
