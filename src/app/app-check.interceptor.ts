import { Injectable, inject } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { AppCheck, getToken } from '@angular/fire/app-check';
import { Observable, from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environment';

@Injectable()
export class AppCheckInterceptor implements HttpInterceptor {
  private readonly appCheck = inject(AppCheck);
  private readonly protectedOrigins = environment.appCheck?.protectedOrigins ?? [];

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.requiresAppCheck(req.url)) {
      return next.handle(req);
    }

    return from(getToken(this.appCheck, false)).pipe(
      switchMap(({ token }) => {
        const headers = req.headers.set('X-Firebase-AppCheck', token);
        return next.handle(req.clone({ headers }));
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
