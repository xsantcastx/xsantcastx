import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

interface TechOption {
  name: string;
  category: string;
  patterns: string[];
  selected: boolean;
}

@Component({
  selector: 'app-gitignore-generator',
  templateUrl: './gitignore-generator.component.html',
  styleUrls: ['./gitignore-generator.component.css'],
  standalone: false
})
export class GitignoreGeneratorComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free .gitignore Generator — select your tech stack and generate a .gitignore file instantly')}&url=${encodeURIComponent(SITE_URL + '/tools/gitignore-generator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/gitignore-generator')}`;

  copied = false;
  searchQuery = '';

  readonly technologies: TechOption[] = [
    { name: 'Node.js', category: 'Runtime', patterns: ['node_modules/', 'npm-debug.log*', 'yarn-debug.log*', 'yarn-error.log*', '.npm', '.yarn-integrity'], selected: false },
    { name: 'Python', category: 'Language', patterns: ['__pycache__/', '*.py[cod]', '*$py.class', '*.so', '.Python', 'env/', 'venv/', '.venv/', '*.egg-info/', 'dist/'], selected: false },
    { name: 'Java', category: 'Language', patterns: ['*.class', '*.jar', '*.war', '*.ear', 'target/', '.gradle/', 'build/'], selected: false },
    { name: 'macOS', category: 'OS', patterns: ['.DS_Store', '.AppleDouble', '.LSOverride', '._*', '.Spotlight-V100', '.Trashes'], selected: false },
    { name: 'Windows', category: 'OS', patterns: ['Thumbs.db', 'ehthumbs.db', 'Desktop.ini', '$RECYCLE.BIN/'], selected: false },
    { name: 'Linux', category: 'OS', patterns: ['*~', '.fuse_hidden*', '.Trash-*', '.nfs*'], selected: false },
    { name: 'VS Code', category: 'IDE', patterns: ['.vscode/*', '!.vscode/settings.json', '!.vscode/tasks.json', '!.vscode/launch.json', '!.vscode/extensions.json'], selected: false },
    { name: 'JetBrains', category: 'IDE', patterns: ['.idea/', '*.iws', '*.iml', '*.ipr', 'out/'], selected: false },
    { name: 'Vim', category: 'IDE', patterns: ['*.swp', '*.swo', '*~', 'Session.vim', '.netrwhist'], selected: false },
    { name: 'React', category: 'Framework', patterns: ['build/', '.env.local', '.env.development.local', '.env.test.local', '.env.production.local'], selected: false },
    { name: 'Angular', category: 'Framework', patterns: ['dist/', '.angular/', '.sass-cache/', 'connect.lock', 'coverage/', 'libpeerconnection.log'], selected: false },
    { name: 'Vue', category: 'Framework', patterns: ['dist/', '.env.local', '*.local', 'node_modules/'], selected: false },
    { name: 'Docker', category: 'DevOps', patterns: ['docker-compose.override.yml', '.docker/'], selected: false },
    { name: 'Terraform', category: 'DevOps', patterns: ['.terraform/', '*.tfstate', '*.tfstate.*', 'crash.log', '*.tfvars'], selected: false },
    { name: 'Environment', category: 'Security', patterns: ['.env', '.env.*', '!.env.example', '*.pem', '*.key'], selected: false },
    { name: 'Logs', category: 'General', patterns: ['logs/', '*.log', 'npm-debug.log*', 'pids/', '*.pid', '*.seed'], selected: false },
    { name: 'Coverage', category: 'Testing', patterns: ['coverage/', '.nyc_output/', '*.lcov', '.coverage'], selected: false },
    { name: 'Rust', category: 'Language', patterns: ['target/', 'Cargo.lock', '**/*.rs.bk'], selected: false },
    { name: 'Go', category: 'Language', patterns: ['vendor/', '*.exe', '*.test', '*.out'], selected: false },
    { name: 'Ruby', category: 'Language', patterns: ['*.gem', '.bundle/', 'vendor/bundle/', 'Gemfile.lock'], selected: false },
  ];

  constructor(private router: Router) {}

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  get filteredTechnologies(): TechOption[] {
    if (!this.searchQuery.trim()) return this.technologies;
    const q = this.searchQuery.toLowerCase();
    return this.technologies.filter(t => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  }

  get selectedCount(): number {
    return this.technologies.filter(t => t.selected).length;
  }

  toggleTech(tech: TechOption): void {
    tech.selected = !tech.selected;
    if (this.technologies.every(t => t.selected)) {
      this.eggs.trigger('gitignore-everything');
    }
  }

  selectAll(): void {
    this.technologies.forEach(t => t.selected = true);
    this.eggs.trigger('gitignore-everything');
  }

  clearAll(): void {
    this.technologies.forEach(t => t.selected = false);
  }

  get generatedOutput(): string {
    const selected = this.technologies.filter(t => t.selected);
    if (selected.length === 0) return '';
    let output = '# Generated .gitignore\n# https://xsantcastx.dev/tools/gitignore-generator\n\n';
    selected.forEach(tech => {
      output += `# ${tech.name}\n`;
      tech.patterns.forEach(p => output += `${p}\n`);
      output += '\n';
    });
    return output.trim();
  }

  async copyOutput(): Promise<void> {
    if (!this.generatedOutput || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.generatedOutput);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch { /* fallback */ }
  }

  async downloadFile(): Promise<void> {
    if (!this.generatedOutput || !this.isBrowser) return;
    const blob = new Blob([this.generatedOutput], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '.gitignore';
    a.click();
    URL.revokeObjectURL(url);
  }
}
