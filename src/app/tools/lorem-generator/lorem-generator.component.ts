import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

type GenerateMode = 'paragraphs' | 'sentences' | 'words';
type TextVariant = 'classic' | 'hipster' | 'tech';

@Component({
    selector: 'app-lorem-generator',
    templateUrl: './lorem-generator.component.html',
    styleUrls: ['./lorem-generator.component.css'],
    imports: [ToolsSharedModule, FormsModule, DecimalPipe]
})
export class LoremGeneratorComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Lorem Ipsum Generator — paragraphs, sentences, words with fun variants. No sign-up required!')}&url=${encodeURIComponent(SITE_URL + '/tools/lorem-generator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/lorem-generator')}`;

  // Options
  mode: GenerateMode = 'paragraphs';
  variant: TextVariant = 'classic';
  amount = 3;
  startWithLorem = true;
  wrapHtml = false;

  // Output
  output = '';
  copied = false;

  // Stats
  wordCount = 0;
  charCount = 0;
  paragraphCount = 0;

  // ── Classic lorem ipsum corpus ──────────────────────────────────────────

  private readonly classicWords = [
    'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
    'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
    'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
    'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
    'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
    'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
    'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
    'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum', 'vitae', 'elementum',
    'curabitur', 'blandit', 'tempus', 'porttitor', 'auctor', 'neque', 'ornare',
    'aenean', 'euismod', 'pellentesque', 'habitant', 'morbi', 'tristique',
    'senectus', 'netus', 'malesuada', 'fames', 'ac', 'turpis', 'egestas',
    'maecenas', 'pharetra', 'convallis', 'posuere', 'leo', 'urna', 'molestie',
    'viverra', 'lacus', 'vel', 'facilisis', 'volutpat', 'vulputate', 'dignissim',
    'suspendisse', 'interdum', 'imperdiet', 'massa', 'tincidunt', 'nunc', 'pulvinar',
    'sapien', 'ligula', 'ultrices', 'gravida', 'dictum', 'felis', 'tortor',
    'pretium', 'nibh', 'praesent', 'semper', 'feugiat', 'diam', 'donec',
    'adipisicing', 'faucibus', 'scelerisque', 'eleifend', 'integer'
  ];

  private readonly hipsterWords = [
    'artisan', 'kombucha', 'vinyl', 'organic', 'aesthetic', 'brunch', 'selfie',
    'avocado', 'toast', 'craft', 'beer', 'fixie', 'portland', 'brooklyn',
    'sustainable', 'vegan', 'gluten-free', 'cold-brew', 'latte', 'matcha',
    'skateboard', 'flannel', 'vintage', 'typewriter', 'polaroid', 'retro',
    'farm-to-table', 'single-origin', 'fair-trade', 'artisanal', 'handcrafted',
    'microbrew', 'gastropub', 'heirloom', 'normcore', 'dreamcatcher',
    'thundercats', 'literally', 'irony', 'lo-fi', 'synth', 'chillwave',
    'bushwick', 'williamsburg', 'shoreditch', 'edison', 'bulb', 'mason', 'jar',
    'succulent', 'terrarium', 'minimalist', 'hygge', 'wanderlust', 'curated',
    'bespoke', 'pour-over', 'cortado', 'espresso', 'barista', 'sourdough',
    'fermented', 'kimchi', 'sriracha', 'umami', 'foraged', 'truffle',
    'deconstructed', 'elevated', 'plant-based', 'oat-milk', 'adaptogen',
    'mindful', 'intentional', 'slow-living', 'wabi-sabi', 'kinfolk',
    'analog', 'cassette', 'zine', 'letterpress', 'calligraphy', 'macrame',
    'terrazzo', 'rattan', 'linen', 'ceramic', 'stoneware', 'enamel',
    'reclaimed', 'upcycled', 'thrifted', 'secondhand', 'patchwork'
  ];

  private readonly techWords = [
    'algorithm', 'blockchain', 'kubernetes', 'docker', 'microservice', 'serverless',
    'typescript', 'javascript', 'python', 'rust', 'golang', 'webpack', 'vite',
    'angular', 'react', 'svelte', 'component', 'middleware', 'api', 'graphql',
    'mutation', 'subscription', 'websocket', 'http', 'restful', 'endpoint',
    'deployment', 'pipeline', 'terraform', 'ansible', 'nginx', 'redis',
    'postgres', 'mongodb', 'elasticsearch', 'kafka', 'rabbitmq', 'prometheus',
    'grafana', 'observable', 'async', 'await', 'promise', 'callback', 'closure',
    'prototype', 'interface', 'abstraction', 'polymorphism', 'inheritance',
    'encapsulation', 'refactor', 'sprint', 'scrum', 'kanban', 'agile',
    'git', 'merge', 'rebase', 'commit', 'branch', 'repository', 'pull-request',
    'code-review', 'linting', 'testing', 'unit-test', 'integration', 'ci-cd',
    'devops', 'cloud', 'lambda', 'container', 'orchestration', 'load-balancer',
    'cache', 'cdn', 'ssl', 'oauth', 'jwt', 'token', 'hash', 'encryption',
    'binary', 'compiler', 'runtime', 'garbage-collector', 'heap', 'stack',
    'recursion', 'iteration', 'singleton', 'factory', 'observer', 'decorator',
    'dependency-injection', 'monorepo', 'npm', 'yarn', 'node', 'deno', 'bun'
  ];

  constructor(private router: Router) {}

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Mode / option changes ──────────────────────────────────────────────

  setMode(m: GenerateMode) {
    this.mode = m;
    this.output = '';
    this.resetStats();
  }

  setVariant(v: TextVariant) {
    this.variant = v;
    if (this.output) this.generate();
  }

  onAmountChange() {
    if (this.amount < 1) this.amount = 1;
    const max = this.mode === 'paragraphs' ? 50 : this.mode === 'sentences' ? 200 : 1000;
    if (this.amount > max) this.amount = max;
  }

  // ── Generation ─────────────────────────────────────────────────────────

  generate() {
    const words = this.getWordPool();
    let paragraphs: string[] = [];

    if (this.mode === 'paragraphs') {
      paragraphs = this.generateParagraphs(words, this.amount);
    } else if (this.mode === 'sentences') {
      const text = this.generateSentences(words, this.amount);
      paragraphs = [text];
    } else {
      const text = this.generateWords(words, this.amount);
      paragraphs = [text];
    }

    // Apply "start with Lorem ipsum" toggle
    if (this.startWithLorem && paragraphs.length > 0) {
      const loremStart = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';
      const first = paragraphs[0];
      if (!first.startsWith('Lorem ipsum')) {
        paragraphs[0] = loremStart + first.charAt(0).toLowerCase() + first.slice(1);
      }
    }

    if (this.wrapHtml) {
      this.output = paragraphs.map(p => `<p>${p}</p>`).join('\n\n');
    } else {
      this.output = paragraphs.join('\n\n');
    }

    this.updateStats(paragraphs);

    // Easter egg: exactly 42 paragraphs
    if (this.mode === 'paragraphs' && this.amount === 42) {
      this.eggs.trigger('lorem-42');
    }
  }

  private getWordPool(): string[] {
    switch (this.variant) {
      case 'hipster': return this.hipsterWords;
      case 'tech': return this.techWords;
      default: return this.classicWords;
    }
  }

  private generateParagraphs(words: string[], count: number): string[] {
    const paragraphs: string[] = [];
    for (let i = 0; i < count; i++) {
      const sentenceCount = this.randomInt(4, 8);
      const sentences: string[] = [];
      for (let j = 0; j < sentenceCount; j++) {
        sentences.push(this.buildSentence(words));
      }
      paragraphs.push(sentences.join(' '));
    }
    return paragraphs;
  }

  private generateSentences(words: string[], count: number): string {
    const sentences: string[] = [];
    for (let i = 0; i < count; i++) {
      sentences.push(this.buildSentence(words));
    }
    return sentences.join(' ');
  }

  private generateWords(words: string[], count: number): string {
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(words[this.randomInt(0, words.length - 1)]);
    }
    // Capitalize first word and add period at end
    if (result.length > 0) {
      result[0] = result[0].charAt(0).toUpperCase() + result[0].slice(1);
    }
    return result.join(' ') + '.';
  }

  private buildSentence(words: string[]): string {
    const len = this.randomInt(6, 16);
    const selected: string[] = [];
    for (let i = 0; i < len; i++) {
      selected.push(words[this.randomInt(0, words.length - 1)]);
    }
    // Add comma at a random midpoint for natural feel
    if (len > 8) {
      const commaPos = this.randomInt(3, len - 3);
      selected[commaPos] = selected[commaPos] + ',';
    }
    selected[0] = selected[0].charAt(0).toUpperCase() + selected[0].slice(1);
    return selected.join(' ') + '.';
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ── Stats ──────────────────────────────────────────────────────────────

  private updateStats(paragraphs: string[]) {
    const plainText = paragraphs.join('\n\n');
    this.wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length;
    this.charCount = plainText.length;
    this.paragraphCount = paragraphs.length;
  }

  private resetStats() {
    this.wordCount = 0;
    this.charCount = 0;
    this.paragraphCount = 0;
  }

  // ── Actions ────────────────────────────────────────────────────────────

  clearAll() {
    this.output = '';
    this.resetStats();
  }

  async copyOutput() {
    if (!this.output || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.output);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(this.output);
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
    this.copied = true;
    setTimeout(() => (this.copied = false), 2000);
  }

  get maxAmount(): number {
    return this.mode === 'paragraphs' ? 50 : this.mode === 'sentences' ? 200 : 1000;
  }

  get modeLabel(): string {
    return this.mode === 'paragraphs' ? 'paragraphs' : this.mode === 'sentences' ? 'sentences' : 'words';
  }
}
