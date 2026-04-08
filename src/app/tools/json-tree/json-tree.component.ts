import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

interface TreeNode {
  key: string;
  value: any;
  type: string;
  children?: TreeNode[];
  expanded: boolean;
  depth: number;
  visible: boolean;
}

@Component({
  selector: 'app-json-tree',
  templateUrl: './json-tree.component.html',
  styleUrls: ['./json-tree.component.css'],
  standalone: false
})
export class JsonTreeComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free JSON Tree Viewer — collapsible tree with type badges and search!')}&url=${encodeURIComponent(SITE_URL + '/tools/json-tree')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/json-tree')}`;

  input = '';
  nodes: TreeNode[] = [];
  errorMessage = '';
  searchTerm = '';
  nodeCount = 0;
  copied = false;

  constructor(private router: Router) {}

  goBack() { this.router.navigate(['/tools']); }

  parse() {
    this.errorMessage = '';
    this.nodes = [];
    this.nodeCount = 0;
    if (!this.input.trim()) return;

    try {
      const parsed = JSON.parse(this.input);
      this.nodes = this.buildTree(parsed, 'root', 0);
      this.nodeCount = this.countNodes(this.nodes);
      if (this.nodeCount >= 1000) {
        this.eggs.trigger('json-tree-forest');
      }
    } catch {
      this.errorMessage = 'Invalid JSON input.';
    }
  }

  private buildTree(value: any, key: string, depth: number): TreeNode[] {
    const type = Array.isArray(value) ? 'array' : typeof value === 'object' && value !== null ? 'object' : typeof value;
    const node: TreeNode = { key, value, type, expanded: depth < 2, depth, visible: true };

    if (type === 'object' || type === 'array') {
      const entries = type === 'array' ? value.map((v: any, i: number) => [String(i), v]) : Object.entries(value);
      node.children = [];
      for (const [k, v] of entries) {
        node.children.push(...this.buildTree(v, k, depth + 1));
      }
    }
    return [node];
  }

  private countNodes(nodes: TreeNode[]): number {
    let count = 0;
    for (const n of nodes) {
      count++;
      if (n.children) count += this.countNodes(n.children);
    }
    return count;
  }

  toggleNode(node: TreeNode) {
    node.expanded = !node.expanded;
  }

  expandAll() { this.setExpanded(this.nodes, true); }
  collapseAll() { this.setExpanded(this.nodes, false); }

  private setExpanded(nodes: TreeNode[], val: boolean) {
    for (const n of nodes) {
      n.expanded = val;
      if (n.children) this.setExpanded(n.children, val);
    }
  }

  matchesSearch(node: TreeNode): boolean {
    if (!this.searchTerm) return true;
    const term = this.searchTerm.toLowerCase();
    if (node.key.toLowerCase().includes(term)) return true;
    if (String(node.value).toLowerCase().includes(term)) return true;
    return false;
  }

  getTypeBadgeClass(type: string): string {
    return 'jt-badge--' + type;
  }

  formatValue(node: TreeNode): string {
    if (node.type === 'object') return `{${node.children?.length || 0}}`;
    if (node.type === 'array') return `[${node.children?.length || 0}]`;
    if (node.type === 'string') return `"${node.value}"`;
    return String(node.value);
  }

  clearAll() { this.input = ''; this.nodes = []; this.errorMessage = ''; this.searchTerm = ''; this.nodeCount = 0; }

  async copyInput() {
    if (!this.input || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.input);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {}
  }
}
