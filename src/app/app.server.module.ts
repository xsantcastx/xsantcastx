import { NgModule, ErrorHandler } from '@angular/core';
import { ServerModule } from '@angular/platform-server';
import { AppModule } from './app.module';
import { AppComponent } from './app.component';

/**
 * Suppress domino's NotYetImplemented errors during SSR prerendering.
 * These occur when Angular's renderer calls setProperty / outerHTML.set
 * on domino's partial DOM — non-critical because the browser applies
 * them on hydration. Without this handler the worker thread terminates
 * and the entire prerender batch fails.
 */
class SsrErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === 'NotYetImplemented') return;
    console.error('SSR Error:', error);
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
