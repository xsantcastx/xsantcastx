import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { getToken } from '@angular/fire/app-check';
import { Observable, from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { whenAppCheckReady } from './app-check.bootstrap';

@Injectable()
export class AppCheckInterceptor implements HttpInterceptor {
  private readonly protectedOrigins = environment.appCheck?.protectedOrigins ?? [];

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Cheap check first, so the overwhelmingly common "not a protected
    // origin" case never touches App Check at all.
    if (!this.requiresAppCheck(req.url)) {
      return next.handle(req);
    }

    // App Check is initialized on idle rather than at bootstrap (see
    // app-check.bootstrap.ts), so a protected request that fires early has to
    // wait for it. Requests to protected origins are user-initiated, well
    // after that window, so in practice this resolves immediately.
    return from(whenAppCheckReady()).pipe(
      switchMap(appCheck => {
        if (!appCheck) {
          return next.handle(req);
        }
        return from(getToken(appCheck, false)).pipe(
          switchMap(({ token }) => {
            const headers = req.headers.set('X-Firebase-AppCheck', token);
            return next.handle(req.clone({ headers }));
          })
        );
      }),
      catchError(error => {
        console.error('[AppCheckInterceptor] Failed to obtain App Check token', error);
        return throwError(() => error);
      })
    );
  }

  private requiresAppCheck(url: string): boolean {
    if (!this.protectedOrigins.length) {
      return false;
    }

    if (!url.startsWith('http')) {
      return false;
    }

    try {
      const requestUrl = new URL(url);
      return this.protectedOrigins.some(origin => {
        try {
          const protectedUrl = new URL(origin);
          return requestUrl.origin === protectedUrl.origin || url.startsWith(origin);
        } catch {
          return url.startsWith(origin);
        }
      });
    } catch {
      return false;
    }
  }
}
