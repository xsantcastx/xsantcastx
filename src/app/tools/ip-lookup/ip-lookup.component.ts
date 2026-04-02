import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

type ActiveTab = 'myip' | 'validate' | 'subnet' | 'reference';

interface SubnetResult {
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  totalHosts: number;
  subnetMask: string;
  wildcardMask: string;
  cidr: number;
}

@Component({
  selector: 'app-ip-lookup',
  templateUrl: './ip-lookup.component.html',
  styleUrls: ['./ip-lookup.component.css'],
  standalone: false
})
export class IpLookupComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private fetchController: AbortController | null = null;

  // Tabs
  activeTab: ActiveTab = 'myip';

  // My IP
  publicIp = '';
  ipVersion = '';
  ipLoading = false;
  ipError = '';
  ipCopied = false;

  // Validator
  validateInput = '';
  validateResult: { valid: boolean; version: string; message: string } | null = null;

  // Subnet calculator
  subnetIp = '';
  subnetCidr = 24;
  subnetResult: SubnetResult | null = null;
  subnetError = '';

  // Reference data
  readonly privateRanges = [
    { range: '10.0.0.0/8',        class: 'A', hosts: '16,777,214',  description: 'Large enterprise networks' },
    { range: '172.16.0.0/12',     class: 'B', hosts: '1,048,574',   description: 'Medium-sized networks' },
    { range: '192.168.0.0/16',    class: 'C', hosts: '65,534',      description: 'Home & small office (most common)' },
    { range: '127.0.0.0/8',       class: '-', hosts: '16,777,214',  description: 'Loopback (localhost)' },
    { range: '169.254.0.0/16',    class: '-', hosts: '65,534',      description: 'Link-local (APIPA / auto-config)' },
    { range: '100.64.0.0/10',     class: '-', hosts: '4,194,302',   description: 'Carrier-grade NAT (CGNAT)' },
    { range: '192.0.0.0/24',      class: '-', hosts: '254',         description: 'IETF protocol assignments' },
    { range: '198.18.0.0/15',     class: '-', hosts: '131,070',     description: 'Benchmarking / testing' },
  ];

  readonly ipv6Reserved = [
    { range: '::1/128',           description: 'Loopback address' },
    { range: 'fc00::/7',          description: 'Unique local addresses (ULA)' },
    { range: 'fe80::/10',         description: 'Link-local addresses' },
    { range: 'ff00::/8',          description: 'Multicast addresses' },
    { range: '2001:db8::/32',     description: 'Documentation range' },
    { range: '::ffff:0:0/96',     description: 'IPv4-mapped IPv6 addresses' },
  ];

  constructor(private router: Router) {}

  ngOnInit() {
    if (this.isBrowser) {
      this.fetchPublicIp();
    }
  }

  ngOnDestroy() {
    if (this.fetchController) {
      this.fetchController.abort();
    }
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  setTab(tab: ActiveTab) {
    this.activeTab = tab;
  }

  // ── My IP ───────────────────────────────────────────────────────

  async fetchPublicIp() {
    if (!this.isBrowser) return;
    this.ipLoading = true;
    this.ipError = '';
    this.publicIp = '';
    this.ipVersion = '';

    this.fetchController = new AbortController();

    try {
      const res = await fetch('https://api.ipify.org?format=json', {
        signal: this.fetchController.signal
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.publicIp = data.ip;
      this.ipVersion = this.detectIpVersion(data.ip);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        // Fallback to api64 for IPv6
        try {
          const res2 = await fetch('https://api64.ipify.org?format=json');
          if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
          const data2 = await res2.json();
          this.publicIp = data2.ip;
          this.ipVersion = this.detectIpVersion(data2.ip);
        } catch {
          this.ipError = 'Could not detect your public IP. Check your connection or try again.';
        }
      }
    } finally {
      this.ipLoading = false;
      this.fetchController = null;
    }
  }

  async copyIp() {
    if (!this.publicIp || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.publicIp);
      this.ipCopied = true;
      setTimeout(() => (this.ipCopied = false), 2000);
    } catch {
      this.fallbackCopy(this.publicIp);
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
    this.ipCopied = true;
    setTimeout(() => (this.ipCopied = false), 2000);
  }

  // ── Validator ───────────────────────────────────────────────────

  onValidateInput() {
    const input = this.validateInput.trim();
    if (!input) {
      this.validateResult = null;
      return;
    }

    // Easter egg: localhost
    if (input === '127.0.0.1') {
      this.eggs.trigger('ip-localhost');
    }

    if (this.isValidIPv4(input)) {
      this.validateResult = { valid: true, version: 'IPv4', message: `Valid IPv4 address` };
    } else if (this.isValidIPv6(input)) {
      this.validateResult = { valid: true, version: 'IPv6', message: `Valid IPv6 address` };
    } else {
      this.validateResult = { valid: false, version: '-', message: 'Not a valid IPv4 or IPv6 address' };
    }
  }

  // ── Subnet Calculator ──────────────────────────────────────────

  calculateSubnet() {
    this.subnetError = '';
    this.subnetResult = null;

    const ip = this.subnetIp.trim();
    if (!ip) {
      this.subnetError = 'Please enter an IP address.';
      return;
    }

    if (!this.isValidIPv4(ip)) {
      this.subnetError = 'Please enter a valid IPv4 address for subnet calculation.';
      return;
    }

    const cidr = Math.floor(this.subnetCidr);
    if (cidr < 0 || cidr > 32) {
      this.subnetError = 'CIDR must be between 0 and 32.';
      return;
    }

    const ipNum = this.ipToNumber(ip);
    const mask = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
    const network = (ipNum & mask) >>> 0;
    const broadcast = (network | ~mask) >>> 0;

    const totalHosts = cidr >= 31 ? (cidr === 32 ? 1 : 2) : Math.pow(2, 32 - cidr) - 2;
    const firstHost = cidr >= 31 ? network : (network + 1) >>> 0;
    const lastHost = cidr >= 31 ? broadcast : (broadcast - 1) >>> 0;

    this.subnetResult = {
      network: this.numberToIp(network),
      broadcast: this.numberToIp(broadcast),
      firstHost: this.numberToIp(firstHost),
      lastHost: this.numberToIp(lastHost),
      totalHosts,
      subnetMask: this.numberToIp(mask),
      wildcardMask: this.numberToIp((~mask) >>> 0),
      cidr
    };
  }

  // ── IP Helpers ─────────────────────────────────────────────────

  private detectIpVersion(ip: string): string {
    if (ip.includes(':')) return 'IPv6';
    if (this.isValidIPv4(ip)) return 'IPv4';
    return 'Unknown';
  }

  private isValidIPv4(ip: string): boolean {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every(p => {
      if (!/^\d{1,3}$/.test(p)) return false;
      const n = parseInt(p, 10);
      return n >= 0 && n <= 255 && p === String(n);
    });
  }

  private isValidIPv6(ip: string): boolean {
    // Full and abbreviated IPv6 validation
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/;
    return ipv6Regex.test(ip);
  }

  private ipToNumber(ip: string): number {
    const parts = ip.split('.').map(Number);
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  }

  private numberToIp(num: number): string {
    return [
      (num >>> 24) & 255,
      (num >>> 16) & 255,
      (num >>> 8) & 255,
      num & 255
    ].join('.');
  }
}
