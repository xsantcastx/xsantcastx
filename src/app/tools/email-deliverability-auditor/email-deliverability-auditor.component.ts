import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';
import { NgClass, TitleCasePipe } from '@angular/common';

export type RecordStatus = 'pass' | 'warn' | 'fail' | 'missing' | 'pending';

export interface SpfMechanism {
  qualifier: string;
  mechanism: string;
  value: string;
}

export interface SpfResult {
  raw: string;
  mechanisms: SpfMechanism[];
  status: RecordStatus;
  issues: string[];
  suggestions: string[];
  correctedRecord: string;
  includeDepth: number;
}

export interface DkimResult {
  selector: string;
  raw: string;
  keyLength: number;
  status: RecordStatus;
  issues: string[];
  suggestions: string[];
  correctedRecord: string;
}

export interface DmarcTag {
  tag: string;
  value: string;
  description: string;
}

export interface DmarcResult {
  raw: string;
  tags: DmarcTag[];
  policy: 'none' | 'quarantine' | 'reject' | 'missing';
  alignmentSpf: string;
  alignmentDkim: string;
  status: RecordStatus;
  issues: string[];
  suggestions: string[];
  correctedRecord: string;
}

export interface MxRecord {
  priority: number;
  hostname: string;
  resolvedIps: string[];
}

export interface MxResult {
  records: MxRecord[];
  status: RecordStatus;
  issues: string[];
  suggestions: string[];
}

export interface AuditResults {
  domain: string;
  spf: SpfResult | null;
  dkim: DkimResult[];
  dmarc: DmarcResult | null;
  mx: MxResult | null;
  score: number;
  scoreBreakdown: { spf: number; dkim: number; dmarc: number; mx: number };
  audited: boolean;
}

@Component({
    selector: 'app-email-deliverability-auditor',
    templateUrl: './email-deliverability-auditor.component.html',
    styleUrls: ['./email-deliverability-auditor.component.css'],
    imports: [ToolsSharedModule, FormsModule, NgClass, TitleCasePipe]
})
export class EmailDeliverabilityAuditorComponent implements OnInit, OnDestroy {
  private paramSub?: Subscription;

  domain = '';
  dkimSelectorInput = '';
  selectedDkimSelector = 'google';
  loading = false;
  error = '';
  results: AuditResults | null = null;
  activeDkimTab = 0;
  expandedAccordions: Record<string, boolean> = {};
  copiedSnippet: string | null = null;

