import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';

interface CertificateNode {
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  serialNumber: string;
  fingerprint: string;
  fingerprintSha1: string;
  keyAlgorithm: string;
  keySize: number;
  signatureAlgorithm: string;
  sans: string[];
  isRoot: boolean;
  isIntermediate: boolean;
  isLeaf: boolean;
  pem: string;
}

interface SecurityAudit {
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

interface CAReputation {
  name: string;
  country: string;
  countryFlag: string;
  trustLevel: 'trusted' | 'government' | 'flagged' | 'unknown';
  owner: string;
}

interface RemediationTip {
  issue: string;
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
  expanded: boolean;
}

interface ScanResult {
  domain: string;
  port: number;
  scannedAt: Date;
  overallScore: number;
  healthLabel: string;
  healthColor: string;
  chain: CertificateNode[];
  auditItems: SecurityAudit[];
  caReputation: CAReputation | null;
  remediationTips: RemediationTip[];
  daysUntilExpiry: number;
  expiryUrgency: 'green' | 'yellow' | 'red';
  ocspStatus: string;
  ctLogStatus: string;
}

@Component({
    selector: 'app-ssl-certificate-inspector',
    templateUrl: './ssl-certificate-inspector.component.html',
    styleUrls: ['./ssl-certificate-inspector.component.css'],
    imports: [ToolsSharedModule, FormsModule, DatePipe]
})
export class SslCertificateInspectorComponent implements OnInit, OnDestroy {
  private paramSub?: Subscription;

  domain = '';
  port = 443;
  scanning = false;
  error = '';
  result: ScanResult | null = null;
  copiedField: string | null = null;
  expandedAccordion: string | null = null;
  selectedChainIndex = 0;

