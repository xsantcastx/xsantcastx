import { Component, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';

type EmailProvider = 'gmail' | 'sendgrid' | 'aws-ses' | 'mailchimp' | 'custom';
type DmarcPolicy = 'none' | 'quarantine' | 'reject';

interface ProviderPreset {
  label: string;
  spfInclude: string;
  dkimSelector: string;
  dkimDomain: string;
}

interface DiagnosticIssue {
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  fix: string;
}

interface DnsRecord {
  type: 'TXT' | 'CNAME';
  host: string;
  value: string;
  ttl: number;
  copied: boolean;
}

interface ValidationStatus {
  spf: 'valid' | 'invalid' | 'missing' | 'unknown';
  dkim: 'valid' | 'invalid' | 'missing' | 'unknown';
  dmarc: 'valid' | 'invalid' | 'missing' | 'unknown';
}

@Component({
  selector: 'app-gmail-deliverability-checker',
  templateUrl: './gmail-deliverability-checker.component.html',
  styleUrls: ['./gmail-deliverability-checker.component.css'],
  standalone: false
})
export class GmailDeliverabilityCheckerComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Inputs
  domainName = '';
  emailProvider: EmailProvider = 'gmail';
  existingSpfRecord = '';
  existingDkimPublicKey = '';

  // UI state
  hasScanned = false;
  isScanning = false;
  activeTab: 'spf' | 'dkim' | 'dmarc' = 'spf';
  error = '';

  // Generated records
  spfRecord: DnsRecord | null = null;
  dkimRecord: DnsRecord | null = null;
  dmarcRecord: DnsRecord | null = null;

  // Config options
  dmarcPolicy: DmarcPolicy = 'quarantine';
  dmarcRuaEmail = '';
  dmarcPct = 100;
  spfAllMechanism: '~all' | '-all' | '?all' = '~all';
  dkimSelector = 'google';
  customSpfIncludes = '';
  customIpList = '';

  // Status
  validationStatus: ValidationStatus = {
    spf: 'unknown',
    dkim: 'unknown',
    dmarc: 'unknown'
  };

  diagnosticIssues: DiagnosticIssue[] = [];

  implementationSteps: string[] = [];

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Gmail Deliverability Checker — diagnose email delivery issues and auto-generate SPF, DKIM, DMARC DNS records instantly 📧')}&url=${encodeURIComponent(SITE_URL + '/tools/gmail-deliverability-checker')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/gmail-deliverability-checker')}`;

  readonly providers: { value: EmailProvider; label: string }[] = [
    { value: 'gmail', label: 'Google Workspace / Gmail' },
    { value: 'sendgrid', label: 'SendGrid' },
    { value: 'aws-ses', label: 'Amazon SES' },
    { value: 'mailchimp', label: 'Mailchimp / Mandrill' },
    { value: 'custom', label: 'Custom / Other' }
  ];

  readonly dmarcPolicies: { value: DmarcPolicy; label: string; description: string }[] = [
    { value: 'none', label: 'None (Monitor)', description: 'No action taken, just monitoring. Safe to start with.' },
    { value: 'quarantine', label: 'Quarantine', description: 'Suspicious emails go to spam folder.' },
    { value: 'reject', label: 'Reject', description: 'Unauthenticated emails are rejected outright.' }
  ];

  readonly spfMechanisms: { value: '~all' | '-all' | '?all'; label: string; description: string }[] = [
    { value: '~all', label: 'SoftFail (~all)', description: 'Emails from unlisted sources are marked suspicious.' },
    { value: '-all', label: 'HardFail (-all)', description: 'Emails from unlisted sources are rejected.' },
    { value: '?all', label: 'Neutral (?all)', description: 'No policy applied for unlisted sources.' }
  ];

  private readonly providerPresets: Record<EmailProvider, ProviderPreset> = {
    gmail: {
      label: 'Google Workspace',
      spfInclude: 'include:_spf.google.com',
      dkimSelector: 'google',
      dkimDomain: 'domainkey.google.com'
    },
    sendgrid: {
      label: 'SendGrid',
      spfInclude: 'include:sendgrid.net',
      dkimSelector: 's1',
      dkimDomain: 'domainkey.sendgrid.net'
    },
    'aws-ses': {
      label: 'Amazon SES',
      spfInclude: 'include:amazonses.com',
      dkimSelector: 'amazonses',
      dkimDomain: 'dkim.amazonses.com'
    },
    mailchimp: {
      label: 'Mailchimp',
      spfInclude: 'include:servers.mcsv.net',
      dkimSelector: 'k1',
      dkimDomain: 'dkim.mcsv.net'
    },
    custom: {
      label: 'Custom',
      spfInclude: '',
      dkimSelector: 'mail',
      dkimDomain: ''
    }
  };

  constructor(private router: Router, private translationService: TranslationService) {}

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  onProviderChange(): void {
    const preset = this.providerPresets[this.emailProvider];
    this.dkimSelector = preset.dkimSelector;
  }

  isValidDomain(domain: string): boolean {
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return domainRegex.test(domain.trim());
  }

  scan(): void {
    this.error = '';
    const domain = this.domainName.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    this.domainName = domain;

    if (!domain) {
      this.error = 'Please enter a domain name.';
      return;
    }
    if (!this.isValidDomain(domain)) {
      this.error = 'Please enter a valid domain name (e.g. example.com).';
      return;
    }

    this.isScanning = true;
    this.hasScanned = false;
    this.diagnosticIssues = [];
    this.implementationSteps = [];

    // Simulate async DNS lookup
    setTimeout(() => {
      this.performAnalysis(domain);
      this.isScanning = false;
      this.hasScanned = true;
    }, 1200);
  }

  private performAnalysis(domain: string): void {
    this.analyzeExistingRecords();
    this.generateSpfRecord(domain);
    this.generateDkimRecord(domain);
    this.generateDmarcRecord(domain);
    this.buildDiagnosticIssues();
    this.buildImplementationSteps(domain);
  }

  private analyzeExistingRecords(): void {
    // SPF analysis
    if (!this.existingSpfRecord) {
      this.validationStatus.spf = 'missing';
    } else if (this.existingSpfRecord.startsWith('v=spf1')) {
      const hasMechanism = this.existingSpfRecord.includes('include:') || this.existingSpfRecord.includes('ip4:') || this.existingSpfRecord.includes('ip6:');
      const hasAll = this.existingSpfRecord.includes('all');
      this.validationStatus.spf = (hasMechanism && hasAll) ? 'valid' : 'invalid';
    } else {
      this.validationStatus.spf = 'invalid';
    }

    // DKIM analysis
    if (!this.existingDkimPublicKey) {
      this.validationStatus.dkim = 'missing';
    } else if (this.existingDkimPublicKey.includes('p=')) {
      this.validationStatus.dkim = 'valid';
    } else {
      this.validationStatus.dkim = 'invalid';
    }

    // DMARC always unknown until we generate
    this.validationStatus.dmarc = 'missing';
  }

  private generateSpfRecord(domain: string): void {
    const preset = this.providerPresets[this.emailProvider];
    const parts: string[] = ['v=spf1'];

    // Add provider include
    if (preset.spfInclude) {
      parts.push(preset.spfInclude);
    }

    // Add custom includes
    if (this.customSpfIncludes.trim()) {
      const includes = this.customSpfIncludes.split(',').map(s => s.trim()).filter(s => s);
      includes.forEach(inc => {
        const formatted = inc.startsWith('include:') ? inc : `include:${inc}`;
        parts.push(formatted);
      });
    }

    // Add custom IPs
    if (this.customIpList.trim()) {
      const ips = this.customIpList.split(',').map(s => s.trim()).filter(s => s);
      ips.forEach(ip => {
        if (ip.includes(':')) {
          parts.push(`ip6:${ip}`);
        } else {
          parts.push(`ip4:${ip}`);
        }
      });
    }

    parts.push(this.spfAllMechanism);

    this.spfRecord = {
      type: 'TXT',
      host: '@',
      value: parts.join(' '),
      ttl: 3600,
      copied: false
    };
  }

  private generateDkimRecord(domain: string): void {
    const selector = this.dkimSelector || this.providerPresets[this.emailProvider].dkimSelector;

    let dkimValue: string;

    if (this.existingDkimPublicKey && this.existingDkimPublicKey.includes('p=')) {
      // Use provided key
      const keyData = this.existingDkimPublicKey
        .replace(/-----BEGIN PUBLIC KEY-----/, '')
        .replace(/-----END PUBLIC KEY-----/, '')
        .replace(/\s+/g, '');
      dkimValue = `v=DKIM1; k=rsa; p=${keyData}`;
    } else if (this.emailProvider !== 'custom') {
      // Provider-specific CNAME
      const preset = this.providerPresets[this.emailProvider];
      this.dkimRecord = {
        type: 'CNAME',
        host: `${selector}._domainkey`,
        value: `${selector}._domainkey.${preset.dkimDomain}`,
        ttl: 3600,
        copied: false
      };
      return;
    } else {
      // Placeholder for custom
      dkimValue = `v=DKIM1; k=rsa; p=<YOUR_PUBLIC_KEY_HERE>`;
    }

    this.dkimRecord = {
      type: 'TXT',
      host: `${selector}._domainkey`,
      value: dkimValue,
      ttl: 3600,
      copied: false
    };
  }

  private generateDmarcRecord(domain: string): void {
    let value = `v=DMARC1; p=${this.dmarcPolicy}; pct=${this.dmarcPct}`;

    if (this.dmarcRuaEmail.trim()) {
      value += `; rua=mailto:${this.dmarcRuaEmail.trim()}`;
    } else {
      value += `; rua=mailto:dmarc-reports@${domain}`;
    }

    value += `; sp=${this.dmarcPolicy}; adkim=r; aspf=r`;

    this.dmarcRecord = {
      type: 'TXT',
      host: '_dmarc',
      value,
      ttl: 3600,
      copied: false
    };

    this.validationStatus.dmarc = 'valid';
  }

  private buildDiagnosticIssues(): void {
    this.diagnosticIssues = [];

    if (this.validationStatus.spf === 'missing') {
      this.diagnosticIssues.push({
        severity: 'error',
        title: 'Missing SPF Record',
        description: 'No SPF record found for this domain. Emails may be rejected or marked as spam by receiving servers.',
        fix: 'Add the generated SPF TXT record to your DNS at the root (@) of your domain.'
      });
    } else if (this.validationStatus.spf === 'invalid') {
      this.diagnosticIssues.push({
        severity: 'warning',
        title: 'Invalid SPF Record',
        description: 'Your existing SPF record appears malformed or incomplete.',
        fix: 'Replace your current SPF record with the generated one below.'
      });
    }

    if (this.validationStatus.dkim === 'missing') {
      this.diagnosticIssues.push({
        severity: 'error',
        title: 'Missing DKIM Record',
        description: 'DKIM signing is not configured. Gmail requires DKIM for optimal deliverability.',
        fix: 'Add the generated DKIM record to your DNS provider and enable DKIM signing in your email platform.'
      });
    } else if (this.validationStatus.dkim === 'invalid') {
      this.diagnosticIssues.push({
        severity: 'warning',
        title: 'DKIM Key Format Issue',
        description: 'The provided DKIM public key may be incorrectly formatted.',
        fix: 'Ensure your DKIM key begins with p= and contains only the base64-encoded public key.'
      });
    }

    if (this.validationStatus.dmarc === 'missing') {
      this.diagnosticIssues.push({
        severity: 'warning',
        title: 'Missing DMARC Record',
        description: 'No DMARC policy found. Without DMARC, your domain is vulnerable to spoofing.',
        fix: 'Add the generated DMARC TXT record at _dmarc subdomain of your domain.'
      });
    }

    if (this.dmarcPolicy === 'none') {
      this.diagnosticIssues.push({
        severity: 'info',
        title: 'DMARC in Monitor Mode',
        description: 'Your DMARC policy is set to "none" which only monitors without taking action.',
        fix: 'After reviewing DMARC reports for 2-4 weeks, upgrade policy to "quarantine" or "reject".'
      });
    }

    if (this.spfAllMechanism === '?all') {
      this.diagnosticIssues.push({
        severity: 'warning',
        title: 'Neutral SPF Policy',
        description: 'Using ?all (neutral) provides no protection against unauthorized senders.',
        fix: 'Switch to ~all (softfail) or -all (hardfail) for better protection.'
      });
    }

    if (!this.dmarcRuaEmail.trim()) {
      this.diagnosticIssues.push({
        severity: 'info',
        title: 'No DMARC Reporting Email',
        description: 'Without a reporting email, you won\'t receive DMARC aggregate reports to monitor authentication failures.',
        fix: 'Add a valid email address in the DMARC configuration to receive daily reports.'
      });
    }

    if (this.existingSpfRecord && this.countSpfLookups(this.existingSpfRecord) > 10) {
      this.diagnosticIssues.push({
        severity: 'error',
        title: 'SPF Lookup Limit Exceeded',
        description: 'SPF records are limited to 10 DNS lookups. Exceeding this causes SPF to fail.',
        fix: 'Consolidate your SPF includes or use an SPF flattening service to reduce lookups.'
      });
    }
  }

  private countSpfLookups(spf: string): number {
    const lookupMechanisms = ['include:', 'a', 'mx', 'ptr', 'exists:', 'redirect='];
    return lookupMechanisms.reduce((count, m) => {
      return count + (spf.split(m).length - 1);
    }, 0);
  }

  private buildImplementationSteps(domain: string): void {
    this.implementationSteps = [
      `Log in to your DNS provider (e.g., Cloudflare, Route53, Namecheap) for domain "${domain}".`,
      'Navigate to DNS Management / DNS Records section.',
      'Add the SPF TXT record at the root (@) of your domain. If an SPF record already exists, replace it — you can only have one SPF record.',
      `Add the DKIM ${this.dkimRecord?.type} record at host "${this.dkimRecord?.host}" with the value shown below.`,
      'Add the DMARC TXT record at "_dmarc" subdomain of your domain.',
      'Wait for DNS propagation (typically 15 minutes to 24 hours).',
      'Send a test email to a Gmail address and check the email headers for "Authentication-Results" to confirm SPF, DKIM, and DMARC all pass.',
      'Monitor your DMARC reports (sent to your rua email) for the first 30 days.',
      'Once reports confirm clean authentication, upgrade DMARC policy from "quarantine" to "reject" for maximum protection.',
      'Test your deliverability using tools like mail-tester.com or Google Postmaster Tools.'
    ];
  }

  regenerate(): void {
    if (this.domainName && this.isValidDomain(this.domainName)) {
      this.performAnalysis(this.domainName);
    }
  }

  copyRecord(record: DnsRecord): void {
    if (!this.isBrowser) return;
    const text = `Type: ${record.type}\nHost: ${record.host}\nValue: ${record.value}\nTTL: ${record.ttl}`;
    navigator.clipboard.writeText(text).then(() => {
      record.copied = true;
      setTimeout(() => { record.copied = false; }, 2000);
    }).catch(() => {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      record.copied = true;
      setTimeout(() => { record.copied = false; }, 2000);
    });
  }

  copyValue(record: DnsRecord): void {
    if (!this.isBrowser) return;
    navigator.clipboard.writeText(record.value).then(() => {
      record.copied = true;
      setTimeout(() => { record.copied = false; }, 2000);
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = record.value;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      record.copied = true;
      setTimeout(() => { record.copied = false; }, 2000);
    });
  }

  getStatusIcon(status: 'valid' | 'invalid' | 'missing' | 'unknown'): string {
    switch (status) {
      case 'valid': return '✓';
      case 'invalid': return '✗';
      case 'missing': return '!';
      default: return '?';
    }
  }

  getStatusClass(status: 'valid' | 'invalid' | 'missing' | 'unknown'): string {
    switch (status) {
      case 'valid': return 'status--valid';
      case 'invalid': return 'status--invalid';
      case 'missing': return 'status--missing';
      default: return 'status--unknown';
    }
  }

  getSeverityClass(severity: 'error' | 'warning' | 'info'): string {
    switch (severity) {
      case 'error': return 'issue--error';
      case 'warning': return 'issue--warning';
      case 'info': return 'issue--info';
    }
  }

  getSeverityIcon(severity: 'error' | 'warning' | 'info'): string {
    switch (severity) {
      case 'error': return '✗';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
    }
  }

  get errorCount(): number {
    return this.diagnosticIssues.filter(i => i.severity === 'error').length;
  }

  get warningCount(): number {
    return this.diagnosticIssues.filter(i => i.severity === 'warning').length;
  }

  get overallScore(): number {
    let score = 100;
    score -= this.diagnosticIssues.filter(i => i.severity === 'error').length * 30;
    score -= this.diagnosticIssues.filter(i => i.severity === 'warning').length * 10;
    return Math.max(0, Math.min(100, score));
  }

  get scoreClass(): string {
    const score = this.overallScore;
    if (score >= 80) return 'score--good';
    if (score >= 50) return 'score--fair';
    return 'score--poor';
  }

  get activeRecord(): DnsRecord | null {
    if (this.activeTab === 'spf') return this.spfRecord;
    if (this.activeTab === 'dkim') return this.dkimRecord;
    if (this.activeTab === 'dmarc') return this.dmarcRecord;
    return null;
  }

  setActiveTab(tab: 'spf' | 'dkim' | 'dmarc'): void {
    this.activeTab = tab;
  }
}