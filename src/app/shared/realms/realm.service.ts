/**
 * realm.service.ts — resolves the current route to a realm and tints the page.
 *
 * Route → tool → category → realm. The result is published two ways: as an
 * observable for components that want to render something, and as
 * `data-realm` + a set of `--realm-*` custom properties on `<html>` for CSS
 * that wants to tint without a component in the loop.
 *
 * That second channel is what puts a realm badge on all 126 tool pages without
 * editing 126 templates: they all share `<header class="tool-header">`, so one
 * global rule keyed on `html[data-realm]` reaches every one of them.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { TOOLS_REGISTRY } from '../../tools/tools-registry';
import { RealmDefinition, realmForCategory } from './realm.model';

@Injectable({ providedIn: 'root' })
export class RealmService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);

  private started = false;
  private readonly current$$ = new BehaviorSubject<RealmDefinition | null>(null);

  /** The realm of the page currently shown, or null off a tool page. */
  readonly current$: Observable<RealmDefinition | null> = this.current$$.asObservable();
  get current(): RealmDefinition | null { return this.current$$.value; }

  init(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.resolve(e.urlAfterRedirects));
    this.resolve(this.router.url);
  }

  /** The realm for a tool slug, for callers that already know the tool. */
  realmForTool(toolId: string): RealmDefinition | null {
    const tool = TOOLS_REGISTRY.find(t => t.id === toolId);
    return tool ? realmForCategory(tool.category) : null;
  }

  private resolve(url: string): void {
    const path = url.split('?')[0].split('#')[0];
    const tool = TOOLS_REGISTRY.find(t => t.route === path);
    const realm = tool ? realmForCategory(tool.category) : null;

    if (realm?.id === this.current?.id) return;
    this.current$$.next(realm);
    this.paint(realm);
  }

  /**
   * Write (or clear) the realm variables on the document root. Cleared on a
   * non-tool route so the cosmic palette on /home is never tinted by whichever
   * tool the visitor happened to open last.
   */
  private paint(realm: RealmDefinition | null): void {
    const root = document.documentElement;
    if (!realm) {
      root.removeAttribute('data-realm');
      ['--realm-color', '--realm-glow', '--realm-name'].forEach(v => root.style.removeProperty(v));
      return;
    }
    root.setAttribute('data-realm', realm.id);
    root.style.setProperty('--realm-color', realm.color);
    root.style.setProperty('--realm-glow', realm.glow);
    // Quoted: this one is consumed by `content:`, which needs a CSS string.
    root.style.setProperty('--realm-name', `"${realm.name}"`);
  }
}