  readonly commonSelectors = ['google', 'default', 'mail', 'dkim', 's1', 's2', 'k1', 'sendgrid', 'pm', 'mimecast'];

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Email Deliverability Auditor — instantly check SPF, DKIM, DMARC & MX records in your browser. No signup required 📧')}&url=${encodeURIComponent(SITE_URL + '/tools/email-deliverability-auditor')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/email-deliverability-auditor')}`;

  private readonly DOH_URL = 'https://cloudflare-dns.com/dns-query';

  constructor(
    private router: Router,
    private translationService: TranslationService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.paramSub = this.route.queryParams.subscribe(params => {
      if (params['domain']) {
        this.domain = params['domain'];
        this.runAudit();
      }
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  toggleAccordion(key: string): void {
    this.expandedAccordions[key] = !this.expandedAccordions[key];
  }

  isAccordionOpen(key: string): boolean {
    return !!this.expandedAccordions[key];
  }

  setDkimTab(index: number): void {
    this.activeDkimTab = index;
  }

  getScoreColor(score: number): string {
    if (score >= 80) return '#22c55e';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  }

  getScoreLabel(score: number): string {
    if (score >= 80) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Poor';
  }

  getStatusClass(status: RecordStatus): string {
    switch (status) {
      case 'pass': return 'badge--pass';
      case 'warn': return 'badge--warn';
      case 'fail': return 'badge--fail';
      case 'missing': return 'badge--missing';
      default: return 'badge--pending';
    }
  }

  getStatusIcon(status: RecordStatus): string {
    switch (status) {
      case 'pass': return '✓';
      case 'warn': return '⚠';
      case 'fail': return '✗';
      case 'missing': return '?';
      default: return '…';
    }
  }

  getDmarcPolicyClass(policy: string): string {
    switch (policy) {
      case 'reject': return 'policy--reject';
      case 'quarantine': return 'policy--quarantine';
      case 'none': return 'policy--none';
      default: return 'policy--missing';
    }
  }

  getScoreCircumference(): number {
    return 2 * Math.PI * 54;
  }

  getScoreDashOffset(score: number): number {
    const circumference = this.getScoreCircumference();
    return circumference - (score / 100) * circumference;
  }

  getAllFixes(): Array<{ title: string; snippet: string }> {
    const fixes: Array<{ title: string; snippet: string }> = [];
    if (this.results?.spf && this.results.spf.suggestions.length > 0) {
      fixes.push({ title: 'SPF Fix', snippet: this.results.spf.correctedRecord });
    }
    if (this.results?.dmarc && this.results.dmarc.suggestions.length > 0) {
      fixes.push({ title: 'DMARC Fix', snippet: this.results.dmarc.correctedRecord });
    }
    if (this.results?.dkim) {
      this.results.dkim.forEach(d => {
        if (d.suggestions.length > 0 && d.correctedRecord) {
          fixes.push({ title: `DKIM Fix (${d.selector})`, snippet: d.correctedRecord });
        }
      });
    }
    return fixes;
  }

  async copySnippet(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copiedSnippet = text;
      setTimeout(() => { this.copiedSnippet = null; }, 2000);
    } catch {
      this.copiedSnippet = null;
    }
  }

  isCopied(text: string): boolean {
    return this.copiedSnippet === text;
  }

  shareResultUrl(): string {
    return `${SITE_URL}/tools/email-deliverability-auditor?domain=${encodeURIComponent(this.domain)}`;
  }

  async copyShareUrl(): Promise<void> {
    await this.copySnippet(this.shareResultUrl());
  }

  onSubmit(): void {
    this.runAudit();
  }

  private normalizeDomain(raw: string): string {
    let d = raw.trim().toLowerCase();
    d = d.replace(/^https?:\/\//i, '');
    d = d.replace(/^www\./i, '');
    d = d.split('/')[0];
    return d;
  }

  private getSelectors(): string[] {
    const selectors = new Set<string>();
    selectors.add(this.selectedDkimSelector);
    if (this.dkimSelectorInput.trim()) {
      this.dkimSelectorInput.split(',').map(s => s.trim()).filter(Boolean).forEach(s => selectors.add(s));
    }
    this.commonSelectors.forEach(s => selectors.add(s));
    return Array.from(selectors).slice(0, 8);
  }

  async runAudit(): Promise<void> {
    if (!this.domain.trim()) {
      this.error = 'Please enter a domain name.';
      return;
    }
    const domain = this.normalizeDomain(this.domain);
    this.domain = domain;
    this.error = '';
    this.loading = true;
    this.results = null;
    this.activeDkimTab = 0;
    this.expandedAccordions = {};

    try {
      this.router.navigate([], { queryParams: { domain }, queryParamsHandling: 'merge', replaceUrl: true });

      const [spfRaw, dmarcRaw, mxRaw] = await Promise.all([
        this.queryDns(domain, 'TXT'),
        this.queryDns(`_dmarc.${domain}`, 'TXT'),
        this.queryDns(domain, 'MX')
      ]);

      const spfResult = this.parseSpf(spfRaw);
      const dmarcResult = this.parseDmarc(dmarcRaw);
      const mxResult = await this.parseMx(mxRaw);

      const selectors = this.getSelectors();
      const dkimResults: DkimResult[] = [];
      for (const selector of selectors) {
        const txt = await this.queryDns(`${selector}._domainkey.${domain}`, 'TXT');
        const result = this.parseDkim(txt, selector);
        if (result.status !== 'missing') {
          dkimResults.push(result);
        }
      }
      if (dkimResults.length === 0) {
        dkimResults.push(this.parseDkim([], this.selectedDkimSelector));
      }

      const scoreBreakdown = this.calculateScore(spfResult, dkimResults, dmarcResult, mxResult);
      const score = scoreBreakdown.spf + scoreBreakdown.dkim + scoreBreakdown.dmarc + scoreBreakdown.mx;

      this.results = {
        domain,
        spf: spfResult,
        dkim: dkimResults,
        dmarc: dmarcResult,
        mx: mxResult,
        score,
        scoreBreakdown,
        audited: true
      };
    } catch (e: any) {
      this.error = `Audit failed: ${e?.message || 'Unknown error. Please check the domain and try again.'}`;
    } finally {
      this.loading = false;
    }
  }

  private async queryDns(name: string, type: string): Promise<any[]> {
    const url = `${this.DOH_URL}?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;
    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/dns-json' }
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.Answer || [];
    } catch {
      return [];
    }
  }

  private parseSpf(answers: any[]): SpfResult {
    const txtRecords = answers
      .filter((a: any) => a.type === 16)
      .map((a: any) => (a.data as string).replace(/^"|"$/g, '').replace(/" "/g, ''));

    const spfRecord = txtRecords.find((r: string) => r.startsWith('v=spf1'));

    if (!spfRecord) {
      return {
        raw: '',
        mechanisms: [],
        status: 'missing',
        issues: ['No SPF record found for this domain.'],
        suggestions: ['Create a TXT record with your SPF policy, e.g.: v=spf1 include:_spf.google.com ~all'],
        correctedRecord: 'v=spf1 include:_spf.google.com ~all',
        includeDepth: 0
      };
    }

    const parts = spfRecord.split(/\s+/).filter(Boolean);
    const mechanisms: SpfMechanism[] = [];
    let includeCount = 0;
    const issues: string[] = [];
    const suggestions: string[] = [];

    for (const part of parts) {
      if (part === 'v=spf1') continue;
      let qualifier = '+';
      let rest = part;
      if (['+', '-', '~', '?'].includes(part[0])) {
        qualifier = part[0];
        rest = part.slice(1);
      }
      const colonIdx = rest.indexOf(':');
      let mech = rest;
      let val = '';
      if (colonIdx !== -1) {
        mech = rest.substring(0, colonIdx);
        val = rest.substring(colonIdx + 1);
      } else if (rest.includes('/')) {
        const slashIdx = rest.indexOf('/');
        mech = rest.substring(0, slashIdx);
        val = rest.substring(slashIdx);
      }
      if (mech === 'include') includeCount++;
      mechanisms.push({ qualifier, mechanism: mech, value: val });
    }

    const allMech = mechanisms.find(m => m.mechanism === 'all');
    let status: RecordStatus = 'pass';

    if (!allMech) {
      issues.push('SPF record has no "all" mechanism. Email servers may not know how to handle unlisted senders.');
      suggestions.push('Add ~all or -all to the end of your SPF record.');
      status = 'warn';
    } else if (allMech.qualifier === '+') {
      issues.push('"all" qualifier is "+all" which passes all senders — this effectively disables SPF protection.');
      suggestions.push('Change "+all" to "-all" (strict) or "~all" (soft-fail) to improve security.');
      status = 'fail';
    } else if (allMech.qualifier === '?') {
      issues.push('"?all" is neutral — provides no protection against spoofing.');
      suggestions.push('Change "?all" to "~all" or "-all".');
      status = 'warn';
    } else if (allMech.qualifier === '~') {
      if (status === 'pass') status = 'warn';
      issues.push('"~all" (softfail) is set — consider upgrading to "-all" for strict SPF enforcement.');
      suggestions.push('Change "~all" to "-all" once you have verified all sending sources.');
    }

    if (includeCount > 10) {
      issues.push(`SPF record has ${includeCount} include mechanisms which may exceed the 10 DNS lookup limit.`);
      suggestions.push('Flatten your SPF record or use a service like dmarcian SPF Flattener to reduce DNS lookups.');
      status = 'fail';
    } else if (includeCount > 7) {
      issues.push(`SPF record has ${includeCount} include lookups — approaching the 10 DNS lookup limit.`);
      suggestions.push('Consider flattening includes to reduce DNS lookups.');
      if (status === 'pass') status = 'warn';
    }

    const correctedRecord = allMech && allMech.qualifier === '-'
      ? spfRecord
      : spfRecord.replace(/[+?~-]?all$/, '-all').replace(/\s+all$/, ' -all') || (spfRecord + ' -all');

    return {
      raw: spfRecord,
      mechanisms,
      status: issues.length === 0 ? 'pass' : status,
      issues,
      suggestions,
      correctedRecord,
      includeDepth: includeCount
    };
  }

  private parseDkim(answers: any[], selector: string): DkimResult {
    const txtRecords = answers
      .filter((a: any) => a.type === 16)
      .map((a: any) => (a.data as string).replace(/^"|"$/g, '').replace(/" "/g, ''));

    const dkimRecord = txtRecords.find((r: string) => r.includes('v=DKIM1') || r.includes('p='));

    if (!dkimRecord) {
      return {
        selector,
        raw: '',
        keyLength: 0,
        status: 'missing',
        issues: [`No DKIM record found for selector "${selector}".`],
        suggestions: [`Set up DKIM signing for selector "${selector}" through your email provider and add the provided TXT record to your DNS.`],
        correctedRecord: ''
      };
    }

    const issues: string[] = [];
    const suggestions: string[] = [];
    let status: RecordStatus = 'pass';

    const pMatch = dkimRecord.match(/p=([A-Za-z0-9+/=]+)/);
    let keyLength = 0;
    if (pMatch && pMatch[1]) {
      try {
        const keyBytes = atob(pMatch[1]);
        keyLength = keyBytes.length * 8;
        if (keyLength < 1024) {
          issues.push(`DKIM key length appears to be ${keyLength} bits — shorter keys are considered insecure.`);
          suggestions.push('Rotate your DKIM key to at least 2048 bits for modern security standards.');
          status = 'fail';
        } else if (keyLength < 2048) {
          issues.push(`DKIM key is ${keyLength} bits — 2048 bits is the current recommendation.`);
          suggestions.push('Consider rotating your DKIM key to 2048 bits.');
          if (status === 'pass') status = 'warn';
        }
      } catch {
        keyLength = 0;
      }
    } else {
      issues.push('Could not find public key (p= tag) in DKIM record.');
      suggestions.push('Ensure the DKIM TXT record includes the p= tag with your public key.');
      status = 'fail';
    }

    if (!dkimRecord.includes('v=DKIM1')) {
      issues.push('DKIM record is missing v=DKIM1 version tag.');
      suggestions.push('Add v=DKIM1; to the beginning of your DKIM TXT record.');
      if (status === 'pass') status = 'warn';
    }

    return {
      selector,
      raw: dkimRecord,
      keyLength,
      status,
      issues,
      suggestions,
      correctedRecord: ''
    };
  }

  private parseDmarc(answers: any[]): DmarcResult {
    const txtRecords = answers
      .filter((a: any) => a.type === 16)
      .map((a: any) => (a.data as string).replace(/^"|"$/g, '').replace(/" "/g, ''));

    const dmarcRecord = txtRecords.find((r: string) => r.startsWith('v=DMARC1'));

    if (!dmarcRecord) {
      return {
        raw: '',
        tags: [],
        policy: 'missing',
        alignmentSpf: 'r',
        alignmentDkim: 'r',
        status: 'missing',
        issues: ['No DMARC record found at _dmarc.' + (this.domain || 'domain') + '.'],
        suggestions: ['Create a DMARC TXT record at _dmarc.yourdomain.com. Start with: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com'],
        correctedRecord: 'v=DMARC1; p=quarantine; adkim=s; aspf=s; rua=mailto:dmarc@yourdomain.com; pct=100'
      };
    }

    const tagDescriptions: Record<string, string> = {
      v: 'DMARC version',
      p: 'Policy for domain',
      sp: 'Policy for subdomains',
      rua: 'Aggregate report URI',
      ruf: 'Forensic report URI',
      adkim: 'DKIM alignment mode',
      aspf: 'SPF alignment mode',
      pct: 'Percentage of messages subjected to filtering',
      fo: 'Failure reporting options',
      rf: 'Report format',
      ri: 'Report interval'
    };

    const tags: DmarcTag[] = [];
    const parts = dmarcRecord.split(';').map((p: string) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      const tag = part.substring(0, eqIdx).trim();
      const value = part.substring(eqIdx + 1).trim();
      tags.push({ tag, value, description: tagDescriptions[tag] || tag });
    }

    const pTag = tags.find(t => t.tag === 'p');
    const adkimTag = tags.find(t => t.tag === 'adkim');
    const aspfTag = tags.find(t => t.tag === 'aspf');
    const ruaTag = tags.find(t => t.tag === 'rua');
    const pctTag = tags.find(t => t.tag === 'pct');

    const policy = (pTag?.value as 'none' | 'quarantine' | 'reject') || 'missing';
    const alignmentDkim = adkimTag?.value || 'r';
    const alignmentSpf = aspfTag?.value || 'r';

    const issues: string[] = [];
    const suggestions: string[] = [];
    let status: RecordStatus = 'pass';

    if (policy === 'none') {
      issues.push('DMARC policy is "none" — emails failing DMARC checks are not rejected or quarantined.');
      suggestions.push('Upgrade DMARC policy from p=none to p=quarantine then eventually p=reject after reviewing reports.');
      status = 'warn';
    } else if (policy === 'quarantine') {
      issues.push('DMARC policy is "quarantine" — failing emails go to spam. Consider upgrading to p=reject.');
      suggestions.push('After verifying your SPF/DKIM setup, upgrade to p=reject for maximum protection.');
      if (status === 'pass') status = 'warn';
    }

    if (!ruaTag) {
      issues.push('No aggregate report URI (rua=) set — you will not receive DMARC reports.');
      suggestions.push('Add rua=mailto:dmarc@yourdomain.com to receive aggregate reports and monitor your email authentication.');
      if (status === 'pass') status = 'warn';
    }

    if (alignmentDkim === 'r') {
      issues.push('DKIM alignment is "relaxed" — strict alignment (adkim=s) provides stronger protection.');
      suggestions.push('Set adkim=s in your DMARC record for strict DKIM alignment.');
      if (status === 'pass') status = 'warn';
    }

    if (alignmentSpf === 'r') {
      issues.push('SPF alignment is "relaxed" — strict alignment (aspf=s) provides stronger protection.');
      suggestions.push('Set aspf=s in your DMARC record for strict SPF alignment.');
      if (status === 'pass') status = 'warn';
    }

    const pctValue = pctTag ? parseInt(pctTag.value, 10) : 100;
    if (!isNaN(pctValue) && pctValue < 100) {
      issues.push(`DMARC pct=${pctValue} — only ${pctValue}% of messages are subject to DMARC filtering.`);
      suggestions.push('Set pct=100 to apply DMARC policy to all messages once you have verified your configuration.');
      if (status === 'pass') status = 'warn';
    }

    const correctedRecord = 'v=DMARC1; p=reject; adkim=s; aspf=s; rua=mailto:dmarc@yourdomain.com; pct=100';

    return {
      raw: dmarcRecord,
      tags,
      policy,
      alignmentSpf,
      alignmentDkim,
      status: issues.length === 0 ? 'pass' : status,
      issues,
      suggestions,
      correctedRecord
    };
  }

  private async parseMx(answers: any[]): Promise<MxResult> {
    const mxAnswers = answers.filter((a: any) => a.type === 15);

    if (mxAnswers.length === 0) {
      return {
        records: [],
        status: 'missing',
        issues: ['No MX records found for this domain. Emails cannot be delivered to this domain.'],
        suggestions: ['Add MX records pointing to your email provider\'s mail servers.']
      };
    }

    const records: MxRecord[] = [];
    const issues: string[] = [];
    const suggestions: string[] = [];
    let status: RecordStatus = 'pass';

    for (const answer of mxAnswers) {
      const parts = (answer.data as string).trim().split(/\s+/);
      const priority = parseInt(parts[0], 10);
      const hostname = (parts[1] || '').replace(/\.$/, '');
      let resolvedIps: string[] = [];
      try {
        const aAnswers = await this.queryDns(hostname, 'A');
        resolvedIps = aAnswers.filter((a: any) => a.type === 1).map((a: any) => a.data as string);
      } catch {
        resolvedIps = [];
      }
      records.push({ priority, hostname, resolvedIps });
    }

    records.sort((a, b) => a.priority - b.priority);

    if (records.length === 1) {
      issues.push('Only one MX record found — consider adding a backup MX record for redundancy.');
      suggestions.push('Add a secondary MX record with a higher priority number for failover.');
      if (status === 'pass') status = 'warn';
    }

    return {
      records,
      status: issues.length === 0 ? 'pass' : status,
      issues,
      suggestions
    };
  }

  private calculateScore(
    spf: SpfResult | null,
    dkim: DkimResult[],
    dmarc: DmarcResult | null,
    mx: MxResult | null
  ): { spf: number; dkim: number; dmarc: number; mx: number } {
    let spfScore = 0;
    if (spf) {
      if (spf.status === 'pass') spfScore = 30;
      else if (spf.status === 'warn') spfScore = 20;
      else if (spf.status === 'fail') spfScore = 5;
    }

    let dkimScore = 0;
    if (dkim.length > 0) {
      const best = dkim.find(d => d.status === 'pass') || dkim[0];
      if (best.status === 'pass') dkimScore = 25;
      else if (best.status === 'warn') dkimScore = 15;
      else if (best.status === 'fail') dkimScore = 5;
    }

    let dmarcScore = 0;
    if (dmarc) {
      if (dmarc.status === 'pass') dmarcScore = 35;
      else if (dmarc.status === 'warn') dmarcScore = 20;
      else if (dmarc.status === 'fail') dmarcScore = 5;
    }

    let mxScore = 0;
    if (mx) {
      if (mx.status === 'pass') mxScore = 10;
      else if (mx.status === 'warn') mxScore = 7;
      else if (mx.status === 'fail') mxScore = 2;
    }

    return { spf: spfScore, dkim: dkimScore, dmarc: dmarcScore, mx: mxScore };
  }
}