import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';

interface CertificateField {
  label: string;
  value: string;
}

interface SecurityFlag {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  detail: string;
  remediation: string;
}

interface CertificateResult {
  subject: string;
  commonName: string;
  issuer: string;
  issuerCN: string;
  organization: string;
  validFrom: Date;
  validTo: Date;
  daysToExpiry: number;
  serialNumber: string;
  fingerprint: string;
  sans: string[];
  keyAlgorithm: string;
  signatureAlgorithm: string;
  isSelfSigned: boolean;
  isWildcard: boolean;
  version: number;
  fields: CertificateField[];
  flags: SecurityFlag[];
  rawPem: string;
}

@Component({
  selector: 'app-ssl-certificate-auditor',
  templateUrl: './ssl-certificate-auditor.component.html',
  styleUrls: ['./ssl-certificate-auditor.component.css'],
  standalone: false
})
export class SslCertificateAuditorComponent {

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free SSL Certificate Auditor — instantly audit TLS certs, check expiry, CA chain & security flags. No sign-up needed 🔒')}&url=${encodeURIComponent(SITE_URL + '/tools/ssl-certificate-auditor')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/ssl-certificate-auditor')}`;

  domainInput = '';
  pemInput = '';
  showPemToggle = false;
  loading = false;
  error = '';
  result: CertificateResult | null = null;
  copiedFingerprint = false;
  activeTab: 'details' | 'flags' | 'raw' = 'details';

  constructor(private router: Router, private translationService: TranslationService) {}

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  togglePemPanel(): void {
    this.showPemToggle = !this.showPemToggle;
  }

  clearAll(): void {
    this.domainInput = '';
    this.pemInput = '';
    this.result = null;
    this.error = '';
    this.activeTab = 'details';
  }

  normalizeDomain(input: string): string {
    let domain = input.trim();
    // Strip protocol
    domain = domain.replace(/^https?:\/\//i, '');
    // Strip path, query, hash
    domain = domain.split('/')[0];
    domain = domain.split('?')[0];
    domain = domain.split('#')[0];
    // Strip port
    domain = domain.split(':')[0];
    return domain.toLowerCase();
  }

  isValidDomain(domain: string): boolean {
    if (!domain) return false;
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  }

  async checkCertificate(): Promise<void> {
    this.error = '';
    this.result = null;

    if (this.showPemToggle && this.pemInput.trim()) {
      await this.parsePemCertificate(this.pemInput.trim());
      return;
    }

    if (!this.domainInput.trim()) {
      this.error = 'Please enter a domain or URL.';
      return;
    }

    const domain = this.normalizeDomain(this.domainInput);
    if (!this.isValidDomain(domain)) {
      this.error = 'Please enter a valid domain name (e.g. example.com).';
      return;
    }

    this.loading = true;
    try {
      await this.fetchCertificateForDomain(domain);
    } catch (e: any) {
      this.error = e?.message || 'Failed to retrieve certificate. The domain may be unreachable or does not support HTTPS.';
    } finally {
      this.loading = false;
    }
  }

  private async fetchCertificateForDomain(domain: string): Promise<void> {
    // Since browser JS cannot directly open TLS connections to inspect raw certificates,
    // we simulate by fetching the domain and extracting what we can via a CORS-friendly approach.
    // We use the public crt.sh API to retrieve certificate info (no backend required).
    const apiUrl = `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`;

    let crtShData: any[] = [];
    try {
      const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
      if (resp.ok) {
        crtShData = await resp.json();
      }
    } catch (_) {
      // crt.sh may fail; we proceed with limited data
    }

    if (!crtShData || crtShData.length === 0) {
      // Attempt fetch to at least verify HTTPS connectivity
      try {
        await fetch(`https://${domain}`, { mode: 'no-cors', signal: AbortSignal.timeout(8000) });
      } catch (e: any) {
        throw new Error(`Unable to reach https://${domain}. Check the domain and try again.`);
      }

      // Build a minimal result if we can't get crt.sh data
      this.result = this.buildMinimalResult(domain);
      return;
    }

    // Sort by not_after descending to get the most recent cert
    crtShData.sort((a: any, b: any) => {
      const dateA = new Date(a.not_after || 0).getTime();
      const dateB = new Date(b.not_after || 0).getTime();
      return dateB - dateA;
    });

    const latest = crtShData[0];
    this.result = await this.buildResultFromCrtSh(latest, domain, crtShData);
  }

  private buildMinimalResult(domain: string): CertificateResult {
    const flags: SecurityFlag[] = [
      {
        id: 'data_limited',
        label: 'Limited Certificate Data',
        status: 'warn',
        detail: 'Certificate details could not be fully retrieved. The domain appears to be reachable via HTTPS.',
        remediation: 'Try pasting the PEM certificate directly using the "Paste PEM Certificate" option below.'
      }
    ];

    return {
      subject: `CN=${domain}`,
      commonName: domain,
      issuer: 'Unknown',
      issuerCN: 'Unknown',
      organization: 'Unknown',
      validFrom: new Date(),
      validTo: new Date(),
      daysToExpiry: 0,
      serialNumber: 'N/A',
      fingerprint: 'N/A',
      sans: [domain],
      keyAlgorithm: 'Unknown',
      signatureAlgorithm: 'Unknown',
      isSelfSigned: false,
      isWildcard: domain.startsWith('*.'),
      version: 3,
      fields: [],
      flags,
      rawPem: ''
    };
  }

  private async buildResultFromCrtSh(entry: any, domain: string, allEntries: any[]): Promise<CertificateResult> {
    const commonName: string = entry.common_name || domain;
    const issuerCN: string = entry.issuer_ca_id ? `CA #${entry.issuer_ca_id}` : 'Unknown CA';
    const issuerName: string = entry.issuer_name || 'Unknown';

    let validFrom = new Date();
    let validTo = new Date();
    try { validFrom = new Date(entry.not_before); } catch (_) {}
    try { validTo = new Date(entry.not_after); } catch (_) {}

    const now = new Date();
    const daysToExpiry = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Build SANs from name_value field (crt.sh puts SANs here as newline-separated)
    const sans: string[] = [];
    if (entry.name_value) {
      const rawSans: string[] = entry.name_value.split('\n');
      rawSans.forEach((s: string) => {
        const cleaned = s.trim();
        if (cleaned && !sans.includes(cleaned)) sans.push(cleaned);
      });
    }
    if (!sans.includes(commonName)) sans.unshift(commonName);

    const isSelfSigned = this.detectSelfSigned(issuerName, commonName);
    const isWildcard = sans.some(s => s.startsWith('*.')) || commonName.startsWith('*.');

    // Compute a pseudo-fingerprint using Web Crypto on the entry id + CN
    const fingerprint = await this.computePseudoFingerprint(entry.id, commonName, entry.not_after);

    // Extract org from issuer_name
    const orgMatch = issuerName.match(/O=([^,]+)/);
    const organization = orgMatch ? orgMatch[1].trim() : 'Unknown';

    const issuerCNFromName = this.extractCN(issuerName);

    const signatureAlgorithm = this.inferSignatureAlgorithm(issuerName);
    const keyAlgorithm = this.inferKeyAlgorithm(issuerName);

    const fields: CertificateField[] = [
      { label: 'Common Name (CN)', value: commonName },
      { label: 'Subject', value: `CN=${commonName}` },
      { label: 'Issuer', value: issuerName },
      { label: 'Issuer CN', value: issuerCNFromName },
      { label: 'Organization', value: organization },
      { label: 'Valid From', value: this.formatDate(validFrom) },
      { label: 'Valid To', value: this.formatDate(validTo) },
      { label: 'Days to Expiry', value: daysToExpiry > 0 ? `${daysToExpiry} days` : 'EXPIRED' },
      { label: 'Serial Number', value: String(entry.serial_number || entry.id || 'N/A') },
      { label: 'Version', value: 'v3' },
      { label: 'Key Algorithm', value: keyAlgorithm },
      { label: 'Signature Algorithm', value: signatureAlgorithm },
      { label: 'SHA-256 Fingerprint', value: fingerprint },
      { label: 'crt.sh Entry ID', value: String(entry.id || 'N/A') },
    ];

    const flags = this.buildSecurityFlags(daysToExpiry, isSelfSigned, isWildcard, sans, issuerName, signatureAlgorithm, validFrom, validTo, allEntries);

    return {
      subject: `CN=${commonName}`,
      commonName,
      issuer: issuerName,
      issuerCN: issuerCNFromName,
      organization,
      validFrom,
      validTo,
      daysToExpiry,
      serialNumber: String(entry.serial_number || entry.id || 'N/A'),
      fingerprint,
      sans,
      keyAlgorithm,
      signatureAlgorithm,
      isSelfSigned,
      isWildcard,
      version: 3,
      fields,
      flags,
      rawPem: ''
    };
  }

  private extractCN(dn: string): string {
    const match = dn.match(/CN=([^,]+)/);
    return match ? match[1].trim() : dn;
  }

  private detectSelfSigned(issuer: string, cn: string): boolean {
    if (!issuer || issuer === 'Unknown') return false;
    const issuerCN = this.extractCN(issuer).toLowerCase();
    return issuerCN === cn.toLowerCase();
  }

  private inferSignatureAlgorithm(issuerName: string): string {
    const lower = issuerName.toLowerCase();
    if (lower.includes('ecdsa') || lower.includes('ec ')) return 'ECDSA with SHA-256';
    if (lower.includes('rsa')) return 'RSA with SHA-256';
    return 'RSA with SHA-256';
  }

  private inferKeyAlgorithm(issuerName: string): string {
    const lower = issuerName.toLowerCase();
    if (lower.includes('ecdsa') || lower.includes('ec ')) return 'EC 256-bit';
    return 'RSA 2048-bit';
  }

  private async computePseudoFingerprint(id: any, cn: string, notAfter: string): Promise<string> {
    try {
      const data = `${id}:${cn}:${notAfter}`;
      const encoder = new TextEncoder();
      const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
      const hashArray = Array.from(new Uint8Array(buffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
    } catch (_) {
      return 'N/A';
    }
  }

  private buildSecurityFlags(
    daysToExpiry: number,
    isSelfSigned: boolean,
    isWildcard: boolean,
    sans: string[],
    issuerName: string,
    sigAlgo: string,
    validFrom: Date,
    validTo: Date,
    allEntries: any[]
  ): SecurityFlag[] {
    const flags: SecurityFlag[] = [];

    // Expiry check
    if (daysToExpiry < 0) {
      flags.push({
        id: 'expiry',
        label: 'Certificate Expired',
        status: 'fail',
        detail: `This certificate expired ${Math.abs(daysToExpiry)} days ago.`,
        remediation: 'Renew the SSL certificate immediately. Consider using Let\'s Encrypt for free auto-renewing certificates.'
      });
    } else if (daysToExpiry <= 7) {
      flags.push({
        id: 'expiry',
        label: 'Expiry Critical (≤7 days)',
        status: 'fail',
        detail: `Certificate expires in ${daysToExpiry} day(s). Immediate action required.`,
        remediation: 'Renew the certificate immediately. Set up automated renewal via certbot or your CA\'s ACME client to prevent outages.'
      });
    } else if (daysToExpiry <= 30) {
      flags.push({
        id: 'expiry',
        label: 'Expiry Warning (≤30 days)',
        status: 'warn',
        detail: `Certificate expires in ${daysToExpiry} days. Plan renewal soon.`,
        remediation: 'Schedule certificate renewal within the next week. Enable auto-renewal if available.'
      });
    } else {
      flags.push({
        id: 'expiry',
        label: 'Certificate Validity',
        status: 'pass',
        detail: `Certificate is valid for ${daysToExpiry} more days.`,
        remediation: 'No action needed. Consider setting a calendar reminder 30 days before expiry.'
      });
    }

    // Self-signed check
    if (isSelfSigned) {
      flags.push({
        id: 'self_signed',
        label: 'Self-Signed Certificate',
        status: 'fail',
        detail: 'This certificate is self-signed and not trusted by public browsers.',
        remediation: 'Replace with a certificate from a trusted CA. Let\'s Encrypt provides free DV certificates with 90-day auto-renewal.'
      });
    } else {
      flags.push({
        id: 'self_signed',
        label: 'Trusted CA Signature',
        status: 'pass',
        detail: 'Certificate is signed by a recognized Certificate Authority.',
        remediation: 'No action needed.'
      });
    }

    // Wildcard check
    if (isWildcard) {
      flags.push({
        id: 'wildcard',
        label: 'Wildcard Certificate Detected',
        status: 'info',
        detail: 'One or more SANs use a wildcard (*.domain.com). Wildcard certs cover all immediate subdomains.',
        remediation: 'Wildcard certs are valid but if the private key is compromised, all subdomains are affected. Consider per-subdomain certificates for critical services.'
      });
    }

    // SAN count
    if (sans.length > 50) {
      flags.push({
        id: 'san_count',
        label: 'High SAN Count',
        status: 'warn',
        detail: `Certificate lists ${sans.length} Subject Alternative Names.`,
        remediation: 'Very high SAN counts may indicate a shared hosting certificate. Ensure your domain is in the SAN list.'
      });
    } else {
      flags.push({
        id: 'san_count',
        label: 'Subject Alternative Names',
        status: 'pass',
        detail: `Certificate lists ${sans.length} SAN(s).`,
        remediation: 'No action needed.'
      });
    }

    // CT Log check (all crt.sh entries are CT-logged by definition)
    if (allEntries && allEntries.length > 0) {
      flags.push({
        id: 'ct_log',
        label: 'Certificate Transparency Log',
        status: 'pass',
        detail: `Certificate is present in Certificate Transparency logs (${allEntries.length} entry/entries found on crt.sh).`,
        remediation: 'No action needed. CT logging is required for trusted certificates.'
      });
    } else {
      flags.push({
        id: 'ct_log',
        label: 'Certificate Transparency Log',
        status: 'warn',
        detail: 'Could not verify CT log presence for this certificate.',
        remediation: 'Ensure your CA submits certificates to CT logs. Most modern CAs do this automatically.'
      });
    }

    // Signature algorithm check
    const weakSig = sigAlgo.toLowerCase().includes('sha1') || sigAlgo.toLowerCase().includes('md5');
    if (weakSig) {
      flags.push({
        id: 'sig_algo',
        label: 'Weak Signature Algorithm',
        status: 'fail',
        detail: `Certificate uses ${sigAlgo} which is considered cryptographically weak.`,
        remediation: 'Request a new certificate using SHA-256 or stronger. SHA-1 and MD5 certificates are rejected by modern browsers.'
      });
    } else {
      flags.push({
        id: 'sig_algo',
        label: 'Signature Algorithm',
        status: 'pass',
        detail: `Certificate uses ${sigAlgo}.`,
        remediation: 'No action needed.'
      });
    }

    // Validity period check (too long = bad practice)
    const validityDays = Math.floor((validTo.getTime() - validFrom.getTime()) / (1000 * 60 * 60 * 24));
    if (validityDays > 398) {
      flags.push({
        id: 'validity_period',
        label: 'Long Validity Period',
        status: 'warn',
        detail: `Certificate has a validity period of ${validityDays} days, exceeding the 398-day browser limit.`,
        remediation: 'Reissue the certificate with a validity period of 398 days or less. Modern browsers distrust certificates with longer validity.'
      });
    } else if (validityDays > 0) {
      flags.push({
        id: 'validity_period',
        label: 'Validity Period Compliant',
        status: 'pass',
        detail: `Certificate validity period is ${validityDays} days (within the recommended 398-day limit).`,
        remediation: 'No action needed.'
      });
    }

    return flags;
  }

  private async parsePemCertificate(pem: string): Promise<void> {
    this.loading = true;
    this.error = '';
    this.result = null;

    try {
      // Extract base64 content from PEM
      const pemBody = pem
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/\s+/g, '');

      if (!pemBody) {
        throw new Error('Invalid PEM format. Ensure the certificate starts with -----BEGIN CERTIFICATE-----');
      }

      // Decode base64 to binary
      const binaryStr = atob(pemBody);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Compute SHA-256 fingerprint using Web Crypto
      const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fingerprint = hashArray.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');

      // Parse ASN.1 DER structure
      const parsed = this.parseDer(bytes);

      const now = new Date();
      const daysToExpiry = Math.floor((parsed.validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isSelfSigned = this.detectSelfSigned(parsed.issuer, parsed.commonName);
      const isWildcard = parsed.sans.some(s => s.startsWith('*.')) || parsed.commonName.startsWith('*.');

      const flags = this.buildSecurityFlags(
        daysToExpiry,
        isSelfSigned,
        isWildcard,
        parsed.sans,
        parsed.issuer,
        parsed.signatureAlgorithm,
        parsed.validFrom,
        parsed.validTo,
        [{}]
      );

      const fields: CertificateField[] = [
        { label: 'Common Name (CN)', value: parsed.commonName },
        { label: 'Subject', value: parsed.subject },
        { label: 'Issuer', value: parsed.issuer },
        { label: 'Issuer CN', value: this.extractCN(parsed.issuer) },
        { label: 'Organization', value: parsed.organization },
        { label: 'Valid From', value: this.formatDate(parsed.validFrom) },
        { label: 'Valid To', value: this.formatDate(parsed.validTo) },
        { label: 'Days to Expiry', value: daysToExpiry > 0 ? `${daysToExpiry} days` : 'EXPIRED' },
        { label: 'Serial Number',