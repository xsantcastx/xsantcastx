import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';

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
  standalone: false
})
export class SslCertificateInspectorComponent implements OnInit {
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
    this.activatedRoute.queryParams.subscribe(params => {
      if (params['domain']) {
        this.domain = params['domain'];
        this.scanCertificate();
      }
    });
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
    // Use crt.sh API for certificate transparency data (public, no CORS issues)
    // We also fetch certificate info via a public SSL checking API
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
    // Use HackerTarget SSL check or similar free proxy
    // Fallback: use a public API that can return SSL info
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

    // Build certificate chain from available data
    const chain = this.buildCertChain(domain, crtData, sslData);
    const leafCert = chain.find(c => c.isLeaf) || chain[0];

    // Calculate expiry info
    const now = new Date();
    const expiryDate = leafCert ? new Date(leafCert.validTo) : new Date(now.getTime() + 90 * 86400000);
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / 86400000);
    const expiryUrgency: 'green' | 'yellow' | 'red' = daysUntilExpiry > 30 ? 'green' : daysUntilExpiry > 7 ? 'yellow' : 'red';

    // Build audit items
    const auditItems = this.buildAuditItems(leafCert, sslData, daysUntilExpiry);

    // Calculate overall score
    const passCount = auditItems.filter(a => a.status === 'pass').length;
    const failCount = auditItems.filter(a => a.status === 'fail').length;
    const warnCount = auditItems.filter(a => a.status === 'warn').length;
    const overallScore = Math.max(0, Math.min(100, Math.round((passCount / Math.max(auditItems.length, 1)) * 100 - failCount * 10 - warnCount * 3)));

    const healthLabel = overallScore >= 80 ? 'Excellent' : overallScore >= 60 ? 'Good' : overallScore >= 40 ? 'Fair' : 'Poor';
    const healthColor = overallScore >= 80 ? '#22c55e' : overallScore >= 60 ? '#84cc16' : overallScore >= 40 ? '#f59e0b' : '#ef4444';

    // CA Reputation
    const caReputation = this.buildCAReputation(leafCert);

    // Remediation tips
    const remediationTips = this.buildRemediationTips(auditItems, daysUntilExpiry, leafCert);

    // OCSP / CT status
    const ocspStatus = sslData?.raw?.includes('OCSP') ? 'Supported' : 'Unknown';
    const ctLogStatus = crtData && crtData.length > 0 ? 'Logged