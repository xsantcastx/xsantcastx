import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

interface PermissionSet {
  read: boolean;
  write: boolean;
  execute: boolean;
}

interface Preset {
  numeric: string;
  label: string;
  description: string;
}

@Component({
    selector: 'app-chmod-calculator',
    templateUrl: './chmod-calculator.component.html',
    styleUrls: ['./chmod-calculator.component.css'],
    imports: [ToolsSharedModule, FormsModule]
})
export class ChmodCalculatorComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Chmod Calculator — interactive permission matrix, numeric & symbolic notation, umask calculator. No sign-up')}&url=${encodeURIComponent(SITE_URL + '/tools/chmod-calculator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/chmod-calculator')}`;

  // Permission matrix
  owner: PermissionSet = { read: true, write: true, execute: true };
  group: PermissionSet = { read: true, write: false, execute: true };
  others: PermissionSet = { read: true, write: false, execute: true };

  // Numeric input
  numericInput = '755';
  numericError = '';

  // Umask
  umaskInput = '022';
  umaskError = '';

  // Copy states
  copiedNumeric = false;
  copiedSymbolic = false;
  copiedCommand = false;
  copiedUmask = false;

  // File path for command
  filePath = './file.sh';

  // Presets
  readonly presets: Preset[] = [
    { numeric: '644', label: '644', description: 'Owner read/write, group & others read-only (files)' },
    { numeric: '755', label: '755', description: 'Owner full, group & others read/execute (directories, scripts)' },
    { numeric: '777', label: '777', description: 'Full access for everyone (use with caution!)' },
    { numeric: '700', label: '700', description: 'Owner full, no access for group & others (private)' },
    { numeric: '600', label: '600', description: 'Owner read/write only (SSH keys, secrets)' },
    { numeric: '444', label: '444', description: 'Read-only for everyone' },
    { numeric: '555', label: '555', description: 'Read/execute for everyone (immutable scripts)' },
    { numeric: '750', label: '750', description: 'Owner full, group read/execute, others none' },
  ];

  constructor(private router: Router) {}

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Permission value helpers ──────────────────────────────────

  private permToOctal(p: PermissionSet): number {
    return (p.read ? 4 : 0) + (p.write ? 2 : 0) + (p.execute ? 1 : 0);
  }

  private octalToPerm(n: number): PermissionSet {
    return {
      read: (n & 4) !== 0,
      write: (n & 2) !== 0,
      execute: (n & 1) !== 0,
    };
  }

  private permToSymbolic(p: PermissionSet): string {
    return (p.read ? 'r' : '-') + (p.write ? 'w' : '-') + (p.execute ? 'x' : '-');
  }

  // ── Computed values ───────────────────────────────────────────

  get numericValue(): string {
    return '' + this.permToOctal(this.owner) + this.permToOctal(this.group) + this.permToOctal(this.others);
  }

  get symbolicValue(): string {
    return this.permToSymbolic(this.owner) + this.permToSymbolic(this.group) + this.permToSymbolic(this.others);
  }

  get chmodCommand(): string {
    return `chmod ${this.numericValue} ${this.filePath}`;
  }

  get chmodSymbolicCommand(): string {
    return `chmod u=${this.permToSymbolic(this.owner).replace(/-/g, '')},g=${this.permToSymbolic(this.group).replace(/-/g, '')},o=${this.permToSymbolic(this.others).replace(/-/g, '')} ${this.filePath}`;
  }

  get umaskResult(): string {
    if (this.umaskError) return '---';
    const umaskNum = parseInt(this.umaskInput, 8);
    if (isNaN(umaskNum) || umaskNum > 777) return '---';
    const filePerms = 666 - parseInt(this.umaskInput, 10);
    const dirPerms = 777 - parseInt(this.umaskInput, 10);
    return `Files: ${this.padOctal(filePerms)} | Dirs: ${this.padOctal(dirPerms)}`;
  }

  get umaskFilePermission(): string {
    if (this.umaskError) return '---';
    const umask = parseInt(this.umaskInput, 8);
    if (isNaN(umask) || umask > 0o777) return '---';
    const result = 0o666 & ~umask;
    return result.toString(8).padStart(3, '0');
  }

  get umaskDirPermission(): string {
    if (this.umaskError) return '---';
    const umask = parseInt(this.umaskInput, 8);
    if (isNaN(umask) || umask > 0o777) return '---';
    const result = 0o777 & ~umask;
    return result.toString(8).padStart(3, '0');
  }

  get umaskSymbolic(): string {
    if (this.umaskError) return '---------';
    const umask = parseInt(this.umaskInput, 8);
    if (isNaN(umask) || umask > 0o777) return '---------';
    const filePerm = 0o666 & ~umask;
    const o = this.octalToPerm((filePerm >> 6) & 7);
    const g = this.octalToPerm((filePerm >> 3) & 7);
    const ot = this.octalToPerm(filePerm & 7);
    return this.permToSymbolic(o) + this.permToSymbolic(g) + this.permToSymbolic(ot);
  }

  private padOctal(n: number): string {
    const s = n.toString();
    return s.padStart(3, '0');
  }

  // ── Checkbox → Numeric sync ───────────────────────────────────

  onPermissionChange() {
    this.numericInput = this.numericValue;
    this.numericError = '';
    this.checkEasterEgg();
  }

  // ── Numeric → Checkbox sync ───────────────────────────────────

  onNumericInput() {
    const val = this.numericInput.trim();
    this.numericError = '';

    if (!val) return;

    if (!/^[0-7]{3}$/.test(val)) {
      this.numericError = 'Enter exactly 3 octal digits (0-7)';
      return;
    }

    const digits = val.split('').map(Number);
    this.owner = this.octalToPerm(digits[0]);
    this.group = this.octalToPerm(digits[1]);
    this.others = this.octalToPerm(digits[2]);
    this.checkEasterEgg();
  }

  // ── Umask input ───────────────────────────────────────────────

  onUmaskInput() {
    const val = this.umaskInput.trim();
    this.umaskError = '';

    if (!val) return;

    if (!/^[0-7]{3,4}$/.test(val)) {
      this.umaskError = 'Enter 3 or 4 octal digits (0-7)';
      return;
    }
  }

  // ── Presets ───────────────────────────────────────────────────

  applyPreset(preset: Preset) {
    this.numericInput = preset.numeric;
    this.onNumericInput();
  }

  // ── Easter egg ────────────────────────────────────────────────

  private checkEasterEgg() {
    if (this.numericValue === '777') {
      this.eggs.trigger('chmod-god');
    }
  }

  // ── Copy actions ──────────────────────────────────────────────

  async copyNumeric() {
    await this.copyText(this.numericValue);
    this.copiedNumeric = true;
    setTimeout(() => (this.copiedNumeric = false), 2000);
  }

  async copySymbolic() {
    await this.copyText(this.symbolicValue);
    this.copiedSymbolic = true;
    setTimeout(() => (this.copiedSymbolic = false), 2000);
  }

  async copyCommand() {
    await this.copyText(this.chmodCommand);
    this.copiedCommand = true;
    setTimeout(() => (this.copiedCommand = false), 2000);
  }

  async copyUmaskResult() {
    await this.copyText(`umask ${this.umaskInput} → files: ${this.umaskFilePermission}, dirs: ${this.umaskDirPermission}`);
    this.copiedUmask = true;
    setTimeout(() => (this.copiedUmask = false), 2000);
  }

  private async copyText(text: string) {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(text);
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
  }

  // ── Helpers for template ──────────────────────────────────────

  get ownerSymbolic(): string { return this.permToSymbolic(this.owner); }
  get groupSymbolic(): string { return this.permToSymbolic(this.group); }
  get othersSymbolic(): string { return this.permToSymbolic(this.others); }
}
