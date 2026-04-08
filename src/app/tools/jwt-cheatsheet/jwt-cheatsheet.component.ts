import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

interface JwtClaim { name: string; description: string; required: boolean; example: string; }
interface JwtAlgorithm { name: string; type: string; description: string; keySize: string; security: 'low' | 'medium' | 'high'; }

@Component({
  selector: 'app-jwt-cheatsheet',
  templateUrl: './jwt-cheatsheet.component.html',
  styleUrls: ['./jwt-cheatsheet.component.css'],
  standalone: false
})
export class JwtCheatsheetComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('JWT Claims Reference & Algorithm Comparison — quick reference for JSON Web Tokens')}&url=${encodeURIComponent(SITE_URL + '/tools/jwt-cheatsheet')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/jwt-cheatsheet')}`;

  searchQuery = '';
  activeTab: 'claims' | 'algorithms' = 'claims';
  copied = false;

  readonly claims: JwtClaim[] = [
    { name: 'iss', description: 'Issuer — identifies the principal that issued the JWT', required: false, example: '"iss": "https://auth.example.com"' },
    { name: 'sub', description: 'Subject — identifies the principal that is the subject of the JWT', required: false, example: '"sub": "user-12345"' },
    { name: 'aud', description: 'Audience — identifies the recipients the JWT is intended for', required: false, example: '"aud": "https://api.example.com"' },
    { name: 'exp', description: 'Expiration Time — time after which the JWT must not be accepted (Unix timestamp)', required: false, example: '"exp": 1700000000' },
    { name: 'nbf', description: 'Not Before — time before which the JWT must not be accepted (Unix timestamp)', required: false, example: '"nbf": 1699900000' },
    { name: 'iat', description: 'Issued At — time at which the JWT was issued (Unix timestamp)', required: false, example: '"iat": 1699900000' },
    { name: 'jti', description: 'JWT ID — unique identifier for the JWT, used to prevent replay attacks', required: false, example: '"jti": "abc-123-def-456"' },
    { name: 'name', description: 'Full name of the user (OpenID Connect)', required: false, example: '"name": "Jane Doe"' },
    { name: 'email', description: 'Email address of the user (OpenID Connect)', required: false, example: '"email": "jane@example.com"' },
    { name: 'roles', description: 'Custom claim for user roles (not standard, but common)', required: false, example: '"roles": ["admin", "editor"]' },
    { name: 'scope', description: 'OAuth 2.0 scopes granted to the token', required: false, example: '"scope": "read write"' },
    { name: 'typ', description: 'Token type (header claim)', required: false, example: '"typ": "JWT"' },
    { name: 'alg', description: 'Algorithm used to sign the token (header claim)', required: true, example: '"alg": "HS256"' },
    { name: 'kid', description: 'Key ID — hint for which key was used to sign (header claim)', required: false, example: '"kid": "key-2024-01"' },
  ];

  readonly algorithms: JwtAlgorithm[] = [
    { name: 'HS256', type: 'HMAC', description: 'HMAC using SHA-256. Symmetric — same secret for signing and verifying.', keySize: '256-bit', security: 'medium' },
    { name: 'HS384', type: 'HMAC', description: 'HMAC using SHA-384. Symmetric — same secret for signing and verifying.', keySize: '384-bit', security: 'medium' },
    { name: 'HS512', type: 'HMAC', description: 'HMAC using SHA-512. Symmetric — same secret for signing and verifying.', keySize: '512-bit', security: 'high' },
    { name: 'RS256', type: 'RSA', description: 'RSA signature with SHA-256. Asymmetric — private key signs, public key verifies.', keySize: '2048-bit+', security: 'high' },
    { name: 'RS384', type: 'RSA', description: 'RSA signature with SHA-384. Asymmetric.', keySize: '2048-bit+', security: 'high' },
    { name: 'RS512', type: 'RSA', description: 'RSA signature with SHA-512. Asymmetric.', keySize: '2048-bit+', security: 'high' },
    { name: 'ES256', type: 'ECDSA', description: 'ECDSA using P-256 curve and SHA-256. Compact signatures, good for mobile.', keySize: '256-bit', security: 'high' },
    { name: 'ES384', type: 'ECDSA', description: 'ECDSA using P-384 curve and SHA-384.', keySize: '384-bit', security: 'high' },
    { name: 'ES512', type: 'ECDSA', description: 'ECDSA using P-521 curve and SHA-512.', keySize: '521-bit', security: 'high' },
    { name: 'PS256', type: 'RSA-PSS', description: 'RSA-PSS using SHA-256. More secure padding than RS256.', keySize: '2048-bit+', security: 'high' },
    { name: 'none', type: 'None', description: 'No digital signature. NEVER use in production — allows token forgery.', keySize: 'N/A', security: 'low' },
  ];

  constructor(private router: Router) {}

  goBack(): void { this.router.navigate(['/tools']); }

  onSearchInput(): void {
    if (this.searchQuery.trim().toLowerCase() === 'none') {
      this.eggs.trigger('jwt-none-ref');
    }
  }

  get filteredClaims(): JwtClaim[] {
    if (!this.searchQuery.trim()) return this.claims;
    const q = this.searchQuery.toLowerCase();
    return this.claims.filter(c => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }

  get filteredAlgorithms(): JwtAlgorithm[] {
    if (!this.searchQuery.trim()) return this.algorithms;
    const q = this.searchQuery.toLowerCase();
    return this.algorithms.filter(a => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.type.toLowerCase().includes(q));
  }

  async copyClaim(claim: JwtClaim): Promise<void> {
    if (!this.isBrowser) return;
    try { await navigator.clipboard.writeText(claim.example); this.copied = true; setTimeout(() => (this.copied = false), 2000); } catch {}
  }
}
