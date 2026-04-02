import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

export interface TreeNode {
  key: string;
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object';
  path: string;
  dotPath: string;
  bracketPath: string;
  depth: number;
  children: TreeNode[];
  expanded: boolean;
  childCount: number;
  matchesSearch: boolean;
}

@Component({
  selector: 'app-json-path',
  templateUrl: './json-path.component.html',
  styleUrls: ['./json-path.component.css'],
  standalone: false
})
export class JsonPathComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free JSON Path Finder — paste JSON, click any node to get its path. No sign-up required!')}&url=${encodeURIComponent(SITE_URL + '/tools/json-path')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/json-path')}`;

  // Input
  jsonInput = '';

  // Tree state
  tree: TreeNode[] = [];
  selectedNode: TreeNode | null = null;
  selectedDotPath = '';
  selectedBracketPath = '';

  // Search
  searchQuery = '';

  // Validation
  validationStatus: 'idle' | 'valid' | 'invalid' = 'idle';
  errorMessage = '';

  // Stats
  nodeCount = 0;
  maxDepth = 0;

  // Copy feedback
  copiedDot = false;
  copiedBracket = false;

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Live parsing (debounced 300ms) ──────────────────────────────────────

  onInput() {
    if (!this.jsonInput.trim()) {
      this.validationStatus = 'idle';
      this.errorMessage = '';
      this.tree = [];
      this.selectedNode = null;
      this.selectedDotPath = '';
      this.selectedBracketPath = '';
      this.nodeCount = 0;
      this.maxDepth = 0;
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.parseAndBuildTree(), 300);
  }

  private parseAndBuildTree() {
    try {
      const parsed = JSON.parse(this.jsonInput);
      this.validationStatus = 'valid';
      this.errorMessage = '';
      this.nodeCount = 0;
      this.maxDepth = 0;
      this.tree = this.buildTree(parsed, '$', '$', 0);
      this.applySearch();

      // Easter egg: depth > 15
      if (this.maxDepth > 15) {
        this.eggs.trigger('json-abyss');
      }
    } catch (e: any) {
      this.validationStatus = 'invalid';
      this.errorMessage = e?.message ?? 'Invalid JSON';
      this.tree = [];
      this.nodeCount = 0;
      this.maxDepth = 0;
    }
  }

  private buildTree(value: unknown, key: string, parentPath: string, depth: number): TreeNode[] {
    this.nodeCount++;
    if (depth > this.maxDepth) this.maxDepth = depth;

    const type = this.getType(value);
    const isRoot = key === '$';
    const dotPath = isRoot ? '$' : this.buildDotPath(parentPath, key);
    const bracketPath = isRoot ? '$' : this.buildBracketPath(parentPath, key);

    const node: TreeNode = {
      key,
      value,
      type,
      path: dotPath,
      dotPath,
      bracketPath,
      depth,
      children: [],
      expanded: depth < 2,
      childCount: 0,
      matchesSearch: true
    };

    if (type === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj);
      node.childCount = keys.length;
      for (const k of keys) {
        const childNodes = this.buildTree(obj[k], k, dotPath, depth + 1);
        node.children.push(...childNodes);
      }
    } else if (type === 'array') {
      const arr = value as unknown[];
      node.childCount = arr.length;
      for (let i = 0; i < arr.length; i++) {
        const childNodes = this.buildTree(arr[i], String(i), dotPath, depth + 1);
        node.children.push(...childNodes);
      }
    }

    return [node];
  }

  private buildDotPath(parentPath: string, key: string): string {
    // Use bracket notation for array indices or keys with special chars
    if (/^\d+$/.test(key)) {
      return `${parentPath}[${key}]`;
    }
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
      return `${parentPath}.${key}`;
    }
    return `${parentPath}["${key}"]`;
  }

  private buildBracketPath(parentPath: string, key: string): string {
    if (/^\d+$/.test(key)) {
      return `${parentPath}[${key}]`;
    }
    return `${parentPath}["${key}"]`;
  }

  private getType(value: unknown): TreeNode['type'] {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    const t = typeof value;
    if (t === 'string') return 'string';
    if (t === 'number') return 'number';
    if (t === 'boolean') return 'boolean';
    if (t === 'object') return 'object';
    return 'string';
  }

  // ── Node interaction ───────────────────────────────────────────────────

  toggleNode(node: TreeNode, event: Event) {
    event.stopPropagation();
    node.expanded = !node.expanded;
  }

  selectNode(node: TreeNode) {
    this.selectedNode = node;
    this.selectedDotPath = node.dotPath;
    this.selectedBracketPath = node.bracketPath;
  }

  // ── Search / filter ────────────────────────────────────────────────────

  onSearchChange() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.applySearch(), 200);
  }

  private applySearch() {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) {
      this.markAllVisible(this.tree);
      return;
    }
    for (const node of this.tree) {
      this.markMatchingNodes(node, query);
    }
  }

  private markAllVisible(nodes: TreeNode[]) {
    for (const node of nodes) {
      node.matchesSearch = true;
      this.markAllVisible(node.children);
    }
  }

  private markMatchingNodes(node: TreeNode, query: string): boolean {
    const keyMatch = node.key.toLowerCase().includes(query);
    const pathMatch = node.dotPath.toLowerCase().includes(query);
    const valueMatch = this.getDisplayValue(node).toLowerCase().includes(query);

    let childMatch = false;
    for (const child of node.children) {
      if (this.markMatchingNodes(child, query)) {
        childMatch = true;
      }
    }

    node.matchesSearch = keyMatch || pathMatch || valueMatch || childMatch;

    // Auto-expand parent nodes that contain matches
    if (childMatch && !node.expanded) {
      node.expanded = true;
    }

    return node.matchesSearch;
  }

  // ── Display helpers ────────────────────────────────────────────────────

  getDisplayValue(node: TreeNode): string {
    if (node.type === 'object') return `{ ${node.childCount} key${node.childCount !== 1 ? 's' : ''} }`;
    if (node.type === 'array') return `[ ${node.childCount} item${node.childCount !== 1 ? 's' : ''} ]`;
    if (node.type === 'string') return `"${node.value}"`;
    if (node.type === 'null') return 'null';
    return String(node.value);
  }

  getTypeBadgeClass(type: string): string {
    return `jp-type-badge jp-type-badge--${type}`;
  }

  isExpandable(node: TreeNode): boolean {
    return node.type === 'object' || node.type === 'array';
  }

  // ── Clipboard ──────────────────────────────────────────────────────────

  async copyDotPath() {
    if (!this.selectedDotPath || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.selectedDotPath);
      this.copiedDot = true;
      setTimeout(() => (this.copiedDot = false), 2000);
    } catch {
      this.fallbackCopy(this.selectedDotPath);
      this.copiedDot = true;
      setTimeout(() => (this.copiedDot = false), 2000);
    }
  }

  async copyBracketPath() {
    if (!this.selectedBracketPath || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.selectedBracketPath);
      this.copiedBracket = true;
      setTimeout(() => (this.copiedBracket = false), 2000);
    } catch {
      this.fallbackCopy(this.selectedBracketPath);
      this.copiedBracket = true;
      setTimeout(() => (this.copiedBracket = false), 2000);
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
  }

  // ── Actions ────────────────────────────────────────────────────────────

  loadSample() {
    this.jsonInput = JSON.stringify({
      "store": {
        "name": "JSON Path Finder",
        "location": {
          "city": "Austin",
          "state": "TX",
          "coordinates": {
            "lat": 30.2672,
            "lng": -97.7431
          }
        },
        "departments": [
          {
            "name": "Engineering",
            "employees": [
              { "id": 1, "name": "Alice", "active": true },
              { "id": 2, "name": "Bob", "active": false }
            ]
          },
          {
            "name": "Design",
            "employees": [
              { "id": 3, "name": "Charlie", "active": true }
            ]
          }
        ],
        "metadata": {
          "version": "2.0",
          "tags": ["json", "path", "finder"],
          "config": null
        }
      }
    }, null, 2);
    this.onInput();
  }

  clearAll() {
    this.jsonInput = '';
    this.tree = [];
    this.selectedNode = null;
    this.selectedDotPath = '';
    this.selectedBracketPath = '';
    this.searchQuery = '';
    this.validationStatus = 'idle';
    this.errorMessage = '';
    this.nodeCount = 0;
    this.maxDepth = 0;
  }

  expandAll() {
    this.setExpandedAll(this.tree, true);
  }

  collapseAll() {
    this.setExpandedAll(this.tree, false);
  }

  private setExpandedAll(nodes: TreeNode[], expanded: boolean) {
    for (const node of nodes) {
      if (this.isExpandable(node)) {
        node.expanded = expanded;
      }
      this.setExpandedAll(node.children, expanded);
    }
  }
}
