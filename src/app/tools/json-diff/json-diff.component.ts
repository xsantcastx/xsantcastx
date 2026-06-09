import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

interface DiffEntry {
  key: string;
  type: 'added' | 'removed' | 'changed' | 'same';
  oldValue?: any;
  newValue?: any;
}

@Component({
    selector: 'app-json-diff',
    templateUrl: './json-diff.component.html',
    styleUrls: ['./json-diff.component.css'],
    imports: [FormsModule, NgClass, ToolsSharedModule]
})
export class JsonDiffComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free JSON Diff Tool — compare two JSON objects side by side!')}&url=${encodeURIComponent(SITE_URL + '/tools/json-diff')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/json-diff')}`;

  leftInput = '';
  rightInput = '';
  diffs: DiffEntry[] = [];
  errorMessage = '';
  copied = false;
  addedCount = 0;
  removedCount = 0;
  changedCount = 0;

  constructor(private router: Router) {}

  goBack() { this.router.navigate(['/tools']); }

  compare() {
    this.errorMessage = '';
    this.diffs = [];
    this.addedCount = 0;
    this.removedCount = 0;
    this.changedCount = 0;

    if (!this.leftInput.trim() || !this.rightInput.trim()) return;

    let left: any, right: any;
    try { left = JSON.parse(this.leftInput); } catch { this.errorMessage = 'Left JSON is invalid.'; return; }
    try { right = JSON.parse(this.rightInput); } catch { this.errorMessage = 'Right JSON is invalid.'; return; }

    if (JSON.stringify(left) === JSON.stringify(right)) {
      this.eggs.trigger('json-diff-same');
    }

    this.diffs = this.diffObjects('', left, right);
    this.addedCount = this.diffs.filter(d => d.type === 'added').length;
    this.removedCount = this.diffs.filter(d => d.type === 'removed').length;
    this.changedCount = this.diffs.filter(d => d.type === 'changed').length;
  }

  private diffObjects(prefix: string, a: any, b: any): DiffEntry[] {
    const results: DiffEntry[] = [];
    const allKeys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const key of allKeys) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (!(key in a)) {
        results.push({ key: path, type: 'added', newValue: b[key] });
      } else if (!(key in b)) {
        results.push({ key: path, type: 'removed', oldValue: a[key] });
      } else if (typeof a[key] === 'object' && typeof b[key] === 'object' && a[key] !== null && b[key] !== null && !Array.isArray(a[key]) && !Array.isArray(b[key])) {
        results.push(...this.diffObjects(path, a[key], b[key]));
      } else if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
        results.push({ key: path, type: 'changed', oldValue: a[key], newValue: b[key] });
      }
    }
    return results;
  }

  clearAll() {
    this.leftInput = '';
    this.rightInput = '';
    this.diffs = [];
    this.errorMessage = '';
    this.addedCount = 0;
    this.removedCount = 0;
    this.changedCount = 0;
  }

  async copyOutput() {
    if (!this.diffs.length || !this.isBrowser) return;
    const text = this.diffs.map(d => `${d.type.toUpperCase()}: ${d.key}${d.oldValue !== undefined ? ' | old: ' + JSON.stringify(d.oldValue) : ''}${d.newValue !== undefined ? ' | new: ' + JSON.stringify(d.newValue) : ''}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {}
  }

  formatValue(v: any): string {
    return JSON.stringify(v);
  }
}