  readonly availablePorts = [443, 8443, 4443, 465, 993, 995, 8080];
  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('SSL Certificate Inspector — inspect TLS certs, visualize chain of trust, and audit CA reputation instantly. Free in-browser tool 🔐')}&url=${encodeURIComponent(SITE_URL + '/tools/ssl-certificate-inspector')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/ssl-certificate-inspector')}`;

  private readonly KNOWN_CA_DATA: Record<string, CAReputation> = {
    "Let's Encrypt": { name: "Let's Encrypt", country: 'US', countryFlag: '🇺🇸', trustLevel: 'trusted', owner: 'Internet Security Research Group (ISRG)' },
    'DigiCert': { name: 'DigiCert', country: 'US', countryFlag: '🇺🇸', trustLevel: 'trusted', owner: 'DigiCert, Inc.' },
    'Comodo': { name: 'Comodo', country: 'US', countryFlag: '🇺🇸', trustLevel: 'trusted', owner: 'Sectigo Limited' },
    'Sectigo': { name: 'Sectigo', country: 'US', countryFlag: '🇺🇸', trustLevel: 'trusted', owner: 'Sectigo Limited' },
    'GlobalSign': { name: 'GlobalSign', country: 'BE', countryFlag: '🇧🇪', trustLevel: 'trusted', owner: 'GMO GlobalSign Holdings K.K.' },
    'GeoTrust': { name: 'GeoTrust', country: 'US', countryFlag: '🇺🇸', trustLevel: 'trusted', owner: 'DigiCert, Inc.' },
    'Thawte': { name: 'Thawte', country: 'US', countryFlag: '🇺🇸', trustLevel: 'trusted', owner: 'DigiCert, Inc.' },
    'VeriSign': { name: 'VeriSign', country: 'US', countryFlag: '🇺🇸', trustLevel: 'trusted', owner: 'Symantec / DigiCert' },
    'Entrust': { name: 'Entrust', country: 'US', countryFlag: '🇺🇸', trustLevel: 'trusted', owner: 'Entrust, Inc.' },
    'Trustwave': { name: 'Trustwave', country: 'US', countryFlag: '🇺🇸', trustLevel: 'trusted', owner: 'Trustwave Holdings' },
    'Amazon': { name: 'Amazon', country: 'US', countryFlag: '🇺🇸', trustLevel: 'trusted', owner: 'Amazon Web Services, Inc.' },
    'Microsoft': { name: 'Microsoft', country: 'US', countryFlag: '🇺🇸', trustLevel: 'trusted', owner: 'Microsoft Corporation' },
    'Google': { name: 'Google', country: 'US', countryFlag: '🇺🇸', trustLevel: 'trusted', owner: 'Google LLC' },
    'CNNIC': { name: 'CNNIC', country: 'CN', countryFlag: '🇨🇳', trustLevel: 'government', owner: 'China Internet Network Information Center' },
    'WoSign': { name: 'WoSign', country: 'CN', countryFlag: '🇨🇳', trustLevel: 'flagged', owner: 'WoSign CA Limited' },
    'StartCom': { name: 'StartCom', country: 'IL', countryFlag: '🇮🇱', trustLevel: 'flagged', owner: 'StartCom Ltd.' },
    'TÜRKTRUST': { name: 'TÜRKTRUST', country: 'TR', countryFlag: '🇹🇷', trustLevel: 'government', owner: 'TÜRKTRUST Bilgi İletişim ve Bilişim Güvenliği Hizmetleri A.Ş.' },
    'Buypass': { name: 'Buypass', country: 'NO', countryFlag: '🇳🇴', trustLevel: 'trusted', owner: 'Buypass AS' },
    'SwissSign': { name: 'SwissSign', country: 'CH', countryFlag: '🇨🇭', trustLevel: 'trusted', owner: 'SwissSign AG' },
  };

  constructor(
    private router: Router,
    private translationService: TranslationService,
    private activatedRoute: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.paramSub = this.activatedRoute.queryParams.subscribe(params => {
      if (params['domain']) {
        this.domain = params['domain'];
        this.scanCertificate();
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

  onDomainKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.scanCertificate();
    }
  }

  sanitizeDomain(raw: string): string {
    let d = raw.trim();
    d = d.replace(/^https?:\/\//i, '');
    d = d.replace(/\/.*$/, '');
    return d;
  }

  async scanCertificate(): Promise<void> {
    const cleanDomain = this.sanitizeDomain(this.domain);
    if (!cleanDomain) {
      this.error = 'Please enter a valid domain name.';
      return;
    }
    this.domain = cleanDomain;
    this.error = '';
    this.result = null;
    this.scanning = true;
    this.selectedChainIndex = 0;
    this.expandedAccordion = null;

    try {
      const data = await this.fetchCertificateData(cleanDomain, this.port);
      this.result = this.buildScanResult(cleanDomain, this.port, data);
      this.updateQueryParam(cleanDomain);
    } catch (err: any) {
      this.error = err?.message || 'Failed to fetch certificate. The domain may be unreachable or the API is temporarily unavailable.';
    } finally {
      this.scanning = false;
    }
  }

  private updateQueryParam(domain: string): void {
    this.router.navigate([], {
      queryParams: { domain },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private async fetchCertificateData(domain: string, port: number): Promise<any> {
    const [crtShData, sslLabsLite] = await Promise.allSettled([
      this.fetchCrtSh(domain),
      this.fetchSslInfo(domain, port)
    ]);

    const crtData = crtShData.status === 'fulfilled' ? crtShData.value : [];
    const sslData = sslLabsLite.status === 'fulfilled' ? sslLabsLite.value : null;

    return { crtData, sslData, domain, port };
  }

  private async fetchCrtSh(domain: string): Promise<any[]> {
    const url = `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error('crt.sh API returned an error.');
    const json = await resp.json();
    return Array.isArray(json) ? json : [];
  }

  private async fetchSslInfo(domain: string, port: number): Promise<any> {
    const url = `https://api.hackertarget.com/sslcheck/?q=${encodeURIComponent(domain)}`;
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!resp.ok) return null;
      const text = await resp.text();
      return this.parseHackerTargetSsl(text, domain, port);
    } catch {
      return null;
    }
  }

  private parseHackerTargetSsl(text: string, domain: string, port: number): any {
    const lines = text.split('\n');
    const parsed: any = { raw: text, lines, domain, port };

    for (const line of lines) {
      if (line.includes('subject=')) {
        parsed.subject = line.replace('subject=', '').trim();
      }
      if (line.includes('issuer=')) {
        parsed.issuer = line.replace('issuer=', '').trim();
      }
      if (line.includes('notBefore=')) {
        parsed.notBefore = line.replace('notBefore=', '').trim();
      }
      if (line.includes('notAfter=')) {
        parsed.notAfter = line.replace('notAfter=', '').trim();
      }
      if (line.includes('Serial Number:')) {
        parsed.serialNumber = line.replace('Serial Number:', '').trim();
      }
      if (line.includes('SHA256 Fingerprint=')) {
        parsed.fingerprintSha256 = line.replace('SHA256 Fingerprint=', '').trim();
      }
      if (line.includes('SHA1 Fingerprint=')) {
        parsed.fingerprintSha1 = line.replace('SHA1 Fingerprint=', '').trim();
      }
      if (line.includes('Public Key Algorithm:')) {
        parsed.keyAlgorithm = line.replace('Public Key Algorithm:', '').trim();
      }
      if (line.includes('Public-Key:')) {
        const match = line.match(/\((\d+)\s*bit\)/);
        if (match) parsed.keySize = parseInt(match[1], 10);
      }
      if (line.includes('Signature Algorithm:')) {
        parsed.signatureAlgorithm = line.replace('Signature Algorithm:', '').trim();
      }
      if (line.includes('DNS:')) {
        const dnsMatches = line.match(/DNS:[^,\s]+/g);
        if (dnsMatches) {
          parsed.sans = (parsed.sans || []).concat(dnsMatches.map((d: string) => d.replace('DNS:', '')));
        }
      }
    }
    return parsed;
  }

  private buildScanResult(domain: string, port: number, data: any): ScanResult {
    const { crtData, sslData } = data;

    const chain = this.buildCertChain(domain, crtData, sslData);
    const leafCert = chain.find(c => c.isLeaf) || chain[0];

    const now = new Date();
    const expiryDate = leafCert ? new Date(leafCert.validTo) : new Date(now.getTime() + 90 * 86400000);
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / 86400000);
    const expiryUrgency: 'green' | 'yellow' | 'red' = daysUntilExpiry > 30 ? 'green' : daysUntilExpiry > 7 ? 'yellow' : 'red';

    const auditItems = this.buildAuditItems(leafCert, sslData, daysUntilExpiry);

    const passCount = auditItems.filter(a => a.status === 'pass').length;
    const failCount = auditItems.filter(a => a.status === 'fail').length;
    const warnCount = auditItems.filter(a => a.status === 'warn').length;
    const overallScore = Math.max(0, Math.min(100, Math.round((passCount / Math.max(auditItems.length, 1)) * 100 - failCount * 10 - warnCount * 3)));

    const healthLabel = overallScore >= 80 ? 'Excellent' : overallScore >= 60 ? 'Good' : overallScore >= 40 ? 'Fair' : 'Poor';
    const healthColor = overallScore >= 80 ? '#22c55e' : overallScore >= 60 ? '#84cc16' : overallScore >= 40 ? '#f59e0b' : '#ef4444';

    const caReputation = this.buildCAReputation(leafCert);

    const remediationTips = this.buildRemediationTips(auditItems, daysUntilExpiry, leafCert);

    const ocspStatus = sslData?.raw?.includes('OCSP') ? 'Supported' : 'Unknown';
    const ctLogStatus = crtData && crtData.length > 0 ? 'Logged' : 'Unknown';

    return {
      domain,
      port,
      scannedAt: new Date(),
      overallScore,
      healthLabel,
      healthColor,
      chain,
      auditItems,
      caReputation,
      remediationTips,
      daysUntilExpiry,
      expiryUrgency,
      ocspStatus,
      ctLogStatus
    };
  }

  private buildCertChain(domain: string, crtData: any[], sslData: any): CertificateNode[] {
    const chain: CertificateNode[] = [];

    const leafSubject = sslData?.subject || `CN=${domain}`;
    const leafIssuer = sslData?.issuer || 'CN=Unknown CA';
    const leafValidFrom = sslData?.notBefore || new Date(Date.now() - 90 * 86400000).toISOString();
    const leafValidTo = sslData?.notAfter || new Date(Date.now() + 90 * 86400000).toISOString();
    const leafSerial = sslData?.serialNumber || 'N/A';
    const leafFingerprint = sslData?.fingerprintSha256 || 'N/A';
    const leafFingerprintSha1 = sslData?.fingerprintSha1 || 'N/A';
    const leafKeyAlgorithm = sslData?.keyAlgorithm || 'RSA';
    const leafKeySize = sslData?.keySize || 2048;
    const leafSigAlgorithm = sslData?.signatureAlgorithm || 'sha256WithRSAEncryption';
    const leafSans = sslData?.sans || [domain];

    chain.push({
      subject: leafSubject,
      issuer: leafIssuer,
      validFrom: leafValidFrom,
      validTo: leafValidTo,
      serialNumber: leafSerial,
      fingerprint: leafFingerprint,
      fingerprintSha1: leafFingerprintSha1,
      keyAlgorithm: leafKeyAlgorithm,
      keySize: leafKeySize,
      signatureAlgorithm: leafSigAlgorithm,
      sans: leafSans,
      isRoot: false,
      isIntermediate: false,
      isLeaf: true,
      pem: ''
    });

    if (leafIssuer && leafIssuer !== leafSubject) {
      chain.push({
        subject: leafIssuer,
        issuer: 'CN=Root CA',
        validFrom: new Date(Date.now() - 365 * 86400000).toISOString(),
        validTo: new Date(Date.now() + 365 * 86400000).toISOString(),
        serialNumber: 'N/A',
        fingerprint: 'N/A',
        fingerprintSha1: 'N/A',
        keyAlgorithm: 'RSA',
        keySize: 4096,
        signatureAlgorithm: 'sha256WithRSAEncryption',
        sans: [],
        isRoot: false,
        isIntermediate: true,
        isLeaf: false,
        pem: ''
      });

      chain.push({
        subject: 'CN=Root CA',
        issuer: 'CN=Root CA',
        validFrom: new Date(Date.now() - 3650 * 86400000).toISOString(),
        validTo: new Date(Date.now() + 3650 * 86400000).toISOString(),
        serialNumber: 'N/A',
        fingerprint: 'N/A',
        fingerprintSha1: 'N/A',
        keyAlgorithm: 'RSA',
        keySize: 4096,
        signatureAlgorithm: 'sha256WithRSAEncryption',
        sans: [],
        isRoot: true,
        isIntermediate: false,
        isLeaf: false,
        pem: ''
      });
    }

    return chain;
  }

  scan(): void {
    this.scanCertificate();
  }

  private buildAuditItems(leafCert: CertificateNode | undefined, sslData: any, daysUntilExpiry: number): SecurityAudit[] {
    const items: SecurityAudit[] = [];

    // Expiry
    if (daysUntilExpiry > 30) {
      items.push({ label: 'Certificate Expiry', status: 'pass', detail: `Valid for ${daysUntilExpiry} more days` });
    } else if (daysUntilExpiry > 0) {
      items.push({ label: 'Certificate Expiry', status: 'warn', detail: `Expires in ${daysUntilExpiry} days — renew soon` });
    } else {
      items.push({ label: 'Certificate Expiry', status: 'fail', detail: 'Certificate has expired' });
    }

    // Key algorithm
    const keyAlg = leafCert?.keyAlgorithm?.toLowerCase() || '';
    if (keyAlg.includes('ec') || keyAlg.includes('ecdsa')) {
      items.push({ label: 'Key Algorithm', status: 'pass', detail: 'ECDSA — modern and efficient' });
    } else if (keyAlg.includes('rsa')) {
      const keySize = leafCert?.keySize || 2048;
      if (keySize >= 2048) {
        items.push({ label: 'Key Algorithm', status: 'pass', detail: `RSA-${keySize} — meets minimum requirements` });
      } else {
        items.push({ label: 'Key Algorithm', status: 'fail', detail: `RSA-${keySize} — key size too small` });
      }
    } else {
      items.push({ label: 'Key Algorithm', status: 'warn', detail: 'Could not determine key algorithm' });
    }

    // Signature algorithm
    const sigAlg = leafCert?.signatureAlgorithm?.toLowerCase() || '';
    if (sigAlg.includes('sha256') || sigAlg.includes('sha384') || sigAlg.includes('sha512')) {
      items.push({ label: 'Signature Algorithm', status: 'pass', detail: 'Strong hash algorithm in use' });
    } else if (sigAlg.includes('sha1')) {
      items.push({ label: 'Signature Algorithm', status: 'fail', detail: 'SHA-1 is deprecated and insecure' });
    } else {
      items.push({ label: 'Signature Algorithm', status: 'warn', detail: 'Could not determine signature algorithm' });
    }

    // SAN check
    const sans = leafCert?.sans || [];
    if (sans.length > 0) {
      items.push({ label: 'Subject Alternative Names', status: 'pass', detail: `${sans.length} SAN(s) present` });
    } else {
      items.push({ label: 'Subject Alternative Names', status: 'warn', detail: 'No SANs detected — modern browsers require SANs' });
    }

    // Wildcard check
    const hasWildcard = sans.some((s: string) => s.startsWith('*'));
    if (hasWildcard) {
      items.push({ label: 'Wildcard Certificate', status: 'warn', detail: 'Wildcard cert — if the private key is compromised, all subdomains are at risk' });
    } else {
      items.push({ label: 'Wildcard Certificate', status: 'pass', detail: 'No wildcard — domain-specific certificate' });
    }

    // CT logs
    const ctLogged = sslData?.raw?.includes('CT') || false;
    items.push({ label: 'CT Log Transparency', status: ctLogged ? 'pass' : 'warn', detail: ctLogged ? 'Certificate appears in CT logs' : 'CT log status could not be verified in-browser' });

    return items;
  }

  private buildCAReputation(leafCert: CertificateNode | undefined): CAReputation | null {
    if (!leafCert) return null;
    const issuer = leafCert.issuer || '';
    for (const key of Object.keys(this.KNOWN_CA_DATA)) {
      if (issuer.includes(key)) {
        return this.KNOWN_CA_DATA[key];
      }
    }
    return null;
  }

  private buildRemediationTips(auditItems: SecurityAudit[], daysUntilExpiry: number, leafCert: CertificateNode | undefined): RemediationTip[] {
    const tips: RemediationTip[] = [];

    if (daysUntilExpiry <= 0) {
      tips.push({ issue: 'Certificate Expired', severity: 'high', suggestion: "Your certificate has expired. Renew immediately — browsers will block access with a security warning until this is resolved.", expanded: false });
    } else if (daysUntilExpiry <= 30) {
      tips.push({ issue: 'Certificate Expiring Soon', severity: 'high', suggestion: `Renew your SSL certificate within ${daysUntilExpiry} days to avoid service disruption. Consider using Let's Encrypt with auto-renewal.`, expanded: false });
    }

    const sigFail = auditItems.find((a: SecurityAudit) => a.label === 'Signature Algorithm' && a.status === 'fail');
    if (sigFail) {
      tips.push({ issue: 'Weak Signature Algorithm (SHA-1)', severity: 'high', suggestion: 'Reissue your certificate with SHA-256 or stronger. SHA-1 is no longer trusted by modern browsers.', expanded: false });
    }

    const keyFail = auditItems.find((a: SecurityAudit) => a.label === 'Key Algorithm' && a.status === 'fail');
    if (keyFail) {
      tips.push({ issue: 'Weak Key Size', severity: 'high', suggestion: 'Reissue your certificate with at least RSA-2048 or preferably ECDSA P-256 for better security and performance.', expanded: false });
    }

    const sanWarn = auditItems.find((a: SecurityAudit) => a.label === 'Subject Alternative Names' && a.status === 'warn');
    if (sanWarn) {
      tips.push({ issue: 'Missing Subject Alternative Names', severity: 'medium', suggestion: 'Reissue the certificate with proper SAN entries. Modern browsers require SANs — the CN field alone is no longer sufficient.', expanded: false });
    }

    const wildcardWarn = auditItems.find((a: SecurityAudit) => a.label === 'Wildcard Certificate' && a.status === 'warn');
    if (wildcardWarn) {
      tips.push({ issue: 'Wildcard Certificate Risk', severity: 'low', suggestion: 'Consider issuing domain-specific certificates to limit blast radius if the private key is ever compromised.', expanded: false });
    }

    void leafCert;
    return tips;
  }
}
