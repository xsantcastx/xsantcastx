import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Routes, provideRouter, Router } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';

import { APP_ROUTES } from './app-routing.module';
import { CANONICAL_REDIRECTS } from './shared/canonical-routes';

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

  function redirectSource(path: string | undefined): string {
    return path ? '/' + path : '/';
  }

  function redirectDest(to: string): string {
    return to.startsWith('/') ? to : '/' + to;
  }

  for (const redirect of CANONICAL_REDIRECTS) {
    const from = redirectSource(redirect.path);
    const to = redirectDest(redirect.redirectTo as string);
    it(`redirects ${from} → ${to}`, async () => {
      await router.navigateByUrl(from);
      expect(router.url).toBe(to);
    });
  }

  it('keeps /arena/color-memory on the game route', async () => {
    await router.navigateByUrl('/arena/color-memory');
    expect(router.url).toBe('/arena/color-memory');
    expect(leafPath(router)).toBe('arena/color-memory');
    expect(leafPath(router)).not.toBe('world/trials');
  });

  it('redirects /tools → /world', async () => {
    await router.navigateByUrl('/tools');
    expect(router.url).toBe('/world');
  });

  it('redirects /tools/box-shadow-generator → /world', async () => {
    await router.navigateByUrl('/tools/box-shadow-generator');
    expect(router.url).toBe('/world');
  });

  it('redirects /tools?realm=luminous → /world', async () => {
    await router.navigateByUrl('/tools?realm=luminous');
    expect(router.url.split('?')[0]).toBe('/world');
  });

  it('redirects /mission-control → /world', async () => {
    await router.navigateByUrl('/mission-control');
    expect(router.url).toBe('/world');
  });

  it('redirects retired product pages to /world', async () => {
    for (const from of ['/mcp', '/blueprint', '/sponsors', '/donate', '/pro', '/embed', '/embed/json-formatter']) {
      await router.navigateByUrl(from);
      expect(router.url).toBe('/world');
    }
  });

  const pages = ['/character', '/world', '/forge/runes', '/world/trials', '/world/quests', '/sanctum', '/market', '/codex'] as const;

  for (const url of pages) {
    it(`resolves ${url} (not 404)`, async () => {
      await router.navigateByUrl(url);
      expect(router.url).toBe(url);
      expect(leafPath(router)).not.toBe('**');
    });
  }

  it('APP_ROUTES consumes the shared redirect table', () => {
    for (const redirect of CANONICAL_REDIRECTS) {
      expect(APP_ROUTES).toContain(redirect);
    }
  });
});
