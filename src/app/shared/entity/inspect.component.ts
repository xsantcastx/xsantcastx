/**
 * inspect.component.ts — read-only Quick Inspect overlay.
 *
 * Desktop: side dialog. Mobile: bottom sheet. Overlay stack owns Escape.
 */
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { InspectService, type InspectView } from './inspect.service';
import { type EntityAction, type EntityFact } from './entity.model';
import { InventoryService } from '../rpg/inventory.service';

@Component({
  selector: 'app-inspect',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inspect.component.html',
  styleUrls: ['./inspect.component.css'],
})
export class InspectComponent implements OnInit, OnDestroy {
  private readonly inspect = inject(InspectService);
  private readonly inventory = inject(InventoryService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private sub?: Subscription;
  private media?: MediaQueryList;
  private mediaHandler?: () => void;

  @ViewChild('titleEl') titleEl?: ElementRef<HTMLElement>;

  view: InspectView = this.inspect.view;
  sheet = false;

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  ngOnInit(): void {
    this.inspect.start();
    this.sub = this.inspect.view$.subscribe(view => {
      const opened = view.open && !this.view.open;
      this.view = view;
      this.cdr.markForCheck();
      if (opened) {
        const focusTitle = () => this.titleEl?.nativeElement.focus();
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => focusTitle());
        else setTimeout(focusTitle, 0);
      }
    });
    if (this.isBrowser && typeof window.matchMedia === 'function') {
      this.media = window.matchMedia('(max-width: 768px)');
      this.sheet = this.media.matches;
      this.mediaHandler = () => {
        this.sheet = !!this.media?.matches;
        this.cdr.markForCheck();
      };
      this.media.addEventListener('change', this.mediaHandler);
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.media && this.mediaHandler) {
      this.media.removeEventListener('change', this.mediaHandler);
    }
  }

  close(): void {
    this.inspect.close();
  }

  retry(): void {
    this.inspect.retry();
  }

  runAction(action: EntityAction): void {
    if (action.id !== 'equip' || !action.enabled || !this.view.ref) return;
    this.inventory.init();
    this.inventory.equip(this.view.ref.id, 'weapon');
    this.inspect.retry();
  }

  factValue(fact: EntityFact): string {
    return fact.exactValue ?? fact.value;
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.view.open || event.key !== 'Tab') return;
    const root = (event.currentTarget as HTMLElement | null)?.querySelector?.('.qi') as HTMLElement | null;
    if (!root) return;
    const focusable = this.trapTargets(root);
    if (focusable.length === 0) {
      event.preventDefault();
      this.titleEl?.nativeElement.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && (active === first || active === this.titleEl?.nativeElement)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Title is tabindex=-1 so it is not in the default tab list, but it is the
   *  initial focus. It must be first in the trap or Shift+Tab leaks out. */
  trapTargets(root: HTMLElement): HTMLElement[] {
    const listed = Array.from(root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    const title = this.titleEl?.nativeElement;
    const merged = title && !listed.includes(title) ? [title, ...listed] : listed;
    return merged.filter(el => el.offsetParent !== null || el === document.activeElement);
  }
}
