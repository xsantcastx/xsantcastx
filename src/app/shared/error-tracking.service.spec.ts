import { TestBed } from '@angular/core/testing';
import { ErrorTrackingService } from './error-tracking.service';

/**
 * These cover the recovery path added for the production
 * "Importing binding name 'a' is not found" wall.
 *
 * The fault it recovers from is invisible to a normal build check: Firebase
 * Hosting answers a missing chunk with the SPA shell at 200 OK rather than a
 * 404, so a page pointed at a previous deploy's file names fails inside the
 * module parser instead of at the network layer.
 */
describe('ErrorTrackingService — stale-deploy recovery', () => {
  let service: ErrorTrackingService;
  let reload: jasmine.Spy;
  let purge: jasmine.Spy;

  const RECOVERY_KEY = 'godforge-stale-deploy-recovery';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ErrorTrackingService] });
    service = TestBed.inject(ErrorTrackingService);

    sessionStorage.removeItem(RECOVERY_KEY);

    // Both are real side effects — one navigates the karma runner away.
    reload = spyOn<any>(service, 'reloadPage').and.stub();
    purge = spyOn<any>(service, 'purgeClientCaches').and.returnValue(Promise.resolve());
  });

  afterEach(() => sessionStorage.removeItem(RECOVERY_KEY));

  /** Drives the private capture() the way a window 'error' listener would. */
  const raise = (message: string) =>
    (service as any).capture({ kind: 'window.onerror', message });

  const STALE_MESSAGES = [
    "Importing binding name 'a' is not found.",
    'Loading chunk 42 failed.',
    'Failed to fetch dynamically imported module: https://xsantcastx.com/chunk-ABCD1234.js',
    "Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of \"text/html\". Strict MIME type checking is enforced for module scripts per HTML spec. is not a valid JavaScript MIME type",
    "Unexpected token '<'",
  ];

  STALE_MESSAGES.forEach((message) => {
    it(`purges and reloads once for: ${message.slice(0, 48)}…`, async () => {
      raise(message);
      await Promise.resolve();
      await Promise.resolve();

      expect(purge).toHaveBeenCalledTimes(1);
      expect(reload).toHaveBeenCalledTimes(1);
    });
  });

  it('reloads only once per tab, then reports instead of looping', async () => {
    raise("Importing binding name 'a' is not found.");
    await Promise.resolve();
    await Promise.resolve();
    expect(reload).toHaveBeenCalledTimes(1);

    // Second occurrence: the purge already happened, so this is a real build
    // fault. Reloading again would trap the visitor in a refresh loop.
    const reported = spyOn(console, 'error');
    raise("Importing binding name 'a' is not found.");
    await Promise.resolve();
    await Promise.resolve();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(purge).toHaveBeenCalledTimes(1);
    expect(reported).toHaveBeenCalled();
    const payload = reported.calls.mostRecent().args[1] as { message: string };
    expect(payload.message).toContain('[unrecovered after cache purge]');
  });

  it('leaves an ordinary application error to the normal report path', async () => {
    const reported = spyOn(console, 'error');
    raise("Cannot read properties of undefined (reading 'forge')");
    await Promise.resolve();

    expect(reload).not.toHaveBeenCalled();
    expect(purge).not.toHaveBeenCalled();
    expect(reported).toHaveBeenCalled();
    expect(reported.calls.mostRecent().args[0]).toBe('[GODFORGE ERROR]');
  });

  it('still silences known noise without recovering', async () => {
    const reported = spyOn(console, 'error');
    raise('ResizeObserver loop limit exceeded');
    await Promise.resolve();

    expect(reload).not.toHaveBeenCalled();
    expect(reported).not.toHaveBeenCalled();
  });
});

/**
 * The HTTP-cache repair step.
 *
 * Clearing Cache Storage and unregistering the worker was never enough: the
 * poisoned copy also sits in the browser's own HTTP cache, put there by a
 * `Cache-Control: immutable` that Safari honours literally and will not
 * revalidate even on a reload. The only way out is to request the address again
 * with `cache: 'reload'`, which bypasses that cache on the way in and overwrites
 * the entry on the way out.
 */
describe('ErrorTrackingService — HTTP cache repair', () => {
  let service: ErrorTrackingService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ErrorTrackingService] });
    service = TestBed.inject(ErrorTrackingService);
  });

  const origin = window.location.origin;

  it("refetches with cache: 'reload' — anything weaker leaves the poisoned entry in place", async () => {
    spyOn<any>(service, 'staleBuildUrls').and.returnValue([`${origin}/chunk-ABCD1234.js`]);
    const fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response(''));

    await (service as any).repairHttpCache();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    expect(url).toBe(`${origin}/chunk-ABCD1234.js`);
    expect(init.cache).toBe('reload');
  });

  it('survives a failing refetch, because the reload after it is what matters', async () => {
    spyOn<any>(service, 'staleBuildUrls').and.returnValue([`${origin}/chunk-ABCD1234.js`]);
    spyOn(window, 'fetch').and.rejectWith(new TypeError('offline'));

    await expectAsync((service as any).repairHttpCache()).toBeResolved();
  });

  it('collects the scripts the document declares', () => {
    const el = document.createElement('script');
    el.src = `${origin}/chunk-FROMDOC.js`;
    document.head.appendChild(el);
    try {
      expect((service as any).staleBuildUrls()).toContain(`${origin}/chunk-FROMDOC.js`);
    } finally {
      el.remove();
    }
  });

  it('skips cross-origin and non-build addresses', () => {
    spyOn(performance, 'getEntriesByType').and.returnValue([
      { name: `${origin}/chunk-KEEP1234.js` },
      { name: `${origin}/styles-KEEP5678.css` },
      { name: 'https://www.googletagmanager.com/gtag/js?id=X' }, // third party
      { name: `${origin}/assets/brand/icon-192.png` },           // not a module
      { name: `${origin}/api/send-contact` },                    // not an asset
    ] as any);

    const urls: string[] = (service as any).staleBuildUrls();

    expect(urls).toContain(`${origin}/chunk-KEEP1234.js`);
    expect(urls).toContain(`${origin}/styles-KEEP5678.css`);
    expect(urls.some((u) => u.includes('googletagmanager'))).toBeFalse();
    expect(urls.some((u) => u.endsWith('.png'))).toBeFalse();
    expect(urls.some((u) => u.endsWith('send-contact'))).toBeFalse();
  });

  it('reports each address once even when timing and the document both name it', () => {
    const el = document.createElement('script');
    el.src = `${origin}/chunk-DOUBLE12.js`;
    document.head.appendChild(el);
    spyOn(performance, 'getEntriesByType').and.returnValue(
      [{ name: `${origin}/chunk-DOUBLE12.js` }] as any,
    );
    try {
      const urls: string[] = (service as any).staleBuildUrls();
      expect(urls.filter((u) => u.endsWith('chunk-DOUBLE12.js')).length).toBe(1);
    } finally {
      el.remove();
    }
  });
});
