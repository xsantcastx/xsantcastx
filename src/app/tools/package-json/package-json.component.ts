import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

interface ScriptEntry { key: string; value: string; }

@Component({
    selector: 'app-package-json',
    templateUrl: './package-json.component.html',
    styleUrls: ['./package-json.component.css'],
    imports: [FormsModule, ToolsSharedModule]
})
export class PackageJsonComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free package.json Builder — visual editor with script presets!')}&url=${encodeURIComponent(SITE_URL + '/tools/package-json')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/package-json')}`;

  name = 'my-project';
  version = '1.0.0';
  description = '';
  main = 'index.js';
  author = '';
  license = 'MIT';
  private_ = false;
  type: 'commonjs' | 'module' = 'commonjs';
  scripts: ScriptEntry[] = [
    { key: 'start', value: 'node index.js' },
    { key: 'test', value: 'echo "Error: no test specified" && exit 1' },
  ];
  keywords: string[] = [];
  newKeyword = '';
  copied = false;

  readonly scriptPresets: Record<string, ScriptEntry[]> = {
    'Node.js': [
      { key: 'start', value: 'node index.js' },
      { key: 'dev', value: 'nodemon index.js' },
      { key: 'test', value: 'jest' },
    ],
    'React': [
      { key: 'start', value: 'react-scripts start' },
      { key: 'build', value: 'react-scripts build' },
      { key: 'test', value: 'react-scripts test' },
      { key: 'eject', value: 'react-scripts eject' },
    ],
    'TypeScript': [
      { key: 'build', value: 'tsc' },
      { key: 'dev', value: 'ts-node src/index.ts' },
      { key: 'lint', value: 'eslint src/' },
      { key: 'test', value: 'jest --config jest.config.ts' },
    ],
    'Vite': [
      { key: 'dev', value: 'vite' },
      { key: 'build', value: 'vite build' },
      { key: 'preview', value: 'vite preview' },
    ],
  };

  constructor(private router: Router) {}

  goBack() { this.router.navigate(['/tools']); }

  onVersionChange() {
    if (this.version === '0.0.0') {
      this.eggs.trigger('pkg-zero');
    }
  }

  addScript() {
    this.scripts.push({ key: '', value: '' });
  }

  removeScript(i: number) {
    this.scripts.splice(i, 1);
  }

  loadPreset(name: string) {
    this.scripts = this.scriptPresets[name].map(s => ({ ...s }));
  }

  addKeyword() {
    if (!this.newKeyword.trim()) return;
    this.keywords.push(this.newKeyword.trim());
    this.newKeyword = '';
  }

  removeKeyword(i: number) {
    this.keywords.splice(i, 1);
  }

  get output(): string {
    const pkg: any = { name: this.name, version: this.version };
    if (this.description) pkg.description = this.description;
    if (this.main) pkg.main = this.main;
    if (this.type !== 'commonjs') pkg.type = this.type;
    const scripts: any = {};
    for (const s of this.scripts) { if (s.key && s.value) scripts[s.key] = s.value; }
    if (Object.keys(scripts).length) pkg.scripts = scripts;
    if (this.keywords.length) pkg.keywords = this.keywords;
    if (this.author) pkg.author = this.author;
    pkg.license = this.license;
    if (this.private_) pkg.private = true;
    return JSON.stringify(pkg, null, 2);
  }

  async copyOutput() {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.output);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {}
  }
}
