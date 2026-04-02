import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

type ActiveTab = 'lookup' | 'reference';

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  ttl: number;
  priority?: number;
}

interface DnsTypeOption {
  type: string;
  label: string;
  description: string;
  selected: boolean;
}

@Component({
  selector: 'app-dns-lookup',
  templateUrl: './dns-lookup.component.html',
  styleUrls: ['./dns-lookup.component.css'],
  standalone: false
})
export class DnsLookupComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private fetchControllers: AbortController[] = [];

  // Tabs
  activeTab: ActiveTab = 'lookup';

  // Domain input
  domain = '';
  isLoading = false;
  errorMessage = '';
  resultsCopied = false;

  // Records
  records: DnsRecord[] = [];
  queryTime = 0;
  queriedDomain = '';

  // Record type options
  recordTypes: DnsTypeOption[] = [
    { type: 'A',     label: 'A',     description: 'IPv4 address',           selected: true },
    { type: 'AAAA',  label: 'AAAA',  description: 'IPv6 address',           selected: true },
    { type: 'CNAME', label: 'CNAME', description: 'Canonical name alias',   selected: true },
    { type: 'MX',    label: 'MX',    description: 'Mail exchange',          selected: true },
    { type: 'NS',    label: 'NS',    description: 'Name server',            selected: true },
    { type: 'TXT',   label: 'TXT',   description: 'Text record',            selected: true },
    { type: 'SOA',   label: 'SOA',   description: 'Start of authority',     selected: true },
    { type: 'SRV',   label: 'SRV',   description: 'Service locator',        selected: true },
  ];

  // Select mode
  queryAllTypes = true;

  // DNS reference data
  readonly dnsExplanations = [
    { type: 'A',     name: 'Address Record',         description: 'Maps a domain to an IPv4 address (e.g. 93.184.216.34). The most fundamental DNS record type.' },
    { type: 'AAAA',  name: 'IPv6 Address Record',    description: 'Maps a domain to an IPv6 address (e.g. 2606:2800:220:1:248:1893:25c8:1946). Required for IPv6 connectivity.' },
    { type: 'CNAME', name: 'Canonical Name',          description: 'Creates an alias from one domain to another. Cannot coexist with other record types on the same name.' },
    { type: 'MX',    name: 'Mail Exchange',            description: 'Specifies mail servers for the domain with priority values. Lower priority = higher preference.' },
    { type: 'NS',    name: 'Name Server',              description: 'Delegates a DNS zone to authoritative name servers. Every domain must have at least two NS records.' },
    { type: 'TXT',   name: 'Text Record',              description: 'Holds arbitrary text data. Commonly used for SPF, DKIM, DMARC, domain verification, and more.' },
    { type: 'SOA',   name: 'Start of Authority',       description: 'Contains zone administration info: primary nameserver, admin email, serial number, and timing parameters.' },
    { type: 'SRV',   name: 'Service Record',            description: 'Defines the location (host + port) for specific services like SIP, XMPP, or LDAP with priority and weight.' },
  ];

  readonly commonTxtRecords = [
    { name: 'SPF',   example: 'v=spf1 include:_spf.google.com ~all', description: 'Sender Policy Framework - authorizes mail senders' },
    { name: 'DKIM',  example: 'v=DKIM1; k=rsa; p=MIGfMA0G...', description: 'DomainKeys Identified Mail - email authentication' },
    { name: 'DMARC', example: 'v=DMARC1; p=reject; rua=mailto:...', description: 'Domain-based Message Authentication reporting' },
    { name: 'Verification', example: 'google-site-verification=abc123...', description: 'Domain ownership proof for various services' },
  ];

  constructor(private router: Router) {}

  ngOnDestroy() {
    this.abortAllRequests();
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  setTab(tab: ActiveTab) {
    this.activeTab = tab;
  }

  // ── Query controls ─────────────────────────────────────────────

  toggleAllTypes() {
    this.queryAllTypes = !this.queryAllTypes;
    if (this.queryAllTypes) {
      this.recordTypes.forEach(rt => rt.selected = true);
    }
  }

  toggleRecordType(rt: DnsTypeOption) {
    rt.selected = !rt.selected;
    this.queryAllTypes = this.recordTypes.every(t => t.selected);
  }

  get selectedTypes(): DnsTypeOption[] {
    return this.queryAllTypes ? this.recordTypes : this.recordTypes.filter(rt => rt.selected);
  }

  get hasSelectedTypes(): boolean {
    return this.selectedTypes.length > 0;
  }

  // ── DNS Lookup ─────────────────────────────────────────────────

  async lookup() {
    if (!this.isBrowser) return;

    const rawDomain = this.domain.trim().toLowerCase();
    if (!rawDomain) {
      this.errorMessage = 'Please enter a domain name.';
      return;
    }

    // Strip protocol and paths
    let cleanDomain = rawDomain
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '');

    if (!this.isValidDomain(cleanDomain)) {
      this.errorMessage = 'Please enter a valid domain name (e.g. example.com).';
      return;
    }

    // Easter egg: localhost
    if (cleanDomain === 'localhost') {
      this.eggs.trigger('dns-localhost');
    }

    this.abortAllRequests();
    this.isLoading = true;
    this.errorMessage = '';
    this.records = [];
    this.queriedDomain = cleanDomain;
    this.resultsCopied = false;

    const startTime = performance.now();
    const typesToQuery = this.selectedTypes.map(t => t.type);
    const allRecords: DnsRecord[] = [];

    try {
      const promises = typesToQuery.map(type => this.queryDnsType(cleanDomain, type));
      const results = await Promise.allSettled(promises);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          allRecords.push(...result.value);
        }
      }

      this.queryTime = Math.round(performance.now() - startTime);
      this.records = allRecords;

      if (allRecords.length === 0) {
        this.errorMessage = `No DNS records found for "${cleanDomain}" with the selected record types.`;
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        this.errorMessage = 'DNS lookup failed. Please check the domain and try again.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  private async queryDnsType(domain: string, type: string): Promise<DnsRecord[]> {
    const controller = new AbortController();
    this.fetchControllers.push(controller);

    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/dns-json' },
      signal: controller.signal
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (!data.Answer || !Array.isArray(data.Answer)) return [];

    return data.Answer.map((answer: any) => {
      const record: DnsRecord = {
        type: this.dnsTypeNumberToString(answer.type),
        name: answer.name?.replace(/\.$/, '') || domain,
        value: answer.data || '',
        ttl: answer.TTL || 0,
      };

      // Extract priority from MX and SRV records
      if (record.type === 'MX' && record.value) {
        const parts = record.value.split(/\s+/);
        if (parts.length >= 2) {
          record.priority = parseInt(parts[0], 10);
          record.value = parts.slice(1).join(' ').replace(/\.$/, '');
        }
      }

      if (record.type === 'SRV' && record.value) {
        const parts = record.value.split(/\s+/);
        if (parts.length >= 4) {
          record.priority = parseInt(parts[0], 10);
          record.value = `weight:${parts[1]} port:${parts[2]} target:${parts[3].replace(/\.$/, '')}`;
        }
      }

      // Clean trailing dots from values
      record.value = record.value.replace(/\.$/, '');

      return record;
    });
  }

  private dnsTypeNumberToString(typeNum: number): string {
    const map: Record<number, string> = {
      1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA',
      15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV'
    };
    return map[typeNum] || `TYPE${typeNum}`;
  }

  private isValidDomain(domain: string): boolean {
    if (domain === 'localhost') return true;
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
    return domainRegex.test(domain);
  }

  private abortAllRequests() {
    this.fetchControllers.forEach(c => c.abort());
    this.fetchControllers = [];
  }

  // ── Helpers ────────────────────────────────────────────────────

  formatTtl(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  getTypeColor(type: string): string {
    const colors: Record<string, string> = {
      'A': 'var(--primary-color)',
      'AAAA': '#64d8ff',
      'CNAME': 'var(--secondary-color)',
      'MX': '#ff9f43',
      'NS': '#ff6b9d',
      'TXT': '#ffd93d',
      'SOA': '#6bcb77',
      'SRV': '#ee82ee',
    };
    return colors[type] || 'var(--text-muted)';
  }

  get recordsByType(): { type: string; records: DnsRecord[] }[] {
    const grouped = new Map<string, DnsRecord[]>();
    for (const record of this.records) {
      const existing = grouped.get(record.type) || [];
      existing.push(record);
      grouped.set(record.type, existing);
    }
    const typeOrder = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA', 'SRV'];
    return typeOrder
      .filter(t => grouped.has(t))
      .map(t => ({ type: t, records: grouped.get(t)! }))
      .concat(
        [...grouped.entries()]
          .filter(([t]) => !typeOrder.includes(t))
          .map(([type, records]) => ({ type, records }))
      );
  }

  // ── Copy results ───────────────────────────────────────────────

  async copyResults() {
    if (!this.isBrowser || this.records.length === 0) return;

    const lines = [`; DNS Records for ${this.queriedDomain}`, `; Query time: ${this.queryTime}ms`, ''];
    for (const record of this.records) {
      const priority = record.priority !== undefined ? `  priority:${record.priority}` : '';
      lines.push(`${record.name}\t${record.ttl}\tIN\t${record.type}\t${record.value}${priority}`);
    }

    const text = lines.join('\n');

    try {
      await navigator.clipboard.writeText(text);
      this.resultsCopied = true;
      setTimeout(() => (this.resultsCopied = false), 2000);
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
    this.resultsCopied = true;
    setTimeout(() => (this.resultsCopied = false), 2000);
  }

  // ── Actions ────────────────────────────────────────────────────

  clearAll() {
    this.domain = '';
    this.records = [];
    this.errorMessage = '';
    this.queriedDomain = '';
    this.queryTime = 0;
    this.isLoading = false;
    this.resultsCopied = false;
    this.abortAllRequests();
  }

  loadSample() {
    this.domain = 'google.com';
    this.queryAllTypes = true;
    this.recordTypes.forEach(rt => rt.selected = true);
    this.lookup();
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.lookup();
    }
  }

  get hasResults(): boolean {
    return this.records.length > 0;
  }
}
