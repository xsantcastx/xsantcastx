import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { Skills, Projects } from './models/portfolio.models';

/**
 * Portfolio service — loads static JSON assets for the About/Skills sections.
 *
 * SSR note: During server-side rendering Angular's HttpClient resolves the
 * relative `assets/data/*.json` URLs against `http://ng-localhost/...` and
 * fails the prerender worker with `NotYetImplemented` / HTTP errors. Both
 * datasets are progressive-enhancement UI (the page still paints without
 * them), so we short-circuit on the server and return an empty array. The
 * browser-hydrated runtime performs the real HTTP fetch.
 *
 * Tracked in Notion: 347e6899-f10e-810a-a34c-f365f6e235f6
 */
@Injectable({
  providedIn: 'root'
})
export class PortfolioService {
  private skillsUrl = 'assets/data/skills.json';
  private projectsUrl = 'assets/data/projects.json';

  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  constructor(private http: HttpClient) {}

  getSkills(): Observable<Skills[]> {
    if (!this.isBrowser) {
      return of([]);
    }
    return this.http.get<Skills[]>(this.skillsUrl);
  }

  getProjects(): Observable<Projects[]> {
    if (!this.isBrowser) {
      return of([]);
    }
    return this.http.get<Projects[]>(this.projectsUrl);
  }
}