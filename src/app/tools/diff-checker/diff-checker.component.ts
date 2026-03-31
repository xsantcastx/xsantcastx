import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

type ViewMode = 'side-by-side' | 'unified';
type DiffLineType = 'added' | 'deleted' | 'changed' | 'unchanged';

interface DiffLine {
  type: DiffLineType;
  leftNum: number | null;
  rightNum: number | null;
  leftText: string;
  rightText: string;
}

interface UnifiedLine {
  type: DiffLineType;
  lineNum: number | null;
  prefix: string;
  text: string;
}

@Component({
  selector: 'app-diff-checker',
  templateUrl: './diff-checker.component.html',
  styleUrls: ['./diff-checker.component.css'],
  standalone: false
})
export class DiffCheckerComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Text Diff Checker — compare texts side-by-side with color-coded diffs. No sign-up required!')}&url=${encodeURIComponent(SITE_URL + '/tools/diff-checker')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/diff-checker')}`;

  // Inputs
  originalText = '';
  modifiedText = '';

  // Options
  viewMode: ViewMode = 'side-by-side';
  ignoreWhitespace = false;
  caseInsensitive = false;

  // Output
  diffLines: DiffLine[] = [];
  unifiedLines: UnifiedLine[] = [];
  copied = false;

  // Stats
  linesAdded = 0;
  linesDeleted = 0;
  linesChanged = 0;
  linesUnchanged = 0;

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  onInput() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.computeDiff(), 300);
  }

  compare() {
    this.computeDiff();
  }

  clearAll() {
    this.originalText = '';
    this.modifiedText = '';
    this.diffLines = [];
    this.unifiedLines = [];
    this.linesAdded = 0;
    this.linesDeleted = 0;
    this.linesChanged = 0;
    this.linesUnchanged = 0;
  }

  loadSample() {
    this.originalText = `function greet(name) {
  console.log("Hello, " + name);
  return true;
}

const items = [1, 2, 3];
for (let i = 0; i < items.length; i++) {
  console.log(items[i]);
}

