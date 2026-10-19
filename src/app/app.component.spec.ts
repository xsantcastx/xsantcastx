/**
 * app.component.spec.ts — the shell instantiates, and its overlays are siblings.
 *
 * What used to be here was the Angular CLI's scaffold: three tests, one of which
 * asserted that `.content span` reads "xsantcastx app is running!". That markup
 * was deleted before the first feature shipped, and the assertion had been
 * failing on every clean checkout since — not on its own claim, but on NG0304,
 * because `fixture.detectChanges()` renders a template that now mounts about
 * twenty child components the TestBed does not declare. A test that cannot reach
 * its own assertion is not guarding anything.
 *
 * The replacement renders the shell against `NO_ERRORS_SCHEMA` and checks the
 * one structural property of this template that is genuinely load-bearing and
 * genuinely easy to break: every full-viewport overlay is a *sibling* of
 * `<main>`, never a descendant of it. `routeFadeIn` leaves a transform on every
 * routed host, which makes it a containing block, so a `position: fixed` overlay
 * moved inside `<main>` is pinned to the page instead of the viewport. That has
 * already cost this repo several releases; see the comments in
 * app.component.html.
 */
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AppComponent } from './app.component';
import { CloudSaveService } from './shared/cloud-save/cloud-save.service';

describe('AppComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [RouterTestingModule],
    declarations: [AppComponent],
    // The shell mounts about twenty feature components, every one of which
    // would need its own module here to render. None of them is what this
    // spec is about.
    schemas: [NO_ERRORS_SCHEMA],
  }));

  // Cross-save (docs/handoff/cross-save.md): the shell is the only thing
  // mounted on every load now, so it is what has to resume a signed-in
  // device. When a header chip did this and the chip was deleted, sync
  // silently stopped for every returning player.
  it('resumes cloud save on every load', () => {
    const init = spyOn(CloudSaveService.prototype, 'init');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('creates the shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.title).toEqual('xsantcastx');
  });

  it('renders the router outlet inside <main>, with a skip link before it', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const main = el.querySelector('main#main-content');
    expect(main).toBeTruthy();
    expect(main!.querySelector('router-outlet')).toBeTruthy();

    const skip = el.querySelector('a.skip-to-main');
    expect(skip).toBeTruthy();
    expect(skip!.getAttribute('href')).toBe('#main-content');
  });

  it('carries no site chrome: the game is the whole page (game-only shell)', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    for (const tag of ['app-header', 'app-footer', 'app-command-palette', 'app-deferred-overlays', 'app-place-banner-outlet', 'app-godforge-loader', 'app-forge-scene']) {
      expect(el.querySelector(tag)).withContext(`${tag} is site chrome`).toBeNull();
    }
  });

  it('keeps every full-viewport overlay a sibling of <main>, not a child', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    // Each of these is position: fixed and full-viewport. Inside <main> the
    // route fade's transform would trap it against the page.
    const overlays = [
      'app-cloud-save-merge-dialog',
      'app-device-lease-banner',
      'app-site-notice-outlet',
      'app-cookie-banner',
    ];
    const main = el.querySelector('main#main-content')!;
    for (const tag of overlays) {
      const node = el.querySelector(tag);
      expect(node)
        .withContext(`${tag} is not in the shell at all`)
        .toBeTruthy();
      expect(main.contains(node!))
        .withContext(`${tag} must be a sibling of <main>, not a descendant`)
        .toBe(false);
    }
  });
});
