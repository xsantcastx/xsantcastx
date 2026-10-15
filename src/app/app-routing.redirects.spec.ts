import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Routes, provideRouter, Router } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';

import { APP_ROUTES } from './app-routing.module';
import { CANONICAL_REDIRECTS, INTO_PLAY, intoPlay } from './shared/canonical-routes';

@Component({ standalone: true, template: '' })
class RouteStubComponent {}

function stubLazyRoutes(routes: Routes): Routes {
  return routes.map(route => {
    const next: Routes[number] = { ...route };
    if (next.loadComponent || next.loadChildren) {
      delete next.loadComponent;
      delete next.loadChildren;
      next.component = RouteStubComponent;
    }
    if (next.children) next.children = stubLazyRoutes(next.children);
    return next;
  });
}

function leafPath(router: Router): string | undefined {
  let snap = router.routerState.snapshot.root;
  while (snap.firstChild) snap = snap.firstChild;
  return snap.routeConfig?.path;
}

describe('canonical player routing', () => {
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(stubLazyRoutes(APP_ROUTES)),
        provideLocationMocks(),
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
  });

  // Game-only shell: every retired page URL lands in the game, at the panel it
  // became when there is one, and carries its own query along.
  for (const [path, at] of Object.entries(INTO_PLAY)) {
    if (path.includes(':')) continue;
    const from = '/' + path;
    const to = intoPlay(at);
    it(`redirects ${from} → ${to}`, async () => {
      await router.navigateByUrl(from);
      expect(router.url).toBe(to);
      expect(leafPath(router)).toBe('play');
    });
  }

  it('carries the old page query into the game (/codex?tab=collection)', async () => {
    await router.navigateByUrl('/codex?tab=collection');
    expect(router.url).toBe('/play?at=codex&tab=collection');
  });

  it('sends a realm page, a retired tool and an unknown URL to the game', async () => {
    for (const url of ['/world/realms/luminous', '/tools/box-shadow-generator', '/no-such-place']) {
      await router.navigateByUrl(url);
      expect(router.url.split('?')[0]).withContext(url).toBe('/play');
      expect(leafPath(router)).withContext(url).toBe('play');
    }
  });

  it('routes nothing beside the game but the owner dashboard', () => {
    const paths = APP_ROUTES.filter(r => !r.redirectTo).map(r => r.path);
    expect(paths).toEqual(['play', 'admin']);
  });

  it('APP_ROUTES consumes the shared redirect table', () => {
    for (const redirect of CANONICAL_REDIRECTS) {
      expect(APP_ROUTES).toContain(redirect);
    }
  });
});
