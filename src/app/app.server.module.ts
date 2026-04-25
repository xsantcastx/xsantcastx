import { NgModule, ErrorHandler, Inject, Optional } from '@angular/core';
import { ServerModule } from '@angular/platform-server';
import { DOCUMENT } from '@angular/common';
import { AppModule } from './app.module';
import { AppComponent } from './app.component';

/**
 * Capture every error thrown during SSR prerender and emit a single,
 * structured, greppable log line so the build-health-monitor agent can
 * detect swallowed per-route failures post-hoc — even when the build
 * itself exits zero thanks to this handler + the domino postinstall patch.
 *
 * Without this, NotYetImplemented and other prerender errors either
 * crashed the worker (pre Angular 21 upgrade) or silently disappeared,
 * which left CI green while the rendered HTML for the affected route
 * was a stub. See Agent Backlog 34be6899-* for context.
 *
 * Log format (single line per error, easy to grep):
 *   [SSR-SWALLOWED] route=<url> kind=<NotYetImplemented|Other> msg=<truncated, no newlines>
 *
 * For non-NotYetImplemented errors, a second line follows with the top
 * frames of the stack so postmortems don't have to rebuild the prerender:
 *   [SSR-SWALLOWED-STACK] route=<url> <frame> | <frame> | <frame>
 *
 * scripts/check-prerender-health.js parses these lines.
 */
class SsrErrorHandler implements ErrorHandler {
  constructor(@Optional() @Inject(DOCUMENT) private readonly document: Document | null) {}

  handleError(error: unknown): void {
    const msg = error instanceof Error ? error.message : String(error);
    const kind = msg === 'NotYetImplemented' ? 'NotYetImplemented' : 'Other';
    const route = this.routeForCurrentRender();
    const truncated = (msg.length > 200 ? msg.slice(0, 200) + '…' : msg).replace(/\s+/g, ' ');

    // console.warn is non-fatal but distinct from console.log — the build-health-monitor
    // agent can grep stderr for the prefix and surface counts per-route.
    console.warn(`[SSR-SWALLOWED] route=${route} kind=${kind} msg=${truncated}`);

    if (kind !== 'NotYetImplemented' && error instanceof Error && error.stack) {
      const frames = error.stack
        .split('\n')
        .slice(1, 4) // skip the "Error: msg" header, take the next 3 frames
        .map(f => f.trim())
        .filter(Boolean)
        .join(' | ');
      if (frames) {
        console.warn(`[SSR-SWALLOWED-STACK] route=${route} ${frames}`);
      }
    }
  }

  /**
   * Best-effort: in @angular/build:application prerender, each route gets
   * its own bootstrap with `document.location` set to the prerender URL.
   * We prefer `pathname` so the marker is identical regardless of host.
   */
  private routeForCurrentRender(): string {
    try {
      const loc = this.document?.location;
      if (loc && loc.pathname) return loc.pathname;
      const url = this.document?.URL;
      if (url) {
        try {
          return new URL(url).pathname;
        } catch {
          return url;
        }
      }
    } catch {
      // fall through
    }
    return '<unknown>';
  }
}

@NgModule({
  imports: [AppModule, ServerModule],
  bootstrap: [AppComponent],
  providers: [
    { provide: ErrorHandler, useClass: SsrErrorHandler },
  ],
})
export class AppServerModule {}