// End of file`;

    this.modifiedText = `function greet(name, greeting) {
  const message = greeting + ", " + name + "!";
  console.log(message);
  return message;
}

const items = [1, 2, 3, 4, 5];
for (const item of items) {
  console.log(item);
}

// Updated logic
// End of file`;

    this.computeDiff();
  }

  swapTexts() {
    const temp = this.originalText;
    this.originalText = this.modifiedText;
    this.modifiedText = temp;
    this.computeDiff();
  }

  // ── Diff computation ──────────────────────────────────────────

  private computeDiff() {
    const origLines = this.originalText.split('\n');
    const modLines = this.modifiedText.split('\n');

    const prepOrig = origLines.map(l => this.prepareLine(l));
    const prepMod = modLines.map(l => this.prepareLine(l));

    // LCS-based diff
    const lcs = this.computeLCS(prepOrig, prepMod);

    this.diffLines = [];
    this.unifiedLines = [];
    this.linesAdded = 0;
    this.linesDeleted = 0;
    this.linesChanged = 0;
    this.linesUnchanged = 0;

    let oi = 0, mi = 0, li = 0;

    while (oi < origLines.length || mi < modLines.length) {
      if (li < lcs.length && oi < origLines.length && mi < modLines.length &&
          prepOrig[oi] === lcs[li] && prepMod[mi] === lcs[li]) {
        // Unchanged line
        this.diffLines.push({
          type: 'unchanged',
          leftNum: oi + 1,
          rightNum: mi + 1,
          leftText: origLines[oi],
          rightText: modLines[mi]
        });
        this.unifiedLines.push({
          type: 'unchanged',
          lineNum: oi + 1,
          prefix: ' ',
          text: origLines[oi]
        });
        this.linesUnchanged++;
        oi++; mi++; li++;
      } else if (li < lcs.length && mi < modLines.length && prepMod[mi] === lcs[li]) {
        // Deleted from original
        this.diffLines.push({
          type: 'deleted',
          leftNum: oi + 1,
          rightNum: null,
          leftText: origLines[oi],
          rightText: ''
        });
        this.unifiedLines.push({
          type: 'deleted',
          lineNum: oi + 1,
          prefix: '-',
          text: origLines[oi]
        });
        this.linesDeleted++;
        oi++;
      } else if (li < lcs.length && oi < origLines.length && prepOrig[oi] === lcs[li]) {
        // Added in modified
        this.diffLines.push({
          type: 'added',
          leftNum: null,
          rightNum: mi + 1,
          leftText: '',
          rightText: modLines[mi]
        });
        this.unifiedLines.push({
          type: 'added',
          lineNum: mi + 1,
          prefix: '+',
          text: modLines[mi]
        });
        this.linesAdded++;
        mi++;
      } else if (oi < origLines.length && mi < modLines.length) {
        // Changed line (both sides differ and neither matches the LCS)
        this.diffLines.push({
          type: 'changed',
          leftNum: oi + 1,
          rightNum: mi + 1,
          leftText: origLines[oi],
          rightText: modLines[mi]
        });
        this.unifiedLines.push({
          type: 'deleted',
          lineNum: oi + 1,
          prefix: '-',
          text: origLines[oi]
        });
        this.unifiedLines.push({
          type: 'added',
          lineNum: mi + 1,
          prefix: '+',
          text: modLines[mi]
        });
        this.linesChanged++;
        oi++; mi++;
      } else if (oi < origLines.length) {
        // Remaining deleted
        this.diffLines.push({
          type: 'deleted',
          leftNum: oi + 1,
          rightNum: null,
          leftText: origLines[oi],
          rightText: ''
        });
        this.unifiedLines.push({
          type: 'deleted',
          lineNum: oi + 1,
          prefix: '-',
          text: origLines[oi]
        });
        this.linesDeleted++;
        oi++;
      } else {
        // Remaining added
        this.diffLines.push({
          type: 'added',
          leftNum: null,
          rightNum: mi + 1,
          leftText: '',
          rightText: modLines[mi]
        });
        this.unifiedLines.push({
          type: 'added',
          lineNum: mi + 1,
          prefix: '+',
          text: modLines[mi]
        });
        this.linesAdded++;
        mi++;
      }
    }

    // Easter egg: identical texts
    if (this.originalText.length > 0 && this.modifiedText.length > 0 &&
        this.linesAdded === 0 && this.linesDeleted === 0 && this.linesChanged === 0) {
      this.eggs.trigger('diff-identical');
    }
  }

  // ── LCS (Longest Common Subsequence) ─────────────────────────

  private computeLCS(a: string[], b: string[]): string[] {
    const m = a.length;
    const n = b.length;

    // Build DP table
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to find the LCS
    const lcs: string[] = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) {
        lcs.unshift(a[i - 1]);
        i--; j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    return lcs;
  }

  private prepareLine(line: string): string {
    let result = line;
    if (this.ignoreWhitespace) {
      result = result.replace(/\s+/g, ' ').trim();
    }
    if (this.caseInsensitive) {
      result = result.toLowerCase();
    }
    return result;
  }

  // ── Clipboard ─────────────────────────────────────────────────

  async copyDiff() {
    if (!this.isBrowser) return;
    const output = this.buildDiffOutput();
    if (!output) return;

    try {
      await navigator.clipboard.writeText(output);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(output);
    }
  }

  private fallbackCopy(text: string) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    this.copied = true;
    setTimeout(() => (this.copied = false), 2000);
  }

  private buildDiffOutput(): string {
    if (this.unifiedLines.length === 0) return '';
    return this.unifiedLines
      .map(l => `${l.prefix} ${l.text}`)
      .join('\n');
  }

  // ── Helpers ───────────────────────────────────────────────────

  get hasDiff(): boolean {
    return this.diffLines.length > 0;
  }

  get totalChanges(): number {
    return this.linesAdded + this.linesDeleted + this.linesChanged;
  }

  escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
