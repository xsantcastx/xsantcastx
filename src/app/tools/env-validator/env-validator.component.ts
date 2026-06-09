import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

type Severity = 'error' | 'warning' | 'info';

interface ValidationIssue {
  line: number;
  severity: Severity;
  message: string;
  key?: string;
  value?: string;
}

interface ParsedEnvLine {
  lineNumber: number;
  raw: string;
  key: string;
  value: string;
  isComment: boolean;
  isEmpty: boolean;
}

interface SecretPattern {
  name: string;
  regex: RegExp;
  description: string;
}

@Component({
    selector: 'app-env-validator',
    templateUrl: './env-validator.component.html',
    styleUrls: ['./env-validator.component.css'],
    imports: [ToolsSharedModule, FormsModule, UpperCasePipe]
})
export class EnvValidatorComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free .env File Validator & Secret Scanner — validate syntax, detect leaked secrets, export .env.example instantly. No sign-up required.')}&url=${encodeURIComponent(SITE_URL + '/tools/env-validator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/env-validator')}`;

  // Input
  envInput = '';

  // Output state
  issues: ValidationIssue[] = [];
  parsedLines: ParsedEnvLine[] = [];
  validationStatus: 'idle' | 'valid' | 'warnings' | 'errors' = 'idle';
  secretsDetected = false;
  copied = false;
  copiedGitignore = false;
  copiedExample = false;
  downloaded = false;

  // Stats
  lineCount = 0;
  keyCount = 0;
  errorCount = 0;
  warningCount = 0;
  infoCount = 0;
  secretCount = 0;

  // Filter
  activeFilter: Severity | 'all' = 'all';

  // Secret patterns
  private readonly secretPatterns: SecretPattern[] = [
    { name: 'AWS Access Key', regex: /(?:^|=\s*)(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{12,}/, description: 'AWS Access Key ID detected' },
    { name: 'AWS Secret Key', regex: /(?:^|=\s*)[A-Za-z0-9/+=]{40}(?:\s*$)/, description: 'Possible AWS Secret Access Key' },
    { name: 'GitHub Token', regex: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/, description: 'GitHub personal access token detected' },
    { name: 'GitHub Fine-Grained Token', regex: /github_pat_[A-Za-z0-9_]{22,}/, description: 'GitHub fine-grained personal access token detected' },
    { name: 'Stripe Secret Key', regex: /sk_live_[A-Za-z0-9]{24,}/, description: 'Stripe live secret key detected' },
    { name: 'Stripe Publishable Key', regex: /pk_live_[A-Za-z0-9]{24,}/, description: 'Stripe live publishable key detected' },
    { name: 'Stripe Test Key', regex: /[sp]k_test_[A-Za-z0-9]{24,}/, description: 'Stripe test key detected' },
    { name: 'Slack Token', regex: /xox[bpors]-[A-Za-z0-9-]{10,}/, description: 'Slack API token detected' },
    { name: 'Slack Webhook', regex: /hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/, description: 'Slack webhook URL detected' },
    { name: 'Google API Key', regex: /AIza[A-Za-z0-9_\\-]{35}/, description: 'Google API key detected' },
    { name: 'Twilio API Key', regex: /SK[a-f0-9]{32}/, description: 'Twilio API key detected' },
    { name: 'SendGrid API Key', regex: /SG\.[A-Za-z0-9_-]{22,}\.[A-Za-z0-9_-]{43,}/, description: 'SendGrid API key detected' },
    { name: 'Mailgun API Key', regex: /key-[A-Za-z0-9]{32}/, description: 'Mailgun API key detected' },
    { name: 'Firebase Key', regex: /AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140,}/, description: 'Firebase server key detected' },
    { name: 'Heroku API Key', regex: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/, description: 'Possible Heroku API key (UUID format)' },
    { name: 'Private Key', regex: /-----BEGIN\s+(RSA\s+)?PRIVATE\sKEY-----/, description: 'Private key detected' },
    { name: 'Generic Secret', regex: /(?:password|passwd|pwd|secret|token|api_key|apikey|access_key|auth)\s*=\s*[^\s]{8,}/i, description: 'Possible hardcoded secret in a sensitive variable' },
    { name: 'JWT Token', regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, description: 'JWT token detected' },
    { name: 'NPM Token', regex: /npm_[A-Za-z0-9]{36}/, description: 'NPM access token detected' },
    { name: 'Discord Token', regex: /[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27}/, description: 'Discord bot token detected' },
  ];

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Live validation (debounced 300ms) ──────────────────────────────────────

  onInput() {
    this.lineCount = this.envInput ? this.envInput.split('\n').length : 0;

    if (!this.envInput.trim()) {
      this.resetState();
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.validate(), 300);
  }

  private resetState() {
    this.validationStatus = 'idle';
    this.issues = [];
    this.parsedLines = [];
    this.keyCount = 0;
    this.errorCount = 0;
    this.warningCount = 0;
    this.infoCount = 0;
    this.secretCount = 0;
    this.secretsDetected = false;
    this.lineCount = 0;
  }

  // ── Core validation ───────────────────────────────────────────────────────

  validate() {
    if (!this.envInput.trim()) {
      this.resetState();
      return;
    }

    // Easter egg: SECRET_EASTER_EGG in .env
    if (this.envInput.includes('SECRET_EASTER_EGG')) this.eggs.trigger('env-secret');

    const lines = this.envInput.split('\n');
    this.lineCount = lines.length;
    this.issues = [];
    this.parsedLines = [];

    const seenKeys = new Map<string, number>();
    let keyCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const lineNum = i + 1;
      const trimmed = raw.trim();

      // Empty line
      if (!trimmed) {
        this.parsedLines.push({ lineNumber: lineNum, raw, key: '', value: '', isComment: false, isEmpty: true });
        continue;
      }

      // Comment
      if (trimmed.startsWith('#')) {
        this.parsedLines.push({ lineNumber: lineNum, raw, key: '', value: '', isComment: true, isEmpty: false });
        continue;
      }

      // Must contain =
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        this.parsedLines.push({ lineNumber: lineNum, raw, key: '', value: '', isComment: false, isEmpty: false });
        this.issues.push({ line: lineNum, severity: 'error', message: 'Missing "=" sign — not a valid .env entry' });
        continue;
      }

      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1);

      this.parsedLines.push({ lineNumber: lineNum, raw, key, value, isComment: false, isEmpty: false });
      keyCount++;

      // Validate key name
      if (!key) {
        this.issues.push({ line: lineNum, severity: 'error', message: 'Empty key name before "="', key });
      } else if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        this.issues.push({ line: lineNum, severity: 'error', message: `Invalid key name "${key}" — keys must start with a letter or underscore and contain only letters, digits, and underscores`, key });
      }

      // Check for duplicate keys
      if (key) {
        if (seenKeys.has(key)) {
          this.issues.push({ line: lineNum, severity: 'warning', message: `Duplicate key "${key}" — previously defined on line ${seenKeys.get(key)}`, key });
        }
        seenKeys.set(key, lineNum);
      }

      // Check for missing value
      if (value === '' || value.trim() === '') {
        this.issues.push({ line: lineNum, severity: 'warning', message: `Key "${key}" has an empty value`, key });
      }

      // Check for unquoted values with spaces
      const trimmedValue = value.trim();
      if (trimmedValue.includes(' ') && !trimmedValue.startsWith('"') && !trimmedValue.startsWith("'")) {
        this.issues.push({ line: lineNum, severity: 'warning', message: `Value for "${key}" contains spaces but is not quoted — wrap in double quotes to preserve whitespace`, key, value: trimmedValue });
      }

      // Check for trailing inline comments without quotes
      if (trimmedValue.includes('#') && !trimmedValue.startsWith('"') && !trimmedValue.startsWith("'")) {
        this.issues.push({ line: lineNum, severity: 'info', message: `Value for "${key}" contains "#" — this may be interpreted as an inline comment. Wrap in double quotes if the "#" is part of the value`, key, value: trimmedValue });
      }

      // Check for mixed quotes
      if ((trimmedValue.startsWith('"') && trimmedValue.endsWith("'")) || (trimmedValue.startsWith("'") && trimmedValue.endsWith('"'))) {
        this.issues.push({ line: lineNum, severity: 'error', message: `Value for "${key}" has mismatched quotes`, key, value: trimmedValue });
      }

      // Check for single quotes (some parsers don't handle them)
      if (trimmedValue.startsWith("'") && trimmedValue.endsWith("'")) {
        this.issues.push({ line: lineNum, severity: 'info', message: `Value for "${key}" uses single quotes — some .env parsers (e.g. Docker) do not strip single quotes. Consider using double quotes instead`, key, value: trimmedValue });
      }

      // Secret scanning
      this.scanForSecrets(lineNum, key, value);
    }

    this.keyCount = keyCount;
    this.errorCount = this.issues.filter(i => i.severity === 'error').length;
    this.warningCount = this.issues.filter(i => i.severity === 'warning').length;
    this.infoCount = this.issues.filter(i => i.severity === 'info').length;
    this.secretCount = this.issues.filter(i => i.message.includes('detected') || i.message.includes('Possible hardcoded secret') || i.message.includes('JWT token') || i.message.includes('Possible Heroku')).length;
    this.secretsDetected = this.secretCount > 0;

    if (this.errorCount > 0) {
      this.validationStatus = 'errors';
    } else if (this.warningCount > 0 || this.secretsDetected) {
      this.validationStatus = 'warnings';
    } else {
      this.validationStatus = 'valid';
    }
  }

  private scanForSecrets(lineNum: number, key: string, value: string) {
    const fullLine = `${key}=${value}`;
    for (const pattern of this.secretPatterns) {
      if (pattern.regex.test(fullLine)) {
        // Avoid duplicate generic secret matches if a specific pattern already matched
        if (pattern.name === 'Generic Secret') {
          const alreadyHasSpecific = this.issues.some(
            i => i.line === lineNum && i.severity === 'error' && i.message.includes('detected')
          );
          if (alreadyHasSpecific) continue;
        }
        this.issues.push({
          line: lineNum,
          severity: 'error',
          message: `SECRET: ${pattern.description} (${pattern.name})`,
          key,
          value: value.trim()
        });
      }
    }
  }

  // ── Filtering ─────────────────────────────────────────────────────────────

  get filteredIssues(): ValidationIssue[] {
    if (this.activeFilter === 'all') return this.issues;
    return this.issues.filter(i => i.severity === this.activeFilter);
  }

  setFilter(filter: Severity | 'all') {
    this.activeFilter = filter;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  loadSample() {
    this.envInput = `# Application Config
APP_NAME=MyApp
APP_ENV=production
APP_PORT=3000
APP_DEBUG=true

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=super_secret_password_123
DB_NAME=myapp_production

# API Keys (DO NOT COMMIT!)
AWS_ACCESS_KEY_ID=AKIA_EXAMPLE_KEY_HERE
AWS_SECRET_ACCESS_KEY=example/secret/key/replace/me
GITHUB_TOKEN=ghp_exampletoken1234567890abcdefg
STRIPE_SECRET_KEY=sk_test_example1234567890abcdef

# Invalid entries for demo
=missing_key
INVALID KEY NAME=value
UNQUOTED_SPACES=hello world this breaks
DUPLICATE_KEY=first
DUPLICATE_KEY=second
MIXED_QUOTES="hello'
HAS_HASH=value#not-a-comment

# Misc
EMPTY_VALUE=
SINGLE_QUOTED='some value'
NODE_ENV=production`;
    this.onInput();
  }

  clearAll() {
    this.envInput = '';
    this.resetState();
  }

  // ── Export .env.example ────────────────────────────────────────────────────

  generateEnvExample(): string {
    const lines = this.envInput.split('\n');
    const output: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        output.push(line);
        continue;
      }
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        output.push(line);
        continue;
      }
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();

      // Generate placeholder based on key name
      let placeholder = 'your_value_here';
      const keyLower = key.toLowerCase();
      if (keyLower.includes('port')) placeholder = '3000';
      else if (keyLower.includes('host')) placeholder = 'localhost';
      else if (keyLower.includes('url') || keyLower.includes('uri')) placeholder = 'https://example.com';
      else if (keyLower.includes('email')) placeholder = 'user@example.com';
      else if (keyLower.includes('name') && keyLower.includes('db')) placeholder = 'my_database';
      else if (keyLower.includes('name') && keyLower.includes('app')) placeholder = 'MyApp';
      else if (keyLower.includes('user')) placeholder = 'your_username';
      else if (keyLower.includes('password') || keyLower.includes('passwd') || keyLower.includes('pwd')) placeholder = 'your_password';
      else if (keyLower.includes('secret') || keyLower.includes('key') || keyLower.includes('token') || keyLower.includes('api')) placeholder = 'your_secret_here';
      else if (keyLower.includes('env')) placeholder = 'development';
      else if (keyLower.includes('debug')) placeholder = 'false';
      else if (value === 'true' || value === 'false') placeholder = 'false';
      else if (/^\d+$/.test(value)) placeholder = value;

      output.push(`${key}=${placeholder}`);
    }

    return output.join('\n');
  }

  // ── .gitignore suggestion ─────────────────────────────────────────────────

  get gitignoreEntries(): string {
    return `# Environment files
.env
.env.local
.env.*.local
.env.production
.env.staging
.env.development

# Keep the example
!.env.example`;
  }

  // ── Clipboard & Download ──────────────────────────────────────────────────

  async copyInput() {
    if (!this.envInput || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.envInput);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(this.envInput, 'copied');
    }
  }

  async copyGitignore() {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.gitignoreEntries);
      this.copiedGitignore = true;
      setTimeout(() => (this.copiedGitignore = false), 2000);
    } catch {
      this.fallbackCopy(this.gitignoreEntries, 'copiedGitignore');
    }
  }

  async copyEnvExample() {
    if (!this.isBrowser) return;
    const example = this.generateEnvExample();
    try {
      await navigator.clipboard.writeText(example);
      this.copiedExample = true;
      setTimeout(() => (this.copiedExample = false), 2000);
    } catch {
      this.fallbackCopy(example, 'copiedExample');
    }
  }

  downloadEnvExample() {
    if (!this.isBrowser) return;
    const example = this.generateEnvExample();
    const blob = new Blob([example], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '.env.example';
    a.click();
    URL.revokeObjectURL(url);
    this.downloaded = true;
    setTimeout(() => (this.downloaded = false), 2000);
  }

  private fallbackCopy(text: string, flag: 'copied' | 'copiedGitignore' | 'copiedExample') {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    (this as any)[flag] = true;
    setTimeout(() => ((this as any)[flag] = false), 2000);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  getLineIssues(lineNum: number): ValidationIssue[] {
    return this.issues.filter(i => i.line === lineNum);
  }

  hasIssue(lineNum: number, severity?: Severity): boolean {
    if (severity) return this.issues.some(i => i.line === lineNum && i.severity === severity);
    return this.issues.some(i => i.line === lineNum);
  }

  getLineSeverity(lineNum: number): Severity | null {
    const lineIssues = this.getLineIssues(lineNum);
    if (lineIssues.some(i => i.severity === 'error')) return 'error';
    if (lineIssues.some(i => i.severity === 'warning')) return 'warning';
    if (lineIssues.some(i => i.severity === 'info')) return 'info';
    return null;
  }

  getSeverityIcon(severity: Severity): string {
    switch (severity) {
      case 'error': return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-2h2v2h-2zm0-4V7h2v6h-2z';
      case 'warning': return 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z';
      case 'info': return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z';
    }
  }
}
