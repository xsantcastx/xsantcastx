/**
 * project-detail.component.ts — `/apps/<id>`: one project's page, in that project's own design
 * system (data-skin on the page root re-skins the whole thing: hero, screenshots, lists, buttons).
 * The route supplies `projectId` in its data (app-routing.module.ts builds one route per project so
 * each prerenders with its own title, description and JSON-LD).
 */
import { ChangeDetectionStrategy, Component, ViewEncapsulation, afterNextRender, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PROJECTS, StoreProject, projectById, projectUrl } from './projects.data';
import { CrontaMockComponent, StoreCtaComponent, StoreFooterComponent, StoreTopbarComponent } from './store-parts';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [RouterLink, StoreCtaComponent, StoreTopbarComponent, StoreFooterComponent, CrontaMockComponent],
  templateUrl: './project-detail.component.html',
  styleUrl: './store.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDetailComponent {
  readonly project: StoreProject;
  readonly others: readonly StoreProject[];
  readonly url = projectUrl;
  /** Total downloads of the project's GitHub release files (null until known, or when GitHub can't be reached). */
  readonly downloads = signal<number | null>(null);
  /** The line appears once the count is meaningful (early numbers are mostly our own test downloads). */
  static readonly showDownloadsFrom = 50;

  constructor() {
    const route = inject(ActivatedRoute);
    const found = projectById(route.snapshot.data['projectId']);
    if (!found) {
      // Cannot happen for the generated routes; keeps the type honest.
      inject(Router).navigateByUrl('/');
    }
    this.project = found ?? PROJECTS[0];
    this.others = PROJECTS.filter(p => p.id !== this.project.id);
    // A link to a section (e.g. Decanter's Help › Support Decanter opens `#support`) lands on it.
    afterNextRender(() => {
      const target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
      if (target) target.scrollIntoView();
      else window.scrollTo(0, 0);
      if (this.project.downloadsRepo) void this.countDownloads(this.project.downloadsRepo);
    });
  }

  /** Sums download_count over the repo's releases (GitHub's public API; nothing about the visitor is sent). */
  private async countDownloads(repo: string): Promise<void> {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100`, { headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) return;
      const releases = (await res.json()) as { assets?: { name: string; download_count: number }[] }[];
      const total = releases.flatMap(r => r.assets ?? []).filter(a => a.name.endsWith('.dmg')).reduce((n, a) => n + a.download_count, 0);
      if (total >= ProjectDetailComponent.showDownloadsFrom) this.downloads.set(total);
    } catch {
      // Offline or rate-limited: the line simply doesn't show.
    }
  }
}
