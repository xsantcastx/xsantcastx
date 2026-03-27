import { Component, OnInit, OnDestroy, inject, PLATFORM_ID, HostListener } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';

export interface Tool {
  id: string;
  name: string;
  desc: string;
  route: string;
  category: string;
  icon: string;
  features: string[];
}

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css'],
  standalone: false
})
export class LandingComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private firestore = inject(Firestore);
  private router = inject(Router);

  activeCategory = 'All';
  searchQuery = '';
  spotlightIndex = 0;
  subscribeEmail = '';
  subscribeStatus: 'idle' | 'loading' | 'success' | 'error' = 'idle';

  readonly categories = ['All', 'CSS Tools', 'Email Tools', 'Security Tools', 'Code Converters', 'Productivity'];

  readonly tools: Tool[] = [
    {
      id: 'box-shadow',
      name: 'CSS Box Shadow Generator',
      desc: 'Design multi-layer CSS shadows visually with live preview and one-click copy.',
      route: '/tools/box-shadow-generator',
      category: 'CSS Tools',
      icon: '◻',
      features: ['Multiple shadow layers', 'Live visual preview', 'RGBA color picker', 'One-click CSS copy']
    },
    {
      id: 'color-palette',
      name: 'Color Palette Extractor',
      desc: 'Extract dominant colors from any image. Export as CSS variables, Tailwind, or JSON.',
      route: '/tools/color-palette',
      category: 'CSS Tools',
      icon: '◉',
      features: ['Dominant color extraction', 'HEX, RGB & HSL formats', 'Export CSS variables', 'Export Tailwind config']
    },
    {
      id: 'contrast-checker',
      name: 'WCAG Contrast Checker',
      desc: 'Test foreground/background pairs against WCAG AA & AAA accessibility standards.',
      route: '/tools/contrast-checker',
      category: 'CSS Tools',
      icon: '◑',
      features: ['AA & AAA compliance', 'Normal & large text', 'UI component checks', 'Color picker']
    },
    {
      id: 'email-auditor',
      name: 'Email Deliverability Auditor',
      desc: 'Audit SPF, DKIM, DMARC & MX DNS records. Get actionable fix recommendations.',
      route: '/tools/email-deliverability-auditor',
      category: 'Email Tools',
      icon: '◈',
      features: ['SPF record validation', 'DKIM DNS lookup', 'DMARC policy check', 'Fix recommendations']
    },
    {
      id: 'gmail-checker',
      name: 'Gmail Deliverability Checker',
      desc: 'Diagnose why emails land in Gmail spam. Auto-generate ready-to-copy DNS fixes.',
      route: '/tools/gmail-deliverability-checker',
      category: 'Email Tools',
      icon: '◎',
      features: ['Gmail-specific diagnostics', 'SPF auto-generator', 'Ready-to-copy DNS fixes', 'MX record lookup']
    },
    {
      id: 'ssl-inspector',
      name: 'SSL Certificate Inspector',
      desc: 'Inspect TLS cert chains, expiry dates, cipher strength, and CA reputation.',
      route: '/tools/ssl-certificate-inspector',
      category: 'Security Tools',
      icon: '⬡',
      features: ['Certificate expiry check', 'Full chain visualization', 'Weak cipher detection', 'CA reputation audit']
    },
    {
      id: 'svg-to-code',
      name: 'SVG to Code Converter',
      desc: 'Convert SVGs to React, Vue, or Angular components with props and ARIA attributes.',
      route: '/tools/svg-to-code',
      category: 'Code Converters',
      icon: '⟨⟩',
      features: ['React JSX/TSX output', 'Vue & Angular support', 'Color & size props', 'ARIA accessibility']
    },
    {
      id: 'json-formatter',
      name: 'JSON Formatter & Validator',
      desc: 'Format, validate, minify and repair JSON with live syntax checking and one-click copy.',
      route: '/tools/json-formatter',
      category: 'Code Converters',
      icon: '{}',
      features: ['Live validation', 'Syntax highlighting', 'Sort keys & minify', 'Repair broken JSON']
    },
    {
      id: 'base64-encoder',
      name: 'Base64 Encoder & Decoder',
      desc: 'Encode text or files to Base64 and decode back to text. URL-safe mode, live conversion.',
      route: '/tools/base64-encoder',
      category: 'Code Converters',
      icon: '64',
      features: ['Encode & decode text', 'URL-safe Base64', 'File drag & drop encode', 'Live conversion']
    },
    {
      id: 'regex-tester',
      name: 'Regex Tester',
      desc: 'Test regular expressions live with match highlighting, capture groups, flags and plain-English explanations.',
      route: '/tools/regex-tester',
      category: 'Code Converters',
      icon: '.*',
      features: ['Live match highlighting', 'Capture groups', 'g i m s u flags', 'Plain-English explanation']
    },
    {
      id: 'pdf-generator',
      name: 'PDF Catalog Generator',
      desc: 'Build professional product catalogs from images and export as PDF instantly.',
      route: '/tools/pdf-generator',
      category: 'Productivity',
      icon: '▤',
      features: ['Drag & drop upload', 'Multiple layout templates', 'Custom accent colors', 'Auto-save to browser']
    },
    {
      id: 'image-compressor',
      name: 'Image Compressor',
      desc: 'Compress JPEG, PNG, and WebP images in-browser. No uploads, instant download.',
      route: '/tools/image-compressor',
      category: 'Productivity',
      icon: '▣',
      features: ['JPEG, PNG & WebP', 'Batch up to 20 images', 'Live quality preview', 'No server uploads']
    }
  ];

  readonly changelog = [
    { date: 'Mar 2026', text: 'SEO improvements & Core Web Vitals optimization' },
    { date: 'Feb 2026', text: 'SVG to Code Converter & Image Compressor launched' },
    { date: 'Jan 2026', text: 'Watch Live Work / AI Mission Control launched' },
    { date: 'Dec 2025', text: 'Gmail Deliverability Checker & Email Auditor added' },
    { date: 'Nov 2025', text: 'SSR + Firebase Hosting deployed, site goes live' }
  ];

  /** Tools shown in the hero carousel — pick 5 spread across categories */
  get heroCarouselTools(): Tool[] {
    const ids = ['box-shadow', 'email-auditor', 'ssl-inspector', 'svg-to-code', 'pdf-generator'];
    return ids.map(id => this.tools.find(t => t.id === id)).filter((t): t is Tool => !!t);
  }

  get filteredTools(): Tool[] {
    const q = this.searchQuery.toLowerCase();
    return this.tools.filter(t => {
      const matchCat = this.activeCategory === 'All' || t.category === this.activeCategory;
      const matchQ = !q || t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }

  get spotlightTool(): Tool {
    return this.tools[this.spotlightIndex];
  }

  ngOnInit(): void {
    this.spotlightIndex = Math.floor(Math.random() * this.tools.length);
  }

  ngOnDestroy(): void {}

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.isBrowser) return;
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.focusSearch();
    }
  }

  setCategory(cat: string): void {
    this.activeCategory = cat;
    this.searchQuery = '';
  }

  focusSearch(): void {
    if (!this.isBrowser) return;
    const el = document.getElementById('tool-search-input') as HTMLInputElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => el.focus(), 380);
    }
  }

  async onSubscribe(): Promise<void> {
    if (!this.subscribeEmail || !this.subscribeEmail.includes('@')) return;
    this.subscribeStatus = 'loading';
    try {
      const col = collection(this.firestore, 'homepage_subscribers');
      await addDoc(col, {
        email: this.subscribeEmail,
        subscribedAt: new Date().toISOString(),
        source: 'homepage_footer_cta'
      });
      this.subscribeStatus = 'success';
      this.subscribeEmail = '';
    } catch {
      this.subscribeStatus = 'error';
    }
  }
}
