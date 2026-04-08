import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

interface CheckItem {
  text: string;
  checked: boolean;
}

@Component({
  selector: 'app-checklist',
  templateUrl: './checklist.component.html',
  styleUrls: ['./checklist.component.css'],
  standalone: false
})
export class ChecklistComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Checklist Maker — create checklists, export as Markdown!')}&url=${encodeURIComponent(SITE_URL + '/tools/checklist')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/checklist')}`;

  items: CheckItem[] = [];
  newItemText = '';
  copied = false;

  readonly templates: Record<string, CheckItem[]> = {
    'Code Review': [
      { text: 'Code compiles without errors', checked: false },
      { text: 'No console.log statements left', checked: false },
      { text: 'Unit tests pass', checked: false },
      { text: 'No hardcoded values', checked: false },
      { text: 'Error handling is implemented', checked: false },
      { text: 'Code follows style guide', checked: false },
      { text: 'No security vulnerabilities', checked: false },
    ],
    'Deploy': [
      { text: 'All tests pass', checked: false },
      { text: 'Environment variables set', checked: false },
      { text: 'Database migrations run', checked: false },
      { text: 'Backup created', checked: false },
      { text: 'Monitoring alerts configured', checked: false },
      { text: 'Rollback plan documented', checked: false },
    ],
    'PR': [
      { text: 'Branch is up to date with main', checked: false },
      { text: 'PR description is clear', checked: false },
      { text: 'Screenshots attached if UI change', checked: false },
      { text: 'Tests added for new features', checked: false },
      { text: 'No merge conflicts', checked: false },
      { text: 'Reviewers assigned', checked: false },
    ],
  };

  constructor(private router: Router) {}

  goBack() { this.router.navigate(['/tools']); }

  addItem() {
    if (!this.newItemText.trim()) return;
    this.items.push({ text: this.newItemText.trim(), checked: false });
    this.newItemText = '';
  }

  removeItem(i: number) {
    this.items.splice(i, 1);
  }

  toggleItem(i: number) {
    this.items[i].checked = !this.items[i].checked;
    if (this.items.length > 0 && this.items.every(item => item.checked)) {
      this.eggs.trigger('checklist-complete');
    }
  }

  loadTemplate(name: string) {
    this.items = this.templates[name].map(t => ({ ...t }));
  }

  get checkedCount(): number {
    return this.items.filter(i => i.checked).length;
  }

  get progress(): number {
    return this.items.length ? Math.round((this.checkedCount / this.items.length) * 100) : 0;
  }

  exportMarkdown(): string {
    return this.items.map(i => `- [${i.checked ? 'x' : ' '}] ${i.text}`).join('\n');
  }

  async copyMarkdown() {
    if (!this.items.length || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.exportMarkdown());
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {}
  }

  clearAll() {
    this.items = [];
    this.newItemText = '';
  }
}
