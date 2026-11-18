/**
 * store-parts.ts — the small shared pieces of the projects store: the top bar, the
 * CTA button, the footer and the Cronta sample screens. Styled by store.css
 * (ViewEncapsulation.None, so a card or a slide can set data-skin and re-skin them).
 */
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, model } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PROJECTS, StoreProject, projectUrl } from './projects.data';

@Component({
  selector: 'app-store-cta',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    @if (project().cta.disabled) {
      <button type="button" class="btn btn-primary" [class.btn-lg]="large()" [class.btn-block]="block()" aria-disabled="true">
        {{ project().cta.label }}
      </button>
    } @else if (project().cta.route) {
      <a class="btn btn-primary" [class.btn-lg]="large()" [class.btn-block]="block()" [routerLink]="project().cta.route">
        {{ project().cta.label }}
      </a>
    } @else {
      <a class="btn btn-primary" [class.btn-lg]="large()" [class.btn-block]="block()" [href]="project().cta.href" target="_blank" rel="noopener">
        {{ project().cta.label }}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>
        <span class="sr-only">(opens in a new tab)</span>
      </a>
    }
  `,
  host: { style: 'display: contents' },
})
export class StoreCtaComponent {
  readonly project = input.required<StoreProject>();
  readonly large = input(false);
  readonly block = input(false);
}

@Component({
  selector: 'app-store-topbar',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <header class="topbar">
      <div class="topbar-in">
        @if (back()) {
          <a class="topbar-back" routerLink="/">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
            Store
          </a>
        }
        <a class="brand" routerLink="/" aria-label="xsantcastx, all projects">
          <span class="brand-tile" aria-hidden="true">x</span>
          <span>xsantcastx</span>
          <span class="brand-sub" aria-hidden="true">Projects</span>
        </a>
        <span class="topbar-spacer"></span>
        @if (searchable()) {
          <div class="search" role="search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
            <input type="search" name="q" autocomplete="off" aria-label="Search projects" placeholder="Search projects"
                   [value]="query()" (input)="query.set($any($event.target).value)">
          </div>
        }
      </div>
    </header>
  `,
})
export class StoreTopbarComponent {
  readonly back = input(false);
  readonly searchable = input(false);
  readonly query = model('');
}

@Component({
  selector: 'app-store-footer',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <footer class="footer">
      <div class="footer-in">
        <p>&copy; {{ year }} xsantcastx</p>
        <nav aria-label="Projects">
          <ul>
            @for (p of projects; track p.id) {
              <li><a [routerLink]="url(p)">{{ p.name }}</a></li>
            }
          </ul>
        </nav>
      </div>
    </footer>
  `,
})
export class StoreFooterComponent {
  readonly projects = PROJECTS;
  readonly year = new Date().getFullYear();
  url = projectUrl;
}

/** Cronta sample screens, drawn with the Cronta tokens (data-skin="cronta" on an ancestor). Sample names only. */
@Component({
  selector: 'app-cronta-mock',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="mock" role="img" [attr.aria-label]="label()">
      @switch (kind()) {
        @case ('cronta-clock') {
          <div class="mock-phone" aria-hidden="true">
            <div class="mock-bar"><img src="/assets/projects/cronta/symbol.svg" alt="" width="18" height="18"> Cronta</div>
            <div class="mock-time">09:02</div>
            <div class="mock-who">Sam · Front counter</div>
            <div class="mock-btn mock-btn-line">Start break</div>
            <div class="mock-btn mock-btn-accent">Clock in</div>
          </div>
        }
        @case ('cronta-whos-in') {
          <div class="mock-card" aria-hidden="true">
            <h4>Who's in</h4>
            <div class="mock-row"><b>Sam</b><span class="mock-status mock-good"><i></i>Working</span></div>
            <div class="mock-row"><b>Alex</b><span class="mock-status mock-warn"><i></i>On break</span></div>
            <div class="mock-row"><b>Jo</b><span class="mock-status mock-good"><i></i>Working</span></div>
            <div class="mock-row"><b>Kim</b><span class="mock-status mock-muted"><i></i>Not in</span></div>
          </div>
        }
        @case ('cronta-week') {
          <div class="mock-week" aria-hidden="true">
            <div class="mock-week-head"><span>Plan the week</span><span class="mock-publish">Publish</span></div>
            <div class="mock-grid">
              <span></span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span>
              <span class="nm">Sam</span><span class="sh">Open</span><span class="sh">Open</span><span class="off"></span><span class="sh">Open</span><span class="sh">Open</span>
              <span class="nm">Alex</span><span class="off"></span><span class="sh">Close</span><span class="sh">Close</span><span class="sh">Close</span><span class="off"></span>
              <span class="nm">Jo</span><span class="sh">Close</span><span class="off"></span><span class="sh">Open</span><span class="off"></span><span class="sh">Close</span>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class CrontaMockComponent {
  readonly kind = input.required<string>();
  readonly label = input('Sample Cronta screen');
}
